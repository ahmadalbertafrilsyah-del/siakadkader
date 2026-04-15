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
  
  const [adminRayonId, setAdminRayonId] = useState(''); 
  const [namaRayonAsli, setNamaRayonAsli] = useState(''); 

  // --- STATE PENGATURAN KOP SURAT ---
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });
  const [fileKop, setFileKop] = useState<File | null>(null);
  const [fileFooter, setFileFooter] = useState<File | null>(null);
  const [isSavingPengaturan, setIsSavingPengaturan] = useState(false);

  // --- STATE SURAT ---
  const [suratMasuk, setSuratMasuk] = useState<any[]>([]);
  const [fileSuratBalasan, setFileSuratBalasan] = useState<Record<string, File | null>>({}); 
  const [isUploadingSurat, setIsUploadingSurat] = useState(false);
  const [listJenisSurat, setListJenisSurat] = useState<any[]>([]);
  const [newJenisSurat, setNewJenisSurat] = useState('');
  const [newSyaratSurat, setNewSyaratSurat] = useState(''); 
  const [isSavingJenisSurat, setIsSavingJenisSurat] = useState(false);

  // --- STATE MANAJEMEN AKUN ---
  const [dataPendamping, setDataPendamping] = useState<any[]>([]);
  const [dataKader, setDataKader] = useState<any[]>([]);
  const [tabAkun, setTabAkun] = useState('kader'); 
  const [formKader, setFormKader] = useState({ nim: '', nia: '', nama: '', password: '', pendampingId: '' });
  const [formPendamping, setFormPendamping] = useState({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState(''); 
  
  const [searchKader, setSearchKader] = useState('');
  const [filterJenjangKader, setFilterJenjangKader] = useState('');
  const [searchPendamping, setSearchPendamping] = useState('');

  const currentYear = new Date().getFullYear();
  const [filterTahunBeranda, setFilterTahunBeranda] = useState<string>(currentYear.toString());

  // --- STATE MASTER KURIKULUM & EDIT LOKAL ---
  const [tabKurikulum, setTabKurikulum] = useState('MAPABA');
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], SIG: [], SKP: [], NONFORMAL: [] });
  const [formMateri, setFormMateri] = useState({ kode: '', nama: '', muatan: '', bobot: 3 });
  const [isSavingKurikulum, setIsSavingKurikulum] = useState(false);
  const [masterKurikulumPusat, setMasterKurikulumPusat] = useState<any[]>([]); 
  
  // STATE UNTUK EDIT MATERI 
  const [editingMateriId, setEditingMateriId] = useState<string | null>(null);
  const [editMateriForm, setEditMateriForm] = useState({ kode: '', nama: '', muatan: '', bobot: 0 });

  // --- STATE NILAI KHS & RAPORT ---
  const [selectedKaderNilai, setSelectedKaderNilai] = useState('');
  const [selectedJenjangNilai, setSelectedJenjangNilai] = useState('MAPABA');
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 
  const [evaluasiKader, setEvaluasiKader] = useState<{ catatan: string }>({ catatan: '' });
  const [tabRaportAdmin, setTabRaportAdmin] = useState('raport'); 
  
  // STATE PENILAIAN MATRIKS DETAIL
  const [kategoriBobot, setKategoriBobot] = useState<{id: string, nama: string, persen: number}[]>([]);
  const [nilaiMentah, setNilaiMentah] = useState<Record<string, Record<string, number>>>({});
  const [formKategori, setFormKategori] = useState({ nama: '', persen: 0 });
  const [isSavingEvaluasi, setIsSavingEvaluasi] = useState(false);

  // --- STATE TUGAS, PERPUS, SARAN ---
  const [saranMasuk, setSaranMasuk] = useState<any[]>([]);
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [formTugas, setFormTugas] = useState({ nama_tugas: '', deadline: '' });
  const [listPerpus, setListPerpus] = useState<any[]>([]);
  const [formPerpus, setFormPerpus] = useState({ folder: '', nama_file: '' });
  const [filePerpus, setFilePerpus] = useState<File | null>(null);
  const [isUploadingPerpus, setIsUploadingPerpus] = useState(false);

  // --- STATE TES PEMAHAMAN ---
  const [listTes, setListTes] = useState<any[]>([]);
  const [riwayatTes, setRiwayatTes] = useState<any[]>([]);
  const [selectedTesId, setSelectedTesId] = useState('');
  const [jawabanTesViewer, setJawabanTesViewer] = useState<any[]>([]);
  const [selectedTesHasil, setSelectedTesHasil] = useState<any>(null);
  const [formTes, setFormTes] = useState({ judul: '', jenjang: 'MAPABA', soal: '' });

  const materiAktif = listKurikulum[selectedJenjangNilai] || [];

  // ==========================================
  // API HELPER: FUNGSI UPLOAD CLOUDINARY
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

            if (userData.role !== 'rayon') {
              alert(`Akses Ditolak!`);
              signOut(auth);
              router.push('/');
              return;
            }

            const currentRayonId = userData.username; 
            setAdminRayonId(currentRayonId);
            
            onSnapshot(doc(db, "users", currentRayonId), (rayonSnap) => {
              if (rayonSnap.exists()) {
                const rData = rayonSnap.data();
                setNamaRayonAsli(rData.nama || currentRayonId);
                setPengaturanCetak({ kopSuratUrl: rData.kopSuratUrl || '', footerUrl: rData.footerUrl || '' });
              }
            });
            
            onSnapshot(query(collection(db, "users"), where("role", "==", "pendamping"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setDataPendamping(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            onSnapshot(query(collection(db, "users"), where("role", "==", "kader"), where("id_rayon", "==", currentRayonId)), (snap) => {
              const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setDataKader(list);
              if(list.length > 0 && !selectedKaderNilai) setSelectedKaderNilai((list[0] as any).nim);
            });

            onSnapshot(query(collection(db, "pengajuan_surat"), orderBy("timestamp", "desc")), (snap) => {
              setSuratMasuk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
            });

            onSnapshot(query(collection(db, "master_jenis_surat"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setListJenisSurat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            onSnapshot(doc(db, "kurikulum_rayon", currentRayonId), (docSnap) => {
              if (docSnap.exists()) setListKurikulum(docSnap.data() as Record<string, any[]>);
            });

            onSnapshot(collection(db, "master_kurikulum_pusat"), (snap) => {
              setMasterKurikulumPusat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            onSnapshot(query(collection(db, "saran_aspirasi"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setSaranMasuk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
            });

            onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setListMasterTugas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
            });

            onSnapshot(query(collection(db, "perpustakaan"), where("id_rayon", "==", currentRayonId)), (snap) => {
              setListPerpus(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
            });

            onSnapshot(query(collection(db, "master_tes"), where("id_rayon", "==", currentRayonId)), (snap) => {
              const tesList: any[] = [];
              snap.forEach((doc) => tesList.push({ id: doc.id, ...doc.data() }));
              setListTes(tesList);
            });

            onSnapshot(query(collection(db, "jawaban_tes"), where("id_rayon", "==", currentRayonId)), (snap) => {
              const riwayat: any[] = [];
              snap.forEach((doc) => riwayat.push({ id: doc.id, ...doc.data() }));
              setRiwayatTes(riwayat);
            });
          }
        });
      } else {
        router.push('/');
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // ==========================================
  // EFEK 2: PANTAU NILAI KADER (REAL-TIME MATRIKS)
  // ==========================================
  useEffect(() => {
    if (!selectedKaderNilai) return;
    
    const unsubscribeNilai = onSnapshot(doc(db, "nilai_khs", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data());
      else setNilaiKaderRealtime({});
    });

    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists() && docSnap.data()[selectedJenjangNilai]) {
        const data = docSnap.data()[selectedJenjangNilai];
        setKategoriBobot(data.bobot || []);
        setNilaiMentah(data.nilai_mentah || {});
        setEvaluasiKader({ catatan: data.catatan || '' });
      } else {
        setKategoriBobot([]);
        setNilaiMentah({});
        setEvaluasiKader({ catatan: '' });
      }
    });

    return () => { unsubscribeNilai(); unsubscribeKeaktifan(); };
  }, [selectedKaderNilai, selectedJenjangNilai]);

  const dataKaderDifilterTahun = dataKader.filter(k => {
    if (filterTahunBeranda === 'Semua') return true;
    if (!k.createdAt) return false; 
    const tahunKader = new Date(k.createdAt).getFullYear().toString();
    return tahunKader === filterTahunBeranda;
  });

  const daftarTahunUnik = ['Semua'];
  for (let i = 0; i < 3; i++) {
    daftarTahunUnik.push((currentYear - i).toString());
  }

  // ==========================================
  // LOGIKA PERHITUNGAN RAPORT KHS
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
    const sksKaliNilai = materi.bobot * angkaNilai;
    
    totalSks += materi.bobot;
    if (nilaiHuruf !== "-") totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode}>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{index + 1}</td>
        <td style={{ padding: '6px 10px', textAlign: 'left' }}>{materi.kode}</td>
        <td style={{ padding: '6px 10px', textAlign: 'left' }}>{materi.nama}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#555' }}>
           {nilaiHuruf}
        </td>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });

  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";
  const kaderDicetak = dataKader.find(k => k.nim === selectedKaderNilai) || {};
  const totalBobotTersimpan = kategoriBobot.reduce((sum, k) => sum + k.persen, 0);

  // ==========================================
  // FUNGSI PENILAIAN MATRIKS DETAIL
  // ==========================================
  const handleTambahKategoriBobot = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!selectedKaderNilai || !formKategori.nama) return;
    if(totalBobotTersimpan + formKategori.persen > 100) return alert("Total bobot tidak boleh melebihi 100%!");
    
    setIsSavingEvaluasi(true);
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { bobot: [], nilai_mentah: {}, catatan: '' };
      const newBobot = [...(jenjangData.bobot || []), { id: Date.now().toString(), nama: formKategori.nama, persen: formKategori.persen }];
      
      await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { 
        ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, bobot: newBobot } 
      }, { merge: true });
      setFormKategori({ nama: '', persen: 0 });
    } catch (error) { alert("Gagal menyimpan kategori bobot."); } finally { setIsSavingEvaluasi(false); }
  };

  const handleHapusKategoriBobot = async (id: string) => {
    if(!window.confirm("Hapus kategori bobot ini?")) return;
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data();
      const jenjangData = currentEvaluasi[selectedJenjangNilai];
      const newBobot = jenjangData.bobot.filter((item: any) => item.id !== id);
      
      await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { 
        ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, bobot: newBobot } 
      }, { merge: true });
    } catch (error) { alert("Gagal menghapus."); }
  };

  const handleInputNilaiMentah = (kodeMateri: string, namaKategori: string, value: string) => {
    let valNum = Number(value); if (valNum > 100) valNum = 100; if (valNum < 0) valNum = 0;
    const updatedNilai = { ...nilaiMentah, [kodeMateri]: { ...(nilaiMentah[kodeMateri] || {}), [namaKategori]: valNum } };
    setNilaiMentah(updatedNilai);
  };

  const handleAutoSaveNilaiDetail = async (kodeMateri: string) => {
    if (!selectedKaderNilai) return;
    try {
      const docRef = doc(db, "evaluasi_kader", selectedKaderNilai);
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { bobot: kategoriBobot, nilai_mentah: {}, catatan: evaluasiKader.catatan };
      
      await setDoc(docRef, { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, nilai_mentah: nilaiMentah } }, { merge: true });

      let angkaAkhir = 0;
      kategoriBobot.forEach(kat => {
          const score = nilaiMentah[kodeMateri]?.[kat.nama] || 0;
          angkaAkhir += score * (kat.persen / 100);
      });

      const hurufAkhir = getNilaiHuruf(angkaAkhir);
      await setDoc(doc(db, "nilai_khs", selectedKaderNilai), { 
        [kodeMateri]: hurufAkhir, terakhirDiubah: Date.now(), diubahOleh: "Admin Rayon" 
      }, { merge: true });

    } catch (error) { console.error("Gagal auto-save nilai", error); }
  };

  const handleSimpanCatatan = async (text: string) => {
    setEvaluasiKader({ ...evaluasiKader, catatan: text });
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { bobot: [], nilai_mentah: {}, catatan: '' };
      await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, catatan: text } }, { merge: true });
    } catch (error) { console.error(error); }
  };

  // ==========================================
  // FUNGSI LAINNYA
  // ==========================================
  const handleSimpanPengaturanCetak = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingPengaturan(true);
    try {
      let newKop = pengaturanCetak.kopSuratUrl; let newFooter = pengaturanCetak.footerUrl;
      if (fileKop) newKop = await uploadToCloudinary(fileKop);
      if (fileFooter) newFooter = await uploadToCloudinary(fileFooter);
      await updateDoc(doc(db, "users", adminRayonId), { kopSuratUrl: newKop, footerUrl: newFooter });
      alert("Pengaturan Kop & Footer berhasil disimpan!"); setFileKop(null); setFileFooter(null);
    } catch (error) { alert("Gagal menyimpan."); } finally { setIsSavingPengaturan(false); }
  };

  const handleBuatTes = async (e: React.FormEvent) => {
    e.preventDefault(); if (!formTes.judul || !formTes.soal) return;
    const daftarSoalArray = formTes.soal.split('\n').filter(s => s.trim() !== '');
    try {
      await addDoc(collection(db, "master_tes"), { id_rayon: adminRayonId, judul: formTes.judul, jenjang: formTes.jenjang, daftar_soal: daftarSoalArray, status: 'Tutup', timestamp: Date.now() });
      alert("Tes berhasil dibuat!"); setFormTes({ judul: '', jenjang: 'MAPABA', soal: '' });
    } catch (error) { alert("Gagal."); }
  };

  const handleToggleStatusTes = async (idTes: string, statusSaatIni: string) => {
    const statusAkanDatang = statusSaatIni === 'Buka' ? 'Tutup' : 'Buka';
    if (!window.confirm(`Ubah status tes menjadi: ${statusAkanDatang}?`)) return;
    try { await updateDoc(doc(db, "master_tes", idTes), { status: statusAkanDatang }); } catch (error) {}
  };

  const handleHapusTes = async (idTes: string) => {
    if (!window.confirm("Hapus permanen?")) return;
    try { await deleteDoc(doc(db, "master_tes", idTes)); } catch (error) {}
  };

  const handleLihatHasilTes = async (tes: any) => {
    setSelectedTesHasil(tes);
    try {
      const q = query(collection(db, "jawaban_tes"), where("id_tes", "==", tes.id));
      const snap = await getDocs(q);
      const dataJawaban = snap.docs.map(doc => doc.data());
      dataJawaban.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setJawabanTesViewer(dataJawaban);
    } catch (error) { alert("Gagal memuat data."); }
  };

  const handleTambahJenisSurat = async (e: React.FormEvent) => {
    e.preventDefault(); if(!newJenisSurat.trim()) return; setIsSavingJenisSurat(true);
    try { await addDoc(collection(db, "master_jenis_surat"), { id_rayon: adminRayonId, jenis: newJenisSurat, syarat: newSyaratSurat, timestamp: Date.now() }); setNewJenisSurat(''); setNewSyaratSurat(''); alert("Surat ditambahkan!"); } catch(err) {} finally { setIsSavingJenisSurat(false); }
  };

  const handleHapusJenisSurat = async (id: string) => { if(window.confirm("Hapus?")) await deleteDoc(doc(db, "master_jenis_surat", id)); };
  const handleFileSuratChange = (idSurat: string, file: File | null) => { setFileSuratBalasan(prev => ({ ...prev, [idSurat]: file })); };

  const handleAksiSurat = async (idSurat: string, aksi: 'Disetujui' | 'Ditolak') => {
    if (aksi === 'Ditolak') { if(!window.confirm("Tolak pengajuan?")) return; try { await updateDoc(doc(db, "pengajuan_surat", idSurat), { status: aksi }); } catch (error) {} return; }
    const fileBalasan = fileSuratBalasan[idSurat];
    if (!fileBalasan) return alert("Wajib unggah File Balasan Resmi!"); setIsUploadingSurat(true);
    try { const fileUrl = await uploadToCloudinary(fileBalasan); await updateDoc(doc(db, "pengajuan_surat", idSurat), { status: aksi, file_balasan_url: fileUrl }); alert("Sukses!"); } catch (error) {} finally { setIsUploadingSurat(false); }
  };

  const handleHapusSurat = async (idSurat: string) => { if (!window.confirm("Yakin hapus permanen?")) return; try { await deleteDoc(doc(db, "pengajuan_surat", idSurat)); alert("Surat dihapus."); } catch (error) {} };

  const handleUbahStatusAkun = async (idAkun: string, statusSekarang: string) => { const statusBaru = statusSekarang === "Aktif" ? "Pasif" : "Aktif"; if (!window.confirm(`Ubah status ke ${statusBaru}?`)) return; try { await updateDoc(doc(db, "users", idAkun), { status: statusBaru }); } catch (error) {} };
  const handleHapusAkun = async (idAkun: string, nama: string) => { if (!window.confirm(`Hapus permanen "${nama}"?`)) return; try { await deleteDoc(doc(db, "users", idAkun)); alert(`Dihapus.`); } catch (error) {} };
  const handleUbahPlottingPendamping = async (nimKader: string, pendampingBaru: string) => { try { await updateDoc(doc(db, "users", nimKader), { pendampingId: pendampingBaru }); } catch (error) {} };
  const handleUbahJenjangKader = async (nimKader: string, jenjangBaru: string) => { if (!window.confirm(`Pindah jenjang? Pendamping diriset.`)) return; try { await updateDoc(doc(db, "users", nimKader), { jenjang: jenjangBaru, pendampingId: "" }); alert("Sukses."); } catch (error) {} };
  const handleUbahJenjangPendamping = async (idPendamping: string, jenjangTugasBaru: string) => { try { await updateDoc(doc(db, "users", idPendamping), { jenjangTugas: jenjangTugasBaru }); } catch (error) {} };

  const handleUbahNiaKader = async (nimKader: string, niaBaru: string) => {
    try { await updateDoc(doc(db, "users", nimKader), { nia: niaBaru }); } catch (error) { console.error("Gagal update NIA", error); }
  };
  
  const handleBersihkanDataKaderLama = async () => {
    const batasTahun = currentYear - 3; 
    const kaderExpired = dataKader.filter(k => { if (!k.createdAt) return false; return new Date(k.createdAt).getFullYear() <= batasTahun; });
    if (kaderExpired.length === 0) return alert(`Tidak ada data kader <= tahun ${batasTahun}.`);
    if (!window.confirm(`Yakin hapus permanen ${kaderExpired.length} kader angkatan ${batasTahun} kebawah?`)) return;
    setIsSubmitting(true);
    try {
      for (const kader of kaderExpired) { await deleteDoc(doc(db, "users", kader.id)); await deleteDoc(doc(db, "nilai_khs", kader.nim)); await deleteDoc(doc(db, "evaluasi_kader", kader.nim)); }
      alert(`Pembersihan Selesai!`);
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
      setFormMateri({ kode: '', nama: '', muatan: '', bobot: 3 });
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
    if (!editMateriForm.kode || !editMateriForm.nama) return alert("Kode dan Nama materi tidak boleh kosong!");
    setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const updatedList = currentList.map((m: any) => m.id === materiId ? { ...m, ...editMateriForm } : m);
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: updatedList }, { merge: true });
      setEditingMateriId(null);
      alert("Materi berhasil diperbarui!");
    } catch(err) { alert("Gagal mengedit materi."); } finally { setIsSavingKurikulum(false); }
  };

  const handleTambahTugas = async (e: React.FormEvent) => { e.preventDefault(); try { await addDoc(collection(db, "master_tugas"), { id_rayon: adminRayonId, nama_tugas: formTugas.nama_tugas, deadline: formTugas.deadline, timestamp: Date.now() }); setFormTugas({ nama_tugas: '', deadline: '' }); alert("Tugas ditambah!"); } catch (error) {} };
  const handleHapusTugas = async (idTugas: string) => { if(window.confirm("Hapus?")) await deleteDoc(doc(db, "master_tugas", idTugas)); };

  const handleTambahPerpus = async (e: React.FormEvent) => {
    e.preventDefault(); if(!filePerpus) return alert("Pilih file!"); setIsUploadingPerpus(true);
    try { const fileUrl = await uploadToCloudinary(filePerpus); await addDoc(collection(db, "perpustakaan"), { id_rayon: adminRayonId, folder: formPerpus.folder, nama_file: formPerpus.nama_file, link_file: fileUrl, timestamp: Date.now() }); setFormPerpus({ folder: '', nama_file: '' }); setFilePerpus(null); alert("Materi diupload!"); } catch (error) {} finally { setIsUploadingPerpus(false); }
  };
  const handleHapusPerpus = async (idPerpus: string) => { if(window.confirm("Hapus?")) await deleteDoc(doc(db, "perpustakaan", idPerpus)); };

  const getSecondaryAuth = () => { const apps = getApps(); const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(auth.app.options, 'SecondaryApp'); return getAuth(secondaryApp); };

  const handleBuatAkunKader = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const emailBaru = `${formKader.nim}@pmii-uinmalang.or.id`.toLowerCase();
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formKader.password);
      await setDoc(doc(db, "users", formKader.nim), { nim: formKader.nim, nia: formKader.nia, nama: formKader.nama, email: emailBaru, role: "kader", id_rayon: adminRayonId, jenjang: "MAPABA", pendampingId: formKader.pendampingId, status: "Aktif", createdAt: Date.now() });
      await signOutSecondary(secondaryAuth); alert(`Sukses!`); setFormKader({ nim: '', nia: '', nama: '', password: '', pendampingId: '' });
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  const handleBuatAkunPendamping = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); const secondaryAuth = getSecondaryAuth();
    try {
      const emailBaru = `${formPendamping.username}@pmii-uinmalang.or.id`.toLowerCase();
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formPendamping.password);
      await setDoc(doc(db, "users", formPendamping.username), { username: formPendamping.username, nama: formPendamping.nama, email: emailBaru, role: "pendamping", id_rayon: adminRayonId, jumlahBinaan: 0, status: "Aktif", jenjangTugas: formPendamping.jenjangTugas, createdAt: Date.now() });
      await signOutSecondary(secondaryAuth); alert(`Sukses!`); setFormPendamping({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' });
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  const handleImportExcel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fileInput = (e.target as HTMLFormElement).elements[0] as HTMLInputElement; const file = fileInput?.files?.[0];
    if (!file) return alert("Pilih file!"); setIsSubmitting(true); setImportProgress("Membaca file Excel..."); const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' }); const wsname = wb.SheetNames[0]; const ws = wb.Sheets[wsname]; const data = XLSX.utils.sheet_to_json(ws); 
        if (data.length === 0) throw new Error("Kosong."); const secondaryAuth = getSecondaryAuth(); let successCount = 0; let errorCount = 0;
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i]; 
          const nim = String(row['NIM'] || row['nim'] || '').trim(); 
          const nia = String(row['NIA'] || row['nia'] || '').trim(); 
          const nama = row['Nama'] || row['nama'] || ''; 
          const tglLahir = String(row['TanggalLahir'] || row['tanggallahir'] || row['Password'] || '').trim(); 
          let pendamping = row['Pendamping'] || row['pendamping'] || '';
          
          if (!nim || !nama || !tglLahir) { errorCount++; continue; }
          setImportProgress(`Memproses: ${nama} (${i + 1}/${data.length})`);
          const emailBaru = `${nim}@pmii-uinmalang.or.id`.toLowerCase();
          try {
            await createUserWithEmailAndPassword(secondaryAuth, emailBaru, tglLahir);
            await setDoc(doc(db, "users", nim), { nim: nim, nia: nia, nama: nama, email: emailBaru, role: "kader", id_rayon: adminRayonId, jenjang: "MAPABA", pendampingId: pendamping, status: "Aktif", createdAt: Date.now() }); successCount++;
          } catch(err: any) { errorCount++; }
        }
        await signOutSecondary(secondaryAuth); alert(`Selesai! Berhasil: ${successCount}. Gagal: ${errorCount}`); fileInput.value = ''; 
      } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); setImportProgress(''); }
    };
    reader.readAsBinaryString(file);
  };

  const handleLogout = () => { signOut(auth); router.push('/'); };
  const handleDownloadPDF = () => { window.print(); };
  
  const filteredKader = dataKader.filter((k: any) => 
    ((k.nama && k.nama.toLowerCase().includes(searchKader.toLowerCase())) || 
     (k.nim && k.nim.includes(searchKader))) &&
    (filterJenjangKader === '' || k.jenjang === filterJenjangKader)
  );

  const filteredPendamping = dataPendamping.filter((p: any) => 
    (p.nama && p.nama.toLowerCase().includes(searchPendamping.toLowerCase())) || 
    (p.username && p.username.toLowerCase().includes(searchPendamping.toLowerCase()))
  );
  
  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'beranda': return 'Dashboard';
      case 'manajemen-akun': return 'Manajemen Akun';
      case 'kurikulum': return 'Kurikulum';
      case 'pantau-nilai': return 'Raport Kaderisasi';
      case 'master-tugas': return 'Manajemen Tugas';
      case 'verifikasi-surat': return 'Layanan Administrasi';
      case 'perpus': return 'Perpustakaan Digital';
      case 'manajemen-tes': return 'Manajemen Tes';
      case 'saran': return 'Kotak Aspirasi';
      default: return 'Dashboard Admin';
    }
  };

  const groupedPerpus = listPerpus.reduce((acc, item) => { if (!acc[item.folder]) acc[item.folder] = []; acc[item.folder].push(item); return acc; }, {});

  // ==========================================
  // VIEW RENDER
  // ==========================================
  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS UNTUK TAMPILAN WEB & CETAK PDF A4 BACKGROUND */}
      <style>{`
        @media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }
        
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 600px; }
        .tabel-utama thead tr { border-top: 2px solid #555; border-bottom: 2px solid #555; background-color: #fff; }
        .tabel-utama th { padding: 10px; color: #333; text-align: center; font-weight: bold; }
        .tabel-utama td { padding: 8px 10px; border-bottom: 1px solid #ddd; color: #333; }
        
        /* TAMPILAN LAYAR WEB (SEMBUNYIKAN PRINT WADAH DENGAN AMAN) */
        @media screen {
          .print-layout-container { 
             position: absolute !important;
             top: 0 !important;
             left: 0 !important;
             width: 100% !important;
             height: 0 !important; 
             overflow: hidden !important; 
             visibility: hidden !important; 
             z-index: -999 !important;
          }
          .bg-kertas-a4 { display: none !important; }
        }
        
        /* TAMPILAN SAAT CETAK PDF (CTRL+P) */
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background-color: white !important; margin: 0; padding: 0; height: auto !important; }
          
          /* Sembunyikan Elemen Web Yang Tidak Perlu */
          aside, header, .no-print { display: none !important; }
          main { margin-left: 0 !important; display: block !important; height: auto !important; overflow: visible !important; }
          div[style*="overflow: hidden"], div[style*="overflowY: auto"] { overflow: visible !important; height: auto !important; }
          
          /* Tampilkan Wadah Cetak Utama */
          .print-layout-container { 
            display: block !important; 
            position: relative !important;
            width: 100% !important;
            height: auto !important;       
            overflow: visible !important;  
            visibility: visible !important;
            z-index: 1 !important; 
          }
          
          .print-layout-container * { 
            color: #000 !important; 
            font-family: "Arial", "Arial Narrow", sans-serif !important; 
            line-height: 1.15 !important; 
          }
          
          /* Background Kertas A4 Mengunci Di Belakang */
          .bg-kertas-a4 { 
            position: fixed !important; 
            top: 0; left: 0; right: 0; bottom: 0; 
            width: 210mm !important; 
            height: 297mm !important; 
            z-index: -1 !important; 
          }
          .bg-kertas-a4 img { 
            width: 210mm !important; 
            height: 297mm !important; 
            object-fit: fill !important; 
          }

          /* AREA KONTEN: Diberi margin/padding atas 110mm agar tidak menabrak KOP SURAT */
          .print-content-area { 
            position: relative !important; 
            z-index: 10 !important; 
            padding: 50mm 25mm 40mm 25mm !important; 
            background-color: transparent !important; 
          }

          table { width: 100% !important; border-collapse: collapse !important; background-color: transparent !important; }
          tr { page-break-inside: avoid !important; }
          th, td { 
            border: 1px solid #000 !important; 
            padding: 6px 8px !important; 
            font-size: 11pt !important; 
          }
          th { font-weight: bold !important; text-align: center !important; }
          
          .tabel-biodata { margin-bottom: 15px !important; border: none !important; width: 100% !important; }
          .tabel-biodata td, .tabel-biodata tr { border: none !important; padding: 4px 0 !important; text-align: left !important; }
          
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* SIDEBAR ADMIN */}
      <aside className="no-print" style={{ width: '260px', background: 'linear-gradient(135deg, #1e824c 0%, #154360 100%)', color: 'white', display: 'flex', flexDirection: 'column', overflowY: 'auto', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'left 0.3s ease', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🏛️ SIAKAD PMII</span>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <h4 style={{ fontSize: '1rem', margin: 0, color: '#f1c40f', lineHeight: '1.4' }}>{namaRayonAsli || 'Memuat...'}</h4>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', margin: 0 }}>
          {[
            { id: 'beranda', icon: '🏠', label: 'Dashboard' },
            { id: 'verifikasi-surat', icon: '✉️', label: 'Layanan Administrasi', badge: suratMasuk.filter(s => s.status === 'Menunggu Verifikasi').length || null },
            { id: 'manajemen-akun', icon: '👥', label: 'Manajemen Akun' },
            { id: 'kurikulum', icon: '📚', label: 'Kurikulum' }, 
            { id: 'pantau-nilai', icon: '📊', label: 'Raport Kaderisasi' }, 
            { id: 'manajemen-tes', icon: '📝', label: 'Manajemen Tes' },
            { id: 'master-tugas', icon: '📋', label: 'Manajemen Tugas' }, 
            { id: 'perpus', icon: '📁', label: 'Perpustakaan Digital' }, 
            { id: 'saran', icon: '💬', label: 'Kotak Aspirasi', badge: saranMasuk.length || null }, 
          ].map((item) => (
            <li key={item.id}>
              <button 
                onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} 
                style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent', border: 'none', color: activeMenu === item.id ? '#fff' : '#d1d1d1', padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', transition: '0.2s' }}
              >
                <div style={{ display: 'flex', gap: '15px' }}><span>{item.icon}</span> {item.label}</div>
                {item.badge && <span style={{ backgroundColor: '#e74c3c', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>{item.badge}</span>}
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
            <div style={{ fontSize: '0.8rem', color: '#1e824c', fontWeight: 'bold' }}>Admin: {adminRayonId}</div>
          </div>
        </header>

        {/* ISI KONTEN (Scroll Berjalan Di Sini Saja) */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>

          {/* MENU 0: BERANDA OVERVIEW */}
          {activeMenu === 'beranda' && (
            <div>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h2 style={{color: '#1e824c', marginTop: 0, fontSize: '1.5rem'}}>Selamat Datang di Pusat Kendali {namaRayonAsli}!</h2>
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
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #2ecc71' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Total Pendamping Aktif</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{dataPendamping.length}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f1c40f' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Surat Menunggu</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{suratMasuk.filter(s => s.status === 'Menunggu Verifikasi').length}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #e74c3c' }}>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontWeight: 'bold' }}>Tugas Rayon Aktif</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginTop: '5px' }}>{listMasterTugas.length}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h4 style={{ marginTop: 0, color: '#0d1b2a', marginBottom: '15px' }}>Distribusi Jenjang Kader</h4>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
                    <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Jenjang Kaderisasi</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Jumlah Kader</th></tr></thead>
                    <tbody>
                      {['MAPABA', 'PKD', 'SIG', 'SKP'].map((jenjang) => {
                        let count = 0;
                        if (jenjang === 'MAPABA') count = dataKaderDifilterTahun.filter(k => ['MAPABA', 'PKD', 'SIG', 'SKP'].includes(k.jenjang)).length;
                        else if (jenjang === 'PKD') count = dataKaderDifilterTahun.filter(k => ['PKD', 'SKP'].includes(k.jenjang)).length;
                        else if (jenjang === 'SIG') count = dataKaderDifilterTahun.filter(k => ['SIG', 'SKP'].includes(k.jenjang)).length;
                        else if (jenjang === 'SKP') count = dataKaderDifilterTahun.filter(k => k.jenjang === 'SKP').length;
                        return (
                          <tr key={jenjang} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{jenjang}</td><td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#3498db' }}>{count} Kader</td></tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* MENU 1: VERIFIKASI SURAT */}
          {activeMenu === 'verifikasi-surat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#1e824c', margin: 0, borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>Pengaturan Jenis Layanan Surat</h3>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 300px', maxWidth: '100%', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
                    <h4 style={{marginTop: 0, marginBottom: '15px', color: '#333'}}>➕ Tambah Layanan Baru</h4>
                    <form onSubmit={handleTambahJenisSurat} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <input type="text" placeholder="Nama / Jenis Surat" required value={newJenisSurat} onChange={(e) => setNewJenisSurat(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }} />
                      <textarea rows={3} placeholder="Instruksi Isian Wajib (Misal: Sebutkan tgl kegiatan)" value={newSyaratSurat} onChange={(e) => setNewSyaratSurat(e.target.value)} required style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
                      <button disabled={isSavingJenisSurat} type="submit" style={{ backgroundColor: '#2ecc71', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingJenisSurat ? 'not-allowed' : 'pointer' }}>{isSavingJenisSurat ? 'Menyimpan...' : 'Tambahkan Layanan'}</button>
                    </form>
                  </div>
                  <div style={{ flex: '2 1 400px', minWidth: 0, maxWidth: '100%', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '500px' }}>
                        <thead><tr style={{ backgroundColor: '#f8f9fa' }}><th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Jenis Surat</th><th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Instruksi Isian Wajib</th><th style={{ padding: '15px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th></tr></thead>
                        <tbody>
                          {listJenisSurat.length === 0 ? (<tr><td colSpan={3} style={{textAlign: 'center', padding: '20px'}}>Belum ada jenis surat.</td></tr>) : listJenisSurat.map((surat) => (
                            <tr key={surat.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '15px', fontWeight: 'bold' }}>{surat.jenis}</td><td style={{ padding: '15px', color: '#555', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{surat.syarat || '-'}</td>
                              <td style={{ padding: '15px', textAlign: 'center' }}><button onClick={() => handleHapusJenisSurat(surat.id)} style={{ color: 'white', backgroundColor: '#e74c3c', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Hapus</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '400px' }}>
                <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', flexWrap: 'wrap', gap: '10px', borderRadius: '8px 8px 0 0' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '1px' }}>DAFTAR PENGAJUAN SURAT KADER</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '20px' }}>{suratMasuk.filter(s => s.status === 'Menunggu Verifikasi').length} Menunggu Verifikasi</div>
                </div>
                <div style={{ padding: '20px', width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#333', minWidth: '800px' }}>
                    <thead><tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa' }}><th style={{ padding: '10px' }}>Kader</th><th style={{ padding: '10px' }}>Jenis</th><th style={{ padding: '10px' }}>Isian Keperluan</th><th style={{ padding: '10px' }}>Status</th><th style={{ padding: '10px' }}>Balasan Surat (Manual)</th><th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th></tr></thead>
                    <tbody>
                      {suratMasuk.length === 0 ? (<tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada surat masuk.</td></tr>) : suratMasuk.map((surat, index) => (
                        <tr key={surat.id} style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                          <td style={{ padding: '10px' }}><span style={{ fontWeight: 'bold', color: '#004a87' }}>{surat.email_kader.split('@')[0]}</span><br/><span style={{fontSize: '0.7rem', color: '#999'}}>{surat.tanggal}</span></td>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{surat.jenis}</td>
                          <td style={{ padding: '10px', whiteSpace: 'pre-wrap', fontStyle: 'italic', color: '#555' }}>"{surat.keperluan}"</td>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: surat.status === 'Menunggu Verifikasi' ? '#f39c12' : surat.status === 'Disetujui' ? '#27ae60' : '#c0392b' }}>{surat.status}</td>
                          <td style={{ padding: '10px' }}>
                            {surat.status === 'Menunggu Verifikasi' ? (
                              <input type="file" accept=".pdf, .jpg, .png" onChange={(e) => handleFileSuratChange(surat.id, e.target.files ? e.target.files[0] : null)} style={{ padding: '4px', fontSize: '0.75rem', maxWidth: '180px' }} />
                            ) : surat.status === 'Disetujui' && surat.file_balasan_url ? (
                              <a href={surat.file_balasan_url} target="_blank" style={{ color: 'blue', textDecoration: 'none', fontWeight: 'bold' }}>Lihat Balasan</a>
                            ) : (<span style={{ color: '#ccc' }}>-</span>)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {surat.status === 'Menunggu Verifikasi' ? (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button disabled={isUploadingSurat} onClick={() => handleAksiSurat(surat.id, 'Disetujui')} style={{ background: '#27ae60', border: 'none', color: 'white', cursor: isUploadingSurat ? 'not-allowed' : 'pointer', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', fontSize: '0.75rem' }}>{isUploadingSurat ? '...' : 'Setujui'}</button>
                                <button disabled={isUploadingSurat} onClick={() => handleAksiSurat(surat.id, 'Ditolak')} style={{ background: '#c0392b', border: 'none', color: 'white', cursor: isUploadingSurat ? 'not-allowed' : 'pointer', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', fontSize: '0.75rem' }}>Tolak</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}><span style={{ color: '#95a5a6' }}>👁️ Selesai</span><button onClick={() => handleHapusSurat(surat.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem' }} title="Hapus Permanen">🗑️</button></div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU 2: MANAJEMEN AKUN */}
          {activeMenu === 'manajemen-akun' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              
              {/* HEADER MANAJEMEN AKUN */}
              <h3 style={{ color: '#1e824c', margin: '0 0 15px 0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Manajemen Akun & Data</h3>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabAkun('kader')} style={{ padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkun === 'kader' ? '#1e824c' : '#f4f6f9', color: tabAkun === 'kader' ? 'white' : '#555', flex: '1 1 auto', textAlign: 'center', fontSize: '0.85rem' }}>🎓 Akun Kader</button>
                <button onClick={() => setTabAkun('pendamping')} style={{ padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkun === 'pendamping' ? '#1e824c' : '#f4f6f9', color: tabAkun === 'pendamping' ? 'white' : '#555', flex: '1 1 auto', textAlign: 'center', fontSize: '0.85rem' }}>👤 Akun Pendamping</button>
              </div>

              {tabAkun === 'kader' && (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 300px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ backgroundColor: '#fdfdfd', padding: '15px', border: '1px solid #eee', borderRadius: '8px' }}>
                      <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>✏️ Buat Akun Satuan</h4>
                      <form onSubmit={handleBuatAkunKader} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        <input type="number" placeholder="NIM Kader" value={formKader.nim} onChange={e => setFormKader({...formKader, nim: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                        <input type="text" placeholder="NIA Kader (Opsional)" value={formKader.nia} onChange={e => setFormKader({...formKader, nia: e.target.value})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                        <input type="text" placeholder="Nama Lengkap Kader" value={formKader.nama} onChange={e => setFormKader({...formKader, nama: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                        <input type="text" placeholder="Password (Misal: 20042004)" value={formKader.password} onChange={e => setFormKader({...formKader, password: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                        <select required value={formKader.pendampingId} onChange={e => setFormKader({...formKader, pendampingId: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }}>
                          <option value="" disabled>-- Pilih Pendamping --</option>
                          {dataPendamping.map(p => <option key={p.id} value={p.username}>{p.nama}</option>)}
                        </select>
                        <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#2ecc71', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>{isSubmitting ? 'Memproses...' : 'Buat Akun'}</button>
                      </form>
                    </div>

                    <div style={{ backgroundColor: '#f0fbf4', padding: '15px', border: '1px solid #c8e6c9', borderRadius: '8px' }}>
                      <h4 style={{ marginTop: 0, color: '#1e824c', borderBottom: '1px dashed #a5d6a7', paddingBottom: '8px' }}>📗 Import Massal (Excel)</h4>
                      <p style={{fontSize: '0.75rem', color: '#555', margin: '5px 0'}}>Format: <b>NIM | NIA | Nama | TanggalLahir | Pendamping</b></p>
                      <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input type="file" accept=".xlsx, .xls" required style={{ padding: '6px', border: '1px dashed #1e824c', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.8rem' }} />
                        <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#1e824c', color: 'white', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>🚀 Proses Data Excel</button>
                        {importProgress && <div style={{fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold', textAlign: 'center'}}>{importProgress}</div>}
                      </form>
                    </div>

                    <div style={{ backgroundColor: '#fff5f5', padding: '15px', border: '1px solid #ffcdd2', borderRadius: '8px' }}>
                      <h4 style={{ marginTop: 0, color: '#c62828', borderBottom: '1px dashed #ef9a9a', paddingBottom: '8px' }}>🧹 Pembersihan Data</h4>
                      <p style={{fontSize: '0.75rem', color: '#555', margin: '5px 0 10px 0'}}>Hapus permanen data kader angkatan lama (3 tahun).</p>
                      <button onClick={handleBersihkanDataKaderLama} disabled={isSubmitting} style={{ backgroundColor: '#c62828', color: 'white', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', width: '100%', border: 'none', fontSize: '0.85rem' }}>🗑️ Bersihkan Data Kadaluarsa</button>
                    </div>
                  </div>
                  
                  <div style={{ flex: '2 1 400px', minWidth: 0, maxWidth: '100%', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, color: '#1e824c', fontSize: '0.95rem' }}>🔄 Daftar Kader, Plotting & Jenjang</h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <select value={filterJenjangKader} onChange={(e) => setFilterJenjangKader(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <option value="">Semua Jenjang</option><option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
                        </select>
                        <input type="text" placeholder="🔍 Cari NIM atau Nama..." value={searchKader} onChange={(e) => setSearchKader(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem' }} />
                      </div>
                    </div>
                    
                    <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '950px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', color: '#333', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>NIM / Tahun</th>
                            <th style={{ padding: '10px' }}>Nama Kader</th>
                            <th style={{ padding: '10px' }}>Nomor NIA</th>
                            <th style={{ padding: '10px' }}>Jenjang (Ubah)</th>
                            <th style={{ padding: '10px' }}>Pendamping</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredKader.length === 0 ? (<tr><td colSpan={7} style={{textAlign: 'center', padding: '20px', color: '#999'}}>Tidak ada data kader yang cocok.</td></tr>) : (
                            filteredKader.map((k) => {
                              const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                              return (
                                <tr key={k.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#555' }}>{k.nim} <br/> <span style={{fontSize: '0.7rem', color: '#1e824c'}}>Agt. {thnMasuk}</span></td>
                                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#333' }}>{k.nama}</td>
                                  <td style={{ padding: '10px' }}>
                                    <input 
                                      type="text" 
                                      placeholder="Masukkan NIA" 
                                      value={k.nia || ''} 
                                      onChange={(e) => handleUbahNiaKader(k.nim, e.target.value)} 
                                      style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', maxWidth: '120px', fontSize: '0.75rem', outline: 'none' }}
                                    />
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                    <select value={k.jenjang || "MAPABA"} onChange={(e) => handleUbahJenjangKader(k.nim, e.target.value)} style={{ padding: '4px', border: '1px solid #3498db', borderRadius: '4px', backgroundColor: '#eaf4fc', fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '100px', fontSize: '0.75rem', color: '#2c3e50' }}>
                                      <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
                                    </select>
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                     <select value={k.pendampingId || ""} onChange={(e) => handleUbahPlottingPendamping(k.nim, e.target.value)} style={{ padding: '4px', border: '1px solid #2ecc71', borderRadius: '4px', backgroundColor: '#fff', fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '130px', fontSize: '0.75rem' }}>
                                       <option value="">- Kosong -</option>
                                       {dataPendamping.map(p => <option key={p.id} value={p.username}>{p.nama}</option>)}
                                     </select>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <button onClick={() => handleUbahStatusAkun(k.id, k.status)} style={{ padding: '4px 6px', border: 'none', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: k.status === 'Aktif' ? '#e8f5e9' : '#ffebee', color: k.status === 'Aktif' ? '#2e7d32' : '#c62828' }}>{k.status === 'Aktif' ? '🟢 Aktif' : '🔴 Pasif'}</button>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <button onClick={() => handleHapusAkun(k.id, k.nama)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Akun">🗑️</button>
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
              )}

              {tabAkun === 'pendamping' && (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 300px', maxWidth: '100%', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>✏️ Buat Akun Pendamping</h4>
                    <form onSubmit={handleBuatAkunPendamping} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                      <input type="text" placeholder="Nama Lengkap Pendamping" value={formPendamping.nama} onChange={e => setFormPendamping({...formPendamping, nama: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                      <input type="text" placeholder="Username (contoh: ridwan_rkcd)" value={formPendamping.username} onChange={e => setFormPendamping({...formPendamping, username: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                      <input type="text" placeholder="Password Sementara" value={formPendamping.password} onChange={e => setFormPendamping({...formPendamping, password: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                      <select required value={formPendamping.jenjangTugas} onChange={e => setFormPendamping({...formPendamping, jenjangTugas: e.target.value})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', color: '#2c3e50', fontSize: '0.85rem' }}>
                        <option value="MAPABA">Tugas Pendamping MAPABA</option><option value="PKD">Tugas Pendamping PKD</option><option value="SIG">Tugas Pendamping SIG</option><option value="SKP">Tugas Pendamping SKP</option>
                      </select>
                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#1e824c', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Buat Akun</button>
                    </form>
                  </div>
                  <div style={{ flex: '2 1 400px', minWidth: 0, maxWidth: '100%', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, color: '#1e824c', fontSize: '0.95rem' }}>📋 Daftar Pendamping</h4>
                      <input type="text" placeholder="🔍 Cari Nama/Username..." value={searchPendamping} onChange={(e) => setSearchPendamping(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem' }} />
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '600px' }}>
                        <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#333', textAlign: 'left' }}><th style={{ padding: '10px' }}>Nama Pendamping</th><th style={{ padding: '10px' }}>Username</th><th style={{ padding: '10px' }}>Tugas Jenjang</th><th style={{ padding: '10px', textAlign: 'center' }}>Status</th><th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th></tr></thead>
                        <tbody>
                          {filteredPendamping.length === 0 ? (<tr><td colSpan={5} style={{textAlign: 'center', padding: '20px', color: '#999'}}>Tidak ada pendamping.</td></tr>) : (
                            filteredPendamping.map((p) => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.nama}</td><td style={{ padding: '10px' }}>{p.username}</td>
                                <td style={{ padding: '10px' }}>
                                  <select value={p.jenjangTugas || "MAPABA"} onChange={(e) => handleUbahJenjangPendamping(p.id, e.target.value)} style={{ padding: '4px', border: '1px solid #3498db', borderRadius: '4px', backgroundColor: '#eaf4fc', fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '120px', fontSize: '0.75rem', color: '#2c3e50' }}>
                                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option>
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

          {/* MENU 3: KURIKULUM (EDIT UPDATE) */}
          {activeMenu === 'kurikulum' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '500px' }}>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button onClick={() => setTabKurikulum('MAPABA')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'MAPABA' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'MAPABA' ? 'white' : '#555', fontSize: '0.85rem' }}>📘 MAPABA</button>
                  <button onClick={() => setTabKurikulum('PKD')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'PKD' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'PKD' ? 'white' : '#555', fontSize: '0.85rem' }}>📙 PKD</button>
                  <button onClick={() => setTabKurikulum('SIG')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'SIG' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'SIG' ? 'white' : '#555', fontSize: '0.85rem' }}>📕 SIG</button>
                  <button onClick={() => setTabKurikulum('SKP')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'SKP' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'SKP' ? 'white' : '#555', fontSize: '0.85rem' }}>👩 SKP</button>
                  <button onClick={() => setTabKurikulum('NONFORMAL')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'NONFORMAL' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'NONFORMAL' ? 'white' : '#555', fontSize: '0.85rem' }}>📗 Non-Formal</button>
                </div>
                
                <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{backgroundColor: '#eef2f3', padding: '12px 15px', borderBottom: '1px solid #ddd'}}><h4 style={{margin: 0, color: '#0d1b2a', fontSize: '0.9rem'}}>✅ Kurikulum Rayon Saat Ini ({tabKurikulum})</h4></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', minWidth: '600px' }}>
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

                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 400px', minWidth: 0, maxWidth: '100%', backgroundColor: '#fdfdfd', padding: '15px', borderRadius: '8px', border: '1px dashed #b2c2cf' }}>
                    <h4 style={{ color: '#0d1b2a', marginTop: 0, marginBottom: '10px', fontSize: '0.9rem' }}>📌 Kurikulum Standar MUSPIMNAS</h4>
                    <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #eee' }}>
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

                  <div style={{ flex: '1 1 250px', maxWidth: '100%', backgroundColor: '#f0fbf4', padding: '15px', border: '1px solid #c8e6c9', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#1e824c', borderBottom: '1px dashed #a5d6a7', paddingBottom: '8px', fontSize: '0.9rem' }}>📝 Tambah Materi Lokal/Lainnya</h4>
                    <form onSubmit={handleTambahMateriLokal} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                      <input type="text" placeholder="Kode (Misal: LOKAL-01)" required value={formMateri.kode} onChange={(e) => setFormMateri({...formMateri, kode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                      <input type="text" placeholder="Nama Materi Lokal" required value={formMateri.nama} onChange={(e) => setFormMateri({...formMateri, nama: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                      <textarea rows={2} placeholder="Muatan / Pembahasan (Opsional)" value={formMateri.muatan} onChange={(e) => setFormMateri({...formMateri, muatan: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                      <input type="number" placeholder="Bobot SKS/Jam (1 SKS = 30 Mnt)" required value={formMateri.bobot} onChange={(e) => setFormMateri({...formMateri, bobot: Number(e.target.value)})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                      <button disabled={isSavingKurikulum} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Tambahkan Lokal</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MENU 4: PANTAU NILAI / RAPORT (FULL MATRIX UPDATED) */}
          {/* ========================================================= */}
          {activeMenu === 'pantau-nilai' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader:</span>
                  <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {dataKader.length === 0 && <option value="">Tidak ada kader</option>}
                    {dataKader.map(k => <option key={k.nim} value={k.nim}>{k.nama} ({k.createdAt ? new Date(k.createdAt).getFullYear() : '-'})</option>)}
                  </select>
                  
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginLeft: '5px' }}>Jenjang:</span>
                  <select value={selectedJenjangNilai} onChange={(e) => setSelectedJenjangNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #2c3e50', borderRadius: '4px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', backgroundColor: '#eef2f3', color: '#2c3e50', fontSize: '0.85rem' }}>
                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
                  </select>
                  
                  {tabRaportAdmin === 'raport' && selectedKaderNilai && (
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>🖨️ Cetak KHS</button>
                  )}
                </div>
              </div>
              
              <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '15px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabRaportAdmin('raport')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'raport' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'raport' ? '#fff' : 'transparent', color: tabRaportAdmin === 'raport' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>📑 Raport Kaderisasi</button>
                <button onClick={() => setTabRaportAdmin('persentase')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'persentase' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'persentase' ? '#fff' : 'transparent', color: tabRaportAdmin === 'persentase' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>📊 Input Nilai</button>
                <button onClick={() => setTabRaportAdmin('pengaturan')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'pengaturan' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'pengaturan' ? '#fff' : 'transparent', color: tabRaportAdmin === 'pengaturan' ? '#555' : '#e67e22', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', marginLeft: 'auto', fontSize: '0.85rem' }}>⚙️ Pengaturan Cetak</button>
              </div>

              {tabRaportAdmin === 'raport' && (
                <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
                  <table className="tabel-utama" style={{ minWidth: '600px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '5%' }}>No</th><th style={{ width: '10%' }}>Kode</th><th style={{ width: '45%' }}>Nama Materi</th>
                        <th style={{ width: '10%' }}>SKS</th><th style={{ width: '10%' }}>Nilai Huruf</th><th style={{ width: '10%' }}>SKS x Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur oleh Pengurus Rayon.</td></tr>) : barisRaportRender}
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

              {tabRaportAdmin === 'persentase' && (
                <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
                  <div className="no-print" style={{ marginBottom: '15px', background: '#fdfdfd', padding: '15px', borderRadius: '6px', border: '1px solid #eee' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#1e824c', fontSize: '0.9rem' }}>⚙️ Pengaturan Kategori & Bobot Penilaian (Max 100%)</h4>
                    <form onSubmit={handleTambahKategoriBobot} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input type="text" required placeholder="Nama Kategori (Cth: Pre-Test)" value={formKategori.nama} onChange={e => setFormKategori({...formKategori, nama: e.target.value})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: '1 1 200px', fontSize: '0.85rem' }} />
                      <input type="number" required placeholder="Bobot %" value={formKategori.persen || ''} onChange={e => setFormKategori({...formKategori, persen: Number(e.target.value)})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: '0 0 100px', fontSize: '0.85rem' }} />
                      <button type="submit" disabled={isSavingEvaluasi || !selectedKaderNilai || totalBobotTersimpan >= 100} style={{ background: (totalBobotTersimpan >= 100 || !selectedKaderNilai) ? '#ccc' : '#28a745', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: (totalBobotTersimpan >= 100 || !selectedKaderNilai) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>➕ Tambah Kategori</button>
                    </form>
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {kategoriBobot.map(kat => (
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

                  <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ width: '3%' }}>No</th>
                        <th rowSpan={2} style={{ width: '10%', textAlign: 'left' }}>Kode</th>
                        <th rowSpan={2} style={{ width: '25%', textAlign: 'left' }}>Nama Materi</th>
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
                  <p style={{fontSize: '0.7rem', color: '#888', marginTop: '10px', fontStyle: 'italic'}}>*Tips: Ketik nilai (0-100) di kotak, lalu klik sembarang tempat di luar kotak agar sistem otomatis menyimpan & menghitung hasil.</p>

                  <div className="no-print" style={{ marginTop: '20px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Catatan Khusus untuk Kader Ini:</label>
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
                    <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>{isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}</button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* MENU 6: MANAJEMEN TES PEMAHAMAN */}
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
                  <div className="no-print" style={{ width: '100%', overflowX: 'auto' }}>
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
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 300px', maxWidth: '100%', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', alignSelf: 'flex-start' }}>
                    <h4 style={{ color: '#1e824c', margin: '0 0 15px 0', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>📝 Buat Tes Baru</h4>
                    <form onSubmit={handleBuatTes} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" placeholder="Judul Tes (Cth: Pre-Test MAPABA)" required value={formTes.judul} onChange={(e) => setFormTes({...formTes, judul: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                      <select required value={formTes.jenjang} onChange={(e) => setFormTes({...formTes, jenjang: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option><option value="Umum">Umum (Semua)</option>
                      </select>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#e67e22', marginBottom: '5px' }}>*Tekan Enter (baris baru) untuk memisahkan pertanyaan.</div>
                        <textarea rows={5} required value={formTes.soal} onChange={(e) => setFormTes({...formTes, soal: e.target.value})} placeholder="1. Apa tujuan PMII?&#10;2. Jelaskan makna logo!" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                      </div>
                      <button type="submit" style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Buat Tes</button>
                    </form>
                  </div>
                  <div style={{ flex: '2 1 400px', minWidth: 0, maxWidth: '100%', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                      <h4 style={{ color: '#4a637d', margin: 0 }}>Daftar Tes Rayon</h4>
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
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
                </div>
              )}
            </div>
          )}

          {/* MENU 7: MASTER TUGAS */}
          {activeMenu === 'master-tugas' && (
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', maxWidth: '100%', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <h4 style={{marginTop: 0, marginBottom: '15px', color: '#1e824c', borderBottom: '1px dashed #ccc', paddingBottom: '8px'}}>➕ Tambah Tugas</h4>
                  <form onSubmit={handleTambahTugas} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="text" placeholder="Nama Tugas (Misal: Resume NDP)" required value={formTugas.nama_tugas} onChange={(e) => setFormTugas({...formTugas, nama_tugas: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                    <div><label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Batas Waktu (Deadline)</label><input type="date" required value={formTugas.deadline} onChange={(e) => setFormTugas({...formTugas, deadline: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px', fontSize: '0.85rem', boxSizing: 'border-box' }} /></div>
                    <button type="submit" style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Buat Tugas Baru</button>
                  </form>
                </div>
                <div style={{ flex: '2 1 400px', minWidth: 0, maxWidth: '100%', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
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
            </div>
          )}

          {/* MENU 8: KELOLA PERPUSTAKAAN */}
          {activeMenu === 'perpus' && (
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', maxWidth: '100%', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <h4 style={{marginTop: 0, marginBottom: '15px', color: '#1e824c', borderBottom: '1px dashed #ccc', paddingBottom: '8px'}}>📤 Upload Materi Baru</h4>
                  <form onSubmit={handleTambahPerpus} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="text" placeholder="Nama Folder (Cth: Modul MAPABA)" required value={formPerpus.folder} onChange={(e) => setFormPerpus({...formPerpus, folder: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                    <input type="text" placeholder="Judul Buku/Materi" required value={formPerpus.nama_file} onChange={(e) => setFormPerpus({...formPerpus, nama_file: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                    <input type="file" required accept=".pdf,.doc,.docx" onChange={(e) => setFilePerpus(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #ccc', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.8rem' }} />
                    <button disabled={isUploadingPerpus} type="submit" style={{ backgroundColor: isUploadingPerpus ? '#95a5a6' : '#004a87', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isUploadingPerpus ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>{isUploadingPerpus ? 'Mengupload...' : 'Upload ke Perpus'}</button>
                  </form>
                </div>
                <div style={{ flex: '2 1 400px', minWidth: 0, maxWidth: '100%', border: '1px solid #eee', borderRadius: '8px' }}>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    {Object.keys(groupedPerpus).length === 0 ? (<div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Perpustakaan kosong.</div>) : (
                      Object.keys(groupedPerpus).map(folderName => (
                        <div key={folderName} style={{ marginBottom: '20px' }}>
                          <div style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px 15px', fontSize: '0.9rem', fontWeight: 'bold' }}>📁 Folder: {folderName}</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
                            <tbody>
                              {groupedPerpus[folderName].map((item: any) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '12px' }}>{item.nama_file}</td>
                                  <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <a href={item.link_file} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#3498db', color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', marginRight: '5px' }}>Buka</a>
                                    <button onClick={() => handleHapusPerpus(item.id)} style={{ color: 'white', backgroundColor: '#e74c3c', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Hapus</button>
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
              </div>
            </div>
          )}

          {/* MENU 9: SARAN MASUK */}
          {activeMenu === 'saran' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', padding: '20px' }}>
              <h3 style={{ color: '#1e824c', margin: '0 0 15px 0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Kotak Saran & Aspirasi</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                {saranMasuk.length === 0 ? <p style={{ color: '#999' }}>Belum ada saran masuk.</p> : saranMasuk.map((saran) => (
                  <div key={saran.id} style={{ backgroundColor: '#fdfdfd', border: '1px solid #eee', borderRadius: '8px', padding: '15px', borderLeft: '4px solid #f1c40f', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ fontWeight: 'bold', color: '#1e824c', fontSize: '0.9rem' }}>{saran.nama} <span style={{fontSize: '0.75rem', color: '#888'}}>({saran.nim})</span></span><span style={{ fontSize: '0.7rem', color: '#aaa' }}>{saran.tanggal}</span></div>
                    <p style={{ color: '#555', fontStyle: 'italic', margin: 0, lineHeight: '1.4', fontSize: '0.85rem' }}>"{saran.saran}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ================================================================================ */}
      {/* STRUKTUR HIDDEN HTML KHUSUS UNTUK PRINT PDF DENGAN BACKGROUND GAMBAR A4 */}
      {/* ================================================================================ */}
      <div id="hidden-print-container" className="print-layout-container">
        {pengaturanCetak.kopSuratUrl && (<div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>)}
        <div className="print-content-area">
          
          {/* CETAK KHS RAPORT ADMIN */}
          {activeMenu === 'pantau-nilai' && tabRaportAdmin === 'raport' && (
            <div>
              <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI</h3>
              <table className="tabel-biodata">
                <tbody>
                  <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak.nim || '...........................'}</td></tr>
                  <tr><td>Nama Mahasiswa</td><td>:</td><td>{kaderDicetak.nama || '...........................'}</td></tr>
                  <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '...........................'}</td></tr>
                  <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{selectedJenjangNilai}</td></tr>
                </tbody>
              </table>
              <table className="tabel-utama">
                <thead>
                  <tr><th style={{ width: '5%' }}>No</th><th style={{ width: '20%', textAlign: 'left' }}>Kode</th><th style={{ width: '45%', textAlign: 'left' }}>Nama Materi</th><th style={{ width: '10%' }}>SKS</th><th style={{ width: '10%' }}>Nilai</th><th style={{ width: '10%' }}>SKS x Nilai</th></tr>
                </thead>
                <tbody>
                  {materiAktif.length === 0 ? (<tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur.</td></tr>) : barisRaportRender}
                  <tr><td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td><td></td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td></tr>
                  <tr><td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kader)</td><td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{ipKader}</td></tr>
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