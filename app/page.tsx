'use client';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, or } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import React, { useState, useEffect } from 'react';

// --- TAMPILAN DEFAULT LOGIN ---
const defaultDesign = {
  nama: "Sistem Informasi Kaderisasi (SIAKAD)",
  logo: "https://i.ibb.co.com/nNhTXzYD/Asset-6-4x.png", 
  warnaUtama: "#004a87", 
  warnaAksen: "#f1c40f", 
  bgUrl: "https://www.transparenttextures.com/patterns/cubes.png",
  pengumuman: "Selamat datang di Sistem Informasi Kaderisasi PMII Sunan Ampel Malang.",
  infoTeks: [
    "Ketentuan Login Sistem:",
    "🎓 Kader: Gunakan NIM",
    "👤 Pendamping: Gunakan Username",
    "🏢 Pengurus Rayon/Komisariat: Gunakan Username",
    "Semua akses menggunakan Password yang telah diberikan. Segera ubah profil setelah berhasil masuk."
  ]
};

export default function PintuMasukSiKader() {
  const [design, setDesign] = useState(defaultDesign);
  
  const [loginId, setLoginId] = useState(''); // Diganti namanya biar lebih universal (bukan cuma kader)
  const [password, setPassword] = useState('');
  const [jawabanCaptcha, setJawabanCaptcha] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  
  const [captchaNum1, setCaptchaNum1] = useState(0);
  const [captchaNum2, setCaptchaNum2] = useState(0);

  useEffect(() => {
    setCaptchaNum1(Math.floor(Math.random() * 10) + 1);
    setCaptchaNum2(Math.floor(Math.random() * 10) + 1);
  }, []);

  // --- LOGIKA SMART GATEKEEPER (Mendeteksi NIM atau Username) ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (parseInt(jawabanCaptcha) !== (captchaNum1 + captchaNum2)) {
      alert("Jawaban matematika salah! Silakan hitung kembali.");
      return;
    }

    setIsLoggingIn(true);

    try {
      let emailUntukLogin = "";
      let peranUser = "";
      let namaUser = "";

      // 1. Cek di Database, apakah ID yang dimasukkan adalah NIM (Kader) atau Username (Pengurus)
      const q = query(
        collection(db, "users"), 
        or(
          where("nim", "==", loginId),      // Jika dia Kader
          where("username", "==", loginId), // Jika dia Pendamping / Rayon / Komisariat
          where("nia", "==", loginId)       // Opsi tambahan jika pakai NIA
        )
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        emailUntukLogin = userData.email; // Ambil email asli di balik layarnya
        peranUser = userData.role;
        namaUser = userData.nama;
      } else {
        throw new Error("Akun tidak ditemukan di sistem SIAKAD.");
      }

      // 2. Lakukan proses Auth Firebase secara rahasia di backend
      await signInWithEmailAndPassword(auth, emailUntukLogin, password);
      
      alert(`Alhamdulillah, Login Berhasil! Selamat datang, ${namaUser || loginId}.`);

      // 3. Arahkan ke Dashboard sesuai jabatannya
      if (peranUser === 'komisariat') {
        router.push('/komisariat/dashboard');
      } else if (peranUser === 'rayon') { // <--- DI SINI PERUBAHANNYA
        router.push('/rayon/dashboard');
      } else if (peranUser === 'pendamping') {
        router.push('/pendamping/dashboard');
      } else {
        router.push('/kader/dashboard');
      }
      
    } catch (error: any) {
      const pesanError = error.message.includes("Akun tidak ditemukan") 
        ? "NIM atau Username belum terdaftar. Pastikan ejaan sudah benar."
        : "Password salah atau terjadi kesalahan sistem.";
      
      alert(`Maaf, Akses Ditolak! ${pesanError}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#eef2f3', 
      backgroundImage: `url(${design.bgUrl})`,
      fontFamily: 'Arial, sans-serif',
      transition: 'all 0.5s ease',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* HEADER */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '15px 5%',
        backgroundColor: 'rgba(255,255,255,0.95)', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src={design.logo} alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', margin: 0, color: '#333', fontWeight: 'bold' }}>PK. PMII Sunan Ampel Malang</h1>
            <p style={{ margin: 0, color: design.warnaUtama, fontSize: 'clamp(0.75rem, 2vw, 0.9rem)', fontWeight: 'bold' }}>{design.nama}</p>
          </div>
        </div>
      </header>

      {/* JUDUL BESAR */}
      <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', padding: '15px 5%', borderBottom: `3px solid ${design.warnaAksen}` }}>
        <h2 style={{ letterSpacing: '2px', margin: 0, color: design.warnaUtama, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)' }}>GERBANG MASUK SIAKAD</h2>
      </div>

      {/* PENGUMUMAN */}
      <div style={{ backgroundColor: design.warnaUtama, color: 'white', padding: '10px 5%', textAlign: 'center', fontStyle: 'italic', fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', transition: 'background-color 0.5s ease' }}>
        {design.pengumuman}
      </div>

      {/* KONTEN UTAMA (RESPONSIF) */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px 5%' 
      }}>
        <div style={{
          display: 'flex', 
          flexWrap: 'wrap', 
          width: '100%',
          maxWidth: '900px', 
          backgroundColor: 'rgba(255,255,255,0.95)', 
          borderRadius: '10px', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
          overflow: 'hidden'
        }}>
          
          {/* KOLOM KIRI (INFO) */}
          <div style={{ flex: '1 1 300px', padding: '30px', borderRight: '1px solid #eee', boxSizing: 'border-box' }}>
            <h3 style={{ color: design.warnaUtama, borderBottom: '2px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>Aturan Login</h3>
            <div style={{ fontSize: '0.9rem', color: '#555', lineHeight: '1.6' }}>
              {design.infoTeks.map((teks: string, index: number) => (
                <p key={index} style={{ marginBottom: '10px', fontWeight: index > 0 && index < 4 ? 'bold' : 'normal', color: index > 0 && index < 4 ? '#2c3e50' : '#555' }}>
                  {teks}
                </p>
              ))}
            </div>
          </div>

          {/* KOLOM KANAN (FORM LOGIN) */}
          <div style={{ flex: '1 1 300px', padding: '30px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            
            <form style={{ width: '100%', maxWidth: '350px' }} onSubmit={handleLogin}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '5px', fontWeight: 'bold' }}>NIM / Username</label>
                <input 
                  type="text" 
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="NIM / Username" 
                  style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '5px', fontWeight: 'bold' }}>Password</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', letterSpacing: '3px', boxSizing: 'border-box' }} 
                />
              </div>

              {/* CAPTCHA MATEMATIKA */}
              <div style={{ marginBottom: '25px', textAlign: 'center' }}>
                <div style={{ backgroundColor: '#e8f4f8', padding: '10px', fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '5px', border: '1px dashed #ccc', color: '#333' }}>
                  {captchaNum1} + {captchaNum2} = 
                </div>
                <input 
                  type="number" 
                  required 
                  value={jawabanCaptcha}
                  onChange={(e) => setJawabanCaptcha(e.target.value)}
                  placeholder="jawab disini..." 
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderTop: 'none', textAlign: 'center', fontSize: '0.9rem', boxSizing: 'border-box' }} 
                />
              </div>

              <button disabled={isLoggingIn} type="submit" style={{ width: '100%', padding: '14px', backgroundColor: isLoggingIn ? '#95a5a6' : design.warnaUtama, border: 'none', borderRadius: '6px', fontWeight: 'bold', color: 'white', cursor: isLoggingIn ? 'not-allowed' : 'pointer', fontSize: '1rem', transition: 'background-color 0.3s ease' }}>
                {isLoggingIn ? 'Mengecek Database...' : 'Masuk Ke Sistem'}
              </button>
            </form>

          </div>
        </div>
      </main>
      
      <footer style={{ textAlign: 'center', padding: '20px 5%', color: '#777', fontSize: '0.85rem' }}>
        &copy; {new Date().getFullYear()} PMII Komisariat Sunan Ampel Malang <br/>
        Dikembangkan untuk kaderisasi yang terstruktur dan masif.
      </footer>

    </div>
  );
}