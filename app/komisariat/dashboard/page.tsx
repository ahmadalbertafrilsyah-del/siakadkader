'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Registrasi komponen Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function PageDashboardBeranda() {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
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
        
        {/* TAMBAHKAN minWidth: 0 dan overflow: 'hidden' di sini */}
        <div style={{ flex: '2 1 500px', minWidth: 0, overflow: 'hidden', backgroundColor: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h4 style={{ textAlign: 'center', margin: '0 0 20px 0', color: '#333' }}>Distribusi Kader Berdasarkan Rayon</h4>
          <div style={{ position: 'relative', height: '300px', width: '100%' }}>
            <Bar 
              data={chartDataRayon} 
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} 
            />
          </div>
        </div>
        
        {/* TAMBAHKAN minWidth: 0 dan overflow: 'hidden' di sini */}
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
  );
}