'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';

export default function PageDatabaseKader() {
  const [databaseKader, setDatabaseKader] = useState<any[]>([]);
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  const [dataPendamping, setDataPendamping] = useState<any[]>([]);

  const [searchKader, setSearchKader] = useState('');
  const [filterRayonKader, setFilterRayonKader] = useState('');
  const [kaderPage, setKaderPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [editKaderModal, setEditKaderModal] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk melacak ID kader yang dicentang
  const [selectedKaderIds, setSelectedKaderIds] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const listKader: any[] = []; const listRayon: any[] = []; const listPendamping: any[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        if (d.role === 'kader') listKader.push({ id: doc.id, ...d });
        else if (d.role === 'rayon') listRayon.push({ id: doc.id, ...d });
        else if (d.role === 'pendamping') listPendamping.push({ id: doc.id, ...d });
      });
      setDatabaseKader(listKader); setDataRayon(listRayon); setDataPendamping(listPendamping);
    });
    return () => unsub();
  }, []);

  const getNamaRayon = (idRayon: string) => {
    if (idRayon === 'Komisariat' || idRayon === 'Pusat Komisariat') return 'Pusat Komisariat';
    const r = dataRayon.find(x => x.id_rayon === idRayon || x.username === idRayon);
    return r ? r.nama : idRayon;
  };

  const filteredKaderDB = databaseKader.filter(kader => {
    const matchSearch = kader.nama?.toLowerCase().includes(searchKader.toLowerCase()) || kader.nim?.includes(searchKader);
    const matchRayon = filterRayonKader === '' || kader.id_rayon === filterRayonKader;
    return matchSearch && matchRayon;
  });

  const indexOfLastKader = kaderPage * itemsPerPage;
  const indexOfFirstKader = indexOfLastKader - itemsPerPage;
  const currentKaderDisplay = filteredKaderDB.slice(indexOfFirstKader, indexOfLastKader);

  // Fungsi Centang Satu Per Satu
  const handleToggleSelect = (kaderId: string) => {
    setSelectedKaderIds(prev =>
      prev.includes(kaderId) ? prev.filter(id => id !== kaderId) : [...prev, kaderId]
    );
  };

  // Fungsi Centang Semua (Select All) di Halaman Saat Ini
  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const visibleIds = currentKaderDisplay.map(k => k.id);
      setSelectedKaderIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    } else {
      const visibleIds = currentKaderDisplay.map(k => k.id);
      setSelectedKaderIds(prev => prev.filter(id => !visibleIds.includes(id)));
    }
  };

  // Fungsi Hapus Massal (Bulk Delete)
  const handleHapusTerpilih = async () => {
    if (selectedKaderIds.length === 0) return;
    if (!window.confirm(`PERINGATAN KERAS!\nAnda yakin ingin menghapus TOTAL ${selectedKaderIds.length} kader yang dicentang dari seluruh sistem?\nSemua nilai, tugas, dan histori akan lenyap!`)) return;

    setIsSubmitting(true);
    try {
      for (const id of selectedKaderIds) {
        const kader = databaseKader.find(k => k.id === id);
        if (kader) {
          await deleteDoc(doc(db, "users", kader.id));
          if (kader.nim) {
            await deleteDoc(doc(db, "nilai_khs", kader.nim));
            await deleteDoc(doc(db, "evaluasi_kader", kader.nim));
          }
          if (kader.email) {
            const snapBerkas = await getDocs(query(collection(db, "berkas_kader"), where("email_kader", "==", kader.email)));
            snapBerkas.forEach(d => deleteDoc(d.ref));
          }
        }
      }
      alert(`${selectedKaderIds.length} kader telah dihapus secara permanen dari sistem.`);
      setSelectedKaderIds([]); // Reset centang setelah berhasil dihapus
    } catch (error) {
      alert("Gagal menghapus beberapa data kader.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export seluruh database kader ke Excel
  const handleExportExcel = () => {
    if (databaseKader.length === 0) return alert("Kosong!");
    const dataToExport = databaseKader.map((k, i) => ({
      "No": i + 1, "NIM": k.nim || '-', "Nama": k.nama || '-', "Asal Rayon": getNamaRayon(k.id_rayon), "Jenjang": k.jenjang || 'MAPABA', "Status": k.status || 'Aktif'
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Database Kader"); XLSX.writeFile(wb, `Database_Kader_Komisariat_${Date.now()}.xlsx`);
  };

  // Ubah status Aktif / Pasif
  const handleUbahStatusKader = async (kader: any) => {
    const statusBaru = kader.status === "Aktif" ? "Pasif" : "Aktif";
    if (!window.confirm(`Ubah status ke ${statusBaru}?`)) return;
    try { await updateDoc(doc(db, "users", kader.id), { status: statusBaru }); } catch (error) {}
  };

  // Hapus total satu kader dari sistem
  const handleHapusKaderTotal = async (kader: any) => {
    if (!window.confirm(`Yakin hapus TOTAL dari sistem?`)) return;
    try {
      await deleteDoc(doc(db, "users", kader.id)); await deleteDoc(doc(db, "nilai_khs", kader.nim)); await deleteDoc(doc(db, "evaluasi_kader", kader.nim));
      if (kader.email) { const snapBerkas = await getDocs(query(collection(db, "berkas_kader"), where("email_kader", "==", kader.email))); snapBerkas.forEach(d => deleteDoc(d.ref)); }
      alert("Kader dihapus permanen.");
    } catch (error) {}
  };

  // Buka modal edit untuk satu kader
  const bukaEditKader = (kader: any) => {
    setEditKaderModal({ oldNim: kader.nim, id: kader.id, nim: kader.nim, nama: kader.nama, nia: kader.nia || '', angkatan: kader.angkatan || '', id_rayon: kader.id_rayon || '', jenjang: kader.jenjang || 'MAPABA', riwayat_kaderisasi: kader.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false } });
  };

  const handleSimpanEditKader = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const newNim = editKaderModal.nim.trim();
      const docRef = doc(db, "users", editKaderModal.id);

      if (newNim !== editKaderModal.oldNim) {
         const oldNim = editKaderModal.oldNim;
         const newEmail = `${newNim}@pmii-uinmalang.or.id`.toLowerCase();
         const oldEmail = `${oldNim}@pmii-uinmalang.or.id`.toLowerCase();

         // 1. Pindahkan Data Profil Users
         const oldKaderData = (await getDocs(query(collection(db, "users"), where("nim", "==", oldNim)))).docs[0]?.data() || {};
         await setDoc(doc(db, "users", newNim), { ...oldKaderData, nim: newNim, nama: editKaderModal.nama, id_rayon: editKaderModal.id_rayon, jenjang: editKaderModal.jenjang, email: newEmail });
         await deleteDoc(docRef);

         // 2. Migrasi nilai_khs (Salin ke NIM baru, hapus NIM lama)
         const oldNilaiSnap = await getDocs(query(collection(db, "nilai_khs"), where("__name__", "==", oldNim)));
         if (!oldNilaiSnap.empty) {
             await setDoc(doc(db, "nilai_khs", newNim), oldNilaiSnap.docs[0].data());
             await deleteDoc(doc(db, "nilai_khs", oldNim));
         }

         // 3. Migrasi evaluasi_kader
         const oldEvaluasiSnap = await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", oldNim)));
         if (!oldEvaluasiSnap.empty) {
             await setDoc(doc(db, "evaluasi_kader", newNim), oldEvaluasiSnap.docs[0].data());
             await deleteDoc(doc(db, "evaluasi_kader", oldNim));
         }

         // 4. Update relasi di jawaban_tes
         const tesSnap = await getDocs(query(collection(db, "jawaban_tes"), where("nim", "==", oldNim)));
         tesSnap.forEach(async (d) => await updateDoc(doc(db, "jawaban_tes", d.id), { nim: newNim }));

         // 5. Update relasi email di berkas_kader
         const berkasSnap = await getDocs(query(collection(db, "berkas_kader"), where("email_kader", "==", oldEmail)));
         berkasSnap.forEach(async (d) => await updateDoc(doc(db, "berkas_kader", d.id), { email_kader: newEmail }));

         alert("Data, NIM, dan seluruh riwayat kader berhasil diperbarui!");
      } else {
         await updateDoc(docRef, { nama: editKaderModal.nama, id_rayon: editKaderModal.id_rayon, jenjang: editKaderModal.jenjang });
         alert("Data diperbarui!");
      }
      setEditKaderModal(null);
    } catch (error) {
      alert("Gagal memperbarui data. Cek koneksi Anda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const semuaTercentang = currentKaderDisplay.length > 0 && currentKaderDisplay.every(k => selectedKaderIds.includes(k.id));

  return (
    <>
      <style>{`
        .km-wrapper { display: flex; flex-direction: column; gap: 20px; box-sizing: border-box; width: 100%; }

        .km-card {
          background: #ffffff; border-radius: 12px; border: 1px solid #eaeaea;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02); box-sizing: border-box;
        }

        .form-control-custom {
          width: 100%; padding: 10px 14px; border: 1px solid #e3e6ec; background-color: #ffffff;
          border-radius: 8px; font-size: 0.85rem; outline: none; color: #0f1b2e;
          transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; font-family: inherit;
        }
        .form-control-custom:focus { border-color: #28395a; box-shadow: 0 0 0 3px rgba(40, 57, 90, 0.08); }

        .btn-main {
          background-color: #0f1b2e; color: #ffffff; border: none; padding: 10px 18px;
          border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.82rem;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          transition: background-color 0.2s;
        }
        .btn-main:hover { background-color: #28395a; }
        .btn-main:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-gold {
          background-color: #f5c518; color: #0f1b2e; border: 1px solid #e3b300; padding: 8px 14px;
          border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.78rem;
        }
        .btn-danger {
          background-color: #fef2f2; color: #c0392b; border: 1px solid #fadbd8; padding: 8px 14px;
          border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.78rem;
        }
        .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

        .km-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .km-table th {
          background-color: #f6f7fa; color: #0f1b2e; padding: 13px 16px; font-weight: 700;
          font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.02em;
          border-bottom: 1px solid #eaeaea; white-space: nowrap;
        }
        .km-table td { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }

        .km-badge {
          display: inline-flex; background-color: #eef1f7; color: #28395a; padding: 4px 10px;
          border-radius: 20px; font-size: 0.7rem; font-weight: 700;
        }
        .km-status { display: inline-flex; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; }
        .km-status.aktif { background-color: #e8f5e9; color: #2e7d32; }
        .km-status.pasif { background-color: #ffebee; color: #c62828; }

        .km-mcard {
          background: #ffffff; border: 1px solid #eaeaea; border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02); padding: 14px;
        }
        .km-mcard.selected { border-color: #f5c518; background: #fffdf3; }

        .desktop-view { display: block; }
        .mobile-view { display: none; }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
          .desktop-view { display: none !important; }
          .mobile-view { display: block !important; }
        }
      `}</style>

      {/* ========================================================== */}
      {/* TAMPILAN DESKTOP                                           */}
      {/* ========================================================== */}
      <div className="desktop-view km-wrapper">

        {/* Header Halaman */}
        <div className="km-card" style={{ padding: '22px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '3px solid #f5c518' }}>
          <div>
            <h3 style={{ color: '#0f1b2e', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Database Kader Global (Super Admin)</h3>
            <p style={{ fontSize: '0.82rem', color: '#7a8699', margin: '6px 0 0 0' }}>Manajemen data kader tingkat pusat. Perubahan memengaruhi seluruh sistem.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedKaderIds.length > 0 && (
              <button onClick={handleHapusTerpilih} disabled={isSubmitting} className="btn-danger" style={{ padding: '10px 18px', fontSize: '0.82rem' }}>
                🗑️ {isSubmitting ? 'Menghapus...' : `Hapus Terpilih (${selectedKaderIds.length})`}
              </button>
            )}
            <button onClick={handleExportExcel} className="btn-main">📥 Export Excel</button>
          </div>
        </div>

        {/* Kartu Filter + Tabel */}
        <div className="km-card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: '12px', backgroundColor: '#fbfbfd', padding: '16px 20px', borderBottom: '1px solid #eaeaea', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="🔍 Cari NIM atau Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} className="form-control-custom" style={{ flex: '1 1 220px' }} />
            <select value={filterRayonKader} onChange={(e) => setFilterRayonKader(e.target.value)} className="form-control-custom" style={{ flex: '1 1 180px', cursor: 'pointer' }}>
              <option value="">-- Semua Rayon --</option>
              {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.8rem', color: '#7a8699', fontWeight: 700 }}>Tampilkan:</span>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setKaderPage(1); }} className="form-control-custom" style={{ width: '130px', cursor: 'pointer', fontWeight: 700, color: '#28395a' }}>
                <option value={10}>10 Baris</option><option value={50}>50 Baris</option><option value={100}>100 Baris</option>
              </select>
            </div>
          </div>

          <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
            <table className="km-table" style={{ minWidth: '1000px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: '3%' }}>
                    <input
                      type="checkbox"
                      checked={semuaTercentang}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#0f1b2e' }}
                    />
                  </th>
                  <th style={{ textAlign: 'center', width: '5%' }}>No</th>
                  <th style={{ textAlign: 'center', width: '10%' }}>NIM</th>
                  <th style={{ width: '30%' }}>Nama Lengkap</th>
                  <th style={{ textAlign: 'center', width: '25%' }}>Instansi</th>
                  <th style={{ textAlign: 'center', width: '5%' }}>Jenjang</th>
                  <th style={{ textAlign: 'center', width: '5%' }}>Status</th>
                  <th style={{ textAlign: 'center', width: '20%' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentKaderDisplay.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '45px', textAlign: 'center', color: '#9aa3b2' }}>Data tidak ditemukan.</td></tr>
                ) : (
                  currentKaderDisplay.map((kader, idx) => (
                    <tr key={kader.nim} style={{ backgroundColor: selectedKaderIds.includes(kader.id) ? '#fffdf3' : 'transparent', transition: 'background-color 0.2s' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedKaderIds.includes(kader.id)}
                          onChange={() => handleToggleSelect(kader.id)}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#f5c518' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center', color: '#9aa3b2' }}>{indexOfFirstKader + idx + 1}</td>
                      <td style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, color: '#0f1b2e' }}>{kader.nim}</div></td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f1b2e' }}>{kader.nama}</div>
                        <div style={{ color: '#9aa3b2', fontSize: '0.74rem' }}>Thn: {kader.angkatan || '-'}</div>
                      </td>
                      <td style={{ color: '#28395a', fontWeight: 700, textAlign: 'center', fontSize: '0.82rem' }}>{getNamaRayon(kader.id_rayon)}</td>
                      <td style={{ textAlign: 'center' }}><span className="km-badge">{kader.jenjang || 'MAPABA'}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <div onClick={() => handleUbahStatusKader(kader)} className={`km-status ${(!kader.status || kader.status === 'Aktif') ? 'aktif' : 'pasif'}`}>{(!kader.status || kader.status === 'Aktif') ? 'Aktif' : 'Pasif'}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button onClick={() => bukaEditKader(kader)} className="btn-gold">✏️ Edit</button>
                          <button onClick={() => handleHapusKaderTotal(kader)} className="btn-danger">🗑️ Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #eaeaea', backgroundColor: '#fbfbfd' }}>
            <span style={{ fontSize: '0.82rem', color: '#7a8699', fontWeight: 700 }}>Halaman {kaderPage} &middot; {filteredKaderDB.length} kader</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={kaderPage === 1} onClick={() => setKaderPage(kaderPage - 1)} style={{ padding: '8px 16px', border: '1px solid #e3e6ec', borderRadius: '8px', cursor: kaderPage === 1 ? 'not-allowed' : 'pointer', background: '#fff', fontSize: '0.82rem', fontWeight: 700, color: '#28395a' }}>⬅️ Sebelumnya</button>
              <button onClick={() => setKaderPage(kaderPage + 1)} style={{ padding: '8px 16px', border: '1px solid #e3e6ec', borderRadius: '8px', cursor: 'pointer', background: '#fff', fontSize: '0.82rem', fontWeight: 700, color: '#28395a' }}>Selanjutnya ➡️</button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* TAMPILAN MOBILE                                            */}
      {/* ========================================================== */}
      <div className="mobile-view">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div className="km-card" style={{ padding: '16px', borderTop: '3px solid #f5c518' }}>
            <h3 style={{ color: '#0f1b2e', margin: 0, fontSize: '1rem', fontWeight: 800 }}>Database Kader Global</h3>
            <p style={{ fontSize: '0.75rem', color: '#7a8699', margin: '6px 0 12px 0', lineHeight: 1.5 }}>Manajemen data kader tingkat pusat. Perubahan memengaruhi seluruh sistem.</p>
            <button onClick={handleExportExcel} className="btn-main" style={{ width: '100%' }}>📥 Export Excel</button>
          </div>

          <div className="km-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="🔍 Cari NIM atau Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} className="form-control-custom" />
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={filterRayonKader} onChange={(e) => setFilterRayonKader(e.target.value)} className="form-control-custom" style={{ flex: 1, cursor: 'pointer' }}>
                <option value="">Semua Rayon</option>
                {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
              </select>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setKaderPage(1); }} className="form-control-custom" style={{ width: '105px', cursor: 'pointer' }}>
                <option value={10}>10 Baris</option><option value={50}>50 Baris</option><option value={100}>100 Baris</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#28395a', cursor: 'pointer' }}>
              <input type="checkbox" checked={semuaTercentang} onChange={handleToggleSelectAll} style={{ accentColor: '#0f1b2e', transform: 'scale(1.15)' }} />
              Centang semua di halaman ini
            </label>
          </div>

          {selectedKaderIds.length > 0 && (
            <button onClick={handleHapusTerpilih} disabled={isSubmitting} className="btn-danger" style={{ width: '100%', padding: '12px' }}>
              🗑️ {isSubmitting ? 'Menghapus...' : `Hapus Terpilih (${selectedKaderIds.length})`}
            </button>
          )}

          {currentKaderDisplay.length === 0 ? (
            <div className="km-card" style={{ padding: '32px 16px', textAlign: 'center', color: '#9aa3b2', fontSize: '0.85rem' }}>Data tidak ditemukan.</div>
          ) : (
            currentKaderDisplay.map((kader, idx) => (
              <div key={kader.nim} className={`km-mcard ${selectedKaderIds.includes(kader.id) ? 'selected' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={selectedKaderIds.includes(kader.id)}
                    onChange={() => handleToggleSelect(kader.id)}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#f5c518', marginTop: '3px' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.68rem', color: '#9aa3b2', fontWeight: 700 }}>#{indexOfFirstKader + idx + 1} &middot; NIM {kader.nim}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f1b2e', marginTop: '2px' }}>{kader.nama}</div>
                    <div style={{ fontSize: '0.75rem', color: '#28395a', fontWeight: 600, marginTop: '2px' }}>{getNamaRayon(kader.id_rayon)}</div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span className="km-badge">{kader.jenjang || 'MAPABA'}</span>
                      <span className="km-badge" style={{ backgroundColor: '#fff8e1', color: '#8a6d00' }}>Thn {kader.angkatan || '-'}</span>
                      <div onClick={() => handleUbahStatusKader(kader)} className={`km-status ${(!kader.status || kader.status === 'Aktif') ? 'aktif' : 'pasif'}`}>{(!kader.status || kader.status === 'Aktif') ? 'Aktif' : 'Pasif'}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
                  <button onClick={() => bukaEditKader(kader)} className="btn-gold" style={{ flex: 1 }}>✏️ Edit</button>
                  <button onClick={() => handleHapusKaderTotal(kader)} className="btn-danger" style={{ flex: 1 }}>🗑️ Hapus</button>
                </div>
              </div>
            ))
          )}

          <div className="km-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}>
            <button disabled={kaderPage === 1} onClick={() => setKaderPage(kaderPage - 1)} style={{ padding: '8px 14px', border: '1px solid #e3e6ec', borderRadius: '8px', cursor: kaderPage === 1 ? 'not-allowed' : 'pointer', background: '#fbfbfd', fontSize: '0.78rem', fontWeight: 700, color: '#28395a' }}>⬅️ Seb</button>
            <span style={{ fontSize: '0.78rem', color: '#7a8699', fontWeight: 700 }}>Hal {kaderPage}</span>
            <button onClick={() => setKaderPage(kaderPage + 1)} style={{ padding: '8px 14px', border: '1px solid #e3e6ec', borderRadius: '8px', cursor: 'pointer', background: '#fbfbfd', fontSize: '0.78rem', fontWeight: 700, color: '#28395a' }}>Sel ➡️</button>
          </div>

          <div style={{ height: '80px' }}></div>
        </div>
      </div>

      {/* MODAL KELOLA EDIT SUPER ADMIN */}
      {editKaderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,27,46,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '16px' }}>
          <div className="hide-scroll" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <button onClick={() => setEditKaderModal(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: '#f6f7fa', border: '1px solid #eaeaea', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, color: '#7a8699' }}>✖</button>
            <h3 style={{ marginTop: 0, color: '#0f1b2e', borderBottom: '2px solid #f5c518', paddingBottom: '12px', marginBottom: '20px', fontSize: '1.05rem', fontWeight: 800 }}>⚙️ Edit Kader</h3>
            <form onSubmit={handleSimpanEditKader} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#7a8699', fontWeight: 700, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Nama Lengkap</label>
                <input type="text" required placeholder="Nama Lengkap" value={editKaderModal.nama} onChange={e => setEditKaderModal({...editKaderModal, nama: e.target.value})} className="form-control-custom" />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#7a8699', fontWeight: 700, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>NIM</label>
                <input type="text" required placeholder="NIM" value={editKaderModal.nim} onChange={e => setEditKaderModal({...editKaderModal, nim: e.target.value})} className="form-control-custom" />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#7a8699', fontWeight: 700, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Asal Rayon</label>
                <select value={editKaderModal.id_rayon} onChange={e => setEditKaderModal({...editKaderModal, id_rayon: e.target.value})} required className="form-control-custom" style={{ cursor: 'pointer' }}>
                  {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#7a8699', fontWeight: 700, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Jenjang</label>
                <select value={editKaderModal.jenjang} onChange={e => setEditKaderModal({...editKaderModal, jenjang: e.target.value})} className="form-control-custom" style={{ cursor: 'pointer' }}>
                  <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
                </select>
              </div>
              <button disabled={isSubmitting} type="submit" className="btn-main" style={{ padding: '14px', marginTop: '4px' }}>{isSubmitting ? 'Memproses...' : '💾 Simpan'}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
