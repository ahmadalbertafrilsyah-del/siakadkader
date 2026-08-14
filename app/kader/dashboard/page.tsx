'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, onSnapshot, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';

export default function DashboardKader() {
  const router = useRouter();
  
  // --- STATE PROFIL KADER ---
  const [profil, setProfil] = useState({
    fotoUrl: 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO', 
    nama: 'Loading...', nim: '', nia: '-', angkatan: '',
    email: '', tempatLahir: '', tanggalLahir: '',
    alamatAsal: '', alamatDomisili: '', id_rayon: '', jenjang: 'MAPABA',
    status: 'Aktif', pendampingId: '', pendamping_skp_id: '',
    pendamping_mapaba_id: [], pendamping_pkd_id: [], pendamping_sig_id: []
  });
  
  const [namaRayonAsli, setNamaRayonAsli] = useState('Memuat Instansi...');
  const [semuaPendamping, setSemuaPendamping] = useState<any[]>([]); 
  const [semuaRayon, setSemuaRayon] = useState<any[]>([]); 
  
  // --- STATE UPLOAD BERKAS & TUGAS ---
  const [riwayatBerkas, setRiwayatBerkas] = useState<any[]>([]);
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]); 
  
  // --- STATE RAPORT DINAMIS ---
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({}); 
  const [nilaiKader, setNilaiKader] = useState<Record<string, string>>({});
  const [kategoriBobotRayon, setKategoriBobotRayon] = useState<Record<string, any[]>>({});
  const [kategoriBobotKomisariat, setKategoriBobotKomisariat] = useState<Record<string, any[]>>({});
  const [evaluasiKaderGlobal, setEvaluasiKaderGlobal] = useState<Record<string, any>>({});

  // --- STATE ENTERPRISE (KALENDER, BROADCAST) ---
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [notifikasiGlobal, setNotifikasiGlobal] = useState<any[]>([]);

  useEffect(() => {
    const qPendamping = query(collection(db, "users"), where("role", "==", "pendamping"));
    const unsubP = onSnapshot(qPendamping, (snap) => {
      setSemuaPendamping(snap.docs.map(d => ({ username: d.id, ...d.data() })));
    });

    const qRayon = query(collection(db, "users"), where("role", "==", "rayon"));
    const unsubR = onSnapshot(qRayon, (snap) => {
      setSemuaRayon(snap.docs.map(d => ({ username: d.id, ...d.data() })));
    });

    return () => { unsubP(); unsubR(); };
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const dataDB = snap.docs[0].data();
            if (dataDB.role !== 'kader') {
              router.push('/');
              return;
            }

            setProfil({
              fotoUrl: dataDB.fotoUrl || 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO',
              nama: dataDB.nama || '', nim: dataDB.nim || '', nia: dataDB.nia || '-', 
              angkatan: dataDB.angkatan || '', email: dataDB.email || '', 
              tempatLahir: dataDB.tempatLahir || '', tanggalLahir: dataDB.tanggalLahir || '',
              alamatAsal: dataDB.alamatAsal || '', alamatDomisili: dataDB.alamatDomisili || '',
              id_rayon: dataDB.id_rayon || '', jenjang: dataDB.jenjang || 'MAPABA',
              status: dataDB.status || 'Aktif',
              pendampingId: dataDB.pendampingId || '',
              pendamping_skp_id: dataDB.pendamping_skp_id || '',
              pendamping_mapaba_id: dataDB.pendamping_mapaba_id || [],
              pendamping_pkd_id: dataDB.pendamping_pkd_id || [],
              pendamping_sig_id: dataDB.pendamping_sig_id || []
            });

            if(dataDB.id_rayon) {
              if (dataDB.id_rayon === 'Komisariat' || dataDB.id_rayon === 'Pusat Komisariat') {
                 setNamaRayonAsli('Pusat Komisariat');
              } else {
                 onSnapshot(doc(db, "users", dataDB.id_rayon), (rayonSnap) => {
                   if (rayonSnap.exists()) {
                      setNamaRayonAsli(rayonSnap.data().nama || dataDB.id_rayon);
                   }
                 });
              }

              const allP = [
                ...(Array.isArray(dataDB.pendamping_mapaba_id) ? dataDB.pendamping_mapaba_id : (dataDB.pendamping_mapaba_id ? [dataDB.pendamping_mapaba_id] : [])),
                ...(Array.isArray(dataDB.pendamping_pkd_id) ? dataDB.pendamping_pkd_id : (dataDB.pendamping_pkd_id ? [dataDB.pendamping_pkd_id] : [])),
                ...(Array.isArray(dataDB.pendamping_sig_id) ? dataDB.pendamping_sig_id : (dataDB.pendamping_sig_id ? [dataDB.pendamping_sig_id] : [])),
                ...(Array.isArray(dataDB.pendampingId) ? dataDB.pendampingId : (dataDB.pendampingId ? [dataDB.pendampingId] : []))
              ];

              jalankanPendengarDataRayon(dataDB.nim, user.email, dataDB.id_rayon, allP, dataDB.pendamping_skp_id);
            }
          }
        });
        
        onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.bobot_penilaian) setKategoriBobotKomisariat(data.bobot_penilaian);
          }
        });

      } else {
        router.push('/');
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const jalankanPendengarDataRayon = (nimKader: string, emailKader: string | null, idRayon: string, allPendampingIds: any[], pendampingSkpId: any) => {
    if(!nimKader || !emailKader || !idRayon) return;

    onSnapshot(doc(db, "kurikulum_rayon", idRayon), (docSnap) => {
      const dataRayon = docSnap.exists() ? docSnap.data() : {};
      onSnapshot(collection(db, "master_kurikulum_pusat"), (pusatSnap) => {
        const skpMateri: any[] = [];
        pusatSnap.forEach(d => { if (d.data().jenjang === 'SKP') skpMateri.push({ id: d.id, ...d.data() }); });
        skpMateri.sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' }));
        setListKurikulum({ ...dataRayon, SKP: skpMateri } as Record<string, any[]>);
      });
    });

    onSnapshot(doc(db, "pengaturan_rayon", idRayon), (docSnap) => {
      if (docSnap.exists() && docSnap.data().bobot_penilaian) {
        setKategoriBobotRayon(docSnap.data().bobot_penilaian);
      }
    });

    onSnapshot(doc(db, "nilai_khs", nimKader), (docSnap) => {
      if (docSnap.exists()) setNilaiKader(docSnap.data());
    });

    const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", emailKader));
    onSnapshot(qBerkas, (snap) => {
      const dataBerkas: any[] = [];
      snap.forEach((doc) => dataBerkas.push({ id: doc.id, ...doc.data() }));
      dataBerkas.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setRiwayatBerkas(dataBerkas);
    });

    onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", idRayon)), (snapRayon) => {
      const dataTugasRayon: any[] = [];
      snapRayon.forEach((doc) => dataTugasRayon.push({ id: doc.id, ...doc.data() }));

      onSnapshot(query(collection(db, "master_tugas"), where("jenjang", "==", "SKP")), (snapSkp) => {
        const dataTugasSkp: any[] = [];
        snapSkp.forEach((doc) => dataTugasSkp.push({ id: doc.id, ...doc.data() }));
        const mergedTugas = [...dataTugasRayon, ...dataTugasSkp];
        const uniqueTugas = Array.from(new Map(mergedTugas.map(item => [item.id, item])).values());
        setListMasterTugas(uniqueTugas);
      });
    });

    const pIdSkp = Array.isArray(pendampingSkpId) ? pendampingSkpId : (pendampingSkpId ? [pendampingSkpId] : []);
    const fullPids = [...allPendampingIds, ...pIdSkp].filter(Boolean);

    onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
      const listJadwal: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.pembuat === "Komisariat" || d.pembuat === "Pusat Komisariat" || d.id_rayon === "Komisariat" || d.id_rayon === idRayon) {
          if (d.target === "Rayon" || d.target === "Pendamping") return;
          if (d.target === "Binaan" || (d.pembuat && d.pembuat.includes("Pendamping"))) {
             if (!fullPids.includes(d.pendamping_id)) return;
          }
          listJadwal.push({ id: doc.id, ...d });
        }
      });
      listJadwal.sort((a, b) => b.timestamp - a.timestamp);
      setJadwalKegiatan(listJadwal);
    });

    onSnapshot(collection(db, "notifikasi_global"), (snap) => {
      const listNotif: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.target === "Semua" || d.target === "Kader" || (d.target === "Binaan" && fullPids.includes(d.pengirim_id))) {
          if (d.pengirim === "Pusat Komisariat" || d.id_rayon === "Komisariat" || d.id_rayon === idRayon || fullPids.includes(d.pengirim_id)) {
            listNotif.push({ id: doc.id, ...d });
          }
        }
      });
      listNotif.sort((a, b) => b.timestamp - a.timestamp);
      setNotifikasiGlobal(listNotif);
    });
  };

  useEffect(() => {
    if (!profil.nim) return;
    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", profil.nim), (docSnap) => {
      if (docSnap.exists()) {
        setEvaluasiKaderGlobal(docSnap.data());
      } else {
        setEvaluasiKaderGlobal({});
      }
    });
    return () => unsubscribeKeaktifan();
  }, [profil.nim]);

  const getNamaPendamping = (idData: any) => {
    if (!idData || idData.length === 0) return "Belum Diplotkan";
    if (Array.isArray(idData)) {
       if(idData.length === 0) return "Belum Diplotkan";
       return idData.map(id => semuaPendamping.find(p => p.username === id || p.id === id)?.nama || id).join(', ');
    }
    return semuaPendamping.find(p => p.username === idData || p.id === idData)?.nama || idData;
  };

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };

  // --- PERHITUNGAN IPK MENGGUNAKAN MATRIKS KHS (PRESISI) ---
  const getNilaiHurufRealtime = (kodeMateri: string, jenjangTujuan: string) => {
    const bobotJenjang = jenjangTujuan === 'SKP' ? (kategoriBobotKomisariat['SKP'] || []) : (kategoriBobotRayon[jenjangTujuan] || []);
    const mentah = evaluasiKaderGlobal[jenjangTujuan]?.nilai_mentah?.[kodeMateri];
    
    if (!bobotJenjang || bobotJenjang.length === 0) return "-";
    if (!mentah || Object.keys(mentah).length === 0) return nilaiKader[kodeMateri] || "-";

    let angkaAkhir = 0;
    bobotJenjang.forEach((kat: any) => {
        const score = mentah[kat.nama] || 0;
        angkaAkhir += (score * (kat.persen / 100));
    });
    return getNilaiHuruf(angkaAkhir);
  };

  const hitungIpkPerJenjang = (jenjang: string) => {
    const materi = listKurikulum[jenjang] || [];
    if (materi.length === 0) return null;
    let tSks = 0; let tBobot = 0; let adaNilai = false;
    
    materi.forEach(m => {
        const huruf = getNilaiHurufRealtime(m.kode, jenjang);
        tSks += (m.bobot || 0);
        if (huruf !== "-") {
            adaNilai = true;
            tBobot += (m.bobot || 0) * konversiHurufKeAngka(huruf);
        }
    });
    if (!adaNilai) return null;
    return tSks > 0 ? (tBobot / tSks).toFixed(2) : "0.00";
  };

  const ipkMapaba = hitungIpkPerJenjang('MAPABA');
  const ipkPkd = hitungIpkPerJenjang('PKD');
  const ipkSig = hitungIpkPerJenjang('SIG');
  const ipkSkp = hitungIpkPerJenjang('SKP');

  const currentIpk = profil.jenjang === 'MAPABA' ? ipkMapaba :
                     profil.jenjang === 'PKD' ? ipkPkd :
                     profil.jenjang === 'SIG' ? ipkSig :
                     profil.jenjang === 'SKP' ? ipkSkp : '0.00';

  const tugasSelesai = riwayatBerkas.filter((b) => b.status === 'Selesai').length;
  const tugasTotal = listMasterTugas.length;

  const MenuCardMobile = ({ icon, label, onClick }: any) => (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: '#fff', padding: '15px 5px', borderRadius: '12px' }}>
       <div style={{ backgroundColor: '#eaf4fc', width: '55px', height: '55px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.8rem' }}>{icon}</div>
       <div style={{ fontSize: '0.75rem', color: '#0000af', textAlign: 'center', fontWeight: 'bold' }}>{label}</div>
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

        /* Menyembunyikan scrollbar di slider IPK */
        .hide-scroll::-webkit-scrollbar {
          display: none;
        }
        .hide-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* ========================================================== */}
      {/* 1. TAMPILAN LAPTOP / DESKTOP UTUH SEPERTI SEBELUMNYA         */}
      {/* ========================================================== */}
      <div className="desktop-view">
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
          <h2 style={{marginTop: 0, fontSize: '1.5rem', color: '#0000af'}}>Halo, Sahabat/i {profil.nama ? profil.nama.split(' ')[0] : ''}! 👋</h2>
          <p style={{margin: '8px 0 0 0', fontSize: '0.9rem', color: '#555', opacity: 0.9}}>Selamat datang di Sistem Informasi Akademik dan Kaderisasi {namaRayonAsli}. Berikut adalah ringkasan progres kaderisasi Anda saat ini.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '10px' }}>
          <div style={{ backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', borderLeft: '4px solid #2ecc71', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold' }}>Pendamping Instansi</div>
            <div style={{ fontSize: '1.1rem', color: '#333', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getNamaPendamping(profil.pendamping_mapaba_id?.length ? profil.pendamping_mapaba_id : profil.pendampingId)}
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
      {/* 2. TAMPILAN MOBILE APP ONLY (GRID MENU & MELENGKUNG)       */}
      {/* ========================================================== */}
      <div className="mobile-view" style={{ minHeight: '100%', margin: 0, padding: 0 }}>
        
        {/* Area Lengkungan Biru Tua */}
        <div style={{ 
           backgroundColor: '#0000af', 
           padding: '30px 20px 80px 20px', 
           borderBottomLeftRadius: '30px', 
           borderBottomRightRadius: '30px', 
           color: 'white',
           marginTop: '-1px'
        }}>
           <h1 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '0.5px', color: '#f1c40f' }}>Layanan Referensi</h1>
           <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.5' }}>
             Akses seluruh data kaderisasi, tugas, raport, dan referensi bacaan {namaRayonAsli} dalam satu genggaman.
           </p>
        </div>

        {/* Grid Menu Kotak Melayang */}
        <div style={{ marginTop: '-50px', padding: '0 20px', position: 'relative', zIndex: 10 }}>
          <div style={{ 
             backgroundColor: '#fff', borderRadius: '16px', padding: '25px 15px', 
             boxShadow: '0 8px 20px rgba(0,0,0,0.06)', 
             display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 10px' 
          }}>
             <MenuCardMobile icon="📊" label="Kartu KHS" onClick={() => router.push('/kader/raport')} />
             <MenuCardMobile icon="📚" label="Perpus" onClick={() => router.push('/kader/perpustakaan')} />
             <MenuCardMobile icon="📅" label="Agenda" onClick={() => router.push('/kader/kalender')} />
             <MenuCardMobile icon="📝" label="Ujian Tes" onClick={() => router.push('/kader/tes')} />
             <MenuCardMobile icon="📋" label="Upload Tugas" onClick={() => router.push('/kader/tugas')} />
             <MenuCardMobile icon="📜" label="Sertifikat" onClick={() => router.push('/kader/sertifikat')} />
          </div>
        </div>

        {/* Kartu IPK Dinamis Utama */}
        <div style={{ padding: '20px' }}>
          <div style={{ 
             backgroundColor: '#fff', borderRadius: '16px', padding: '20px', 
             boxShadow: '0 4px 12px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '6px solid #0000af'
          }}>
             <div>
               <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', marginBottom: '4px' }}>Indeks Prestasi Saat Ini</div>
               <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0000af' }}>IPK: {currentIpk || '0.00'}</div>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#27ae60', fontWeight: 'bold', fontSize: '0.85rem', backgroundColor: '#e8f5e9', padding: '8px 14px', borderRadius: '20px' }}>
               Kader {profil.status || 'Aktif'} <span style={{fontSize: '0.6rem'}}>{profil.status === 'Pasif' ? '🔴' : '🟢'}</span>
             </div>
          </div>
        </div>

        {/* Kartu IPK Tiap Jenjang (Scroll Horizontal) */}
        <div style={{ padding: '0 20px 20px 20px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '0.9rem' }}>Detail IPK per Jenjang</h4>
          <div className="hide-scroll" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
              <div style={{ minWidth: '110px', backgroundColor: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #eaeaea', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>MAPABA</div>
                  <div style={{ fontSize: '1.3rem', color: ipkMapaba ? '#0000af' : '#ccc', fontWeight: 'bold', marginTop: '5px' }}>{ipkMapaba || '-'}</div>
              </div>
              <div style={{ minWidth: '110px', backgroundColor: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #eaeaea', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>PKD</div>
                  <div style={{ fontSize: '1.3rem', color: ipkPkd ? '#0000af' : '#ccc', fontWeight: 'bold', marginTop: '5px' }}>{ipkPkd || '-'}</div>
              </div>
              <div style={{ minWidth: '110px', backgroundColor: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #eaeaea', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>SIG</div>
                  <div style={{ fontSize: '1.3rem', color: ipkSig ? '#0000af' : '#ccc', fontWeight: 'bold', marginTop: '5px' }}>{ipkSig || '-'}</div>
              </div>
              <div style={{ minWidth: '110px', backgroundColor: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #eaeaea', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>SKP</div>
                  <div style={{ fontSize: '1.3rem', color: ipkSkp ? '#0000af' : '#ccc', fontWeight: 'bold', marginTop: '5px' }}>{ipkSkp || '-'}</div>
              </div>
          </div>
        </div>

        {/* Kartu Profil Warning */}
        {(!profil.nim || !profil.tempatLahir || profil.nia === '-') && (
          <div style={{ padding: '0 20px 30px 20px' }}>
            <div style={{ 
               backgroundColor: '#fff3cd', borderRadius: '12px', padding: '20px', border: '1px solid #f1c40f',
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