'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageSertifikatKader() {
  const [profilKader, setProfilKader] = useState<any>({ nama: '', nim: '', id_rayon: '', jenjang: 'MAPABA', angkatan: '' });
  
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
    scanTtdKomisariat: { top: 82, left: 50, width: 18, fontSize: 12 }
  };

  const [settings, setSettings] = useState({
    templateUrl: '',
    orientasi: 'portrait',
    posisi: defaultPosisi,
    namaKetuaCabang: '',
    stempelCabangUrl: '',
    scanTtdCabangUrl: '',
    namaKetuaKomisariat: '',
    stempelKomisariatUrl: '',
    scanTtdKomisariatUrl: '',
    namaKetuaRayon: '',
    stempelRayonUrl: ''
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
              nama: p.nama, nim: p.nim, id_rayon: p.id_rayon, jenjang: p.jenjang || 'MAPABA', angkatan: p.angkatan || new Date().getFullYear().toString(),
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
    if (!profilKader.angkatan) return;

    let unsubs: (() => void)[] = [];

    const qMaster = query(
      collection(db, "master_template_sertifikat"),
      where("jenjang", "==", selectedJenjang),
      where("angkatan", "==", profilKader.angkatan)
    );
    const unsubMaster = onSnapshot(qMaster, (snapshot) => {
      if (!snapshot.empty) {
        const masterData = snapshot.docs[0].data();
        let loadedPosisi = masterData.posisi || defaultPosisi;

        setSettings(prev => ({
          ...prev,
          templateUrl: masterData.templateUrl || '',
          orientasi: masterData.orientasi || 'portrait',
          posisi: loadedPosisi,
          namaKetuaCabang: masterData.namaKetuaCabang || '',
          stempelCabangUrl: masterData.stempelCabangUrl || '',
          scanTtdCabangUrl: masterData.scanTtdCabangUrl || '',
          namaKetuaKomisariat: masterData.namaKetuaKomisariat || '',
          stempelKomisariatUrl: masterData.stempelKomisariatUrl || '',
          scanTtdKomisariatUrl: masterData.scanTtdKomisariatUrl || ''
        }));
      }
    });
    unsubs.push(unsubMaster);

    if (profilKader.id_rayon) {
      const rayonDocId = `${profilKader.id_rayon}_${selectedJenjang}_${profilKader.angkatan}`;
      const unsubRayon = onSnapshot(doc(db, "pengaturan_sertifikat", rayonDocId), (docSnap) => {
        if (docSnap.exists()) {
          const rayonData = docSnap.data();
          setSettings(prev => ({
            ...prev,
            namaKetuaRayon: rayonData.namaKetuaRayon || '',
            stempelRayonUrl: rayonData.stempelUrl || ''
          }));
        }
      });
      unsubs.push(unsubRayon);
    }

    return () => { unsubs.forEach(u => u()); };
  }, [selectedJenjang, profilKader.angkatan, profilKader.id_rayon]);

  const nomorDitampilkan = profilKader.nia && profilKader.nia !== '-' ? profilKader.nia : (profilKader.nomor_sertifikat ? profilKader.nomor_sertifikat : '- Belum Ada Nomor -');
  const aspectRatio = settings.orientasi === 'portrait' ? '1 / 1.414' : '1.414 / 1';
  const fontScaleCqw = settings.orientasi === 'portrait' ? 0.168 : 0.1188;

  let namaKegiatanFull = selectedJenjang === 'PKD' ? 'Pelatihan Kader Dasar (PKD)' : (selectedJenjang === 'SIG' ? 'Sekolah Islam Gender (SIG)' : 'Masa Penerimaan Anggota Baru (MAPABA)');
  let statusKader = selectedJenjang === 'PKD' ? 'KADER MUJAHID PMII' : 'ANGGOTA PMII';

  const getDataTeks = (key: string) => {
    if (key === 'nomor') return nomorDitampilkan;
    if (key === 'teksPembuka') return `Yang bertanda tangan di bawah ini Pengurus Rayon PMII Komisariat Sunan Ampel Malang memberikan status <b>${statusKader}</b> kepada :`;
    if (key === 'nama') return `Nama          : ${profilKader.nama}`;
    if (key === 'nik') return `NIK             : ${profilKader.nik}`;
    if (key === 'ttl') return `TTL             : ${profilKader.ttl}`;
    if (key === 'jurusan') return `Jurusan       : ${profilKader.jurusan}`;
    if (key === 'pt') return `Perguruan Tinggi : ${profilKader.pt}`;
    if (key === 'teksKelulusan') return `Bahwa nama yang disebutkan diatas telah <b>LULUS</b> ${namaKegiatanFull} oleh Pengurus Rayon PMII.`;
    if (key === 'ttdCabang') return `${settings.namaKetuaCabang || 'NAMA KETUA PC'}<br/>Ketua PC. PMII Kota Malang`;
    if (key === 'ttdKomisariat') return `${settings.namaKetuaKomisariat || 'NAMA KETUA PK'}<br/>Ketua PK. PMII Sunan Ampel`;
    if (key === 'ttdRayon') return `${settings.namaKetuaRayon || 'NAMA KETUA RAYON'}<br/>Ketua Rayon PMII`;
    return '';
  };

  return (
    <>
      <style>{`
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
          .isian-data { position: absolute; z-index: 10; font-family: "Arial Narrow", Arial, sans-serif; color: black !important; line-height: 1.2; }
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
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6"></circle>
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path>
                  </svg>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Cetak Piagam & Sertifikat Digital</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Sertifikat resmi PMII lengkap dengan stempel dan tanda tangan digital instansi.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={selectedJenjang} onChange={e => setSelectedJenjang(e.target.value)} className="select-jenjang">
                <option value="MAPABA">MAPABA</option>
                <option value="PKD">PKD</option>
                <option value="SIG">SIG</option>
              </select>
              <button onClick={() => window.print()} className="btn-print">
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
            {settings.templateUrl ? (
              <img src={settings.templateUrl} alt="Template Sertifikat" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 1 }} />
            ) : (
              <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.85rem', zIndex: 1, padding: '20px', textAlign: 'center' }}>
                ⚠️ Template sertifikat untuk {selectedJenjang} belum diatur oleh Admin Komisariat.
              </div>
            )}

            {/* Render Stempel (zIndex 7) */}
            {settings.stempelCabangUrl && (settings.posisi as any).stempelCabang && (
              <div style={{ position: 'absolute', zIndex: 7, top: `${(settings.posisi as any).stempelCabang.top}%`, left: `${(settings.posisi as any).stempelCabang.left}%`, width: `${(settings.posisi as any).stempelCabang.width}%` }}>
                <img src={settings.stempelCabangUrl} alt="Stempel Cabang" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
              </div>
            )}
            {settings.stempelKomisariatUrl && (settings.posisi as any).stempelKomisariat && (
              <div style={{ position: 'absolute', zIndex: 7, top: `${(settings.posisi as any).stempelKomisariat.top}%`, left: `${(settings.posisi as any).stempelKomisariat.left}%`, width: `${(settings.posisi as any).stempelKomisariat.width}%` }}>
                <img src={settings.stempelKomisariatUrl} alt="Stempel Komisariat" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
              </div>
            )}
            {settings.stempelRayonUrl && (settings.posisi as any).stempelRayon && (
              <div style={{ position: 'absolute', zIndex: 7, top: `${(settings.posisi as any).stempelRayon.top}%`, left: `${(settings.posisi as any).stempelRayon.left}%`, width: `${(settings.posisi as any).stempelRayon.width}%` }}>
                <img src={settings.stempelRayonUrl} alt="Stempel Rayon" style={{ width: '100%', objectFit: 'contain', opacity: 0.85, pointerEvents: 'none' }} />
              </div>
            )}

            {/* Render Scan TTD (zIndex 6) */}
            {settings.scanTtdCabangUrl && (settings.posisi as any).scanTtdCabang && (
              <div style={{ position: 'absolute', zIndex: 6, top: `${(settings.posisi as any).scanTtdCabang.top}%`, left: `${(settings.posisi as any).scanTtdCabang.left}%`, width: `${(settings.posisi as any).scanTtdCabang.width}%` }}>
                <img src={settings.scanTtdCabangUrl} alt="Scan TTD Cabang" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
              </div>
            )}
            {settings.scanTtdKomisariatUrl && (settings.posisi as any).scanTtdKomisariat && (
              <div style={{ position: 'absolute', zIndex: 6, top: `${(settings.posisi as any).scanTtdKomisariat.top}%`, left: `${(settings.posisi as any).scanTtdKomisariat.left}%`, width: `${(settings.posisi as any).scanTtdKomisariat.width}%` }}>
                <img src={settings.scanTtdKomisariatUrl} alt="Scan TTD Komisariat" style={{ width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
              </div>
            )}
            
            {/* Render Teks Dinamis */}
            {Object.keys(settings.posisi).map(key => {
              if (['stempelCabang', 'stempelKomisariat', 'stempelRayon', 'scanTtdCabang', 'scanTtdKomisariat'].includes(key)) return null;
              const p = (settings.posisi as any)[key];
              if (!p) return null;
              const isCenter = key === 'nomor';

              return (
                <div key={key} style={{ 
                  position: 'absolute', zIndex: 2, top: `${p.top}%`, left: `${p.left}%`, width: `${p.width || 60}%`, 
                  textAlign: p.align || (isCenter ? 'center' : 'left'), transform: isCenter ? 'translate(-50%, 0)' : 'none', 
                  fontFamily: '"Arial Narrow", Arial, sans-serif', fontSize: `${p.fontSize * fontScaleCqw}cqw`, 
                  fontWeight: p.isBold ? 'bold' : 'normal', fontStyle: p.isItalic ? 'italic' : 'normal',
                  color: '#000', lineHeight: '1.2'
                }}>
                  <div dangerouslySetInnerHTML={{ __html: getDataTeks(key) }} />
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

        {settings.stempelCabangUrl && (settings.posisi as any).stempelCabang && (
          <div className="isian-data" style={{ zIndex: 7, top: `${(settings.posisi as any).stempelCabang.top}%`, left: `${(settings.posisi as any).stempelCabang.left}%`, width: `${(settings.posisi as any).stempelCabang.width}%` }}>
            <img src={settings.stempelCabangUrl} alt="Stempel Cabang" style={{ width: '100%', objectFit: 'contain', opacity: 0.85 }} />
          </div>
        )}
        {settings.stempelKomisariatUrl && (settings.posisi as any).stempelKomisariat && (
          <div className="isian-data" style={{ zIndex: 7, top: `${(settings.posisi as any).stempelKomisariat.top}%`, left: `${(settings.posisi as any).stempelKomisariat.left}%`, width: `${(settings.posisi as any).stempelKomisariat.width}%` }}>
            <img src={settings.stempelKomisariatUrl} alt="Stempel Komisariat" style={{ width: '100%', objectFit: 'contain', opacity: 0.85 }} />
          </div>
        )}
        {settings.stempelRayonUrl && (settings.posisi as any).stempelRayon && (
          <div className="isian-data" style={{ zIndex: 7, top: `${(settings.posisi as any).stempelRayon.top}%`, left: `${(settings.posisi as any).stempelRayon.left}%`, width: `${(settings.posisi as any).stempelRayon.width}%` }}>
            <img src={settings.stempelRayonUrl} alt="Stempel Rayon" style={{ width: '100%', objectFit: 'contain', opacity: 0.85 }} />
          </div>
        )}

        {settings.scanTtdCabangUrl && (settings.posisi as any).scanTtdCabang && (
          <div className="isian-data" style={{ zIndex: 6, top: `${(settings.posisi as any).scanTtdCabang.top}%`, left: `${(settings.posisi as any).scanTtdCabang.left}%`, width: `${(settings.posisi as any).scanTtdCabang.width}%` }}>
            <img src={settings.scanTtdCabangUrl} alt="Scan TTD Cabang" style={{ width: '100%', objectFit: 'contain' }} />
          </div>
        )}
        {settings.scanTtdKomisariatUrl && (settings.posisi as any).scanTtdKomisariat && (
          <div className="isian-data" style={{ zIndex: 6, top: `${(settings.posisi as any).scanTtdKomisariat.top}%`, left: `${(settings.posisi as any).scanTtdKomisariat.left}%`, width: `${(settings.posisi as any).scanTtdKomisariat.width}%` }}>
            <img src={settings.scanTtdKomisariatUrl} alt="Scan TTD Komisariat" style={{ width: '100%', objectFit: 'contain' }} />
          </div>
        )}

        {Object.keys(settings.posisi).map(key => {
           if (['stempelCabang', 'stempelKomisariat', 'stempelRayon', 'scanTtdCabang', 'scanTtdKomisariat'].includes(key)) return null;
           const p = (settings.posisi as any)[key];
           if (!p) return null;
           const isCenter = key === 'nomor';
           return (
             <div key={key} className="isian-data" style={{ 
               top: `${p.top}%`, left: `${p.left}%`, width: `${p.width || 60}%`, 
               textAlign: p.align || (isCenter ? 'center' : 'left'), transform: isCenter ? 'translate(-50%, 0)' : 'none', 
               fontSize: `${p.fontSize}pt`, fontWeight: p.isBold ? 'bold' : 'normal', fontStyle: p.isItalic ? 'italic' : 'normal',
             }}>
               <div dangerouslySetInnerHTML={{ __html: getDataTeks(key) }} />
             </div>
           );
        })}
      </div>
    </>
  );
}