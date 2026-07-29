'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageDashboardBerandaRayon() {
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

  return (
    <div>
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <h2 style={{color: '#0d1b2a', marginTop: 0, fontSize: '1.5rem'}}>Dashboard {namaRayonAsli}!</h2>
        <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Kelola data kaderisasi, master tugas, surat, akun kader, dan perpustakaan secara real-time melalui panel ini.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>📊 Overview Kaderisasi Rayon</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Filter Angkatan:</label>
          <select value={filterTahunBeranda} onChange={(e) => setFilterTahunBeranda(e.target.value)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #1e824c', fontWeight: 'bold', color: '#1e824c', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
            {daftarTahunUnik.map(thn => <option key={thn} value={thn}>{thn === 'Semua' ? 'Tampilkan Semua Data' : `Angkatan ${thn}`}</option>)}
          </select>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Kader Terdata</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{dataKaderDifilterTahun.length}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Delegasi SKP Aktif</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{skpKaderTerdata.length}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #2ecc71' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Pendamping Aktif</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{dataPendamping.length}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
          <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Rayon Aktif</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{listMasterTugas.length}</div>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h4 style={{ marginTop: 0, color: '#0d1b2a', marginBottom: '15px' }}>Distribusi Jenjang Kader</h4>
        <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
            <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Jenjang Kaderisasi</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Jumlah Kader</th></tr></thead>
            <tbody>
              {['MAPABA', 'PKD', 'SIG', 'SKP'].map((jenjang) => {
                let count = 0;
                if (jenjang === 'MAPABA') count = dataKaderDifilterTahun.filter((k: any) => ['MAPABA', 'PKD', 'SIG', 'SKP'].includes(k.jenjang)).length;
                else if (jenjang === 'PKD') count = dataKaderDifilterTahun.filter((k: any) => ['PKD', 'SKP'].includes(k.jenjang)).length;
                else if (jenjang === 'SIG') count = dataKaderDifilterTahun.filter((k: any) => ['SIG'].includes(k.jenjang)).length;
                else if (jenjang === 'SKP') count = skpKaderTerdata.length;
                return (
                  <tr key={jenjang} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{jenjang}</td><td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#3498db' }}>{count} Kader</td></tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h4 style={{ marginTop: 0, color: '#e74c3c', marginBottom: '5px' }}>🎓 Kader Delegasi Sekolah Kader Putri (SKP)</h4>
        <p style={{fontSize: '0.8rem', color: '#777', marginBottom: '15px'}}>Daftar kader yang di-plotting ke dalam program SKP oleh Pusat Komisariat yang memiliki asal Rayon ini.</p>
        <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
          <table className="tabel-utama" style={{ minWidth: '600px' }}>
            <thead>
              <tr style={{ backgroundColor: '#fdf2e9', color: '#e74c3c' }}>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>NIM</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Nama Delegasi SKP</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Angkatan</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Pendamping SKP</th>
              </tr>
            </thead>
            <tbody>
              {skpKaderTerdata.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada delegasi SKP dari rayon ini.</td></tr>
              ) : (
                skpKaderTerdata.map((k: any) => (
                  <tr key={k.nim} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{k.nim}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{k.nama}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#888' }}>{k.angkatan}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#0000af', fontSize: '0.75rem' }}>{getNamaPendamping(k.pendamping_skp_id)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}