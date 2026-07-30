'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

export default function PageDaftarKaderPendamping() {
  const router = useRouter();
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '', jenjangTugas: 'MAPABA' });
  const [kaderBinaan, setKaderBinaan] = useState<any[]>([]);
  const [semuaRayon, setSemuaRayon] = useState<any[]>([]); 
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], SIG: [], SKP: [], NONFORMAL: [] });
  const [kategoriBobotRayon, setKategoriBobotRayon] = useState<Record<string, any[]>>({});
  const [kategoriBobotKomisariat, setKategoriBobotKomisariat] = useState<Record<string, any[]>>({});

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubRayon = onSnapshot(query(collection(db, "users"), where("role", "==", "rayon")), (snap) => {
      setSemuaRayon(snap.docs.map(d => ({ username: d.id, ...d.data() })));
    });
    unsubs.push(unsubRayon);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon, jenjangTugas: p.jenjangTugas || 'MAPABA' });
            const isPendampingSKP = p.id_rayon === 'Komisariat';

            if (isPendampingSKP) {
              const unsub1 = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap: any) => {
                if (docSnap.exists() && docSnap.data().bobot_penilaian) setKategoriBobotKomisariat(docSnap.data().bobot_penilaian);
              });
              unsubs.push(unsub1);

              const unsub2 = onSnapshot(query(collection(db, "master_kurikulum_pusat"), where("jenjang", "==", "SKP")), (snap: any) => {
                const listMateri: any[] = []; snap.docs.forEach((doc: any) => listMateri.push({ id: doc.id, ...doc.data() }));
                setListKurikulum(prev => ({ ...prev, SKP: listMateri }));
              });
              unsubs.push(unsub2);
            } else {
              const unsub3 = onSnapshot(doc(db, "pengaturan_rayon", p.id_rayon), (docSnap: any) => {
                if (docSnap.exists() && docSnap.data().bobot_penilaian) setKategoriBobotRayon(docSnap.data().bobot_penilaian);
              });
              unsubs.push(unsub3);

              const unsub4 = onSnapshot(doc(db, "kurikulum_rayon", p.id_rayon), (docSnap: any) => {
                if (docSnap.exists()) setListKurikulum(docSnap.data() as Record<string, any[]>);
              });
              unsubs.push(unsub4);
            }

            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const listKader: any[] = [];
            
            for (const d of snapKader.docs) {
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

              if (isBinaan) {
                  const evaluasiSnap = await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", data.nim)));
                  const evaluasiData = evaluasiSnap.empty ? {} : evaluasiSnap.docs[0].data();
                  listKader.push({ id: d.id, evaluasiMaster: evaluasiData, ...data });
              }
            }
            setKaderBinaan(listKader);
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

  const getNamaInstansi = (idData: string) => {
    if (!idData) return "-";
    if (idData === 'Komisariat' || idData === 'Pusat Komisariat') return 'Pusat Komisariat';
    const r = semuaRayon.find((x: any) => x.username === idData || x.id_rayon === idData || x.id === idData);
    return r ? r.nama : idData;
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };
  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const hitungIpkDinamicTabel = (kaderTarget: any, jenjangTarget: string) => {
    const kurikulumTarget = listKurikulum[jenjangTarget] || [];
    if (kurikulumTarget.length === 0) return "-";
    
    let tempT_sks = 0; let tempT_bobot = 0; let adaYangDiisi = false;
    const evaluasiMaster = kaderTarget.evaluasiMaster || {};
    const evaluasiDiJenjang = evaluasiMaster[jenjangTarget] || { nilai_mentah: {} };
    
    const bobotJenjang = jenjangTarget === 'SKP' 
      ? (kategoriBobotKomisariat['SKP'] || []) 
      : (kategoriBobotRayon[jenjangTarget] || (kategoriBobotRayon['MAPABA'] || [])); 
    
    kurikulumTarget.forEach(m => {
        const mentah = evaluasiDiJenjang.nilai_mentah?.[m.kode];
        let huruf = "-";
        
        if (mentah && Object.keys(mentah).length > 0 && bobotJenjang.length > 0) {
            let num = 0;
            bobotJenjang.forEach((k: any) => { num += (mentah[k.nama] || 0) * (k.persen / 100); });
            huruf = getNilaiHuruf(num);
        }

        tempT_sks += (m.bobot || 0);
        if (huruf !== "-") { adaYangDiisi = true; tempT_bobot += (m.bobot || 0) * konversiHurufKeAngka(huruf); }
    });

    if (!adaYangDiisi) return "-";
    return tempT_sks > 0 ? (tempT_bobot / tempT_sks).toFixed(2) : "0.00";
  };

  const handleExportKaderBinaan = () => {
    if (kaderBinaan.length === 0) return alert("Belum ada data kader binaan!");
    const dataToExport = kaderBinaan.map((k, i) => ({
      "No": i + 1, "NIM": k.nim || '-', "Nama Lengkap": k.nama || '-', "NIA": k.nia || '-', "Asal Rayon": getNamaInstansi(k.id_rayon), "Jenjang Terakhir": k.jenjang || 'MAPABA', "Status": k.status || 'Aktif'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Kader Binaan"); XLSX.writeFile(workbook, `Data_Binaan_${profilPendamping.nama}_${Date.now()}.xlsx`);
  };

  return (
    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <p style={{ color: '#555', fontSize: '0.85rem', margin: 0 }}>Daftar kader yang diplotkan langsung kepada Anda sebagai pendamping.</p>
        <button onClick={handleExportKaderBinaan} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>📥 Export Excel Binaan</button>
      </div>

      <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
        <table className="tabel-utama" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '800px' }}>
          <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#333' }}><th style={{ padding: '10px', textAlign: 'center' }}>NIM & Angkatan</th><th style={{ padding: '10px', textAlign: 'left' }}>Nama Kader</th><th style={{ padding: '10px', textAlign: 'center' }}>Asal Instansi</th><th style={{ padding: '10px', textAlign: 'center' }}>IPK Sementara</th><th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th></tr></thead>
          <tbody>
            {kaderBinaan.map((k: any) => {
              const thnMasuk = k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear() : '-');
              const ipkDinamis = hitungIpkDinamicTabel(k, profilPendamping.jenjangTugas);
              return (
                <tr key={k.nim} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', textAlign: 'center' }}><b>{k.nim}</b> <br/> <span style={{fontSize: '0.7rem', color: '#1e824c'}}>Angkatan: {thnMasuk}</span></td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{k.nama}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>{getNamaInstansi(k.id_rayon)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#0000af' }}>{ipkDinamis}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => router.push('/pendamping/input-nilai')} style={{ padding: '6px 12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>Buka Raport 📝</button></td>
                </tr>
              )
            })}
            {kaderBinaan.length === 0 && <tr><td colSpan={5} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada kader binaan yang diplotkan ke Anda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}