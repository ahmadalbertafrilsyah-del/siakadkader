'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function RayonLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [adminRayonId, setAdminRayonId] = useState('');
  const [profilRayon, setProfilRayon] = useState({ 
    nama: 'Memuat...', 
    fotoLogoUrl: 'https://via.placeholder.com/200x200/0000af/fff?text=Rayon' 
  });

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole) => {
          if (!snapRole.empty) {
            const userData = snapRole.docs[0].data();
            if (userData.role !== 'rayon') {
              alert(`Akses Ditolak! Anda bukan Pengurus Rayon.`);
              signOut(auth);
              router.push('/');
              return;
            }
            
            const currentRayonId = userData.username;
            setAdminRayonId(currentRayonId);

            const unsubRayon = onSnapshot(doc(db, "users", currentRayonId), (rayonSnap) => {
              if (rayonSnap.exists()) {
                const rData = rayonSnap.data();
                setProfilRayon({
                  nama: rData.nama || currentRayonId,
                  fotoLogoUrl: rData.fotoLogoUrl || 'https://via.placeholder.com/200x200/0000af/fff?text=Rayon'
                });
              }
            });
            unsubs.push(unsubRayon);
            
            setIsLoading(false);
          }
        });
        unsubs.push(unsubRole);
      } else { 
        router.push('/'); 
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub());
    };
  }, [router]);

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const menuItems = [
    { id: '/rayon/dashboard', icon: '🏠', label: 'Dashboard Utama' },
    { id: '/rayon/profil-rayon', icon: '🏢', label: 'Profil Rayon' },
    { id: '/rayon/kalender', icon: '📅', label: 'Kalender & Jadwal' },
    { id: '/rayon/broadcast', icon: '📡', label: 'Broadcast Notifikasi' },
    { id: '/rayon/manajemen-akun', icon: '👥', label: 'Manajemen Akun' },
    { id: '/rayon/kurikulum', icon: '📚', label: 'Kurikulum Kaderisasi' }, 
    { id: '/rayon/pantau-nilai', icon: '📊', label: 'Raport Kaderisasi' },
    { id: '/rayon/pengaturan-sertifikat', icon: '📜', label: 'Sertifikat Digital' }, 
    { id: '/rayon/manajemen-tes', icon: '📝', label: 'Manajemen Tes' },
    { id: '/rayon/master-tugas', icon: '📋', label: 'Manajemen Tugas' }, 
    { id: '/rayon/perpus', icon: '📁', label: 'Perpustakaan Digital' }, 
  ];

  const mobileNavItems = [
    { id: '/rayon/dashboard', icon: '🏠', label: 'Home' },
    { id: '/rayon/manajemen-akun', icon: '👥', label: 'Akun' },
    { id: '/rayon/pantau-nilai', icon: '📊', label: 'Nilai KHS' },
    { id: '/rayon/master-tugas', icon: '📋', label: 'Tugas' },
    { id: '/rayon/profil-rayon', icon: '🏢', label: 'Profil' }
  ];

  const activeMenu = menuItems.find(m => pathname.includes(m.id)) || menuItems[0];

  if (isLoading) return <div style={{display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#0000af', fontWeight: 'bold'}}>Memuat Sistem SIAKAD...</div>;

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS MASTER LAYOUT & TABEL ELEGAN */}
      <style>{`
        * { box-sizing: border-box; } 
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
        input, select, textarea { max-width: 100%; outline: none; }
        
        .mobile-only { display: none !important; }
        .desktop-only { display: flex !important; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; overflow-x: auto; }
        .hide-scroll::-webkit-scrollbar { display: none; }
        
        /* ----------------------------------------------------- */
        /* PERBAIKAN WARNA TABEL: BIRU GELAP & KUNING            */
        /* ----------------------------------------------------- */
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .tabel-utama thead th { 
          background-color: #0000af !important; /* Warna Biru PMII */
          color: #f1c40f !important; /* Teks Kuning PMII */
          padding: 14px 15px; 
          font-weight: bold; 
          border: 1px solid rgba(255,255,255,0.15) !important;
          white-space: nowrap;
        }
        .tabel-utama tbody td { 
          padding: 12px 15px; 
          border-bottom: 1px solid #eee; 
          color: #333; 
          background-color: #fff; 
        }
        .tabel-utama tbody tr:hover td { background-color: #f0f5ff !important; }

        /* ----------------------------------------------------- */
        /* PENGATURAN KHUSUS HP (MOBILE FIRST)                   */
        /* ----------------------------------------------------- */
        @media (max-width: 767px) { 
          .mobile-only { display: flex !important; }
          .desktop-only { display: none !important; }
          
          /* Hilangkan Sidebar di HP */
          aside.sidebar-desktop { display: none !important; }
          .main-content { 
             margin-left: 0 !important; 
             background-color: #f4f6f9 !important;
          } 
          /* Hilangkan Padding Global agar Header Biru Bisa Edge-to-Edge */
          .mobile-content-wrapper { padding: 0 !important; }
          
          /* TABEL MENGECIL DI HP AGAR TIDAK MAKAN TEMPAT */
          .tabel-utama { font-size: 0.75rem !important; }
          .tabel-utama thead th { padding: 10px 8px !important; }
          .tabel-utama tbody td { padding: 10px 8px !important; }
        }

        /* ----------------------------------------------------- */
        /* PENGATURAN MODE LAPTOP/PC                             */
        /* ----------------------------------------------------- */
        @media (min-width: 768px) { 
          aside.sidebar-desktop { left: 0 !important; } 
          .main-content { margin-left: ${isSidebarCollapsed ? '80px' : '260px'} !important; } 
          .menu-burger { display: none !important; } 
          .toggle-collapse { display: block !important; }
          /* Padding standar desktop */
          .mobile-content-wrapper { padding: 25px !important; }
        }
      `}</style>
      
      {/* OVERLAY UNTUK HP */}
      {isSidebarOpen && ( <div className="no-print" onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }} /> )}

      {/* SIDEBAR DESKTOP */}
      <aside className="no-print sidebar-desktop" style={{ width: isSidebarCollapsed ? '80px' : '260px', background: 'linear-gradient(100deg, #0000af 100%)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 10px rgba(0,0,0,0.1)', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'all 0.3s ease' }}>
        <div style={{ padding: '15px', fontSize: '1.1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{ fontSize: '1.5rem' }}>🏛️</span>
            {!isSidebarCollapsed && <span style={{ color: 'white', letterSpacing: '1px', whiteSpace: 'nowrap' }}>SIAKAD PMII</span>}
          </div>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>
        
        {!isSidebarCollapsed && (
          <div style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <img src={profilRayon.fotoLogoUrl} alt="Logo" style={{ width: '45px', height: '45px', backgroundColor: '#fff', borderRadius: '50%', objectFit: 'contain', border: '2px solid #f1c40f' }} />
            <div>
              <h4 style={{ fontSize: '0.8rem', margin: '0 0 3px 0', color: '#fff', lineHeight: '1.2' }}>{profilRayon.nama}</h4>
              <p style={{ fontSize: '0.7rem', color: '#f1c40f', margin: 0, fontWeight: 'bold' }}>Admin Rayon</p>
            </div>
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: '10px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {menuItems.map((item) => {
            const isActive = pathname.includes(item.id);
            return (
              <li key={item.id}>
                <Link href={item.id} onClick={() => setIsSidebarOpen(false)} style={{ textDecoration: 'none', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: isActive ? '#f1c40f' : '#ecf0f1', padding: isSidebarCollapsed ? '15px 0' : '12px 15px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: isSidebarCollapsed ? '0' : '10px', fontSize: '0.85rem', cursor: 'pointer', borderLeft: isActive ? '4px solid #f1c40f' : '4px solid transparent', backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', transition: '0.2s', fontWeight: isActive ? 'bold' : 'normal' }}>
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
            <div style={{ fontSize: '0.75rem', color: '#0000af', fontWeight: 'bold', backgroundColor: '#eaf4fc', padding: '4px 10px', borderRadius: '15px' }}>🏛️ : {adminRayonId}</div>
          </div>
        </header>

        {/* HEADER MOBILE APP BAR ONLY */}
        <header className="mobile-only" style={{ backgroundColor: '#0000af', padding: '20px 20px 15px 20px', justifyContent: 'space-between', alignItems: 'center', color: 'white', position: 'sticky', top: 0, zIndex: 40 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <img src={profilRayon.fotoLogoUrl} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #f1c40f', objectFit: 'contain', backgroundColor: '#fff' }} />
             <div>
               <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Admin Rayon</div>
               <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#f1c40f' }}>{profilRayon.nama}</div>
             </div>
           </div>
           <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => router.push('/rayon/broadcast')}>
              <span style={{ fontSize: '1.5rem' }}>📢</span>
           </div>
        </header>

        {/* AREA KONTEN (PAGES DI-INJEKSI DISINI) */}
        <div className="mobile-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>

        {/* BOTTOM NAVIGATION MOBILE APP ONLY */}
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