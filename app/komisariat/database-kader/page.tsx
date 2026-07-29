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

  return (
    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>Database Kader Global (Super Admin)</h3>
          <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Manajemen data kader tingkat pusat. Perubahan memengaruhi seluruh sistem.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedKaderIds.length > 0 && (
            <button onClick={handleHapusTerpilih} disabled={isSubmitting} style={{ backgroundColor: '#e74c3c', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
              🗑️ {isSubmitting ? 'Menghapus...' : `Hapus Terpilih (${selectedKaderIds.length})`}
            </button>
          )}
          <button onClick={() => {
            if (databaseKader.length === 0) return alert("Kosong!");
            const dataToExport = databaseKader.map((k, i) => ({
              "No": i + 1, "NIM": k.nim || '-', "Nama": k.nama || '-', "Asal Rayon": getNamaRayon(k.id_rayon), "Jenjang": k.jenjang || 'MAPABA', "Status": k.status || 'Aktif'
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Database Kader"); XLSX.writeFile(wb, `Database_Kader_Komisariat_${Date.now()}.xlsx`);
          }} style={{ backgroundColor: '#0000af', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📥 Export Excel
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', backgroundColor: '#fcfcfc', padding: '15px', borderRadius: '10px', border: '1px solid #eaeaea', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="Cari NIM atau Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} style={{ flex: '1 1 200px', padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} />
        <select value={filterRayonKader} onChange={(e) => setFilterRayonKader(e.target.value)} style={{ flex: '1 1 150px', padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
          <option value="">-- Semua Rayon --</option>
          {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
           <span style={{fontSize: '0.85rem', color: '#555', fontWeight: 'bold'}}>Tampilkan:</span>
           <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setKaderPage(1); }} style={{ padding: '8px 12px', border: '1px solid #0000af', color: '#0000af', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', outline: 'none' }}>
             <option value={10}>10 Baris</option><option value={50}>50 Baris</option><option value={100}>100 Baris</option>
           </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px' }}>
        <table className="tabel-utama" style={{ minWidth: '1000px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: '3%' }}>
                <input 
                  type="checkbox" 
                  checked={currentKaderDisplay.length > 0 && currentKaderDisplay.every(k => selectedKaderIds.includes(k.id))}
                  onChange={handleToggleSelectAll}
                  style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#0000af' }}
                />
              </th>
              <th style={{ textAlign: 'center', width: '4%' }}>No</th>
              <th style={{ textAlign: 'center', width: '15%' }}>NIM</th>
              <th style={{ textAlign: 'left', width: '23%' }}>Nama Lengkap</th>
              <th style={{ textAlign: 'center', width: '15%' }}>Instansi</th>
              <th style={{ textAlign: 'center', width: '10%' }}>Jenjang</th>
              <th style={{ textAlign: 'center', width: '10%' }}>Status</th>
              <th style={{ textAlign: 'center', width: '20%' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentKaderDisplay.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Data tidak ditemukan.</td></tr>
            ) : (
              currentKaderDisplay.map((kader, idx) => (
                <tr key={kader.nim} style={{ backgroundColor: selectedKaderIds.includes(kader.id) ? '#f0fbf4' : 'transparent', transition: 'background-color 0.2s' }}>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedKaderIds.includes(kader.id)}
                      onChange={() => handleToggleSelect(kader.id)}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)', accentColor: '#27ae60' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>{indexOfFirstKader + idx + 1}</td>
                  <td style={{ textAlign: 'center' }}><div style={{fontWeight: 'bold'}}>{kader.nim}</div></td>
                  <td><div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{kader.nama}</div><div style={{ color: '#888', fontSize: '0.75rem' }}>Thn: {kader.angkatan || '-'}</div></td>
                  <td style={{ color: '#1e824c', fontWeight: 'bold', textAlign: 'center', fontSize: '0.85rem' }}>{getNamaRayon(kader.id_rayon)}</td>
                  <td style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{kader.jenjang || 'MAPABA'}</span></td>
                  <td style={{ textAlign: 'center' }}>
                     <div onClick={async () => { const statusBaru = kader.status === "Aktif" ? "Pasif" : "Aktif"; if (!window.confirm(`Ubah status ke ${statusBaru}?`)) return; try { await updateDoc(doc(db, "users", kader.id), { status: statusBaru }); } catch (error) {} }} style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!kader.status || kader.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!kader.status || kader.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>{(!kader.status || kader.status === 'Aktif') ? 'Aktif' : 'Pasif'}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                      <button onClick={() => setEditKaderModal({ oldNim: kader.nim, id: kader.id, nim: kader.nim, nama: kader.nama, nia: kader.nia || '', angkatan: kader.angkatan || '', id_rayon: kader.id_rayon || '', jenjang: kader.jenjang || 'MAPABA', riwayat_kaderisasi: kader.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false } })} style={{ backgroundColor: '#f1c40f', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', transition: '0.2s' }}>✏️ Edit</button>
                      <button onClick={async () => {
                         if(!window.confirm(`Yakin hapus TOTAL dari sistem?`)) return;
                         try {
                           await deleteDoc(doc(db, "users", kader.id)); await deleteDoc(doc(db, "nilai_khs", kader.nim)); await deleteDoc(doc(db, "evaluasi_kader", kader.nim));
                           if (kader.email) { const snapBerkas = await getDocs(query(collection(db, "berkas_kader"), where("email_kader", "==", kader.email))); snapBerkas.forEach(d => deleteDoc(d.ref)); }
                           alert("Kader dihapus permanen.");
                         } catch (error) {}
                      }} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', transition: '0.2s' }}>🗑️ Hapus</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '0 10px' }}>
         <span style={{fontSize: '0.85rem', color: '#666', fontWeight: 'bold'}}>Halaman {kaderPage}</span>
         <div style={{ display: 'flex', gap: '8px' }}>
            <button disabled={kaderPage === 1} onClick={() => setKaderPage(kaderPage - 1)} style={{ padding: '8px 15px', border: '1px solid #ccc', borderRadius: '6px', cursor: kaderPage === 1 ? 'not-allowed' : 'pointer', background: '#fff', fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>⬅️ Sebelumnya</button>
            <button onClick={() => setKaderPage(kaderPage + 1)} style={{ padding: '8px 15px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', background: '#fff', fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Selanjutnya ➡️</button>
         </div>
      </div>

      {/* MODAL KELOLA EDIT SUPER ADMIN */}
      {editKaderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <button onClick={() => setEditKaderModal(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
            <h3 style={{ marginTop: 0, color: '#0000af', borderBottom: '2px solid #eaeaea', paddingBottom: '15px', marginBottom: '20px' }}>⚙️ Edit Kader</h3>
            <form onSubmit={async (e) => {
               e.preventDefault(); setIsSubmitting(true);
               try {
                 const newNim = editKaderModal.nim.trim(); const docRef = doc(db, "users", editKaderModal.id);
                 if (newNim !== editKaderModal.oldNim) {
                    const oldKaderData = (await getDocs(query(collection(db, "users"), where("nim", "==", editKaderModal.oldNim)))).docs[0]?.data() || {};
                    await setDoc(doc(db, "users", newNim), { ...oldKaderData, nim: newNim, nama: editKaderModal.nama, id_rayon: editKaderModal.id_rayon, jenjang: editKaderModal.jenjang });
                    await deleteDoc(docRef); alert("Data & NIM diperbarui!");
                 } else {
                    await updateDoc(docRef, { nama: editKaderModal.nama, id_rayon: editKaderModal.id_rayon, jenjang: editKaderModal.jenjang }); alert("Data diperbarui!");
                 }
                 setEditKaderModal(null);
               } catch (error) {} finally { setIsSubmitting(false); }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="text" required placeholder="Nama Lengkap" value={editKaderModal.nama} onChange={e => setEditKaderModal({...editKaderModal, nama: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} />
              <input type="text" required placeholder="NIM" value={editKaderModal.nim} onChange={e => setEditKaderModal({...editKaderModal, nim: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} />
              <select value={editKaderModal.id_rayon} onChange={e => setEditKaderModal({...editKaderModal, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}>
                {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
              </select>
              <select value={editKaderModal.jenjang} onChange={e => setEditKaderModal({...editKaderModal, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}>
                <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
              </select>
              <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Simpan</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}