'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // EFEK: AMBIL DATA REAL-TIME DARI FIREBASE & CEK ROLE
  // ==========================================
  useEffect(() => {
    // CEK LOGIN & ROLE SAMA SEPERTI DI RAYON
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
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

    return () => { unsubscribeAuth(); unsubUsers(); unsubSurat(); unsubKurikulumPusat(); };
  }, [router]);

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

  return (
    <div style={{ display: 'flex', backgroundColor: '#f0f2f5', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
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
        <div style={{ padding: '25px 20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{ fontSize: '1.5rem' }}>🏛️</span>
            <span style={{ color: '#f1c40f', letterSpacing: '1px' }}>SIAKAD PMII</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '5px', color: '#fff' }}>ADMIN</h4>
          <p style={{ fontSize: '0.75rem', color: '#bdc3c7', margin: 0 }}>Sistem Informasi Kaderisasi</p>
        </div>

        <ul style={{ listStyle: 'none', padding: '15px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {[
            { id: 'beranda', icon: '📊', label: 'Dashboard Statistik' },
            { id: 'manajemen-rayon', icon: '🏢', label: 'Manajemen Rayon' },
            { id: 'master-kurikulum', icon: '📑', label: 'Master Kurikulum' },
            { id: 'database-kader', icon: '🌐', label: 'Database Kader Global' },
          ].map((item) => (
            <li key={item.id}>
              <button 
                onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }}
                style={{ 
                  width: '100%', textAlign: 'left', background: 'none', border: 'none', color: activeMenu === item.id ? '#f1c40f' : '#bdc3c7', 
                  padding: '15px 25px', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.9rem', cursor: 'pointer',
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
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}>
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
        <style>{`
          @media (min-width: 768px) {
            aside { left: 0 !important; }
            main { margin-left: 260px !important; }
            .menu-burger { display: none !important; }
          }
        `}</style>
        
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#0d1b2a', margin: 0, fontWeight: 'bold' }}>PK. PMII SUNAN AMPEL MALANG</h2>
            <span style={{ fontSize: '0.8rem', color: '#555', backgroundColor: '#fdf2e9', padding: '5px 15px', borderRadius: '20px', border: '1px solid #f1c40f', fontWeight: 'bold' }}>
              Pusat Komisariat
            </span>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          
          {/* MENU 1: BERANDA STATISTIK */}
          {activeMenu === 'beranda' && (
            <div>
              <h3 style={{ color: '#0d1b2a', marginTop: 0, marginBottom: '20px' }}>Overview Kaderisasi Komisariat</h3>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
                <div style={{ flex: '1 1 200px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderBottom: '4px solid #3498db' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.9rem', fontWeight: 'bold' }}>Total Rayon Terdaftar</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '10px' }}>{statGlobal.totalRayon}</div>
                </div>
                <div style={{ flex: '1 1 200px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderBottom: '4px solid #2ecc71' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.9rem', fontWeight: 'bold' }}>Total Kader (Se-UIN)</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '10px' }}>{statGlobal.totalKaderAktif}</div>
                </div>
                <div style={{ flex: '1 1 200px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderBottom: '4px solid #f1c40f' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.9rem', fontWeight: 'bold' }}>Total Pendamping</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '10px' }}>{statGlobal.totalPendamping}</div>
                </div>
                <div style={{ flex: '1 1 200px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderBottom: '4px solid #e74c3c' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.9rem', fontWeight: 'bold' }}>Surat Terdigitalisasi</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '10px' }}>{statGlobal.totalSuratKeluar}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                <h4 style={{ marginTop: 0, color: '#0d1b2a', marginBottom: '15px' }}>Distribusi Rayon Aktif</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '500px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                      <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Nama Rayon</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Total Kader Terdata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataRayon.map((rayon) => {
                      const jumlahKaderRayonIni = databaseKader.filter(k => k.id_rayon === rayon.id_rayon).length;
                      return (
                        <tr key={rayon.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: '#0d1b2a' }}>{rayon.nama}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#3498db' }}>{jumlahKaderRayonIni} Kader</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 2: MANAJEMEN RAYON */}
          {activeMenu === 'manajemen-rayon' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0 }}>Daftar Instansi Rayon</h3>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
                  <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>✏️ Buat Akun Admin Rayon Baru</h4>
                  <form onSubmit={handleBuatAkunRayon} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Rayon Pengenal</label>
                      <input type="text" placeholder="Misal: PR. PMII Tarbiyah" value={formRayon.nama_rayon} onChange={e => setFormRayon({...formRayon, nama_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Username Login (Kode Rayon)</label>
                      <input type="text" placeholder="Misal: admin_rkcd" value={formRayon.id_rayon} onChange={e => setFormRayon({...formRayon, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }} />
                      <span style={{fontSize: '0.7rem', color: '#888'}}>*Gunakan huruf kecil & tanpa spasi</span>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Password Login</label>
                      <input type="text" placeholder="Masukkan Password" value={formRayon.password} onChange={e => setFormRayon({...formRayon, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }} />
                    </div>
                    <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#004a87', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                      {isSubmitting ? 'Memproses...' : '+ Daftarkan Rayon'}
                    </button>
                  </form>
                </div>

                <div style={{ flex: '2 1 100%', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '400px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                        <th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Nama Rayon</th>
                        <th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Username Login Admin</th>
                        <th style={{ padding: '15px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataRayon.map((rayon) => (
                        <tr key={rayon.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '15px', fontWeight: 'bold', color: '#0d1b2a' }}>{rayon.nama}</td>
                          <td style={{ padding: '15px', color: '#666' }}>{rayon.username}</td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#eef2f3', color: '#2ecc71', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem' }}>🟢 Aktif</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU 3: MASTER KURIKULUM PUSAT */}
          {activeMenu === 'master-kurikulum' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ color: '#0d1b2a', margin: 0 }}>Master Kurikulum Kaderisasi</h3>
                  <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Susun standar kurikulum yang komprehensif sebagai acuan seluruh Rayon se-UIN Malang.</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
                  <form onSubmit={handleTambahKurikulumPusat} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Jenjang Kaderisasi</label>
                      <select required value={formKurikulum.jenjang} onChange={e => setFormKurikulum({...formKurikulum, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', marginTop: '5px' }}>
                        <option value="MAPABA">MAPABA</option>
                        <option value="PKD">PKD</option>
                        <option value="SIG">SIG (Sekolah Islam Gender)</option>
                        <option value="SKP">SKP (Sekolah Kader Putri)</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Kode</label>
                        <input type="text" placeholder="Misal: SIG-01" required value={formKurikulum.kode} onChange={e => setFormKurikulum({...formKurikulum, kode: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Bobot (SKS/Jam)</label>
                        <input type="number" placeholder="Jam" required value={formKurikulum.bobot} onChange={e => setFormKurikulum({...formKurikulum, bobot: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Materi Besar</label>
                      <input type="text" placeholder="Misal: Konsep Dasar Islam Gender" required value={formKurikulum.nama} onChange={e => setFormKurikulum({...formKurikulum, nama: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Muatan / Sub Pembahasan (Opsional)</label>
                      <textarea rows={3} placeholder="- Sejarah Gender&#10;- Peran Perempuan dalam Islam" value={formKurikulum.muatan} onChange={e => setFormKurikulum({...formKurikulum, muatan: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px', resize: 'vertical' }} />
                    </div>

                    <button type="submit" style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>+ Tambah Kurikulum Standar</button>
                  </form>
                </div>

                <div style={{ flex: '2 1 100%', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '650px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                        <th style={{ padding: '12px', borderBottom: '2px solid #ddd', width: '100px' }}>Jenjang</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #ddd', width: '80px' }}>Kode</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Nama Materi & Muatan Pembahasan</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '80px' }}>Bobot</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '80px' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterKurikulum.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada data kurikulum pusat.</td></tr>
                      ) : (
                        masterKurikulum.sort((a,b) => a.jenjang.localeCompare(b.jenjang)).map((materi) => (
                          <tr key={materi.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px', fontWeight: 'bold', color: materi.jenjang === 'MAPABA' ? '#1e824c' : materi.jenjang === 'PKD' ? '#8e44ad' : '#e67e22' }}>{materi.jenjang}</td>
                            <td style={{ padding: '12px', color: '#666', fontWeight: 'bold' }}>{materi.kode}</td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ color: '#333', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>{materi.nama}</div>
                              <div style={{ color: '#777', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{materi.muatan || '-'}</div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{materi.bobot} Jam</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button onClick={() => handleHapusKurikulumPusat(materi.id)} style={{ color: '#e74c3c', border: '1px solid #e74c3c', background: 'none', cursor: 'pointer', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px' }}>Hapus</button>
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
              <h3 style={{ color: '#0d1b2a', margin: 0, marginBottom: '15px' }}>Pencarian Kader Global</h3>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Cari NIM / Nama Kader..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} style={{ flex: '1 1 200px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
                <select value={filterRayonKader} onChange={(e) => setFilterRayonKader(e.target.value)} style={{ flex: '1 1 150px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
                  <option value="">Semua Rayon</option>
                  {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                </select>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                      <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>NIM</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Nama Lengkap</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Asal Rayon</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Jenjang Terakhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKader.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Data kader tidak ditemukan.</td></tr>
                    ) : (
                      filteredKader.map((kader) => (
                        <tr key={kader.nim} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', color: '#666', fontWeight: 'bold' }}>{kader.nim}</td>
                          <td style={{ padding: '12px', color: '#333', fontWeight: 'bold' }}>{kader.nama}</td>
                          <td style={{ padding: '12px', color: '#0d1b2a', textTransform: 'uppercase' }}>{kader.id_rayon}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: kader.jenjang === 'MAPABA' ? '#e8f5e9' : '#f3e5f5', color: kader.jenjang === 'MAPABA' ? '#2e7d32' : '#7b1fa2', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
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

        </div>
      </main>
    </div>
  );
}