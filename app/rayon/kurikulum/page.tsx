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
    <div className="page-container">
      <style>{`
        /* PADDING 15PX UNTUK HP SESUAI REQUEST */
        .page-container { padding: 15px; padding-bottom: 90px; }
        
        .card-panel { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); margin-bottom: 20px; border: 1px solid #eaeaea; }
        .flex-row-wrap { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
        .flex-half { flex: 1 1 300px; }

        @media (min-width: 768px) { 
          /* Hilangkan padding container di Desktop karena sudah di-handle oleh layout.tsx */
          .page-container { padding: 0; padding-bottom: 0; } 
          .card-panel { padding: 25px; border-radius: 8px; }
        }
      `}</style>

      <div className="card-panel" style={{ borderBottom: '2px solid #eee', paddingBottom: '15px' }}>
        <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>📚 Kurikulum Kaderisasi</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Tarik materi wajib dari Komisariat atau tambahkan muatan lokal khusus Rayon.</p>
      </div>

      <div className="hide-scroll" style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '5px' }}>
        {['MAPABA', 'PKD', 'SIG', 'NONFORMAL'].map(tab => (
          <button key={tab} onClick={() => setTabKurikulum(tab)} style={{ padding: '8px 18px', border: 'none', background: tabKurikulum === tab ? '#0000af' : '#fff', color: tabKurikulum === tab ? '#f1c40f' : '#555', fontWeight: 'bold', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: '0.2s' }}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-row-wrap">
        <div className="card-panel flex-half">
          <h4 style={{ margin: '0 0 15px 0', color: '#1e824c', fontSize: '0.95rem', fontWeight: 'bold' }}>📥 Tarik Materi Wajib (Pusat)</h4>
          <div className="hide-scroll" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '8px', backgroundColor: '#fafafa' }}>
            {masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).length === 0 ? (
               <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'center' }}>Pusat belum menetapkan materi wajib.</div>
            ) : (
              masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).map((mPusat: any) => {
                const isSudahDitarik = (listKurikulum[tabKurikulum] || []).some((m: any) => m.kode === mPusat.kode);
                return (
                  <div key={mPusat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #eee' }}>
                    <div style={{ flex: 1, paddingRight: '10px' }}><strong style={{ fontSize: '0.85rem', color: '#0d1b2a' }}>{mPusat.kode}</strong><br/><span style={{ fontSize: '0.75rem', color: '#555' }}>{mPusat.nama} ({mPusat.bobot} SKS)</span></div>
                    {isSudahDitarik ? (
                      <span style={{ fontSize: '0.7rem', color: '#27ae60', fontWeight: 'bold', backgroundColor: '#e8f5e9', padding: '4px 8px', borderRadius: '6px' }}>Sudah Ditarik</span>
                    ) : (
                      <button onClick={() => handleTarikMateriPusat(mPusat)} disabled={isSavingKurikulum} style={{ backgroundColor: '#0000af', color: '#f1c40f', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Tarik</button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="card-panel flex-half">
          <h4 style={{ margin: '0 0 15px 0', color: '#0d1b2a', fontSize: '0.95rem', fontWeight: 'bold' }}>➕ Tambah Muatan Lokal Rayon</h4>
          <form onSubmit={handleTambahMateriLokal} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="Kode (ML-01)" required value={formMateri.kode} onChange={e => setFormMateri({...formMateri, kode: e.target.value})} style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
              <input type="number" placeholder="SKS" required value={formMateri.bobot} onChange={e => setFormMateri({...formMateri, bobot: Number(e.target.value)})} style={{ width: '80px', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
            </div>
            <input type="text" placeholder="Nama Materi Lokal" required value={formMateri.nama} onChange={e => setFormMateri({...formMateri, nama: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
            <textarea placeholder="Deskripsi silabus..." required value={formMateri.muatan} onChange={e => setFormMateri({...formMateri, muatan: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', resize: 'vertical', outline: 'none' }} rows={2} />
            <button type="submit" disabled={isSavingKurikulum} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', marginTop: '5px' }}>Simpan Materi Lokal</button>
          </form>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden' }}>
        <table className="tabel-utama" style={{ minWidth: '700px' }}>
          <thead>
            <tr>
              <th style={{ width: '10%', textAlign: 'center' }}>Kode</th>
              <th style={{ width: '35%', textAlign: 'left' }}>Nama Materi</th>
              <th style={{ width: '10%', textAlign: 'center' }}>SKS</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Status/Asal</th>
              <th style={{ width: '30%', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(listKurikulum[tabKurikulum] || []).length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Belum ada susunan kurikulum.</td></tr>
            ) : (
              (listKurikulum[tabKurikulum] || []).map((materi: any) => {
                if (editingMateriId === materi.id) {
                  return (
                    <tr key={materi.id} style={{ backgroundColor: '#fff9e6' }}>
                      <td style={{ padding: '10px' }}><input type="text" value={editMateriForm.kode} onChange={(e) => setEditMateriForm({...editMateriForm, kode: e.target.value})} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }}/></td>
                      <td style={{ padding: '10px' }}>
                        <input type="text" value={editMateriForm.nama} onChange={(e) => setEditMateriForm({...editMateriForm, nama: e.target.value})} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '6px', outline: 'none' }}/>
                        <textarea value={editMateriForm.muatan} onChange={(e) => setEditMateriForm({...editMateriForm, muatan: e.target.value})} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }} rows={2}/>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}><input type="number" value={editMateriForm.bobot} onChange={(e) => setEditMateriForm({...editMateriForm, bobot: Number(e.target.value)})} style={{ width: '60px', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', textAlign: 'center', outline: 'none' }}/></td>
                      <td style={{ padding: '10px', textAlign: 'center', fontSize: '0.75rem', color: '#777' }}>{materi.isLokal ? 'Lokal Rayon' : 'Pusat Komisariat'}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                          <button onClick={() => handleSimpanEditMateri(materi.id)} style={{ color: 'white', backgroundColor: '#2ecc71', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Simpan</button>
                          <button onClick={() => setEditingMateriId(null)} style={{ color: 'white', backgroundColor: '#e74c3c', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Batal</button>
                        </div>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={materi.id}>
                    <td style={{ fontWeight: 'bold', textAlign: 'center', color: '#333' }}>{materi.kode}</td>
                    <td><div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.9rem' }}>{materi.nama}</div><div style={{ fontSize: '0.75rem', color: '#777', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{materi.muatan || '-'}</div></td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{materi.bobot}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ backgroundColor: materi.isLokal ? '#eaf4fc' : '#fff3cd', color: materi.isLokal ? '#0000af' : '#856404', padding: '4px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        {materi.isLokal ? 'Lokal Rayon' : 'Pusat Komisariat'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => { setEditingMateriId(materi.id); setEditMateriForm({ kode: materi.kode, nama: materi.nama, muatan: materi.muatan || '', bobot: materi.bobot }); }} style={{ color: '#0d1b2a', backgroundColor: '#f1c40f', border: 'none', padding: '6px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', marginRight: '8px' }}>Edit</button>
                      <button onClick={() => handleHapusMateri(materi.id)} style={{ color: '#e74c3c', backgroundColor: '#fff0f0', border: '1px solid #fadbd8', padding: '6px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Hapus</button>
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