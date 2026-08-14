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

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub());
    };
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
        /* RESPONSIVE LAYOUT & HIDE SCROLLBAR */
        @media (max-width: 767px) {
           body, html, .mobile-content-wrapper, .app-container {
             overflow-x: hidden;
             -ms-overflow-style: none;
             scrollbar-width: none;
           }
           ::-webkit-scrollbar {
             display: none;
           }
           /* Di HP, header profil nempel ke tepi layar tanpa lengkungan */
           .profile-header-card {
             margin: -20px -20px 20px -20px !important;
             border-radius: 0 !important;
           }
           .profile-header-banner {
             border-radius: 0 !important;
           }
        }
        
        @media (min-width: 768px) {
           /* Di Laptop, kartu menjadi grid 2 kolom agar tidak sempit */
           .profile-grid {
             display: grid;
             grid-template-columns: 1fr 1fr;
             gap: 20px;
           }
        }

        .profile-grid {
           display: flex;
           flex-direction: column;
           gap: 20px;
        }

        .profile-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #eaeaea;
          background-color: #f8f9fa;
          border-radius: 6px;
          font-size: 0.9rem;
          outline: none;
          color: #333;
          transition: all 0.3s;
        }
        .profile-input:focus {
          border-color: #0000af;
          background-color: #fff;
        }
        .info-row {
          display: flex;
          flex-direction: column;
          margin-bottom: 15px;
          border-bottom: 1px solid #f0f0f0;
          padding-bottom: 12px;
        }
        .info-label {
          font-size: 0.75rem;
          color: #888;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 0.95rem;
          color: #333;
          font-weight: bold;
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* KARTU HEADER PROFIL */}
        <div className="profile-header-card" style={{ backgroundColor: '#fff', borderRadius: '8px', paddingBottom: '30px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
          <div className="profile-header-banner" style={{ height: '120px', backgroundColor: '#0000af', borderRadius: '8px 8px 0 0' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-60px', position: 'relative', zIndex: 2 }}>
            <div style={{ position: 'relative' }}>
              <img src={profilKader.fotoUrl} alt="Foto Kader" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
              {isEditingProfil && (
                <label style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: '#f1c40f', color: '#0d1b2a', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                  📷
                  <input type="file" accept="image/*" onChange={(e) => {
                     if (e.target.files && e.target.files[0]) {
                       setFotoFile(e.target.files[0]);
                       setProfilKader({ ...profilKader, fotoUrl: URL.createObjectURL(e.target.files[0]) });
                     }
                  }} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            
            <h2 style={{ margin: '15px 0 5px 0', color: '#0d1b2a', fontSize: '1.4rem', textAlign: 'center' }}>{profilKader.nama}</h2>
            <div style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '6px 16px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              Kader {profilKader.jenjang}
            </div>
          </div>
        </div>

        <div className="profile-grid">
          {/* KARTU INFORMASI PRIBADI */}
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#0d1b2a', fontSize: '1.1rem' }}>Data Akademik & PMII</h3>
              <button 
                disabled={isSavingProfil}
                onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
                style={{ backgroundColor: isEditingProfil ? '#2ecc71' : '#f1c40f', color: isEditingProfil ? '#fff' : '#0d1b2a', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: isSavingProfil ? 'not-allowed' : 'pointer', fontSize: '0.8rem', transition: '0.3s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan' : '✏️ Edit Profil'}
              </button>
            </div>

            <div className="info-row">
              <span className="info-label">Nomor Induk Mahasiswa (NIM)</span>
              <span className="info-value">{profilKader.nim}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Nomor Induk Anggota (NIA)</span>
              <span className="info-value">{profilKader.nia || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Tahun Angkatan</span>
              <span className="info-value">{profilKader.angkatan}</span>
            </div>
            <div className="info-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <span className="info-label">Asal Instansi</span>
              <span className="info-value" style={{ color: '#1e824c' }}>{namaRayonInduk}</span>
            </div>
          </div>

          {/* KARTU KONTAK & DOMISILI */}
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', flex: 1 }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#0d1b2a', fontSize: '1.1rem' }}>Kontak & Domisili</h3>
            
            <div className="info-row">
              <span className="info-label">Nomor WhatsApp</span>
              {isEditingProfil ? (
                <input type="text" className="profile-input" value={profilKader.noHp} onChange={e => setProfilKader({...profilKader, noHp: e.target.value})} placeholder="08123456789" />
              ) : (
                <span className="info-value">{profilKader.noHp || '-'}</span>
              )}
            </div>
            
            <div className="info-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <span className="info-label">Alamat Lengkap Domisili</span>
              {isEditingProfil ? (
                <textarea className="profile-input" rows={3} value={profilKader.alamat} onChange={e => setProfilKader({...profilKader, alamat: e.target.value})} placeholder="Jl. Sunan Kalijaga..." style={{ resize: 'vertical' }} />
              ) : (
                <span className="info-value">{profilKader.alamat || '-'}</span>
              )}
            </div>
            
            {isEditingProfil && (
              <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #f1c40f', marginTop: '15px' }}>
                <p style={{ fontSize: '0.75rem', color: '#856404', margin: 0 }}>*NIM, Nama, dan NIA hanya bisa diubah oleh Pengurus Rayon Anda.</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ height: '30px' }}></div>
      </div>
    </>
  );
}