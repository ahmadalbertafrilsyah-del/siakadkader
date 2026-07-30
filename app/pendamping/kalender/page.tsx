'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageKalenderPendamping() {
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '' });
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [formJadwal, setFormJadwal] = useState({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Binaan' });
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

            const unsubJadwal = onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
              const listJadwal: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.pembuat === "Komisariat" || d.id_rayon === p.id_rayon) {
                  if (d.pembuat.includes("Pendamping") && d.pendamping_id !== p.username) return; 
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

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { id_rayon: profilPendamping.id_rayon, aktor: `Pendamping (${profilPendamping.nama})`, username: profilPendamping.username, role: "pendamping", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "jadwal_kegiatan"), { ...formJadwal, id_rayon: profilPendamping.id_rayon, pembuat: `Pendamping (${profilPendamping.nama})`, pendamping_id: profilPendamping.username, target: 'Binaan', timestamp: Date.now() });
      catatLogAktivitas(`Menjadwalkan kegiatan khusus binaan: ${formJadwal.judul}`); alert("Jadwal Mentoring berhasil dibuat!"); setFormJadwal({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Binaan' });
    } catch (error) { alert("Gagal menyimpan jadwal."); } finally { setIsSubmitting(false); }
  };

  const handleHapusJadwal = async (id: string, judul: string, pembuat: string) => {
    if (!pembuat.includes(profilPendamping.username) && !pembuat.includes(profilPendamping.nama)) return alert("Anda hanya bisa menghapus jadwal yang Anda buat sendiri.");
    if (!window.confirm(`Hapus jadwal "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "jadwal_kegiatan", id)); catatLogAktivitas(`Menghapus jadwal mentoring: ${judul}`); } catch (error) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem' }}>📅 Buat Jadwal Mentoring</h3>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
            <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>➕ Jadwalkan Pertemuan</h4>
            <p style={{fontSize: '0.75rem', color: '#e74c3c', fontStyle: 'italic', marginBottom: '15px'}}>*Jadwal ini hanya akan dikirimkan dan dilihat oleh Kader Binaan Anda.</p>
            <form onSubmit={handleTambahJadwal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Judul Kegiatan (Cth: Kumpul Binaan)" required value={formJadwal.judul} onChange={e => setFormJadwal({...formJadwal, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none' }} />
              <input type="datetime-local" required value={formJadwal.tanggal} onChange={e => setFormJadwal({...formJadwal, tanggal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none' }} />
              <input type="text" placeholder="Lokasi / Media" required value={formJadwal.lokasi} onChange={e => setFormJadwal({...formJadwal, lokasi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none' }} />
              <textarea rows={3} placeholder="Deskripsi Singkat" value={formJadwal.deskripsi} onChange={e => setFormJadwal({...formJadwal, deskripsi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', resize: 'vertical', outline: 'none' }} />
              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Agenda</button>
            </form>
          </div>
          <div style={{ flex: '2 1 450px', overflowX: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'grid', gap: '10px' }}>
              {jadwalKegiatan.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>Belum ada agenda terjadwal.</div>
              ) : (
                jadwalKegiatan.map(jadwal => {
                  const isMine = jadwal.pendamping_id === profilPendamping.username;
                  const labelPembuat = jadwal.pembuat === 'Komisariat' ? 'Pusat Komisariat' : jadwal.pembuat === 'Rayon' ? `Pengurus Rayon` : isMine ? 'Jadwal Anda' : 'Pendamping Lain';
                  const colorLabel = jadwal.pembuat === 'Komisariat' ? '#f1c40f' : jadwal.pembuat === 'Rayon' ? '#e74c3c' : '#3498db';
                  return (
                    <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: `4px solid ${colorLabel}`, padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                          <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '1rem' }}>{jadwal.judul}</h4>
                          <span style={{ backgroundColor: '#f8f9fa', color: '#555', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', border: '1px solid #ddd' }}>{labelPembuat}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                      </div>
                      {isMine && (<button onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul, jadwal.pembuat)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Jadwal Anda">🗑️</button>)}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}