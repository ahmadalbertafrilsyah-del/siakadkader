'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PageMasterTes() {
  const [masterTesPusat, setMasterTesPusat] = useState<any[]>([]);
  const [formTesPusat, setFormTesPusat] = useState({ judul: '', jenjang: 'MAPABA', soal: '' });
  const [selectedTesHasil, setSelectedTesHasil] = useState<any>(null);
  const [jawabanTesViewer, setJawabanTesViewer] = useState<any[]>([]);
  
  // State untuk menyimpan Pengaturan KOP Surat
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { aktor: "PK. PMII Sunan Ampel Malang", role: "komisariat", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  useEffect(() => {
    // Listener Data Tes
    const unsubTes = onSnapshot(collection(db, "master_tes_pusat"), (snap) => {
      const list: any[] = []; snap.forEach(doc => list.push({ id: doc.id, ...doc.data() })); setMasterTesPusat(list);
    });

    // Listener Data Pengaturan Cetak Background (KOP)
    const unsubSettings = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPengaturanCetak({ kopSuratUrl: data.kopSuratUrl || '', footerUrl: data.footerUrl || '' });
      }
    });

    return () => { unsubTes(); unsubSettings(); };
  }, []);

  const handleLihatHasilTesPusat = async (tes: any) => {
    setSelectedTesHasil(tes);
    try {
      const q = query(collection(db, "jawaban_tes"), where("id_tes", "==", tes.id));
      const snap = await getDocs(q);
      const dataJawaban = snap.docs.map(doc => doc.data());
      dataJawaban.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setJawabanTesViewer(dataJawaban);
    } catch (error) { alert("Gagal memuat data."); }
  };

  return (
    <>
      {/* CSS KHUSUS PDF CETAK DENGAN TRIK MASTER TABLE */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          /* 1. MENGATASI OVERRIDE DARI LAYOUT.TSX */
          main.no-print { display: block !important; }
          .main-content { margin-left: 0 !important; }
          header { display: none !important; }
          
          /* 2. SEMBUNYIKAN TAMPILAN WEB */
          .web-ui-container { display: none !important; }
          
          /* 3. TAMPILKAN KHUSUS PRINT */
          body, html { background-color: transparent !important; margin: 0; padding: 0; height: auto !important; }
          .print-layout-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; z-index: 9999 !important; background: white;}
          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; width: 210mm !important; height: 297mm !important; z-index: -10 !important; }
          .bg-kertas-a4 img { width: 100% !important; height: 100% !important; object-fit: fill !important; display: block !important; }

          /* TRICK MASTER TABLE UNTUK MULTI-PAGE PDF */
          table.master-print-table { width: 100% !important; border: none !important; margin: 0 !important; padding: 0 !important; background-color: transparent !important; page-break-inside: auto !important; position: relative !important; z-index: 10 !important; }
          table.master-print-table > thead { display: table-header-group !important; }
          table.master-print-table > tfoot { display: table-footer-group !important; }
          table.master-print-table > tbody { display: table-row-group !important; }
          table.master-print-table > thead > tr > td,
          table.master-print-table > tbody > tr > td,
          table.master-print-table > tfoot > tr > td { border: none !important; padding: 0 !important; background-color: transparent !important; }

          /* SPACER YANG AKAN DIULANG OTOMATIS OLEH BROWSER DI TIAP HALAMAN */
          .header-space { height: 55mm !important; }
          .footer-space { height: 35mm !important; }

          .print-content-area { padding: 0 25mm !important; position: relative; z-index: 10; }

          table.tabel-utama { width: 100% !important; border-collapse: collapse !important; }
          table.tabel-utama th, table.tabel-utama td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11pt !important; color: #000 !important; }
          table.tabel-utama th { font-weight: bold !important; text-align: center !important; }
          .tabel-biodata td { border: none !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      {/* ======================================================== */}
      {/* TAMPILAN WEB NORMAL (DIBUNGKUS CLASS web-ui-container)   */}
      {/* ======================================================== */}
      <div className="web-ui-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📝 Master Tes Pemahaman Kaderisasi</h3>
          
          {selectedTesHasil ? (
            <div style={{ backgroundColor: '#fcfcfc', borderRadius: '10px', border: '1px solid #eaeaea', padding: '20px' }}>
              <button onClick={() => setSelectedTesHasil(null)} style={{ marginBottom: '15px', padding: '6px 15px', backgroundColor: '#fdfdfd', border: '1px solid #ccc', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>⬅️ Kembali ke Daftar</button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ color: '#1e824c', margin: 0, fontSize: '1rem' }}>Data Hasil Ujian: {selectedTesHasil.judul}</h4>
                <button onClick={() => window.print()} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>🖨️ Cetak Semua Jawaban</button>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '8px' }}>
                <table className="tabel-utama" style={{ minWidth: '800px' }}>
                  <thead>
                    <tr><th style={{ width: '15%' }}>Waktu Submit</th><th style={{ width: '25%' }}>Data Kader</th><th style={{ width: '60%' }}>Jawaban Kader</th></tr>
                  </thead>
                  <tbody>
                    {jawabanTesViewer.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada yang mengumpulkan jawaban.</td></tr>
                    ) : (
                      jawabanTesViewer.map((jawab: any) => (
                        <tr key={jawab.nim}>
                          <td style={{ verticalAlign: 'top', fontSize: '0.75rem', color: '#555' }}>{jawab.tanggal}</td>
                          <td style={{ verticalAlign: 'top' }}><div style={{fontWeight: 'bold'}}>{jawab.nama}</div><div style={{fontSize: '0.75rem', color: '#888'}}>NIM: {jawab.nim}</div></td>
                          <td style={{ verticalAlign: 'top' }}>
                            <details style={{ cursor: 'pointer', outline: 'none' }}>
                              <summary style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.8rem', padding: '5px', backgroundColor: '#eaf4fc', borderRadius: '4px', display: 'inline-block' }}>Lihat Jawaban</summary>
                              <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
                                {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                  <div key={i} style={{ marginBottom: '12px' }}>
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
            <>
              <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
                <h4 style={{ marginTop: 0, color: '#333', fontSize: '0.9rem', marginBottom: '15px' }}>➕ Buat Standar Tes Baru</h4>
                <form onSubmit={async (e) => {
                    e.preventDefault(); if (!formTesPusat.judul || !formTesPusat.soal) return;
                    const daftarSoalArray = formTesPusat.soal.split('\n').filter(s => s.trim() !== '');
                    try { await addDoc(collection(db, "master_tes_pusat"), { judul: formTesPusat.judul, jenjang: formTesPusat.jenjang, daftar_soal: daftarSoalArray, status: 'Tutup', timestamp: Date.now() }); setFormTesPusat({ judul: '', jenjang: 'MAPABA', soal: '' }); catatLogAktivitas(`Membuat Master Tes: ${formTesPusat.judul}`); } catch (error) { }
                }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'start' }}>
                  <div><label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Judul Tes</label><input type="text" required value={formTesPusat.judul} onChange={e => setFormTesPusat({...formTesPusat, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} /></div>
                  <div><label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Jenjang Kaderisasi</label><select required value={formTesPusat.jenjang} onChange={e => setFormTesPusat({...formTesPusat, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}><option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option></select></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Daftar Pertanyaan (*Enter untuk memisah soal)</label><textarea rows={4} required value={formTesPusat.soal} onChange={e => setFormTesPusat({...formTesPusat, soal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', resize: 'vertical' }} /></div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}><button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan Master Tes</button></div>
                </form>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
                <table className="tabel-utama" style={{ minWidth: '700px' }}>
                  <thead><tr><th style={{ textAlign: 'center', width: '15%' }}>Jenjang</th><th style={{ textAlign: 'center', width: '35%' }}>Judul Tes</th><th style={{ textAlign: 'center', width: '10%' }}>Soal</th><th style={{ textAlign: 'center', width: '15%' }}>Status</th><th style={{ textAlign: 'center', width: '25%' }}>Aksi</th></tr></thead>
                  <tbody>
                    {masterTesPusat.sort((a,b) => a.jenjang.localeCompare(b.jenjang)).map((tes) => (
                      <tr key={tes.id}>
                        <td style={{ fontWeight: 'bold', textAlign: 'center', color: '#1e824c' }}>{tes.jenjang}</td>
                        <td><div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{tes.judul}</div></td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{tes.daftar_soal?.length || 0}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div onClick={async () => { const statusAkanDatang = tes.status === 'Buka' ? 'Tutup' : 'Buka'; if (!window.confirm(`Ubah status tes menjadi: ${statusAkanDatang}?`)) return; try { await updateDoc(doc(db, "master_tes_pusat", tes.id), { status: statusAkanDatang }); } catch (error) {} }} style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tes.status === 'Buka' ? '#e8f5e9' : '#ffebee', color: tes.status === 'Buka' ? '#2e7d32' : '#c62828' }}>
                            {tes.status === 'Buka' ? 'Dibuka' : 'Ditutup'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => handleLihatHasilTesPusat(tes)} style={{ color: 'white', backgroundColor: '#3498db', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Lihat Hasil</button>
                            <button onClick={async () => { if (window.confirm("Hapus tes ini?")) { await deleteDoc(doc(db, "master_tes_pusat", tes.id)); catatLogAktivitas(`Menghapus Master Tes: ${tes.judul}`); } }} style={{ color: 'white', backgroundColor: '#e74c3c', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Hapus Tes</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAMPILAN KHUSUS CETAK PDF (Muncul Otomatis saat Di-Print)  */}
      {/* ======================================================== */}
      {selectedTesHasil && (
        <div className="print-layout-container">
          {/* Menerapkan Background KOP jika sudah diatur */}
          {pengaturanCetak.kopSuratUrl && (<div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>)}
          
          <table className="master-print-table">
            <thead>
              <tr>
                <td><div className="header-space"></div></td>
              </tr>
            </thead>
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
                                <tr><td style={{width: '150px'}}>Nama Kader Binaan</td><td style={{width: '15px'}}>:</td><td style={{fontWeight: 'bold'}}>{jawab.nama}</td></tr>
                                <tr><td>NIM</td><td>:</td><td>{jawab.nim}</td></tr>
                                <tr><td>Waktu Submit</td><td>:</td><td>{jawab.tanggal}</td></tr>
                              </tbody>
                            </table>
                            <table className="tabel-utama">
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
            <tfoot>
              <tr>
                <td><div className="footer-space"></div></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}