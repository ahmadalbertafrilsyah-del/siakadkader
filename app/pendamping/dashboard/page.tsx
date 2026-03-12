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
  
  // STATE BARU: Menyimpan Nama Rayon Asli
  const [namaRayonInduk, setNamaRayonInduk] = useState('');

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
    formData.append("upload_preset", "siakad_upload"); // Sesuaikan preset Anda
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
              // Tarik Nama Asli Rayon
              onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap) => {
                if (rayonSnap.exists()) setNamaRayonInduk(rayonSnap.data().nama);
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
      alert(`Berhasil Simpan Evaluasi.`);
    } catch (error) { alert("Gagal"); } finally { setIsSavingKeaktifan(false); }
  };

  const handleVerifikasiTugas = async (idBerkas: string) => {
    try {
      await updateDoc(doc(db, "berkas_kader", idBerkas), { status: 'Selesai' });
      alert("Terverifikasi.");
    } catch (error) { alert("Error"); }
  };

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
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
      <tr key={materi.kode} style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa' }}>
        <td style={{ padding: '12px', textAlign: 'center' }}>{index + 1}</td>
        <td style={{ padding: '12px', fontWeight: 'bold', color: '#555' }}>{materi.kode}</td>
        <td style={{ padding: '12px', color: '#333' }}>{materi.nama}</td>
        <td style={{ padding: '12px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '12px', textAlign: 'center' }}>
          <select value={nilaiHuruf === "-" ? "" : nilaiHuruf} onChange={(e) => handleUbahNilai(materi.kode, e.target.value)} style={{ padding: '6px 10px', border: `1px solid ${nilaiHuruf !== '-' ? '#f39c12' : '#ccc'}`, borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}>
            <option value="">-</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select>
        </td>
        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });
  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: '260px', background: 'linear-gradient(135deg, #1e824c 0%, #154360 100%)', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'left 0.3s ease' }}>
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🏛️ SIAKAD PMII</span>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>{profilPendamping.nama}</div>
          <div style={{fontSize: '0.75rem', color: '#f1c40f', marginTop: '4px'}}>Tugas: {profilPendamping.jenjangTugas}</div>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', flex: 1, margin: 0 }}>
          {[{ id: 'profil', icon: '👤', label: 'Profil Saya' }, { id: 'daftar-kader', icon: '📋', label: 'Daftar Binaan' }, { id: 'input-nilai', icon: '📝', label: 'Raport & Evaluasi' }, { id: 'berkas-tugas', icon: '📂', label: 'Verifikasi Tugas' }].map((item) => (
            <li key={item.id}>
              <button onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent', border: 'none', color: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', transition: '0.2s' }}>
                <span>{item.icon}</span> {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: '20px' }}><button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid #fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🚪 Keluar</button></div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '0', width: '100%', overflowX: 'hidden' }}>
        <style>{`@media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }`}</style>
        
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1.1rem', color: '#333', margin: 0 }}>Ruang Pendamping {namaRayonInduk}</h2>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1 }}>
          
          {/* MENU 0: PROFIL */}
          {activeMenu === 'profil' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', fontWeight: 'bold' }}>PROFIL SAYA</div>
              <div style={{ padding: '30px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 200px', textAlign: 'center' }}>
                  <img src={profilPendamping.fotoUrl} style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '8px', border: '4px solid #eee' }} />
                  <input type="file" accept="image/*" onChange={handleFotoChange} style={{ marginTop: '10px', fontSize: '0.75rem', width: '100%' }} />
                  <button onClick={handleSimpanProfil} disabled={isSavingProfil} style={{ marginTop: '20px', width: '100%', padding: '12px', backgroundColor: '#1e824c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>{isSavingProfil ? '...' : '💾 Simpan Profil'}</button>
                </div>
                <div style={{ flex: '1 1 350px' }}>
                  <table style={{ width: '100%', fontSize: '0.95rem' }}>
                    <tbody>
                      <tr><td style={{ padding: '15px 0', fontWeight: 'bold', color: '#555', width: '40%' }}>Username</td><td>{profilPendamping.username}</td></tr>
                      <tr><td style={{ padding: '15px 0', fontWeight: 'bold', color: '#555' }}>Nama Lengkap</td><td>{profilPendamping.nama}</td></tr>
                      <tr><td style={{ padding: '15px 0', fontWeight: 'bold', color: '#555' }}>Tugas Jenjang</td><td style={{ color: '#e67e22', fontWeight: 'bold' }}>{profilPendamping.jenjangTugas}</td></tr>
                      <tr><td style={{ padding: '15px 0', fontWeight: 'bold', color: '#555' }}>WhatsApp</td><td><input type="text" value={profilPendamping.noHp} onChange={e => setProfilPendamping({...profilPendamping, noHp: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} /></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU 1: DAFTAR KADER */}
          {activeMenu === 'daftar-kader' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <h3 style={{ color: '#2c3e50', marginTop: 0 }}>Daftar Kader Binaan Anda</h3>
              <div style={{overflowX: 'auto'}}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '400px' }}>
                  <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}><th style={{ padding: '12px', textAlign: 'left' }}>NIM</th><th style={{ padding: '12px' }}>Nama Kader</th><th style={{ padding: '12px', textAlign: 'center' }}>Aksi</th></tr></thead>
                  <tbody>
                    {kaderBinaan.map(k => {
                      const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                      return (
                        <tr key={k.nim} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: '#555' }}>{k.nim} <br/> <span style={{fontSize: '0.7rem', color: '#1e824c'}}>Agt. {thnMasuk}</span></td>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: '#333' }}>{k.nama}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}><button onClick={() => { setSelectedKader(k.nim); setActiveMenu('input-nilai'); }} style={{ padding: '8px 15px', backgroundColor: '#1e824c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Buka Raport 📝</button></td>
                        </tr>
                      )
                    })}
                    {kaderBinaan.length === 0 && <tr><td colSpan={3} style={{textAlign: 'center', padding: '20px', color: '#999'}}>Belum ada kader binaan yang diplotkan ke Anda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 2: INPUT NILAI & EVALUASI */}
          {activeMenu === 'input-nilai' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              
              {/* HEADER DROPDOWN BERJEJER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h3 style={{ color: '#1e824c', margin: 0 }}>Input Nilai & Evaluasi</h3>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Kader:</span>
                    <select value={selectedKader} onChange={(e) => setSelectedKader(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '200px' }}>
                      {kaderBinaan.length === 0 && <option value="">Tidak ada binaan</option>}
                      {kaderBinaan.map(k => {
                        const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                        return <option key={k.nim} value={k.nim}>{k.nama} ({thnMasuk})</option>
                      })}
                    </select>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Jenjang:</span>
                    <div style={{ padding: '8px 20px', backgroundColor: '#eef2f3', borderRadius: '4px', fontWeight: 'bold', color: '#2c3e50', border: '1px solid #ccc' }}>{selectedJenjang}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>
                <button onClick={() => setTabInput('materi')} style={{ padding: '12px 20px', border: 'none', background: tabInput === 'materi' ? '#1e824c' : 'transparent', color: tabInput === 'materi' ? 'white' : '#777', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px 4px 0 0' }}>📑 Raport Kaderisasi</button>
                <button onClick={() => setTabInput('keaktifan')} style={{ padding: '12px 20px', border: 'none', background: tabInput === 'keaktifan' ? '#1e824c' : 'transparent', color: tabInput === 'keaktifan' ? 'white' : '#777', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px 4px 0 0' }}>📊 Evaluasi Keaktifan</button>
              </div>

              {tabInput === 'materi' && (
                <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '4px', padding: '15px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '600px' }}>
                    <thead style={{ backgroundColor: '#1e824c', color: 'white' }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'center' }}>No</th><th style={{ padding: '12px' }}>Kode</th><th style={{ padding: '12px' }}>Nama Materi / Kegiatan</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>SKS</th><th style={{ padding: '12px', textAlign: 'center' }}>Nilai</th><th style={{ padding: '12px', textAlign: 'center' }}>SKS x Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiAktif.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Kurikulum jenjang {selectedJenjang} belum diatur oleh Admin Rayon.</td></tr>
                      ) : barisRaportRender}
                      <tr style={{ borderTop: '2px solid #ddd', fontWeight: 'bold' }}><td colSpan={3} style={{ textAlign: 'center', padding: '15px', color: '#333' }}>Jumlah</td><td style={{ textAlign: 'center' }}>{totalSks}</td><td></td><td style={{ textAlign: 'center' }}>{totalBobotNilai}</td></tr>
                      <tr style={{ borderTop: '1px solid #333' }}><td colSpan={5} style={{ textAlign: 'center', padding: '20px', fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>IP (Indeks Prestasi) Kader</td><td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: '#c0392b' }}>{ipKader}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {tabInput === 'keaktifan' && (
                <div style={{ backgroundColor: '#fafafa', padding: '25px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', backgroundColor: 'white', borderCollapse: 'collapse', marginBottom: '25px', border: '1px solid #ddd', minWidth: '400px' }}>
                      <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}><tr><th style={{ padding: '12px' }}>Kategori Penilaian (%)</th><th style={{ textAlign: 'center', width: '120px' }}>Nilai (0-100)</th><th style={{ textAlign: 'center', width: '50px' }}>Hapus</th></tr></thead>
                      <tbody>
                        {listKeaktifan.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px', fontWeight: 'bold', color: '#555' }}>{item.kategori}</td>
                            <td style={{ padding: '12px' }}><input type="number" min="0" max="100" value={item.nilai} onChange={e => handleUbahNilaiKeaktifan(item.id, Number(e.target.value))} style={{ width: '100%', padding: '10px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' }} /></td>
                            <td style={{ textAlign: 'center' }}><button onClick={() => handleHapusKategori(item.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>×</button></td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: '#f9f9f9' }}>
                          <td style={{ padding: '10px' }}><input type="text" value={newKategori} onChange={e => setNewKategori(e.target.value)} placeholder="Tambah kategori penilaian baru..." style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} /></td>
                          <td colSpan={2} style={{ padding: '10px' }}><button onClick={handleAddKategori} style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Tambah</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <label style={{display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#555'}}>Catatan Pesan Pendamping:</label>
                  <textarea rows={4} value={catatanKeaktifan} onChange={e => setCatatanKeaktifan(e.target.value)} placeholder="Tuliskan evaluasi etika, saran, atau catatan lainnya untuk kader..." style={{ width: '100%', padding: '15px', marginBottom: '20px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }} />
                  <button onClick={handleSimpanKeaktifan} disabled={isSavingKeaktifan} style={{ width: '100%', padding: '15px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>{isSavingKeaktifan ? 'Menyimpan...' : '💾 Simpan Evaluasi Keaktifan'}</button>
                </div>
              )}
            </div>
          )}

          {/* MENU 3: VERIFIKASI TUGAS */}
          {activeMenu === 'berkas-tugas' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <h3 style={{color: '#2c3e50'}}>Verifikasi Tugas Kader Binaan</h3>
              <div style={{overflowX: 'auto'}}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '500px' }}>
                  <thead style={{ backgroundColor: '#f8f9fa' }}><tr><th style={{ padding: '12px', textAlign: 'left' }}>Kader / Tanggal</th><th style={{ padding: '12px', textAlign: 'left' }}>Nama Tugas</th><th style={{ textAlign: 'center' }}>Dokumen</th><th style={{ textAlign: 'center' }}>Status</th></tr></thead>
                  <tbody>
                    {berkasTugas.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px' }}><b style={{color: '#004a87'}}>{b.email_kader.split('@')[0]}</b><br/><span style={{fontSize: '0.7rem', color: '#999'}}>{b.tanggal}</span></td>
                        <td style={{ padding: '12px' }}><b>{b.jenis_berkas}</b><br/><span style={{fontSize: '0.75rem', color: '#666'}}>{b.nama_file_asli}</span></td>
                        <td style={{ textAlign: 'center' }}><a href={b.file_link_or_id} target="_blank" style={{ padding: '6px 12px', backgroundColor: '#f1c40f', borderRadius: '4px', textDecoration: 'none', color: '#333', fontWeight: 'bold', fontSize: '0.75rem' }}>👁️ Lihat</a></td>
                        <td style={{ textAlign: 'center' }}>{b.status === 'Selesai' ? <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✅ Selesai</span> : <button onClick={() => handleVerifikasiTugas(b.id)} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>Verifikasi</button>}</td>
                      </tr>
                    ))}
                    {berkasTugas.length === 0 && <tr><td colSpan={4} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada berkas yang diunggah oleh kader binaan Anda.</td></tr>}
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