'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PageLogAktivitas() {
  const [logAktivitas, setLogAktivitas] = useState<any[]>([]);

  useEffect(() => {
    const unsubLog = onSnapshot(query(collection(db, "log_aktivitas"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      const listLog: any[] = []; snap.forEach(doc => listLog.push({ id: doc.id, ...doc.data() })); setLogAktivitas(listLog);
    });
    return () => unsubLog();
  }, []);

  return (
    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
        <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>🕵️ Log Aktivitas Sistem Pusat</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Rekaman aktivitas dan riwayat perubahan data (Menampilkan 50 aktivitas terbaru).</p>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', boxSizing: 'border-box' }}>
        <table className="tabel-utama" style={{ minWidth: '800px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', width: '15%' }}>Waktu Sistem</th>
              <th style={{ textAlign: 'left', width: '30%' }}>Aktor Pengguna</th>
              <th style={{ textAlign: 'left', width: '55%' }}>Aktivitas / Aksi yang Dilakukan</th>
            </tr>
          </thead>
          <tbody>
            {logAktivitas.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Belum ada catatan aktivitas sistem.</td></tr>
            ) : (
              logAktivitas.map((log) => (
                <tr key={log.id}>
                  <td style={{ color: '#666', fontSize: '0.8rem', fontWeight: 'bold' }}>{log.waktu_format}</td>
                  <td style={{ color: '#0000af', fontWeight: 'bold', fontSize: '0.85rem' }}>{log.aktor}</td>
                  <td style={{ color: '#333', fontStyle: 'italic', fontSize: '0.85rem' }}>{log.aksi}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}