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
        /* COLOR PALETTE & LAYOUT */
        :root {
          --text-main: #111827;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
          --bg-card: #ffffff;
        }

        .page-wrapper { display: flex; flex-direction: column; gap: 24px; }
        
        .header-card { 
          background: var(--bg-card); padding: 24px; border-radius: 8px; 
          border: 1px solid var(--border-color); box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
        }
        
        .header-title-container { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .header-icon { color: #2563eb; display: flex; align-items: center; justify-content: center; }

        .preview-card {
          background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
          display: flex; flex-direction: column; gap: 20px; text-align: center;
        }

        .select-jenjang {
          padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px;
          outline: none; font-weight: 600; color: var(--text-main); background-color: #fff;
          cursor: pointer; font-size: 0.85rem; transition: border-color 0.2s;
        }
        .select-jenjang:focus { border-color: #2563eb; }

        .btn-print {
          background-color: #2563eb; color: white; border: none; padding: 9px 18px;
          border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;
          display: inline-flex; align-items: center; gap: 6px; transition: background-color 0.2s;
        }
        .btn-print:hover { background-color: #1d4ed8; }

        @media (max-width: 767px) {
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .page-wrapper { padding: 16px; }
           .header-card, .preview-card { padding: 16px; }
        }
        
        @media print {
          @page { size: A4 ${settings.orientasi}; margin: 0; }
          body, html { background-color: white !important; margin: 0; padding: 0; height: 100vh !important; width: 100vw !important; overflow: hidden !important; }
          aside, header, nav, .web-ui-container { display: none !important; }
          main.no-print { display: block !important; margin: 0 !important; padding: 0 !important; }
          .print-layout-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: ${settings.orientasi === 'portrait' ? '210mm' : '297mm'} !important; height: ${settings.orientasi === 'portrait' ? '297mm' : '210mm'} !important; z-index: 9999 !important; background: white !important; }
          .bg-sertifikat { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
          .bg-sertifikat img { width: 100%; height: 100%; object-fit: fill; display: block; }
          .isian-data { position: absolute; z-index: 10; font-family: "Arial Narrow", Arial, sans-serif; color: black !important; white-space: nowrap; line-height: 1.2; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      {/* WEB UI CONTAINER */}
      <div className="web-ui-container page-wrapper">
        
        {/* HEADER */}
        <div className="header-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div className="header-title-container">
                <div className="header-icon">
                  {/* SVG Ikon Sertifikat / Penghargaan */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6"></circle>
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path>
                  </svg>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Cetak Piagam & Sertifikat Digital</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Sertifikat resmi PMII yang tata letaknya telah diatur oleh Pengurus.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={selectedJenjang} onChange={e => setSelectedJenjang(e.target.value)} className="select-jenjang">
                <option value="MAPABA">MAPABA</option>
                <option value="PKD">PKD</option>
                <option value="SIG">SIG</option>
                <option value="SKP">SKP</option>
              </select>
              <button onClick={() => window.print()} className="btn-print">
                {/* SVG Ikon Cetak */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Cetak PDF
              </button>
            </div>
          </div>
        </div>

        {/* PRATINJAU SERTIFIKAT */}
        <div className="preview-card">
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)', textAlign: 'left', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            Pratinjau Sertifikat ({settings.orientasi})
          </div>
          
          <div style={{ 
            position: 'relative', width: '100%', maxWidth: '850px', margin: '0 auto', 
            aspectRatio: aspectRatio, border: '1px solid var(--border-color)', borderRadius: '6px', 
            overflow: 'hidden', backgroundColor: '#fdfdfd', containerType: 'inline-size',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            {settings.templateUrl && (
              <img src={settings.templateUrl} alt="Template Sertifikat" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 1 }} />
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

        <div style={{ height: '50px' }} className="mobile-only"></div>
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