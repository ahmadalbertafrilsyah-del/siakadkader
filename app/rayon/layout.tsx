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

  if (isLoading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#11118f', fontWeight: 'bold' }}>Memuat Sistem SIAKAD...</div>;

  return (
    <div className={`siakad-shell ${isSidebarCollapsed ? 'collapsed' : ''}`}>

      {/* SIDEBAR DESKTOP */}
      <aside className="no-print sk-sidebar">
        <div className="sk-brand">
          <span className="sk-brand-logo">🏛️</span>
          {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>SIAKAD PMII</span>}
        </div>

        {!isSidebarCollapsed && (
          <div className="sk-profile">
            <img src={profilRayon.fotoLogoUrl} alt="Logo" style={{ objectFit: 'contain' }} />
            <div style={{ minWidth: 0 }}>
              <h4 className="sk-pname">{profilRayon.nama}</h4>
              <p className="sk-prole">Admin Rayon</p>
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
          <div style={{ marginLeft: 'auto' }}><span className="sk-chip">🏛️ {adminRayonId}</span></div>
        </header>

        {/* HEADER MOBILE APP BAR (terkunci) */}
        <header className="sk-appbar">
          <div className="sk-ab-profile">
            <img src={profilRayon.fotoLogoUrl} alt="Logo" style={{ objectFit: 'contain' }} />
            <div style={{ minWidth: 0 }}>
              <div className="sk-ab-sub">Admin Rayon</div>
              <div className="sk-ab-title">{profilRayon.nama}</div>
            </div>
          </div>
          <div className="sk-ab-action" onClick={() => router.push('/rayon/broadcast')}>📢</div>
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
