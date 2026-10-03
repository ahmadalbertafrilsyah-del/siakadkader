'use client';

import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import React, { useState, useEffect } from 'react';

// --- TAMPILAN DEFAULT LOGIN ---
const defaultDesign = {
  nama: "Sistem Informasi Akademik dan Kaderisasi",
  logo: "https://i.ibb.co.com/nNhTXzYD/Asset-6-4x.png",
  warnaUtama: "#11118f",
  warnaAksen: "#f5c518",
  pengumuman: "Selamat datang di Sistem Informasi Kaderisasi PMII Sunan Ampel Malang.",
};

// Ketentuan login, ditampilkan sebagai daftar berikon
const aturanLogin = [
  { ikon: '🎓', peran: 'Kader', cara: 'Masuk menggunakan NIM' },
  { ikon: '👤', peran: 'Pendamping', cara: 'Masuk menggunakan Username' },
  { ikon: '🏢', peran: 'Pengurus Rayon & Komisariat', cara: 'Masuk menggunakan Username' },
];

export default function PintuMasukSiKader() {
  const [design] = useState(defaultDesign);

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [jawabanCaptcha, setJawabanCaptcha] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lihatPassword, setLihatPassword] = useState(false);
  const router = useRouter();

  const [captchaNum1, setCaptchaNum1] = useState(0);
  const [captchaNum2, setCaptchaNum2] = useState(0);

  // --- STATE UNTUK PENGUMUMAN BERJALAN ---
  const [pengumumanList, setPengumumanList] = useState<string[]>([defaultDesign.pengumuman]);
  const [currentPengumumanIndex, setCurrentPengumumanIndex] = useState(0);

  useEffect(() => {
    generateCaptcha();

    // 1. Tarik data pengumuman dinamis dari database (secara realtime)
    const unsubscribePengumuman = onSnapshot(doc(db, "pengaturan_sistem", "pengumuman"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().listTeks && docSnap.data().listTeks.length > 0) {
        setPengumumanList(docSnap.data().listTeks);
      } else {
        setPengumumanList([defaultDesign.pengumuman]); // Balik ke default jika kosong
      }
    });

    return () => unsubscribePengumuman();
  }, []);

  // 2. Timer untuk menggeser pengumuman setiap 5 detik
  useEffect(() => {
    if (pengumumanList.length <= 1) return; // Jika cuma 1 teks, tidak perlu bergeser

    const interval = setInterval(() => {
      setCurrentPengumumanIndex((prevIndex) => (prevIndex + 1) % pengumumanList.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [pengumumanList]);

  const generateCaptcha = () => {
    setCaptchaNum1(Math.floor(Math.random() * 10) + 1);
    setCaptchaNum2(Math.floor(Math.random() * 10) + 1);
    setJawabanCaptcha('');
  };

  // --- LOGIKA SMART GATEKEEPER ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parseInt(jawabanCaptcha) !== (captchaNum1 + captchaNum2)) {
      alert("Jawaban matematika salah! Silakan hitung kembali.");
      generateCaptcha();
      return;
    }

    setIsLoggingIn(true);

    try {
      let emailUntukLogin = "";
      let peranUser = "";
      let statusUser = "";

      const inputAsli = loginId.trim();

      // MENCARI DATA BERDASARKAN NIM ATAU USERNAME (Pencarian Ganda yang Kuat)
      let querySnapshot = await getDocs(query(collection(db, "users"), where("nim", "==", inputAsli)));

      if (querySnapshot.empty && !isNaN(Number(inputAsli))) {
        querySnapshot = await getDocs(query(collection(db, "users"), where("nim", "==", Number(inputAsli))));
      }

      if (querySnapshot.empty) {
        querySnapshot = await getDocs(query(collection(db, "users"), where("username", "==", inputAsli)));
      }

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();

        emailUntukLogin = userData.email;
        peranUser = userData.role;
        statusUser = userData.status;
      } else {
        throw new Error("Akun tidak ditemukan di sistem SIAKAD.");
      }

      // Cek Status Aktif/Pasif
      if (statusUser === "Pasif") {
        throw new Error("Akun Anda sedang dinonaktifkan. Silakan hubungi Admin Rayon.");
      }

      // Lakukan proses Auth Firebase menggunakan email yang ditemukan
      await signInWithEmailAndPassword(auth, emailUntukLogin, password);

      // Arahkan ke Dashboard sesuai jabatannya
      if (peranUser === 'komisariat') {
        router.push('/komisariat/dashboard');
      } else if (peranUser === 'rayon') {
        router.push('/rayon/dashboard');
      } else if (peranUser === 'pendamping') {
        router.push('/pendamping/dashboard');
      } else if (peranUser === 'kader') {
        router.push('/kader/dashboard');
      } else {
        throw new Error("Role tidak valid. Hubungi Admin.");
      }

    } catch (error: any) {
      let pesanError = "Password salah atau terjadi kesalahan sistem.";

      if (error.message.includes("Akun tidak ditemukan")) {
        pesanError = "NIM atau Username belum terdaftar. Pastikan ejaan sudah benar (perhatikan huruf besar/kecil).";
      } else if (error.message.includes("dinonaktifkan")) {
        pesanError = error.message;
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        pesanError = "NIM/Username atau Password Anda salah!";
      }

      alert(`Maaf, Akses Ditolak!\n\n${pesanError}`);
      generateCaptcha();
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="lg-shell">
      <style>{`
        .lg-shell {
          --lg-primary: #11118f;
          --lg-primary-2: #2d2de0;
          --lg-accent: #f5c518;
          --lg-ink: #111827;
          --lg-body: #374151;
          --lg-muted: #6b7280;
          --lg-border: #e5e7eb;

          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          overflow: hidden;
          background: radial-gradient(1200px 700px at 12% 8%, #2d2de0 0%, transparent 60%),
                      radial-gradient(900px 600px at 88% 92%, #1b1bb5 0%, transparent 62%),
                      linear-gradient(140deg, #080845 0%, #11118f 52%, #1d1dad 100%);
          box-sizing: border-box;
        }
        .lg-shell *, .lg-shell *::before, .lg-shell *::after { box-sizing: border-box; }

        /* Ornamen cahaya lembut */
        .lg-aurora { position: absolute; inset: 0; pointer-events: none; }
        .lg-aurora::before, .lg-aurora::after {
          content: ''; position: absolute; border-radius: 50%; filter: blur(90px);
        }
        .lg-aurora::before { width: 520px; height: 520px; top: -160px; right: -120px; background: rgba(245,197,24,.20); }
        .lg-aurora::after  { width: 460px; height: 460px; bottom: -180px; left: -120px; background: rgba(66,133,244,.26); }

        /* KARTU UTAMA */
        .lg-card {
          position: relative; z-index: 2;
          width: 100%; max-width: 1020px;
          display: grid; grid-template-columns: 1.05fr 1fr;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 40px 90px rgba(4,4,40,.45), 0 2px 8px rgba(4,4,40,.2);
        }

        /* ---------- PANEL BRAND (KIRI) ---------- */
        .lg-brand {
          position: relative;
          padding: 42px 40px;
          color: #fff;
          background: linear-gradient(165deg, var(--lg-primary) 0%, var(--lg-primary-2) 100%);
          display: flex; flex-direction: column; gap: 24px;
        }
        .lg-brand::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(520px 320px at 85% 0%, rgba(245,197,24,.18), transparent 70%);
          pointer-events: none;
        }
        .lg-brand > * { position: relative; z-index: 1; }

        .lg-org { display: flex; align-items: center; gap: 14px; }
        .lg-logo {
          width: 54px; height: 54px; flex: none; object-fit: contain;
          background: #fff; border-radius: 14px; padding: 6px;
          box-shadow: 0 6px 18px rgba(0,0,0,.18);
        }
        .lg-org-name { font-size: .95rem; font-weight: 700; line-height: 1.3; letter-spacing: .2px; }
        .lg-org-sub { font-size: .76rem; opacity: .85; margin-top: 3px; }

        .lg-title { margin: 0; font-size: 2.05rem; font-weight: 800; letter-spacing: -.5px; line-height: 1.1; }
        .lg-title span { color: var(--lg-accent); }
        .lg-desc { margin: 8px 0 0; font-size: .9rem; line-height: 1.65; opacity: .9; max-width: 42ch; }

        /* Pengumuman berjalan */
        .lg-ticker {
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.16);
          backdrop-filter: blur(6px);
          border-radius: 14px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 7px; min-height: 84px;
        }
        .lg-ticker-label {
          font-size: .66rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
          color: var(--lg-accent); display: inline-flex; align-items: center; gap: 6px;
        }
        .lg-ticker-text { font-size: .86rem; line-height: 1.6; animation: lgFade .7s ease-out; }
        @keyframes lgFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        /* Ketentuan login */
        .lg-rules { margin-top: auto; }
        .lg-rules-title {
          font-size: .66rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
          color: var(--lg-accent); margin-bottom: 12px;
        }
        .lg-rules-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .lg-rule {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
          border-radius: 12px; padding: 10px 13px;
        }
        .lg-rule-ic {
          width: 34px; height: 34px; flex: none; display: grid; place-items: center;
          background: rgba(255,255,255,.14); border-radius: 10px; font-size: 1.05rem;
        }
        .lg-rule-peran { font-size: .82rem; font-weight: 700; line-height: 1.2; }
        .lg-rule-cara { font-size: .72rem; opacity: .82; margin-top: 2px; }
        .lg-note { margin: 12px 0 0; font-size: .72rem; opacity: .75; line-height: 1.55; }

        /* ---------- PANEL FORM (KANAN) ---------- */
        .lg-form-wrap {
          padding: 46px 42px;
          display: flex; flex-direction: column; justify-content: center;
          background: #fff;
        }
        .lg-form-head h2 { margin: 0; font-size: 1.45rem; font-weight: 800; color: var(--lg-ink); letter-spacing: -.3px; }
        .lg-form-head p { margin: 7px 0 0; font-size: .86rem; color: var(--lg-muted); line-height: 1.5; }

        .lg-form { margin-top: 28px; display: flex; flex-direction: column; gap: 18px; }
        .lg-field { display: flex; flex-direction: column; gap: 8px; }
        .lg-label {
          font-size: .68rem; font-weight: 700; letter-spacing: .07em;
          text-transform: uppercase; color: var(--lg-muted);
        }
        .lg-input {
          width: 100%; padding: 13px 15px;
          border: 1px solid var(--lg-border); border-radius: 11px;
          font-size: .92rem; color: var(--lg-ink); font-family: inherit;
          background: #fff; outline: none; transition: border-color .18s, box-shadow .18s, background .18s;
        }
        .lg-input::placeholder { color: #9ca3af; font-weight: 400; }
        .lg-input:focus {
          border-color: var(--lg-primary-2);
          box-shadow: 0 0 0 4px rgba(45,45,224,.12);
        }

        .lg-pass { position: relative; }
        .lg-pass .lg-input { padding-right: 52px; letter-spacing: .06em; }
        .lg-eye {
          position: absolute; top: 50%; right: 8px; transform: translateY(-50%);
          width: 36px; height: 36px; display: grid; place-items: center;
          background: none; border: none; cursor: pointer; border-radius: 9px;
          font-size: 1rem; color: var(--lg-muted); transition: background .18s;
        }
        .lg-eye:hover { background: #f3f4f6; }

        /* Captcha */
        .lg-captcha { display: flex; align-items: stretch; gap: 10px; }
        .lg-captcha-q {
          flex: none; min-width: 112px; display: grid; place-items: center;
          background: linear-gradient(165deg, var(--lg-primary), var(--lg-primary-2));
          color: #fff; border-radius: 11px; font-weight: 800; font-size: 1rem; letter-spacing: .06em;
          user-select: none;
        }
        .lg-captcha .lg-input { flex: 1; min-width: 0; }
        .lg-refresh {
          flex: none; width: 46px; border: 1px solid var(--lg-border); background: #f9fafb;
          border-radius: 11px; cursor: pointer; font-size: 1.05rem; color: var(--lg-body);
          transition: background .18s, color .18s, border-color .18s;
        }
        .lg-refresh:hover { background: var(--lg-primary); color: #fff; border-color: var(--lg-primary); }

        .lg-submit {
          margin-top: 6px; width: 100%; padding: 15px 18px;
          border: none; border-radius: 12px; cursor: pointer;
          font-family: inherit; font-size: .95rem; font-weight: 800; letter-spacing: .02em;
          color: #fff; background: linear-gradient(165deg, var(--lg-primary), var(--lg-primary-2));
          box-shadow: 0 10px 24px rgba(17,17,143,.28);
          transition: transform .18s, box-shadow .18s, filter .18s;
        }
        .lg-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 32px rgba(17,17,143,.34); }
        .lg-submit:active:not(:disabled) { transform: translateY(0); }
        .lg-submit:disabled { background: #9ca3af; box-shadow: none; cursor: not-allowed; }

        .lg-foot {
          margin-top: 26px; padding-top: 18px; border-top: 1px solid var(--lg-border);
          text-align: center; font-size: .74rem; color: var(--lg-muted); line-height: 1.6;
        }

        /* ---------- RESPONSIF ---------- */
        @media (max-width: 900px) {
          .lg-shell { padding: 0; align-items: stretch; }
          .lg-card { grid-template-columns: 1fr; max-width: 560px; border-radius: 0; box-shadow: none; }
          .lg-brand { padding: 30px 22px 34px; border-radius: 0 0 26px 26px; gap: 18px; }
          .lg-title { font-size: 1.7rem; }
          .lg-desc { display: none; }
          .lg-rules { margin-top: 4px; }
          .lg-form-wrap { padding: 28px 22px 40px; }
        }
        @media (max-width: 420px) {
          .lg-brand { padding: 24px 18px 30px; }
          .lg-form-wrap { padding: 24px 18px 36px; }
          .lg-captcha-q { min-width: 92px; font-size: .92rem; }
        }
      `}</style>

      <div className="lg-aurora" aria-hidden="true" />

      <div className="lg-card">

        {/* ============ PANEL BRAND ============ */}
        <aside className="lg-brand">
          <div className="lg-org">
            <img src={design.logo} alt="Logo PMII" className="lg-logo" />
            <div>
              <div className="lg-org-name">PK. PMII Sunan Ampel Malang</div>
              <div className="lg-org-sub">Pergerakan Mahasiswa Islam Indonesia</div>
            </div>
          </div>

          <div>
            <h1 className="lg-title">SIAKAD <span>PMII</span></h1>
            <p className="lg-desc">
              Satu pintu untuk kaderisasi yang terstruktur: raport kaderisasi, pengumpulan tugas,
              ujian, sertifikat digital, hingga jadwal kegiatan.
            </p>
          </div>

          <div className="lg-ticker">
            <span className="lg-ticker-label">📢 Pengumuman</span>
            <span key={currentPengumumanIndex} className="lg-ticker-text">
              {pengumumanList[currentPengumumanIndex]}
            </span>
          </div>

          <div className="lg-rules">
            <div className="lg-rules-title">Ketentuan Login</div>
            <ul className="lg-rules-list">
              {aturanLogin.map((a) => (
                <li key={a.peran} className="lg-rule">
                  <span className="lg-rule-ic">{a.ikon}</span>
                  <div>
                    <div className="lg-rule-peran">{a.peran}</div>
                    <div className="lg-rule-cara">{a.cara}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="lg-note">
              Password sesuai yang diberikan admin. Segera perbarui profil Anda setelah berhasil masuk.
            </p>
          </div>
        </aside>

        {/* ============ PANEL FORM ============ */}
        <section className="lg-form-wrap">
          <div className="lg-form-head">
            <h2>Masuk ke Sistem</h2>
            <p>Gunakan akun SIAKAD Anda untuk melanjutkan.</p>
          </div>

          <form className="lg-form" onSubmit={handleLogin}>
            <div className="lg-field">
              <label className="lg-label" htmlFor="loginId">NIM / Username</label>
              <input
                id="loginId"
                type="text"
                required
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Masukkan NIM atau Username"
                className="lg-input"
              />
            </div>

            <div className="lg-field">
              <label className="lg-label" htmlFor="password">Password</label>
              <div className="lg-pass">
                <input
                  id="password"
                  type={lihatPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="lg-input"
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setLihatPassword(!lihatPassword)}
                  aria-label={lihatPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  title={lihatPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {lihatPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="lg-field">
              <span className="lg-label">Verifikasi Keamanan</span>
              <div className="lg-captcha">
                <div className="lg-captcha-q">{captchaNum1} + {captchaNum2} = ?</div>
                <input
                  type="number"
                  required
                  value={jawabanCaptcha}
                  onChange={(e) => setJawabanCaptcha(e.target.value)}
                  placeholder="Hasil penjumlahan"
                  className="lg-input"
                />
                <button type="button" className="lg-refresh" onClick={generateCaptcha} title="Ganti soal" aria-label="Ganti soal">↻</button>
              </div>
            </div>

            <button disabled={isLoggingIn} type="submit" className="lg-submit">
              {isLoggingIn ? 'Memeriksa data…' : 'Masuk ke Sistem'}
            </button>
          </form>

          <div className="lg-foot">
            &copy; {new Date().getFullYear()} PK. PMII Sunan Ampel Malang<br />
            Dikembangkan untuk kaderisasi yang terstruktur dan masif.
          </div>
        </section>

      </div>
    </div>
  );
}
