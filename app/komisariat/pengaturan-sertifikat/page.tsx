'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PagePengaturanSertifikatKomisariat() {
  const [adminKomisariatId, setAdminKomisariatId] = useState('');
  
  const [formJenjang, setFormJenjang] = useState('MAPABA');
  const [formAngkatan, setFormAngkatan] = useState(new Date().getFullYear().toString());
  const [orientasi, setOrientasi] = useState('portrait');
  const [templateUrl, setTemplateUrl] = useState('');
  const [fileTemplate, setFileTemplate] = useState<File | null>(null);

  const [namaKetuaCabang, setNamaKetuaCabang] = useState('');
  const [stempelCabangUrl, setStempelCabangUrl] = useState('');
  const [fileStempelCabang, setFileStempelCabang] = useState<File | null>(null);
  const [scanTtdCabangUrl, setScanTtdCabangUrl] = useState('');
  const [fileScanTtdCabang, setFileScanTtdCabang] = useState<File | null>(null);

  const [namaKetuaKomisariat, setNamaKetuaKomisariat] = useState('');
  const [stempelKomisariatUrl, setStempelKomisariatUrl] = useState('');
  const [fileStempelKomisariat, setFileStempelKomisariat] = useState<File | null>(null);
  const [scanTtdKomisariatUrl, setScanTtdKomisariatUrl] = useState('');
  const [fileScanTtdKomisariat, setFileScanTtdKomisariat] = useState<File | null>(null);

  const [copyJenjang, setCopyJenjang] = useState('MAPABA');
  const [copyAngkatan, setCopyAngkatan] = useState(new Date().getFullYear().toString());

  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const defaultPosisi = {
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
    stempelCabang: { left: 15, top: 78.0, width: 15, fontSize: 12 },
    stempelKomisariat: { left: 45, top: 78.0, width: 15, fontSize: 12 },
    stempelRayon: { left: 75, top: 78.0, width: 15, fontSize: 12 },
    scanTtdCabang: { left: 20, top: 82.0, width: 18, fontSize: 12 },
    scanTtdKomisariat: { left: 50, top: 82.0, width: 18, fontSize: 12 },
    scanTtdRayon: { left: 80, top: 82.0, width: 18, fontSize: 12 }
  };
  
  const [posisi, setPosisi] = useState(defaultPosisi);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            setAdminKomisariatId(snapRole.docs[0].data().username);
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!adminKomisariatId) return;
    const docId = `${adminKomisariatId}_${formJenjang}_${formAngkatan}`;
    
    const unsub = onSnapshot(doc(db, "master_template_sertifikat", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTemplateUrl(data.templateUrl || '');
        setOrientasi(data.orientasi || 'portrait');
        setNamaKetuaCabang(data.namaKetuaCabang || '');
        setStempelCabangUrl(data.stempelCabangUrl || '');
        setScanTtdCabangUrl(data.scanTtdCabangUrl || '');
        setNamaKetuaKomisariat(data.namaKetuaKomisariat || '');
        setStempelKomisariatUrl(data.stempelKomisariatUrl || '');
        setScanTtdKomisariatUrl(data.scanTtdKomisariatUrl || '');
        
        if (data.posisi) {
          const loadedPosisi = data.posisi;
          Object.keys(defaultPosisi).forEach(k => {
            if (loadedPosisi[k]) {
               if (loadedPosisi[k].fontSize === undefined) loadedPosisi[k].fontSize = 14;
               if (loadedPosisi[k].width === undefined) loadedPosisi[k].width = (defaultPosisi as any)[k].width || 60;
               if (loadedPosisi[k].align === undefined) loadedPosisi[k].align = (defaultPosisi as any)[k].align || 'left';
               if (loadedPosisi[k].isBold === undefined) loadedPosisi[k].isBold = false;
               if (loadedPosisi[k].isItalic === undefined) loadedPosisi[k].isItalic = false;
            } else {
               loadedPosisi[k] = defaultPosisi[k as keyof typeof defaultPosisi];
            }
          });
          setPosisi(loadedPosisi as typeof defaultPosisi);
        } else {
          setPosisi(defaultPosisi);
        }
      } else {
        setTemplateUrl('');
        setOrientasi('portrait');
        setPosisi(defaultPosisi);
        setNamaKetuaCabang(''); setStempelCabangUrl(''); setScanTtdCabangUrl('');
        setNamaKetuaKomisariat(''); setStempelKomisariatUrl(''); setScanTtdKomisariatUrl('');
      }
    });
    return () => unsub();
  }, [adminKomisariatId, formJenjang, formAngkatan]);

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
      let finalTemplate = templateUrl;
      let finalStempelCab = stempelCabangUrl;
      let finalScanTtdCab = scanTtdCabangUrl;
      let finalStempelKom = stempelKomisariatUrl;
      let finalScanTtdKom = scanTtdKomisariatUrl;

      if (fileTemplate) finalTemplate = await uploadToCloudinary(fileTemplate);
      if (fileStempelCabang) finalStempelCab = await uploadToCloudinary(fileStempelCabang);
      if (fileScanTtdCabang) finalScanTtdCab = await uploadToCloudinary(fileScanTtdCabang);
      if (fileStempelKomisariat) finalStempelKom = await uploadToCloudinary(fileStempelKomisariat);
      if (fileScanTtdKomisariat) finalScanTtdKom = await uploadToCloudinary(fileScanTtdKomisariat);
      
      const docId = `${adminKomisariatId}_${formJenjang}_${formAngkatan}`;
      await setDoc(doc(db, "master_template_sertifikat", docId), {
        id_komisariat: adminKomisariatId,
        jenjang: formJenjang,
        angkatan: formAngkatan,
        orientasi, 
        posisi,
        templateUrl: finalTemplate, 
        namaKetuaCabang, stempelCabangUrl: finalStempelCab, scanTtdCabangUrl: finalScanTtdCab,
        namaKetuaKomisariat, stempelKomisariatUrl: finalStempelKom, scanTtdKomisariatUrl: finalScanTtdKom,
        updatedAt: Date.now()
      }, { merge: true });
      
      alert("Master Template & Koordinat Sertifikat berhasil disimpan!");
      setFileTemplate(null); setFileStempelCabang(null); setFileScanTtdCabang(null); setFileStempelKomisariat(null); setFileScanTtdKomisariat(null);
    } catch (error) { alert("Gagal menyimpan pengaturan."); } finally { setIsSavingSetting(false); }
  };

  const handleSalinTemplateMaster = async () => {
    if (!adminKomisariatId) return;
    const sourceDocId = `${adminKomisariatId}_${copyJenjang}_${copyAngkatan}`;
    const sourceRef = doc(db, "master_template_sertifikat", sourceDocId);
    const sourceSnap = await getDoc(sourceRef);
    if (sourceSnap.exists()) {
      const data = sourceSnap.data();
      if (data.posisi) setPosisi(data.posisi);
      if (data.orientasi) setOrientasi(data.orientasi);
      if (data.namaKetuaCabang) setNamaKetuaCabang(data.namaKetuaCabang);
      if (data.namaKetuaKomisariat) setNamaKetuaKomisariat(data.namaKetuaKomisariat);
      if (data.stempelCabangUrl) setStempelCabangUrl(data.stempelCabangUrl);
      if (data.scanTtdCabangUrl) setScanTtdCabangUrl(data.scanTtdCabangUrl);
      if (data.stempelKomisariatUrl) setStempelKomisariatUrl(data.stempelKomisariatUrl);
      if (data.scanTtdKomisariatUrl) setScanTtdKomisariatUrl(data.scanTtdKomisariatUrl);
      if (data.templateUrl) setTemplateUrl(data.templateUrl);
      alert(`Berhasil menyalin seluruh koordinat & pengaturan dari ${copyJenjang} (${copyAngkatan})!`);
    } else {
      alert(`Template master untuk ${copyJenjang} (${copyAngkatan}) belum tersedia.`);
    }
  };

  const updatePosisi = (field: string, prop: string, value: any) => {
    setPosisi({ ...posisi, [field]: { ...posisi[field as keyof typeof posisi], [prop]: value } });
  };

  const handleMouseDown = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setDraggingKey(key);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingKey) return;
    const canvasEl = document.getElementById('preview-canvas-box');
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();

    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    let newLeft = (xPx / rect.width) * 100;
    let newTop = (yPx / rect.height) * 100;

    newLeft = Math.max(0, Math.min(95, newLeft));
    newTop = Math.max(0, Math.min(95, newTop));

    updatePosisi(draggingKey, 'left', Number(newLeft.toFixed(1)));
    updatePosisi(draggingKey, 'top', Number(newTop.toFixed(1)));
  };

  const handleMouseUp = () => {
    setDraggingKey(null);
  };

  const isPortrait = orientasi === 'portrait';
  const aspectRatio = isPortrait ? '1 / 1.414' : '1.414 / 1';

  return (
    <>
      <style>{`
        .pengaturan-komisariat-wrapper { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
        .card-panel { background: #ffffff; padding: 20px 25px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 0.75rem; font-weight: bold; color: #555; text-transform: uppercase; }
        .form-input { padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.85rem; color: #333; outline: none; background-color: #fafafa; width: 100%; box-sizing: border-box; }
        .form-input:focus { border-color: #0000af; background-color: #fff; }
        .section-title { font-size: 1rem; color: #0d1b2a; margin: 0 0 15px 0; font-weight: bold; padding-bottom: 10px; border-bottom: 2px solid #f0f4f8; }
        .kordinat-row { display: grid; grid-template-columns: 130px 1fr 1fr 1fr 1fr 1fr 60px; gap: 6px; align-items: center; background-color: #fff; padding: 8px; border: 1px solid #eaeaea; border-radius: 8px; font-size: 0.72rem; margin-bottom: 8px; }
        @media (max-width: 1000px) { .kordinat-row { grid-template-columns: 1fr; gap: 6px; } }
      `}</style>

      <div className="pengaturan-komisariat-wrapper">
        
        <div className="card-panel">
          <h3 className="section-title">📂 Target Template Master Sertifikat</h3>
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
          </div>

          <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#f4f6f8', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#333' }}>⚡ Salin Pengaturan Koordinat dari:</span>
            <select value={copyJenjang} onChange={e => setCopyJenjang(e.target.value)} className="form-input" style={{ width: '130px', padding: '6px' }}>
              <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option>
            </select>
            <input type="number" value={copyAngkatan} onChange={e => setCopyAngkatan(e.target.value)} className="form-input" style={{ width: '90px', padding: '6px' }} />
            <button onClick={handleSalinTemplateMaster} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
              📥 Terapkan Koordinat Ini
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          
          <div className="card-panel" style={{ flex: '1 1 540px', display: 'flex', flexDirection: 'column' }}>
            
            <h3 className="section-title">🖼️ Upload Blanko, Stempel & Scan TTD</h3>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Upload Blanko Kosong (Background Sertifikat)</label>
                <input type="file" accept="image/*" onChange={(e) => setFileTemplate(e.target.files ? e.target.files[0] : null)} className="form-input" style={{ border: '1px dashed #3498db' }} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Nama Ketua Cabang</label>
                <input type="text" placeholder="DIKY WAHYU FIRMANSYAH" value={namaKetuaCabang} onChange={e => setNamaKetuaCabang(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Stempel Cabang (PNG)</label>
                <input type="file" accept="image/png" onChange={(e) => setFileStempelCabang(e.target.files ? e.target.files[0] : null)} className="form-input" style={{ fontSize: '0.75rem' }} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Scan TTD Cabang (PNG Transparan)</label>
                <input type="file" accept="image/png" onChange={(e) => setFileScanTtdCabang(e.target.files ? e.target.files[0] : null)} className="form-input" style={{ fontSize: '0.75rem', border: '1px dashed #e67e22' }} />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Ketua Komisariat</label>
                <input type="text" placeholder="LASKHA SHAKIERA" value={namaKetuaKomisariat} onChange={e => setNamaKetuaKomisariat(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Stempel Komisariat (PNG)</label>
                <input type="file" accept="image/png" onChange={(e) => setFileStempelKomisariat(e.target.files ? e.target.files[0] : null)} className="form-input" style={{ fontSize: '0.75rem' }} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Scan TTD Komisariat (PNG Transparan)</label>
                <input type="file" accept="image/png" onChange={(e) => setFileScanTtdKomisariat(e.target.files ? e.target.files[0] : null)} className="form-input" style={{ fontSize: '0.75rem', border: '1px dashed #e67e22' }} />
              </div>
            </div>

            <h3 className="section-title" style={{ marginTop: '10px' }}>🛠️ Pengatur Koordinat, Ukuran & Posisi Stempel / TTD</h3>
            <div style={{ backgroundColor: '#f9f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
              {Object.keys(posisi).map((key) => {
                const p = (posisi as any)[key] || {};
                return (
                  <div key={key} className="kordinat-row">
                    <strong style={{ textTransform: 'capitalize', color: '#0d1b2a' }}>{key}</strong>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <span style={{ color: '#777', fontWeight: 'bold' }}>X:</span>
                      <input type="number" step="0.1" value={p.left ?? ''} onChange={e => updatePosisi(key, 'left', Number(e.target.value))} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} />%
                    </div>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <span style={{ color: '#777', fontWeight: 'bold' }}>Y:</span>
                      <input type="number" step="0.1" value={p.top ?? ''} onChange={e => updatePosisi(key, 'top', Number(e.target.value))} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} />%
                    </div>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <span style={{ color: '#777', fontWeight: 'bold' }}>W:</span>
                      <input type="number" step="1" value={p.width ?? ''} onChange={e => updatePosisi(key, 'width', Number(e.target.value))} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} />%
                    </div>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <span style={{ color: '#777', fontWeight: 'bold' }}>Sz:</span>
                      <input type="number" value={p.fontSize ?? ''} onChange={e => updatePosisi(key, 'fontSize', Number(e.target.value))} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <select value={p.align || 'left'} onChange={e => updatePosisi(key, 'align', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.7rem' }}>
                        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '1px', cursor: 'pointer', fontWeight: 'bold', color: p.isBold ? '#0000af' : '#777' }}>
                        <input type="checkbox" checked={!!p.isBold} onChange={e => updatePosisi(key, 'isBold', e.target.checked)} /> B
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={handleSimpanPengaturan} disabled={isSavingSetting} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingSetting ? 'not-allowed' : 'pointer', fontSize: '0.9rem', marginTop: '20px', boxShadow: '0 4px 6px rgba(0,0,175,0.1)' }}>
              {isSavingSetting ? 'Mengupload & Menyimpan...' : '💾 Simpan Template Master Komisariat'}
            </button>
          </div>

          {/* LIVE PREVIEW KOMISARIAT - MENGGUNAKAN CONTAINER QUERY CQW AGAR 100% SINKRON DENGAN KADER */}
          <div className="card-panel" style={{ flex: '1 1 450px', backgroundColor: '#ecf0f1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 className="section-title" style={{ width: '100%', borderBottom: 'none', textAlign: 'center' }}>👀 Live Preview Master (Bisa Diseret)</h3>
            <p style={{ fontSize: '0.75rem', color: '#777', marginBottom: '15px', textAlign: 'center' }}>Klik dan seret teks, stempel, maupun scan TTD langsung pada kanvas untuk mengatur posisinya.</p>
            
            <div 
              id="preview-canvas-box"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ 
                position: 'relative', width: '100%', maxWidth: '550px', 
                aspectRatio: aspectRatio,
                backgroundColor: 'white', border: '2px solid #ccc', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', overflow: 'hidden', cursor: draggingKey ? 'grabbing' : 'default',
                containerType: 'inline-size'
              }}
            >
              
              {(templateUrl || fileTemplate) ? (
                <img src={fileTemplate ? URL.createObjectURL(fileTemplate) : templateUrl} alt="Template" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 1, pointerEvents: 'none' }} />
              ) : (
                <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', zIndex: 1, pointerEvents: 'none' }}>
                  - Belum ada blanko kosong diupload -
                </div>
              )}
              
              {/* Stempel Cabang */}
              {(fileStempelCabang ? URL.createObjectURL(fileStempelCabang) : stempelCabangUrl) && (posisi as any).stempelCabang && (
                <div onMouseDown={e => handleMouseDown(e, 'stempelCabang')} style={{ position: 'absolute', zIndex: 7, top: `${(posisi as any).stempelCabang.top}%`, left: `${(posisi as any).stempelCabang.left}%`, width: `${(posisi as any).stempelCabang.width}%`, cursor: 'grab', padding: '2px 4px' }}>
                  <img src={fileStempelCabang ? URL.createObjectURL(fileStempelCabang) : stempelCabangUrl} alt="Stempel Cabang" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none', opacity: 0.85 }} />
                </div>
              )}
              {/* Stempel Komisariat */}
              {(fileStempelKomisariat ? URL.createObjectURL(fileStempelKomisariat) : stempelKomisariatUrl) && (posisi as any).stempelKomisariat && (
                <div onMouseDown={e => handleMouseDown(e, 'stempelKomisariat')} style={{ position: 'absolute', zIndex: 7, top: `${(posisi as any).stempelKomisariat.top}%`, left: `${(posisi as any).stempelKomisariat.left}%`, width: `${(posisi as any).stempelKomisariat.width}%`, cursor: 'grab', padding: '2px 4px' }}>
                  <img src={fileStempelKomisariat ? URL.createObjectURL(fileStempelKomisariat) : stempelKomisariatUrl} alt="Stempel Komisariat" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none', opacity: 0.85 }} />
                </div>
              )}
              {/* Stempel Rayon Placeholder */}
              {(posisi as any).stempelRayon && (
                <div onMouseDown={e => handleMouseDown(e, 'stempelRayon')} style={{ position: 'absolute', zIndex: 7, top: `${(posisi as any).stempelRayon.top}%`, left: `${(posisi as any).stempelRayon.left}%`, width: `${(posisi as any).stempelRayon.width}%`, cursor: 'grab', padding: '2px 4px', textAlign: 'center', fontSize: '0.65rem', color: '#2980b9' }}>
                  [Stempel Rayon]
                </div>
              )}

              {/* Scan TTD Cabang */}
              {(fileScanTtdCabang ? URL.createObjectURL(fileScanTtdCabang) : scanTtdCabangUrl) && (posisi as any).scanTtdCabang && (
                <div onMouseDown={e => handleMouseDown(e, 'scanTtdCabang')} style={{ position: 'absolute', zIndex: 6, top: `${(posisi as any).scanTtdCabang.top}%`, left: `${(posisi as any).scanTtdCabang.left}%`, width: `${(posisi as any).scanTtdCabang.width}%`, cursor: 'grab', padding: '2px 4px' }}>
                  <img src={fileScanTtdCabang ? URL.createObjectURL(fileScanTtdCabang) : scanTtdCabangUrl} alt="Scan TTD Cabang" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                </div>
              )}
              {/* Scan TTD Komisariat */}
              {(fileScanTtdKomisariat ? URL.createObjectURL(fileScanTtdKomisariat) : scanTtdKomisariatUrl) && (posisi as any).scanTtdKomisariat && (
                <div onMouseDown={e => handleMouseDown(e, 'scanTtdKomisariat')} style={{ position: 'absolute', zIndex: 6, top: `${(posisi as any).scanTtdKomisariat.top}%`, left: `${(posisi as any).scanTtdKomisariat.left}%`, width: `${(posisi as any).scanTtdKomisariat.width}%`, cursor: 'grab', padding: '2px 4px' }}>
                  <img src={fileScanTtdKomisariat ? URL.createObjectURL(fileScanTtdKomisariat) : scanTtdKomisariatUrl} alt="Scan TTD Komisariat" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                </div>
              )}
              {/* Scan TTD Rayon Placeholder */}
              {(posisi as any).scanTtdRayon && (
                <div onMouseDown={e => handleMouseDown(e, 'scanTtdRayon')} style={{ position: 'absolute', zIndex: 6, top: `${(posisi as any).scanTtdRayon.top}%`, left: `${(posisi as any).scanTtdRayon.left}%`, width: `${(posisi as any).scanTtdRayon.width}%`, cursor: 'grab', padding: '2px 4px', textAlign: 'center', fontSize: '0.65rem', color: '#e67e22' }}>
                  [Scan TTD Rayon]
                </div>
              )}

              {/* Render Teks Master dengan Skala CQW */}
              {Object.keys(posisi).map(key => {
                if (['stempelCabang', 'stempelKomisariat', 'stempelRayon', 'scanTtdCabang', 'scanTtdKomisariat', 'scanTtdRayon'].includes(key)) return null;
                const p = (posisi as any)[key];
                if (!p) return null;
                const isCenter = key === 'nomor';

                let renderContent = '';
                if (key === 'nomor') renderContent = `10/${formJenjang}-X/${formAngkatan}`;
                else if (key === 'teksPembuka') renderContent = `Yang bertanda tangan di bawah ini Pengurus Rayon Pergerakan Mahasiswa Islam Indonesia "KAWAH" Chondrodimuko Komisariat Sunan Ampel Malang masa khidmat 2024-2025 memberikan status <b>ANGGOTA PMII</b> kepada :`;
                else if (key === 'nama') renderContent = 'AHMAD ALBERT AFRILSYAH';
                else if (key === 'nik') renderContent = '35730123456789';
                else if (key === 'ttl') renderContent = 'MALANG, 10 AGUSTUS 2002';
                else if (key === 'jurusan') renderContent = 'TEKNIK INFORMATIKA';
                else if (key === 'pt') renderContent = 'UNIVERSITAS ISLAM NEGERI MAULANA MALIK IBRAHIM MALANG';
                else if (key === 'teksKelulusan') renderContent = `Bahwa nama yang disebutkan diatas telah Lulus ${formJenjang === 'PKD' ? 'Pelatihan Kader Dasar (PKD)' : 'Masa Penerimaan Anggota Baru (MAPABA)'} pada tanggal 16 - 20 Oktober 2026 yang dilaksanakan di MTs Ma'arif NU Kota Malang oleh Pengurus Rayon Pergerakan Mahasiswa Islam Indonesia "KAWAH" Chondrodimuko.`;
                else if (key === 'penetapan') renderContent = `<div>Kota Malang</div><div style="border-bottom: 1.2px solid #000; padding-bottom: 1px; margin-bottom: 1px">12 Desember 2026 M</div><div>12 Jumadil Awal 1449 H</div>`;
                
                else if (key === 'ttdCabang') renderContent = `<span style="font-weight: bold;">${namaKetuaCabang || 'NAMA KETUA PC'}</span><br/><span style="font-weight: normal;">Ketua PC. PMII Kota Malang</span>`;
                else if (key === 'ttdKomisariat') renderContent = `<span style="font-weight: bold;">${namaKetuaKomisariat || 'NAMA KETUA PK'}</span><br/><span style="font-weight: normal;">Ketua PK. PMII Sunan Ampel Malang</span>`;
                else if (key === 'ttdRayon') renderContent = `<span style="font-weight: bold;">NAMA KETUA RAYON</span><br/><span style="font-weight: normal;">Ketua Rayon PMII</span>`;

                return (
                  <div key={key} onMouseDown={e => handleMouseDown(e, key)} style={{ 
                    position: 'absolute', zIndex: 2, 
                    top: `${p.top}%`, left: `${p.left}%`, width: `${p.width || 60}%`,
                    textAlign: p.align || (isCenter ? 'center' : 'left'),
                    transform: isCenter ? 'translate(-50%, 0)' : 'none', cursor: 'grab',
                    fontFamily: '"Arial Narrow", sans-serif',
                    fontSize: `${(p.fontSize || 14) / 6.5}cqw`, 
                    fontWeight: p.isBold ? 'bold' : 'normal',
                    fontStyle: p.isItalic ? 'italic' : 'normal',
                    color: '#000', lineHeight: '1.3',
                    border: '1px dashed rgba(255,0,0,0.5)', background: 'rgba(255,255,255,0.6)', padding: '2px 4px', margin: 0
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: renderContent }} />
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