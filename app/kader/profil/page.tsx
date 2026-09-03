'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageProfilKader() {
  const [profilKader, setProfilKader] = useState({ 
    nama: 'Loading...', nim: '', nia: '', fotoUrl: 'https://via.placeholder.com/200x250/3498db/fff?text=FOTO', 
    noHp: '', alamat: '', id_rayon: '', jenjang: 'MAPABA', angkatan: '' 
  });
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  
  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [isSavingProfil, setIsSavingProfil] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilKader({ 
              nama: p.nama || '', nim: p.nim || '', nia: p.nia || '', 
              fotoUrl: p.fotoUrl || 'https://via.placeholder.com/200x250/3498db/fff?text=FOTO',
              noHp: p.noHp || '', alamat: p.alamat || '', id_rayon: p.id_rayon || '', 
              jenjang: p.jenjang || 'MAPABA', angkatan: p.angkatan || '-'
            });

            if (p.id_rayon === 'Komisariat' || p.id_rayon === 'Pusat Komisariat') {
               setNamaRayonInduk('Pusat Komisariat');
            } else if (p.id_rayon) {
               const unsubRayon = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                 if (rayonSnap.exists()) setNamaRayonInduk(rayonSnap.data().nama || p.id_rayon);
               });
               unsubs.push(unsubRayon);
            }
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => { unsubscribeAuth(); unsubs.forEach(unsub => unsub()); };
  }, []);

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file); formData.append("upload_preset", "siakad_upload"); 
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/image/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  const handleSimpanProfil = async () => {
    if(!profilKader.nim) return;
    setIsSavingProfil(true);
    try {
      let finalFotoUrl = profilKader.fotoUrl;
      if (fotoFile) finalFotoUrl = await uploadToCloudinary(fotoFile); 
      await updateDoc(doc(db, "users", profilKader.nim), { noHp: profilKader.noHp, alamat: profilKader.alamat, fotoUrl: finalFotoUrl });
      alert("Profil berhasil diperbarui!");
      setIsEditingProfil(false); setFotoFile(null);
    } catch (error) { alert("Gagal menyimpan profil"); } finally { setIsSavingProfil(false); }
  };

  return (
    <>
      <style>{`
        /* COLOR PALETTE (Modern Slate/Gray) */
        :root {
          --text-main: #111827;
          --text-body: #374151;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
          --bg-card: #ffffff;
        }

        .page-wrapper { display: flex; flex-direction: column; gap: 24px; }
        
        .profile-hero { 
          background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-color); 
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); overflow: hidden; position: relative; padding-bottom: 32px;
        }
        
        .profile-banner { height: 120px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); }
        
        .profile-grid { display: flex; flex-direction: column; gap: 24px; }
        
        .profile-card { 
          background: var(--bg-card); border-radius: 8px; padding: 24px; 
          border: 1px solid var(--border-color); box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
        }

        .profile-input { 
          width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); 
          background-color: #ffffff; border-radius: 6px; font-size: 0.9rem; outline: none; 
          color: var(--text-main); transition: border-color 0.2s; box-sizing: border-box;
        }
        .profile-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }

        .info-row { display: flex; flex-direction: column; margin-bottom: 16px; border-bottom: 1px solid #f3f4f6; padding-bottom: 12px; }
        .info-label { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
        .info-value { font-size: 0.95rem; color: var(--text-main); font-weight: 600; }

        .btn-edit {
          background-color: #f3f4f6; color: var(--text-main); border: 1px solid var(--border-color); 
          padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.8rem; 
          transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;
        }
        .btn-edit:hover { background-color: #e5e7eb; }
        .btn-edit.saving { background-color: #2563eb; color: white; border-color: #2563eb; }

        .badge-jenjang {
          background-color: #eff6ff; color: #1d4ed8; padding: 4px 12px; 
          border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: 1px solid #dbeafe;
        }

        @media (max-width: 767px) {
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .page-wrapper { padding: 16px; }
           .profile-card { padding: 16px; }
        }
        
        @media (min-width: 768px) {
           .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        }
      `}</style>

      <div className="web-ui-container page-wrapper">
        
        {/* KARTU HEADER PROFIL */}
        <div className="profile-hero">
          <div className="profile-banner" />
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-60px', position: 'relative', zIndex: 2 }}>
            <div style={{ position: 'relative' }}>
              <img src={profilKader.fotoUrl} alt="Foto Kader" style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
              {isEditingProfil && (
                <label style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: '#2563eb', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                  📷
                  <input type="file" accept="image/*" onChange={(e) => {
                     if (e.target.files && e.target.files[0]) {
                       setFotoFile(e.target.files[0]); setProfilKader({ ...profilKader, fotoUrl: URL.createObjectURL(e.target.files[0]) });
                     }
                  }} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            
            <h2 style={{ margin: '12px 0 6px 0', color: 'var(--text-main)', fontSize: '1.25rem', textAlign: 'center', fontWeight: '700' }}>{profilKader.nama}</h2>
            <span className="badge-jenjang">
              Kader {profilKader.jenjang}
            </span>
          </div>
        </div>

        <div className="profile-grid">
          
          {/* KARTU INFORMASI PRIBADI */}
          <div className="profile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem', fontWeight: '600' }}>Data Akademik & PMII</h3>
              <button 
                disabled={isSavingProfil}
                onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
                className={`btn-edit ${isEditingProfil ? 'saving' : ''}`}
              >
                {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Perubahan' : '✏️ Edit Profil'}
              </button>
            </div>

            <div className="info-row"><span className="info-label">Nomor Induk Mahasiswa (NIM)</span><span className="info-value">{profilKader.nim}</span></div>
            <div className="info-row"><span className="info-label">Nomor Induk Anggota (NIA)</span><span className="info-value">{profilKader.nia || '-'}</span></div>
            <div className="info-row"><span className="info-label">Tahun Angkatan</span><span className="info-value">{profilKader.angkatan}</span></div>
            <div className="info-row" style={{ borderBottom: 'none', paddingBottom: 0 }}><span className="info-label">Asal Instansi</span><span className="info-value" style={{ color: '#15803d' }}>{namaRayonInduk}</span></div>
          </div>

          {/* KARTU KONTAK & DOMISILI */}
          <div className="profile-card">
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Kontak & Domisili</h3>
            
            <div className="info-row">
              <span className="info-label">Nomor WhatsApp</span>
              {isEditingProfil ? (
                <input type="text" className="profile-input" value={profilKader.noHp} onChange={e => setProfilKader({...profilKader, noHp: e.target.value})} placeholder="08123456789" />
              ) : (<span className="info-value">{profilKader.noHp || '-'}</span>)}
            </div>
            
            <div className="info-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <span className="info-label">Alamat Lengkap Domisili</span>
              {isEditingProfil ? (
                <textarea className="profile-input" rows={3} value={profilKader.alamat} onChange={e => setProfilKader({...profilKader, alamat: e.target.value})} placeholder="Jl. Sunan Kalijaga..." style={{ resize: 'vertical' }} />
              ) : (<span className="info-value">{profilKader.alamat || '-'}</span>)}
            </div>
            
            {isEditingProfil && (
              <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #f59e0b', marginTop: '16px' }}>
                <p style={{ fontSize: '0.75rem', color: '#b45309', margin: 0, lineHeight: '1.4' }}>*NIM, Nama, dan NIA bersifat tetap dan hanya dapat diubah oleh Pengurus Instansi Anda.</p>
              </div>
            )}
          </div>

        </div>

        <div style={{ height: '50px' }} className="mobile-only"></div>
      </div>
    </>
  );
}