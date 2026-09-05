'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';

export default function PagePengaturanSertifikatRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  // State Konfigurasi Utama
  const [formJenjang, setFormJenjang] = useState('MAPABA');
  const [formAngkatan, setFormAngkatan] = useState(new Date().getFullYear().toString());
  const [orientasi, setOrientasi] = useState('portrait');

  // State Master dari Komisariat
  const [masterTemplate, setMasterTemplate] = useState<any>(null);
  
  // State Data Sertifikat Rayon
  const [masaKhidmat, setMasaKhidmat] = useState('2024-2025');
  const [tempatDitetapkan, setTempatDitetapkan] = useState('Kota Malang');
  const [tanggalMasehi, setTanggalMasehi] = useState('');
  const [tanggalHijriyah, setTanggalHijriyah] = useState('');
  const [tanggalPelaksanaan, setTanggalPelaksanaan] = useState('');
  const [tempatPelaksanaan, setTempatPelaksanaan] = useState('');
  
  const [namaKetuaRayon, setNamaKetuaRayon] = useState('');
  const [stempelUrl, setStempelUrl] = useState('');
  const [fileStempel, setFileStempel] = useState<File | null>(null);
  
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [fileExcel, setFileExcel] = useState<File | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const data = snapRole.docs[0].data();
            setAdminRayonId(data.username);
            setNamaRayonAsli(data.nama || data.username);
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Ambil Master Template dari Komisariat berdasarkan Jenjang & Angkatan secara dinamis
  useEffect(() => {
    const qMaster = query(
      collection(db, "master_template_sertifikat"),
      where("jenjang", "==", formJenjang),
      where("angkatan", "==", formAngkatan)
    );
    const unsubMaster = onSnapshot(qMaster, (snapshot) => {
      if (!snapshot.empty) {
        const masterData = snapshot.docs[0].data();
        setMasterTemplate(masterData);
        setOrientasi(masterData.orientasi || 'portrait');
      } else {
        setMasterTemplate(null);
      }
    });
    return () => unsubMaster();
  }, [formJenjang, formAngkatan]);

  // Ambil Data Pengaturan Rayon
  useEffect(() => {
    if (!adminRayonId) return;
    const docId = `${adminRayonId}_${formJenjang}_${formAngkatan}`;
    const unsub = onSnapshot(doc(db, "pengaturan_sertifikat", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.orientasi) setOrientasi(data.orientasi);
        setMasaKhidmat(data.masaKhidmat || '2024-2025');
        setTempatDitetapkan(data.tempatDitetapkan || 'Kota Malang');
        setTanggalMasehi(data.tanggalMasehi || '');
        setTanggalHijriyah(data.tanggalHijriyah || '');
        setTanggalPelaksanaan(data.tanggalPelaksanaan || '');
        setTempatPelaksanaan(data.tempatPelaksanaan || '');
        setNamaKetuaRayon(data.namaKetuaRayon || '');
        setStempelUrl(data.stempelUrl || '');
      } else {
        setMasaKhidmat('2024-2025');
        setTempatDitetapkan('Kota Malang');
        setTanggalMasehi(''); setTanggalHijriyah('');
        setTanggalPelaksanaan(''); setTempatPelaksanaan('');
        setNamaKetuaRayon(''); setStempelUrl('');
      }
    });
    return () => unsub();
  }, [adminRayonId, formJenjang, formAngkatan]);

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file); formData.append("upload_preset", "siakad_upload"); 
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/image/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  const handleSimpanPengaturan = async () => {
    setIsSavingSetting(true);
    try {
      let finalStempelUrl = stempelUrl;
      if (fileStempel) finalStempelUrl = await uploadToCloudinary(fileStempel);
      
      const docId = `${adminRayonId}_${formJenjang}_${formAngkatan}`;
      await setDoc(doc(db, "pengaturan_sertifikat", docId), {
        orientasi, masaKhidmat, tempatDitetapkan, tanggalMasehi, tanggalHijriyah, 
        tanggalPelaksanaan, tempatPelaksanaan, namaKetuaRayon, 
        stempelUrl: finalStempelUrl, updatedAt: Date.now()
      }, { merge: true });
      
      alert("Pengaturan Data Sertifikat Rayon berhasil disimpan!");
      setFileStempel(null);
    } catch (error) { alert("Gagal menyimpan pengaturan."); } finally { setIsSavingSetting(false); }
  };

  const handleUploadExcelData = async () => {
    if (!fileExcel) return alert("Pilih file Excel terlebih dahulu!");
    setIsUploadingExcel(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const batch = writeBatch(db);
        let count = 0;

        for (const row of json) {
          if (!row.NIM) continue; 
          const qKader = query(collection(db, "users"), where("nim", "==", row.NIM.toString()));
          const snapKader = await getDocs(qKader);
          
          if (!snapKader.empty) {
            const docRef = doc(db, "users", snapKader.docs[0].id);
            batch.update(docRef, {
              nik: row.NIK?.toString() || '',
              ttl: row['Tempat, Tanggal Lahir'] || '',
              jurusan: row.Jurusan || '',
              pt: row['Perguruan Tinggi'] || '',
              nomor_sertifikat: row['Nomor Sertifikat'] || '',
              nia: row.NIA?.toString() || snapKader.docs[0].data().nia || ''
            });
            count++;
          }
        }
        await batch.commit();
        alert(`Berhasil mengupdate data kelengkapan sertifikat untuk ${count} kader!`);
        setFileExcel(null);
      } catch (error) { alert("Gagal memproses file Excel."); } finally { setIsUploadingExcel(false); }
    };
    reader.readAsBinaryString(fileExcel);
  };

  const isPortrait = orientasi === 'portrait';
  const previewWidth = 650;
  const previewHeight = isPortrait ? previewWidth * 1.414 : previewWidth / 1.414;

  let namaKegiatanFull = 'Masa Penerimaan Anggota Baru (MAPABA)';
  let statusKader = 'ANGGOTA PMII';
  if (formJenjang === 'PKD') {
    namaKegiatanFull = 'Pelatihan Kader Dasar (PKD)';
    statusKader = 'KADER MUJAHID PMII';
  }

  // Koordinat master dari Komisariat
  const posisiMaster = masterTemplate?.posisi || {
    nomor: { left: 53, top: 21.4, width: 40, fontSize: 16, isBold: true, isItalic: false, align: 'center' },
    teksPembuka: { left: 10, top: 32.0, width: 80, fontSize: 14, isBold: false, isItalic: false, align: 'justify' },
    nama: { left: 22, top: 38.4, width: 60, fontSize: 16, isBold: true, isItalic: false, align: 'left' },
    nik: { left: 22, top: 41.2, width: 60, fontSize: 14, isBold: false, isItalic: false, align: 'left' },
    ttl: { left: 22, top: 44.0, width: 60, fontSize: 14, isBold: false, isItalic: false, align: 'left' },
    jurusan: { left: 22, top: 47.0, width: 60, fontSize: 14, isBold: false, isItalic: false, align: 'left' },
    pt: { left: 22, top: 49.8, width: 60, fontSize: 14, isBold: false, isItalic: false, align: 'left' },
    teksKelulusan: { left: 10, top: 54.5, width: 80, fontSize: 14, isBold: false, isItalic: false, align: 'justify' },
    penetapan: { left: 60, top: 72.0, width: 35, fontSize: 14, isBold: false, isItalic: false, align: 'left' },
    ttdCabang: { left: 20, top: 88.0, width: 25, fontSize: 14, isBold: true, isItalic: false, align: 'center' },
    ttdKomisariat: { left: 50, top: 88.0, width: 25, fontSize: 14, isBold: true, isItalic: false, align: 'center' },
    ttdRayon: { left: 80, top: 88.0, width: 25, fontSize: 14, isBold: true, isItalic: false, align: 'center' },
    stempelCabang: { left: 15, top: 78.0, width: 15 },
    stempelKomisariat: { left: 45, top: 78.0, width: 15 },
    scanTtdCabang: { left: 20, top: 82.0, width: 18 },
    scanTtdKomisariat: { left: 50, top: 82.0, width: 18 }
  };

  return (
    <>
      <style>{`
        .pengaturan-sertifikat-wrapper { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
        .card-panel { background: #ffffff; padding: 20px 25px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 0.75rem; font-weight: bold; color: #555; text-transform: uppercase; }
        .form-input { padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.85rem; color: #333; outline: none; background-color: #fafafa; }
        .form-input:focus { border-color: #0000af; background-color: #fff; }
        .section-title { font-size: 1rem; color: #0d1b2a; margin: 0 0 15px 0; font-weight: bold; padding-bottom: 10px; border-bottom: 2px solid #f0f4f8; }
        @media (max-width: 768px) { .pengaturan-sertifikat-wrapper { gap: 15px; padding: 5px; } .card-panel { padding: 15px; } }
      `}</style>

      <div className="pengaturan-sertifikat-wrapper">
        
        {/* 1. UPLOAD EXCEL KELENGKAPAN */}
        <div className="card-panel">
          <h3 className="section-title">📥 Upload Data Kelengkapan Sertifikat (Excel)</h3>
          <p style={{ fontSize: '0.8rem', color: '#777', marginBottom: '15px' }}>Header kolom wajib: <b>NIM, NIK, Tempat, Tanggal Lahir, Jurusan, Perguruan Tinggi, Nomor Sertifikat, NIA</b>.</p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept=".xlsx, .xls" onChange={(e) => setFileExcel(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #bbb', borderRadius: '8px', backgroundColor: '#fafafa', fontSize: '0.85rem', flex: '1 1 250px' }} />
            <button onClick={handleUploadExcelData} disabled={isUploadingExcel} style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: isUploadingExcel ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isUploadingExcel ? 'Memproses Data...' : '📤 Proses & Update Database'}
            </button>
          </div>
        </div>

        {/* 2. FORM & LIVE PREVIEW MASTER */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* KOLOM KIRI: FORM PENGATURAN RAYON */}
          <div className="card-panel" style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }}>
            
            <h3 className="section-title">⚙️ Basis Sertifikat & Kegiatan</h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Jenjang Kaderisasi</label>
                <select value={formJenjang} onChange={e => setFormJenjang(e.target.value)} className="form-input">
                  <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tahun Angkatan</label>
                <input type="number" value={formAngkatan} onChange={e => setFormAngkatan(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Orientasi Kertas A4</label>
                <select value={orientasi} onChange={e => setOrientasi(e.target.value)} disabled className="form-input" style={{ backgroundColor: '#eee', cursor: 'not-allowed' }}>
                  <option value="portrait">A4 Portrait (Berdiri)</option><option value="landscape">A4 Landscape (Mendatar)</option>
                </select>
                <span style={{ fontSize: '0.7rem', color: '#888' }}>*Orientasi diatur oleh Komisariat</span>
              </div>
              <div className="form-group">
                <label className="form-label">Masa Khidmat Rayon</label>
                <input type="text" placeholder="Misal: 2024-2025" value={masaKhidmat} onChange={e => setMasaKhidmat(e.target.value)} className="form-input" />
              </div>
            </div>

            <h3 className="section-title">📅 Data Pelaksanaan & Penetapan</h3>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tanggal Pelaksanaan Kegiatan</label>
                <input type="text" placeholder="Misal: 16 - 17 November 2024" value={tanggalPelaksanaan} onChange={e => setTanggalPelaksanaan(e.target.value)} className="form-input" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tempat Pelaksanaan Kegiatan</label>
                <input type="text" placeholder="Misal: SMP Ma'arif 3 Batu" value={tempatPelaksanaan} onChange={e => setTempatPelaksanaan(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Tempat Ditetapkan</label>
                <input type="text" placeholder="Misal: Kota Malang" value={tempatDitetapkan} onChange={e => setTempatDitetapkan(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Tgl Ditetapkan (Masehi)</label>
                <input type="text" placeholder="Misal: 12 Desember 2024 M" value={tanggalMasehi} onChange={e => setTanggalMasehi(e.target.value)} className="form-input" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tgl Ditetapkan (Hijriyah)</label>
                <input type="text" placeholder="Misal: 10 Jumadil Akhir 1446 H" value={tanggalHijriyah} onChange={e => setTanggalHijriyah(e.target.value)} className="form-input" />
              </div>
            </div>

            <h3 className="section-title">✍️ Pengesahan Rayon</h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nama Ketua Rayon (Kapital)</label>
                <input type="text" placeholder="Misal: ALFIAN FAHMI MA'ARIF" value={namaKetuaRayon} onChange={e => setNamaKetuaRayon(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Upload Stempel Rayon (PNG Transparan)</label>
                <input type="file" accept="image/png" onChange={(e) => setFileStempel(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #3498db', borderRadius: '8px', fontSize: '0.75rem', backgroundColor: '#f4f9fd' }} />
                {(stempelUrl || fileStempel) && (
                  <div style={{ marginTop: '5px', padding: '5px', backgroundColor: '#eee', borderRadius: '6px', width: 'fit-content' }}>
                    <img src={fileStempel ? URL.createObjectURL(fileStempel) : stempelUrl} alt="Stempel" style={{ height: '40px', objectFit: 'contain' }} />
                  </div>
                )}
              </div>
            </div>

            <button onClick={handleSimpanPengaturan} disabled={isSavingSetting} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingSetting ? 'not-allowed' : 'pointer', fontSize: '0.85rem', marginTop: '10px', boxShadow: '0 4px 6px rgba(0,0,175,0.1)' }}>
              {isSavingSetting ? 'Menyimpan Konfigurasi...' : '💾 Simpan Data Sertifikat'}
            </button>
          </div>

          {/* KOLOM KANAN: LIVE PREVIEW PERSIS SEPERTI DI KOMISARIAT */}
          <div className="card-panel" style={{ flex: '1 1 450px', backgroundColor: '#ecf0f1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 className="section-title" style={{ width: '100%', borderBottom: 'none', marginBottom: '5px' }}>👀 Live Preview Sertifikat Rayon</h3>
            <p style={{ fontSize: '0.75rem', color: '#777', marginBottom: '15px', textAlign: 'center' }}>Blangko dan tata letak koordinat ditarik langsung dari Master Pengaturan Komisariat.</p>
            
            <div style={{ 
              position: 'relative', width: `${previewWidth}px`, height: `${previewHeight}px`, 
              backgroundColor: 'white', border: '2px solid #ccc', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', overflow: 'hidden'
            }}>
              
              {masterTemplate?.templateUrl ? (
                <img src={masterTemplate.templateUrl} alt="Blanko Komisariat" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'fill', zIndex: 1 }} />
              ) : (
                <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.85rem', zIndex: 1, padding: '20px', textAlign: 'center' }}>
                  ⚠️ Blanko kosong untuk {formJenjang} ({formAngkatan}) belum diatur oleh Admin Komisariat.
                </div>
              )}

              {Object.keys(posisiMaster).map(key => {
                const p = posisiMaster[key];
                if (!p) return null;
                const isCenter = key === 'nomor';

                // Render Stempel Cabang & Komisariat (zIndex 7 agar di atas TTD)
                if (key === 'stempelCabang' && masterTemplate?.stempelCabangUrl) {
                  return (
                    <div key={key} style={{ position: 'absolute', zIndex: 7, top: `${p.top}%`, left: `${p.left}%`, width: `${p.width}%` }}>
                      <img src={masterTemplate.stempelCabangUrl} alt="Stempel Cabang" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
                    </div>
                  );
                }
                if (key === 'stempelKomisariat' && masterTemplate?.stempelKomisariatUrl) {
                  return (
                    <div key={key} style={{ position: 'absolute', zIndex: 7, top: `${p.top}%`, left: `${p.left}%`, width: `${p.width}%` }}>
                      <img src={masterTemplate.stempelKomisariatUrl} alt="Stempel Komisariat" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
                    </div>
                  );
                }
                if (key === 'stempelRayon' && stempelUrl) {
                  return (
                    <div key={key} style={{ position: 'absolute', zIndex: 7, top: `${p.top}%`, left: `${p.left}%`, width: `${p.width}%` }}>
                      <img src={stempelUrl} alt="Stempel Rayon" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
                    </div>
                  );
                }

                // Render Scan TTD Cabang & Komisariat (zIndex 6 di bawah stempel)
                if (key === 'scanTtdCabang' && masterTemplate?.scanTtdCabangUrl) {
                  return (
                    <div key={key} style={{ position: 'absolute', zIndex: 6, top: `${p.top}%`, left: `${p.left}%`, width: `${p.width}%` }}>
                      <img src={masterTemplate.scanTtdCabangUrl} alt="Scan TTD Cabang" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                    </div>
                  );
                }
                if (key === 'scanTtdKomisariat' && masterTemplate?.scanTtdKomisariatUrl) {
                  return (
                    <div key={key} style={{ position: 'absolute', zIndex: 6, top: `${p.top}%`, left: `${p.left}%`, width: `${p.width}%` }}>
                      <img src={masterTemplate.scanTtdKomisariatUrl} alt="Scan TTD Komisariat" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                    </div>
                  );
                }

                let content = '';
                if (key === 'nomor') content = `10/${formJenjang}-X/${formAngkatan}`;
                else if (key === 'teksPembuka') content = `Yang bertanda tangan di bawah ini ${namaRayonAsli || 'Rayon PMII'} Komisariat Sunan Ampel Malang masa khidmat ${masaKhidmat || '...'} memberikan status <b>${statusKader}</b> kepada :`;
                else if (key === 'nama') content = 'AHMAD ALBERT AFRILSYAH';
                else if (key === 'nik') content = '35730123456789';
                else if (key === 'ttl') content = 'MALANG, 10 AGUSTUS 2002';
                else if (key === 'jurusan') content = 'TEKNIK INFORMATIKA';
                else if (key === 'pt') content = 'UNIVERSITAS ISLAM NEGERI MAULANA MALIK IBRAHIM MALANG';
                else if (key === 'teksKelulusan') content = `Bahwa nama yang disebutkan diatas telah <b>LULUS</b> ${namaKegiatanFull} pada tanggal ${tanggalPelaksanaan || '...'} yang dilaksanakan di ${tempatPelaksanaan || '...'} oleh ${namaRayonAsli || 'Rayon PMII'}.`;
                
                else if (key === 'penetapan') {
                  return (
                    <div key={key} style={{ 
                      position: 'absolute', zIndex: 2, 
                      top: `${p.top}%`, left: `${p.left}%`, width: `${p.width}%`,
                      textAlign: p.align || 'left',
                      fontFamily: '"Arial Narrow", Arial, sans-serif',
                      fontSize: `${p.fontSize}px`, 
                      fontWeight: p.isBold ? 'bold' : 'normal',
                      fontStyle: p.isItalic ? 'italic' : 'normal',
                      color: '#000', lineHeight: '1.3',
                      border: '1px dashed rgba(255,0,0,0.4)', background: 'rgba(255,255,255,0.4)', padding: '2px 4px'
                    }}>
                      <div>{tempatDitetapkan || '...'}</div>
                      <div style={{ borderBottom: '1.2px solid #000', paddingBottom: '1px', marginBottom: '1px' }}>{tanggalMasehi || '...'}</div>
                      <div>{tanggalHijriyah || '...'}</div>
                    </div>
                  );
                }

                else if (key === 'ttdCabang') content = `${masterTemplate?.namaKetuaCabang || 'NAMA KETUA PC'}<br/>Ketua PC. PMII Kota Malang`;
                else if (key === 'ttdKomisariat') content = `${masterTemplate?.namaKetuaKomisariat || 'NAMA KETUA PK'}<br/>Ketua PK. PMII Sunan Ampel Malang`;
                else if (key === 'ttdRayon') content = `${namaKetuaRayon || 'NAMA KETUA RAYON'}<br/>Ketua ${namaRayonAsli || 'PR. PMII'}`;

                // Jika elemen berupa key stempel/scan TTD tapi gambarnya belum diupload, abaikan render teks kosong
                if (['stempelCabang', 'stempelKomisariat', 'stempelRayon', 'scanTtdCabang', 'scanTtdKomisariat'].includes(key)) {
                  return null;
                }

                return (
                  <div key={key} style={{ 
                    position: 'absolute', zIndex: 2, 
                    top: `${p.top}%`, left: `${p.left}%`, width: `${p.width}%`,
                    textAlign: p.align || (isCenter ? 'center' : 'left'),
                    transform: isCenter ? 'translate(-50%, 0)' : 'none', 
                    fontFamily: '"Arial Narrow", Arial, sans-serif',
                    fontSize: `${p.fontSize}px`, 
                    fontWeight: p.isBold ? 'bold' : 'normal',
                    fontStyle: p.isItalic ? 'italic' : 'normal',
                    color: '#000', lineHeight: '1.3',
                    border: '1px dashed rgba(255,0,0,0.4)', background: 'rgba(255,255,255,0.4)', padding: '2px 4px'
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: content }} />
                  </div>
                );
              })}

            </div>
          </div>

        </div>
      </div>
    </>
  );
}