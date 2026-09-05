'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PagePengaturanSertifikatKomisariat() {
  const [adminKomisariatId, setAdminKomisariatId] = useState('');
  
  // State Konfigurasi Utama
  const [formJenjang, setFormJenjang] = useState('MAPABA');
  const [formAngkatan, setFormAngkatan] = useState(new Date().getFullYear().toString());
  const [orientasi, setOrientasi] = useState('portrait');
  const [templateUrl, setTemplateUrl] = useState('');
  const [fileTemplate, setFileTemplate] = useState<File | null>(null);

  // State Pengesahan
  const [namaKetuaCabang, setNamaKetuaCabang] = useState('');
  const [stempelCabangUrl, setStempelCabangUrl] = useState('');
  const [fileStempelCabang, setFileStempelCabang] = useState<File | null>(null);

  const [namaKetuaKomisariat, setNamaKetuaKomisariat] = useState('');
  const [stempelKomisariatUrl, setStempelKomisariatUrl] = useState('');
  const [fileStempelKomisariat, setFileStempelKomisariat] = useState<File | null>(null);

  const [isSavingSetting, setIsSavingSetting] = useState(false);

  // Default Kordinat Posisi
  const defaultPosisi = {
    nomor: { left: 53, top: 21.4, fontSize: 12, isBold: true, isItalic: false },
    nama: { left: 33, top: 38.4, fontSize: 14, isBold: true, isItalic: false },
    nik: { left: 33, top: 41.2, fontSize: 12, isBold: true, isItalic: false },
    ttl: { left: 33, top: 44.0, fontSize: 12, isBold: true, isItalic: false },
    jurusan: { left: 33, top: 47.0, fontSize: 12, isBold: true, isItalic: false },
    pt: { left: 33, top: 49.8, fontSize: 12, isBold: true, isItalic: false },
    ttdCabang: { left: 20, top: 82.0, fontSize: 12, isBold: true, isItalic: false },
    ttdKomisariat: { left: 50, top: 82.0, fontSize: 12, isBold: true, isItalic: false }
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
    
    // Master Template disimpan di collection terpusat agar bisa ditarik oleh Rayon nanti
    const unsub = onSnapshot(doc(db, "master_template_sertifikat", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTemplateUrl(data.templateUrl || '');
        setOrientasi(data.orientasi || 'portrait');
        setNamaKetuaCabang(data.namaKetuaCabang || '');
        setStempelCabangUrl(data.stempelCabangUrl || '');
        setNamaKetuaKomisariat(data.namaKetuaKomisariat || '');
        setStempelKomisariatUrl(data.stempelKomisariatUrl || '');
        
        if (data.posisi) {
          const loadedPosisi = data.posisi;
          Object.keys(defaultPosisi).forEach(k => {
            if (loadedPosisi[k]) {
               if (loadedPosisi[k].fontSize === undefined) loadedPosisi[k].fontSize = 12;
               if (loadedPosisi[k].isBold === undefined) loadedPosisi[k].isBold = true;
               if (loadedPosisi[k].isItalic === undefined) loadedPosisi[k].isItalic = false;
            } else {
               loadedPosisi[k] = defaultPosisi[k as keyof typeof defaultPosisi];
            }
          });
          setPosisi(loadedPosisi as typeof defaultPosisi);
        }
      } else {
        setTemplateUrl('');
        setOrientasi('portrait');
        setPosisi(defaultPosisi);
        setNamaKetuaCabang(''); setStempelCabangUrl('');
        setNamaKetuaKomisariat(''); setStempelKomisariatUrl('');
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
      let finalStempelKom = stempelKomisariatUrl;

      if (fileTemplate) finalTemplate = await uploadToCloudinary(fileTemplate);
      if (fileStempelCabang) finalStempelCab = await uploadToCloudinary(fileStempelCabang);
      if (fileStempelKomisariat) finalStempelKom = await uploadToCloudinary(fileStempelKomisariat);
      
      const docId = `${adminKomisariatId}_${formJenjang}_${formAngkatan}`;
      await setDoc(doc(db, "master_template_sertifikat", docId), {
        id_komisariat: adminKomisariatId,
        jenjang: formJenjang,
        angkatan: formAngkatan,
        orientasi, 
        posisi,
        templateUrl: finalTemplate, 
        namaKetuaCabang, stempelCabangUrl: finalStempelCab,
        namaKetuaKomisariat, stempelKomisariatUrl: finalStempelKom,
        updatedAt: Date.now()
      }, { merge: true });
      
      alert("Template & Koordinat Sertifikat berhasil disimpan!");
      setFileTemplate(null); setFileStempelCabang(null); setFileStempelKomisariat(null);
    } catch (error) { alert("Gagal menyimpan pengaturan."); } finally { setIsSavingSetting(false); }
  };

  const updatePosisi = (field: string, prop: string, value: any) => {
    setPosisi({ ...posisi, [field]: { ...posisi[field as keyof typeof posisi], [prop]: value } });
  };

  const aspectRatio = orientasi === 'portrait' ? '1 / 1.414' : '1.414 / 1';
  const fontScaleCqw = orientasi === 'portrait' ? 0.168 : 0.1188;

  const mockData = {
    nomor: '10/MAPABA-X/2026',
    nama: 'Ahmad Albert Afrilsyah',
    nik: '35730123456789',
    ttl: 'Malang, 10 Agustus 2002',
    jurusan: 'Teknik Informatika',
    pt: 'UIN Maulana Malik Ibrahim',
    ttdCabang: namaKetuaCabang || 'KETUA CABANG',
    ttdKomisariat: namaKetuaKomisariat || 'KETUA KOMISARIAT'
  };

  return (
    <>
      <style>{`
        .pengaturan-komisariat-wrapper { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
        .card-panel { background: #ffffff; padding: 20px 25px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 0.75rem; font-weight: bold; color: #555; text-transform: uppercase; }
        .form-input { padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.85rem; color: #333; outline: none; background-color: #fafafa; }
        .form-input:focus { border-color: #0000af; background-color: #fff; }
        
        .section-title { font-size: 1rem; color: #0d1b2a; margin: 0 0 15px 0; font-weight: bold; padding-bottom: 10px; border-bottom: 2px solid #f0f4f8; }
        
        .kordinat-row { display: grid; grid-template-columns: 80px 1fr 1fr 1fr 60px; gap: 10px; alignItems: center; background-color: #fff; padding: 10px; border: 1px solid #eaeaea; border-radius: 8px; font-size: 0.8rem; margin-bottom: 8px; }
        
        @media (max-width: 768px) {
          .pengaturan-komisariat-wrapper { gap: 15px; padding: 5px; }
          .card-panel { padding: 15px; }
          .kordinat-row { grid-template-columns: 1fr; gap: 8px; }
        }
      `}</style>

      <div className="pengaturan-komisariat-wrapper">
        
        {/* HEADER KONTROL UTAMA */}
        <div className="card-panel">
          <h3 className="section-title">📂 Target Template Master</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Jenjang Kaderisasi</label>
              <select value={formJenjang} onChange={e => setFormJenjang(e.target.value)} className="form-input">
                <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option>
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
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* KOLOM KIRI: SETTING LAYOUT & KOORDINAT */}
          <div className="card-panel" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column' }}>
            
            <h3 className="section-title">🖼️ Upload Desain Utama & Pengesahan</h3>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Upload Template Kosong (Background Dasar)</label>
                <input type="file" accept="image/*" onChange={(e) => setFileTemplate(e.target.files ? e.target.files[0] : null)} className="form-input" style={{ border: '1px dashed #3498db' }} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Nama Ketua Cabang</label>
                <input type="text" placeholder="KAPITAL" value={namaKetuaCabang} onChange={e => setNamaKetuaCabang(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Stempel Cabang (PNG)</label>
                <input type="file" accept="image/png" onChange={(e) => setFileStempelCabang(e.target.files ? e.target.files[0] : null)} className="form-input" style={{ fontSize: '0.75rem' }} />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Ketua Komisariat</label>
                <input type="text" placeholder="KAPITAL" value={namaKetuaKomisariat} onChange={e => setNamaKetuaKomisariat(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Stempel Komisariat (PNG)</label>
                <input type="file" accept="image/png" onChange={(e) => setFileStempelKomisariat(e.target.files ? e.target.files[0] : null)} className="form-input" style={{ fontSize: '0.75rem' }} />
              </div>
            </div>

            <h3 className="section-title" style={{ marginTop: '10px' }}>🛠️ Pengatur Koordinat & Font (Arial Narrow)</h3>
            <div style={{ backgroundColor: '#f9f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
              {Object.keys(posisi).map((key) => {
                const p = (posisi as any)[key];
                return (
                  <div key={key} className="kordinat-row">
                    <strong style={{ textTransform: 'capitalize', color: '#0d1b2a' }}>{key}</strong>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: '#777', fontWeight: 'bold' }}>X:</span>
                      <input type="number" step="0.1" value={p.left} onChange={e => updatePosisi(key, 'left', Number(e.target.value))} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />%
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: '#777', fontWeight: 'bold' }}>Y:</span>
                      <input type="number" step="0.1" value={p.top} onChange={e => updatePosisi(key, 'top', Number(e.target.value))} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />%
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: '#777', fontWeight: 'bold' }}>Size:</span>
                      <input type="number" value={p.fontSize} onChange={e => updatePosisi(key, 'fontSize', Number(e.target.value))} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold', color: p.isBold ? '#0000af' : '#777' }}>
                        <input type="checkbox" checked={p.isBold} onChange={e => updatePosisi(key, 'isBold', e.target.checked)} /> B
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontStyle: 'italic', color: p.isItalic ? '#0000af' : '#777' }}>
                        <input type="checkbox" checked={p.isItalic} onChange={e => updatePosisi(key, 'isItalic', e.target.checked)} /> I
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={handleSimpanPengaturan} disabled={isSavingSetting} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingSetting ? 'not-allowed' : 'pointer', fontSize: '0.9rem', marginTop: '20px', boxShadow: '0 4px 6px rgba(0,0,175,0.1)' }}>
              {isSavingSetting ? 'Mengupload & Menyimpan...' : '💾 Simpan Template Master'}
            </button>
          </div>

          {/* KOLOM KANAN: LIVE PREVIEW KANVAS */}
          <div className="card-panel" style={{ flex: '1 1 450px', backgroundColor: '#ecf0f1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 className="section-title" style={{ width: '100%', borderBottom: 'none' }}>👀 Live Preview Master</h3>
            <p style={{ fontSize: '0.75rem', color: '#777', marginBottom: '15px', textAlign: 'center' }}>Seret atau atur koordinat agar teks menempati posisi yang presisi di atas gambar template.</p>
            
            <div style={{ 
              position: 'relative', width: '100%', maxWidth: '800px', 
              aspectRatio: aspectRatio, backgroundColor: 'white', border: '2px solid #ccc', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', overflow: 'hidden',
              containerType: 'inline-size'
            }}>
              
              {/* Gambar Background Template */}
              {(templateUrl || fileTemplate) ? (
                <img src={fileTemplate ? URL.createObjectURL(fileTemplate) : templateUrl} alt="Template" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'fill', zIndex: 1 }} />
              ) : (
                <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', zIndex: 1 }}>
                  - Belum ada template diupload -
                </div>
              )}
              
              {/* Overlay Teks Kordinat */}
              {Object.keys(posisi).map(key => {
                const p = (posisi as any)[key];
                const isCenter = key === 'nomor' || key === 'ttdCabang' || key === 'ttdKomisariat';

                return (
                  <div key={key} style={{ 
                    position: 'absolute', zIndex: 2, 
                    top: `${p.top}%`, left: `${p.left}%`, 
                    transform: isCenter ? 'translate(-50%, 0)' : 'none', 
                    fontFamily: '"Arial Narrow", Arial, sans-serif',
                    fontSize: `${p.fontSize * fontScaleCqw}cqw`, 
                    fontWeight: p.isBold ? 'bold' : 'normal',
                    fontStyle: p.isItalic ? 'italic' : 'normal',
                    color: '#000', whiteSpace: 'nowrap', lineHeight: '1.2',
                    border: '1px dashed rgba(255,0,0,0.4)', background: 'rgba(255,255,255,0.3)', padding: '0 2px'
                  }}>
                    {/* Render Teks Default */}
                    {(mockData as any)[key]}

                    {/* Khusus untuk area TTD, tampilkan juga stempelnya jika ada */}
                    {key === 'ttdCabang' && (stempelCabangUrl || fileStempelCabang) && (
                       <img src={fileStempelCabang ? URL.createObjectURL(fileStempelCabang) : stempelCabangUrl} alt="Stempel PC" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -10px)', width: '12cqi', opacity: 0.8, zIndex: -1 }} />
                    )}
                    {key === 'ttdKomisariat' && (stempelKomisariatUrl || fileStempelKomisariat) && (
                       <img src={fileStempelKomisariat ? URL.createObjectURL(fileStempelKomisariat) : stempelKomisariatUrl} alt="Stempel PK" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -10px)', width: '12cqi', opacity: 0.8, zIndex: -1 }} />
                    )}
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