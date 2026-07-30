'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageBerkasTugasPendamping() {
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '' });
  const [berkasTugas, setBerkasTugas] = useState<any[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon });

            const isPendampingSKP = p.id_rayon === 'Komisariat';
            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const emailKaderBinaan: string[] = [];
            
            snapKader.forEach(d => {
              const data = d.data();
              let isBinaan = false;
              if (isPendampingSKP) {
                  if (Array.isArray(data.pendamping_skp_id)) { if (data.pendamping_skp_id.includes(p.username)) isBinaan = true; } 
                  else if (data.pendamping_skp_id === p.username) isBinaan = true;
              } else {
                  const pMapaba = Array.isArray(data.pendamping_mapaba_id) ? data.pendamping_mapaba_id : (data.pendamping_mapaba_id ? [data.pendamping_mapaba_id] : []);
                  const pPkd = Array.isArray(data.pendamping_pkd_id) ? data.pendamping_pkd_id : (data.pendamping_pkd_id ? [data.pendamping_pkd_id] : []);
                  const pSig = Array.isArray(data.pendamping_sig_id) ? data.pendamping_sig_id : (data.pendamping_sig_id ? [data.pendamping_sig_id] : []);
                  if (pMapaba.includes(p.username) || pPkd.includes(p.username) || pSig.includes(p.username) || data.pendampingId === p.username) isBinaan = true;
              }
              if (isBinaan) emailKaderBinaan.push(data.email);
            });

            if (emailKaderBinaan.length > 0) {
              const unsubBerkas = onSnapshot(collection(db, "berkas_kader"), (snap) => {
                 const dataBerkas: any[] = [];
                 snap.forEach(doc => { const d = doc.data(); if (emailKaderBinaan.includes(d.email_kader)) dataBerkas.push({ id: doc.id, ...d }); });
                 dataBerkas.sort((a, b) => b.timestamp - a.timestamp);
                 setBerkasTugas(dataBerkas);
              });
              unsubs.push(unsubBerkas);
            }
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(u => u());
    };
  }, []);

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { id_rayon: profilPendamping.id_rayon, aktor: `Pendamping (${profilPendamping.nama})`, username: profilPendamping.username, role: "pendamping", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  const handleVerifikasiTugas = async (idBerkas: string) => {
    try {
      await updateDoc(doc(db, "berkas_kader", idBerkas), { status: 'Selesai' });
      catatLogAktivitas(`Memverifikasi (ACC) tugas kader.`);
    } catch (error) { alert("Error verifikasi tugas."); }
  };

  return (
    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <h3 style={{ color: '#1e824c', margin: '0 0 15px 0', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Verifikasi Tugas Kader Binaan</h3>
      <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '15px' }}>Daftar tugas yang telah dikerjakan dan diunggah oleh kader binaan Anda.</p>
      
      <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
        <table className="tabel-utama" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '550px' }}>
          <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555', textAlign: 'left' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Kader / Tanggal</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Nama Tugas Berkas</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Dokumen</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi Status</th></tr></thead>
          <tbody>
            {berkasTugas.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}><b style={{color: '#004a87'}}>{b.email_kader.split('@')[0]}</b><br/><span style={{fontSize: '0.7rem', color: '#999'}}>{b.tanggal}</span></td>
                <td style={{ padding: '10px' }}><b>{b.jenis_berkas}</b><br/><span style={{fontSize: '0.7rem', color: '#666', fontStyle: 'italic'}}>{b.nama_file_asli}</span></td>
                <td style={{ padding: '10px', textAlign: 'center' }}><a href={b.file_link_or_id} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 8px', backgroundColor: '#f1c40f', borderRadius: '4px', textDecoration: 'none', color: '#333', fontWeight: 'bold', fontSize: '0.7rem' }}>👁️ Lihat</a></td>
                <td style={{ padding: '10px', textAlign: 'center' }}>{b.status === 'Selesai' ? <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.75rem' }}>✅ Selesai</span> : <button onClick={() => handleVerifikasiTugas(b.id)} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>Verifikasi Selesai</button>}</td>
              </tr>
            ))}
            {berkasTugas.length === 0 && <tr><td colSpan={4} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada berkas tugas yang diunggah oleh kader binaan Anda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}