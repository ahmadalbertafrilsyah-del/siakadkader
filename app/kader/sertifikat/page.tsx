'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageSertifikatKader() {
  const [profilKader, setProfilKader] = useState<any>({ nama: '', nim: '', id_rayon: '', jenjang: 'MAPABA', angkatan: '' });
  
  const defaultPosisi = {
    nomor: { top: 30, left: 50, fontSize: 14, isBold: true, isItalic: false }, 
    nama: { top: 45, left: 40, fontSize: 24, isBold: true, isItalic: false }, 
    nik: { top: 48, left: 40, fontSize: 14, isBold: false, isItalic: false },
    ttl: { top: 51, left: 40, fontSize: 14, isBold: false, isItalic: false }, 
    jurusan: { top: 54, left: 40, fontSize: 14, isBold: false, isItalic: false }, 
    pt: { top: 57, left: 40, fontSize: 14, isBold: false, isItalic: false },
  };

  const [settings, setSettings] = useState({
    templateUrl: 'https://via.placeholder.com/1123x794/ffffff/cccccc?text=Memuat+Sertifikat...',
    orientasi: 'landscape',
    posisi: defaultPosisi
  });

  const [selectedJenjang, setSelectedJenjang] = useState('MAPABA');

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilKader({ 
              nama: p.nama, nim: p.nim, id_rayon: p.id_rayon, jenjang: p.jenjang || 'MAPABA', angkatan: p.angkatan || '-',
              nik: p.nik || '-', ttl: p.ttl || '-', jurusan: p.jurusan || '-', pt: p.pt || '-', 
              nomor_sertifikat: p.nomor_sertifikat || '', nia: p.nia || ''
            });
            setSelectedJenjang(p.jenjang || 'MAPABA');
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => { unsubscribeAuth(); unsubs.forEach(u => u()); };
  }, []);

  useEffect(() => {
    if (!profilKader.id_rayon) return;
    const docId = `${profilKader.id_rayon}_${selectedJenjang}_${profilKader.angkatan}`;
    
    const unsub = onSnapshot(doc(db, "pengaturan_sertifikat", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let loadedPosisi = data.posisi;
        if (loadedPosisi) {
           Object.keys(defaultPosisi).forEach(k => {
             if (loadedPosisi[k]) {
                if (loadedPosisi[k].fontSize === undefined) loadedPosisi[k].fontSize = 14;
                if (loadedPosisi[k].isBold === undefined) loadedPosisi[k].isBold = false;
                if (loadedPosisi[k].isItalic === undefined) loadedPosisi[k].isItalic = false;
             } else {
                loadedPosisi[k] = defaultPosisi[k as keyof typeof defaultPosisi];
             }
           });
        }
        setSettings({
          templateUrl: data.templateUrl || '',
          orientasi: data.orientasi || 'landscape',
          posisi: loadedPosisi || defaultPosisi
        });
      } else {
        setSettings({
          templateUrl: 'https://via.placeholder.com/800x1131/ffffff/cccccc?text=Sertifikat+Belum+Diatur+Instansi',
          orientasi: 'landscape',
          posisi: defaultPosisi
        });
      }
    });
    return () => unsub();
  }, [profilKader.id_rayon, selectedJenjang, profilKader.angkatan]);

  const nomorDitampilkan = profilKader.nia && profilKader.nia !== '-' ? profilKader.nia : (profilKader.nomor_sertifikat ? profilKader.nomor_sertifikat : '- Belum Ada Nomor -');
  const aspectRatio = settings.orientasi === 'portrait' ? '1 / 1.414' : '1.414 / 1';
  const fontScaleCqw = settings.orientasi === 'portrait' ? 0.168 : 0.1188;

  const getDataTeks = (key: string) => {
    if (key === 'nomor') return nomorDitampilkan;
    if (key === 'nama') return profilKader.nama;
    if (key === 'nik') return profilKader.nik;
    if (key === 'ttl') return profilKader.ttl;
    if (key === 'jurusan') return profilKader.jurusan;
    if (key === 'pt') return profilKader.pt;
    return '';
  };

  return (
    <>
      <style>{`
        .mobile-padded { display: flex; flex-direction: column; gap: 20px; }
        @media (max-width: 767px) {
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .mobile-padded { padding: 15px !important; }
        }
        
        @media print {
          @page { size: A4 ${settings.orientasi}; margin: 0; }
          body, html { background-color: white !important; margin: 0; padding: 0; height: 100vh !important; width: 100vw !important; overflow: hidden !important; }
          aside, header, nav, .web-ui-container { display: none !important; }
          main.no-print { display: block !important; margin: 0 !important; padding: 0 !important; }
          .mobile-content-wrapper { padding: 0 !important; margin: 0 !important; }
          .print-layout-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: ${settings.orientasi === 'portrait' ? '210mm' : '297mm'} !important; height: ${settings.orientasi === 'portrait' ? '297mm' : '210mm'} !important; z-index: 9999 !important; background: white !important; }
          .bg-sertifikat { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
          .bg-sertifikat img { width: 100%; height: 100%; object-fit: fill; display: block; }
          .isian-data { position: absolute; z-index: 10; font-family: "Arial Narrow", Arial, sans-serif; color: black !important; white-space: nowrap; line-height: 1.2; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      {/* WEB UI CONTAINER (Disembunyikan saat print) */}
      <div className="web-ui-container mobile-padded">
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #eaeaea' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>🎓 Cetak Piagam / Sertifikat Digital</h3>
              <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Sertifikat resmi PMII yang tata letaknya telah diatur oleh Pengurus.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={selectedJenjang} onChange={e => setSelectedJenjang(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none', fontWeight: 'bold', color: '#0000af', cursor: 'pointer' }}>
                <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
              </select>
              <button onClick={() => window.print()} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                🖨️ Cetak PDF
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: '#fdfdfd', border: '1px solid #eee', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
            <p style={{ marginBottom: '15px', color: '#555', fontSize: '0.9rem', fontWeight: 'bold' }}>Pratinjau Sertifikat ({settings.orientasi})</p>
            
            <div style={{ 
              position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto', 
              aspectRatio: aspectRatio, border: '1px solid #ccc', overflow: 'hidden', backgroundColor: 'white', containerType: 'inline-size' 
            }}>
              {settings.templateUrl && (
                <img src={settings.templateUrl} alt="Template" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 1 }} />
              )}
              
              {Object.keys(settings.posisi).map(key => {
                const p = (settings.posisi as any)[key];
                return (
                  <div key={key} style={{ 
                    position: 'absolute', zIndex: 2, top: `${p.top}%`, left: `${p.left}%`, transform: key === 'nomor' ? 'translate(-50%, 0)' : 'none', 
                    fontFamily: '"Arial Narrow", Arial, sans-serif', fontSize: `${p.fontSize * fontScaleCqw}cqw`, 
                    fontWeight: p.isBold ? 'bold' : 'normal', fontStyle: p.isItalic ? 'italic' : 'normal',
                    color: '#000', whiteSpace: 'nowrap', lineHeight: '1.2'
                  }}>
                    {getDataTeks(key)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ height: '80px' }} className="mobile-only"></div>
      </div>

      {/* RENDER CETAK KHUSUS KERTAS A4 (PDF) */}
      <div className="print-layout-container">
        <div className="bg-sertifikat">
          {settings.templateUrl && <img src={settings.templateUrl} alt="Background" />}
        </div>
        {Object.keys(settings.posisi).map(key => {
           const p = (settings.posisi as any)[key];
           return (
             <div key={key} className="isian-data" style={{ 
               top: `${p.top}%`, left: `${p.left}%`, transform: key === 'nomor' ? 'translate(-50%, 0)' : 'none', 
               fontSize: `${p.fontSize}pt`, fontWeight: p.isBold ? 'bold' : 'normal', fontStyle: p.isItalic ? 'italic' : 'normal',
             }}>
               {getDataTeks(key)}
             </div>
           );
        })}
      </div>
    </>
  );
}