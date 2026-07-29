'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PageBroadcast() {
  const [riwayatBroadcast, setRiwayatBroadcast] = useState<any[]>([]);
  const [formBroadcast, setFormBroadcast] = useState({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubBroadcast = onSnapshot(query(collection(db, "notifikasi_global"), where("pengirim", "==", "Pusat Komisariat")), (snap) => {
      const listNotif: any[] = []; 
      snap.forEach(doc => listNotif.push({ id: doc.id, ...doc.data() }));
      listNotif.sort((a, b) => b.timestamp - a.timestamp); 
      setRiwayatBroadcast(listNotif);
    });
    return () => unsubBroadcast();
  }, []);

  const handleKirimBroadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notifikasi_global"), { 
        ...formBroadcast, 
        pengirim: "Pusat Komisariat", 
        tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), 
        timestamp: Date.now() 
      });
      alert("Pesan Broadcast berhasil disiarkan!"); 
      setFormBroadcast({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
    } catch (error) { alert("Gagal mengirim broadcast."); } finally { setIsSubmitting(false); }
  };

  const handleHapusBroadcast = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus pesan broadcast "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "notifikasi_global", id)); } catch (error) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📡 Pusat Broadcast & Notifikasi</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Kirimkan pesan mendesak atau pengumuman penting yang akan muncul di notifikasi pengguna tujuan.</p>
        
        <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
          <form onSubmit={handleKirimBroadcast} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'end' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Judul Pesan</label>
              <input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Cth: Panggilan Rapat Darurat" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Isi Pesan Lengkap</label>
              <textarea rows={3} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Detail pengumuman..." style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Batas Waktu Siar</label>
              <input type="date" required value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Target Penerima</label>
              <select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <option value="Semua">📢 Semua Pengguna (Rayon, Pendamping, Kader)</option>
                <option value="Rayon">🏢 Hanya Admin Rayon</option>
                <option value="Pendamping">👤 Hanya Para Pendamping</option>
                <option value="Kader">🎓 Hanya Seluruh Kader</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', height: '100%' }}>
              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}>
                {isSubmitting ? 'Mengirim...' : '🚀 Siarkan Pesan'}
              </button>
            </div>
          </form>
        </div>

        <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
          <table className="tabel-utama" style={{ minWidth: '700px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', width: '40%' }}>Judul & Pesan Broadcast</th>
                <th style={{ textAlign: 'center', width: '20%' }}>Target</th>
                <th style={{ textAlign: 'center', width: '20%' }}>Batas Waktu</th>
                <th style={{ textAlign: 'center', width: '20%' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {riwayatBroadcast.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada riwayat broadcast yang dikirim.</td></tr>
              ) : (
                riwayatBroadcast.map((notif) => (
                  <tr key={notif.id}>
                    <td>
                      <div style={{ fontWeight: 'bold', color: '#1e824c', fontSize: '0.9rem' }}>{notif.judul}</div>
                      <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{notif.pesan}</div>
                      <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px' }}>Dibuat: {notif.tanggal}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{notif.target}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#e74c3c', fontSize: '0.8rem' }}>{notif.batas_waktu || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem' }} title="Tarik / Hapus Pesan">🗑️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}