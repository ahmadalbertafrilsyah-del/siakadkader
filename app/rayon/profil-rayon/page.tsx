'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageProfilRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  
  const [profilRayon, setProfilRayon] = useState({
    fotoLogoUrl: 'https://via.placeholder.com/200x200/0000af/fff?text=Logo+Rayon',
    nama: '', tanggalBerdiri: '', fakultas: '', programStudi: ''
  });
  
  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [fotoLogoFile, setFotoLogoFile] = useState<File | null>(null);
  const [isSavingPengaturan, setIsSavingPengaturan] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            
            onSnapshot(doc(db, "users", currentRayonId), (rayonSnap: any) => {
              if (rayonSnap.exists()) {
                const rData = rayonSnap.data();
                setProfilRayon({
                  fotoLogoUrl: rData.fotoLogoUrl || 'https://via.placeholder.com/200x200/0000af/fff?text=Logo+Rayon',
                  nama: rData.nama || currentRayonId, 
                  tanggalBerdiri: rData.tanggalBerdiri || '',
                  fakultas: rData.fakultas || '', 
                  programStudi: rData.programStudi || ''
                });
              }
            });
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file); formData.append("upload_preset", "siakad_upload"); 
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/image/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload ke Cloudinary");
    return data.secure_url.replace("http://", "https://");
  };

  const catatLogAktivitas = async (aksi: string) => {
    if (!adminRayonId) return;
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: profilRayon.nama || adminRayonId, role: "rayon",
        aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  const handleSimpanProfilRayon = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingPengaturan(true);
    try {
      let finalFoto = profilRayon.fotoLogoUrl;
      if (fotoLogoFile) { finalFoto = await uploadToCloudinary(fotoLogoFile); }
      await updateDoc(doc(db, "users", adminRayonId), {
        nama: profilRayon.nama, tanggalBerdiri: profilRayon.tanggalBerdiri,
        fakultas: profilRayon.fakultas, programStudi: profilRayon.programStudi, fotoLogoUrl: finalFoto
      });
      catatLogAktivitas("Memperbarui Profil Rayon."); alert("Profil Rayon berhasil diperbarui!");
      setIsEditingProfil(false); setFotoLogoFile(null);
    } catch (error) { alert("Gagal menyimpan profil."); } finally { setIsSavingPengaturan(false); }
  };

  // Parsing program studi menjadi array untuk nomor urut
  const listProgramStudi = profilRayon.programStudi 
    ? profilRayon.programStudi.split(',').map(s => s.trim()).filter(Boolean) 
    : [];

  return (
    <>
      <style>{`
        :root {
          --text-main: #111827;
          --text-body: #374151;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
          --bg-card: #ffffff;
        }

        .page-wrapper { display: flex; flex-direction: column; gap: 24px; box-sizing: border-box; width: 100%; }
        
        .header-card { 
          background: var(--bg-card); padding: 24px; border-radius: 8px; 
          border: 1px solid var(--border-color); box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); 
        }

        .profile-container {
          background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-color);
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); padding: 32px;
          display: grid; grid-template-columns: 240px 1fr; gap: 32px; align-items: start;
        }

        .profile-input { 
          width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); 
          background-color: #ffffff; border-radius: 6px; font-size: 0.9rem; outline: none; 
          color: var(--text-main); transition: border-color 0.2s; box-sizing: border-box;
        }
        .profile-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }

        .info-row { display: flex; flex-direction: column; gap: 6px; padding: 16px 0; border-bottom: 1px solid #f3f4f6; }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
        .info-value { font-size: 0.95rem; color: var(--text-main); font-weight: 600; }

        .btn-action {
          width: 100%; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem; 
          transition: all 0.2s; border: 1px solid transparent; text-align: center; box-sizing: border-box;
        }
        .btn-primary { background-color: #2563eb; color: white; }
        .btn-primary:hover { background-color: #1d4ed8; }
        .btn-success { background-color: #16a34a; color: white; }
        .btn-success:hover { background-color: #15803d; }
        .btn-danger { background-color: #dc2626; color: white; }
        .btn-danger:hover { background-color: #b91c1c; }

        /* Mencegah scrollbar tidak diinginkan di perangkat mobile */
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 768px) {
           body, html, .app-container { overflow-x: hidden !important; -ms-overflow-style: none; scrollbar-width: none; width: 100%; margin: 0; padding: 0; }
           ::-webkit-scrollbar { display: none; }
           .page-wrapper { padding: 12px; box-sizing: border-box; overflow-x: hidden; }
           .profile-container { grid-template-columns: 1fr; padding: 20px; gap: 20px; }
        }
      `}</style>

      <div className="page-wrapper hide-scroll">
        
        {/* HEADER */}
        <div className="header-card">
          <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '700' }}>🏢 Profil Rayon</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lengkapi data identitas dan informasi resmi Rayon Anda di bawah ini.</p>
        </div>

        {/* KONTEN UTAMA PROFIL */}
        <div className="profile-container">
          
          {/* SISI KIRI: LOGO & TOMBOL AKSI */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <div style={{ width: '100%', maxWidth: '200px', aspectRatio: '1/1', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={profilRayon.fotoLogoUrl} alt="Logo Rayon" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px', boxSizing: 'border-box' }} />
            </div>

            {isEditingProfil && (
              <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Unggah Logo Baru:</label>
                <input type="file" accept="image/*" onChange={(e) => {
                   if (e.target.files && e.target.files[0]) {
                     setFotoLogoFile(e.target.files[0]);
                     setProfilRayon({ ...profilRayon, fotoLogoUrl: URL.createObjectURL(e.target.files[0]) });
                   }
                }} style={{ fontSize: '0.8rem', width: '100%' }} />
              </div>
            )}

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                disabled={isSavingPengaturan}
                onClick={() => isEditingProfil ? handleSimpanProfilRayon(new Event('submit') as any) : setIsEditingProfil(true)} 
                className={`btn-action ${isEditingProfil ? 'btn-success' : 'btn-primary'}`}>
                {isSavingPengaturan ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Perubahan' : '✏️ Ubah Profil'}
              </button>

              {isEditingProfil && (
                <button 
                  onClick={() => { setIsEditingProfil(false); setFotoLogoFile(null); }} 
                  className="btn-action btn-danger">
                  Batal
                </button>
              )}
            </div>
          </div>

          {/* SISI KANAN: FORM / DETAIL INFORMASI */}
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <form onSubmit={handleSimpanProfilRayon} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              
              {/* Nama Rayon */}
              <div className="info-row">
                <span className="info-label">Nama Rayon</span>
                {isEditingProfil ? (
                  <input type="text" className="profile-input" placeholder="PR. PMII ..." value={profilRayon.nama} onChange={(e) => setProfilRayon({...profilRayon, nama: e.target.value})} />
                ) : (
                  <span className="info-value" style={{ fontSize: '1.1rem' }}>{profilRayon.nama || '- Belum diisi -'}</span>
                )}
              </div>

              {/* Tanggal Berdiri */}
              <div className="info-row">
                <span className="info-label">Tanggal / Tahun Berdiri</span>
                {isEditingProfil ? (
                  <input type="text" className="profile-input" placeholder="02 Juli 1995" value={profilRayon.tanggalBerdiri} onChange={(e) => setProfilRayon({...profilRayon, tanggalBerdiri: e.target.value})} />
                ) : (
                  <span className="info-value">{profilRayon.tanggalBerdiri || '- Belum diisi -'}</span>
                )}
              </div>

              {/* Fakultas Naungan */}
              <div className="info-row">
                <span className="info-label">Fakultas Naungan</span>
                {isEditingProfil ? (
                  <input type="text" className="profile-input" placeholder="Fakultas ..." value={profilRayon.fakultas} onChange={(e) => setProfilRayon({...profilRayon, fakultas: e.target.value})} />
                ) : (
                  <span className="info-value">{profilRayon.fakultas || '- Belum diisi -'}</span>
                )}
              </div>

              {/* Program Studi (Tampil dengan Angka 1, 2, dst) */}
              <div className="info-row">
                <span className="info-label">Program Studi</span>
                {isEditingProfil ? (
                  <div>
                    <textarea 
                      rows={4} 
                      className="profile-input" 
                      placeholder="Pendidikan Agama Islam, Pendidikan Bahasa Arab..." 
                      value={profilRayon.programStudi} 
                      onChange={(e) => setProfilRayon({...profilRayon, programStudi: e.target.value})} 
                      style={{ resize: 'vertical' }} 
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>*Pisahkan dengan koma (,) untuk memisahkan setiap program studi.</span>
                  </div>
                ) : (
                  listProgramStudi.length === 0 ? (
                    <span className="info-value" style={{ color: 'var(--text-muted)' }}>- Belum diisi -</span>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {listProgramStudi.map((prodi, idx) => (
                        <li key={idx} style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: '600' }}>
                          {prodi}
                        </li>
                      ))}
                    </ol>
                  )
                )}
              </div>

            </form>
          </div>

        </div>

        <div style={{ height: '40px' }} className="mobile-only"></div>
      </div>
    </>
  );
}