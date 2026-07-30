'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageBroadcastPendamping() {
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '' });
  const [riwayatBroadcast, setRiwayatBroadcast] = useState<any[]>([]);
  const [formBroadcast, setFormBroadcast] = useState({ judul: '', pesan: '', target: 'Binaan', batas_waktu: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon });

            const unsubBroad = onSnapshot(query(collection(db, "notifikasi_global"), where("pengirim_id", "==", p.username)), (snap) => {
              const listSent: any[] = [];
              snap.forEach(doc => listSent.push({ id: doc.id, ...doc.data() }));
              listSent.sort((a, b) => b.timestamp - a.timestamp);
              setRiwayatBroadcast(listSent);
            });
            unsubs.push(unsubBroad);
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

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { id_rayon: profilPendamping.id_rayon, aktor: `Pendamping (${profilPendamping.nama})`, username: profilPendamping.username, role: "pendamping", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  const handleKirimBroadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notifikasi_global"), { ...formBroadcast, target: "Binaan", id_rayon: profilPendamping.id_rayon, pengirim: `Pendamping (${profilPendamping.nama})`, pengirim_id: profilPendamping.username, tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), timestamp: Date.now() });
      catatLogAktivitas(`Mengirim Broadcast khusus Kader Binaan: ${formBroadcast.judul}`); alert("Pesan Broadcast berhasil dikirim ke Binaan Anda!"); setFormBroadcast({ ...formBroadcast, judul: '', pesan: '', batas_waktu: '' });
    } catch (error) { alert("Gagal mengirim broadcast."); } finally { setIsSubmitting(false); }
  };

  const handleHapusBroadcast = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus/tarik pesan broadcast "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "notifikasi_global", id)); catatLogAktivitas(`Menarik pesan Broadcast binaan: ${judul}`); } catch (error) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📡 Pusat Pengumuman Binaan</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Kirimkan instruksi tugas atau pesan mendesak. Pengumuman ini <b>HANYA</b> akan dibaca oleh kader binaan Anda.</p>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
            <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Judul Pesan</label><input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Cth: Tugas Tambahan Makalah" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} /></div>
              <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Isi Pesan Lengkap</label><textarea rows={4} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Detail instruksi..." style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical', outline: 'none' }} /></div>
              <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Batas Waktu</label><input type="date" required value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} /></div>
              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>{isSubmitting ? 'Mengirim...' : '🚀 Siarkan ke Binaan'}</button>
            </form>
          </div>
          <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', boxSizing: 'border-box' }}>
            <table className="tabel-utama" style={{ minWidth: '550px', width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead><tr style={{ backgroundColor: '#0d1b2a', color: 'white' }}><th style={{ padding: '10px', color: 'white' }}>Judul & Pesan Terkirim</th><th style={{ padding: '10px', textAlign: 'center', color: 'white', width: '120px' }}>Batas Waktu</th><th style={{ padding: '10px', textAlign: 'center', color: 'white', width: '80px' }}>Aksi</th></tr></thead>
              <tbody>
                {riwayatBroadcast.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada riwayat pengumuman yang Anda buat.</td></tr>
                ) : (
                  riwayatBroadcast.map((notif) => (
                    <tr key={notif.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}><div style={{ fontWeight: 'bold', color: '#1e824c', fontSize: '0.9rem' }}>{notif.judul}</div><div style={{ fontSize: '0.8rem', color: '#555', whiteSpace: 'pre-wrap' }}>{notif.pesan}</div><div style={{ fontSize: '0.7rem', color: '#aaa' }}>Dibuat: {notif.tanggal}</div></td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#e74c3c' }}>{notif.batas_waktu || '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem' }} title="Tarik / Hapus">🗑️</button></td>
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