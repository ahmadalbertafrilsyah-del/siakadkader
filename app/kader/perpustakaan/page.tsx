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
        .desktop-view { display: block; }
        .mobile-view { display: none; }
        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: block !important; }
           body, html, .mobile-content-wrapper, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* DESKTOP */}
      <div className="desktop-view" style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', minHeight: '80vh' }}>
        <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
          <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>📚 Perpustakaan Digital & Modul</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Akses E-Book, modul kaderisasi, dan referensi bacaan untuk menunjang wawasan Anda.</p>
        </div>
        <div>
          {Object.keys(groupedPerpus).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>
              Belum ada file di Perpustakaan Digital.
            </div>
          ) : (
            Object.keys(groupedPerpus).sort().map(folder => (
              <div key={folder} style={{ marginBottom: '25px', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#2c3e50', padding: '12px 15px', fontWeight: 'bold', color: 'white', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📁 Folder: {folder}
                </div>
                <div style={{ padding: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', backgroundColor: '#fdfdfd' }}>
                  {groupedPerpus[folder].map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <div style={{ overflow: 'hidden', flex: 1, paddingRight: '10px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '5px' }}>{item.nama_file}</div>
                        <span style={{ fontSize: '0.65rem', color: '#777', backgroundColor: '#eee', padding: '2px 6px', borderRadius: '4px' }}>
                          {item.id_rayon === 'Komisariat' ? 'Pusat Komisariat' : 'Modul Rayon'}
                        </span>
                      </div>
                      <a href={item.link_file} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#2ecc71', color: 'white', padding: '8px 12px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0, textAlign: 'center' }}>
                        👁️ Buka / Unduh
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MOBILE */}
      <div className="mobile-view">
        {Object.keys(groupedPerpus).length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>
            Belum ada referensi materi.
          </div>
        ) : (
          Object.keys(groupedPerpus).sort().map(folder => (
            <div key={folder} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e824c', marginBottom: '10px', paddingBottom: '5px', borderBottom: '2px solid #1e824c', display: 'inline-block' }}>
                📁 {folder}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {groupedPerpus[folder].map((item: any) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '8px' }}>
                    <div style={{ overflow: 'hidden', flex: 1, paddingRight: '10px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>{item.nama_file}</div>
                      <span style={{ fontSize: '0.65rem', color: '#777', fontStyle: 'italic' }}>
                        {item.id_rayon === 'Komisariat' ? 'Sumber: Pusat Komisariat' : 'Sumber: Pengurus Rayon'}
                      </span>
                    </div>
                    <a href={item.link_file} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#0000af', color: 'white', padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.75rem' }}>
                      Buka
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div style={{ height: '30px' }}></div>
      </div>
    </>
  );
}