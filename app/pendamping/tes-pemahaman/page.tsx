'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageHasilTesPendamping() {
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '' });
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });
  
  const [listTes, setListTes] = useState<any[]>([]);
  const [riwayatTesBinaan, setRiwayatTesBinaan] = useState<any[]>([]);
  const [selectedTesHasil, setSelectedTesHasil] = useState<any>(null);
  const [jawabanTesViewer, setJawabanTesViewer] = useState<any[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon });

            const isPendampingSKP = p.id_rayon === 'Komisariat';

            // Ambil KOP & Tes Tersedia
            if (isPendampingSKP) {
              const unsub1 = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap: any) => {
                if (docSnap.exists()) setPengaturanCetak({ kopSuratUrl: docSnap.data().kopSuratUrl || '', footerUrl: '' });
              });
              const unsub2 = onSnapshot(query(collection(db, "master_tes_pusat"), where("jenjang", "==", "SKP")), (snap: any) => {
                setListTes(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
              });
              unsubs.push(unsub1, unsub2);
            } else {
              const unsub3 = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                if (rayonSnap.exists()) setPengaturanCetak({ kopSuratUrl: rayonSnap.data().kopSuratUrl || '', footerUrl: '' });
              });
              const unsub4 = onSnapshot(query(collection(db, "master_tes"), where("id_rayon", "==", p.id_rayon)), (snap: any) => {
                setListTes(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
              });
              unsubs.push(unsub3, unsub4);
            }

            // Ambil Binaan
            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const nimKaderBinaan: string[] = [];
            
            snapKader.forEach(d => {
              const data = d.data();
              let isBinaan = false;
              if (isPendampingSKP) {
                  if (Array.isArray(data.pendamping_skp_id)) { if (data.pendamping_skp_id.includes(p.username)) isBinaan = true; } 
                  else if (data.pendamping_skp_id === p.username) isBinaan = true;
              } else {
                  const pMapaba = Array.isArray(data.pendamping_mapaba_id) ? data.pendamping_mapaba_id : (data.pendamping_mapaba_id ? [data.pendamping_mapaba_id] : []);
                  const pPkd = Array.isArray(data.pendamping_pkd_id) ? data.pendamping_pkd_id : (data.pendamping_pkd_id ? [data.pendamping_pkd_id] : []);
                  const pSig = Array.isArray(data.pendamping_sig_id) ? data.pendamping_sig_id : (data.pendamping_sig_id ? [data.pendamping_sig_id] : []);
                  if (pMapaba.includes(p.username) || pPkd.includes(p.username) || pSig.includes(p.username) || data.pendampingId === p.username) isBinaan = true;
              }
              if (isBinaan) nimKaderBinaan.push(data.nim);
            });

            // Ambil Jawaban
            if (nimKaderBinaan.length > 0) {
              const unsub5 = onSnapshot(collection(db, "jawaban_tes"), (snap) => {
                const dataTes: any[] = [];
                snap.forEach(doc => { const d = doc.data(); if (nimKaderBinaan.includes(d.nim)) dataTes.push({ id: doc.id, ...d }); });
                setRiwayatTesBinaan(dataTes);
              });
              unsubs.push(unsub5);
            }
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(u => u());
    };
  }, []);

  const handleLihatHasilTes = (tes: any) => {
    setSelectedTesHasil(tes);
    const jawabanBinaan = riwayatTesBinaan.filter(r => r.id_tes === tes.id);
    jawabanBinaan.sort((a: any, b: any) => b.timestamp - a.timestamp);
    setJawabanTesViewer(jawabanBinaan);
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          main.no-print { display: block !important; }
          .main-content { margin-left: 0 !important; }
          header { display: none !important; }
          .web-ui-container { display: none !important; }
          body, html { background-color: transparent !important; margin: 0; padding: 0; height: auto !important; }
          .print-layout-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; z-index: 9999 !important; background: white;}
          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; width: 210mm !important; height: 297mm !important; z-index: -10 !important; }
          .bg-kertas-a4 img { width: 100% !important; height: 100% !important; object-fit: fill !important; display: block !important; }
          table.master-print-table { width: 100% !important; border: none !important; margin: 0 !important; padding: 0 !important; background-color: transparent !important; page-break-inside: auto !important; position: relative !important; z-index: 10 !important; }
          table.master-print-table > thead { display: table-header-group !important; }
          table.master-print-table > tfoot { display: table-footer-group !important; }
          table.master-print-table > tbody { display: table-row-group !important; }
          table.master-print-table td { border: none !important; padding: 0 !important; background-color: transparent !important; }
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

      <div className="web-ui-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {selectedTesHasil ? (
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', padding: '20px' }}>
            <button onClick={() => setSelectedTesHasil(null)} style={{ marginBottom: '15px', padding: '6px 12px', backgroundColor: '#f1c40f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>⬅️ Kembali</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ color: '#1e824c', margin: 0, fontSize: '1.1rem' }}>Hasil Binaan: {selectedTesHasil.judul}</h3>
              <button onClick={() => window.print()} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>🖨️ Cetak Hasil</button>
            </div>
            
            <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
              <table className="tabel-utama" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '800px' }}>
                <thead><tr style={{ backgroundColor: '#f8f9fa' }}><th style={{ padding: '10px', width: '15%' }}>Waktu Submit</th><th style={{ padding: '10px', width: '15%' }}>NIM</th><th style={{ padding: '10px', width: '25%' }}>Nama Kader Binaan</th><th style={{ padding: '10px', width: '45%' }}>Jawaban</th></tr></thead>
                <tbody>
                  {jawabanTesViewer.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Kader binaan Anda belum mengerjakan tes ini.</td></tr>
                  ) : (
                    jawabanTesViewer.map((jawab: any) => (
                      <tr key={jawab.nim} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px', verticalAlign: 'top' }}>{jawab.tanggal}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nim}</td>
                        <td style={{ padding: '10px', color: '#004a87', fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nama}</td>
                        <td style={{ padding: '10px', verticalAlign: 'top' }}>
                          <details style={{ cursor: 'pointer' }}>
                            <summary style={{ color: '#27ae60', fontWeight: 'bold', outline: 'none' }}>Tampilkan Jawaban</summary>
                            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '4px' }}>
                              {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                <div key={i} style={{ marginBottom: '10px' }}>
                                  <div style={{ fontWeight: 'bold', color: '#333' }}>Q: {soal}</div><div style={{ color: '#555', fontStyle: 'italic', paddingLeft: '10px', borderLeft: '3px solid #3498db', marginTop: '4px', whiteSpace: 'pre-wrap' }}>A: {jawab.jawaban[i] || '- Kosong -'}</div>
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
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', overflowX: 'auto' }}>
            <h4 style={{ color: '#4a637d', margin: '0 0 15px 0', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>Daftar Tes yang Tersebar</h4>
            <table className="tabel-utama" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '500px' }}>
              <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Judul & Jenjang</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Soal</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Status Tes</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th></tr></thead>
              <tbody>
                {listTes.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Instansi terkait belum membuat/menarik tes.</td></tr>
                ) : (
                  listTes.map((tes) => (
                    <tr key={tes.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{tes.judul}</div>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}>Sasaran: {tes.jenjang}</div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#e67e22' }}>{tes.daftar_soal?.length || 0}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: tes.status === 'Buka' ? '#e8f5e9' : '#ffebee', color: tes.status === 'Buka' ? '#2e7d32' : '#c62828' }}>
                          {tes.status === 'Buka' ? '🔓 Dibuka' : '🔒 Ditutup'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <button onClick={() => handleLihatHasilTes(tes)} style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Lihat Jawaban Binaan</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTesHasil && (
        <div className="print-layout-container">
          {pengaturanCetak.kopSuratUrl && (<div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>)}
          <table className="master-print-table">
            <thead><tr><td><div className="header-space"></div></td></tr></thead>
            <tbody>
              <tr>
                <td>
                  <div className="print-content-area">
                    {jawabanTesViewer.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#000', fontStyle: 'italic' }}>Belum ada jawaban terkumpul.</p>
                    ) : (
                      jawabanTesViewer.map((jawab: any) => (
                        <div key={jawab.nim} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                          <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 20px 0', fontSize: '12pt', textTransform: 'uppercase' }}>REKAP JAWABAN KADER BINAAN: {selectedTesHasil.judul}</h3>
                          <table className="tabel-biodata" style={{ marginBottom: '10px' }}>
                            <tbody>
                              <tr><td style={{width: '150px'}}>Nama Pendamping</td><td style={{width: '15px'}}>:</td><td style={{fontWeight: 'bold'}}>{profilPendamping.nama}</td></tr>
                              <tr><td style={{width: '150px'}}>Nama Kader Binaan</td><td style={{width: '15px'}}>:</td><td style={{fontWeight: 'bold'}}>{jawab.nama}</td></tr>
                              <tr><td>NIM</td><td>:</td><td>{jawab.nim}</td></tr>
                              <tr><td>Waktu Submit</td><td>:</td><td>{jawab.tanggal}</td></tr>
                            </tbody>
                          </table>
                          <table className="tabel-utama">
                            <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '45%' }}>Pertanyaan</th><th style={{ width: '50%' }}>Jawaban Kader</th></tr></thead>
                            <tbody>
                              {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                <tr key={i}><td style={{ textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td><td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{soal}</td><td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap', fontStyle: 'italic', color: '#333' }}>{jawab.jawaban[i] || '- Kosong -'}</td></tr>
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