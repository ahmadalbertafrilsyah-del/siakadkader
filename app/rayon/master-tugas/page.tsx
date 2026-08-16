'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageMasterTugas() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [formTugas, setFormTugas] = useState({ nama_tugas: '', deadline: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(snapRole.docs[0].data().nama || currentRayonId);
            
            onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", currentRayonId)), (snap: any) => {
              const list: any[] = [];
              snap.forEach((doc: any) => list.push({ id: doc.id, ...doc.data() }));
              list.sort((a, b) => b.timestamp - a.timestamp);
              setListMasterTugas(list);
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

  const handleTambahTugas = async (e: React.FormEvent) => { 
    e.preventDefault(); setIsSubmitting(true);
    try { 
      await addDoc(collection(db, "master_tugas"), { id_rayon: adminRayonId, nama_tugas: formTugas.nama_tugas, deadline: formTugas.deadline, timestamp: Date.now() }); 
      catatLogAktivitas(`Membuat tugas baru: ${formTugas.nama_tugas}`); 
      setFormTugas({ nama_tugas: '', deadline: '' }); 
    } catch (error) { alert("Gagal menyimpan tugas."); } finally { setIsSubmitting(false); }
  };

  const handleHapusTugas = async (idTugas: string, namaTugas: string) => { 
    if(window.confirm(`Hapus tugas "${namaTugas}"?`)) {
      await deleteDoc(doc(db, "master_tugas", idTugas)); 
      catatLogAktivitas(`Menghapus tugas: ${namaTugas}`);
    }
  };

  return (
    <>
      <style>{`
        /* TOGGLE DESKTOP & MOBILE */
        .desktop-view { display: block; }
        .mobile-view { display: none; }
        
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: flex !important; flex-direction: column; gap: 15px; padding: 15px !important; }
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* ============================================== */}
      {/* 1. DESKTOP VIEW                                */}
      {/* ============================================== */}
      <div className="desktop-view">
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
          <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
            <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>📋 Manajemen Tugas Rayon</h3>
            <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Daftarkan judul tugas dan deadline agar Kader dapat mengupload file tugas mereka.</p>
          </div>

          <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '8px', marginBottom: '25px' }}>
            <form onSubmit={handleTambahTugas} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Judul Tugas / Berkas</label>
                <input type="text" placeholder="Misal: Makalah Sejarah PMII" required value={formTugas.nama_tugas} onChange={e => setFormTugas({...formTugas, nama_tugas: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Batas Waktu (Deadline)</label>
                <input type="date" required value={formTugas.deadline} onChange={e => setFormTugas({...formTugas, deadline: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} />
              </div>
              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '40px', fontSize: '0.85rem' }}>+ Buat Tugas</button>
            </form>
          </div>

          <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="tabel-utama" style={{ minWidth: '600px', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '5%', textAlign: 'center' }}>No</th>
                  <th style={{ width: '50%', textAlign: 'left' }}>Nama Tugas Tersedia</th>
                  <th style={{ width: '25%', textAlign: 'center' }}>Deadline</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {listMasterTugas.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada tugas yang dibuat.</td></tr>
                ) : (
                  listMasterTugas.map((tugas, idx) => (
                    <tr key={tugas.id}>
                      <td style={{ textAlign: 'center', color: '#555' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.9rem' }}>{tugas.nama_tugas}</td>
                      <td style={{ textAlign: 'center', color: '#e74c3c', fontWeight: 'bold', fontSize: '0.85rem' }}>{tugas.deadline}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => handleHapusTugas(tugas.id, tugas.nama_tugas)} style={{ color: 'white', backgroundColor: '#e74c3c', border: 'none', padding: '6px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }} title="Hapus Tugas">Hapus</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================== */}
      {/* 2. MOBILE VIEW                                 */}
      {/* ============================================== */}
      <div className="mobile-view">
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#0000af', fontSize: '1rem' }}>➕ Tambah Tugas Baru</h4>
          <form onSubmit={handleTambahTugas} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" placeholder="Judul Tugas (Misal: Makalah Sejarah)" required value={formTugas.nama_tugas} onChange={e => setFormTugas({...formTugas, nama_tugas: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
            <input type="date" required value={formTugas.deadline} onChange={e => setFormTugas({...formTugas, deadline: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }} />
            <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '5px' }}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Tugas'}
            </button>
          </form>
        </div>

        <h4 style={{ margin: '5px 0 0 0', color: '#555', fontSize: '0.9rem', fontWeight: 'bold' }}>Daftar Tugas Aktif</h4>
        
        {/* TABEL DATA TUGAS MOBILE */}
        <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <table className="tabel-utama" style={{ minWidth: '450px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Nama Tugas</th>
                <th style={{ textAlign: 'center', width: '25%' }}>Deadline</th>
                <th style={{ textAlign: 'center', width: '20%' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listMasterTugas.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Belum ada tugas yang dibuat.</td></tr>
              ) : (
                listMasterTugas.map((tugas) => (
                  <tr key={tugas.id}>
                    <td>
                      <div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.85rem' }}>{tugas.nama_tugas}</div>
                    </td>
                    <td style={{ textAlign: 'center', color: '#e74c3c', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      {tugas.deadline}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => handleHapusTugas(tugas.id, tugas.nama_tugas)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ height: '80px' }}></div>
      </div>
    </>
  );
}