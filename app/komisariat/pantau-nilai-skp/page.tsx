'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function PageRaportSKP() {
  const [databaseKader, setDatabaseKader] = useState<any[]>([]);
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
      const listKader: any[] = [];
      snap.forEach((doc) => { if (doc.data().role === 'kader') listKader.push({ id: doc.id, ...doc.data() }); });
      setDatabaseKader(listKader);
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

  const kaderDicetak = databaseKader.find(k => k.nim === selectedKaderNilai) || {};

  return (
    <>
      {/* CSS KHUSUS PDF CETAK (OVERRIDE LAYOUT) */}
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
      <div className="web-ui-container" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
        
        {/* HEADER & DESKRIPSI */}
        <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Raport & Penilaian Peserta SKP</h3>
          <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Kelola nilai, bobot matriks, dan cetak Kartu Hasil Studi kader SKP.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader SKP:</span>
            <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
              {databaseKader.filter(k => k.jenjang === 'SKP').length === 0 && <option value="">Tidak ada peserta SKP</option>}
              {databaseKader.filter(k => k.jenjang === 'SKP').map(k => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
            </select>
            
            {tabRaportAdmin === 'raport' && selectedKaderNilai && (
              <button onClick={() => window.print()} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>🖨️ Cetak KHS SKP</button>
            )}
          </div>
        </div>
        
        {/* TABS NAVIGASI */}
        <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '0px', flexWrap: 'wrap' }}>
          <button onClick={() => setTabRaportAdmin('raport')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'raport' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'raport' ? '#fff' : 'transparent', color: tabRaportAdmin === 'raport' ? '#555' : '#0000af', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>Raport Kaderisasi</button>
          <button onClick={() => setTabRaportAdmin('persentase')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'persentase' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'persentase' ? '#fff' : 'transparent', color: tabRaportAdmin === 'persentase' ? '#555' : '#0000af', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>Persentase & Nilai</button>
          <button onClick={() => setTabRaportAdmin('pengaturan')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'pengaturan' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'pengaturan' ? '#fff' : 'transparent', color: tabRaportAdmin === 'pengaturan' ? '#555' : '#e67e22', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', marginLeft: 'auto', fontSize: '0.85rem' }}>⚙️ Pengaturan Cetak</button>
        </div>

        {/* TAB 1: RAPORT KADERISASI */}
        {tabRaportAdmin === 'raport' && (
          <div style={{ width: '100%', overflowX: 'auto', padding: '15px 0 0px 0' }}>
            <table className="tabel-utama" style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>No</th><th style={{ width: '12%', textAlign: 'center' }}>Kode</th><th style={{ width: '53%', textAlign: 'center' }}>Nama Materi SKP</th>
                  <th style={{ width: '8%' }}>SKS</th><th style={{ width: '8%' }}>Nilai Huruf</th><th style={{ width: '8%' }}>SKS x Nilai</th>
                </tr>
              </thead>
              <tbody>
                {masterKurikulum.filter(m => m.jenjang === 'SKP').length === 0 ? (<tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum SKP belum diatur.</td></tr>) : masterKurikulum.filter(m => m.jenjang === 'SKP').sort((a,b)=>a.kode.localeCompare(b.kode, undefined, {numeric: true})).map((materi, index) => {
                    let angkaAkhir = 0;
                    (kategoriBobotGlobal['SKP'] || []).forEach((kat: any) => {
                      const score = evaluasiKader?.nilai_mentah?.[materi.kode]?.[kat.nama] || 0;
                      angkaAkhir += (score * (kat.persen / 100));
                    });
                    const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                    const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                    const sksKali = materi.bobot * angka;
                    return (
                      <tr key={materi.kode}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td><td style={{ textAlign: 'center' }}>{materi.kode}</td><td style={{ fontWeight: 'bold' }}>{materi.nama}</td>
                        <td style={{ textAlign: 'center' }}>{materi.bobot}</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: huruf !== '-' ? '#27ae60' : '#999' }}>{huruf}</td><td style={{ textAlign: 'center' }}>{huruf !== '-' ? sksKali : 0}</td>
                      </tr>
                    )
                })}
                <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0)}</td><td></td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>{
                    let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                    const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                    const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                    return sum + (m.bobot * angka);
                },0)}</td></tr>
                <tr><td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kader)</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0) > 0 ? (masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>{
                    let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                    const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                    const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                    return sum + (m.bobot * angka);
            },0) / masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0)).toFixed(2) : "0.00"}</td></tr>
              </tbody>
            </table>
            <p style={{fontSize: '0.75rem', color: '#888', marginTop: '15px', fontStyle: 'italic'}}>*Catatan: Nilai Huruf terisi otomatis berdasarkan perhitungan Matriks di tab "Persentase & Nilai".</p>
          </div>
        )}

        {/* TAB 2: PERSENTASE & NILAI */}
        {tabRaportAdmin === 'persentase' && (
          <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
            <div style={{ marginBottom: '15px', background: '#fdfdfd', padding: '15px', borderRadius: '6px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#1e824c', fontSize: '0.9rem' }}>⚙️ Kategori & Bobot Penilaian SKP</h4>
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

            <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '3%', textAlign: 'center' }}>No</th>
                  <th rowSpan={2} style={{ width: '10%', textAlign: 'center' }}>Kode</th>
                  <th rowSpan={2} style={{ width: '25%', textAlign: 'center' }}>Nama Materi</th>
                  {(kategoriBobotGlobal['SKP'] || []).length > 0 && <th colSpan={(kategoriBobotGlobal['SKP'] || []).length} style={{ borderBottom: '1px solid #ddd', textAlign: 'center', backgroundColor: '#f0fbf4' }}>Input Nilai Detail (0-100)</th>}
                  <th rowSpan={2} style={{ width: '5%', textAlign: 'center' }}>SKS</th>
                  <th colSpan={2} style={{ borderBottom: '1px solid #ddd', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Hasil Akhir</th>
                </tr>
                <tr>
                  {(kategoriBobotGlobal['SKP'] || []).map((kat: any) => (
                    <th key={kat.id} style={{ fontSize: '0.75rem', textAlign: 'center', padding: '6px 5px', color: '#1e824c', backgroundColor: '#f0fbf4' }}>{kat.nama} <br/><span style={{color: '#e74c3c'}}>{kat.persen}%</span></th>
                  ))}
                  <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Angka</th>
                  <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Huruf</th>
                </tr>
              </thead>
              <tbody>
                {masterKurikulum.filter(m => m.jenjang === 'SKP').length === 0 ? (
                  <tr><td colSpan={7 + (kategoriBobotGlobal['SKP'] || []).length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi SKP.</td></tr>
                ) : (
                  masterKurikulum.filter(m => m.jenjang === 'SKP').map((materi, index) => {
                    let angkaAkhir = 0;
                    (kategoriBobotGlobal['SKP'] || []).forEach((kat: any) => {
                        const score = nilaiMentah[materi.kode]?.[kat.nama] || 0;
                        angkaAkhir += (score * (kat.persen / 100));
                    });
                    const hurufAkhir = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';

                    return (
                      <tr key={`rinci-${materi.kode}`}>
                        <td>{index + 1}</td><td style={{ textAlign: 'left' }}>{materi.kode}</td><td style={{ textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
                        {(kategoriBobotGlobal['SKP'] || []).map((kat: any) => (
                          <td key={kat.id} style={{ backgroundColor: '#fcfcfc' }}>
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
                              style={{ width: '50px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none' }} />
                          </td>
                        ))}
                        <td>{materi.bobot}</td>
                        <td style={{ fontWeight: 'bold', color: '#004a87', backgroundColor: '#f4f9fd' }}>{angkaAkhir > 0 ? angkaAkhir.toFixed(1) : '-'}</td>
                        <td style={{ fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#f4f9fd', fontSize: '1rem' }}>{hurufAkhir}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Catatan Evaluasi SKP:</label>
              <textarea value={evaluasiKader.catatan} onChange={async e => {
                  setEvaluasiKader({ ...evaluasiKader, catatan: e.target.value });
                  try {
                    const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                    const jenjangData = currentEvaluasi['SKP'] || { nilai_mentah: {}, catatan: '' };
                    await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, ['SKP']: { ...jenjangData, catatan: e.target.value } }, { merge: true });
                  } catch (error) {}
              }} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', height: '60px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box' }} placeholder="Tulis catatan perkembangan kader disini..." />
            </div>
          </div>
        )}

        {/* TAB 3: PENGATURAN CETAK */}
        {tabRaportAdmin === 'pengaturan' && (
          <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}>
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
              <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px', borderLeft: '4px solid #f1c40f', fontSize: '0.8rem', color: '#856404', lineHeight: '1.4' }}><b>PENTING:</b> Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan TANDA TANGAN di bagian bawah. Gambar ini akan menjadi background pada saat cetak PDF SKP.</div>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#333', fontSize: '0.85rem' }}>Upload Template Background A4 (Komisariat)</label>
                {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '10px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px' }} />}
                <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #ccc', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
              </div>
              <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
            </form>
          </div>
        )}
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
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI SKP</h3>
                      <table className="tabel-biodata">
                        <tbody>
                          <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak.nim || '...........................'}</td></tr>
                          <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak.nama || '...........................'}</td></tr>
                          <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak.angkatan || (kaderDicetak.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................')}</td></tr>
                          <tr><td>Jenjang Kaderisasi</td><td>:</td><td>SKP (Sekolah Kader Putri)</td></tr>
                        </tbody>
                      </table>
                      <table className="tabel-utama">
                        <thead>
                          <tr><th>No</th><th>Kode</th><th>Nama Materi</th><th>SKS</th><th>Nilai</th><th>SKS x Nilai</th></tr>
                        </thead>
                        <tbody>
                          {masterKurikulum.filter(m => m.jenjang === 'SKP').map((materi, index) => {
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
                          <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0)}</td><td></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>{
                              let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                              const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                              const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                              return sum + (m.bobot * angka);
                          },0)}</td></tr>
                          <tr><td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold' }}>IPK (Indeks Prestasi Kader)</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0) > 0 ? (masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>{
                              let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                              const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                              const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                              return sum + (m.bobot * angka);
                      },0) / masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0)).toFixed(2) : "0.00"}</td></tr>
                        </tbody>
                      </table>
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