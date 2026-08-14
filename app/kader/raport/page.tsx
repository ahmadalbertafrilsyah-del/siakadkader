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
  const [kategoriBobotKomisariat, setKategoriBobotKomisariat] = useState<Record<string, any[]>>({});
  
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

            // Tarik KOP & Kurikulum
            if (isKomisariat) {
              setNamaRayonInduk('Pusat Komisariat');
              const unsub1 = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap: any) => {
                if (docSnap.exists()) {
                  const d = docSnap.data();
                  setPengaturanCetak({ kopSuratUrl: d.kopSuratUrl || '', footerUrl: d.footerUrl || '' });
                  if (d.bobot_penilaian) {
                      setSemuaBobot(d.bobot_penilaian);
                      setKategoriBobotKomisariat(d.bobot_penilaian);
                  }
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

              const unsubKomisariatSettings = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap: any) => {
                if (docSnap.exists() && docSnap.data().bobot_penilaian) setKategoriBobotKomisariat(docSnap.data().bobot_penilaian);
              });
              unsubs.push(unsubKomisariatSettings);

              const unsub5 = onSnapshot(doc(db, "kurikulum_rayon", p.id_rayon), (docSnap: any) => {
                const dataRayon = docSnap.exists() ? docSnap.data() : {};
                onSnapshot(collection(db, "master_kurikulum_pusat"), (pusatSnap) => {
                  const skpMateri: any[] = [];
                  pusatSnap.forEach(d => { if (d.data().jenjang === 'SKP') skpMateri.push({ id: d.id, ...d.data() }); });
                  skpMateri.sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' }));
                  setListKurikulumAll({ ...dataRayon, SKP: skpMateri } as Record<string, any[]>);
                });
              });
              unsubs.push(unsub5);
            }

            // Tarik Nilai & Evaluasi Kader
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

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };

  const materiAktif = listKurikulumAll[selectedJenjang] || [];
  const kategoriBobotAktif = selectedJenjang === 'SKP' ? (kategoriBobotKomisariat['SKP'] || []) : (semuaBobot[selectedJenjang] || (semuaBobot['MAPABA'] || []));
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
    
    // Perhitungan Presisi
    const angkaSkala4 = angkaAkhir > 0 ? (angkaAkhir / 25) : 0; 
    const sksKaliNilai = (materi.bobot || 0) * (angkaAkhir > 0 ? angkaSkala4 : konversiHurufKeAngka(nilaiHuruf));
    
    totalSks += (materi.bobot || 0); 
    if (nilaiHuruf !== "-") totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode} style={{ borderBottom: '1px solid #eee' }}>
        <td style={{ padding: '15px 10px', textAlign: 'center', color: '#777' }}>{index + 1}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#0d1b2a' }}>{materi.kode}</td>
        <td style={{ padding: '15px 10px', textAlign: 'left', color: '#333' }}>{materi.nama}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#aaa' }}>{nilaiHuruf}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{sksKaliNilai > 0 ? sksKaliNilai.toFixed(2) : '-'}</td>
      </tr>
    );
  });
  
  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";

  // FUNGSI EXPORT EXCEL
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
      
      const angkaSkala4 = angkaAkhir > 0 ? (angkaAkhir / 25) : konversiHurufKeAngka(nilaiHuruf); 
      
      return {
        "No": index + 1, "Kode": materi.kode, "Nama Materi": materi.nama,
        "SKS": materi.bobot, "Nilai Huruf": nilaiHuruf, "SKS x Nilai": ((materi.bobot || 0) * angkaSkala4).toFixed(2)
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
        /* RESPONSIVE LAYOUT & HIDE SCROLLBAR */
        @media (max-width: 767px) {
           body, html, .mobile-content-wrapper, .app-container {
             overflow-x: hidden;
             -ms-overflow-style: none;
             scrollbar-width: none;
           }
           ::-webkit-scrollbar {
             display: none;
           }
        }

        /* HIDE SCROLL CLASS */
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        /* CSS TAB TEGAS (SUDUT 8PX) */
        .modern-tab-container {
           display: flex;
           background-color: #f0f2f5;
           padding: 6px;
           border-radius: 8px;
           width: fit-content;
           margin-bottom: 20px;
        }
        .modern-tab {
           padding: 10px 20px;
           border-radius: 6px;
           border: none;
           background: transparent;
           color: #777;
           font-weight: bold;
           font-size: 0.85rem;
           cursor: pointer;
           transition: all 0.3s;
        }
        .modern-tab.active {
           background-color: #fff;
           color: #0000af;
           box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        /* CSS PRINT PDF A4 KHS */
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
          table.tabel-utama-print { width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px; }
          table.tabel-utama-print th, table.tabel-utama-print td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11pt !important; color: #000 !important; }
          table.tabel-utama-print th { font-weight: bold !important; text-align: center !important; }
          .tabel-biodata td { border: none !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      <div className="web-ui-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* HEADER & FILTER SEJAJAR */}
        <div style={{ background: 'white', padding: '15px 20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div className="hide-scroll" style={{ display: 'flex', alignItems: 'center', gap: '15px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '5px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Jenjang:</span>
            <select value={selectedJenjang} onChange={(e) => setSelectedJenjang(e.target.value)} style={{ padding: '8px 15px', border: '1px solid #eee', borderRadius: '8px', outline: 'none', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', color: '#0000af', minWidth: '120px' }}>
              <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
            </select>
            
            {/* TOMBOL EXPORT DAN CETAK LANGSUNG SEJAJAR */}
            {tabAktif === 'raport' && (
              <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                <button onClick={() => window.print()} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  🖨️ Cetak KHS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* AREA KONTEN UTAMA */}
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', padding: '20px', minHeight: '50vh' }}>
          
          <div className="modern-tab-container hide-scroll" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
             <button onClick={() => setTabAktif('raport')} className={`modern-tab ${tabAktif === 'raport' ? 'active' : ''}`}>
               Kartu Hasil Studi (KHS)
             </button>
             <button onClick={() => setTabAktif('persentase')} className={`modern-tab ${tabAktif === 'persentase' ? 'active' : ''}`}>
               Rincian Nilai Mentah
             </button>
          </div>

          {/* TAB: RAPORT KADERISASI */}
          {tabAktif === 'raport' && (
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f4f8', color: '#555' }}>
                    <th style={{ padding: '15px 10px', borderRadius: '10px 0 0 10px', textAlign: 'center' }}>No</th>
                    <th style={{ padding: '15px 10px', textAlign: 'center' }}>Kode</th>
                    <th style={{ padding: '15px 10px', textAlign: 'center' }}>Materi Kurikulum</th>
                    <th style={{ padding: '15px 10px', textAlign: 'center' }}>SKS</th>
                    <th style={{ padding: '15px 10px', textAlign: 'center' }}>Nilai</th>
                    <th style={{ padding: '15px 10px', borderRadius: '0 10px 10px 0', textAlign: 'center' }}>SKS x Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Materi kurikulum jenjang ini belum tersedia.</td></tr>) : barisRaportRender}
                  <tr style={{ borderTop: '2px dashed #ddd' }}>
                    <td colSpan={3} style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>Total SKS</td>
                    <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1.1rem' }}>{totalSks}</td>
                    <td></td>
                    <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1.1rem' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td>
                  </tr>
                  <tr>
                    <td colSpan={6}>
                      <div style={{ backgroundColor: '#eaf4fc', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #cce5ff', marginTop: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: '#004a87', fontSize: '1.1rem' }}>Indeks Prestasi Kader (IPK)</span>
                        <span style={{ fontWeight: '900', color: '#0000af', fontSize: '1.8rem' }}>{ipKader}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic', marginTop: '15px', textAlign: 'center' }}>*IPK dihitung secara presisi berdasarkan Nilai Mentah / 25.</p>
            </div>
          )}

          {/* TAB: PERSENTASE & NILAI DETAIL */}
          {tabAktif === 'persentase' && (
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
              <div style={{ marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '12px', border: '1px solid #eee' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '0.85rem' }}>📌 Komposisi Penilaian {selectedJenjang}</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {kategoriBobotAktif.length === 0 ? <span style={{ fontSize: '0.8rem', color: '#e74c3c' }}>Belum ada bobot penilaian yang ditetapkan Instansi.</span> : 
                    kategoriBobotAktif.map((kat: any) => (
                      <div key={kat.id} style={{ backgroundColor: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #ddd', fontSize: '0.75rem', fontWeight: 'bold', color: '#555', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        {kat.nama}: <span style={{ color: '#27ae60' }}>{kat.persen}%</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '900px', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ padding: '10px', backgroundColor: '#f0f4f8', color: '#555', borderRadius: '10px 0 0 0' }}>No</th>
                    <th rowSpan={2} style={{ padding: '10px', backgroundColor: '#f0f4f8', color: '#555' }}>Kode</th>
                    <th rowSpan={2} style={{ padding: '10px', backgroundColor: '#f0f4f8', color: '#555', textAlign: 'center' }}>Nama Materi</th>
                    {kategoriBobotAktif.length > 0 && <th colSpan={kategoriBobotAktif.length} style={{ padding: '10px', backgroundColor: '#e8f5e9', color: '#27ae60', borderBottom: '1px solid #fff' }}>Nilai Mentah (0-100)</th>}
                    <th rowSpan={2} style={{ padding: '10px', backgroundColor: '#f0f4f8', color: '#555' }}>SKS</th>
                    <th colSpan={2} style={{ padding: '10px', backgroundColor: '#eaf4fc', color: '#004a87', borderRadius: '0 10px 0 0', borderBottom: '1px solid #fff' }}>Hasil Akhir</th>
                  </tr>
                  <tr>
                    {kategoriBobotAktif.map((kat: any) => <th key={kat.id} style={{ padding: '8px', backgroundColor: '#e8f5e9', color: '#1e824c', fontSize: '0.75rem' }}>{kat.nama}</th>)}
                    <th style={{ padding: '8px', backgroundColor: '#eaf4fc', color: '#004a87', fontSize: '0.75rem' }}>Angka</th>
                    <th style={{ padding: '8px', backgroundColor: '#eaf4fc', color: '#004a87', fontSize: '0.75rem' }}>Huruf</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (
                    <tr><td colSpan={6 + kategoriBobotAktif.length} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Belum ada rincian nilai.</td></tr>
                  ) : (
                    materiAktif.map((materi, index) => {
                      let angkaAkhir = 0;
                      const mentah = evaluasiMaster[selectedJenjang]?.nilai_mentah?.[materi.kode] || {};
                      kategoriBobotAktif.forEach((kat: any) => { angkaAkhir += ((mentah[kat.nama] || 0) * (kat.persen / 100)); });
                      const hurufAkhir = getNilaiHuruf(angkaAkhir);
                      const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';

                      return (
                        <tr key={`rinci-${materi.kode}`} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px' }}>{index + 1}</td>
                          <td style={{ padding: '12px' }}>{materi.kode}</td>
                          <td style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>{materi.nama}</td>
                          
                          {kategoriBobotAktif.map((kat: any) => (
                            <td key={kat.id} style={{ backgroundColor: '#fafafa', color: '#555', fontWeight: 'bold' }}>
                              {mentah[kat.nama] !== undefined && mentah[kat.nama] > 0 ? mentah[kat.nama] : '-'}
                            </td>
                          ))}
                          
                          <td style={{ padding: '12px' }}>{materi.bobot}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: '#004a87', backgroundColor: '#fcfcfc' }}>{displayAngka}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#fcfcfc', fontSize: '1rem' }}>{hurufAkhir}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>

              {catatanKeaktifan && (
                <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#fffbeb', borderLeft: '4px solid #f1c40f', borderRadius: '12px' }}>
                  <strong style={{ color: '#856404', fontSize: '0.9rem' }}>Pesan & Evaluasi Pendamping:</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#555', whiteSpace: 'pre-wrap', fontStyle: 'italic', lineHeight: '1.5' }}>"{catatanKeaktifan}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ height: '80px' }} className="mobile-only"></div>
      </div>

      {/* PRINT CONTAINER KHUSUS CETAK A4 PDF */}
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
                  <table className="tabel-utama-print">
                    <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '15%' }}>Kode</th><th style={{ width: '45%' }}>Nama Materi Kurikulum</th><th style={{ width: '10%' }}>SKS</th><th style={{ width: '10%' }}>Nilai Huruf</th><th style={{ width: '15%' }}>SKS x Nilai</th></tr></thead>
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