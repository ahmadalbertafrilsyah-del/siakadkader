'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PagePerpustakaanRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [listPerpus, setListPerpus] = useState<any[]>([]);
  const [formPerpus, setFormPerpus] = useState({ folder: 'MAPABA', nama_file: '' });
  const [filePerpus, setFilePerpus] = useState<File | null>(null);
  const [isUploadingPerpus, setIsUploadingPerpus] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(snapRole.docs[0].data().nama || currentRayonId);
            
            onSnapshot(query(collection(db, "perpustakaan"), where("id_rayon", "==", currentRayonId)), (snap: any) => {
              const list: any[] = [];
              snap.forEach((doc: any) => list.push({ id: doc.id, ...doc.data() }));
              setListPerpus(list);
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
    // Menggunakan upload tipe 'raw' untuk PDF/Dokumen
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/raw/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon",
        aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  const handleTambahPerpus = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if(!filePerpus) return alert("Pilih file terlebih dahulu!"); 
    setIsUploadingPerpus(true);
    try { 
      const fileUrl = await uploadToCloudinary(filePerpus); 
      await addDoc(collection(db, "perpustakaan"), { 
        id_rayon: adminRayonId, folder: formPerpus.folder, nama_file: formPerpus.nama_file, 
        link_file: fileUrl, timestamp: Date.now() 
      }); 
      catatLogAktivitas(`Mengupload E-Book/Materi: ${formPerpus.nama_file}`);
      setFormPerpus({ ...formPerpus, nama_file: '' }); setFilePerpus(null); 
    } catch (error) { alert("Gagal mengupload file."); } finally { setIsUploadingPerpus(false); }
  };

  const handleHapusPerpus = async (idPerpus: string, namaFile: string) => { 
    if(window.confirm(`Hapus dokumen "${namaFile}"?`)) {
      await deleteDoc(doc(db, "perpustakaan", idPerpus)); 
      catatLogAktivitas(`Menghapus E-Book/Materi: ${namaFile}`);
    }
  };

  const groupedPerpus = listPerpus.reduce((acc: any, item: any) => { 
    if (!acc[item.folder]) acc[item.folder] = []; 
    acc[item.folder].push(item); 
    return acc; 
  }, {});

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           body, html, .mobile-content-wrapper, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .mobile-padded { display: flex; flex-direction: column; gap: 15px; }
        }
        @media (min-width: 768px) {
           .mobile-view { display: none !important; }
        }
      `}</style>

      {/* DESKTOP VIEW */}
      <div className="desktop-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
            <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>📁 Perpustakaan Digital Rayon</h3>
            <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Sediakan modul e-book, jurnal, atau referensi materi sesuai jenjang yang bisa dibaca kader.</p>
          </div>

          <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '8px', marginBottom: '25px' }}>
            <form onSubmit={handleTambahPerpus} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Kategori Map</label>
                <select required value={formPerpus.folder} onChange={e => setFormPerpus({...formPerpus, folder: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="MAPABA">Materi MAPABA</option><option value="PKD">Materi PKD</option><option value="SIG">Materi SIG</option><option value="SKP">Materi SKP</option><option value="UMUM">Bacaan Umum</option>
                </select>
              </div>
              <div style={{ flex: '2 1 200px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Nama Modul / E-Book</label>
                <input type="text" placeholder="Misal: Modul NDP PMII" required value={formPerpus.nama_file} onChange={e => setFormPerpus({...formPerpus, nama_file: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none' }} />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Pilih File (PDF/Doc)</label>
                <input type="file" required onChange={e => setFilePerpus(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', padding: '8px', border: '1px dashed #3498db', borderRadius: '4px', fontSize: '0.8rem', outline: 'none' }} />
              </div>
              <button disabled={isUploadingPerpus} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: isUploadingPerpus ? 'not-allowed' : 'pointer', height: '40px', fontSize: '0.85rem' }}>
                {isUploadingPerpus ? 'Mengupload...' : '📤 Upload File'}
              </button>
            </form>
          </div>

          <div>
            {Object.keys(groupedPerpus).length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>Belum ada file di Perpustakaan Digital.</div>
            ) : (
              Object.keys(groupedPerpus).map(folder => (
                <div key={folder} style={{ marginBottom: '20px', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#eaf4fc', padding: '10px 15px', fontWeight: 'bold', color: '#0000af', borderBottom: '1px solid #eee' }}>📁 Folder: {folder}</div>
                  <div style={{ padding: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                    {groupedPerpus[folder].map((item: any) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '6px' }}>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nama_file}</div>
                          <a href={item.link_file} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: '#3498db', textDecoration: 'none', fontWeight: 'bold' }}>👁️ Buka Dokumen</a>
                        </div>
                        <button onClick={() => handleHapusPerpus(item.id, item.nama_file)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '1.2rem', padding: '5px' }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="mobile-view mobile-padded">
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <h4 style={{ marginTop: 0, color: '#0000af', fontSize: '1rem', marginBottom: '15px' }}>📤 Upload Modul Baru</h4>
          <form onSubmit={handleTambahPerpus} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <select required value={formPerpus.folder} onChange={e => setFormPerpus({...formPerpus, folder: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', backgroundColor: '#fff', outline: 'none' }}>
               <option value="MAPABA">Materi MAPABA</option><option value="PKD">Materi PKD</option><option value="SIG">Materi SIG</option><option value="SKP">Materi SKP</option><option value="UMUM">Bacaan Umum</option>
            </select>
            <input type="text" placeholder="Nama Modul / E-Book" required value={formPerpus.nama_file} onChange={e => setFormPerpus({...formPerpus, nama_file: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
            <input type="file" required onChange={e => setFilePerpus(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', padding: '10px', border: '2px dashed #3498db', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
            <button disabled={isUploadingPerpus} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>{isUploadingPerpus ? 'Mengupload...' : 'Upload File'}</button>
          </form>
        </div>

        <h4 style={{ margin: '10px 0 5px 0', color: '#555', fontSize: '0.9rem' }}>Daftar Modul Rayon</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {Object.keys(groupedPerpus).length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', color: '#999', fontSize: '0.85rem' }}>Belum ada file di Perpustakaan.</div>
          ) : (
            Object.keys(groupedPerpus).sort().map(folder => (
              <div key={folder} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e824c', marginBottom: '10px', borderBottom: '2px solid #1e824c', display: 'inline-block' }}>📁 Folder: {folder}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {groupedPerpus[folder].map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                      <div style={{ overflow: 'hidden', flex: 1, paddingRight: '10px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '5px' }}>{item.nama_file}</div>
                        <a href={item.link_file} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#3498db', textDecoration: 'none', fontWeight: 'bold' }}>👁️ Buka / Unduh Dokumen</a>
                      </div>
                      <button onClick={() => handleHapusPerpus(item.id, item.nama_file)} style={{ color: '#e74c3c', backgroundColor: '#fff0f0', border: '1px solid #fadbd8', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>Hapus</button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ height: '80px' }}></div>
      </div>
    </>
  );
}