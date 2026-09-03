'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageKalenderRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [formJadwal, setFormJadwal] = useState({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua Internal Rayon' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const userData = snapRole.docs[0].data();
            const currentRayonId = userData.username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(userData.nama || currentRayonId);

            // Ambil semua jadwal, lalu filter di sisi klien
            const unsubJadwal = onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
              const listJadwal: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                // 1. Tampilkan jadwal dari Komisariat yang ditargetkan untuk Semua atau Rayon
                const isDariKomisariat = d.pembuat === "Komisariat" && (d.target === "Semua" || d.target === "Rayon");
                // 2. Tampilkan jadwal lokal yang dibuat oleh Rayon ini sendiri
                const isLokalRayon = d.id_rayon === currentRayonId;

                if (isDariKomisariat || isLokalRayon) {
                  listJadwal.push({ id: doc.id, ...d });
                }
              });
              
              // Urutkan dari yang terbaru dibuat
              listJadwal.sort((a, b) => b.timestamp - a.timestamp);
              setJadwalKegiatan(listJadwal);
            });
            unsubs.push(unsubJadwal);
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

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon",
        aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "jadwal_kegiatan"), { 
        ...formJadwal, 
        pembuat: "Rayon", 
        id_rayon: adminRayonId,
        nama_pembuat: namaRayonAsli,
        timestamp: Date.now() 
      });
      catatLogAktivitas(`Menambahkan jadwal kegiatan Rayon: ${formJadwal.judul}`);
      alert("Jadwal kegiatan berhasil ditambahkan!"); 
      setFormJadwal({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua Internal Rayon' });
    } catch (error) { 
      alert("Gagal menyimpan jadwal."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleHapusJadwal = async (id: string, judul: string, pembuat: string) => {
    if (pembuat === "Komisariat") {
      return alert("Anda tidak memiliki akses untuk menghapus jadwal yang dibuat oleh Pusat Komisariat.");
    }
    if (!window.confirm(`Hapus jadwal "${judul}"?`)) return;
    
    try { 
      await deleteDoc(doc(db, "jadwal_kegiatan", id)); 
      catatLogAktivitas(`Menghapus jadwal kegiatan: ${judul}`);
    } catch (error) { 
      alert("Gagal menghapus jadwal."); 
    }
  };

  return (
    <>
      <style>{`
        /* STRUKTUR UTAMA */
        .page-wrapper { display: flex; flex-direction: column; gap: 20px; }
        .header-card { background: white; padding: 25px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .form-card { background: #fcfcfc; padding: 25px; border: 1px solid #eaeaea; border-radius: 12px; }
        
        /* FORM INPUT STYLES */
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-label { font-size: 0.85rem; font-weight: bold; color: #333; }
        .custom-input { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 0.9rem; outline: none; transition: 0.2s; background: #fff; font-family: inherit; }
        .custom-input:focus { border-color: #3498db; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1); }
        
        .btn-submit { background-color: #27ae60; color: white; border: none; padding: 14px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 0.95rem; transition: 0.3s; box-shadow: 0 4px 10px rgba(39, 174, 96, 0.2); }
        .btn-submit:hover:not(:disabled) { background-color: #219653; transform: translateY(-2px); }
        .btn-submit:disabled { background-color: #95a5a6; cursor: not-allowed; box-shadow: none; }

        /* TABEL DESKTOP */
        .desktop-table-container { width: 100%; overflow-x: auto; border: 1px solid #eaeaea; border-radius: 12px; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.01); }
        .tabel-kalender { min-width: 900px; width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
        .tabel-kalender th { background-color: #f0f4f8; color: #555; padding: 15px; font-weight: bold; white-space: nowrap; }
        .tabel-kalender td { padding: 15px; border-bottom: 1px solid #eee; vertical-align: middle; color: #333; }
        .tabel-kalender tr:last-child td { border-bottom: none; }
        .tabel-kalender tr:hover { background-color: #fdfdfd; }

        /* CARD MOBILE */
        .mobile-card-container { display: none; }
        .agenda-card { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
        .agenda-title { font-weight: bold; color: #0d1b2a; font-size: 1.05rem; margin-bottom: 5px; line-height: 1.4; }
        .badge-pusat { background-color: #fff3cd; color: #856404; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; display: inline-block; }
        .badge-lokal { background-color: #eaf4fc; color: #0000af; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; display: inline-block; }
        .agenda-info { display: flex; align-items: flex-start; gap: 8px; font-size: 0.85rem; color: #555; }
        
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        /* MEDIA QUERIES UNTUK MOBILE */
        @media (max-width: 767px) {
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .page-wrapper { padding: 15px; }
           .header-card, .form-card { padding: 20px; }
           
           /* Sembunyikan tabel di HP, tampilkan Card */
           .desktop-table-container { display: none; }
           .mobile-card-container { display: flex; flex-direction: column; gap: 15px; }
        }
      `}</style>

      <div className="page-wrapper">
        
        {/* HEADER */}
        <div className="header-card">
          <h3 style={{ color: '#0d1b2a', margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>Kalender & Jadwal Rayon</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', margin: 0 }}>Kelola agenda kegiatan internal Rayon Anda, atau pantau instruksi agenda dari Pusat Komisariat.</p>
        </div>
        
        {/* FORM TAMBAH AGENDA */}
        <div className="form-card">
          <form onSubmit={handleTambahJadwal} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
            <div className="input-group">
              <label className="input-label">Judul Kegiatan</label>
              <input type="text" placeholder="Cth: RTAR / Kajian Rutin" required className="custom-input" value={formJadwal.judul} onChange={e => setFormJadwal({...formJadwal, judul: e.target.value})} />
            </div>
            
            <div className="input-group">
              <label className="input-label">Tanggal & Waktu</label>
              <input type="datetime-local" required className="custom-input" value={formJadwal.tanggal} onChange={e => setFormJadwal({...formJadwal, tanggal: e.target.value})} />
            </div>
            
            <div className="input-group">
              <label className="input-label">Lokasi / Media</label>
              <input type="text" placeholder="Gedung / Link Zoom" required className="custom-input" value={formJadwal.lokasi} onChange={e => setFormJadwal({...formJadwal, lokasi: e.target.value})} />
            </div>
            
            <div className="input-group">
              <label className="input-label">Target Peserta Internal</label>
              <select required className="custom-input" style={{ cursor: 'pointer' }} value={formJadwal.target} onChange={e => setFormJadwal({...formJadwal, target: e.target.value})}>
                <option value="Semua Internal Rayon">📢 Semua Pengguna Rayon</option>
                <option value="Pendamping Rayon">👤 Hanya Para Pendamping</option>
                <option value="Kader Rayon">🎓 Hanya Seluruh Kader</option>
              </select>
            </div>
            
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Deskripsi Singkat</label>
              <textarea rows={3} placeholder="Isi detail instruksi, perlengkapan, atau deskripsi agenda..." className="custom-input" style={{ resize: 'vertical' }} value={formJadwal.deskripsi} onChange={e => setFormJadwal({...formJadwal, deskripsi: e.target.value})} />
            </div>
            
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button disabled={isSubmitting} type="submit" className="btn-submit">
                {isSubmitting ? 'Menyimpan...' : '💾 Simpan Agenda'}
              </button>
            </div>
          </form>
        </div>

        {/* TABEL DATA KALENDER (HANYA TAMPIL DI DESKTOP) */}
        <div className="desktop-table-container hide-scroll">
           <table className="tabel-kalender">
              <thead>
                <tr>
                  <th style={{ borderRadius: '10px 0 0 0', width: '25%' }}>Agenda & Penyelenggara</th>
                  <th style={{ width: '25%' }}>Waktu & Lokasi</th>
                  <th style={{ width: '25%' }}>Deskripsi</th>
                  <th style={{ textAlign: 'center', width: '15%' }}>Target</th>
                  <th style={{ textAlign: 'center', borderRadius: '0 10px 0 0', width: '10%' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jadwalKegiatan.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#999', fontSize: '0.95rem' }}>Belum ada agenda terjadwal.</td></tr>
                ) : (
                  jadwalKegiatan.map(jadwal => {
                    const isPusat = jadwal.pembuat === "Komisariat";
                    return (
                      <tr key={jadwal.id}>
                        <td>
                          <div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '1rem', marginBottom: '8px' }}>
                            {jadwal.judul}
                          </div>
                          <span className={isPusat ? "badge-pusat" : "badge-lokal"}>
                            {isPusat ? '🏛️ Pusat Komisariat' : '🏢 Lokal Rayon'}
                          </span>
                        </td>
                        <td>
                          <div style={{color: '#e67e22', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '6px', whiteSpace: 'nowrap'}}>
                            🗓️ {jadwal.tanggal.replace('T', ' - ')}
                          </div>
                          <div style={{fontSize: '0.85rem', color: '#555', display: 'flex', alignItems: 'flex-start', gap: '6px'}}>
                            <span>📍</span> <span>{jadwal.lokasi}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#555', fontStyle: 'italic', lineHeight: '1.5' }}>
                          {jadwal.deskripsi}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#f8f9fa', color: '#555', border: '1px solid #ddd', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-block', whiteSpace: 'nowrap' }}>
                            {jadwal.target || 'Semua'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!isPusat ? (
                            <button 
                              onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul, jadwal.pembuat)} 
                              style={{ color: '#e74c3c', background: '#fff0f0', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #fadbd8', transition: '0.2s', whiteSpace: 'nowrap' }} 
                              title="Hapus Jadwal Lokal"
                            >
                              Hapus
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic', backgroundColor: '#f8f9fa', padding: '6px 12px', borderRadius: '8px', border: '1px dashed #ddd', display: 'inline-block', whiteSpace: 'nowrap' }}>
                              🔒 Terkunci
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
           </table>
        </div>

        {/* TAMPILAN CARD (HANYA TAMPIL DI MOBILE/HP) */}
        <div className="mobile-card-container">
          {jadwalKegiatan.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', backgroundColor: '#fff', border: '1px dashed #ccc', borderRadius: '12px', color: '#999', fontSize: '0.9rem' }}>
              Belum ada agenda terjadwal.
            </div>
          ) : (
            jadwalKegiatan.map(jadwal => {
              const isPusat = jadwal.pembuat === "Komisariat";
              return (
                <div key={jadwal.id} className="agenda-card">
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <div className="agenda-title">{jadwal.judul}</div>
                      <span className={isPusat ? "badge-pusat" : "badge-lokal"}>
                        {isPusat ? '🏛️ Pusat Komisariat' : '🏢 Lokal Rayon'}
                      </span>
                    </div>
                    
                    {!isPusat && (
                      <button onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul, jadwal.pembuat)} style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: '1.2rem', cursor: 'pointer', padding: '5px' }} title="Hapus Jadwal Lokal">
                        🗑️
                      </button>
                    )}
                  </div>
                  
                  <div style={{ borderTop: '1px dashed #eee', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="agenda-info">
                      <span>🗓️</span> <strong>{jadwal.tanggal.replace('T', ' - ')}</strong>
                    </div>
                    <div className="agenda-info">
                      <span>📍</span> <span>{jadwal.lokasi}</span>
                    </div>
                    <div className="agenda-info">
                      <span>🎯</span> <span style={{ fontWeight: '500', color: '#004a87' }}>{jadwal.target || 'Semua'}</span>
                    </div>
                  </div>
                  
                  {jadwal.deskripsi && (
                    <div style={{ backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: '#555', fontStyle: 'italic', lineHeight: '1.5', marginTop: '4px' }}>
                      "{jadwal.deskripsi}"
                    </div>
                  )}

                </div>
              )
            })
          )}
        </div>

        <div style={{ height: '60px' }} className="mobile-only"></div>
      </div>
    </>
  );
}