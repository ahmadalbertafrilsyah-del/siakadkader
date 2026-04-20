'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import * as XLSX from 'xlsx';

export default function DashboardPendamping() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState('beranda'); 
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- STATE PROFIL PENDAMPING ---
  const [profilPendamping, setProfilPendamping] = useState({ 
    nama: 'Loading...', 
    username: '',
    fotoUrl: 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO',
    noHp: '',
    alamat: '',
    id_rayon: '',
    jenjangTugas: 'MAPABA' 
  });
  
  // STATE BARU: Menyimpan Nama Rayon Asli & Pengaturan Cetak (Dari Rayon)
  const [namaRayonInduk, setNamaRayonInduk] = useState('');
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });

  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [isSavingProfil, setIsSavingProfil] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  // --- STATE DATA DINAMIS KADER ---
  const [kaderBinaan, setKaderBinaan] = useState<any[]>([]);
  const [berkasTugas, setBerkasTugas] = useState<any[]>([]);
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], SIG: [], SKP: [], NONFORMAL: [] });
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 

  const [tabInput, setTabInput] = useState('materi'); 
  const [selectedKader, setSelectedKader] = useState('');
  
  // Jenjang dikunci mati sesuai penugasan dari Admin Rayon
  const selectedJenjang = profilPendamping.jenjangTugas || 'MAPABA';
  const materiAktif = listKurikulum[selectedJenjang] || [];

  // --- STATE EVALUASI MATRIKS (AUTO-CALCULATE) ---
  const [kategoriBobot, setKategoriBobot] = useState<{id: string, nama: string, persen: number}[]>([]);
  const [nilaiMentah, setNilaiMentah] = useState<Record<string, Record<string, number>>>({});
  const [catatanKeaktifan, setCatatanKeaktifan] = useState('');

  // --- STATE TAMBAHAN UNTUK BERANDA & TES ---
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [listPerpus, setListPerpus] = useState<any[]>([]);
  const [listTes, setListTes] = useState<any[]>([]);
  const [riwayatTesBinaan, setRiwayatTesBinaan] = useState<any[]>([]);
  const [selectedTesHasil, setSelectedTesHasil] = useState<any>(null);
  const [jawabanTesViewer, setJawabanTesViewer] = useState<any[]>([]);

  // ---> STATE BARU: FITUR ENTERPRISE (KALENDER, BROADCAST, LOG) <---
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [notifikasiGlobal, setNotifikasiGlobal] = useState<any[]>([]);
  const [logAktivitas, setLogAktivitas] = useState<any[]>([]);
  const [formJadwal, setFormJadwal] = useState({ judul: '', tanggal: '', lokasi: '', deskripsi: '' });
  const [formBroadcast, setFormBroadcast] = useState({ judul: '', pesan: '', target: 'Binaan' });

  // ==========================================
  // FUNGSI PENCATAT LOG AKTIVITAS (AUDIT TRAIL)
  // ==========================================
  const catatLogAktivitas = async (aksi: string) => {
    if (!profilPendamping.username) return;
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: profilPendamping.id_rayon,
        aktor: `Pendamping (${profilPendamping.nama})`,
        username: profilPendamping.username,
        role: "pendamping",
        aksi: aksi,
        timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) { console.error("Gagal mencatat log", e); }
  };

  // ==========================================
  // API HELPER: CLOUDINARY UPLOAD
  // ==========================================
  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "siakad_upload"); 
    const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
    
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/${resourceType}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload");
    return data.secure_url.replace("http://", "https://");
  };

  // ==========================================
  // 1. EFEK: CEK LOGIN & ROLE PENDAMPING (SATPAM)
  // ==========================================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const p = snap.docs[0].data();
            
            if (p.role !== 'pendamping') {
              alert(`Akses Ditolak! Jabatan Anda adalah "${p.role}". Halaman ini khusus Pendamping.`);
              signOut(auth);
              router.push('/');
              return;
            }

            setCurrentUser(user);
            setProfilPendamping({ 
              nama: p.nama || '', 
              username: p.username || '',
              fotoUrl: p.fotoUrl || 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO',
              noHp: p.noHp || '',
              alamat: p.alamat || '',
              id_rayon: p.id_rayon || '',
              jenjangTugas: p.jenjangTugas || 'MAPABA'
            });
            
            ambilDataKaderBinaan(p.username);
            
            if(p.id_rayon){
              onSnapshot(doc(db, "users", p.id_rayon), (rayonSnap) => {
                if (rayonSnap.exists()) {
                  const rData = rayonSnap.data();
                  setNamaRayonInduk(rData.nama || p.id_rayon);
                  setPengaturanCetak({ kopSuratUrl: rData.kopSuratUrl || '', footerUrl: rData.footerUrl || '' });
                }
              });

              onSnapshot(doc(db, "pengaturan_rayon", p.id_rayon), (docSnap) => {
                if (docSnap.exists() && docSnap.data().bobot_penilaian) {
                  const bobotJenjangIni = docSnap.data().bobot_penilaian[p.jenjangTugas || 'MAPABA'] || [];
                  setKategoriBobot(bobotJenjangIni);
                } else { setKategoriBobot([]); }
              });

              onSnapshot(doc(db, "kurikulum_rayon", p.id_rayon), (docSnap) => {
                if (docSnap.exists()) setListKurikulum(docSnap.data() as Record<string, any[]>);
              });

              onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", p.id_rayon)), (snap) => {
                setListMasterTugas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
              });

              onSnapshot(query(collection(db, "perpustakaan"), where("id_rayon", "==", p.id_rayon)), (snap) => {
                setListPerpus(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
              });

              onSnapshot(query(collection(db, "master_tes"), where("id_rayon", "==", p.id_rayon)), (snap) => {
                const tesList: any[] = [];
                snap.forEach((doc) => tesList.push({ id: doc.id, ...doc.data() }));
                setListTes(tesList);
              });

              // ---> PENDENGAR FITUR BARU: JADWAL & NOTIFIKASI <---
              onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
                const listJadwal: any[] = [];
                snap.forEach(doc => {
                  const d = doc.data();
                  // Tampilkan jadwal Komisariat, jadwal Rayon sendiri, atau jadwal bikinan pendamping ini sendiri
                  if (d.pembuat === "Komisariat" || d.id_rayon === p.id_rayon) {
                    listJadwal.push({ id: doc.id, ...d });
                  }
                });
                listJadwal.sort((a, b) => b.timestamp - a.timestamp);
                setJadwalKegiatan(listJadwal);
              });

              onSnapshot(collection(db, "notifikasi_global"), (snap) => {
                const listNotif: any[] = [];
                snap.forEach(doc => {
                  const d = doc.data();
                  // Tampilkan jika target Semua, Pendamping, atau jika dia sendiri pengirimnya
                  if (d.target === "Semua" || d.target === "Pendamping" || d.pengirim_id === p.username) {
                     if (d.pengirim === "Pusat Komisariat" || d.id_rayon === p.id_rayon) {
                       listNotif.push({ id: doc.id, ...d });
                     }
                  }
                });
                listNotif.sort((a, b) => b.timestamp - a.timestamp);
                setNotifikasiGlobal(listNotif);
              });

              // Log aktivitas khusus milik dia sendiri
              onSnapshot(query(collection(db, "log_aktivitas"), where("username", "==", p.username)), (snap) => {
                const listLog: any[] = [];
                snap.forEach(doc => listLog.push({ id: doc.id, ...doc.data() }));
                listLog.sort((a, b) => b.timestamp - a.timestamp);
                setLogAktivitas(listLog.slice(0, 50));
              });
            }
          }
        });
      } else {
        router.push('/');
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // ==========================================
  // 2. EFEK: PANTAU NILAI KADER (REAL-TIME MATRIKS)
  // ==========================================
  useEffect(() => {
    if (!selectedKader) return;
    
    const unsubscribeNilai = onSnapshot(doc(db, "nilai_khs", selectedKader), (docSnap) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data());
      else setNilaiKaderRealtime({});
    });

    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", selectedKader), (docSnap) => {
      if (docSnap.exists() && docSnap.data()[selectedJenjang]) {
        const data = docSnap.data()[selectedJenjang];
        setNilaiMentah(data.nilai_mentah || {});
        setCatatanKeaktifan(data.catatan || '');
      } else {
        setNilaiMentah({});
        setCatatanKeaktifan('');
      }
    });
    
    return () => { unsubscribeNilai(); unsubscribeKeaktifan(); };
  }, [selectedKader, selectedJenjang]);

  // ==========================================
  // LOGIKA FUNGSI DASHBOARD
  // ==========================================
  const ambilDataKaderBinaan = async (usernamePendamping: string) => {
    try {
      const qKader = query(collection(db, "users"), where("role", "==", "kader"), where("pendampingId", "==", usernamePendamping));
      const snapKader = await getDocs(qKader);
      const listKader: any[] = snapKader.docs.map(d => ({ id: d.id, ...d.data() }));
      setKaderBinaan(listKader);
      if (listKader.length > 0 && !selectedKader) setSelectedKader(listKader[0].nim);

      const emailKaderBinaan = listKader.map(k => k.email);
      if (emailKaderBinaan.length > 0) {
        const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "in", emailKaderBinaan));
        onSnapshot(qBerkas, (snap) => {
           setBerkasTugas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const qTes = query(collection(db, "jawaban_tes"), where("nim", "in", listKader.map(k => k.nim)));
        onSnapshot(qTes, (snap) => {
          setRiwayatTesBinaan(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }
    } catch (error) { console.error(error); }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoFile(file);
      setProfilPendamping({ ...profilPendamping, fotoUrl: URL.createObjectURL(file) });
    }
  };

  const handleSimpanProfil = async () => {
    if(!profilPendamping.username) return;
    setIsSavingProfil(true);
    try {
      let finalFotoUrl = profilPendamping.fotoUrl;
      if (fotoFile) finalFotoUrl = await uploadToCloudinary(fotoFile); 
      await updateDoc(doc(db, "users", profilPendamping.username), { noHp: profilPendamping.noHp, alamat: profilPendamping.alamat, fotoUrl: finalFotoUrl });
      catatLogAktivitas("Memperbarui foto/data profil pendamping.");
      alert("Profil diperbarui!");
      setIsEditingProfil(false); setFotoFile(null);
    } catch (error) { alert("Gagal simpan"); } finally { setIsSavingProfil(false); }
  };

  const handleVerifikasiTugas = async (idBerkas: string) => {
    try {
      await updateDoc(doc(db, "berkas_kader", idBerkas), { status: 'Selesai' });
      catatLogAktivitas(`Memverifikasi (ACC) tugas kader.`);
      alert("Tugas Terverifikasi Selesai.");
    } catch (error) { alert("Error verifikasi tugas."); }
  };

  const handleLihatHasilTes = (tes: any) => {
    setSelectedTesHasil(tes);
    const jawabanBinaan = riwayatTesBinaan.filter(r => r.id_tes === tes.id);
    jawabanBinaan.sort((a: any, b: any) => b.timestamp - a.timestamp);
    setJawabanTesViewer(jawabanBinaan);
  };

  const handleDownloadPDF = () => { window.print(); };

  // ---> FITUR BARU: EXPORT EXCEL BINAAN <---
  const handleExportKaderBinaan = () => {
    if (kaderBinaan.length === 0) return alert("Belum ada data kader binaan!");
    const dataToExport = kaderBinaan.map((k, i) => ({
      "No": i + 1,
      "NIM": k.nim || '-',
      "Nama Lengkap": k.nama || '-',
      "NIA": k.nia || '-',
      "Jenjang Terakhir": k.jenjang || 'MAPABA',
      "Email": k.email || '-',
      "Status": k.status || 'Aktif'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kader Binaan");
    XLSX.writeFile(workbook, `Data_Binaan_${profilPendamping.nama}_${Date.now()}.xlsx`);
    catatLogAktivitas("Mengekspor (Download Excel) daftar kader binaan.");
  };

  // ---> FITUR BARU: KALENDER JADWAL <---
  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "jadwal_kegiatan"), {
        ...formJadwal,
        id_rayon: profilPendamping.id_rayon,
        pembuat: `Pendamping (${profilPendamping.nama})`,
        pendamping_id: profilPendamping.username,
        timestamp: Date.now()
      });
      catatLogAktivitas(`Menambahkan jadwal mentoring/binaan: ${formJadwal.judul}`);
      alert("Jadwal berhasil ditambahkan!");
      setFormJadwal({ judul: '', tanggal: '', lokasi: '', deskripsi: '' });
    } catch (error) { alert("Gagal menyimpan jadwal."); } finally { setIsSubmitting(false); }
  };

  const handleHapusJadwal = async (id: string, judul: string, pembuat: string) => {
    if (!pembuat.includes(profilPendamping.username) && !pembuat.includes(profilPendamping.nama)) {
      return alert("Anda hanya bisa menghapus jadwal yang Anda buat sendiri.");
    }
    if (!window.confirm(`Hapus jadwal "${judul}"?`)) return;
    try {
      await deleteDoc(doc(db, "jadwal_kegiatan", id));
      catatLogAktivitas(`Menghapus jadwal mentoring: ${judul}`);
    } catch (error) { alert("Gagal menghapus."); }
  };

  // ---> FITUR BARU: BROADCAST NOTIFIKASI <---
  const handleKirimBroadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notifikasi_global"), {
        ...formBroadcast,
        target: "Binaan", 
        id_rayon: profilPendamping.id_rayon,
        pengirim: `Pendamping (${profilPendamping.nama})`,
        pengirim_id: profilPendamping.username,
        tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
        timestamp: Date.now()
      });
      catatLogAktivitas(`Mengirim Broadcast ke Kader Binaan: ${formBroadcast.judul}`);
      alert("Pesan Broadcast berhasil dikirim ke Binaan Anda!");
      setFormBroadcast({ ...formBroadcast, judul: '', pesan: '' });
    } catch (error) { alert("Gagal mengirim broadcast."); } finally { setIsSubmitting(false); }
  };


  // ==========================================
  // PERHITUNGAN RAPORT KHS
  // ==========================================
  let totalSks = 0;
  let totalBobotNilai = 0;
  
  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A";
    if (angka >= 51) return "B";
    if (angka >= 26) return "C";
    if (angka >= 10) return "D";
    if (angka > 0) return "E";
    return "-";
  };

  const barisRaportRender = materiAktif.map((materi, index) => {
    const nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
    const angkaNilai = konversiHurufKeAngka(nilaiHuruf);
    const sksKaliNilai = (materi.bobot || 0) * angkaNilai;
    
    totalSks += (materi.bobot || 0);
    if (nilaiHuruf !== "-") totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode} className="table-row" style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa' }}>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'center' }}>{index + 1}</td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', color: '#555' }}>{materi.kode}</td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'left', color: '#333' }}>{materi.nama}</td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#555' }}>{nilaiHuruf}</td>
        <td className="col-cetak" style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e824c' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });
  
  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";
  const kaderDicetak = kaderBinaan.find(k => k.nim === selectedKader) || {};
  const totalBobotTersimpan = kategoriBobot.reduce((sum, k) => sum + k.persen, 0);

  // ==========================================
  // FUNGSI PENILAIAN MATRIKS DETAIL
  // ==========================================
  const handleInputNilaiMentah = (kodeMateri: string, namaKategori: string, value: string) => {
    let valNum = Number(value); if (valNum > 100) valNum = 100; if (valNum < 0) valNum = 0;
    const updatedNilai = { ...nilaiMentah, [kodeMateri]: { ...(nilaiMentah[kodeMateri] || {}), [namaKategori]: valNum } };
    setNilaiMentah(updatedNilai);
  };

  const handleAutoSaveNilaiDetail = async (kodeMateri: string) => {
    if (!selectedKader) return;
    try {
      const docRef = doc(db, "evaluasi_kader", selectedKader);
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKader)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjang] || { bobot: kategoriBobot, nilai_mentah: {}, catatan: catatanKeaktifan };
      
      await setDoc(docRef, { ...currentEvaluasi, [selectedJenjang]: { ...jenjangData, nilai_mentah: nilaiMentah } }, { merge: true });

      let angkaAkhir = 0;
      kategoriBobot.forEach(kat => {
          const score = nilaiMentah[kodeMateri]?.[kat.nama] || 0;
          angkaAkhir += score * (kat.persen / 100);
      });

      const hurufAkhir = getNilaiHuruf(angkaAkhir);

      await setDoc(doc(db, "nilai_khs", selectedKader), { 
        [kodeMateri]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: `Pendamping (${profilPendamping.nama})` 
      }, { merge: true });
      
      catatLogAktivitas(`Menyimpan/Update nilai Matriks (${kodeMateri}) untuk kader: ${selectedKader}`);
    } catch (error) { console.error("Gagal auto-save nilai", error); }
  };

  const handleSimpanCatatan = async (text: string) => {
    setCatatanKeaktifan(text);
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKader)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjang] || { bobot: kategoriBobot, nilai_mentah: nilaiMentah, catatan: '' };
      await setDoc(doc(db, "evaluasi_kader", selectedKader), { ...currentEvaluasi, [selectedJenjang]: { ...jenjangData, catatan: text } }, { merge: true });
      catatLogAktivitas(`Menulis catatan evaluasi untuk kader: ${selectedKader}`);
    } catch (error) { console.error(error); }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'beranda': return 'Dashboard';
      case 'kalender': return 'Jadwal & Agenda';
      case 'broadcast': return 'Broadcast';
      case 'profil': return 'Profil Saya';
      case 'daftar-kader': return 'Daftar Binaan';
      case 'input-nilai': return 'Raport Kaderisasi';
      case 'berkas-tugas': return 'Verifikasi Tugas';
      case 'tes-pemahaman': return 'Hasil Tes Binaan';
      case 'log-aktivitas': return 'Log Aktivitas';
      default: return 'Dashboard Pendamping';
    }
  };

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS UNTUK TAMPILAN WEB & CETAK PDF A4 BACKGROUND */}
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
        .tabel-utama thead tr { border-top: 2px solid #555; border-bottom: 2px solid #555; background-color: #fff; }
        .tabel-utama th { padding: 10px; color: #333; text-align: center; font-weight: bold; }
        .tabel-utama td { padding: 8px 10px; border-bottom: 1px solid #ddd; color: #333; }
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
          .print-content-area { position: relative !important; z-index: 10 !important; padding: 85mm 20mm 30mm 20mm !important; background-color: transparent !important; }
          table { width: 100% !important; border-collapse: collapse !important; background-color: transparent !important; }
          tr { page-break-inside: avoid !important; background-color: transparent !important; }
          th, td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11pt !important; background-color: transparent !important; }
          th { font-weight: bold !important; text-align: center !important; }
          .tabel-biodata { margin-bottom: 15px !important; border: none !important; width: 100% !important; }
          .tabel-biodata td, .tabel-biodata tr { border: none !important; padding: 3px 0 !important; text-align: left !important; }
          .no-print { display: none !important; } 
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {isSidebarOpen && (
        <div className="no-print" onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }} />
      )}
      
      {/* SIDEBAR PENDAMPING */}
      <aside className="no-print" style={{ width: '260px', background: 'linear-gradient(135deg, #0000FF 0%, #000090 100%)', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'left 0.3s ease', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🏛️ SIAKAD PMII</span>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{fontSize: '0.9rem', fontWeight: 'bold', lineHeight: '1.4'}}>{profilPendamping.nama}</div>
          <div style={{fontSize: '0.75rem', color: '#f1c40f', marginTop: '4px'}}>Pendamping: {profilPendamping.jenjangTugas}</div>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', flex: 1, margin: 0, overflowY: 'auto' }}>
          {[
            { id: 'beranda', icon: '🏠', label: 'Dashboard' }, 
            { id: 'kalender', icon: '📅', label: 'Jadwal Mentoring' },
            { id: 'broadcast', icon: '📡', label: 'Pengumuman Binaan' },
            { id: 'profil', icon: '👤', label: 'Profil Saya' }, 
            { id: 'daftar-kader', icon: '👥', label: 'Daftar Binaan' }, 
            { id: 'input-nilai', icon: '📊', label: 'Raport Kaderisasi' }, 
            { id: 'berkas-tugas', icon: '📋', label: 'Verifikasi Tugas', badge: berkasTugas.filter(b => b.status === 'Menunggu Verifikasi').length || null },
            { id: 'tes-pemahaman', icon: '📝', label: 'Hasil Tes Binaan' },
            { id: 'log-aktivitas', icon: '🕵️', label: 'Log Aktivitas' },
          ].map((item) => (
            <li key={item.id}>
              <button onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent', border: 'none', color: activeMenu === item.id ? '#f1c40f' : '#d1d1d1', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', transition: '0.2s', fontWeight: activeMenu === item.id ? 'bold' : 'normal', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', gap: '15px' }}><span style={{fontSize: '1.1rem'}}>{item.icon}</span> {item.label}</div>
                {item.badge && <span style={{ backgroundColor: '#e74c3c', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>{item.badge}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}><button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid #fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>🚪 Keluar</button></div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '0', width: '100%', overflowX: 'hidden' }}>
        
        {/* HEADER DINAMIS */}
        <header className="no-print" style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, textTransform: 'uppercase', fontWeight: 'bold' }}>
              {getHeaderTitle()}
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#1e824c', fontWeight: 'bold' }}>👤: {namaRayonInduk}</div>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>

          {/* MENU 0: BERANDA */}
          {activeMenu === 'beranda' && (
            <div>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h2 style={{color: '#1e824c', marginTop: 0, fontSize: '1.5rem'}}>Halo, Sahabat/i {profilPendamping.nama.split(' ')[0]}! 👋</h2>
                <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Selamat datang di Panel Pendamping. Pantau perkembangan kader binaan Anda dan berikan evaluasi terbaik untuk kemajuan {namaRayonInduk}.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Kader Binaan</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{kaderBinaan.length}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Binaan Menunggu</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{berkasTugas.filter(s => s.status === 'Menunggu Verifikasi').length}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Rayon Aktif</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{listMasterTugas.length}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #2ecc71' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Materi di Perpus Rayon</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{listPerpus.length}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#1e824c' }}>📌 Papan Instruksi Tugas Rayon</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', fontSize: '0.85rem', lineHeight: '1.8' }}>
                    {listMasterTugas.length === 0 ? <li>Belum ada instruksi tugas dari Admin Rayon.</li> : 
                      listMasterTugas.map(tugas => (
                        <li key={tugas.id}>Kader wajib mengumpulkan <b>{tugas.nama_tugas}</b> paling lambat {tugas.deadline}. Harap ingatkan binaan Anda!</li>
                      ))
                    }
                  </ul>
                </div>
              </div>

            </div>
          )}

          {/* MENU 2: KALENDER & JADWAL (FITUR BARU) */}
          {activeMenu === 'kalender' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem' }}>📅 Jadwal Kegiatan & Mentoring</h3>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>➕ Jadwalkan Mentoring</h4>
                    <form onSubmit={handleTambahJadwal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" placeholder="Judul Kegiatan (Cth: Kumpul Binaan)" required value={formJadwal.judul} onChange={e => setFormJadwal({...formJadwal, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <input type="datetime-local" required value={formJadwal.tanggal} onChange={e => setFormJadwal({...formJadwal, tanggal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <input type="text" placeholder="Lokasi / Media" required value={formJadwal.lokasi} onChange={e => setFormJadwal({...formJadwal, lokasi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <textarea rows={3} placeholder="Deskripsi Singkat" value={formJadwal.deskripsi} onChange={e => setFormJadwal({...formJadwal, deskripsi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} />
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Agenda</button>
                    </form>
                  </div>
                  <div style={{ flex: '2 1 450px', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {jadwalKegiatan.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>Belum ada agenda terjadwal.</div>
                      ) : (
                        jadwalKegiatan.map(jadwal => {
                          const isMine = jadwal.pendamping_id === profilPendamping.username;
                          const labelPembuat = jadwal.pembuat === 'Komisariat' ? 'Pusat Komisariat' : jadwal.pembuat === 'Rayon' ? `Pengurus Rayon` : isMine ? 'Jadwal Anda' : 'Pendamping Lain';
                          const colorLabel = jadwal.pembuat === 'Komisariat' ? '#f1c40f' : jadwal.pembuat === 'Rayon' ? '#e74c3c' : '#3498db';

                          return (
                            <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: `4px solid ${colorLabel}`, padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                  <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '1rem' }}>{jadwal.judul}</h4>
                                  <span style={{ backgroundColor: '#f8f9fa', color: '#555', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', border: '1px solid #ddd' }}>{labelPembuat}</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                              </div>
                              {isMine && (
                                <button onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul, jadwal.pembuat)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Jadwal Anda">🗑️</button>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MENU 3: BROADCAST NOTIFIKASI (FITUR BARU) */}
          {activeMenu === 'broadcast' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem' }}>📡 Pusat Pengumuman Binaan</h3>
                <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px' }}>Kirimkan pesan mendesak atau instruksi tugas yang akan muncul di notifikasi khusus untuk kader binaan Anda.</p>
                
                <div style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', maxWidth: '600px' }}>
                  <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Judul Pesan</label>
                      <input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Cth: Panggilan Kumpul Binaan" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Isi Pesan Lengkap</label>
                      <textarea rows={4} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Detail pengumuman..." style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', resize: 'vertical' }} />
                    </div>
                    <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      {isSubmitting ? 'Mengirim...' : '🚀 Siarkan ke Seluruh Binaan'}
                    </button>
                  </form>
                </div>
              </div>

              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                 <h4 style={{ margin: '0 0 15px 0', color: '#0d1b2a', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🔔 Kotak Masuk Notifikasi Anda</h4>
                 <div style={{ display: 'grid', gap: '10px' }}>
                    {notifikasiGlobal.length === 0 ? (
                      <p style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>Belum ada pengumuman masuk untuk Anda.</p>
                    ) : (
                      notifikasiGlobal.map(notif => (
                        <div key={notif.id} style={{ padding: '15px', backgroundColor: '#fcfcfc', border: '1px solid #eee', borderLeft: '4px solid #f1c40f', borderRadius: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <strong style={{ color: '#333' }}>{notif.judul}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#888' }}>{notif.tanggal}</span>
                          </div>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#555' }}>{notif.pesan}</p>
                          <div style={{ fontSize: '0.7rem', color: '#1e824c', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>
          )}
          
          {/* MENU 4: PROFIL */}
          {activeMenu === 'profil' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', fontWeight: 'bold' }}>PROFIL SAYA</div>
              <div style={{ padding: '30px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 180px', textAlign: 'center' }}>
                  <img src={profilPendamping.fotoUrl} alt="Foto Pendamping" style={{ width: '100%', height: '230px', objectFit: 'cover', borderRadius: '8px', border: '4px solid #eee' }} />
                  {isEditingProfil && (
                    <div style={{ marginTop: '10px', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Unggah Foto Baru:</label>
                      <input type="file" accept="image/*" onChange={handleFotoChange} style={{ marginTop: '5px', fontSize: '0.7rem', width: '100%' }} />
                    </div>
                  )}
                  <button 
                    onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
                    disabled={isSavingProfil} 
                    style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: isEditingProfil ? '#2ecc71' : '#1e824c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil' : '📝 Ubah Profil Saya'}
                  </button>
                </div>
                
                <div style={{ flex: '1 1 350px' }}>
                  <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#333', minWidth: '400px' }}>
                      <tbody>
                        <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', width: '35%', borderBottom: '1px solid #eee' }}>Username</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{profilPendamping.username}</td></tr>
                        <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nama Lengkap</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{profilPendamping.nama}</td></tr>
                        <tr><td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Tugas Pendampingan</td><td style={{ padding: '10px', borderBottom: '1px solid #eee' }}><span style={{ color: '#e67e22', fontWeight: 'bold', backgroundColor: '#fff3cd', padding: '4px 8px', borderRadius: '4px' }}>{profilPendamping.jenjangTugas}</span></td></tr>
                        <tr>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Nomor WhatsApp</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                            {isEditingProfil ? (
                              <input type="text" value={profilPendamping.noHp} onChange={e => setProfilPendamping({...profilPendamping, noHp: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                            ) : (profilPendamping.noHp || '-')}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee' }}>Alamat / Domisili</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                            {isEditingProfil ? (
                              <input type="text" value={profilPendamping.alamat} onChange={e => setProfilPendamping({...profilPendamping, alamat: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                            ) : (profilPendamping.alamat || '-')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {isEditingProfil && <p style={{ fontSize: '0.75rem', color: '#e74c3c', marginTop: '10px' }}>*Nama, Username, dan Jenjang Tugas hanya bisa diubah oleh Pengurus Rayon.</p>}
                </div>
              </div>
            </div>
          )}

          {/* MENU 5: DAFTAR KADER */}
          {activeMenu === 'daftar-kader' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <p style={{ color: '#555', fontSize: '0.85rem', margin: 0 }}>Daftar kader yang diplotkan langsung kepada Anda sebagai pendamping.</p>
                <button onClick={handleExportKaderBinaan} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  📥 Export Excel Binaan
                </button>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '500px' }}>
                  <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#333' }}><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>NIM</th><th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Nama Kader</th><th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Aksi</th></tr></thead>
                  <tbody>
                    {kaderBinaan.map(k => {
                      const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                      return (
                        <tr key={k.nim} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#555' }}>{k.nim} <br/> <span style={{fontSize: '0.7rem', color: '#1e824c'}}>Agt. {thnMasuk}</span></td>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{k.nama}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => { setSelectedKader(k.nim); setActiveMenu('input-nilai'); }} style={{ padding: '6px 12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>Buka Raport 📝</button></td>
                        </tr>
                      )
                    })}
                    {kaderBinaan.length === 0 && <tr><td colSpan={3} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada kader binaan yang diplotkan ke Anda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 6: INPUT NILAI MATRIKS (AUTO-CALC) */}
          {activeMenu === 'input-nilai' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              
              {/* HEADER DROPDOWN BERJEJER */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader:</span>
                  <select value={selectedKader} onChange={(e) => setSelectedKader(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {kaderBinaan.length === 0 && <option value="">Tidak ada binaan</option>}
                    {kaderBinaan.map(k => {
                      const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                      return <option key={k.nim} value={k.nim}>{k.nama} ({thnMasuk})</option>
                    })}
                  </select>
                  
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginLeft: '5px' }}>Jenjang:</span>
                  {/* Di pendamping, jenjang dikunci mati sesuai penugasannya */}
                  <div style={{ padding: '6px 15px', backgroundColor: '#eef2f3', borderRadius: '4px', fontWeight: 'bold', color: '#2c3e50', border: '1px solid #ccc', fontSize: '0.85rem' }}>{selectedJenjang}</div>
                  
                  {/* TOMBOL CETAK KHS */}
                  {tabInput === 'materi' && selectedKader && (
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                      🖨️ Cetak KHS
                    </button>
                  )}
                </div>
              </div>

              <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '0 20px', backgroundColor: '#fff', marginTop: '15px', flexWrap: 'wrap' }}>
                 <button onClick={() => setTabInput('materi')} style={{ padding: '5px 12px', border: 'none', background: tabInput === 'materi' ? '#fff' : 'transparent', color: tabInput === 'materi' ? '#007bff' : '#555', fontWeight: tabInput === 'materi' ? 'bold' : 'normal', borderTop: tabInput === 'materi' ? '3px solid #007bff' : '3px solid transparent', borderRight: '1px solid #ddd', borderLeft: '1px solid #ddd', cursor: 'pointer', marginBottom: '-1px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   Raport Kaderisasi
                 </button>
                 <button onClick={() => setTabInput('keaktifan')} style={{ padding: '5px 12px', border: 'none', background: tabInput === 'keaktifan' ? '#fff' : 'transparent', color: tabInput === 'keaktifan' ? '#007bff' : '#555', fontWeight: tabInput === 'keaktifan' ? 'bold' : 'normal', borderTop: tabInput === 'keaktifan' ? '3px solid #007bff' : '3px solid transparent', borderRight: '1px solid #ddd', cursor: 'pointer', marginBottom: '-1px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   Persentase & Nilai
                 </button>
              </div>

              <div style={{ padding: '3px' }}>

                {/* TAB 1: RAPORT KADERISASI */}
                {tabInput === 'materi' && (
                  <div id="area-cetak-raport" style={{ width: '100%', overflowX: 'auto', padding: '10px 0', boxSizing: 'border-box' }}>
                    
                    <table className="tabel-utama" style={{ minWidth: '600px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '5%' }}>No</th>
                          <th style={{ width: '12%', textAlign: 'left' }}>Kode Materi</th>
                          <th style={{ width: '53%', textAlign: 'left' }}>Nama Materi</th>
                          <th style={{ width: '10%' }}>SKS</th>
                          <th style={{ width: '10%' }}>Nilai Huruf</th>
                          <th style={{ width: '10%' }}>SKS x Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materiAktif.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum jenjang ini belum diatur oleh Admin Rayon.</td></tr>
                        ) : barisRaportRender}
                        
                        <tr style={{ borderTop: '2px solid #ccc' }}>
                          <td colSpan={3} style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                          <td style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                          <td className="no-print"></td>
                          <td style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}>
                          <td colSpan={5} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>IPK (Indeks Prestasi Kader)</td>
                          <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>{ipKader}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p style={{fontSize: '0.75rem', color: '#888', marginTop: '15px', fontStyle: 'italic'}}>*Catatan: Nilai Huruf pada tabel ini terisi otomatis berdasarkan perhitungan Matriks di tab "Input Nilai Detail".</p>

                  </div>
                )}

                {/* TAB 2: INPUT NILAI MATRIKS (EVALUASI) */}
                {tabInput === 'keaktifan' && (
                  <div style={{ backgroundColor: '#fafafa', padding: '20px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    
                    {/* INDIKATOR KATEGORI BOBOT (READ-ONLY DARI RAYON) */}
                    <div className="no-print" style={{ marginBottom: '20px', background: '#eef2f3', padding: '15px', borderRadius: '6px', border: '1px dashed #b2c2cf' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#0d1b2a', fontSize: '0.85rem' }}>📌 Kategori & Bobot Penilaian (Ditetapkan Admin Rayon)</h4>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {kategoriBobot.length === 0 ? <span style={{ fontSize: '0.8rem', color: '#e74c3c' }}>Admin Rayon belum menetapkan bobot penilaian untuk jenjang ini.</span> : 
                          kategoriBobot.map(kat => (
                            <div key={kat.id} style={{ backgroundColor: '#fff', padding: '4px 10px', borderRadius: '20px', border: '1px solid #ccc', fontSize: '0.75rem', fontWeight: 'bold', color: '#333' }}>
                              {kat.nama}: <span style={{ color: '#27ae60' }}>{kat.persen}%</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                      <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem', backgroundColor: '#fff' }}>
                        <thead>
                          <tr>
                            <th rowSpan={2} style={{ width: '3%' }}>No</th>
                            <th rowSpan={2} style={{ width: '8%', textAlign: 'left' }}>Kode</th>
                            <th rowSpan={2} style={{ width: '35%', textAlign: 'left' }}>Nama Materi</th>
                            {kategoriBobot.length > 0 && <th colSpan={kategoriBobot.length} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f0fbf4' }}>Input Nilai Detail (0-100)</th>}
                            <th rowSpan={2} style={{ width: '5%' }}>SKS</th>
                            <th colSpan={2} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#eaf4fc' }}>Hasil Akhir</th>
                            <th rowSpan={2} style={{ width: '8%' }}>SKS x Nilai Huruf</th>
                          </tr>
                          <tr>
                            {kategoriBobot.map(kat => (
                              <th key={kat.id} style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#1e824c', backgroundColor: '#f0fbf4' }}>
                                {kat.nama} <br/><span style={{color: '#e74c3c'}}>{kat.persen}%</span>
                              </th>
                            ))}
                            <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', backgroundColor: '#eaf4fc' }}>Angka</th>
                            <th style={{ fontSize: '0.75rem', padding: '6px 5px', color: '#004a87', backgroundColor: '#eaf4fc' }}>Huruf</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materiAktif.length === 0 ? (
                            <tr><td colSpan={7 + kategoriBobot.length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi untuk jenjang ini.</td></tr>
                          ) : (
                            materiAktif.map((materi, index) => {
                              let angkaAkhir = 0;
                              kategoriBobot.forEach(kat => {
                                  const score = nilaiMentah[materi.kode]?.[kat.nama] || 0;
                                  angkaAkhir += (score * (kat.persen / 100));
                              });

                              const hurufAkhir = getNilaiHuruf(angkaAkhir);
                              const angkaNilaiSks = konversiHurufKeAngka(hurufAkhir);
                              const sksKaliNilai = (materi.bobot || 0) * angkaNilaiSks;

                              return (
                                <tr key={`rinci-${materi.kode}`}>
                                  <td>{index + 1}</td><td style={{ textAlign: 'left' }}>{materi.kode}</td><td style={{ textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
                                  
                                  {kategoriBobot.map((kat) => (
                                    <td key={kat.id} style={{ backgroundColor: '#fcfcfc' }}>
                                      <input 
                                        type="number" className="no-print" min="0" max="100" placeholder="0"
                                        value={nilaiMentah[materi.kode]?.[kat.nama] === 0 ? '' : (nilaiMentah[materi.kode]?.[kat.nama] || '')}
                                        onChange={(e) => handleInputNilaiMentah(materi.kode, kat.nama, e.target.value)}
                                        onBlur={() => handleAutoSaveNilaiDetail(materi.kode)}
                                        style={{ width: '50px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none' }}
                                      />
                                      <span className="print-only-inline" style={{ display: 'none', fontWeight: 'bold' }}>{nilaiMentah[materi.kode]?.[kat.nama] || 0}</span>
                                    </td>
                                  ))}
                                  
                                  <td>{materi.bobot}</td>
                                  <td style={{ fontWeight: 'bold', color: '#004a87', backgroundColor: '#f4f9fd' }}>{angkaAkhir > 0 ? angkaAkhir.toFixed(1) : '-'}</td>
                                  <td style={{ fontWeight: 'bold', color: hurufAkhir !== '-' ? '#27ae60' : '#999', backgroundColor: '#f4f9fd', fontSize: '1rem' }}>{hurufAkhir}</td>
                                  <td style={{ fontWeight: 'bold' }}>{hurufAkhir === '-' ? 0 : sksKaliNilai}</td>
                                </tr>
                              )
                            })
                          )}
                          <tr>
                            <td colSpan={3 + kategoriBobot.length} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah SKS & Nilai</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                            <td colSpan={2}></td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                          </tr>
                          <tr>
                            <td colSpan={4 + kategoriBobot.length} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kader)</td>
                            <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1.1rem' }}>{ipKader}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <p style={{fontSize: '0.7rem', color: '#888', marginTop: '10px', fontStyle: 'italic'}}>*Tips: Ketik nilai mentah (0-100) di dalam kotak, lalu klik sembarang tempat di luar kotak agar sistem otomatis menyimpan data ke server.</p>

                    <div className="no-print" style={{ marginTop: '20px' }}>
                      <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#333', fontSize: '0.85rem'}}>Catatan / Pesan Pendamping untuk Kader:</label>
                      <textarea rows={4} value={catatanKeaktifan} onChange={e => handleSimpanCatatan(e.target.value)} placeholder="Tuliskan evaluasi etika, saran pengembangan, atau pesan lainnya..." style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MENU 7: VERIFIKASI TUGAS */}
          {activeMenu === 'berkas-tugas' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#1e824c', margin: '0 0 15px 0', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Verifikasi Tugas Kader Binaan</h3>
              <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '15px' }}>Daftar tugas yang telah dikerjakan dan diunggah oleh kader binaan Anda.</p>
              <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '550px' }}>
                  <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555', textAlign: 'left' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Kader / Tanggal</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Nama Tugas Berkas</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Dokumen</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi Status</th></tr></thead>
                  <tbody>
                    {berkasTugas.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px' }}><b style={{color: '#004a87'}}>{b.email_kader.split('@')[0]}</b><br/><span style={{fontSize: '0.7rem', color: '#999'}}>{b.tanggal}</span></td>
                        <td style={{ padding: '10px' }}><b>{b.jenis_berkas}</b><br/><span style={{fontSize: '0.7rem', color: '#666', fontStyle: 'italic'}}>{b.nama_file_asli}</span></td>
                        <td style={{ padding: '10px', textAlign: 'center' }}><a href={b.file_link_or_id} target="_blank" style={{ padding: '4px 8px', backgroundColor: '#f1c40f', borderRadius: '4px', textDecoration: 'none', color: '#333', fontWeight: 'bold', fontSize: '0.7rem' }}>👁️ Lihat</a></td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{b.status === 'Selesai' ? <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.75rem' }}>✅ Selesai</span> : <button onClick={() => handleVerifikasiTugas(b.id)} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>Verifikasi Selesai</button>}</td>
                      </tr>
                    ))}
                    {berkasTugas.length === 0 && <tr><td colSpan={4} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Belum ada berkas tugas yang diunggah oleh kader binaan Anda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MENU 8: HASIL TES PEMAHAMAN BINAAN */}
          {activeMenu === 'tes-pemahaman' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedTesHasil ? (
                // TAMPILAN LIHAT HASIL TES BINAAN
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', padding: '20px' }}>
                  <button className="no-print" onClick={() => setSelectedTesHasil(null)} style={{ marginBottom: '15px', padding: '6px 12px', backgroundColor: '#f1c40f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                    ⬅️ Kembali
                  </button>
                  
                  <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ color: '#1e824c', margin: '0 0 10px 0', fontSize: '1.1rem' }}>Hasil Binaan: {selectedTesHasil.judul} ({selectedTesHasil.jenjang})</h3>
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                      🖨️ Cetak Hasil
                    </button>
                  </div>
                  
                  <div className="no-print" style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <table className="tabel-utama no-print" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '800px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '15%' }}>Waktu Submit</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '15%' }}>NIM</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '25%' }}>Nama Kader Binaan</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '45%' }}>Jawaban</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jawabanTesViewer.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Kader binaan Anda belum mengerjakan tes ini.</td></tr>
                        ) : (
                          jawabanTesViewer.map((jawab: any) => (
                            <tr key={jawab.nim} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px', verticalAlign: 'top' }}>{jawab.tanggal}</td>
                              <td style={{ padding: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nim}</td>
                              <td style={{ padding: '10px', color: '#004a87', fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nama}</td>
                              <td style={{ padding: '10px', verticalAlign: 'top' }}>
                                <details style={{ cursor: 'pointer' }}>
                                  <summary style={{ color: '#27ae60', fontWeight: 'bold', outline: 'none' }}>Tampilkan Jawaban</summary>
                                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '4px' }}>
                                    {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                      <div key={i} style={{ marginBottom: '10px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#333' }}>Q: {soal}</div>
                                        <div style={{ color: '#555', fontStyle: 'italic', paddingLeft: '10px', borderLeft: '3px solid #3498db', marginTop: '4px', whiteSpace: 'pre-wrap' }}>A: {jawab.jawaban[i] || '- Kosong -'}</div>
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
                    <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 20px 0', fontSize: '12pt', textTransform: 'uppercase' }}>
                      REKAP JAWABAN KADER BINAAN: {selectedTesHasil.judul}
                    </h3>
                    
                    {jawabanTesViewer.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#000', fontStyle: 'italic' }}>Belum ada jawaban terkumpul.</p>
                    ) : (
                      jawabanTesViewer.map((jawab: any) => (
                        <div key={jawab.nim} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                          <table className="tabel-biodata" style={{ marginBottom: '10px' }}>
                            <tbody>
                              <tr><td style={{width: '150px'}}>Nama Pendamping</td><td style={{width: '15px'}}>:</td><td style={{fontWeight: 'bold'}}>{profilPendamping.nama}</td></tr>
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

                </div>
              ) : (
                // DAFTAR TES RAYON
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', overflowX: 'auto' }}>
                  <h4 style={{ color: '#4a637d', margin: '0 0 15px 0', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>Daftar Tes dari Rayon</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '500px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Judul & Jenjang</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Soal</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Status Tes</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listTes.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Rayon belum membuat tes pemahaman.</td></tr>
                      ) : (
                        listTes.map((tes) => (
                          <tr key={tes.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>
                              <div style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{tes.judul}</div>
                              <div style={{ fontSize: '0.7rem', color: '#888' }}>Sasaran: {tes.jenjang}</div>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#e67e22' }}>{tes.daftar_soal?.length || 0}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: tes.status === 'Buka' ? '#e8f5e9' : '#ffebee', color: tes.status === 'Buka' ? '#2e7d32' : '#c62828' }}>
                                {tes.status === 'Buka' ? '🔓 Dibuka' : '🔒 Ditutup'}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <button onClick={() => handleLihatHasilTes(tes)} style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Lihat Jawaban Binaan</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* MENU 9: LOG AKTIVITAS (FITUR BARU) */}
          {activeMenu === 'log-aktivitas' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>🕵️ Log Aktivitas Sistem Saya</h3>
                <p style={{ fontSize: '0.8rem', color: '#777', margin: '5px 0 0 0' }}>Rekaman aktivitas yang Anda lakukan sebagai Pendamping (Maksimal 50 aktivitas terakhir).</p>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', boxSizing: 'border-box' }}>
                <table className="tabel-utama" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'left', width: '180px' }}>Waktu Sistem</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>Aktivitas / Aksi yang Dilakukan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logAktivitas.length === 0 ? (
                      <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada catatan aktivitas.</td></tr>
                    ) : (
                      logAktivitas.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', color: '#666', fontSize: '0.8rem' }}>{log.waktu_format}</td>
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
        
        {/* Gambar Background A4 dari Admin Rayon */}
        {pengaturanCetak.kopSuratUrl && (
          <div className="bg-kertas-a4">
            <img src={pengaturanCetak.kopSuratUrl} alt="Background A4" />
          </div>
        )}

        {/* Pembungkus Konten Tabel */}
        <div className="print-content-area">
          
          {/* CETAK KHS PENDAMPING */}
          {activeMenu === 'input-nilai' && tabInput === 'materi' && (
            <div>
              <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI</h3>
              <table className="tabel-biodata">
                <tbody>
                  <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak.nim || '...........................'}</td></tr>
                  <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak.nama || '...........................'}</td></tr>
                  <tr><td>Nama Rayon</td><td>:</td><td>{namaRayonInduk || '...........................'}</td></tr>
                  <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................'}</td></tr>
                  <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{selectedJenjang}</td></tr>
                </tbody>
              </table>

              <table className="tabel-utama">
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>No</th>
                    <th style={{ width: '12%', textAlign: 'left' }}>Kode</th>
                    <th style={{ width: '53%', textAlign: 'left' }}>Nama Materi</th>
                    <th style={{ width: '10%' }}>SKS</th>
                    <th style={{ width: '10%' }}>Nilai</th>
                    <th style={{ width: '10%' }}>SKS x Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur oleh Pengurus Rayon.</td></tr>
                  ) : barisRaportRender}
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                    <td></td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kaderisasi)</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{ipKader}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}