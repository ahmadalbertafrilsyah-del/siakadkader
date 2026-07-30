'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function PageDashboardKader() {
  const [profilKader, setProfilKader] = useState({ nama: '', nim: '', id_rayon: '', jenjang: 'MAPABA', pendamping_id: '' });
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  
  const [notifikasiGlobal, setNotifikasiGlobal] = useState<any[]>([]); 
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [berkasTugas, setBerkasTugas] = useState<any[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = []; 

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            
            let currentPendampingId = '';
            if (p.jenjang === 'MAPABA') currentPendampingId = Array.isArray(p.pendamping_mapaba_id) ? p.pendamping_mapaba_id[0] : p.pendamping_mapaba_id;
            if (p.jenjang === 'PKD') currentPendampingId = Array.isArray(p.pendamping_pkd_id) ? p.pendamping_pkd_id[0] : p.pendamping_pkd_id;
            if (p.jenjang === 'SIG') currentPendampingId = Array.isArray(p.pendamping_sig_id) ? p.pendamping_sig_id[0] : p.pendamping_sig_id;
            if (p.jenjang === 'SKP') currentPendampingId = Array.isArray(p.pendamping_skp_id) ? p.pendamping_skp_id[0] : p.pendamping_skp_id;

            setProfilKader({ nama: p.nama, nim: p.nim, id_rayon: p.id_rayon, jenjang: p.jenjang || 'MAPABA', pendamping_id: currentPendampingId });
            
            if (p.id_rayon === 'Komisariat' || p.id_rayon === 'Pusat Komisariat') {
               setNamaRayonInduk('Pusat Komisariat');
            } else if (p.id_rayon) {
              const unsubRayon = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                if (rayonSnap.exists()) setNamaRayonInduk(rayonSnap.data().nama || p.id_rayon);
              });
              unsubs.push(unsubRayon);
            }

            const unsubNotif = onSnapshot(collection(db, "notifikasi_global"), (snap: any) => {
              const listNotif: any[] = [];
              snap.forEach((doc: any) => {
                const d = doc.data();
                if (d.target === "Semua" || d.target === "Kader") {
                   if (d.pengirim === "Pusat Komisariat" || d.id_rayon === p.id_rayon) listNotif.push({ id: doc.id, ...d });
                }
                if (d.target === "Binaan" && d.pengirim_id === currentPendampingId) {
                   listNotif.push({ id: doc.id, ...d });
                }
              });
              listNotif.sort((a: any, b: any) => b.timestamp - a.timestamp); setNotifikasiGlobal(listNotif);
            });
            unsubs.push(unsubNotif);

            const unsubJadwal = onSnapshot(collection(db, "jadwal_kegiatan"), (snap: any) => {
              const listJadwal: any[] = [];
              snap.forEach((doc: any) => {
                const d = doc.data();
                if (d.pembuat === "Komisariat" || d.id_rayon === p.id_rayon) {
                  if (d.target === "Binaan" && d.pendamping_id !== currentPendampingId) return; 
                  listJadwal.push({ id: doc.id, ...d });
                }
              });
              listJadwal.sort((a: any, b: any) => b.timestamp - a.timestamp); setJadwalKegiatan(listJadwal);
            });
            unsubs.push(unsubJadwal);

            const unsubBerkas = onSnapshot(query(collection(db, "berkas_kader"), where("email_kader", "==", p.email)), (snap: any) => {
               setBerkasTugas(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
            });
            unsubs.push(unsubBerkas);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ backgroundColor: '#2c3e50', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', color: 'white', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{color: '#f1c40f', marginTop: 0, fontSize: '1.6rem'}}>Halo, Sahabat/i {profilKader.nama.split(' ')[0]}! ✨</h2>
          <p style={{lineHeight: '1.6', margin: 0, fontSize: '0.95rem', opacity: 0.9}}>Selamat datang di portal akademik kaderisasi. Mari tingkatkan kapasitas diri dan selesaikan seluruh rangkaian tugas pada jenjang <b>{profilKader.jenjang}</b> di <b>{namaRayonInduk}</b>.</p>
        </div>
        <div style={{ position: 'absolute', right: '-20px', bottom: '-40px', fontSize: '10rem', opacity: 0.1, zIndex: 1 }}>🎓</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Status Kaderisasi</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{profilKader.jenjang}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Diunggah</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{berkasTugas.length} <span style={{fontSize: '0.8rem', color: '#999'}}>Dokumen</span></div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #2ecc71' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Selesai (ACC)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#27ae60', marginTop: '5px' }}>{berkasTugas.filter(b => b.status === 'Selesai').length} <span style={{fontSize: '0.8rem', color: '#999'}}>Dokumen</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
            <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>📢 Papan Pengumuman</h3>
            <Link href="/kader/pengumuman" style={{ fontSize: '0.8rem', color: '#3498db', textDecoration: 'none', fontWeight: 'bold' }}>Lihat Semua</Link>
          </div>
          <div style={{ display: 'grid', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
            {notifikasiGlobal.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada informasi terbaru.</div>
            ) : (
              notifikasiGlobal.slice(0, 5).map(notif => {
                const isBinaan = notif.target === 'Binaan';
                return (
                  <div key={notif.id} style={{ padding: '15px', backgroundColor: isBinaan ? '#f0fbf4' : '#fcfcfc', border: '1px solid #eee', borderLeft: isBinaan ? '4px solid #27ae60' : '4px solid #3498db', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <strong style={{ color: '#333', fontSize: '0.9rem' }}>{notif.judul}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#888' }}>{notif.tanggal}</span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.pesan}</p>
                    <div style={{ fontSize: '0.7rem', color: isBinaan ? '#27ae60' : '#3498db', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
            <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>📅 Jadwal Terdekat</h3>
            <Link href="/kader/kalender" style={{ fontSize: '0.8rem', color: '#3498db', textDecoration: 'none', fontWeight: 'bold' }}>Buka Kalender</Link>
          </div>
          <div style={{ display: 'grid', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
            {jadwalKegiatan.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Tidak ada agenda terdekat.</div>
            ) : (
              jadwalKegiatan.slice(0, 5).map(jadwal => {
                const isPendamping = jadwal.pembuat.includes('Pendamping');
                return (
                  <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: isPendamping ? '4px solid #2ecc71' : '4px solid #f1c40f', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '0.95rem' }}>{jadwal.judul}</h4>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{jadwal.deskripsi}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}