'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PagePengumpulanTugasKader() {
  const [profilKader, setProfilKader] = useState({ nama: '', email: '', id_rayon: '' });
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [riwayatBerkas, setRiwayatBerkas] = useState<any[]>([]);
  
  // State untuk menyimpan file per tugas (key: nama_tugas)
  const [filesToUpload, setFilesToUpload] = useState<Record<string, File>>({});
  // State untuk melacak tugas mana yang sedang loading upload
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilKader({ nama: p.nama, email: p.email, id_rayon: p.id_rayon });

            // Ambil daftar master tugas
            const unsubTugas = onSnapshot(collection(db, "master_tugas"), (snap) => {
              const list: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.id_rayon === p.id_rayon || d.id_rayon === 'Komisariat') list.push({ id: doc.id, ...d });
              });
              setListMasterTugas(list);
            });
            unsubs.push(unsubTugas);

            // Ambil riwayat tugas yang sudah dikumpulkan kader
            const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", p.email));
            const unsubBerkas = onSnapshot(qBerkas, (snap) => {
              const riwayat: any[] = [];
              snap.forEach(doc => riwayat.push({ id: doc.id, ...doc.data() }));
              riwayat.sort((a, b) => b.timestamp - a.timestamp);
              setRiwayatBerkas(riwayat);
            });
            unsubs.push(unsubBerkas);
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
    formData.append("file", file); 
    formData.append("upload_preset", "siakad_upload"); 
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/raw/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  const handleFileChange = (namaTugas: string, file: File | null) => {
    setFilesToUpload(prev => {
      const newFiles = { ...prev };
      if (file) {
        newFiles[namaTugas] = file;
      } else {
        delete newFiles[namaTugas];
      }
      return newFiles;
    });
  };

  const handleUploadTugas = async (namaTugas: string) => {
    const file = filesToUpload[namaTugas];
    if (!file) return alert("Pilih file (PDF/Word) terlebih dahulu untuk tugas ini!");
    
    setUploadingTask(namaTugas);
    try {
      const fileUrl = await uploadToCloudinary(file);
      await addDoc(collection(db, "berkas_kader"), {
        id_rayon: profilKader.id_rayon, 
        email_kader: profilKader.email, 
        jenis_berkas: namaTugas,
        file_link_or_id: fileUrl, 
        nama_file_asli: file.name, 
        status: "Menunggu Verifikasi",
        tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), 
        timestamp: Date.now()
      });
      alert(`Tugas "${namaTugas}" berhasil dikumpulkan!`);
      
      // Bersihkan file dari state setelah sukses
      setFilesToUpload(prev => {
        const newFiles = { ...prev };
        delete newFiles[namaTugas];
        return newFiles;
      });
    } catch (error) { 
      alert("Gagal mengunggah file. Pastikan koneksi stabil."); 
    } finally { 
      setUploadingTask(null); 
    }
  };

  return (
    <>
      <style>{`
        /* RESPONSIVE LAYOUT & HIDE SCROLLBAR */
        .mobile-padded { display: flex; flex-direction: column; gap: 20px; }
        
        @media (max-width: 767px) {
           body, html, .mobile-content-wrapper, .app-container {
             overflow-x: hidden;
             -ms-overflow-style: none;
             scrollbar-width: none;
           }
           ::-webkit-scrollbar {
             display: none;
           }
           .mobile-padded { padding: 15px !important; }
        }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        .file-input-custom { 
           padding: 8px; border: 1px dashed #ccc; border-radius: 6px; 
           background-color: #fafafa; font-size: 0.75rem; width: 100%; 
           max-width: 200px; cursor: pointer; outline: none; transition: 0.2s;
        }
        .file-input-custom:hover { border-color: #3498db; background-color: #f4f9fd; }
      `}</style>

      <div className="web-ui-container mobile-padded">
        
        {/* HEADER */}
        <div style={{ background: 'white', padding: '20px 25px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>Pengumpulan Berkas & Tugas</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', margin: 0 }}>Unggah file tugas atau makalah Anda langsung pada kolom dokumen di bawah ini.</p>
        </div>

        {/* AREA KONTEN UTAMA - TABEL TUGAS */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', padding: '15px', minHeight: '50vh', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
          <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f4f8', color: '#555' }}>
                  <th style={{ padding: '12px 10px', borderRadius: '8px 0 0 8px', textAlign: 'center', width: '5%' }}>No</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', width: '25%' }}>Nama Tugas</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '15%' }}>Tenggat Waktu</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '15%' }}>Status</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '25%' }}>Dokumen / File</th>
                  <th style={{ padding: '12px 10px', borderRadius: '0 8px 8px 0', textAlign: 'center', width: '15%' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {listMasterTugas.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                      Belum ada tugas yang diinstruksikan oleh pengurus.
                    </td>
                  </tr>
                ) : (
                  listMasterTugas.map((tugas, index) => {
                    // Cek apakah kader sudah mengumpulkan tugas ini
                    const submittedBerkas = riwayatBerkas.find(r => r.jenis_berkas === tugas.nama_tugas);
                    const isUploadingThis = uploadingTask === tugas.nama_tugas;
                    const hasFileSelected = !!filesToUpload[tugas.nama_tugas];

                    return (
                      <tr key={tugas.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '15px 10px', textAlign: 'center', color: '#777', fontWeight: 'bold' }}>{index + 1}</td>
                        
                        {/* KOLOM NAMA TUGAS */}
                        <td style={{ padding: '15px 10px' }}>
                          <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>
                            {tugas.nama_tugas}
                          </div>
                        </td>

                        {/* KOLOM TENGGAT WAKTU */}
                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                          <div style={{ color: '#e67e22', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {tugas.deadline || '-'}
                          </div>
                        </td>

                        {/* KOLOM STATUS */}
                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                          {submittedBerkas ? (
                            submittedBerkas.status === 'Selesai' ? (
                              <span style={{ backgroundColor: '#eaf4fc', color: '#27ae60', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #2ecc71', whiteSpace: 'nowrap' }}>✅ Diterima (ACC)</span>
                            ) : (
                              <span style={{ backgroundColor: '#fff3cd', color: '#e67e22', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #f1c40f', whiteSpace: 'nowrap' }}>⏳ Menunggu Cek</span>
                            )
                          ) : (
                            <span style={{ backgroundColor: '#f4f6f9', color: '#7f8c8d', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #bdc3c7', whiteSpace: 'nowrap' }}>Belum Dikerjakan</span>
                          )}
                        </td>

                        {/* KOLOM FILE DOKUMEN */}
                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                          {submittedBerkas ? (
                            // Tampilkan link file jika sudah mengumpulkan
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                              <a href={submittedBerkas.file_link_or_id} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#004a87', textDecoration: 'none', fontWeight: 'bold', padding: '6px 12px', backgroundColor: '#eaf4fc', borderRadius: '6px', border: '1px solid #d6eaf8', display: 'inline-block', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                📄 {submittedBerkas.nama_file_asli}
                              </a>
                              <span style={{ fontSize: '0.7rem', color: '#888' }}>Dikumpul: {submittedBerkas.tanggal}</span>
                            </div>
                          ) : (
                            // Tampilkan input form file jika belum mengumpulkan
                            <input 
                              type="file" 
                              accept=".pdf,.doc,.docx"
                              className="file-input-custom"
                              onChange={(e) => handleFileChange(tugas.nama_tugas, e.target.files ? e.target.files[0] : null)}
                            />
                          )}
                        </td>

                        {/* KOLOM AKSI (TOMBOL KUMPULKAN) */}
                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                          {submittedBerkas ? (
                            <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.8rem' }}>Tugas Selesai 🎉</span>
                          ) : (
                            <button 
                              disabled={isUploadingThis || !hasFileSelected} 
                              onClick={() => handleUploadTugas(tugas.nama_tugas)}
                              style={{ 
                                backgroundColor: hasFileSelected ? '#0000af' : '#95a5a6', 
                                color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', 
                                fontWeight: 'bold', cursor: hasFileSelected ? 'pointer' : 'not-allowed', 
                                fontSize: '0.8rem', transition: '0.3s', whiteSpace: 'nowrap',
                                boxShadow: hasFileSelected ? '0 2px 6px rgba(0,0,175,0.2)' : 'none'
                              }}
                            >
                              {isUploadingThis ? 'Mengunggah...' : '📤 Kumpulkan'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ height: '50px' }} className="mobile-only"></div>
      </div>
    </>
  );
}