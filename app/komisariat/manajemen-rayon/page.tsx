'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';
import * as XLSX from 'xlsx';

export default function PageManajemenRayon() {
  const [tabAkunPusat, setTabAkunPusat] = useState('rayon');
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  const [databaseKader, setDatabaseKader] = useState<any[]>([]);
  const [dataPendamping, setDataPendamping] = useState<any[]>([]);
  
  const [formRayon, setFormRayon] = useState({ id_rayon: '', nama_rayon: '', password: '' });
  const [formPendampingSKP, setFormPendampingSKP] = useState({ nama: '', username: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- STATE KHUSUS KADER SKP ---
  const [modeInputKaderSKP, setModeInputKaderSKP] = useState<'pilih' | 'baru' | 'import'>('pilih');
  const [formPilihKaderSKP, setFormPilihKaderSKP] = useState({ nim: '', pendampingId: [] as string[] });
  
  // DITAMBAHKAN: Field nama_rayon_luar untuk menangkap teks input manual delegasi luar
  const [formKaderSKP, setFormKaderSKP] = useState({ nim: '', nama: '', password: '', id_rayon: '', nama_rayon_luar: '', pendampingId: [] as string[], angkatan: new Date().getFullYear().toString() });
  const [importProgress, setImportProgress] = useState('');

  // --- FETCH DATA ---
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const listKader: any[] = []; const listRayon: any[] = []; const listPendamping: any[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'kader') { listKader.push({ id: doc.id, ...data }); } 
        else if (data.role === 'pendamping') { listPendamping.push({ id: doc.id, ...data }); } 
        else if (data.role === 'rayon') { listRayon.push({ id: doc.id, ...data }); }
      });
      setDatabaseKader(listKader); setDataRayon(listRayon); setDataPendamping(listPendamping);
    });
    return () => unsubUsers();
  }, []);

  const getSecondaryAuth = () => { 
    const apps = getApps(); 
    const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(auth.app.options, 'SecondaryApp'); 
    return getAuth(secondaryApp); 
  };

  const getNamaRayon = (idRayon: string) => {
    if (idRayon === 'Komisariat' || idRayon === 'Pusat Komisariat') return 'Pusat Komisariat';
    const rayon = dataRayon.find(r => r.id_rayon === idRayon || r.username === idRayon);
    return rayon ? rayon.nama : idRayon;
  };

  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        aktor: "PK. PMII Sunan Ampel Malang",
        role: "komisariat",
        aksi: aksi,
        timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  // --- FUNGSI INSTANSI & PENDAMPING ---
  const handleBuatAkunRayon = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeUsername = formRayon.id_rayon.trim().toLowerCase(); 
      const emailBaru = `${safeUsername}@pmii-uinmalang.or.id`;
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formRayon.password);
      await setDoc(doc(db, "users", safeUsername), { nama: formRayon.nama_rayon, username: safeUsername, id_rayon: safeUsername, email: emailBaru, role: "rayon", status: "Aktif", createdAt: Date.now() });
      await setDoc(doc(db, "settings_rayon", safeUsername), { id: safeUsername, nama: formRayon.nama_rayon, pengumuman: `Selamat datang di ${formRayon.nama_rayon}.`, warnaUtama: "#004a87", warnaAksen: "#f1c40f" });
      await signOutSecondary(secondaryAuth); 
      catatLogAktivitas(`Mendaftarkan Instansi Rayon Baru: ${formRayon.nama_rayon}`);
      alert(`Sukses! Akun Admin Rayon berhasil dibuat.`); 
      setFormRayon({ id_rayon: '', nama_rayon: '', password: '' });
    } catch (error: any) { alert("Gagal membuat akun Rayon: " + error.message); } finally { setIsSubmitting(false); }
  };

  const handleBuatAkunPendampingSKP = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeUsername = formPendampingSKP.username.trim().toLowerCase(); const emailBaru = `${safeUsername}@pmii-uinmalang.or.id`;
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formPendampingSKP.password);
      await setDoc(doc(db, "users", safeUsername), { nama: formPendampingSKP.nama, username: safeUsername, email: emailBaru, role: "pendamping", id_rayon: "Komisariat", jenjangTugas: "SKP", status: "Aktif", createdAt: Date.now() });
      await signOutSecondary(secondaryAuth); 
      catatLogAktivitas(`Mendaftarkan Pendamping SKP: ${formPendampingSKP.nama}`);
      alert(`Sukses! Akun Pendamping SKP berhasil dibuat.`); 
      setFormPendampingSKP({ nama: '', username: '', password: '' });
    } catch (error: any) { alert("Gagal membuat Pendamping SKP."); } finally { setIsSubmitting(false); }
  };

  // --- FUNGSI KADER SKP ---
  const handlePlotKaderSKP = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    if (!formPilihKaderSKP.nim || formPilihKaderSKP.pendampingId.length === 0) { 
      alert("Harap lengkapi pilihan kader dan centang minimal 1 pendamping!"); setIsSubmitting(false); return; 
    }
    try {
      await updateDoc(doc(db, "users", formPilihKaderSKP.nim), { jenjang: "SKP", pendamping_skp_id: formPilihKaderSKP.pendampingId });
      catatLogAktivitas(`Meng-upgrade NIM ${formPilihKaderSKP.nim} menjadi peserta SKP.`);
      alert("Berhasil memplotkan/upgrade kader menjadi peserta SKP!"); setFormPilihKaderSKP({nim: '', pendampingId: []});
    } catch(err) { alert("Gagal memplotkan kader."); } finally { setIsSubmitting(false); }
  };

  const handleKeluarkanKaderSKP = async (nim: string) => {
    if (!window.confirm("Keluarkan kader ini dari program SKP? (Akun tidak akan dihapus, hanya dilepas status SKP-nya)")) return;
    try { await updateDoc(doc(db, "users", nim), { jenjang: "SIG", pendamping_skp_id: [] }); catatLogAktivitas(`Melepas NIM ${nim} dari program SKP.`); } catch (error) {}
  };

  const handleBuatAkunKaderSKP_Manual = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeNim = formKaderSKP.nim.trim(); const emailBaru = `${safeNim}@pmii-uinmalang.or.id`.toLowerCase();
      
      // LOGIKA PENENTUAN NAMA ASAL RAYON FINAL
      let finalAsalRayon = formKaderSKP.id_rayon || "Luar Komisariat";
      if (formKaderSKP.id_rayon === "Luar Komisariat" && formKaderSKP.nama_rayon_luar.trim() !== "") {
         finalAsalRayon = formKaderSKP.nama_rayon_luar.trim();
      }

      const existingKader = databaseKader.find(k => k.nim === safeNim);
      if (existingKader) {
        await updateDoc(doc(db, "users", existingKader.id), { jenjang: "SKP", pendamping_skp_id: formKaderSKP.pendampingId });
        catatLogAktivitas(`Menghubungkan Kader Lama ke SKP: ${existingKader.nama}`);
        alert(`Kader dengan NIM ${safeNim} sudah terdaftar di sistem. Data berhasil diperbarui dan dihubungkan ke SKP!`);
      } else {
        await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formKaderSKP.password);
        const tanggalBuatModif = new Date(); tanggalBuatModif.setFullYear(parseInt(formKaderSKP.angkatan));
        await setDoc(doc(db, "users", safeNim), {
          nim: safeNim, nama: formKaderSKP.nama, email: emailBaru, role: "kader",
          id_rayon: finalAsalRayon, jenjang: "SKP", pendamping_skp_id: formKaderSKP.pendampingId, status: "Aktif", createdAt: tanggalBuatModif.getTime()
        });
        await signOutSecondary(secondaryAuth); catatLogAktivitas(`Mendaftarkan Akun Kader SKP Baru: ${formKaderSKP.nama}`); alert(`Sukses! Akun Kader SKP baru berhasil dibuat.`);
      }
      setFormKaderSKP({ nim: '', nama: '', password: '', id_rayon: '', nama_rayon_luar: '', pendampingId: [], angkatan: new Date().getFullYear().toString() });
    } catch (error: any) { alert("Gagal memproses Kader SKP: " + error.message); } finally { setIsSubmitting(false); }
  };

  const handleImportExcelSKP = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fileInput = (e.target as HTMLFormElement).elements[0] as HTMLInputElement; const file = fileInput?.files?.[0];
    if (!file) return alert("Pilih file!"); setIsSubmitting(true); setImportProgress("Membaca file Excel..."); const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' }); const wsname = wb.SheetNames[0]; const ws = wb.Sheets[wsname]; const data = XLSX.utils.sheet_to_json(ws); 
        if (data.length === 0) throw new Error("Kosong."); const secondaryAuth = getSecondaryAuth(); let successCount = 0; let errorCount = 0; let updateCount = 0;
        
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i]; 
          const nim = String(row['NIM'] || row['nim'] || '').trim(); const nama = row['Nama'] || row['nama'] || ''; const asalRayon = row['Asal Rayon'] || row['asal rayon'] || row['Rayon'] || 'Luar Komisariat';
          const angkatan = String(row['Angkatan'] || row['angkatan'] || new Date().getFullYear()).trim(); const password = String(row['Password'] || row['password'] || '').trim() || nim; 
          let pendampingInput = String(row['Pendamping'] || row['pendamping'] || '').trim(); let pendampingArray: string[] = [];
          if (pendampingInput) {
             const names = pendampingInput.split(',').map(n => n.trim());
             names.forEach(n => {
                 const matched = dataPendamping.find(p => p.nama.toLowerCase() === n.toLowerCase() || p.username.toLowerCase() === n.toLowerCase());
                 if (matched) pendampingArray.push(matched.username); else pendampingArray.push(n); 
             });
          }
          if (!nim || !nama) { errorCount++; continue; }
          setImportProgress(`Memproses: ${nama} (${i + 1}/${data.length})`);
          const existingKader = databaseKader.find(k => k.nim === nim);
          if (existingKader) {
              await updateDoc(doc(db, "users", existingKader.id), { jenjang: "SKP", pendamping_skp_id: pendampingArray }); updateCount++;
          } else {
              const emailBaru = `${nim}@pmii-uinmalang.or.id`.toLowerCase();
              try {
                await createUserWithEmailAndPassword(secondaryAuth, emailBaru, password);
                const tanggalBuatModif = new Date(); tanggalBuatModif.setFullYear(parseInt(angkatan));
                await setDoc(doc(db, "users", nim), { nim: nim, nama: nama, email: emailBaru, role: "kader", id_rayon: asalRayon, jenjang: "SKP", pendamping_skp_id: pendampingArray, angkatan: angkatan, status: "Aktif", createdAt: tanggalBuatModif.getTime() }); 
                successCount++;
              } catch(err: any) { errorCount++; }
          }
        }
        await signOutSecondary(secondaryAuth); alert(`Selesai! Buat Baru: ${successCount}. Update Lama (Link to SKP): ${updateCount}. Gagal: ${errorCount}`); fileInput.value = ''; 
      } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); setImportProgress(''); }
    };
    reader.readAsBinaryString(file);
  };

  // --- FUNGSI GENERAL ---
  const handleUbahStatusAkun = async (idAkun: string, statusSekarang: string) => {
    const statusBaru = statusSekarang === "Aktif" ? "Pasif" : "Aktif"; 
    if (!window.confirm(`Ubah status akun ini menjadi ${statusBaru}?`)) return;
    try { await updateDoc(doc(db, "users", idAkun), { status: statusBaru }); } catch (error) {}
  };

  const handleHapusRayon = async (idRayon: string, namaRayon: string) => {
    if (!window.confirm(`PERINGATAN! Anda yakin ingin menghapus permanen akun Rayon "${namaRayon}"?`)) return;
    try { await deleteDoc(doc(db, "users", idRayon)); await deleteDoc(doc(db, "settings_rayon", idRayon)); alert(`Akun dihapus.`); } catch (error) {}
  };

  const handleHapusAkunLain = async (idAkun: string, namaAkun: string) => {
    if (!window.confirm(`PERINGATAN! Anda yakin ingin menghapus permanen akun "${namaAkun}"?`)) return;
    try { await deleteDoc(doc(db, "users", idAkun)); } catch (error) {}
  };

  return (
    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
        <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Manajemen Akun & Instansi</h3>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <button onClick={() => setTabAkunPusat('rayon')} style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkunPusat === 'rayon' ? '#0000af' : '#f8f9fa', color: tabAkunPusat === 'rayon' ? 'white' : '#555', fontSize: '0.85rem', transition: '0.2s', border: 'none' }}>🏢 Instansi Rayon</button>
        <button onClick={() => setTabAkunPusat('pendamping-skp')} style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkunPusat === 'pendamping-skp' ? '#0000af' : '#f8f9fa', color: tabAkunPusat === 'pendamping-skp' ? 'white' : '#555', fontSize: '0.85rem', transition: '0.2s', border: 'none' }}>👩 Pendamping SKP</button>
        <button onClick={() => setTabAkunPusat('kader-skp')} style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkunPusat === 'kader-skp' ? '#0000af' : '#f8f9fa', color: tabAkunPusat === 'kader-skp' ? 'white' : '#555', fontSize: '0.85rem', transition: '0.2s', border: 'none' }}>🎓 Kader SKP</button>
      </div>

      {/* TAB INSTANSI RAYON */}
      {tabAkunPusat === 'rayon' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
            <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>✏️ Buat Akun Admin Rayon</h4>
            <form onSubmit={handleBuatAkunRayon} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
              <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Rayon</label><input type="text" value={formRayon.nama_rayon} onChange={e => setFormRayon({...formRayon, nama_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
              <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Username Login (Kode)</label><input type="text" value={formRayon.id_rayon} onChange={e => setFormRayon({...formRayon, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
              <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Password Login</label><input type="text" value={formRayon.password} onChange={e => setFormRayon({...formRayon, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '40px' }}>{isSubmitting ? 'Memproses...' : '+ Daftarkan Rayon'}</button>
            </form>
          </div>

          <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
            <table className="tabel-utama" style={{ minWidth: '400px' }}>
              <thead>
                <tr><th style={{ textAlign: 'center' }}>Nama Rayon</th><th style={{ textAlign: 'center' }}>Username</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>Aksi</th></tr>
              </thead>
              <tbody>
                {dataRayon.map((rayon) => (
                  <tr key={rayon.id}>
                    <td style={{ fontWeight: 'bold', color: '#0d1b2a', textAlign: 'center' }}>{rayon.nama}</td>
                    <td style={{ color: '#666', textAlign: 'center' }}>{rayon.username}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div onClick={() => handleUbahStatusAkun(rayon.id, rayon.status || 'Aktif')} style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!rayon.status || rayon.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!rayon.status || rayon.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                        {(!rayon.status || rayon.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><button onClick={() => handleHapusRayon(rayon.id, rayon.nama)} style={{ color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB PENDAMPING SKP */}
      {tabAkunPusat === 'pendamping-skp' && (
         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
         <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
           <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>✏️ Buat Pendamping SKP</h4>
           <form onSubmit={handleBuatAkunPendampingSKP} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
             <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Lengkap</label><input type="text" value={formPendampingSKP.nama} onChange={e => setFormPendampingSKP({...formPendampingSKP, nama: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
             <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Username Login</label><input type="text" value={formPendampingSKP.username} onChange={e => setFormPendampingSKP({...formPendampingSKP, username: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
             <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Password Login</label><input type="text" value={formPendampingSKP.password} onChange={e => setFormPendampingSKP({...formPendampingSKP, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px' }} /></div>
             <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '40px' }}>{isSubmitting ? 'Memproses...' : '+ Daftarkan'}</button>
           </form>
         </div>

         <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
           <table className="tabel-utama" style={{ minWidth: '400px' }}>
             <thead>
               <tr><th style={{ textAlign: 'center' }}>Nama Pendamping</th><th style={{ textAlign: 'center' }}>Username</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>Aksi</th></tr>
             </thead>
             <tbody>
               {dataPendamping.filter(p => p.jenjangTugas === 'SKP').map(p => (
                 <tr key={p.id}>
                   <td style={{ fontWeight: 'bold', color: '#0d1b2a', textAlign: 'center' }}>{p.nama}</td>
                   <td style={{ color: '#666', textAlign: 'center' }}>{p.username}</td>
                   <td style={{ textAlign: 'center' }}>
                     <div onClick={() => handleUbahStatusAkun(p.id, p.status || 'Aktif')} style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!p.status || p.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!p.status || p.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                       {(!p.status || p.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                     </div>
                   </td>
                   <td style={{ textAlign: 'center' }}><button onClick={() => handleHapusAkunLain(p.id, p.nama)} style={{ color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button></td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>
      )}

      {/* TAB KADER SKP */}
      {tabAkunPusat === 'kader-skp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button type="button" onClick={() => setModeInputKaderSKP('pilih')} style={{ flex: 1, padding: '10px 5px', fontSize: '0.75rem', fontWeight: 'bold', border: modeInputKaderSKP === 'pilih' ? 'none' : '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: modeInputKaderSKP === 'pilih' ? '#0000af' : '#fff', color: modeInputKaderSKP === 'pilih' ? '#fff' : '#555', transition: '0.2s' }}>Pilih Database</button>
              <button type="button" onClick={() => setModeInputKaderSKP('baru')} style={{ flex: 1, padding: '10px 5px', fontSize: '0.75rem', fontWeight: 'bold', border: modeInputKaderSKP === 'baru' ? 'none' : '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: modeInputKaderSKP === 'baru' ? '#0000af' : '#fff', color: modeInputKaderSKP === 'baru' ? '#fff' : '#555', transition: '0.2s' }}>Buat Manual</button>
              <button type="button" onClick={() => setModeInputKaderSKP('import')} style={{ flex: 1, padding: '10px 5px', fontSize: '0.75rem', fontWeight: 'bold', border: modeInputKaderSKP === 'import' ? 'none' : '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: modeInputKaderSKP === 'import' ? '#2ecc71' : '#fff', color: modeInputKaderSKP === 'import' ? '#fff' : '#555', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><span style={{fontSize: '0.9rem'}}>📗</span> Import</button>
            </div>

            {modeInputKaderSKP === 'pilih' ? (
              <form onSubmit={handlePlotKaderSKP} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ fontSize: '0.75rem', color: '#777', fontStyle: 'italic', marginBottom: '5px' }}>Upgrade Kader yg sudah ada di Rayon menjadi peserta SKP.</div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Pilih Kader</label>
                  <select value={formPilihKaderSKP.nim} onChange={e => setFormPilihKaderSKP({...formPilihKaderSKP, nim: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="" disabled>-- Cari Kader --</option>
                    {databaseKader.filter(k => k.jenjang !== 'SKP').map(k => <option key={k.id} value={k.nim}>{k.nama} ({getNamaRayon(k.id_rayon)})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Plot ke Pendamping SKP (Bisa pilih lebih dari 1)</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '6px', padding: '12px', backgroundColor: '#fafafa', marginTop: '5px' }}>
                    {dataPendamping.filter(p => p.jenjangTugas === 'SKP').map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', marginBottom: '10px', cursor: 'pointer', color: '#333' }}>
                        <input 
                          type="checkbox" 
                          value={p.username}
                          checked={formPilihKaderSKP.pendampingId.includes(p.username)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if(e.target.checked) setFormPilihKaderSKP(prev => ({...prev, pendampingId: [...prev.pendampingId, val]}));
                            else setFormPilihKaderSKP(prev => ({...prev, pendampingId: prev.pendampingId.filter(id => id !== val)}));
                          }}
                          style={{ marginRight: '12px', transform: 'scale(1.2)', accentColor: '#0000af' }}
                        />
                        {p.nama}
                      </label>
                    ))}
                    {dataPendamping.filter(p => p.jenjangTugas === 'SKP').length === 0 && <span style={{fontSize: '0.75rem', color: '#999'}}>Belum ada pendamping SKP terdaftar.</span>}
                  </div>
                </div>
                <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', fontSize: '0.9rem', width: '100%' }}>
                  {isSubmitting ? 'Memproses...' : '✓ Upgrade ke SKP'}
                </button>
              </form>
            ) : modeInputKaderSKP === 'baru' ? (
              <form onSubmit={handleBuatAkunKaderSKP_Manual} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'start' }}>
                <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: '#777', fontStyle: 'italic', marginBottom: '5px' }}>Khusus kader delegasi luar yang belum punya akun. Jika NIM sudah ada di sistem, otomatis akan dihubungkan ke SKP.</div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>NIM Kader</label>
                  <input type="text" placeholder="NIM Kader" value={formKaderSKP.nim} onChange={e => setFormKaderSKP({...formKaderSKP, nim: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none', marginTop: '5px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Lengkap</label>
                  <input type="text" placeholder="Nama Lengkap" value={formKaderSKP.nama} onChange={e => setFormKaderSKP({...formKaderSKP, nama: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none', marginTop: '5px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Asal Rayon</label>
                  <select value={formKaderSKP.id_rayon} onChange={e => setFormKaderSKP({...formKaderSKP, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff', marginTop: '5px' }}>
                     <option value="" disabled>-- Pilih Asal Rayon --</option>
                     {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                     <option value="Luar Komisariat">Delegasi Luar Komisariat</option>
                  </select>
                  
                  {/* INPUT MANUAL MUNCUL KETIKA DELEGASI LUAR DIPILIH */}
                  {formKaderSKP.id_rayon === 'Luar Komisariat' && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold' }}>Ketik Nama Asal Rayon / Instansi Luar</label>
                      <input 
                        type="text" 
                        placeholder="Misal: PMII Rayon Brawijaya" 
                        value={formKaderSKP.nama_rayon_luar} 
                        onChange={e => setFormKaderSKP({...formKaderSKP, nama_rayon_luar: e.target.value})} 
                        required 
                        style={{ width: '100%', padding: '8px', border: '1px dashed #e67e22', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.8rem', outline: 'none', marginTop: '5px' }} 
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Tahun Angkatan</label>
                  <input type="number" placeholder="Angkatan (Cth: 2026)" value={formKaderSKP.angkatan} onChange={e => setFormKaderSKP({...formKaderSKP, angkatan: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none', marginTop: '5px' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Pilih Pendamping SKP (Bisa lebih dari 1)</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '6px', padding: '12px', backgroundColor: '#fafafa', marginTop: '5px' }}>
                    {dataPendamping.filter(p => p.jenjangTugas === 'SKP').map(p => (
                      <label key={p.id} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.85rem', marginRight: '20px', marginBottom: '10px', cursor: 'pointer', color: '#333' }}>
                        <input 
                          type="checkbox" 
                          value={p.username}
                          checked={formKaderSKP.pendampingId.includes(p.username)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if(e.target.checked) setFormKaderSKP(prev => ({...prev, pendampingId: [...prev.pendampingId, val]}));
                            else setFormKaderSKP(prev => ({...prev, pendampingId: prev.pendampingId.filter(id => id !== val)}));
                          }}
                          style={{ marginRight: '8px', transform: 'scale(1.2)', accentColor: '#0000af' }}
                        />
                        {p.nama}
                      </label>
                    ))}
                    {dataPendamping.filter(p => p.jenjangTugas === 'SKP').length === 0 && <span style={{fontSize: '0.75rem', color: '#999'}}>Belum ada pendamping SKP.</span>}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                   <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Password Login</label>
                      <input type="text" placeholder="Password Login" value={formKaderSKP.password} onChange={e => setFormKaderSKP({...formKaderSKP, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                   </div>
                   <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', height: '40px' }}>
                     {isSubmitting ? 'Memproses...' : '+ Daftarkan Kader'}
                   </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleImportExcelSKP} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ fontSize: '0.75rem', color: '#555', fontStyle: 'italic', marginBottom: '5px', backgroundColor: '#fff3e0', padding: '10px', borderRadius: '6px', borderLeft: '4px solid #f39c12', lineHeight: '1.5' }}>
                  Format Kolom Excel (Baris Pertama Harus Persis):<br/>
                  <b>NIM | Nama | Asal Rayon | Angkatan | Password | Pendamping</b><br/><br/>
                  <span style={{color: '#c0392b'}}>*Kolom Pendamping bisa diisi lebih dari 1 dengan pemisah koma (Cth: Siti, Aisyah). Jika NIM sudah ada, akan otomatis di-upgrade ke SKP.</span>
                </div>
                <input type="file" accept=".xlsx, .xls" required style={{ padding: '10px', border: '2px dashed #2ecc71', borderRadius: '6px', backgroundColor: '#fcfcfc', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }} />
                <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.9rem', width: '100%' }}>
                  🚀 Mulai Import Data
                </button>
                {importProgress && <div style={{fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold', textAlign: 'center'}}>{importProgress}</div>}
              </form>
            )}
          </div>
          <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
            <table className="tabel-utama" style={{ minWidth: '800px' }}>
              <thead style={{ borderBottom: '2px solid #eee' }}>
                <tr>
                  <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>NIM / Thn</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Nama Kader</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Asal Instansi</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Pendamping SKP</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Status</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {databaseKader.filter(k => k.jenjang === 'SKP').length === 0 ? (
                  <tr><td colSpan={6} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada kader SKP yang terdaftar.</td></tr>
                ) : (
                  databaseKader.filter(k => k.jenjang === 'SKP').map(k => {
                    const thnMasuk = k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear() : '-');
                    
                    let namaPendampingDisplay = '-';
                    if (Array.isArray(k.pendamping_skp_id) && k.pendamping_skp_id.length > 0) {
                        namaPendampingDisplay = k.pendamping_skp_id.map((id:string) => dataPendamping.find(p=>p.username === id)?.nama || id).join(', ');
                    } else if (k.pendamping_skp_id && typeof k.pendamping_skp_id === 'string') {
                        namaPendampingDisplay = dataPendamping.find(p=>p.username === k.pendamping_skp_id)?.nama || k.pendamping_skp_id;
                    }

                    return (
                      <tr key={k.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '15px 10px', fontWeight: 'bold', color: '#555', textAlign: 'center' }}>{k.nim} <br/> <span style={{fontSize: '0.75rem', color: '#27ae60'}}>{thnMasuk}</span></td>
                        <td style={{ padding: '15px 10px', fontWeight: 'bold', color: '#0d1b2a', textAlign: 'center' }}>{k.nama}</td>
                        <td style={{ padding: '15px 10px', color: '#888', textAlign: 'center', fontSize: '0.8rem' }}>{getNamaRayon(k.id_rayon)}</td>
                        <td style={{ padding: '15px 10px', color: '#888', textAlign: 'center', fontSize: '0.8rem', fontStyle: namaPendampingDisplay === '-' ? 'italic' : 'normal' }}>{namaPendampingDisplay}</td>
                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                          <div onClick={() => handleUbahStatusAkun(k.id, k.status || 'Aktif')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!k.status || k.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!k.status || k.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: (!k.status || k.status === 'Aktif') ? '#2ecc71' : '#e74c3c' }}></span>
                            {(!k.status || k.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                          </div>
                        </td>
                        <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                          <button onClick={() => handleKeluarkanKaderSKP(k.nim)} style={{ color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#e74c3c'} onMouseOut={e => e.currentTarget.style.color = '#aaa'} title="Unplot Kader">🗑️</button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}