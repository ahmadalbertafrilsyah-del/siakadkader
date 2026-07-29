'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PageMasterKurikulum() {
  const [masterKurikulum, setMasterKurikulum] = useState<any[]>([]);
  const [formKurikulum, setFormKurikulum] = useState({ jenjang: 'MAPABA', kode: '', nama: '', muatan: '', bobot: 3 });
  const [filterJenjangKurikulum, setFilterJenjangKurikulum] = useState('MAPABA');
  const [editingKurikulumId, setEditingKurikulumId] = useState<string | null>(null);
  const [editKurikulumForm, setEditKurikulumForm] = useState({ kode: '', nama: '', muatan: '', bobot: 0 });

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        aktor: "PK. PMII Sunan Ampel Malang", role: "komisariat", aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "master_kurikulum_pusat"), (snap) => {
      const list: any[] = []; snap.forEach(doc => list.push({ id: doc.id, ...doc.data() })); setMasterKurikulum(list);
    });
    return () => unsub();
  }, []);

  const handleTambahKurikulumPusat = async (e: React.FormEvent) => {
    e.preventDefault();
    try { 
      await addDoc(collection(db, "master_kurikulum_pusat"), { ...formKurikulum, bobot: Number(formKurikulum.bobot), timestamp: Date.now() }); 
      catatLogAktivitas(`Menambahkan Master Kurikulum Pusat: ${formKurikulum.nama}`);
      setFormKurikulum({ ...formKurikulum, kode: '', nama: '', muatan: '' }); 
    } catch (error) { }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📑 Master Kurikulum Kaderisasi</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Susun standar kurikulum yang komprehensif sebagai acuan seluruh Rayon se-UIN Malang.</p>
        
        <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
          <h4 style={{ marginTop: 0, color: '#333', fontSize: '0.9rem', marginBottom: '15px' }}>➕ Tambah Standar Kurikulum</h4>
          <form onSubmit={handleTambahKurikulumPusat} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Jenjang Kaderisasi</label>
              <select required value={formKurikulum.jenjang} onChange={e => setFormKurikulum({...formKurikulum, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Kode Materi</label>
              <input type="text" placeholder="Cth: MPB-01" required value={formKurikulum.kode} onChange={e => setFormKurikulum({...formKurikulum, kode: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Bobot (SKS)</label>
              <input type="number" placeholder="SKS" required value={formKurikulum.bobot} onChange={e => setFormKurikulum({...formKurikulum, bobot: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Nama Materi Besar</label>
              <input type="text" placeholder="Misal: Sejarah PMII" required value={formKurikulum.nama} onChange={e => setFormKurikulum({...formKurikulum, nama: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Muatan / Sub Pembahasan</label>
              <textarea rows={2} placeholder="Detail silabus..." value={formKurikulum.muatan} onChange={e => setFormKurikulum({...formKurikulum, muatan: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>+ Simpan Kurikulum Standar</button>
            </div>
          </form>
        </div>

        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.85rem' }}>Filter Jenjang Tabel:</label>
          <select value={filterJenjangKurikulum} onChange={(e) => setFilterJenjangKurikulum(e.target.value)} style={{ padding: '8px 15px', border: '1px solid #1e824c', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#1e824c' }}>
            <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
          </select>
        </div>

        <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
          <table className="tabel-utama" style={{ minWidth: '700px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '10%' }}>Jenjang</th><th style={{ textAlign: 'center', width: '10%' }}>Kode</th><th style={{ textAlign: 'center', width: '50%' }}>Nama Materi & Muatan</th>
                <th style={{ textAlign: 'center', width: '10%' }}>Bobot</th><th style={{ textAlign: 'center', width: '20%' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {masterKurikulum.filter(m => m.jenjang === filterJenjangKurikulum).sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' })).map((materi) => {
                if (editingKurikulumId === materi.id) {
                  return (
                    <tr key={materi.id} style={{ backgroundColor: '#fff9e6' }}>
                      <td style={{ fontWeight: 'bold', color: '#1e824c', textAlign: 'center' }}>{materi.jenjang}</td>
                      <td><input type="text" value={editKurikulumForm.kode} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, kode: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}/></td>
                      <td><input type="text" value={editKurikulumForm.nama} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, nama: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '4px' }}/><textarea value={editKurikulumForm.muatan} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, muatan: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} rows={2}/></td>
                      <td style={{ textAlign: 'center' }}><input type="number" value={editKurikulumForm.bobot} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, bobot: Number(e.target.value)})} style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center' }}/></td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{display: 'flex', gap: '5px', justifyContent: 'center'}}>
                          <button onClick={async () => {
                              try { await updateDoc(doc(db, "master_kurikulum_pusat", materi.id), { ...editKurikulumForm, bobot: Number(editKurikulumForm.bobot) }); setEditingKurikulumId(null); } catch(err) {}
                          }} style={{ color: 'white', backgroundColor: '#2ecc71', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Simpan</button>
                          <button onClick={() => setEditingKurikulumId(null)} style={{ color: 'white', backgroundColor: '#95a5a6', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Batal</button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={materi.id}>
                    <td style={{ fontWeight: 'bold', textAlign: 'center', color: materi.jenjang === 'MAPABA' ? '#1e824c' : materi.jenjang === 'PKD' ? '#8e44ad' : '#e67e22' }}>{materi.jenjang}</td>
                    <td style={{ color: '#666', fontWeight: 'bold', textAlign: 'center' }}>{materi.kode}</td>
                    <td><div style={{ color: '#333', fontWeight: 'bold', marginBottom: '2px', fontSize: '0.85rem' }}>{materi.nama}</div><div style={{ color: '#777', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{materi.muatan || '-'}</div></td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{materi.bobot}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => { setEditingKurikulumId(materi.id); setEditKurikulumForm({ kode: materi.kode, nama: materi.nama, muatan: materi.muatan || '', bobot: materi.bobot }); }} style={{ color: '#3498db', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', marginRight: '10px' }} title="Edit">✏️</button>
                      <button onClick={async () => {
                          if(window.confirm("Hapus materi ini?")) { await deleteDoc(doc(db, "master_kurikulum_pusat", materi.id)); catatLogAktivitas(`Menghapus Kurikulum Pusat: ${materi.nama}`); }
                      }} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem' }} title="Hapus">🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}