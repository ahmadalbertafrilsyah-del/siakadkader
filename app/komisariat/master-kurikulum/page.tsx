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

  const handleSimpanEditKurikulum = async (materiId: string) => {
    try { await updateDoc(doc(db, "master_kurikulum_pusat", materiId), { ...editKurikulumForm, bobot: Number(editKurikulumForm.bobot) }); setEditingKurikulumId(null); } catch(err) {}
  };

  const handleHapusKurikulum = async (materi: any) => {
    if(window.confirm("Hapus materi ini?")) { await deleteDoc(doc(db, "master_kurikulum_pusat", materi.id)); catatLogAktivitas(`Menghapus Kurikulum Pusat: ${materi.nama}`); }
  };

  const mulaiEditKurikulum = (materi: any) => {
    setEditingKurikulumId(materi.id);
    setEditKurikulumForm({ kode: materi.kode, nama: materi.nama, muatan: materi.muatan || '', bobot: materi.bobot });
  };

  const warnaJenjang = (jenjang: string) => jenjang === 'MAPABA' ? '#1e824c' : jenjang === 'PKD' ? '#8e44ad' : '#e67e22';

  const daftarMateri = masterKurikulum
    .filter(m => m.jenjang === filterJenjangKurikulum)
    .sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' }));

  const totalBobot = daftarMateri.reduce((acc, m) => acc + (Number(m.bobot) || 0), 0);

  const daftarJenjang = ['MAPABA', 'PKD', 'SIG', 'SKP', 'NONFORMAL'];
  const labelJenjang = (j: string) => j === 'NONFORMAL' ? 'Non-Formal' : j;

  // Form tambah kurikulum (dipakai desktop & mobile)
  const renderFormTambah = (isMobile: boolean) => (
    <form onSubmit={handleTambahKurikulumPusat} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
      <div>
        <label className="mk-label">Jenjang Kaderisasi</label>
        <select required value={formKurikulum.jenjang} onChange={e => setFormKurikulum({...formKurikulum, jenjang: e.target.value})} className="form-control-custom" style={{ cursor: 'pointer' }}>
          <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
        </select>
      </div>
      <div>
        <label className="mk-label">Kode Materi</label>
        <input type="text" placeholder="Cth: MPB-01" required value={formKurikulum.kode} onChange={e => setFormKurikulum({...formKurikulum, kode: e.target.value})} className="form-control-custom" />
      </div>
      <div>
        <label className="mk-label">Bobot (SKS)</label>
        <input type="number" placeholder="SKS" required value={formKurikulum.bobot} onChange={e => setFormKurikulum({...formKurikulum, bobot: Number(e.target.value)})} className="form-control-custom" />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label className="mk-label">Nama Materi Besar</label>
        <input type="text" placeholder="Misal: Sejarah PMII" required value={formKurikulum.nama} onChange={e => setFormKurikulum({...formKurikulum, nama: e.target.value})} className="form-control-custom" />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label className="mk-label">Muatan / Sub Pembahasan</label>
        <textarea rows={2} placeholder="Detail silabus..." value={formKurikulum.muatan} onChange={e => setFormKurikulum({...formKurikulum, muatan: e.target.value})} className="form-control-custom" style={{ resize: 'vertical' }} />
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
        <button type="submit" className="btn-main" style={{ width: isMobile ? '100%' : 'auto' }}>+ Simpan Kurikulum Standar</button>
      </div>
    </form>
  );

  return (
    <>
      <style>{`
        .mk-wrapper { display: flex; flex-direction: column; gap: 20px; box-sizing: border-box; width: 100%; }

        .mk-card {
          background: #ffffff; border-radius: 12px; border: 1px solid #eaeaea;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02); box-sizing: border-box;
        }

        .mk-label { font-size: 0.72rem; font-weight: 700; color: #7a8699; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.02em; }

        .form-control-custom {
          width: 100%; padding: 10px 14px; border: 1px solid #e3e6ec; background-color: #ffffff;
          border-radius: 8px; font-size: 0.85rem; outline: none; color: #0f1b2e;
          transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; font-family: inherit;
        }
        .form-control-custom:focus { border-color: #28395a; box-shadow: 0 0 0 3px rgba(40, 57, 90, 0.08); }

        .btn-main {
          background-color: #0f1b2e; color: #ffffff; border: none; padding: 11px 20px;
          border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.82rem;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          transition: background-color 0.2s;
        }
        .btn-main:hover { background-color: #28395a; }

        .mk-tabs { display: flex; gap: 6px; background-color: #f0f2f5; padding: 4px; border-radius: 10px; overflow-x: auto; }
        .mk-tab {
          padding: 8px 14px; border-radius: 8px; border: none; background: transparent; color: #7a8699;
          font-weight: 700; font-size: 0.76rem; cursor: pointer; transition: all 0.25s; white-space: nowrap;
        }
        .mk-tab.active { background-color: #0f1b2e; color: #f5c518; box-shadow: 0 2px 6px rgba(15,27,46,0.18); }

        .mk-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .mk-table th {
          background-color: #f6f7fa; color: #0f1b2e; padding: 13px 16px; font-weight: 700;
          font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.02em;
          border-bottom: 1px solid #eaeaea; white-space: nowrap;
        }
        .mk-table td { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }

        .mk-icon-btn { border: none; background: none; cursor: pointer; font-weight: 700; font-size: 1.1rem; padding: 2px 6px; }

        .btn-mini-save { color: #fff; background-color: #27ae60; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.75rem; }
        .btn-mini-cancel { color: #fff; background-color: #95a5a6; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.75rem; }

        .mk-mcard {
          background: #ffffff; border: 1px solid #eaeaea; border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02); padding: 14px;
        }
        .mk-mcard.editing { border-color: #f5c518; background: #fffdf3; }

        .desktop-view { display: block; }
        .mobile-view { display: none; }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
          .desktop-view { display: none !important; }
          .mobile-view { display: block !important; }
        }
      `}</style>

      {/* ========================================================== */}
      {/* TAMPILAN DESKTOP                                           */}
      {/* ========================================================== */}
      <div className="desktop-view mk-wrapper">

        {/* Header Halaman */}
        <div className="mk-card" style={{ padding: '22px 26px', borderTop: '3px solid #f5c518' }}>
          <h3 style={{ color: '#0f1b2e', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>📑 Master Kurikulum Kaderisasi</h3>
          <p style={{ fontSize: '0.82rem', color: '#7a8699', margin: '6px 0 0 0' }}>Susun standar kurikulum yang komprehensif sebagai acuan seluruh Rayon se-UIN Malang.</p>
        </div>

        {/* Form Tambah */}
        <div className="mk-card" style={{ padding: '24px 26px' }}>
          <h4 style={{ margin: '0 0 18px 0', color: '#0f1b2e', fontSize: '0.95rem', fontWeight: 700, borderBottom: '1px solid #f3f4f6', paddingBottom: '14px' }}>➕ Tambah Standar Kurikulum</h4>
          {renderFormTambah(false)}
        </div>

        {/* Daftar Kurikulum */}
        <div className="mk-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fbfbfd', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="mk-tabs hide-scroll">
              {daftarJenjang.map(j => (
                <button key={j} type="button" onClick={() => setFilterJenjangKurikulum(j)} className={`mk-tab ${filterJenjangKurikulum === j ? 'active' : ''}`}>{labelJenjang(j)}</button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#7a8699', fontWeight: 700 }}>
              {daftarMateri.length} materi &middot; Total bobot {totalBobot} SKS
            </div>
          </div>

          <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
            <table className="mk-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: '10%' }}>Jenjang</th>
                  <th style={{ textAlign: 'center', width: '15%' }}>Kode</th>
                  <th style={{ width: '60%' }}>Nama Materi &amp; Muatan</th>
                  <th style={{ textAlign: 'center', width: '5%' }}>Bobot</th>
                  <th style={{ textAlign: 'center', width: '10%' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftarMateri.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '45px', textAlign: 'center', color: '#9aa3b2' }}>Belum ada materi pada jenjang ini.</td></tr>
                ) : daftarMateri.map((materi) => {
                  if (editingKurikulumId === materi.id) {
                    return (
                      <tr key={materi.id} style={{ backgroundColor: '#fffdf3' }}>
                        <td style={{ fontWeight: 700, color: warnaJenjang(materi.jenjang), textAlign: 'center' }}>{materi.jenjang}</td>
                        <td><input type="text" value={editKurikulumForm.kode} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, kode: e.target.value})} className="form-control-custom" style={{ padding: '7px 10px' }}/></td>
                        <td>
                          <input type="text" value={editKurikulumForm.nama} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, nama: e.target.value})} className="form-control-custom" style={{ padding: '7px 10px', marginBottom: '6px' }}/>
                          <textarea value={editKurikulumForm.muatan} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, muatan: e.target.value})} className="form-control-custom" style={{ padding: '7px 10px', resize: 'vertical' }} rows={2}/>
                        </td>
                        <td style={{ textAlign: 'center' }}><input type="number" value={editKurikulumForm.bobot} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, bobot: Number(e.target.value)})} className="form-control-custom" style={{ width: '64px', padding: '7px 6px', textAlign: 'center' }}/></td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{display: 'flex', gap: '6px', justifyContent: 'center'}}>
                            <button onClick={() => handleSimpanEditKurikulum(materi.id)} className="btn-mini-save">Simpan</button>
                            <button onClick={() => setEditingKurikulumId(null)} className="btn-mini-cancel">Batal</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={materi.id}>
                      <td style={{ fontWeight: 700, textAlign: 'center', color: warnaJenjang(materi.jenjang) }}>{materi.jenjang}</td>
                      <td style={{ color: '#28395a', fontWeight: 700, textAlign: 'center' }}>{materi.kode}</td>
                      <td>
                        <div style={{ color: '#0f1b2e', fontWeight: 700, marginBottom: '3px', fontSize: '0.88rem' }}>{materi.nama}</div>
                        <div style={{ color: '#9aa3b2', fontSize: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{materi.muatan || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', backgroundColor: '#fff8e1', color: '#8a6d00', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800 }}>{materi.bobot}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => mulaiEditKurikulum(materi)} className="mk-icon-btn" style={{ color: '#28395a', marginRight: '6px' }} title="Edit">✏️</button>
                        <button onClick={() => handleHapusKurikulum(materi)} className="mk-icon-btn" style={{ color: '#e74c3c' }} title="Hapus">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* TAMPILAN MOBILE                                            */}
      {/* ========================================================== */}
      <div className="mobile-view">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div className="mk-card" style={{ padding: '16px', borderTop: '3px solid #f5c518' }}>
            <h3 style={{ color: '#0f1b2e', margin: 0, fontSize: '1rem', fontWeight: 800 }}>📑 Master Kurikulum</h3>
            <p style={{ fontSize: '0.75rem', color: '#7a8699', margin: '6px 0 0 0', lineHeight: 1.5 }}>Standar kurikulum acuan seluruh Rayon se-UIN Malang.</p>
          </div>

          <div className="mk-card" style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 14px 0', color: '#0f1b2e', fontSize: '0.88rem', fontWeight: 800, borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>➕ Tambah Standar Kurikulum</h4>
            {renderFormTambah(true)}
          </div>

          <div className="mk-tabs hide-scroll">
            {daftarJenjang.map(j => (
              <button key={j} type="button" onClick={() => setFilterJenjangKurikulum(j)} className={`mk-tab ${filterJenjangKurikulum === j ? 'active' : ''}`}>{labelJenjang(j)}</button>
            ))}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#7a8699', fontWeight: 700, padding: '0 2px' }}>
            {daftarMateri.length} materi &middot; Total bobot {totalBobot} SKS
          </div>

          {daftarMateri.length === 0 ? (
            <div className="mk-card" style={{ padding: '32px 16px', textAlign: 'center', color: '#9aa3b2', fontSize: '0.85rem' }}>Belum ada materi pada jenjang ini.</div>
          ) : daftarMateri.map((materi) => {
            if (editingKurikulumId === materi.id) {
              return (
                <div key={materi.id} className="mk-mcard editing" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: warnaJenjang(materi.jenjang) }}>{materi.jenjang}</div>
                  <div>
                    <label className="mk-label">Kode Materi</label>
                    <input type="text" value={editKurikulumForm.kode} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, kode: e.target.value})} className="form-control-custom" />
                  </div>
                  <div>
                    <label className="mk-label">Nama Materi</label>
                    <input type="text" value={editKurikulumForm.nama} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, nama: e.target.value})} className="form-control-custom" />
                  </div>
                  <div>
                    <label className="mk-label">Muatan</label>
                    <textarea value={editKurikulumForm.muatan} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, muatan: e.target.value})} className="form-control-custom" style={{ resize: 'vertical' }} rows={3}/>
                  </div>
                  <div>
                    <label className="mk-label">Bobot (SKS)</label>
                    <input type="number" value={editKurikulumForm.bobot} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, bobot: Number(e.target.value)})} className="form-control-custom" />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleSimpanEditKurikulum(materi.id)} className="btn-mini-save" style={{ flex: 1, padding: '10px' }}>Simpan</button>
                    <button onClick={() => setEditingKurikulumId(null)} className="btn-mini-cancel" style={{ flex: 1, padding: '10px' }}>Batal</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={materi.id} className="mk-mcard">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: warnaJenjang(materi.jenjang) }}>{materi.jenjang} &middot; {materi.kode}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f1b2e', marginTop: '3px' }}>{materi.nama}</div>
                  </div>
                  <span style={{ display: 'inline-flex', backgroundColor: '#fff8e1', color: '#8a6d00', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{materi.bobot} SKS</span>
                </div>
                <div style={{ color: '#9aa3b2', fontSize: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: '8px' }}>{materi.muatan || '-'}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
                  <button onClick={() => mulaiEditKurikulum(materi)} style={{ flex: 1, backgroundColor: '#f5c518', color: '#0f1b2e', border: '1px solid #e3b300', padding: '9px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>✏️ Edit</button>
                  <button onClick={() => handleHapusKurikulum(materi)} style={{ flex: 1, backgroundColor: '#fef2f2', color: '#c0392b', border: '1px solid #fadbd8', padding: '9px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>🗑️ Hapus</button>
                </div>
              </div>
            );
          })}

          <div style={{ height: '80px' }}></div>
        </div>
      </div>
    </>
  );
}
