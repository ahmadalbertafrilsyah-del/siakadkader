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

  // Bottom Navigation Mobile (5 menu utama)
  const mobileNavItems = [
    { id: '/komisariat/dashboard', icon: '🏠', label: 'Home' },
    { id: '/komisariat/manajemen-rayon', icon: '🏢', label: 'Rayon' },
    { id: '/komisariat/database-kader', icon: '👥', label: 'Kader' },
    { id: '/komisariat/master-tes', icon: '📝', label: 'Tes' },
    { id: '/komisariat/pantau-nilai-skp', icon: '📊', label: 'Nilai SKP' },
  ];

  const activeMenu = menuItems.find(m => pathname.includes(m.id)) || menuItems[0];

  if (isLoading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Memuat Sistem...</div>;

  // Tema Super Admin: biru-tua elegan + aksen emas
  const theme = { '--sk-primary': '#0f1b2e', '--sk-primary-2': '#28395a', '--sk-accent': '#f5c518' } as React.CSSProperties;

  return (
    <div className={`siakad-shell ${isSidebarCollapsed ? 'collapsed' : ''}`} style={theme}>

      {/* SIDEBAR DESKTOP */}
      <aside className="no-print sk-sidebar">
        <div className="sk-brand">
          <span className="sk-brand-logo">🎓</span>
          {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>SIAKAD PMII</span>}
        </div>

        {!isSidebarCollapsed && (
          <div className="sk-profile">
            <img src={profilKomisariat.fotoUrl} alt="Logo Pusat" style={{ objectFit: 'contain', padding: '3px' }} />
            <div style={{ minWidth: 0 }}>
              <h4 className="sk-pname">{profilKomisariat.nama}</h4>
              <p className="sk-prole">⭐ Super Admin</p>
            </div>
          </div>
        )}

        <ul className="sk-nav">
          {menuItems.map((item) => {
            const isActive = pathname.includes(item.id);
            return (
              <li key={item.id}>
                <Link href={item.id} className={`sk-nav-link ${isActive ? 'active' : ''}`} title={item.label}>
                  <span className="sk-nav-ic">{item.icon}</span>
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="sk-logout-wrap">
          <button onClick={handleLogout} className="sk-logout" title="Keluar">
            <span style={{ fontSize: '1.1rem' }}>🚪</span>
            {!isSidebarCollapsed && <span>Keluar Sistem</span>}
          </button>
        </div>
      </aside>

      <main className="no-print sk-main">

        {/* HEADER DESKTOP */}
        <header className="sk-topbar">
          <button className="sk-collapse-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>{isSidebarCollapsed ? '▶' : '◀'}</button>
          <h2 className="sk-title">{activeMenu.label}</h2>
          <div style={{ marginLeft: 'auto' }}>
            <span className="sk-chip" style={{ background: '#fff8e1', color: '#8a6d00', borderColor: '#ffe9a3' }}>⭐ Super Admin</span>
          </div>
        </header>

        {/* HEADER MOBILE APP BAR (terkunci) */}
        <header className="sk-appbar">
          <div className="sk-ab-profile">
            <img src={profilKomisariat.fotoUrl} alt="Logo" style={{ objectFit: 'contain', padding: '2px' }} />
            <div style={{ minWidth: 0 }}>
              <div className="sk-ab-sub">Super Admin</div>
              <div className="sk-ab-title">{activeMenu.label}</div>
            </div>
          </div>
          <div className="sk-ab-action" onClick={() => router.push('/komisariat/broadcast')}>📢</div>
        </header>

        {/* KONTEN */}
        <div className="sk-content">
          {children}
        </div>

        {/* BOTTOM NAV MOBILE */}
        <nav className="sk-bottomnav no-print">
          {mobileNavItems.map(item => {
            const isActive = pathname.includes(item.id);
            return (
              <Link key={item.id} href={item.id} className={`sk-bn-link ${isActive ? 'active' : ''}`}>
                <span className="sk-bn-ic">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

      </main>
    </div>
  );
}
