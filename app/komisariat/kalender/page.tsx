'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PageKalenderJadwal() {
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [formJadwal, setFormJadwal] = useState({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubJadwal = onSnapshot(query(collection(db, "jadwal_kegiatan"), orderBy("timestamp", "desc")), (snap) => {
      const listJadwal: any[] = []; 
      snap.forEach(doc => listJadwal.push({ id: doc.id, ...doc.data() })); 
      setJadwalKegiatan(listJadwal);
    });
    return () => unsubJadwal();
  }, []);

  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "jadwal_kegiatan"), { ...formJadwal, pembuat: "Komisariat", timestamp: Date.now() });
      alert("Jadwal kegiatan berhasil ditambahkan!"); 
      setFormJadwal({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua' });
    } catch (error) { alert("Gagal menyimpan jadwal."); } finally { setIsSubmitting(false); }
  };

  const handleHapusJadwal = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus jadwal "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "jadwal_kegiatan", id)); } catch (error) { alert("Gagal menghapus."); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 20px 0', fontSize: '1.2rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📅 Jadwal Kegiatan Terpusat</h3>
        
        {/* Form Tambah */}
        <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
          <h4 style={{ marginTop: 0, color: '#333', fontSize: '0.9rem', marginBottom: '15px' }}>➕ Tambah Agenda Baru</h4>
          <form onSubmit={handleTambahJadwal} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'end' }}>
             {/* Copy exact inputs from your original Kalender block here */}
             <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Judul Kegiatan</label>
              <input type="text" placeholder="Cth: RTK Komisariat" required value={formJadwal.judul} onChange={e => setFormJadwal({...formJadwal, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Tanggal & Waktu</label>
              <input type="datetime-local" required value={formJadwal.tanggal} onChange={e => setFormJadwal({...formJadwal, tanggal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Lokasi / Media</label>
              <input type="text" placeholder="Gedung / Zoom" required value={formJadwal.lokasi} onChange={e => setFormJadwal({...formJadwal, lokasi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Target Peserta</label>
              <select required value={formJadwal.target} onChange={e => setFormJadwal({...formJadwal, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <option value="Semua">📢 Terlihat Semua Pengguna</option>
                <option value="Rayon">🏢 Hanya Admin Rayon</option>
                <option value="Pendamping">👤 Hanya Para Pendamping</option>
                <option value="Kader">🎓 Hanya Seluruh Kader</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Deskripsi Singkat</label>
              <textarea rows={2} placeholder="Isi deskripsi..." value={formJadwal.deskripsi} onChange={e => setFormJadwal({...formJadwal, deskripsi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Agenda</button>
            </div>
          </form>
        </div>

        {/* Tabel Data Kalender */}
        <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
           <table className="tabel-utama" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: '25%' }}>Agenda</th>
                  <th style={{ textAlign: 'left', width: '25%' }}>Waktu & Lokasi</th>
                  <th style={{ textAlign: 'left', width: '30%' }}>Deskripsi</th>
                  <th style={{ textAlign: 'center', width: '10%' }}>Target</th>
                  <th style={{ textAlign: 'center', width: '10%' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jadwalKegiatan.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada agenda terjadwal.</td></tr>
                ) : (
                  jadwalKegiatan.map(jadwal => (
                    <tr key={jadwal.id}>
                      <td style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{jadwal.judul}</td>
                      <td><div style={{color: '#e67e22', fontWeight: 'bold', fontSize: '0.8rem'}}>🗓️ {jadwal.tanggal.replace('T', ' - ')}</div><div style={{fontSize: '0.8rem', color: '#555', marginTop: '4px'}}>📍 {jadwal.lokasi}</div></td>
                      <td style={{ fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</td>
                      <td style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{jadwal.target || 'Semua'}</span></td>
                      <td style={{ textAlign: 'center' }}><button onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Jadwal">🗑️</button></td>
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