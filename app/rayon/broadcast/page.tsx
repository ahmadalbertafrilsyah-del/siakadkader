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
      alert("Pesan disiarkan!");
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
        /* OVERRIDE CSS TABEL AGAR TIDAK PUCAT DI LAPTOP */
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .tabel-utama thead tr { background-color: #0d1b2a !important; color: white !important; border: none !important; }
        .tabel-utama th { color: white !important; padding: 12px 15px !important; border: none !important; font-weight: bold; }
        .tabel-utama td { padding: 12px 15px !important; border-bottom: 1px solid #eee !important; color: #333 !important; background-color: #fff !important; }

        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .mobile-padded { display: flex; flex-direction: column; gap: 15px; padding: 15px !important; }
        }
        @media (min-width: 768px) {
           .mobile-view { display: none !important; }
        }
      `}</style>

      {/* DESKTOP VIEW */}
      <div className="desktop-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.2rem' }}>📡 Pusat Broadcast Notifikasi</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px' }}>Kirimkan pesan mendesak atau pengumuman penting kepada pengguna di Rayon Anda.</p>
          
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
                <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Judul Pesan</label><input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} /></div>
                  <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Isi Pesan Lengkap</label><textarea rows={4} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical', outline: 'none' }} /></div>
                  <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Batas Waktu</label><input type="date" required value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} /></div>
                  <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Target Penerima</label><select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}><option value="Semua">📢 Semua Pengguna Rayon</option><option value="Pendamping">👤 Hanya Para Pendamping</option><option value="Kader">🎓 Hanya Seluruh Kader</option></select></div>
                  <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>Siarkan Pesan</button>
                </form>
              </div>
              <div style={{ backgroundColor: '#fff3cd', padding: '15px', border: '1px solid #ffeeba', borderRadius: '8px' }}>
                 <h4 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '0.9rem' }}>📥 Kotak Masuk (Dari Komisariat)</h4>
                 <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                   {notifikasiInbox.length === 0 ? (
                     <div style={{ fontSize: '0.8rem', color: '#856404', fontStyle: 'italic' }}>Tidak ada pesan masuk.</div>
                   ) : (
                     notifikasiInbox.map(notif => (
                         <div key={notif.id} style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', marginBottom: '8px', borderLeft: '3px solid #f1c40f' }}>
                           <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem' }}>{notif.judul}</div>
                           <div style={{ fontSize: '0.75rem', color: '#555', whiteSpace: 'pre-wrap', margin: '4px 0' }}>{notif.pesan}</div>
                           <div style={{ fontSize: '0.65rem', color: '#999' }}>{notif.tanggal}</div>
                         </div>
                     ))
                   )}
                 </div>
              </div>
            </div>
            
            <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="tabel-utama" style={{ minWidth: '550px', width: '100%' }}>
                <thead style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                  <tr>
                    <th style={{ padding: '12px', color: 'white', textAlign: 'left' }}>Judul & Pesan Terkirim</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: 'white' }}>Batas Waktu</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: 'white' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {riwayatBroadcast.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada riwayat pengumuman yang Anda buat.</td></tr>
                  ) : (
                    riwayatBroadcast.map((notif) => (
                      <tr key={notif.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px' }}><div style={{ fontWeight: 'bold', color: '#1e824c', fontSize: '0.9rem' }}>{notif.judul}</div><div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{notif.pesan}</div></td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#e74c3c' }}>{notif.batas_waktu || '-'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}><button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="mobile-view mobile-padded">
        
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <h4 style={{ marginTop: 0, color: '#0000af', fontSize: '1rem', marginBottom: '15px' }}>🚀 Siarkan Pengumuman Baru</h4>
          <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Judul Pengumuman" style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
            <textarea rows={4} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Isi pesan..." style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
               <input type="date" value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} style={{ flex: 1, padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
               <select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} style={{ flex: 1, padding: '12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.85rem', backgroundColor: '#fff', outline: 'none' }}>
                  <option value="Semua">Semua</option><option value="Pendamping">Pendamping</option><option value="Kader">Kader</option>
               </select>
            </div>
            <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>{isSubmitting ? 'Mengirim...' : 'Siarkan Pesan'}</button>
          </form>
        </div>

        {notifikasiInbox.length > 0 && (
          <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '12px', border: '1px solid #ffeeba' }}>
             <h4 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '0.95rem' }}>📥 Pesan Dari Komisariat</h4>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {notifikasiInbox.map(notif => (
                 <div key={notif.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #f1c40f' }}>
                   <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>{notif.judul}</div>
                   <div style={{ fontSize: '0.8rem', color: '#555', margin: '4px 0', whiteSpace: 'pre-wrap' }}>{notif.pesan}</div>
                   <div style={{ fontSize: '0.7rem', color: '#999' }}>{notif.tanggal}</div>
                 </div>
               ))}
             </div>
          </div>
        )}

        <h4 style={{ margin: '10px 0 5px 0', color: '#555', fontSize: '0.9rem', fontWeight: 'bold' }}>Riwayat Pesan Terkirim</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {riwayatBroadcast.length === 0 ? (
             <div style={{ padding: '25px', textAlign: 'center', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', color: '#999', fontSize: '0.85rem' }}>Belum ada pengumuman terkirim.</div>
          ) : (
            riwayatBroadcast.map((notif) => (
              <div key={notif.id} style={{ backgroundColor: '#fff', border: '1px solid #eaeaea', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                   <strong style={{ color: '#1e824c', fontSize: '1rem' }}>{notif.judul}</strong>
                   <span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold' }}>{notif.target}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{notif.pesan}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                   <span style={{ fontSize: '0.75rem', color: '#999' }}>{notif.tanggal.split(' pukul')[0]}</span>
                   <button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#e74c3c', backgroundColor: '#fff0f0', border: '1px solid #fadbd8', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>Tarik/Hapus</button>
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