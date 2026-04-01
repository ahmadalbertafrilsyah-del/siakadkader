'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, setDoc, doc, deleteDoc, addDoc, onSnapshot, where } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signOut as signOutSecondary } from 'firebase/auth';

export default function DashboardKomisariat() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState('beranda');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

  // --- STATE STATISTIK & DATA GLOBAL (REAL-TIME) ---
  const [statGlobal, setStatGlobal] = useState({ totalRayon: 0, totalKaderAktif: 0, totalPendamping: 0, totalSuratKeluar: 0 });
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  const [databaseKader, setDatabaseKader] = useState<any[]>([]);
  const [masterKurikulum, setMasterKurikulum] = useState<any[]>([]);

  // --- STATE FORM INPUT ---
  const [formRayon, setFormRayon] = useState({ id_rayon: '', nama_rayon: '', password: '' });
  const [formKurikulum, setFormKurikulum] = useState({ jenjang: 'MAPABA', kode: '', nama: '', muatan: '', bobot: 3 });
  
  // --- STATE PENCARIAN KADER ---
  const [searchKader, setSearchKader] = useState('');
  const [filterRayonKader, setFilterRayonKader] = useState('');

  // --- STATE PENGUMUMAN LOGIN ---
  const [pengumumanList, setPengumumanList] = useState<string[]>([]);
  const [newPengumuman, setNewPengumuman] = useState('');
  const [isSavingPengumuman, setIsSavingPengumuman] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // EFEK: AMBIL DATA REAL-TIME DARI FIREBASE & CEK ROLE
  // ==========================================
  useEffect(() => {
    // CEK LOGIN & ROLE
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole) => {
          if (!snapRole.empty) {
            const userData = snapRole.docs[0].data();
            if (userData.role !== 'komisariat') {
              alert(`Akses Ditolak! Anda bukan Pengurus Komisariat.`);
              signOut(auth);
              router.push('/');
              return;
            }
          }
        });
      } else {
        router.push('/');
      }
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      let kaderCount = 0;
      let pendampingCount = 0;
      let rayonCount = 0;
      const listKader: any[] = [];
      const listRayon: any[] = [];

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'kader') {
          kaderCount++;
          listKader.push({ id: doc.id, ...data });
        } else if (data.role === 'pendamping') {
          pendampingCount++;
        } else if (data.role === 'rayon') {
          rayonCount++;
          listRayon.push({ id: doc.id, ...data });
        }
      });

      setDatabaseKader(listKader);
      setDataRayon(listRayon);
      setStatGlobal(prev => ({ ...prev, totalKaderAktif: kaderCount, totalPendamping: pendampingCount, totalRayon: rayonCount }));
    });

    const unsubSurat = onSnapshot(collection(db, "pengajuan_surat"), (snap) => {
      setStatGlobal(prev => ({ ...prev, totalSuratKeluar: snap.size }));
    });

    const unsubKurikulumPusat = onSnapshot(collection(db, "master_kurikulum_pusat"), (snap) => {
      const listMateri: any[] = [];
      snap.forEach(doc => listMateri.push({ id: doc.id, ...doc.data() }));
      setMasterKurikulum(listMateri);
    });

    // Listener untuk Pengumuman Login
    const unsubPengumuman = onSnapshot(doc(db, "pengaturan_sistem", "pengumuman"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().listTeks) {
        setPengumumanList(docSnap.data().listTeks);
      }
    });

    return () => { unsubscribeAuth(); unsubUsers(); unsubSurat(); unsubKurikulumPusat(); unsubPengumuman(); };
  }, [router]);

  // ==========================================
  // FUNGSI MANAJEMEN PENGUMUMAN LOGIN 
  // ==========================================
  const handleTambahPengumuman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPengumuman.trim()) return;
    setPengumumanList([...pengumumanList, newPengumuman]);
    setNewPengumuman('');
  };

  const handleHapusPengumuman = (index: number) => {
    const newList = [...pengumumanList];
    newList.splice(index, 1);
    setPengumumanList(newList);
  };

  const handleSimpanPengumuman = async () => {
    setIsSavingPengumuman(true);
    try {
      await setDoc(doc(db, "pengaturan_sistem", "pengumuman"), {
        listTeks: pengumumanList,
        terakhirDiubah: Date.now()
      }, { merge: true });
      alert("Pengumuman berhasil disebarkan ke halaman Login!");
    } catch (error) {
      alert("Gagal menyimpan pengumuman.");
    } finally {
      setIsSavingPengumuman(false);
    }
  };

  // ==========================================
  // FUNGSI MANAJEMEN RAYON (DENGAN SECONDARY AUTH)
  // ==========================================
  const handleBuatAkunRayon = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Inisialisasi Auth Kedua agar tidak terlogout
    const apps = getApps();
    const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(auth.app.options, 'SecondaryApp');
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const safeUsername = formRayon.id_rayon.trim().toLowerCase();
      const emailBaru = `${safeUsername}@sikad.com`;
      
      // Buat akun menggunakan Auth Kedua
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formRayon.password);
      
      // Simpan Identitas ke Firestore
      await setDoc(doc(db, "users", safeUsername), {
        nama: formRayon.nama_rayon,
        username: safeUsername, 
        id_rayon: safeUsername, 
        email: emailBaru,
        role: "rayon",
        status: "Aktif",
        createdAt: Date.now()
      });
      
      // Buat template settingan UI
      await setDoc(doc(db, "settings_rayon", safeUsername), {
        id: safeUsername,
        nama: formRayon.nama_rayon,
        pengumuman: `Selamat datang di SiKad ${formRayon.nama_rayon}.`,
        warnaUtama: "#004a87",
        warnaAksen: "#f1c40f"
      });

      // Logout akun kedua dari background
      await signOutSecondary(secondaryAuth);

      alert(`Sukses! Akun Admin untuk ${formRayon.nama_rayon} berhasil dibuat tanpa logout dari Komisariat.\n\nUsername Login: ${safeUsername}\nPassword: ${formRayon.password}`);
      setFormRayon({ id_rayon: '', nama_rayon: '', password: '' });
      
    } catch (error: any) {
      alert("Gagal membuat akun Rayon: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // FUNGSI MASTER KURIKULUM PUSAT
  // ==========================================
  const handleTambahKurikulumPusat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "master_kurikulum_pusat"), {
        jenjang: formKurikulum.jenjang,
        kode: formKurikulum.kode,
        nama: formKurikulum.nama,
        muatan: formKurikulum.muatan,
        bobot: Number(formKurikulum.bobot),
        timestamp: Date.now()
      });
      alert("Materi berhasil ditambahkan ke kurikulum standar pusat!");
      setFormKurikulum({ ...formKurikulum, kode: '', nama: '', muatan: '' });
    } catch (error) {
      alert("Gagal menyimpan materi pusat.");
    }
  };

  const handleHapusKurikulumPusat = async (id: string) => {
    if(window.confirm("Hapus materi ini dari standar pusat?")) {
      await deleteDoc(doc(db, "master_kurikulum_pusat", id));
    }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const filteredKader = databaseKader.filter(kader => {
    const matchSearch = kader.nama?.toLowerCase().includes(searchKader.toLowerCase()) || kader.nim?.includes(searchKader);
    const matchRayon = filterRayonKader === '' || kader.id_rayon === filterRayonKader;
    return matchSearch && matchRayon;
  });

  // ==========================================
  // LOGIKA NAMA HEADER DINAMIS
  // ==========================================
  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'beranda': return 'Dashboard Statistik Global';
      case 'manajemen-rayon': return 'Manajemen Akun Rayon';
      case 'master-kurikulum': return 'Master Kurikulum Pusat';
      case 'database-kader': return 'Database Kader Se-UIN';
      case 'pengumuman': return 'Pengaturan Teks Login';
      default: return 'Pusat Komisariat';
    }
  };

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS UNTUK TAMPILAN WEB */}
      <style>{`
        @media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 600px; }
        .tabel-utama thead tr { border-bottom: 2px solid #ddd; background-color: #f8f9fa; }
        .tabel-utama th { padding: 10px; color: #555; text-align: left; font-weight: bold; }
        .tabel-utama td { padding: 10px; border-bottom: 1px solid #eee; color: #333; }
      `}</style>
      
      {/* SIDEBAR KOMISARIAT */}
      <aside style={{ 
        width: '260px', 
        background: 'linear-gradient(180deg, #0d1b2a 0%, #1b263b 100%)', 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column', 
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: isSidebarOpen ? '0' : '-260px',
        zIndex: 50,
        transition: 'left 0.3s ease'
      }}>
        <div style={{ padding: '20px 20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{ fontSize: '1.5rem' }}>🏛️</span>
            <span style={{ color: '#f1c40f', letterSpacing: '1px' }}>SIAKAD PMII</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '5px', color: '#fff', textTransform: 'uppercase' }}>Pusat Komisariat</h4>
          <p style={{ fontSize: '0.75rem', color: '#bdc3c7', margin: 0 }}>Sistem Informasi Kaderisasi</p>
        </div>

        <ul style={{ listStyle: 'none', padding: '15px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {[
            { id: 'beranda', icon: '📊', label: 'Dashboard Statistik' },
            { id: 'manajemen-rayon', icon: '🏢', label: 'Manajemen Rayon' },
            { id: 'master-kurikulum', icon: '📑', label: 'Master Kurikulum' },
            { id: 'database-kader', icon: '🌐', label: 'Database Kader Global' },
            { id: 'pengumuman', icon: '📢', label: 'Pengumuman Login' },
          ].map((item) => (
            <li key={item.id}>
              <button 
                onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }}
                style={{ 
                  width: '100%', textAlign: 'left', background: 'none', border: 'none', color: activeMenu === item.id ? '#f1c40f' : '#bdc3c7', 
                  padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.85rem', cursor: 'pointer',
                  borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent',
                  backgroundColor: activeMenu === item.id ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                  transition: '0.2s', fontWeight: activeMenu === item.id ? 'bold' : 'normal'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span> {item.label}
              </button>
            </li>
          ))}
        </ul>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', fontSize: '0.85rem' }}>
            🚪 Keluar Sistem
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT CONTAINER */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        marginLeft: '0', 
        width: '100%', 
        overflowX: 'hidden' 
      }}>
        
        {/* HEADER ATAS DINAMIS */}
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, fontWeight: 'bold', textTransform: 'uppercase' }}>
              {getHeaderTitle()}
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#555', backgroundColor: '#fdf2e9', padding: '4px 12px', borderRadius: '20px', border: '1px solid #f1c40f', fontWeight: 'bold' }}>
              Pusat Komisariat
            </span>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          
          {/* MENU 1: BERANDA STATISTIK */}
          {activeMenu === 'beranda' && (
            <div>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h2 style={{color: '#0d1b2a', marginTop: 0, fontSize: '1.5rem'}}>Overview Kaderisasi Komisariat 🏛️</h2>
                <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Pantau pergerakan kader, aktivitas Rayon, dan persebaran data seluruh anggota PMII di tingkat Komisariat.</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Rayon Terdaftar</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalRayon}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #2ecc71' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Kader (Se-UIN)</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalKaderAktif}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Pendamping</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalPendamping}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Surat Terdigitalisasi</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalSuratKeluar}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                <h4 style={{ marginTop: 0, color: '#0d1b2a', marginBottom: '15px' }}>Distribusi Rayon Aktif</h4>
                <table className="tabel-utama" style={{ minWidth: '400px' }}>
                  <thead>
                    <tr>
                      <th>Nama Rayon</th>
                      <th style={{ textAlign: 'center' }}>Total Kader Terdata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataRayon.length === 0 ? (
                      <tr><td colSpan={2} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada data rayon.</td></tr>
                    ) : (
                      dataRayon.map((rayon) => {
                        const jumlahKaderRayonIni = databaseKader.filter(k => k.id_rayon === rayon.id_rayon).length;
                        return (
                          <tr key={rayon.id}>
                            <td style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{rayon.nama}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#3498db' }}>{jumlahKaderRayonIni} Kader</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 2: MANAJEMEN RAYON */}
          {activeMenu === 'manajemen-rayon' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                  <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Daftar Instansi Rayon</h3>
                </div>
                
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>✏️ Buat Akun Admin Rayon</h4>
                    <form onSubmit={handleBuatAkunRayon} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Nama Rayon Pengenal</label>
                        <input type="text" placeholder="Misal: PR. PMII Tarbiyah" value={formRayon.nama_rayon} onChange={e => setFormRayon({...formRayon, nama_rayon: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Username Login (Kode Rayon)</label>
                        <input type="text" placeholder="Misal: admin_rkcd" value={formRayon.id_rayon} onChange={e => setFormRayon({...formRayon, id_rayon: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                        <span style={{fontSize: '0.65rem', color: '#888'}}>*Gunakan huruf kecil & tanpa spasi</span>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Password Login</label>
                        <input type="text" placeholder="Masukkan Password" value={formRayon.password} onChange={e => setFormRayon({...formRayon, password: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                      </div>
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#004a87', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px', fontSize: '0.85rem' }}>
                        {isSubmitting ? 'Memproses...' : '+ Daftarkan Rayon'}
                      </button>
                    </form>
                  </div>

                  <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <table className="tabel-utama" style={{ minWidth: '400px' }}>
                      <thead>
                        <tr>
                          <th>Nama Rayon</th>
                          <th>Username Login Admin</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataRayon.length === 0 ? (
                           <tr><td colSpan={3} style={{textAlign: 'center', padding: '20px', color: '#999'}}>Belum ada data rayon.</td></tr>
                        ) : (
                          dataRayon.map((rayon) => (
                            <tr key={rayon.id}>
                              <td style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{rayon.nama}</td>
                              <td style={{ color: '#666' }}>{rayon.username}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ backgroundColor: '#eef2f3', color: '#2ecc71', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>🟢 Aktif</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MENU 3: MASTER KURIKULUM PUSAT */}
          {activeMenu === 'master-kurikulum' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Master Kurikulum Kaderisasi</h3>
                <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Susun standar kurikulum yang komprehensif sebagai acuan seluruh Rayon se-UIN Malang.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <form onSubmit={handleTambahKurikulumPusat} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Jenjang Kaderisasi</label>
                      <select required value={formKurikulum.jenjang} onChange={e => setFormKurikulum({...formKurikulum, jenjang: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                        <option value="MAPABA">MAPABA</option>
                        <option value="PKD">PKD</option>
                        <option value="SIG">SIG (Sekolah Islam Gender)</option>
                        <option value="SKP">SKP (Sekolah Kader Putri)</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Kode</label>
                        <input type="text" placeholder="Cth: SIG-01" required value={formKurikulum.kode} onChange={e => setFormKurikulum({...formKurikulum, kode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Bobot (SKS/Jam)</label>
                        <input type="number" placeholder="Jam" required value={formKurikulum.bobot} onChange={e => setFormKurikulum({...formKurikulum, bobot: Number(e.target.value)})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Nama Materi Besar</label>
                      <input type="text" placeholder="Misal: Konsep Dasar Islam Gender" required value={formKurikulum.nama} onChange={e => setFormKurikulum({...formKurikulum, nama: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Muatan / Sub Pembahasan</label>
                      <textarea rows={3} placeholder="- Sejarah Gender&#10;- Peran Perempuan dalam Islam" value={formKurikulum.muatan} onChange={e => setFormKurikulum({...formKurikulum, muatan: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    </div>

                    <button type="submit" style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px', fontSize: '0.85rem' }}>+ Tambah Kurikulum Standar</button>
                  </form>
                </div>

                <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <table className="tabel-utama" style={{ minWidth: '550px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                        <th style={{ width: '100px', color: 'white' }}>Jenjang</th>
                        <th style={{ width: '80px', color: 'white' }}>Kode</th>
                        <th style={{ color: 'white' }}>Nama Materi & Muatan Pembahasan</th>
                        <th style={{ textAlign: 'center', width: '80px', color: 'white' }}>Bobot</th>
                        <th style={{ textAlign: 'center', width: '80px', color: 'white' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterKurikulum.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada data kurikulum pusat.</td></tr>
                      ) : (
                        masterKurikulum.sort((a,b) => a.jenjang.localeCompare(b.jenjang)).map((materi) => (
                          <tr key={materi.id}>
                            <td style={{ fontWeight: 'bold', color: materi.jenjang === 'MAPABA' ? '#1e824c' : materi.jenjang === 'PKD' ? '#8e44ad' : '#e67e22' }}>{materi.jenjang}</td>
                            <td style={{ color: '#666', fontWeight: 'bold' }}>{materi.kode}</td>
                            <td>
                              <div style={{ color: '#333', fontWeight: 'bold', marginBottom: '2px', fontSize: '0.85rem' }}>{materi.nama}</div>
                              <div style={{ color: '#777', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{materi.muatan || '-'}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{materi.bobot} Jam</td>
                            <td style={{ textAlign: 'center' }}>
                              <button onClick={() => handleHapusKurikulumPusat(materi.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }} title="Hapus Materi">🗑️</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU 4: DATABASE KADER GLOBAL */}
          {activeMenu === 'database-kader' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0d1b2a', margin: 0, marginBottom: '15px', fontSize: '1.1rem' }}>Pencarian Kader Global</h3>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Cari NIM / Nama Kader..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} style={{ flex: '1 1 200px', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none' }} />
                <select value={filterRayonKader} onChange={(e) => setFilterRayonKader(e.target.value)} style={{ flex: '1 1 150px', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Semua Rayon</option>
                  {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                </select>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                <table className="tabel-utama" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th>NIM</th>
                      <th>Nama Lengkap</th>
                      <th>Asal Rayon</th>
                      <th style={{ textAlign: 'center' }}>Jenjang Terakhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKader.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Data kader tidak ditemukan.</td></tr>
                    ) : (
                      filteredKader.map((kader) => (
                        <tr key={kader.nim}>
                          <td style={{ color: '#666', fontWeight: 'bold' }}>{kader.nim}</td>
                          <td style={{ color: '#333', fontWeight: 'bold' }}>{kader.nama}</td>
                          <td style={{ color: '#0d1b2a', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 'bold' }}>{kader.id_rayon}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ backgroundColor: kader.jenjang === 'MAPABA' ? '#e8f5e9' : '#f3e5f5', color: kader.jenjang === 'MAPABA' ? '#2e7d32' : '#7b1fa2', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {kader.jenjang || 'MAPABA'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 5: PENGUMUMAN LOGIN */}
          {activeMenu === 'pengumuman' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Pengumuman Halaman Login</h3>
                  <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Teks di bawah ini akan tayang dan bergeser otomatis (slider) di halaman depan SIAKAD.</p>
                </div>
                <button 
                  onClick={handleSimpanPengumuman} 
                  disabled={isSavingPengumuman}
                  style={{ backgroundColor: isSavingPengumuman ? '#95a5a6' : '#2ecc71', color: 'white', padding: '8px 15px', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: isSavingPengumuman ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                >
                  {isSavingPengumuman ? 'Menyimpan...' : '💾 Simpan & Siarkan'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>➕ Tambah Kalimat Baru</h4>
                  <form onSubmit={handleTambahPengumuman} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    <textarea 
                      rows={3}
                      placeholder="Misal: Pendaftaran PKD Cabang Kota Malang telah dibuka. Hubungi pengurus Rayon masing-masing." 
                      value={newPengumuman} 
                      onChange={e => setNewPengumuman(e.target.value)} 
                      required 
                      style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.85rem' }} 
                    />
                    <button type="submit" style={{ backgroundColor: '#0d1b2a', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Tambahkan ke Daftar</button>
                  </form>
                </div>

                <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ margin: 0, color: '#333', fontSize: '0.9rem' }}>📋 Daftar Teks Berjalan:</h4>
                  {pengumumanList.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>
                      Belum ada pengumuman.
                    </div>
                  ) : (
                    pengumumanList.map((teks, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', backgroundColor: '#eef2f3', borderLeft: '4px solid #1e824c', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#333', lineHeight: '1.5' }}>{teks}</span>
                        <button 
                          onClick={() => handleHapusPengumuman(index)} 
                          style={{ marginLeft: '15px', backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                        >
                          Hapus
                        </button>
                      </div>
                    ))
                  )}
                  <p style={{ fontSize: '0.75rem', color: '#e67e22', fontStyle: 'italic', marginTop: '10px' }}>
                    *Jangan lupa klik tombol <b>"Simpan & Siarkan"</b> di atas agar perubahan tampil di halaman login.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}