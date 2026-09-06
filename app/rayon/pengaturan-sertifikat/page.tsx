'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, writeBatch, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';

export default function PagePengaturanSertifikatRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [activeTab, setActiveTab] = useState<'pengaturan' | 'database'>('pengaturan');

  const [formJenjang, setFormJenjang] = useState('MAPABA');
  const [formAngkatan, setFormAngkatan] = useState(new Date().getFullYear().toString());
  const [orientasi, setOrientasi] = useState('portrait');

  const [masterTemplate, setMasterTemplate] = useState<any>(null);
  
  const [masaKhidmat, setMasaKhidmat] = useState('2024-2025');
  const [tempatDitetapkan, setTempatDitetapkan] = useState('Kota Malang');
  const [tanggalMasehi, setTanggalMasehi] = useState('');
  const [tanggalHijriyah, setTanggalHijriyah] = useState('');
  const [tanggalPelaksanaan, setTanggalPelaksanaan] = useState('');
  const [tempatPelaksanaan, setTempatPelaksanaan] = useState('');
  
  const [namaKetuaRayon, setNamaKetuaRayon] = useState('');
  
  const [stempelUrl, setStempelUrl] = useState('');
  const [fileStempel, setFileStempel] = useState<File | null>(null);
  const [scanTtdRayonUrl, setScanTtdRayonUrl] = useState('');
  const [fileTtdRayon, setFileTtdRayon] = useState<File | null>(null);
  
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [fileExcel, setFileExcel] = useState<File | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  const [listKaderSertifikat, setListKaderSertifikat] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [selectedKaderEdit, setSelectedKaderEdit] = useState<any>(null);

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
        setScanTtdRayonUrl(data.scanTtdRayonUrl || '');
      } else {
        setMasaKhidmat('2024-2025');
        setTempatDitetapkan('Kota Malang');
        setTanggalMasehi(''); setTanggalHijriyah('');
        setTanggalPelaksanaan(''); setTempatPelaksanaan('');
        setNamaKetuaRayon(''); setStempelUrl(''); setScanTtdRayonUrl('');
      }
    });
    return () => unsub();
  }, [adminRayonId, formJenjang, formAngkatan]);

  useEffect(() => {
    if (!adminRayonId) return;
    const qKaderCert = query(
      collection(db, "kader_sertifikat"),
      where("id_rayon", "==", adminRayonId),
      where("jenjang", "==", formJenjang),
      where("angkatan", "==", formAngkatan)
    );
    const unsubKader = onSnapshot(qKaderCert, (snapshot) => {
      const dataList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListKaderSertifikat(dataList);
    });
    return () => unsubKader();
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

      let finalTtdRayonUrl = scanTtdRayonUrl;
      if (fileTtdRayon) finalTtdRayonUrl = await uploadToCloudinary(fileTtdRayon);
      
      const docId = `${adminRayonId}_${formJenjang}_${formAngkatan}`;
      await setDoc(doc(db, "pengaturan_sertifikat", docId), {
        orientasi, masaKhidmat, tempatDitetapkan, tanggalMasehi, tanggalHijriyah, 
        tanggalPelaksanaan, tempatPelaksanaan, namaKetuaRayon, 
        stempelUrl: finalStempelUrl, 
        scanTtdRayonUrl: finalTtdRayonUrl,
        updatedAt: Date.now()
      }, { merge: true });
      
      alert("Pengaturan Data Sertifikat Rayon berhasil disimpan!");
      setFileStempel(null);
      setFileTtdRayon(null);
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
          if (!row.NIM && !row.Nama) continue;
          const nimKader = row.NIM ? row.NIM.toString() : '';
          const certDocId = `${adminRayonId}_${nimKader}_${formJenjang}_${formAngkatan}`;
          const docRef = doc(db, "kader_sertifikat", certDocId);

          batch.set(docRef, {
            id_rayon: adminRayonId,
            jenjang: formJenjang,
            angkatan: formAngkatan,
            nama: row.Nama || '',
            nim: nimKader,
            nik: row.NIK ? row.NIK.toString() : '',
            ttl: row['Tempat, Tanggal Lahir'] || '',
            jurusan: row.Jurusan || '',
            pt: row['Perguruan Tinggi'] || '',
            nomor_sertifikat: row['Nomor Sertifikat'] || '',
            nia: row.NIA ? row.NIA.toString() : '',
            updatedAt: Date.now()
          }, { merge: true });
          count++;
        }

        await batch.commit();
        alert(`Berhasil mengimpor data sertifikat untuk ${count} kader pada jenjang ${formJenjang}!`);
        setFileExcel(null);
      } catch (error) { 
        console.error(error);
        alert("Gagal memproses file Excel."); 
      } finally { 
        setIsUploadingExcel(false); 
      }
    };
    reader.readAsBinaryString(fileExcel);
  };

  const handleSimpanEditKader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKaderEdit) return;
    try {
      const docRef = doc(db, "kader_sertifikat", selectedKaderEdit.id);
      await setDoc(docRef, { ...selectedKaderEdit, updatedAt: Date.now() }, { merge: true });
      alert("Data kader berhasil diperbarui!");
      setModalEditOpen(false);
      setSelectedKaderEdit(null);
    } catch (err) {
      alert("Gagal memperbarui data kader.");
    }
  };

  const handleHapusKader = async (id: string) => {
    if (!confirm("Yakin ingin menghapus data kader ini dari daftar penerbitan sertifikat?")) return;
    try {
      await deleteDoc(doc(db, "kader_sertifikat", id));
      alert("Data berhasil dihapus.");
    } catch (err) {
      alert("Gagal menghapus data.");
    }
  };

  const filteredKader = listKaderSertifikat.filter(k => 
    k.nama?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    k.nim?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.nomor_sertifikat?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isPortrait = orientasi === 'portrait';
  const aspectRatio = isPortrait ? '1 / 1.414' : '1.414 / 1';

  let namaKegiatanFull = formJenjang === 'PKD' ? 'Pelatihan Kader Dasar (PKD)' : (formJenjang === 'SIG' ? 'Sekolah Islam Gender (SIG)' : 'Masa Penerimaan Anggota Baru (MAPABA)');
  let statusKader = formJenjang === 'PKD' ? 'KADER MUJAHID PMII' : 'ANGGOTA PMII';

  const cleanRayonName = namaRayonAsli ? namaRayonAsli.replace(/^(PR\.?\s*PMII|Pengurus\s*Rayon\s*PMII)\s*/i, '') : adminRayonId;
  const namaRayonLengkap = `Pengurus Rayon Pergerakan Mahasiswa Islam Indonesia ${cleanRayonName}`;

  const defaultPosisi = {
    nomor: { top: 30, left: 50, width: 40, fontSize: 16, isBold: true, isItalic: false, align: 'center' }, 
    teksPembuka: { top: 32, left: 10, width: 80, fontSize: 14, isBold: false, isItalic: false, align: 'justify' },
    nama: { top: 38.4, left: 22, width: 60, fontSize: 16, isBold: true, isItalic: false, align: 'left' }, 
    nik: { top: 41.2, left: 22, width: 60, fontSize: 14, isBold: false, isItalic: false, align: 'left' },
    ttl: { top: 44, left: 22, width: 60, fontSize: 14, isBold: false, isItalic: false, align: 'left' }, 
    jurusan: { top: 47, left: 22, width: 60, fontSize: 14, isBold: false, isItalic: false, align: 'left' }, 
    pt: { top: 49.8, left: 22, width: 60, fontSize: 14, isBold: false, isItalic: false, align: 'left' },
    teksKelulusan: { top: 54.5, left: 10, width: 80, fontSize: 14, isBold: false, isItalic: false, align: 'justify' },
    penetapan: { top: 72, left: 60, width: 35, fontSize: 14, isBold: false, isItalic: false, align: 'left' },
    ttdCabang: { top: 88, left: 20, width: 25, fontSize: 14, isBold: true, isItalic: false, align: 'center' },
    ttdKomisariat: { top: 88, left: 50, width: 25, fontSize: 14, isBold: true, isItalic: false, align: 'center' },
    ttdRayon: { top: 88, left: 80, width: 25, fontSize: 14, isBold: true, isItalic: false, align: 'center' },
    stempelCabang: { top: 78, left: 15, width: 15, fontSize: 12 },
    stempelKomisariat: { top: 78, left: 45, width: 15, fontSize: 12 },
    stempelRayon: { top: 78, left: 75, width: 15, fontSize: 12 },
    scanTtdCabang: { top: 82, left: 20, width: 18, fontSize: 12 },
    scanTtdKomisariat: { top: 82, left: 50, width: 18, fontSize: 12 },
    scanTtdRayon: { top: 82, left: 80, width: 18, fontSize: 12 }
  };

  const rawMasterPosisi = masterTemplate?.posisi || defaultPosisi;
  const ttdRayonPos = rawMasterPosisi.ttdRayon || defaultPosisi.ttdRayon;

  const posisiMaster = {
    ...defaultPosisi,
    ...rawMasterPosisi,
    stempelRayon: rawMasterPosisi.stempelRayon || { left: ttdRayonPos.left - 5, top: ttdRayonPos.top - 10, width: 15 },
    scanTtdRayon: rawMasterPosisi.scanTtdRayon || { left: ttdRayonPos.left, top: ttdRayonPos.top - 6, width: 18 }
  };

  const getRayonDataTeks = (key: string) => {
    if (key === 'nomor') return `10/${formJenjang}-X/${formAngkatan}`;
    if (key === 'teksPembuka') return `Yang bertanda tangan di bawah ini ${namaRayonLengkap} Komisariat Sunan Ampel Malang masa khidmat ${masaKhidmat || '...'} memberikan status <b>${statusKader}</b> kepada :`;
    if (key === 'nama') return 'AHMAD ALBERT AFRILSYAH';
    if (key === 'nik') return '35730123456789';
    if (key === 'ttl') return 'MALANG, 10 AGUSTUS 2002';
    if (key === 'jurusan') return 'TEKNIK INFORMATIKA';
    if (key === 'pt') return 'UNIVERSITAS ISLAM NEGERI MAULANA MALIK IBRAHIM MALANG';
    if (key === 'teksKelulusan') return `Bahwa nama yang disebutkan diatas telah Lulus ${namaKegiatanFull} pada tanggal ${tanggalPelaksanaan || '...'} yang dilaksanakan di ${tempatPelaksanaan || '...'} oleh ${namaRayonLengkap}.`;
    if (key === 'penetapan') return `<div>${tempatDitetapkan || '...'}</div><div style="border-bottom: 1.2px solid #000; padding-bottom: 1px; margin-bottom: 1px">${tanggalMasehi || '...'}</div><div>${tanggalHijriyah || '...'}</div>`;
    
    if (key === 'ttdCabang') return `<span style="font-weight: bold;">${masterTemplate?.namaKetuaCabang || 'NAMA KETUA PC'}</span><br/><span style="font-weight: normal;">Ketua PC. PMII Kota Malang</span>`;
    if (key === 'ttdKomisariat') return `<span style="font-weight: bold;">${masterTemplate?.namaKetuaKomisariat || 'NAMA KETUA PK'}</span><br/><span style="font-weight: normal;">Ketua PK. PMII Sunan Ampel Malang</span>`;
    if (key === 'ttdRayon') return `<span style="font-weight: bold;">${namaKetuaRayon || 'NAMA KETUA RAYON'}</span><br/><span style="font-weight: normal;">Ketua ${namaRayonAsli || 'Rayon PMII'}</span>`;
    return '';
  };

  return (
    <>
      <style>{`
        :root { --text-main: #111827; --border-color: #e5e7eb; --bg-card: #ffffff; }
        .pengaturan-sertifikat-wrapper { display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; padding: 10px 10px 90px 10px; max-width: 1400px; margin: 0 auto; overflow-x: hidden; }
        .card-panel { background: var(--bg-card); padding: 16px 20px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 2px 10px rgba(0,0,0,0.02); box-sizing: border-box; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 0.75rem; font-weight: bold; color: #555; text-transform: uppercase; }
        .form-input { padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.85rem; color: #333; outline: none; background-color: #fafafa; width: 100%; box-sizing: border-box; }
        .form-input:focus { border-color: #0000af; background-color: #fff; }
        .section-title { font-size: 0.95rem; color: #0d1b2a; margin: 0 0 12px 0; font-weight: bold; padding-bottom: 8px; border-bottom: 2px solid #f0f4f8; }
        .tab-btn { padding: 8px 14px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; cursor: pointer; border: 1px solid #ddd; background: #f8f9fa; color: #555; transition: all 0.2s; white-space: nowrap; }
        .tab-btn.active { background: #0000af; color: #fff; border-color: #0000af; }
        .data-table-container { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 10px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; min-width: 650px; }
        .data-table th, .data-table td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
        .data-table th { background: #f8fafc; color: #334155; font-weight: bold; }
        .action-btn { padding: 5px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; border: none; white-space: nowrap; }
        
        @media (max-width: 768px) {
          body, html { overflow-x: hidden; }
          .pengaturan-sertifikat-wrapper { padding: 6px 6px 90px 6px; gap: 12px; width: 100%; max-width: 100vw; }
          .card-panel { padding: 12px; border-radius: 8px; width: 100%; }
          .form-grid { grid-template-columns: 1fr; gap: 10px; }
        }
      `}</style>

      <div className="pengaturan-sertifikat-wrapper">
        
        <div className="card-panel" style={{ padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0d1b2a', marginRight: '6px' }}>📁 Menu:</span>
          <button className={`tab-btn ${activeTab === 'pengaturan' ? 'active' : ''}`} onClick={() => setActiveTab('pengaturan')}>
            Pengaturan
          </button>
          <button className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`} onClick={() => setActiveTab('database')}>
            Data Kader ({listKaderSertifikat.length})
          </button>
        </div>

        <div className="card-panel" style={{ padding: '12px 16px', backgroundColor: '#fdfdfe' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Jenjang Kaderisasi Aktif</label>
              <select value={formJenjang} onChange={e => setFormJenjang(e.target.value)} className="form-input" style={{ fontWeight: 'bold', color: '#0000af' }}>
                <option value="MAPABA">MAPABA</option>
                <option value="PKD">PKD</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tahun Angkatan</label>
              <input type="number" value={formAngkatan} onChange={e => setFormAngkatan(e.target.value)} className="form-input" style={{ fontWeight: 'bold' }} />
            </div>
          </div>
        </div>

        {activeTab === 'pengaturan' ? (
          <>
            <div className="card-panel">
              <h3 className="section-title">📥 Upload Data Kelengkapan (Excel) - {formJenjang} ({formAngkatan})</h3>
              <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '12px', lineHeight: '1.4' }}>Header kolom wajib: <b>Nama, NIM, NIK, Tempat, Tanggal Lahir, Jurusan, Perguruan Tinggi, Nomor Sertifikat, NIA</b>.</p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="file" accept=".xlsx, .xls" onChange={(e) => setFileExcel(e.target.files ? e.target.files[0] : null)} style={{ padding: '6px', border: '1px dashed #bbb', borderRadius: '8px', backgroundColor: '#fafafa', fontSize: '0.8rem', flex: '1 1 220px', width: '100%', boxSizing: 'border-box' }} />
                <button onClick={handleUploadExcelData} disabled={isUploadingExcel} style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: isUploadingExcel ? 'not-allowed' : 'pointer', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }}>
                  {isUploadingExcel ? 'Memproses...' : '📤 Proses & Simpan'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              
              <div className="card-panel" style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column' }}>
                
                <h3 className="section-title">⚙️ Konfigurasi Teks & Kegiatan</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Orientasi Kertas A4</label>
                    <select value={orientasi} onChange={e => setOrientasi(e.target.value)} disabled className="form-input" style={{ backgroundColor: '#eee', cursor: 'not-allowed' }}>
                      <option value="portrait">A4 Portrait (Berdiri)</option><option value="landscape">A4 Landscape (Mendatar)</option>
                    </select>
                    <span style={{ fontSize: '0.68rem', color: '#888' }}>*Diatur oleh Komisariat</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Masa Khidmat Rayon</label>
                    <input type="text" placeholder="Misal: 2024-2025" value={masaKhidmat} onChange={e => setMasaKhidmat(e.target.value)} className="form-input" />
                  </div>
                </div>

                <h3 className="section-title">📅 Data Pelaksanaan & Penetapan</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tanggal Pelaksanaan Kegiatan</label>
                    <input type="text" placeholder="Misal: 16 - 17 Nov 2024" value={tanggalPelaksanaan} onChange={e => setTanggalPelaksanaan(e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
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
                  <div className="form-group">
                    <label className="form-label">Tgl Ditetapkan (Hijriyah)</label>
                    <input type="text" placeholder="Misal: 10 Jumadil Akhir 1446 H" value={tanggalHijriyah} onChange={e => setTanggalHijriyah(e.target.value)} className="form-input" />
                  </div>
                </div>

                <h3 className="section-title">✍️ Pengesahan Rayon</h3>
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Nama Ketua Rayon (Kapital)</label>
                    <input type="text" placeholder="Misal: ALFIAN FAHMI" value={namaKetuaRayon} onChange={e => setNamaKetuaRayon(e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Upload Stempel Rayon (PNG)</label>
                    <input type="file" accept="image/png" onChange={(e) => setFileStempel(e.target.files ? e.target.files[0] : null)} style={{ padding: '6px', border: '1px dashed #3498db', borderRadius: '8px', fontSize: '0.75rem', backgroundColor: '#f4f9fd', width: '100%', boxSizing: 'border-box' }} />
                    {(stempelUrl || fileStempel) && (
                      <div style={{ marginTop: '5px', padding: '5px', backgroundColor: '#eee', borderRadius: '6px', width: 'fit-content' }}>
                        <img src={fileStempel ? URL.createObjectURL(fileStempel) : stempelUrl} alt="Stempel" style={{ height: '35px', objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Upload Scan TTD Ketua Rayon (PNG)</label>
                    <input type="file" accept="image/png" onChange={(e) => setFileTtdRayon(e.target.files ? e.target.files[0] : null)} style={{ padding: '6px', border: '1px dashed #3498db', borderRadius: '8px', fontSize: '0.75rem', backgroundColor: '#f4f9fd', width: '100%', boxSizing: 'border-box' }} />
                    {(scanTtdRayonUrl || fileTtdRayon) && (
                      <div style={{ marginTop: '5px', padding: '5px', backgroundColor: '#eee', borderRadius: '6px', width: 'fit-content' }}>
                        <img src={fileTtdRayon ? URL.createObjectURL(fileTtdRayon) : scanTtdRayonUrl} alt="TTD Rayon" style={{ height: '35px', objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={handleSimpanPengaturan} disabled={isSavingSetting} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingSetting ? 'not-allowed' : 'pointer', fontSize: '0.85rem', marginTop: '10px', width: '100%', boxSizing: 'border-box' }}>
                  {isSavingSetting ? 'Menyimpan...' : '💾 Simpan Data Sertifikat'}
                </button>
              </div>

              {/* LIVE PREVIEW RAYON - SINKRON DENGAN KADER MENGGUNAKAN CONTAINER QUERY CQW */}
              <div className="card-panel" style={{ flex: '1 1 320px', backgroundColor: '#ecf0f1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3 className="section-title" style={{ width: '100%', borderBottom: 'none', marginBottom: '5px', textAlign: 'center' }}>👀 Live Preview Sertifikat</h3>
                <p style={{ fontSize: '0.75rem', color: '#777', marginBottom: '12px', textAlign: 'center' }}>Tata letak ditarik otomatis dari Master Komisariat.</p>
                
                <div style={{ 
                  position: 'relative', width: '100%', maxWidth: '550px', 
                  aspectRatio: aspectRatio,
                  backgroundColor: 'white', border: '2px solid #ccc', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', overflow: 'hidden',
                  containerType: 'inline-size'
                }}>
                  
                  {masterTemplate?.templateUrl ? (
                    <img src={masterTemplate.templateUrl} alt="Blanko Komisariat" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 1, pointerEvents: 'none' }} />
                  ) : (
                    <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem', zIndex: 1, padding: '15px', textAlign: 'center' }}>
                      ⚠️ Blanko kosong untuk {formJenjang} ({formAngkatan}) belum diatur oleh Komisariat.
                    </div>
                  )}

                  {/* Stempel Cabang */}
                  {masterTemplate?.stempelCabangUrl && (posisiMaster as any).stempelCabang && (
                    <div style={{ position: 'absolute', zIndex: 7, top: `${(posisiMaster as any).stempelCabang.top}%`, left: `${(posisiMaster as any).stempelCabang.left}%`, width: `${(posisiMaster as any).stempelCabang.width}%`, padding: '2px 4px' }}>
                      <img src={masterTemplate.stempelCabangUrl} alt="Stempel Cabang" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
                    </div>
                  )}
                  {/* Stempel Komisariat */}
                  {masterTemplate?.stempelKomisariatUrl && (posisiMaster as any).stempelKomisariat && (
                    <div style={{ position: 'absolute', zIndex: 7, top: `${(posisiMaster as any).stempelKomisariat.top}%`, left: `${(posisiMaster as any).stempelKomisariat.left}%`, width: `${(posisiMaster as any).stempelKomisariat.width}%`, padding: '2px 4px' }}>
                      <img src={masterTemplate.stempelKomisariatUrl} alt="Stempel Komisariat" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
                    </div>
                  )}
                  {/* Stempel Rayon */}
                  {(stempelUrl || masterTemplate?.posisi?.stempelRayon) && (posisiMaster as any).stempelRayon && (
                    <div style={{ position: 'absolute', zIndex: 7, top: `${(posisiMaster as any).stempelRayon.top}%`, left: `${(posisiMaster as any).stempelRayon.left}%`, width: `${(posisiMaster as any).stempelRayon.width}%`, padding: '2px 4px' }}>
                      {stempelUrl ? (
                        <img src={stempelUrl} alt="Stempel Rayon" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#2980b9' }}>[Stempel Rayon]</div>
                      )}
                    </div>
                  )}

                  {/* Scan TTD Cabang */}
                  {masterTemplate?.scanTtdCabangUrl && (posisiMaster as any).scanTtdCabang && (
                    <div style={{ position: 'absolute', zIndex: 6, top: `${(posisiMaster as any).scanTtdCabang.top}%`, left: `${(posisiMaster as any).scanTtdCabang.left}%`, width: `${(posisiMaster as any).scanTtdCabang.width}%`, padding: '2px 4px' }}>
                      <img src={masterTemplate.scanTtdCabangUrl} alt="Scan TTD Cabang" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                    </div>
                  )}
                  {/* Scan TTD Komisariat */}
                  {masterTemplate?.scanTtdKomisariatUrl && (posisiMaster as any).scanTtdKomisariat && (
                    <div style={{ position: 'absolute', zIndex: 6, top: `${(posisiMaster as any).scanTtdKomisariat.top}%`, left: `${(posisiMaster as any).scanTtdKomisariat.left}%`, width: `${(posisiMaster as any).scanTtdKomisariat.width}%`, padding: '2px 4px' }}>
                      <img src={masterTemplate.scanTtdKomisariatUrl} alt="Scan TTD Komisariat" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                    </div>
                  )}
                  {/* Scan TTD Rayon */}
                  {(scanTtdRayonUrl || masterTemplate?.posisi?.scanTtdRayon) && (posisiMaster as any).scanTtdRayon && (
                    <div style={{ position: 'absolute', zIndex: 6, top: `${(posisiMaster as any).scanTtdRayon.top}%`, left: `${(posisiMaster as any).scanTtdRayon.left}%`, width: `${(posisiMaster as any).scanTtdRayon.width}%`, padding: '2px 4px' }}>
                      {scanTtdRayonUrl ? (
                        <img src={scanTtdRayonUrl} alt="Scan TTD Rayon" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#e67e22' }}>[Scan TTD Rayon]</div>
                      )}
                    </div>
                  )}

                  {/* Render Teks Dinamis dengan Skala CQW */}
                  {Object.keys(posisiMaster).map(key => {
                    if (['stempelCabang', 'stempelKomisariat', 'stempelRayon', 'scanTtdCabang', 'scanTtdKomisariat', 'scanTtdRayon'].includes(key)) return null;
                    const p = (posisiMaster as any)[key];
                    if (!p) return null;
                    const isCenter = key === 'nomor';

                    return (
                      <div key={key} style={{ 
                        position: 'absolute', zIndex: 2, 
                        top: `${p.top}%`, left: `${p.left}%`, width: `${p.width || 60}%`, 
                        textAlign: p.align || (isCenter ? 'center' : 'left'), 
                        transform: isCenter ? 'translate(-50%, 0)' : 'none', 
                        fontFamily: '"Arial Narrow", sans-serif', 
                        fontSize: `${(p.fontSize || 14) / 6.5}cqw`, 
                        fontWeight: p.isBold ? 'bold' : 'normal', fontStyle: p.isItalic ? 'italic' : 'normal',
                        color: '#000', lineHeight: '1.3',
                        padding: '2px 4px', border: '1px solid transparent', margin: 0
                      }}>
                        <div dangerouslySetInnerHTML={{ __html: getRayonDataTeks(key) }} />
                      </div>
                    );
                  })}

                </div>
              </div>

            </div>
          </>
        ) : (
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 className="section-title" style={{ margin: 0, borderBottom: 'none' }}>
                📋 Daftar Kader ({formJenjang} - {formAngkatan})
              </h3>
              <input 
                type="text" 
                placeholder="Cari Nama / NIM / No Sertifikat..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="form-input" 
                style={{ width: '100%', maxWidth: '260px', padding: '8px 12px' }} 
              />
            </div>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Kader</th>
                    <th>NIM / NIA</th>
                    <th>No. Sertifikat</th>
                    <th>NIK</th>
                    <th>Jurusan / PT</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKader.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#777', padding: '20px' }}>
                        Belum ada data kader untuk jenjang <b>{formJenjang}</b> angkatan <b>{formAngkatan}</b>.
                      </td>
                    </tr>
                  ) : (
                    filteredKader.map((k, idx) => (
                      <tr key={k.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{k.nama}</td>
                        <td>{k.nim} / {k.nia || '-'}</td>
                        <td><span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{k.nomor_sertifikat || 'Belum Ada'}</span></td>
                        <td>{k.nik}</td>
                        <td>{k.jurusan} <br/><span style={{ color: '#666', fontSize: '0.75rem' }}>{k.pt}</span></td>
                        <td style={{ textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button onClick={() => { setSelectedKaderEdit(k); setModalEditOpen(true); }} className="action-btn" style={{ background: '#f59e0b', color: '#fff' }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => handleHapusKader(k.id)} className="action-btn" style={{ background: '#ef4444', color: '#fff' }}>
                            🗑️ Hapus
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

      </div>

      {modalEditOpen && selectedKaderEdit && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#0d1b2a', borderBottom: '2px solid #f0f4f8', paddingBottom: '8px' }}>
              ✏️ Edit Kelengkapan Sertifikat Kader
            </h3>
            
            <form onSubmit={handleSimpanEditKader} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Nama Kader</label>
                <input type="text" value={selectedKaderEdit.nama || ''} onChange={e => setSelectedKaderEdit({...selectedKaderEdit, nama: e.target.value})} className="form-input" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">NIM</label>
                  <input type="text" value={selectedKaderEdit.nim || ''} onChange={e => setSelectedKaderEdit({...selectedKaderEdit, nim: e.target.value})} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">NIA</label>
                  <input type="text" value={selectedKaderEdit.nia || ''} onChange={e => setSelectedKaderEdit({...selectedKaderEdit, nia: e.target.value})} className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nomor Sertifikat</label>
                <input type="text" value={selectedKaderEdit.nomor_sertifikat || ''} onChange={e => setSelectedKaderEdit({...selectedKaderEdit, nomor_sertifikat: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">NIK</label>
                <input type="text" value={selectedKaderEdit.nik || ''} onChange={e => setSelectedKaderEdit({...selectedKaderEdit, nik: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Tempat, Tanggal Lahir</label>
                <input type="text" value={selectedKaderEdit.ttl || ''} onChange={e => setSelectedKaderEdit({...selectedKaderEdit, ttl: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Jurusan</label>
                <input type="text" value={selectedKaderEdit.jurusan || ''} onChange={e => setSelectedKaderEdit({...selectedKaderEdit, jurusan: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Perguruan Tinggi</label>
                <input type="text" value={selectedKaderEdit.pt || ''} onChange={e => setSelectedKaderEdit({...selectedKaderEdit, pt: e.target.value})} className="form-input" />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => { setModalEditOpen(false); setSelectedKaderEdit(null); }} style={{ padding: '8px 14px', borderRadius: '6px', background: '#cbd5e1', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Batal
                </button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', background: '#0000af', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}