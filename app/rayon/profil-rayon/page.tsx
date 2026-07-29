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
            
            // Langsung tarik data spesifik rayon dari database
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

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
      <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #ddd' }}>
         <h3 style={{ margin: 0, color: '#0d1b2a', fontSize: '1.2rem' }}>🏢 Profil Rayon</h3>
         <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#777' }}>Lengkapi data identitas Rayon Anda di bawah ini.</p>
      </div>
      <div style={{ padding: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 200px', textAlign: 'center' }}>
          <img src={profilRayon.fotoLogoUrl} alt="Logo Rayon" style={{ width: '100%', height: '200px', objectFit: 'contain', border: '4px solid #eee', borderRadius: '8px', backgroundColor: '#fafafa' }} />
          {isEditingProfil && (
            <div style={{ marginTop: '10px', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Unggah Logo Baru:</label>
              <input type="file" accept="image/*" onChange={(e) => {
                 if (e.target.files && e.target.files[0]) {
                   setFotoLogoFile(e.target.files[0]);
                   setProfilRayon({ ...profilRayon, fotoLogoUrl: URL.createObjectURL(e.target.files[0]) });
                 }
              }} style={{ width: '100%', fontSize: '0.7rem', marginTop: '5px' }} />
            </div>
          )}
          <button 
            disabled={isSavingPengaturan}
            onClick={() => isEditingProfil ? handleSimpanProfilRayon(new Event('submit') as any) : setIsEditingProfil(true)} 
            style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: isEditingProfil ? '#2ecc71' : '#0000af', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.85rem', transition: '0.2s' }}>
            {isSavingPengaturan ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil Rayon' : '📝 Ubah Profil'}
          </button>
          {isEditingProfil && (
             <button onClick={() => {setIsEditingProfil(false); setFotoLogoFile(null);}} style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Batal</button>
          )}
        </div>
        <div style={{ flex: '1 1 350px' }}>
          <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
            <form onSubmit={handleSimpanProfilRayon}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#333', minWidth: '400px' }}>
                <tbody>
                  {[
                    { label: 'Nama Rayon', key: 'nama', placeholder: 'PR. PMII ...' },
                    { label: 'Tanggal / Tahun Berdiri', key: 'tanggalBerdiri', placeholder: 'DD-MM-YYYY' },
                    { label: 'Fakultas Naungan', key: 'fakultas', placeholder: 'Fakultas ...' },
                    { label: 'Program Studi', key: 'programStudi', placeholder: 'Prodi A, Prodi B, Prodi C...' },
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold', width: '200px', color: '#555' }}>{row.label}</td>
                      <td style={{ padding: '12px 10px' }}>
                        {isEditingProfil ? (
                          row.key === 'programStudi' ? (
                             <div>
                                <textarea rows={2} placeholder={row.placeholder} value={(profilRayon as any)[row.key]} onChange={(e) => setProfilRayon({...profilRayon, [row.key]: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />
                                <span style={{fontSize: '0.7rem', color: '#888'}}>*Pisahkan dengan koma jika lebih dari satu prodi.</span>
                             </div>
                          ) : (
                             <input type="text" placeholder={row.placeholder} value={(profilRayon as any)[row.key]} onChange={(e) => setProfilRayon({...profilRayon, [row.key]: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
                          )
                        ) : ( 
                          <span style={{ color: '#333', fontWeight: row.key === 'nama' ? 'bold' : 'normal', fontSize: row.key === 'nama' ? '1rem' : '0.85rem' }}>
                            {(profilRayon as any)[row.key] || '- Belum diisi -'}
                          </span> 
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}