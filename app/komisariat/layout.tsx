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
  
  // State untuk Sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Laptop (Icon Only)
  const [isLoading, setIsLoading] = useState(true);

  // Verifikasi Akses Komisariat
  useEffect(() => {
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
            setIsLoading(false);
          }
        });
      } else { 
        router.push('/'); 
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const handleLogout = async () => { 
    await signOut(auth); 
    router.push('/'); 
  };

  const menuItems = [
    { id: '/komisariat/dashboard', icon: '📊', label: 'Dashboard Statistik' },
    { id: '/komisariat/kalender', icon: '📅', label: 'Kalender & Jadwal' },
    { id: '/komisariat/broadcast', icon: '📡', label: 'Broadcast Notifikasi' },
    { id: '/komisariat/manajemen-rayon', icon: '🏢', label: 'Akun & Instansi' },
    { id: '/komisariat/pantau-nilai-skp', icon: '👩', label: 'Raport SKP (Penilaian)' },
    { id: '/komisariat/master-kurikulum', icon: '📑', label: 'Master Kurikulum' },
    { id: '/komisariat/master-tes', icon: '📝', label: 'Master Tes Pusat' },
    { id: '/komisariat/database-kader', icon: '🌐', label: 'Database Kader' },
    { id: '/komisariat/pengumuman', icon: '📢', label: 'Pengumuman Login' },
    { id: '/komisariat/log-aktivitas', icon: '🕵️', label: 'Log Aktivitas Sistem' },
  ];

  const activeMenu = menuItems.find(m => pathname.includes(m.id)) || menuItems[0];

  if (isLoading) return <div style={{display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center'}}>Memuat Sistem...</div>;

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS LAYOUT RESPONSIVE & CETAK */}
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
        .tabel-utama thead tr { border-top: 1px solid #e0e0e0; border-bottom: 2px solid #0000af; background-color: #f8f9fa; }
        .tabel-utama th { padding: 12px 10px; color: #333; text-align: left; font-weight: bold; }
        .tabel-utama td { padding: 12px 10px; border-bottom: 1px solid #eee; color: #333; }
      `}</style>
      
      {/* OVERLAY UNTUK HP */}
      {isSidebarOpen && (
        <div className="no-print" onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }} />
      )}

      {/* SIDEBAR KOMISARIAT */}
      <aside className="no-print sidebar-desktop" style={{ width: isSidebarCollapsed ? '80px' : '260px', background: 'linear-gradient(100deg, #0000af 100%)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 10px rgba(0,0,0,0.1)', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'all 0.3s ease' }}>
        
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{ fontSize: '1.5rem' }}>🏛️</span>
            {!isSidebarCollapsed && <span style={{ color: 'white', letterSpacing: '1px', whiteSpace: 'nowrap' }}>SIAKAD PMII</span>}
          </div>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>
        
        {!isSidebarCollapsed && (
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '5px', color: '#fff', textTransform: 'uppercase' }}>Pengurus Komisariat</h4>
            <p style={{ fontSize: '0.75rem', color: '#bdc3c7', margin: 0 }}>Sunan Ampel Malang</p>
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: '15px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {menuItems.map((item) => {
            const isActive = pathname.includes(item.id);
            return (
              <li key={item.id}>
                <Link 
                  href={item.id} 
                  onClick={() => setIsSidebarOpen(false)} 
                  style={{ textDecoration: 'none', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: isActive ? '#f1c40f' : '#bdc3c7', padding: isSidebarCollapsed ? '15px 0' : '12px 20px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: isSidebarCollapsed ? '0' : '15px', fontSize: '0.85rem', cursor: 'pointer', borderLeft: isActive ? '4px solid #f1c40f' : '4px solid transparent', backgroundColor: isActive ? 'rgba(255, 215, 0, 0.05)' : 'transparent', transition: '0.2s', fontWeight: isActive ? 'bold' : 'normal' }}
                >
                  <span style={{ fontSize: '1.2rem' }} title={isSidebarCollapsed ? item.label : ''}>{item.icon}</span> 
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }} title={isSidebarCollapsed ? 'Keluar Sistem' : ''}>🚪</span>
            {!isSidebarCollapsed && <span>Keluar Sistem</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="no-print main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden', transition: 'all 0.3s ease' }}>
        
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          
          {/* TOMBOL COLLAPSE SIDEBAR (LAPTOP) */}
          <button className="toggle-collapse" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#555', padding: '5px' }}>
            {isSidebarCollapsed ? '▶' : '◀'}
          </button>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, fontWeight: 'bold', textTransform: 'uppercase' }}>{activeMenu.label}</h2>
            <span style={{ fontSize: '0.75rem', color: '#555', backgroundColor: '#fdf2e9', padding: '4px 12px', borderRadius: '20px', border: '1px solid #f1c40f', fontWeight: 'bold' }}>Admin Komisariat</span>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {children} {/* KONTEN HALAMAN AKAN MUNCUL DI SINI */}
        </div>
      </main>
      
    </div>
  );
}