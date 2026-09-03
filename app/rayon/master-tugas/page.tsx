'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageMasterTugasRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [berkasKaderRayon, setBerkasKaderRayon] = useState<any[]>([]);
  const [tabAktif, setTabAktif] = useState<'tugas' | 'verifikasi'>('tugas');

  const [formTugas, setFormTugas] = useState({ nama_tugas: '', deadline: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const rayonData = snapRole.docs[0].data();
            const currentRayonId = rayonData.username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(rayonData.nama || currentRayonId);
            
            // 1. Ambil Master Tugas Rayon
            const unsubTugas = onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", currentRayonId)), (snap: any) => {
              const list: any[] = [];
              snap.forEach((doc: any) => list.push({ id: doc.id, ...doc.data() }));
              list.sort((a, b) => b.timestamp - a.timestamp);
              setListMasterTugas(list);
            });
            unsubs.push(unsubTugas);

            // 2. Ambil data kader yang terdaftar di Rayon ini untuk verifikasi tugas
            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const emailKaderRayon: string[] = [];
            
            snapKader.forEach(d => {
              const data = d.data();
              const terdaftarDi = data.terdaftar_di || [data.id_rayon];
              if (terdaftarDi.includes(currentRayonId)) {
                emailKaderRayon.push(data.email);
              }
            });

            // 3. Ambil Berkas Tugas Kader Berdasarkan Email
            if (emailKaderRayon.length > 0) {
              const unsubBerkas = onSnapshot(collection(db, "berkas_kader"), (snap) => {
                const listBerkas: any[] = [];
                snap.forEach(doc => {
                  const d = doc.id ? { id: doc.id, ...doc.data() } : doc.data();
                  if (emailKaderRayon.includes((d as any).email_kader)) {
                    listBerkas.push(d);
                  }
                });
                listBerkas.sort((a, b) => b.timestamp - a.timestamp);
                setBerkasKaderRayon(listBerkas);
              });
              unsubs.push(unsubBerkas);
            }
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(u => u());
    };
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
      await addDoc(collection(db, "master_tugas"), { 
        id_rayon: adminRayonId, 
        nama_tugas: formTugas.nama_tugas, 
        deadline: formTugas.deadline, 
        timestamp: Date.now() 
      }); 
      catatLogAktivitas(`Membuat tugas baru: ${formTugas.nama_tugas}`); 
      alert("Tugas berhasil dibuat!");
      setFormTugas({ nama_tugas: '', deadline: '' }); 
    } catch (error) { 
      alert("Gagal menyimpan tugas."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleHapusTugas = async (idTugas: string, namaTugas: string) => { 
    if(window.confirm(`Hapus tugas "${namaTugas}"?`)) {
      await deleteDoc(doc(db, "master_tugas", idTugas)); 
      catatLogAktivitas(`Menghapus tugas: ${namaTugas}`);
    }
  };

  const handleVerifikasiTugas = async (idBerkas: string, namaKader: string) => {
    try {
      await updateDoc(doc(db, "berkas_kader", idBerkas), { status: 'Selesai' });
      catatLogAktivitas(`Memverifikasi (ACC) tugas kader: ${namaKader}`);
      alert("Tugas berhasil diverifikasi (ACC)!");
    } catch (error) {
      alert("Gagal memverifikasi tugas.");
    }
  };

  return (
    <>
      <style>{`
        .page-wrapper { display: flex; flex-direction: column; gap: 20px; }
        .header-card { background: white; padding: 25px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .form-card { background: #fdfdfd; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; margin-bottom: 25px; }
        
        .modern-tab-container { display: flex; background-color: #f0f2f5; padding: 6px; border-radius: 8px; width: fit-content; margin-bottom: 20px; }
        .modern-tab { padding: 10px 20px; border-radius: 6px; border: none; background: transparent; color: #777; font-weight: bold; font-size: 0.85rem; cursor: pointer; transition: all 0.3s; white-space: nowrap; }
        .modern-tab.active { background-color: #0000af; color: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
           .page-wrapper { padding: 15px; }
           .header-card, .form-card { padding: 20px; }
           .modern-tab-container { width: 100%; overflow-x: auto; background-color: #fff; border: 1px solid #eaeaea; border-radius: 12px; padding: 6px; }
        }
      `}</style>

      <div className="page-wrapper">
        
        {/* HEADER */}
        <div className="header-card">
          <h3 style={{ color: '#0d1b2a', margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>📋 Manajemen & Verifikasi Tugas Rayon</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', margin: 0 }}>Buat instruksi tugas baru atau periksa dan verifikasi tugas yang telah dikumpulkan oleh kader.</p>
        </div>

        {/* TAB NAVIGASI */}
        <div className="modern-tab-container hide-scroll">
           <button onClick={() => setTabAktif('tugas')} className={`modern-tab ${tabAktif === 'tugas' ? 'active' : ''}`}>Daftar Master Tugas</button>
           <button onClick={() => setTabAktif('verifikasi')} className={`modern-tab ${tabAktif === 'verifikasi' ? 'active' : ''}`}>
             Verifikasi Tugas Kader {berkasKaderRayon.filter(b => b.status === 'Menunggu Verifikasi').length > 0 && `(${berkasKaderRayon.filter(b => b.status === 'Menunggu Verifikasi').length})`}
           </button>
        </div>

        {/* TAB 1: MASTER TUGAS */}
        {tabAktif === 'tugas' && (
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            
            <div className="form-card">
              <form onSubmit={handleTambahTugas} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 250px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Judul Tugas / Berkas</label>
                  <input type="text" placeholder="Misal: Makalah Sejarah PMII" required value={formTugas.nama_tugas} onChange={e => setFormTugas({...formTugas, nama_tugas: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Batas Waktu (Deadline)</label>
                  <input type="date" required value={formTugas.deadline} onChange={e => setFormTugas({...formTugas, deadline: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} />
                </div>
                <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '11px 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', transition: '0.2s' }}>
                  {isSubmitting ? 'Menyimpan...' : '+ Buat Tugas'}
                </button>
              </form>
            </div>

            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', backgroundColor: '#fff' }}>
              <table style={{ minWidth: '600px', width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f0f4f8', color: '#555' }}>
                  <tr>
                    <th style={{ padding: '12px 15px', borderRadius: '10px 0 0 0', width: '5%', textAlign: 'center' }}>No</th>
                    <th style={{ padding: '12px 15px', width: '55%' }}>Nama Tugas Tersedia</th>
                    <th style={{ padding: '12px 15px', width: '25%', textAlign: 'center' }}>Deadline</th>
                    <th style={{ padding: '12px 15px', borderRadius: '0 10px 0 0', width: '15%', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {listMasterTugas.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Belum ada tugas yang dibuat.</td></tr>
                  ) : (
                    listMasterTugas.map((tugas, idx) => (
                      <tr key={tugas.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ textAlign: 'center', color: '#777', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold', color: '#0d1b2a', padding: '15px' }}>{tugas.nama_tugas}</td>
                        <td style={{ textAlign: 'center', color: '#e67e22', fontWeight: 'bold', padding: '15px' }}>{tugas.deadline}</td>
                        <td style={{ textAlign: 'center', padding: '15px' }}>
                          <button onClick={() => handleHapusTugas(tugas.id, tugas.nama_tugas)} style={{ color: '#e74c3c', background: '#fff0f0', border: '1px solid #fadbd8', padding: '6px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', transition: '0.2s' }}>
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 2: VERIFIKASI TUGAS KADER */}
        {tabAktif === 'verifikasi' && (
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', backgroundColor: '#fff' }}>
              <table style={{ minWidth: '750px', width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f0f4f8', color: '#555' }}>
                  <tr>
                    <th style={{ padding: '12px 15px', borderRadius: '10px 0 0 0', width: '25%' }}>Kader / Waktu Kumpul</th>
                    <th style={{ padding: '12px 15px', width: '30%' }}>Jenis Tugas / File</th>
                    <th style={{ padding: '12px 15px', textAlign: 'center', width: '20%' }}>Dokumen</th>
                    <th style={{ padding: '12px 15px', textAlign: 'center', borderRadius: '0 10px 0 0', width: '25%' }}>Status & Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {berkasKaderRayon.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Belum ada berkas tugas yang dikumpulkan oleh kader.</td></tr>
                  ) : (
                    berkasKaderRayon.map((berkas) => (
                      <tr key={berkas.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '15px' }}>
                          <div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.9rem', marginBottom: '4px' }}>{berkas.email_kader.split('@')[0]}</div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>{berkas.tanggal}</div>
                        </td>
                        <td style={{ padding: '15px' }}>
                          <div style={{ fontWeight: 'bold', color: '#1e824c', fontSize: '0.9rem' }}>{berkas.jenis_berkas}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>{berkas.nama_file_asli}</div>
                        </td>
                        <td style={{ padding: '15px', textAlign: 'center' }}>
                          <a href={berkas.file_link_or_id} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#eaf4fc', borderRadius: '6px', textDecoration: 'none', color: '#004a87', fontWeight: 'bold', fontSize: '0.8rem', border: '1px solid #d6eaf8', display: 'inline-block' }}>
                            👁️ Lihat File
                          </a>
                        </td>
                        <td style={{ padding: '15px', textAlign: 'center' }}>
                          {berkas.status === 'Selesai' ? (
                            <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.8rem', backgroundColor: '#eaf4fc', padding: '6px 12px', borderRadius: '20px', border: '1px solid #2ecc71', display: 'inline-block' }}>✅ Selesai (ACC)</span>
                          ) : (
                            <button 
                              onClick={() => handleVerifikasiTugas(berkas.id, berkas.email_kader)} 
                              style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', boxShadow: '0 2px 5px rgba(46,204,113,0.2)' }}
                            >
                              Verifikasi Selesai (ACC)
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ height: '50px' }}></div>
      </div>
    </>
  );
}