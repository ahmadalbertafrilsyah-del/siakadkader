'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function KomisariatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // MENGGUNAKAN LOGO BARU SEBAGAI DEFAULT FOTO
  const logoPusat = "https://i.ibb.co.com/nNhTXzYD/Asset-6-4x.png";

  const [profilKomisariat, setProfilKomisariat] = useState({ 
    nama: 'Loading...', username: '', fotoUrl: logoPusat
  });

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            if (p.role !== 'komisariat') {
              alert(`Akses Ditolak! Anda bukan Admin Komisariat.`);
              signOut(auth); router.push('/'); return;
            }

            setProfilKomisariat({ 
              nama: p.nama || 'Pusat Komisariat', username: p.username || '', fotoUrl: p.fotoUrl || logoPusat 
            });
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
    { id: '/komisariat/dashboard', icon: '🏠', label: 'Dashboard Utama' },
    { id: '/komisariat/manajemen-rayon', icon: '🏢', label: 'Manajemen Rayon' },
    { id: '/komisariat/database-kader', icon: '👥', label: 'Database Kader' },
    { id: '/komisariat/master-kurikulum', icon: '📚', label: 'Master Kurikulum' },
    { id: '/komisariat/master-tes', icon: '📝', label: 'Master Tes' },
    { id: '/komisariat/pantau-nilai-skp', icon: '📊', label: 'Pantau Nilai SKP' },
    { id: '/komisariat/kalender', icon: '📅', label: 'Kalender Terpusat' },
    { id: '/komisariat/pengumuman', icon: '📢', label: 'Pengumuman' },
    { id: '/komisariat/broadcast', icon: '📡', label: 'Broadcast Notifikasi' },
    { id: '/komisariat/pengaturan-sertifikat', icon: '📜', label: 'Sertifikat Digital' },
    { id: '/komisariat/log-aktivitas', icon: '⏱️', label: 'Log Aktivitas' },
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

      <aside className="no-print sidebar-desktop" style={{ width: isSidebarCollapsed ? '80px' : '260px', background: 'linear-gradient(100deg, #1a252f 100%)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 10px rgba(0,0,0,0.1)', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'all 0.3s ease' }}>
        <div style={{ padding: '15px', fontSize: '1.1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{ fontSize: '1.5rem' }}>🎓</span>
            {!isSidebarCollapsed && <span style={{ color: 'white', whiteSpace: 'nowrap' }}>SIAKAD PMII</span>}
          </div>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>
        
        {!isSidebarCollapsed && (
          <div style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <img src={profilKomisariat.fotoUrl} alt="Logo Pusat" style={{ width: '45px', height: '45px', backgroundColor: '#fff', borderRadius: '50%', objectFit: 'contain', padding: '2px', border: '2px solid #f1c40f' }} />
            <div>
              <h4 style={{ fontSize: '0.8rem', margin: '0 0 3px 0', color: '#fff', lineHeight: '1.2' }}>{profilKomisariat.nama}</h4>
              <p style={{ fontSize: '0.7rem', color: '#f1c40f', margin: 0, fontWeight: 'bold' }}>Admin Pusat</p>
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
            <div style={{ fontSize: '0.75rem', color: '#856404', fontWeight: 'bold', backgroundColor: '#fff3cd', padding: '4px 10px', borderRadius: '15px' }}>⭐ Super Admin</div>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </main>
      
    </div>
  );
}