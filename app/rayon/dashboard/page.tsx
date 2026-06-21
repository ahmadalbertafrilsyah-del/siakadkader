'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where, setDoc, doc, deleteDoc, addDoc, onSnapshot, orderBy, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';
import * as XLSX from 'xlsx';

export default function DashboardAdminRayon() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState('beranda');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const [adminRayonId, setAdminRayonId] = useState(''); 
  const [namaRayonAsli, setNamaRayonAsli] = useState(''); 

  // --- STATE PROFIL RAYON ---
  const [profilRayon, setProfilRayon] = useState({
    fotoLogoUrl: 'https://via.placeholder.com/200x200/0000af/fff?text=Logo+Rayon',
    nama: '', tanggalBerdiri: '', fakultas: '', programStudi: ''
  });
  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [fotoLogoFile, setFotoLogoFile] = useState<File | null>(null);

  // --- STATE PENGATURAN KOP SURAT ---
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });
  const [fileKop, setFileKop] = useState<File | null>(null);
  const [fileFooter, setFileFooter] = useState<File | null>(null);
  const [isSavingPengaturan, setIsSavingPengaturan] = useState(false);

  // --- STATE MANAJEMEN AKUN ---
  const [dataPendamping, setDataPendamping] = useState<any[]>([]);
  const [dataKader, setDataKader] = useState<any[]>([]);
  const [dataRayon, setDataRayon] = useState<any[]>([]);
  const [tabAkun, setTabAkun] = useState('kader'); 
  const [modeInputKader, setModeInputKader] = useState<'baru' | 'import'>('baru');

  const [formKader, setFormKader] = useState({ nim: '', nia: '', nama: '', password: '', pendamping_mapaba_id: [] as string[], angkatan: new Date().getFullYear().toString(), asalRayon: '' });
  const [formPendamping, setFormPendamping] = useState({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState(''); 
  
  const [searchKader, setSearchKader] = useState('');
  const [filterJenjangKader, setFilterJenjangKader] = useState('');
  const [searchPendamping, setSearchPendamping] = useState('');
  
  // State Pagination
  const [kaderPage, setKaderPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [editKaderModal, setEditKaderModal] = useState<any>(null);

  const currentYear = new Date().getFullYear();
  const [filterTahunBeranda, setFilterTahunBeranda] = useState<string>(currentYear.toString());

  // --- STATE MASTER KURIKULUM & EDIT LOKAL ---
  const [tabKurikulum, setTabKurikulum] = useState('MAPABA');
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], SIG: [], NONFORMAL: [] });
  const [formMateri, setFormMateri] = useState({ kode: '', nama: '', muatan: '', bobot: 3 });
  const [isSavingKurikulum, setIsSavingKurikulum] = useState(false);
  const [masterKurikulumPusat, setMasterKurikulumPusat] = useState<any[]>([]); 
  
  const [editingMateriId, setEditingMateriId] = useState<string | null>(null);
  const [editMateriForm, setEditMateriForm] = useState({ kode: '', nama: '', muatan: '', bobot: 0 });

  // --- STATE NILAI KHS & RAPORT ---
  const [selectedKaderNilai, setSelectedKaderNilai] = useState('');
  const [selectedJenjangNilai, setSelectedJenjangNilai] = useState('MAPABA');
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 
  const [evaluasiKader, setEvaluasiKader] = useState<{ catatan: string }>({ catatan: '' });
  const [tabRaportAdmin, setTabRaportAdmin] = useState('raport'); 
  
  const [kategoriBobotGlobal, setKategoriBobotGlobal] = useState<Record<string, any[]>>({});
  const [nilaiMentah, setNilaiMentah] = useState<Record<string, Record<string, number>>>({});
  const [formKategori, setFormKategori] = useState({ nama: '', persen: 0 });
  const [isSavingEvaluasi, setIsSavingEvaluasi] = useState(false);

  // --- STATE TUGAS, PERPUS ---
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [formTugas, setFormTugas] = useState({ nama_tugas: '', deadline: '' });
  const [listPerpus, setListPerpus] = useState<any[]>([]);
  const [formPerpus, setFormPerpus] = useState({ folder: '', nama_file: '' });
  const [filePerpus, setFilePerpus] = useState<File | null>(null);
  const [isUploadingPerpus, setIsUploadingPerpus] = useState(false);

  // --- STATE TES PEMAHAMAN ---
  const [listTes, setListTes] = useState<any[]>([]);
  const [riwayatTes, setRiwayatTes] = useState<any[]>([]);
  const [jawabanTesViewer, setJawabanTesViewer] = useState<any[]>([]);
  const [selectedTesHasil, setSelectedTesHasil] = useState<any>(null);
  const [formTes, setFormTes] = useState({ judul: '', jenjang: 'MAPABA', soal: '' });
  const [masterTesPusat, setMasterTesPusat] = useState<any[]>([]);

  // --- STATE ENTERPRISE (KALENDER, BROADCAST) ---
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [riwayatBroadcast, setRiwayatBroadcast] = useState<any[]>([]);
  const [notifikasiInbox, setNotifikasiInbox] = useState<any[]>([]); 

  const [formJadwal, setFormJadwal] = useState({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua' });
  const [formBroadcast, setFormBroadcast] = useState({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });

  // ==========================================
  // FUNGSI PENCATAT LOG & UPLOAD
  // ==========================================
  const catatLogAktivitas = async (aksi: string) => {
    if (!adminRayonId) return;
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: adminRayonId, aktor: namaRayonAsli || adminRayonId, role: "rayon",
        aksi: aksi, timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) { console.error("Gagal mencatat log", e); }
  };

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file); formData.append("upload_preset", "siakad_upload"); 
    const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/${resourceType}/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload ke Cloudinary");
    return data.secure_url.replace("http://", "https://");
  };

  // ==========================================
  // EFEK 1: CEK LOGIN ADMIN & LISTENER DATA RAYON
  // ==========================================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(qRole, (snapRole) => {
          if (!snapRole.empty) {
            const userData = snapRole.docs[0].data();
            if (userData.role !== 'rayon') { alert(`Akses Ditolak!`); signOut(auth); router.push('/'); return; }

            const currentRayonId = userData.username; 
            setAdminRayonId(currentRayonId);
            
            onSnapshot(doc(db, "users", currentRayonId), (rayonSnap) => {
              if (rayonSnap.exists()) {
                const rData = rayonSnap.data();
                setNamaRayonAsli(rData.nama || currentRayonId);
                setPengaturanCetak({ kopSuratUrl: rData.kopSuratUrl || '', footerUrl: rData.footerUrl || '' });
                setProfilRayon({
                  fotoLogoUrl: rData.fotoLogoUrl || 'https://via.placeholder.com/200x200/0000af/fff?text=Logo+Rayon',
                  nama: rData.nama || currentRayonId, tanggalBerdiri: rData.tanggalBerdiri || '',
                  fakultas: rData.fakultas || '', programStudi: rData.programStudi || ''
                });
              }
            });

            onSnapshot(doc(db, "pengaturan_rayon", currentRayonId), (docSnap) => {
              if (docSnap.exists()) setKategoriBobotGlobal(docSnap.data().bobot_penilaian || {});
              else setKategoriBobotGlobal({});
            });
            
            onSnapshot(query(collection(db, "users"), where("role", "==", "rayon")), (snap) => {
              setDataRayon(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            onSnapshot(query(collection(db, "users"), where("role", "==", "pendamping"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setDataPendamping(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            onSnapshot(query(collection(db, "users"), where("role", "==", "kader")), (snap) => {
              const list: any[] = [];
              snap.docs.forEach(doc => {
                 const data = doc.data();
                 const terdaftarDi = data.terdaftar_di || [data.id_rayon];
                 if (terdaftarDi.includes(currentRayonId)) { list.push({ id: doc.id, ...data }); }
              });
              setDataKader(list);
              if(list.length > 0 && !selectedKaderNilai) setSelectedKaderNilai((list[0] as any).nim);
            });

            onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setListMasterTugas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
            });

            onSnapshot(query(collection(db, "perpustakaan"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setListPerpus(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
            });

            onSnapshot(query(collection(db, "master_tes"), where("id_rayon", "==", currentRayonId)), (snap) => {
              const tesList: any[] = []; snap.forEach((doc) => tesList.push({ id: doc.id, ...doc.data() })); setListTes(tesList);
            });

            onSnapshot(query(collection(db, "jawaban_tes"), where("id_rayon", "==", currentRayonId)), (snap) => {
              const riwayat: any[] = []; snap.forEach((doc) => riwayat.push({ id: doc.id, ...doc.data() })); setRiwayatTes(riwayat);
            });

            onSnapshot(collection(db, "master_tes_pusat"), (snap) => {
              const listTesPusat: any[] = []; snap.forEach(doc => listTesPusat.push({ id: doc.id, ...doc.data() })); setMasterTesPusat(listTesPusat);
            });

            onSnapshot(doc(db, "kurikulum_rayon", currentRayonId), (docSnap) => {
              if (docSnap.exists()) setListKurikulum(docSnap.data() as Record<string, any[]>);
            });

            onSnapshot(collection(db, "master_kurikulum_pusat"), (snap) => {
              setMasterKurikulumPusat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
              const listJadwal: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.pembuat === "Komisariat" || d.id_rayon === currentRayonId) listJadwal.push({ id: doc.id, ...d });
              });
              listJadwal.sort((a, b) => b.timestamp - a.timestamp); setJadwalKegiatan(listJadwal);
            });

            onSnapshot(collection(db, "notifikasi_global"), (snap) => {
              const listSent: any[] = []; const listInbox: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.id_rayon === currentRayonId && d.pengirim !== "Pusat Komisariat") listSent.push({ id: doc.id, ...d });
                if (d.pengirim === "Pusat Komisariat" && (d.target === "Semua" || d.target === "Rayon")) listInbox.push({ id: doc.id, ...d });
              });
              listSent.sort((a, b) => b.timestamp - a.timestamp); listInbox.sort((a, b) => b.timestamp - a.timestamp);
              setRiwayatBroadcast(listSent); setNotifikasiInbox(listInbox);
            });
          }
        });
      } else { router.push('/'); }
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!selectedKaderNilai) return;
    const unsubscribeNilai = onSnapshot(doc(db, "nilai_khs", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data()); else setNilaiKaderRealtime({});
    });
    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists() && docSnap.data()[selectedJenjangNilai]) {
        const data = docSnap.data()[selectedJenjangNilai];
        setNilaiMentah(data.nilai_mentah || {}); setEvaluasiKader({ catatan: data.catatan || '' });
      } else {
        setNilaiMentah({}); setEvaluasiKader({ catatan: '' });
      }
    });
    return () => { unsubscribeNilai(); unsubscribeKeaktifan(); };
  }, [selectedKaderNilai, selectedJenjangNilai]);

  // ==========================================
  // FUNGSI HELPER NAMA, FILTER KADER, & PAGINATION
  // ==========================================
  const getNamaRayon = (idRayon: string) => {
    if (!idRayon) return "-";
    if (idRayon === 'Komisariat' || idRayon === 'Pusat Komisariat') return 'Pusat Komisariat';
    const r = dataRayon.find((x: any) => x.username === idRayon || x.id_rayon === idRayon || x.id === idRayon);
    return r ? r.nama : idRayon;
  };

  const getNamaPendamping = (idData: any) => {
    if (!idData || idData.length === 0) return "-";
    if (Array.isArray(idData)) {
       if(idData.length === 0) return "-";
       return idData.map((id: any) => dataPendamping.find(p => p.username === id || p.id === id)?.nama || id).join(', ');
    }
    return dataPendamping.find(p => p.username === idData || p.id === idData)?.nama || idData;
  };

  const dataKaderDifilterTahun = dataKader.filter(k => {
    if (filterTahunBeranda === 'Semua') return true;
    const tahunKader = k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear().toString() : '');
    return tahunKader === filterTahunBeranda;
  });

  // PENYEMPURNAAN DETEKSI KADER SKP EKSKLUSIF
  const skpKaderTerdata = dataKaderDifilterTahun.filter((k: any) => 
     k.jenjang === 'SKP' && 
     (k.id_rayon === adminRayonId || k.id_rayon === namaRayonAsli || (k.terdaftar_di && k.terdaftar_di.includes(adminRayonId)))
  );

  const filteredKader = dataKader.filter((k: any) => 
    ((k.nama && k.nama.toLowerCase().includes(searchKader.toLowerCase())) || (k.nim && k.nim.includes(searchKader))) &&
    (filterJenjangKader === '' || k.jenjang === filterJenjangKader)
  );

  const filteredPendamping = dataPendamping.filter((p: any) => 
    p.id_rayon === adminRayonId && 
    ((p.nama && p.nama.toLowerCase().includes(searchPendamping.toLowerCase())) || (p.username && p.username.toLowerCase().includes(searchPendamping.toLowerCase())))
  );

  const indexOfLastKader = kaderPage * itemsPerPage;
  const indexOfFirstKader = indexOfLastKader - itemsPerPage;
  const currentKaderDisplay = filteredKader.slice(indexOfFirstKader, indexOfLastKader);
  const totalPagesKader = Math.ceil(filteredKader.length / itemsPerPage);

  const daftarTahunUnik = ['Semua'];
  for (let i = 0; i < 3; i++) { daftarTahunUnik.push((currentYear - i).toString()); }

  let totalSks = 0; let totalBobotNilai = 0;

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };

  const materiAktif = listKurikulum[selectedJenjangNilai] || [];
  const barisRaportRender = materiAktif.map((materi, index) => {
    const nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
    const angkaNilai = konversiHurufKeAngka(nilaiHuruf);
    const sksKaliNilai = materi.bobot * angkaNilai;
    totalSks += materi.bobot; if (nilaiHuruf !== "-") totalBobotNilai += sksKaliNilai;
    return (
      <tr key={materi.kode}>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{index + 1}</td><td style={{ padding: '6px 10px', textAlign: 'left' }}>{materi.kode}</td>
        <td style={{ padding: '6px 10px', textAlign: 'left' }}>{materi.nama}</td><td style={{ padding: '6px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#555' }}>{nilaiHuruf}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });

  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";
  const kaderDicetak = dataKader.find(k => k.nim === selectedKaderNilai) || {};

  const kategoriBobotAktif = kategoriBobotGlobal[selectedJenjangNilai] || [];
  const totalBobotTersimpan = kategoriBobotAktif.reduce((sum: number, k: any) => sum + k.persen, 0);

  // ==========================================
  // FUNGSI PENILAIAN MATRIKS DETAIL
  // ==========================================
  const handleTambahKategoriBobot = async (e: React.FormEvent) => {
    e.preventDefault(); if(!formKategori.nama) return;
    if(totalBobotTersimpan + formKategori.persen > 100) return alert("Total bobot tidak boleh melebihi 100%!");
    setIsSavingEvaluasi(true);
    try {
      const docRef = doc(db, "pengaturan_rayon", adminRayonId);
      const newBobot = [...kategoriBobotAktif, { id: Date.now().toString(), nama: formKategori.nama, persen: formKategori.persen }];
      await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, [selectedJenjangNilai]: newBobot } }, { merge: true });
      catatLogAktivitas(`Menambahkan Kategori Bobot: ${formKategori.nama} (${formKategori.persen}%)`);
      setFormKategori({ nama: '', persen: 0 }); setActiveModal(null);
    } catch (error) { alert("Gagal."); } finally { setIsSavingEvaluasi(false); }
  };

  const handleHapusKategoriBobot = async (id: string) => {
    if(!window.confirm("Hapus kategori bobot ini dari jenjang " + selectedJenjangNilai + "?")) return;
    try {
      const docRef = doc(db, "pengaturan_rayon", adminRayonId);
      const newBobot = kategoriBobotAktif.filter((item: any) => item.id !== id);
      await setDoc(docRef, { bobot_penilaian: { ...kategoriBobotGlobal, [selectedJenjangNilai]: newBobot } }, { merge: true });
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
      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { nilai_mentah: {}, catatan: evaluasiKader.catatan };
      await setDoc(docRef, { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, nilai_mentah: nilaiMentah } }, { merge: true });

      let angkaAkhir = 0;
      kategoriBobotAktif.forEach((kat: any) => { const score = nilaiMentah[kodeMateri]?.[kat.nama] || 0; angkaAkhir += (score * (kat.persen / 100)); });
      const hurufAkhir = getNilaiHuruf(angkaAkhir);
      await setDoc(doc(db, "nilai_khs", selectedKaderNilai), { [kodeMateri]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: "Admin Rayon" }, { merge: true });
    } catch (error) {}
  };

  const handleSimpanCatatan = async (text: string) => {
    setEvaluasiKader({ ...evaluasiKader, catatan: text });
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { nilai_mentah: {}, catatan: '' };
      await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, catatan: text } }, { merge: true });
    } catch (error) {}
  };

  // ==========================================
  // FITUR PROFIL RAYON
  // ==========================================
  const handleSimpanProfilRayon = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingPengaturan(true);
    try {
      let finalFoto = profilRayon.fotoLogoUrl;
      if (fotoLogoFile) { finalFoto = await uploadToCloudinary(fotoLogoFile); }
      await updateDoc(doc(db, "users", adminRayonId), {
        nama: profilRayon.nama, tanggalBerdiri: profilRayon.tanggalBerdiri,
        fakultas: profilRayon.fakultas, programStudi: profilRayon.programStudi, fotoLogoUrl: finalFoto
      });
      catatLogAktivitas("Memperbarui Profil Rayon."); alert("Profil Rayon berhasil diperbarui!");
      setIsEditingProfil(false); setFotoLogoFile(null);
    } catch (error) { alert("Gagal."); } finally { setIsSavingPengaturan(false); }
  };

  // ==========================================
  // FITUR ENTERPRISE LENGKAP
  // ==========================================
  const handleExportKaderRayon = () => {
    if (dataKader.length === 0) return alert("Belum ada data kader!");
    const dataToExport = dataKader.map((k, i) => ({
      "No": i + 1, "NIM": k.nim || '-', "Nama Lengkap": k.nama || '-',
      "Asal Rayon": getNamaRayon(k.id_rayon), "NIA": k.nia || '-',
      "Jenjang Terakhir": k.jenjang || 'MAPABA', "Angkatan": k.angkatan || '-',
      "Email": k.email || '-', "Status": k.status || 'Aktif'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport); const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Kader");
    XLSX.writeFile(workbook, `Data_Kader_${adminRayonId}_${Date.now()}.xlsx`);
    catatLogAktivitas("Mengekspor (Download Excel) data kader rayon.");
  };

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

  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "jadwal_kegiatan"), { ...formJadwal, id_rayon: adminRayonId, pembuat: namaRayonAsli || adminRayonId, timestamp: Date.now() });
      catatLogAktivitas(`Menambahkan jadwal kegiatan rayon (Target: ${formJadwal.target}): ${formJadwal.judul}`);
      alert("Jadwal ditambahkan!"); setFormJadwal({ judul: '', tanggal: '', lokasi: '', deskripsi: '', target: 'Semua' });
    } catch (error) { alert("Gagal."); } finally { setIsSubmitting(false); }
  };

  const handleHapusJadwal = async (id: string, judul: string, pembuat: string) => {
    if (pembuat === "Komisariat" || pembuat === "Pusat Komisariat") return alert("Anda tidak memiliki akses menghapus jadwal Komisariat.");
    if (!window.confirm(`Hapus jadwal "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "jadwal_kegiatan", id)); catatLogAktivitas(`Menghapus jadwal kegiatan rayon: ${judul}`); } catch (error) {}
  };

  const handleKirimBroadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addDoc(collection(db, "notifikasi_global"), { ...formBroadcast, id_rayon: adminRayonId, pengirim: namaRayonAsli || adminRayonId, tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), timestamp: Date.now() });
      catatLogAktivitas(`Mengirim Broadcast (${formBroadcast.target}): ${formBroadcast.judul}`); alert("Pesan disiarkan!");
      setFormBroadcast({ judul: '', pesan: '', target: 'Semua', batas_waktu: '' });
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleHapusBroadcast = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus/tarik pesan broadcast "${judul}"?`)) return;
    try { await deleteDoc(doc(db, "notifikasi_global", id)); catatLogAktivitas(`Menarik pesan Broadcast: ${judul}`); } catch (error) {}
  };

  const handleSimpanPengaturanCetak = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingPengaturan(true);
    try {
      let newKop = pengaturanCetak.kopSuratUrl; let newFooter = pengaturanCetak.footerUrl;
      if (fileKop) newKop = await uploadToCloudinary(fileKop); if (fileFooter) newFooter = await uploadToCloudinary(fileFooter);
      await updateDoc(doc(db, "users", adminRayonId), { kopSuratUrl: newKop, footerUrl: newFooter });
      catatLogAktivitas("Menyimpan pengaturan KOP Cetak Surat."); alert("Disimpan!"); setFileKop(null); setFileFooter(null);
    } catch (error) {} finally { setIsSavingPengaturan(false); }
  };

  const handleBuatTes = async (e: React.FormEvent) => {
    e.preventDefault(); if (!formTes.judul || !formTes.soal) return;
    const daftarSoalArray = formTes.soal.split('\n').filter(s => s.trim() !== '');
    try {
      await addDoc(collection(db, "master_tes"), { id_rayon: adminRayonId, judul: formTes.judul, jenjang: formTes.jenjang, daftar_soal: daftarSoalArray, status: 'Tutup', timestamp: Date.now() });
      catatLogAktivitas(`Membuat Tes Pemahaman: ${formTes.judul}`); alert("Tes dibuat!"); setFormTes({ judul: '', jenjang: 'MAPABA', soal: '' }); setActiveModal(null);
    } catch (error) {}
  };

  const handleTarikTesPusat = async (tesPusat: any) => {
    try {
      await addDoc(collection(db, "master_tes"), { id_rayon: adminRayonId, judul: tesPusat.judul, jenjang: tesPusat.jenjang, daftar_soal: tesPusat.daftar_soal || [], status: 'Tutup', timestamp: Date.now() });
      catatLogAktivitas(`Menarik Master Tes dari Komisariat: ${tesPusat.judul}`); alert("Sukses!");
    } catch (error) {}
  };

  const handleToggleStatusTes = async (idTes: string, statusSaatIni: string) => {
    const statusAkanDatang = statusSaatIni === 'Buka' ? 'Tutup' : 'Buka'; if (!window.confirm(`Ubah status tes menjadi: ${statusAkanDatang}?`)) return;
    try { await updateDoc(doc(db, "master_tes", idTes), { status: statusAkanDatang }); } catch (error) {}
  };

  const handleHapusTes = async (idTes: string) => { if (!window.confirm("Hapus permanen?")) return; try { await deleteDoc(doc(db, "master_tes", idTes)); } catch (error) {} };

  const handleLihatHasilTes = async (tes: any) => {
    setSelectedTesHasil(tes);
    try {
      const q = query(collection(db, "jawaban_tes"), where("id_tes", "==", tes.id));
      const snap = await getDocs(q); const dataJawaban = snap.docs.map(doc => doc.data());
      dataJawaban.sort((a: any, b: any) => b.timestamp - a.timestamp); setJawabanTesViewer(dataJawaban);
    } catch (error) {}
  };

  const handleUbahStatusAkun = async (idAkun: string, statusSekarang: string) => { const statusBaru = statusSekarang === "Aktif" ? "Pasif" : "Aktif"; if (!window.confirm(`Ubah status ke ${statusBaru}?`)) return; try { await updateDoc(doc(db, "users", idAkun), { status: statusBaru }); } catch (error) {} };
  const handleHapusAkun = async (idAkun: string, nama: string) => { if (!window.confirm(`Hapus permanen "${nama}"?`)) return; try { await deleteDoc(doc(db, "users", idAkun)); alert(`Dihapus.`); } catch (error) {} };
  const handleUbahAngkatanKader = async (nimKader: string, angkatanBaru: string) => { try { await updateDoc(doc(db, "users", nimKader), { angkatan: angkatanBaru }); } catch (error) {} };
  const handleUbahJenjangPendamping = async (idPendamping: string, jenjangTugasBaru: string) => { try { await updateDoc(doc(db, "users", idPendamping), { jenjangTugas: jenjangTugasBaru }); } catch (error) {} };
  const handleUbahNiaKader = async (nimKader: string, niaBaru: string) => { try { await updateDoc(doc(db, "users", nimKader), { nia: niaBaru }); } catch (error) {} };
  
  const handleBersihkanDataKaderLama = async () => {
    const batasTahun = currentYear - 3; 
    const kaderExpired = dataKader.filter(k => { if (!k.createdAt) return false; return new Date(k.createdAt).getFullYear() <= batasTahun; });
    if (kaderExpired.length === 0) return alert(`Tidak ada data kader <= tahun ${batasTahun}.`);
    if (!window.confirm(`Yakin hapus permanen ${kaderExpired.length} kader angkatan ${batasTahun} kebawah?`)) return;
    setIsSubmitting(true);
    try {
      for (const kader of kaderExpired) { await deleteDoc(doc(db, "users", kader.id)); await deleteDoc(doc(db, "nilai_khs", kader.nim)); await deleteDoc(doc(db, "evaluasi_kader", kader.nim)); }
      catatLogAktivitas("Membersihkan data kader kadaluarsa."); alert(`Pembersihan Selesai!`); setActiveModal(null);
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleTarikMateriPusat = async (materiPusat: any) => {
    setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const newMateri = { id: Date.now().toString(), kode: materiPusat.kode, nama: materiPusat.nama, muatan: materiPusat.muatan || '', bobot: Number(materiPusat.bobot), isLokal: false };
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: [...currentList, newMateri] }, { merge: true });
    } catch (error) {} finally { setIsSavingKurikulum(false); }
  };

  const handleTambahMateriLokal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const newMateri = { id: Date.now().toString(), kode: formMateri.kode, nama: formMateri.nama, muatan: formMateri.muatan, bobot: Number(formMateri.bobot), isLokal: true };
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: [...currentList, newMateri] }, { merge: true });
      catatLogAktivitas(`Menambahkan materi lokal: ${formMateri.nama}`);
      setFormMateri({ kode: '', nama: '', muatan: '', bobot: 3 }); setActiveModal(null); 
    } catch (error) {} finally { setIsSavingKurikulum(false); }
  };

  const handleHapusMateri = async (materiId: string) => {
    if (!window.confirm("Yakin hapus?")) return;
    try {
      const currentList = listKurikulum[tabKurikulum] || []; const filteredList = currentList.filter((m: any) => m.id !== materiId);
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: filteredList }, { merge: true });
    } catch (error) {}
  };

  const handleSimpanEditMateri = async (materiId: string) => {
    if (!editMateriForm.kode || !editMateriForm.nama) return alert("Kode dan Nama materi tidak boleh kosong!"); setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const updatedList = currentList.map((m: any) => m.id === materiId ? { ...m, ...editMateriForm } : m);
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: updatedList }, { merge: true });
      setEditingMateriId(null); alert("Materi berhasil diperbarui!");
    } catch(err) {} finally { setIsSavingKurikulum(false); }
  };

  const handleTambahTugas = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    try { 
      await addDoc(collection(db, "master_tugas"), { id_rayon: adminRayonId, nama_tugas: formTugas.nama_tugas, deadline: formTugas.deadline, timestamp: Date.now() }); 
      catatLogAktivitas(`Membuat tugas baru: ${formTugas.nama_tugas}`); setFormTugas({ nama_tugas: '', deadline: '' }); alert("Tugas ditambah!"); setActiveModal(null); 
    } catch (error) {} 
  };
  const handleHapusTugas = async (idTugas: string) => { if(window.confirm("Hapus?")) await deleteDoc(doc(db, "master_tugas", idTugas)); };

  const handleTambahPerpus = async (e: React.FormEvent) => {
    e.preventDefault(); if(!filePerpus) return alert("Pilih file!"); setIsUploadingPerpus(true);
    try { 
      const fileUrl = await uploadToCloudinary(filePerpus); 
      await addDoc(collection(db, "perpustakaan"), { id_rayon: adminRayonId, folder: formPerpus.folder, nama_file: formPerpus.nama_file, link_file: fileUrl, timestamp: Date.now() }); 
      setFormPerpus({ folder: '', nama_file: '' }); setFilePerpus(null); alert("Materi diupload!"); setActiveModal(null); 
    } catch (error) {} finally { setIsUploadingPerpus(false); }
  };
  const handleHapusPerpus = async (idPerpus: string) => { if(window.confirm("Hapus?")) await deleteDoc(doc(db, "perpustakaan", idPerpus)); };

  const getSecondaryAuth = () => { const apps = getApps(); const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(auth.app.options, 'SecondaryApp'); return getAuth(secondaryApp); };

  // ==========================================
  // LOGIKA IMPORT & PENAMBAHAN KADER SUPER CERDAS (4 VARIABEL)
  // ==========================================
  const handleBuatAkunPendamping = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeUsername = formPendamping.username.trim().replace(/\s+/g, '').toLowerCase();
      const emailBaru = `${safeUsername}@pmii-uinmalang.or.id`;
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formPendamping.password);
      await setDoc(doc(db, "users", safeUsername), { username: safeUsername, nama: formPendamping.nama, email: emailBaru, role: "pendamping", id_rayon: adminRayonId, jumlahBinaan: 0, status: "Aktif", jenjangTugas: formPendamping.jenjangTugas, createdAt: Date.now() });
      await signOutSecondary(secondaryAuth); catatLogAktivitas(`Membuat akun pendamping: ${formPendamping.nama}`); alert(`Sukses! Akun pendamping berhasil dibuat.`); 
      setFormPendamping({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' }); setActiveModal(null);
    } catch (error: any) { alert("Gagal. Pastikan username belum dipakai. Error: " + error.message); } finally { setIsSubmitting(false); }
  };

  const handleBuatAkunKader = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const safeNim = formKader.nim.trim();
      const qCek = query(collection(db, "users"), where("nim", "==", safeNim), where("role", "==", "kader"));
      const snapCek = await getDocs(qCek);

      let asalRayonFix = adminRayonId;
      if (formKader.asalRayon.trim()) {
         const inputVal = formKader.asalRayon.trim();
         const matchedRayon = dataRayon.find((r: any) => r.nama.toLowerCase() === inputVal.toLowerCase() || r.username.toLowerCase() === inputVal.toLowerCase() || r.id === inputVal);
         asalRayonFix = matchedRayon ? (matchedRayon.username || matchedRayon.id) : inputVal;
      }

      if (!snapCek.empty) {
         const existingDoc = snapCek.docs[0]; const existingData = existingDoc.data();
         const existingTerdaftar = existingData.terdaftar_di || [existingData.id_rayon];
         if (!existingTerdaftar.includes(adminRayonId)) existingTerdaftar.push(adminRayonId);
         const mergedPendamping = Array.from(new Set([...(existingData.pendamping_mapaba_id || []), ...formKader.pendamping_mapaba_id]));
         const riwayatUpdated = existingData.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false };
         await updateDoc(doc(db, "users", existingDoc.id), { jenjang: 'MAPABA', pendamping_mapaba_id: mergedPendamping, riwayat_kaderisasi: riwayatUpdated, terdaftar_di: existingTerdaftar });
         catatLogAktivitas(`Menarik akun kader lama ke Rayon: ${existingData.nama}`);
         alert(`Kader ditarik sukses tanpa menghapus Asal Rayon Asli!`);
      } else {
          const emailBaru = `${safeNim}@pmii-uinmalang.or.id`.toLowerCase();
          await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formKader.password);
          await setDoc(doc(db, "users", safeNim), { 
            nim: safeNim, nia: formKader.nia, nama: formKader.nama, email: emailBaru, 
            role: "kader", id_rayon: asalRayonFix, jenjang: "MAPABA", 
            pendamping_mapaba_id: formKader.pendamping_mapaba_id, pendamping_pkd_id: [], pendamping_sig_id: [], pendamping_skp_id: [],
            riwayat_kaderisasi: { MAPABA: true, PKD: false, SIG: false, SKP: false },
            angkatan: formKader.angkatan, status: "Aktif", createdAt: Date.now(), terdaftar_di: Array.from(new Set([asalRayonFix, adminRayonId])) 
          });
          await signOutSecondary(secondaryAuth); catatLogAktivitas(`Membuat akun kader baru: ${formKader.nama}`); alert(`Sukses dibuat.`);
      }
      setFormKader({ nim: '', nia: '', nama: '', password: '', pendamping_mapaba_id: [], angkatan: new Date().getFullYear().toString(), asalRayon: '' });
      setActiveModal(null);
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{ "NIM": "", "NIA": "", "AsalRayon": "", "Nama": "", "Jenjang": "", "Angkatan": "", "TanggalLahir": "", "Pendamping": "" }];
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
          const angkatan = String(row['Angkatan'] || row['angkatan'] || currentYear).trim(); 
          const tglLahir = String(row['TanggalLahir'] || row['tanggallahir'] || row['Password'] || '').trim(); 
          const asalRayonExcel = String(row['AsalRayon'] || row['Asal Rayon'] || row['asalrayon'] || '').trim();

          let finalAsalRayonId = adminRayonId;
          if (asalRayonExcel) {
             const matchedRayon = dataRayon.find((r: any) => r.nama.toLowerCase() === asalRayonExcel.toLowerCase() || r.username.toLowerCase() === asalRayonExcel.toLowerCase() || r.id === asalRayonExcel);
             finalAsalRayonId = matchedRayon ? (matchedRayon.username || matchedRayon.id) : asalRayonExcel;
          }
          
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
        setActiveModal(null);
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

  const handleLogout = () => { signOut(auth); router.push('/'); };
  const handleDownloadPDF = () => { window.print(); };

  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'beranda': return 'Dashboard Utama';
      case 'profil-rayon': return 'Profil Rayon';
      case 'kalender': return 'Kalender & Jadwal Rayon';
      case 'broadcast': return 'Pusat Broadcast Notifikasi';
      case 'manajemen-akun': return 'Manajemen Akun';
      case 'kurikulum': return 'Kurikulum Kaderisasi';
      case 'pantau-nilai': return 'Raport Kaderisasi';
      case 'master-tugas': return 'Manajemen Tugas';
      case 'perpus': return 'Perpustakaan Digital';
      case 'manajemen-tes': return 'Manajemen Tes';
      default: return 'Dashboard Admin';
    }
  };

  const groupedPerpus = listPerpus.reduce((acc, item) => { if (!acc[item.folder]) acc[item.folder] = []; acc[item.folder].push(item); return acc; }, {});

  // ==========================================
  // VIEW RENDER
  // ==========================================
  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      <style>{`
        * { box-sizing: border-box; } 
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
          body, html { background-color: white !important; margin: 0; padding: 0; height: auto !important; }
          div[style*="overflow: hidden"], div[style*="overflowY: auto"] { overflow: visible !important; height: auto !important; }
          aside, main, header, .no-print { display: none !important; }
          .print-layout-container { display: block !important; position: relative !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; background-color: transparent !important; opacity: 1 !important; z-index: 10 !important; }
          .print-layout-container * { color: #000 !important; font-family: "Arial", "Arial Narrow", sans-serif !important; line-height: 1.15 !important; }
          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; width: 210mm !important; height: 297mm !important; z-index: -10 !important; }
          .bg-kertas-a4 img { width: 210mm !important; height: 297mm !important; object-fit: fill !important; display: block !important; }
          .print-content-area { position: relative !important; z-index: 10 !important; padding: 50mm 25mm 30mm 25mm !important; background-color: transparent !important; }
          table { width: 100% !important; border-collapse: collapse !important; background-color: transparent !important; }
          tr { page-break-inside: avoid !important; background-color: transparent !important; }
          .tabel-utama thead tr { border-top: 1px solid #000 !important; border-bottom: 1px solid #000 !important; } 
          th, td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11pt !important; background-color: transparent !important; color: #000 !important; }
          th { font-weight: bold !important; text-align: center !important; }
          .tabel-biodata { margin-bottom: 15px !important; border: none !important; width: 100% !important; }
          .tabel-biodata td, .tabel-biodata tr { border: none !important; padding: 3px 0 !important; text-align: left !important; }
          .no-print { display: none !important; } 
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {isSidebarOpen && (<div className="no-print" onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }} />)}
      
      {/* SIDEBAR */}
      <aside className="no-print" style={{ width: '260px', background: 'linear-gradient(100deg, #0000af 100%)', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'left 0.3s ease', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🏛️ SIAKAD PMII</span>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <h4 style={{ fontSize: '1rem', margin: 0, color: '#f1c40f', lineHeight: '1.4' }}>{namaRayonAsli || 'Memuat...'}</h4>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', margin: 0, flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'beranda', icon: '🏠', label: 'Dashboard Utama' },
            { id: 'profil-rayon', icon: '🏢', label: 'Profil Rayon' },
            { id: 'kalender', icon: '📅', label: 'Kalender & Jadwal' },
            { id: 'broadcast', icon: '📡', label: 'Broadcast Notifikasi' },
            { id: 'manajemen-akun', icon: '👥', label: 'Manajemen Akun' },
            { id: 'kurikulum', icon: '📚', label: 'Kurikulum Kaderisasi' }, 
            { id: 'pantau-nilai', icon: '📊', label: 'Raport Kaderisasi' }, 
            { id: 'manajemen-tes', icon: '📝', label: 'Manajemen Tes' },
            { id: 'master-tugas', icon: '📋', label: 'Manajemen Tugas' }, 
            { id: 'perpus', icon: '📁', label: 'Perpustakaan Digital' }, 
          ].map((item) => (
            <li key={item.id}>
              <button 
                onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} 
                style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent', border: 'none', color: activeMenu === item.id ? '#fff' : '#d1d1d1', padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', transition: '0.2s' }}
              >
                <div style={{ display: 'flex', gap: '15px' }}><span>{item.icon}</span> {item.label}</div>
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🚪 Keluar</button>
        </div>
      </aside>

      {/* Konten Utama Container (Header Freeze) */}
      <main className="no-print" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '0', width: '100%', overflowX: 'hidden' }}>
        
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, textTransform: 'uppercase', fontWeight: 'bold' }}>{getHeaderTitle()}</h2>
            <div style={{ fontSize: '0.8rem', color: '#0000af', fontWeight: 'bold' }}>👤: {adminRayonId}</div>
          </div>
        </header>

        {/* ISI KONTEN (Scroll Berjalan Di Sini Saja) */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>

          {/* MENU 0: BERANDA OVERVIEW */}
          {activeMenu === 'beranda' && (
            <div>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h2 style={{color: '#0d1b2a', marginTop: 0, fontSize: '1.5rem'}}>Dashboard {namaRayonAsli}!</h2>
                <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Kelola data kaderisasi, master tugas, surat, akun kader, dan perpustakaan secara real-time melalui panel ini.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>📊 Overview Kaderisasi Rayon</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Filter Angkatan:</label>
                  <select value={filterTahunBeranda} onChange={(e) => setFilterTahunBeranda(e.target.value)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #1e824c', fontWeight: 'bold', color: '#1e824c', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {daftarTahunUnik.map(thn => <option key={thn} value={thn}>{thn === 'Semua' ? 'Tampilkan Semua Data' : `Angkatan ${thn}`}</option>)}
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3498db' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Kader Terdata</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{dataKaderDifilterTahun.length}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Delegasi SKP Aktif</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{skpKaderTerdata.length}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #2ecc71' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Pendamping Aktif</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{dataPendamping.length}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Rayon Aktif</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{listMasterTugas.length}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
                <h4 style={{ marginTop: 0, color: '#0d1b2a', marginBottom: '15px' }}>Distribusi Jenjang Kader</h4>
                <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
                    <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Jenjang Kaderisasi</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Jumlah Kader</th></tr></thead>
                    <tbody>
                      {['MAPABA', 'PKD', 'SIG', 'SKP'].map((jenjang) => {
                        let count = 0;
                        if (jenjang === 'MAPABA') count = dataKaderDifilterTahun.filter((k: any) => ['MAPABA', 'PKD', 'SIG', 'SKP'].includes(k.jenjang)).length;
                        else if (jenjang === 'PKD') count = dataKaderDifilterTahun.filter((k: any) => ['PKD', 'SKP'].includes(k.jenjang)).length;
                        else if (jenjang === 'SIG') count = dataKaderDifilterTahun.filter((k: any) => ['SIG'].includes(k.jenjang)).length;
                        else if (jenjang === 'SKP') count = skpKaderTerdata.length;
                        return (
                          <tr key={jenjang} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{jenjang}</td><td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#3498db' }}>{count} Kader</td></tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABEL SKP KHUSUS */}
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h4 style={{ marginTop: 0, color: '#e74c3c', marginBottom: '5px' }}>🎓 Kader Delegasi Sekolah Kader Putri (SKP)</h4>
                <p style={{fontSize: '0.8rem', color: '#777', marginBottom: '15px'}}>Daftar kader yang di-plotting ke dalam program SKP oleh Pusat Komisariat yang memiliki asal Rayon ini.</p>
                <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                  <table className="tabel-utama" style={{ minWidth: '600px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fdf2e9', color: '#e74c3c' }}>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>NIM</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Nama Delegasi SKP</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Angkatan</th>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Pendamping SKP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skpKaderTerdata.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada delegasi SKP dari rayon ini.</td></tr>
                      ) : (
                        skpKaderTerdata.map((k: any) => (
                          <tr key={k.nim} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{k.nim}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{k.nama}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#888' }}>{k.angkatan}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#0000af', fontSize: '0.75rem' }}>{getNamaPendamping(k.pendamping_skp_id)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU BARU: PROFIL RAYON */}
          {activeMenu === 'profil-rayon' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
              <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #ddd' }}>
                 <h3 style={{ margin: 0, color: '#0d1b2a', fontSize: '1.2rem' }}>🏢 Profil Rayon</h3>
                 <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#777' }}>Lengkapi data identitas Rayon Anda di bawah ini.</p>
              </div>
              <div style={{ padding: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 200px', textAlign: 'center' }}>
                  <img src={profilRayon.fotoLogoUrl} alt="Logo Rayon" style={{ width: '100%', height: '200px', objectFit: 'contain', border: '4px solid #eee', borderRadius: '8px', backgroundColor: '#fafafa' }} />
                  {isEditingProfil && (
                    <div style={{ marginTop: '10px', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Unggah Logo Baru:</label>
                      <input type="file" accept="image/*" onChange={(e) => {
                         if (e.target.files && e.target.files[0]) {
                           setFotoLogoFile(e.target.files[0]);
                           setProfilRayon({ ...profilRayon, fotoLogoUrl: URL.createObjectURL(e.target.files[0]) });
                         }
                      }} style={{ width: '100%', fontSize: '0.7rem', marginTop: '5px' }} />
                    </div>
                  )}
                  <button 
                    disabled={isSavingPengaturan}
                    onClick={() => isEditingProfil ? handleSimpanProfilRayon(new Event('submit') as any) : setIsEditingProfil(true)} 
                    style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: isEditingProfil ? '#2ecc71' : '#0000af', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.85rem', transition: '0.2s' }}>
                    {isSavingPengaturan ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil Rayon' : '📝 Ubah Profil'}
                  </button>
                  {isEditingProfil && (
                     <button onClick={() => {setIsEditingProfil(false); setFotoLogoFile(null);}} style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Batal</button>
                  )}
                </div>
                <div style={{ flex: '1 1 350px' }}>
                  <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <form onSubmit={handleSimpanProfilRayon}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#333', minWidth: '400px' }}>
                        <tbody>
                          {[
                            { label: 'Nama Rayon', key: 'nama', placeholder: 'PR. PMII ...' },
                            { label: 'Tanggal / Tahun Berdiri', key: 'tanggalBerdiri', placeholder: 'DD-MM-YYYY' },
                            { label: 'Fakultas Naungan', key: 'fakultas', placeholder: 'Fakultas ...' },
                            { label: 'Program Studi', key: 'programStudi', placeholder: 'Prodi A, Prodi B, Prodi C...' },
                          ].map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '12px 10px', fontWeight: 'bold', width: '200px', color: '#555' }}>{row.label}</td>
                              <td style={{ padding: '12px 10px' }}>
                                {isEditingProfil ? (
                                  row.key === 'programStudi' ? (
                                     <div>
                                        <textarea rows={2} placeholder={row.placeholder} value={(profilRayon as any)[row.key]} onChange={(e) => setProfilRayon({...profilRayon, [row.key]: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }} />
                                        <span style={{fontSize: '0.7rem', color: '#888'}}>*Pisahkan dengan koma jika lebih dari satu prodi.</span>
                                     </div>
                                  ) : (
                                     <input type="text" placeholder={row.placeholder} value={(profilRayon as any)[row.key]} onChange={(e) => setProfilRayon({...profilRayon, [row.key]: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                                  )
                                ) : ( 
                                  <span style={{ color: '#333', fontWeight: row.key === 'nama' ? 'bold' : 'normal', fontSize: row.key === 'nama' ? '1rem' : '0.85rem' }}>
                                    {(profilRayon as any)[row.key] || '- Belum diisi -'}
                                  </span> 
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MENU 2: KALENDER & JADWAL */}
          {activeMenu === 'kalender' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem' }}>📅 Kalender & Jadwal Kegiatan Rayon</h3>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>➕ Tambah Agenda Rayon</h4>
                    <form onSubmit={handleTambahJadwal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" placeholder="Judul Kegiatan (Cth: RTK Rayon)" required value={formJadwal.judul} onChange={e => setFormJadwal({...formJadwal, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <input type="datetime-local" required value={formJadwal.tanggal} onChange={e => setFormJadwal({...formJadwal, tanggal: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <input type="text" placeholder="Lokasi / Media" required value={formJadwal.lokasi} onChange={e => setFormJadwal({...formJadwal, lokasi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      <select required value={formJadwal.target} onChange={e => setFormJadwal({...formJadwal, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', cursor: 'pointer' }}>
                        <option value="Semua">📢 Terlihat Semua Pengguna</option>
                        <option value="Rayon">🏢 Hanya Admin Rayon</option>
                        <option value="Pendamping">👤 Hanya Para Pendamping</option>
                        <option value="Kader">🎓 Hanya Seluruh Kader</option>
                      </select>
                      <textarea rows={3} placeholder="Deskripsi Singkat" value={formJadwal.deskripsi} onChange={e => setFormJadwal({...formJadwal, deskripsi: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} />
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Simpan Agenda</button>
                    </form>
                  </div>
                  <div style={{ flex: '2 1 450px', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {jadwalKegiatan.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>Belum ada agenda terjadwal.</div>
                      ) : (
                        jadwalKegiatan.map((jadwal: any) => (
                          <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: jadwal.pembuat === 'Komisariat' ? '4px solid #f1c40f' : '4px solid #3498db', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '1rem' }}>{jadwal.judul}</h4>
                                {jadwal.pembuat === 'Komisariat' ? (
                                  <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '2px 6px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold', border: '1px solid #ffeeba' }}>Komisariat</span>
                                ) : (
                                  <span style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold' }}>Target: {jadwal.target || 'Semua'}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                            </div>
                            <button onClick={() => handleHapusJadwal(jadwal.id, jadwal.judul, jadwal.pembuat)} style={{ color: jadwal.pembuat === 'Komisariat' ? '#ccc' : '#e74c3c', border: 'none', background: 'none', cursor: jadwal.pembuat === 'Komisariat' ? 'not-allowed' : 'pointer', fontSize: '1rem' }} title={jadwal.pembuat === 'Komisariat' ? 'Hanya Pusat Komisariat yang bisa menghapus' : 'Hapus Jadwal'}>🗑️</button>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem' }}>📡 Pusat Broadcast & Notifikasi Rayon</h3>
                <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px' }}>Kirimkan pesan mendesak atau pengumuman penting yang akan muncul di notifikasi pengguna Rayon Anda.</p>
                
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {/* KIRI: FORM BROADCAST */}
                  <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <form onSubmit={handleKirimBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Judul Pesan</label>
                        <input type="text" required value={formBroadcast.judul} onChange={e => setFormBroadcast({...formBroadcast, judul: e.target.value})} placeholder="Cth: Panggilan Rapat Darurat" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Isi Pesan Lengkap</label>
                        <textarea rows={4} required value={formBroadcast.pesan} onChange={e => setFormBroadcast({...formBroadcast, pesan: e.target.value})} placeholder="Detail pengumuman..." style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', resize: 'vertical' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Batas Waktu Siar</label>
                        <input type="date" required value={formBroadcast.batas_waktu} onChange={e => setFormBroadcast({...formBroadcast, batas_waktu: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Target Penerima</label>
                        <select value={formBroadcast.target} onChange={e => setFormBroadcast({...formBroadcast, target: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '5px', cursor: 'pointer' }}>
                          <option value="Semua">📢 Semua Pengguna (Pendamping & Kader)</option>
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
                        <tr style={{ backgroundColor: '#0d1b2a', color: 'white' }}>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', color: 'white', textAlign: 'left' }}>Judul & Pesan Broadcast</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', color: 'white', width: '100px' }}>Target</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', color: 'white', width: '120px' }}>Batas Waktu</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center', color: 'white', width: '80px' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riwayatBroadcast.length === 0 ? (
                          <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada riwayat broadcast yang dikirim.</td></tr>
                        ) : (
                          riwayatBroadcast.map((notif: any) => (
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

              {/* KOTAK MASUK NOTIFIKASI DARI KOMISARIAT */}
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                 <h4 style={{ margin: '0 0 15px 0', color: '#0d1b2a', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🔔 Kotak Masuk Notifikasi dari Komisariat</h4>
                 <div style={{ display: 'grid', gap: '10px' }}>
                    {notifikasiInbox.length === 0 ? (
                      <p style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>Belum ada pengumuman masuk dari Pusat Komisariat.</p>
                    ) : (
                      notifikasiInbox.map((notif: any) => (
                        <div key={notif.id} style={{ padding: '15px', backgroundColor: '#fcfcfc', border: '1px solid #eee', borderLeft: '4px solid #f1c40f', borderRadius: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <strong style={{ color: '#333' }}>{notif.judul}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#888' }}>{notif.tanggal}</span>
                          </div>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap' }}>{notif.pesan}</p>
                          <div style={{ fontSize: '0.7rem', color: '#1e824c', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>
          )}

          {/* MENU 5: MANAJEMEN AKUN */}
          {activeMenu === 'manajemen-akun' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              
              {/* HEADER MANAJEMEN AKUN */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0 }}>Manajemen Akun & Data</h3>
                {tabAkun === 'kader' && (
                  <button onClick={handleExportKaderRayon} style={{ backgroundColor: '#0000af', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    📥 Export Data Kader
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabAkun('kader')} style={{ padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkun === 'kader' ? '#0000af' : '#f4f6f9', color: tabAkun === 'kader' ? 'white' : '#555', flex: '1 1 auto', textAlign: 'center', fontSize: '0.85rem' }}>🎓 Akun Kader</button>
                <button onClick={() => setTabAkun('pendamping')} style={{ padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkun === 'pendamping' ? '#0000af' : '#f4f6f9', color: tabAkun === 'pendamping' ? 'white' : '#555', flex: '1 1 auto', textAlign: 'center', fontSize: '0.85rem' }}>👤 Akun Pendamping</button>
              </div>

              {tabAkun === 'kader' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setModeInputKader('baru')} style={{ padding: '8px 15px', fontSize: '0.75rem', fontWeight: 'bold', border: modeInputKader === 'baru' ? 'none' : '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: modeInputKader === 'baru' ? '#0000af' : '#fff', color: modeInputKader === 'baru' ? '#fff' : '#555', transition: '0.2s' }}>Buat Manual</button>
                      <button type="button" onClick={() => setModeInputKader('import')} style={{ padding: '8px 15px', fontSize: '0.75rem', fontWeight: 'bold', border: modeInputKader === 'import' ? 'none' : '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: modeInputKader === 'import' ? '#2ecc71' : '#fff', color: modeInputKader === 'import' ? '#fff' : '#555', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}>📗 Import Excel</button>
                      {modeInputKader === 'import' && (
                         <button type="button" onClick={handleDownloadTemplate} style={{ padding: '8px 15px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #3498db', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#eaf4fc', color: '#004a87', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}>⬇️ Download Template</button>
                      )}
                      <button onClick={handleBersihkanDataKaderLama} style={{ padding: '8px 15px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #e74c3c', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#fff', color: '#e74c3c', transition: '0.2s', marginLeft: 'auto' }}>🧹 Bersihkan Data Expired</button>
                    </div>

                    {modeInputKader === 'baru' ? (
                      <form onSubmit={handleBuatAkunKader} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'end' }}>
                        <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: '#777', fontStyle: 'italic', marginBottom: '5px' }}>Buat akun kader baru, atau hubungkan kader dari Rayon lain ke Rayon Anda.</div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>NIM Kader</label>
                          <input type="text" placeholder="NIM Kader" value={formKader.nim} onChange={e => setFormKader({...formKader, nim: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Lengkap</label>
                          <input type="text" placeholder="Nama Lengkap" value={formKader.nama} onChange={e => setFormKader({...formKader, nama: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Tahun Angkatan</label>
                          <input type="number" placeholder="Angkatan (Cth: 2026)" value={formKader.angkatan} onChange={e => setFormKader({...formKader, angkatan: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Asal Rayon</label>
                          <input 
                            list="data-rayon-list"
                            type="text" 
                            placeholder="-- Otomatis Rayon Ini / Ketik Rayon Luar --" 
                            value={formKader.asalRayon} 
                            onChange={e => setFormKader({...formKader, asalRayon: e.target.value})} 
                            style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} 
                          />
                          <datalist id="data-rayon-list">
                            {dataRayon.map((r: any) => <option key={r.id} value={r.nama}>{r.username}</option>)}
                          </datalist>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Pilih Pendamping MAPABA (Bisa lebih dari 1)</label>
                          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '6px', padding: '12px', backgroundColor: '#fafafa', marginTop: '5px' }}>
                            {dataPendamping.filter((p: any) => p.id_rayon === adminRayonId).map((p: any) => (
                              <label key={p.id} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.85rem', marginRight: '20px', marginBottom: '10px', cursor: 'pointer', color: '#333' }}>
                                <input 
                                  type="checkbox" 
                                  value={p.username}
                                  checked={formKader.pendamping_mapaba_id.includes(p.username)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if(e.target.checked) setFormKader(prev => ({...prev, pendamping_mapaba_id: [...prev.pendamping_mapaba_id, val]}));
                                    else setFormKader(prev => ({...prev, pendamping_mapaba_id: prev.pendamping_mapaba_id.filter(id => id !== val)}));
                                  }}
                                  style={{ marginRight: '8px', transform: 'scale(1.2)', accentColor: '#0000af' }}
                                />
                                {p.nama}
                              </label>
                            ))}
                            {dataPendamping.filter((p: any) => p.id_rayon === adminRayonId).length === 0 && <span style={{fontSize: '0.75rem', color: '#999'}}>Belum ada pendamping di Rayon Anda.</span>}
                          </div>
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                           <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Password Login</label>
                              <input type="text" placeholder="Password Login (Cth: 20042004)" value={formKader.password} onChange={e => setFormKader({...formKader, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                           </div>
                           <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', height: '40px' }}>
                             {isSubmitting ? 'Memproses...' : '+ Daftarkan Kader'}
                           </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#555', fontStyle: 'italic', marginBottom: '5px', backgroundColor: '#fff3e0', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #f39c12', lineHeight: '1.6' }}>
                          Format Kolom Excel (Baris Pertama Harus Persis):<br/>
                          <b>NIM | NIA | AsalRayon | Nama | Jenjang | Angkatan | TanggalLahir | Pendamping</b><br/><br/>
                          <span style={{color: '#c0392b'}}>
                            *Kolom <b>AsalRayon</b> diisi dengan nama rayon yang sesuai atau dikosongi untuk otomatis mengikuti rayon ini.<br/>
                            *Kolom <b>Jenjang</b> diisi: MAPABA / PKD / SIG / SKP.<br/>
                            *Kolom <b>Pendamping</b> bisa diisi lebih dari 1 dengan pemisah koma (Cth: Siti, Aisyah).<br/>
                            *Jika NIM sudah ada, status Jenjang dan Pendamping akan otomatis diperbarui tanpa menghapus histori nilainya.
                          </span>
                        </div>
                        <input type="file" accept=".xlsx, .xls" required style={{ padding: '10px', border: '2px dashed #2ecc71', borderRadius: '6px', backgroundColor: '#fcfcfc', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }} />
                        <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.9rem', width: '100%' }}>
                          🚀 Mulai Import Data
                        </button>
                        {importProgress && <div style={{fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold', textAlign: 'center'}}>{importProgress}</div>}
                      </form>
                    )}
                  </div>
                  
                  {/* TABEL DATA KADER (PAGINATED) */}
                  <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '0.95rem' }}>🔄 Tabel Data Kader</h4>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <select value={filterJenjangKader} onChange={(e) => setFilterJenjangKader(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <option value="">Semua Jenjang</option>
                          <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
                        </select>
                        <input type="text" placeholder="🔍 Cari NIM atau Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem', minWidth: '200px' }} />
                      </div>
                    </div>
                    
                    <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                      <table className="tabel-utama" style={{ minWidth: '950px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', color: '#333', textAlign: 'center' }}>
                            <th style={{ padding: '10px' }}>NIM / Tahun</th>
                            <th style={{ padding: '10px' }}>Nama Kader</th>
                            <th style={{ padding: '10px' }}>Asal Rayon</th>
                            <th style={{ padding: '10px' }}>Nomor NIA</th>
                            <th style={{ padding: '10px' }}>Jenjang</th>
                            <th style={{ padding: '10px' }}>Pendamping Saat Ini</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentKaderDisplay.length === 0 ? (<tr><td colSpan={8} style={{textAlign: 'center', padding: '30px', color: '#999'}}>Tidak ada data kader yang cocok.</td></tr>) : (
                            currentKaderDisplay.map((k: any) => {
                              const thnMasuk = k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear() : '-');
                              return (
                                <tr key={k.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#555', textAlign: 'center' }}>
                                    {k.nim} <br/> 
                                    <input 
                                      type="number" 
                                      placeholder="Tahun" 
                                      value={k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear() : '')} 
                                      onChange={(e) => handleUbahAngkatanKader(k.nim, e.target.value)} 
                                      style={{ padding: '2px 6px', border: '1px solid #ccc', borderRadius: '4px', width: '65px', fontSize: '0.75rem', outline: 'none', marginTop: '4px', fontWeight: 'bold', color: '#1e824c', textAlign: 'center' }}
                                    />
                                  </td>
                                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#333' }}>{k.nama}</td>
                                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e824c', textAlign: 'center', fontSize: '0.8rem' }}>{getNamaRayon(k.id_rayon)}</td>
                                  <td style={{ padding: '10px' }}>
                                    <input 
                                      type="text" 
                                      placeholder="Masukkan NIA" 
                                      value={k.nia || ''} 
                                      onChange={(e) => handleUbahNiaKader(k.nim, e.target.value)} 
                                      style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', maxWidth: '120px', fontSize: '0.75rem', outline: 'none' }}
                                    />
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#eaf4fc', fontWeight: 'bold', fontSize: '0.75rem', color: '#2c3e50' }}>{k.jenjang || "MAPABA"}</span>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', fontSize: '0.75rem' }}>
                                    <div style={{color: '#555', fontStyle: 'italic'}}>
                                      {k.jenjang === 'MAPABA' && getNamaPendamping(k.pendamping_mapaba_id)}
                                      {k.jenjang === 'PKD' && getNamaPendamping(k.pendamping_pkd_id)}
                                      {k.jenjang === 'SIG' && getNamaPendamping(k.pendamping_sig_id)}
                                      {k.jenjang === 'SKP' && getNamaPendamping(k.pendamping_skp_id)}
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <button onClick={() => handleUbahStatusAkun(k.id, k.status)} style={{ padding: '4px 6px', border: 'none', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: k.status === 'Aktif' ? '#e8f5e9' : '#ffebee', color: k.status === 'Aktif' ? '#2e7d32' : '#c62828' }}>{k.status === 'Aktif' ? '🟢 Aktif' : '🔴 Pasif'}</button>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                      <button onClick={() => {
                                        setEditKaderModal({
                                          oldNim: k.nim, id: k.id, nim: k.nim, nama: k.nama, nia: k.nia || '', angkatan: k.angkatan || '',
                                          tanggalLahir: k.tanggalLahir || '', id_rayon: k.id_rayon || '', jenjang: k.jenjang || 'MAPABA',
                                          riwayat_kaderisasi: k.riwayat_kaderisasi || { MAPABA: true, PKD: false, SIG: false, SKP: false },
                                          pendamping_mapaba_id: k.pendamping_mapaba_id || [],
                                          pendamping_pkd_id: k.pendamping_pkd_id || [],
                                          pendamping_sig_id: k.pendamping_sig_id || [],
                                          pendamping_skp_id: k.pendamping_skp_id || []
                                        });
                                      }} style={{ backgroundColor: '#f1c40f', color: '#333', border: 'none', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', transition: '0.2s' }}>✏️ Edit</button>
                                      <button onClick={() => handleHapusKaderTotal(k)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Total ke Akar">🗑️</button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* PAGINATION KADER */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                       <span style={{fontSize: '0.85rem', color: '#666', fontWeight: 'bold'}}>Halaman {kaderPage} dari {totalPagesKader || 1}</span>
                       <div style={{ display: 'flex', gap: '8px' }}>
                          <button disabled={kaderPage === 1} onClick={() => setKaderPage(kaderPage - 1)} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', cursor: kaderPage === 1 ? 'not-allowed' : 'pointer', background: '#fff', fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>⬅️ Sebelumnya</button>
                          <button disabled={kaderPage === totalPagesKader || totalPagesKader === 0} onClick={() => setKaderPage(kaderPage + 1)} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', cursor: kaderPage === totalPagesKader || totalPagesKader === 0 ? 'not-allowed' : 'pointer', background: '#fff', fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Selanjutnya ➡️</button>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB PENDAMPING */}
              {tabAkun === 'pendamping' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '25px', border: '1px solid #eaeaea', borderRadius: '10px' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px', fontSize: '0.9rem' }}>✏️ Buat Akun Pendamping Baru</h4>
                    <form onSubmit={handleBuatAkunPendamping} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px', alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Nama Lengkap Pendamping</label>
                        <input type="text" placeholder="Misal: Siti Aminah" value={formPendamping.nama} onChange={e => setFormPendamping({...formPendamping, nama: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Username Login <span style={{fontSize:'0.65rem', fontWeight:'normal'}}></span></label>
                        <input type="text" placeholder="Misal: siti_mapaba" value={formPendamping.username} onChange={e => setFormPendamping({...formPendamping, username: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Tugas Pendamping (Jenjang)</label>
                        <select required value={formPendamping.jenjangTugas} onChange={e => setFormPendamping({...formPendamping, jenjangTugas: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                          <option value="MAPABA">Tugas MAPABA</option><option value="PKD">Tugas PKD</option><option value="SIG">Tugas SIG</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Password Login</label>
                        <input type="text" placeholder="Masukkan Password" value={formPendamping.password} onChange={e => setFormPendamping({...formPendamping, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', marginTop: '5px', boxSizing: 'border-box', fontSize: '0.85rem', outline: 'none' }} />
                      </div>
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', width: '100%', height: '40px' }}>
                        {isSubmitting ? 'Memproses...' : '+ Daftarkan Pendamping'}
                      </button>
                    </form>
                  </div>

                  <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ margin: '0', color: '#0d1b2a', fontSize: '0.95rem' }}>📋 Tabel Data Pendamping</h4>
                      <input type="text" placeholder="🔍 Cari Nama/Username..." value={searchPendamping} onChange={(e) => setSearchPendamping(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem', minWidth: '200px' }} />
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                      <table className="tabel-utama" style={{ minWidth: '600px' }}>
                        <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#333', textAlign: 'left' }}><th style={{ padding: '10px' }}>Nama Pendamping</th><th style={{ padding: '10px' }}>Username</th><th style={{ padding: '10px' }}>Tugas Jenjang</th><th style={{ padding: '10px', textAlign: 'center' }}>Status</th><th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th></tr></thead>
                        <tbody>
                          {filteredPendamping.length === 0 ? (<tr><td colSpan={5} style={{textAlign: 'center', padding: '20px', color: '#999'}}>Tidak ada pendamping.</td></tr>) : (
                            filteredPendamping.map((p: any) => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.nama}</td><td style={{ padding: '10px' }}>{p.username}</td>
                                <td style={{ padding: '10px' }}>
                                  <select value={p.jenjangTugas || "MAPABA"} onChange={(e) => handleUbahJenjangPendamping(p.id, e.target.value)} style={{ padding: '4px', border: '1px solid #3498db', borderRadius: '4px', backgroundColor: '#eaf4fc', fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '120px', fontSize: '0.75rem', color: '#2c3e50' }}>
                                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option>
                                  </select>
                                </td>
                                <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => handleUbahStatusAkun(p.id, p.status || 'Aktif')} style={{ padding: '4px 8px', border: 'none', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!p.status || p.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!p.status || p.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>{(!p.status || p.status === 'Aktif') ? '🟢 Aktif' : '🔴 Pasif'}</button></td>
                                <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => handleHapusAkun(p.id, p.nama)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button></td>
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
          )}

          {/* MENU 6: KURIKULUM (EDIT UPDATE) */}
          {activeMenu === 'kurikulum' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '500px' }}>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => setTabKurikulum('MAPABA')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'MAPABA' ? '#0000af' : '#f4f6f9', color: tabKurikulum === 'MAPABA' ? 'white' : '#555', fontSize: '0.85rem' }}>📘 MAPABA</button>
                    <button onClick={() => setTabKurikulum('PKD')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'PKD' ? '#0000af' : '#f4f6f9', color: tabKurikulum === 'PKD' ? 'white' : '#555', fontSize: '0.85rem' }}>📙 PKD</button>
                    <button onClick={() => setTabKurikulum('SIG')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'SIG' ? '#0000af' : '#f4f6f9', color: tabKurikulum === 'SIG' ? 'white' : '#555', fontSize: '0.85rem' }}>📕 SIG</button>
                    <button onClick={() => setTabKurikulum('NONFORMAL')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'NONFORMAL' ? '#0000af' : '#f4f6f9', color: tabKurikulum === 'NONFORMAL' ? 'white' : '#555', fontSize: '0.85rem' }}>📗 Non-Formal</button>
                  </div>
                  <button onClick={() => setActiveModal('tambahMateriLokal')} style={{ backgroundColor: '#0000af', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>➕ Tambah Materi Lokal</button>
                </div>
                
                <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{backgroundColor: '#eef2f3', padding: '12px 15px', borderBottom: '1px solid #ddd'}}><h4 style={{margin: 0, color: '#0d1b2a', fontSize: '0.9rem'}}>Kurikulum Rayon Saat Ini ({tabKurikulum})</h4></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', minWidth: '450px' }}>
                    <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '40px' }}>No</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Kode</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Nama Materi & Muatan</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Bobot</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th></tr></thead>
                    <tbody>
                      {!listKurikulum[tabKurikulum] || listKurikulum[tabKurikulum].length === 0 ? (<tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Rayon belum memiliki kurikulum di jenjang ini.</td></tr>) : (
                        listKurikulum[tabKurikulum].map((materi, idx) => {
                          const isPusat = masterKurikulumPusat.some(mp => mp.kode === materi.kode);
                          const canEdit = materi.isLokal !== undefined ? materi.isLokal : !isPusat;

                          if (editingMateriId === materi.id) {
                             return (
                                <tr key={materi.id} style={{ borderBottom: '1px solid #eee', backgroundColor: '#fff9e6' }}>
                                  <td style={{ padding: '10px' }}>{idx + 1}</td>
                                  <td style={{ padding: '10px' }}>
                                    <input type="text" value={editMateriForm.kode} onChange={(e) => setEditMateriForm({...editMateriForm, kode: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}/>
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                    <input type="text" value={editMateriForm.nama} onChange={(e) => setEditMateriForm({...editMateriForm, nama: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '4px' }}/>
                                    <textarea value={editMateriForm.muatan} onChange={(e) => setEditMateriForm({...editMateriForm, muatan: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} rows={2}/>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <input type="number" value={editMateriForm.bobot} onChange={(e) => setEditMateriForm({...editMateriForm, bobot: Number(e.target.value)})} style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center' }}/>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                     <button onClick={() => handleSimpanEditMateri(materi.id)} style={{ color: 'white', backgroundColor: '#2ecc71', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Simpan</button>
                                     <button onClick={() => setEditingMateriId(null)} style={{ color: 'white', backgroundColor: '#95a5a6', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Batal</button>
                                  </td>
                                </tr>
                             )
                          }

                          return (
                            <tr key={materi.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px' }}>{idx + 1}</td><td style={{ padding: '10px', fontWeight: 'bold', color: '#004a87' }}>{materi.kode}</td>
                              <td style={{ padding: '10px' }}><div style={{color: '#333', fontWeight: 'bold'}}>{materi.nama}</div><div style={{color: '#777', fontSize: '0.7rem', whiteSpace: 'pre-wrap'}}>{materi.muatan || '-'}</div></td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{materi.bobot}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  {canEdit && (
                                     <button onClick={() => { setEditingMateriId(materi.id); setEditMateriForm({ kode: materi.kode, nama: materi.nama, muatan: materi.muatan || '', bobot: materi.bobot }); }} style={{ color: '#3498db', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button>
                                  )}
                                  <button onClick={() => handleHapusMateri(materi.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Hapus</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #eee' }}>
                  <h4 style={{ color: '#0d1b2a', margin: 0, padding: '15px', backgroundColor: '#fdfdfd', borderBottom: '1px solid #eee' }}>Kurikulum Standar MUSPIMNAS</h4>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', minWidth: '400px' }}>
                      <thead><tr style={{ backgroundColor: '#0d1b2a', color: 'white' }}><th style={{ padding: '8px', textAlign: 'center' }}>Kode</th><th style={{ padding: '8px', textAlign: 'center' }}>Nama Materi</th><th style={{ padding: '8px', textAlign: 'center' }}>Aksi</th></tr></thead>
                      <tbody>
                        {masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).length === 0 ? (<tr><td colSpan={3} style={{ textAlign: 'center', padding: '15px', color: '#999' }}>Pusat belum menetapkan standar materi ini.</td></tr>) : (
                          masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).map((materiPusat) => {
                            const currentList = listKurikulum[tabKurikulum] || []; const isAlreadyAdded = currentList.some(m => m.kode === materiPusat.kode || m.nama === materiPusat.nama);
                            return (
                              <tr key={materiPusat.id} style={{ borderBottom: '1px solid #eee', backgroundColor: isAlreadyAdded ? '#f9f9f9' : 'white' }}>
                                <td style={{ padding: '8px', fontWeight: 'bold', color: isAlreadyAdded ? '#000000' : '#333', textAlign: 'center' }}>{materiPusat.kode}</td>
                                <td style={{ padding: '8px' }}><div style={{fontWeight: 'bold', color: isAlreadyAdded ? '#000000' : '#333'}}>{materiPusat.nama}</div><div style={{fontSize: '0.7rem', color: '#888', whiteSpace: 'pre-wrap'}}>{materiPusat.muatan}</div></td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                  {isAlreadyAdded ? (<span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.75rem' }}>✅ Dipakai</span>) : (<button onClick={() => handleTarikMateriPusat(materiPusat)} disabled={isSavingKurikulum} style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem' }}>➕ Pakai</button>)}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MENU 7: PANTAU NILAI / RAPORT (FULL MATRIX UPDATED) */}
          {/* ========================================================= */}
          {activeMenu === 'pantau-nilai' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader:</span>
                  <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {dataKader.length === 0 && <option value="">Tidak ada kader</option>}
                    {dataKader.map(k => <option key={k.nim} value={k.nim}>{k.nama} ({k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear() : '-')})</option>)}
                  </select>
                  
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginLeft: '5px' }}>Jenjang:</span>
                  <select value={selectedJenjangNilai} onChange={(e) => setSelectedJenjangNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #2c3e50', borderRadius: '4px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', backgroundColor: '#eef2f3', color: '#2c3e50', fontSize: '0.85rem' }}>
                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="NONFORMAL">Non-Formal</option>
                  </select>
                  
                  {tabRaportAdmin === 'raport' && selectedKaderNilai && (
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>🖨️ Cetak KHS</button>
                  )}
                </div>
              </div>
              
              <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '0px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabRaportAdmin('raport')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'raport' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'raport' ? '#fff' : 'transparent', color: tabRaportAdmin === 'raport' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>Raport Kaderisasi</button>
                <button onClick={() => setTabRaportAdmin('persentase')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'persentase' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'persentase' ? '#fff' : 'transparent', color: tabRaportAdmin === 'persentase' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>Persentase & Nilai</button>
                <button onClick={() => setTabRaportAdmin('pengaturan')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'pengaturan' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'pengaturan' ? '#fff' : 'transparent', color: tabRaportAdmin === 'pengaturan' ? '#555' : '#e67e22', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', marginLeft: 'auto', fontSize: '0.85rem' }}>⚙️ Pengaturan Cetak</button>
              </div>

              {tabRaportAdmin === 'raport' && (
                <div style={{ width: '100%', overflowX: 'auto', padding: '5px 0 0px 0' }}>
                  <table className="tabel-utama" style={{ minWidth: '600px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '5%' }}>No</th><th style={{ width: '12%', textAlign: 'center' }}>Kode</th><th style={{ width: '53%', textAlign: 'center' }}>Nama Materi</th>
                        <th style={{ width: '8%' }}>SKS</th><th style={{ width: '8%' }}>Nilai Huruf</th><th style={{ width: '8%' }}>SKS x Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur oleh Pengurus Rayon.</td></tr>) : barisRaportRender}
                      <tr style={{ borderTop: '2px solid #ccc' }}>
                        <td colSpan={3} style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah SKS & Nilai</td>
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

              {tabRaportAdmin === 'persentase' && (
                <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
                  <div className="no-print" style={{ marginBottom: '15px', background: '#fdfdfd', padding: '15px', borderRadius: '6px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', color: '#0000af', fontSize: '0.9rem' }}>⚙️ Kategori & Bobot Penilaian</h4>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {kategoriBobotAktif.map((kat: any) => (
                          <div key={kat.id} style={{ backgroundColor: '#eaf4fc', padding: '5px 10px', borderRadius: '20px', border: '1px solid #3498db', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{kat.nama}: {kat.persen}%</span>
                            <button type="button" onClick={() => handleHapusKategoriBobot(kat.id)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>×</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: 'bold', color: totalBobotTersimpan === 100 ? '#27ae60' : '#e67e22' }}>
                        Total Bobot Saat Ini: {totalBobotTersimpan}% / 100%
                        {totalBobotTersimpan < 100 && <span style={{ fontStyle: 'italic', marginLeft: '5px', color: '#e74c3c' }}>(Harap lengkapi hingga 100% agar nilai akurat)</span>}
                      </div>
                    </div>
                    <button onClick={() => setActiveModal('tambahKategoriBobot')} style={{ background: '#0000af', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>➕ Tambah Kategori</button>
                  </div>

                  <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ width: '3%' }}>No</th>
                        <th rowSpan={2} style={{ width: '10%', textAlign: 'center' }}>Kode</th>
                        <th rowSpan={2} style={{ width: '25%', textAlign: 'center' }}>Nama Materi</th>
                        {kategoriBobotAktif.length > 0 && <th colSpan={kategoriBobotAktif.length} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f0fbf4' }}>Input Nilai Detail (0-100)</th>}
                        <th rowSpan={2} style={{ width: '5%' }}>SKS</th>
                        <th colSpan={2} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#eaf4fc' }}>Hasil Akhir</th>
                        <th rowSpan={2} style={{ width: '8%' }}>SKS x Nilai Huruf</th>
                      </tr>
                      <tr>
                        {kategoriBobotAktif.map((kat: any) => (
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
                        <tr><td colSpan={7 + kategoriBobotAktif.length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi untuk jenjang ini.</td></tr>
                      ) : (
                        materiAktif.map((materi, index) => {
                          let angkaAkhir = 0;
                          kategoriBobotAktif.forEach((kat: any) => {
                              const score = nilaiMentah[materi.kode]?.[kat.nama] || 0;
                              angkaAkhir += (score * (kat.persen / 100));
                          });

                          const hurufAkhir = getNilaiHuruf(angkaAkhir);
                          const angkaNilaiSks = konversiHurufKeAngka(hurufAkhir);
                          const sksKaliNilai = (materi.bobot || 0) * angkaNilaiSks;

                          return (
                            <tr key={`rinci-${materi.kode}`}>
                              <td>{index + 1}</td><td style={{ textAlign: 'left' }}>{materi.kode}</td><td style={{ textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
                              
                              {kategoriBobotAktif.map((kat: any) => (
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
                        <td colSpan={3 + kategoriBobotAktif.length} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah SKS & Nilai</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                        <td colSpan={2}></td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                      </tr>
                      <tr>
                        <td colSpan={4 + kategoriBobotAktif.length} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kader)</td>
                        <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1.1rem' }}>{ipKader}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="no-print" style={{ marginTop: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#1e824c' }}>Catatan Khusus dari Pendamping/Rayon:</label>
                    <textarea value={evaluasiKader.catatan} onChange={e => handleSimpanCatatan(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', height: '60px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box' }} placeholder="Tulis catatan perkembangan kader disini..." />
                  </div>
                </div>
              )}

              {/* TAB PENGATURAN KOP CETAK */}
              {tabRaportAdmin === 'pengaturan' && (
                <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}>
                  <form onSubmit={handleSimpanPengaturanCetak} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
                    <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px', borderLeft: '4px solid #f1c40f', fontSize: '0.8rem', color: '#856404', lineHeight: '1.4' }}><b>PENTING:</b> Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan TANDA TANGAN di bagian bawah. Gambar ini akan menjadi background pada saat cetak PDF.</div>
                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#333', fontSize: '0.85rem' }}>Upload Template Background A4</label>
                      {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '10px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px' }} />}
                      <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #ccc', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
                    </div>
                    <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#0000af', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* MENU 8: MANAJEMEN TES PEMAHAMAN */}
          {activeMenu === 'manajemen-tes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedTesHasil ? (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', padding: '20px' }}>
                  <button className="no-print" onClick={() => setSelectedTesHasil(null)} style={{ marginBottom: '15px', padding: '6px 12px', backgroundColor: '#f1c40f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>⬅️ Kembali</button>
                  <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ color: '#1e824c', margin: '0 0 10px 0', fontSize: '1.1rem' }}>Data Hasil: {selectedTesHasil.judul} ({selectedTesHasil.jenjang})</h3>
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>🖨️ Cetak Semua Hasil</button>
                  </div>
                  
                  {/* TAMPILAN WEB (BISA DI KLIK/TOGGLE) */}
                  <div className="no-print" style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <table className="tabel-utama" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '800px' }}>
                      <thead><tr style={{ backgroundColor: '#f8f9fa' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '15%' }}>Waktu Submit</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '15%' }}>NIM</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '25%' }}>Nama Kader</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '45%' }}>Jawaban Kader</th></tr></thead>
                      <tbody>
                        {jawabanTesViewer.length === 0 ? (<tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada jawaban terkumpul.</td></tr>) : (
                          jawabanTesViewer.map((jawab: any) => (
                            <tr key={jawab.nim} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px', verticalAlign: 'top' }}>{jawab.tanggal}</td><td style={{ padding: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nim}</td><td style={{ padding: '10px', color: '#004a87', fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nama}</td>
                              <td style={{ padding: '10px', verticalAlign: 'top' }}>
                                <details style={{ cursor: 'pointer' }}>
                                  <summary style={{ color: '#27ae60', fontWeight: 'bold', outline: 'none' }}>Tampilkan Jawaban</summary>
                                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '4px' }}>
                                    {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (<div key={i} style={{ marginBottom: '10px' }}><div style={{ fontWeight: 'bold', color: '#333' }}>Q: {soal}</div><div style={{ color: '#555', fontStyle: 'italic', paddingLeft: '10px', borderLeft: '3px solid #3498db', marginTop: '4px', whiteSpace: 'pre-wrap' }}>A: {jawab.jawaban[i] || '- Kosong -'}</div></div>))}
                                  </div>
                                </details>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* TAMPILAN KHUSUS PRINT (BLOK PER KADER) */}
                  <div className="print-only-container" style={{ display: 'none' }}>
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
                </div>
              ) : (
                <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                  <div style={{ padding: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '0.95rem' }}>Daftar Tes Rayon</h4>
                    <button onClick={() => setActiveModal('tambahTes')} style={{ backgroundColor: '#0000af', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>➕ Buat Tes Baru</button>
                  </div>
                  
                  {/* TABEL MASTER TES PUSAT DARI KOMISARIAT */}
                  <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #eee' }}>
                    <h4 style={{ color: '#0d1b2a', margin: 0, padding: '15px', backgroundColor: '#fdfdfd', borderBottom: '1px solid #eee' }}>📥 Bank Soal / Tes Standar Komisariat</h4>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', minWidth: '400px' }}>
                        <thead><tr style={{ backgroundColor: '#0d1b2a', color: 'white' }}><th style={{ padding: '8px', textAlign: 'center' }}>Judul & Jenjang</th><th style={{ padding: '8px', textAlign: 'center' }}>Soal</th><th style={{ padding: '8px', textAlign: 'center' }}>Aksi</th></tr></thead>
                        <tbody>
                          {masterTesPusat.length === 0 ? (<tr><td colSpan={3} style={{ textAlign: 'center', padding: '15px', color: '#999' }}>Komisariat belum menetapkan standar tes.</td></tr>) : (
                            masterTesPusat.sort((a,b) => a.jenjang.localeCompare(b.jenjang)).map((tesPusat) => {
                              const isAlreadyAdded = listTes.some(t => t.judul === tesPusat.judul && t.jenjang === tesPusat.jenjang);
                              return (
                                <tr key={tesPusat.id} style={{ borderBottom: '1px solid #eee', backgroundColor: isAlreadyAdded ? '#f9f9f9' : 'white' }}>
                                  <td style={{ padding: '8px' }}>
                                    <div style={{fontWeight: 'bold', color: isAlreadyAdded ? '#000' : '#333'}}>{tesPusat.judul}</div>
                                    <div style={{fontSize: '0.7rem', color: '#888'}}>Sasaran: {tesPusat.jenjang}</div>
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center' }}>
                                    <details style={{ cursor: 'pointer', outline: 'none', display: 'inline-block', textAlign: 'left' }}>
                                      <summary style={{ fontSize: '0.75rem', color: '#3498db', fontWeight: 'bold' }}>Lihat {tesPusat.daftar_soal?.length || 0} Soal</summary>
                                      <ol style={{ fontSize: '0.7rem', color: '#555', paddingLeft: '15px', margin: '5px 0 0 0', textAlign: 'left' }}>
                                        {(tesPusat.daftar_soal || []).map((s: string, i: number) => <li key={i} style={{ marginBottom: '2px' }}>{s}</li>)}
                                      </ol>
                                    </details>
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center' }}>
                                    {isAlreadyAdded ? (<span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.75rem' }}>✅ Ditarik</span>) : (<button onClick={() => handleTarikTesPusat(tesPusat)} style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem' }}>➕ Tarik</button>)}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '600px' }}>
                      <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Judul & Jenjang</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Soal</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Status</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th></tr></thead>
                      <tbody>
                        {listTes.length === 0 ? (<tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada tes pemahaman.</td></tr>) : (
                          listTes.map((tes) => (
                            <tr key={tes.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px' }}><div style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{tes.judul}</div><div style={{ fontSize: '0.7rem', color: '#888' }}>Sasaran: {tes.jenjang}</div></td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#e67e22' }}>{tes.daftar_soal?.length || 0}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => handleToggleStatusTes(tes.id, tes.status)} style={{ padding: '4px 8px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: tes.status === 'Buka' ? '#e8f5e9' : '#ffebee', color: tes.status === 'Buka' ? '#2e7d32' : '#c62828' }}>{tes.status === 'Buka' ? '🔓 Dibuka' : '🔒 Ditutup'}</button></td>
                              <td style={{ padding: '10px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                <button onClick={() => handleLihatHasilTes(tes)} style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Hasil</button>
                                <button onClick={() => handleHapusTes(tes.id)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Hapus</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MENU 9: MASTER TUGAS */}
          {activeMenu === 'master-tugas' && (
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                <div style={{ padding: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#1e824c', fontSize: '0.95rem' }}>Daftar Tugas Rayon</h4>
                  <button onClick={() => setActiveModal('tambahTugas')} style={{ backgroundColor: '#0000af', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>➕ Tambah Tugas</button>
                </div>
                <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
                    <thead><tr style={{ backgroundColor: '#f8f9fa' }}><th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Nama Tugas</th><th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Deadline</th><th style={{ padding: '15px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th></tr></thead>
                    <tbody>
                      {listMasterTugas.length === 0 ? (<tr><td colSpan={3} style={{textAlign: 'center', padding: '20px'}}>Belum ada tugas.</td></tr>) : listMasterTugas.map((tugas) => (
                        <tr key={tugas.id} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '15px', fontWeight: 'bold', color: '#0d1b2a' }}>{tugas.nama_tugas}</td><td style={{ padding: '15px', color: '#e74c3c', fontWeight: 'bold' }}>{tugas.deadline}</td><td style={{ padding: '15px', textAlign: 'center' }}><button onClick={() => handleHapusTugas(tugas.id)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Hapus</button></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU 10: KELOLA PERPUSTAKAAN */}
          {activeMenu === 'perpus' && (
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#0d1b2a', fontSize: '1rem' }}>Materi Perpustakaan</h4>
                <button onClick={() => setActiveModal('tambahPerpus')} style={{ backgroundColor: '#0000af', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>📤 Upload Materi</button>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                {Object.keys(groupedPerpus).length === 0 ? (<div style={{ textAlign: 'center', padding: '30px', color: '#999', border: '1px dashed #ccc', borderRadius: '8px' }}>Perpustakaan kosong.</div>) : (
                  Object.keys(groupedPerpus).map(folderName => (
                    <div key={folderName} style={{ marginBottom: '20px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ backgroundColor: '#1e824c', color: 'white', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📁 {folderName}
                      </div>
                      <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {groupedPerpus[folderName].map((item: any) => (
                           <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '8px', flexWrap: 'wrap', gap: '5px' }}>
                             <span style={{ fontSize: '0.85rem', color: '#333' }}>{item.nama_file}</span>
                             <a href={item.link_file} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#f1c40f', color: '#333', padding: '4px 8px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.75rem', border: '1px solid #d4ac0d' }}>
                               Buka
                             </a>
                           </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ================================================================================ */}
      {/* STRUKTUR POP-UP MODAL UNTUK FORM ISIAN (DITEKAN DARI TOMBOL +)                   */}
      {/* ================================================================================ */}
      {activeModal && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '8px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            
            <button onClick={() => setActiveModal(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#eee', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1rem', cursor: 'pointer', color: '#555' }}>✖</button>

            {/* Modal: Tambah Materi Lokal */}
            {activeModal === 'tambahMateriLokal' && (
              <div>
                <h4 style={{ marginTop: 0, color: '#1e824c', borderBottom: '1px dashed #a5d6a7', paddingBottom: '8px', fontSize: '0.9rem' }}>📝 Tambah Materi Lokal/Lainnya</h4>
                <form onSubmit={handleTambahMateriLokal} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <input type="text" placeholder="Kode (Misal: LOKAL-01)" required value={formMateri.kode} onChange={(e) => setFormMateri({...formMateri, kode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                  <input type="text" placeholder="Nama Materi Lokal" required value={formMateri.nama} onChange={(e) => setFormMateri({...formMateri, nama: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                  <textarea rows={2} placeholder="Muatan / Pembahasan (Opsional)" value={formMateri.muatan} onChange={(e) => setFormMateri({...formMateri, muatan: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                  <input type="number" placeholder="Bobot SKS/Jam (1 SKS = 30 Mnt)" required value={formMateri.bobot} onChange={(e) => setFormMateri({...formMateri, bobot: Number(e.target.value)})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                  <button disabled={isSavingKurikulum} type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Tambahkan Lokal</button>
                </form>
              </div>
            )}

            {/* Modal: Tambah Kategori Bobot (Matriks) */}
            {activeModal === 'tambahKategoriBobot' && (
              <div>
                <h4 style={{ margin: '0 0 15px 0', color: '#0d1b2a', fontSize: '1rem', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>⚙️ Tambah Kategori Penilaian</h4>
                <form onSubmit={handleTambahKategoriBobot} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <input type="text" required placeholder="Nama Kategori (Cth: Pre-Test)" value={formKategori.nama} onChange={e => setFormKategori({...formKategori, nama: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Bobot Penilaian (%)</label>
                    <input type="number" required placeholder="Bobot %" value={formKategori.persen || ''} onChange={e => setFormKategori({...formKategori, persen: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', marginTop: '5px', boxSizing: 'border-box' }} />
                  </div>
                  <button type="submit" disabled={isSavingEvaluasi || !selectedKaderNilai || totalBobotTersimpan >= 100} style={{ background: (totalBobotTersimpan >= 100 || !selectedKaderNilai) ? '#ccc' : '#0000af', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: (totalBobotTersimpan >= 100 || !selectedKaderNilai) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>➕ Tambah Kategori</button>
                </form>
                {totalBobotTersimpan >= 100 && <p style={{fontSize: '0.75rem', color: '#e74c3c', marginTop: '10px'}}>Total bobot sudah 100%, Anda tidak bisa menambah kategori baru sebelum menghapus yang lama.</p>}
              </div>
            )}

            {/* Modal: Tambah Tugas */}
            {activeModal === 'tambahTugas' && (
              <div>
                <h4 style={{marginTop: 0, marginBottom: '15px', color: '#0000af', borderBottom: '1px dashed #ccc', paddingBottom: '8px'}}>➕ Tambah Tugas Kader</h4>
                <form onSubmit={handleTambahTugas} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="text" placeholder="Nama Tugas (Misal: Resume NDP)" required value={formTugas.nama_tugas} onChange={(e) => setFormTugas({...formTugas, nama_tugas: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                  <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Batas Waktu (Deadline)</label><input type="date" required value={formTugas.deadline} onChange={(e) => setFormTugas({...formTugas, deadline: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px', fontSize: '0.85rem', boxSizing: 'border-box' }} /></div>
                  <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Buat Tugas Baru</button>
                </form>
              </div>
            )}

            {/* Modal: Tambah Perpus */}
            {activeModal === 'tambahPerpus' && (
              <div>
                <h4 style={{marginTop: 0, marginBottom: '15px', color: '#0000af', borderBottom: '1px dashed #ccc', paddingBottom: '8px'}}>📤 Upload Materi Perpus</h4>
                <form onSubmit={handleTambahPerpus} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="text" placeholder="Nama Folder (Cth: Modul MAPABA)" required value={formPerpus.folder} onChange={(e) => setFormPerpus({...formPerpus, folder: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                  <input type="text" placeholder="Judul Buku/Materi" required value={formPerpus.nama_file} onChange={(e) => setFormPerpus({...formPerpus, nama_file: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                  <input type="file" required accept=".pdf,.doc,.docx" onChange={(e) => setFilePerpus(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #ccc', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.8rem' }} />
                  <button disabled={isUploadingPerpus} type="submit" style={{ backgroundColor: isUploadingPerpus ? '#95a5a6' : '#0000af', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isUploadingPerpus ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>{isUploadingPerpus ? 'Mengupload...' : 'Upload ke Perpus'}</button>
                </form>
              </div>
            )}

            {/* Modal: Buat Tes */}
            {activeModal === 'tambahTes' && (
              <div>
                <h4 style={{ color: '#1e824c', margin: '0 0 15px 0', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>📝 Buat Tes Baru</h4>
                <form onSubmit={handleBuatTes} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="text" placeholder="Judul Tes (Cth: Pre-Test Aswaja)" required value={formTes.judul} onChange={(e) => setFormTes({...formTes, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                  <select required value={formTes.jenjang} onChange={(e) => setFormTes({...formTes, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="NONFORMAL">Non-Formal</option><option value="Umum">Umum (Semua)</option>
                  </select>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#e67e22', marginBottom: '5px' }}>*Tekan Enter (baris baru) untuk memisahkan pertanyaan.</div>
                    <textarea rows={5} required value={formTes.soal} onChange={(e) => setFormTes({...formTes, soal: e.target.value})} placeholder="1. Apa tujuan PMII?&#10;2. Jelaskan makna logo!" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                  </div>
                  <button type="submit" style={{ backgroundColor: '#0000af', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Buat Tes</button>
                </form>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ================================================================================ */}
      {/* STRUKTUR HIDDEN HTML KHUSUS UNTUK PRINT PDF DENGAN BACKGROUND GAMBAR A4 */}
      {/* ================================================================================ */}
      <div id="hidden-print-container" className="print-layout-container">
        
        {/* Gambar Background A4 dari Admin Rayon */}
        {pengaturanCetak?.kopSuratUrl && (
          <div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>
        )}

        {/* TRICK MASTER TABLE AGAR MARGIN REPEAT DI SETIAP HALAMAN */}
        <table className="master-print-table">
          <thead>
            <tr>
              <td>
                {/* Spacer Atas (Memberi ruang untuk KOP Surat di setiap halaman) */}
                <div className="header-space"></div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {/* Pembungkus Konten Tabel */}
                <div className="print-content-area">
                  
                  {/* CETAK KHS RAPORT ADMIN */}
                  {activeMenu === 'pantau-nilai' && tabRaportAdmin === 'raport' && (
                    <div>
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI</h3>
                      <table className="tabel-biodata">
                        <tbody>
                          <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak?.nim || '...........................'}</td></tr>
                          <tr><td>Nomor Induk Anggota</td><td>:</td><td>{kaderDicetak?.nia || '...........................'}</td></tr>
                          <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak?.nama || '...........................'}</td></tr>
                          <tr><td>Nama Rayon Pelaksana</td><td>:</td><td>{namaRayonAsli || '...........................'}</td></tr>
                          <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak?.angkatan || (kaderDicetak?.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................')}</td></tr>
                          <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{selectedJenjangNilai}</td></tr>
                        </tbody>
                      </table>

                      <table className="tabel-utama">
                        <thead>
                          <tr>
                            <th style={{ width: '5%' }}>No</th>
                            <th style={{ width: '12%', textAlign: 'center' }}>Kode</th>
                            <th style={{ width: '53%', textAlign: 'center' }}>Nama Materi</th>
                            <th style={{ width: '10%' }}>SKS</th>
                            <th style={{ width: '10%' }}>Nilai</th>
                            <th style={{ width: '10%' }}>SKS x Nilai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materiAktif.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur.</td></tr>
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

                  {/* CETAK HASIL TES PEMAHAMAN KADER OLEH ADMIN */}
                  {activeMenu === 'manajemen-tes' && selectedTesHasil && (
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
                                <tr><td style={{width: '150px'}}>Nama Kader</td><td style={{width: '15px'}}>:</td><td style={{fontWeight: 'bold'}}>{jawab.nama}</td></tr>
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
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                {/* Spacer Bawah (Memberi ruang untuk Tanda Tangan/Footer di setiap halaman) */}
                <div className="footer-space"></div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}