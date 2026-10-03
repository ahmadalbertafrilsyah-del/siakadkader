'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Registrasi komponen Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function PageDashboardBeranda() {
  const router = useRouter();

  // State untuk Kartu Statistik dan Tabel
  const [statGlobal, setStatGlobal] = useState({ totalRayon: 0, totalKaderAktif: 0, totalPendamping: 0, totalSuratKeluar: 0 });
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  const [databaseKader, setDatabaseKader] = useState<any[]>([]);

  // State untuk Grafik Visual
  const [chartDataRayon, setChartDataRayon] = useState<any>({ labels: [], datasets: [] });
  const [chartDataJenjang, setChartDataJenjang] = useState<any>({ labels: [], datasets: [] });

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    // Tarik data seluruh user (Kader, Pendamping, Rayon)
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      let kaderCount = 0;
      let pendampingCount = 0;
      let rayonCount = 0;

      const listKader: any[] = [];
      const listRayon: any[] = [];

      // Variabel agregasi untuk grafik
      const rekapanRayon: Record<string, number> = {};
      const rekapanJenjang: Record<string, number> = { MAPABA: 0, PKD: 0, SIG: 0, SKP: 0 };

      snap.forEach((doc) => {
        const data = doc.data();

        if (data.role === 'kader') {
          kaderCount++;
          listKader.push({ id: doc.id, ...data });

          // Agregasi Grafik Rayon
          const namaRayon = data.id_rayon || "Tanpa Rayon";
          if (!rekapanRayon[namaRayon]) rekapanRayon[namaRayon] = 0;
          rekapanRayon[namaRayon]++;

          // Agregasi Grafik Jenjang
          const jenjang = data.jenjang || "MAPABA";
          if (rekapanJenjang[jenjang] !== undefined) rekapanJenjang[jenjang]++;

        } else if (data.role === 'pendamping') {
          pendampingCount++;
        } else if (data.role === 'rayon') {
          rayonCount++;
          listRayon.push({ id: doc.id, ...data });
        }
      });

      // Update State Tabel dan Kartu
      setDatabaseKader(listKader);
      setDataRayon(listRayon);
      setStatGlobal(prev => ({ ...prev, totalKaderAktif: kaderCount, totalPendamping: pendampingCount, totalRayon: rayonCount }));

      // Update State Grafik
      setChartDataRayon({
        labels: Object.keys(rekapanRayon),
        datasets: [{
          label: 'Jumlah Kader per Rayon',
          data: Object.values(rekapanRayon),
          backgroundColor: '#3498db',
          borderRadius: 4,
        }]
      });

      setChartDataJenjang({
        labels: Object.keys(rekapanJenjang),
        datasets: [{
          label: 'Persentase Jenjang Kaderisasi',
          data: Object.values(rekapanJenjang),
          backgroundColor: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'],
          borderWidth: 1,
        }]
      });
    });
    unsubs.push(unsubUsers);

    // Tarik data surat keluar
    const unsubSurat = onSnapshot(collection(db, "pengajuan_surat"), (snap) => {
      setStatGlobal(prev => ({ ...prev, totalSuratKeluar: snap.size }));
    });
    unsubs.push(unsubSurat);

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  // ===== Turunan data untuk tampilan mobile (dihitung dari state yang sudah ada) =====
  const rekapJenjangMobile: Record<string, number> = { MAPABA: 0, PKD: 0, SIG: 0, SKP: 0 };
  databaseKader.forEach((k: any) => {
    const jenjang = k.jenjang || 'MAPABA';
    if (rekapJenjangMobile[jenjang] !== undefined) rekapJenjangMobile[jenjang]++;
  });

  const rayonTerdataMobile = dataRayon
    .map((rayon: any) => ({
      id: rayon.id,
      nama: rayon.nama || rayon.id_rayon || 'Tanpa Nama',
      jumlah: databaseKader.filter((k: any) => k.id_rayon === rayon.id_rayon).length
    }))
    .sort((a, b) => b.jumlah - a.jumlah);

  // Kartu menu ala aplikasi (mobile)
  const MenuCardMobile = ({ icon, label, onClick }: any) => (
    <div onClick={onClick} className="hover-card-modern" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      cursor: 'pointer', backgroundColor: '#fff', padding: '15px 5px',
      borderRadius: '16px', transition: 'all 0.3s ease'
    }}>
      <div style={{
        backgroundColor: '#eef2f9', width: '50px', height: '50px', borderRadius: '14px',
        display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem',
        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), 0 2px 8px rgba(15,27,46,0.06)'
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#111', textAlign: 'center', fontWeight: 'bold', lineHeight: '1.2' }}>{label}</div>
    </div>
  );

  return (
    <>
      <style>{`
        /* TOGGLE TAMPILAN LAPTOP vs TAMPILAN APLIKASI HP */
        .desktop-view { display: block; }
        .mobile-view { display: none; }

        @media (max-width: 767px) {
          .desktop-view { display: none !important; }
          .mobile-view { display: block !important; }
          body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
          ::-webkit-scrollbar { display: none; }
        }

        .hover-card-modern:active { transform: scale(0.95); opacity: 0.85; }
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; overflow-x: auto; }
      `}</style>

      {/* ========================================================== */}
      {/* 1. TAMPILAN LAPTOP / DESKTOP (TETAP SEPERTI SEMULA)        */}
      {/* ========================================================== */}
      <div className="desktop-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* 1. Header Dashboard */}
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h2 style={{color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.5rem'}}>Dashboard Komisariat 🏛️</h2>
          <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Pantau pergerakan kader, aktivitas Rayon, dan persebaran data seluruh anggota PMII di tingkat Komisariat.</p>
        </div>

        {/* 2. Kartu Statistik Global */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Rayon Terdaftar</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalRayon}</div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #2ecc71' }}>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Kader (Se-UIN)</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalKaderAktif}</div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Pendamping</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalPendamping}</div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Surat Terdigitalisasi</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalSuratKeluar}</div>
          </div>
        </div>

        {/* 3. Grafik Visual Analitik */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>

          <div style={{ flex: '2 1 500px', minWidth: 0, overflow: 'hidden', backgroundColor: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h4 style={{ textAlign: 'center', margin: '0 0 20px 0', color: '#333' }}>Distribusi Kader Berdasarkan Rayon</h4>
            <div style={{ position: 'relative', height: '300px', width: '100%' }}>
              <Bar
                data={chartDataRayon}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
              />
            </div>
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 0, overflow: 'hidden', backgroundColor: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h4 style={{ textAlign: 'center', margin: '0 0 20px 0', color: '#333' }}>Rasio Jenjang Kaderisasi</h4>
            <div style={{ position: 'relative', height: '300px', width: '100%' }}>
              <Pie
                data={chartDataJenjang}
                options={{ responsive: true, maintainAspectRatio: false }}
              />
            </div>
          </div>
        </div>

        {/* 4. Tabel Distribusi Rayon Aktif */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#0d1b2a' }}>Daftar Rayon Aktif</h4>
          <table className="tabel-utama" style={{ minWidth: '400px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Nama Rayon</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Total Kader Terdata</th>
              </tr>
            </thead>
            <tbody>
              {dataRayon.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada data rayon.</td></tr>
              ) : (
                dataRayon.map((rayon) => {
                  const jumlahKaderRayonIni = databaseKader.filter(k => k.id_rayon === rayon.id_rayon).length;
                  return (
                    <tr key={rayon.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#0d1b2a' }}>{rayon.nama}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#3498db' }}>{jumlahKaderRayonIni} Kader</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ========================================================== */}
      {/* 2. TAMPILAN MOBILE APP (NAVY ELEGAN + AKSEN EMAS)          */}
      {/* ========================================================== */}
      <div className="mobile-view">

        {/* Area Header Navy Melengkung (Edge to Edge) */}
        <div className="sk-bleed" style={{
          background: 'linear-gradient(135deg, #0f1b2e 0%, #28395a 100%)',
          padding: '18px 20px 70px 20px',
          borderBottomLeftRadius: '30px',
          borderBottomRightRadius: '30px',
          color: 'white',
          position: 'relative'
        }}>
          <div style={{ fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.85, fontWeight: 'bold' }}>Pusat Komisariat</div>
          <h1 style={{ margin: '6px 0 0 0', fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.5px', color: '#f5c518' }}>SIAKAD PMII 🏛️</h1>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', opacity: 0.9, lineHeight: '1.45' }}>
            Pantau pergerakan kader, aktivitas rayon, dan persebaran data seluruh anggota se-Komisariat.
          </p>
        </div>

        {/* Kartu Statistik Mengambang (menimpa header) */}
        <div style={{ marginTop: '-45px', position: 'relative', zIndex: 10 }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '20px', padding: '18px 14px',
            boxShadow: '0 8px 25px rgba(15,27,46,0.12)',
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 10px'
          }}>
            {[
              { label: 'Total Rayon', val: statGlobal.totalRayon, color: '#28395a', icon: '🏢' },
              { label: 'Total Kader', val: statGlobal.totalKaderAktif, color: '#2ecc71', icon: '👥' },
              { label: 'Pendamping', val: statGlobal.totalPendamping, color: '#e67e22', icon: '🧑‍🏫' },
              { label: 'Surat Digital', val: statGlobal.totalSuratKeluar, color: '#e74c3c', icon: '✉️' }
            ].map(item => (
              <div key={item.label} style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '12px 14px', border: '1px solid #eef2f7' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 'bold', letterSpacing: '0.3px' }}>{item.icon} {item.label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: item.color, marginTop: '4px', lineHeight: 1 }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid Menu Pintasan */}
        <div style={{ marginTop: '22px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f1b2e', fontSize: '0.92rem' }}>Menu Pintasan</h4>
          <div style={{
            backgroundColor: '#fff', borderRadius: '20px', padding: '18px 10px',
            boxShadow: '0 4px 14px rgba(15,27,46,0.06)', border: '1px solid #eef2f7',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 8px'
          }}>
            <MenuCardMobile icon="🏢" label="Manajemen Rayon" onClick={() => router.push('/komisariat/manajemen-rayon')} />
            <MenuCardMobile icon="👥" label="Database Kader" onClick={() => router.push('/komisariat/database-kader')} />
            <MenuCardMobile icon="📚" label="Master Kurikulum" onClick={() => router.push('/komisariat/master-kurikulum')} />
            <MenuCardMobile icon="📝" label="Master Tes" onClick={() => router.push('/komisariat/master-tes')} />
            <MenuCardMobile icon="📊" label="Nilai SKP" onClick={() => router.push('/komisariat/pantau-nilai-skp')} />
            <MenuCardMobile icon="📅" label="Kalender" onClick={() => router.push('/komisariat/kalender')} />
            <MenuCardMobile icon="📢" label="Pengumuman" onClick={() => router.push('/komisariat/pengumuman')} />
            <MenuCardMobile icon="📡" label="Broadcast" onClick={() => router.push('/komisariat/broadcast')} />
            <MenuCardMobile icon="📜" label="Sertifikat" onClick={() => router.push('/komisariat/pengaturan-sertifikat')} />
          </div>
        </div>

        {/* Distribusi Jenjang Kaderisasi */}
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '18px', marginTop: '18px', border: '1px solid #eef2f7', boxShadow: '0 4px 10px rgba(15,27,46,0.04)' }}>
          <h4 style={{ margin: '0 0 14px 0', color: '#0f1b2e', fontSize: '0.92rem' }}>Rasio Jenjang Kaderisasi</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['MAPABA', 'PKD', 'SIG', 'SKP'].map((jenjang) => {
              const jumlah = rekapJenjangMobile[jenjang] || 0;
              const persen = statGlobal.totalKaderAktif > 0 ? Math.round((jumlah / statGlobal.totalKaderAktif) * 100) : 0;
              return (
                <div key={jenjang}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold', color: '#0f1b2e', fontSize: '0.8rem' }}>{jenjang}</span>
                    <span style={{ fontWeight: 'bold', color: '#28395a', fontSize: '0.78rem' }}>{jumlah} Kader ({persen}%)</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#eef2f7', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${persen}%`, height: '100%', background: 'linear-gradient(90deg, #28395a 0%, #f5c518 100%)', borderRadius: '99px', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daftar Rayon Aktif */}
        <div style={{ marginTop: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, color: '#0f1b2e', fontSize: '0.92rem' }}>Daftar Rayon Aktif</h4>
            <span onClick={() => router.push('/komisariat/manajemen-rayon')} style={{ fontSize: '0.74rem', fontWeight: 'bold', color: '#28395a', cursor: 'pointer' }}>Kelola ›</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rayonTerdataMobile.length === 0 ? (
              <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '26px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', border: '1px solid #eef2f7' }}>
                Belum ada data rayon.
              </div>
            ) : (
              rayonTerdataMobile.map((rayon) => (
                <div key={rayon.id} onClick={() => router.push('/komisariat/manajemen-rayon')} className="hover-card-modern" style={{
                  backgroundColor: '#fff', borderRadius: '16px', padding: '14px 16px',
                  border: '1px solid #eef2f7', boxShadow: '0 4px 10px rgba(15,27,46,0.04)',
                  display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s ease'
                }}>
                  <div style={{ width: '42px', height: '42px', flex: 'none', borderRadius: '14px', background: 'linear-gradient(135deg, #0f1b2e 0%, #28395a 100%)', color: '#f5c518', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem' }}>🏢</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#0f1b2e', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rayon.nama}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{rayon.jumlah} kader terdata</div>
                  </div>
                  <div style={{ fontWeight: 900, color: '#28395a', fontSize: '1.05rem' }}>{rayon.jumlah}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ height: '30px' }}></div>
      </div>
    </>
  );
}
