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
    { id: '/kader/tugas', icon: '📋', label: 'Pengumpulan Tugas' },
    { id: '/kader/tes', icon: '📝', label: 'Ujian & Tes' },
    { id: '/kader/sertifikat', icon: '📜', label: 'Sertifikat Digital' },
    { id: '/kader/kalender', icon: '📅', label: 'Jadwal Kegiatan' },
    { id: '/kader/pengumuman', icon: '📢', label: 'Pengumuman' },
    { id: '/kader/perpustakaan', icon: '📚', label: 'Perpustakaan' },

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
    <div className={`siakad-shell ${isSidebarCollapsed ? 'collapsed' : ''}`}>

      {/* SIDEBAR DESKTOP */}
      <aside className="no-print sk-sidebar">
        <div className="sk-brand">
          <span className="sk-brand-logo">🎓</span>
          {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>SIAKAD PMII</span>}
        </div>

        {!isSidebarCollapsed && (
          <div className="sk-profile">
            <img src={profilKader.fotoUrl} alt="Foto" />
            <div style={{ minWidth: 0 }}>
              <h4 className="sk-pname">{profilKader.nama}</h4>
              <p className="sk-prole">{profilKader.nim}</p>
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
          <div style={{ marginLeft: 'auto' }}><span className="sk-chip">🏛️ {namaRayonInduk}</span></div>
        </header>

        {/* HEADER MOBILE APP BAR (terkunci) */}
        <header className="sk-appbar">
          <div className="sk-ab-profile">
            <img src={profilKader.fotoUrl} alt="Foto" />
            <div style={{ minWidth: 0 }}>
              <div className="sk-ab-sub">Salam, Sahabat/i</div>
              <div className="sk-ab-title">{profilKader.nama}</div>
            </div>
          </div>
          <div className="sk-ab-action" onClick={() => router.push('/kader/pengumuman')}>🔔</div>
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