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

            onSnapshot(query(collection(db, "users"), where("role", "==", "rayon")), (snap: any) => {
              setDataRayon(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
            });
            onSnapshot(query(collection(db, "users"), where("role", "==", "pendamping"), where("id_rayon", "==", currentRayonId)), (snap: any) => {
              setDataPendamping(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
            });
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

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon", aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  const handleBuatAkunPendamping = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeUsername = formPendamping.username.trim().replace(/\s+/g, '').toLowerCase();
      const emailBaru = `${safeUsername}@pmii-uinmalang.or.id`;
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formPendamping.password);
      await setDoc(doc(db, "users", safeUsername), { username: safeUsername, nama: formPendamping.nama, email: emailBaru, role: "pendamping", id_rayon: adminRayonId, jumlahBinaan: 0, status: "Aktif", jenjangTugas: formPendamping.jenjangTugas, createdAt: Date.now() });
      await signOutSecondary(secondaryAuth); catatLogAktivitas(`Membuat akun pendamping: ${formPendamping.nama}`); alert(`Sukses!`); setFormPendamping({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' });
    } catch (error: any) { alert("Gagal. Error: " + error.message); } finally { setIsSubmitting(false); }
  };

  const handleBuatAkunKader = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeNim = formKader.nim.trim();
      const qCek = query(collection(db, "users"), where("nim", "==", safeNim), where("role", "==", "kader"));
      const snapCek = await getDocs(qCek);
      let finalAsalRayon = formKader.id_rayon || adminRayonId;
      if (formKader.id_rayon === "Luar Komisariat" && formKader.nama_rayon_luar.trim() !== "") { finalAsalRayon = formKader.nama_rayon_luar.trim(); }

      if (!snapCek.empty) {
         const existingDoc = snapCek.docs[0]; const existingData = existingDoc.data();
         const existingTerdaftar = existingData.terdaftar_di || [existingData.id_rayon];
         if (!existingTerdaftar.includes(adminRayonId)) existingTerdaftar.push(adminRayonId);
         const mergedPendamping = Array.from(new Set([...(existingData.pendamping_mapaba_id || []), ...formKader.pendamping_mapaba_id]));
         const riwayatUpdated = existingData.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false };
         await updateDoc(doc(db, "users", existingDoc.id), { jenjang: 'MAPABA', pendamping_mapaba_id: mergedPendamping, riwayat_kaderisasi: riwayatUpdated, terdaftar_di: existingTerdaftar });
         catatLogAktivitas(`Menarik akun kader lama ke Rayon: ${existingData.nama}`); alert(`Kader ditarik sukses!`);
      } else {
          const emailBaru = `${safeNim}@pmii-uinmalang.or.id`.toLowerCase();
          await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formKader.password);
          await setDoc(doc(db, "users", safeNim), { 
            nim: safeNim, nia: formKader.nia || '', nama: formKader.nama, email: emailBaru, role: "kader", id_rayon: finalAsalRayon, jenjang: "MAPABA", 
            pendamping_mapaba_id: formKader.pendamping_mapaba_id, pendamping_pkd_id: [], pendamping_sig_id: [], pendamping_skp_id: [],
            riwayat_kaderisasi: { MAPABA: true, PKD: false, SIG: false, SKP: false }, angkatan: formKader.angkatan, status: "Aktif", createdAt: Date.now(), terdaftar_di: Array.from(new Set([finalAsalRayon, adminRayonId]))
          });
          await signOutSecondary(secondaryAuth); catatLogAktivitas(`Membuat akun kader baru: ${formKader.nama}`); alert(`Sukses dibuat.`);
      }
      setFormKader({ nim: '', nia: '', nama: '', password: '', id_rayon: '', nama_rayon_luar: '', pendamping_mapaba_id: [], angkatan: new Date().getFullYear().toString() });
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{ "NIM": "", "NIA": "", "Nama": "", "Asal Rayon": "", "Jenjang": "MAPABA", "Angkatan": "", "TanggalLahir": "", "Pendamping": "" }];
    const worksheet = XLSX.utils.json_to_sheet(templateData); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Template_Kader"); XLSX.writeFile(workbook, "Template_Import_Kader.xlsx");
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
                  nim: nim, nia: nia || '', nama: nama, email: emailBaru, role: "kader", id_rayon: finalAsalRayonId, jenjang: jenjangExcel, 
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
      const newNim = editKaderModal.nim.trim(); 
      const docRef = doc(db, "users", editKaderModal.id);
      let asalRayonFix = editKaderModal.id_rayon;
      
      if (asalRayonFix && asalRayonFix.trim() !== '') {
         const inputVal = asalRayonFix.trim();
         const matchedRayon = dataRayon.find((r: any) => r.nama.toLowerCase() === inputVal.toLowerCase() || r.username.toLowerCase() === inputVal.toLowerCase() || r.id === inputVal);
         asalRayonFix = matchedRayon ? (matchedRayon.username || matchedRayon.id) : inputVal;
      }
      
      if (newNim !== editKaderModal.oldNim) {
        const oldNim = editKaderModal.oldNim;
        const newEmail = `${newNim}@pmii-uinmalang.or.id`.toLowerCase();
        const oldEmail = `${oldNim}@pmii-uinmalang.or.id`.toLowerCase();

        const oldKaderData = (await getDocs(query(collection(db, "users"), where("nim", "==", oldNim)))).docs[0]?.data() || {};
        await setDoc(doc(db, "users", newNim), { ...oldKaderData, nim: newNim, nama: editKaderModal.nama, nia: editKaderModal.nia || '', angkatan: editKaderModal.angkatan, tanggalLahir: editKaderModal.tanggalLahir || '', id_rayon: asalRayonFix, jenjang: editKaderModal.jenjang, riwayat_kaderisasi: editKaderModal.riwayat_kaderisasi, pendamping_mapaba_id: editKaderModal.pendamping_mapaba_id, pendamping_pkd_id: editKaderModal.pendamping_pkd_id, pendamping_sig_id: editKaderModal.pendamping_sig_id, pendamping_skp_id: editKaderModal.pendamping_skp_id, email: newEmail });
        await deleteDoc(docRef); 

        const oldNilaiSnap = await getDocs(query(collection(db, "nilai_khs"), where("__name__", "==", oldNim)));
        if (!oldNilaiSnap.empty) {
            await setDoc(doc(db, "nilai_khs", newNim), oldNilaiSnap.docs[0].data());
            await deleteDoc(doc(db, "nilai_khs", oldNim));
        }

        const oldEvaluasiSnap = await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", oldNim)));
        if (!oldEvaluasiSnap.empty) {
            await setDoc(doc(db, "evaluasi_kader", newNim), oldEvaluasiSnap.docs[0].data());
            await deleteDoc(doc(db, "evaluasi_kader", oldNim));
        }

        const tesSnap = await getDocs(query(collection(db, "jawaban_tes"), where("nim", "==", oldNim)));
        tesSnap.forEach(async (d) => await updateDoc(doc(db, "jawaban_tes", d.id), { nim: newNim }));

        const berkasSnap = await getDocs(query(collection(db, "berkas_kader"), where("email_kader", "==", oldEmail)));
        berkasSnap.forEach(async (d) => await updateDoc(doc(db, "berkas_kader", d.id), { email_kader: newEmail }));

        alert("Data, NIM, dan seluruh riwayat kader berhasil diperbarui!");
      } else {
        await updateDoc(docRef, { nama: editKaderModal.nama, nia: editKaderModal.nia || '', angkatan: editKaderModal.angkatan, tanggalLahir: editKaderModal.tanggalLahir || '', id_rayon: asalRayonFix, jenjang: editKaderModal.jenjang, riwayat_kaderisasi: editKaderModal.riwayat_kaderisasi, pendamping_mapaba_id: editKaderModal.pendamping_mapaba_id, pendamping_pkd_id: editKaderModal.pendamping_pkd_id, pendamping_sig_id: editKaderModal.pendamping_sig_id, pendamping_skp_id: editKaderModal.pendamping_skp_id });
        alert("Data berhasil diperbarui!");
      }
      setEditKaderModal(null);
    } catch (error) { 
      alert("Terjadi kesalahan. Pastikan koneksi stabil."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleUbahStatusAkun = async (idAkun: string, statusSekarang: string) => { const statusBaru = statusSekarang === "Aktif" ? "Pasif" : "Aktif"; if (!window.confirm(`Ubah status ke ${statusBaru}?`)) return; try { await updateDoc(doc(db, "users", idAkun), { status: statusBaru }); } catch (error) {} };
  const handleHapusAkun = async (idAkun: string, nama: string) => { if (!window.confirm(`Hapus permanen akun pendamping "${nama}"?`)) return; try { await deleteDoc(doc(db, "users", idAkun)); alert(`Dihapus.`); } catch (error) {} };
  
  const handleHapusKaderTotal = async (kader: any) => {
    if(!window.confirm(`PERINGATAN KERAS!\nYakin ingin menghapus permanen akun "${kader.nama}"?`)) return;
    try {
      await deleteDoc(doc(db, "users", kader.id)); await deleteDoc(doc(db, "nilai_khs", kader.nim)); await deleteDoc(doc(db, "evaluasi_kader", kader.nim));
      if (kader.email) { const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", kader.email)); const snapBerkas = await getDocs(qBerkas); snapBerkas.forEach(d => deleteDoc(d.ref)); }
      const qTes = query(collection(db, "jawaban_tes"), where("nim", "==", kader.nim)); const snapTes = await getDocs(qTes); snapTes.forEach(d => deleteDoc(d.ref));
      catatLogAktivitas(`Menghapus permanen akun kader: ${kader.nama}`); alert("Kader dihapus.");
    } catch (error) { alert("Gagal menghapus total."); }
  };

  const filteredKader = dataKader.filter((k: any) => 
    ((k.nama && k.nama.toLowerCase().includes(searchKader.toLowerCase())) || (k.nim && k.nim.includes(searchKader))) && (filterJenjangKader === '' || k.jenjang === filterJenjangKader)
  );

  const indexOfLastKader = kaderPage * itemsPerPage;
  const indexOfFirstKader = indexOfLastKader - itemsPerPage;
  const currentKaderDisplay = filteredKader.slice(indexOfFirstKader, indexOfLastKader);

  return (
    <>
      <style>{`
        :root {
          --text-main: #111827;
          --text-body: #374151;
          --text-muted: #6b7280;
          --border-color: #e5e7eb;
          --bg-card: #ffffff;
        }

        /* Diperbesar gap antar elemen dari 24px menjadi 36px agar tidak mepet */
        .page-wrapper { display: flex; flex-direction: column; gap: 36px; box-sizing: border-box; width: 100%; }
        
        .header-card { 
          background: var(--bg-card); padding: 28px 32px; border-radius: 8px; 
          border: 1px solid var(--border-color); box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); 
        }

        .form-control-custom {
          width: 100%; padding: 12px 16px; border: 1px solid var(--border-color); 
          background-color: #ffffff; border-radius: 6px; font-size: 0.9rem; outline: none; 
          color: var(--text-main); transition: border-color 0.2s; box-sizing: border-box;
          font-family: inherit;
        }
        .form-control-custom:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }

        .desktop-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .desktop-table th { background-color: #f8fafc; color: var(--text-main); padding: 14px 18px; font-weight: 600; border-bottom: 1px solid var(--border-color); }
        .desktop-table td { padding: 16px 18px; border-bottom: 1px solid #f3f4f6; color: var(--text-body); background-color: #fff; vertical-align: middle; }

        .btn-main {
          background-color: #2563eb; color: white; border: none; padding: 12px 24px;
          border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;
          transition: background-color 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn-main:hover { background-color: #1d4ed8; }

        .btn-tab {
          padding: 8px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;
          transition: all 0.2s; border: 1px solid var(--border-color); background-color: #f8fafc; color: var(--text-muted);
        }
        .btn-tab.active { background-color: #2563eb; color: white; border-color: #2563eb; }

        .desktop-view { display: block; }
        .mobile-view { display: none; }
        
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
           .desktop-view { display: none !important; }
           .mobile-view { display: block !important; }
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .mobile-padded { display: flex; flex-direction: column; gap: 20px; padding: 16px !important; }
        }
      `}</style>

      {/* ========================================================== */}
      {/* DESKTOP VIEW                                               */}
      {/* ========================================================== */}
      <div className="desktop-view page-wrapper">
        
        {/* HEADER GABUNGAN DENGAN TOMBOL TAB (KADER & PENDAMPING) */}
        <div className="header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: '700' }}>Manajemen Akun Rayon</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Kelola data akun kader dan pendamping di lingkungan Rayon Anda.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setTabAkun('kader')} className={`btn-tab ${tabAkun === 'kader' ? 'active' : ''}`}>🎓 Kader Rayon</button>
            <button onClick={() => setTabAkun('pendamping')} className={`btn-tab ${tabAkun === 'pendamping' ? 'active' : ''}`}>👩 Pendamping Rayon</button>
          </div>
        </div>

        {tabAkun === 'kader' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Form Input Kader */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '32px', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #f3f4f6', paddingBottom: '20px' }}>
                <button type="button" onClick={() => setModeInputKader('baru')} className={`btn-tab ${modeInputKader === 'baru' ? 'active' : ''}`}>Buat Manual</button>
                <button type="button" onClick={() => setModeInputKader('import')} className={`btn-tab ${modeInputKader === 'import' ? 'active' : ''}`}>📗 Import Data Excel</button>
              </div>

              {modeInputKader === 'baru' ? (
                <form onSubmit={handleBuatAkunKader} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'start' }}>
                  <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '4px' }}>*Jika NIM sudah terdaftar di sistem, akun akan otomatis ditarik ke dalam Rayon Anda.</div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>NIM Kader</label>
                    <input type="text" placeholder="Cth: 22010111..." value={formKader.nim} onChange={e => setFormKader({...formKader, nim: e.target.value})} required className="form-control-custom" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>NIA (Opsional)</label>
                    <input type="text" placeholder="Nomor Induk Anggota" value={formKader.nia} onChange={e => setFormKader({...formKader, nia: e.target.value})} className="form-control-custom" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Nama Lengkap</label>
                    <input type="text" placeholder="Nama Lengkap Kader" value={formKader.nama} onChange={e => setFormKader({...formKader, nama: e.target.value})} required className="form-control-custom" />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Asal Rayon</label>
                    <select value={formKader.id_rayon} onChange={e => setFormKader({...formKader, id_rayon: e.target.value})} required className="form-control-custom" style={{ cursor: 'pointer' }}>
                       <option value="" disabled>-- Pilih Asal Rayon --</option>
                       {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                       <option value="Luar Komisariat">Delegasi Luar Komisariat</option>
                    </select>
                    {formKader.id_rayon === 'Luar Komisariat' && (
                      <div style={{ marginTop: '12px' }}>
                        <input type="text" placeholder="Ketik Nama Asal Rayon Luar..." value={formKader.nama_rayon_luar} onChange={e => setFormKader({...formKader, nama_rayon_luar: e.target.value})} required className="form-control-custom" style={{ borderStyle: 'dashed' }} />
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Tahun Angkatan</label>
                    <input type="number" placeholder="Cth: 2026" value={formKader.angkatan} onChange={e => setFormKader({...formKader, angkatan: e.target.value})} required className="form-control-custom" />
                  </div>
                  
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Plot ke Pendamping MAPABA</label>
                    <div className="hide-scroll" style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', backgroundColor: '#f9fafb' }}>
                      {dataPendamping.map(p => (
                        <label key={p.id} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.85rem', marginRight: '24px', marginBottom: '10px', cursor: 'pointer', color: 'var(--text-body)', fontWeight: '500' }}>
                          <input type="checkbox" value={p.username} checked={formKader.pendamping_mapaba_id.includes(p.username)} onChange={(e) => { const val = e.target.value; if(e.target.checked) setFormKader(prev => ({...prev, pendamping_mapaba_id: [...prev.pendamping_mapaba_id, val]})); else setFormKader(prev => ({...prev, pendamping_mapaba_id: prev.pendamping_mapaba_id.filter(id => id !== val)})); }} style={{ marginRight: '8px', accentColor: '#2563eb' }} />
                          {p.nama}
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '20px', alignItems: 'flex-end', marginTop: '6px' }}>
                     <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Password Login</label>
                       <input type="text" placeholder="Tgl Lahir (DDMMYYYY)" value={formKader.password} onChange={e => setFormKader({...formKader, password: e.target.value})} required className="form-control-custom" />
                     </div>
                     <button disabled={isSubmitting} type="submit" className="btn-main" style={{ height: '46px' }}>{isSubmitting ? 'Memproses...' : '+ Daftarkan Kader'}</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#b45309', backgroundColor: '#fffbeb', padding: '16px', borderRadius: '6px', border: '1px solid #fef3c7', lineHeight: '1.6' }}>
                    <b>Format Kolom Excel:</b> NIM | NIA | Nama | Asal Rayon | Jenjang | Angkatan | TanggalLahir | Pendamping<br/>
                    *TanggalLahir otomatis menjadi password akun.
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <input type="file" accept=".xlsx, .xls" required style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', flex: 1, backgroundColor: '#fff', fontSize: '0.9rem' }} />
                    <button type="button" onClick={handleDownloadTemplate} className="btn-main" style={{ backgroundColor: '#0f172a' }}>📥 Unduh Template</button>
                  </div>
                  <button disabled={isSubmitting} type="submit" className="btn-main" style={{ backgroundColor: '#16a34a' }}>{isSubmitting ? 'Memproses...' : '🚀 Mulai Import Data'}</button>
                  {importProgress && <div style={{textAlign: 'center', fontSize: '0.9rem', color: '#d97706', fontWeight: '600'}}>{importProgress}</div>}
                </form>
              )}
            </div>

            {/* Filter & Tabel Data Kader */}
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
              
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="text" placeholder="🔍 Cari NIM / Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} className="form-control-custom" style={{ flex: '1 1 240px', backgroundColor: '#fff' }} />
                <select value={filterJenjangKader} onChange={(e) => setFilterJenjangKader(e.target.value)} className="form-control-custom" style={{ flex: '1 1 180px', backgroundColor: '#fff', cursor: 'pointer' }}>
                  <option value="">Semua Jenjang</option>
                  <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option>
                </select>
                <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setKaderPage(1); }} className="form-control-custom" style={{ width: '140px', backgroundColor: '#fff', cursor: 'pointer' }}>
                  <option value={10}>10 Baris</option><option value={50}>50 Baris</option><option value={100}>100 Baris</option>
                </select>
              </div>

              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table className="desktop-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '5%' }}>No</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>NIM</th>
                      <th style={{ width: '35%' }}>Nama Lengkap</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Jenjang</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Status</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentKaderDisplay.length === 0 ? (
                      <tr><td colSpan={6} style={{textAlign: 'center', padding: '50px', color: 'var(--text-muted)'}}>Data kader tidak ditemukan.</td></tr>
                    ) : (
                      currentKaderDisplay.map((kader, idx) => (
                        <tr key={kader.nim}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{indexOfFirstKader + idx + 1}</td>
                          <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-main)' }}>{kader.nim}</td>
                          <td>
                            <div style={{fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem'}}>{kader.nama}</div>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>NIA: {kader.nia || '-'} | Angkatan: {kader.angkatan}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', border: '1px solid #dbeafe' }}>{kader.jenjang || 'MAPABA'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div onClick={() => handleUbahStatusAkun(kader.id, kader.status || 'Aktif')} style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', backgroundColor: (!kader.status || kader.status === 'Aktif') ? '#f0fdf4' : '#fef2f2', color: (!kader.status || kader.status === 'Aktif') ? '#15803d' : '#b91c1c', border: `1px solid ${(!kader.status || kader.status === 'Aktif') ? '#dcfce7' : '#fee2e2'}` }}>
                              {(!kader.status || kader.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button onClick={() => setEditKaderModal({ oldNim: kader.nim, id: kader.id, nim: kader.nim, nama: kader.nama, nia: kader.nia || '', angkatan: kader.angkatan || '', id_rayon: kader.id_rayon || adminRayonId, jenjang: kader.jenjang || 'MAPABA', riwayat_kaderisasi: kader.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false }, pendamping_mapaba_id: kader.pendamping_mapaba_id || [], pendamping_pkd_id: kader.pendamping_pkd_id || [], pendamping_sig_id: kader.pendamping_sig_id || [], pendamping_skp_id: kader.pendamping_skp_id || [] })} style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                              <button onClick={() => handleHapusKaderTotal(kader)} style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.75rem' }}>Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500'}}>Halaman {kaderPage}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={kaderPage === 1} onClick={() => setKaderPage(kaderPage - 1)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: kaderPage === 1 ? 'not-allowed' : 'pointer', background: '#fff', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Seb</button>
                  <button onClick={() => setKaderPage(kaderPage + 1)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', background: '#fff', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Sel</button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB PENDAMPING RAYON */}
        {tabAkun === 'pendamping' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
             <div style={{ backgroundColor: 'var(--bg-card)', padding: '32px', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
               <h4 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: '600', borderBottom: '1px solid #f3f4f6', paddingBottom: '16px' }}>Daftarkan Akun Pendamping</h4>
               <form onSubmit={handleBuatAkunPendamping} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'end' }}>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Nama Lengkap</label>
                   <input type="text" value={formPendamping.nama} onChange={e => setFormPendamping({...formPendamping, nama: e.target.value})} required className="form-control-custom" />
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Username Login</label>
                   <input type="text" value={formPendamping.username} onChange={e => setFormPendamping({...formPendamping, username: e.target.value})} required className="form-control-custom" />
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Jenjang Tugas</label>
                   <select required value={formPendamping.jenjangTugas} onChange={e => setFormPendamping({...formPendamping, jenjangTugas: e.target.value})} className="form-control-custom" style={{ cursor: 'pointer' }}>
                     <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option>
                   </select>
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Password Login</label>
                   <input type="text" value={formPendamping.password} onChange={e => setFormPendamping({...formPendamping, password: e.target.value})} required className="form-control-custom" />
                 </div>
                 <button disabled={isSubmitting} type="submit" className="btn-main" style={{ gridColumn: '1 / -1', height: '46px', marginTop: '6px' }}>{isSubmitting ? 'Memproses...' : '+ Daftarkan Pendamping'}</button>
               </form>
             </div>

             <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                 <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: '600' }}>Daftar Pendamping Rayon</h4>
               </div>
               <div style={{ width: '100%', overflowX: 'auto' }}>
                 <table className="desktop-table">
                   <thead>
                     <tr>
                       <th style={{ textAlign: 'center' }}>Nama Pendamping</th>
                       <th style={{ textAlign: 'center' }}>Username</th>
                       <th style={{ textAlign: 'center' }}>Tugas</th>
                       <th style={{ textAlign: 'center' }}>Status</th>
                       <th style={{ textAlign: 'center' }}>Aksi</th>
                     </tr>
                   </thead>
                   <tbody>
                     {dataPendamping.length === 0 ? (
                       <tr><td colSpan={5} style={{textAlign: 'center', padding: '50px', color: 'var(--text-muted)'}}>Belum ada pendamping terdaftar.</td></tr>
                     ) : (
                       dataPendamping.map(p => (
                         <tr key={p.id}>
                           <td style={{ fontWeight: '600', color: 'var(--text-main)', textAlign: 'center' }}>{p.nama}</td>
                           <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{p.username}</td>
                           <td style={{ textAlign: 'center' }}>
                             <span style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', border: '1px solid #fef3c7' }}>{p.jenjangTugas}</span>
                           </td>
                           <td style={{ textAlign: 'center' }}>
                             <div onClick={() => handleUbahStatusAkun(p.id, p.status || 'Aktif')} style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', backgroundColor: (!p.status || p.status === 'Aktif') ? '#f0fdf4' : '#fef2f2', color: (!p.status || p.status === 'Aktif') ? '#15803d' : '#b91c1c', border: `1px solid ${(!p.status || p.status === 'Aktif') ? '#dcfce7' : '#fee2e2'}` }}>
                               {(!p.status || p.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                             </div>
                           </td>
                           <td style={{ textAlign: 'center' }}>
                             <button onClick={() => handleHapusAkun(p.id, p.nama)} style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fee2e2', padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>Hapus</button>
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
           </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* MOBILE VIEW                                                */}
      {/* ========================================================== */}
      <div className="mobile-view mobile-padded">
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setTabAkun('kader')} className={`btn-tab ${tabAkun === 'kader' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }}>🎓 Kader</button>
          <button onClick={() => setTabAkun('pendamping')} className={`btn-tab ${tabAkun === 'pendamping' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }}>👩 Pendamping</button>
        </div>

        {tabAkun === 'kader' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', border: '1px solid #eaeaea', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button type="button" onClick={() => setModeInputKader('baru')} className={`btn-tab ${modeInputKader === 'baru' ? 'active' : ''}`} style={{ flex: 1 }}>Manual</button>
                <button type="button" onClick={() => setModeInputKader('import')} className={`btn-tab ${modeInputKader === 'import' ? 'active' : ''}`} style={{ flex: 1 }}>📗 Import Excel</button>
              </div>

              {modeInputKader === 'baru' ? (
                <form onSubmit={handleBuatAkunKader} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="text" placeholder="NIM Kader" value={formKader.nim} onChange={e => setFormKader({...formKader, nim: e.target.value})} required className="form-control-custom" />
                  <input type="text" placeholder="NIA (Opsional)" value={formKader.nia} onChange={e => setFormKader({...formKader, nia: e.target.value})} className="form-control-custom" />
                  <input type="text" placeholder="Nama Lengkap" value={formKader.nama} onChange={e => setFormKader({...formKader, nama: e.target.value})} required className="form-control-custom" />
                  <select value={formKader.id_rayon} onChange={e => setFormKader({...formKader, id_rayon: e.target.value})} required className="form-control-custom" style={{ backgroundColor: '#fff', cursor: 'pointer' }}>
                     <option value="" disabled>-- Pilih Asal Rayon --</option>
                     {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                     <option value="Luar Komisariat">Delegasi Luar Komisariat</option>
                  </select>
                  {formKader.id_rayon === 'Luar Komisariat' && (
                    <input type="text" placeholder="Nama Rayon Luar" value={formKader.nama_rayon_luar} onChange={e => setFormKader({...formKader, nama_rayon_luar: e.target.value})} required className="form-control-custom" style={{ borderStyle: 'dashed' }} />
                  )}
                  <input type="number" placeholder="Angkatan (Cth: 2026)" value={formKader.angkatan} onChange={e => setFormKader({...formKader, angkatan: e.target.value})} required className="form-control-custom" />
                  
                  <div style={{ backgroundColor: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Pendamping MAPABA</label>
                    <div className="hide-scroll" style={{ maxHeight: '130px', overflowY: 'auto' }}>
                      {dataPendamping.map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', marginBottom: '8px', cursor: 'pointer', color: 'var(--text-body)', fontWeight: '500' }}>
                          <input type="checkbox" value={p.username} checked={formKader.pendamping_mapaba_id.includes(p.username)} onChange={(e) => { const val = e.target.value; if(e.target.checked) setFormKader(prev => ({...prev, pendamping_mapaba_id: [...prev.pendamping_mapaba_id, val]})); else setFormKader(prev => ({...prev, pendamping_mapaba_id: prev.pendamping_mapaba_id.filter(id => id !== val)})); }} style={{ marginRight: '8px', accentColor: '#2563eb' }} />
                          {p.nama}
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <input type="text" placeholder="Password: Tgl Lahir (DDMMYYYY)" value={formKader.password} onChange={e => setFormKader({...formKader, password: e.target.value})} required className="form-control-custom" />
                  <button disabled={isSubmitting} type="submit" className="btn-main" style={{ marginTop: '4px' }}>{isSubmitting ? 'Memproses...' : 'Daftarkan Kader'}</button>
                </form>
              ) : (
                <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#b45309', backgroundColor: '#fffbeb', padding: '10px', borderRadius: '6px', border: '1px solid #fef3c7', lineHeight: '1.4' }}>
                    <b>Format Excel:</b> NIM | NIA | Nama | Asal Rayon | Jenjang | Angkatan | TanggalLahir | Pendamping
                  </div>
                  <input type="file" accept=".xlsx, .xls" required style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fcfcfc', fontSize: '0.85rem' }} />
                  <button type="button" onClick={handleDownloadTemplate} className="btn-main" style={{ backgroundColor: '#0f172a' }}>📥 Unduh Template</button>
                  <button disabled={isSubmitting} type="submit" className="btn-main" style={{ backgroundColor: '#16a34a' }}>{isSubmitting ? 'Memproses...' : '🚀 Mulai Import Data'}</button>
                  {importProgress && <div style={{textAlign: 'center', fontSize: '0.8rem', color: '#d97706', fontWeight: '600'}}>{importProgress}</div>}
                </form>
              )}
            </div>

            {/* Filter & Pencarian Mobile */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" placeholder="🔍 Cari NIM / Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} className="form-control-custom" style={{ backgroundColor: '#fff' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <select value={filterJenjangKader} onChange={(e) => setFilterJenjangKader(e.target.value)} className="form-control-custom" style={{ flex: 1, backgroundColor: '#fff', cursor: 'pointer' }}>
                  <option value="">Semua Jenjang</option><option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option>
                </select>
                <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setKaderPage(1); }} className="form-control-custom" style={{ width: '110px', backgroundColor: '#fff', cursor: 'pointer' }}>
                  <option value={10}>10 Baris</option><option value={50}>50 Baris</option><option value={100}>100 Baris</option>
                </select>
              </div>
            </div>

            {/* Tabel Data Kader Mobile */}
            <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
              <table className="desktop-table" style={{ minWidth: '700px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '5%' }}>No</th>
                    <th style={{ textAlign: 'center', width: '20%' }}>NIM</th>
                    <th style={{ width: '35%' }}>Nama Lengkap</th>
                    <th style={{ textAlign: 'center', width: '15%' }}>Jenjang</th>
                    <th style={{ textAlign: 'center', width: '10%' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '15%' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentKaderDisplay.length === 0 ? (
                    <tr><td colSpan={6} style={{textAlign: 'center', padding: '30px', color: 'var(--text-muted)'}}>Data kader tidak ditemukan.</td></tr>
                  ) : (
                    currentKaderDisplay.map((kader, idx) => (
                      <tr key={kader.nim}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{indexOfFirstKader + idx + 1}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>{kader.nim}</td>
                        <td>
                          <div style={{fontWeight: '600', color: 'var(--text-main)', fontSize: '0.85rem'}}>{kader.nama}</div>
                          <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>Angkatan: {kader.angkatan}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>{kader.jenjang || 'MAPABA'}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div onClick={() => handleUbahStatusAkun(kader.id, kader.status || 'Aktif')} style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer', backgroundColor: (!kader.status || kader.status === 'Aktif') ? '#f0fdf4' : '#fef2f2', color: (!kader.status || kader.status === 'Aktif') ? '#15803d' : '#b91c1c' }}>
                            {(!kader.status || kader.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button onClick={() => setEditKaderModal({ oldNim: kader.nim, id: kader.id, nim: kader.nim, nama: kader.nama, nia: kader.nia || '', angkatan: kader.angkatan || '', id_rayon: kader.id_rayon || adminRayonId, jenjang: kader.jenjang || 'MAPABA', riwayat_kaderisasi: kader.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false }, pendamping_mapaba_id: kader.pendamping_mapaba_id || [], pendamping_pkd_id: kader.pendamping_pkd_id || [], pendamping_sig_id: kader.pendamping_sig_id || [], pendamping_skp_id: kader.pendamping_skp_id || [] })} style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '0.7rem' }}>Edit</button>
                            <button onClick={() => handleHapusKaderTotal(kader)} style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '0.7rem' }}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button disabled={kaderPage === 1} onClick={() => setKaderPage(kaderPage - 1)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#f8fafc', fontWeight: '600', color: 'var(--text-main)', fontSize: '0.8rem' }}>Seb</button>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Hal {kaderPage}</span>
              <button onClick={() => setKaderPage(kaderPage + 1)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#f8fafc', fontWeight: '600', color: 'var(--text-main)', fontSize: '0.8rem' }}>Sel</button>
            </div>
          </div>
        )}

        {tabAkun === 'pendamping' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div style={{ backgroundColor: '#fff', padding: '20px', border: '1px solid #eaeaea', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
               <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: '700', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>Daftarkan Pendamping</h4>
               <form onSubmit={handleBuatAkunPendamping} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <input type="text" placeholder="Nama Lengkap" value={formPendamping.nama} onChange={e => setFormPendamping({...formPendamping, nama: e.target.value})} required className="form-control-custom" />
                 <input type="text" placeholder="Username Login" value={formPendamping.username} onChange={e => setFormPendamping({...formPendamping, username: e.target.value})} required className="form-control-custom" />
                 <select required value={formPendamping.jenjangTugas} onChange={e => setFormPendamping({...formPendamping, jenjangTugas: e.target.value})} className="form-control-custom" style={{ backgroundColor: '#fff', cursor: 'pointer' }}><option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option></select>
                 <input type="text" placeholder="Password Login" value={formPendamping.password} onChange={e => setFormPendamping({...formPendamping, password: e.target.value})} required className="form-control-custom" />
                 <button disabled={isSubmitting} type="submit" className="btn-main" style={{ marginTop: '4px' }}>{isSubmitting ? 'Memproses...' : 'Daftarkan Pendamping'}</button>
               </form>
             </div>

             <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
               <table className="desktop-table" style={{ minWidth: '450px' }}>
                 <thead>
                   <tr>
                     <th style={{ textAlign: 'center' }}>Nama</th>
                     <th style={{ textAlign: 'center' }}>Username</th>
                     <th style={{ textAlign: 'center' }}>Tugas</th>
                     <th style={{ textAlign: 'center' }}>Status</th>
                     <th style={{ textAlign: 'center' }}>Aksi</th>
                   </tr>
                 </thead>
                 <tbody>
                   {dataPendamping.length === 0 ? (
                     <tr><td colSpan={5} style={{textAlign: 'center', padding: '30px', color: 'var(--text-muted)'}}>Belum ada pendamping.</td></tr>
                   ) : (
                     dataPendamping.map(p => (
                       <tr key={p.id}>
                         <td style={{ fontWeight: '600', color: 'var(--text-main)', textAlign: 'center', fontSize: '0.85rem' }}>{p.nama}</td>
                         <td style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem' }}>{p.username}</td>
                         <td style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>{p.jenjangTugas}</span></td>
                         <td style={{ textAlign: 'center' }}>
                           <div onClick={() => handleUbahStatusAkun(p.id, p.status || 'Aktif')} style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer', backgroundColor: (!p.status || p.status === 'Aktif') ? '#f0fdf4' : '#fef2f2', color: (!p.status || p.status === 'Aktif') ? '#15803d' : '#b91c1c' }}>{(!p.status || p.status === 'Aktif') ? 'Aktif' : 'Pasif'}</div>
                         </td>
                         <td style={{ textAlign: 'center' }}><button onClick={() => handleHapusAkun(p.id, p.nama)} style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fee2e2', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer' }}>Hapus</button></td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        <div style={{ height: '80px' }}></div>
      </div>

      {/* MODAL EDIT KADER */}
      {editKaderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '16px' }}>
          <div className="hide-scroll" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <button onClick={() => setEditKaderModal(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>✕</button>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px', fontSize: '1.1rem', fontWeight: '700' }}>Edit Data Kader</h3>
            
            <form onSubmit={handleSimpanEditKader} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Nama Lengkap</label>
                   <input type="text" required value={editKaderModal.nama} onChange={e => setEditKaderModal({...editKaderModal, nama: e.target.value})} className="form-control-custom" />
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>NIM</label>
                   <input type="text" required value={editKaderModal.nim} onChange={e => setEditKaderModal({...editKaderModal, nim: e.target.value})} className="form-control-custom" />
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>NIA</label>
                   <input type="text" value={editKaderModal.nia || ''} onChange={e => setEditKaderModal({...editKaderModal, nia: e.target.value})} className="form-control-custom" />
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Asal Rayon</label>
                   <select value={editKaderModal.id_rayon || ''} onChange={e => setEditKaderModal({...editKaderModal, id_rayon: e.target.value})} required className="form-control-custom" style={{ backgroundColor: '#fff', cursor: 'pointer' }}>
                     {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                     <option value="Luar Komisariat">Delegasi Luar Komisariat</option>
                   </select>
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Tahun Angkatan</label>
                   <input type="number" required value={editKaderModal.angkatan || ''} onChange={e => setEditKaderModal({...editKaderModal, angkatan: e.target.value})} className="form-control-custom" />
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Password / Tgl Lahir</label>
                   <input type="text" value={editKaderModal.tanggalLahir || ''} onChange={e => setEditKaderModal({...editKaderModal, tanggalLahir: e.target.value})} className="form-control-custom" />
                 </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600' }}>Histori Lulus Jenjang</h4>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {['MAPABA', 'PKD', 'SIG', 'SKP'].map(jenjang => (
                    <label key={jenjang} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-body)' }}>
                      <input type="checkbox" checked={editKaderModal.riwayat_kaderisasi[jenjang] || false} onChange={() => { setEditKaderModal({ ...editKaderModal, riwayat_kaderisasi: { ...editKaderModal.riwayat_kaderisasi, [jenjang]: !editKaderModal.riwayat_kaderisasi[jenjang] } }); }} style={{ accentColor: '#2563eb' }} />
                      Lulus {jenjang}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Status Jenjang TERTINGGI Saat Ini</label>
                  <select value={editKaderModal.jenjang || 'MAPABA'} onChange={e => setEditKaderModal({...editKaderModal, jenjang: e.target.value})} className="form-control-custom" style={{ backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
                  </select>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600' }}>Plotting Pendamping</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['mapaba', 'pkd', 'sig', 'skp'].map(jenjangKey => {
                      const fieldName = `pendamping_${jenjangKey}_id`;
                      return (
                        <div key={jenjangKey} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', backgroundColor: '#fff' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#2563eb', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Pendamping {jenjangKey.toUpperCase()}</label>
                          <div className="hide-scroll" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                            {dataPendamping.map(p => (
                              <label key={p.id} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', marginBottom: '6px', cursor: 'pointer', color: 'var(--text-body)', fontWeight: '500' }}>
                                <input type="checkbox" value={p.username} checked={(editKaderModal[fieldName] || []).includes(p.username)} onChange={(e) => { const val = e.target.value; const currentArr = editKaderModal[fieldName] || []; if(e.target.checked) setEditKaderModal({...editKaderModal, [fieldName]: [...currentArr, val]}); else setEditKaderModal({...editKaderModal, [fieldName]: currentArr.filter((id: string) => id !== val)}); }} style={{ marginRight: '8px', accentColor: '#2563eb' }} />
                                {p.nama}
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                  })}
                </div>
              </div>

              <button disabled={isSubmitting} type="submit" className="btn-main" style={{ marginTop: '8px' }}>
                {isSubmitting ? 'Memproses...' : '💾 Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}