'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDocs, query, where, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PagePantauNilaiRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');
  
  const [dataKader, setDataKader] = useState<any[]>([]);
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({});
  const [kategoriBobotGlobal, setKategoriBobotGlobal] = useState<Record<string, any[]>>({});
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });

  const [selectedKaderNilai, setSelectedKaderNilai] = useState('');
  const [selectedJenjangNilai, setSelectedJenjangNilai] = useState('MAPABA');
  const [tabRaportAdmin, setTabRaportAdmin] = useState('raport'); 
  
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 
  const [evaluasiKader, setEvaluasiKader] = useState<{ catatan: string }>({ catatan: '' });
  const [nilaiMentah, setNilaiMentah] = useState<Record<string, Record<string, number>>>({});
  
  const [formKategori, setFormKategori] = useState({ nama: '', persen: 0 });
  const [isSavingEvaluasi, setIsSavingEvaluasi] = useState(false);

  const [fileKop, setFileKop] = useState<File | null>(null);
  const [isSavingPengaturan, setIsSavingPengaturan] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            
            onSnapshot(doc(db, "users", currentRayonId), (rayonSnap: any) => {
              if (rayonSnap.exists()) {
                const rData = rayonSnap.data();
                setNamaRayonAsli(rData.nama || currentRayonId);
                setPengaturanCetak({ kopSuratUrl: rData.kopSuratUrl || '', footerUrl: rData.footerUrl || '' });
              }
            });

            onSnapshot(doc(db, "pengaturan_rayon", currentRayonId), (docSnap: any) => {
              if (docSnap.exists()) setKategoriBobotGlobal(docSnap.data().bobot_penilaian || {});
            });

            onSnapshot(doc(db, "kurikulum_rayon", currentRayonId), (docSnap: any) => {
              if (docSnap.exists()) setListKurikulum(docSnap.data());
            });

            onSnapshot(query(collection(db, "users"), where("role", "==", "kader")), (snap: any) => {
              const list: any[] = [];
              snap.docs.forEach((doc: any) => {
                 const data = doc.data();
                 const terdaftarDi = data.terdaftar_di || [data.id_rayon];
                 if (terdaftarDi.includes(currentRayonId)) list.push({ id: doc.id, ...data });
              });
              setDataKader(list);
              if (list.length > 0 && !selectedKaderNilai) setSelectedKaderNilai(list[0].nim);
            });
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, [selectedKaderNilai]);

  useEffect(() => {
    if (!selectedKaderNilai) return;
    const unsubscribeNilai = onSnapshot(doc(db, "nilai_khs", selectedKaderNilai), (docSnap: any) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data()); else setNilaiKaderRealtime({});
    });
    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", selectedKaderNilai), (docSnap: any) => {
      if (docSnap.exists() && docSnap.data()[selectedJenjangNilai]) {
        const data = docSnap.data()[selectedJenjangNilai];
        setNilaiMentah(data.nilai_mentah || {}); setEvaluasiKader({ catatan: data.catatan || '' });
      } else {
        setNilaiMentah({}); setEvaluasiKader({ catatan: '' });
      }
    });
    return () => { unsubscribeNilai(); unsubscribeKeaktifan(); };
  }, [selectedKaderNilai, selectedJenjangNilai]);

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file); formData.append("upload_preset", "siakad_upload"); 
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/image/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };

  const handleInputNilaiMentah = (kodeMateri: string, namaKategori: string, value: string) => {
    let valNum = Number(value); if (valNum > 100) valNum = 100; if (valNum < 0) valNum = 0;
    setNilaiMentah({ ...nilaiMentah, [kodeMateri]: { ...(nilaiMentah[kodeMateri] || {}), [namaKategori]: valNum } });
  };

  const handleAutoSaveNilaiDetail = async (kodeMateri: string) => {
    if (!selectedKaderNilai) return;
    try {
      const docRef = doc(db, "evaluasi_kader", selectedKaderNilai);
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { nilai_mentah: {}, catatan: evaluasiKader.catatan };
      await setDoc(docRef, { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, nilai_mentah: nilaiMentah } }, { merge: true });

      let angkaAkhir = 0;
      (kategoriBobotGlobal[selectedJenjangNilai] || []).forEach((kat: any) => { const score = nilaiMentah[kodeMateri]?.[kat.nama] || 0; angkaAkhir += (score * (kat.persen / 100)); });
      const hurufAkhir = getNilaiHuruf(angkaAkhir);
      await setDoc(doc(db, "nilai_khs", selectedKaderNilai), { [kodeMateri]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: "Admin Rayon" }, { merge: true });
    } catch (error) {}
  };

  const materiAktif = listKurikulum[selectedJenjangNilai] || [];
  const kategoriBobotAktif = kategoriBobotGlobal[selectedJenjangNilai] || [];
  const kaderDicetak = dataKader.find(k => k.nim === selectedKaderNilai) || {};

  let totalSks = 0; let totalBobotNilai = 0;
  
  const barisRaportRender = materiAktif.map((materi, index) => {
    let nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
    let angkaAkhir = 0;
    const mentah = nilaiMentah[materi.kode];
    
    if (mentah && Object.keys(mentah).length > 0 && kategoriBobotAktif.length > 0) {
      kategoriBobotAktif.forEach((kat: any) => { angkaAkhir += (mentah[kat.nama] || 0) * (kat.persen / 100); });
      nilaiHuruf = getNilaiHuruf(angkaAkhir);
    }

    const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';
    const angkaSkala4 = angkaAkhir > 0 ? (angkaAkhir / 25) : 0; 
    const sksKaliNilai = (materi.bobot || 0) * angkaSkala4;
    totalSks += (materi.bobot || 0); 
    if (angkaAkhir > 0) totalBobotNilai += sksKaliNilai;
    
    return (
      <tr key={materi.kode} style={{ borderBottom: '1px solid #eee' }}>
        <td style={{ padding: '12px 10px', textAlign: 'center' }}>{index + 1}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold' }}>{materi.kode}</td>
        <td style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: '#004a87' }}>{displayAngka}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#e74c3c' }}>{nilaiHuruf}</td>
        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold' }}>{sksKaliNilai > 0 ? sksKaliNilai.toFixed(2) : 0}</td>
      </tr>
    );
  });
  
  const ipKader = totalSks > 0 ? parseFloat((totalBobotNilai / totalSks).toFixed(2)) : 0;

  return (
    <div>
      <style>{`
        .desktop-view { display: flex; flex-direction: column; gap: 20px; }
        .mobile-view { display: none; }
        
        /* HIDE SCROLLBAR TRACK - MENCEGAH SCROLLBAR ABU-ABU MUNCUL */
        .hide-scroll::-webkit-scrollbar { display: none !important; }
        .hide-scroll { -ms-overflow-style: none !important; scrollbar-width: none !important; }

        .modern-tab-container {
           display: flex; background-color: #f0f2f5; padding: 6px; border-radius: 8px; width: fit-content; margin-bottom: 20px;
        }
        .modern-tab {
           padding: 10px 20px; border-radius: 6px; border: none; background: transparent; color: #777; font-weight: bold; font-size: 0.85rem; cursor: pointer; transition: all 0.3s; white-space: nowrap;
        }
        .modern-tab.active { background-color: #0000af; color: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }

        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: flex !important; flex-direction: column; gap: 15px; padding: 15px !important; }
           .modern-tab-container { width: 100%; overflow-x: auto; background-color: #fff; border: 1px solid #eaeaea; border-radius: 12px; padding: 6px; margin-bottom: 10px; }
        }

        /* PERBAIKAN CSS PRINT (KHS PDF) */
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background-color: white !important; margin: 0; padding: 0; height: auto !important; }
          .no-print, header, aside, .web-ui-container, .mobile-view, .desktop-view { display: none !important; }
          
          .print-layout-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; z-index: 9999 !important; background: white !important;}
          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; width: 210mm !important; height: 297mm !important; z-index: -10 !important; }
          .bg-kertas-a4 img { width: 100% !important; height: 100% !important; object-fit: fill !important; display: block !important; }
          
          table.master-print-table { width: 100% !important; border: none !important; margin: 0 !important; padding: 0 !important; background-color: transparent !important; border-collapse: collapse !important; }
          table.master-print-table > thead { display: table-header-group !important; }
          table.master-print-table > tfoot { display: table-footer-group !important; }
          table.master-print-table > tbody { display: table-row-group !important; }
          table.master-print-table td { border: none !important; padding: 0 !important; background-color: transparent !important; }
          
          .header-space { height: 40mm !important; } 
          .footer-space { height: 30mm !important; }
          .print-content-area { padding: 0 25mm !important; position: relative; z-index: 10; margin-top: 0 !important;}
          
          table.tabel-utama-print { width: 100% !important; border-collapse: collapse !important; margin-top: 15px !important; margin-bottom: 20px !important; font-size: 11pt !important; color: #000 !important; }
          table.tabel-utama-print th, table.tabel-utama-print td { border: 1px solid #000 !important; padding: 6px 8px !important; color: #000 !important; }
          table.tabel-utama-print th { background-color: #f0f0f0 !important; font-weight: bold !important; text-align: center !important; }
          .tabel-biodata td { border: none !important; padding: 3px 0 !important; font-size: 11pt !important; color: #000 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen { .print-layout-container { display: none !important; } }
      `}</style>

      {/* ========================================================= */}
      {/* DESKTOP VIEW                                              */}
      {/* ========================================================= */}
      <div className="desktop-view">
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
            <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Raport & Penilaian Peserta Kaderisasi</h3>
            <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Kelola nilai, bobot matriks, dan cetak Kartu Hasil Studi kader Rayon.</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader:</span>
              <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontWeight: 'bold', minWidth: '200px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                {dataKader.length === 0 && <option value="">Belum ada kader terdaftar</option>}
                {dataKader.map(k => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
              </select>
              
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginLeft: '10px' }}>Jenjang:</span>
              <select value={selectedJenjangNilai} onChange={(e) => setSelectedJenjangNilai(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #0000af', borderRadius: '6px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#0000af' }}>
                <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="NONFORMAL">Non-Formal</option>
              </select>

              {tabRaportAdmin === 'raport' && selectedKaderNilai && (
                <button onClick={() => window.print()} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>🖨️ Cetak KHS</button>
              )}
            </div>
          </div>
          
          <div className="modern-tab-container hide-scroll" style={{ overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap' }}>
             <button onClick={() => setTabRaportAdmin('raport')} className={`modern-tab ${tabRaportAdmin === 'raport' ? 'active' : ''}`}>Raport Kaderisasi</button>
             <button onClick={() => setTabRaportAdmin('persentase')} className={`modern-tab ${tabRaportAdmin === 'persentase' ? 'active' : ''}`}>Persentase & Nilai</button>
             <button onClick={() => setTabRaportAdmin('pengaturan')} className={`modern-tab ${tabRaportAdmin === 'pengaturan' ? 'active' : ''}`} style={{ color: tabRaportAdmin === 'pengaturan' ? '#e67e22' : '#777' }}>⚙️ KOP Cetak</button>
          </div>

          {/* TAB 1: RAPORT KADERISASI */}
          {tabRaportAdmin === 'raport' && (
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', border: '1px solid #eaeaea', borderRadius: '8px' }}>
              <table className="tabel-utama" style={{ minWidth: '600px' }}>
                <thead style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                  <tr><th style={{ width: '5%' }}>No</th><th style={{ width: '12%' }}>Kode</th><th style={{ width: '53%', textAlign: 'center' }}>Nama Materi Kurikulum</th><th style={{ width: '8%' }}>SKS</th><th style={{ width: '8%' }}>Angka</th><th style={{ width: '8%' }}>Nilai Huruf</th><th style={{ width: '8%' }}>SKS x Nilai</th></tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (<tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur.</td></tr>) : barisRaportRender}
                  <tr style={{ borderTop: '2px solid #ccc' }}><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', padding: '15px' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold', padding: '15px' }}>{totalSks}</td><td colSpan={2}></td><td style={{ textAlign: 'center', fontWeight: 'bold', padding: '15px' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                  <tr style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', backgroundColor: '#f9fbfd' }}>
                    <td colSpan={6} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', color: '#004a87' }}>IPK (Indeks Prestasi Kader)</td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: '#0000af' }}>{ipKader}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: PERSENTASE & NILAI */}
          {tabRaportAdmin === 'persentase' && (
            <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', padding: '10px 0' }}>
              <div style={{ marginBottom: '15px', background: '#fdfdfd', padding: '15px', borderRadius: '8px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#1e824c', fontSize: '0.9rem' }}>⚙️ Kategori & Bobot Penilaian ({selectedJenjangNilai})</h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {(kategoriBobotGlobal[selectedJenjangNilai] || []).map((kat: any) => (
                      <div key={kat.id} style={{ backgroundColor: '#eaf4fc', padding: '5px 12px', borderRadius: '20px', border: '1px solid #3498db', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{kat.nama}: {kat.persen}%</span>
                        <button type="button" onClick={async () => {
                            if(!window.confirm("Hapus kategori bobot ini?")) return;
                            const docRef = doc(db, "pengaturan_rayon", adminRayonId);
                            const newBobot = (kategoriBobotGlobal[selectedJenjangNilai] || []).filter((item: any) => item.id !== kat.id);
                            await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, [selectedJenjangNilai]: newBobot } }, { merge: true });
                        }} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const tBobot = (kategoriBobotGlobal[selectedJenjangNilai] || []).reduce((sum: number, k: any) => sum + k.persen, 0);
                    if(tBobot + formKategori.persen > 100) return alert("Total bobot tidak boleh melebihi 100%!");
                    setIsSavingEvaluasi(true);
                    try {
                      const docRef = doc(db, "pengaturan_rayon", adminRayonId);
                      const newBobot = [...(kategoriBobotGlobal[selectedJenjangNilai] || []), { id: Date.now().toString(), nama: formKategori.nama, persen: formKategori.persen }];
                      await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, [selectedJenjangNilai]: newBobot } }, { merge: true });
                      setFormKategori({ nama: '', persen: 0 });
                    } catch (error) {} finally { setIsSavingEvaluasi(false); }
                }} style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" required placeholder="Nama Kategori (Cth: UTS)" value={formKategori.nama} onChange={e => setFormKategori({...formKategori, nama: e.target.value})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', width: '150px' }} />
                  <input type="number" required placeholder="Bobot %" value={formKategori.persen || ''} onChange={e => setFormKategori({...formKategori, persen: Number(e.target.value)})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', width: '80px' }} />
                  <button type="submit" disabled={isSavingEvaluasi || (kategoriBobotGlobal[selectedJenjangNilai] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100} style={{ background: ((kategoriBobotGlobal[selectedJenjangNilai] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100) ? '#ccc' : '#28a745', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: ((kategoriBobotGlobal[selectedJenjangNilai] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>➕</button>
                </form>
              </div>

              <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', border: '1px solid #eaeaea', borderRadius: '8px' }}>
                <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px' }}>
                  <thead style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                    <tr>
                      <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>No</th>
                      <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>Kode</th>
                      <th rowSpan={2} style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>Nama Materi</th>
                      {(kategoriBobotGlobal[selectedJenjangNilai] || []).length > 0 && <th colSpan={(kategoriBobotGlobal[selectedJenjangNilai] || []).length} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.2)', textAlign: 'center', backgroundColor: '#1e824c' }}>Nilai Mentah (0-100)</th>}
                      <th rowSpan={2} style={{ padding: '10px', borderLeft: '1px solid rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>SKS</th>
                      <th colSpan={2} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.2)', textAlign: 'center', backgroundColor: '#004a87' }}>Hasil Akhir</th>
                    </tr>
                    <tr>
                      {(kategoriBobotGlobal[selectedJenjangNilai] || []).map((kat: any) => (
                        <th key={kat.id} style={{ fontSize: '0.75rem', textAlign: 'center', padding: '8px', backgroundColor: '#27ae60', borderRight: '1px solid rgba(255,255,255,0.2)' }}>{kat.nama} <br/><span style={{color: '#fff3cd'}}>{kat.persen}%</span></th>
                      ))}
                      <th style={{ fontSize: '0.75rem', padding: '8px', textAlign: 'center', backgroundColor: '#3498db', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Angka</th>
                      <th style={{ fontSize: '0.75rem', padding: '8px', textAlign: 'center', backgroundColor: '#3498db' }}>Huruf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiAktif.length === 0 ? (
                      <tr><td colSpan={6 + (kategoriBobotGlobal[selectedJenjangNilai] || []).length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi SKP.</td></tr>
                    ) : (
                      materiAktif.map((materi, index) => {
                        let angkaAkhir = 0;
                        (kategoriBobotGlobal[selectedJenjangNilai] || []).forEach((kat: any) => { const score = nilaiMentah[materi.kode]?.[kat.nama] || 0; angkaAkhir += (score * (kat.persen / 100)); });
                        const hurufAkhir = getNilaiHuruf(angkaAkhir); const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';

                        return (
                          <tr key={`rinci-${materi.kode}`}>
                            <td style={{ textAlign: 'center' }}>{index + 1}</td><td style={{ textAlign: 'center' }}>{materi.kode}</td><td style={{ textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
                            {(kategoriBobotGlobal[selectedJenjangNilai] || []).map((kat: any) => (
                              <td key={kat.id} style={{ backgroundColor: '#fafafa', textAlign: 'center' }}>
                                <input type="number" min="0" max="100" placeholder="0" value={nilaiMentah[materi.kode]?.[kat.nama] === 0 ? '' : (nilaiMentah[materi.kode]?.[kat.nama] || '')} 
                                  onChange={(e) => handleInputNilaiMentah(materi.kode, kat.nama, e.target.value)} 
                                  onBlur={() => handleAutoSaveNilaiDetail(materi.kode)} 
                                  style={{ width: '60px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none' }} />
                              </td>
                            ))}
                            <td style={{ textAlign: 'center' }}>{materi.bobot}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#004a87', backgroundColor: '#f4f9fd' }}>{displayAngka}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#e74c3c', backgroundColor: '#f4f9fd', fontSize: '1rem' }}>{hurufAkhir}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: '#333' }}>Catatan Evaluasi / Pesan Pendamping:</label>
                <textarea value={evaluasiKader.catatan} onChange={async e => {
                    setEvaluasiKader({ ...evaluasiKader, catatan: e.target.value });
                    try {
                      const docRef = doc(db, "evaluasi_kader", selectedKaderNilai);
                      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { nilai_mentah: {}, catatan: '' };
                      await setDoc(docRef, { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, catatan: e.target.value } }, { merge: true });
                    } catch (error) {}
                }} style={{ width: '100%', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', resize: 'vertical', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }} placeholder="Tulis catatan perkembangan kader disini..." rows={3} />
              </div>
            </div>
          )}

          {/* TAB 3: PENGATURAN CETAK */}
          {tabRaportAdmin === 'pengaturan' && (
            <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '8px', padding: '25px' }}>
              <form onSubmit={async (e) => {
                  e.preventDefault(); setIsSavingPengaturan(true);
                  try {
                    let newKop = pengaturanCetak.kopSuratUrl;
                    if (fileKop) newKop = await uploadToCloudinary(fileKop);
                    await setDoc(doc(db, "users", adminRayonId), { kopSuratUrl: newKop }, { merge: true });
                    catatLogAktivitas("Menyimpan pengaturan KOP Cetak Surat.");
                    alert("Pengaturan Kop Surat Rayon berhasil disimpan!"); setFileKop(null);
                  } catch (error) {} finally { setIsSavingPengaturan(false); }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px' }}>
                <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #f1c40f', fontSize: '0.85rem', color: '#856404', lineHeight: '1.5' }}><b>PENTING:</b> Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan TANDA TANGAN Pengurus di bagian bawah. Gambar ini akan menjadi background pada saat cetak PDF.</div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#333', fontSize: '0.9rem' }}>Upload Template Background A4 (Rayon)</label>
                  {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', marginBottom: '15px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px', borderRadius: '6px' }} />}
                  <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '12px', border: '2px dashed #3498db', borderRadius: '6px', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                </div>
                <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.9rem', width: '200px' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE VIEW (DENGAN TABEL HORIZONTAL SCROLL)              */}
      {/* ========================================================= */}
      <div className="mobile-view">
        
        {/* HEADER & FILTER SEJAJAR */}
        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', outline: 'none', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', boxSizing: 'border-box' }}>
              {dataKader.length === 0 && <option value="">Tidak ada kader</option>}
              {dataKader.map(k => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
            </select>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={selectedJenjangNilai} onChange={(e) => setSelectedJenjangNilai(e.target.value)} style={{ flex: 1, padding: '10px', border: '1px solid #0000af', borderRadius: '8px', outline: 'none', backgroundColor: '#f0f5ff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#0000af', boxSizing: 'border-box' }}>
                <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="NONFORMAL">Non-Formal</option>
              </select>

              {tabRaportAdmin === 'raport' && selectedKaderNilai && (
                <button onClick={() => window.print()} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', boxShadow: '0 2px 5px rgba(0,0,175,0.2)' }}>
                  🖨️ Cetak
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AREA KONTEN UTAMA */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', padding: '15px', minHeight: '50vh' }}>
          
          {/* TAB MENU SCROLL HORIZONTAL */}
          <div className="modern-tab-container hide-scroll" style={{ overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap' }}>
             <button onClick={() => setTabRaportAdmin('raport')} className={`modern-tab ${tabRaportAdmin === 'raport' ? 'active' : ''}`}>Raport KHS</button>
             <button onClick={() => setTabRaportAdmin('persentase')} className={`modern-tab ${tabRaportAdmin === 'persentase' ? 'active' : ''}`}>Rincian Nilai</button>
             <button onClick={() => setTabRaportAdmin('pengaturan')} className={`modern-tab ${tabRaportAdmin === 'pengaturan' ? 'active' : ''}`}>⚙️ KOP</button>
          </div>

          {/* ISI TAB MOBILE */}
          {tabRaportAdmin === 'raport' && (
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', borderRadius: '8px', border: '1px solid #eaeaea' }}>
              <table className="tabel-utama" style={{ minWidth: '700px', width: '100%' }}>
                <thead style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                  <tr>
                    <th style={{ width: '5%', textAlign: 'center', padding: '12px', color: '#fff' }}>No</th>
                    <th style={{ width: '12%', textAlign: 'center', padding: '12px', color: '#fff' }}>Kode</th>
                    <th style={{ width: '53%', textAlign: 'center', padding: '12px', color: '#fff' }}>Nama Materi Kurikulum</th>
                    <th style={{ width: '8%', textAlign: 'center', padding: '12px', color: '#fff' }}>SKS</th>
                    <th style={{ width: '8%', textAlign: 'center', padding: '12px', color: '#fff' }}>Angka</th>
                    <th style={{ width: '8%', textAlign: 'center', padding: '12px', color: '#fff' }}>Nilai</th>
                    <th style={{ width: '8%', textAlign: 'center', padding: '12px', color: '#fff' }}>SKS x Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Materi belum tersedia.</td></tr>) : barisRaportRender}
                  <tr style={{ borderTop: '2px dashed #ddd' }}>
                    <td colSpan={3} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>Total SKS</td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{totalSks}</td><td></td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td>
                  </tr>
                  <tr>
                    <td colSpan={6}>
                      <div style={{ backgroundColor: '#eaf4fc', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #cce5ff', marginTop: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: '#004a87', fontSize: '1rem' }}>Indeks Prestasi Kader (IPK)</span>
                        <span style={{ fontWeight: '900', color: '#0000af', fontSize: '1.5rem' }}>{ipKader}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {tabRaportAdmin === 'persentase' && (
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ marginBottom: '20px', background: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '0.85rem' }}>📌 Komposisi Penilaian</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {kategoriBobotAktif.length === 0 ? <span style={{ fontSize: '0.75rem', color: '#e74c3c' }}>Belum ada bobot. Atur di mode Desktop.</span> : 
                    kategoriBobotAktif.map((kat: any) => (
                      <div key={kat.id} style={{ backgroundColor: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.75rem', fontWeight: 'bold', color: '#555' }}>
                        {kat.nama}: <span style={{ color: '#27ae60' }}>{kat.persen}%</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', borderRadius: '8px', border: '1px solid #eaeaea' }}>
                <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '800px', width: '100%' }}>
                  <thead style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                    <tr>
                      <th rowSpan={2} style={{ padding: '8px', color: '#fff', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>No</th>
                      <th rowSpan={2} style={{ padding: '8px', color: '#fff', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>Kode</th>
                      <th rowSpan={2} style={{ padding: '8px', color: '#fff', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>Nama Materi</th>
                      {kategoriBobotAktif.length > 0 && <th colSpan={kategoriBobotAktif.length} style={{ padding: '8px', color: '#fff', backgroundColor: '#1e824c', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>Nilai Mentah (0-100)</th>}
                      <th rowSpan={2} style={{ padding: '8px', color: '#fff', borderLeft: '1px solid rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>SKS</th>
                      <th colSpan={2} style={{ padding: '8px', color: '#fff', backgroundColor: '#3498db', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>Hasil Akhir</th>
                    </tr>
                    <tr>
                      {kategoriBobotAktif.map((kat: any) => <th key={kat.id} style={{ padding: '6px', color: '#fff', backgroundColor: '#27ae60', fontSize: '0.7rem', borderRight: '1px solid rgba(255,255,255,0.2)' }}>{kat.nama}</th>)}
                      <th style={{ padding: '6px', color: '#fff', backgroundColor: '#2980b9', fontSize: '0.7rem', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Angka</th>
                      <th style={{ padding: '6px', color: '#fff', backgroundColor: '#2980b9', fontSize: '0.7rem' }}>Huruf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiAktif.length === 0 ? (
                      <tr><td colSpan={6 + kategoriBobotAktif.length} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Belum ada rincian nilai.</td></tr>
                    ) : (
                      materiAktif.map((materi, index) => {
                        let angkaAkhir = 0; const mentah = nilaiMentah[materi.kode] || {};
                        kategoriBobotAktif.forEach((kat: any) => { angkaAkhir += ((mentah[kat.nama] || 0) * (kat.persen / 100)); });
                        const hurufAkhir = getNilaiHuruf(angkaAkhir); const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';

                        return (
                          <tr key={`rinci-${materi.kode}`} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{index + 1}</td>
                            <td style={{ padding: '10px' }}>{materi.kode}</td>
                            <td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>{materi.nama}</td>
                            {kategoriBobotAktif.map((kat: any) => (
                              <td key={kat.id} style={{ backgroundColor: '#fafafa' }}>
                                 <input type="number" min="0" max="100" placeholder="0" value={nilaiMentah[materi.kode]?.[kat.nama] === 0 ? '' : (nilaiMentah[materi.kode]?.[kat.nama] || '')} 
                                    onChange={(e) => handleInputNilaiMentah(materi.kode, kat.nama, e.target.value)} 
                                    onBlur={() => handleAutoSaveNilaiDetail(materi.kode)} 
                                    style={{ width: '60px', padding: '8px', border: '1px solid #ccc', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                              </td>
                            ))}
                            <td style={{ padding: '10px' }}>{materi.bobot}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#004a87', backgroundColor: '#fcfcfc' }}>{displayAngka}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#e74c3c', backgroundColor: '#fcfcfc', fontSize: '0.9rem' }}>{hurufAkhir}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: '#333' }}>Catatan Evaluasi / Pesan Pendamping:</label>
                <textarea value={evaluasiKader.catatan} onChange={async e => {
                    setEvaluasiKader({ ...evaluasiKader, catatan: e.target.value });
                    try {
                      const docRef = doc(db, "evaluasi_kader", selectedKaderNilai);
                      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { nilai_mentah: {}, catatan: '' };
                      await setDoc(docRef, { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, catatan: e.target.value } }, { merge: true });
                    } catch (error) {}
                }} style={{ width: '100%', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', resize: 'vertical', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }} placeholder="Tulis catatan perkembangan kader disini..." rows={3} />
              </div>
            </div>
          )}

          {/* TAB 3: PENGATURAN CETAK */}
          {tabRaportAdmin === 'pengaturan' && (
            <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
              <form onSubmit={async (e) => {
                  e.preventDefault(); setIsSavingPengaturan(true);
                  try {
                    let newKop = pengaturanCetak.kopSuratUrl;
                    if (fileKop) newKop = await uploadToCloudinary(fileKop);
                    await setDoc(doc(db, "users", adminRayonId), { kopSuratUrl: newKop }, { merge: true });
                    catatLogAktivitas("Menyimpan pengaturan KOP Cetak Surat.");
                    alert("Pengaturan Kop Surat Rayon berhasil disimpan!"); setFileKop(null);
                  } catch (error) {} finally { setIsSavingPengaturan(false); }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #f1c40f', fontSize: '0.8rem', color: '#856404', lineHeight: '1.5' }}>Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan TANDA TANGAN Pengurus di bagian bawah. Gambar ini akan menjadi background pada saat cetak PDF.</div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#333', fontSize: '0.85rem' }}>Upload Template Background A4</label>
                  {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '15px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px', borderRadius: '8px' }} />}
                  <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '12px', border: '2px dashed #3498db', borderRadius: '8px', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                </div>
                <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
              </form>
            </div>
          )}
        </div>
        <div style={{ height: '80px' }}></div>
      </div>

      {/* PRINT CONTAINER KHUSUS CETAK A4 PDF (TEGAS & TIDAK TURUN KE BAWAH) */}
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
                      <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak.nim || '...........................'}</td></tr>
                      <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak.nama || '...........................'}</td></tr>
                      <tr><td>Pelaksana Instansi</td><td>:</td><td>{namaRayonAsli}</td></tr>
                      <tr><td>Tahun Angkatan</td><td>:</td><td>{kaderDicetak.angkatan || '...........................'}</td></tr>
                      <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{selectedJenjangNilai}</td></tr>
                    </tbody>
                  </table>
                  <table className="tabel-utama-print">
                    <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '15%' }}>Kode Materi</th><th style={{ width: '45%' }}>Nama Materi Kurikulum</th><th style={{ width: '10%' }}>SKS</th><th style={{ width: '10%' }}>Nilai Huruf</th><th style={{ width: '15%' }}>SKS x Nilai</th></tr></thead>
                    <tbody>
                      {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center' }}>Kurikulum belum diatur.</td></tr>) : barisRaportRender}
                      <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalSks}</td><td></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                      <tr><td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold' }}>Indeks Prestasi Kaderisasi (IPK)</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{ipKader}</td></tr>
                    </tbody>
                  </table>
                  
                  {evaluasiKader.catatan && (
                    <div style={{ marginTop: '20px' }}>
                      <strong style={{ fontSize: '11pt' }}>Catatan Evaluasi Pendamping:</strong>
                      <p style={{ marginTop: '5px', fontSize: '11pt', fontStyle: 'italic' }}>"{evaluasiKader.catatan}"</p>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td><div className="footer-space"></div></td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}