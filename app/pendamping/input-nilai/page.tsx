'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageInputNilaiPendamping() {
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '', jenjangTugas: 'MAPABA' });
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });
  
  const [kaderBinaan, setKaderBinaan] = useState<any[]>([]);
  const [selectedKader, setSelectedKader] = useState('');
  const [tabInput, setTabInput] = useState('materi'); 
  
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({});
  const [kategoriBobot, setKategoriBobot] = useState<any[]>([]);
  
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 
  const [nilaiMentah, setNilaiMentah] = useState<Record<string, Record<string, number>>>({});
  const [catatanKeaktifan, setCatatanKeaktifan] = useState('');
  const [evaluasiKader, setEvaluasiKader] = useState<{ nilai_mentah?: any, catatan: string }>({ nilai_mentah: {}, catatan: '' });

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon, jenjangTugas: p.jenjangTugas || 'MAPABA' });
            const isPendampingSKP = p.id_rayon === 'Komisariat';

            if (isPendampingSKP) {
              setNamaRayonInduk('Pusat Komisariat');
              const unsub1 = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap: any) => {
                if (docSnap.exists()) {
                  const d = docSnap.data(); setPengaturanCetak({ kopSuratUrl: d.kopSuratUrl || '', footerUrl: d.footerUrl || '' });
                  if (d.bobot_penilaian && d.bobot_penilaian['SKP']) setKategoriBobot(d.bobot_penilaian['SKP']);
                }
              });
              unsubs.push(unsub1);

              const unsub2 = onSnapshot(query(collection(db, "master_kurikulum_pusat"), where("jenjang", "==", "SKP")), (snap: any) => {
                const listMateri: any[] = []; snap.docs.forEach((doc: any) => listMateri.push({ id: doc.id, ...doc.data() }));
                setListKurikulum({ SKP: listMateri.sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true })) });
              });
              unsubs.push(unsub2);
            } else {
              const unsub3 = onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap: any) => {
                if (rayonSnap.exists()) {
                  const rData = rayonSnap.data(); setNamaRayonInduk(rData.nama || p.id_rayon);
                  setPengaturanCetak({ kopSuratUrl: rData.kopSuratUrl || '', footerUrl: rData.footerUrl || '' });
                }
              });
              unsubs.push(unsub3);

              const unsub4 = onSnapshot(doc(db, "pengaturan_rayon", p.id_rayon), (docSnap: any) => {
                if (docSnap.exists() && docSnap.data().bobot_penilaian) setKategoriBobot(docSnap.data().bobot_penilaian[p.jenjangTugas || 'MAPABA'] || []);
              });
              unsubs.push(unsub4);

              const unsub5 = onSnapshot(doc(db, "kurikulum_rayon", p.id_rayon), (docSnap: any) => {
                if (docSnap.exists()) setListKurikulum(docSnap.data());
              });
              unsubs.push(unsub5);
            }

            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const listKader: any[] = [];
            snapKader.forEach(d => {
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
              if (isBinaan) listKader.push({ id: d.id, ...data });
            });
            setKaderBinaan(listKader);
            if (listKader.length > 0 && !selectedKader) setSelectedKader(listKader[0].nim);
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(u => u());
    };
  }, [selectedKader]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    if (!selectedKader) return;
    const jenjang = profilPendamping.jenjangTugas;
    
    const unsub1 = onSnapshot(doc(db, "nilai_khs", selectedKader), (docSnap: any) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data()); else setNilaiKaderRealtime({});
    });
    unsubs.push(unsub1);

    const unsub2 = onSnapshot(doc(db, "evaluasi_kader", selectedKader), (docSnap: any) => {
      if (docSnap.exists() && docSnap.data()[jenjang]) {
        const data = docSnap.data()[jenjang];
        setNilaiMentah(data.nilai_mentah || {}); setCatatanKeaktifan(data.catatan || ''); setEvaluasiKader(data);
      } else {
        setNilaiMentah({}); setCatatanKeaktifan(''); setEvaluasiKader({ catatan: '' });
      }
    });
    unsubs.push(unsub2);

    return () => unsubs.forEach(u => u());
  }, [selectedKader, profilPendamping.jenjangTugas]);

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { id_rayon: profilPendamping.id_rayon, aktor: `Pendamping (${profilPendamping.nama})`, username: profilPendamping.username, role: "pendamping", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };
  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const handleInputNilaiMentah = (kodeMateri: string, namaKategori: string, value: string) => {
    let valNum = Number(value); if (valNum > 100) valNum = 100; if (valNum < 0) valNum = 0;
    setNilaiMentah({ ...nilaiMentah, [kodeMateri]: { ...(nilaiMentah[kodeMateri] || {}), [namaKategori]: valNum } });
  };

  const handleAutoSaveNilaiDetail = async (kodeMateri: string) => {
    if (!selectedKader) return;
    try {
      const docRef = doc(db, "evaluasi_kader", selectedKader);
      const existingSnap = await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKader)));
      const currentEvaluasi = existingSnap.empty ? {} : existingSnap.docs[0].data();
      const jenjangData = currentEvaluasi[profilPendamping.jenjangTugas] || { catatan: catatanKeaktifan };

      await setDoc(docRef, { ...currentEvaluasi, [profilPendamping.jenjangTugas]: { ...jenjangData, nilai_mentah: nilaiMentah, catatan: catatanKeaktifan } }, { merge: true });

      let angkaAkhir = 0;
      kategoriBobot.forEach(kat => { const score = nilaiMentah[kodeMateri]?.[kat.nama] || 0; angkaAkhir += score * (kat.persen / 100); });
      const hurufAkhir = getNilaiHuruf(angkaAkhir);

      await setDoc(doc(db, "nilai_khs", selectedKader), { [kodeMateri]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: `Pendamping (${profilPendamping.nama})` }, { merge: true });
      catatLogAktivitas(`Menyimpan nilai (${kodeMateri}) untuk kader: ${selectedKader}`);
    } catch (error) {}
  };

  const handleSimpanCatatan = async (text: string) => {
    setCatatanKeaktifan(text);
    try {
      const existingSnap = await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKader)));
      const currentEvaluasi = existingSnap.empty ? {} : existingSnap.docs[0].data();
      const jenjangData = currentEvaluasi[profilPendamping.jenjangTugas] || { nilai_mentah: nilaiMentah };
      await setDoc(doc(db, "evaluasi_kader", selectedKader), { ...currentEvaluasi, [profilPendamping.jenjangTugas]: { ...jenjangData, catatan: text } }, { merge: true });
    } catch (error) {}
  };

  const materiAktif = listKurikulum[profilPendamping.jenjangTugas] || [];
  let totalSks = 0; let totalBobotNilai = 0;
  
  const barisRaportRender = materiAktif.map((materi, index) => {
    const mentah = evaluasiKader?.nilai_mentah?.[materi.kode];
    let nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
    let angkaAkhir = 0;

    if (mentah && Object.keys(mentah).length > 0 && kategoriBobot.length > 0) {
      kategoriBobot.forEach((kat: any) => { angkaAkhir += (mentah[kat.nama] || 0) * (kat.persen / 100); });
      nilaiHuruf = getNilaiHuruf(angkaAkhir);
    }
    
    const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';
    const angkaSkala4 = angkaAkhir > 0 ? (angkaAkhir / 25) : 0; 
    const sksKaliNilai = (materi.bobot || 0) * angkaSkala4;
    totalSks += (materi.bobot || 0); 
    if (angkaAkhir > 0) totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode}>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{index + 1}</td><td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>{materi.kode}</td>
        <td style={{ padding: '6px 10px', textAlign: 'left' }}>{materi.nama}</td><td style={{ padding: '6px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: '#004a87' }}>{displayAngka}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#555' }}>{nilaiHuruf}</td><td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>{sksKaliNilai > 0 ? sksKaliNilai.toFixed(2) : 0}</td>
      </tr>
    );
  });
  
  const ipKader = totalSks > 0 ? parseFloat((totalBobotNilai / totalSks).toFixed(2)) : 0;
  const kaderDicetak = kaderBinaan.find(k => k.nim === selectedKader) || {};

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          main.no-print { display: block !important; }
          .main-content { margin-left: 0 !important; }
          header { display: none !important; }
          .web-ui-container { display: none !important; }
          body, html { background-color: transparent !important; margin: 0; padding: 0; height: auto !important; }
          .print-layout-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; z-index: 9999 !important; background: white;}
          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; width: 210mm !important; height: 297mm !important; z-index: -10 !important; }
          .bg-kertas-a4 img { width: 100% !important; height: 100% !important; object-fit: fill !important; display: block !important; }
          table.master-print-table { width: 100% !important; border: none !important; margin: 0 !important; padding: 0 !important; background-color: transparent !important; page-break-inside: auto !important; position: relative !important; z-index: 10 !important; }
          table.master-print-table > thead { display: table-header-group !important; }
          table.master-print-table > tfoot { display: table-footer-group !important; }
          table.master-print-table > tbody { display: table-row-group !important; }
          table.master-print-table td { border: none !important; padding: 0 !important; background-color: transparent !important; }
          .header-space { height: 55mm !important; }
          .footer-space { height: 35mm !important; }
          .print-content-area { padding: 0 25mm !important; position: relative; z-index: 10; }
          table.tabel-utama { width: 100% !important; border-collapse: collapse !important; }
          table.tabel-utama th, table.tabel-utama td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11pt !important; color: #000 !important; }
          table.tabel-utama th { font-weight: bold !important; text-align: center !important; }
          .tabel-biodata td { border: none !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      <div className="web-ui-container" style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader Binaan:</span>
            <select value={selectedKader} onChange={(e) => setSelectedKader(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
              {kaderBinaan.length === 0 && <option value="">Tidak ada binaan</option>}
              {kaderBinaan.map((k: any) => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
            </select>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginLeft: '5px' }}>Jenjang:</span>
            <div style={{ padding: '6px 15px', backgroundColor: '#eef2f3', borderRadius: '4px', fontWeight: 'bold', color: '#2c3e50', border: '1px solid #ccc', fontSize: '0.85rem' }}>{profilPendamping.jenjangTugas}</div>
            
            {tabInput === 'materi' && selectedKader && (
              <button onClick={() => window.print()} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', fontSize: '0.85rem' }}>🖨️ Cetak KHS</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '0 20px', backgroundColor: '#fff', marginTop: '15px', flexWrap: 'wrap' }}>
           <button onClick={() => setTabInput('materi')} style={{ padding: '5px 12px', border: 'none', background: tabInput === 'materi' ? '#fff' : 'transparent', color: tabInput === 'materi' ? '#007bff' : '#555', fontWeight: tabInput === 'materi' ? 'bold' : 'normal', borderTop: tabInput === 'materi' ? '3px solid #007bff' : '3px solid transparent', borderRight: '1px solid #ddd', borderLeft: '1px solid #ddd', cursor: 'pointer', marginBottom: '-1px', fontSize: '0.9rem' }}>Raport Kaderisasi</button>
           <button onClick={() => setTabInput('keaktifan')} style={{ padding: '5px 12px', border: 'none', background: tabInput === 'keaktifan' ? '#fff' : 'transparent', color: tabInput === 'keaktifan' ? '#007bff' : '#555', fontWeight: tabInput === 'keaktifan' ? 'bold' : 'normal', borderTop: tabInput === 'keaktifan' ? '3px solid #007bff' : '3px solid transparent', borderRight: '1px solid #ddd', cursor: 'pointer', marginBottom: '-1px', fontSize: '0.9rem' }}>Persentase & Nilai Detail</button>
        </div>

        {tabInput === 'materi' && (
          <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0', boxSizing: 'border-box' }}>
            <table className="tabel-utama" style={{ minWidth: '600px' }}>
              <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '12%', textAlign: 'center' }}>Kode</th><th style={{ width: '53%', textAlign: 'center' }}>Nama Materi</th><th style={{ width: '8%' }}>SKS</th><th style={{ width: '8%' }}>Angka</th><th style={{ width: '8%' }}>Nilai Huruf</th><th style={{ width: '8%' }}>SKS x Nilai</th></tr></thead>
              <tbody>
                {materiAktif.length === 0 ? (<tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur.</td></tr>) : barisRaportRender}
                <tr style={{ borderTop: '2px solid #ccc' }}><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalSks}</td><td colSpan={2}></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                <tr style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}><td colSpan={6} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.95rem' }}>IPK (Indeks Prestasi Kader)</td><td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>{ipKader}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {tabInput === 'keaktifan' && (
          <div style={{ backgroundColor: '#fafafa', padding: '20px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div style={{ marginBottom: '20px', background: '#eef2f3', padding: '15px', borderRadius: '6px', border: '1px dashed #b2c2cf' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0d1b2a', fontSize: '0.85rem' }}>📌 Kategori & Bobot Penilaian (Ditetapkan Instansi)</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {kategoriBobot.length === 0 ? <span style={{ fontSize: '0.8rem', color: '#e74c3c' }}>Belum ada bobot penilaian yang ditetapkan.</span> : 
                  kategoriBobot.map(kat => (
                    <div key={kat.id} style={{ backgroundColor: '#fff', padding: '4px 10px', borderRadius: '20px', border: '1px solid #ccc', fontSize: '0.75rem', fontWeight: 'bold', color: '#333' }}>
                      {kat.nama}: <span style={{ color: '#27ae60' }}>{kat.persen}%</span>
                    </div>
                  ))
                }
              </div>
            </div>

            <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
              <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem', backgroundColor: '#fff' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '3%' }}>No</th><th rowSpan={2} style={{ width: '8%', textAlign: 'center' }}>Kode</th><th rowSpan={2} style={{ width: '35%', textAlign: 'center' }}>Nama Materi</th>
                    {kategoriBobot.length > 0 && <th colSpan={kategoriBobot.length} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f0fbf4' }}>Input Nilai Detail (0-100)</th>}
                    <th rowSpan={2} style={{ width: '5%' }}>SKS</th><th colSpan={2} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#eaf4fc' }}>Hasil Akhir</th><th rowSpan={2} style={{ width: '8%' }}>SKS x Nilai</th>
                  </tr>
                  <tr>
                    {kategoriBobot.map(kat => <th key={kat.id} style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#1e824c', backgroundColor: '#f0fbf4' }}>{kat.nama} <br/><span style={{color: '#e74c3c'}}>{kat.persen}%</span></th>)}
                    <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', backgroundColor: '#eaf4fc' }}>Angka</th><th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', backgroundColor: '#eaf4fc' }}>Huruf</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (
                    <tr><td colSpan={7 + kategoriBobot.length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi.</td></tr>
                  ) : (
                    materiAktif.map((materi, index) => {
                      let angkaAkhir = 0;
                      kategoriBobot.forEach(kat => { const score = nilaiMentah[materi.kode]?.[kat.nama] || 0; angkaAkhir += (score * (kat.persen / 100)); });
                      const hurufAkhir = getNilaiHuruf(angkaAkhir);
                      const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';
                      const angkaSkala4 = angkaAkhir > 0 ? (angkaAkhir / 25) : 0;
                      const sksKaliNilai = (materi.bobot || 0) * angkaSkala4;

                      return (
                        <tr key={`rinci-${materi.kode}`}>
                          <td>{index + 1}</td><td style={{ textAlign: 'left' }}>{materi.kode}</td><td style={{ textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
                          {kategoriBobot.map((kat) => (
                            <td key={kat.id} style={{ backgroundColor: '#fcfcfc' }}>
                              <input type="number" min="0" max="100" placeholder="0"
                                value={nilaiMentah[materi.kode]?.[kat.nama] === 0 ? '' : (nilaiMentah[materi.kode]?.[kat.nama] || '')}
                                onChange={(e) => handleInputNilaiMentah(materi.kode, kat.nama, e.target.value)} onBlur={() => handleAutoSaveNilaiDetail(materi.kode)}
                                style={{ width: '50px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', fontSize: '0.85rem', outline: 'none' }} />
                            </td>
                          ))}
                          <td>{materi.bobot}</td>
                          <td style={{ fontWeight: 'bold', color: '#004a87', backgroundColor: '#f4f9fd' }}>{displayAngka}</td>
                          <td style={{ fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#f4f9fd', fontSize: '1rem' }}>{hurufAkhir}</td>
                          <td style={{ fontWeight: 'bold' }}>{sksKaliNilai > 0 ? sksKaliNilai.toFixed(2) : 0}</td>
                        </tr>
                      )
                    })
                  )}
                  <tr><td colSpan={3 + kategoriBobot.length} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah SKS & Nilai</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalSks}</td><td colSpan={2}></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                  <tr><td colSpan={4 + kategoriBobot.length} style={{ textAlign: 'center', fontWeight: 'bold' }}>IPK (Indeks Prestasi Kader)</td><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>{ipKader}</td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '20px' }}>
              <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.85rem'}}>Catatan / Pesan Pendamping untuk Kader:</label>
              <textarea rows={4} value={catatanKeaktifan} onChange={e => handleSimpanCatatan(e.target.value)} placeholder="Tuliskan evaluasi etika, saran pengembangan..." style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {/* PRINT CONTAINER */}
      <div className="print-layout-container">
        {pengaturanCetak.kopSuratUrl && <div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>}
        <table className="master-print-table">
          <thead><tr><td><div className="header-space"></div></td></tr></thead>
          <tbody>
            <tr>
              <td>
                <div className="print-content-area">
                  <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI</h3>
                  <table className="tabel-biodata">
                    <tbody>
                      <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak?.nim || '...........................'}</td></tr>
                      <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak?.nama || '...........................'}</td></tr>
                      <tr><td>Pelaksana</td><td>:</td><td>{namaRayonInduk}</td></tr>
                      <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak?.angkatan || (kaderDicetak?.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................')}</td></tr>
                      <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{profilPendamping.jenjangTugas}</td></tr>
                    </tbody>
                  </table>
                  <table className="tabel-utama">
                    <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '12%' }}>Kode</th><th style={{ width: '53%' }}>Nama Materi</th><th style={{ width: '10%' }}>SKS</th><th style={{ width: '10%' }}>Angka</th><th style={{ width: '10%' }}>Nilai</th><th style={{ width: '10%' }}>SKS x Nilai</th></tr></thead>
                    <tbody>
                      {materiAktif.length === 0 ? (<tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center' }}>Kurikulum belum diatur oleh Pengurus.</td></tr>) : barisRaportRender}
                      <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalSks}</td><td colSpan={2}></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                      <tr><td colSpan={6} style={{ textAlign: 'center', fontWeight: 'bold' }}>IPK (Indeks Prestasi Kaderisasi)</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{ipKader}</td></tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td><div className="footer-space"></div></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}