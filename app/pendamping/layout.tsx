'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function PendampingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [profilPendamping, setProfilPendamping] = useState({ 
    nama: 'Loading...', username: '', fotoUrl: 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO', jenjangTugas: 'MAPABA', id_rayon: ''
  });
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  const [tugasMenunggu, setTugasMenunggu] = useState(0);

  useEffect(() => {
    let unsubs: (() => void)[] = []; // Array penyimpan fungsi pembersih listener

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            if (p.role !== 'pendamping') {
              alert(`Akses Ditolak! Anda bukan Pendamping.`);
              signOut(auth); router.push('/'); return;
            }

            setProfilPendamping({ 
              nama: p.nama || '', username: p.username || '', fotoUrl: p.fotoUrl || 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO', 
              jenjangTugas: p.jenjangTugas || 'MAPABA', id_rayon: p.id_rayon || ''
            });

            // Set Nama Rayon
            if (p.id_rayon === 'Komisariat') {
               setNamaRayonInduk('Pusat Komisariat');
            } else if (p.id_rayon) {
               const unsubRayon = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                 if (rayonSnap.exists()) setNamaRayonInduk(rayonSnap.data().nama || p.id_rayon);
               });
               unsubs.push(unsubRayon);
            }

            // Hitung badge Tugas Menunggu
            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const emailKaderBinaan: string[] = [];
            
            snapKader.forEach(d => {
              const data = d.data();
              let isBinaan = false;
              if (p.id_rayon === 'Komisariat') {
                  if (Array.isArray(data.pendamping_skp_id)) { if (data.pendamping_skp_id.includes(p.username)) isBinaan = true; } 
                  else if (data.pendamping_skp_id === p.username) isBinaan = true;
              } else {
                  const pMapaba = Array.isArray(data.pendamping_mapaba_id) ? data.pendamping_mapaba_id : (data.pendamping_mapaba_id ? [data.pendamping_mapaba_id] : []);
                  const pPkd = Array.isArray(data.pendamping_pkd_id) ? data.pendamping_pkd_id : (data.pendamping_pkd_id ? [data.pendamping_pkd_id] : []);
                  const pSig = Array.isArray(data.pendamping_sig_id) ? data.pendamping_sig_id : (data.pendamping_sig_id ? [data.pendamping_sig_id] : []);
                  if (pMapaba.includes(p.username) || pPkd.includes(p.username) || pSig.includes(p.username) || data.pendampingId === p.username) isBinaan = true;
              }
              if (isBinaan) emailKaderBinaan.push(data.email);
            });

            if (emailKaderBinaan.length > 0) {
              const unsubBerkas = onSnapshot(collection(db, "berkas_kader"), (snap: any) => {
                 let count = 0;
                 snap.forEach((doc: any) => {
                   const d = doc.data();
                   if (emailKaderBinaan.includes(d.email_kader) && d.status === 'Menunggu Verifikasi') count++;
                 });
                 setTugasMenunggu(count);
              });
              unsubs.push(unsubBerkas);
            }
            setIsLoading(false);
          }
        });
        unsubs.push(unsubRole);
      } else { router.push('/'); }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub()); // Matikan semua listener saat keluar
    };
  }, [router]);

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const menuItems = [
    { id: '/pendamping/dashboard', icon: '🏠', label: 'Dashboard Utama' },
    { id: '/pendamping/profil', icon: '👤', label: 'Profil Saya' },
    { id: '/pendamping/kalender', icon: '📅', label: 'Jadwal Mentoring' },
    { id: '/pendamping/broadcast', icon: '📡', label: 'Pengumuman Binaan' },
    { id: '/pendamping/daftar-kader', icon: '👥', label: 'Daftar Binaan' },
    { id: '/pendamping/input-nilai', icon: '📊', label: 'Raport Kaderisasi' },
    { id: '/pendamping/berkas-tugas', icon: '📋', label: 'Verifikasi Tugas', badge: tugasMenunggu > 0 ? tugasMenunggu : null },
    { id: '/pendamping/tes-pemahaman', icon: '📝', label: 'Hasil Tes Binaan' },
  ];

  const activeMenu = menuItems.find(m => pathname.includes(m.id)) || menuItems[0];

  if (isLoading) return <div style={{display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center'}}>Memuat Sistem...</div>;

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      <style>{`
        * { box-sizing: border-box; } 
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.4); }
        input, select, textarea { max-width: 100%; outline: none; }
        
        @media (min-width: 768px) { 
          aside.sidebar-desktop { left: 0 !important; } 
          .main-content { margin-left: ${isSidebarCollapsed ? '80px' : '260px'} !important; } 
          .menu-burger { display: none !important; } 
          .toggle-collapse { display: block !important; }
        }
        @media (max-width: 767px) {
          .toggle-collapse { display: none !important; }
          .main-content { margin-left: 0 !important; }
        }
        div[style*="overflowX: auto"], div[style*="overflow-x: auto"] { -webkit-overflow-scrolling: touch; }
        
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 600px; }
        .tabel-utama thead tr { border-top: 2px solid #555; border-bottom: 2px solid #555; background-color: #fff; }
        .tabel-utama th { padding: 10px; color: #333; text-align: center; font-weight: bold; }
        .tabel-utama td { padding: 8px 10px; border-bottom: 1px solid #ddd; color: #333; }
      `}</style>
      
      {isSidebarOpen && (<div className="no-print" onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }} />)}

      <aside className="no-print sidebar-desktop" style={{ width: isSidebarCollapsed ? '80px' : '260px', background: 'linear-gradient(100deg, #0000af 100%)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 10px rgba(0,0,0,0.1)', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'all 0.3s ease' }}>
        <div style={{ padding: '15px', fontSize: '1.1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{ fontSize: '1.5rem' }}>🎓</span>
            {!isSidebarCollapsed && <span style={{ color: 'white', whiteSpace: 'nowrap' }}>SIAKAD PMII</span>}
          </div>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>
        
        {!isSidebarCollapsed && (
          <div style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <img src={profilPendamping.fotoUrl} alt="Foto" style={{ width: '45px', height: '45px', backgroundColor: '#e74c3c', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f1c40f' }} />
            <div>
              <h4 style={{ fontSize: '0.8rem', margin: '0 0 3px 0', color: '#fff', lineHeight: '1.2' }}>{profilPendamping.nama}</h4>
              <p style={{ fontSize: '0.7rem', color: '#f1c40f', margin: 0, fontWeight: 'bold' }}>Pendamping: {profilPendamping.jenjangTugas}</p>
            </div>
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: '10px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {menuItems.map((item) => {
            const isActive = pathname.includes(item.id);
            return (
              <li key={item.id}>
                <Link href={item.id} onClick={() => setIsSidebarOpen(false)} style={{ textDecoration: 'none', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: isActive ? '#f1c40f' : '#ecf0f1', padding: isSidebarCollapsed ? '15px 0' : '12px 15px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', gap: isSidebarCollapsed ? '0' : '10px', fontSize: '0.85rem', cursor: 'pointer', borderLeft: isActive ? '4px solid #f1c40f' : '4px solid transparent', backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', transition: '0.2s', fontWeight: isActive ? 'bold' : 'normal' }}>
                  <div style={{ display: 'flex', gap: '10px' }}><span style={{ fontSize: '1.2rem' }} title={isSidebarCollapsed ? item.label : ''}>{item.icon}</span> {!isSidebarCollapsed && <span>{item.label}</span>}</div>
                  {!isSidebarCollapsed && item.badge && <span style={{ backgroundColor: '#e74c3c', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>{item.badge}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#f1c40f', border: '1px solid #f1c40f', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }} title={isSidebarCollapsed ? 'Keluar Sistem' : ''}>🚪</span>
            {!isSidebarCollapsed && <span>Keluar Sistem</span>}
          </button>
        </div>
      </aside>

      <main className="no-print main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden', transition: 'all 0.3s ease' }}>
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <button className="toggle-collapse" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#555', padding: '5px' }}>{isSidebarCollapsed ? '▶' : '◀'}</button>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, textTransform: 'uppercase', fontWeight: 'bold' }}>{activeMenu.label}</h2>
            <div style={{ fontSize: '0.75rem', color: '#1e824c', fontWeight: 'bold', backgroundColor: '#e8f5e9', padding: '4px 10px', borderRadius: '15px' }}>👤 : {namaRayonInduk}</div>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}