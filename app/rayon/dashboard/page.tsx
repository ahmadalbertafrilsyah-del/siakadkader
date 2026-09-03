'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function PageDashboardBerandaRayon() {
  const router = useRouter();

  const [dataPendamping, setDataPendamping] = useState<any[]>([]);
  const [dataKader, setDataKader] = useState<any[]>([]);
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  
  const [adminRayonId, setAdminRayonId] = useState(''); 
  const [namaRayonAsli, setNamaRayonAsli] = useState('');

  const currentYear = new Date().getFullYear();
  const [filterTahunBeranda, setFilterTahunBeranda] = useState<string>(currentYear.toString());

  // Fetch Data yang berkaitan dengan dashboard ringkasan
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            
            // Nama Rayon
            onSnapshot(doc(db, "users", currentRayonId), (rayonSnap) => {
              if (rayonSnap.exists()) setNamaRayonAsli(rayonSnap.data().nama || currentRayonId);
            });
            
            // Data Rayon (semua untuk mapping id ke nama)
            onSnapshot(query(collection(db, "users"), where("role", "==", "rayon")), (snap) => {
              setDataRayon(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            // Data Pendamping Rayon Ini
            onSnapshot(query(collection(db, "users"), where("role", "==", "pendamping"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setDataPendamping(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            // Data Kader Rayon Ini
            onSnapshot(query(collection(db, "users"), where("role", "==", "kader")), (snap) => {
              const list: any[] = [];
              snap.docs.forEach(doc => {
                 const data = doc.data();
                 const terdaftarDi = data.terdaftar_di || [data.id_rayon];
                 if (terdaftarDi.includes(currentRayonId)) { list.push({ id: doc.id, ...data }); }
              });
              setDataKader(list);
            });

            // Data Master Tugas Rayon Ini
            onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setListMasterTugas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
            });
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const getNamaPendamping = (idData: any) => {
    if (!idData || idData.length === 0) return "-";
    if (Array.isArray(idData)) {
       if(idData.length === 0) return "-";
       return idData.map((id: any) => dataPendamping.find(p => p.username === id || p.id === id)?.nama || id).join(', ');
    }
    return dataPendamping.find(p => p.username === idData || p.id === idData)?.nama || idData;
  };

  const dataKaderDifilterTahun = dataKader.filter(k => {
    if (filterTahunBeranda === 'Semua') return true;
    const tahunKader = k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear().toString() : '');
    return tahunKader === filterTahunBeranda;
  });

  const skpKaderTerdata = dataKaderDifilterTahun.filter((k: any) => 
     k.jenjang === 'SKP' && 
     (k.id_rayon === adminRayonId || k.id_rayon === namaRayonAsli || (k.terdaftar_di && k.terdaftar_di.includes(adminRayonId)))
  );

  const daftarTahunUnik = ['Semua'];
  for (let i = 0; i < 3; i++) { daftarTahunUnik.push((currentYear - i).toString()); }

  const MenuCardMobile = ({ icon, label, onClick }: any) => (
    <div onClick={onClick} className="hover-card-modern" style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', 
        cursor: 'pointer', backgroundColor: '#fff', padding: '15px 5px', 
        borderRadius: '16px', transition: 'all 0.3s ease' 
    }}>
       <div style={{ 
           backgroundColor: '#f0f5ff', width: '50px', height: '50px', borderRadius: '14px', 
           display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem',
           boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,175,0.05)'
       }}>
           {icon}
       </div>
       <div style={{ fontSize: '0.7rem', color: '#333', textAlign: 'center', fontWeight: 'bold' }}>{label}</div>
    </div>
  );

  return (
    <>
      <style>{`
        /* COLOR PALETTE & DESKTOP ENTERPRISE STYLING */
        :root {
          --text-main: #111827;
          --text-body: #374151;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
          --bg-card: #ffffff;
        }

        .desktop-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .desktop-table th { background-color: #f8fafc; color: var(--text-main); padding: 12px 16px; font-weight: 600; border-bottom: 1px solid var(--border-color); }
        .desktop-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: var(--text-body); background-color: #fff; }

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
      {/* 1. TAMPILAN LAPTOP / DESKTOP (PROFESSIONAL CLEAN UI)       */}
      {/* ========================================================== */}
      <div className="desktop-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Banner Selamat Datang */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)' }}>Dashboard {namaRayonAsli}</h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Kelola data kaderisasi, master tugas, surat, akun kader, dan perpustakaan secara real-time melalui panel ini.
          </p>
        </div>

        {/* Baris Filter & Judul Overview */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Overview Kaderisasi Rayon</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Filter Angkatan:</label>
            <select value={filterTahunBeranda} onChange={(e) => setFilterTahunBeranda(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-main)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', backgroundColor: '#fff' }}>
              {daftarTahunUnik.map(thn => <option key={thn} value={thn}>{thn === 'Semua' ? 'Tampilkan Semua Data' : `Angkatan ${thn}`}</option>)}
            </select>
          </div>
        </div>
        
        {/* Kartu Statistik Utama (4 Kolom) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Kader Terdata</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '8px' }}>{dataKaderDifilterTahun.length}</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delegasi SKP Aktif</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '8px' }}>{skpKaderTerdata.length}</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Pendamping Aktif</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '8px' }}>{dataPendamping.length}</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tugas Rayon Aktif</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '8px' }}>{listMasterTugas.length}</div>
          </div>
        </div>

        {/* Bagian Bawah: Distribusi Jenjang & Kader SKP */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          
          {/* Distribusi Jenjang */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: '600' }}>Distribusi Jenjang Kader</h4>
            <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="desktop-table">
                <thead><tr><th>Jenjang</th><th style={{ textAlign: 'center' }}>Jumlah</th></tr></thead>
                <tbody>
                  {['MAPABA', 'PKD', 'SIG', 'SKP'].map((jenjang) => {
                    let count = 0;
                    if (jenjang === 'MAPABA') count = dataKaderDifilterTahun.filter((k: any) => ['MAPABA', 'PKD', 'SIG', 'SKP'].includes(k.jenjang)).length;
                    else if (jenjang === 'PKD') count = dataKaderDifilterTahun.filter((k: any) => ['PKD', 'SKP'].includes(k.jenjang)).length;
                    else if (jenjang === 'SIG') count = dataKaderDifilterTahun.filter((k: any) => ['SIG'].includes(k.jenjang)).length;
                    else if (jenjang === 'SKP') count = skpKaderTerdata.length;
                    return (
                      <tr key={jenjang}>
                        <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{jenjang}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600', color: '#2563eb' }}>{count} Kader</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel Kader Delegasi SKP */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: '600' }}>Kader Delegasi SKP</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Daftar kader yang di-plotting ke dalam program SKP oleh Pusat Komisariat.</p>
            <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="desktop-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '25%' }}>NIM</th>
                    <th style={{ textAlign: 'left', width: '45%' }}>Nama Delegasi SKP</th>
                    <th style={{ textAlign: 'center', width: '30%' }}>Pendamping SKP</th>
                  </tr>
                </thead>
                <tbody>
                  {skpKaderTerdata.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Belum ada delegasi SKP dari rayon ini.</td></tr>
                  ) : (
                    skpKaderTerdata.map((k: any) => (
                      <tr key={k.nim}>
                        <td style={{ textAlign: 'center', fontWeight: '500', color: 'var(--text-muted)' }}>{k.nim}</td>
                        <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{k.nama}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600', color: '#2563eb', fontSize: '0.8rem' }}>{getNamaPendamping(k.pendamping_skp_id)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. TAMPILAN MOBILE APP ONLY (MODERN, TEGAS, LEGA)          */}
      {/* ========================================================== */}
      <div className="mobile-view">
        
        {/* Area Header Biru Tua Premium (Edge to Edge) */}
        <div style={{ 
           backgroundColor: '#0000af',
           padding: '15px 15px 75px 15px', 
           borderBottomLeftRadius: '30px', 
           borderBottomRightRadius: '30px', 
           color: 'white',
           position: 'relative'
        }}>
           <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '0.5px', color: '#f1c40f', position: 'relative', zIndex: 2 }}>SIAKAD PMII</h1>
           <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', opacity: 0.9, lineHeight: '1.4', position: 'relative', zIndex: 2 }}>
             Sistem terintegrasi untuk manajemen kaderisasi, data akademik, dan administrasi rayon.
           </p>
        </div>

        {/* Grid Menu Kotak Melayang (Floating Glass Effect) */}
        <div style={{ padding: '0 15px', marginTop: '-45px', position: 'relative', zIndex: 10 }}>
          <div style={{ 
             backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px 10px', 
             boxShadow: '0 8px 25px rgba(0,0,175,0.08)', 
             display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px 10px' 
          }}>
             <MenuCardMobile icon="📁" label="Perpustakaan" onClick={() => router.push('/rayon/perpus')} />
             <MenuCardMobile icon="📚" label="Kurikulum" onClick={() => router.push('/rayon/kurikulum')} />
             <MenuCardMobile icon="📝" label="Ujian Tes" onClick={() => router.push('/rayon/manajemen-tes')} />
             <MenuCardMobile icon="📊" label="Nilai KHS" onClick={() => router.push('/rayon/pantau-nilai')} />
             <MenuCardMobile icon="📅" label="Jadwal" onClick={() => router.push('/rayon/kalender')} />
             <MenuCardMobile icon="📜" label="Sertifikat" onClick={() => router.push('/rayon/pengaturan-sertifikat')} />
          </div>
        </div>

        {/* AREA BAWAH MENU (Dibungkus Padding 15px agar konten lega) */}
        <div style={{ padding: '0 15px' }}>
          
          {/* Statistik Scroll Horizontal */}
          <div style={{ marginTop: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
               <h4 style={{ margin: '0', color: '#444', fontSize: '0.9rem' }}>Statistik {filterTahunBeranda !== 'Semua' ? `Angkatan ${filterTahunBeranda}` : 'Global'}</h4>
               <select value={filterTahunBeranda} onChange={(e) => setFilterTahunBeranda(e.target.value)} style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #0000af', color: '#0000af', outline: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
                 {daftarTahunUnik.map(thn => <option key={thn} value={thn}>{thn === 'Semua' ? 'Semua' : thn}</option>)}
               </select>
            </div>
            
            <div className="hide-scroll" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                {[
                  { label: 'Total Kader', val: dataKaderDifilterTahun.length, color: '#3498db' },
                  { label: 'SKP Aktif', val: skpKaderTerdata.length, color: '#e74c3c' },
                  { label: 'Pendamping', val: dataPendamping.length, color: '#2ecc71' },
                  { label: 'Tugas Aktif', val: listMasterTugas.length, color: '#f1c40f' }
                ].map(item => (
                  <div key={item.label} style={{ minWidth: '110px', backgroundColor: '#fff', padding: '15px 12px', borderRadius: '16px', border: '1px solid #eaeaea', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#777', fontWeight: 'bold', letterSpacing: '0.5px' }}>{item.label}</div>
                      <div style={{ fontSize: '1.6rem', color: item.color, fontWeight: '900', marginTop: '6px' }}>{item.val}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Tabel Distribusi Jenjang Mini */}
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)', marginTop: '15px', border: '1px solid #eaeaea' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#0d1b2a', fontSize: '0.95rem' }}>Distribusi Jenjang Kader</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['MAPABA', 'PKD', 'SIG', 'SKP'].map((jenjang) => {
                  let count = 0;
                  if (jenjang === 'MAPABA') count = dataKaderDifilterTahun.filter((k: any) => ['MAPABA', 'PKD', 'SIG', 'SKP'].includes(k.jenjang)).length;
                  else if (jenjang === 'PKD') count = dataKaderDifilterTahun.filter((k: any) => ['PKD', 'SKP'].includes(k.jenjang)).length;
                  else if (jenjang === 'SIG') count = dataKaderDifilterTahun.filter((k: any) => ['SIG'].includes(k.jenjang)).length;
                  else if (jenjang === 'SKP') count = skpKaderTerdata.length;
                  return (
                    <div key={jenjang} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                       <span style={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem' }}>{jenjang}</span>
                       <span style={{ fontWeight: 'bold', color: '#0000af', fontSize: '0.85rem' }}>{count} Orang</span>
                    </div>
                  )
              })}
            </div>
          </div>

          <div style={{ height: '90px' }}></div>
        </div>
      </div>

    </>
  );
}