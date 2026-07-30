'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageKalenderKader() {
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            
            let currentPendampingId = '';
            if (p.jenjang === 'MAPABA') currentPendampingId = Array.isArray(p.pendamping_mapaba_id) ? p.pendamping_mapaba_id[0] : p.pendamping_mapaba_id;
            if (p.jenjang === 'PKD') currentPendampingId = Array.isArray(p.pendamping_pkd_id) ? p.pendamping_pkd_id[0] : p.pendamping_pkd_id;
            if (p.jenjang === 'SIG') currentPendampingId = Array.isArray(p.pendamping_sig_id) ? p.pendamping_sig_id[0] : p.pendamping_sig_id;
            if (p.jenjang === 'SKP') currentPendampingId = Array.isArray(p.pendamping_skp_id) ? p.pendamping_skp_id[0] : p.pendamping_skp_id;

            const unsubJadwal = onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
              const listJadwal: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.pembuat === "Komisariat" || d.id_rayon === p.id_rayon) {
                  // Kader tidak boleh melihat jadwal khusus "Rayon Internal" atau "Pendamping Internal"
                  if (d.target === "Rayon" || d.target === "Pendamping") return;
                  // Jika target Binaan, hanya boleh lihat jika pembuatnya adalah pendampingnya sendiri
                  if (d.target === "Binaan" && d.pendamping_id !== currentPendampingId) return; 
                  
                  listJadwal.push({ id: doc.id, ...d });
                }
              });
              listJadwal.sort((a, b) => b.timestamp - a.timestamp);
              setJadwalKegiatan(listJadwal);
            });
            unsubs.push(unsubJadwal);
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  return (
    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
        <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>📅 Kalender & Agenda Kegiatan</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Seluruh jadwal resmi dari Komisariat, Rayon, maupun sesi Mentoring dengan Pendamping Anda.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {jadwalKegiatan.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>
             Belum ada agenda terjadwal di sistem.
          </div>
        ) : (
          jadwalKegiatan.map(jadwal => {
            const isKomisariat = jadwal.pembuat === 'Komisariat';
            const isMentoring = jadwal.target === 'Binaan';
            const bgColor = isKomisariat ? '#fff9e6' : isMentoring ? '#eaf4fc' : '#fdfdfd';
            const borderColor = isKomisariat ? '#f1c40f' : isMentoring ? '#3498db' : '#2ecc71';
            const labelPembuat = isKomisariat ? 'Pusat Komisariat' : isMentoring ? 'Pendamping Anda' : 'Pengurus Rayon';

            return (
              <div key={jadwal.id} style={{ backgroundColor: bgColor, border: '1px solid #eee', borderTop: `4px solid ${borderColor}`, padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ backgroundColor: '#fff', color: '#555', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{labelPembuat}</span>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>{jadwal.tanggal.split('T')[0]}</span>
                </div>
                <h4 style={{ margin: '0 0 5px 0', color: '#0d1b2a', fontSize: '1.1rem' }}>{jadwal.judul}</h4>
                <div style={{ fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '10px' }}>📍 Lokasi: {jadwal.lokasi} <br/> ⏰ Pukul: {jadwal.tanggal.split('T')[1]}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', lineHeight: '1.5' }}>{jadwal.deskripsi}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}