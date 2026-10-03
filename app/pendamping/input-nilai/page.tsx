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
      <tr key={materi.kode} style={{ borderBottom: '1px solid #eee' }}>
        <td style={{ padding: '15px 10px', textAlign: 'center', color: '#777' }}>{index + 1}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#0d1b2a' }}>{materi.kode}</td>
        <td style={{ padding: '15px 10px', textAlign: 'left', color: '#333' }}>{materi.nama}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#004a87' }}>{displayAngka}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#aaa' }}>{nilaiHuruf}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{sksKaliNilai > 0 ? sksKaliNilai.toFixed(2) : '-'}</td>
      </tr>
    );
  });

  const ipKader = totalSks > 0 ? parseFloat((totalBobotNilai / totalSks).toFixed(2)) : 0;
  const kaderDicetak = kaderBinaan.find(k => k.nim === selectedKader) || {};

  return (
    <>
      <style>{`
        .mobile-padded { display: flex; flex-direction: column; gap: 20px; }

        @media (max-width: 767px) {
           body, html, .mobile-content-wrapper, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .mobile-padded { padding: 15px !important; }
        }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        .modern-tab-container {
           display: flex; background-color: #f0f2f5; padding: 4px; border-radius: 8px; width: fit-content; margin-bottom: 15px;
        }
        .modern-tab {
           padding: 8px 12px; border-radius: 6px; border: none; background: transparent; color: #777; font-weight: bold; font-size: 0.75rem; cursor: pointer; transition: all 0.3s; white-space: nowrap;
        }
        .modern-tab.active {
           background-color: #fff; color: #0b5e4a; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        /* CETAK PDF DENGAN BACKGROUND KOP */
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html, .app-container, main, .main-content, .mobile-content-wrapper, .mobile-padded {
            background-color: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; display: block !important; position: static !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .siakad-shell, .sk-main, .sk-content {
            display: block !important; height: auto !important; min-height: 0 !important; overflow: visible !important; position: static !important; margin: 0 !important; padding: 0 !important;
          }
          .sk-sidebar, .sk-topbar, .sk-appbar, .sk-bottomnav { display: none !important; }
          aside, header, nav, .web-ui-container, .mobile-only, .desktop-only { display: none !important; }

          .print-layout-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; z-index: 9999 !important; background: white !important;}

          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; width: 210mm !important; height: 297mm !important; z-index: -10 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .bg-kertas-a4 img { width: 100% !important; height: 100% !important; object-fit: fill !important; display: block !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          table.master-print-table { width: 100% !important; border: none !important; margin: 0 !important; padding: 0 !important; background-color: transparent !important; page-break-inside: auto !important; position: relative !important; z-index: 10 !important; }
          table.master-print-table > thead { display: table-header-group !important; }
          table.master-print-table > tfoot { display: table-footer-group !important; }
          table.master-print-table > tbody { display: table-row-group !important; }
          table.master-print-table td { border: none !important; padding: 0 !important; background-color: transparent !important; }

          .header-space { height: 55mm !important; }
          .footer-space { height: 35mm !important; }
          .print-content-area { padding: 0 25mm !important; position: relative; z-index: 10; margin-top: 0 !important; }

          table.tabel-utama-print { width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px; page-break-inside: auto !important; }
          table.tabel-utama-print tr { page-break-inside: avoid !important; page-break-after: auto !important; }
          table.tabel-utama-print th, table.tabel-utama-print td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11pt !important; color: #000 !important; }
          table.tabel-utama-print th { font-weight: bold !important; text-align: center !important; }
          .tabel-biodata { margin-top: 0 !important; }
          .tabel-biodata td { border: none !important; padding: 3px 0 !important; font-size: 11pt !important; color: #000 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      {/* TAMPILAN WEB NORMAL */}
      <div className="web-ui-container mobile-padded">

        {/* BARIS FILTER */}
        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>

            {/* Group Pilih Kader Binaan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 220px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>Pilih Kader Binaan:</span>
              <select value={selectedKader} onChange={(e) => setSelectedKader(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: '8px', outline: 'none', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', width: '100%' }}>
                {kaderBinaan.length === 0 && <option value="">Tidak ada binaan</option>}
                {kaderBinaan.map((k: any) => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
              </select>
            </div>

            {/* Group Jenjang (tetap/tidak bisa diubah) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 1 auto' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>Jenjang:</span>
              <div style={{ padding: '8px 14px', backgroundColor: '#e8f5f0', borderRadius: '8px', fontWeight: 'bold', color: '#0b5e4a', border: '1px solid #cfe9e0', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{profilPendamping.jenjangTugas}</div>
            </div>

            {/* Tombol Cetak KHS */}
            {tabInput === 'materi' && selectedKader && (
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={() => window.print()} style={{ backgroundColor: '#0b5e4a', color: '#f5c518', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', boxShadow: '0 2px 5px rgba(11,94,74,0.15)' }}>
                  🖨️ Cetak KHS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KARTU KONTEN */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '15px', minHeight: '50vh' }}>

          <div className="modern-tab-container hide-scroll" style={{ maxWidth: '100%', overflowX: 'auto' }}>
            <button onClick={() => setTabInput('materi')} className={`modern-tab ${tabInput === 'materi' ? 'active' : ''}`}>Kartu Hasil Studi</button>
            <button onClick={() => setTabInput('keaktifan')} className={`modern-tab ${tabInput === 'keaktifan' ? 'active' : ''}`}>Rincian &amp; Bobot Nilai</button>
          </div>

          {tabInput === 'materi' && (
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '760px', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f4f8', color: '#555' }}>
                    <th style={{ padding: '12px 10px', borderRadius: '8px 0 0 8px', textAlign: 'center' }}>No</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Kode</th>
                    <th style={{ padding: '12px 10px' }}>Materi Kurikulum</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>SKS</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Angka</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Nilai</th>
                    <th style={{ padding: '12px 10px', borderRadius: '0 8px 8px 0', textAlign: 'center' }}>SKS x Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (<tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Materi kurikulum jenjang ini belum tersedia.</td></tr>) : barisRaportRender}
                  <tr style={{ borderTop: '2px dashed #ddd' }}>
                    <td colSpan={3} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>Total SKS</td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{totalSks}</td>
                    <td colSpan={2}></td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td>
                  </tr>
                  <tr>
                    <td colSpan={7}>
                      <div style={{ backgroundColor: '#eaf4fc', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #cce5ff', marginTop: '10px', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'bold', color: '#004a87', fontSize: '1rem' }}>Indeks Prestasi Kader (IPK)</span>
                        <span style={{ fontWeight: '900', color: '#0000af', fontSize: '1.5rem' }}>{ipKader}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {tabInput === 'keaktifan' && (
            <div>
              <div style={{ marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '0.85rem' }}>📌 Kategori &amp; Bobot Penilaian (Ditetapkan Instansi)</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {kategoriBobot.length === 0 ? <span style={{ fontSize: '0.75rem', color: '#e74c3c' }}>Belum ada bobot penilaian yang ditetapkan.</span> :
                    kategoriBobot.map(kat => (
                      <div key={kat.id} style={{ backgroundColor: '#fff', padding: '5px 12px', borderRadius: '20px', border: '1px solid #139070', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{kat.nama}:</span>
                        <span style={{ fontWeight: 'bold', color: '#0b5e4a' }}>{kat.persen}%</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Wrapper scroll khusus untuk tabel saja agar bagian atas tidak ikut bergeser */}
              <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', overflowY: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '900px', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555', borderRadius: '8px 0 0 0' }}>No</th>
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555' }}>Kode</th>
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555', textAlign: 'left' }}>Nama Materi</th>
                      {kategoriBobot.length > 0 && <th colSpan={kategoriBobot.length} style={{ padding: '8px', backgroundColor: '#e8f5e9', color: '#1e824c', borderBottom: '1px solid #fff' }}>Input Nilai Detail (0-100)</th>}
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555' }}>SKS</th>
                      <th colSpan={2} style={{ padding: '8px', backgroundColor: '#eaf4fc', color: '#004a87', borderBottom: '1px solid #fff' }}>Hasil Akhir</th>
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555', borderRadius: '0 8px 0 0' }}>SKS x Nilai</th>
                    </tr>
                    <tr>
                      {kategoriBobot.map(kat => <th key={kat.id} style={{ padding: '6px', backgroundColor: '#e8f5e9', color: '#1e824c', fontSize: '0.7rem' }}>{kat.nama} ({kat.persen}%)</th>)}
                      <th style={{ padding: '6px', backgroundColor: '#eaf4fc', color: '#004a87', fontSize: '0.7rem' }}>Angka</th>
                      <th style={{ padding: '6px', backgroundColor: '#eaf4fc', color: '#004a87', fontSize: '0.7rem' }}>Huruf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiAktif.length === 0 ? (
                      <tr><td colSpan={7 + kategoriBobot.length} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Belum ada rincian nilai.</td></tr>
                    ) : (
                      materiAktif.map((materi, index) => {
                        let angkaAkhir = 0;
                        kategoriBobot.forEach(kat => { const score = nilaiMentah[materi.kode]?.[kat.nama] || 0; angkaAkhir += (score * (kat.persen / 100)); });
                        const hurufAkhir = getNilaiHuruf(angkaAkhir);
                        const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';
                        const angkaSkala4 = angkaAkhir > 0 ? (angkaAkhir / 25) : 0;
                        const sksKaliNilai = (materi.bobot || 0) * angkaSkala4;

                        return (
                          <tr key={`rinci-${materi.kode}`} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{index + 1}</td>
                            <td style={{ padding: '10px' }}>{materi.kode}</td>
                            <td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>{materi.nama}</td>
                            {kategoriBobot.map((kat) => (
                              <td key={kat.id} style={{ backgroundColor: '#fafafa' }}>
                                <input type="number" min="0" max="100" placeholder="0"
                                  value={nilaiMentah[materi.kode]?.[kat.nama] === 0 ? '' : (nilaiMentah[materi.kode]?.[kat.nama] || '')}
                                  onChange={(e) => handleInputNilaiMentah(materi.kode, kat.nama, e.target.value)} onBlur={() => handleAutoSaveNilaiDetail(materi.kode)}
                                  style={{ width: '60px', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', textAlign: 'center', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }} />
                              </td>
                            ))}
                            <td style={{ padding: '10px' }}>{materi.bobot}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#004a87', backgroundColor: '#fcfcfc' }}>{displayAngka}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#fcfcfc', fontSize: '0.9rem' }}>{hurufAkhir}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e824c' }}>{sksKaliNilai > 0 ? sksKaliNilai.toFixed(2) : 0}</td>
                          </tr>
                        )
                      })
                    )}
                    <tr style={{ borderTop: '2px dashed #ddd' }}>
                      <td colSpan={3 + kategoriBobot.length} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>Jumlah SKS &amp; Nilai</td>
                      <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{totalSks}</td>
                      <td colSpan={2}></td>
                      <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td>
                    </tr>
                    <tr>
                      <td colSpan={7 + kategoriBobot.length}>
                        <div style={{ backgroundColor: '#eaf4fc', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #cce5ff', marginTop: '10px', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', color: '#004a87', fontSize: '1rem' }}>Indeks Prestasi Kader (IPK)</span>
                          <span style={{ fontWeight: '900', color: '#0000af', fontSize: '1.5rem' }}>{ipKader}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: '#333' }}>Catatan / Pesan Pendamping untuk Kader:</label>
                <textarea rows={4} value={catatanKeaktifan} onChange={e => handleSimpanCatatan(e.target.value)} placeholder="Tuliskan evaluasi etika, saran pengembangan..." style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </div>
          )}
        </div>
        <div style={{ height: '80px' }} className="mobile-only"></div>
      </div>

      {/* PRINT CONTAINER KHUSUS CETAK A4 PDF DENGAN BACKGROUND KOP */}
      <div className="print-layout-container">
        {pengaturanCetak.kopSuratUrl && <div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>}
        <table className="master-print-table">
          <thead><tr><td><div className="header-space"></div></td></tr></thead>
          <tbody>
            <tr>
              <td>
                <div className="print-content-area">
                  <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>KARTU HASIL STUDI (KHS) KADERISASI</h3>
                  <table className="tabel-biodata" style={{ width: '100%', marginBottom: '15px' }}>
                    <tbody>
                      <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak?.nim || '...........................'}</td></tr>
                      <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak?.nama || '...........................'}</td></tr>
                      <tr><td>Pelaksana Instansi</td><td>:</td><td>{namaRayonInduk}</td></tr>
                      <tr><td>Tahun Angkatan</td><td>:</td><td>{kaderDicetak?.angkatan || (kaderDicetak?.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................')}</td></tr>
                      <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{profilPendamping.jenjangTugas === 'SKP' ? 'SKP (Sekolah Kader Putri)' : profilPendamping.jenjangTugas}</td></tr>
                    </tbody>
                  </table>
                  <table className="tabel-utama-print">
                    <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '12%' }}>Kode Materi</th><th style={{ width: '45%' }}>Nama Materi Kurikulum</th><th style={{ width: '8%' }}>SKS</th><th style={{ width: '10%' }}>Angka</th><th style={{ width: '8%' }}>Nilai Huruf</th><th style={{ width: '12%' }}>SKS x Nilai</th></tr></thead>
                    <tbody>
                      {materiAktif.length === 0 ? (<tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center' }}>Kurikulum belum diatur oleh Pengurus.</td></tr>) : barisRaportRender}
                      <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalSks}</td><td colSpan={2}></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                      <tr><td colSpan={6} style={{ textAlign: 'center', fontWeight: 'bold' }}>Indeks Prestasi Kaderisasi (IPK)</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{ipKader}</td></tr>
                    </tbody>
                  </table>

                  {catatanKeaktifan && (
                    <div style={{ marginTop: '20px' }}>
                      <strong style={{ fontSize: '11pt' }}>Catatan Evaluasi Pendamping:</strong>
                      <p style={{ marginTop: '5px', fontSize: '11pt', fontStyle: 'italic' }}>"{catatanKeaktifan}"</p>
                    </div>
                  )}
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
