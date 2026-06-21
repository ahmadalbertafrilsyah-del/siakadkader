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
  const [dataPendamping, setDataPendamping] = useState<any[]>([]);
  
  const [tabAkunPusat, setTabAkunPusat] = useState('kader-skp');
  
  // --- STATE MASTER KURIKULUM & TES PUSAT ---
  const [masterKurikulum, setMasterKurikulum] = useState<any[]>([]);
  const [masterTesPusat, setMasterTesPusat] = useState<any[]>([]);
  const [selectedTesHasil, setSelectedTesHasil] = useState<any>(null);
  const [jawabanTesViewer, setJawabanTesViewer] = useState<any[]>([]);

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

  const [formJadwal, setFormJadwal] = useState({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua' });
  const [formBroadcast, setFormBroadcast] = useState({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });

  // --- STATE FORM INPUT RAYON, SKP, & PUSAT ---
  const [formRayon, setFormRayon] = useState({ id_rayon: '', nama_rayon: '', password: '' });
  const [formPendampingSKP, setFormPendampingSKP] = useState({ nama: '', username: '', password: '' });
  
  const [modeInputKaderSKP, setModeInputKaderSKP] = useState<'pilih' | 'baru' | 'import'>('pilih');
  const [formPilihKaderSKP, setFormPilihKaderSKP] = useState({ nim: '', pendampingId: [] as string[] });
  const [formKaderSKP, setFormKaderSKP] = useState({ nim: '', nama: '', password: '', id_rayon: '', pendampingId: [] as string[], angkatan: new Date().getFullYear().toString() });
  const [importProgress, setImportProgress] = useState('');
  
  const [formKurikulum, setFormKurikulum] = useState({ jenjang: 'MAPABA', kode: '', nama: '', muatan: '', bobot: 3 });
  const [formTesPusat, setFormTesPusat] = useState({ judul: '', jenjang: 'MAPABA', soal: '' });
  
  // --- STATE PENCARIAN & PAGINATION KADER ---
  const [searchKader, setSearchKader] = useState('');
  const [filterRayonKader, setFilterRayonKader] = useState('');
  const [kaderPage, setKaderPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // --- STATE MODAL EDIT KADER (SUPER ADMIN) ---
  const [editKaderModal, setEditKaderModal] = useState<any>(null);

  // --- STATE PENILAIAN SKP & RAPORT ---
  const [selectedKaderNilai, setSelectedKaderNilai] = useState('');
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 
  const [evaluasiKader, setEvaluasiKader] = useState<{ nilai_mentah?: any, catatan: string }>({ nilai_mentah: {}, catatan: '' });
  const [tabRaportAdmin, setTabRaportAdmin] = useState('raport'); 
  const [kategoriBobotGlobal, setKategoriBobotGlobal] = useState<Record<string, any[]>>({});
  const [nilaiMentah, setNilaiMentah] = useState<Record<string, Record<string, number>>>({});
  const [formKategori, setFormKategori] = useState({ nama: '', persen: 0 });
  const [isSavingEvaluasi, setIsSavingEvaluasi] = useState(false);
  
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });
  const [fileKop, setFileKop] = useState<File | null>(null);
  const [isSavingPengaturan, setIsSavingPengaturan] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // HELPER MAPPING NAMA RAYON & UPLOAD
  // ==========================================
  const getNamaRayon = (idRayon: string) => {
    if (idRayon === 'Komisariat' || idRayon === 'Pusat Komisariat') return 'Pusat Komisariat';
    const rayon = dataRayon.find(r => r.id_rayon === idRayon || r.username === idRayon);
    return rayon ? rayon.nama : idRayon;
  };

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
        aktor: "PK. PMII Sunan Ampel Malang",
        role: "komisariat",
        aksi: aksi,
        timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) { console.error("Gagal mencatat log", e); }
  };

  // ==========================================
  // EFEK: AMBIL DATA REAL-TIME DARI FIREBASE
  // ==========================================
  useEffect(() => {
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
      } else { router.push('/'); }
    });

    const unsubSettings = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPengaturanCetak({ kopSuratUrl: data.kopSuratUrl || '', footerUrl: data.footerUrl || '' });
        if (data.bobot_penilaian) setKategoriBobotGlobal(data.bobot_penilaian);
      }
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      let kaderCount = 0; let pendampingCount = 0; let rayonCount = 0;
      const listKader: any[] = []; const listRayon: any[] = []; const listPendamping: any[] = [];

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'kader') { kaderCount++; listKader.push({ id: doc.id, ...data }); } 
        else if (data.role === 'pendamping') { pendampingCount++; listPendamping.push({ id: doc.id, ...data }); } 
        else if (data.role === 'rayon') { rayonCount++; listRayon.push({ id: doc.id, ...data }); }
      });

      setDatabaseKader(listKader); setDataRayon(listRayon); setDataPendamping(listPendamping);
      setStatGlobal(prev => ({ ...prev, totalKaderAktif: kaderCount, totalPendamping: pendampingCount, totalRayon: rayonCount }));
      
      const kaderSKP = listKader.filter(k => k.jenjang === 'SKP');
      if (kaderSKP.length > 0 && !selectedKaderNilai) setSelectedKaderNilai(kaderSKP[0].nim);
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

    const unsubBroadcast = onSnapshot(query(collection(db, "notifikasi_global"), where("pengirim", "==", "Pusat Komisariat")), (snap) => {
      const listNotif: any[] = []; snap.forEach(doc => listNotif.push({ id: doc.id, ...doc.data() }));
      listNotif.sort((a, b) => b.timestamp - a.timestamp); setRiwayatBroadcast(listNotif);
    });

    const unsubLog = onSnapshot(query(collection(db, "log_aktivitas"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      const listLog: any[] = []; snap.forEach(doc => listLog.push({ id: doc.id, ...doc.data() })); setLogAktivitas(listLog);
    });

    return () => { unsubscribeAuth(); unsubUsers(); unsubSurat(); unsubKurikulumPusat(); unsubTesPusat(); unsubPengumuman(); unsubJadwal(); unsubBroadcast(); unsubLog(); unsubSettings(); };
  }, [router]);

  useEffect(() => {
    if (!selectedKaderNilai) return;
    const unsubscribeNilai = onSnapshot(doc(db, "nilai_khs", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data()); else setNilaiKaderRealtime({});
    });
    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists() && docSnap.data()['SKP']) {
        const data = docSnap.data()['SKP'];
        setNilaiMentah(data.nilai_mentah || {}); setEvaluasiKader(data); 
      } else { 
        setNilaiMentah({}); setEvaluasiKader({ catatan: '' }); 
      }
    });
    return () => { unsubscribeNilai(); unsubscribeKeaktifan(); };
  }, [selectedKaderNilai]);


  // ==========================================
  // FITUR KALENDER, BROADCAST, PENGUMUMAN
  // ==========================================
  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "jadwal_kegiatan"), { ...formJadwal, pembuat: "Komisariat", timestamp: Date.now() });
      catatLogAktivitas(`Menambahkan jadwal (Target: ${formJadwal.target}): ${formJadwal.judul}`);
      alert("Jadwal kegiatan berhasil ditambahkan!"); setFormJadwal({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua' });
    } catch (error) { alert("Gagal menyimpan jadwal."); } finally { setIsSubmitting(false); }
  };

  const handleHapusJadwal = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus jadwal "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "jadwal_kegiatan", id)); catatLogAktivitas(`Menghapus jadwal kegiatan: ${judul}`); } catch (error) { alert("Gagal menghapus."); }
  };

  const handleKirimBroadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notifikasi_global"), { ...formBroadcast, pengirim: "Pusat Komisariat", tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), timestamp: Date.now() });
      catatLogAktivitas(`Mengirim Broadcast (${formBroadcast.target}): ${formBroadcast.judul}`); alert("Pesan Broadcast berhasil disiarkan!"); setFormBroadcast({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
    } catch (error) { alert("Gagal mengirim broadcast."); } finally { setIsSubmitting(false); }
  };

  const handleHapusBroadcast = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus/tarik pesan broadcast "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "notifikasi_global", id)); catatLogAktivitas(`Menarik pesan Broadcast: ${judul}`); } catch (error) {}
  };

  const handleSimpanPengumuman = async () => {
    setIsSavingPengumuman(true);
    try { await setDoc(doc(db, "pengaturan_sistem", "pengumuman"), { listTeks: pengumumanList, terakhirDiubah: Date.now() }, { merge: true }); catatLogAktivitas("Mengubah urutan Teks Pengumuman Login."); alert("Pengumuman berhasil disebarkan!"); } catch (error) {} finally { setIsSavingPengumuman(false); }
  };

  const handleTambahPengumuman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPengumuman.trim()) return;
    setPengumumanList([...pengumumanList, newPengumuman]);
    setNewPengumuman('');
  };

  const handleHapusPengumuman = (index: number) => {
    const newList = [...pengumumanList];
    newList.splice(index, 1);
    setPengumumanList(newList);
  };

  // ==========================================
  // FUNGSI MANAJEMEN AKUN (RAYON, PENDAMPING SKP, KADER SKP)
  // ==========================================
  const getSecondaryAuth = () => { const apps = getApps(); const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(auth.app.options, 'SecondaryApp'); return getAuth(secondaryApp); };

  const handleBuatAkunRayon = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeUsername = formRayon.id_rayon.trim().toLowerCase(); const emailBaru = `${safeUsername}@pmii-uinmalang.or.id`;
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formRayon.password);
      await setDoc(doc(db, "users", safeUsername), { nama: formRayon.nama_rayon, username: safeUsername, id_rayon: safeUsername, email: emailBaru, role: "rayon", status: "Aktif", createdAt: Date.now() });
      await setDoc(doc(db, "settings_rayon", safeUsername), { id: safeUsername, nama: formRayon.nama_rayon, pengumuman: `Selamat datang di Sistem Informasi dan Akademik Kaderisasi ${formRayon.nama_rayon}.`, warnaUtama: "#004a87", warnaAksen: "#f1c40f" });
      await signOutSecondary(secondaryAuth); catatLogAktivitas(`Mendaftarkan Instansi Rayon Baru: ${formRayon.nama_rayon}`); alert(`Sukses! Akun Admin Rayon berhasil dibuat.`); setFormRayon({ id_rayon: '', nama_rayon: '', password: '' });
    } catch (error: any) { alert("Gagal membuat akun Rayon: " + error.message); } finally { setIsSubmitting(false); }
  };

  const handleBuatAkunPendampingSKP = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeUsername = formPendampingSKP.username.trim().toLowerCase(); const emailBaru = `${safeUsername}@pmii-uinmalang.or.id`;
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formPendampingSKP.password);
      await setDoc(doc(db, "users", safeUsername), { nama: formPendampingSKP.nama, username: safeUsername, email: emailBaru, role: "pendamping", id_rayon: "Komisariat", jenjangTugas: "SKP", status: "Aktif", createdAt: Date.now() });
      await signOutSecondary(secondaryAuth); catatLogAktivitas(`Mendaftarkan Pendamping SKP: ${formPendampingSKP.nama}`); alert(`Sukses! Akun Pendamping SKP berhasil dibuat.`); setFormPendampingSKP({ nama: '', username: '', password: '' });
    } catch (error: any) { alert("Gagal membuat Pendamping SKP: " + error.message); } finally { setIsSubmitting(false); }
  };

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
          id_rayon: formKaderSKP.id_rayon || "Luar Komisariat", jenjang: "SKP", pendamping_skp_id: formKaderSKP.pendampingId, status: "Aktif", createdAt: tanggalBuatModif.getTime()
        });
        await signOutSecondary(secondaryAuth); catatLogAktivitas(`Mendaftarkan Akun Kader SKP Baru: ${formKaderSKP.nama}`); alert(`Sukses! Akun Kader SKP baru berhasil dibuat.`);
      }
      setFormKaderSKP({ nim: '', nama: '', password: '', id_rayon: '', pendampingId: [], angkatan: new Date().getFullYear().toString() });
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

  const handleUbahStatusAkun = async (idAkun: string, statusSekarang: string) => {
    const statusBaru = statusSekarang === "Aktif" ? "Pasif" : "Aktif"; if (!window.confirm(`Ubah status akun ini menjadi ${statusBaru}?`)) return;
    try { await updateDoc(doc(db, "users", idAkun), { status: statusBaru }); } catch (error) {}
  };

  // ==========================================
  // FUNGSI DATABASE KADER (SUPER ADMIN)
  // ==========================================
  const filteredKaderDB = databaseKader.filter(kader => {
    const matchSearch = kader.nama?.toLowerCase().includes(searchKader.toLowerCase()) || kader.nim?.includes(searchKader);
    const matchRayon = filterRayonKader === '' || kader.id_rayon === filterRayonKader;
    return matchSearch && matchRayon;
  });

  const indexOfLastKader = kaderPage * itemsPerPage;
  const indexOfFirstKader = indexOfLastKader - itemsPerPage;
  const currentKaderDisplay = filteredKaderDB.slice(indexOfFirstKader, indexOfLastKader);
  const totalPagesKader = Math.ceil(filteredKaderDB.length / itemsPerPage);

  const handleExportKaderGlobal = () => {
    if (databaseKader.length === 0) return alert("Database Kader Kosong!");
    const dataToExport = databaseKader.map((k, i) => ({
      "No": i + 1, "NIM": k.nim || '-', "Nama Lengkap": k.nama || '-', "NIA": k.nia || '-', "Asal Rayon": getNamaRayon(k.id_rayon), "Jenjang Terakhir": k.jenjang || 'MAPABA', "Status": k.status || 'Aktif'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Database Kader"); XLSX.writeFile(workbook, `Database_Kader_Komisariat_${Date.now()}.xlsx`);
    catatLogAktivitas("Mengekspor (Download Excel) seluruh database kader se-UIN.");
  };

  const handleHapusKaderTotal = async (kader: any) => {
    if(!window.confirm(`PERINGATAN KERAS!\nAnda yakin ingin menghapus "${kader.nama}" secara TOTAL dari seluruh sistem database UIN?\nSemua nilai, tugas, dan histori akan lenyap!`)) return;
    try {
      await deleteDoc(doc(db, "users", kader.id)); await deleteDoc(doc(db, "nilai_khs", kader.nim)); await deleteDoc(doc(db, "evaluasi_kader", kader.nim));
      if (kader.email) {
          const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", kader.email));
          const snapBerkas = await getDocs(qBerkas); snapBerkas.forEach(d => deleteDoc(d.ref));
      }
      const qTes = query(collection(db, "jawaban_tes"), where("nim", "==", kader.nim));
      const snapTes = await getDocs(qTes); snapTes.forEach(d => deleteDoc(d.ref));
      alert("Kader telah dihapus secara permanen dari seluruh sistem.");
    } catch (error) { alert("Gagal menghapus total."); }
  };

  const handleHapusAkunLain = async (idAkun: string, namaAkun: string) => {
    if (!window.confirm(`PERINGATAN!\nAnda yakin ingin menghapus permanen akun "${namaAkun}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try { await deleteDoc(doc(db, "users", idAkun)); catatLogAktivitas(`Menghapus permanen akun: ${namaAkun}`); } catch (error) {}
  };

  const handleHapusRayon = async (idRayon: string, namaRayon: string) => {
    if (!window.confirm(`PERINGATAN!\nAnda yakin ingin menghapus permanen akun Rayon "${namaRayon}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try { await deleteDoc(doc(db, "users", idRayon)); await deleteDoc(doc(db, "settings_rayon", idRayon)); catatLogAktivitas(`Menghapus permanen akun Rayon: ${namaRayon}`); alert(`Akun Rayon ${namaRayon} berhasil dihapus.`); } catch (error) { alert("Gagal menghapus rayon."); }
  };

  // ==========================================
  // FUNGSI PENILAIAN SKP
  // ==========================================
  const handleSimpanPengaturanCetak = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingPengaturan(true);
    try {
      let newKop = pengaturanCetak.kopSuratUrl;
      if (fileKop) newKop = await uploadToCloudinary(fileKop);
      await setDoc(doc(db, "pengaturan_sistem", "komisariat_settings"), { kopSuratUrl: newKop }, { merge: true });
      catatLogAktivitas("Menyimpan pengaturan KOP Cetak Surat SKP.");
      alert("Pengaturan Kop berhasil disimpan!"); setFileKop(null);
    } catch (error) { alert("Gagal menyimpan."); } finally { setIsSavingPengaturan(false); }
  };

  const handleTambahKategoriBobot = async (e: React.FormEvent) => {
    e.preventDefault(); if(!formKategori.nama) return;
    const kategoriBobotAktif = kategoriBobotGlobal['SKP'] || [];
    const totalBobotTersimpan = kategoriBobotAktif.reduce((sum: number, k: any) => sum + k.persen, 0);
    if(totalBobotTersimpan + formKategori.persen > 100) return alert("Total bobot tidak boleh melebihi 100%!");
    setIsSavingEvaluasi(true);
    try {
      const docRef = doc(db, "pengaturan_sistem", "komisariat_settings");
      const newBobot = [...kategoriBobotAktif, { id: Date.now().toString(), nama: formKategori.nama, persen: formKategori.persen }];
      await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, 'SKP': newBobot } }, { merge: true });
      catatLogAktivitas(`Menambahkan Kategori Bobot SKP: ${formKategori.nama}`);
      setFormKategori({ nama: '', persen: 0 });
    } catch (error) { alert("Gagal menyimpan kategori bobot."); } finally { setIsSavingEvaluasi(false); }
  };

  const handleHapusKategoriBobot = async (id: string) => {
    if(!window.confirm("Hapus kategori bobot ini?")) return;
    try {
      const kategoriBobotAktif = kategoriBobotGlobal['SKP'] || [];
      const docRef = doc(db, "pengaturan_sistem", "komisariat_settings");
      const newBobot = kategoriBobotAktif.filter((item: any) => item.id !== id);
      await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, 'SKP': newBobot } }, { merge: true });
    } catch (error) {}
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
      const jenjangData = currentEvaluasi['SKP'] || { nilai_mentah: {}, catatan: evaluasiKader.catatan };
      await setDoc(docRef, { ...currentEvaluasi, ['SKP']: { ...jenjangData, nilai_mentah: nilaiMentah } }, { merge: true });

      let angkaAkhir = 0;
      const kategoriBobotAktif = kategoriBobotGlobal['SKP'] || [];
      kategoriBobotAktif.forEach((kat: any) => { const score = nilaiMentah[kodeMateri]?.[kat.nama] || 0; angkaAkhir += score * (kat.persen / 100); });
      const hurufAkhir = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
      await setDoc(doc(db, "nilai_khs", selectedKaderNilai), { [kodeMateri]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: "Admin Komisariat" }, { merge: true });
    } catch (error) {}
  };

  const handleSimpanCatatan = async (text: string) => {
    setEvaluasiKader({ ...evaluasiKader, catatan: text });
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi['SKP'] || { nilai_mentah: {}, catatan: '' };
      await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, ['SKP']: { ...jenjangData, catatan: text } }, { merge: true });
    } catch (error) {}
  };

  // ==========================================
  // MASTER KURIKULUM & TES PUSAT
  // ==========================================
  const handleTambahKurikulumPusat = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await addDoc(collection(db, "master_kurikulum_pusat"), { jenjang: formKurikulum.jenjang, kode: formKurikulum.kode, nama: formKurikulum.nama, muatan: formKurikulum.muatan, bobot: Number(formKurikulum.bobot), timestamp: Date.now() }); setFormKurikulum({ ...formKurikulum, kode: '', nama: '', muatan: '' }); } catch (error) { }
  };
  const handleHapusKurikulumPusat = async (id: string, nama: string) => { if(window.confirm("Hapus materi ini dari standar pusat?")) { await deleteDoc(doc(db, "master_kurikulum_pusat", id)); catatLogAktivitas(`Menghapus Kurikulum Pusat: ${nama}`); } };
  const handleSimpanEditKurikulumPusat = async (materiId: string) => {
    if (!editKurikulumForm.kode || !editKurikulumForm.nama) return;
    try { await updateDoc(doc(db, "master_kurikulum_pusat", materiId), { kode: editKurikulumForm.kode, nama: editKurikulumForm.nama, muatan: editKurikulumForm.muatan, bobot: Number(editKurikulumForm.bobot) }); setEditingKurikulumId(null); } catch(err) {}
  };

  const handleTambahTesPusat = async (e: React.FormEvent) => {
    e.preventDefault(); if (!formTesPusat.judul || !formTesPusat.soal) return;
    const daftarSoalArray = formTesPusat.soal.split('\n').filter(s => s.trim() !== '');
    try { await addDoc(collection(db, "master_tes_pusat"), { judul: formTesPusat.judul, jenjang: formTesPusat.jenjang, daftar_soal: daftarSoalArray, status: 'Tutup', timestamp: Date.now() }); setFormTesPusat({ judul: '', jenjang: 'MAPABA', soal: '' }); } catch (error) { }
  };
  const handleToggleStatusTesPusat = async (idTes: string, statusSaatIni: string) => { const statusAkanDatang = statusSaatIni === 'Buka' ? 'Tutup' : 'Buka'; if (!window.confirm(`Ubah status tes menjadi: ${statusAkanDatang}?`)) return; try { await updateDoc(doc(db, "master_tes_pusat", idTes), { status: statusAkanDatang }); } catch (error) {} };
  const handleHapusTesPusat = async (id: string, judul: string) => { if (window.confirm("Hapus tes ini dari standar pusat?")) { await deleteDoc(doc(db, "master_tes_pusat", id)); catatLogAktivitas(`Menghapus Master Tes Pusat: ${judul}`); } };
  const handleLihatHasilTesPusat = async (tes: any) => {
    setSelectedTesHasil(tes);
    try {
      const q = query(collection(db, "jawaban_tes"), where("id_tes", "==", tes.id));
      const snap = await getDocs(q);
      const dataJawaban = snap.docs.map(doc => doc.data());
      dataJawaban.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setJawabanTesViewer(dataJawaban);
    } catch (error) { alert("Gagal memuat data."); }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'beranda': return 'Dashboard Statistik';
      case 'kalender': return 'Kalender & Jadwal Terpusat';
      case 'broadcast': return 'Pusat Broadcast Notifikasi';
      case 'manajemen-rayon': return 'Manajemen Akun & Instansi';
      case 'master-kurikulum': return 'Master Kurikulum Pusat';
      case 'master-tes': return 'Master Tes Pemahaman';
      case 'database-kader': return 'Database Kader (Super Admin)';
      case 'pengumuman': return 'Pengumuman Halaman Login';
      case 'log-aktivitas': return 'Log Aktivitas Sistem';
      case 'pantau-nilai-skp': return 'Raport Kaderisasi SKP';
      default: return 'Pusat Komisariat';
    }
  };

  // ==========================================
  // PERHITUNGAN KHUSUS UNTUK CETAK KHS
  // ==========================================
  const kaderDicetak = databaseKader.find(k => k.nim === selectedKaderNilai) || {};
  let totalSksCetak = 0;
  let totalBobotNilaiCetak = 0;

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS UNTUK TAMPILAN WEB */}
      <style>{`
        * { box-sizing: border-box; } 
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.4); }
        input, select, textarea { max-width: 100%; outline: none; }
        @media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }
        div[style*="overflowX: auto"], div[style*="overflow-x: auto"] { -webkit-overflow-scrolling: touch; }
        
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 600px; }
        .tabel-utama thead tr { border-top: 1px solid #e0e0e0; border-bottom: 2px solid #0000af; background-color: #f8f9fa; }
        .tabel-utama th { padding: 12px 10px; color: #333; text-align: left; font-weight: bold; }
        .tabel-utama td { padding: 12px 10px; border-bottom: 1px solid #eee; color: #333; }
        
        /* CSS KHUSUS UNTUK MEMASTIKAN CETAK PDF BERJALAN LANCAR */
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
          .print-content-area { position: relative !important; z-index: 10 !important; padding: 55mm 25mm 30mm 25mm !important; background-color: transparent !important; }
          table { width: 100% !important; border-collapse: collapse !important; background-color: transparent !important; }
          tr { page-break-inside: avoid !important; background-color: transparent !important; }
          .tabel-utama thead tr { border-top: 1px solid #000 !important; border-bottom: 1px solid #000 !important; } 
          th, td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11pt !important; background-color: transparent !important; color: #000 !important; }
          th { font-weight: bold !important; text-align: center !important; }
          .tabel-biodata { margin-bottom: 15px !important; border: none !important; width: 100% !important; }
          .tabel-biodata td, .tabel-biodata tr { border: none !important; padding: 3px 0 !important; text-align: left !important; }
          .print-only-container { display: block !important; }
        }
      `}</style>
      
      {isSidebarOpen && (
        <div className="no-print" onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }} />
      )}

      {/* SIDEBAR KOMISARIAT */}
      <aside className="no-print" style={{ width: '260px', background: 'linear-gradient(100deg, #0000af 100%)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 10px rgba(0,0,0,0.1)', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'left 0.3s ease' }}>
        <div style={{ padding: '20px 20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}><span style={{ fontSize: '1.5rem' }}>🏛️</span><span style={{ color: 'white', letterSpacing: '1px' }}>SIAKAD PMII</span></div>
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
            { id: 'broadcast', icon: '📡', label: 'Broadcast Notifikasi' },
            { id: 'manajemen-rayon', icon: '🏢', label: 'Akun & Instansi' },
            { id: 'pantau-nilai-skp', icon: '👩', label: 'Raport SKP (Penilaian)' },
            { id: 'master-kurikulum', icon: '📑', label: 'Master Kurikulum' },
            { id: 'master-tes', icon: '📝', label: 'Master Tes Pusat' },
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

          {/* MENU 2: KALENDER & JADWAL (FORMAL/MODERN LAYOUT) */}
          {activeMenu === 'kalender' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 20px 0', fontSize: '1.2rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📅 Jadwal Kegiatan Terpusat</h3>
                
                {/* FORM TOP LAYOUT (GRID) */}
                <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
                  <h4 style={{ marginTop: 0, color: '#333', fontSize: '0.9rem', marginBottom: '15px' }}>➕ Tambah Agenda Baru</h4>
                  <form onSubmit={handleTambahJadwal} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Judul Kegiatan</label>
                      <input type="text" placeholder="Cth: RTM Komisariat" required value={formJadwal.judul} onChange={e => setFormJadwal({...formJadwal, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Tanggal & Waktu</label>
                      <input type="datetime-local" required value={formJadwal.tanggal} onChange={e => setFormJadwal({...formJadwal, tanggal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Lokasi / Media</label>
                      <input type="text" placeholder="Gedung / Zoom" required value={formJadwal.lokasi} onChange={e => setFormJadwal({...formJadwal, lokasi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Target Peserta</label>
                      <select required value={formJadwal.target} onChange={e => setFormJadwal({...formJadwal, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <option value="Semua">📢 Terlihat Semua Pengguna</option>
                        <option value="Rayon">🏢 Hanya Admin Rayon</option>
                        <option value="Pendamping">👤 Hanya Para Pendamping</option>
                        <option value="Kader">🎓 Hanya Seluruh Kader</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Deskripsi Singkat</label>
                      <textarea rows={2} placeholder="Isi deskripsi..." value={formJadwal.deskripsi} onChange={e => setFormJadwal({...formJadwal, deskripsi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Agenda</button>
                    </div>
                  </form>
                </div>

                {/* TABLE BOTTOM LAYOUT */}
                <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
                   <table className="tabel-utama" style={{ minWidth: '700px' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', width: '25%' }}>Agenda</th>
                          <th style={{ textAlign: 'left', width: '25%' }}>Waktu & Lokasi</th>
                          <th style={{ textAlign: 'left', width: '30%' }}>Deskripsi</th>
                          <th style={{ textAlign: 'center', width: '10%' }}>Target</th>
                          <th style={{ textAlign: 'center', width: '10%' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jadwalKegiatan.length === 0 ? (
                          <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada agenda terjadwal.</td></tr>
                        ) : (
                          jadwalKegiatan.map(jadwal => (
                            <tr key={jadwal.id}>
                              <td style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{jadwal.judul}</td>
                              <td><div style={{color: '#e67e22', fontWeight: 'bold', fontSize: '0.8rem'}}>🗓️ {jadwal.tanggal.replace('T', ' - ')}</div><div style={{fontSize: '0.8rem', color: '#555', marginTop: '4px'}}>📍 {jadwal.lokasi}</div></td>
                              <td style={{ fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</td>
                              <td style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{jadwal.target || 'Semua'}</span></td>
                              <td style={{ textAlign: 'center' }}><button onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Jadwal">🗑️</button></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                   </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU 3: BROADCAST NOTIFIKASI (FORMAL/MODERN LAYOUT) */}
          {activeMenu === 'broadcast' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📡 Pusat Broadcast & Notifikasi</h3>
                <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Kirimkan pesan mendesak atau pengumuman penting yang akan muncul di notifikasi pengguna tujuan.</p>
                
                {/* FORM TOP LAYOUT (GRID) */}
                <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
                  <form onSubmit={handleKirimBroadcast} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'end' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Judul Pesan</label>
                      <input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Cth: Panggilan Rapat Darurat" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Isi Pesan Lengkap</label>
                      <textarea rows={3} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Detail pengumuman..." style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Batas Waktu Siar</label>
                      <input type="date" required value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Target Penerima</label>
                      <select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <option value="Semua">📢 Semua Pengguna (Rayon, Pendamping, Kader)</option>
                        <option value="Rayon">🏢 Hanya Admin Rayon</option>
                        <option value="Pendamping">👤 Hanya Para Pendamping</option>
                        <option value="Kader">🎓 Hanya Seluruh Kader</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', height: '100%' }}>
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}>
                        {isSubmitting ? 'Mengirim...' : '🚀 Siarkan Pesan'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* TABLE BOTTOM LAYOUT */}
                <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
                  <table className="tabel-utama" style={{ minWidth: '700px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', width: '40%' }}>Judul & Pesan Broadcast</th>
                        <th style={{ textAlign: 'center', width: '20%' }}>Target</th>
                        <th style={{ textAlign: 'center', width: '20%' }}>Batas Waktu</th>
                        <th style={{ textAlign: 'center', width: '20%' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayatBroadcast.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada riwayat broadcast yang dikirim.</td></tr>
                      ) : (
                        riwayatBroadcast.map((notif) => (
                          <tr key={notif.id}>
                            <td>
                              <div style={{ fontWeight: 'bold', color: '#1e824c', fontSize: '0.9rem' }}>{notif.judul}</div>
                              <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{notif.pesan}</div>
                              <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px' }}>Dibuat: {notif.tanggal}</div>
                            </td>
                            <td style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{notif.target}</span></td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#e74c3c', fontSize: '0.8rem' }}>{notif.batas_waktu || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button onClick={() => handleHapusBroadcast(notif.id, notif.judul)} style={{ color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#e74c3c'} onMouseOut={e => e.currentTarget.style.color = '#aaa'} title="Tarik / Hapus Pesan">🗑️</button>
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

          {/* MENU 4: MANAJEMEN AKUN & INSTANSI */}
          {activeMenu === 'manajemen-rayon' && (
            <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Manajemen Akun & Instansi</h3>
              </div>
              
              {/* TABS DESIGN MODERN */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabAkunPusat('rayon')} style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkunPusat === 'rayon' ? '#0000af' : '#f8f9fa', color: tabAkunPusat === 'rayon' ? 'white' : '#555', fontSize: '0.85rem', transition: '0.2s', boxShadow: tabAkunPusat === 'rayon' ? '0 4px 6px rgba(0,0,175,0.2)' : 'none', border: tabAkunPusat === 'rayon' ? 'none' : '1px solid #ddd' }}>🏢 Instansi Rayon</button>
                <button onClick={() => setTabAkunPusat('pendamping-skp')} style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkunPusat === 'pendamping-skp' ? '#0000af' : '#f8f9fa', color: tabAkunPusat === 'pendamping-skp' ? 'white' : '#555', fontSize: '0.85rem', transition: '0.2s', boxShadow: tabAkunPusat === 'pendamping-skp' ? '0 4px 6px rgba(0,0,175,0.2)' : 'none', border: tabAkunPusat === 'pendamping-skp' ? 'none' : '1px solid #ddd' }}>👩 Pendamping SKP</button>
                <button onClick={() => setTabAkunPusat('kader-skp')} style={{ padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkunPusat === 'kader-skp' ? '#0000af' : '#f8f9fa', color: tabAkunPusat === 'kader-skp' ? 'white' : '#555', fontSize: '0.85rem', transition: '0.2s', boxShadow: tabAkunPusat === 'kader-skp' ? '0 4px 6px rgba(0,0,175,0.2)' : 'none', border: tabAkunPusat === 'kader-skp' ? 'none' : '1px solid #ddd' }}>🎓 Kader SKP</button>
              </div>

              {tabAkunPusat === 'rayon' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>✏️ Buat Akun Admin Rayon</h4>
                    <form onSubmit={handleBuatAkunRayon} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Rayon Pengenal</label>
                        <input type="text" placeholder="Misal: PR. PMII Tarbiyah" value={formRayon.nama_rayon} onChange={e => setFormRayon({...formRayon, nama_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Username Login (Kode Rayon) <span style={{fontSize:'0.65rem', fontWeight:'normal'}}>*huruf kecil tanpa spasi</span></label>
                        <input type="text" placeholder="Misal: admin_rkcd" value={formRayon.id_rayon} onChange={e => setFormRayon({...formRayon, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Password Login</label>
                        <input type="text" placeholder="Masukkan Password" value={formRayon.password} onChange={e => setFormRayon({...formRayon, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', width: '100%', height: '40px' }}>
                        {isSubmitting ? 'Memproses...' : '+ Daftarkan Rayon'}
                      </button>
                    </form>
                  </div>

                  <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
                    <table className="tabel-utama" style={{ minWidth: '400px' }}>
                      <thead style={{ borderBottom: '2px solid #eee' }}>
                        <tr>
                          <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Nama Rayon</th>
                          <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Username Login Admin</th>
                          <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Status</th>
                          <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataRayon.length === 0 ? (
                           <tr><td colSpan={4} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada data rayon yang terdaftar.</td></tr>
                        ) : (
                          dataRayon.map((rayon) => (
                            <tr key={rayon.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '15px 10px', fontWeight: 'bold', color: '#0d1b2a', textAlign: 'center' }}>{rayon.nama}</td>
                              <td style={{ padding: '15px 10px', color: '#666', textAlign: 'center' }}>{rayon.username}</td>
                              <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                <div onClick={() => handleUbahStatusAkun(rayon.id, rayon.status || 'Aktif')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!rayon.status || rayon.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!rayon.status || rayon.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: (!rayon.status || rayon.status === 'Aktif') ? '#2ecc71' : '#e74c3c' }}></span>
                                  {(!rayon.status || rayon.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                                </div>
                              </td>
                              <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                <button onClick={() => handleHapusRayon(rayon.id, rayon.nama)} style={{ color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#e74c3c'} onMouseOut={e => e.currentTarget.style.color = '#aaa'} title="Hapus Rayon">🗑️</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tabAkunPusat === 'pendamping-skp' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>✏️ Buat Pendamping SKP</h4>
                    <form onSubmit={handleBuatAkunPendampingSKP} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Lengkap</label>
                        <input type="text" placeholder="Misal: Siti Aminah" value={formPendampingSKP.nama} onChange={e => setFormPendampingSKP({...formPendampingSKP, nama: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Username Login</label>
                        <input type="text" placeholder="Misal: siti_skp" value={formPendampingSKP.username} onChange={e => setFormPendampingSKP({...formPendampingSKP, username: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Password Login</label>
                        <input type="text" placeholder="Masukkan Password" value={formPendampingSKP.password} onChange={e => setFormPendampingSKP({...formPendampingSKP, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', width: '100%', height: '40px' }}>
                        {isSubmitting ? 'Memproses...' : '+ Daftarkan Pendamping'}
                      </button>
                    </form>
                  </div>
                  <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
                    <table className="tabel-utama" style={{ minWidth: '400px' }}>
                      <thead style={{ borderBottom: '2px solid #eee' }}>
                        <tr>
                          <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Nama Pendamping</th>
                          <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Username</th>
                          <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Status</th>
                          <th style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: 'transparent', color: '#555' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataPendamping.filter(p => p.jenjangTugas === 'SKP').length === 0 ? (
                          <tr><td colSpan={4} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada pendamping SKP yang terdaftar.</td></tr>
                        ) : (
                          dataPendamping.filter(p => p.jenjangTugas === 'SKP').map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '15px 10px', fontWeight: 'bold', color: '#0d1b2a', textAlign: 'center' }}>{p.nama}</td>
                              <td style={{ padding: '15px 10px', color: '#666', textAlign: 'center' }}>{p.username}</td>
                              <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                <div onClick={() => handleUbahStatusAkun(p.id, p.status || 'Aktif')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!p.status || p.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!p.status || p.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: (!p.status || p.status === 'Aktif') ? '#2ecc71' : '#e74c3c' }}></span>
                                  {(!p.status || p.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                                </div>
                              </td>
                              <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                <button onClick={() => handleHapusAkunLain(p.id, p.nama)} style={{ color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#e74c3c'} onMouseOut={e => e.currentTarget.style.color = '#aaa'} title="Hapus Pendamping">🗑️</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
                      <form onSubmit={handleBuatAkunKaderSKP_Manual} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end' }}>
                        <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: '#777', fontStyle: 'italic', marginBottom: '5px' }}>Khusus kader delegasi luar yang belum punya akun. Jika NIM sudah ada di sistem, otomatis akan dihubungkan ke SKP.</div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>NIM Kader</label>
                          <input type="text" placeholder="NIM Kader" value={formKaderSKP.nim} onChange={e => setFormKaderSKP({...formKaderSKP, nim: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Lengkap</label>
                          <input type="text" placeholder="Nama Lengkap" value={formKaderSKP.nama} onChange={e => setFormKaderSKP({...formKaderSKP, nama: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Asal Rayon</label>
                          <select value={formKaderSKP.id_rayon} onChange={e => setFormKaderSKP({...formKaderSKP, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }}>
                             <option value="" disabled>-- Pilih Asal Rayon --</option>
                             {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                             <option value="Luar Komisariat">Delegasi Luar Komisariat</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Tahun Angkatan</label>
                          <input type="number" placeholder="Angkatan (Cth: 2026)" value={formKaderSKP.angkatan} onChange={e => setFormKaderSKP({...formKaderSKP, angkatan: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
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
                            
                            // Logika render multiple pendamping
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
          )}

          {/* ========================================================= */}
          {/* MENU BARU 4.5: PANTAU NILAI / RAPORT SKP KHUSUS KOMISARIAT  */}
          {/* ========================================================= */}
          {activeMenu === 'pantau-nilai-skp' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>Raport & Penilaian Peserta SKP</h3>
                <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Kelola nilai, bobot matriks, dan cetak Kartu Hasil Studi kader SKP.</p>
              </div>

              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader SKP:</span>
                  <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {databaseKader.filter(k => k.jenjang === 'SKP').length === 0 && <option value="">Tidak ada peserta SKP</option>}
                    {databaseKader.filter(k => k.jenjang === 'SKP').map(k => <option key={k.nim} value={k.nim}>{k.nama}</option>)}
                  </select>
                  
                  {tabRaportAdmin === 'raport' && selectedKaderNilai && (
                    <button onClick={() => window.print()} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>🖨️ Cetak KHS SKP</button>
                  )}
                </div>
              </div>
              
              <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '0px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabRaportAdmin('raport')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'raport' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'raport' ? '#fff' : 'transparent', color: tabRaportAdmin === 'raport' ? '#555' : '#0000af', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>Raport Kaderisasi</button>
                <button onClick={() => setTabRaportAdmin('persentase')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'persentase' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'persentase' ? '#fff' : 'transparent', color: tabRaportAdmin === 'persentase' ? '#555' : '#0000af', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>Persentase & Nilai</button>
                <button onClick={() => setTabRaportAdmin('pengaturan')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'pengaturan' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'pengaturan' ? '#fff' : 'transparent', color: tabRaportAdmin === 'pengaturan' ? '#555' : '#e67e22', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', marginLeft: 'auto', fontSize: '0.85rem' }}>⚙️ Pengaturan Cetak</button>
              </div>

              {tabRaportAdmin === 'raport' && (
                <div style={{ width: '100%', overflowX: 'auto', padding: '15px 0 0px 0' }}>
                  <table className="tabel-utama" style={{ minWidth: '600px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '5%' }}>No</th><th style={{ width: '12%', textAlign: 'center' }}>Kode</th><th style={{ width: '53%', textAlign: 'center' }}>Nama Materi SKP</th>
                        <th style={{ width: '8%' }}>SKS</th><th style={{ width: '8%' }}>Nilai Huruf</th><th style={{ width: '8%' }}>SKS x Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterKurikulum.filter(m => m.jenjang === 'SKP').length === 0 ? (<tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum SKP belum diatur.</td></tr>) : masterKurikulum.filter(m => m.jenjang === 'SKP').sort((a,b)=>a.kode.localeCompare(b.kode, undefined, {numeric: true})).map((materi, index) => {
                         let angkaAkhir = 0;
                         (kategoriBobotGlobal['SKP'] || []).forEach((kat: any) => {
                           const score = evaluasiKader?.nilai_mentah?.[materi.kode]?.[kat.nama] || 0;
                           angkaAkhir += (score * (kat.persen / 100));
                         });
                         const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                         const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                         const sksKali = materi.bobot * angka;
                         return (
                            <tr key={materi.kode}>
                              <td style={{ textAlign: 'center' }}>{index + 1}</td><td style={{ textAlign: 'center' }}>{materi.kode}</td><td style={{ fontWeight: 'bold' }}>{materi.nama}</td>
                              <td style={{ textAlign: 'center' }}>{materi.bobot}</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: huruf !== '-' ? '#27ae60' : '#999' }}>{huruf}</td><td style={{ textAlign: 'center' }}>{huruf !== '-' ? sksKali : 0}</td>
                            </tr>
                         )
                      })}
                      <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0)}</td><td></td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>{
                         let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                         const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                         const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                         return sum + (m.bobot * angka);
                      },0)}</td></tr>
                      <tr><td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kader)</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0) > 0 ? (masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>{
                         let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                         const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                         const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                         return sum + (m.bobot * angka);
                  },0) / masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0)).toFixed(2) : "0.00"}</td></tr>
                    </tbody>
                  </table>
                  <p style={{fontSize: '0.75rem', color: '#888', marginTop: '15px', fontStyle: 'italic'}}>*Catatan: Nilai Huruf terisi otomatis berdasarkan perhitungan Matriks di tab "Persentase & Nilai".</p>
                </div>
              )}

              {tabRaportAdmin === 'persentase' && (
                <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
                  <div className="no-print" style={{ marginBottom: '15px', background: '#fdfdfd', padding: '15px', borderRadius: '6px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', color: '#1e824c', fontSize: '0.9rem' }}>⚙️ Kategori & Bobot Penilaian SKP</h4>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {(kategoriBobotGlobal['SKP'] || []).map((kat: any) => (
                          <div key={kat.id} style={{ backgroundColor: '#eaf4fc', padding: '5px 10px', borderRadius: '20px', border: '1px solid #3498db', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{kat.nama}: {kat.persen}%</span>
                            <button type="button" onClick={async () => {
                               if(!window.confirm("Hapus kategori bobot ini?")) return;
                               const docRef = doc(db, "pengaturan_sistem", "komisariat_settings");
                               const newBobot = (kategoriBobotGlobal['SKP'] || []).filter((item: any) => item.id !== kat.id);
                               await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, 'SKP': newBobot } }, { merge: true });
                            }} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>×</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: 'bold', color: (kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) === 100 ? '#27ae60' : '#e67e22' }}>
                        Total Bobot Saat Ini: {(kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0)}% / 100%
                        {(kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) < 100 && <span style={{ fontStyle: 'italic', marginLeft: '5px', color: '#e74c3c' }}>(Harap lengkapi hingga 100% agar nilai akurat)</span>}
                      </div>
                    </div>
                    <form onSubmit={async (e) => {
                       e.preventDefault();
                       const tBobot = (kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0);
                       if(tBobot + formKategori.persen > 100) return alert("Total bobot tidak boleh melebihi 100%!");
                       setIsSavingEvaluasi(true);
                       try {
                         const docRef = doc(db, "pengaturan_sistem", "komisariat_settings");
                         const newBobot = [...(kategoriBobotGlobal['SKP'] || []), { id: Date.now().toString(), nama: formKategori.nama, persen: formKategori.persen }];
                         await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, 'SKP': newBobot } }, { merge: true });
                         setFormKategori({ nama: '', persen: 0 });
                       } catch (error) {} finally { setIsSavingEvaluasi(false); }
                    }} style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" required placeholder="Nama Kategori" value={formKategori.nama} onChange={e => setFormKategori({...formKategori, nama: e.target.value})} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', width: '120px' }} />
                      <input type="number" required placeholder="Bobot %" value={formKategori.persen || ''} onChange={e => setFormKategori({...formKategori, persen: Number(e.target.value)})} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', width: '80px' }} />
                      <button type="submit" disabled={isSavingEvaluasi || (kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100} style={{ background: ((kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100) ? '#ccc' : '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: ((kategoriBobotGlobal['SKP'] || []).reduce((sum: number, k: any) => sum + k.persen, 0) >= 100) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>➕</button>
                    </form>
                  </div>

                  <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ width: '3%', textAlign: 'center' }}>No</th>
                        <th rowSpan={2} style={{ width: '10%', textAlign: 'center' }}>Kode</th>
                        <th rowSpan={2} style={{ width: '25%', textAlign: 'center' }}>Nama Materi</th>
                        {(kategoriBobotGlobal['SKP'] || []).length > 0 && <th colSpan={(kategoriBobotGlobal['SKP'] || []).length} style={{ borderBottom: '1px solid #ddd', textAlign: 'center', backgroundColor: '#f0fbf4' }}>Input Nilai Detail (0-100)</th>}
                        <th rowSpan={2} style={{ width: '5%', textAlign: 'center' }}>SKS</th>
                        <th colSpan={2} style={{ borderBottom: '1px solid #ddd', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Hasil Akhir</th>
                      </tr>
                      <tr>
                        {(kategoriBobotGlobal['SKP'] || []).map((kat: any) => (
                          <th key={kat.id} style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#1e824c', backgroundColor: '#f0fbf4' }}>{kat.nama} <br/><span style={{color: '#e74c3c'}}>{kat.persen}%</span></th>
                        ))}
                        <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Angka</th>
                        <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', textAlign: 'center', backgroundColor: '#eaf4fc' }}>Huruf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterKurikulum.filter(m => m.jenjang === 'SKP').length === 0 ? (
                        <tr><td colSpan={7 + (kategoriBobotGlobal['SKP'] || []).length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi SKP.</td></tr>
                      ) : (
                        masterKurikulum.filter(m => m.jenjang === 'SKP').map((materi, index) => {
                          let angkaAkhir = 0;
                          (kategoriBobotGlobal['SKP'] || []).forEach((kat: any) => {
                              const score = nilaiMentah[materi.kode]?.[kat.nama] || 0;
                              angkaAkhir += (score * (kat.persen / 100));
                          });
                          const hurufAkhir = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';

                          return (
                            <tr key={`rinci-${materi.kode}`}>
                              <td>{index + 1}</td><td style={{ textAlign: 'left' }}>{materi.kode}</td><td style={{ textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
                              {(kategoriBobotGlobal['SKP'] || []).map((kat: any) => (
                                <td key={kat.id} style={{ backgroundColor: '#fcfcfc' }}>
                                  <input type="number" className="no-print" min="0" max="100" placeholder="0" value={nilaiMentah[materi.kode]?.[kat.nama] === 0 ? '' : (nilaiMentah[materi.kode]?.[kat.nama] || '')} 
                                    onChange={(e) => {
                                       let valNum = Number(e.target.value); if (valNum > 100) valNum = 100; if (valNum < 0) valNum = 0;
                                       setNilaiMentah({ ...nilaiMentah, [materi.kode]: { ...(nilaiMentah[materi.kode] || {}), [kat.nama]: valNum } });
                                    }} 
                                    onBlur={async () => {
                                       if (!selectedKaderNilai) return;
                                       try {
                                         const docRef = doc(db, "evaluasi_kader", selectedKaderNilai);
                                         const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                                         const jenjangData = currentEvaluasi['SKP'] || { nilai_mentah: {}, catatan: evaluasiKader.catatan };
                                         await setDoc(docRef, { ...currentEvaluasi, ['SKP']: { ...jenjangData, nilai_mentah: nilaiMentah } }, { merge: true });
                                         await setDoc(doc(db, "nilai_khs", selectedKaderNilai), { [materi.kode]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: "Admin Komisariat" }, { merge: true });
                                       } catch (error) {}
                                    }} 
                                    style={{ width: '50px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none' }} />
                                </td>
                              ))}
                              <td>{materi.bobot}</td>
                              <td style={{ fontWeight: 'bold', color: '#004a87', backgroundColor: '#f4f9fd' }}>{angkaAkhir > 0 ? angkaAkhir.toFixed(1) : '-'}</td>
                              <td style={{ fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#f4f9fd', fontSize: '1rem' }}>{hurufAkhir}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                  <div className="no-print" style={{ marginTop: '20px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Catatan Evaluasi SKP:</label>
                    <textarea value={evaluasiKader.catatan} onChange={async e => {
                       setEvaluasiKader({ ...evaluasiKader, catatan: e.target.value });
                       try {
                         const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
                         const jenjangData = currentEvaluasi['SKP'] || { nilai_mentah: {}, catatan: '' };
                         await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, ['SKP']: { ...jenjangData, catatan: e.target.value } }, { merge: true });
                       } catch (error) {}
                    }} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', height: '60px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box' }} placeholder="Tulis catatan perkembangan kader disini..." />
                  </div>
                </div>
              )}

              {/* TAB PENGATURAN KOP CETAK SKP */}
              {tabRaportAdmin === 'pengaturan' && (
                <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}>
                  <form onSubmit={async (e) => {
                     e.preventDefault(); setIsSavingPengaturan(true);
                     try {
                       let newKop = pengaturanCetak.kopSuratUrl;
                       if (fileKop) newKop = await uploadToCloudinary(fileKop);
                       await setDoc(doc(db, "pengaturan_sistem", "komisariat_settings"), { kopSuratUrl: newKop }, { merge: true });
                       alert("Pengaturan Kop berhasil disimpan!"); setFileKop(null);
                     } catch (error) {} finally { setIsSavingPengaturan(false); }
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
                    <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px', borderLeft: '4px solid #f1c40f', fontSize: '0.8rem', color: '#856404', lineHeight: '1.4' }}><b>PENTING:</b> Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan TANDA TANGAN di bagian bawah. Gambar ini akan menjadi background pada saat cetak PDF SKP.</div>
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#333', fontSize: '0.85rem' }}>Upload Template Background A4 (Komisariat)</label>
                      {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '10px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px' }} />}
                      <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #ccc', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
                    </div>
                    <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* MENU 5: MASTER KURIKULUM PUSAT (FORMAL/MODERN LAYOUT) */}
          {activeMenu === 'master-kurikulum' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📑 Master Kurikulum Kaderisasi</h3>
                <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Susun standar kurikulum yang komprehensif sebagai acuan seluruh Rayon se-UIN Malang.</p>
                
                {/* FORM TOP LAYOUT */}
                <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
                  <h4 style={{ marginTop: 0, color: '#333', fontSize: '0.9rem', marginBottom: '15px' }}>➕ Tambah Standar Kurikulum</h4>
                  <form onSubmit={async (e) => {
                     e.preventDefault();
                     try { await addDoc(collection(db, "master_kurikulum_pusat"), { ...formKurikulum, timestamp: Date.now() }); setFormKurikulum({ ...formKurikulum, kode: '', nama: '', muatan: '' }); } catch (error) { }
                  }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Jenjang Kaderisasi</label>
                      <select required value={formKurikulum.jenjang} onChange={e => setFormKurikulum({...formKurikulum, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Kode Materi</label>
                      <input type="text" placeholder="Cth: MPB-01" required value={formKurikulum.kode} onChange={e => setFormKurikulum({...formKurikulum, kode: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Bobot (SKS)</label>
                      <input type="number" placeholder="SKS" required value={formKurikulum.bobot} onChange={e => setFormKurikulum({...formKurikulum, bobot: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Nama Materi Besar</label>
                      <input type="text" placeholder="Misal: Sejarah PMII" required value={formKurikulum.nama} onChange={e => setFormKurikulum({...formKurikulum, nama: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Muatan / Sub Pembahasan</label>
                      <textarea rows={2} placeholder="Detail silabus..." value={formKurikulum.muatan} onChange={e => setFormKurikulum({...formKurikulum, muatan: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>+ Simpan Kurikulum Standar</button>
                    </div>
                  </form>
                </div>

                {/* TABLE BOTTOM LAYOUT */}
                <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.85rem' }}>Filter Jenjang Tabel:</label>
                  <select value={filterJenjangKurikulum} onChange={(e) => setFilterJenjangKurikulum(e.target.value)} style={{ padding: '8px 15px', border: '1px solid #1e824c', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#1e824c' }}>
                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
                  </select>
                </div>

                <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
                  <table className="tabel-utama" style={{ minWidth: '700px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', width: '10%' }}>Jenjang</th>
                        <th style={{ textAlign: 'center', width: '10%' }}>Kode</th>
                        <th style={{ textAlign: 'center', width: '50%' }}>Nama Materi & Muatan</th>
                        <th style={{ textAlign: 'center', width: '10%' }}>Bobot</th>
                        <th style={{ textAlign: 'center', width: '20%' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filteredKurikulum = masterKurikulum.filter(m => m.jenjang === filterJenjangKurikulum).sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' }));
                        if (filteredKurikulum.length === 0) return <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada data kurikulum pusat untuk jenjang {filterJenjangKurikulum}.</td></tr>;
                        return filteredKurikulum.map((materi) => {
                          if (editingKurikulumId === materi.id) {
                            return (
                              <tr key={materi.id} style={{ backgroundColor: '#fff9e6' }}>
                                <td style={{ fontWeight: 'bold', color: '#1e824c', textAlign: 'center' }}>{materi.jenjang}</td>
                                <td><input type="text" value={editKurikulumForm.kode} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, kode: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}/></td>
                                <td><input type="text" value={editKurikulumForm.nama} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, nama: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '4px' }}/><textarea value={editKurikulumForm.muatan} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, muatan: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} rows={2}/></td>
                                <td style={{ textAlign: 'center' }}><input type="number" value={editKurikulumForm.bobot} onChange={(e) => setEditKurikulumForm({...editKurikulumForm, bobot: Number(e.target.value)})} style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center' }}/></td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{display: 'flex', gap: '5px', justifyContent: 'center'}}>
                                    <button onClick={async () => {
                                       if (!editKurikulumForm.kode || !editKurikulumForm.nama) return;
                                       try { await updateDoc(doc(db, "master_kurikulum_pusat", materi.id), { kode: editKurikulumForm.kode, nama: editKurikulumForm.nama, muatan: editKurikulumForm.muatan, bobot: Number(editKurikulumForm.bobot) }); setEditingKurikulumId(null); } catch(err) {}
                                    }} style={{ color: 'white', backgroundColor: '#2ecc71', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Simpan</button>
                                    <button onClick={() => setEditingKurikulumId(null)} style={{ color: 'white', backgroundColor: '#95a5a6', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Batal</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={materi.id}>
                              <td style={{ fontWeight: 'bold', textAlign: 'center', color: materi.jenjang === 'MAPABA' ? '#1e824c' : materi.jenjang === 'PKD' ? '#8e44ad' : '#e67e22' }}>{materi.jenjang}</td>
                              <td style={{ color: '#666', fontWeight: 'bold', textAlign: 'center' }}>{materi.kode}</td>
                              <td><div style={{ color: '#333', fontWeight: 'bold', marginBottom: '2px', fontSize: '0.85rem' }}>{materi.nama}</div><div style={{ color: '#777', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{materi.muatan || '-'}</div></td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{materi.bobot}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button onClick={() => { setEditingKurikulumId(materi.id); setEditKurikulumForm({ kode: materi.kode, nama: materi.nama, muatan: materi.muatan || '', bobot: materi.bobot }); }} style={{ color: '#3498db', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', marginRight: '10px', transition: '0.2s' }} title="Edit Materi">✏️</button>
                                <button onClick={async () => {
                                   if(window.confirm("Hapus materi ini dari standar pusat?")) { await deleteDoc(doc(db, "master_kurikulum_pusat", materi.id)); catatLogAktivitas(`Menghapus Kurikulum Pusat: ${materi.nama}`); }
                                }} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', transition: '0.2s' }} title="Hapus Materi">🗑️</button>
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
          )}

          {/* MENU 6: MASTER TES PEMAHAMAN PUSAT (FORMAL/MODERN LAYOUT) */}
          {activeMenu === 'master-tes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📝 Master Tes Pemahaman Kaderisasi</h3>
                <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Susun standar pertanyaan tes (Pre-Test/Post-Test) yang dapat digunakan oleh seluruh Rayon atau Kader secara langsung.</p>
                
                {selectedTesHasil ? (
                  <div style={{ backgroundColor: '#fcfcfc', borderRadius: '10px', border: '1px solid #eaeaea', padding: '20px' }}>
                    <button className="no-print" onClick={() => setSelectedTesHasil(null)} style={{ marginBottom: '15px', padding: '6px 15px', backgroundColor: '#fdfdfd', border: '1px solid #ccc', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', color: '#555' }}>⬅️ Kembali ke Daftar</button>
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ color: '#1e824c', margin: 0, fontSize: '1rem' }}>Data Hasil Ujian: {selectedTesHasil.judul}</h4>
                      <button onClick={() => window.print()} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>🖨️ Cetak Semua Jawaban</button>
                    </div>

                    <div className="no-print" style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '8px' }}>
                      <table className="tabel-utama" style={{ minWidth: '800px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '15%', textAlign: 'left' }}>Waktu Submit</th>
                            <th style={{ width: '25%', textAlign: 'left' }}>Data Kader</th>
                            <th style={{ width: '60%', textAlign: 'left' }}>Jawaban Kader</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jawabanTesViewer.length === 0 ? (
                            <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada kader yang mengumpulkan jawaban.</td></tr>
                          ) : (
                            jawabanTesViewer.map((jawab: any) => (
                              <tr key={jawab.nim}>
                                <td style={{ verticalAlign: 'top', fontSize: '0.75rem', color: '#555' }}>{jawab.tanggal}</td>
                                <td style={{ verticalAlign: 'top' }}>
                                  <div style={{fontWeight: 'bold', color: '#0d1b2a'}}>{jawab.nama}</div>
                                  <div style={{fontSize: '0.75rem', color: '#888'}}>NIM: {jawab.nim}</div>
                                </td>
                                <td style={{ verticalAlign: 'top' }}>
                                  <details style={{ cursor: 'pointer', outline: 'none' }}>
                                    <summary style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.8rem', padding: '5px', backgroundColor: '#eaf4fc', borderRadius: '4px', display: 'inline-block' }}>Lihat Jawaban</summary>
                                    <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
                                      {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                        <div key={i} style={{ marginBottom: '12px' }}>
                                          <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem' }}>Q: {soal}</div>
                                          <div style={{ color: '#004a87', fontStyle: 'italic', paddingLeft: '12px', borderLeft: '3px solid #3498db', marginTop: '6px', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>A: {jawab.jawaban[i] || '- Kosong -'}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* TAMPILAN KHUSUS PRINT (BLOK PER KADER BINAAN) */}
                    <div className="print-only-container" style={{ display: 'none' }}>
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 20px 0', fontSize: '12pt', textTransform: 'uppercase' }}>REKAP JAWABAN KADER: {selectedTesHasil.judul}</h3>
                      {jawabanTesViewer.map((jawab: any) => (
                          <div key={jawab.nim} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                            <table className="tabel-biodata" style={{ marginBottom: '10px' }}>
                              <tbody>
                                <tr><td style={{width: '150px'}}>Nama Kader Binaan</td><td style={{width: '15px'}}>:</td><td style={{fontWeight: 'bold'}}>{jawab.nama}</td></tr>
                                <tr><td>NIM</td><td>:</td><td>{jawab.nim}</td></tr>
                                <tr><td>Waktu Submit</td><td>:</td><td>{jawab.tanggal}</td></tr>
                              </tbody>
                            </table>
                            <table className="tabel-utama">
                              <thead><tr><th style={{ width: '5%' }}>No</th><th style={{ width: '45%', textAlign: 'left' }}>Pertanyaan</th><th style={{ width: '50%', textAlign: 'left' }}>Jawaban Kader</th></tr></thead>
                              <tbody>
                                {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                  <tr key={i}><td style={{ textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td><td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{soal}</td><td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap', fontStyle: 'italic', color: '#333' }}>{jawab.jawaban[i] || '- Kosong -'}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                      ))}
                    </div>

                  </div>
                ) : (
                  <>
                    {/* FORM TOP LAYOUT */}
                    <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
                      <h4 style={{ marginTop: 0, color: '#333', fontSize: '0.9rem', marginBottom: '15px' }}>➕ Buat Standar Tes Baru</h4>
                      <form onSubmit={async (e) => {
                         e.preventDefault(); if (!formTesPusat.judul || !formTesPusat.soal) return;
                         const daftarSoalArray = formTesPusat.soal.split('\n').filter(s => s.trim() !== '');
                         try { await addDoc(collection(db, "master_tes_pusat"), { judul: formTesPusat.judul, jenjang: formTesPusat.jenjang, daftar_soal: daftarSoalArray, status: 'Tutup', timestamp: Date.now() }); setFormTesPusat({ judul: '', jenjang: 'MAPABA', soal: '' }); } catch (error) { }
                      }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'start' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Judul Tes</label>
                          <input type="text" placeholder="Cth: Pre-Test Aswaja" required value={formTesPusat.judul} onChange={e => setFormTesPusat({...formTesPusat, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Jenjang Kaderisasi Target</label>
                          <select required value={formTesPusat.jenjang} onChange={e => setFormTesPusat({...formTesPusat, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG (Sekolah Islam Gender)</option><option value="SKP">SKP (Sekolah Kader Putri)</option><option value="NONFORMAL">Non-Formal</option><option value="Umum">Umum (Semua)</option>
                          </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Daftar Pertanyaan <span style={{color: '#e67e22', fontStyle: 'italic'}}>(*Tekan Enter untuk memisahkan tiap soal)</span></label>
                          <textarea rows={4} placeholder="1. Jelaskan definisi Aswaja!&#10;2. Sebutkan tokoh-tokoh penting!" required value={formTesPusat.soal} onChange={e => setFormTesPusat({...formTesPusat, soal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Master Tes</button>
                        </div>
                      </form>
                    </div>

                    {/* TABLE BOTTOM LAYOUT */}
                    <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
                      <table className="tabel-utama" style={{ minWidth: '700px' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'center', width: '15%' }}>Jenjang</th>
                            <th style={{ textAlign: 'center', width: '35%' }}>Judul Tes</th>
                            <th style={{ textAlign: 'center', width: '10%' }}>Jumlah Soal</th>
                            <th style={{ textAlign: 'center', width: '15%' }}>Status Tes</th>
                            <th style={{ textAlign: 'center', width: '25%' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masterTesPusat.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada data master tes pusat.</td></tr>
                          ) : (
                            masterTesPusat.sort((a,b) => a.jenjang.localeCompare(b.jenjang)).map((tes) => (
                              <tr key={tes.id}>
                                <td style={{ fontWeight: 'bold', textAlign: 'center', color: tes.jenjang === 'MAPABA' ? '#1e824c' : tes.jenjang === 'PKD' ? '#8e44ad' : '#e67e22' }}>{tes.jenjang}</td>
                                <td>
                                  <div style={{ color: '#333', fontWeight: 'bold', marginBottom: '4px', fontSize: '0.9rem' }}>{tes.judul}</div>
                                  <details style={{ cursor: 'pointer', outline: 'none' }}>
                                    <summary style={{ fontSize: '0.75rem', color: '#3498db', fontWeight: 'bold', backgroundColor: '#eaf4fc', padding: '2px 8px', borderRadius: '12px', display: 'inline-block' }}>Lihat Soal</summary>
                                    <ol style={{ fontSize: '0.75rem', color: '#555', paddingLeft: '15px', margin: '8px 0 0 0' }}>
                                      {(tes.daftar_soal || []).map((s: string, i: number) => <li key={i} style={{ marginBottom: '4px' }}>{s}</li>)}
                                    </ol>
                                  </details>
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#555', fontSize: '1rem' }}>{tes.daftar_soal?.length || 0}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <div onClick={async () => {
                                     const statusAkanDatang = tes.status === 'Buka' ? 'Tutup' : 'Buka';
                                     if (!window.confirm(`Ubah status tes menjadi: ${statusAkanDatang}?`)) return;
                                     try { await updateDoc(doc(db, "master_tes_pusat", tes.id), { status: statusAkanDatang }); } catch (error) {}
                                  }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tes.status === 'Buka' ? '#e8f5e9' : '#ffebee', color: tes.status === 'Buka' ? '#2e7d32' : '#c62828' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: tes.status === 'Buka' ? '#2ecc71' : '#e74c3c' }}></span>
                                    {tes.status === 'Buka' ? 'Dibuka' : 'Ditutup'}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button onClick={async () => {
                                       setSelectedTesHasil(tes);
                                       try {
                                         const q = query(collection(db, "jawaban_tes"), where("id_tes", "==", tes.id));
                                         const snap = await getDocs(q);
                                         const dataJawaban = snap.docs.map(doc => doc.data());
                                         dataJawaban.sort((a: any, b: any) => b.timestamp - a.timestamp);
                                         setJawabanTesViewer(dataJawaban);
                                       } catch (error) { alert("Gagal memuat data."); }
                                    }} style={{ color: 'white', backgroundColor: '#3498db', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Lihat Hasil</button>
                                    <button onClick={async () => {
                                       if (window.confirm("Hapus tes ini dari standar pusat?")) { await deleteDoc(doc(db, "master_tes_pusat", tes.id)); catatLogAktivitas(`Menghapus Master Tes Pusat: ${tes.judul}`); }
                                    }} style={{ color: 'white', backgroundColor: '#e74c3c', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Hapus Tes</button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* MENU 7: DATABASE KADER GLOBAL (SUPER ADMIN) DENGAN PAGINATION & MODAL */}
          {activeMenu === 'database-kader' && (
            <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>Database Kader Global (Super Admin)</h3>
                  <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Manajemen data kader tingkat pusat. Perubahan di sini akan memengaruhi data di seluruh Rayon.</p>
                </div>
                <button onClick={() => {
                  if (databaseKader.length === 0) return alert("Database Kosong!");
                  const dataToExport = databaseKader.map((k, i) => ({
                    "No": i + 1, "NIM": k.nim || '-', "Nama Lengkap": k.nama || '-', "NIA": k.nia || '-', "Asal Rayon": getNamaRayon(k.id_rayon), "Jenjang Terakhir": k.jenjang || 'MAPABA', "Status": k.status || 'Aktif'
                  }));
                  const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Database Kader"); XLSX.writeFile(wb, `Database_Kader_Global_${Date.now()}.xlsx`);
                }} style={{ backgroundColor: '#0000af', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📥 Export Data Excel Full
                </button>
              </div>
              
              {/* FILTER BAR PENCARIAN & PAGINATION */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', backgroundColor: '#fcfcfc', padding: '15px', borderRadius: '10px', border: '1px solid #eaeaea', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="text" placeholder="Cari NIM atau Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} style={{ flex: '1 1 200px', padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} />
                <select value={filterRayonKader} onChange={(e) => setFilterRayonKader(e.target.value)} style={{ flex: '1 1 150px', padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="">-- Semua Rayon --</option>
                  {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                   <span style={{fontSize: '0.85rem', color: '#555', fontWeight: 'bold'}}>Tampilkan Baris:</span>
                   <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setKaderPage(1); }} style={{ padding: '8px 12px', border: '1px solid #0000af', color: '#0000af', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                     <option value={10}>10 Baris</option><option value={50}>50 Baris</option><option value={100}>100 Baris</option><option value={250}>250 Baris</option>
                   </select>
                </div>
              </div>

              {/* TABEL DATA KADER (PAGINATED) */}
              <div style={{ overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', boxSizing: 'border-box' }}>
                <table className="tabel-utama" style={{ minWidth: '950px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '5%' }}>No</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>NIM / Password</th>
                      <th style={{ textAlign: 'left', width: '25%' }}>Nama Lengkap</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Asal Instansi</th>
                      <th style={{ textAlign: 'center', width: '10%' }}>Jenjang</th>
                      <th style={{ textAlign: 'center', width: '10%' }}>Status</th>
                      <th style={{ textAlign: 'center', width: '20%' }}>Aksi Super Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredKaderDB = databaseKader.filter(kader => {
                        const matchSearch = kader.nama?.toLowerCase().includes(searchKader.toLowerCase()) || kader.nim?.includes(searchKader);
                        const matchRayon = filterRayonKader === '' || kader.id_rayon === filterRayonKader;
                        return matchSearch && matchRayon;
                      });

                      const indexOfLastKader = kaderPage * itemsPerPage;
                      const indexOfFirstKader = indexOfLastKader - itemsPerPage;
                      const currentKaderDisplay = filteredKaderDB.slice(indexOfFirstKader, indexOfLastKader);
                      const totalPagesKader = Math.ceil(filteredKaderDB.length / itemsPerPage);

                      if (currentKaderDisplay.length === 0) {
                        return <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Data kader tidak ditemukan.</td></tr>;
                      }

                      return currentKaderDisplay.map((kader, idx) => (
                        <tr key={kader.nim}>
                          <td style={{ textAlign: 'center', color: '#666' }}>{indexOfFirstKader + idx + 1}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{color: '#0d1b2a', fontWeight: 'bold'}}>{kader.nim}</div>
                            <div style={{color: '#e74c3c', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '2px'}} title="Kata Sandi / Tgl Lahir">🔑 {kader.tanggalLahir || '-'}</div>
                          </td>
                          <td>
                            <div style={{ color: '#333', fontWeight: 'bold', fontSize: '0.9rem' }}>{kader.nama}</div>
                            <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '2px' }}>NIA: {kader.nia || 'Belum Ada'} | Thn: {kader.angkatan || '-'}</div>
                          </td>
                          <td style={{ color: '#1e824c', fontWeight: 'bold', textAlign: 'center', fontSize: '0.85rem' }}>{getNamaRayon(kader.id_rayon)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#eaf4fc', color: '#0000af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{kader.jenjang || 'MAPABA'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                             <div onClick={async () => {
                               const statusBaru = kader.status === "Aktif" ? "Pasif" : "Aktif"; if (!window.confirm(`Ubah status akun ini menjadi ${statusBaru}?`)) return;
                               try { await updateDoc(doc(db, "users", kader.id), { status: statusBaru }); } catch (error) {}
                             }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!kader.status || kader.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!kader.status || kader.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                               <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: (!kader.status || kader.status === 'Aktif') ? '#2ecc71' : '#e74c3c' }}></span>
                               {(!kader.status || kader.status === 'Aktif') ? 'Aktif' : 'Pasif'}
                             </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                              <button onClick={() => {
                                setEditKaderModal({
                                  oldNim: kader.nim, id: kader.id, nim: kader.nim, nama: kader.nama, nia: kader.nia || '', angkatan: kader.angkatan || '',
                                  tanggalLahir: kader.tanggalLahir || '', id_rayon: kader.id_rayon || '', jenjang: kader.jenjang || 'MAPABA',
                                  riwayat_kaderisasi: kader.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false },
                                  pendamping_mapaba_id: kader.pendamping_mapaba_id || (kader.pendampingId ? (Array.isArray(kader.pendampingId) ? kader.pendampingId : [kader.pendampingId]) : []),
                                  pendamping_pkd_id: kader.pendamping_pkd_id || [],
                                  pendamping_sig_id: kader.pendamping_sig_id || [],
                                  pendamping_skp_id: kader.pendamping_skp_id || []
                                });
                              }} style={{ backgroundColor: '#f1c40f', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', transition: '0.2s' }}>✏️ Edit</button>
                              <button onClick={async () => {
                                 if(!window.confirm(`PERINGATAN KERAS!\nAnda yakin ingin menghapus "${kader.nama}" secara TOTAL dari seluruh sistem database UIN?\nSemua nilai, tugas, dan histori akan lenyap!`)) return;
                                 try {
                                   await deleteDoc(doc(db, "users", kader.id)); await deleteDoc(doc(db, "nilai_khs", kader.nim)); await deleteDoc(doc(db, "evaluasi_kader", kader.nim));
                                   if (kader.email) {
                                       const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", kader.email));
                                       const snapBerkas = await getDocs(qBerkas); snapBerkas.forEach(d => deleteDoc(d.ref));
                                   }
                                   const qTes = query(collection(db, "jawaban_tes"), where("nim", "==", kader.nim));
                                   const snapTes = await getDocs(qTes); snapTes.forEach(d => deleteDoc(d.ref));
                                   alert("Kader telah dihapus secara permanen dari seluruh sistem.");
                                 } catch (error) { alert("Gagal menghapus total."); }
                              }} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', transition: '0.2s' }}>🗑️ Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* FOOTER PAGINATION */}
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
                  <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                    <button onClick={() => setEditKaderModal(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', color: '#555', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>✖</button>
                    
                    <h3 style={{ marginTop: 0, color: '#0000af', borderBottom: '2px solid #eaeaea', paddingBottom: '15px', marginBottom: '20px', fontSize: '1.3rem' }}>⚙️ Panel Edit Database Kader (Super Admin)</h3>
                    
                    <form onSubmit={async (e) => {
                       e.preventDefault(); setIsSubmitting(true);
                       try {
                         const newNim = editKaderModal.nim.trim(); const docRef = doc(db, "users", editKaderModal.id);
                         if (newNim !== editKaderModal.oldNim) {
                            const oldKaderData = (await getDocs(query(collection(db, "users"), where("nim", "==", editKaderModal.oldNim)))).docs[0]?.data() || {};
                            await setDoc(doc(db, "users", newNim), { 
                              ...oldKaderData, nim: newNim, nama: editKaderModal.nama, nia: editKaderModal.nia, 
                              angkatan: editKaderModal.angkatan, tanggalLahir: editKaderModal.tanggalLahir, 
                              id_rayon: editKaderModal.id_rayon, jenjang: editKaderModal.jenjang, riwayat_kaderisasi: editKaderModal.riwayat_kaderisasi,
                              pendamping_mapaba_id: editKaderModal.pendamping_mapaba_id,
                              pendamping_pkd_id: editKaderModal.pendamping_pkd_id,
                              pendamping_sig_id: editKaderModal.pendamping_sig_id,
                              pendamping_skp_id: editKaderModal.pendamping_skp_id
                            });
                            await deleteDoc(docRef); alert("Data & NIM berhasil diperbarui! Pastikan tugas/nilai kader disesuaikan jika perlu.");
                         } else {
                            await updateDoc(docRef, { 
                              nama: editKaderModal.nama, nia: editKaderModal.nia, angkatan: editKaderModal.angkatan, 
                              tanggalLahir: editKaderModal.tanggalLahir, id_rayon: editKaderModal.id_rayon, jenjang: editKaderModal.jenjang, riwayat_kaderisasi: editKaderModal.riwayat_kaderisasi,
                              pendamping_mapaba_id: editKaderModal.pendamping_mapaba_id,
                              pendamping_pkd_id: editKaderModal.pendamping_pkd_id,
                              pendamping_sig_id: editKaderModal.pendamping_sig_id,
                              pendamping_skp_id: editKaderModal.pendamping_skp_id
                            });
                            alert("Data berhasil diperbarui!");
                         }
                         setEditKaderModal(null);
                       } catch (error) { alert("Terjadi kesalahan saat menyimpan data."); } finally { setIsSubmitting(false); }
                    }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                         <div>
                           <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Nama Lengkap</label>
                           <input type="text" required value={editKaderModal.nama} onChange={e => setEditKaderModal({...editKaderModal, nama: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem' }} />
                         </div>
                         <div>
                           <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>NIM Induk Database</label>
                           <input type="text" required value={editKaderModal.nim} onChange={e => setEditKaderModal({...editKaderModal, nim: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem' }} />
                         </div>
                         <div>
                           <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Nomor Induk Anggota (NIA)</label>
                           <input type="text" value={editKaderModal.nia} onChange={e => setEditKaderModal({...editKaderModal, nia: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem' }} />
                         </div>
                         <div>
                           <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Ubah Asal Rayon (Permanen)</label>
                           <select value={editKaderModal.id_rayon} onChange={e => setEditKaderModal({...editKaderModal, id_rayon: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                             {dataRayon.map(r => <option key={r.id_rayon} value={r.id_rayon}>{r.nama}</option>)}
                             <option value="Luar Komisariat">Delegasi Luar Komisariat</option>
                           </select>
                         </div>
                         <div>
                           <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Tahun Angkatan</label>
                           <input type="number" required value={editKaderModal.angkatan} onChange={e => setEditKaderModal({...editKaderModal, angkatan: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem' }} />
                         </div>
                         <div>
                           <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px', display: 'block' }}>Tanggal Lahir / Password Login</label>
                           <input type="text" value={editKaderModal.tanggalLahir} onChange={e => setEditKaderModal({...editKaderModal, tanggalLahir: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem' }} />
                         </div>
                      </div>

                      <div style={{ backgroundColor: '#f0fbf4', border: '1px solid #27ae60', padding: '20px', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#1e824c', fontSize: '0.95rem' }}>🎓 Histori & Jenjang Kaderisasi</h4>
                        <p style={{fontSize: '0.75rem', color: '#555', marginTop: '-10px', marginBottom: '15px'}}>Centang jenjang di bawah ini jika kader tersebut sudah lulus/selesai mengikutinya. Ini akan membuka akses mereka ke perpustakaan/tugas jenjang lanjutan.</p>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          {['MAPABA', 'PKD', 'SIG', 'SKP'].map(jenjang => (
                            <label key={jenjang} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#333', cursor: 'pointer', backgroundColor: '#fff', padding: '8px 15px', borderRadius: '20px', border: '1px solid #ddd' }}>
                              <input type="checkbox" checked={editKaderModal.riwayat_kaderisasi[jenjang] || false} onChange={() => { setEditKaderModal({ ...editKaderModal, riwayat_kaderisasi: { ...editKaderModal.riwayat_kaderisasi, [jenjang]: !editKaderModal.riwayat_kaderisasi[jenjang] } }); }} style={{ transform: 'scale(1.2)', accentColor: '#27ae60' }} />
                              Lulus {jenjang}
                            </label>
                          ))}
                        </div>
                        
                        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px dashed #27ae60' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e824c', marginBottom: '8px', display: 'block' }}>Set Status Jenjang TERTINGGI Saat Ini (Dipakai sebagai acuan IPK Raport):</label>
                          <select value={editKaderModal.jenjang} onChange={e => setEditKaderModal({...editKaderModal, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #27ae60', borderRadius: '6px', fontWeight: 'bold', color: '#27ae60', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#fdfdfd', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#0d1b2a', fontSize: '1rem' }}>👨‍🏫 Plotting Pendamping per Jenjang</h4>
                        <p style={{fontSize: '0.75rem', color: '#555', marginTop: '0', marginBottom: '15px'}}>Pilih pendamping yang bertugas membimbing kader ini di setiap jenjangnya. (Dapat dipilih lebih dari satu dari berbagai Rayon/Komisariat)</p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                          {['mapaba', 'pkd', 'sig', 'skp'].map(jenjangKey => {
                              const fieldName = `pendamping_${jenjangKey}_id`;
                              const jenjangLabel = jenjangKey.toUpperCase();
                              return (
                                <div key={jenjangKey} style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '10px', backgroundColor: '#fff' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#1e824c', display: 'block', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Pendamping {jenjangLabel}</label>
                                  <div style={{ maxHeight: '150px', overflowY: 'auto', padding: '2px' }}>
                                    {dataPendamping.map(p => (
                                      <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', fontSize: '0.7rem', marginBottom: '6px', cursor: 'pointer', color: '#333' }}>
                                        <input 
                                          type="checkbox" 
                                          value={p.username}
                                          checked={(editKaderModal[fieldName] || []).includes(p.username)}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const currentArr = editKaderModal[fieldName] || [];
                                            if(e.target.checked) setEditKaderModal({...editKaderModal, [fieldName]: [...currentArr, val]});
                                            else setEditKaderModal({...editKaderModal, [fieldName]: currentArr.filter((id: string) => id !== val)});
                                          }}
                                          style={{ marginRight: '6px', marginTop: '2px' }}
                                        />
                                        <span style={{lineHeight: '1.2'}}>{p.nama} <br/><span style={{fontSize: '0.6rem', color: '#888'}}>({getNamaRayon(p.id_rayon)})</span></span>
                                      </label>
                                    ))}
                                    {dataPendamping.length === 0 && <span style={{fontSize: '0.65rem', color: '#999'}}>Belum ada pendamping.</span>}
                                  </div>
                                </div>
                              )
                          })}
                        </div>
                      </div>

                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#0000af', color: 'white', border: 'none', padding: '15px', borderRadius: '6px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', marginTop: '10px', fontSize: '1rem', width: '100%', transition: '0.2s' }}>
                        {isSubmitting ? 'Menyimpan...' : '💾 Simpan Perubahan Global'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MENU 8: PENGUMUMAN LOGIN (FORMAL/MODERN LAYOUT) */}
          {activeMenu === 'pengumuman' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📢 Pengumuman Halaman Login</h3>
                <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Teks di bawah ini akan tayang dan bergeser otomatis (slider marquee) di halaman paling depan SIAKAD untuk dibaca oleh seluruh kader saat akan masuk.</p>
                
                {/* FORM TOP LAYOUT */}
                <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eaeaea', borderRadius: '10px', marginBottom: '25px' }}>
                  <form onSubmit={handleTambahPengumuman} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>➕ Tambah Kalimat Pengumuman Baru</label>
                    <textarea 
                      rows={3}
                      placeholder="Misal: Pendaftaran PKD Cabang Kota Malang telah dibuka. Hubungi pengurus Rayon masing-masing untuk koordinasi pendelegasian." 
                      value={newPengumuman} 
                      onChange={e => setNewPengumuman(e.target.value)} 
                      required 
                      style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                       <span style={{fontSize: '0.75rem', color: '#e67e22', fontStyle: 'italic'}}>*Klik <b>Tambah ke Daftar</b> dulu, lalu klik <b>Simpan & Siarkan</b> agar muncul di halaman depan.</span>
                       <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>➕ Tambah ke Daftar</button>
                    </div>
                  </form>
                </div>

                {/* LIST BOTTOM LAYOUT */}
                <div style={{ border: '1px solid #eaeaea', borderRadius: '10px', padding: '20px', backgroundColor: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed #ccc', paddingBottom: '10px' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '1rem' }}>📋 Daftar Teks Berjalan Saat Ini</h4>
                    <button 
                      onClick={handleSimpanPengumuman} 
                      disabled={isSavingPengumuman}
                      style={{ backgroundColor: isSavingPengumuman ? '#95a5a6' : '#2ecc71', color: 'white', padding: '8px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: isSavingPengumuman ? 'not-allowed' : 'pointer', fontSize: '0.85rem', transition: '0.2s', boxShadow: '0 4px 6px rgba(46, 204, 113, 0.2)' }}
                    >
                      {isSavingPengumuman ? 'Menyimpan...' : '💾 Simpan & Siarkan Publik'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pengumumanList.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>
                        Belum ada teks pengumuman yang diatur.
                      </div>
                    ) : (
                      pengumumanList.map((teks, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#eaf4fc', borderLeft: '4px solid #0000af', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.85rem', color: '#333', lineHeight: '1.5', flex: 1, paddingRight: '15px' }}>{teks}</span>
                          <button 
                            onClick={() => handleHapusPengumuman(index)} 
                            style={{ backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', transition: '0.2s' }}
                            onMouseOver={e => {e.currentTarget.style.backgroundColor = '#e74c3c'; e.currentTarget.style.color = '#fff'}}
                            onMouseOut={e => {e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#e74c3c'}}
                          >
                            Hapus
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MENU 9: LOG AKTIVITAS (Sistem Audit Trail) */}
          {activeMenu === 'log-aktivitas' && (
            <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>🕵️ Log Aktivitas Sistem Pusat</h3>
                <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Rekaman aktivitas dan riwayat perubahan data yang dilakukan oleh Admin Komisariat (Menampilkan maksimal 50 aktivitas terbaru).</p>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', boxSizing: 'border-box' }}>
                <table className="tabel-utama" style={{ minWidth: '800px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: '20%' }}>Waktu Sistem</th>
                      <th style={{ textAlign: 'left', width: '20%' }}>Aktor Pengguna</th>
                      <th style={{ textAlign: 'left', width: '60%' }}>Aktivitas / Aksi yang Dilakukan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logAktivitas.length === 0 ? (
                      <tr><td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Belum ada catatan aktivitas sistem.</td></tr>
                    ) : (
                      logAktivitas.map((log) => (
                        <tr key={log.id}>
                          <td style={{ color: '#666', fontSize: '0.8rem', fontWeight: 'bold' }}>{log.waktu_format}</td>
                          <td style={{ color: '#0000af', fontWeight: 'bold', fontSize: '0.85rem' }}>{log.aktor}</td>
                          <td style={{ color: '#333', fontStyle: 'italic', fontSize: '0.85rem' }}>{log.aksi}</td>
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
        {pengaturanCetak.kopSuratUrl && (<div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>)}
        <div className="print-content-area">
          
          {/* CETAK KHS RAPORT ADMIN */}
          {activeMenu === 'pantau-nilai-skp' && tabRaportAdmin === 'raport' && (
            <div>
              <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI SKP</h3>
              <table className="tabel-biodata">
                <tbody>
                  <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak.nim || '...........................'}</td></tr>
                  <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak.nama || '...........................'}</td></tr>
                  <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak.angkatan || (kaderDicetak.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................')}</td></tr>
                  <tr><td>Jenjang Kaderisasi</td><td>:</td><td>SKP (Sekolah Kader Putri)</td></tr>
                </tbody>
              </table>
              <table className="tabel-utama">
                <thead>
                  <tr><th style={{ width: '5%' }}>No</th><th style={{ width: '12%', textAlign: 'center' }}>Kode</th><th style={{ width: '53%', textAlign: 'center' }}>Nama Materi</th><th style={{ width: '10%' }}>SKS</th><th style={{ width: '10%' }}>Nilai</th><th style={{ width: '10%' }}>SKS x Nilai</th></tr>
                </thead>
                <tbody>
                  {masterKurikulum.filter(m => m.jenjang === 'SKP').length === 0 ? (<tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur.</td></tr>) : masterKurikulum.filter(m => m.jenjang === 'SKP').sort((a,b)=>a.kode.localeCompare(b.kode, undefined, {numeric: true})).map((materi, index) => {
                     let angkaAkhir = 0;
                     (kategoriBobotGlobal['SKP'] || []).forEach((kat: any) => {
                       const score = evaluasiKader?.nilai_mentah?.[materi.kode]?.[kat.nama] || 0;
                       angkaAkhir += (score * (kat.persen / 100));
                     });
                     const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                     const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                     const sksKali = materi.bobot * angka;
                     return (
                        <tr key={materi.kode}>
                          <td style={{ textAlign: 'center' }}>{index + 1}</td><td style={{ textAlign: 'center' }}>{materi.kode}</td><td style={{ fontWeight: 'bold' }}>{materi.nama}</td>
                          <td style={{ textAlign: 'center' }}>{materi.bobot}</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: huruf !== '-' ? '#27ae60' : '#999' }}>{huruf}</td><td style={{ textAlign: 'center' }}>{huruf !== '-' ? sksKali : 0}</td>
                        </tr>
                     )
                  })}
                  <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0)}</td><td></td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>{
                     let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                     const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                     const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                     return sum + (m.bobot * angka);
                  },0)}</td></tr>
                  <tr><td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kader)</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0) > 0 ? (masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>{
                     let angkaAkhir=0; (kategoriBobotGlobal['SKP']||[]).forEach((kat:any)=>{const score=evaluasiKader?.nilai_mentah?.[m.kode]?.[kat.nama]||0; angkaAkhir+=(score*(kat.persen/100));});
                     const huruf = angkaAkhir >= 76 ? 'A' : angkaAkhir >= 51 ? 'B' : angkaAkhir >= 26 ? 'C' : angkaAkhir >= 10 ? 'D' : angkaAkhir > 0 ? 'E' : '-';
                     const angka = huruf === 'A' ? 4 : huruf === 'B' ? 3 : huruf === 'C' ? 2 : huruf === 'D' ? 1 : 0;
                     return sum + (m.bobot * angka);
                  },0) / masterKurikulum.filter(m=>m.jenjang==='SKP').reduce((sum,m)=>sum+m.bobot,0)).toFixed(2) : "0.00"}</td></tr>
                </tbody>
              </table>
            </div>
          )}

          {/* CETAK HASIL TES PEMAHAMAN KADER OLEH ADMIN */}
          {activeMenu === 'master-tes' && selectedTesHasil && (
            <div>
              <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 20px 0', fontSize: '12pt', textTransform: 'uppercase' }}>
                REKAP JAWABAN: {selectedTesHasil.judul}
              </h3>
              
              {jawabanTesViewer.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#000', fontStyle: 'italic' }}>Belum ada jawaban terkumpul.</p>
              ) : (
                jawabanTesViewer.map((jawab: any) => (
                  <div key={jawab.nim} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                    <table className="tabel-biodata" style={{ marginBottom: '10px' }}>
                      <tbody>
                        <tr><td style={{width: '150px'}}>Nama Kader Binaan</td><td style={{width: '15px'}}>:</td><td style={{fontWeight: 'bold'}}>{jawab.nama}</td></tr>
                        <tr><td>NIM</td><td>:</td><td>{jawab.nim}</td></tr>
                        <tr><td>Waktu Submit</td><td>:</td><td>{jawab.tanggal}</td></tr>
                      </tbody>
                    </table>

                    <table className="tabel-utama">
                      <thead>
                        <tr>
                          <th style={{ width: '5%' }}>No</th>
                          <th style={{ width: '45%', textAlign: 'left' }}>Pertanyaan</th>
                          <th style={{ width: '50%', textAlign: 'left' }}>Jawaban Kader</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td>
                            <td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{soal}</td>
                            <td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap', fontStyle: 'italic', color: '#333' }}>
                              {jawab.jawaban[i] || '- Kosong -'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}