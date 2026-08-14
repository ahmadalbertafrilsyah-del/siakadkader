'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function KaderLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [profilKader, setProfilKader] = useState({ 
    nama: 'Loading...', nim: '', fotoUrl: 'https://via.placeholder.com/200x250/3498db/fff?text=FOTO', jenjang: 'MAPABA', id_rayon: ''
  });
  const [namaRayonInduk, setNamaRayonInduk] = useState('');

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            if (p.role !== 'kader') {
              alert(`Akses Ditolak! Anda bukan Kader.`);
              signOut(auth); router.push('/'); return;
            }

            setProfilKader({ 
              nama: p.nama || '', nim: p.nim || '', fotoUrl: p.fotoUrl || 'https://via.placeholder.com/200x250/3498db/fff?text=FOTO', 
              jenjang: p.jenjang || 'MAPABA', id_rayon: p.id_rayon || ''
            });

            if (p.id_rayon === 'Komisariat' || p.id_rayon === 'Pusat Komisariat') {
               setNamaRayonInduk('Pusat Komisariat');
            } else if (p.id_rayon) {
               const unsubRayon = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                 if (rayonSnap.exists()) setNamaRayonInduk(rayonSnap.data().nama || p.id_rayon);
               });
               unsubs.push(unsubRayon);
            }
            setIsLoading(false);
          }
        });
        unsubs.push(unsubRole);
      } else { router.push('/'); }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub());
    };
  }, [router]);

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const menuItems = [
    { id: '/kader/dashboard', icon: '🏠', label: 'Beranda' },
    { id: '/kader/profil', icon: '👤', label: 'Profil Saya' },
    { id: '/kader/raport', icon: '🎓', label: 'Kartu Hasil Studi' },
    { id: '/kader/sertifikat', icon: '📜', label: 'Sertifikat Digital' },
    { id: '/kader/kalender', icon: '📅', label: 'Jadwal Kegiatan' },
    { id: '/kader/pengumuman', icon: '📢', label: 'Pengumuman' },
    { id: '/kader/perpustakaan', icon: '📚', label: 'Perpustakaan' },
    { id: '/kader/tugas', icon: '📋', label: 'Pengumpulan Tugas' },
    { id: '/kader/tes', icon: '📝', label: 'Ujian & Tes' },
  ];

  // Mobile Bottom Navigation Mapping (Hanya 5 Menu Utama)
  const mobileNavItems = [
    { id: '/kader/dashboard', icon: '🏠', label: 'Home' },
    { id: '/kader/kalender', icon: '📅', label: 'Jadwal' },
    { id: '/kader/raport', icon: '🎓', label: 'KHS' },
    { id: '/kader/tugas', icon: '📋', label: 'Tugas' },
    { id: '/kader/profil', icon: '👤', label: 'Profil' }
  ];

  const activeMenu = menuItems.find(m => pathname.includes(m.id)) || menuItems[0];

  if (isLoading) return <div style={{display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#0000af', fontWeight: 'bold'}}>Memuat Sistem SIAKAD...</div>;

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      <style>{`
        * { box-sizing: border-box; } 
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        input, select, textarea { max-width: 100%; outline: none; }
        
        .mobile-only { display: none !important; }
        .desktop-only { display: flex !important; }

        /* PENGATURAN MODE HP */
        @media (max-width: 767px) { 
          .mobile-only { display: flex !important; }
          .desktop-only { display: none !important; }
          
          /* Hilangkan Sidebar & Margin Konten di HP */
          aside.sidebar-desktop { display: none !important; }
          .main-content { 
             margin-left: 0 !important; 
             padding-bottom: 75px !important; /* Ruang untuk Bottom Nav */
             background-color: #f4f6f9 !important;
          } 
          .mobile-content-wrapper { padding: 0 !important; }
        }

        /* PENGATURAN MODE LAPTOP/PC */
        @media (min-width: 768px) { 
          aside.sidebar-desktop { left: 0 !important; } 
          .main-content { margin-left: ${isSidebarCollapsed ? '80px' : '260px'} !important; } 
          .menu-burger { display: none !important; } 
          .toggle-collapse { display: block !important; }
        }
        
        div[style*="overflowX: auto"], div[style*="overflow-x: auto"] { -webkit-overflow-scrolling: touch; }
      `}</style>
      
      {/* SIDEBAR DESKTOP */}
      <aside className="no-print sidebar-desktop" style={{ width: isSidebarCollapsed ? '80px' : '260px', background: 'linear-gradient(100deg, #0000af 100%)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 10px rgba(0,0,0,0.1)', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50, transition: 'all 0.3s ease' }}>
        <div style={{ padding: '15px', fontSize: '1.1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{ fontSize: '1.5rem' }}>🎓</span>
            {!isSidebarCollapsed && <span style={{ color: 'white', whiteSpace: 'nowrap' }}>SIAKAD PMII</span>}
          </div>
        </div>
        
        {!isSidebarCollapsed && (
          <div style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <img src={profilKader.fotoUrl} alt="Foto" style={{ width: '45px', height: '45px', backgroundColor: '#e74c3c', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f1c40f' }} />
            <div>
              <h4 style={{ fontSize: '0.8rem', margin: '0 0 3px 0', color: '#fff', lineHeight: '1.2' }}>{profilKader.nama}</h4>
              <p style={{ fontSize: '0.7rem', color: '#f1c40f', margin: 0, fontWeight: 'bold' }}>{profilKader.nim}</p>
            </div>
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: '10px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {menuItems.map((item) => {
            const isActive = pathname.includes(item.id);
            return (
              <li key={item.id}>
                <Link href={item.id} style={{ textDecoration: 'none', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: isActive ? '#f1c40f' : '#ecf0f1', padding: isSidebarCollapsed ? '15px 0' : '12px 15px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: isSidebarCollapsed ? '0' : '10px', fontSize: '0.85rem', cursor: 'pointer', borderLeft: isActive ? '4px solid #f1c40f' : '4px solid transparent', backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', transition: '0.2s', fontWeight: isActive ? 'bold' : 'normal' }}>
                  <span style={{ fontSize: '1.2rem' }} title={isSidebarCollapsed ? item.label : ''}>{item.icon}</span> 
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#f1c40f', border: '1px solid #f1c40f', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }} title={isSidebarCollapsed ? 'Keluar' : ''}>🚪</span>
            {!isSidebarCollapsed && <span>Keluar Sistem</span>}
          </button>
        </div>
      </aside>

      <main className="no-print main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden', transition: 'all 0.3s ease' }}>
        
        {/* HEADER DESKTOP ONLY */}
        <header className="desktop-only" style={{ backgroundColor: '#fff', padding: '15px 20px', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="toggle-collapse" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#555', padding: '5px' }}>{isSidebarCollapsed ? '▶' : '◀'}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, textTransform: 'uppercase', fontWeight: 'bold' }}>{activeMenu.label}</h2>
            <div style={{ fontSize: '0.75rem', color: '#0000af', fontWeight: 'bold', backgroundColor: '#eaf4fc', padding: '4px 10px', borderRadius: '15px' }}>🏛️ : {namaRayonInduk}</div>
          </div>
        </header>

        {/* HEADER MOBILE APP BAR ONLY (Warna Biru Khas PMII) */}
        <header className="mobile-only" style={{ backgroundColor: '#0000af', padding: '20px 20px 15px 20px', justifyContent: 'space-between', alignItems: 'center', color: 'white', position: 'sticky', top: 0, zIndex: 40 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <img src={profilKader.fotoUrl} alt="Foto" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #f1c40f', objectFit: 'cover' }} />
             <div>
               <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Salam, Sahabat/i</div>
               <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#f1c40f' }}>{profilKader.nama}</div>
             </div>
           </div>
           <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => router.push('/kader/pengumuman')}>
              <span style={{ fontSize: '1.5rem' }}>🔔</span>
              <span style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#e74c3c', width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #0000af' }}></span>
           </div>
        </header>

        {/* AREA KONTEN (PAGES) */}
        <div className="mobile-content-wrapper" style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {children}
        </div>

        {/* BOTTOM NAVIGATION MOBILE APP ONLY (Aksen Biru & Kuning) */}
        <nav className="mobile-only no-print" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff',
          justifyContent: 'space-around', alignItems: 'center',
          padding: '8px 0', borderTop: '1px solid #eaeaea', zIndex: 999,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}>
          {mobileNavItems.map(item => {
            const isActive = pathname.includes(item.id);
            return (
              <Link key={item.id} href={item.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none',
                color: isActive ? '#0000af' : '#95a5a6', gap: '4px', flex: 1
              }}>
                <span style={{ fontSize: '1.3rem', filter: isActive ? 'none' : 'grayscale(100%)', opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: isActive ? 'bold' : 'normal' }}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

      </main>
    </div>
  );
}