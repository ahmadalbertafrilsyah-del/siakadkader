'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PagePengumumanLogin() {
  const [pengumumanList, setPengumumanList] = useState<string[]>([]);
  const [newPengumuman, setNewPengumuman] = useState('');
  const [isSavingPengumuman, setIsSavingPengumuman] = useState(false);

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { aktor: "PK. PMII Sunan Ampel Malang", role: "komisariat", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "pengaturan_sistem", "pengumuman"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().listTeks) setPengumumanList(docSnap.data().listTeks);
    });
    return () => unsub();
  }, []);

  const handleTambahPengumuman = (e: React.FormEvent) => {
    e.preventDefault(); if (!newPengumuman.trim()) return;
    setPengumumanList([...pengumumanList, newPengumuman]); setNewPengumuman('');
  };

  const handleSimpanPengumuman = async () => {
    setIsSavingPengumuman(true);
    try { 
      await setDoc(doc(db, "pengaturan_sistem", "pengumuman"), { listTeks: pengumumanList, terakhirDiubah: Date.now() }, { merge: true }); 
      catatLogAktivitas("Mengubah urutan Teks Pengumuman Login."); 
      alert("Pengumuman berhasil disebarkan!"); 
    } catch (error) {} finally { setIsSavingPengumuman(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📢 Pengumuman Halaman Login</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Teks di bawah ini akan tayang dan bergeser otomatis di halaman depan SIAKAD.</p>
        
        <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
          <form onSubmit={handleTambahPengumuman} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>➕ Tambah Kalimat Pengumuman Baru</label>
            <textarea rows={3} placeholder="Misal: Pendaftaran PKD telah dibuka..." value={newPengumuman} onChange={e => setNewPengumuman(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{fontSize: '0.75rem', color: '#e67e22', fontStyle: 'italic'}}>*Klik <b>Tambah ke Daftar</b> dulu, lalu klik <b>Simpan & Siarkan</b>.</span>
               <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>➕ Tambah ke Daftar</button>
            </div>
          </form>
        </div>

        <div style={{ border: '1px solid #eaeaea', borderRadius: '10px', padding: '20px', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed #ccc', paddingBottom: '10px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '1rem' }}>📋 Daftar Teks Berjalan Saat Ini</h4>
            <button onClick={handleSimpanPengumuman} disabled={isSavingPengumuman} style={{ backgroundColor: isSavingPengumuman ? '#95a5a6' : '#2ecc71', color: 'white', padding: '8px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{isSavingPengumuman ? 'Menyimpan...' : '💾 Simpan & Siarkan'}</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pengumumanList.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada teks pengumuman.</div>
            ) : (
              pengumumanList.map((teks, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#eaf4fc', borderLeft: '4px solid #0000af', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#333', lineHeight: '1.5', flex: 1, paddingRight: '15px' }}>{teks}</span>
                  <button onClick={() => { const nl = [...pengumumanList]; nl.splice(index, 1); setPengumumanList(nl); }} style={{ backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Hapus</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}