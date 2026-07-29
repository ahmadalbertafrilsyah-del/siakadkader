'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import * as XLSX from 'xlsx';

export default function PageManajemenAkunRayon() {
  const [adminRayonId, setAdminRayonId] = useState('');
  const [namaRayonAsli, setNamaRayonAsli] = useState('');

  const [dataPendamping, setDataPendamping] = useState<any[]>([]);
  const [dataKader, setDataKader] = useState<any[]>([]);
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  
  const [tabAkun, setTabAkun] = useState('kader'); 
  const [modeInputKader, setModeInputKader] = useState<'baru' | 'import'>('baru');

  // STATE DITAMBAHKAN: id_rayon dan nama_rayon_luar
  const [formKader, setFormKader] = useState({ 
    nim: '', nia: '', nama: '', password: '', 
    id_rayon: '', nama_rayon_luar: '', 
    pendamping_mapaba_id: [] as string[], 
    angkatan: new Date().getFullYear().toString() 
  });
  
  const [formPendamping, setFormPendamping] = useState({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState(''); 
  
  const [searchKader, setSearchKader] = useState('');
  const [filterJenjangKader, setFilterJenjangKader] = useState('');
  
  const [kaderPage, setKaderPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [editKaderModal, setEditKaderModal] = useState<any>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const currentRayonId = snapRole.docs[0].data().username;
            setAdminRayonId(currentRayonId);
            setNamaRayonAsli(snapRole.docs[0].data().nama || currentRayonId);

            // Fetch semua Rayon
            onSnapshot(query(collection(db, "users"), where("role", "==", "rayon")), (snap: any) => {
              setDataRayon(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
            });

            // Fetch Pendamping di Rayon ini
            onSnapshot(query(collection(db, "users"), where("role", "==", "pendamping"), where("id_rayon", "==", currentRayonId)), (snap: any) => {
              setDataPendamping(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
            });

            // Fetch Kader di Rayon ini
            onSnapshot(query(collection(db, "users"), where("role", "==", "kader")), (snap: any) => {
              const list: any[] = [];
              snap.docs.forEach((doc: any) => {
                 const data = doc.data();
                 const terdaftarDi = data.terdaftar_di || [data.id_rayon];
                 if (terdaftarDi.includes(currentRayonId)) { list.push({ id: doc.id, ...data }); }
              });
              setDataKader(list);
            });
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const getSecondaryAuth = () => { 
    const apps = getApps(); 
    const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(auth.app.options, 'SecondaryApp'); 
    return getAuth(secondaryApp); 
  };

  const getNamaRayon = (idRayon: string) => {
    if (idRayon === 'Komisariat' || idRayon === 'Pusat Komisariat') return 'Pusat Komisariat';
    const r = dataRayon.find((x: any) => x.username === idRayon || x.id_rayon === idRayon || x.id === idRayon);
    return r ? r.nama : idRayon;
  };

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon", aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  // --- FUNGSI PENDAMPING ---
  const handleBuatAkunPendamping = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeUsername = formPendamping.username.trim().replace(/\s+/g, '').toLowerCase();
      const emailBaru = `${safeUsername}@pmii-uinmalang.or.id`;
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formPendamping.password);
      await setDoc(doc(db, "users", safeUsername), { username: safeUsername, nama: formPendamping.nama, email: emailBaru, role: "pendamping", id_rayon: adminRayonId, jumlahBinaan: 0, status: "Aktif", jenjangTugas: formPendamping.jenjangTugas, createdAt: Date.now() });
      await signOutSecondary(secondaryAuth); 
      catatLogAktivitas(`Membuat akun pendamping: ${formPendamping.nama}`); 
      alert(`Sukses! Akun pendamping berhasil dibuat.`); 
      setFormPendamping({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' });
    } catch (error: any) { alert("Gagal. Pastikan username belum dipakai. Error: " + error.message); } finally { setIsSubmitting(false); }
  };

  // --- FUNGSI KADER ---
  const handleBuatAkunKader = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeNim = formKader.nim.trim();
      const qCek = query(collection(db, "users"), where("nim", "==", safeNim), where("role", "==", "kader"));
      const snapCek = await getDocs(qCek);

      // LOGIKA PENENTUAN NAMA ASAL RAYON FINAL
      let finalAsalRayon = formKader.id_rayon || adminRayonId;
      if (formKader.id_rayon === "Luar Komisariat" && formKader.nama_rayon_luar.trim() !== "") {
         finalAsalRayon = formKader.nama_rayon_luar.trim();
      }

      if (!snapCek.empty) {
         const existingDoc = snapCek.docs[0]; const existingData = existingDoc.data();
         const existingTerdaftar = existingData.terdaftar_di || [existingData.id_rayon];
         if (!existingTerdaftar.includes(adminRayonId)) existingTerdaftar.push(adminRayonId);
         const mergedPendamping = Array.from(new Set([...(existingData.pendamping_mapaba_id || []), ...formKader.pendamping_mapaba_id]));
         const riwayatUpdated = existingData.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false };
         await updateDoc(doc(db, "users", existingDoc.id), { jenjang: 'MAPABA', pendamping_mapaba_id: mergedPendamping, riwayat_kaderisasi: riwayatUpdated, terdaftar_di: existingTerdaftar });
         catatLogAktivitas(`Menarik akun kader lama ke Rayon: ${existingData.nama}`);
         alert(`Kader ditarik sukses ke Rayon ini!`);
      } else {
          const emailBaru = `${safeNim}@pmii-uinmalang.or.id`.toLowerCase();
          await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formKader.password);
          await setDoc(doc(db, "users", safeNim), { 
            nim: safeNim, nia: formKader.nia, nama: formKader.nama, email: emailBaru, 
            role: "kader", id_rayon: finalAsalRayon, jenjang: "MAPABA", 
            pendamping_mapaba_id: formKader.pendamping_mapaba_id, pendamping_pkd_id: [], pendamping_sig_id: [], pendamping_skp_id: [],
            riwayat_kaderisasi: { MAPABA: true, PKD: false, SIG: false, SKP: false },
            angkatan: formKader.angkatan, status: "Aktif", createdAt: Date.now(), terdaftar_di: Array.from(new Set([finalAsalRayon, adminRayonId]))
          });
          await signOutSecondary(secondaryAuth); catatLogAktivitas(`Membuat akun kader baru: ${formKader.nama}`); alert(`Sukses dibuat.`);
      }
      setFormKader({ nim: '', nia: '', nama: '', password: '', id_rayon: '', nama_rayon_luar: '', pendamping_mapaba_id: [], angkatan: new Date().getFullYear().toString() });
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{ "NIM": "", "NIA": "", "Nama": "", "Asal Rayon": "", "Jenjang": "MAPABA", "Angkatan": "", "TanggalLahir": "", "Pendamping": "" }];
    const worksheet = XLSX.utils.json_to_sheet(templateData); const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template_Kader");
    XLSX.writeFile(workbook, "Template_Import_Kader.xlsx");
  };

  const handleImportExcel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fileInput = (e.target as HTMLFormElement).elements[0] as HTMLInputElement; const file = fileInput?.files?.[0];
    if (!file) return alert("Pilih file!"); setIsSubmitting(true); setImportProgress("Membaca file Excel..."); const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' }); const wsname = wb.SheetNames[0]; const ws = wb.Sheets[wsname]; const data = XLSX.utils.sheet_to_json(ws); 
        if (data.length === 0) throw new Error("Kosong."); const secondaryAuth = getSecondaryAuth(); let successCount = 0; let errorCount = 0; let updateCount = 0;
        
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i]; 
          const nim = String(row['NIM'] || row['nim'] || '').trim(); const nia = String(row['NIA'] || row['nia'] || '').trim(); const nama = row['Nama'] || row['nama'] || ''; 
          const jenjangExcel = String(row['Jenjang'] || row['jenjang'] || 'MAPABA').trim().toUpperCase();
          const angkatan = String(row['Angkatan'] || row['angkatan'] || new Date().getFullYear()).trim(); 
          const tglLahir = String(row['TanggalLahir'] || row['tanggallahir'] || row['Password'] || '').trim(); 
          const asalRayonExcel = String(row['Asal Rayon'] || row['asal rayon'] || row['Rayon'] || '').trim();

          let fieldPendamping = 'pendamping_mapaba_id';
          if (jenjangExcel === 'PKD') fieldPendamping = 'pendamping_pkd_id'; else if (jenjangExcel === 'SIG') fieldPendamping = 'pendamping_sig_id'; else if (jenjangExcel === 'SKP') fieldPendamping = 'pendamping_skp_id';

          let pendampingInput = String(row['Pendamping'] || row['pendamping'] || '').trim(); let pendampingArray: string[] = [];
          if (pendampingInput) {
             const names = pendampingInput.split(',').map(n => n.trim());
             names.forEach(n => {
                 const matched = dataPendamping.find(p => p.nama.toLowerCase() === n.toLowerCase() || p.username.toLowerCase() === n.toLowerCase() || p.id.toLowerCase() === n.toLowerCase());
                 if (matched) pendampingArray.push(matched.username || matched.id); else pendampingArray.push(n); 
             });
          }

          let finalAsalRayonId = adminRayonId;
          if (asalRayonExcel) {
             const matchedRayon = dataRayon.find((r: any) => r.nama.toLowerCase() === asalRayonExcel.toLowerCase() || r.username.toLowerCase() === asalRayonExcel.toLowerCase() || r.id === asalRayonExcel);
             finalAsalRayonId = matchedRayon ? (matchedRayon.username || matchedRayon.id) : asalRayonExcel;
          }

          if (!nim || !nama || !tglLahir) { errorCount++; continue; }
          setImportProgress(`Memproses: ${nama} (${i + 1}/${data.length})`);
          
          const qCek = query(collection(db, "users"), where("nim", "==", nim), where("role", "==", "kader"));
          const snapCek = await getDocs(qCek);
          
          if (!snapCek.empty) {
             const existingDoc = snapCek.docs[0]; const existingData = existingDoc.data();
             const existingTerdaftar = existingData.terdaftar_di || [existingData.id_rayon];
             if (!existingTerdaftar.includes(adminRayonId)) existingTerdaftar.push(adminRayonId);

             const mergedPendamping = Array.from(new Set([...(existingData[fieldPendamping] || []), ...pendampingArray]));
             const riwayatUpdated = existingData.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false };
             if (jenjangExcel === 'PKD') riwayatUpdated.PKD = true; if (jenjangExcel === 'SIG') riwayatUpdated.SIG = true; if (jenjangExcel === 'SKP') riwayatUpdated.SKP = true;

             await updateDoc(doc(db, "users", existingDoc.id), { jenjang: jenjangExcel, [fieldPendamping]: mergedPendamping, riwayat_kaderisasi: riwayatUpdated, terdaftar_di: existingTerdaftar });
             updateCount++;
          } else {
             const emailBaru = `${nim}@pmii-uinmalang.or.id`.toLowerCase();
             try {
                await createUserWithEmailAndPassword(secondaryAuth, emailBaru, tglLahir);
                const riwayatBaru = { MAPABA: true, PKD: jenjangExcel === 'PKD', SIG: jenjangExcel === 'SIG', SKP: jenjangExcel === 'SKP' };
                await setDoc(doc(db, "users", nim), { 
                  nim: nim, nia: nia, nama: nama, email: emailBaru, role: "kader", id_rayon: finalAsalRayonId, jenjang: jenjangExcel, 
                  pendamping_mapaba_id: jenjangExcel === 'MAPABA' ? pendampingArray : [], pendamping_pkd_id: jenjangExcel === 'PKD' ? pendampingArray : [], 
                  pendamping_sig_id: jenjangExcel === 'SIG' ? pendampingArray : [], pendamping_skp_id: jenjangExcel === 'SKP' ? pendampingArray : [],
                  riwayat_kaderisasi: riwayatBaru, angkatan: angkatan, status: "Aktif", createdAt: Date.now(), terdaftar_di: Array.from(new Set([finalAsalRayonId, adminRayonId])) 
                }); 
                successCount++;
             } catch(err: any) { errorCount++; }
          }
        }
        await signOutSecondary(secondaryAuth); alert(`Selesai! Buat Baru: ${successCount}. Diupdate/Ditarik: ${updateCount}. Gagal: ${errorCount}`); fileInput.value = ''; 
      } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); setImportProgress(''); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSimpanEditKader = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const newNim = editKaderModal.nim.trim(); const docRef = doc(db, "users", editKaderModal.id);
      
      let asalRayonFix = editKaderModal.id_rayon;
      if (asalRayonFix && asalRayonFix.trim() !== '') {
         const inputVal = asalRayonFix.trim();
         const matchedRayon = dataRayon.find((r: any) => r.nama.toLowerCase() === inputVal.toLowerCase() || r.username.toLowerCase() === inputVal.toLowerCase() || r.id === inputVal);
         asalRayonFix = matchedRayon ? (matchedRayon.username || matchedRayon.id) : inputVal;
      }

      if (newNim !== editKaderModal.oldNim) {
        const oldKaderData = (await getDocs(query(collection(db, "users"), where("nim", "==", editKaderModal.oldNim)))).docs[0]?.data() || {};
        await setDoc(doc(db, "users", newNim), { 
          ...oldKaderData, nim: newNim, nama: editKaderModal.nama, nia: editKaderModal.nia, angkatan: editKaderModal.angkatan, tanggalLahir: editKaderModal.tanggalLahir, 
          id_rayon: asalRayonFix, jenjang: editKaderModal.jenjang, riwayat_kaderisasi: editKaderModal.riwayat_kaderisasi,
          pendamping_mapaba_id: editKaderModal.pendamping_mapaba_id, pendamping_pkd_id: editKaderModal.pendamping_pkd_id,
          pendamping_sig_id: editKaderModal.pendamping_sig_id, pendamping_skp_id: editKaderModal.pendamping_skp_id
        });
        await deleteDoc(docRef); alert("Data & NIM berhasil diperbarui!");
      } else {
        await updateDoc(docRef, { 
          nama: editKaderModal.nama, nia: editKaderModal.nia, angkatan: editKaderModal.angkatan, tanggalLahir: editKaderModal.tanggalLahir, 
          id_rayon: asalRayonFix, jenjang: editKaderModal.jenjang, riwayat_kaderisasi: editKaderModal.riwayat_kaderisasi,
          pendamping_mapaba_id: editKaderModal.pendamping_mapaba_id, pendamping_pkd_id: editKaderModal.pendamping_pkd_id,
          pendamping_sig_id: editKaderModal.pendamping_sig_id, pendamping_skp_id: editKaderModal.pendamping_skp_id
        });
        alert("Data berhasil diperbarui!");
      }
      setEditKaderModal(null);
    } catch (error) { alert("Terjadi kesalahan."); } finally { setIsSubmitting(false); }
  };

  const handleUbahStatusAkun = async (idAkun: string, statusSekarang: string) => { const statusBaru = statusSekarang === "Aktif" ? "Pasif" : "Aktif"; if (!window.confirm(`Ubah status ke ${statusBaru}?`)) return; try { await updateDoc(doc(db, "users", idAkun), { status: statusBaru }); } catch (error) {} };
  const handleHapusAkun = async (idAkun: string, nama: string) => { if (!window.confirm(`Hapus permanen akun pendamping "${nama}"?`)) return; try { await deleteDoc(doc(db, "users", idAkun)); alert(`Dihapus.`); } catch (error) {} };
  
  const handleHapusKaderTotal = async (kader: any) => {
    if(!window.confirm(`PERINGATAN KERAS!\nYakin ingin menghapus permanen akun "${kader.nama}"?`)) return;
    try {
      await deleteDoc(doc(db, "users", kader.id)); await deleteDoc(doc(db, "nilai_khs", kader.nim)); await deleteDoc(doc(db, "evaluasi_kader", kader.nim));
      if (kader.email) {
          const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", kader.email));
          const snapBerkas = await getDocs(qBerkas); snapBerkas.forEach(d => deleteDoc(d.ref));
      }
      const qTes = query(collection(db, "jawaban_tes"), where("nim", "==", kader.nim));
      const snapTes = await getDocs(qTes); snapTes.forEach(d => deleteDoc(d.ref));
      catatLogAktivitas(`Menghapus permanen akun kader: ${kader.nama}`);
      alert("Kader dihapus.");
    } catch (error) { alert("Gagal menghapus total."); }
  };

  const filteredKader = dataKader.filter((k: any) => 
    ((k.nama && k.nama.toLowerCase().includes(searchKader.toLowerCase())) || (k.nim && k.nim.includes(searchKader))) &&
    (filterJenjangKader === '' || k.jenjang === filterJenjangKader)
  );

  const indexOfLastKader = kaderPage * itemsPerPage;
  const indexOfFirstKader = indexOfLastKader - itemsPerPage;
  const currentKaderDisplay = filteredKader.slice(indexOfFirstKader, indexOfLastKader);

  return (
    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
        <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Manajemen Akun Rayon</h3>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <button onClick={() => setTabAkun('kader')} style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkun === 'kader' ? '#0000af' : '#f8f9fa', color: tabAkun === 'kader' ? 'white' : '#555', fontSize: '0.85rem', transition: '0.2s', border: 'none' }}>🎓 Kader Rayon</button>
        <button onClick={() => setTabAkun('pendamping')} style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkun === 'pendamping' ? '#0000af' : '#f8f9fa', color: tabAkun === 'pendamping' ? 'white' : '#555', fontSize: '0.85rem', transition: '0.2s', border: 'none' }}>👩 Pendamping Rayon</button>
      </div>

      {tabAkun === 'kader' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button type="button" onClick={() => setModeInputKader('baru')} style={{ flex: 1, padding: '10px 5px', fontSize: '0.75rem', fontWeight: 'bold', border: modeInputKader === 'baru' ? 'none' : '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: modeInputKader === 'baru' ? '#0000af' : '#fff', color: modeInputKader === 'baru' ? '#fff' : '#555', transition: '0.2s' }}>Buat Manual</button>
              <button type="button" onClick={() => setModeInputKader('import')} style={{ flex: 1, padding: '10px 5px', fontSize: '0.75rem', fontWeight: 'bold', border: modeInputKader === 'import' ? 'none' : '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: modeInputKader === 'import' ? '#2ecc71' : '#fff', color: modeInputKader === 'import' ? '#fff' : '#555', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><span style={{fontSize: '0.9rem'}}>📗</span> Import Data Excel</button>
            </div>

            {modeInputKader === 'baru' ? (
              <form onSubmit={handleBuatAkunKader} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'start' }}>
                <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: '#777', fontStyle: 'italic', marginBottom: '5px' }}>Jika NIM sudah ada di sistem UIN, akun akan otomatis ditarik ke dalam Rayon Anda.</div>
                <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>NIM Kader</label><input type="text" placeholder="NIM Kader" value={formKader.nim} onChange={e => setFormKader({...formKader, nim: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }} /></div>
                <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>NIA (Opsional)</label><input type="text" placeholder="Nomor Induk Anggota" value={formKader.nia} onChange={e => setFormKader({...formKader, nia: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }} /></div>
                <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Lengkap</label><input type="text" placeholder="Nama Lengkap" value={formKader.nama} onChange={e => setFormKader({...formKader, nama: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }} /></div>
                
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Asal Rayon</label>
                  <select value={formKader.id_rayon} onChange={e => setFormKader({...formKader, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }}>
                     <option value="" disabled>-- Pilih Asal Rayon --</option>
                     {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                     <option value="Luar Komisariat">Delegasi Luar Komisariat</option>
                  </select>
                  
                  {formKader.id_rayon === 'Luar Komisariat' && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold' }}>Ketik Nama Asal Rayon / Instansi Luar</label>
                      <input 
                        type="text" 
                        placeholder="Misal: PMII Rayon Brawijaya" 
                        value={formKader.nama_rayon_luar} 
                        onChange={e => setFormKader({...formKader, nama_rayon_luar: e.target.value})} 
                        required 
                        style={{ width: '100%', padding: '8px', border: '1px dashed #e67e22', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.8rem', outline: 'none', marginTop: '5px' }} 
                      />
                    </div>
                  )}
                </div>

                <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Tahun Angkatan</label><input type="number" placeholder="Angkatan (Cth: 2026)" value={formKader.angkatan} onChange={e => setFormKader({...formKader, angkatan: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }} /></div>
                
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Plot ke Pendamping MAPABA</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '6px', padding: '12px', backgroundColor: '#fafafa', marginTop: '5px' }}>
                    {dataPendamping.map(p => (
                      <label key={p.id} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.85rem', marginRight: '20px', marginBottom: '10px', cursor: 'pointer', color: '#333' }}>
                        <input type="checkbox" value={p.username} checked={formKader.pendamping_mapaba_id.includes(p.username)} onChange={(e) => { const val = e.target.value; if(e.target.checked) setFormKader(prev => ({...prev, pendamping_mapaba_id: [...prev.pendamping_mapaba_id, val]})); else setFormKader(prev => ({...prev, pendamping_mapaba_id: prev.pendamping_mapaba_id.filter(id => id !== val)})); }} style={{ marginRight: '8px', transform: 'scale(1.2)' }} />
                        {p.nama}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                   <div style={{ flex: 1 }}><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Password Login</label><input type="text" placeholder="Gunakan Tgl Lahir (DDMMYYYY)" value={formKader.password} onChange={e => setFormKader({...formKader, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }} /></div>
                   <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{isSubmitting ? 'Memproses...' : '+ Daftarkan Kader'}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ fontSize: '0.75rem', color: '#555', backgroundColor: '#fff3e0', padding: '10px', borderRadius: '6px', borderLeft: '4px solid #f39c12' }}>
                  <b>Format Kolom Excel: NIM | NIA | Nama | Asal Rayon | Jenjang | Angkatan | TanggalLahir | Pendamping</b><br/>
                  *TanggalLahir akan menjadi password. Jika NIM sudah ada di Rayon lain, otomatis akan ditarik.
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="file" accept=".xlsx, .xls" required style={{ padding: '10px', border: '2px dashed #2ecc71', borderRadius: '6px', flex: 1, backgroundColor: '#fcfcfc' }} />
                  <button type="button" onClick={handleDownloadTemplate} style={{ padding: '10px 20px', backgroundColor: '#0000af', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>📥 Unduh Template</button>
                </div>
                <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>🚀 Mulai Import Data</button>
                {importProgress && <div style={{textAlign: 'center', fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold'}}>{importProgress}</div>}
              </form>
            )}
          </div>

          {/* FILTER & TABEL KADER */}
          <div style={{ display: 'flex', gap: '10px', backgroundColor: '#fcfcfc', padding: '15px', borderRadius: '10px', border: '1px solid #eaeaea', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Cari NIM / Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} style={{ flex: '1 1 200px', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none' }} />
            <select value={filterJenjangKader} onChange={(e) => setFilterJenjangKader(e.target.value)} style={{ flex: '1 1 150px', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none' }}>
              <option value="">-- Semua Jenjang --</option>
              <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option>
            </select>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginLeft: 'auto' }}>
              <span style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#555'}}>Tampil:</span>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setKaderPage(1); }} style={{ padding: '8px', border: '1px solid #0000af', borderRadius: '6px', outline: 'none' }}>
                <option value={10}>10 Baris</option><option value={50}>50 Baris</option><option value={100}>100 Baris</option>
              </select>
            </div>
          </div>

          <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
            <table className="tabel-utama" style={{ minWidth: '900px' }}>
              <thead style={{ borderBottom: '2px solid #eee' }}>
                <tr>
                  <th style={{ textAlign: 'center', width: '5%' }}>No</th>
                  <th style={{ textAlign: 'center', width: '15%' }}>NIM</th>
                  <th style={{ width: '30%' }}>Nama Lengkap</th>
                  <th style={{ textAlign: 'center', width: '10%' }}>Jenjang</th>
                  <th style={{ textAlign: 'center', width: '10%' }}>Status</th>
                  <th style={{ textAlign: 'center', width: '20%' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentKaderDisplay.length === 0 ? (
                  <tr><td colSpan={6} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Data tidak ditemukan.</td></tr>
                ) : (
                  currentKaderDisplay.map((kader, idx) => (
                    <tr key={kader.nim} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ textAlign: 'center' }}>{indexOfFirstKader + idx + 1}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{kader.nim}</td>
                      <td><div style={{fontWeight: 'bold', color: '#0d1b2a'}}>{kader.nama}</div><div style={{fontSize: '0.75rem', color: '#888'}}>NIA: {kader.nia || '-'} | Angkatan: {kader.angkatan}</div></td>
                      <td style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{kader.jenjang || 'MAPABA'}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <div onClick={() => handleUbahStatusAkun(kader.id, kader.status || 'Aktif')} style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!kader.status || kader.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!kader.status || kader.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                          {(!kader.status || kader.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button onClick={() => setEditKaderModal({ oldNim: kader.nim, id: kader.id, nim: kader.nim, nama: kader.nama, nia: kader.nia || '', angkatan: kader.angkatan || '', id_rayon: kader.id_rayon || adminRayonId, jenjang: kader.jenjang || 'MAPABA', riwayat_kaderisasi: kader.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false }, pendamping_mapaba_id: kader.pendamping_mapaba_id || [], pendamping_pkd_id: kader.pendamping_pkd_id || [], pendamping_sig_id: kader.pendamping_sig_id || [], pendamping_skp_id: kader.pendamping_skp_id || [] })} style={{ backgroundColor: '#f1c40f', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Edit</button>
                          <button onClick={() => handleHapusKaderTotal(kader)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️ Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
            <span style={{fontSize: '0.85rem', color: '#666', fontWeight: 'bold'}}>Halaman {kaderPage}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={kaderPage === 1} onClick={() => setKaderPage(kaderPage - 1)} style={{ padding: '8px 15px', border: '1px solid #ccc', borderRadius: '6px', cursor: kaderPage === 1 ? 'not-allowed' : 'pointer', background: '#fff', fontSize: '0.85rem' }}>⬅️ Seb</button>
              <button onClick={() => setKaderPage(kaderPage + 1)} style={{ padding: '8px 15px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', background: '#fff', fontSize: '0.85rem' }}>Sel ➡️</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB PENDAMPING RAYON */}
      {tabAkun === 'pendamping' && (
         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
         <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
           <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>✏️ Buat Akun Pendamping</h4>
           <form onSubmit={handleBuatAkunPendamping} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
             <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Lengkap</label><input type="text" value={formPendamping.nama} onChange={e => setFormPendamping({...formPendamping, nama: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
             <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Username Login</label><input type="text" value={formPendamping.username} onChange={e => setFormPendamping({...formPendamping, username: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
             <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Jenjang Tugas</label><select required value={formPendamping.jenjangTugas} onChange={e => setFormPendamping({...formPendamping, jenjangTugas: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', cursor: 'pointer' }}><option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option></select></div>
             <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Password Login</label><input type="text" value={formPendamping.password} onChange={e => setFormPendamping({...formPendamping, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
             <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '40px', gridColumn: '1 / -1' }}>{isSubmitting ? 'Memproses...' : '+ Daftarkan Pendamping'}</button>
           </form>
         </div>

         <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
           <table className="tabel-utama" style={{ minWidth: '400px' }}>
             <thead>
               <tr><th style={{ textAlign: 'center' }}>Nama Pendamping</th><th style={{ textAlign: 'center' }}>Username</th><th style={{ textAlign: 'center' }}>Tugas</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>Aksi</th></tr>
             </thead>
             <tbody>
               {dataPendamping.map(p => (
                 <tr key={p.id}>
                   <td style={{ fontWeight: 'bold', color: '#0d1b2a', textAlign: 'center' }}>{p.nama}</td>
                   <td style={{ color: '#666', textAlign: 'center' }}>{p.username}</td>
                   <td style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{p.jenjangTugas}</span></td>
                   <td style={{ textAlign: 'center' }}>
                     <div onClick={() => handleUbahStatusAkun(p.id, p.status || 'Aktif')} style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!p.status || p.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!p.status || p.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>{(!p.status || p.status === 'Aktif') ? 'Aktif' : 'Pasif'}</div>
                   </td>
                   <td style={{ textAlign: 'center' }}><button onClick={() => handleHapusAkun(p.id, p.nama)} style={{ color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button></td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>
      )}

      {/* MODAL EDIT KADER */}
      {editKaderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setEditKaderModal(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
            <h3 style={{ marginTop: 0, color: '#0000af', borderBottom: '2px solid #eaeaea', paddingBottom: '15px', marginBottom: '20px' }}>⚙️ Panel Edit Data Kader</h3>
            <form onSubmit={handleSimpanEditKader} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                 <div><label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', display: 'block' }}>Nama Lengkap</label><input type="text" required value={editKaderModal.nama} onChange={e => setEditKaderModal({...editKaderModal, nama: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} /></div>
                 <div><label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', display: 'block' }}>NIM</label><input type="text" required value={editKaderModal.nim} onChange={e => setEditKaderModal({...editKaderModal, nim: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} /></div>
                 <div><label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', display: 'block' }}>NIA</label><input type="text" value={editKaderModal.nia} onChange={e => setEditKaderModal({...editKaderModal, nia: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} /></div>
                 <div>
                   <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', display: 'block' }}>Ubah Asal Rayon</label>
                   <select value={editKaderModal.id_rayon} onChange={e => setEditKaderModal({...editKaderModal, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}>
                     {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                     <option value="Luar Komisariat">Delegasi Luar Komisariat</option>
                   </select>
                 </div>
                 <div><label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', display: 'block' }}>Tahun Angkatan</label><input type="number" required value={editKaderModal.angkatan} onChange={e => setEditKaderModal({...editKaderModal, angkatan: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} /></div>
                 <div><label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', display: 'block' }}>Password / Tgl Lahir</label><input type="text" value={editKaderModal.tanggalLahir || ''} onChange={e => setEditKaderModal({...editKaderModal, tanggalLahir: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} /></div>
              </div>

              <div style={{ backgroundColor: '#f0fbf4', border: '1px solid #27ae60', padding: '20px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#1e824c' }}>🎓 Histori & Jenjang</h4>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {['MAPABA', 'PKD', 'SIG', 'SKP'].map(jenjang => (
                    <label key={jenjang} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editKaderModal.riwayat_kaderisasi[jenjang] || false} onChange={() => { setEditKaderModal({ ...editKaderModal, riwayat_kaderisasi: { ...editKaderModal.riwayat_kaderisasi, [jenjang]: !editKaderModal.riwayat_kaderisasi[jenjang] } }); }} style={{ transform: 'scale(1.2)' }} />
                      Lulus {jenjang}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: '15px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e824c' }}>Set Status Jenjang TERTINGGI Saat Ini:</label>
                  <select value={editKaderModal.jenjang} onChange={e => setEditKaderModal({...editKaderModal, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #27ae60', borderRadius: '6px', fontWeight: 'bold', color: '#27ae60', marginTop: '5px' }}>
                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
                  </select>
                </div>
              </div>

              <div style={{ backgroundColor: '#fdfdfd', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#0d1b2a' }}>👨‍🏫 Plotting Pendamping per Jenjang</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                  {['mapaba', 'pkd', 'sig', 'skp'].map(jenjangKey => {
                      const fieldName = `pendamping_${jenjangKey}_id`;
                      const jenjangLabel = jenjangKey.toUpperCase();
                      return (
                        <div key={jenjangKey} style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '10px', backgroundColor: '#fff' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#1e824c', display: 'block', marginBottom: '8px' }}>Pendamping {jenjangLabel}</label>
                          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            {dataPendamping.map(p => (
                              <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', fontSize: '0.7rem', marginBottom: '6px', cursor: 'pointer' }}>
                                <input type="checkbox" value={p.username} checked={(editKaderModal[fieldName] || []).includes(p.username)} onChange={(e) => { const val = e.target.value; const currentArr = editKaderModal[fieldName] || []; if(e.target.checked) setEditKaderModal({...editKaderModal, [fieldName]: [...currentArr, val]}); else setEditKaderModal({...editKaderModal, [fieldName]: currentArr.filter((id: string) => id !== val)}); }} style={{ marginRight: '6px' }} />
                                {p.nama}
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                  })}
                </div>
              </div>

              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#0000af', color: 'white', border: 'none', padding: '15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                {isSubmitting ? 'Menyimpan...' : '💾 Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}