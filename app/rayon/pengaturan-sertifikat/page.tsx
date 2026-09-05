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

  useEffect(() => {
    if (!adminRayonId) return;
    const docId = `${adminRayonId}_${formJenjang}_${formAngkatan}`;
    const unsub = onSnapshot(doc(db, "pengaturan_sertifikat", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrientasi(data.orientasi || 'portrait');
        setMasaKhidmat(data.masaKhidmat || '2024-2025');
        setTempatDitetapkan(data.tempatDitetapkan || 'Kota Malang');
        setTanggalMasehi(data.tanggalMasehi || '');
        setTanggalHijriyah(data.tanggalHijriyah || '');
        setTanggalPelaksanaan(data.tanggalPelaksanaan || '');
        setTempatPelaksanaan(data.tempatPelaksanaan || '');
        setNamaKetuaRayon(data.namaKetuaRayon || '');
        setStempelUrl(data.stempelUrl || '');
      } else {
        setOrientasi('portrait');
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
      
      alert("Pengaturan Data Sertifikat berhasil disimpan!");
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

  // Variabel untuk Preview Live
  const aspectRatio = orientasi === 'portrait' ? '1 / 1.414' : '1.414 / 1';
  let namaKegiatanFull = 'Masa Penerimaan Anggota Baru (MAPABA)';
  let statusKader = 'ANGGOTA PMII';
  if (formJenjang === 'PKD') {
    namaKegiatanFull = 'Pelatihan Kader Dasar (PKD)';
    statusKader = 'KADER MUJAHID PMII';
  }

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
        
        @media (max-width: 768px) {
          .pengaturan-sertifikat-wrapper { gap: 15px; padding: 5px; }
          .card-panel { padding: 15px; }
        }
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

        {/* 2. FORM & PREVIEW */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* KOLOM KIRI: FORM PENGATURAN */}
          <div className="card-panel" style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }}>
            
            {/* Filter Dasar */}
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
                <select value={orientasi} onChange={e => setOrientasi(e.target.value)} className="form-input">
                  <option value="portrait">A4 Portrait (Berdiri)</option><option value="landscape">A4 Landscape (Mendatar)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Masa Khidmat Rayon</label>
                <input type="text" placeholder="Misal: 2024-2025" value={masaKhidmat} onChange={e => setMasaKhidmat(e.target.value)} className="form-input" />
              </div>
            </div>

            {/* Form Pelaksanaan & Penetapan */}
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

            {/* Form TTD Rayon */}
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

          {/* KOLOM KANAN: PREVIEW TEKS */}
          <div className="card-panel" style={{ flex: '1 1 400px', backgroundColor: '#f4f6f8', border: '1px dashed #ccc' }}>
            <h3 className="section-title" style={{ borderBottom: 'none', marginBottom: '10px' }}>👀 Simulasi Teks Sertifikat</h3>
            <p style={{ fontSize: '0.75rem', color: '#777', marginBottom: '20px' }}>*Posisi pasti dan template gambar diatur oleh Komisariat. Pratinjau ini hanya memastikan teks dan data rayon yang Anda masukkan benar.</p>
            
            <div style={{ 
              width: '100%', 
              aspectRatio: aspectRatio, 
              backgroundColor: 'white', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)', 
              borderRadius: '2px',
              padding: '6% 8%',
              boxSizing: 'border-box',
              containerType: 'inline-size',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
               
               <div style={{ textAlign: 'center', fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>
                 <div style={{ fontSize: '3.5cqi', fontWeight: 'bold', letterSpacing: '1px' }}>PIAGAM KEANGGOTAAN</div>
                 <div style={{ fontSize: '2.5cqi', fontWeight: 'bold', letterSpacing: '1px' }}>PERGERAKAN MAHASISWA ISLAM INDONESIA</div>
                 <div style={{ fontSize: '1.5cqi', marginTop: '1%' }}>Nomor : 10/{formJenjang}-X/{formAngkatan}</div>
               </div>

               <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '2.2cqi', color: '#111', lineHeight: '1.5', marginTop: '6%', flex: 1 }}>
                 <div style={{ textAlign: 'center', marginBottom: '3%' }}>Bismillahirrahmanirrahim...</div>
                 
                 <div style={{ textAlign: 'justify', marginBottom: '4%' }}>
                    Yang bertanda tangan di bawah ini {namaRayonAsli || 'Rayon PMII'} Komisariat Sunan Ampel Malang masa khidmat {masaKhidmat || '...'} memberikan status <b>{statusKader}</b> kepada :
                 </div>

                 {/* Mockup Biodata */}
                 <div style={{ marginLeft: '10%', marginBottom: '4%' }}>
                   <table style={{ fontSize: '2.2cqi' }}>
                     <tbody>
                       <tr><td style={{ width: '15cqi' }}>Nama</td><td>: Ahmad Albert Afrilsyah</td></tr>
                       <tr><td>NIK</td><td>: 35730123456789</td></tr>
                       <tr><td>TTL</td><td>: Malang, 10 Agustus 2002</td></tr>
                     </tbody>
                   </table>
                 </div>

                 <div style={{ textAlign: 'justify' }}>
                    Bahwa nama yang disebutkan diatas telah <b>LULUS</b> {namaKegiatanFull} pada tanggal {tanggalPelaksanaan || '...'} yang dilaksanakan di {tempatPelaksanaan || '...'} oleh {namaRayonAsli || 'Rayon PMII'}.
                 </div>
               </div>

               {/* Area TTD dan Tanggal */}
               <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '2cqi', color: '#111', marginTop: 'auto' }}>
                 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5%' }}>
                   <div style={{ textAlign: 'left' }}>
                     <div>Ditetapkan di : {tempatDitetapkan || '...'}</div>
                     <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '2px' }}>
                       Pada Tanggal : {tanggalMasehi || '...'}
                     </div>
                     <div>{tanggalHijriyah || '...'}</div>
                   </div>
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                   <div style={{ width: '30%' }}>
                     <div style={{ fontWeight: 'bold' }}>NAMA KETUA PC</div>
                     <div style={{ fontStyle: 'italic', fontSize: '1.8cqi' }}>Ketua PC. PMII Kota Malang</div>
                   </div>
                   <div style={{ width: '30%' }}>
                     <div style={{ fontWeight: 'bold' }}>NAMA KETUA PK</div>
                     <div style={{ fontStyle: 'italic', fontSize: '1.8cqi' }}>Ketua PK. PMII Sunan Ampel</div>
                   </div>
                   <div style={{ width: '30%', position: 'relative' }}>
                     <div style={{ fontWeight: 'bold' }}>{namaKetuaRayon || 'NAMA KETUA RAYON'}</div>
                     <div style={{ fontStyle: 'italic', fontSize: '1.8cqi' }}>Ketua {namaRayonAsli || 'PR. PMII'}</div>
                     {(stempelUrl || fileStempel) && (
                       <img src={fileStempel ? URL.createObjectURL(fileStempel) : stempelUrl} alt="stempel" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, 5px)', width: '12cqi', opacity: 0.8 }} />
                     )}
                   </div>
                 </div>
               </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
}