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
    formData.append("upload_preset", "nama_preset_kamu_disini"); // Sesuaikan preset Anda
    const res = await fetch("https://api.cloudinary.com/v1_1/your_cloud_name/auto/upload", {
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
  // LOGIKA FUNGSI (YANG SEBELUMNYA HILANG/ERROR)
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

  // LOGIKA HITUNG IP (SAMA DENGAN RAYON)
  let totalSks = 0;
  let totalBobotNilai = 0;
  const barisRaportRender = materiAktif.map((materi, index) => {
    const nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
    const angkaNilai = konversiHurufKeAngka(nilaiHuruf);
    const sksKaliNilai = (materi.bobot || 0) * angkaNilai;
    totalSks += (materi.bobot || 0);
    if (nilaiHuruf !== "-") totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode} style={{ borderBottom: '1px solid #eee' }}>
        <td style={{ padding: '12px', textAlign: 'center' }}>{index + 1}</td>
        <td style={{ padding: '12px', fontWeight: 'bold', color: '#666' }}>{materi.kode}</td>
        <td style={{ padding: '12px' }}>{materi.nama}</td>
        <td style={{ padding: '12px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '12px', textAlign: 'center' }}>
          <select value={nilaiHuruf === "-" ? "" : nilaiHuruf} onChange={(e) => handleUbahNilai(materi.kode, e.target.value)} style={{ padding: '5px 10px', border: `1px solid ${nilaiHuruf !== '-' ? '#f39c12' : '#ccc'}`, borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            <option value="">-</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select>
        </td>
        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
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
          <div style={{fontSize: '0.7rem', color: '#f1c40f'}}>Tugas: {profilPendamping.jenjangTugas}</div>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', flex: 1, margin: 0 }}>
          {[{ id: 'profil', icon: '👤', label: 'Profil Saya' }, { id: 'daftar-kader', icon: '📋', label: 'Daftar Binaan' }, { id: 'input-nilai', icon: '📝', label: 'Raport & Evaluasi' }, { id: 'berkas-tugas', icon: '📂', label: 'Verifikasi Tugas' }].map((item) => (
            <li key={item.id}>
              <button onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent', border: 'none', color: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent' }}>
                <span>{item.icon}</span> {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: '20px' }}><button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Keluar</button></div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <style>{`@media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }`}</style>
        
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>☰</button>
          <h2 style={{ fontSize: '1.1rem', color: '#333', margin: 0 }}>Dashboard Pendamping Rayon</h2>
        </header>

        <div style={{ padding: '20px', flex: 1 }}>
          
          {/* MENU PROFIL */}
          {activeMenu === 'profil' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', fontWeight: 'bold' }}>PROFIL SAYA</div>
              <div style={{ padding: '30px', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 180px', textAlign: 'center' }}>
                  <img src={profilPendamping.fotoUrl} style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '8px', border: '4px solid #eee' }} />
                  <input type="file" accept="image/*" onChange={handleFotoChange} style={{ marginTop: '10px', fontSize: '0.7rem', width: '100%' }} />
                  <button onClick={handleSimpanProfil} disabled={isSavingProfil} style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>{isSavingProfil ? '...' : 'Simpan Profil'}</button>
                </div>
                <div style={{ flex: '1 1 300px' }}>
                  <table style={{ width: '100%', fontSize: '0.9rem' }}>
                    <tbody>
                      <tr><td style={{ padding: '15px 0', fontWeight: 'bold', width: '40%' }}>Username</td><td>{profilPendamping.username}</td></tr>
                      <tr><td style={{ padding: '15px 0', fontWeight: 'bold' }}>Nama</td><td>{profilPendamping.nama}</td></tr>
                      <tr><td style={{ padding: '15px 0', fontWeight: 'bold' }}>Tugas Jenjang</td><td style={{ color: '#e67e22', fontWeight: 'bold' }}>{profilPendamping.jenjangTugas}</td></tr>
                      <tr><td style={{ padding: '15px 0', fontWeight: 'bold' }}>WA/HP</td><td><input type="text" value={profilPendamping.noHp} onChange={e => setProfilPendamping({...profilPendamping, noHp: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU DAFTAR KADER */}
          {activeMenu === 'daftar-kader' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <h3 style={{ marginTop: 0 }}>Daftar Kader Binaan Anda</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ backgroundColor: '#f8f9fa' }}><tr><th style={{ padding: '12px' }}>NIM</th><th style={{ padding: '12px' }}>Nama Kader</th><th style={{ padding: '12px', textAlign: 'center' }}>Aksi</th></tr></thead>
                <tbody>
                  {kaderBinaan.map(k => (
                    <tr key={k.nim} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px' }}>{k.nim}</td><td style={{ padding: '12px', fontWeight: 'bold' }}>{k.nama}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}><button onClick={() => { setSelectedKader(k.nim); setActiveMenu('input-nilai'); }} style={{ padding: '6px 12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Input Nilai</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* MENU INPUT NILAI & EVALUASI */}
          {activeMenu === 'input-nilai' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h3 style={{ margin: 0, color: '#1e824c' }}>Raport & Nilai Kader</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Kader:</span>
                  <select value={selectedKader} onChange={(e) => setSelectedKader(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px' }}>
                    {kaderBinaan.map(k => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
                  </select>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Jenjang:</span>
                  <div style={{ padding: '8px 15px', backgroundColor: '#eef2f3', borderRadius: '4px', fontWeight: 'bold', color: '#2c3e50' }}>{selectedJenjang}</div>
                </div>
              </div>

              <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>
                <button onClick={() => setTabInput('materi')} style={{ padding: '12px 20px', border: 'none', background: tabInput === 'materi' ? '#1e824c' : 'transparent', color: tabInput === 'materi' ? 'white' : '#777', fontWeight: 'bold', cursor: 'pointer' }}>📑 Raport Kaderisasi</button>
                <button onClick={() => setTabInput('keaktifan')} style={{ padding: '12px 20px', border: 'none', background: tabInput === 'keaktifan' ? '#1e824c' : 'transparent', color: tabInput === 'keaktifan' ? 'white' : '#777', fontWeight: 'bold', cursor: 'pointer' }}>📊 Evaluasi Keaktifan</button>
              </div>

              {tabInput === 'materi' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ backgroundColor: '#1e824c', color: 'white' }}>
                      <tr>
                        <th style={{ padding: '12px' }}>No</th><th style={{ padding: '12px' }}>Kode</th><th style={{ padding: '12px' }}>Nama Materi / Kegiatan</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>SKS</th><th style={{ padding: '12px', textAlign: 'center' }}>Nilai</th><th style={{ padding: '12px', textAlign: 'center' }}>SKS x Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiAktif.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Kurikulum {selectedJenjang} kosong.</td></tr>
                      ) : barisRaportRender}
                      <tr style={{ borderTop: '2px solid #ddd', fontWeight: 'bold' }}><td colSpan={3} style={{ textAlign: 'center', padding: '15px' }}>Jumlah</td><td style={{ textAlign: 'center' }}>{totalSks}</td><td></td><td style={{ textAlign: 'center' }}>{totalBobotNilai}</td></tr>
                      <tr style={{ borderTop: '1px solid #333' }}><td colSpan={5} style={{ textAlign: 'center', padding: '20px', fontWeight: 'bold', fontSize: '1rem' }}>IP (Indeks Prestasi) Kader</td><td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: '#c0392b' }}>{ipKader}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {tabInput === 'keaktifan' && (
                <div style={{ backgroundColor: '#fafafa', padding: '20px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <table style={{ width: '100%', backgroundColor: 'white', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #ddd' }}>
                    <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}><tr><th style={{ padding: '12px' }}>Kategori Penilaian</th><th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Nilai (%)</th><th style={{ padding: '12px', textAlign: 'center', width: '50px' }}>Hapus</th></tr></thead>
                    <tbody>
                      {listKeaktifan.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.kategori}</td>
                          <td style={{ padding: '12px' }}><input type="number" value={item.nilai} onChange={e => handleUbahNilaiKeaktifan(item.id, Number(e.target.value))} style={{ width: '100%', padding: '8px', textAlign: 'center', border: '1px solid #ccc' }} /></td>
                          <td style={{ textAlign: 'center' }}><button onClick={() => handleHapusKategori(item.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button></td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#f9f9f9' }}>
                        <td style={{ padding: '10px' }}><input type="text" value={newKategori} onChange={e => setNewKategori(e.target.value)} placeholder="Tambah kategori..." style={{ width: '100%', padding: '8px', border: '1px solid #ddd' }} /></td>
                        <td colSpan={2} style={{ padding: '10px' }}><button onClick={handleAddKategori} style={{ width: '100%', padding: '8px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>+ Tambah</button></td>
                      </tr>
                    </tbody>
                  </table>
                  <textarea rows={3} value={catatanKeaktifan} onChange={e => setCatatanKeaktifan(e.target.value)} placeholder="Catatan pesan untuk kader..." style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <button onClick={handleSimpanKeaktifan} disabled={isSavingKeaktifan} style={{ width: '100%', padding: '12px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Simpan Evaluasi</button>
                </div>
              )}
            </div>
          )}

          {/* MENU VERIFIKASI TUGAS */}
          {activeMenu === 'berkas-tugas' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <h3>Cek & Verifikasi Tugas</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f8f9fa' }}><tr><th style={{ padding: '12px' }}>Kader</th><th>Tugas</th><th style={{ textAlign: 'center' }}>Berkas</th><th style={{ textAlign: 'center' }}>Aksi</th></tr></thead>
                <tbody>
                  {berkasTugas.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px' }}><b>{b.email_kader.split('@')[0]}</b><br/>{b.tanggal}</td>
                      <td><b>{b.jenis_berkas}</b></td>
                      <td style={{ textAlign: 'center' }}><a href={b.file_link_or_id} target="_blank" style={{ padding: '6px 12px', backgroundColor: '#f1c40f', borderRadius: '4px', textDecoration: 'none', color: '#333', fontWeight: 'bold' }}>Lihat</a></td>
                      <td style={{ textAlign: 'center' }}>{b.status === 'Selesai' ? <span style={{ color: 'green', fontWeight: 'bold' }}>Selesai</span> : <button onClick={() => handleVerifikasiTugas(b.id)} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '4px', fontWeight: 'bold' }}>Verifikasi</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}