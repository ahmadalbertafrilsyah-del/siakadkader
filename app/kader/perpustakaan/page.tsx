'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PagePerpustakaanKader() {
  const [listPerpus, setListPerpus] = useState<any[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            
            const unsubPerpus = onSnapshot(collection(db, "perpustakaan"), (snap) => {
              const list: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.id_rayon === 'Komisariat' || d.id_rayon === p.id_rayon) {
                  list.push({ id: doc.id, ...d });
                }
              });
              setListPerpus(list);
            });
            unsubs.push(unsubPerpus);
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

  const groupedPerpus = listPerpus.reduce((acc: any, item: any) => { 
    if (!acc[item.folder]) acc[item.folder] = []; 
    acc[item.folder].push(item); 
    return acc; 
  }, {});

  return (
    <>
      <style>{`
        /* COLOR PALETTE (Modern Slate/Gray & Clean) */
        :root {
          --text-main: #111827;
          --text-body: #374151;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
          --bg-card: #ffffff;
        }

        .page-wrapper { display: flex; flex-direction: column; gap: 24px; }
        
        .header-card { 
          background: var(--bg-card); padding: 24px; border-radius: 8px; 
          border: 1px solid var(--border-color); box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
        }
        
        .header-title-container { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .header-icon { color: #2563eb; display: flex; align-items: center; justify-content: center; }

        /* KARTU FOLDER & FILE */
        .folder-section { 
          background: var(--bg-card); border: 1px solid var(--border-color); 
          border-radius: 8px; overflow: hidden; margin-bottom: 24px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); 
        }
        
        .folder-header { 
          background-color: #f8fafc; padding: 16px 20px; font-weight: 600; 
          color: var(--text-main); border-bottom: 1px solid var(--border-color); 
          display: flex; align-items: center; gap: 10px; font-size: 1rem;
        }
        
        .folder-grid { 
          padding: 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
          gap: 16px; background-color: #ffffff; 
        }

        .file-item-card { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: 16px; background-color: #ffffff; border: 1px solid var(--border-color); 
          border-radius: 6px; transition: all 0.2s ease; gap: 12px;
        }
        .file-item-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02); }

        .btn-buka { 
          background-color: #2563eb; color: white; padding: 8px 14px; border-radius: 6px; 
          text-decoration: none; font-weight: 600; font-size: 0.8rem; flex-shrink: 0; 
          text-align: center; transition: background-color 0.2s; white-space: nowrap;
        }
        .btn-buka:hover { background-color: #1d4ed8; }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        /* RESPONSIVE MOBILE */
        @media (max-width: 767px) {
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .page-wrapper { padding: 16px; }
           .header-card { padding: 20px; }
           .folder-grid { padding: 16px; grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="page-wrapper">
        
        {/* HEADER */}
        <div className="header-card">
          <div className="header-title-container">
            <div className="header-icon">
              {/* SVG Ikon Buku / Perpustakaan */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Perpustakaan Digital & Modul</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Akses E-Book, modul kaderisasi, dan referensi bacaan untuk menunjang wawasan Anda.</p>
        </div>

        {/* KONTEN UTAMA */}
        <div>
          {Object.keys(groupedPerpus).length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#fff', border: '1px dashed #d1d5db', borderRadius: '8px', color: 'var(--text-muted)' }}>
              <svg style={{ margin: '0 auto 12px auto', color: '#9ca3af' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
              <span style={{ fontSize: '0.95rem' }}>Belum ada file di Perpustakaan Digital saat ini.</span>
            </div>
          ) : (
            Object.keys(groupedPerpus).sort().map(folder => (
              <div key={folder} className="folder-section">
                
                {/* Judul Folder */}
                <div className="folder-header">
                  {/* Ikon Folder SVG */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#d97706' }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>Folder: {folder}</span>
                </div>

                {/* Grid Daftar File */}
                <div className="folder-grid">
                  {groupedPerpus[folder].map((item: any) => (
                    <div key={item.id} className="file-item-card">
                      
                      <div style={{ overflow: 'hidden', flex: 1, paddingRight: '8px' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' }}>
                          {item.nama_file}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontWeight: '500', display: 'inline-block' }}>
                          {item.id_rayon === 'Komisariat' ? 'Pusat Komisariat' : 'Modul Rayon'}
                        </span>
                      </div>

                      <a href={item.link_file} target="_blank" rel="noopener noreferrer" className="btn-buka">
                        Buka Dokumen
                      </a>

                    </div>
                  ))}
                </div>

              </div>
            ))
          )}
        </div>

        <div style={{ height: '50px' }} className="mobile-only"></div>
      </div>
    </>
  );
}