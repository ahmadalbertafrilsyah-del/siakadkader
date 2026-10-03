'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function PageDashboardBerandaPendamping() {
  const router = useRouter();
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '' });
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  
  const [kaderBinaan, setKaderBinaan] = useState<any[]>([]);
  const [berkasTugas, setBerkasTugas] = useState<any[]>([]);
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [notifikasiGlobal, setNotifikasiGlobal] = useState<any[]>([]); 
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = []; // Array pembersih

    // Fungsi sapu bersih semua listener aktif
    const clearUnsubs = () => {
      unsubs.forEach(unsub => unsub());
      unsubs = [];
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      clearUnsubs(); // Bersihkan setiap auth dipanggil ulang

      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon });
            
            const isPendampingSKP = p.id_rayon === 'Komisariat';
            if (isPendampingSKP) setNamaRayonInduk('Pusat Komisariat');
            else {
              const unsubRayon = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                if (rayonSnap.exists()) setNamaRayonInduk(rayonSnap.data().nama || p.id_rayon);
              });
              unsubs.push(unsubRayon);

              const unsubTugas = onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", p.id_rayon)), (snap: any) => {
                setListMasterTugas(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))); 
              });
              unsubs.push(unsubTugas);
            }

            // Ambil Data Binaan Manual
            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const listKader: any[] = []; const emailKaderBinaan: string[] = [];
            
            snapKader.forEach((d) => {
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
              if (isBinaan) { listKader.push({ id: d.id, ...data }); emailKaderBinaan.push(data.email); }
            });
            setKaderBinaan(listKader);

            if (emailKaderBinaan.length > 0) {
              const unsubBerkas = onSnapshot(collection(db, "berkas_kader"), (snap: any) => {
                 const dataBerkas: any[] = [];
                 snap.forEach((doc: any) => { const d = doc.data(); if (emailKaderBinaan.includes(d.email_kader)) dataBerkas.push({ id: doc.id, ...d }); });
                 setBerkasTugas(dataBerkas);
              });
              unsubs.push(unsubBerkas);
            }

            // Notifikasi & Jadwal
            const unsubNotif = onSnapshot(collection(db, "notifikasi_global"), (snap: any) => {
              const listNotif: any[] = [];
              snap.forEach((doc: any) => {
                const d = doc.data();
                if (d.target === "Semua" || d.target === "Pendamping" || d.pengirim_id === p.username) {
                   if (d.pengirim === "Pusat Komisariat" || d.id_rayon === p.id_rayon) listNotif.push({ id: doc.id, ...d });
                }
              });
              listNotif.sort((a: any, b: any) => b.timestamp - a.timestamp); setNotifikasiGlobal(listNotif);
            });
            unsubs.push(unsubNotif);

            const unsubJadwal = onSnapshot(collection(db, "jadwal_kegiatan"), (snap: any) => {
              const listJadwal: any[] = [];
              snap.forEach((doc: any) => {
                const d = doc.data();
                if (d.pembuat === "Komisariat" || d.id_rayon === p.id_rayon) {
                  if (d.pembuat.includes("Pendamping") && d.pendamping_id !== p.username) return; 
                  listJadwal.push({ id: doc.id, ...d });
                }
              });
              listJadwal.sort((a: any, b: any) => b.timestamp - a.timestamp); setJadwalKegiatan(listJadwal);
            });
            unsubs.push(unsubJadwal);
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => {
      unsubscribeAuth();
      clearUnsubs(); // Bersihkan saat keluar halaman
    };
  }, []);

  const tugasMenungguVerifikasi = berkasTugas.filter(s => s.status === 'Menunggu Verifikasi').length;

  const MenuCardMobile = ({ icon, label, onClick }: any) => (
    <div onClick={onClick} className="hover-card-modern" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        cursor: 'pointer', backgroundColor: '#fff', padding: '15px 5px',
        borderRadius: '16px', transition: 'all 0.3s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
    }}>
       <div style={{
           backgroundColor: '#eaf6f1', width: '50px', height: '50px', borderRadius: '14px',
           display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem',
           boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), 0 2px 8px rgba(11,94,74,0.06)'
       }}>
           {icon}
       </div>
       <div style={{ fontSize: '0.72rem', color: '#111', textAlign: 'center', fontWeight: 'bold' }}>{label}</div>
    </div>
  );

  return (
    <>
      <style>{`
        /* CSS KHUSUS TOGGLE VIEW HALAMAN BERANDA PENDAMPING */
        .desktop-view { display: block; }
        .mobile-view { display: none; }

        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: block !important; }
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
        }

        .hover-card-modern:active { transform: scale(0.95); opacity: 0.8; }
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; overflow-x: auto; }
      `}</style>

      {/* ========================================================== */}
      {/* 1. TAMPILAN LAPTOP / DESKTOP (TIDAK DIUBAH)                */}
      {/* ========================================================== */}
      <div className="desktop-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
        <h2 style={{color: '#1e824c', marginTop: 0, fontSize: '1.5rem'}}>Halo, Sahabat/i {profilPendamping.nama.split(' ')[0]}! 👋</h2>
        <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Selamat datang di Panel Pendamping. Pantau perkembangan kader binaan Anda dan berikan evaluasi terbaik untuk kemajuan {namaRayonInduk}.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Kader Binaan</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{kaderBinaan.length}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Binaan Menunggu</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{berkasTugas.filter(s => s.status === 'Menunggu Verifikasi').length}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Instansi Aktif</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{listMasterTugas.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* NOTIFIKASI INBOX */}
        <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🔔 Pusat Informasi Instansi</h3>
          <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
            {notifikasiGlobal.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada informasi/pengumuman terbaru.</div>
            ) : (
              notifikasiGlobal.map(notif => (
                <div key={notif.id} style={{ padding: '15px', backgroundColor: '#fcfcfc', border: '1px solid #eee', borderLeft: '4px solid #1e824c', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <strong style={{ color: '#333', fontSize: '0.9rem' }}>{notif.judul}</strong>
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>{notif.tanggal}</span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap' }}>{notif.pesan}</p>
                  <div style={{ fontSize: '0.7rem', color: '#3498db', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* JADWAL KEGIATAN */}
        <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📅 Jadwal Kegiatan Terdekat</h3>
          <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
            {jadwalKegiatan.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada agenda kegiatan dalam waktu dekat.</div>
            ) : (
              jadwalKegiatan.map(jadwal => {
                const isKomisariat = jadwal.pembuat === 'Komisariat';
                const isPendamping = jadwal.pembuat.includes('Pendamping');
                const isMine = jadwal.pendamping_id === profilPendamping.username;
                const borderColor = isKomisariat ? '#f1c40f' : isMine ? '#2ecc71' : isPendamping ? '#3498db' : '#e74c3c';
                const labelPembuat = isKomisariat ? 'Pusat Komisariat' : isMine ? 'Jadwal Anda' : isPendamping ? 'Jadwal Mentoring' : 'Pengurus Rayon';

                return (
                  <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: `4px solid ${borderColor}`, padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                        <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '0.95rem' }}>{jadwal.judul}</h4>
                        <span style={{ backgroundColor: '#f8f9fa', color: '#555', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{labelPembuat}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      </div>

      {/* ========================================================== */}
      {/* 2. TAMPILAN MOBILE APP (HIJAU-TEAL ELEGAN + AKSEN EMAS)    */}
      {/* ========================================================== */}
      <div className="mobile-view">

        {/* Area Header Melengkung Edge to Edge */}
        <div className="sk-bleed" style={{
           background: 'linear-gradient(135deg, #0b5e4a 0%, #139070 100%)',
           padding: '18px 18px 80px 18px',
           borderBottomLeftRadius: '30px',
           borderBottomRightRadius: '30px',
           color: '#ffffff',
           position: 'relative'
        }}>
           <div style={{ fontSize: '0.75rem', letterSpacing: '1px', fontWeight: 'bold', color: '#f5c518', opacity: 0.95 }}>PANEL PENDAMPING</div>
           <h1 style={{ margin: '6px 0 0 0', fontSize: '1.35rem', fontWeight: 'bold', letterSpacing: '0.3px' }}>
             Halo, Sahabat/i {profilPendamping.nama ? profilPendamping.nama.split(' ')[0] : ''}! 👋
           </h1>
           <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', opacity: 0.9, lineHeight: '1.5' }}>
             Pantau perkembangan kader binaan Anda dan berikan evaluasi terbaik untuk kemajuan {namaRayonInduk || 'instansi'}.
           </p>
        </div>

        {/* Kartu Statistik Mengambang Menimpa Header */}
        <div style={{ padding: '0 15px', marginTop: '-55px', position: 'relative', zIndex: 10 }}>
          <div style={{
             backgroundColor: '#ffffff', borderRadius: '20px', padding: '16px 10px',
             boxShadow: '0 8px 25px rgba(11,94,74,0.12)',
             display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px'
          }}>
             {[
               { label: 'Kader Binaan', val: kaderBinaan.length, color: '#0b5e4a' },
               { label: 'Tugas Menunggu', val: tugasMenungguVerifikasi, color: '#e67e22' },
               { label: 'Tugas Instansi', val: listMasterTugas.length, color: '#2980b9' }
             ].map(item => (
               <div key={item.label} style={{ textAlign: 'center', padding: '4px 2px' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: item.color, lineHeight: 1.1 }}>{item.val}</div>
                  <div style={{ fontSize: '0.65rem', color: '#777', fontWeight: 'bold', marginTop: '4px' }}>{item.label}</div>
               </div>
             ))}
          </div>
        </div>

        <div style={{ padding: '0 15px' }}>

          {/* Badge Tugas Menunggu Verifikasi (Menonjol) */}
          {tugasMenungguVerifikasi > 0 && (
            <div onClick={() => router.push('/pendamping/berkas-tugas')} className="hover-card-modern" style={{
               marginTop: '18px', cursor: 'pointer',
               background: 'linear-gradient(135deg, #f5c518 0%, #f7d75a 100%)',
               borderRadius: '16px', padding: '16px 18px',
               display: 'flex', alignItems: 'center', justifyContent: 'space-between',
               boxShadow: '0 6px 15px rgba(245,197,24,0.25)'
            }}>
               <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0b5e4a' }}>Tugas Menunggu Verifikasi</div>
                  <div style={{ fontSize: '0.72rem', color: '#4a3c00', marginTop: '4px' }}>Ada {tugasMenungguVerifikasi} berkas kader binaan yang perlu Anda periksa.</div>
               </div>
               <div style={{
                  backgroundColor: '#0b5e4a', color: '#f5c518', minWidth: '42px', height: '42px',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '1.1rem', flexShrink: 0, marginLeft: '12px'
               }}>{tugasMenungguVerifikasi}</div>
            </div>
          )}

          {/* Grid Menu Pintasan */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#0d1b2a', fontSize: '0.9rem' }}>Menu Pendamping</h4>
            <div style={{
               backgroundColor: '#ffffff', borderRadius: '20px', padding: '15px 10px',
               boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #eef1f0',
               display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 8px'
            }}>
               <MenuCardMobile icon="👥" label="Daftar Kader" onClick={() => router.push('/pendamping/daftar-kader')} />
               <MenuCardMobile icon="📋" label="Berkas Tugas" onClick={() => router.push('/pendamping/berkas-tugas')} />
               <MenuCardMobile icon="📊" label="Input Nilai" onClick={() => router.push('/pendamping/input-nilai')} />
               <MenuCardMobile icon="📝" label="Tes Pemahaman" onClick={() => router.push('/pendamping/tes-pemahaman')} />
               <MenuCardMobile icon="📅" label="Kalender" onClick={() => router.push('/pendamping/kalender')} />
               <MenuCardMobile icon="📢" label="Broadcast" onClick={() => router.push('/pendamping/broadcast')} />
               <MenuCardMobile icon="👤" label="Profil" onClick={() => router.push('/pendamping/profil')} />
            </div>
          </div>

          {/* Pusat Informasi Instansi */}
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '18px', marginTop: '18px', border: '1px solid #eef1f0', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#0d1b2a', fontSize: '0.92rem' }}>🔔 Pusat Informasi Instansi</h4>
            <div style={{ display: 'grid', gap: '10px' }}>
              {notifikasiGlobal.length === 0 ? (
                <div style={{ padding: '18px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '12px', color: '#999', fontSize: '0.8rem' }}>Belum ada informasi/pengumuman terbaru.</div>
              ) : (
                notifikasiGlobal.slice(0, 5).map(notif => (
                  <div key={notif.id} style={{ padding: '13px 14px', backgroundColor: '#f9fbfa', borderRadius: '12px', borderLeft: '4px solid #139070' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                      <strong style={{ color: '#0d1b2a', fontSize: '0.84rem' }}>{notif.judul}</strong>
                      <span style={{ fontSize: '0.65rem', color: '#888', flexShrink: 0 }}>{notif.tanggal}</span>
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.78rem', color: '#555', whiteSpace: 'pre-wrap' }}>{notif.pesan}</p>
                    <div style={{ fontSize: '0.66rem', color: '#0b5e4a', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Jadwal Kegiatan Terdekat */}
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '18px', marginTop: '15px', border: '1px solid #eef1f0', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '0.92rem' }}>📅 Jadwal Kegiatan Terdekat</h4>
              <span onClick={() => router.push('/pendamping/kalender')} style={{ fontSize: '0.7rem', color: '#139070', fontWeight: 'bold', cursor: 'pointer' }}>Lihat Semua</span>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {jadwalKegiatan.length === 0 ? (
                <div style={{ padding: '18px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: '12px', color: '#999', fontSize: '0.8rem' }}>Belum ada agenda kegiatan dalam waktu dekat.</div>
              ) : (
                jadwalKegiatan.slice(0, 5).map(jadwal => {
                  const isKomisariat = jadwal.pembuat === 'Komisariat';
                  const isPendamping = jadwal.pembuat.includes('Pendamping');
                  const isMine = jadwal.pendamping_id === profilPendamping.username;
                  const borderColor = isKomisariat ? '#f5c518' : isMine ? '#139070' : isPendamping ? '#2980b9' : '#e74c3c';
                  const labelPembuat = isKomisariat ? 'Pusat Komisariat' : isMine ? 'Jadwal Anda' : isPendamping ? 'Jadwal Mentoring' : 'Pengurus Rayon';

                  return (
                    <div key={jadwal.id} style={{ padding: '13px 14px', backgroundColor: '#f9fbfa', borderRadius: '12px', borderLeft: `4px solid ${borderColor}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
                        <strong style={{ color: '#0d1b2a', fontSize: '0.84rem' }}>{jadwal.judul}</strong>
                        <span style={{ backgroundColor: '#fff', color: '#555', padding: '2px 7px', borderRadius: '10px', fontSize: '0.6rem', border: '1px solid #e0e0e0', fontWeight: 'bold' }}>{labelPembuat}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '4px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                      <p style={{ margin: 0, fontSize: '0.76rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div style={{ height: '90px' }}></div>
        </div>
      </div>
    </>
  );
}