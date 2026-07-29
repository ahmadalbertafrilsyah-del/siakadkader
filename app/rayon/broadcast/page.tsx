'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageBroadcastRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [riwayatBroadcast, setRiwayatBroadcast] = useState<any[]>([]);
  const [notifikasiInbox, setNotifikasiInbox] = useState<any[]>([]); 
  
  const [formBroadcast, setFormBroadcast] = useState({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const { query, where } = require('firebase/firestore');
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(snapRole.docs[0].data().nama || currentRayonId);
            
            onSnapshot(collection(db, "notifikasi_global"), (snap) => {
              const listSent: any[] = []; const listInbox: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.id_rayon === currentRayonId && d.pengirim !== "Pusat Komisariat") listSent.push({ id: doc.id, ...d });
                if (d.pengirim === "Pusat Komisariat" && (d.target === "Semua" || d.target === "Rayon")) listInbox.push({ id: doc.id, ...d });
              });
              listSent.sort((a, b) => b.timestamp - a.timestamp); 
              listInbox.sort((a, b) => b.timestamp - a.timestamp);
              setRiwayatBroadcast(listSent); 
              setNotifikasiInbox(listInbox);
            });
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon",
        aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  const handleKirimBroadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notifikasi_global"), { 
        ...formBroadcast, id_rayon: adminRayonId, pengirim: namaRayonAsli || adminRayonId, 
        tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), 
        timestamp: Date.now() 
      });
      catatLogAktivitas(`Mengirim Broadcast (${formBroadcast.target}): ${formBroadcast.judul}`); 
      alert("Pesan disiarkan!");
      setFormBroadcast({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleHapusBroadcast = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus pesan broadcast "${judul}"?`)) return;
    try { 
      await deleteDoc(doc(db, "notifikasi_global", id)); 
      catatLogAktivitas(`Menarik pesan Broadcast: ${judul}`); 
    } catch (error) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem' }}>📡 Pusat Broadcast Notifikasi</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px' }}>Kirimkan pesan mendesak atau pengumuman penting kepada pengguna di Rayon Anda.</p>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {/* KIRI: FORM & INBOX */}
          <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
              <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Judul Pesan</label>
                  <input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Cth: Panggilan Rapat Darurat" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Isi Pesan Lengkap</label>
                  <textarea rows={4} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Detail pengumuman..." style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', resize: 'vertical', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Batas Waktu</label>
                  <input type="date" required value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Target Penerima (Internal Rayon)</label>
                  <select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', cursor: 'pointer', outline: 'none' }}>
                    <option value="Semua">📢 Semua Pengguna Rayon</option>
                    <option value="Pendamping">👤 Hanya Para Pendamping</option>
                    <option value="Kader">🎓 Hanya Seluruh Kader</option>
                  </select>
                </div>
                <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {isSubmitting ? 'Mengirim...' : '🚀 Siarkan Pesan'}
                </button>
              </form>
            </div>

            <div style={{ backgroundColor: '#fff3cd', padding: '15px', border: '1px solid #ffeeba', borderRadius: '8px' }}>
               <h4 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '0.9rem' }}>📥 Kotak Masuk (Dari Komisariat)</h4>
               <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                 {notifikasiInbox.length === 0 ? (
                   <div style={{ fontSize: '0.8rem', color: '#856404', fontStyle: 'italic' }}>Tidak ada pesan masuk.</div>
                 ) : (
                   notifikasiInbox.map(notif => (
                     <div key={notif.id} style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', marginBottom: '8px', borderLeft: '3px solid #f1c40f' }}>
                       <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem' }}>{notif.judul}</div>
                       <div style={{ fontSize: '0.75rem', color: '#555', whiteSpace: 'pre-wrap', margin: '4px 0' }}>{notif.pesan}</div>
                       <div style={{ fontSize: '0.65rem', color: '#999' }}>{notif.tanggal}</div>
                     </div>
                   ))
                 )}
               </div>
            </div>
          </div>

          {/* KANAN: RIWAYAT BROADCAST YANG DIKIRIM */}
          <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', boxSizing: 'border-box' }}>
            <table className="tabel-utama" style={{ minWidth: '550px' }}>
              <thead>
                <tr style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                  <th style={{ padding: '10px', borderBottom: '2px solid #ddd', color: 'white', textAlign: 'left' }}>Judul & Pesan Terkirim</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', color: 'white', width: '120px' }}>Target & Waktu</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', color: 'white', width: '80px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {riwayatBroadcast.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada riwayat pengumuman yang Anda buat.</td></tr>
                ) : (
                  riwayatBroadcast.map((notif) => (
                    <tr key={notif.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 'bold', color: '#1e824c', fontSize: '0.9rem' }}>{notif.judul}</div>
                        <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{notif.pesan}</div>
                        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px' }}>Dibuat: {notif.tanggal}</div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                         <span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{notif.target}</span>
                         <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '0.8rem', marginTop: '6px' }}>{notif.batas_waktu || '-'}</div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }} title="Tarik / Hapus Pesan">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}