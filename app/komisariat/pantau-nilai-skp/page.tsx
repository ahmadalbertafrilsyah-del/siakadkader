'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PageRaportSKP() {
  const [databaseKader, setDatabaseKader] = useState<any[]>([]);
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  const [masterKurikulum, setMasterKurikulum] = useState<any[]>([]);
  const [selectedKaderNilai, setSelectedKaderNilai] = useState('');
  
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 
  const [evaluasiKader, setEvaluasiKader] = useState<{ nilai_mentah?: any, catatan: string }>({ nilai_mentah: {}, catatan: '' });
  const [tabRaportAdmin, setTabRaportAdmin] = useState('raport'); 
  const [kategoriBobotGlobal, setKategoriBobotGlobal] = useState<Record<string, any[]>>({});
  const [nilaiMentah, setNilaiMentah] = useState<Record<string, Record<string, number>>>({});
  const [formKategori, setFormKategori] = useState({ nama: '', persen: 0 });
  const [isSavingEvaluasi, setIsSavingEvaluasi] = useState(false);
  
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });
  const [fileKop, setFileKop] = useState<File | null>(null);
  const [isSavingPengaturan, setIsSavingPengaturan] = useState(false);

  // --- FUNGSI HELPER UPLOAD & LOG ---
  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "siakad_upload"); 
    const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/${resourceType}/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        aktor: "PK. PMII Sunan Ampel Malang", role: "komisariat", aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) { console.error("Gagal log", e); }
  };

  // --- FETCH DATA AWAL ---
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const listKader: any[] = []; const listRayon: any[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        if (d.role === 'kader') listKader.push({ id: doc.id, ...d });
        else if (d.role === 'rayon') listRayon.push({ id: doc.id, ...d });
      });
      setDatabaseKader(listKader); setDataRayon(listRayon);
      const kaderSKP = listKader.filter(k => k.jenjang === 'SKP');
      if (kaderSKP.length > 0 && !selectedKaderNilai) setSelectedKaderNilai(kaderSKP[0].nim);
    });

    const unsubSettings = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPengaturanCetak({ kopSuratUrl: data.kopSuratUrl || '', footerUrl: data.footerUrl || '' });
        if (data.bobot_penilaian) setKategoriBobotGlobal(data.bobot_penilaian);
      }
    });

    const unsubKurikulum = onSnapshot(collection(db, "master_kurikulum_pusat"), (snap) => {
      const listMateri: any[] = []; snap.forEach(doc => listMateri.push({ id: doc.id, ...doc.data() })); setMasterKurikulum(listMateri);
    });

    return () => { unsubUsers(); unsubSettings(); unsubKurikulum(); };
  }, [selectedKaderNilai]);

  // --- LISENTER NILAI KADER AKTIF ---
  useEffect(() => {
    if (!selectedKaderNilai) return;
    const unsubscribeNilai = onSnapshot(doc(db, "nilai_khs", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data()); else setNilaiKaderRealtime({});
    });
    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists() && docSnap.data()['SKP']) {
        const data = docSnap.data()['SKP'];
        setNilaiMentah(data.nilai_mentah || {}); setEvaluasiKader(data); 
      } else { 
        setNilaiMentah({}); setEvaluasiKader({ catatan: '' }); 
      }
    });
    return () => { unsubscribeNilai(); unsubscribeKeaktifan(); };
  }, [selectedKaderNilai]);

  const kaderDicetak: any = databaseKader.find(k => k.nim === selectedKaderNilai) || {};

  // Materi SKP selalu terurut agar tampilan web dan hasil cetak identik
  const materiSKP = masterKurikulum
    .filter(m => m.jenjang === 'SKP')
    .sort((a, b) => String(a.kode).localeCompare(String(b.kode), undefined, { numeric: true }));

  // Delegasi luar komisariat: id_rayon berisi nama rayon yang diketik manual saat buat akun
  const getAsalRayon = (k: any) => {
    const asal = k?.id_rayon;
    if (!asal) return '-';
    if (asal === 'Komisariat' || asal === 'Pusat Komisariat') return 'Pusat Komisariat';
    const cocok = dataRayon.find((r: any) =>
      r.username === asal || r.id_rayon === asal || r.id === asal ||
      (r.nama && String(r.nama).toLowerCase() === String(asal).toLowerCase())
    );
    return cocok ? (cocok.nama || asal) : asal;
  };

  return (
    <>
      {/* CSS KHUSUS PDF CETAK (OVERRIDE LAYOUT) */}
      <style>{`
        .mobile-padded { display: flex; flex-direction: column; gap: 20px; }

        @media (max-width: 767px) {
           .mobile-padded { padding: 0 !important; }
        }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        .modern-tab-container {
           display: flex; background-color: #f0f2f5; padding: 4px; border-radius: 8px; width: fit-content; margin-bottom: 15px; max-width: 100%; overflow-x: auto;
        }
        .modern-tab {
           padding: 8px 12px; border-radius: 6px; border: none; background: transparent; color: #777; font-weight: bold; font-size: 0.75rem; cursor: pointer; transition: all 0.3s; white-space: nowrap;
        }
        .modern-tab.active {
           background-color: #fff; color: #0000af; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        @media print {
          @page { size: A4 portrait; margin: 0; }
          /* 1. MENGATASI OVERRIDE DARI LAYOUT.TSX */
          main.no-print { display: block !important; }
          header { display: none !important; }
          /* Shell aplikasi memakai height:100dvh + overflow:hidden -> harus dilepas saat cetak
             agar KHS tidak terpotong di satu halaman. */
          .sk-sidebar, .sk-topbar, .sk-appbar, .sk-bottomnav { display: none !important; }
          html, body, .siakad-shell, .sk-main, .sk-content, .main-content {
            display: block !important; height: auto !important; min-height: 0 !important;
            max-height: none !important; overflow: visible !important; position: static !important;
            margin: 0 !important; padding: 0 !important; background: #fff !important;
          }
          
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

          /* Tabel cetak resmi: hitam-putih, bergaris tegas, tanpa warna gradient layar */
          table.tabel-utama-print { width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px; page-break-inside: auto !important; }
          table.tabel-utama-print tr { page-break-inside: avoid !important; page-break-after: auto !important; }
          table.tabel-utama-print th, table.tabel-utama-print td {
            border: 1px solid #000 !important; padding: 5px 7px !important;
            font-size: 11pt !important; color: #000 !important; background: #fff !important;
          }
          table.tabel-utama-print th { font-weight: bold !important; text-align: center !important; background: #fff !important; }
          .tabel-biodata { margin-top: 0 !important; }
          .tabel-biodata td { border: none !important; padding: 3px 0 !important; font-size: 11pt !important; color: #000 !important; background: #fff !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      {/* ======================================================== */}
      {/* TAMPILAN WEB NORMAL (DIBUNGKUS CLASS web-ui-container)   */}
      {/* ======================================================== */}
      <div className="web-ui-container mobile-padded">

        {/* KARTU FILTER: PILIH KADER + CETAK */}
        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ color: '#0f1b2e', margin: 0, fontSize: '1rem' }}>Raport &amp; Penilaian Peserta SKP</h3>
            <p style={{ fontSize: '0.75rem', color: '#888', margin: '4px 0 0 0' }}>Kelola nilai, bobot matriks, dan cetak Kartu Hasil Studi kader SKP.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>Pilih Kader SKP:</span>
              <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: '8px', outline: 'none', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: '#0f1b2e', width: '100%' }}>
                {databaseKader.filter(k => k.jenjang === 'SKP').length === 0 && <option value="">Tidak ada peserta SKP</option>}
                {databaseKader.filter(k => k.jenjang === 'SKP').map(k => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
              </select>
            </div>

            {tabRaportAdmin === 'raport' && selectedKaderNilai && (
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={() => window.print()} style={{ backgroundColor: '#f5c518', color: '#0f1b2e', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', boxShadow: '0 2px 5px rgba(245,197,24,0.25)' }}>
                  🖨️ Cetak KHS SKP
                </button>
              </div>
            )}
          </div>

          {/* IDENTITAS RINGKAS PESERTA SKP */}
          {selectedKaderNilai && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <div style={{ background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', padding: '8px 12px', flex: '1 1 160px' }}>
                <div style={{ fontSize: '0.65rem', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' }}>NIM</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0f1b2e' }}>{kaderDicetak.nim || '-'}</div>
              </div>
              <div style={{ background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', padding: '8px 12px', flex: '1 1 160px' }}>
                <div style={{ fontSize: '0.65rem', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' }}>Asal Rayon</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#28395a' }}>{getAsalRayon(kaderDicetak)}</div>
              </div>
              <div style={{ background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', padding: '8px 12px', flex: '1 1 120px' }}>
                <div style={{ fontSize: '0.65rem', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' }}>Angkatan</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0f1b2e' }}>{kaderDicetak.angkatan || (kaderDicetak.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '-')}</div>
              </div>
              <div style={{ background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', padding: '8px 12px', flex: '1 1 120px' }}>
                <div style={{ fontSize: '0.65rem', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' }}>Jenjang</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0000af' }}>SKP</div>
              </div>
            </div>
          )}
        </div>

        {/* KARTU KONTEN TAB */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '15px', minHeight: '50vh' }}>

        {/* TABS NAVIGASI */}
        <div className="modern-tab-container hide-scroll">
          <button onClick={() => setTabRaportAdmin('raport')} className={`modern-tab ${tabRaportAdmin === 'raport' ? 'active' : ''}`}>Kartu Hasil Studi</button>
          <button onClick={() => setTabRaportAdmin('persentase')} className={`modern-tab ${tabRaportAdmin === 'persentase' ? 'active' : ''}`}>Rincian &amp; Bobot Nilai</button>
          <button onClick={() => setTabRaportAdmin('pengaturan')} className={`modern-tab ${tabRaportAdmin === 'pengaturan' ? 'active' : ''}`} style={{ color: tabRaportAdmin === 'pengaturan' ? '#e67e22' : '#777' }}>⚙️ Pengaturan Cetak</button>
        </div>

        {/* TAB 1: KARTU HASIL STUDI */}
        {tabRaportAdmin === 'raport' && (
          <div>
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f4f8', color: '#555' }}>
                    <th style={{ padding: '12px 10px', borderRadius: '8px 0 0 8px', textAlign: 'center' }}>No</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Kode</th>
                    <th style={{ padding: '12px 10px' }}>Nama Materi SKP</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>SKS</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Nilai</th>
                    <th style={{ padding: '12px 10px', borderRadius: '0 8px 8px 0', textAlign: 'center' }}>SKS x Nilai</th>
                  </tr>
                </thead>
                <tbody>
                {materiSKP.length === 0 ? (<tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Kurikulum SKP belum diatur.</td></tr>) : materiSKP.map((materi, index) => {
                    let angkaAkhir = 0;
                    (kategoriBobotGlobal['SKP'] || []).forEach((kat: any) => {
                      const score = evaluasiKader?.nilai_mentah?.[materi.kode]?.[kat.nama] || 0;
                      angkaAkhir += (score * (kat.persen / 100));
                    });
                    const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                    const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                    const sksKali = materi.bobot * angka;
                    return (
                      <tr key={materi.kode} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '15px 10px', textAlign: 'center', color: '#777' }}>{index + 1}</td>
                        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#0f1b2e' }}>{materi.kode}</td>
                        <td style={{ padding: '15px 10px', textAlign: 'left', color: '#333' }}>{materi.nama}</td>
                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>{materi.bobot}</td>
                        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: huruf !== '-' ? '#27ae60' : '#aaa' }}>{huruf}</td>
                        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{huruf !== '-' ? sksKali : 0}</td>
                      </tr>
                    )
                })}
                <tr style={{ borderTop: '2px dashed #ddd' }}>
                  <td colSpan={3} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>Total SKS</td>
                  <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{materiSKP.reduce((sum,m)=>sum+m.bobot,0)}</td>
                  <td></td>
                  <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{materiSKP.reduce((sum,m)=>{
                    let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                    const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                    const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                    return sum + (m.bobot * angka);
                },0)}</td></tr>
                <tr>
                  <td colSpan={6}>
                    <div style={{ backgroundColor: '#eaf4fc', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #cce5ff', marginTop: '10px' }}>
                      <span style={{ fontWeight: 'bold', color: '#004a87', fontSize: '1rem' }}>Indeks Prestasi Kader (IPK)</span>
                      <span style={{ fontWeight: 900, color: '#0000af', fontSize: '1.5rem' }}>{materiSKP.reduce((sum,m)=>sum+m.bobot,0) > 0 ? (materiSKP.reduce((sum,m)=>{
                    let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                    const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                    const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                    return sum + (m.bobot * angka);
            },0) / materiSKP.reduce((sum,m)=>sum+m.bobot,0)).toFixed(2) : "0.00"}</span>
                    </div>
                  </td>
                </tr>
                </tbody>
              </table>
            </div>
            <p style={{fontSize: '0.75rem', color: '#888', marginTop: '15px', fontStyle: 'italic'}}>*Catatan: Nilai Huruf terisi otomatis berdasarkan perhitungan Matriks di tab "Rincian &amp; Bobot Nilai".</p>
          </div>
        )}

        {/* TAB 2: PERSENTASE & NILAI */}
        {tabRaportAdmin === 'persentase' && (
          <div style={{ width: '100%' }}>
            <div style={{ marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#1e824c', fontSize: '0.85rem' }}>⚙️ Kategori & Bobot Penilaian SKP</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {(kategoriBobotGlobal['SKP'] || []).map((kat: any) => (
                    <div key={kat.id} style={{ backgroundColor: '#eaf4fc', padding: '5px 10px', borderRadius: '20px', border: '1px solid #3498db', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{kat.nama}: {kat.persen}%</span>
                      <button type="button" onClick={async () => {
                          if(!window.confirm("Hapus kategori bobot ini?")) return;
                          const docRef = doc(db, "pengaturan_sistem", "komisariat_settings");
                          const newBobot = (kategoriBobotGlobal['SKP'] || []).filter((item: any) => item.id !== kat.id);
                          await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, 'SKP': newBobot } }, { merge: true });
                      }} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: 'bold', color: (kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) === 100 ? '#27ae60' : '#e67e22' }}>
                  Total Bobot Saat Ini: {(kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0)}% / 100%
                  {(kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) < 100 && <span style={{ fontStyle: 'italic', marginLeft: '5px', color: '#e74c3c' }}>(Harap lengkapi hingga 100% agar nilai akurat)</span>}
                </div>
              </div>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  const tBobot = (kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0);
                  if(tBobot + formKategori.persen > 100) return alert("Total bobot tidak boleh melebihi 100%!");
                  setIsSavingEvaluasi(true);
                  try {
                    const docRef = doc(db, "pengaturan_sistem", "komisariat_settings");
                    const newBobot = [...(kategoriBobotGlobal['SKP'] || []), { id: Date.now().toString(), nama: formKategori.nama, persen: formKategori.persen }];
                    await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, 'SKP': newBobot } }, { merge: true });
                    setFormKategori({ nama: '', persen: 0 });
                  } catch (error) {} finally { setIsSavingEvaluasi(false); }
              }} style={{ display: 'flex', gap: '8px' }}>
                <input type="text" required placeholder="Nama Kategori" value={formKategori.nama} onChange={e => setFormKategori({...formKategori, nama: e.target.value})} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', width: '120px' }} />
                <input type="number" required placeholder="Bobot %" value={formKategori.persen || ''} onChange={e => setFormKategori({...formKategori, persen: Number(e.target.value)})} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', width: '80px' }} />
                <button type="submit" disabled={isSavingEvaluasi || (kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100} style={{ background: ((kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100) ? '#ccc' : '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: ((kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>➕</button>
              </form>
            </div>

            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', overflowY: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '900px', fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555', borderRadius: '8px 0 0 0' }}>No</th>
                  <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555' }}>Kode</th>
                  <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555', textAlign: 'left' }}>Nama Materi</th>
                  {(kategoriBobotGlobal['SKP'] || []).length > 0 && <th colSpan={(kategoriBobotGlobal['SKP'] || []).length} style={{ padding: '8px', borderBottom: '1px solid #fff', textAlign: 'center', backgroundColor: '#e8f5e9', color: '#27ae60' }}>Nilai Mentah (0-100)</th>}
                  <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555' }}>SKS</th>
                  <th colSpan={2} style={{ padding: '8px', borderBottom: '1px solid #fff', textAlign: 'center', backgroundColor: '#eaf4fc', color: '#004a87', borderRadius: '0 8px 0 0' }}>Hasil Akhir</th>
                </tr>
                <tr>
                  {(kategoriBobotGlobal['SKP'] || []).map((kat: any) => (
                    <th key={kat.id} style={{ fontSize: '0.7rem', textAlign: 'center', padding: '6px', color: '#1e824c', backgroundColor: '#e8f5e9' }}>{kat.nama} ({kat.persen}%)</th>
                  ))}
                  <th style={{ fontSize: '0.7rem', padding: '6px', color: '#004a87', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Angka</th>
                  <th style={{ fontSize: '0.7rem', padding: '6px', color: '#004a87', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Huruf</th>
                </tr>
              </thead>
              <tbody>
                {materiSKP.length === 0 ? (
                  <tr><td colSpan={7 + (kategoriBobotGlobal['SKP'] || []).length} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Belum ada materi SKP.</td></tr>
                ) : (
                  materiSKP.map((materi, index) => {
                    let angkaAkhir = 0;
                    (kategoriBobotGlobal['SKP'] || []).forEach((kat: any) => {
                        const score = nilaiMentah[materi.kode]?.[kat.nama] || 0;
                        angkaAkhir += (score * (kat.persen / 100));
                    });
                    const hurufAkhir = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';

                    return (
                      <tr key={`rinci-${materi.kode}`} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px' }}>{index + 1}</td><td style={{ padding: '10px' }}>{materi.kode}</td><td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>{materi.nama}</td>
                        {(kategoriBobotGlobal['SKP'] || []).map((kat: any) => (
                          <td key={kat.id} style={{ backgroundColor: '#fafafa' }}>
                            <input type="number" min="0" max="100" placeholder="0" value={nilaiMentah[materi.kode]?.[kat.nama] === 0 ? '' : (nilaiMentah[materi.kode]?.[kat.nama] || '')} 
                              onChange={(e) => {
                                  let valNum = Number(e.target.value); if (valNum > 100) valNum = 100; if (valNum < 0) valNum = 0;
                                  setNilaiMentah({ ...nilaiMentah, [materi.kode]: { ...(nilaiMentah[materi.kode] || {}), [kat.nama]: valNum } });
                              }} 
                              onBlur={async () => {
                                  if (!selectedKaderNilai) return;
                                  try {
                                    const docRef = doc(db, "evaluasi_kader", selectedKaderNilai);
                                    const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                                    const jenjangData = currentEvaluasi['SKP'] || { nilai_mentah: {}, catatan: evaluasiKader.catatan };
                                    await setDoc(docRef, { ...currentEvaluasi, ['SKP']: { ...jenjangData, nilai_mentah: nilaiMentah } }, { merge: true });
                                    await setDoc(doc(db, "nilai_khs", selectedKaderNilai), { [materi.kode]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: "Admin Komisariat" }, { merge: true });
                                  } catch (error) {}
                              }} 
                              style={{ width: '60px', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} />
                          </td>
                        ))}
                        <td style={{ padding: '10px' }}>{materi.bobot}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#004a87', backgroundColor: '#fcfcfc' }}>{angkaAkhir > 0 ? angkaAkhir.toFixed(1) : '-'}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#fcfcfc', fontSize: '0.9rem' }}>{hurufAkhir}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            </div>
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: '#333' }}>Catatan Evaluasi SKP:</label>
              <textarea value={evaluasiKader.catatan} onChange={async e => {
                  setEvaluasiKader({ ...evaluasiKader, catatan: e.target.value });
                  try {
                    const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                    const jenjangData = currentEvaluasi['SKP'] || { nilai_mentah: {}, catatan: '' };
                    await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, ['SKP']: { ...jenjangData, catatan: e.target.value } }, { merge: true });
                  } catch (error) {}
              }} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', height: '70px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} placeholder="Tulis catatan perkembangan kader disini..." />
            </div>
          </div>
        )}

        {/* TAB 3: PENGATURAN CETAK */}
        {tabRaportAdmin === 'pengaturan' && (
          <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
            <form onSubmit={async (e) => {
                e.preventDefault(); setIsSavingPengaturan(true);
                try {
                  let newKop = pengaturanCetak.kopSuratUrl;
                  if (fileKop) newKop = await uploadToCloudinary(fileKop);
                  await setDoc(doc(db, "pengaturan_sistem", "komisariat_settings"), { kopSuratUrl: newKop }, { merge: true });
                  catatLogAktivitas("Menyimpan pengaturan KOP Cetak Surat SKP.");
                  alert("Pengaturan Kop berhasil disimpan!"); setFileKop(null);
                } catch (error) {} finally { setIsSavingPengaturan(false); }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
              <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #f5c518', fontSize: '0.8rem', color: '#856404', lineHeight: '1.5' }}><b>PENTING:</b> Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan TANDA TANGAN di bagian bawah. Gambar ini akan menjadi background pada saat cetak PDF SKP.</div>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#333', fontSize: '0.85rem' }}>Upload Template Background A4 (Komisariat)</label>
                {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '15px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px', borderRadius: '8px' }} />}
                <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '12px', border: '2px dashed #28395a', borderRadius: '8px', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
              </div>
              <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.85rem', width: '200px' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
            </form>
          </div>
        )}
        </div>
        <div style={{ height: '80px' }} className="mobile-only"></div>
      </div>

      {/* ======================================================== */}
      {/* TAMPILAN KHUSUS CETAK PDF (Muncul Otomatis saat Di-Print)  */}
      {/* ======================================================== */}
      <div className="print-layout-container">
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
                  {tabRaportAdmin === 'raport' && selectedKaderNilai && (
                    <>
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt', textTransform: 'uppercase' }}>Kartu Hasil Studi (KHS) Sekolah Kader Putri</h3>
                      <table className="tabel-biodata" style={{ width: '100%', marginBottom: '15px' }}>
                        <tbody>
                          <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak.nim || '...........................'}</td></tr>
                          <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak.nama || '...........................'}</td></tr>
                          <tr><td>Pelaksana Instansi</td><td>:</td><td>Pusat Komisariat</td></tr>
                          <tr><td>Asal Rayon</td><td>:</td><td>{getAsalRayon(kaderDicetak)}</td></tr>
                          <tr><td>Tahun Angkatan</td><td>:</td><td>{kaderDicetak.angkatan || (kaderDicetak.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................')}</td></tr>
                          <tr><td>Jenjang Kaderisasi</td><td>:</td><td>SKP (Sekolah Kader Putri)</td></tr>
                        </tbody>
                      </table>
                      <table className="tabel-utama-print">
                        <thead>
                          <tr><th style={{ width: '5%' }}>No</th><th style={{ width: '15%' }}>Kode Materi</th><th style={{ width: '45%' }}>Nama Materi Kurikulum</th><th style={{ width: '10%' }}>SKS</th><th style={{ width: '10%' }}>Nilai Huruf</th><th style={{ width: '15%' }}>SKS x Nilai</th></tr>
                        </thead>
                        <tbody>
                          {materiSKP.map((materi, index) => {
                            let angkaAkhir = 0;
                            (kategoriBobotGlobal['SKP'] || []).forEach((kat: any) => {
                              const score = evaluasiKader?.nilai_mentah?.[materi.kode]?.[kat.nama] || 0;
                              angkaAkhir += (score * (kat.persen / 100));
                            });
                            const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                            const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                            return (
                                <tr key={materi.kode}>
                                  <td style={{ textAlign: 'center' }}>{index + 1}</td><td style={{ textAlign: 'center' }}>{materi.kode}</td><td>{materi.nama}</td>
                                  <td style={{ textAlign: 'center' }}>{materi.bobot}</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{huruf}</td><td style={{ textAlign: 'center' }}>{huruf !== '-' ? (materi.bobot * angka) : 0}</td>
                                </tr>
                            )
                          })}
                          <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{materiSKP.reduce((sum,m)=>sum+m.bobot,0)}</td><td></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{materiSKP.reduce((sum,m)=>{
                              let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                              const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                              const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                              return sum + (m.bobot * angka);
                          },0)}</td></tr>
                          <tr><td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold' }}>IPK (Indeks Prestasi Kader)</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{materiSKP.reduce((sum,m)=>sum+m.bobot,0) > 0 ? (materiSKP.reduce((sum,m)=>{
                              let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                              const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                              const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                              return sum + (m.bobot * angka);
                      },0) / materiSKP.reduce((sum,m)=>sum+m.bobot,0)).toFixed(2) : "0.00"}</td></tr>
                        </tbody>
                      </table>

                      {evaluasiKader?.catatan && (
                        <div style={{ marginTop: '20px' }}>
                          <strong style={{ fontSize: '11pt' }}>Catatan Evaluasi Pendamping:</strong>
                          <p style={{ marginTop: '5px', fontSize: '11pt', fontStyle: 'italic' }}>"{evaluasiKader.catatan}"</p>
                        </div>
                      )}
                    </>
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
    </>
  );
}