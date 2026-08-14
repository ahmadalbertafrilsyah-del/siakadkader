'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PagePengumpulanTugasKader() {
  const [profilKader, setProfilKader] = useState({ nama: '', email: '', id_rayon: '' });
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [riwayatBerkas, setRiwayatBerkas] = useState<any[]>([]);
  
  const [selectedTugasNama, setSelectedTugasNama] = useState('');
  const [fileTugas, setFileTugas] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilKader({ nama: p.nama, email: p.email, id_rayon: p.id_rayon });

            const unsubTugas = onSnapshot(collection(db, "master_tugas"), (snap) => {
              const list: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.id_rayon === p.id_rayon || d.id_rayon === 'Komisariat') list.push({ id: doc.id, ...d });
              });
              setListMasterTugas(list);
            });
            unsubs.push(unsubTugas);

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
    formData.append("file", file); formData.append("upload_preset", "siakad_upload"); 
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/raw/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  const handleUploadTugas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileTugas || !selectedTugasNama) return alert("Pilih judul tugas dan file terlebih dahulu!");
    
    const isAlreadyUpload = riwayatBerkas.find(r => r.jenis_berkas === selectedTugasNama && r.status === 'Selesai');
    if(isAlreadyUpload) return alert("Anda sudah menyelesaikan tugas ini!");

    setIsUploading(true);
    try {
      const fileUrl = await uploadToCloudinary(fileTugas);
      await addDoc(collection(db, "berkas_kader"), {
        id_rayon: profilKader.id_rayon, email_kader: profilKader.email, jenis_berkas: selectedTugasNama,
        file_link_or_id: fileUrl, nama_file_asli: fileTugas.name, status: "Menunggu Verifikasi",
        tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), timestamp: Date.now()
      });
      alert("Tugas berhasil dikumpulkan!");
      setFileTugas(null); setSelectedTugasNama('');
    } catch (error) { alert("Gagal mengunggah file. Pastikan ukuran file tidak terlalu besar."); } finally { setIsUploading(false); }
  };

  return (
    <>
      <style>{`
        .desktop-view { display: flex; flex-direction: column; gap: 20px; }
        .mobile-view { display: none; }
        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: block !important; }
           body, html, .mobile-content-wrapper, .app-container {
             overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none;
           }
           ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* TAMPILAN DESKTOP UTUH */}
      <div className="desktop-view">
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📋 Pengumpulan Berkas & Tugas</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Unggah file tugas/makalah sesuai judul yang diinstruksikan oleh Pendamping atau Pengurus.</p>
          
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1e824c', fontSize: '0.9rem' }}>📤 Form Upload Tugas</h4>
              <form onSubmit={handleUploadTugas} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Pilih Judul Tugas</label>
                  <select required value={selectedTugasNama} onChange={e => setSelectedTugasNama(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', marginTop: '5px' }}>
                    <option value="" disabled>-- Pilih Tugas yang Tersedia --</option>
                    {listMasterTugas.length === 0 && <option disabled>Tidak ada tugas aktif</option>}
                    {listMasterTugas.map((tugas: any) => (
                       <option key={tugas.id} value={tugas.nama_tugas}>{tugas.nama_tugas} (DL: {tugas.deadline})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Pilih Dokumen (PDF/Word)</label>
                  <input type="file" required onChange={e => setFileTugas(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', padding: '10px', border: '2px dashed #3498db', borderRadius: '4px', fontSize: '0.8rem', outline: 'none', marginTop: '5px', backgroundColor: '#fff' }} />
                </div>
                <button disabled={isUploading} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', marginTop: '10px' }}>
                  {isUploading ? 'MENGUNGGAH FILE...' : 'Kumpulkan Tugas'}
                </button>
              </form>
            </div>

            <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', boxSizing: 'border-box' }}>
              <table className="tabel-utama" style={{ minWidth: '550px', width: '100%' }}>
                <thead style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                  <tr><th style={{ padding: '12px', textAlign: 'left', color: '#fff' }}>Nama Tugas / File</th><th style={{ padding: '12px', textAlign: 'center', color: '#fff' }}>Waktu Kumpul</th><th style={{ padding: '12px', textAlign: 'center', color: '#fff' }}>Status Verifikasi</th></tr>
                </thead>
                <tbody>
                  {riwayatBerkas.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Anda belum mengumpulkan tugas apapun.</td></tr>
                  ) : (
                    riwayatBerkas.map((berkas) => (
                      <tr key={berkas.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '15px 10px' }}>
                          <div style={{ fontWeight: 'bold', color: '#004a87', fontSize: '0.9rem', marginBottom: '4px' }}>{berkas.jenis_berkas}</div>
                          <a href={berkas.file_link_or_id} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#3498db', textDecoration: 'none', fontStyle: 'italic' }}>📄 {berkas.nama_file_asli}</a>
                        </td>
                        <td style={{ padding: '15px 10px', textAlign: 'center', fontSize: '0.8rem', color: '#555' }}>{berkas.tanggal}</td>
                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                          {berkas.status === 'Selesai' ? (
                            <span style={{ backgroundColor: '#eaf4fc', color: '#27ae60', padding: '6px 12px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #2ecc71' }}>✅ Diterima (ACC)</span>
                          ) : (
                            <span style={{ backgroundColor: '#fff3cd', color: '#e67e22', padding: '6px 12px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #f1c40f' }}>⏳ Menunggu Cek</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* TAMPILAN MOBILE APP (KARTU) */}
      <div className="mobile-view">
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eaeaea', marginBottom: '20px' }}>
           <h4 style={{ margin: '0 0 15px 0', color: '#1e824c', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📤 Upload Tugas Baru</h4>
           <form onSubmit={handleUploadTugas} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Pilih Tugas</label>
                <select required value={selectedTugasNama} onChange={e => setSelectedTugasNama(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fcfcfc' }}>
                  <option value="" disabled>-- Daftar Tugas --</option>
                  {listMasterTugas.map((tugas: any) => (
                     <option key={tugas.id} value={tugas.nama_tugas}>{tugas.nama_tugas}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>File (PDF/Word)</label>
                <input type="file" required onChange={e => setFileTugas(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', padding: '10px', border: '2px dashed #3498db', borderRadius: '6px', fontSize: '0.8rem', outline: 'none', backgroundColor: '#fff' }} />
              </div>
              <button disabled={isUploading} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '15px', borderRadius: '6px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                {isUploading ? 'MENGUNGGAH...' : 'Kumpulkan Tugas'}
              </button>
           </form>
        </div>

        <h4 style={{ color: '#555', fontSize: '0.9rem', marginBottom: '10px' }}>Riwayat Tugas Anda</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {riwayatBerkas.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada histori pengumpulan.</div>
          ) : (
            riwayatBerkas.map((berkas) => (
              <div key={berkas.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.9rem', flex: 1 }}>{berkas.jenis_berkas}</div>
                  <div style={{ fontSize: '0.7rem', color: '#888', whiteSpace: 'nowrap', marginLeft: '10px' }}>{berkas.tanggal}</div>
                </div>
                <a href={berkas.file_link_or_id} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#3498db', textDecoration: 'none', fontStyle: 'italic', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  📄 {berkas.nama_file_asli}
                </a>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                  {berkas.status === 'Selesai' ? (
                    <span style={{ backgroundColor: '#eaf4fc', color: '#27ae60', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #2ecc71' }}>Diterima (ACC)</span>
                  ) : (
                    <span style={{ backgroundColor: '#fff3cd', color: '#e67e22', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #f1c40f' }}>Menunggu Cek</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ height: '30px' }}></div>
      </div>
    </>
  );
}