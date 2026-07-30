'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';

export default function PageRaportKader() {
  const [profilKader, setProfilKader] = useState({ nama: '', nim: '', id_rayon: '', jenjang: 'MAPABA', angkatan: '' });
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });
  
  const [selectedJenjang, setSelectedJenjang] = useState('MAPABA');
  const [tabAktif, setTabAktif] = useState('raport');

  const [listKurikulumAll, setListKurikulumAll] = useState<Record<string, any[]>>({});
  const [semuaBobot, setSemuaBobot] = useState<Record<string, any[]>>({});
  
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 
  const [evaluasiMaster, setEvaluasiMaster] = useState<Record<string, any>>({});

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            const jenjangAktif = p.jenjang || 'MAPABA';
            setProfilKader({ nama: p.nama, nim: p.nim, id_rayon: p.id_rayon, jenjang: jenjangAktif, angkatan: p.angkatan || '-' });
            setSelectedJenjang(jenjangAktif);

            const isKomisariat = p.id_rayon === 'Komisariat' || p.id_rayon === 'Pusat Komisariat';

            // 1. Tarik Data Instansi & Kurikulum Semua Jenjang
            if (isKomisariat) {
              setNamaRayonInduk('Pusat Komisariat');
              const unsub1 = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap: any) => {
                if (docSnap.exists()) {
                  const d = docSnap.data();
                  setPengaturanCetak({ kopSuratUrl: d.kopSuratUrl || '', footerUrl: d.footerUrl || '' });
                  if (d.bobot_penilaian) setSemuaBobot(d.bobot_penilaian);
                }
              });
              unsubs.push(unsub1);

              const unsub2 = onSnapshot(collection(db, "master_kurikulum_pusat"), (snap: any) => {
                const allKuri: Record<string, any[]> = { MAPABA: [], PKD: [], SIG: [], SKP: [], NONFORMAL: [] };
                snap.docs.forEach((doc: any) => {
                  const data = doc.data();
                  if (allKuri[data.jenjang]) allKuri[data.jenjang].push({ id: doc.id, ...data });
                });
                Object.keys(allKuri).forEach(k => allKuri[k].sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true })));
                setListKurikulumAll(allKuri);
              });
              unsubs.push(unsub2);
            } else {
              const unsub3 = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                if (rayonSnap.exists()) {
                  const rData = rayonSnap.data();
                  setNamaRayonInduk(rData.nama || p.id_rayon);
                  setPengaturanCetak({ kopSuratUrl: rData.kopSuratUrl || '', footerUrl: rData.footerUrl || '' });
                }
              });
              unsubs.push(unsub3);

              const unsub4 = onSnapshot(doc(db, "pengaturan_rayon", p.id_rayon), (docSnap: any) => {
                if (docSnap.exists() && docSnap.data().bobot_penilaian) {
                  setSemuaBobot(docSnap.data().bobot_penilaian);
                }
              });
              unsubs.push(unsub4);

              const unsub5 = onSnapshot(doc(db, "kurikulum_rayon", p.id_rayon), (docSnap: any) => {
                if (docSnap.exists()) setListKurikulumAll(docSnap.data());
              });
              unsubs.push(unsub5);
            }

            // 2. Tarik Seluruh Nilai & Evaluasi Kader
            const unsub6 = onSnapshot(doc(db, "nilai_khs", p.nim), (docSnap: any) => {
              if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data()); else setNilaiKaderRealtime({});
            });
            unsubs.push(unsub6);

            const unsub7 = onSnapshot(doc(db, "evaluasi_kader", p.nim), (docSnap: any) => {
              if (docSnap.exists()) setEvaluasiMaster(docSnap.data()); else setEvaluasiMaster({});
            });
            unsubs.push(unsub7);
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

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };

  const materiAktif = listKurikulumAll[selectedJenjang] || [];
  const kategoriBobotAktif = semuaBobot[selectedJenjang] || [];
  const dataJenjangIni = evaluasiMaster[selectedJenjang] || { nilai_mentah: {}, catatan: '' };
  const nilaiMentah = dataJenjangIni.nilai_mentah || {};
  const catatanKeaktifan = dataJenjangIni.catatan || '';

  let totalSks = 0; let totalBobotNilai = 0;
  
  const barisRaportRender = materiAktif.map((materi, index) => {
    let nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
    const mentahKode = nilaiMentah[materi.kode];
    let angkaAkhir = 0;
    
    if (mentahKode && Object.keys(mentahKode).length > 0 && kategoriBobotAktif.length > 0) {
      kategoriBobotAktif.forEach((kat: any) => { angkaAkhir += (mentahKode[kat.nama] || 0) * (kat.persen / 100); });
      nilaiHuruf = getNilaiHuruf(angkaAkhir);
    }
    
    // LOGIKA PERHITUNGAN PRESISI: Mengkonversi dari skala 0-100 ke skala 0-4.00 proporsional
    const angkaSkala4 = angkaAkhir > 0 ? (angkaAkhir / 25) : 0; 
    const sksKaliNilai = (materi.bobot || 0) * angkaSkala4;
    
    totalSks += (materi.bobot || 0); 
    if (angkaAkhir > 0) totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode} style={{ borderBottom: '1px solid #eee' }}>
        <td style={{ padding: '12px 10px', textAlign: 'center' }}>{index + 1}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center', color: '#555' }}>{materi.kode}</td>
        <td style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>{materi.nama}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#aaa' }}>{nilaiHuruf}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center' }}>{angkaAkhir > 0 ? sksKaliNilai.toFixed(2) : '-'}</td>
      </tr>
    );
  });
  
  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";

  // FUNGSI EXPORT EXCEL MENGIKUTI NILAI PRESISI
  const handleExportExcel = () => {
    if (materiAktif.length === 0) return alert("Belum ada data nilai!");
    const dataToExport = materiAktif.map((materi, index) => {
      let nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
      const mentahKode = nilaiMentah[materi.kode];
      let angkaAkhir = 0;
      
      if (mentahKode && Object.keys(mentahKode).length > 0 && kategoriBobotAktif.length > 0) {
        kategoriBobotAktif.forEach((kat: any) => { angkaAkhir += (mentahKode[kat.nama] || 0) * (kat.persen / 100); });
        nilaiHuruf = getNilaiHuruf(angkaAkhir);
      }
      
      const angkaSkala4 = angkaAkhir > 0 ? (angkaAkhir / 25) : 0; 
      
      return {
        "No": index + 1, "Kode Materi": materi.kode, "Nama Materi": materi.nama,
        "SKS": materi.bobot, "Nilai Huruf": nilaiHuruf, "SKS x Nilai": angkaAkhir > 0 ? ((materi.bobot || 0) * angkaSkala4).toFixed(2) : 0
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Raport ${selectedJenjang}`);
    XLSX.writeFile(workbook, `KHS_${profilKader.nama}_${selectedJenjang}.xlsx`);
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
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Raport Jenjang:</span>
              <select value={selectedJenjang} onChange={(e) => setSelectedJenjang(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#004a87' }}>
                <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
               <button onClick={handleExportExcel} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 📊 Export Excel
               </button>
               <button onClick={() => window.print()} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 🖨️ Cetak KHS
               </button>
            </div>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '20px', flexWrap: 'wrap' }}>
             <button onClick={() => setTabAktif('raport')} style={{ padding: '10px 20px', border: 'none', background: tabAktif === 'raport' ? '#fff' : 'transparent', color: tabAktif === 'raport' ? '#007bff' : '#555', fontWeight: tabAktif === 'raport' ? 'bold' : 'normal', borderTop: tabAktif === 'raport' ? '3px solid #007bff' : '3px solid transparent', borderRight: '1px solid #ddd', borderLeft: '1px solid #ddd', cursor: 'pointer', marginBottom: '-1px', fontSize: '0.9rem' }}>
               Raport Kaderisasi
             </button>
             <button onClick={() => setTabAktif('persentase')} style={{ padding: '10px 20px', border: 'none', background: tabAktif === 'persentase' ? '#fff' : 'transparent', color: tabAktif === 'persentase' ? '#007bff' : '#555', fontWeight: tabAktif === 'persentase' ? 'bold' : 'normal', borderTop: tabAktif === 'persentase' ? '3px solid #007bff' : '3px solid transparent', borderRight: '1px solid #ddd', cursor: 'pointer', marginBottom: '-1px', fontSize: '0.9rem' }}>
               Persentase & Nilai
             </button>
          </div>

          {/* TAB: RAPORT KADERISASI */}
          {tabAktif === 'raport' && (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table className="tabel-utama" style={{ minWidth: '700px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ width: '5%', color: '#333', borderBottom: '2px solid #ddd' }}>No</th>
                    <th style={{ width: '15%', textAlign: 'center', color: '#333', borderBottom: '2px solid #ddd' }}>Kode Materi</th>
                    <th style={{ width: '40%', textAlign: 'left', color: '#333', borderBottom: '2px solid #ddd' }}>Nama Materi</th>
                    <th style={{ width: '10%', color: '#333', borderBottom: '2px solid #ddd' }}>SKS</th>
                    <th style={{ width: '15%', color: '#333', borderBottom: '2px solid #ddd' }}>Nilai Huruf</th>
                    <th style={{ width: '15%', color: '#333', borderBottom: '2px solid #ddd' }}>SKS x Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Materi kurikulum belum diatur.</td></tr>) : barisRaportRender}
                  <tr style={{ borderTop: '2px solid #ddd' }}>
                    <td colSpan={3} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                    <td></td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', color: '#004a87' }}>IPK (Indeks Prestasi Kader)</td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: '#004a87' }}>{ipKader}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: '0.75rem', color: '#777', fontStyle: 'italic', marginTop: '10px' }}>*Catatan: Nilai pada tabel ini terisi otomatis berdasarkan perhitungan Matriks presisi di tab "Persentase & Nilai".</p>
            </div>
          )}

          {/* TAB: PERSENTASE & NILAI DETAIL */}
          {tabAktif === 'persentase' && (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <div style={{ marginBottom: '15px', background: '#eef2f3', padding: '15px', borderRadius: '6px', border: '1px dashed #b2c2cf' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#0d1b2a', fontSize: '0.85rem' }}>📌 Indikator Bobot Penilaian {selectedJenjang}</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {kategoriBobotAktif.length === 0 ? <span style={{ fontSize: '0.8rem', color: '#e74c3c' }}>Belum ada bobot penilaian yang ditetapkan Instansi.</span> : 
                    kategoriBobotAktif.map((kat: any) => (
                      <div key={kat.id} style={{ backgroundColor: '#fff', padding: '4px 10px', borderRadius: '20px', border: '1px solid #ccc', fontSize: '0.75rem', fontWeight: 'bold', color: '#333' }}>
                        {kat.nama}: <span style={{ color: '#27ae60' }}>{kat.persen}%</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '3%' }}>No</th><th rowSpan={2} style={{ width: '10%' }}>Kode</th><th rowSpan={2} style={{ width: '25%', textAlign: 'left' }}>Nama Materi</th>
                    {kategoriBobotAktif.length > 0 && <th colSpan={kategoriBobotAktif.length} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f0fbf4' }}>Nilai Detail (0-100)</th>}
                    <th rowSpan={2} style={{ width: '5%' }}>SKS</th><th colSpan={2} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#eaf4fc' }}>Hasil Akhir</th>
                  </tr>
                  <tr>
                    {kategoriBobotAktif.map((kat: any) => <th key={kat.id} style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#1e824c', backgroundColor: '#f0fbf4' }}>{kat.nama} <br/><span style={{color: '#e74c3c'}}>{kat.persen}%</span></th>)}
                    <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', backgroundColor: '#eaf4fc' }}>Angka</th><th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', backgroundColor: '#eaf4fc' }}>Huruf</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (
                    <tr><td colSpan={6 + kategoriBobotAktif.length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi kurikulum.</td></tr>
                  ) : (
                    materiAktif.map((materi, index) => {
                      let angkaAkhir = 0;
                      const mentah = nilaiMentah[materi.kode] || {};
                      kategoriBobotAktif.forEach((kat: any) => { angkaAkhir += ((mentah[kat.nama] || 0) * (kat.persen / 100)); });
                      const hurufAkhir = getNilaiHuruf(angkaAkhir);
                      const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';

                      return (
                        <tr key={`rinci-${materi.kode}`} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px' }}>{index + 1}</td>
                          <td style={{ padding: '10px' }}>{materi.kode}</td>
                          <td style={{ textAlign: 'left', fontWeight: 'bold', color: '#333' }}>{materi.nama}</td>
                          {kategoriBobotAktif.map((kat: any) => (
                            <td key={kat.id} style={{ backgroundColor: '#fcfcfc', color: '#555' }}>
                              {mentah[kat.nama] !== undefined && mentah[kat.nama] > 0 ? mentah[kat.nama] : '-'}
                            </td>
                          ))}
                          <td style={{ padding: '10px' }}>{materi.bobot}</td>
                          <td style={{ fontWeight: 'bold', color: '#004a87', backgroundColor: '#f4f9fd' }}>{displayAngka}</td>
                          <td style={{ fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#f4f9fd', fontSize: '1rem' }}>{hurufAkhir}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>

              {catatanKeaktifan && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderLeft: '4px solid #f1c40f', borderRadius: '4px' }}>
                  <strong style={{ color: '#856404', fontSize: '0.85rem' }}>Pesan & Evaluasi Pendamping:</strong>
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#555', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>"{catatanKeaktifan}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PRINT CONTAINER KHUSUS KADER */}
      <div className="print-layout-container">
        {pengaturanCetak.kopSuratUrl && <div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>}
        <table className="master-print-table">
          <thead><tr><td><div className="header-space"></div></td></tr></thead>
          <tbody>
            <tr>
              <td>
                <div className="print-content-area">
                  <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>KARTU HASIL STUDI (KHS) KADERISASI</h3>
                  <table className="tabel-biodata" style={{ width: '100%', marginBottom: '15px' }}>
                    <tbody>
                      <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{profilKader.nim}</td></tr>
                      <tr><td>Nama Mahasiswa</td><td>:</td><td>{profilKader.nama}</td></tr>
                      <tr><td>Pelaksana Instansi</td><td>:</td><td>{namaRayonInduk}</td></tr>
                      <tr><td>Tahun Angkatan</td><td>:</td><td>{profilKader.angkatan}</td></tr>
                      <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{selectedJenjang}</td></tr>
                    </tbody>
                  </table>
                  <table className="tabel-utama">
                    <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '15%' }}>Kode Materi</th><th style={{ width: '45%' }}>Nama Materi Kurikulum</th><th style={{ width: '10%' }}>SKS</th><th style={{ width: '10%' }}>Nilai Huruf</th><th style={{ width: '15%' }}>SKS x Nilai</th></tr></thead>
                    <tbody>
                      {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center' }}>Kurikulum belum diatur.</td></tr>) : barisRaportRender}
                      <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalSks}</td><td></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                      <tr><td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold' }}>Indeks Prestasi Kaderisasi (IPK)</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{ipKader}</td></tr>
                    </tbody>
                  </table>
                  
                  {catatanKeaktifan && (
                    <div style={{ marginTop: '20px' }}>
                      <strong style={{ fontSize: '11pt' }}>Catatan Evaluasi Pendamping:</strong>
                      <p style={{ marginTop: '5px', fontSize: '11pt', fontStyle: 'italic' }}>"{catatanKeaktifan}"</p>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td><div className="footer-space"></div></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}