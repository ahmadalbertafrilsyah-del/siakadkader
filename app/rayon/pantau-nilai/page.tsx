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
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#aaa' }}>{nilaiHuruf}</td>
        <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{sksKaliNilai > 0 ? sksKaliNilai.toFixed(2) : '-'}</td>
      </tr>
    );
  });
  
  const ipKader = totalSks > 0 ? parseFloat((totalBobotNilai / totalSks).toFixed(2)) : 0;

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
           padding: 8px 12px; border-radius: 6px; border: none; background: transparent; color: #777; font-weight: bold; font-size: 0.75rem; cursor: pointer; transition: all 0.3s;
        }
        .modern-tab.active {
           background-color: #fff; color: #0000af; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        /* CETAK PDF DENGAN BACKGROUND KOP */
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html, .app-container, main, .main-content, .mobile-content-wrapper, .mobile-padded { 
            background-color: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; display: block !important; position: static !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
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
        
        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
    
          {/* Group Pilih Kader */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 220px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>Pilih Kader:</span>
            <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: '8px', outline: 'none', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', width: '100%' }}>
              {dataKader.length === 0 && <option value="">Belum ada kader</option>}
              {dataKader.map(k => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
            </select>
          </div>

          {/* Group Jenjang */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 180px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>Jenjang:</span>
            <select value={selectedJenjangNilai} onChange={(e) => setSelectedJenjangNilai(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: '8px', outline: 'none', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: '#0000af', width: '100%' }}>
              <option value="MAPABA">MAPABA</option>
              <option value="PKD">PKD</option>
              <option value="SIG">SIG</option>
              <option value="SKP">SKP</option>
              <option value="NONFORMAL">Non-Formal</option>
            </select>
          </div>
          
          {/* Tombol Cetak KHS */}
          {tabRaportAdmin === 'raport' && selectedKaderNilai && (
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={() => window.print()} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', boxShadow: '0 2px 5px rgba(0,0,175,0.1)' }}>
                🖨️ Cetak KHS
              </button>
            </div>
          )}
        </div>
      </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', padding: '15px', minHeight: '50vh' }}>
          
          <div className="modern-tab-container hide-scroll">
             <button onClick={() => setTabRaportAdmin('raport')} className={`modern-tab ${tabRaportAdmin === 'raport' ? 'active' : ''}`}>Kartu Hasil Studi</button>
             <button onClick={() => setTabRaportAdmin('persentase')} className={`modern-tab ${tabRaportAdmin === 'persentase' ? 'active' : ''}`}>Rincian & Bobot Nilai</button>
             <button onClick={() => setTabRaportAdmin('pengaturan')} className={`modern-tab ${tabRaportAdmin === 'pengaturan' ? 'active' : ''}`} style={{ color: tabRaportAdmin === 'pengaturan' ? '#e67e22' : '#777' }}>KOP Cetak</button>
          </div>

          {tabRaportAdmin === 'raport' && (
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f4f8', color: '#555' }}>
                    <th style={{ padding: '12px 10px', borderRadius: '8px 0 0 8px', textAlign: 'center' }}>No</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Kode</th><th style={{ padding: '12px 10px' }}>Materi Kurikulum</th><th style={{ padding: '12px 10px', textAlign: 'center' }}>SKS</th><th style={{ padding: '12px 10px', textAlign: 'center' }}>Nilai</th>
                    <th style={{ padding: '12px 10px', borderRadius: '0 8px 8px 0', textAlign: 'center' }}>SKS x Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Materi kurikulum jenjang ini belum tersedia.</td></tr>) : barisRaportRender}
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
            <div>
              <div style={{ marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '0.85rem' }}>📌 Pengaturan Bobot Penilaian ({selectedJenjangNilai})</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                  {(kategoriBobotGlobal[selectedJenjangNilai] || []).length === 0 ? <span style={{ fontSize: '0.75rem', color: '#e74c3c' }}>Belum ada kategori bobot.</span> : 
                    (kategoriBobotGlobal[selectedJenjangNilai] || []).map((kat: any) => (
                      <div key={kat.id} style={{ backgroundColor: '#fff', padding: '5px 12px', borderRadius: '20px', border: '1px solid #3498db', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{kat.nama}: {kat.persen}%</span>
                        <button type="button" onClick={async () => {
                            if(!window.confirm("Hapus kategori bobot ini?")) return;
                            const docRef = doc(db, "pengaturan_rayon", adminRayonId);
                            const newBobot = (kategoriBobotGlobal[selectedJenjangNilai] || []).filter((item: any) => item.id !== kat.id);
                            await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, [selectedJenjangNilai]: newBobot } }, { merge: true });
                        }} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>×</button>
                      </div>
                    ))
                  }
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
                }} style={{ display: 'flex', gap: '8px', maxWidth: '400px', flexWrap: 'wrap' }}>
                  <input type="text" required placeholder="Nama Kategori (Cth: UTS)" value={formKategori.nama} onChange={e => setFormKategori({...formKategori, nama: e.target.value})} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.8rem', flex: 1 }} />
                  <input type="number" required placeholder="Bobot %" value={formKategori.persen || ''} onChange={e => setFormKategori({...formKategori, persen: Number(e.target.value)})} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.8rem', width: '80px' }} />
                  <button type="submit" disabled={isSavingEvaluasi || (kategoriBobotGlobal[selectedJenjangNilai] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>➕ Tambah</button>
                </form>
              </div>

              {/* Wrapper scroll khusus untuk tabel saja agar bagian atas tidak ikut bergeser */}
              <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', overflowY: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '800px', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555', borderRadius: '8px 0 0 0' }}>No</th>
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555' }}>Kode</th>
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555', textAlign: 'left' }}>Nama Materi</th>
                      {kategoriBobotAktif.length > 0 && <th colSpan={kategoriBobotAktif.length} style={{ padding: '8px', backgroundColor: '#e8f5e9', color: '#27ae60', borderBottom: '1px solid #fff' }}>Nilai Mentah (0-100)</th>}
                      <th rowSpan={2} style={{ padding: '8px', backgroundColor: '#f0f4f8', color: '#555' }}>SKS</th>
                      <th colSpan={2} style={{ padding: '8px', backgroundColor: '#eaf4fc', color: '#004a87', borderRadius: '0 8px 0 0', borderBottom: '1px solid #fff' }}>Hasil Akhir</th>
                    </tr>
                    <tr>
                      {kategoriBobotAktif.map((kat: any) => <th key={kat.id} style={{ padding: '6px', backgroundColor: '#e8f5e9', color: '#1e824c', fontSize: '0.7rem' }}>{kat.nama} ({kat.persen}%)</th>)}
                      <th style={{ padding: '6px', backgroundColor: '#eaf4fc', color: '#004a87', fontSize: '0.7rem' }}>Angka</th>
                      <th style={{ padding: '6px', backgroundColor: '#eaf4fc', color: '#004a87', fontSize: '0.7rem' }}>Huruf</th>
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
                                    style={{ width: '60px', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', textAlign: 'center', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }} />
                              </td>
                            ))}
                            <td style={{ padding: '10px' }}>{materi.bobot}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#004a87', backgroundColor: '#fcfcfc' }}>{displayAngka}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#fcfcfc', fontSize: '0.9rem' }}>{hurufAkhir}</td>
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
                      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { nilai_mentah: {}, catatan: '' };
                      await setDoc(docRef, { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, catatan: e.target.value } }, { merge: true });
                    } catch (error) {}
                }} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} placeholder="Tulis catatan perkembangan kader disini..." rows={3} />
              </div>
            </div>
          )}

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
              }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px' }}>
                <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #f1c40f', fontSize: '0.8rem', color: '#856404', lineHeight: '1.5' }}>Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan Header berupa Trilogi PMII di bagian bawah. Gambar ini akan menjadi background pada saat cetak PDF.</div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#333', fontSize: '0.85rem' }}>Upload Template Background A4</label>
                  {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '15px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px', borderRadius: '8px' }} />}
                  <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '12px', border: '2px dashed #3498db', borderRadius: '8px', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                </div>
                <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.85rem', width: '200px' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
              </form>
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
    </>
  );
}