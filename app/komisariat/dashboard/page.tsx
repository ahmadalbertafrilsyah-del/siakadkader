'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, setDoc, doc, deleteDoc, addDoc, onSnapshot, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signOut as signOutSecondary } from 'firebase/auth';
import * as XLSX from 'xlsx';

export default function DashboardKomisariat() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState('beranda');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

  // --- STATE STATISTIK & DATA GLOBAL (REAL-TIME) ---
  const [statGlobal, setStatGlobal] = useState({ totalRayon: 0, totalKaderAktif: 0, totalPendamping: 0, totalSuratKeluar: 0 });
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  const [databaseKader, setDatabaseKader] = useState<any[]>([]);
  
  // --- STATE MASTER KURIKULUM & TES PUSAT ---
  const [masterKurikulum, setMasterKurikulum] = useState<any[]>([]);
  const [masterTesPusat, setMasterTesPusat] = useState<any[]>([]);

  // --- STATE FILTER & EDIT KURIKULUM PUSAT ---
  const [filterJenjangKurikulum, setFilterJenjangKurikulum] = useState('MAPABA');
  const [editingKurikulumId, setEditingKurikulumId] = useState<string | null>(null);
  const [editKurikulumForm, setEditKurikulumForm] = useState({ kode: '', nama: '', muatan: '', bobot: 0 });

  // --- STATE PENGUMUMAN LOGIN ---
  const [pengumumanList, setPengumumanList] = useState<string[]>([]);
  const [newPengumuman, setNewPengumuman] = useState('');
  const [isSavingPengumuman, setIsSavingPengumuman] = useState(false);

  // --- STATE FITUR BARU: KALENDER, BROADCAST, LOG AKTIVITAS ---
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [logAktivitas, setLogAktivitas] = useState<any[]>([]);
  const [riwayatBroadcast, setRiwayatBroadcast] = useState<any[]>([]); 

  const [formJadwal, setFormJadwal] = useState({ judul: '', tanggal: '', lokasi: '', deskripsi: '' });
  const [formBroadcast, setFormBroadcast] = useState({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });

  // --- STATE FORM INPUT RAYON & PUSAT ---
  const [formRayon, setFormRayon] = useState({ id_rayon: '', nama_rayon: '', password: '' });
  const [formKurikulum, setFormKurikulum] = useState({ jenjang: 'MAPABA', kode: '', nama: '', muatan: '', bobot: 3 });
  const [formTesPusat, setFormTesPusat] = useState({ judul: '', jenjang: 'MAPABA', soal: '' });
  
  // --- STATE PENCARIAN KADER ---
  const [searchKader, setSearchKader] = useState('');
  const [filterRayonKader, setFilterRayonKader] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // FUNGSI PENCATAT LOG AKTIVITAS (AUDIT TRAIL)
  // ==========================================
  const catatLogAktivitas = async (aksi: string) => {
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        aktor: "PK. PMII Sunan Ampel Malang",
        role: "komisariat",
        aksi: aksi,
        timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {
      console.error("Gagal mencatat log", e);
    }
  };

  // ==========================================
  // EFEK: AMBIL DATA REAL-TIME DARI FIREBASE & CEK ROLE
  // ==========================================
  useEffect(() => {
    // CEK LOGIN & ROLE
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole) => {
          if (!snapRole.empty) {
            const userData = snapRole.docs[0].data();
            if (userData.role !== 'komisariat') {
              alert(`Akses Ditolak! Anda bukan Pengurus Komisariat.`);
              signOut(auth);
              router.push('/');
              return;
            }
          }
        });
      } else {
        router.push('/');
      }
    });

    // LISTENER USER GLOBAL (KADER, RAYON, PENDAMPING)
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      let kaderCount = 0;
      let pendampingCount = 0;
      let rayonCount = 0;
      const listKader: any[] = [];
      const listRayon: any[] = [];

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'kader') {
          kaderCount++;
          listKader.push({ id: doc.id, ...data });
        } else if (data.role === 'pendamping') {
          pendampingCount++;
        } else if (data.role === 'rayon') {
          rayonCount++;
          listRayon.push({ id: doc.id, ...data });
        }
      });

      setDatabaseKader(listKader);
      setDataRayon(listRayon);
      setStatGlobal(prev => ({ ...prev, totalKaderAktif: kaderCount, totalPendamping: pendampingCount, totalRayon: rayonCount }));
    });

    const unsubSurat = onSnapshot(collection(db, "pengajuan_surat"), (snap) => { setStatGlobal(prev => ({ ...prev, totalSuratKeluar: snap.size })); });
    
    const unsubKurikulumPusat = onSnapshot(collection(db, "master_kurikulum_pusat"), (snap) => {
      const listMateri: any[] = []; snap.forEach(doc => listMateri.push({ id: doc.id, ...doc.data() })); setMasterKurikulum(listMateri);
    });

    const unsubTesPusat = onSnapshot(collection(db, "master_tes_pusat"), (snap) => {
      const listTes: any[] = []; snap.forEach(doc => listTes.push({ id: doc.id, ...doc.data() })); setMasterTesPusat(listTes);
    });

    const unsubPengumuman = onSnapshot(doc(db, "pengaturan_sistem", "pengumuman"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().listTeks) setPengumumanList(docSnap.data().listTeks);
    });

    const unsubJadwal = onSnapshot(query(collection(db, "jadwal_kegiatan"), orderBy("timestamp", "desc")), (snap) => {
      const listJadwal: any[] = []; snap.forEach(doc => listJadwal.push({ id: doc.id, ...doc.data() })); setJadwalKegiatan(listJadwal);
    });

    // LISTENER UNTUK RIWAYAT BROADCAST
    const unsubBroadcast = onSnapshot(query(collection(db, "notifikasi_global"), where("pengirim", "==", "Pusat Komisariat")), (snap) => {
      const listNotif: any[] = [];
      snap.forEach(doc => listNotif.push({ id: doc.id, ...doc.data() }));
      listNotif.sort((a, b) => b.timestamp - a.timestamp); 
      setRiwayatBroadcast(listNotif);
    });

    const unsubLog = onSnapshot(query(collection(db, "log_aktivitas"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      const listLog: any[] = []; snap.forEach(doc => listLog.push({ id: doc.id, ...doc.data() })); setLogAktivitas(listLog);
    });

    return () => { unsubscribeAuth(); unsubUsers(); unsubSurat(); unsubKurikulumPusat(); unsubTesPusat(); unsubPengumuman(); unsubJadwal(); unsubBroadcast(); unsubLog(); };
  }, [router]);


  // ==========================================
  // FUNGSI FITUR BARU: KALENDER, BROADCAST, EXPORT EXCEL
  // ==========================================

  const handleExportKaderGlobal = () => {
    if (databaseKader.length === 0) return alert("Database Kader Kosong!");
    
    const dataToExport = databaseKader.map((k, i) => ({
      "No": i + 1,
      "NIM": k.nim || '-',
      "Nama Lengkap": k.nama || '-',
      "NIA": k.nia || '-',
      "Rayon Asal": k.id_rayon || '-',
      "Jenjang Terakhir": k.jenjang || 'MAPABA',
      "Email": k.email || '-',
      "Status": k.status || 'Aktif'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Database Kader");
    XLSX.writeFile(workbook, `Database_Kader_Komisariat_${Date.now()}.xlsx`);

    catatLogAktivitas("Mengekspor (Download Excel) seluruh database kader se-UIN.");
  };

  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "jadwal_kegiatan"), {
        ...formJadwal,
        pembuat: "Komisariat",
        timestamp: Date.now()
      });
      catatLogAktivitas(`Menambahkan jadwal kegiatan baru: ${formJadwal.judul}`);
      alert("Jadwal kegiatan berhasil ditambahkan!");
      setFormJadwal({ judul: '', tanggal: '', lokasi: '', deskripsi: '' });
    } catch (error) { alert("Gagal menyimpan jadwal."); } finally { setIsSubmitting(false); }
  };

  const handleHapusJadwal = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus jadwal "${judul}"?`)) return;
    try {
      await deleteDoc(doc(db, "jadwal_kegiatan", id));
      catatLogAktivitas(`Menghapus jadwal kegiatan: ${judul}`);
    } catch (error) { alert("Gagal menghapus."); }
  };

  const handleKirimBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notifikasi_global"), {
        ...formBroadcast,
        pengirim: "Pusat Komisariat",
        tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
        timestamp: Date.now()
      });
      catatLogAktivitas(`Mengirim Broadcast (${formBroadcast.target}): ${formBroadcast.judul}`);
      alert("Pesan Broadcast berhasil disiarkan!");
      setFormBroadcast({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
    } catch (error) { alert("Gagal mengirim broadcast."); } finally { setIsSubmitting(false); }
  };

  const handleHapusBroadcast = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus/tarik pesan broadcast "${judul}"?`)) return;
    try {
      await deleteDoc(doc(db, "notifikasi_global", id));
      catatLogAktivitas(`Menarik/Menghapus pesan Broadcast: ${judul}`);
    } catch (error) { alert("Gagal menghapus broadcast."); }
  };


  // ==========================================
  // FUNGSI LAMA (PENGUMUMAN, RAYON, KURIKULUM, TES)
  // ==========================================
  const handleTambahPengumuman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPengumuman.trim()) return;
    setPengumumanList([...pengumumanList, newPengumuman]);
    setNewPengumuman('');
  };

  const handleHapusPengumuman = (index: number) => {
    const newList = [...pengumumanList]; newList.splice(index, 1); setPengumumanList(newList);
  };

  const handleSimpanPengumuman = async () => {
    setIsSavingPengumuman(true);
    try {
      await setDoc(doc(db, "pengaturan_sistem", "pengumuman"), { listTeks: pengumumanList, terakhirDiubah: Date.now() }, { merge: true });
      catatLogAktivitas("Mengubah urutan/isi Teks Pengumuman Login.");
      alert("Pengumuman berhasil disebarkan ke halaman Login!");
    } catch (error) { alert("Gagal menyimpan pengumuman."); } finally { setIsSavingPengumuman(false); }
  };

  const handleBuatAkunRayon = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const apps = getApps();
    const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(auth.app.options, 'SecondaryApp');
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const safeUsername = formRayon.id_rayon.trim().toLowerCase();
      const emailBaru = `${safeUsername}@pmii-uinmalang.or.id`;
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formRayon.password);
      await setDoc(doc(db, "users", safeUsername), { nama: formRayon.nama_rayon, username: safeUsername, id_rayon: safeUsername, email: emailBaru, role: "rayon", status: "Aktif", createdAt: Date.now() });
      await setDoc(doc(db, "settings_rayon", safeUsername), { id: safeUsername, nama: formRayon.nama_rayon, pengumuman: `Selamat datang di Sistem Informasi dan Akademik Kaderisasi ${formRayon.nama_rayon}.`, warnaUtama: "#004a87", warnaAksen: "#f1c40f" });
      await signOutSecondary(secondaryAuth);
      
      catatLogAktivitas(`Mendaftarkan Instansi Rayon Baru: ${formRayon.nama_rayon}`);
      alert(`Sukses! Akun Admin untuk ${formRayon.nama_rayon} berhasil dibuat tanpa logout dari Komisariat.\n\nUsername Login: ${safeUsername}\nPassword: ${formRayon.password}`);
      setFormRayon({ id_rayon: '', nama_rayon: '', password: '' });
    } catch (error: any) { alert("Gagal membuat akun Rayon: " + error.message); } finally { setIsSubmitting(false); }
  };

  const handleUbahStatusRayon = async (idRayon: string, statusSekarang: string) => {
    const statusBaru = statusSekarang === "Aktif" ? "Pasif" : "Aktif";
    if (!window.confirm(`Ubah status akun rayon ini menjadi ${statusBaru}?`)) return;
    try {
      await updateDoc(doc(db, "users", idRayon), { status: statusBaru });
      catatLogAktivitas(`Mengubah status Rayon ${idRayon} menjadi ${statusBaru}.`);
    } catch (error) {
      alert("Gagal mengubah status rayon.");
    }
  };

  const handleHapusRayon = async (idRayon: string, namaRayon: string) => {
    if (!window.confirm(`PERINGATAN!\nAnda yakin ingin menghapus permanen akun Rayon "${namaRayon}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteDoc(doc(db, "users", idRayon));
      await deleteDoc(doc(db, "settings_rayon", idRayon)); 
      catatLogAktivitas(`Menghapus permanen akun Rayon: ${namaRayon}`);
      alert(`Akun Rayon ${namaRayon} berhasil dihapus.`);
    } catch (error) {
      alert("Gagal menghapus rayon.");
    }
  };

  const handleTambahKurikulumPusat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "master_kurikulum_pusat"), { jenjang: formKurikulum.jenjang, kode: formKurikulum.kode, nama: formKurikulum.nama, muatan: formKurikulum.muatan, bobot: Number(formKurikulum.bobot), timestamp: Date.now() });
      catatLogAktivitas(`Menambahkan Master Kurikulum Pusat: [${formKurikulum.kode}] ${formKurikulum.nama}`);
      alert("Materi berhasil ditambahkan ke kurikulum standar pusat!");
      setFormKurikulum({ ...formKurikulum, kode: '', nama: '', muatan: '' });
    } catch (error) { alert("Gagal menyimpan materi pusat."); }
  };

  const handleHapusKurikulumPusat = async (id: string, nama: string) => {
    if(window.confirm("Hapus materi ini dari standar pusat?")) {
      await deleteDoc(doc(db, "master_kurikulum_pusat", id));
      catatLogAktivitas(`Menghapus Kurikulum Pusat: ${nama}`);
    }
  };

  const handleSimpanEditKurikulumPusat = async (materiId: string) => {
    if (!editKurikulumForm.kode || !editKurikulumForm.nama) return alert("Kode dan Nama materi tidak boleh kosong!");
    try {
      await updateDoc(doc(db, "master_kurikulum_pusat", materiId), {
        kode: editKurikulumForm.kode,
        nama: editKurikulumForm.nama,
        muatan: editKurikulumForm.muatan,
        bobot: Number(editKurikulumForm.bobot)
      });
      catatLogAktivitas(`Mengedit Kurikulum Pusat: [${editKurikulumForm.kode}] ${editKurikulumForm.nama}`);
      setEditingKurikulumId(null);
      alert("Materi berhasil diperbarui!");
    } catch(err) { alert("Gagal mengedit materi."); }
  };

  const handleTambahTesPusat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTesPusat.judul || !formTesPusat.soal) return;
    const daftarSoalArray = formTesPusat.soal.split('\n').filter(s => s.trim() !== '');
    try {
      await addDoc(collection(db, "master_tes_pusat"), { judul: formTesPusat.judul, jenjang: formTesPusat.jenjang, daftar_soal: daftarSoalArray, timestamp: Date.now() });
      catatLogAktivitas(`Membuat Master Tes Pusat: ${formTesPusat.judul}`);
      alert("Tes berhasil ditambahkan ke standar pusat!");
      setFormTesPusat({ judul: '', jenjang: 'MAPABA', soal: '' });
    } catch (error) { alert("Gagal menyimpan tes pusat."); }
  };

  const handleHapusTesPusat = async (id: string, judul: string) => {
    if (window.confirm("Hapus tes ini dari standar pusat?")) {
      await deleteDoc(doc(db, "master_tes_pusat", id));
      catatLogAktivitas(`Menghapus Master Tes Pusat: ${judul}`);
    }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const filteredKader = databaseKader.filter(kader => {
    const matchSearch = kader.nama?.toLowerCase().includes(searchKader.toLowerCase()) || kader.nim?.includes(searchKader);
    const matchRayon = filterRayonKader === '' || kader.id_rayon === filterRayonKader;
    return matchSearch && matchRayon;
  });

  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'beranda': return 'Dashboard Statistik';
      case 'kalender': return 'Kalender & Jadwal';
      case 'broadcast': return 'Pusat Broadcast';
      case 'manajemen-rayon': return 'Manajemen Akun';
      case 'master-kurikulum': return 'Master Kurikulum';
      case 'master-tes': return 'Master Tes';
      case 'database-kader': return 'Database Kader';
      case 'pengumuman': return 'Pengumuman Login';
      case 'log-aktivitas': return 'Log Aktivitas';
      default: return 'Pusat Komisariat';
    }
  };

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS UNTUK TAMPILAN WEB */}
      <style>{`
        * { box-sizing: border-box; } /* KUNCI RESPONSIFITAS GLOBAL */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.4); }
        input, select, textarea { max-width: 100%; }
        @media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }
        div[style*="overflowX: auto"], div[style*="overflow-x: auto"] { -webkit-overflow-scrolling: touch; }
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 600px; }
        .tabel-utama thead tr { border-top: 2px solid #ddd; background-color: #f8f9fa; }
        .tabel-utama th { padding: 10px; color: #555; text-align: left; font-weight: bold; }
        .tabel-utama td { padding: 10px; border-bottom: 1px solid #eee; color: #333; }
        
        .print-layout-container { position: absolute !important; top: -9999px !important; left: -9999px !important; width: 1px !important; height: 1px !important; overflow: hidden !important; opacity: 0 !important; pointer-events: none !important; z-index: -9999 !important; }
        @media screen { .bg-kertas-a4 { display: none !important; pointer-events: none !important; } }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background-color: transparent !important; margin: 0; padding: 0; height: auto !important; }
          div[style*="overflow: hidden"], div[style*="overflowY: auto"] { overflow: visible !important; height: auto !important; }
          aside, main, header, .no-print { display: none !important; }
          .print-layout-container { display: block !important; position: relative !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; background-color: transparent !important; opacity: 1 !important; z-index: 10 !important; }
          .print-layout-container * { color: #000 !important; font-family: "Arial", "Arial Narrow", sans-serif !important; line-height: 1.15 !important; }
          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; width: 210mm !important; height: 297mm !important; z-index: -10 !important; }
          .bg-kertas-a4 img { width: 210mm !important; height: 297mm !important; object-fit: fill !important; display: block !important; }
          .print-content-area { position: relative !important; z-index: 10 !important; padding: 50mm 25mm 30mm 25mm !important; background-color: transparent !important; }
          table { width: 100% !important; border-collapse: collapse !important; background-color: transparent !important; }
          tr { page-break-inside: avoid !important; background-color: transparent !important; }
          th, td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11pt !important; background-color: transparent !important; }
          th { font-weight: bold !important; text-align: center !important; }
          .tabel-biodata { margin-bottom: 15px !important; border: none !important; width: 100% !important; }
          .tabel-biodata td, .tabel-biodata tr { border: none !important; padding: 3px 0 !important; text-align: left !important; }
        }
      `}</style>
      
      {isSidebarOpen && (
        <div className="no-print" onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }} />
      )}

      {/* SIDEBAR KOMISARIAT */}
      <aside style={{ width: '260px', background: 'linear-gradient(100deg, #0000af 100%)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 10px rgba(0,0,0,0.1)', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'left 0.3s ease' }}>
        <div style={{ padding: '20px 20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}><span style={{ fontSize: '1.5rem' }}>🏛️</span><span style={{ color: '#f1c40f', letterSpacing: '1px' }}>SIAKAD PMII</span></div>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '5px', color: '#fff', textTransform: 'uppercase' }}>Pengurus Komisariat</h4>
          <p style={{ fontSize: '0.75rem', color: '#bdc3c7', margin: 0 }}>Sunan Ampel Malang</p>
        </div>

        <ul style={{ listStyle: 'none', padding: '15px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {[
            { id: 'beranda', icon: '📊', label: 'Dashboard Statistik' },
            { id: 'kalender', icon: '📅', label: 'Kalender & Jadwal' },
            { id: 'broadcast', icon: '📡', label: 'Broadcast' },
            { id: 'manajemen-rayon', icon: '🏢', label: 'Akun Rayon' },
            { id: 'master-kurikulum', icon: '📑', label: 'Master Kurikulum' },
            { id: 'master-tes', icon: '📝', label: 'Master Tes' },
            { id: 'database-kader', icon: '🌐', label: 'Database Kader' },
            { id: 'pengumuman', icon: '📢', label: 'Pengumuman Login' },
            { id: 'log-aktivitas', icon: '🕵️', label: 'Log Aktivitas Sistem' },
          ].map((item) => (
            <li key={item.id}>
              <button onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: activeMenu === item.id ? '#f1c40f' : '#bdc3c7', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.85rem', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', backgroundColor: activeMenu === item.id ? 'rgba(255, 215, 0, 0.05)' : 'transparent', transition: '0.2s', fontWeight: activeMenu === item.id ? 'bold' : 'normal' }}>
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span> {item.label}
              </button>
            </li>
          ))}
        </ul>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', fontSize: '0.85rem' }}>🚪 Keluar Sistem</button>
        </div>
      </aside>

      {/* MAIN CONTENT CONTAINER */}
      <main className="no-print" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '0', width: '100%', overflowX: 'hidden' }}>
        
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, fontWeight: 'bold', textTransform: 'uppercase' }}>{getHeaderTitle()}</h2>
            <span style={{ fontSize: '0.75rem', color: '#555', backgroundColor: '#fdf2e9', padding: '4px 12px', borderRadius: '20px', border: '1px solid #f1c40f', fontWeight: 'bold' }}>Admin Komisariat</span>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          
          {/* MENU 1: BERANDA STATISTIK */}
          {activeMenu === 'beranda' && (
            <div>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h2 style={{color: '#0d1b2a', marginTop: 0, fontSize: '1.5rem'}}>Dashboard Komisariat 🏛️</h2>
                <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Pantau pergerakan kader, aktivitas Rayon, dan persebaran data seluruh anggota PMII di tingkat Komisariat.</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Rayon Terdaftar</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalRayon}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #2ecc71' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Kader (Se-UIN)</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalKaderAktif}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Pendamping</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalPendamping}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Surat Terdigitalisasi</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{statGlobal.totalSuratKeluar}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                <h4 style={{ marginTop: 0, color: '#0d1b2a', marginBottom: '15px' }}>Distribusi Rayon Aktif</h4>
                <table className="tabel-utama" style={{ minWidth: '400px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Nama Rayon</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Total Kader Terdata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataRayon.length === 0 ? (
                      <tr><td colSpan={2} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada data rayon.</td></tr>
                    ) : (
                      dataRayon.map((rayon) => {
                        const jumlahKaderRayonIni = databaseKader.filter(k => k.id_rayon === rayon.id_rayon).length;
                        return (
                          <tr key={rayon.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{rayon.nama}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#3498db' }}>{jumlahKaderRayonIni} Kader</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 2: KALENDER & JADWAL */}
          {activeMenu === 'kalender' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem' }}>📅 Jadwal Kegiatan Terpusat</h3>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>➕ Tambah Agenda Baru</h4>
                    <form onSubmit={handleTambahJadwal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" placeholder="Judul Kegiatan (Cth: RTM Komisariat)" required value={formJadwal.judul} onChange={e => setFormJadwal({...formJadwal, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <input type="datetime-local" required value={formJadwal.tanggal} onChange={e => setFormJadwal({...formJadwal, tanggal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <input type="text" placeholder="Lokasi / Media" required value={formJadwal.lokasi} onChange={e => setFormJadwal({...formJadwal, lokasi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <textarea rows={3} placeholder="Deskripsi Singkat" value={formJadwal.deskripsi} onChange={e => setFormJadwal({...formJadwal, deskripsi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} />
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Agenda</button>
                    </form>
                  </div>
                  <div style={{ flex: '2 1 450px', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {jadwalKegiatan.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>Belum ada agenda terjadwal.</div>
                      ) : (
                        jadwalKegiatan.map(jadwal => (
                          <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: '4px solid #3498db', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <h4 style={{ margin: '0 0 5px 0', color: '#0d1b2a', fontSize: '1rem' }}>{jadwal.judul}</h4>
                              <div style={{ fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                            </div>
                            <button onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Jadwal">🗑️</button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MENU 3: BROADCAST NOTIFIKASI */}
          {activeMenu === 'broadcast' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>📡 Pusat Broadcast & Notifikasi</h3>
                <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Kirimkan pesan mendesak atau pengumuman penting yang akan muncul di notifikasi pengguna tujuan.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {/* KIRI: FORM BROADCAST */}
                <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Judul Pesan</label>
                      <input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Cth: Panggilan Rapat Darurat" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Isi Pesan Lengkap</label>
                      <textarea rows={4} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Detail pengumuman..." style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Batas Waktu Siar</label>
                      <input type="date" required value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Target Penerima</label>
                      <select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', cursor: 'pointer' }}>
                        <option value="Semua">📢 Semua Pengguna (Rayon, Pendamping, Kader)</option>
                        <option value="Rayon">🏢 Hanya Admin Rayon</option>
                        <option value="Pendamping">👤 Hanya Para Pendamping</option>
                        <option value="Kader">🎓 Hanya Seluruh Kader</option>
                      </select>
                    </div>
                    <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      {isSubmitting ? 'Mengirim...' : '🚀 Siarkan Pesan'}
                    </button>
                  </form>
                </div>

                {/* KANAN: RIWAYAT BROADCAST */}
                <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', boxSizing: 'border-box' }}>
                  <table className="tabel-utama" style={{ minWidth: '550px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', color: 'white' }}>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Judul & Pesan Broadcast</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '100px' }}>Target</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '120px' }}>Batas Waktu</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '80px' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayatBroadcast.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada riwayat broadcast yang dikirim.</td></tr>
                      ) : (
                        riwayatBroadcast.map((notif) => (
                          <tr key={notif.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>
                              <div style={{ fontWeight: 'bold', color: '#1e824c', fontSize: '0.9rem' }}>{notif.judul}</div>
                              <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{notif.pesan}</div>
                              <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px' }}>Dibuat: {notif.tanggal}</div>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{notif.target}</span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#e74c3c', fontSize: '0.8rem' }}>
                              {notif.batas_waktu || '-'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }} title="Tarik / Hapus Pesan">🗑️</button>
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

          {/* MENU 4: MANAJEMEN RAYON */}
          {activeMenu === 'manajemen-rayon' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                  <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Daftar Instansi Rayon</h3>
                </div>
                
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>✏️ Buat Akun Admin Rayon</h4>
                    <form onSubmit={handleBuatAkunRayon} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Nama Rayon Pengenal</label>
                        <input type="text" placeholder="Misal: PR. PMII Tarbiyah" value={formRayon.nama_rayon} onChange={e => setFormRayon({...formRayon, nama_rayon: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Username Login (Kode Rayon)</label>
                        <input type="text" placeholder="Misal: admin_rkcd" value={formRayon.id_rayon} onChange={e => setFormRayon({...formRayon, id_rayon: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                        <span style={{fontSize: '0.65rem', color: '#888'}}>*Gunakan huruf kecil & tanpa spasi</span>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Password Login</label>
                        <input type="text" placeholder="Masukkan Password" value={formRayon.password} onChange={e => setFormRayon({...formRayon, password: e.target.value})} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                      </div>
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#ffffff' : '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px', fontSize: '0.85rem' }}>
                        {isSubmitting ? 'Memproses...' : '+ Daftarkan Rayon'}
                      </button>
                    </form>
                  </div>

                  <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start', boxSizing: 'border-box' }}>
                    <table className="tabel-utama" style={{ minWidth: '400px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', color: '#ffffff' }}>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Nama Rayon</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Username Login Admin</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataRayon.length === 0 ? (
                           <tr><td colSpan={4} style={{textAlign: 'center', padding: '20px', color: '#999'}}>Belum ada data rayon.</td></tr>
                        ) : (
                          dataRayon.map((rayon) => (
                            <tr key={rayon.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{rayon.nama}</td>
                              <td style={{ padding: '10px', color: '#666' }}>{rayon.username}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <button onClick={() => handleUbahStatusRayon(rayon.id, rayon.status || 'Aktif')} style={{ padding: '4px 8px', border: 'none', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!rayon.status || rayon.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!rayon.status || rayon.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                                  {(!rayon.status || rayon.status === 'Aktif') ? '🟢 Aktif' : '🔴 Pasif'}
                                </button>
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <button onClick={() => handleHapusRayon(rayon.id, rayon.nama)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Rayon">🗑️</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MENU 5: MASTER KURIKULUM PUSAT (EDITABLE & SORTED) */}
          {activeMenu === 'master-kurikulum' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Master Kurikulum Kaderisasi</h3>
                <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Susun standar kurikulum yang komprehensif sebagai acuan seluruh Rayon se-UIN Malang.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                
                {/* FORM TAMBAH BARU */}
                <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>➕ Tambah Kurikulum</h4>
                  <form onSubmit={handleTambahKurikulumPusat} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Jenjang Kaderisasi</label>
                      <select required value={formKurikulum.jenjang} onChange={e => setFormKurikulum({...formKurikulum, jenjang: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                        <option value="MAPABA">MAPABA</option>
                        <option value="PKD">PKD</option>
                        <option value="SIG">SIG (Sekolah Islam Gender)</option>
                        <option value="SKP">SKP (Sekolah Kader Putri)</option>
                        <option value="NONFORMAL">Non-Formal</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Kode</label>
                        <input type="text" placeholder="Cth: 01" required value={formKurikulum.kode} onChange={e => setFormKurikulum({...formKurikulum, kode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Bobot (SKS)</label>
                        <input type="number" placeholder=" SKS" required value={formKurikulum.bobot} onChange={e => setFormKurikulum({...formKurikulum, bobot: Number(e.target.value)})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Nama Materi Besar</label>
                      <input type="text" placeholder="Misal: Konsep Dasar Islam Gender" required value={formKurikulum.nama} onChange={e => setFormKurikulum({...formKurikulum, nama: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Muatan / Sub Pembahasan</label>
                      <textarea rows={3} placeholder="- Sejarah Gender&#10;- Peran Perempuan dalam Islam" value={formKurikulum.muatan} onChange={e => setFormKurikulum({...formKurikulum, muatan: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    </div>

                    <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px', fontSize: '0.85rem' }}>+ Tambah Kurikulum Standar</button>
                  </form>
                </div>

                {/* TABEL LIST MATERI (FILTERED & EDITABLE) */}
                <div style={{ flex: '2 1 450px', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%' }}>
                  
                  {/* DROPDOWN FILTER JENJANG */}
                  <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <label style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.85rem' }}>Filter Jenjang:</label>
                    <select 
                      value={filterJenjangKurikulum} 
                      onChange={(e) => setFilterJenjangKurikulum(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#0000af' }}
                    >
                      <option value="MAPABA">MAPABA</option>
                      <option value="PKD">PKD</option>
                      <option value="SIG">SIG</option>
                      <option value="SKP">SKP</option>
                      <option value="NONFORMAL">Non-Formal</option>
                    </select>
                  </div>

                  <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', boxSizing: 'border-box' }}>
                    <table className="tabel-utama" style={{ minWidth: '550px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', color: 'white' }}>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '100px', textAlign: 'center' }}>Jenjang</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '80px', textAlign: 'center' }}>Kode</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Nama Materi & Muatan</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '80px', }}>Bobot</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '100px', }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filteredKurikulum = masterKurikulum
                            .filter(m => m.jenjang === filterJenjangKurikulum)
                            .sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' }));

                          if (filteredKurikulum.length === 0) {
                            return <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada data kurikulum pusat untuk jenjang {filterJenjangKurikulum}.</td></tr>;
                          }

                          return filteredKurikulum.map((materi) => {
                            // MODE EDIT BARIS
                            if (editingKurikulumId === materi.id) {
                              return (
                                <tr key={materi.id} style={{ borderBottom: '1px solid #eee', backgroundColor: '#fff9e6' }}>
                                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e824c', textAlign: 'center' }}>{materi.jenjang}</td>
                                  <td style={{ padding: '10px' }}>
                                    <input type="text" value={editKurikulumForm.kode} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, kode: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}/>
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                    <input type="text" value={editKurikulumForm.nama} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, nama: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '4px' }}/>
                                    <textarea value={editKurikulumForm.muatan} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, muatan: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} rows={2}/>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <input type="number" value={editKurikulumForm.bobot} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, bobot: Number(e.target.value)})} style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center' }}/>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                                      <button onClick={() => handleSimpanEditKurikulumPusat(materi.id)} style={{ color: 'white', backgroundColor: '#2ecc71', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Simpan</button>
                                      <button onClick={() => setEditingKurikulumId(null)} style={{ color: 'white', backgroundColor: '#95a5a6', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Batal</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            // MODE NORMAL BARIS
                            return (
                              <tr key={materi.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px', fontWeight: 'bold', textAlign: 'center', color: materi.jenjang === 'MAPABA' ? '#1e824c' : materi.jenjang === 'PKD' ? '#8e44ad' : '#e67e22' }}>{materi.jenjang}</td>
                                <td style={{ padding: '10px', color: '#666', fontWeight: 'bold', textAlign: 'center' }}>{materi.kode}</td>
                                <td style={{ padding: '10px' }}>
                                  <div style={{ color: '#333', fontWeight: 'bold', marginBottom: '2px', fontSize: '0.85rem' }}>{materi.nama}</div>
                                  <div style={{ color: '#777', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{materi.muatan || '-'}</div>
                                </td>
                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{materi.bobot}</td>
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                  <button onClick={() => { setEditingKurikulumId(materi.id); setEditKurikulumForm({ kode: materi.kode, nama: materi.nama, muatan: materi.muatan || '', bobot: materi.bobot }); }} style={{ color: '#3498db', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', marginRight: '5px' }} title="Edit Materi">✏️</button>
                                  <button onClick={() => handleHapusKurikulumPusat(materi.id, materi.nama)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }} title="Hapus Materi">🗑️</button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MENU 6: MASTER TES PEMAHAMAN PUSAT */}
          {activeMenu === 'master-tes' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Master Tes Pemahaman Kaderisasi</h3>
                <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Susun standar pertanyaan tes (Pre-Test/Post-Test) yang dapat digunakan oleh seluruh Rayon.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <form onSubmit={handleTambahTesPusat} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Jenjang Kaderisasi</label>
                      <select required value={formTesPusat.jenjang} onChange={e => setFormTesPusat({...formTesPusat, jenjang: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                        <option value="MAPABA">MAPABA</option>
                        <option value="PKD">PKD</option>
                        <option value="SIG">SIG (Sekolah Islam Gender)</option>
                        <option value="SKP">SKP (Sekolah Kader Putri)</option>
                        <option value="NONFORMAL">Non-Formal</option>
                        <option value="Umum">Umum (Semua)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Judul Tes</label>
                      <input type="text" placeholder="Misal: Post-Test Materi Aswaja" required value={formTesPusat.judul} onChange={e => setFormTesPusat({...formTesPusat, judul: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Daftar Pertanyaan</label>
                      <p style={{ fontSize: '0.7rem', color: '#e67e22', margin: '3px 0 5px 0' }}>*Tekan Enter (baris baru) untuk memisahkan tiap pertanyaan.</p>
                      <textarea rows={5} placeholder="1. Jelaskan definisi Aswaja!&#10;2. Sebutkan tokoh-tokoh penting!" required value={formTesPusat.soal} onChange={e => setFormTesPusat({...formTesPusat, soal: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    </div>

                    <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px', fontSize: '0.85rem' }}>+ Tambah Master Tes</button>
                  </form>
                </div>

                <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start', boxSizing: 'border-box', minWidth: 0, maxWidth: '100%' }}>
                  <table className="tabel-utama" style={{ minWidth: '550px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', color: 'white' }}>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '100px', textAlign: 'center' }}>Jenjang</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Judul Tes</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '80px', }}>Jml Soal</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '80px', }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterTesPusat.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada data master tes pusat.</td></tr>
                      ) : (
                        masterTesPusat.sort((a,b) => a.jenjang.localeCompare(b.jenjang)).map((tes) => (
                          <tr key={tes.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: tes.jenjang === 'MAPABA' ? '#1e824c' : tes.jenjang === 'PKD' ? '#8e44ad' : '#e67e22' }}>{tes.jenjang}</td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ color: '#333', fontWeight: 'bold', marginBottom: '2px', fontSize: '0.85rem' }}>{tes.judul}</div>
                              <details style={{ cursor: 'pointer', outline: 'none' }}>
                                <summary style={{ fontSize: '0.75rem', color: '#3498db', fontWeight: 'bold' }}>Lihat Soal</summary>
                                <ol style={{ fontSize: '0.75rem', color: '#555', paddingLeft: '15px', margin: '5px 0 0 0' }}>
                                  {(tes.daftar_soal || []).map((s: string, i: number) => <li key={i} style={{ marginBottom: '4px' }}>{s}</li>)}
                                </ol>
                              </details>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{tes.daftar_soal?.length || 0}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <button onClick={() => handleHapusTesPusat(tes.id, tes.judul)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }} title="Hapus Tes">🗑️</button>
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

          {/* MENU 7: DATABASE KADER GLOBAL DENGAN FITUR EXPORT EXCEL */}
          {activeMenu === 'database-kader' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Pencarian Kader Global</h3>
                <button onClick={handleExportKaderGlobal} style={{ backgroundColor: '#0000af', color: 'white', padding: '8px 15px', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📥 Export Data Excel
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Cari NIM / Nama Kader..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} style={{ flex: '1 1 200px', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none' }} />
                <select value={filterRayonKader} onChange={(e) => setFilterRayonKader(e.target.value)} style={{ flex: '1 1 150px', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Semua Rayon</option>
                  {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                </select>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', boxSizing: 'border-box' }}>
                <table className="tabel-utama" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>NIM</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Nama Lengkap</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Asal Rayon</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Jenjang Terakhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKader.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Data kader tidak ditemukan.</td></tr>
                    ) : (
                      filteredKader.map((kader) => (
                        <tr key={kader.nim} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', color: '#666', fontWeight: 'bold' }}>{kader.nim}</td>
                          <td style={{ padding: '10px', color: '#333', fontWeight: 'bold' }}>{kader.nama}</td>
                          <td style={{ padding: '10px', color: '#333', fontWeight: 'bold' }}>{kader.id_rayon}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: kader.jenjang === 'MAPABA' ? '#e8f5e9' : '#f3e5f5', color: kader.jenjang === 'MAPABA' ? '#2e7d32' : '#7b1fa2', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {kader.jenjang || 'MAPABA'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 8: PENGUMUMAN LOGIN */}
          {activeMenu === 'pengumuman' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Pengumuman Halaman Login</h3>
                  <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Teks di bawah ini akan tayang dan bergeser otomatis (slider) di halaman depan SIAKAD.</p>
                </div>
                <button 
                  onClick={handleSimpanPengumuman} 
                  disabled={isSavingPengumuman}
                  style={{ backgroundColor: isSavingPengumuman ? '#95a5a6' : '#0000af', color: 'white', padding: '8px 15px', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: isSavingPengumuman ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                >
                  {isSavingPengumuman ? 'Menyimpan...' : '💾 Simpan & Siarkan'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>➕ Tambah Kalimat Baru</h4>
                  <form onSubmit={handleTambahPengumuman} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    <textarea 
                      rows={3}
                      placeholder="Misal: Pendaftaran PKD Cabang Kota Malang telah dibuka. Hubungi pengurus Rayon masing-masing." 
                      value={newPengumuman} 
                      onChange={e => setNewPengumuman(e.target.value)} 
                      required 
                      style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.85rem' }} 
                    />
                    <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Tambahkan ke Daftar</button>
                  </form>
                </div>

                <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ margin: 0, color: '#333', fontSize: '0.9rem' }}>📋 Daftar Teks Berjalan:</h4>
                  {pengumumanList.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>
                      Belum ada pengumuman.
                    </div>
                  ) : (
                    pengumumanList.map((teks, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', backgroundColor: '#eef2f3', borderLeft: '4px solid #0000af', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#333', lineHeight: '1.5' }}>{teks}</span>
                        <button 
                          onClick={() => handleHapusPengumuman(index)} 
                          style={{ marginLeft: '15px', backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                        >
                          Hapus
                        </button>
                      </div>
                    ))
                  )}
                  <p style={{ fontSize: '0.75rem', color: '#e67e22', fontStyle: 'italic', marginTop: '10px' }}>
                    *Jangan lupa klik tombol <b>"Simpan & Siarkan"</b> di atas agar perubahan tampil di halaman login.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* MENU 9: LOG AKTIVITAS (FITUR BARU) */}
          {activeMenu === 'log-aktivitas' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>🕵️ Log Aktivitas Sistem</h3>
                <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Rekaman aktivitas dan riwayat perubahan data yang dilakukan oleh Admin Pusat Komisariat (Maksimal 50 aktivitas terakhir).</p>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', boxSizing: 'border-box' }}>
                <table className="tabel-utama" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '130px' }}>Waktu Sistem</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', width: '270px' }}>Aktor</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aktivitas / Aksi yang Dilakukan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logAktivitas.length === 0 ? (
                      <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada catatan aktivitas.</td></tr>
                    ) : (
                      logAktivitas.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', color: '#666', fontSize: '0.8rem' }}>{log.waktu_format}</td>
                          <td style={{ padding: '10px', color: '#0000af' }}>{log.aktor}</td>
                          <td style={{ padding: '10px', color: '#333', fontStyle: 'italic', fontSize: '0.85rem' }}>{log.aksi}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* STRUKTUR HIDDEN HTML KHUSUS UNTUK PRINT PDF AGAR RAPI BERULANG */}
      <div id="hidden-print-container" className="print-layout-container">
        {/* Kontainer Kosong (Komisariat belum ada fungsi print PDF) */}
      </div>

    </div>
  );
}