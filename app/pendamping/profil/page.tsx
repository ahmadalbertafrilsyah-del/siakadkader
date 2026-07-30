'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageProfilPendamping() {
  const [profilPendamping, setProfilPendamping] = useState({ 
    nama: 'Loading...', username: '', fotoUrl: 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO', noHp: '', alamat: '', id_rayon: '', jenjangTugas: 'MAPABA' 
  });
  
  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [isSavingProfil, setIsSavingProfil] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  useEffect(() => {
    let unsubRole: any = null; // Variabel penyimpan fungsi pembersih

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ 
              nama: p.nama || '', username: p.username || '', fotoUrl: p.fotoUrl || 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO',
              noHp: p.noHp || '', alamat: p.alamat || '', id_rayon: p.id_rayon || '', jenjangTugas: p.jenjangTugas || 'MAPABA'
            });
          }
        });
      } else {
        if (unsubRole) unsubRole(); // Matikan listener jika user logout
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubRole) unsubRole(); // Matikan listener saat pindah halaman
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

  const catatLogAktivitas = async (aksi: string) => {
    if (!profilPendamping.username) return;
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: profilPendamping.id_rayon, aktor: `Pendamping (${profilPendamping.nama})`, username: profilPendamping.username,
        role: "pendamping", aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  const handleSimpanProfil = async () => {
    if(!profilPendamping.username) return;
    setIsSavingProfil(true);
    try {
      let finalFotoUrl = profilPendamping.fotoUrl;
      if (fotoFile) finalFotoUrl = await uploadToCloudinary(fotoFile); 
      await updateDoc(doc(db, "users", profilPendamping.username), { noHp: profilPendamping.noHp, alamat: profilPendamping.alamat, fotoUrl: finalFotoUrl });
      catatLogAktivitas("Memperbarui foto/data profil pendamping."); alert("Profil diperbarui!");
      setIsEditingProfil(false); setFotoFile(null);
    } catch (error) { alert("Gagal simpan"); } finally { setIsSavingProfil(false); }
  };

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', fontWeight: 'bold' }}>PROFIL SAYA</div>
      <div style={{ padding: '30px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 180px', textAlign: 'center' }}>
          <img src={profilPendamping.fotoUrl} alt="Foto Pendamping" style={{ width: '100%', height: '230px', objectFit: 'cover', borderRadius: '8px', border: '4px solid #eee' }} />
          {isEditingProfil && (
            <div style={{ marginTop: '10px', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Unggah Foto Baru:</label>
              <input type="file" accept="image/*" onChange={(e) => {
                 if (e.target.files && e.target.files[0]) {
                   setFotoFile(e.target.files[0]);
                   setProfilPendamping({ ...profilPendamping, fotoUrl: URL.createObjectURL(e.target.files[0]) });
                 }
              }} style={{ marginTop: '5px', fontSize: '0.7rem', width: '100%' }} />
            </div>
          )}
          <button 
            onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
            disabled={isSavingProfil} 
            style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: isEditingProfil ? '#2ecc71' : '#1e824c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
            {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil' : '📝 Ubah Profil Saya'}
          </button>
        </div>
        
        <div style={{ flex: '1 1 350px' }}>
          <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#333', minWidth: '400px' }}>
              <tbody>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', width: '35%', borderBottom: '1px solid #eee' }}>Username</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{profilPendamping.username}</td></tr>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nama Lengkap</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{profilPendamping.nama}</td></tr>
                <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Tugas Pendampingan</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}><span style={{ color: '#e67e22', fontWeight: 'bold', backgroundColor: '#fff3cd', padding: '4px 8px', borderRadius: '4px' }}>{profilPendamping.jenjangTugas}</span></td></tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nomor WhatsApp</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    {isEditingProfil ? (
                      <input type="text" value={profilPendamping.noHp} onChange={e => setProfilPendamping({...profilPendamping, noHp: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
                    ) : (profilPendamping.noHp || '-')}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Alamat / Domisili</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    {isEditingProfil ? (
                      <input type="text" value={profilPendamping.alamat} onChange={e => setProfilPendamping({...profilPendamping, alamat: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
                    ) : (profilPendamping.alamat || '-')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {isEditingProfil && <p style={{ fontSize: '0.75rem', color: '#e74c3c', marginTop: '10px' }}>*Nama, Username, dan Jenjang Tugas hanya bisa diubah oleh Pengurus Instansi Atas.</p>}
        </div>
      </div>
    </div>
  );
}