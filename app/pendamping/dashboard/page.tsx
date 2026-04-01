'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

export default function DashboardPendamping() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState('profil'); 
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- STATE PROFIL PENDAMPING ---
  const [profilPendamping, setProfilPendamping] = useState({ 
    nama: 'Loading...', 
    username: '',
    fotoUrl: 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO',
    noHp: '',
    alamat: '',
    id_rayon: '',
    jenjangTugas: 'MAPABA' 
  });
  
  // STATE BARU: Menyimpan Nama Rayon Asli & Pengaturan Cetak (Dari Rayon)
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });

  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [isSavingProfil, setIsSavingProfil] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  // --- STATE DATA DINAMIS KADER ---
  const [kaderBinaan, setKaderBinaan] = useState<any[]>([]);
  const [berkasTugas, setBerkasTugas] = useState<any[]>([]);
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], SIG: [], SKP: [], NONFORMAL: [] });
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 

  const [tabInput, setTabInput] = useState('materi'); 
  const [isSavingKeaktifan, setIsSavingKeaktifan] = useState(false);

  const [selectedKader, setSelectedKader] = useState('');
  
  // Jenjang dikunci mati sesuai penugasan dari Admin Rayon
  const selectedJenjang = profilPendamping.jenjangTugas || 'MAPABA';
  const materiAktif = listKurikulum[selectedJenjang] || [];

  // --- STATE EVALUASI KEAKTIFAN ---
  const defaultKeaktifan = [
    { id: 'k1', kategori: 'Kehadiran Forum (Absensi)', nilai: 0 },
    { id: 'k2', kategori: 'Keaktifan Diskusi (Partisipasi)', nilai: 0 },
    { id: 'k3', kategori: 'Penyelesaian Tugas / RTL', nilai: 0 }
  ];
  const [listKeaktifan, setListKeaktifan] = useState<any[]>(defaultKeaktifan);
  const [catatanKeaktifan, setCatatanKeaktifan] = useState('');
  const [newKategori, setNewKategori] = useState('');

  // ==========================================
  // API HELPER: CLOUDINARY UPLOAD
  // ==========================================
  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "siakad_upload"); 
    const res = await fetch("https://api.cloudinary.com/v1_1/dcmdaghbq/auto/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url;
  };

  // ==========================================
  // 1. EFEK: CEK LOGIN & ROLE PENDAMPING (SATPAM)
  // ==========================================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const p = snap.docs[0].data();
            
            // 🛡️ Satpam Role: Hanya Pendamping yang Boleh Masuk
            if (p.role !== 'pendamping') {
              alert(`Akses Ditolak! Jabatan Anda adalah "${p.role}". Halaman ini khusus Pendamping.`);
              signOut(auth);
              router.push('/');
              return;
            }

            setCurrentUser(user);
            setProfilPendamping({ 
              nama: p.nama || '', 
              username: p.username || '',
              fotoUrl: p.fotoUrl || 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO',
              noHp: p.noHp || '',
              alamat: p.alamat || '',
              id_rayon: p.id_rayon || '',
              jenjangTugas: p.jenjangTugas || 'MAPABA'
            });
            
            ambilDataKaderBinaan(p.username);
            
            if(p.id_rayon){
              // Tarik Nama Asli Rayon & Pengaturan Cetak Kop
              onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap) => {
                if (rayonSnap.exists()) {
                  const rData = rayonSnap.data();
                  setNamaRayonInduk(rData.nama || p.id_rayon);
                  setPengaturanCetak({ 
                    kopSuratUrl: rData.kopSuratUrl || '', 
                    footerUrl: rData.footerUrl || '' 
                  });
                }
              });

              onSnapshot(doc(db, "kurikulum_rayon", p.id_rayon), (docSnap) => {
                if (docSnap.exists()) setListKurikulum(docSnap.data() as Record<string, any[]>);
              });
            }
          }
        });
      } else {
        router.push('/');
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // ==========================================
  // 2. EFEK: PANTAU NILAI KADER (REAL-TIME)
  // ==========================================
  useEffect(() => {
    if (!selectedKader) return;
    
    onSnapshot(doc(db, "nilai_khs", selectedKader), (docSnap) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data());
      else setNilaiKaderRealtime({});
    });

    onSnapshot(doc(db, "evaluasi_kader", selectedKader), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data[selectedJenjang]) {
          setListKeaktifan(data[selectedJenjang].listKeaktifan || defaultKeaktifan);
          setCatatanKeaktifan(data[selectedJenjang].catatan || '');
        } else {
          setListKeaktifan(defaultKeaktifan); 
          setCatatanKeaktifan('');
        }
      } else {
        setListKeaktifan(defaultKeaktifan); 
        setCatatanKeaktifan('');
      }
    });
  }, [selectedKader, selectedJenjang]);

  // ==========================================
  // LOGIKA FUNGSI DASHBOARD
  // ==========================================
  const ambilDataKaderBinaan = async (usernamePendamping: string) => {
    try {
      const qKader = query(collection(db, "users"), where("role", "==", "kader"), where("pendampingId", "==", usernamePendamping));
      const snapKader = await getDocs(qKader);
      const listKader: any[] = snapKader.docs.map(d => ({ id: d.id, ...d.data() }));
      setKaderBinaan(listKader);
      if (listKader.length > 0 && !selectedKader) setSelectedKader(listKader[0].nim);

      const emailKaderBinaan = listKader.map(k => k.email);
      if (emailKaderBinaan.length > 0) {
        const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "in", emailKaderBinaan));
        onSnapshot(qBerkas, (snap) => {
           setBerkasTugas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }
    } catch (error) { console.error(error); }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoFile(file);
      setProfilPendamping({ ...profilPendamping, fotoUrl: URL.createObjectURL(file) });
    }
  };

  const handleSimpanProfil = async () => {
    if(!profilPendamping.username) return;
    setIsSavingProfil(true);
    try {
      let finalFotoUrl = profilPendamping.fotoUrl;
      if (fotoFile) finalFotoUrl = await uploadToCloudinary(fotoFile); 
      await updateDoc(doc(db, "users", profilPendamping.username), { noHp: profilPendamping.noHp, alamat: profilPendamping.alamat, fotoUrl: finalFotoUrl });
      alert("Profil diperbarui!");
      setIsEditingProfil(false); setFotoFile(null);
    } catch (error) { alert("Gagal simpan"); } finally { setIsSavingProfil(false); }
  };

  const handleUbahNilai = async (kodeMateri: string, hurufNilai: string) => {
    if (!selectedKader) return alert("Pilih kader!");
    try {
      await setDoc(doc(db, "nilai_khs", selectedKader), { [kodeMateri]: hurufNilai, terakhirDiubah: Date.now(), diubahOleh: `Pendamping (${profilPendamping.nama})` }, { merge: true });
    } catch (error) { alert("Gagal simpan nilai"); }
  };

  const handleAddKategori = () => {
    if(!newKategori) return;
    setListKeaktifan([...listKeaktifan, { id: Date.now().toString(), kategori: newKategori, nilai: 0 }]);
    setNewKategori('');
  };

  const handleHapusKategori = (id: string) => {
    setListKeaktifan(listKeaktifan.filter(k => k.id !== id));
  };

  const handleUbahNilaiKeaktifan = (id: string, newVal: number) => {
    setListKeaktifan(listKeaktifan.map(k => k.id === id ? { ...k, nilai: newVal } : k));
  };

  const handleSimpanKeaktifan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKader) return alert("Pilih kader!");
    setIsSavingKeaktifan(true);
    try {
      await setDoc(doc(db, "evaluasi_kader", selectedKader), { 
        [selectedJenjang]: { listKeaktifan: listKeaktifan, catatan: catatanKeaktifan }
      }, { merge: true });
      alert(`Berhasil Simpan Evaluasi Keaktifan.`);
    } catch (error) { alert("Gagal menyimpan evaluasi."); } finally { setIsSavingKeaktifan(false); }
  };

  const handleVerifikasiTugas = async (idBerkas: string) => {
    try {
      await updateDoc(doc(db, "berkas_kader", idBerkas), { status: 'Selesai' });
      alert("Tugas Terverifikasi Selesai.");
    } catch (error) { alert("Error verifikasi tugas."); }
  };

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  // LOGIKA HITUNG IP 
  let totalSks = 0;
  let totalBobotNilai = 0;
  
  const barisRaportRender = materiAktif.map((materi, index) => {
    const nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
    const angkaNilai = konversiHurufKeAngka(nilaiHuruf);
    const sksKaliNilai = (materi.bobot || 0) * angkaNilai;
    
    totalSks += (materi.bobot || 0);
    if (nilaiHuruf !== "-") totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode} className="table-row" style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa' }}>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'center' }}>{index + 1}</td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', color: '#555' }}>{materi.kode}</td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'left', color: '#333' }}>{materi.nama}</td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td className="no-print" style={{ padding: '6px 10px', textAlign: 'center' }}>
          {/* Versi Input untuk Layar Web */}
          <select 
            value={nilaiHuruf === "-" ? "" : nilaiHuruf} 
            onChange={(e) => handleUbahNilai(materi.kode, e.target.value)} 
            style={{ padding: '4px', border: `1px solid ${nilaiHuruf !== '-' ? '#f39c12' : '#ccc'}`, borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}
          >
            <option value="">-</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select>
        </td>
        {/* Versi Teks untuk Print PDF */}
        <td className="print-only-col col-cetak" style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>
           {nilaiHuruf === "-" ? "" : nilaiHuruf}
        </td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });
  
  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";
  const kaderDicetak = kaderBinaan.find(k => k.nim === selectedKader) || {};

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'profil': return 'Profil Pendamping';
      case 'daftar-kader': return 'Daftar Kader Binaan';
      case 'input-nilai': return 'Input Raport & Evaluasi Kader';
      case 'berkas-tugas': return 'Verifikasi Tugas Kader';
      default: return 'Dashboard Pendamping';
    }
  };

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS UNTUK PRINT / DOWNLOAD PDF - FORMAT A4 FORMAL */}
      <style>{`
        @media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }
        
        /* SEMBUNYIKAN ELEMEN KHUSUS CETAK SAAT DILIHAT DI WEB BROWSER */
        @media screen {
          .print-only-col { display: none !important; }
          .print-only-div { display: none !important; }
          .print-only-inline { display: none !important; }
          .table-row:nth-child(even) { background-color: #fafafa; }
        }
        
        /* ---------------------------------------------------- */
        /* STYLING UNTUK TAMPILAN WEB (SIAKAD UIN MALANG STYLE) */
        /* ---------------------------------------------------- */
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 600px; }
        .tabel-utama thead tr { border-top: 2px solid #555; border-bottom: 2px solid #555; background-color: #fff; }
        .tabel-utama th { padding: 8px 10px; color: #333; text-align: center; font-weight: bold; }
        .tabel-utama td { padding: 6px 10px; border-bottom: 1px solid #ddd; color: #333; }
        
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body, html { background-color: #fff !important; margin: 0; padding: 0; font-family: "Arial Narrow", Arial, sans-serif !important; color: #000 !important; }
          body * { visibility: hidden; }
          
          #area-cetak-raport, #area-cetak-raport * { visibility: visible; color: #000 !important; }
          #area-cetak-raport { 
            position: absolute; left: 0; top: 0; width: 100%; 
            padding: 0 !important; margin: 0; 
            background-color: white !important; 
            border: none !important; box-shadow: none !important;
          }
          
          .no-print { display: none !important; } 
          
          /* Pengaturan Tabel Utama Formal Hitam Putih */
          .tabel-utama { border-collapse: collapse !important; width: 100% !important; margin-bottom: 15px; border: 1px solid #000 !important; }
          .tabel-utama thead tr { border-top: 1px solid #000 !important; border-bottom: 1px solid #000 !important; background-color: #fff !important; color: #000 !important;}
          .tabel-utama th, .tabel-utama td { 
             border: 1px solid #000 !important; 
             padding: 6px 8px !important; 
             font-size: 11pt !important; 
             color: #000 !important; 
             background-color: #fff !important; 
          }
          .tabel-utama th { font-weight: bold !important; text-align: center !important; }
          
          /* Pengaturan Tabel Biodata Tanpa Garis */
          .tabel-biodata { width: 100%; font-size: 12pt !important; border: none !important; margin-bottom: 15px !important; }
          .tabel-biodata td { padding: 4px 0 !important; border: none !important; }
          
          /* Tampilkan elemen khusus print */
          .print-only-header { display: table-cell !important; } 
          .print-only-inline { display: inline !important; }
          .print-kop-surat { display: block !important; margin-bottom: 15px; width: 100%; text-align: center; } 
          .print-kop-surat img { width: 100% !important; max-height: 250px; object-fit: contain; }
          
          .print-footer-container { display: flex !important; width: 100%; justify-content: center; margin-top: 30px; page-break-inside: avoid; } 
          .print-footer-container img { width: 100% !important; object-fit: contain; }
          
          /* Paksa menghilangkan background color browser */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        
        .print-only-header { display: none; }
        .print-kop-surat { display: none; }
        .print-footer-container { display: none; }
      `}</style>
      
      {/* SIDEBAR */}
      <aside className="no-print" style={{ width: '260px', background: 'linear-gradient(135deg, #1e824c 0%, #154360 100%)', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'left 0.3s ease', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🏛️ SIAKAD PMII</span>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{fontSize: '0.9rem', fontWeight: 'bold', lineHeight: '1.4'}}>{profilPendamping.nama}</div>
          <div style={{fontSize: '0.75rem', color: '#f1c40f', marginTop: '4px'}}>Tugas: {profilPendamping.jenjangTugas}</div>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', flex: 1, margin: 0 }}>
          {[{ id: 'profil', icon: '👤', label: 'Profil Saya' }, { id: 'daftar-kader', icon: '📋', label: 'Daftar Binaan' }, { id: 'input-nilai', icon: '📝', label: 'Raport & Evaluasi' }, { id: 'berkas-tugas', icon: '📂', label: 'Verifikasi Tugas' }].map((item) => (
            <li key={item.id}>
              <button onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent', border: 'none', color: activeMenu === item.id ? '#f1c40f' : '#d1d1d1', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', transition: '0.2s', fontWeight: activeMenu === item.id ? 'bold' : 'normal', fontSize: '0.85rem' }}>
                <span style={{fontSize: '1.1rem'}}>{item.icon}</span> {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}><button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid #fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>🚪 Keluar</button></div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '0', width: '100%', overflowX: 'hidden' }}>
        
        {/* HEADER DINAMIS (HANYA SATU DI APLIKASI INI) */}
        <header className="no-print" style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, textTransform: 'uppercase', fontWeight: 'bold' }}>
              {getHeaderTitle()}
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#1e824c', fontWeight: 'bold' }}>📍 Rayon: {namaRayonInduk}</div>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1 }}>
          
          {/* MENU 0: PROFIL */}
          {activeMenu === 'profil' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', fontWeight: 'bold' }}>PROFIL SAYA</div>
              <div style={{ padding: '30px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 180px', textAlign: 'center' }}>
                  <img src={profilPendamping.fotoUrl} alt="Foto Pendamping" style={{ width: '100%', height: '230px', objectFit: 'cover', borderRadius: '8px', border: '4px solid #eee' }} />
                  {isEditingProfil && (
                    <div style={{ marginTop: '10px', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Unggah Foto Baru:</label>
                      <input type="file" accept="image/*" onChange={handleFotoChange} style={{ marginTop: '5px', fontSize: '0.7rem', width: '100%' }} />
                    </div>
                  )}
                  <button 
                    onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
                    disabled={isSavingProfil} 
                    style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: isEditingProfil ? '#2ecc71' : '#1e824c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil' : '📝 Ubah Profil Saya'}
                  </button>
                </div>
                
                <div style={{ flex: '1 1 350px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#333' }}>
                    <tbody>
                      <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', width: '35%', borderBottom: '1px solid #eee' }}>Username</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{profilPendamping.username}</td></tr>
                      <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nama Lengkap</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{profilPendamping.nama}</td></tr>
                      <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Tugas Pendampingan</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}><span style={{ color: '#e67e22', fontWeight: 'bold', backgroundColor: '#fff3cd', padding: '4px 8px', borderRadius: '4px' }}>{profilPendamping.jenjangTugas}</span></td></tr>
                      <tr>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nomor WhatsApp</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                          {isEditingProfil ? (
                            <input type="text" value={profilPendamping.noHp} onChange={e => setProfilPendamping({...profilPendamping, noHp: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                          ) : (profilPendamping.noHp || '-')}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Alamat / Domisili</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                          {isEditingProfil ? (
                            <input type="text" value={profilPendamping.alamat} onChange={e => setProfilPendamping({...profilPendamping, alamat: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                          ) : (profilPendamping.alamat || '-')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {isEditingProfil && <p style={{ fontSize: '0.75rem', color: '#e74c3c', marginTop: '10px' }}>*Nama, Username, dan Jenjang Tugas hanya bisa diubah oleh Pengurus Rayon.</p>}
                </div>
              </div>
            </div>
          )}

          {/* MENU 1: DAFTAR KADER */}
          {activeMenu === 'daftar-kader' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '15px' }}>Daftar kader yang diplotkan langsung kepada Anda sebagai pendamping.</p>
              <div style={{overflowX: 'auto'}}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '500px' }}>
                  <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#333' }}><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>NIM</th><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Nama Kader</th><th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Aksi</th></tr></thead>
                  <tbody>
                    {kaderBinaan.map(k => {
                      const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                      return (
                        <tr key={k.nim} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#555' }}>{k.nim} <br/> <span style={{fontSize: '0.7rem', color: '#1e824c'}}>Agt. {thnMasuk}</span></td>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{k.nama}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => { setSelectedKader(k.nim); setActiveMenu('input-nilai'); }} style={{ padding: '6px 12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>Buka Raport 📝</button></td>
                        </tr>
                      )
                    })}
                    {kaderBinaan.length === 0 && <tr><td colSpan={3} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada kader binaan yang diplotkan ke Anda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 2: INPUT NILAI & EVALUASI */}
          {activeMenu === 'input-nilai' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              
              {/* HEADER DROPDOWN BERJEJER */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader:</span>
                  <select value={selectedKader} onChange={(e) => setSelectedKader(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {kaderBinaan.length === 0 && <option value="">Tidak ada binaan</option>}
                    {kaderBinaan.map(k => {
                      const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                      return <option key={k.nim} value={k.nim}>{k.nama} ({thnMasuk})</option>
                    })}
                  </select>
                  
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginLeft: '5px' }}>Jenjang:</span>
                  {/* Di pendamping, jenjang dikunci mati sesuai penugasannya */}
                  <div style={{ padding: '6px 15px', backgroundColor: '#eef2f3', borderRadius: '4px', fontWeight: 'bold', color: '#2c3e50', border: '1px solid #ccc', fontSize: '0.85rem' }}>{selectedJenjang}</div>
                  
                  {/* TOMBOL CETAK KHS */}
                  {tabInput === 'materi' && selectedKader && (
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                      🖨️ Cetak KHS
                    </button>
                  )}
                </div>
              </div>

              <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '15px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabInput('materi')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabInput === 'materi' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabInput === 'materi' ? '#fff' : 'transparent', color: tabInput === 'materi' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>📑 Raport Kaderisasi</button>
                <button onClick={() => setTabInput('keaktifan')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabInput === 'keaktifan' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabInput === 'keaktifan' ? '#fff' : 'transparent', color: tabInput === 'keaktifan' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>📊 Evaluasi Keaktifan</button>
              </div>

              {/* TAB 1: RAPORT KADERISASI */}
              {tabInput === 'materi' && (
                <div id="area-cetak-raport" style={{ overflowX: 'auto', padding: '10px 0' }}>
                  
                  {/* KOP SURAT (HANYA SAAT PRINT) */}
                  <div className="print-kop-surat">
                    {pengaturanCetak.kopSuratUrl && (
                      <img src={pengaturanCetak.kopSuratUrl} alt="Kop Surat" />
                    )}
                    
                    <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '15px 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI</h3>
                    
                    <table className="tabel-biodata">
                      <tbody>
                        <tr><td style={{width: '200px'}}>Nama Kader</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak?.nama || '-'}</td></tr>
                        <tr><td>NIM</td><td>:</td><td>{kaderDicetak?.nim || '-'}</td></tr>
                        <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak?.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '-'}</td></tr>
                        <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{selectedJenjang}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* TABEL KHS (ADMIN/PENDAMPING/KADER SAMA PERSIS) */}
                  <table className="tabel-utama">
                    <thead>
                      <tr>
                        <th style={{ width: '5%' }}>No</th>
                        <th style={{ width: '20%', textAlign: 'left' }}>Kode Matakuliah</th>
                        <th style={{ width: '45%', textAlign: 'left' }}>Nama Matakuliah</th>
                        <th style={{ width: '10%' }}>SKS</th>
                        <th className="no-print" style={{ width: '10%' }}>Nilai / Input</th>
                        <th className="print-only-header" style={{ width: '10%' }}>Nilai Huruf</th>
                        <th style={{ width: '10%' }}>SKS x Nilai</th>
                      </tr>
                      {/* HEADER KHUSUS PRINT (HITAM PUTIH, BORDER JELAS) */}
                      <tr className="print-only-header">
                        <th style={{ padding: '10px', textAlign: 'center', width: '40px', border: '1px solid #000' }}>No</th>
                        <th style={{ padding: '10px', border: '1px solid #000' }}>Kode Matakuliah</th>
                        <th style={{ padding: '10px', border: '1px solid #000' }}>Nama Matakuliah</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #000' }}>SKS</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #000' }}>Nilai</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #000' }}>SKS x Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiAktif.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum jenjang ini belum diatur oleh Admin Rayon.</td></tr>
                      ) : barisRaportRender}
                      
                      <tr style={{ borderTop: '2px solid #ccc' }}>
                        <td colSpan={3} className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                        <td className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                        <td className="no-print"></td>
                        <td className="print-only-col col-cetak"></td>
                        <td className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                      </tr>
                      <tr style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}>
                        <td colSpan={5} className="no-print col-cetak" style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>IPK (Indeks Prestasi Kader)</td>
                        <td colSpan={5} className="print-only-col col-cetak" style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '11pt' }}>IPK (Indeks Prestasi Kader)</td>
                        <td className="col-cetak" style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>{ipKader}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* FOOTER PDF (GAMBAR TANDA TANGAN/STEMPEL DARI RAYON) */}
                  <div className="print-footer-container">
                    {pengaturanCetak.footerUrl && (
                      <img src={pengaturanCetak.footerUrl} alt="Footer / Tanda Tangan" />
                    )}
                    <div className="teks-motto-biru">
                      Kebenaran, Keadilan, Kejujuran
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EVALUASI KEAKTIFAN */}
              {tabInput === 'keaktifan' && (
                <div style={{ backgroundColor: '#fafafa', padding: '20px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tabel-utama" style={{ width: '100%', backgroundColor: 'white', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #ddd', minWidth: '500px', fontSize: '0.85rem' }}>
                      <thead style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                        <tr>
                          <th style={{ padding: '10px' }}>Kategori Penilaian (Persentase 100%)</th>
                          <th style={{ textAlign: 'center', padding: '10px', width: '150px' }}>Input Nilai (0-100)</th>
                          <th style={{ textAlign: 'center', padding: '10px', width: '60px' }}>Hapus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listKeaktifan.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#333' }}>{item.kategori}</td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <input type="number" min="0" max="100" value={item.nilai} onChange={e => handleUbahNilaiKeaktifan(item.id, Number(e.target.value))} style={{ width: '100%', padding: '8px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} />
                                <span style={{fontWeight: 'bold', color: '#555'}}>%</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '10px' }}>
                              <button onClick={() => handleHapusKategori(item.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }} title="Hapus Kategori">×</button>
                            </td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: '#fdfdfd' }}>
                          <td style={{ padding: '10px' }}>
                            <input type="text" value={newKategori} onChange={e => setNewKategori(e.target.value)} placeholder="Ketik nama kategori baru..." style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', outline: 'none', fontSize: '0.85rem' }} />
                          </td>
                          <td colSpan={2} style={{ padding: '10px' }}>
                            <button onClick={handleAddKategori} style={{ width: '100%', padding: '8px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>➕ Tambah Kategori</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333', fontSize: '0.85rem'}}>Catatan / Pesan Pendamping untuk Kader:</label>
                  <textarea rows={4} value={catatanKeaktifan} onChange={e => setCatatanKeaktifan(e.target.value)} placeholder="Tuliskan evaluasi etika, saran pengembangan, atau pesan lainnya..." style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontSize: '0.85rem' }} />
                  <button onClick={handleSimpanKeaktifan} disabled={isSavingKeaktifan || !selectedKader} style={{ width: '100%', padding: '12px', backgroundColor: '#1e824c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem', cursor: (!selectedKader || isSavingKeaktifan) ? 'not-allowed' : 'pointer' }}>{isSavingKeaktifan ? 'Menyimpan Data...' : '💾 Simpan Tabel Evaluasi Keaktifan'}</button>
                </div>
              )}
            </div>
          )}

          {/* MENU 3: VERIFIKASI TUGAS */}
          {activeMenu === 'berkas-tugas' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#1e824c', margin: '0 0 15px 0', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Verifikasi Tugas Kader Binaan</h3>
              <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '15px' }}>Daftar tugas yang telah dikerjakan dan diunggah oleh kader binaan Anda.</p>
              <div style={{overflowX: 'auto'}}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '550px' }}>
                  <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555', textAlign: 'left' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Kader / Tanggal</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Nama Tugas Berkas</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Dokumen</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi Status</th></tr></thead>
                  <tbody>
                    {berkasTugas.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px' }}><b style={{color: '#004a87'}}>{b.email_kader.split('@')[0]}</b><br/><span style={{fontSize: '0.7rem', color: '#999'}}>{b.tanggal}</span></td>
                        <td style={{ padding: '10px' }}><b>{b.jenis_berkas}</b><br/><span style={{fontSize: '0.7rem', color: '#666', fontStyle: 'italic'}}>{b.nama_file_asli}</span></td>
                        <td style={{ padding: '10px', textAlign: 'center' }}><a href={b.file_link_or_id} target="_blank" style={{ padding: '4px 8px', backgroundColor: '#f1c40f', borderRadius: '4px', textDecoration: 'none', color: '#333', fontWeight: 'bold', fontSize: '0.7rem' }}>👁️ Lihat</a></td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{b.status === 'Selesai' ? <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.75rem' }}>✅ Selesai</span> : <button onClick={() => handleVerifikasiTugas(b.id)} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>Verifikasi Selesai</button>}</td>
                      </tr>
                    ))}
                    {berkasTugas.length === 0 && <tr><td colSpan={4} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada berkas tugas yang diunggah oleh kader binaan Anda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}