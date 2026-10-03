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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [profilPendamping, setProfilPendamping] = useState({
    nama: 'Loading...', username: '', fotoUrl: 'https://via.placeholder.com/200x250/0b5e4a/fff?text=FOTO', jenjangTugas: 'MAPABA', id_rayon: ''
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
              nama: p.nama || '', username: p.username || '', fotoUrl: p.fotoUrl || 'https://via.placeholder.com/200x250/0b5e4a/fff?text=FOTO',
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
    { id: '/pendamping/dashboard', icon: '🏠', label: 'Dashboard Utama', badge: null as number | null },
    { id: '/pendamping/profil', icon: '👤', label: 'Profil Saya', badge: null as number | null },
    { id: '/pendamping/kalender', icon: '📅', label: 'Jadwal Mentoring', badge: null as number | null },
    { id: '/pendamping/broadcast', icon: '📡', label: 'Pengumuman Binaan', badge: null as number | null },
    { id: '/pendamping/daftar-kader', icon: '👥', label: 'Daftar Binaan', badge: null as number | null },
    { id: '/pendamping/input-nilai', icon: '📊', label: 'Raport Kaderisasi', badge: null as number | null },
    { id: '/pendamping/berkas-tugas', icon: '📋', label: 'Verifikasi Tugas', badge: tugasMenunggu > 0 ? tugasMenunggu : null },
    { id: '/pendamping/tes-pemahaman', icon: '📝', label: 'Hasil Tes Binaan', badge: null as number | null },
  ];

  // Bottom Navigation Mobile (5 menu utama)
  const mobileNavItems = [
    { id: '/pendamping/dashboard', icon: '🏠', label: 'Home', badge: null as number | null },
    { id: '/pendamping/daftar-kader', icon: '👥', label: 'Binaan', badge: null as number | null },
    { id: '/pendamping/input-nilai', icon: '📊', label: 'Nilai', badge: null as number | null },
    { id: '/pendamping/berkas-tugas', icon: '📋', label: 'Tugas', badge: tugasMenunggu > 0 ? tugasMenunggu : null },
    { id: '/pendamping/profil', icon: '👤', label: 'Profil', badge: null as number | null },
  ];

  const activeMenu = menuItems.find(m => pathname.includes(m.id)) || menuItems[0];

  if (isLoading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Memuat Sistem...</div>;

  // Tema Pendamping: hijau-teal elegan + aksen emas
  const theme = { '--sk-primary': '#0b5e4a', '--sk-primary-2': '#139070', '--sk-accent': '#f5c518' } as React.CSSProperties;

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
            <img src={profilPendamping.fotoUrl} alt="Foto" />
            <div style={{ minWidth: 0 }}>
              <h4 className="sk-pname">{profilPendamping.nama}</h4>
              <p className="sk-prole">Pendamping {profilPendamping.jenjangTugas}</p>
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
                  {!isSidebarCollapsed && item.badge ? <span className="sk-nav-badge">{item.badge}</span> : null}
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
            <span className="sk-chip" style={{ background: '#e8f7f0', color: '#0b5e4a', borderColor: '#bfe9d7' }}>👤 {namaRayonInduk}</span>
          </div>
        </header>

        {/* HEADER MOBILE APP BAR (terkunci) */}
        <header className="sk-appbar">
          <div className="sk-ab-profile">
            <img src={profilPendamping.fotoUrl} alt="Foto" />
            <div style={{ minWidth: 0 }}>
              <div className="sk-ab-sub">Pendamping {profilPendamping.jenjangTugas}</div>
              <div className="sk-ab-title">{profilPendamping.nama}</div>
            </div>
          </div>
          <div className="sk-ab-action" onClick={() => router.push('/pendamping/berkas-tugas')}>
            📋
            {tugasMenunggu > 0 && <span className="sk-ab-badge">{tugasMenunggu}</span>}
          </div>
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
                {item.badge ? <span className="sk-bn-badge">{item.badge}</span> : null}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

      </main>
    </div>
  );
}
