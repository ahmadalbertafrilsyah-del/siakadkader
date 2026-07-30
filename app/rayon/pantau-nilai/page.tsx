'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDocs, query, where, addDoc, updateDoc } from 'firebase/firestore';
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
    formData.append("file", file);
    formData.append("upload_preset", "siakad_upload"); 
    const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/${resourceType}/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon",
        aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
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
  const totalBobotTersimpan = kategoriBobotAktif.reduce((sum: number, k: any) => sum + k.persen, 0);
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
      <tr key={materi.kode}>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{index + 1}</td><td style={{ padding: '6px 10px', textAlign: 'left' }}>{materi.kode}</td>
        <td style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td><td style={{ padding: '6px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: '#004a87' }}>{displayAngka}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#555' }}>{nilaiHuruf}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>{sksKaliNilai > 0 ? sksKaliNilai.toFixed(2) : 0}</td>
      </tr>
    );
  });
  
  const ipKader = totalSks > 0 ? parseFloat((totalBobotNilai / totalSks).toFixed(2)) : 0;

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

      <div className="web-ui-container" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        
        <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Raport & Penilaian Peserta Kaderisasi</h3>
          <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Kelola nilai, bobot matriks, dan cetak Kartu Hasil Studi kader Rayon.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader:</span>
            <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
              {dataKader.length === 0 && <option value="">Belum ada kader terdaftar</option>}
              {dataKader.map(k => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
            </select>
            
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginLeft: '5px' }}>Jenjang:</span>
            <select value={selectedJenjangNilai} onChange={(e) => setSelectedJenjangNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#1e824c' }}>
              <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="NONFORMAL">Non-Formal</option>
            </select>

            {tabRaportAdmin === 'raport' && selectedKaderNilai && (
              <button onClick={() => window.print()} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', fontSize: '0.85rem' }}>🖨️ Cetak KHS</button>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '0px', flexWrap: 'wrap' }}>
          <button onClick={() => setTabRaportAdmin('raport')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'raport' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'raport' ? '#fff' : 'transparent', color: tabRaportAdmin === 'raport' ? '#555' : '#0000af', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>Raport Kaderisasi</button>
          <button onClick={() => setTabRaportAdmin('persentase')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'persentase' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'persentase' ? '#fff' : 'transparent', color: tabRaportAdmin === 'persentase' ? '#555' : '#0000af', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>Persentase & Nilai Detail</button>
          <button onClick={() => setTabRaportAdmin('pengaturan')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'pengaturan' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'pengaturan' ? '#fff' : 'transparent', color: tabRaportAdmin === 'pengaturan' ? '#555' : '#e67e22', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', marginLeft: 'auto', fontSize: '0.85rem' }}>⚙️ Pengaturan Cetak</button>
        </div>

        {tabRaportAdmin === 'raport' && (
          <div style={{ width: '100%', overflowX: 'auto', padding: '15px 0 0px 0' }}>
            <table className="tabel-utama" style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>No</th><th style={{ width: '12%', textAlign: 'center' }}>Kode</th><th style={{ width: '53%', textAlign: 'center' }}>Nama Materi</th>
                  <th style={{ width: '8%' }}>SKS</th><th style={{ width: '8%' }}>Angka</th><th style={{ width: '8%' }}>Nilai Huruf</th><th style={{ width: '8%' }}>SKS x Nilai</th>
                </tr>
              </thead>
              <tbody>
                {materiAktif.length === 0 ? (<tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur.</td></tr>) : barisRaportRender}
                <tr style={{ borderTop: '2px solid #ccc' }}><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td><td colSpan={2}></td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                <tr style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}><td colSpan={6} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>IPK (Indeks Prestasi Kader)</td><td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>{ipKader}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {tabRaportAdmin === 'persentase' && (
          <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
            <div style={{ marginBottom: '15px', background: '#fdfdfd', padding: '15px', borderRadius: '6px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#1e824c', fontSize: '0.9rem' }}>⚙️ Kategori & Bobot Penilaian ({selectedJenjangNilai})</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {(kategoriBobotGlobal[selectedJenjangNilai] || []).map((kat: any) => (
                    <div key={kat.id} style={{ backgroundColor: '#eaf4fc', padding: '5px 10px', borderRadius: '20px', border: '1px solid #3498db', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{kat.nama}: {kat.persen}%</span>
                      <button type="button" onClick={async () => {
                          if(!window.confirm("Hapus kategori bobot ini?")) return;
                          const newBobot = (kategoriBobotGlobal[selectedJenjangNilai] || []).filter((item: any) => item.id !== kat.id);
                          await setDoc(doc(db, "pengaturan_rayon", adminRayonId), { bobot_penilaian: { ...kategoriBobotGlobal, [selectedJenjangNilai]: newBobot } }, { merge: true });
                      }} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: 'bold', color: totalBobotTersimpan === 100 ? '#27ae60' : '#e67e22' }}>
                  Total Bobot: {totalBobotTersimpan}% / 100%
                  {totalBobotTersimpan < 100 && <span style={{ fontStyle: 'italic', marginLeft: '5px', color: '#e74c3c' }}>(Harap lengkapi hingga 100%)</span>}
                </div>
              </div>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  if(totalBobotTersimpan + formKategori.persen > 100) return alert("Total bobot melebihi 100%!");
                  setIsSavingEvaluasi(true);
                  try {
                    const newBobot = [...(kategoriBobotGlobal[selectedJenjangNilai] || []), { id: Date.now().toString(), nama: formKategori.nama, persen: formKategori.persen }];
                    await setDoc(doc(db, "pengaturan_rayon", adminRayonId), { bobot_penilaian: { ...kategoriBobotGlobal, [selectedJenjangNilai]: newBobot } }, { merge: true });
                    setFormKategori({ nama: '', persen: 0 });
                  } catch (error) {} finally { setIsSavingEvaluasi(false); }
              }} style={{ display: 'flex', gap: '8px' }}>
                <input type="text" required placeholder="Nama Kategori" value={formKategori.nama} onChange={e => setFormKategori({...formKategori, nama: e.target.value})} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', width: '120px' }} />
                <input type="number" required placeholder="Bobot %" value={formKategori.persen || ''} onChange={e => setFormKategori({...formKategori, persen: Number(e.target.value)})} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', width: '80px' }} />
                <button type="submit" disabled={isSavingEvaluasi || totalBobotTersimpan >= 100} style={{ background: totalBobotTersimpan >= 100 ? '#ccc' : '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: totalBobotTersimpan >= 100 ? 'not-allowed' : 'pointer' }}>➕</button>
              </form>
            </div>

            <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem', backgroundColor: '#fff' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '3%', textAlign: 'center' }}>No</th><th rowSpan={2} style={{ width: '10%', textAlign: 'center' }}>Kode</th><th rowSpan={2} style={{ width: '25%', textAlign: 'center' }}>Nama Materi</th>
                  {(kategoriBobotGlobal[selectedJenjangNilai] || []).length > 0 && <th colSpan={(kategoriBobotGlobal[selectedJenjangNilai] || []).length} style={{ borderBottom: '1px solid #ddd', textAlign: 'center', backgroundColor: '#f0fbf4' }}>Input Nilai Detail (0-100)</th>}
                  <th rowSpan={2} style={{ width: '5%', textAlign: 'center' }}>SKS</th><th colSpan={2} style={{ borderBottom: '1px solid #ddd', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Hasil Akhir</th>
                </tr>
                <tr>
                  {(kategoriBobotGlobal[selectedJenjangNilai] || []).map((kat: any) => <th key={kat.id} style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#1e824c', backgroundColor: '#f0fbf4' }}>{kat.nama} <br/><span style={{color: '#e74c3c'}}>{kat.persen}%</span></th>)}
                  <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Angka</th><th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Huruf</th>
                </tr>
              </thead>
              <tbody>
                {materiAktif.length === 0 ? (
                  <tr><td colSpan={6 + (kategoriBobotGlobal[selectedJenjangNilai] || []).length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi.</td></tr>
                ) : (
                  materiAktif.map((materi, index) => {
                    let angkaAkhir = 0;
                    (kategoriBobotGlobal[selectedJenjangNilai] || []).forEach((kat: any) => {
                        const score = nilaiMentah[materi.kode]?.[kat.nama] || 0;
                        angkaAkhir += (score * (kat.persen / 100));
                    });
                    const hurufAkhir = getNilaiHuruf(angkaAkhir);
                    const displayAngka = angkaAkhir > 0 ? parseFloat(angkaAkhir.toFixed(2)) : '-';

                    return (
                      <tr key={`rinci-${materi.kode}`}>
                        <td>{index + 1}</td><td style={{ textAlign: 'left' }}>{materi.kode}</td><td style={{ textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
                        {(kategoriBobotGlobal[selectedJenjangNilai] || []).map((kat: any) => (
                          <td key={kat.id} style={{ backgroundColor: '#fcfcfc' }}>
                            <input type="number" min="0" max="100" placeholder="0"
                              value={nilaiMentah[materi.kode]?.[kat.nama] === 0 ? '' : (nilaiMentah[materi.kode]?.[kat.nama] || '')}
                              onChange={(e) => {
                                  let valNum = Number(e.target.value); if (valNum > 100) valNum = 100; if (valNum < 0) valNum = 0;
                                  setNilaiMentah({ ...nilaiMentah, [materi.kode]: { ...(nilaiMentah[materi.kode] || {}), [kat.nama]: valNum } });
                              }} 
                              onBlur={async () => {
                                  if (!selectedKaderNilai) return;
                                  try {
                                    const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                                    const jenjangData = currentEvaluasi[selectedJenjangNilai] || { nilai_mentah: {}, catatan: evaluasiKader.catatan };
                                    await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, nilai_mentah: nilaiMentah } }, { merge: true });
                                    await setDoc(doc(db, "nilai_khs", selectedKaderNilai), { [materi.kode]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: "Admin Rayon" }, { merge: true });
                                  } catch (error) {}
                              }} 
                              style={{ width: '50px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', outline: 'none' }} />
                          </td>
                        ))}
                        <td>{materi.bobot}</td>
                        <td style={{ fontWeight: 'bold', color: '#004a87', backgroundColor: '#f4f9fd' }}>{displayAngka}</td>
                        <td style={{ fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#f4f9fd', fontSize: '1rem' }}>{hurufAkhir}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Catatan Evaluasi Kader:</label>
              <textarea value={evaluasiKader.catatan} onChange={async e => {
                  setEvaluasiKader({ ...evaluasiKader, catatan: e.target.value });
                  try {
                    const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                    const jenjangData = currentEvaluasi[selectedJenjangNilai] || { nilai_mentah: {}, catatan: '' };
                    await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, catatan: e.target.value } }, { merge: true });
                  } catch (error) {}
              }} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', height: '60px', resize: 'vertical', fontSize: '0.85rem', outline: 'none' }} placeholder="Tulis catatan perkembangan kader disini..." />
            </div>
          </div>
        )}

        {/* TAB 3: PENGATURAN CETAK */}
        {tabRaportAdmin === 'pengaturan' && (
          <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '4px', padding: '20px', marginTop: '15px' }}>
            <form onSubmit={async (e) => {
                e.preventDefault(); setIsSavingPengaturan(true);
                try {
                  let newKop = pengaturanCetak.kopSuratUrl;
                  if (fileKop) newKop = await uploadToCloudinary(fileKop);
                  await updateDoc(doc(db, "users", adminRayonId), { kopSuratUrl: newKop });
                  catatLogAktivitas("Menyimpan pengaturan KOP Cetak Surat.");
                  alert("Pengaturan Kop berhasil disimpan!"); setFileKop(null);
                } catch (error) {} finally { setIsSavingPengaturan(false); }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
              <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px', borderLeft: '4px solid #f1c40f', fontSize: '0.8rem', color: '#856404', lineHeight: '1.4' }}><b>PENTING:</b> Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan TANDA TANGAN di bagian bawah. Gambar ini akan menjadi background pada saat cetak PDF.</div>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#333', fontSize: '0.85rem' }}>Upload Template Background A4 Rayon</label>
                {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '10px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px' }} />}
                <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #ccc', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
              </div>
              <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
            </form>
          </div>
        )}
      </div>

      {/* TAMPILAN KHUSUS CETAK PDF */}
      <div className="print-layout-container">
        {pengaturanCetak.kopSuratUrl && (<div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>)}
        <table className="master-print-table">
          <thead><tr><td><div className="header-space"></div></td></tr></thead>
          <tbody>
            <tr>
              <td>
                <div className="print-content-area">
                  {tabRaportAdmin === 'raport' && selectedKaderNilai && (
                    <>
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI</h3>
                      <table className="tabel-biodata">
                        <tbody>
                          <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak.nim || '...........................'}</td></tr>
                          <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak.nama || '...........................'}</td></tr>
                          <tr><td>Pelaksana</td><td>:</td><td>{namaRayonAsli}</td></tr>
                          <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak.angkatan || (kaderDicetak.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................')}</td></tr>
                          <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{selectedJenjangNilai}</td></tr>
                        </tbody>
                      </table>
                      <table className="tabel-utama">
                        <thead><tr><th>No</th><th>Kode</th><th>Nama Materi</th><th>SKS</th><th>Angka</th><th>Nilai Huruf</th><th>SKS x Nilai</th></tr></thead>
                        <tbody>
                          {materiAktif.length === 0 ? (<tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center' }}>Kurikulum belum diatur oleh Pengurus.</td></tr>) : barisRaportRender}
                          <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalSks}</td><td colSpan={2}></td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalBobotNilai > 0 ? totalBobotNilai.toFixed(2) : 0}</td></tr>
                          <tr><td colSpan={6} style={{ textAlign: 'center', fontWeight: 'bold' }}>IPK (Indeks Prestasi Kaderisasi)</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{ipKader}</td></tr>
                        </tbody>
                      </table>
                    </>
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