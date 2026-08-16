'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageManajemenTesRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [listTes, setListTes] = useState<any[]>([]);
  const [masterTesPusat, setMasterTesPusat] = useState<any[]>([]);
  const [jawabanTesViewer, setJawabanTesViewer] = useState<any[]>([]);
  const [selectedTesHasil, setSelectedTesHasil] = useState<any>(null);
  
  const [formTes, setFormTes] = useState({ judul: '', jenjang: 'MAPABA', soal: '' });
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(snapRole.docs[0].data().nama || currentRayonId);
            
            // Pengaturan KOP
            onSnapshot(doc(db, "users", currentRayonId), (rayonSnap: any) => {
              if (rayonSnap.exists()) {
                setPengaturanCetak({ kopSuratUrl: rayonSnap.data().kopSuratUrl || '', footerUrl: rayonSnap.data().footerUrl || '' });
              }
            });

            // Master Tes Rayon Lokal
            onSnapshot(query(collection(db, "master_tes"), where("id_rayon", "==", currentRayonId)), (snap: any) => {
              const tesList: any[] = []; snap.forEach((doc: any) => tesList.push({ id: doc.id, ...doc.data() })); setListTes(tesList);
            });
          }
        });
      }
    });

    const unsubPusat = onSnapshot(collection(db, "master_tes_pusat"), (snap: any) => {
      const listTesPusat: any[] = []; snap.forEach((doc: any) => listTesPusat.push({ id: doc.id, ...doc.data() })); setMasterTesPusat(listTesPusat);
    });

    return () => { unsubscribeAuth(); unsubPusat(); };
  }, []);

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  const handleBuatTes = async (e: React.FormEvent) => {
    e.preventDefault(); if (!formTes.judul || !formTes.soal) return;
    const daftarSoalArray = formTes.soal.split('\n').filter(s => s.trim() !== '');
    try {
      await addDoc(collection(db, "master_tes"), { id_rayon: adminRayonId, judul: formTes.judul, jenjang: formTes.jenjang, daftar_soal: daftarSoalArray, status: 'Tutup', timestamp: Date.now() });
      catatLogAktivitas(`Membuat Tes Lokal: ${formTes.judul}`); alert("Tes berhasil dibuat!"); 
      setFormTes({ judul: '', jenjang: 'MAPABA', soal: '' }); 
    } catch (error) {}
  };

  const handleTarikTesPusat = async (tesPusat: any) => {
    try {
      await addDoc(collection(db, "master_tes"), { id_rayon: adminRayonId, judul: tesPusat.judul, jenjang: tesPusat.jenjang, daftar_soal: tesPusat.daftar_soal || [], status: 'Tutup', timestamp: Date.now() });
      catatLogAktivitas(`Menarik Master Tes Pusat: ${tesPusat.judul}`); alert("Sukses ditarik ke daftar tes rayon!");
    } catch (error) {}
  };

  const handleToggleStatusTes = async (idTes: string, statusSaatIni: string) => {
    const statusAkanDatang = statusSaatIni === 'Buka' ? 'Tutup' : 'Buka'; if (!window.confirm(`Ubah status tes menjadi: ${statusAkanDatang}?`)) return;
    try { await updateDoc(doc(db, "master_tes", idTes), { status: statusAkanDatang }); } catch (error) {}
  };

  const handleLihatHasilTes = async (tes: any) => {
    setSelectedTesHasil(tes);
    try {
      const q = query(collection(db, "jawaban_tes"), where("id_tes", "==", tes.id));
      const snap = await getDocs(q); 
      const dataJawaban = snap.docs.map(doc => doc.data());
      dataJawaban.sort((a: any, b: any) => b.timestamp - a.timestamp); 
      setJawabanTesViewer(dataJawaban);
    } catch (error) {}
  };

  return (
    <>
      <style>{`
        /* TOGGLE DESKTOP & MOBILE */
        .desktop-view { display: flex; flex-direction: column; gap: 20px; }
        .mobile-view { display: none; }
        
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: flex !important; flex-direction: column; gap: 15px; padding: 15px !important; }
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
        }

        /* KHUSUS CETAK PDF */
        @media print {
          @page { size: A4 portrait; margin: 0; }
          main.no-print { display: block !important; }
          .main-content { margin-left: 0 !important; }
          header { display: none !important; }
          .desktop-view, .mobile-view { display: none !important; }
          body, html { background-color: transparent !important; margin: 0; padding: 0; height: auto !important; }
          .print-layout-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; z-index: 9999 !important; background: white;}
          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; width: 210mm !important; height: 297mm !important; z-index: -10 !important; }
          .bg-kertas-a4 img { width: 100% !important; height: 100% !important; object-fit: fill !important; display: block !important; }
          table.master-print-table { width: 100% !important; border: none !important; margin: 0 !important; padding: 0 !important; background-color: transparent !important; page-break-inside: auto !important; position: relative !important; z-index: 10 !important; }
          table.master-print-table > thead { display: table-header-group !important; }
          table.master-print-table > tfoot { display: table-footer-group !important; }
          table.master-print-table > tbody { display: table-row-group !important; }
          table.master-print-table td { border: none !important; padding: 0 !important; background-color: transparent !important; }
          .header-space { height: 40mm !important; }
          .footer-space { height: 30mm !important; }
          .print-content-area { padding: 0 25mm !important; position: relative; z-index: 10; margin-top: 0 !important; }
          table.tabel-utama-print { width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px; font-size: 11pt !important; color: #000 !important; }
          table.tabel-utama-print th, table.tabel-utama-print td { border: 1px solid #000 !important; padding: 6px 8px !important; }
          table.tabel-utama-print th { background-color: #f0f0f0 !important; font-weight: bold !important; text-align: center !important; }
          .tabel-biodata td { border: none !important; padding: 3px 0 !important; font-size: 11pt !important; color: #000 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      {/* ============================================== */}
      {/* 1. DESKTOP VIEW                                */}
      {/* ============================================== */}
      <div className="desktop-view">
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📝 Manajemen Tes Pemahaman</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Buat soal tes sendiri atau tarik soal standar dari Pusat Komisariat untuk diujikan ke kader.</p>
          
          {selectedTesHasil ? (
            <div style={{ backgroundColor: '#fcfcfc', borderRadius: '10px', border: '1px solid #eaeaea', padding: '20px' }}>
              <button onClick={() => setSelectedTesHasil(null)} style={{ marginBottom: '15px', padding: '8px 15px', backgroundColor: '#fdfdfd', border: '1px solid #ccc', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>⬅️ Kembali ke Daftar</button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ color: '#1e824c', margin: 0, fontSize: '1rem' }}>Data Hasil Ujian: {selectedTesHasil.judul}</h4>
                <button onClick={() => window.print()} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>🖨️ Cetak Hasil</button>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="tabel-utama" style={{ minWidth: '800px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '15%', textAlign: 'left' }}>Waktu Submit</th>
                      <th style={{ width: '25%', textAlign: 'left' }}>Data Kader</th>
                      <th style={{ width: '60%', textAlign: 'left' }}>Jawaban Kader</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jawabanTesViewer.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada yang mengumpulkan jawaban.</td></tr>
                    ) : (
                      jawabanTesViewer.map((jawab: any) => (
                        <tr key={jawab.nim}>
                          <td style={{ verticalAlign: 'top', fontSize: '0.75rem', color: '#555' }}>{jawab.tanggal}</td>
                          <td style={{ verticalAlign: 'top' }}><div style={{fontWeight: 'bold', color: '#0d1b2a'}}>{jawab.nama}</div><div style={{fontSize: '0.75rem', color: '#888'}}>NIM: {jawab.nim}</div></td>
                          <td style={{ verticalAlign: 'top' }}>
                            <details style={{ cursor: 'pointer', outline: 'none' }}>
                              <summary style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.85rem', padding: '6px 10px', backgroundColor: '#eaf4fc', borderRadius: '6px', display: 'inline-block' }}>Lihat Jawaban Detail</summary>
                              <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '8px' }}>
                                {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                  <div key={i} style={{ marginBottom: '15px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem' }}>Q: {soal}</div>
                                    <div style={{ color: '#004a87', fontStyle: 'italic', paddingLeft: '12px', borderLeft: '3px solid #3498db', marginTop: '6px', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>A: {jawab.jawaban[i] || '- Kosong -'}</div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#1e824c', fontSize: '0.95rem' }}>📥 Tarik Tes Standar Komisariat</h4>
                  <div className="hide-scroll" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '8px', backgroundColor: '#fff' }}>
                    {masterTesPusat.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'center' }}>Pusat belum menetapkan tes standar.</div>
                    ) : (
                      masterTesPusat.map((tesPusat: any) => {
                        const isDitarik = listTes.some(t => t.judul === tesPusat.judul && t.jenjang === tesPusat.jenjang);
                        return (
                          <div key={tesPusat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #eee' }}>
                            <div><strong style={{ fontSize: '0.85rem', color: '#0d1b2a' }}>{tesPusat.judul}</strong><br/><span style={{ fontSize: '0.75rem', color: '#555' }}>Jenjang: {tesPusat.jenjang}</span></div>
                            {isDitarik ? (
                              <span style={{ fontSize: '0.7rem', color: '#27ae60', fontWeight: 'bold', backgroundColor: '#e8f5e9', padding: '4px 8px', borderRadius: '6px' }}>Ditarik</span>
                            ) : (
                              <button onClick={() => handleTarikTesPusat(tesPusat)} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Tarik</button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
                  <h4 style={{ marginTop: 0, color: '#0d1b2a', fontSize: '0.95rem', marginBottom: '15px' }}>➕ Buat Tes / Soal Lokal</h4>
                  <form onSubmit={handleBuatTes} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="text" placeholder="Judul Tes (Misal: Post Test Mapaba)" required value={formTes.judul} onChange={e => setFormTes({...formTes, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} />
                    <select required value={formTes.jenjang} onChange={e => setFormTes({...formTes, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}>
                      <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
                    </select>
                    <textarea rows={4} placeholder="Daftar Pertanyaan (Enter untuk memisah soal)..." required value={formTes.soal} onChange={e => setFormTes({...formTes, soal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', resize: 'vertical', fontSize: '0.85rem', outline: 'none' }} />
                    <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Tes Lokal</button>
                  </form>
                </div>
              </div>

              <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', overflow: 'hidden', alignSelf: 'flex-start' }}>
                <table className="tabel-utama" style={{ minWidth: '550px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Judul Tes & Jenjang</th>
                      <th style={{ textAlign: 'center', width: '10%' }}>Soal</th>
                      <th style={{ textAlign: 'center', width: '20%' }}>Status</th>
                      <th style={{ textAlign: 'center', width: '25%' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listTes.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada tes yang siap diujikan.</td></tr>
                    ) : (
                      listTes.map((tes) => (
                        <tr key={tes.id}>
                          <td><div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.95rem' }}>{tes.judul}</div><div style={{ fontSize: '0.75rem', color: '#888' }}>{tes.jenjang}</div></td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#e67e22', fontSize: '0.95rem' }}>{tes.daftar_soal?.length || 0}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div onClick={() => handleToggleStatusTes(tes.id, tes.status)} style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tes.status === 'Buka' ? '#e8f5e9' : '#ffebee', color: tes.status === 'Buka' ? '#2e7d32' : '#c62828' }}>
                              {tes.status === 'Buka' ? '🔓 Buka' : '🔒 Tutup'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button onClick={() => handleLihatHasilTes(tes)} style={{ color: 'white', backgroundColor: '#3498db', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Hasil</button>
                              <button onClick={async () => { if (window.confirm("Hapus tes ini?")) { await deleteDoc(doc(db, "master_tes", tes.id)); catatLogAktivitas(`Menghapus Tes: ${tes.judul}`); } }} style={{ color: 'white', backgroundColor: '#e74c3c', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================== */}
      {/* 2. MOBILE VIEW (Dengan Tabel Horizontal Scroll)*/}
      {/* ============================================== */}
      <div className="mobile-view">
        {selectedTesHasil ? (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd', padding: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <button onClick={() => setSelectedTesHasil(null)} style={{ padding: '8px 12px', backgroundColor: '#f1c40f', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem' }}>⬅️ Kembali</button>
              <button onClick={() => window.print()} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem' }}>🖨️ Cetak</button>
            </div>
            
            <h4 style={{ color: '#1e824c', margin: '0 0 15px 0', fontSize: '1rem' }}>Hasil: {selectedTesHasil.judul}</h4>
            
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', borderRadius: '8px', border: '1px solid #eaeaea' }}>
               <table className="tabel-utama" style={{ minWidth: '650px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '20%', textAlign: 'left' }}>Tgl Submit</th>
                      <th style={{ width: '30%', textAlign: 'left' }}>Data Kader</th>
                      <th style={{ width: '50%', textAlign: 'left' }}>Jawaban Kader</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jawabanTesViewer.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada yang mengumpulkan jawaban.</td></tr>
                    ) : (
                      jawabanTesViewer.map((jawab: any) => (
                        <tr key={jawab.nim}>
                          <td style={{ verticalAlign: 'top', color: '#555' }}>{jawab.tanggal}</td>
                          <td style={{ verticalAlign: 'top' }}><div style={{fontWeight: 'bold', color: '#0d1b2a'}}>{jawab.nama}</div><div style={{color: '#888'}}>NIM: {jawab.nim}</div></td>
                          <td style={{ verticalAlign: 'top' }}>
                            <details style={{ cursor: 'pointer', outline: 'none' }}>
                              <summary style={{ color: '#27ae60', fontWeight: 'bold', padding: '6px', backgroundColor: '#eaf4fc', borderRadius: '6px', display: 'inline-block' }}>Tampilkan Jawaban</summary>
                              <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '8px' }}>
                                {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                  <div key={i} style={{ marginBottom: '12px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#333' }}>Q: {soal}</div>
                                    <div style={{ color: '#004a87', fontStyle: 'italic', paddingLeft: '12px', borderLeft: '3px solid #3498db', marginTop: '6px', whiteSpace: 'pre-wrap' }}>A: {jawab.jawaban[i] || '- Kosong -'}</div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
               </table>
            </div>
          </div>
        ) : (
          <>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1e824c', fontSize: '0.95rem' }}>📥 Tarik Tes Standar Komisariat</h4>
              <div className="hide-scroll" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                {masterTesPusat.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: '#999', textAlign: 'center' }}>Pusat belum menetapkan tes standar.</div>
                ) : (
                  masterTesPusat.map((tesPusat: any) => {
                    const isDitarik = listTes.some(t => t.judul === tesPusat.judul && t.jenjang === tesPusat.jenjang);
                    return (
                      <div key={tesPusat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #eee' }}>
                        <div style={{ flex: 1, paddingRight: '10px' }}><strong style={{ fontSize: '0.85rem', color: '#0d1b2a' }}>{tesPusat.judul}</strong><br/><span style={{ fontSize: '0.75rem', color: '#555' }}>Jenjang: {tesPusat.jenjang}</span></div>
                        {isDitarik ? (
                          <span style={{ fontSize: '0.7rem', color: '#27ae60', fontWeight: 'bold', backgroundColor: '#e8f5e9', padding: '6px 10px', borderRadius: '6px' }}>Ditarik</span>
                        ) : (
                          <button onClick={() => handleTarikTesPusat(tesPusat)} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>Tarik</button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
              <h4 style={{ marginTop: 0, color: '#0d1b2a', fontSize: '0.95rem', marginBottom: '15px' }}>➕ Buat Tes Lokal</h4>
              <form onSubmit={handleBuatTes} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" placeholder="Judul Tes" required value={formTes.judul} onChange={e => setFormTes({...formTes, judul: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
                <select required value={formTes.jenjang} onChange={e => setFormTes({...formTes, jenjang: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', backgroundColor: '#fff', outline: 'none' }}>
                  <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
                </select>
                <textarea rows={4} placeholder="Daftar Pertanyaan (Enter untuk memisah soal)..." required value={formTes.soal} onChange={e => setFormTes({...formTes, soal: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', resize: 'vertical', fontSize: '0.85rem', outline: 'none' }} />
                <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>Simpan Tes Lokal</button>
              </form>
            </div>

            <h4 style={{ margin: '5px 0 0 0', color: '#555', fontSize: '0.9rem', fontWeight: 'bold' }}>Daftar Ujian Tes Tersedia</h4>
            
            {/* TABEL DAFTAR TES MOBILE */}
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
              <table className="tabel-utama" style={{ minWidth: '550px', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Judul Tes & Jenjang</th>
                    <th style={{ textAlign: 'center', width: '10%' }}>Soal</th>
                    <th style={{ textAlign: 'center', width: '20%' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '25%' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {listTes.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Belum ada tes dibuat.</td></tr>
                  ) : (
                    listTes.map((tes) => (
                      <tr key={tes.id}>
                        <td>
                          <div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.95rem' }}>{tes.judul}</div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>{tes.jenjang}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#e67e22', fontSize: '0.95rem' }}>{tes.daftar_soal?.length || 0}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div onClick={() => handleToggleStatusTes(tes.id, tes.status)} style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tes.status === 'Buka' ? '#e8f5e9' : '#ffebee', color: tes.status === 'Buka' ? '#2e7d32' : '#c62828' }}>
                            {tes.status === 'Buka' ? '🔓 Buka' : '🔒 Tutup'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => handleLihatHasilTes(tes)} style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold' }}>Hasil</button>
                            <button onClick={async () => { if (window.confirm("Hapus tes ini?")) { await deleteDoc(doc(db, "master_tes", tes.id)); } }} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold' }}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ height: '80px' }}></div>
          </>
        )}
      </div>

      {/* ============================================== */}
      {/* 3. TAMPILAN KHUSUS CETAK PDF                   */}
      {/* ============================================== */}
      {selectedTesHasil && (
        <div className="print-layout-container">
          {pengaturanCetak.kopSuratUrl && (<div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>)}
          <table className="master-print-table">
            <thead><tr><td><div className="header-space"></div></td></tr></thead>
            <tbody>
              <tr>
                <td>
                  <div className="print-content-area">
                    <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 20px 0', fontSize: '12pt', textTransform: 'uppercase' }}>REKAP JAWABAN KADER: {selectedTesHasil.judul}</h3>
                    {jawabanTesViewer.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#000', fontStyle: 'italic' }}>Belum ada jawaban terkumpul.</p>
                    ) : (
                        jawabanTesViewer.map((jawab: any) => (
                          <div key={jawab.nim} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                            <table className="tabel-biodata" style={{ marginBottom: '10px' }}>
                              <tbody>
                                <tr><td style={{width: '150px'}}>Nama Kader</td><td style={{width: '15px'}}>:</td><td style={{fontWeight: 'bold'}}>{jawab.nama}</td></tr>
                                <tr><td>NIM</td><td>:</td><td>{jawab.nim}</td></tr>
                                <tr><td>Waktu Submit</td><td>:</td><td>{jawab.tanggal}</td></tr>
                              </tbody>
                            </table>
                            <table className="tabel-utama-print">
                              <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '45%' }}>Pertanyaan</th><th style={{ width: '50%' }}>Jawaban Kader</th></tr></thead>
                              <tbody>
                                {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                  <tr key={i}><td style={{ textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td><td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{soal}</td><td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{jawab.jawaban[i] || '- Kosong -'}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot><tr><td><div className="footer-space"></div></td></tr></tfoot>
          </table>
        </div>
      )}
    </>
  );
}