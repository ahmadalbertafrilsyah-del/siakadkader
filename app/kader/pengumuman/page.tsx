'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PagePengumumanKader() {
  const [notifikasiGlobal, setNotifikasiGlobal] = useState<any[]>([]);

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

            const unsubNotif = onSnapshot(collection(db, "notifikasi_global"), (snap) => {
              const listNotif: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.target === "Semua" || d.target === "Kader") {
                   if (d.pengirim === "Pusat Komisariat" || d.id_rayon === p.id_rayon) listNotif.push({ id: doc.id, ...d });
                }
                if (d.target === "Binaan" && d.pengirim_id === currentPendampingId) {
                   listNotif.push({ id: doc.id, ...d });
                }
              });
              listNotif.sort((a, b) => b.timestamp - a.timestamp);
              setNotifikasiGlobal(listNotif);
            });
            unsubs.push(unsubNotif);
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
    <>
      <style>{`
        .desktop-view { display: block; }
        .mobile-view { display: none; }
        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: block !important; }
           body, html, .mobile-content-wrapper, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* DESKTOP VIEW */}
      <div className="desktop-view" style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', minHeight: '80vh' }}>
        <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
          <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>📢 Papan Pengumuman & Informasi</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Informasi mendesak, instruksi tugas, atau surat edaran dari instansi maupun pendamping.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {notifikasiGlobal.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>Belum ada pengumuman untuk Anda.</div>
          ) : (
            notifikasiGlobal.map(notif => {
              const isBinaan = notif.target === 'Binaan';
              const isKomisariat = notif.pengirim === 'Pusat Komisariat';
              return (
                <div key={notif.id} style={{ padding: '20px', backgroundColor: isBinaan ? '#f0fbf4' : '#fcfcfc', border: '1px solid #eee', borderLeft: isKomisariat ? '5px solid #f1c40f' : isBinaan ? '5px solid #27ae60' : '5px solid #3498db', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #ddd', paddingBottom: '10px' }}>
                    <strong style={{ color: '#0d1b2a', fontSize: '1.1rem' }}>{notif.judul}</strong><span style={{ fontSize: '0.75rem', color: '#888' }}>{notif.tanggal}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#444', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{notif.pesan}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: isBinaan ? '#27ae60' : '#3498db', fontWeight: 'bold' }}>Oleh: {notif.pengirim}</div>
                    {notif.batas_waktu && (<div style={{ fontSize: '0.75rem', color: '#e74c3c', fontWeight: 'bold', backgroundColor: '#ffebee', padding: '4px 10px', borderRadius: '15px' }}>Batas Berlaku: {notif.batas_waktu}</div>)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="mobile-view">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifikasiGlobal.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada informasi terbaru.</div>
          ) : (
            notifikasiGlobal.map(notif => {
              const isBinaan = notif.target === 'Binaan';
              const isKomisariat = notif.pengirim === 'Pusat Komisariat';
              const borderColor = isKomisariat ? '#f1c40f' : isBinaan ? '#27ae60' : '#3498db';
              
              return (
                <div key={notif.id} style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #eaeaea', borderLeft: `5px solid ${borderColor}`, borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ color: '#0d1b2a', fontSize: '1rem', flex: 1, paddingRight: '10px' }}>{notif.judul}</strong>
                    <span style={{ fontSize: '0.65rem', color: '#888', whiteSpace: 'nowrap' }}>{notif.tanggal.split(' pukul')[0]}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{notif.pesan}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: borderColor, fontWeight: 'bold' }}>{notif.pengirim}</div>
                    {notif.batas_waktu && (<div style={{ fontSize: '0.7rem', color: '#e74c3c', fontWeight: 'bold' }}>Batas: {notif.batas_waktu}</div>)}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div style={{ height: '30px' }}></div>
      </div>
    </>
  );
}