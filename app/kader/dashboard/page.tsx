'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function DashboardKader() {
  const router = useRouter();
  
  // State Data
  const [profil, setProfil] = useState<any>({});
  const [namaRayonAsli, setNamaRayonAsli] = useState('Memuat Instansi...');
  const [semuaPendamping, setSemuaPendamping] = useState<any[]>([]); 
  const [semuaRayon, setSemuaRayon] = useState<any[]>([]); 
  
  const [tugasSelesai, setTugasSelesai] = useState(0);
  const [tugasTotal, setTugasTotal] = useState(0);
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [notifikasiGlobal, setNotifikasiGlobal] = useState<any[]>([]);

  // State IPK Dinamis
  const [ipkMapaba, setIpkMapaba] = useState<string | null>(null);
  const [ipkPkd, setIpkPkd] = useState<string | null>(null);
  const [ipkSig, setIpkSig] = useState<string | null>(null);
  const [ipkSkp, setIpkSkp] = useState<string | null>(null);
  const [ipKaderTampilan, setIpKaderTampilan] = useState('0.00');

  useEffect(() => {
    const qPendamping = query(collection(db, "users"), where("role", "==", "pendamping"));
    const unsubP = onSnapshot(qPendamping, (snap) => setSemuaPendamping(snap.docs.map(d => ({ username: d.id, ...d.data() }))));

    const qRayon = query(collection(db, "users"), where("role", "==", "rayon"));
    const unsubR = onSnapshot(qRayon, (snap) => setSemuaRayon(snap.docs.map(d => ({ username: d.id, ...d.data() }))));

    return () => { unsubP(); unsubR(); };
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(q, async (snap) => {
          if (!snap.empty) {
            const dataDB = snap.docs[0].data();
            setProfil({ id: snap.docs[0].id, ...dataDB });

            // Resolusi Nama Instansi
            if (dataDB.id_rayon === 'Komisariat') {
               setNamaRayonAsli('Pusat Komisariat');
            } else if (dataDB.id_rayon) {
               onSnapshot(doc(db, "users", dataDB.id_rayon), (rSnap) => {
                  if (rSnap.exists()) setNamaRayonAsli(rSnap.data().nama || dataDB.id_rayon);
               });
            }

            // Hitung Tugas
            const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", dataDB.email));
            onSnapshot(qBerkas, (bSnap) => {
               setTugasSelesai(bSnap.docs.filter(d => d.data().status === 'Selesai').length);
            });
            onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", dataDB.id_rayon)), (tSnap) => {
               let tot = tSnap.size;
               onSnapshot(query(collection(db, "master_tugas"), where("jenjang", "==", "SKP")), (skpSnap) => {
                  setTugasTotal(tot + skpSnap.size);
               });
            });

            // Jadwal & Notifikasi
            const allP = [
                ...(Array.isArray(dataDB.pendamping_mapaba_id) ? dataDB.pendamping_mapaba_id : (dataDB.pendamping_mapaba_id ? [dataDB.pendamping_mapaba_id] : [])),
                ...(Array.isArray(dataDB.pendamping_pkd_id) ? dataDB.pendamping_pkd_id : (dataDB.pendamping_pkd_id ? [dataDB.pendamping_pkd_id] : [])),
                ...(Array.isArray(dataDB.pendamping_sig_id) ? dataDB.pendamping_sig_id : (dataDB.pendamping_sig_id ? [dataDB.pendamping_sig_id] : [])),
                ...(Array.isArray(dataDB.pendampingId) ? dataDB.pendampingId : (dataDB.pendampingId ? [dataDB.pendampingId] : []))
            ];

            onSnapshot(collection(db, "jadwal_kegiatan"), (jSnap) => {
               const listJ: any[] = [];
               jSnap.forEach(d => {
                  const j = d.data();
                  if (j.pembuat === "Komisariat" || j.id_rayon === dataDB.id_rayon || j.id_rayon === "Komisariat") {
                      if (j.target === "Rayon" || j.target === "Pendamping") return;
                      if (j.target === "Binaan" || j.pembuat?.includes("Pendamping")) {
                         if (!allP.includes(j.pendamping_id)) return;
                      }
                      listJ.push({ id: d.id, ...j });
                  }
               });
               listJ.sort((a, b) => b.timestamp - a.timestamp); setJadwalKegiatan(listJ);
            });

            onSnapshot(collection(db, "notifikasi_global"), (nSnap) => {
               const listN: any[] = [];
               nSnap.forEach(d => {
                  const n = d.data();
                  if (n.target === "Semua" || n.target === "Kader" || (n.target === "Binaan" && allP.includes(n.pengirim_id))) {
                      if (n.pengirim === "Pusat Komisariat" || n.id_rayon === dataDB.id_rayon || allP.includes(n.pengirim_id)) {
                         listN.push({ id: d.id, ...n });
                      }
                  }
               });
               listN.sort((a, b) => b.timestamp - a.timestamp); setNotifikasiGlobal(listN);
            });

            // IPK Sederhana Kalkulasi Cepat
            onSnapshot(doc(db, "nilai_khs", dataDB.nim), (nSnap) => {
               if (nSnap.exists()) {
                  const nData = nSnap.data();
                  let tPoin = 0; let count = 0;
                  Object.keys(nData).forEach(k => {
                     const h = nData[k];
                     if(h === 'A') tPoin+=4; else if(h==='B') tPoin+=3; else if(h==='C') tPoin+=2; else if(h==='D') tPoin+=1;
                     if(['A','B','C','D','E'].includes(h)) count++;
                  });
                  const avg = count > 0 ? (tPoin/count).toFixed(2) : '0.00';
                  setIpKaderTampilan(avg);
                  
                  // Dummy mapping untuk UI Desktop
                  setIpkMapaba(avg); setIpkPkd(null); setIpkSig(null); setIpkSkp(null);
               }
            });

          }
        });
      } else { router.push('/'); }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const getNamaPendamping = (idData: any) => {
    if (!idData || idData.length === 0) return "Belum Diplotkan";
    if (Array.isArray(idData)) {
       if(idData.length === 0) return "Belum Diplotkan";
       return idData.map(id => semuaPendamping.find(p => p.username === id || p.id === id)?.nama || id).join(', ');
    }
    return semuaPendamping.find(p => p.username === idData || p.id === idData)?.nama || idData;
  };

  const MenuCardMobile = ({ icon, label, onClick }: any) => (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: '#fff', padding: '15px 5px', borderRadius: '12px' }}>
       <div style={{ backgroundColor: '#eaf4fc', width: '45px', height: '45px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.4rem' }}>{icon}</div>
       <div style={{ fontSize: '0.7rem', color: '#0000af', textAlign: 'center', fontWeight: 'bold' }}>{label}</div>
    </div>
  );

  return (
    <>
      <style>{`
        /* CSS KHUSUS TOGGLE VIEW */
        .desktop-view { display: flex; flex-direction: column; gap: 20px; }
        .mobile-view { display: none; }
        
        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: block !important; }
        }
      `}</style>

      {/* ========================================================== */}
      {/* 1. TAMPILAN LAPTOP / DESKTOP UTUH SEPERTI SEBELUMNYA */}
      {/* ========================================================== */}
      <div className="desktop-view">
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
          <h2 style={{marginTop: 0, fontSize: '1.5rem', color: '#0000af'}}>Halo, Sahabat/i {profil.nama ? profil.nama.split(' ')[0] : ''}! 👋</h2>
          <p style={{margin: '8px 0 0 0', fontSize: '0.9rem', color: '#555', opacity: 0.9}}>Selamat datang di Sistem Informasi Akademik dan Kaderisasi {namaRayonAsli}. Berikut adalah ringkasan progres kaderisasi Anda saat ini.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '10px' }}>
          <div style={{ backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', borderLeft: '4px solid #2ecc71', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold' }}>Pendamping MAPABA</div>
            <div style={{ fontSize: '1.1rem', color: '#333', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getNamaPendamping(profil.pendamping_mapaba_id || profil.pendampingId)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '8px' }}>Pendamping SKP (Komisariat)</div>
            <div style={{ fontSize: '1.1rem', color: '#0000af', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getNamaPendamping(profil.pendamping_skp_id)}
            </div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #e74c3c', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold' }}>Tugas Diselesaikan</div>
            <div style={{ fontSize: '1.5rem', color: '#333', fontWeight: 'bold', marginTop: '5px' }}>{tugasSelesai} <span style={{fontSize: '0.8rem', color: '#888'}}>/ {tugasTotal}</span></div>
          </div>
        </div>

        <h4 style={{ margin: '0 0 5px 0', color: '#0000af', fontSize: '1.1rem' }}>📊 Indeks Prestasi Kader (IPK)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '10px' }}>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>IPK MAPABA</div>
                <div style={{ fontSize: '1.5rem', color: ipkMapaba ? '#0000af' : '#999', fontWeight: 'bold', marginTop: '5px' }}>{ipkMapaba || '-'}</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>IPK PKD</div>
                <div style={{ fontSize: '1.5rem', color: ipkPkd ? '#0000af' : '#999', fontWeight: 'bold', marginTop: '5px' }}>{ipkPkd || '-'}</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>IPK SIG</div>
                <div style={{ fontSize: '1.5rem', color: ipkSig ? '#0000af' : '#999', fontWeight: 'bold', marginTop: '5px' }}>{ipkSig || '-'}</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>IPK SKP</div>
                <div style={{ fontSize: '1.5rem', color: ipkSkp ? '#0000af' : '#999', fontWeight: 'bold', marginTop: '5px' }}>{ipkSkp || '-'}</div>
            </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🔔 Pusat Informasi</h3>
              <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                {notifikasiGlobal.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Kotak masuk informasi kosong.</div>
                ) : (
                  notifikasiGlobal.map(notif => (
                    <div key={notif.id} style={{ padding: '15px', backgroundColor: '#fcfcfc', border: '1px solid #eee', borderLeft: '4px solid #1e824c', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <strong style={{ color: '#333', fontSize: '0.9rem' }}>{notif.judul}</strong><span style={{ fontSize: '0.7rem', color: '#888' }}>{notif.tanggal}</span>
                      </div>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap' }}>{notif.pesan}</p>
                      <div style={{ fontSize: '0.7rem', color: '#3498db', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📅 Jadwal Kegiatan</h3>
              <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                {jadwalKegiatan.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada agenda kegiatan dalam waktu dekat.</div>
                ) : (
                  jadwalKegiatan.map(jadwal => {
                    const isKomisariat = jadwal.pembuat === 'Komisariat' || jadwal.pembuat === 'Pusat Komisariat';
                    const isPendamping = jadwal.pembuat?.includes('Pendamping');
                    const borderColor = isKomisariat ? '#f1c40f' : isPendamping ? '#3498db' : '#e74c3c';
                    const labelPembuat = isKomisariat ? 'Pusat Komisariat' : isPendamping ? 'Jadwal Mentoring' : 'Pengurus Rayon';

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
      {/* 2. TAMPILAN MOBILE APP ONLY (GRID MENU & MELENGKUNG) */}
      {/* ========================================================== */}
      <div className="mobile-view" style={{ minHeight: '100%', margin: 0, padding: 0 }}>
        
        {/* Area Lengkungan Biru Tua */}
        <div style={{ 
           backgroundColor: '#0000af', 
           padding: '10px 20px 70px 20px', 
           borderBottomLeftRadius: '30px', 
           borderBottomRightRadius: '30px', 
           color: 'white',
           marginTop: '-20px'
        }}>
           <h1 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '0.5px', color: '#f1c40f' }}>Layanan Referensi</h1>
           <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', opacity: 0.9, lineHeight: '1.5' }}>
             Akses seluruh data kaderisasi, tugas, raport, dan referensi bacaan {namaRayonAsli} dalam satu genggaman.
           </p>
        </div>

        {/* Grid Menu Kotak Melayang */}
        <div style={{ marginTop: '-45px', padding: '0 15px', position: 'relative', zIndex: 10 }}>
          <div style={{ 
             backgroundColor: '#fff', borderRadius: '16px', padding: '20px 10px', 
             boxShadow: '0 8px 20px rgba(0,0,0,0.06)', 
             display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' 
          }}>
             <MenuCardMobile icon="📊" label="Kartu KHS" onClick={() => router.push('/kader/raport')} />
             <MenuCardMobile icon="📚" label="Perpus" onClick={() => router.push('/kader/perpustakaan')} />
             <MenuCardMobile icon="📅" label="Agenda" onClick={() => router.push('/kader/kalender')} />
             <MenuCardMobile icon="📝" label="Ujian Tes" onClick={() => router.push('/kader/tes')} />
             <MenuCardMobile icon="📋" label="Upload Tugas" onClick={() => router.push('/kader/tugas')} />
             <MenuCardMobile icon="📜" label="Sertifikat" onClick={() => router.push('/kader/sertifikat')} />
          </div>
        </div>

        {/* Kartu IPK Dinamis */}
        <div style={{ padding: '20px 15px' }}>
          <div style={{ 
             backgroundColor: '#fff', borderRadius: '16px', padding: '20px', 
             boxShadow: '0 4px 12px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '5px solid #0000af'
          }}>
             <div>
               <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 'bold', marginBottom: '4px' }}>Indeks Prestasi Saat Ini</div>
               <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0000af' }}>IPK: {ipKaderTampilan}</div>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#27ae60', fontWeight: 'bold', fontSize: '0.8rem', backgroundColor: '#e8f5e9', padding: '6px 12px', borderRadius: '20px' }}>
               Kader {profil.status || 'Aktif'} <span style={{fontSize: '0.6rem'}}>{profil.status === 'Pasif' ? '🔴' : '🟢'}</span>
             </div>
          </div>
        </div>

        {/* Kartu Profil Warning */}
        {(!profil.nik || !profil.ttl || profil.nia === '-') && (
          <div style={{ padding: '0 15px 30px 15px' }}>
            <div style={{ 
               backgroundColor: '#fff3cd', borderRadius: '16px', padding: '20px', border: '1px solid #f1c40f',
               boxShadow: '0 4px 12px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' 
            }}>
               <h4 style={{ margin: 0, color: '#856404', fontSize: '0.9rem' }}>Profil Anda Belum Lengkap!</h4>
               <p style={{ margin: 0, fontSize: '0.8rem', color: '#856404' }}>Mohon lengkapi NIK, TTL, dll untuk keperluan penerbitan sertifikat digital resmi.</p>
               <button onClick={() => router.push('/kader/profil')} style={{ alignSelf: 'flex-start', backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', marginTop: '5px' }}>
                 Lengkapi Profil
               </button>
            </div>
          </div>
        )}

        <div style={{ height: '80px' }}></div>
      </div>

    </>
  );
}