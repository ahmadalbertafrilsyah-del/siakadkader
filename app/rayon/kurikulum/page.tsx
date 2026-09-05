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
    <>
      <style>{`
        :root {
          --text-main: #111827;
          --text-body: #374151;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
          --bg-card: #ffffff;
        }

        .page-wrapper { 
          display: flex; 
          flex-direction: column; 
          gap: 32px; 
          box-sizing: border-box; 
          width: 100%; 
        }
        
        .header-card { 
          background: var(--bg-card); 
          padding: 28px 32px; 
          border-radius: 8px; 
          border: 1px solid var(--border-color); 
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); 
        }

        .card-panel {
          background: var(--bg-card);
          padding: 28px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
        }

        .form-control-custom {
          width: 100%; padding: 12px 16px; border: 1px solid var(--border-color); 
          background-color: #ffffff; border-radius: 6px; font-size: 0.9rem; outline: none; 
          color: var(--text-main); transition: border-color 0.2s; box-sizing: border-box;
          font-family: inherit;
        }
        .form-control-custom:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }

        .btn-main {
          background-color: #2563eb; color: white; border: none; padding: 12px 24px;
          border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;
          transition: background-color 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn-main:hover { background-color: #1d4ed8; }

        .btn-tab {
          padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;
          transition: all 0.2s; border: 1px solid var(--border-color); background-color: #f8fafc; color: var(--text-muted);
        }
        .btn-tab.active { background-color: #2563eb; color: white; border-color: #2563eb; }

        .desktop-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .desktop-table th { background-color: #f8fafc; color: var(--text-main); padding: 14px 18px; font-weight: 600; border-bottom: 1px solid var(--border-color); }
        .desktop-table td { padding: 16px 18px; border-bottom: 1px solid #f3f4f6; color: var(--text-body); background-color: #fff; vertical-align: middle; }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
           .page-wrapper { gap: 20px; padding: 24px 16px 90px 16px !important; }
           .header-card { padding: 20px; }
           .card-panel { padding: 20px; }
           .btn-tab { padding: 8px 16px; }
        }
      `}</style>

      <div className="page-wrapper">
        
        {/* HEADER */}
        <div className="header-card">
          <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: '700' }}>📚 Kurikulum Kaderisasi</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tarik materi wajib dari Komisariat atau tambahkan muatan lokal khusus Rayon.</p>
        </div>

        {/* TABS */}
        <div className="hide-scroll" style={{ display: 'flex', gap: '10px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {['MAPABA', 'PKD', 'SIG', 'NONFORMAL'].map(tab => (
            <button key={tab} onClick={() => setTabKurikulum(tab)} className={`btn-tab ${tabKurikulum === tab ? 'active' : ''}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* BUNGKUSAN GRID (TARIK MATERI & TAMBAH LOKAL) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* KOLOM TARIK MATERI PUSAT */}
          <div className="card-panel">
            <h4 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: '600' }}>📥 Tarik Materi Wajib (Pusat)</h4>
            <div className="hide-scroll" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', backgroundColor: '#f9fafb', flex: 1 }}>
              {masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).length === 0 ? (
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>Pusat belum menetapkan materi wajib.</div>
              ) : (
                masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).map((mPusat: any) => {
                  const isSudahDitarik = (listKurikulum[tabKurikulum] || []).some((m: any) => m.kode === mPusat.kode);
                  return (
                    <div key={mPusat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px dashed #e5e7eb' }}>
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>{mPusat.kode}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>{mPusat.nama} ({mPusat.bobot} SKS)</span>
                      </div>
                      {isSudahDitarik ? (
                        <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: '600', backgroundColor: '#f0fdf4', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dcfce7' }}>Tersedia</span>
                      ) : (
                        <button onClick={() => handleTarikMateriPusat(mPusat)} disabled={isSavingKurikulum} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>Tarik</button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* KOLOM TAMBAH MUATAN LOKAL */}
          <div className="card-panel">
            <h4 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: '600' }}>➕ Tambah Muatan Lokal Rayon</h4>
            <form onSubmit={handleTambahMateriLokal} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Kode Materi</label>
                  <input type="text" placeholder="Cth: ML-01" required value={formMateri.kode} onChange={e => setFormMateri({...formMateri, kode: e.target.value})} className="form-control-custom" />
                </div>
                <div style={{ width: '90px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>SKS</label>
                  <input type="number" placeholder="SKS" required value={formMateri.bobot} onChange={e => setFormMateri({...formMateri, bobot: Number(e.target.value)})} className="form-control-custom" />
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Nama Materi Lokal</label>
                <input type="text" placeholder="Masukkan nama materi lokal..." required value={formMateri.nama} onChange={e => setFormMateri({...formMateri, nama: e.target.value})} className="form-control-custom" />
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Deskripsi Muatan</label>
                <textarea placeholder="Penjelasan singkat terkait materi ini..." required value={formMateri.muatan} onChange={e => setFormMateri({...formMateri, muatan: e.target.value})} className="form-control-custom" rows={3} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ flex: 1 }}></div> {/* Spacer */}
              
              <button type="submit" disabled={isSavingKurikulum} className="btn-main" style={{ backgroundColor: '#16a34a', height: '46px', marginTop: '10px' }}>
                {isSavingKurikulum ? 'Menyimpan...' : 'Simpan Materi Lokal'}
              </button>
            </form>
          </div>

        </div>

        {/* TABEL DATA KURIKULUM */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table className="desktop-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={{ width: '15%', textAlign: 'center' }}>Kode</th>
                  <th style={{ width: '35%', textAlign: 'left' }}>Nama Materi</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>SKS</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Asal Materi</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(listKurikulum[tabKurikulum] || []).length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada susunan kurikulum di jenjang ini.</td></tr>
                ) : (
                  (listKurikulum[tabKurikulum] || []).map((materi: any) => {
                    if (editingMateriId === materi.id) {
                      return (
                        <tr key={materi.id} style={{ backgroundColor: '#fffbeb' }}>
                          <td style={{ padding: '16px' }}><input type="text" value={editMateriForm.kode} onChange={(e) => setEditMateriForm({...editMateriForm, kode: e.target.value})} className="form-control-custom" style={{ padding: '8px 12px' }}/></td>
                          <td style={{ padding: '16px' }}>
                            <input type="text" value={editMateriForm.nama} onChange={(e) => setEditMateriForm({...editMateriForm, nama: e.target.value})} className="form-control-custom" style={{ marginBottom: '8px', padding: '8px 12px' }}/>
                            <textarea value={editMateriForm.muatan} onChange={(e) => setEditMateriForm({...editMateriForm, muatan: e.target.value})} className="form-control-custom" rows={2} style={{ padding: '8px 12px', resize: 'vertical' }}/>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center' }}><input type="number" value={editMateriForm.bobot} onChange={(e) => setEditMateriForm({...editMateriForm, bobot: Number(e.target.value)})} className="form-control-custom" style={{ padding: '8px 12px', textAlign: 'center' }}/></td>
                          <td style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{materi.isLokal ? 'Lokal Rayon' : 'Pengurus Komisariat'}</td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                              <button onClick={() => handleSimpanEditMateri(materi.id)} style={{ color: 'white', backgroundColor: '#16a34a', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem' }}>Simpan</button>
                              <button onClick={() => setEditingMateriId(null)} style={{ color: 'var(--text-main)', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem' }}>Batal</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={materi.id}>
                        <td style={{ fontWeight: '600', textAlign: 'center', color: 'var(--text-main)' }}>{materi.kode}</td>
                        <td>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '4px' }}>{materi.nama}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{materi.muatan || '-'}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-main)' }}>{materi.bobot}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ backgroundColor: materi.isLokal ? '#eff6ff' : '#fffbeb', color: materi.isLokal ? '#1d4ed8' : '#b45309', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${materi.isLokal ? '#dbeafe' : '#fef3c7'}`, fontSize: '0.75rem', fontWeight: '600' }}>
                            {materi.isLokal ? 'Lokal Rayon' : 'Pengurus Komisariat'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => { setEditingMateriId(materi.id); setEditMateriForm({ kode: materi.kode, nama: materi.nama, muatan: materi.muatan || '', bobot: materi.bobot }); }} style={{ color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem' }}>Edit</button>
                            <button onClick={() => handleHapusMateri(materi.id)} style={{ color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem' }}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </>
  );
}