'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageBroadcastRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [riwayatBroadcast, setRiwayatBroadcast] = useState<any[]>([]);
  const [notifikasiInbox, setNotifikasiInbox] = useState<any[]>([]); 
  
  const [formBroadcast, setFormBroadcast] = useState({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(snapRole.docs[0].data().nama || currentRayonId);
            
            onSnapshot(collection(db, "notifikasi_global"), (snap) => {
              const listSent: any[] = []; const listInbox: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.id_rayon === currentRayonId && d.pengirim !== "Pusat Komisariat") listSent.push({ id: doc.id, ...d });
                if (d.pengirim === "Pusat Komisariat" && (d.target === "Semua" || d.target === "Rayon")) listInbox.push({ id: doc.id, ...d });
              });
              listSent.sort((a, b) => b.timestamp - a.timestamp); 
              listInbox.sort((a, b) => b.timestamp - a.timestamp);
              setRiwayatBroadcast(listSent); 
              setNotifikasiInbox(listInbox);
            });
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon",
        aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  const handleKirimBroadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notifikasi_global"), { 
        ...formBroadcast, id_rayon: adminRayonId, pengirim: namaRayonAsli || adminRayonId, 
        tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), 
        timestamp: Date.now() 
      });
      catatLogAktivitas(`Mengirim Broadcast (${formBroadcast.target}): ${formBroadcast.judul}`); 
      alert("Pesan berhasil disiarkan!");
      setFormBroadcast({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleHapusBroadcast = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus/tarik pesan broadcast "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "notifikasi_global", id)); catatLogAktivitas(`Menarik pesan Broadcast: ${judul}`); } catch (error) {}
  };

  return (
    <>
      <style>{`
        /* COLOR PALETTE & MODERN ENTERPRISE STYLING */
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

        .form-control-custom {
          width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); 
          background-color: #ffffff; border-radius: 6px; font-size: 0.9rem; outline: none; 
          color: var(--text-main); transition: border-color 0.2s; box-sizing: border-box;
          font-family: inherit;
        }
        .form-control-custom:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }

        .desktop-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .desktop-table th { background-color: #f8fafc; color: var(--text-main); padding: 14px 16px; font-weight: 600; border-bottom: 1px solid var(--border-color); }
        .desktop-table td { padding: 16px; border-bottom: 1px solid #f3f4f6; color: var(--text-body); background-color: #fff; vertical-align: top; }

        .btn-submit {
          background-color: #2563eb; color: white; border: none; padding: 12px 24px;
          border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.9rem;
          transition: background-color 0.2s; text-align: center;
        }
        .btn-submit:hover:not(:disabled) { background-color: #1d4ed8; }
        .btn-submit:disabled { background-color: #9ca3af; cursor: not-allowed; }

        .badge-target {
          background-color: #eff6ff; color: #1d4ed8; padding: 4px 10px; 
          border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: 1px solid #dbeafe;
          display: inline-block;
        }

        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .mobile-padded { display: flex; flex-direction: column; gap: 16px; padding: 16px !important; }
        }
        @media (min-width: 768px) {
           .mobile-view { display: none !important; }
           .desktop-view { display: flex; flex-direction: column; gap: 24px; }
        }
      `}</style>

      {/* DESKTOP VIEW */}
      <div className="desktop-view page-wrapper">
        
        {/* HEADER */}
        <div className="header-card">
          <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '700' }}>📡 Pusat Broadcast Notifikasi</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Kirimkan pesan mendesak atau pengumuman penting kepada pengguna di Rayon Anda.</p>
        </div>

        {/* 1. BAGIAN ATAS: BUAT SIARAN BARU & KOTAK MASUK */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Form Buat Siaran Baru */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: '600', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>Buat Siaran Baru</h4>
            
            <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Judul Pesan</label>
                <input type="text" required placeholder="Cth: Undangan Rapat Pleno" value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} className="form-control-custom" />
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Isi Pesan Lengkap</label>
                <textarea rows={4} required placeholder="Tulis isi pengumuman secara mendetail..." value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} className="form-control-custom" style={{ resize: 'vertical' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Batas Waktu</label>
                  <input type="date" required value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} className="form-control-custom" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Target Penerima</label>
                  <select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} className="form-control-custom" style={{ cursor: 'pointer' }}>
                    <option value="Semua">📢 Semua Pengguna Rayon</option>
                    <option value="Pendamping">👤 Hanya Para Pendamping</option>
                    <option value="Kader">🎓 Hanya Seluruh Kader</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button disabled={isSubmitting} type="submit" className="btn-submit">
                  {isSubmitting ? 'Menyiarkan...' : 'Siarkan Pesan'}
                </button>
              </div>
            </form>
          </div>

          {/* Kotak Masuk dari Komisariat */}
          <div style={{ backgroundColor: '#fffbeb', padding: '24px', border: '1px solid #fef3c7', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
             <h4 style={{ margin: '0 0 16px 0', color: '#b45309', fontSize: '1.05rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #fde68a', paddingBottom: '12px' }}>
               <span>📥</span> Kotak Masuk (Dari Komisariat)
             </h4>
             <div style={{ maxHeight: '315px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }} className="hide-scroll">
               {notifikasiInbox.length === 0 ? (
                 <div style={{ fontSize: '0.85rem', color: '#d97706', fontStyle: 'italic', padding: '15px 0' }}>Tidak ada pesan masuk dari pusat komisariat.</div>
               ) : (
                 notifikasiInbox.map(notif => (
                     <div key={notif.id} style={{ backgroundColor: '#fff', padding: '14px', borderRadius: '6px', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b' }}>
                       <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem', marginBottom: '4px' }}>{notif.judul}</div>
                       <div style={{ fontSize: '0.825rem', color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: '1.4', marginBottom: '6px' }}>{notif.pesan}</div>
                       <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: '500' }}>{notif.tanggal}</div>
                     </div>
                 ))
               )}
             </div>
          </div>

        </div>

        {/* 2. BAGIAN BAWAH: TABEL RIWAYAT PESAN TERKIRIM (LEBAR PENUH) */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: '600' }}>Riwayat Pesan Terkirim</h4>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table className="desktop-table">
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>Judul & Pesan Terkirim</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Batas Waktu</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Target</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {riwayatBroadcast.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada riwayat pengumuman yang Anda buat.</td></tr>
                ) : (
                  riwayatBroadcast.map((notif) => (
                    <tr key={notif.id}>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '4px' }}>{notif.judul}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{notif.pesan}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: '#dc2626', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {notif.batas_waktu ? notif.batas_waktu.split('-').reverse().join('-') : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge-target">{notif.target}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#dc2626', border: '1px solid #fee2e2', background: '#fef2f2', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem' }} title="Tarik / Hapus Pesan">
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MOBILE VIEW */}
      <div className="mobile-view mobile-padded">
        
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <h4 style={{ marginTop: 0, color: '#111827', fontSize: '1rem', marginBottom: '15px', fontWeight: '700' }}>🚀 Siarkan Pengumuman Baru</h4>
          <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Judul Pengumuman" className="form-control-custom" />
            <textarea rows={4} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Isi pesan selengkapnya..." className="form-control-custom" />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
               <input type="date" value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} className="form-control-custom" style={{ flex: 1 }} />
               <select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} className="form-control-custom" style={{ flex: 1, backgroundColor: '#fff' }}>
                  <option value="Semua">Semua</option><option value="Pendamping">Pendamping</option><option value="Kader">Kader</option>
               </select>
            </div>
            <button disabled={isSubmitting} type="submit" className="btn-submit" style={{ marginTop: '4px' }}>{isSubmitting ? 'Mengirim...' : 'Siarkan Pesan'}</button>
          </form>
        </div>

        {notifikasiInbox.length > 0 && (
          <div style={{ backgroundColor: '#fffbeb', padding: '20px', borderRadius: '12px', border: '1px solid #fef3c7' }}>
             <h4 style={{ margin: '0 0 12px 0', color: '#b45309', fontSize: '0.95rem', fontWeight: '700' }}>📥 Pesan Dari Komisariat</h4>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {notifikasiInbox.map(notif => (
                 <div key={notif.id} style={{ backgroundColor: '#fff', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', border: '1px solid #fde68a' }}>
                   <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem', marginBottom: '4px' }}>{notif.judul}</div>
                   <div style={{ fontSize: '0.8rem', color: '#4b5563', margin: '4px 0', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{notif.pesan}</div>
                   <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '6px' }}>{notif.tanggal}</div>
                 </div>
               ))}
             </div>
          </div>
        )}

        <h4 style={{ margin: '10px 0 5px 0', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: '700' }}>Riwayat Pesan Terkirim</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {riwayatBroadcast.length === 0 ? (
             <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada pengumuman terkirim.</div>
          ) : (
            riwayatBroadcast.map((notif) => (
              <div key={notif.id} style={{ backgroundColor: '#fff', border: '1px solid #eaeaea', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                   <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: '600' }}>{notif.judul}</strong>
                   <span className="badge-target">{notif.target}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-body)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{notif.pesan}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                   <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{notif.tanggal.split(' pukul')[0]}</span>
                   <button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>Tarik / Hapus</button>
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