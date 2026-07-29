'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageKurikulumRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');

  const [tabKurikulum, setTabKurikulum] = useState('MAPABA');
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], SIG: [], NONFORMAL: [] });
  const [masterKurikulumPusat, setMasterKurikulumPusat] = useState<any[]>([]); 
  
  const [formMateri, setFormMateri] = useState({ kode: '', nama: '', muatan: '', bobot: 3 });
  const [isSavingKurikulum, setIsSavingKurikulum] = useState(false);
  const [editingMateriId, setEditingMateriId] = useState<string | null>(null);
  const [editMateriForm, setEditMateriForm] = useState({ kode: '', nama: '', muatan: '', bobot: 0 });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(snapRole.docs[0].data().nama || currentRayonId);

            onSnapshot(doc(db, "kurikulum_rayon", currentRayonId), (docSnap: any) => {
              if (docSnap.exists()) setListKurikulum(docSnap.data() as Record<string, any[]>);
            });
          }
        });
      }
    });

    const unsubPusat = onSnapshot(collection(db, "master_kurikulum_pusat"), (snap: any) => {
      setMasterKurikulumPusat(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubscribeAuth(); unsubPusat(); };
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

  const handleTarikMateriPusat = async (materiPusat: any) => {
    setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const newMateri = { id: Date.now().toString(), kode: materiPusat.kode, nama: materiPusat.nama, muatan: materiPusat.muatan || '', bobot: Number(materiPusat.bobot), isLokal: false };
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: [...currentList, newMateri] }, { merge: true });
      catatLogAktivitas(`Menarik Materi Pusat: ${materiPusat.nama}`);
    } catch (error) {} finally { setIsSavingKurikulum(false); }
  };

  const handleTambahMateriLokal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const newMateri = { id: Date.now().toString(), kode: formMateri.kode, nama: formMateri.nama, muatan: formMateri.muatan, bobot: Number(formMateri.bobot), isLokal: true };
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: [...currentList, newMateri] }, { merge: true });
      catatLogAktivitas(`Menambahkan materi lokal: ${formMateri.nama}`);
      setFormMateri({ kode: '', nama: '', muatan: '', bobot: 3 }); 
    } catch (error) {} finally { setIsSavingKurikulum(false); }
  };

  const handleHapusMateri = async (materiId: string) => {
    if (!window.confirm("Yakin menghapus materi ini dari kurikulum rayon?")) return;
    try {
      const currentList = listKurikulum[tabKurikulum] || []; 
      const filteredList = currentList.filter((m: any) => m.id !== materiId);
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: filteredList }, { merge: true });
    } catch (error) {}
  };

  const handleSimpanEditMateri = async (materiId: string) => {
    if (!editMateriForm.kode || !editMateriForm.nama) return alert("Kode dan Nama materi tidak boleh kosong!"); 
    setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const updatedList = currentList.map((m: any) => m.id === materiId ? { ...m, ...editMateriForm } : m);
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: updatedList }, { merge: true });
      setEditingMateriId(null); 
    } catch(err) {} finally { setIsSavingKurikulum(false); }
  };

  return (
    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
        <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>📚 Kurikulum Kaderisasi Rayon</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Tarik materi wajib dari Komisariat atau tambahkan muatan lokal khusus Rayon.</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px', overflowX: 'auto' }}>
        {['MAPABA', 'PKD', 'SIG', 'NONFORMAL'].map(tab => (
          <button key={tab} onClick={() => setTabKurikulum(tab)} style={{ padding: '8px 15px', border: 'none', background: tabKurikulum === tab ? '#0000af' : '#f4f6f9', color: tabKurikulum === tab ? 'white' : '#555', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1e824c', fontSize: '0.9rem' }}>📥 Tarik Materi Wajib (Dari Komisariat)</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px', backgroundColor: '#fff' }}>
            {masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).length === 0 ? (
               <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'center' }}>Pusat belum menetapkan materi wajib.</div>
            ) : (
              masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).map((mPusat: any) => {
                const isSudahDitarik = (listKurikulum[tabKurikulum] || []).some((m: any) => m.kode === mPusat.kode);
                return (
                  <div key={mPusat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #eee' }}>
                    <div><strong style={{ fontSize: '0.85rem' }}>{mPusat.kode}</strong><br/><span style={{ fontSize: '0.75rem', color: '#555' }}>{mPusat.nama} ({mPusat.bobot} SKS)</span></div>
                    {isSudahDitarik ? (
                      <span style={{ fontSize: '0.7rem', color: '#27ae60', fontWeight: 'bold', backgroundColor: '#e8f5e9', padding: '4px 8px', borderRadius: '4px' }}>Sudah Ditarik</span>
                    ) : (
                      <button onClick={() => handleTarikMateriPusat(mPusat)} disabled={isSavingKurikulum} style={{ backgroundColor: '#f1c40f', color: '#333', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Tarik</button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#0d1b2a', fontSize: '0.9rem' }}>➕ Tambah Muatan Lokal Rayon</h4>
          <form onSubmit={handleTambahMateriLokal} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input type="text" placeholder="Kode (Cth: ML-01)" required value={formMateri.kode} onChange={e => setFormMateri({...formMateri, kode: e.target.value})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', outline: 'none' }} />
            <input type="number" placeholder="Bobot SKS" required value={formMateri.bobot} onChange={e => setFormMateri({...formMateri, bobot: Number(e.target.value)})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', outline: 'none' }} />
            <input type="text" placeholder="Nama Materi Lokal" required value={formMateri.nama} onChange={e => setFormMateri({...formMateri, nama: e.target.value})} style={{ gridColumn: '1 / -1', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', outline: 'none' }} />
            <textarea placeholder="Deskripsi silabus..." required value={formMateri.muatan} onChange={e => setFormMateri({...formMateri, muatan: e.target.value})} style={{ gridColumn: '1 / -1', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', resize: 'vertical', outline: 'none' }} rows={2} />
            <button type="submit" disabled={isSavingKurikulum} style={{ gridColumn: '1 / -1', backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>+ Simpan Materi Lokal</button>
          </form>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '8px' }}>
        <table className="tabel-utama" style={{ minWidth: '700px' }}>
          <thead><tr><th style={{ width: '10%', textAlign: 'center' }}>Kode</th><th style={{ width: '35%' }}>Nama Materi</th><th style={{ width: '10%', textAlign: 'center' }}>SKS</th><th style={{ width: '15%', textAlign: 'center' }}>Status/Asal</th><th style={{ width: '30%', textAlign: 'center' }}>Aksi</th></tr></thead>
          <tbody>
            {(listKurikulum[tabKurikulum] || []).length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada susunan kurikulum.</td></tr>
            ) : (
              (listKurikulum[tabKurikulum] || []).map((materi: any) => {
                if (editingMateriId === materi.id) {
                  return (
                    <tr key={materi.id} style={{ backgroundColor: '#fff9e6' }}>
                      <td><input type="text" value={editMateriForm.kode} onChange={(e) => setEditMateriForm({...editMateriForm, kode: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}/></td>
                      <td>
                        <input type="text" value={editMateriForm.nama} onChange={(e) => setEditMateriForm({...editMateriForm, nama: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '4px' }}/>
                        <textarea value={editMateriForm.muatan} onChange={(e) => setEditMateriForm({...editMateriForm, muatan: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} rows={2}/>
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="number" value={editMateriForm.bobot} onChange={(e) => setEditMateriForm({...editMateriForm, bobot: Number(e.target.value)})} style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center' }}/></td>
                      <td style={{ textAlign: 'center', fontSize: '0.75rem', color: '#777' }}>{materi.isLokal ? 'Lokal Rayon' : 'Pusat Komisariat'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{display: 'flex', gap: '5px', justifyContent: 'center'}}>
                          <button onClick={() => handleSimpanEditMateri(materi.id)} style={{ color: 'white', backgroundColor: '#2ecc71', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Simpan</button>
                          <button onClick={() => setEditingMateriId(null)} style={{ color: 'white', backgroundColor: '#95a5a6', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Batal</button>
                        </div>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={materi.id}>
                    <td style={{ fontWeight: 'bold', textAlign: 'center', color: '#333' }}>{materi.kode}</td>
                    <td><div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.9rem' }}>{materi.nama}</div><div style={{ fontSize: '0.75rem', color: '#777', whiteSpace: 'pre-wrap' }}>{materi.muatan}</div></td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{materi.bobot}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ backgroundColor: materi.isLokal ? '#eaf4fc' : '#fff3cd', color: materi.isLokal ? '#0000af' : '#856404', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        {materi.isLokal ? 'Lokal Rayon' : 'Pusat Komisariat'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => { setEditingMateriId(materi.id); setEditMateriForm({ kode: materi.kode, nama: materi.nama, muatan: materi.muatan || '', bobot: materi.bobot }); }} style={{ color: '#f1c40f', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', marginRight: '10px' }} title="Edit Materi">✏️</button>
                      <button onClick={() => handleHapusMateri(materi.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }} title="Hapus">🗑️</button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}