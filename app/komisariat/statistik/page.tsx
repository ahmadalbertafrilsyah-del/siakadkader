'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function PageStatistikKomisariat() {
  const [dataRayon, setDataRayon] = useState<any>({ labels: [], datasets: [] });
  const [dataJenjang, setDataJenjang] = useState<any>({ labels: [], datasets: [] });
  const [totalKader, setTotalKader] = useState(0);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const qKader = query(collection(db, "users"), where("role", "==", "kader"));
    const unsubKader = onSnapshot(qKader, (snap) => {
      const rekapanRayon: Record<string, number> = {};
      const rekapanJenjang: Record<string, number> = { MAPABA: 0, PKD: 0, SIG: 0, SKP: 0 };
      let total = 0;

      snap.forEach(doc => {
        const data = doc.data();
        total++;
        
        const namaRayon = data.id_rayon || "Tanpa Rayon";
        if (!rekapanRayon[namaRayon]) rekapanRayon[namaRayon] = 0;
        rekapanRayon[namaRayon]++;

        const jenjang = data.jenjang || "MAPABA";
        if (rekapanJenjang[jenjang] !== undefined) rekapanJenjang[jenjang]++;
      });

      setTotalKader(total);

      setDataRayon({
        labels: Object.keys(rekapanRayon),
        datasets: [{
          label: 'Jumlah Kader per Rayon',
          data: Object.values(rekapanRayon),
          backgroundColor: '#3498db',
          borderRadius: 4,
        }]
      });

      setDataJenjang({
        labels: Object.keys(rekapanJenjang),
        datasets: [{
          label: 'Persentase Jenjang Kaderisasi',
          data: Object.values(rekapanJenjang),
          backgroundColor: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'],
          borderWidth: 1,
        }]
      });
    });
    
    unsubs.push(unsubKader);

    return () => {
      unsubs.forEach(u => u());
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📊 Dashboard Analitik Visual</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
          Total Kader Aktif Terdaftar: <b style={{ color: '#1e824c', fontSize: '1.1rem' }}>{totalKader} Mahasiswa</b>
        </p>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ flex: '2 1 500px', backgroundColor: '#fdfdfd', border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
            <h4 style={{ textAlign: 'center', margin: '0 0 20px 0', color: '#333' }}>Distribusi Kader Berdasarkan Rayon</h4>
            <div style={{ position: 'relative', height: '300px', width: '100%' }}>
              <Bar 
                data={dataRayon} 
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} 
              />
            </div>
          </div>
          
          <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
            <h4 style={{ textAlign: 'center', margin: '0 0 20px 0', color: '#333' }}>Rasio Jenjang Kaderisasi</h4>
            <div style={{ position: 'relative', height: '300px', width: '100%' }}>
              <Pie 
                data={dataJenjang} 
                options={{ responsive: true, maintainAspectRatio: false }} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}