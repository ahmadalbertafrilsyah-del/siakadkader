'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageDashboardBerandaPendamping() {
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '' });
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  
  const [kaderBinaan, setKaderBinaan] = useState<any[]>([]);
  const [berkasTugas, setBerkasTugas] = useState<any[]>([]);
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [notifikasiGlobal, setNotifikasiGlobal] = useState<any[]>([]); 
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = []; // Array pembersih

    // Fungsi sapu bersih semua listener aktif
    const clearUnsubs = () => {
      unsubs.forEach(unsub => unsub());
      unsubs = [];
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      clearUnsubs(); // Bersihkan setiap auth dipanggil ulang

      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon });
            
            const isPendampingSKP = p.id_rayon === 'Komisariat';
            if (isPendampingSKP) setNamaRayonInduk('Pusat Komisariat');
            else {
              const unsubRayon = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                if (rayonSnap.exists()) setNamaRayonInduk(rayonSnap.data().nama || p.id_rayon);
              });
              unsubs.push(unsubRayon);

              const unsubTugas = onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", p.id_rayon)), (snap: any) => {
                setListMasterTugas(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))); 
              });
              unsubs.push(unsubTugas);
            }

            // Ambil Data Binaan Manual
            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const listKader: any[] = []; const emailKaderBinaan: string[] = [];
            
            snapKader.forEach((d) => {
              const data = d.data();
              let isBinaan = false;
              if (isPendampingSKP) {
                  if (Array.isArray(data.pendamping_skp_id)) { if (data.pendamping_skp_id.includes(p.username)) isBinaan = true; } 
                  else if (data.pendamping_skp_id === p.username) isBinaan = true;
              } else {
                  const pMapaba = Array.isArray(data.pendamping_mapaba_id) ? data.pendamping_mapaba_id : (data.pendamping_mapaba_id ? [data.pendamping_mapaba_id] : []);
                  const pPkd = Array.isArray(data.pendamping_pkd_id) ? data.pendamping_pkd_id : (data.pendamping_pkd_id ? [data.pendamping_pkd_id] : []);
                  const pSig = Array.isArray(data.pendamping_sig_id) ? data.pendamping_sig_id : (data.pendamping_sig_id ? [data.pendamping_sig_id] : []);
                  if (pMapaba.includes(p.username) || pPkd.includes(p.username) || pSig.includes(p.username) || data.pendampingId === p.username) isBinaan = true;
              }
              if (isBinaan) { listKader.push({ id: d.id, ...data }); emailKaderBinaan.push(data.email); }
            });
            setKaderBinaan(listKader);

            if (emailKaderBinaan.length > 0) {
              const unsubBerkas = onSnapshot(collection(db, "berkas_kader"), (snap: any) => {
                 const dataBerkas: any[] = [];
                 snap.forEach((doc: any) => { const d = doc.data(); if (emailKaderBinaan.includes(d.email_kader)) dataBerkas.push({ id: doc.id, ...d }); });
                 setBerkasTugas(dataBerkas);
              });
              unsubs.push(unsubBerkas);
            }

            // Notifikasi & Jadwal
            const unsubNotif = onSnapshot(collection(db, "notifikasi_global"), (snap: any) => {
              const listNotif: any[] = [];
              snap.forEach((doc: any) => {
                const d = doc.data();
                if (d.target === "Semua" || d.target === "Pendamping" || d.pengirim_id === p.username) {
                   if (d.pengirim === "Pusat Komisariat" || d.id_rayon === p.id_rayon) listNotif.push({ id: doc.id, ...d });
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
                  if (d.pembuat.includes("Pendamping") && d.pendamping_id !== p.username) return; 
                  listJadwal.push({ id: doc.id, ...d });
                }
              });
              listJadwal.sort((a: any, b: any) => b.timestamp - a.timestamp); setJadwalKegiatan(listJadwal);
            });
            unsubs.push(unsubJadwal);
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => {
      unsubscribeAuth();
      clearUnsubs(); // Bersihkan saat keluar halaman
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
        <h2 style={{color: '#1e824c', marginTop: 0, fontSize: '1.5rem'}}>Halo, Sahabat/i {profilPendamping.nama.split(' ')[0]}! 👋</h2>
        <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Selamat datang di Panel Pendamping. Pantau perkembangan kader binaan Anda dan berikan evaluasi terbaik untuk kemajuan {namaRayonInduk}.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Kader Binaan</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{kaderBinaan.length}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Binaan Menunggu</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{berkasTugas.filter(s => s.status === 'Menunggu Verifikasi').length}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Instansi Aktif</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{listMasterTugas.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* NOTIFIKASI INBOX */}
        <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🔔 Pusat Informasi Instansi</h3>
          <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
            {notifikasiGlobal.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada informasi/pengumuman terbaru.</div>
            ) : (
              notifikasiGlobal.map(notif => (
                <div key={notif.id} style={{ padding: '15px', backgroundColor: '#fcfcfc', border: '1px solid #eee', borderLeft: '4px solid #1e824c', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <strong style={{ color: '#333', fontSize: '0.9rem' }}>{notif.judul}</strong>
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>{notif.tanggal}</span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap' }}>{notif.pesan}</p>
                  <div style={{ fontSize: '0.7rem', color: '#3498db', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* JADWAL KEGIATAN */}
        <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📅 Jadwal Kegiatan Terdekat</h3>
          <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
            {jadwalKegiatan.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada agenda kegiatan dalam waktu dekat.</div>
            ) : (
              jadwalKegiatan.map(jadwal => {
                const isKomisariat = jadwal.pembuat === 'Komisariat';
                const isPendamping = jadwal.pembuat.includes('Pendamping');
                const isMine = jadwal.pendamping_id === profilPendamping.username;
                const borderColor = isKomisariat ? '#f1c40f' : isMine ? '#2ecc71' : isPendamping ? '#3498db' : '#e74c3c';
                const labelPembuat = isKomisariat ? 'Pusat Komisariat' : isMine ? 'Jadwal Anda' : isPendamping ? 'Jadwal Mentoring' : 'Pengurus Rayon';

                return (
                  <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: `4px solid ${borderColor}`, padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                        <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '0.95rem' }}>{jadwal.judul}</h4>
                        <span style={{ backgroundColor: '#f8f9fa', color: '#555', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{labelPembuat}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                    </div>
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