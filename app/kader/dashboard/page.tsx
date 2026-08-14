'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

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
  const [tugasSelesai, setTugasSelesai] = useState(0);
  const [tugasTotal, setTugasTotal] = useState(0);
  
  // --- STATE RAPORT DINAMIS ---
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({}); 
  const [nilaiKader, setNilaiKader] = useState<Record<string, string>>({});
  const [kategoriBobotRayon, setKategoriBobotRayon] = useState<Record<string, any[]>>({});
  const [kategoriBobotKomisariat, setKategoriBobotKomisariat] = useState<Record<string, any[]>>({});
  const [evaluasiKaderGlobal, setEvaluasiKaderGlobal] = useState<Record<string, any>>({});

  // State IPK Dinamis
  const [ipkMapaba, setIpkMapaba] = useState<string | null>(null);
  const [ipkPkd, setIpkPkd] = useState<string | null>(null);
  const [ipkSig, setIpkSig] = useState<string | null>(null);
  const [ipkSkp, setIpkSkp] = useState<string | null>(null);
  const [ipKader, setIpKader] = useState('0.00');

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
      setTugasSelesai(dataBerkas.filter(b => b.status === 'Selesai').length);
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
        setTugasTotal(uniqueTugas.length);
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

  // --- PERHITUNGAN IPK PRESISI ---
  const getNilaiHurufRealtime = (kodeMateri: string, jenjangTujuan: string) => {
    const bobotJenjang = jenjangTujuan === 'SKP' ? (kategoriBobotKomisariat['SKP'] || []) : (kategoriBobotRayon[jenjangTujuan] || (kategoriBobotRayon['MAPABA'] || []));
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

  useEffect(() => {
    setIpkMapaba(hitungIpkPerJenjang('MAPABA'));
    setIpkPkd(hitungIpkPerJenjang('PKD'));
    setIpkSig(hitungIpkPerJenjang('SIG'));
    setIpkSkp(hitungIpkPerJenjang('SKP'));

    const currentIpk = profil.jenjang === 'MAPABA' ? hitungIpkPerJenjang('MAPABA') :
                       profil.jenjang === 'PKD' ? hitungIpkPerJenjang('PKD') :
                       profil.jenjang === 'SIG' ? hitungIpkPerJenjang('SIG') :
                       profil.jenjang === 'SKP' ? hitungIpkPerJenjang('SKP') : '0.00';
                       
    setIpKader(currentIpk || '0.00');
  }, [listKurikulum, evaluasiKaderGlobal, kategoriBobotRayon, kategoriBobotKomisariat, profil.jenjang, nilaiKader]);


  const LineChartIPK = () => {
    const ipks = [
        { label: 'MAPABA', val: parseFloat(ipkMapaba || '0') },
        { label: 'PKD', val: parseFloat(ipkPkd || '0') },
        { label: 'SIG', val: parseFloat(ipkSig || '0') },
        { label: 'SKP', val: parseFloat(ipkSkp || '0') },
    ];
    
    const getY = (val: number) => 100 - (val / 4 * 80); 
    const getX = (idx: number) => 40 + (idx * 90); 

    const pathD = ipks.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.val)}`).join(' ');
    const areaD = `${pathD} L ${getX(3)} 120 L ${getX(0)} 120 Z`;

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '25px 20px', boxShadow: '0 8px 25px rgba(0,0,0,0.03)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ fontSize: '0.9rem', color: '#555', fontWeight: 'bold' }}>Grafik Indeks Prestasi</div>
              <div style={{ fontSize: '0.75rem', color: '#27ae60', fontWeight: 'bold', backgroundColor: '#eaf4fc', padding: '6px 10px', borderRadius: '12px' }}>IPK Max: 4.00</div>
           </div>
           
           <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
              <svg viewBox="0 0 350 140" style={{ width: '100%', minWidth: '350px', height: '140px', overflow: 'visible' }}>
                 <defs>
                   <linearGradient id="gradientIPK" x1="0%" y1="0%" x2="0%" y2="100%">
                     <stop offset="0%" stopColor="#0000af" stopOpacity="0.15" />
                     <stop offset="100%" stopColor="#0000af" stopOpacity="0" />
                   </linearGradient>
                 </defs>
                 
                 {[0, 1, 2, 3, 4].map(v => (
                    <g key={v}>
                      <text x="10" y={getY(v) + 4} fontSize="10" fill="#bbb" fontWeight="bold">{v}</text>
                      <line x1="25" y1={getY(v)} x2="350" y2={getY(v)} stroke="#f4f6f9" strokeWidth="2" strokeDasharray="4" />
                    </g>
                 ))}
                 
                 <path d={areaD} fill="url(#gradientIPK)" />
                 <path d={pathD} fill="none" stroke="#0000af" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                 
                 {ipks.map((p, i) => (
                    <g key={i}>
                       <circle cx={getX(i)} cy={getY(p.val)} r="6" fill="#fff" stroke="#0000af" strokeWidth="3" />
                       <text x={getX(i)} y="135" fontSize="10" fill="#777" textAnchor="middle" fontWeight="bold">{p.label}</text>
                       {p.val > 0 && (
                           <text x={getX(i)} y={getY(p.val) - 12} fontSize="11" fill="#0000af" textAnchor="middle" fontWeight="bold">
                               {p.val.toFixed(2)}
                           </text>
                       )}
                    </g>
                 ))}
              </svg>
           </div>
        </div>
    );
  };

  const MenuCardMobile = ({ icon, label, onClick }: any) => (
    <div onClick={onClick} className="hover-card-modern" style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', 
        cursor: 'pointer', backgroundColor: '#fff', padding: '18px 8px', 
        borderRadius: '20px', transition: 'all 0.3s ease' 
    }}>
       <div style={{ 
           backgroundColor: '#f0f5ff', width: '56px', height: '56px', borderRadius: '18px', 
           display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.6rem',
           boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 10px rgba(0,0,175,0.08)'
       }}>
           {icon}
       </div>
       <div style={{ fontSize: '0.75rem', color: '#333', textAlign: 'center', fontWeight: 'bold' }}>{label}</div>
    </div>
  );

  return (
    <>
      <style>{`
        /* CSS KHUSUS TOGGLE VIEW & MODERN DESIGN */
        .desktop-view { display: flex; flex-direction: column; gap: 20px; }
        .mobile-view { display: none; }
        
        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: block !important; }
           
           /* Menghilangkan scrollbar secara global pada view mobile */
           body, html, .mobile-view {
             overflow-x: hidden;
             -ms-overflow-style: none;  
             scrollbar-width: none;  
           }
           ::-webkit-scrollbar {
             display: none;
           }
        }

        .hover-card-modern:active { transform: scale(0.95); opacity: 0.8; }
        
        .modern-gradient-card {
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            border-radius: 24px;
            padding: 25px;
            color: white;
            box-shadow: 0 10px 30px rgba(46, 204, 113, 0.3);
            position: relative;
            overflow: hidden;
        }
        .modern-gradient-card::after {
            content: '';
            position: absolute;
            top: -40px;
            right: -30px;
            width: 140px;
            height: 140px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 50%;
        }
      `}</style>

      {/* ========================================================== */}
      {/* 1. TAMPILAN LAPTOP / DESKTOP UTUH                          */}
      {/* ========================================================== */}
      <div className="desktop-view">
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
          <h2 style={{marginTop: 0, fontSize: '1.6rem', color: '#0000af'}}>Halo, Sahabat/i {profil.nama}! 👋</h2>
          <p style={{margin: '8px 0 0 0', fontSize: '0.95rem', color: '#555', opacity: 0.9}}>Selamat datang di Sistem Informasi Akademik dan Kaderisasi {namaRayonAsli}. Berikut adalah ringkasan progres kaderisasi Anda saat ini.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '10px' }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', borderLeft: '5px solid #2ecc71', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold' }}>Pendamping Instansi</div>
            <div style={{ fontSize: '1.1rem', color: '#333', fontWeight: 'bold', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getNamaPendamping(profil.pendamping_mapaba_id?.length ? profil.pendamping_mapaba_id : profil.pendampingId)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold', marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px' }}>Pendamping SKP (Komisariat)</div>
            <div style={{ fontSize: '1.1rem', color: '#0000af', fontWeight: 'bold', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getNamaPendamping(profil.pendamping_skp_id)}
            </div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '25px 20px', borderRadius: '16px', borderLeft: '5px solid #e74c3c', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '0.85rem', color: '#777', fontWeight: 'bold' }}>Tugas Diselesaikan</div>
            <div style={{ fontSize: '2rem', color: '#333', fontWeight: 'bold', marginTop: '5px' }}>{tugasSelesai} <span style={{fontSize: '1rem', color: '#888'}}>/ {tugasTotal}</span></div>
          </div>
        </div>

        <h4 style={{ margin: '5px 0', color: '#0000af', fontSize: '1.1rem' }}>📊 Indeks Prestasi Kader (IPK)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '10px' }}>
            {[{label: 'MAPABA', val: ipkMapaba}, {label: 'PKD', val: ipkPkd}, {label: 'SIG', val: ipkSig}, {label: 'SKP', val: ipkSkp}].map(item => (
                <div key={item.label} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.85rem', color: '#555', fontWeight: 'bold' }}>IPK {item.label}</div>
                    <div style={{ fontSize: '1.6rem', color: item.val ? '#0000af' : '#ccc', fontWeight: 'bold', marginTop: '8px' }}>{item.val || '-'}</div>
                </div>
            ))}
        </div>

        <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 350px', background: 'white', padding: '25px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>🔔 Pusat Informasi</h3>
              <div style={{ display: 'grid', gap: '15px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                {notifikasiGlobal.length === 0 ? (
                  <div style={{ padding: '25px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '12px', color: '#999', fontSize: '0.85rem' }}>Kotak masuk informasi kosong.</div>
                ) : (
                  notifikasiGlobal.map(notif => (
                    <div key={notif.id} style={{ padding: '20px', backgroundColor: '#fdfdfd', border: '1px solid #eee', borderLeft: '4px solid #1e824c', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ color: '#333', fontSize: '0.95rem' }}>{notif.judul}</strong><span style={{ fontSize: '0.75rem', color: '#888' }}>{notif.tanggal}</span>
                      </div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{notif.pesan}</p>
                      <div style={{ fontSize: '0.75rem', color: '#3498db', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div style={{ flex: '1 1 350px', background: 'white', padding: '25px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>📅 Jadwal Kegiatan</h3>
              <div style={{ display: 'grid', gap: '15px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                {jadwalKegiatan.length === 0 ? (
                  <div style={{ padding: '25px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '12px', color: '#999', fontSize: '0.85rem' }}>Belum ada agenda kegiatan dalam waktu dekat.</div>
                ) : (
                  jadwalKegiatan.map(jadwal => {
                    const isKomisariat = jadwal.pembuat === 'Komisariat' || jadwal.pembuat === 'Pusat Komisariat';
                    const isPendamping = jadwal.pembuat?.includes('Pendamping');
                    const borderColor = isKomisariat ? '#f1c40f' : isPendamping ? '#3498db' : '#e74c3c';
                    const labelPembuat = isKomisariat ? 'Pusat Komisariat' : isPendamping ? 'Jadwal Mentoring' : 'Pengurus Rayon';

                    return (
                      <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: `4px solid ${borderColor}`, padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '1rem' }}>{jadwal.judul}</h4>
                            <span style={{ backgroundColor: '#f8f9fa', color: '#555', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{labelPembuat}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '8px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', fontStyle: 'italic', lineHeight: '1.5' }}>{jadwal.deskripsi}</p>
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
      {/* 2. TAMPILAN MOBILE APP ONLY (MODERN & ELEGANT)             */}
      {/* ========================================================== */}
      <div className="mobile-view" style={{ minHeight: '100%', margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        
        {/* Area Lengkungan Biru Tua Premium */}
        <div style={{ 
           background: 'linear-gradient(135deg, #0000af 0%, #1a56db 100%)', 
           padding: '40px 20px 90px 20px', 
           borderBottomLeftRadius: '40px', 
           borderBottomRightRadius: '40px', 
           color: 'white',
           marginTop: '-1px',
           position: 'relative',
           overflow: 'hidden'
        }}>
           <div style={{ position: 'absolute', top: '-30px', right: '-20px', width: '150px', height: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
           <div style={{ position: 'absolute', bottom: '20px', left: '-40px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
           
           <h1 style={{ margin: 0, fontSize: '1.6rem', letterSpacing: '0.5px', fontWeight: 'bold', color: '#f1c40f', position: 'relative', zIndex: 2 }}>SIAKAD PMII</h1>
           <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.5', position: 'relative', zIndex: 2 }}>
             Akses seluruh data kaderisasi, tugas, raport, dan referensi bacaan {namaRayonAsli} dalam satu genggaman.
           </p>
        </div>

        {/* Grid Menu Kotak Melayang */}
        <div style={{ marginTop: '-60px', padding: '0 20px', position: 'relative', zIndex: 10 }}>
          <div style={{ 
             backgroundColor: '#ffffff', borderRadius: '24px', padding: '25px 15px', 
             boxShadow: '0 15px 35px rgba(0,0,0,0.06)', 
             display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 10px' 
          }}>
             <MenuCardMobile icon="🎓" label="Kartu KHS" onClick={() => router.push('/kader/raport')} />
             <MenuCardMobile icon="📚" label="Perpus" onClick={() => router.push('/kader/perpustakaan')} />
             <MenuCardMobile icon="📅" label="Agenda" onClick={() => router.push('/kader/kalender')} />
             <MenuCardMobile icon="📝" label="Ujian Tes" onClick={() => router.push('/kader/tes')} />
             <MenuCardMobile icon="📋" label="Upload Tugas" onClick={() => router.push('/kader/tugas')} />
             <MenuCardMobile icon="📜" label="Sertifikat" onClick={() => router.push('/kader/sertifikat')} />
          </div>
        </div>

        {/* Kartu IPK Dinamis Utama (Modern Green Gradient Card) */}
        <div style={{ padding: '25px 20px 10px 20px' }}>
          <div className="modern-gradient-card">
             <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                 <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px' }}>Indeks Prestasi Saat Ini</div>
                 <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>IPK: {ipKader}</div>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: profil.status === 'Aktif' ? '#1e824c' : '#c62828', fontWeight: 'bold', fontSize: '0.75rem', backgroundColor: '#fff', padding: '8px 14px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                 Kader {profil.status || 'Aktif'} <span style={{fontSize: '0.6rem'}}>{profil.status === 'Pasif' ? '🔴' : '🟢'}</span>
               </div>
             </div>
          </div>
        </div>

        {/* GRAFIK LINE CHART VISUAL */}
        <div style={{ padding: '10px 20px 20px 20px' }}>
          <LineChartIPK />
        </div>

        {/* Kartu Profil Warning */}
        {(!profil.nim || !profil.tempatLahir || profil.nia === '-') && (
          <div style={{ padding: '0 20px 30px 20px' }}>
            <div style={{ 
               backgroundColor: '#fffbeb', borderRadius: '20px', padding: '25px', border: '1px solid #ffeeba',
               boxShadow: '0 8px 20px rgba(241, 196, 15, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px' 
            }}>
               <h4 style={{ margin: 0, color: '#856404', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span>⚠️</span> Profil Belum Lengkap!</h4>
               <p style={{ margin: 0, fontSize: '0.85rem', color: '#856404', lineHeight: '1.5' }}>Mohon lengkapi NIK, TTL, dll untuk keperluan penerbitan sertifikat digital resmi Anda.</p>
               <button onClick={() => router.push('/kader/profil')} style={{ alignSelf: 'flex-start', backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '10px 24px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', marginTop: '5px', boxShadow: '0 4px 10px rgba(241, 196, 15, 0.3)' }}>
                 Lengkapi Sekarang
               </button>
            </div>
          </div>
        )}

        <div style={{ height: '90px' }}></div>
      </div>

    </>
  );
}