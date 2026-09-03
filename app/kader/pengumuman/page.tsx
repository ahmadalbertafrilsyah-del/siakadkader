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
        /* COLOR PALETTE (Modern Slate/Gray) */
        :root {
          --text-main: #111827;
          --text-body: #374151;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
          --bg-card: #ffffff;
          --bg-page: #f9fafb;
        }

        .page-wrapper { display: flex; flex-direction: column; gap: 24px; }
        
        .header-card { 
          background: var(--bg-card); padding: 24px; border-radius: 8px; 
          border: 1px solid var(--border-color);
        }
        
        .header-title-container { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .header-icon { color: #2563eb; display: flex; align-items: center; justify-content: center; }
        
        .content-area { display: flex; flex-direction: column; gap: 16px; min-height: 50vh; }

        /* KARTU PENGUMUMAN (FLAT DESIGN) */
        .announcement-card {
          background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 24px;
          display: flex; flex-direction: column; gap: 16px; transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .announcement-card:hover { border-color: #d1d5db; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); }

        .announcement-header { 
          display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; 
        }
        
        .announcement-title { margin: 0; color: var(--text-main); font-size: 1.1rem; font-weight: 600; line-height: 1.4; }
        
        .announcement-date { 
          font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; font-weight: 500;
          display: flex; align-items: center; gap: 6px; 
        }
        
        .announcement-body { margin: 0; font-size: 0.95rem; color: var(--text-body); white-space: pre-wrap; line-height: 1.6; }

        .announcement-footer { 
          display: flex; justify-content: space-between; align-items: center; 
          margin-top: 8px; flex-wrap: wrap; gap: 12px; border-top: 1px dashed #f3f4f6; padding-top: 16px;
        }
        
        /* LABEL / BADGE (MODERN & SUBTLE) */
        .badge { 
          padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; 
          display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent;
        }
        
        .badge-pusat { background-color: #fffbeb; color: #b45309; border-color: #fef3c7; }
        .badge-rayon { background-color: #eff6ff; color: #1d4ed8; border-color: #dbeafe; }
        .badge-binaan { background-color: #f0fdf4; color: #15803d; border-color: #dcfce7; }
        
        .badge-deadline { background-color: #fef2f2; color: #b91c1c; border-color: #fee2e2; }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        /* RESPONSIVE MOBILE */
        @media (max-width: 767px) {
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .page-wrapper { padding: 16px; }
           .header-card, .announcement-card { padding: 20px; }
           .announcement-header { flex-direction: column; gap: 8px; }
        }
      `}</style>

      <div className="page-wrapper">
        
        {/* HEADER */}
        <div className="header-card">
          <div className="header-title-container">
            <div className="header-icon">
              {/* SVG Ikon Pengumuman Modern */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#111827' }}>Papan Pengumuman & Informasi</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Informasi mendesak, instruksi tugas, atau surat edaran dari instansi maupun pendamping.</p>
        </div>

        {/* AREA DAFTAR PENGUMUMAN */}
        <div className="content-area">
          {notifikasiGlobal.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#fff', border: '1px dashed #d1d5db', borderRadius: '8px', color: '#6b7280' }}>
              <svg style={{ margin: '0 auto 12px auto', color: '#9ca3af' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
                <line x1="9" y1="17" x2="11" y2="17"></line>
              </svg>
              <span style={{ fontSize: '0.95rem' }}>Belum ada pengumuman terbaru untuk Anda saat ini.</span>
            </div>
          ) : (
            notifikasiGlobal.map(notif => {
              // Logika class berdasarkan pengirim
              const isKomisariat = notif.pengirim === 'Pusat Komisariat';
              const isBinaan = notif.target === 'Binaan';
              
              let badgeClass = 'badge-rayon';
              if (isKomisariat) badgeClass = 'badge-pusat';
              if (isBinaan) badgeClass = 'badge-binaan';

              return (
                <div key={notif.id} className="announcement-card">
                  
                  {/* Bagian Judul dan Tanggal */}
                  <div className="announcement-header">
                    <h4 className="announcement-title">{notif.judul}</h4>
                    <div className="announcement-date">
                      {/* Ikon Kalender Modern */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span>{notif.tanggal.replace(' pukul', ',')}</span>
                    </div>
                  </div>
                  
                  {/* Isi Pesan */}
                  <p className="announcement-body">{notif.pesan}</p>
                  
                  {/* Bagian Footer: Pengirim & Deadline */}
                  <div className="announcement-footer">
                    <span className={`badge ${badgeClass}`}>
                      {/* Ikon User/Bangunan Modern */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      Dari: {notif.pengirim}
                    </span>
                    
                    {notif.batas_waktu && (
                      <span className="badge badge-deadline">
                        {/* Ikon Jam/Deadline Modern */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Batas Berlaku: {notif.batas_waktu.split('-').reverse().join('-')}
                      </span>
                    )}
                  </div>
                  
                </div>
              )
            })
          )}
        </div>
        
        <div style={{ height: '50px' }} className="mobile-only"></div>
      </div>
    </>
  );
}