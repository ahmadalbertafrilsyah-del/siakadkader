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
    <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#2980b9', padding: '15px 20px', color: 'white', fontWeight: 'bold' }}>PROFIL KADER</div>
      <div style={{ padding: '30px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 180px', textAlign: 'center' }}>
          <img src={profilKader.fotoUrl} alt="Foto Kader" style={{ width: '100%', height: '230px', objectFit: 'cover', borderRadius: '8px', border: '4px solid #eee' }} />
          {isEditingProfil && (
            <div style={{ marginTop: '10px', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Unggah Foto Baru:</label>
              <input type="file" accept="image/*" onChange={(e) => {
                 if (e.target.files && e.target.files[0]) {
                   setFotoFile(e.target.files[0]);
                   setProfilKader({ ...profilKader, fotoUrl: URL.createObjectURL(e.target.files[0]) });
                 }
              }} style={{ marginTop: '5px', fontSize: '0.7rem', width: '100%' }} />
            </div>
          )}
          <button 
            onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
            disabled={isSavingProfil} 
            style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: isEditingProfil ? '#2ecc71' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
            {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil' : '📝 Ubah Profil Saya'}
          </button>
        </div>
        
        <div style={{ flex: '1 1 350px' }}>
          <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#333', minWidth: '400px' }}>
              <tbody>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', width: '35%', borderBottom: '1px solid #eee' }}>Nomor Induk Mahasiswa (NIM)</td><td style={{ padding: '10px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{profilKader.nim}</td></tr>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nomor Induk Anggota (NIA)</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{profilKader.nia || '-'}</td></tr>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nama Lengkap</td><td style={{ padding: '10px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{profilKader.nama}</td></tr>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Asal Instansi (Rayon/Luar)</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{namaRayonInduk}</td></tr>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Tahun Angkatan</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{profilKader.angkatan}</td></tr>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Status Jenjang Terakhir</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}><span style={{ color: '#004a87', fontWeight: 'bold', backgroundColor: '#eaf4fc', padding: '4px 8px', borderRadius: '4px' }}>{profilKader.jenjang}</span></td></tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nomor WhatsApp</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    {isEditingProfil ? (
                      <input type="text" value={profilKader.noHp} onChange={e => setProfilKader({...profilKader, noHp: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
                    ) : (profilKader.noHp || '-')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Alamat / Domisili</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    {isEditingProfil ? (
                      <input type="text" value={profilKader.alamat} onChange={e => setProfilKader({...profilKader, alamat: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
                    ) : (profilKader.alamat || '-')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {isEditingProfil && <p style={{ fontSize: '0.75rem', color: '#e74c3c', marginTop: '10px' }}>*NIM, Nama, Asal Rayon, dan Jenjang hanya bisa diubah oleh Pengurus/Admin Rayon.</p>}
        </div>
      </div>
    </div>
  );
}