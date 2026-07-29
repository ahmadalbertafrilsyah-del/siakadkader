'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageKalenderRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [formJadwal, setFormJadwal] = useState({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua' });
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
            
            onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
              const listJadwal: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.pembuat === "Komisariat" || d.id_rayon === currentRayonId) listJadwal.push({ id: doc.id, ...d });
              });
              listJadwal.sort((a, b) => b.timestamp - a.timestamp); 
              setJadwalKegiatan(listJadwal);
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

  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "jadwal_kegiatan"), { ...formJadwal, id_rayon: adminRayonId, pembuat: namaRayonAsli || adminRayonId, timestamp: Date.now() });
      catatLogAktivitas(`Menambahkan jadwal kegiatan rayon (Target: ${formJadwal.target}): ${formJadwal.judul}`);
      alert("Jadwal ditambahkan!"); 
      setFormJadwal({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua' });
    } catch (error) { alert("Gagal."); } finally { setIsSubmitting(false); }
  };

  const handleHapusJadwal = async (id: string, judul: string, pembuat: string) => {
    if (pembuat === "Komisariat" || pembuat === "Pusat Komisariat") return alert("Anda tidak memiliki akses menghapus jadwal Komisariat.");
    if (!window.confirm(`Hapus jadwal "${judul}"?`)) return;
    try { 
      await deleteDoc(doc(db, "jadwal_kegiatan", id)); 
      catatLogAktivitas(`Menghapus jadwal kegiatan rayon: ${judul}`); 
    } catch (error) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem' }}>📅 Kalender & Jadwal Kegiatan Rayon</h3>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
            <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>➕ Tambah Agenda Rayon</h4>
            <form onSubmit={handleTambahJadwal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Judul Kegiatan (Cth: RTK Rayon)" required value={formJadwal.judul} onChange={e => setFormJadwal({...formJadwal, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
              <input type="datetime-local" required value={formJadwal.tanggal} onChange={e => setFormJadwal({...formJadwal, tanggal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
              <input type="text" placeholder="Lokasi / Media" required value={formJadwal.lokasi} onChange={e => setFormJadwal({...formJadwal, lokasi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
              <select required value={formJadwal.target} onChange={e => setFormJadwal({...formJadwal, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', cursor: 'pointer', outline: 'none' }}>
                <option value="Semua">📢 Terlihat Semua Pengguna</option>
                <option value="Rayon">🏢 Hanya Admin Rayon</option>
                <option value="Pendamping">👤 Hanya Para Pendamping</option>
                <option value="Kader">🎓 Hanya Seluruh Kader</option>
              </select>
              <textarea rows={3} placeholder="Deskripsi Singkat" value={formJadwal.deskripsi} onChange={e => setFormJadwal({...formJadwal, deskripsi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Agenda</button>
            </form>
          </div>
          <div style={{ flex: '2 1 450px', overflowX: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'grid', gap: '10px' }}>
              {jadwalKegiatan.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>Belum ada agenda terjadwal.</div>
              ) : (
                jadwalKegiatan.map((jadwal: any) => (
                  <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: jadwal.pembuat === 'Komisariat' ? '4px solid #f1c40f' : '4px solid #3498db', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                        <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '1rem' }}>{jadwal.judul}</h4>
                        {jadwal.pembuat === 'Komisariat' ? (
                          <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '2px 6px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold', border: '1px solid #ffeeba' }}>Pusat Komisariat</span>
                        ) : (
                          <span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '2px 6px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold', border: '1px solid #b8daff' }}>Agenda Rayon</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                    </div>
                    {jadwal.pembuat !== 'Komisariat' && (
                      <button onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul, jadwal.pembuat)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Jadwal Rayon">🗑️</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}