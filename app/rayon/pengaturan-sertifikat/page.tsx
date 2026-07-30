'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';

export default function PagePengaturanSertifikatRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  
  const [formJenjang, setFormJenjang] = useState('MAPABA');
  const [formAngkatan, setFormAngkatan] = useState(new Date().getFullYear().toString());
  const [orientasi, setOrientasi] = useState('portrait');
  const [templateUrl, setTemplateUrl] = useState('');
  const [fileTemplate, setFileTemplate] = useState<File | null>(null);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  const defaultPosisi = {
    nomor: { top: 25, left: 50, fontSize: 14, isBold: true, isItalic: false },
    nama: { top: 45, left: 35, fontSize: 24, isBold: true, isItalic: false },
    nik: { top: 48, left: 35, fontSize: 14, isBold: false, isItalic: false },
    ttl: { top: 51, left: 35, fontSize: 14, isBold: false, isItalic: false },
    jurusan: { top: 54, left: 35, fontSize: 14, isBold: false, isItalic: false },
    pt: { top: 57, left: 35, fontSize: 14, isBold: false, isItalic: false },
  };
  
  const [posisi, setPosisi] = useState(defaultPosisi);

  const [fileExcel, setFileExcel] = useState<File | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            setAdminRayonId(snapRole.docs[0].data().username);
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
        setTemplateUrl(data.templateUrl || '');
        setOrientasi(data.orientasi || 'portrait');
        if (data.posisi) {
          const loadedPosisi = data.posisi;
          Object.keys(defaultPosisi).forEach(k => {
            if (loadedPosisi[k]) {
               if (loadedPosisi[k].fontSize === undefined) loadedPosisi[k].fontSize = 14;
               if (loadedPosisi[k].isBold === undefined) loadedPosisi[k].isBold = false;
               if (loadedPosisi[k].isItalic === undefined) loadedPosisi[k].isItalic = false;
            } else {
               loadedPosisi[k] = defaultPosisi[k as keyof typeof defaultPosisi];
            }
          });
          setPosisi(loadedPosisi);
        }
      } else {
        setTemplateUrl('');
        setOrientasi('portrait');
        setPosisi(defaultPosisi);
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
      let finalUrl = templateUrl;
      if (fileTemplate) finalUrl = await uploadToCloudinary(fileTemplate);
      
      const docId = `${adminRayonId}_${formJenjang}_${formAngkatan}`;
      await setDoc(doc(db, "pengaturan_sertifikat", docId), {
        templateUrl: finalUrl, orientasi, posisi, updatedAt: Date.now()
      }, { merge: true });
      
      alert("Pengaturan Sertifikat & Kanvas berhasil disimpan!");
      setFileTemplate(null);
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

  const updatePosisi = (field: string, prop: string, value: any) => {
    setPosisi({ ...posisi, [field]: { ...posisi[field as keyof typeof posisi], [prop]: value } });
  };

  const aspectRatio = orientasi === 'portrait' ? '1 / 1.414' : '1.414 / 1';
  // Skala rasio Font (pt) ke Container Query Width (cqw) agar presisi di layar mana pun
  const fontScaleCqw = orientasi === 'portrait' ? 0.168 : 0.1188;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.1rem' }}>📥 Upload Data Kelengkapan Sertifikat (Excel)</h3>
        <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '15px' }}>Header kolom wajib: <b>NIM, NIK, Tempat, Tanggal Lahir, Jurusan, Perguruan Tinggi, Nomor Sertifikat, NIA</b>.</p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".xlsx, .xls" onChange={(e) => setFileExcel(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fafafa', fontSize: '0.85rem' }} />
          <button onClick={handleUploadExcelData} disabled={isUploadingExcel} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: isUploadingExcel ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
            {isUploadingExcel ? 'Memproses Data...' : '📤 Proses & Update Database'}
          </button>
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        
        <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0', fontSize: '1.1rem', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>⚙️ Setting Template & Posisi Teks</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Jenjang Kaderisasi</label>
              <select value={formJenjang} onChange={e => setFormJenjang(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }}>
                <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Tahun Angkatan</label>
              <input type="number" value={formAngkatan} onChange={e => setFormAngkatan(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Orientasi Kertas A4</label>
              <select value={orientasi} onChange={e => setOrientasi(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }}>
                <option value="portrait">A4 Portrait (Berdiri)</option><option value="landscape">A4 Landscape (Mendatar)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Upload Template Kosong (Gambar)</label>
              <input type="file" accept="image/*" onChange={(e) => setFileTemplate(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', padding: '6px', border: '1px dashed #3498db', borderRadius: '4px', marginTop: '5px', fontSize: '0.75rem' }} />
            </div>
          </div>

          <div style={{ backgroundColor: '#fafafa', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#e67e22' }}>🛠️ Pengatur Koordinat & Font (Arial Narrow)</h4>
            
            <div style={{ display: 'grid', gap: '10px' }}>
              {Object.keys(posisi).map((key) => {
                const p = (posisi as any)[key];
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', backgroundColor: '#fff', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <strong style={{ width: '60px', textTransform: 'capitalize' }}>{key}</strong>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      X:<input type="number" value={p.left} onChange={e => updatePosisi(key, 'left', Number(e.target.value))} style={{ width: '45px', padding: '4px', border: '1px solid #ccc' }} />%
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      Y:<input type="number" value={p.top} onChange={e => updatePosisi(key, 'top', Number(e.target.value))} style={{ width: '45px', padding: '4px', border: '1px solid #ccc' }} />%
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      Size:<input type="number" value={p.fontSize} onChange={e => updatePosisi(key, 'fontSize', Number(e.target.value))} style={{ width: '45px', padding: '4px', border: '1px solid #ccc' }} title="Ukuran Font (pt)" />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', fontWeight: 'bold' }}>
                      <input type="checkbox" checked={p.isBold} onChange={e => updatePosisi(key, 'isBold', e.target.checked)} /> B
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', fontStyle: 'italic' }}>
                      <input type="checkbox" checked={p.isItalic} onChange={e => updatePosisi(key, 'isItalic', e.target.checked)} /> I
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={handleSimpanPengaturan} disabled={isSavingSetting} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingSetting ? 'not-allowed' : 'pointer' }}>
            {isSavingSetting ? 'Menyimpan...' : '💾 Simpan Konfigurasi & Layout'}
          </button>
        </div>

        <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#ecf0f1', padding: '20px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>👀 Live Preview Kanvas</h4>
          <div style={{ 
            position: 'relative', width: '100%', maxWidth: '800px', 
            aspectRatio: aspectRatio, backgroundColor: 'white', border: '2px solid #ccc', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', overflow: 'hidden',
            containerType: 'inline-size' /* MENGGUNAKAN CONTAINER QUERIES AGAR SKALA FONT AKURAT */
          }}>
            {(templateUrl || fileTemplate) && (
              <img src={fileTemplate ? URL.createObjectURL(fileTemplate) : templateUrl} alt="Template" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'fill', zIndex: 1 }} />
            )}
            
            {Object.keys(posisi).map(key => {
              const p = (posisi as any)[key];
              const textSimulasi = key === 'nomor' ? '10/MAPABA-X/2026' : 
                                   key === 'nama' ? 'Ahmad Albert Afrilsyah' : 
                                   key === 'nik' ? '35730123456789' : 
                                   key === 'ttl' ? 'Malang, 10 Agustus 2002' : 
                                   key === 'jurusan' ? 'Teknik Informatika' : 'UIN Maulana Malik Ibrahim';
              return (
                <div key={key} style={{ 
                  position: 'absolute', zIndex: 2, 
                  top: `${p.top}%`, left: `${p.left}%`, 
                  transform: key === 'nomor' ? 'translate(-50%, 0)' : 'none', 
                  fontFamily: '"Arial Narrow", Arial, sans-serif',
                  fontSize: `${p.fontSize * fontScaleCqw}cqw`, 
                  fontWeight: p.isBold ? 'bold' : 'normal',
                  fontStyle: p.isItalic ? 'italic' : 'normal',
                  color: 'blue', border: '1px dashed rgba(0,0,255,0.3)', background: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap',
                  lineHeight: '1.2'
                }}>
                  {textSimulasi}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}