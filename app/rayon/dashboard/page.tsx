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

  // --- STATE PENGATURAN KOP SURAT (BARU) ---
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
  const [formKader, setFormKader] = useState({ nim: '', nama: '', password: '', pendampingId: '' });
  const [formPendamping, setFormPendamping] = useState({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState(''); 
  
  // STATE PENCARIAN AKUN
  const [searchKader, setSearchKader] = useState('');
  const [filterJenjangKader, setFilterJenjangKader] = useState('');
  const [searchPendamping, setSearchPendamping] = useState('');

  // STATE FILTER TAHUN KADERISASI (BERANDA)
  const currentYear = new Date().getFullYear();
  const [filterTahunBeranda, setFilterTahunBeranda] = useState<string>(currentYear.toString());

  // --- STATE MASTER KURIKULUM ---
  const [tabKurikulum, setTabKurikulum] = useState('MAPABA');
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], SIG: [], SKP: [], NONFORMAL: [] });
  const [formMateri, setFormMateri] = useState({ kode: '', nama: '', muatan: '', bobot: 3 });
  const [isSavingKurikulum, setIsSavingKurikulum] = useState(false);
  const [masterKurikulumPusat, setMasterKurikulumPusat] = useState<any[]>([]); 

  // --- STATE NILAI KHS & RAPORT ---
  const [selectedKaderNilai, setSelectedKaderNilai] = useState('');
  const [selectedJenjangNilai, setSelectedJenjangNilai] = useState('MAPABA');
  const [nilaiKaderRealtime, setNilaiKaderRealtime] = useState<Record<string, string>>({}); 
  const [evaluasiKader, setEvaluasiKader] = useState<{ listKeaktifan: any[], catatan: string }>({ listKeaktifan: [], catatan: '' });
  const [tabRaportAdmin, setTabRaportAdmin] = useState('raport'); 
  
  // STATE INPUT PERSENTASE (BARU)
  const [formKeaktifan, setFormKeaktifan] = useState({ kategori: '', nilai: 0 });
  const [isSavingEvaluasi, setIsSavingEvaluasi] = useState(false);

  // --- STATE TUGAS, PERPUS, SARAN ---
  const [saranMasuk, setSaranMasuk] = useState<any[]>([]);
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]);
  const [formTugas, setFormTugas] = useState({ nama_tugas: '', deadline: '' });
  const [listPerpus, setListPerpus] = useState<any[]>([]);
  const [formPerpus, setFormPerpus] = useState({ folder: '', nama_file: '' });
  const [filePerpus, setFilePerpus] = useState<File | null>(null);
  const [isUploadingPerpus, setIsUploadingPerpus] = useState(false);

  // --- STATE TES PEMAHAMAN (BARU) ---
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
    
    // PERBAIKAN: Gunakan auto upload agar PDF dan Word bisa dibaca, tidak dipaksa ke image
    const res = await fetch("https://api.cloudinary.com/v1_1/dcmdaghbq/auto/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload ke Cloudinary");
    return data.secure_url;
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
              alert(`Akses Ditolak! Anda mencoba masuk sebagai Admin Rayon, namun jabatan Anda adalah "${userData.role}". Silakan login kembali dengan akun yang benar.`);
              signOut(auth);
              router.push('/');
              return;
            }

            const currentRayonId = userData.username; 
            setAdminRayonId(currentRayonId);
            
            // Tarik data profil rayon (termasuk Kop & Footer yang sudah diupload)
            onSnapshot(doc(db, "users", currentRayonId), (rayonSnap) => {
              if (rayonSnap.exists()) {
                const rData = rayonSnap.data();
                setNamaRayonAsli(rData.nama || currentRayonId);
                setPengaturanCetak({
                  kopSuratUrl: rData.kopSuratUrl || '',
                  footerUrl: rData.footerUrl || ''
                });
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

            // PENDENGAR TES PEMAHAMAN
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
  // EFEK 2: PANTAU NILAI KADER & RAPORT (REAL-TIME)
  // ==========================================
  useEffect(() => {
    if (!selectedKaderNilai) return;
    
    const unsubscribeNilai = onSnapshot(doc(db, "nilai_khs", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists()) setNilaiKaderRealtime(docSnap.data());
      else setNilaiKaderRealtime({});
    });

    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", selectedKaderNilai), (docSnap) => {
      if (docSnap.exists() && docSnap.data()[selectedJenjangNilai]) {
        setEvaluasiKader(docSnap.data()[selectedJenjangNilai]);
      } else {
        setEvaluasiKader({ listKeaktifan: [], catatan: '' });
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
  // LOGIKA PERHITUNGAN RAPORT KHS (SKS & IP)
  // ==========================================
  let totalSks = 0;
  let totalBobotNilai = 0;

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
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
        <td className="no-print" style={{ padding: '6px 10px', textAlign: 'center' }}>
          {/* Versi Input untuk Layar Web */}
          <select 
            value={nilaiHuruf === "-" ? "" : nilaiHuruf} 
            onChange={(e) => handleUbahNilai(materi.kode, e.target.value)} 
            style={{ padding: '4px', border: `1px solid ${nilaiHuruf !== '-' ? '#f39c12' : '#ccc'}`, borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}
          >
            <option value="">-</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select>
        </td>
        {/* Versi Teks untuk Print PDF */}
        <td className="print-only-col" style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>
           {nilaiHuruf === "-" ? "" : nilaiHuruf}
        </td>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });

  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";
  const kaderDicetak = dataKader.find(k => k.nim === selectedKaderNilai) || {};

  const kategoriPenilaian = evaluasiKader.listKeaktifan?.length > 0 
    ? evaluasiKader.listKeaktifan.map(k => k.kategori) 
    : ['Pre-Test', 'Keaktifan', 'Tugas', 'Post-Test'];

  // ==========================================
  // FUNGSI SIMPAN EVALUASI KEAKTIFAN KADER
  // ==========================================
  const handleSimpanEvaluasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!selectedKaderNilai || !formKeaktifan.kategori) return;
    setIsSavingEvaluasi(true);
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { listKeaktifan: [], catatan: '' };
      const newList = [...jenjangData.listKeaktifan, { id: Date.now().toString(), kategori: formKeaktifan.kategori, nilai: formKeaktifan.nilai }];
      await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, listKeaktifan: newList } });
      setFormKeaktifan({ kategori: '', nilai: 0 });
      alert("Nilai Keaktifan Berhasil Ditambahkan!");
    } catch (error) { alert("Gagal menyimpan."); } finally { setIsSavingEvaluasi(false); }
  };

  const handleHapusEvaluasi = async (id: string) => {
    if(!window.confirm("Hapus item penilaian ini?")) return;
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data();
      const jenjangData = currentEvaluasi[selectedJenjangNilai];
      const newList = jenjangData.listKeaktifan.filter((item: any) => item.id !== id);
      await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, listKeaktifan: newList } });
    } catch (error) { alert("Gagal menghapus."); }
  };

  const handleSimpanCatatan = async (text: string) => {
    setEvaluasiKader({ ...evaluasiKader, catatan: text });
    try {
      const currentEvaluasi = (await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", selectedKaderNilai)))).docs[0]?.data() || {};
      const jenjangData = currentEvaluasi[selectedJenjangNilai] || { listKeaktifan: [], catatan: '' };
      await setDoc(doc(db, "evaluasi_kader", selectedKaderNilai), { ...currentEvaluasi, [selectedJenjangNilai]: { ...jenjangData, catatan: text } });
    } catch (error) { console.error(error); }
  };

  // ==========================================
  // FUNGSI SIMPAN PENGATURAN KOP & FOOTER
  // ==========================================
  const handleSimpanPengaturanCetak = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPengaturan(true);
    try {
      let newKop = pengaturanCetak.kopSuratUrl;
      let newFooter = pengaturanCetak.footerUrl;

      if (fileKop) newKop = await uploadToCloudinary(fileKop);
      if (fileFooter) newFooter = await uploadToCloudinary(fileFooter);

      await updateDoc(doc(db, "users", adminRayonId), {
        kopSuratUrl: newKop,
        footerUrl: newFooter
      });

      alert("Pengaturan Kop & Footer berhasil disimpan!");
      setFileKop(null);
      setFileFooter(null);
    } catch (error) {
      alert("Gagal menyimpan pengaturan cetak.");
    } finally {
      setIsSavingPengaturan(false);
    }
  };

  // ==========================================
  // FUNGSI MANAJEMEN TES PEMAHAMAN
  // ==========================================
  const handleBuatTes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTes.judul || !formTes.soal) return;
    
    const daftarSoalArray = formTes.soal.split('\n').filter(s => s.trim() !== '');

    try {
      await addDoc(collection(db, "master_tes"), {
        id_rayon: adminRayonId,
        judul: formTes.judul,
        jenjang: formTes.jenjang,
        daftar_soal: daftarSoalArray,
        status: 'Tutup', 
        timestamp: Date.now()
      });
      alert("Tes Pemahaman berhasil dibuat!");
      setFormTes({ judul: '', jenjang: 'MAPABA', soal: '' });
    } catch (error) {
      alert("Gagal membuat tes.");
    }
  };

  const handleToggleStatusTes = async (idTes: string, statusSaatIni: string) => {
    const statusAkanDatang = statusSaatIni === 'Buka' ? 'Tutup' : 'Buka';
    if (!window.confirm(`Anda yakin ingin mengubah status tes ini menjadi: ${statusAkanDatang}?`)) return;
    try {
      await updateDoc(doc(db, "master_tes", idTes), { status: statusAkanDatang });
    } catch (error) {
      alert("Gagal mengubah status tes.");
    }
  };

  const handleHapusTes = async (idTes: string) => {
    if (!window.confirm("Yakin ingin menghapus tes ini secara permanen?")) return;
    try {
      await deleteDoc(doc(db, "master_tes", idTes));
    } catch (error) {
      alert("Gagal menghapus tes.");
    }
  };

  const handleLihatHasilTes = async (tes: any) => {
    setSelectedTesHasil(tes);
    try {
      const q = query(collection(db, "jawaban_tes"), where("id_tes", "==", tes.id));
      const snap = await getDocs(q);
      const dataJawaban = snap.docs.map(doc => doc.data());
      dataJawaban.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setJawabanTesViewer(dataJawaban);
    } catch (error) {
      alert("Gagal memuat data jawaban kader.");
    }
  };

  // ==========================================
  // FUNGSI JENIS LAYANAN SURAT & SYARAT ISIAN
  // ==========================================
  const handleTambahJenisSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newJenisSurat.trim()) return;
    setIsSavingJenisSurat(true);
    try {
      await addDoc(collection(db, "master_jenis_surat"), { id_rayon: adminRayonId, jenis: newJenisSurat, syarat: newSyaratSurat, timestamp: Date.now() });
      setNewJenisSurat(''); setNewSyaratSurat(''); alert("Jenis layanan surat berhasil ditambahkan!");
    } catch(err) { alert("Gagal menambahkan jenis surat"); } finally { setIsSavingJenisSurat(false); }
  };

  const handleHapusJenisSurat = async (id: string) => {
     if(window.confirm("Hapus layanan surat ini? Kader tidak akan bisa memilihnya lagi.")) {
        await deleteDoc(doc(db, "master_jenis_surat", id));
     }
  };

  const handleFileSuratChange = (idSurat: string, file: File | null) => {
    setFileSuratBalasan(prev => ({ ...prev, [idSurat]: file }));
  };

  const handleAksiSurat = async (idSurat: string, aksi: 'Disetujui' | 'Ditolak') => {
    if (aksi === 'Ditolak') {
      if(!window.confirm("Yakin menolak pengajuan surat ini?")) return;
      try { await updateDoc(doc(db, "pengajuan_surat", idSurat), { status: aksi }); } catch (error) { alert("Terjadi kesalahan."); }
      return;
    }
    const fileBalasan = fileSuratBalasan[idSurat];
    if (!fileBalasan) return alert("Wajib mengunggah File Balasan Surat Resmi (PDF/JPG) terlebih dahulu!");
    setIsUploadingSurat(true);
    try {
      const fileUrl = await uploadToCloudinary(fileBalasan);
      await updateDoc(doc(db, "pengajuan_surat", idSurat), { status: aksi, file_balasan_url: fileUrl });
      alert("Surat berhasil disetujui dan dikirim ke Kader!");
    } catch (error) { alert("Gagal mengupload surat balasan."); } finally { setIsUploadingSurat(false); }
  };

  // FUNGSI HAPUS SURAT (BARU)
  const handleHapusSurat = async (idSurat: string) => {
    if (!window.confirm("Yakin ingin menghapus data pengajuan surat ini secara permanen?")) return;
    try {
      await deleteDoc(doc(db, "pengajuan_surat", idSurat));
      alert("Surat berhasil dihapus.");
    } catch (error) {
      alert("Gagal menghapus surat.");
    }
  };

  // ==========================================
  // FUNGSI MANAJEMEN AKUN & PEMBERSIHAN DATA KADALUARSA
  // ==========================================
  const handleUbahStatusAkun = async (idAkun: string, statusSekarang: string) => {
    const statusBaru = statusSekarang === "Aktif" ? "Pasif" : "Aktif";
    if (!window.confirm(`Yakin mengubah status akun ini menjadi ${statusBaru}?`)) return;
    try { await updateDoc(doc(db, "users", idAkun), { status: statusBaru }); } catch (error) { alert("Gagal mengubah status."); }
  };

  const handleHapusAkun = async (idAkun: string, nama: string) => {
    if (!window.confirm(`PERINGATAN! Anda akan menghapus akun "${nama}" secara permanen. Lanjutkan?`)) return;
    try { await deleteDoc(doc(db, "users", idAkun)); alert(`Akun ${nama} berhasil dihapus.`); } catch (error) { alert("Gagal menghapus akun."); }
  };

  const handleUbahPlottingPendamping = async (nimKader: string, pendampingBaru: string) => {
    try { await updateDoc(doc(db, "users", nimKader), { pendampingId: pendampingBaru }); } catch (error) { alert("Gagal memindahkan kader."); }
  };

  const handleUbahJenjangKader = async (nimKader: string, jenjangBaru: string) => {
    if (!window.confirm(`Pindahkan ke jenjang ${jenjangBaru}? Pendamping sebelumnya akan direset. Lanjutkan?`)) return;
    try { await updateDoc(doc(db, "users", nimKader), { jenjang: jenjangBaru, pendampingId: "" }); alert("Status Jenjang diperbarui."); } catch (error) { alert("Gagal mengubah jenjang."); }
  };

  const handleUbahJenjangPendamping = async (idPendamping: string, jenjangTugasBaru: string) => {
    try { await updateDoc(doc(db, "users", idPendamping), { jenjangTugas: jenjangTugasBaru }); } catch (error) { alert("Gagal mengubah penugasan."); }
  };

  const handleBersihkanDataKaderLama = async () => {
    const batasTahun = currentYear - 3; 

    const kaderExpired = dataKader.filter(k => {
      if (!k.createdAt) return false;
      const tahunKader = new Date(k.createdAt).getFullYear();
      return tahunKader <= batasTahun;
    });

    if (kaderExpired.length === 0) {
      alert(`Tidak ada data kader dari tahun ${batasTahun} ke bawah yang perlu dibersihkan.`);
      return;
    }

    const konfirmasi = window.confirm(`PERINGATAN BAHAYA!\n\nSistem mendeteksi ada ${kaderExpired.length} data kader dari angkatan ${batasTahun} dan sebelumnya.\n\nAnda akan MENGHAPUS PERMANEN data mereka dari database Rayon. Data ini tidak dapat dikembalikan.\n\nApakah Anda benar-benar yakin ingin melanjutkan pembersihan ini?`);
    
    if (!konfirmasi) return;

    setIsSubmitting(true);
    try {
      let deletedCount = 0;
      for (const kader of kaderExpired) {
        await deleteDoc(doc(db, "users", kader.id));
        await deleteDoc(doc(db, "nilai_khs", kader.nim));
        await deleteDoc(doc(db, "evaluasi_kader", kader.nim));
        deletedCount++;
      }
      alert(`Pembersihan Selesai! ${deletedCount} data kader lama berhasil dihapus permanen dari sistem.`);
    } catch (error) {
      alert("Terjadi kesalahan saat membersihkan data.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // FUNGSI LAINNYA
  // ==========================================
  const handleTarikMateriPusat = async (materiPusat: any) => {
    setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const newMateri = { id: Date.now().toString(), kode: materiPusat.kode, nama: materiPusat.nama, muatan: materiPusat.muatan || '', bobot: Number(materiPusat.bobot) };
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: [...currentList, newMateri] }, { merge: true });
    } catch (error) { alert("Gagal menarik materi."); } finally { setIsSavingKurikulum(false); }
  };

  const handleTambahMateriLokal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingKurikulum(true);
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const newMateri = { id: Date.now().toString(), kode: formMateri.kode, nama: formMateri.nama, muatan: formMateri.muatan, bobot: Number(formMateri.bobot) };
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: [...currentList, newMateri] }, { merge: true });
      setFormMateri({ kode: '', nama: '', muatan: '', bobot: 3 });
    } catch (error) { alert("Gagal menyimpan materi lokal."); } finally { setIsSavingKurikulum(false); }
  };

  const handleHapusMateri = async (materiId: string) => {
    if (!window.confirm("Yakin ingin menghapus kegiatan ini?")) return;
    try {
      const currentList = listKurikulum[tabKurikulum] || [];
      const filteredList = currentList.filter((m: any) => m.id !== materiId);
      await setDoc(doc(db, "kurikulum_rayon", adminRayonId), { [tabKurikulum]: filteredList }, { merge: true });
    } catch (error) { alert("Gagal menghapus materi."); }
  };

  const handleUbahNilai = async (kodeMateri: string, hurufNilai: string) => {
    if (!selectedKaderNilai) return alert("Pilih kader terlebih dahulu!");
    try { await setDoc(doc(db, "nilai_khs", selectedKaderNilai), { [kodeMateri]: hurufNilai, terakhirDiubah: Date.now(), diubahOleh: "Admin Rayon" }, { merge: true }); } catch (error) { console.error(error); }
  };

  const handleTambahTugas = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "master_tugas"), { id_rayon: adminRayonId, nama_tugas: formTugas.nama_tugas, deadline: formTugas.deadline, timestamp: Date.now() });
      setFormTugas({ nama_tugas: '', deadline: '' });
      alert("Tugas berhasil ditambahkan!");
    } catch (error) { alert("Gagal tambah tugas"); }
  };

  const handleHapusTugas = async (idTugas: string) => {
    if(window.confirm("Hapus tugas ini?")) await deleteDoc(doc(db, "master_tugas", idTugas));
  };

  const handleTambahPerpus = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!filePerpus) return alert("Pilih file dokumen/pdf dulu!");
    setIsUploadingPerpus(true);
    try {
      const fileUrl = await uploadToCloudinary(filePerpus); 
      await addDoc(collection(db, "perpustakaan"), { id_rayon: adminRayonId, folder: formPerpus.folder, nama_file: formPerpus.nama_file, link_file: fileUrl, timestamp: Date.now() });
      alert("Materi berhasil diupload!");
      setFormPerpus({ folder: '', nama_file: '' }); setFilePerpus(null);
    } catch (error) { alert("Gagal upload materi."); } finally { setIsUploadingPerpus(false); }
  };

  const handleHapusPerpus = async (idPerpus: string) => {
    if(window.confirm("Hapus materi ini?")) await deleteDoc(doc(db, "perpustakaan", idPerpus));
  };

  const getSecondaryAuth = () => {
    const apps = getApps();
    const secondaryApp = apps.find(app => app.name === 'SecondaryApp') || initializeApp(auth.app.options, 'SecondaryApp');
    return getAuth(secondaryApp);
  };

  const handleBuatAkunKader = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    const secondaryAuth = getSecondaryAuth();
    try {
      // PERBAIKAN: Menggunakan domain email khusus kader
      const emailBaru = `${formKader.nim}@pmii-uinmalang.or.id`.toLowerCase();
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formKader.password);
      await setDoc(doc(db, "users", formKader.nim), { nim: formKader.nim, nia: "", nama: formKader.nama, email: emailBaru, role: "kader", id_rayon: adminRayonId, jenjang: "MAPABA", pendampingId: formKader.pendampingId, status: "Aktif", createdAt: Date.now() });
      await signOutSecondary(secondaryAuth);
      alert(`Sukses buat Kader!`);
      setFormKader({ nim: '', nama: '', password: '', pendampingId: '' });
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  const handleBuatAkunPendamping = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    const secondaryAuth = getSecondaryAuth();
    try {
      // PERBAIKAN: Menggunakan domain email khusus
      const emailBaru = `${formPendamping.username}@pmii-uinmalang.or.id`.toLowerCase();
      await createUserWithEmailAndPassword(secondaryAuth, emailBaru, formPendamping.password);
      await setDoc(doc(db, "users", formPendamping.username), { 
        username: formPendamping.username, 
        nama: formPendamping.nama, 
        email: emailBaru, 
        role: "pendamping", 
        id_rayon: adminRayonId, 
        jumlahBinaan: 0, 
        status: "Aktif",
        jenjangTugas: formPendamping.jenjangTugas,
        createdAt: Date.now() 
      });
      await signOutSecondary(secondaryAuth);
      alert(`Sukses buat Pendamping untuk jenjang ${formPendamping.jenjangTugas}!`);
      setFormPendamping({ nama: '', username: '', password: '', jenjangTugas: 'MAPABA' });
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  const handleImportExcel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fileInput = (e.target as HTMLFormElement).elements[0] as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return alert("Pilih file excel terlebih dahulu!");
    setIsSubmitting(true); setImportProgress("Membaca file Excel...");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0]; 
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws); 
        if (data.length === 0) throw new Error("File Excel kosong / format salah.");
        const secondaryAuth = getSecondaryAuth();
        let successCount = 0; let errorCount = 0;
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i];
          const nim = String(row['NIM'] || row['nim'] || '').trim();
          const nama = row['Nama'] || row['nama'] || '';
          const tglLahir = String(row['TanggalLahir'] || row['tanggallahir'] || row['Password'] || '').trim();
          let pendamping = row['Pendamping'] || row['pendamping'] || '';
          if (!nim || !nama || !tglLahir) { errorCount++; continue; }
          setImportProgress(`Memproses: ${nama} (${i + 1}/${data.length})`);
          // PERBAIKAN: Menggunakan domain email khusus
          const emailBaru = `${nim}@pmii-uinmalang.or.id`.toLowerCase();
          try {
            await createUserWithEmailAndPassword(secondaryAuth, emailBaru, tglLahir);
            await setDoc(doc(db, "users", nim), { nim: nim, nia: "", nama: nama, email: emailBaru, role: "kader", id_rayon: adminRayonId, jenjang: "MAPABA", pendampingId: pendamping, status: "Aktif", createdAt: Date.now() });
            successCount++;
          } catch(err: any) { errorCount++; }
        }
        await signOutSecondary(secondaryAuth);
        alert(`Import Massal Selesai!\nBerhasil: ${successCount} Kader\nGagal/Dilewati: ${errorCount}`);
        fileInput.value = ''; 
      } catch (error: any) { alert("Error membaca Excel: " + error.message); } finally { setIsSubmitting(false); setImportProgress(''); }
    };
    reader.readAsBinaryString(file);
  };

  const handleLogout = () => { signOut(auth); router.push('/'); };

  const handleDownloadPDF = () => {
    window.print();
  };

  const filteredKader = dataKader.filter(k => 
    ((k.nama && k.nama.toLowerCase().includes(searchKader.toLowerCase())) || 
     (k.nim && k.nim.includes(searchKader))) &&
    (filterJenjangKader === '' || k.jenjang === filterJenjangKader)
  );

  const filteredPendamping = dataPendamping.filter(p => 
    (p.nama && p.nama.toLowerCase().includes(searchPendamping.toLowerCase())) || 
    (p.username && p.username.toLowerCase().includes(searchPendamping.toLowerCase()))
  );

  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'beranda': return 'Dashboard Statistik';
      case 'manajemen-akun': return 'Manajemen Akun User';
      case 'kurikulum': return 'Master Kurikulum Rayon';
      case 'pantau-nilai': return 'Raport & KHS Kader';
      case 'master-tugas': return 'Manajemen Tugas Kader';
      case 'verifikasi-surat': return 'Layanan Administrasi Surat';
      case 'perpus': return 'Perpustakaan Digital';
      case 'manajemen-tes': return 'Manajemen Tes Pemahaman';
      case 'saran': return 'Kotak Aspirasi Kader';
      default: return 'Dashboard Admin';
    }
  };

  const groupedPerpus = listPerpus.reduce((acc, item) => {
    if (!acc[item.folder]) acc[item.folder] = [];
    acc[item.folder].push(item);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      
      <style>{`
        @media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }
        
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 600px; }
        .tabel-utama thead tr { border-top: 2px solid #555; border-bottom: 2px solid #555; background-color: #fff; }
        .tabel-utama th { padding: 10px; color: #333; text-align: center; font-weight: bold; }
        .tabel-utama td { padding: 8px 10px; border-bottom: 1px solid #ddd; color: #333; }
        
        .print-layout-container { display: none; }
        
        /* ---------------------------------------------------- */
        /* STYLING KHUSUS SAAT MENCETAK (PDF) DENGAN BACKGROUND A4 */
        /* ---------------------------------------------------- */
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 0; /* Margin di-nol-kan agar gambar bisa full kertas */
          }
          body, html { background-color: #fff !important; margin: 0; padding: 0; }
          
          body * { visibility: hidden; display: none !important; }
          
          .print-layout-container, .print-layout-container * { 
            visibility: visible !important; 
            display: block;
            color: #000 !important; 
            font-family: Arial, sans-serif !important; 
            line-height: 1.15 !important;
          }
          
          .print-layout-container { 
            position: absolute !important; left: 0; top: 0; width: 100%; 
            background-color: transparent !important; 
          }
          
          /* GAMBAR A4 FULL SEBAGAI BACKGROUND BERULANG */
          .bg-kertas-a4 {
            position: fixed !important;
            top: 0; left: 0;
            width: 100%; height: 100vh;
            z-index: -1; /* Berada di belakang teks */
          }
          .bg-kertas-a4 img {
            width: 210mm !important;
            height: 297mm !important;
            object-fit: fill !important; 
          }

          /* AREA KONTEN MENYESUAIKAN GAMBAR A4 */
          .print-content-area {
            position: relative;
            z-index: 1;
            /* PENTING: Atur margin ini agar teks pas di tengah area putih KOP Anda */
            /* Angka 40mm adalah jarak dari Atas, dan Bawah */
            padding: 40mm 15mm 40mm 15mm !important; 
          }
          
          table { display: table !important; width: 100% !important; border-collapse: collapse !important; }
          tr { display: table-row !important; page-break-inside: avoid !important; }
          th, td { 
             display: table-cell !important;
             border: 1px solid #000 !important; 
             padding: 6px 8px !important; 
             font-size: 11pt !important; 
          }
          th { font-weight: bold !important; text-align: center !important; }
          
          .tabel-biodata { margin-bottom: 15px !important; width: 100% !important; border: none !important; }
          .tabel-biodata td { border: none !important; padding: 4px 0 !important; font-size: 11pt !important; }
          
          .no-print { display: none !important; } 
          
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* SIDEBAR ADMIN */}
      <aside className="no-print" style={{ 
        width: '260px', 
        background: 'linear-gradient(135deg, #1e824c 0%, #154360 100%)', 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column', 
        overflowY: 'auto',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: isSidebarOpen ? '0' : '-260px',
        zIndex: 50,
        transition: 'left 0.3s ease'
      }}>
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🏛️ SIAKAD PMII</span>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <h4 style={{ fontSize: '1rem', margin: 0, color: '#f1c40f', lineHeight: '1.4' }}>{namaRayonAsli || 'Memuat...'}</h4>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', margin: 0 }}>
          {[
            { id: 'beranda', icon: '🏠', label: 'Dashboard Statistik' },
            { id: 'verifikasi-surat', icon: '✉️', label: 'Layanan Surat', badge: suratMasuk.filter(s => s.status === 'Menunggu Verifikasi').length || null },
            { id: 'manajemen-akun', icon: '👥', label: 'Manajemen Akun' },
            { id: 'kurikulum', icon: '📚', label: 'Master Kurikulum' }, 
            { id: 'pantau-nilai', icon: '📊', label: 'Raport Kader' }, 
            { id: 'manajemen-tes', icon: '📝', label: 'Manajemen Tes Materi' },
            { id: 'master-tugas', icon: '📋', label: 'Penugasan Kader' }, 
            { id: 'perpus', icon: '📁', label: 'Perpustakaan Kader' }, 
            { id: 'saran', icon: '💬', label: 'Kotak Saran', badge: saranMasuk.length || null }, 
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

      {/* Konten Utama Container */}
      <main className="no-print" style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        marginLeft: '0', 
        width: '100%', 
        overflowX: 'hidden' 
      }}>
        
        {/* HEADER ATAS DINAMIS */}
        <header style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, textTransform: 'uppercase', fontWeight: 'bold' }}>
              {getHeaderTitle()}
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#1e824c', fontWeight: 'bold' }}>Admin: {adminRayonId}</div>
          </div>
        </header>

        {/* ISI KONTEN */}
        <div style={{ padding: '20px', flex: 1 }}>

          {/* MENU 0: BERANDA OVERVIEW */}
          {activeMenu === 'beranda' && (
            <div>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h2 style={{color: '#1e824c', marginTop: 0, fontSize: '1.5rem'}}>Selamat Datang di Pusat Kendali {namaRayonAsli}!</h2>
                <p style={{color: '#555', lineHeight: '1.6', margin: 0, fontSize: '0.9rem'}}>Kelola data kaderisasi, master tugas, surat, akun kader, dan perpustakaan secara real-time melalui panel ini.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.1rem' }}>📊 Overview Kaderisasi Rayon</h3>
                
                {/* FILTER TAHUN KADERISASI */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Filter Angkatan (Tahun Masuk):</label>
                  <select 
                    value={filterTahunBeranda} 
                    onChange={(e) => setFilterTahunBeranda(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #1e824c', fontWeight: 'bold', color: '#1e824c', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {daftarTahunUnik.map(thn => (
                      <option key={thn} value={thn}>{thn === 'Semua' ? 'Tampilkan Semua Data' : `Angkatan ${thn}`}</option>
                    ))}
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

              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                <h4 style={{ marginTop: 0, color: '#0d1b2a', marginBottom: '15px' }}>
                  Distribusi Jenjang Kader {filterTahunBeranda !== 'Semua' ? `(Angkatan ${filterTahunBeranda})` : ''}
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Jenjang Kaderisasi</th>
                      <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Jumlah Kader</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['MAPABA', 'PKD', 'SIG', 'SKP'].map((jenjang) => {
                      let count = 0;
                      if (jenjang === 'MAPABA') count = dataKaderDifilterTahun.filter(k => ['MAPABA', 'PKD', 'SIG', 'SKP'].includes(k.jenjang)).length;
                      else if (jenjang === 'PKD') count = dataKaderDifilterTahun.filter(k => ['PKD', 'SKP'].includes(k.jenjang)).length;
                      else if (jenjang === 'SIG') count = dataKaderDifilterTahun.filter(k => ['SIG', 'SKP'].includes(k.jenjang)).length;
                      else if (jenjang === 'SKP') count = dataKaderDifilterTahun.filter(k => k.jenjang === 'SKP').length;

                      return (
                        <tr key={jenjang} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d1b2a' }}>{jenjang}</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#3498db' }}>{count} Kader</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* MENU 1: VERIFIKASI SURAT & JENIS LAYANAN */}
          {activeMenu === 'verifikasi-surat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#1e824c', margin: 0, borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>Pengaturan Jenis Layanan Surat</h3>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  
                  <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
                    <h4 style={{marginTop: 0, marginBottom: '15px', color: '#333'}}>➕ Tambah Layanan Baru</h4>
                    <form onSubmit={handleTambahJenisSurat} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div>
                        <label style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px'}}>Nama / Jenis Surat</label>
                        <input type="text" placeholder="Misal: Surat Keterangan Aktif" required value={newJenisSurat} onChange={(e) => setNewJenisSurat(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px'}}>Keterangan / Isian Wajib (Dari Kader)</label>
                        <textarea rows={3} placeholder="Misal: Sebutkan nama kegiatan, tempat, dan tanggal pelaksanaan di kolom Keperluan." value={newSyaratSurat} onChange={(e) => setNewSyaratSurat(e.target.value)} required style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
                        <span style={{fontSize: '0.7rem', color: '#888'}}>Kader wajib membaca instruksi ini saat mengajukan surat.</span>
                      </div>
                      <button disabled={isSavingJenisSurat} type="submit" style={{ backgroundColor: '#2ecc71', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingJenisSurat ? 'not-allowed' : 'pointer', marginTop: '5px' }}>
                        {isSavingJenisSurat ? 'Menyimpan...' : 'Tambahkan Layanan'}
                      </button>
                    </form>
                  </div>

                  <div style={{ flex: '2 1 100%', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
                      <thead><tr style={{ backgroundColor: '#f8f9fa' }}><th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Jenis Surat</th><th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Syarat / Instruksi Isian Wajib</th><th style={{ padding: '15px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th></tr></thead>
                      <tbody>
                        {listJenisSurat.length === 0 ? (<tr><td colSpan={3} style={{textAlign: 'center', padding: '20px'}}>Belum ada jenis surat. Kader tidak bisa mengajukan surat.</td></tr>) : listJenisSurat.map((surat) => (
                          <tr key={surat.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '15px', fontWeight: 'bold' }}>{surat.jenis}</td>
                            <td style={{ padding: '15px', color: '#555', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{surat.syarat || '-'}</td>
                            <td style={{ padding: '15px', textAlign: 'center' }}><button onClick={() => handleHapusJenisSurat(surat.id)} style={{ color: 'white', backgroundColor: '#e74c3c', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>Hapus</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '400px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '1px' }}>DAFTAR PENGAJUAN SURAT KADER</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '20px' }}>
                    {suratMasuk.filter(s => s.status === 'Menunggu Verifikasi').length} Menunggu Verifikasi
                  </div>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#333', minWidth: '800px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '10px', fontWeight: 'bold' }}>NIM / Kader</th>
                          <th style={{ padding: '10px', fontWeight: 'bold' }}>Jenis Pengajuan</th>
                          <th style={{ padding: '10px', fontWeight: 'bold' }}>Isian Keperluan / Jawaban Syarat</th>
                          <th style={{ padding: '10px', fontWeight: 'bold' }}>Status</th>
                          <th style={{ padding: '10px', fontWeight: 'bold' }}>Upload Balasan Surat Manual</th>
                          <th style={{ padding: '10px', fontWeight: 'bold', textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suratMasuk.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada pengajuan surat masuk.</td></tr>
                        ) : (
                          suratMasuk.map((surat, index) => (
                            <tr key={surat.id} style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                              <td style={{ padding: '10px' }}><span style={{ fontWeight: 'bold', color: '#004a87' }}>{surat.email_kader.split('@')[0]}</span><br/><span style={{fontSize: '0.7rem', color: '#999'}}>{surat.tanggal}</span></td>
                              <td style={{ padding: '10px', fontWeight: 'bold' }}>{surat.jenis}</td>
                              <td style={{ padding: '10px', whiteSpace: 'pre-wrap', fontStyle: 'italic', color: '#555' }}>"{surat.keperluan}"</td>
                              <td style={{ padding: '10px', fontWeight: 'bold', color: surat.status === 'Menunggu Verifikasi' ? '#f39c12' : surat.status === 'Disetujui' ? '#27ae60' : '#c0392b' }}>{surat.status}</td>
                              
                              <td style={{ padding: '10px' }}>
                                {surat.status === 'Menunggu Verifikasi' ? (
                                  <input 
                                    type="file" 
                                    accept=".pdf, .jpg, .png"
                                    onChange={(e) => handleFileSuratChange(surat.id, e.target.files ? e.target.files[0] : null)}
                                    style={{ padding: '4px', fontSize: '0.75rem', maxWidth: '180px' }}
                                  />
                                ) : surat.status === 'Disetujui' && surat.file_balasan_url ? (
                                  <a href={surat.file_balasan_url} target="_blank" style={{ color: 'blue', textDecoration: 'none', fontWeight: 'bold' }}>Lihat Balasan</a>
                                ) : (
                                  <span style={{ color: '#ccc' }}>-</span>
                                )}
                              </td>

                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                {surat.status === 'Menunggu Verifikasi' ? (
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button disabled={isUploadingSurat} onClick={() => handleAksiSurat(surat.id, 'Disetujui')} style={{ background: '#27ae60', border: 'none', color: 'white', cursor: isUploadingSurat ? 'not-allowed' : 'pointer', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                      {isUploadingSurat ? '...' : 'Setujui & Kirim'}
                                    </button>
                                    <button disabled={isUploadingSurat} onClick={() => handleAksiSurat(surat.id, 'Ditolak')} style={{ background: '#c0392b', border: 'none', color: 'white', cursor: isUploadingSurat ? 'not-allowed' : 'pointer', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                      Tolak
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <span style={{ color: '#95a5a6' }}>👁️ Selesai</span>
                                    <button onClick={() => handleHapusSurat(surat.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem' }} title="Hapus Permanen">🗑️</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <p style={{fontSize: '0.75rem', color: '#888', marginTop: '10px'}}>*Untuk menyetujui surat, Anda wajib mengupload file balasan yang sudah ditandatangani secara manual (PDF/Foto) terlebih dahulu.</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* MENU 2: MANAJEMEN AKUN & PLOTTING */}
          {activeMenu === 'manajemen-akun' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabAkun('kader')} style={{ padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkun === 'kader' ? '#1e824c' : '#f4f6f9', color: tabAkun === 'kader' ? 'white' : '#555', flex: '1 1 auto', textAlign: 'center', fontSize: '0.85rem' }}>🎓 Akun Kader</button>
                <button onClick={() => setTabAkun('pendamping')} style={{ padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabAkun === 'pendamping' ? '#1e824c' : '#f4f6f9', color: tabAkun === 'pendamping' ? 'white' : '#555', flex: '1 1 auto', textAlign: 'center', fontSize: '0.85rem' }}>👤 Akun Pendamping</button>
              </div>

              {tabAkun === 'kader' && (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  
                  <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ backgroundColor: '#fdfdfd', padding: '15px', border: '1px solid #eee', borderRadius: '8px' }}>
                      <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>✏️ Buat Akun Satuan</h4>
                      <form onSubmit={handleBuatAkunKader} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        <input type="number" placeholder="NIM Kader" value={formKader.nim} onChange={e => setFormKader({...formKader, nim: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
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
                      <p style={{fontSize: '0.75rem', color: '#555', margin: '5px 0'}}>Format Kolom di Excel wajib persis seperti ini (perhatikan besar/kecil huruf): <br/><b>NIM | Nama | TanggalLahir | Pendamping</b></p>
                      <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input type="file" accept=".xlsx, .xls" required style={{ padding: '6px', border: '1px dashed #1e824c', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.8rem' }} />
                        <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#1e824c', color: 'white', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
                          🚀 Proses Data Excel
                        </button>
                        {importProgress && <div style={{fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold', textAlign: 'center'}}>{importProgress}</div>}
                      </form>
                    </div>

                    {/* KARTU PEMBERSIHAN DATA */}
                    <div style={{ backgroundColor: '#fff5f5', padding: '15px', border: '1px solid #ffcdd2', borderRadius: '8px' }}>
                      <h4 style={{ marginTop: 0, color: '#c62828', borderBottom: '1px dashed #ef9a9a', paddingBottom: '8px' }}>🧹 Pembersihan Data</h4>
                      <p style={{fontSize: '0.75rem', color: '#555', margin: '5px 0 10px 0'}}>Hapus permanen data kader angkatan lama (lebih dari 3 tahun) untuk meringankan beban database.</p>
                      <button onClick={handleBersihkanDataKaderLama} disabled={isSubmitting} style={{ backgroundColor: '#c62828', color: 'white', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', width: '100%', border: 'none', fontSize: '0.85rem' }}>
                         🗑️ Bersihkan Data Kadaluarsa
                      </button>
                    </div>

                  </div>
                  
                  <div style={{ flex: '2 1 500px', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: 0, color: '#1e824c', fontSize: '0.95rem' }}>🔄 Daftar Kader, Plotting & Jenjang</h4>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <select 
                          value={filterJenjangKader} 
                          onChange={(e) => setFilterJenjangKader(e.target.value)} 
                          style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          <option value="">Semua Jenjang</option>
                          <option value="MAPABA">MAPABA</option>
                          <option value="PKD">PKD</option>
                          <option value="SIG">SIG</option>
                          <option value="SKP">SKP</option>
                        </select>

                        <input 
                          type="text" 
                          placeholder="🔍 Cari NIM atau Nama..." 
                          value={searchKader} 
                          onChange={(e) => setSearchKader(e.target.value)} 
                          style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem' }} 
                        />
                      </div>
                    </div>
                    
                    <div style={{ overflowX: 'auto', flex: 1 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '800px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', color: '#333', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>NIM / Tahun</th>
                            <th style={{ padding: '10px' }}>Nama Kader</th>
                            <th style={{ padding: '10px' }}>Jenjang (Ubah)</th>
                            <th style={{ padding: '10px' }}>Pendamping Saat Ini</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Hapus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredKader.length === 0 ? (
                            <tr><td colSpan={6} style={{textAlign: 'center', padding: '20px', color: '#999'}}>Tidak ada data kader yang cocok.</td></tr>
                          ) : (
                            filteredKader.map((k) => {
                              const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                              return (
                                <tr key={k.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#555' }}>
                                    {k.nim} <br/> <span style={{fontSize: '0.7rem', color: '#1e824c'}}>Agt. {thnMasuk}</span>
                                  </td>
                                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#333' }}>{k.nama}</td>
                                  
                                  <td style={{ padding: '10px' }}>
                                    <select 
                                      value={k.jenjang || "MAPABA"} 
                                      onChange={(e) => handleUbahJenjangKader(k.nim, e.target.value)}
                                      style={{ padding: '4px', border: '1px solid #3498db', borderRadius: '4px', backgroundColor: '#eaf4fc', fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '100px', fontSize: '0.75rem', color: '#2c3e50' }}
                                    >
                                      <option value="MAPABA">MAPABA</option>
                                      <option value="PKD">PKD</option>
                                      <option value="SIG">SIG</option>
                                      <option value="SKP">SKP</option>
                                    </select>
                                  </td>

                                  <td style={{ padding: '10px' }}>
                                     <select 
                                       value={k.pendampingId || ""} 
                                       onChange={(e) => handleUbahPlottingPendamping(k.nim, e.target.value)}
                                       style={{ padding: '4px', border: '1px solid #2ecc71', borderRadius: '4px', backgroundColor: '#fff', fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '130px', fontSize: '0.75rem' }}
                                     >
                                       <option value="">- Kosong -</option>
                                       {dataPendamping.map(p => <option key={p.id} value={p.username}>{p.nama}</option>)}
                                     </select>
                                  </td>
                                  
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <button onClick={() => handleUbahStatusAkun(k.id, k.status)} style={{ padding: '4px 6px', border: 'none', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: k.status === 'Aktif' ? '#e8f5e9' : '#ffebee', color: k.status === 'Aktif' ? '#2e7d32' : '#c62828' }}>
                                      {k.status === 'Aktif' ? '🟢 Aktif' : '🔴 Pasif'}
                                    </button>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <button onClick={() => handleHapusAkun(k.id, k.nama)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Permanen">🗑️</button>
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
                  
                  <div style={{ flex: '1 1 300px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>✏️ Buat Akun Pendamping</h4>
                    <form onSubmit={handleBuatAkunPendamping} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                      <input type="text" placeholder="Nama Lengkap Pendamping" value={formPendamping.nama} onChange={e => setFormPendamping({...formPendamping, nama: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                      <input type="text" placeholder="Username (contoh: ridwan.aw)" value={formPendamping.username} onChange={e => setFormPendamping({...formPendamping, username: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                      <input type="text" placeholder="Password Sementara" value={formPendamping.password} onChange={e => setFormPendamping({...formPendamping, password: e.target.value})} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                      
                      <select required value={formPendamping.jenjangTugas} onChange={e => setFormPendamping({...formPendamping, jenjangTugas: e.target.value})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', color: '#2c3e50', fontSize: '0.85rem' }}>
                        <option value="MAPABA">Tugas Pendamping MAPABA</option>
                        <option value="PKD">Tugas Pendamping PKD</option>
                        <option value="SIG">Tugas Pendamping SIG</option>
                        <option value="SKP">Tugas Pendamping SKP</option>
                      </select>

                      <button disabled={isSubmitting} type="submit" style={{ backgroundColor: isSubmitting ? '#95a5a6' : '#1e824c', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Buat Akun</button>
                    </form>
                  </div>

                  <div style={{ flex: '2 1 500px', overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, color: '#1e824c', fontSize: '0.95rem' }}>📋 Daftar Pendamping</h4>
                      <input 
                        type="text" 
                        placeholder="🔍 Cari Nama/Username..." 
                        value={searchPendamping} 
                        onChange={(e) => setSearchPendamping(e.target.value)} 
                        style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none', fontSize: '0.8rem' }} 
                      />
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '500px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', color: '#333', textAlign: 'left' }}>
                          <th style={{ padding: '10px' }}>Nama Pendamping</th>
                          <th style={{ padding: '10px' }}>Username</th>
                          <th style={{ padding: '10px' }}>Tugas Jenjang</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPendamping.length === 0 ? (
                          <tr><td colSpan={5} style={{textAlign: 'center', padding: '20px', color: '#999'}}>Tidak ada data pendamping yang cocok.</td></tr>
                        ) : (
                          filteredPendamping.map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.nama}</td>
                              <td style={{ padding: '10px' }}>{p.username}</td>
                              <td style={{ padding: '10px' }}>
                                <select 
                                  value={p.jenjangTugas || "MAPABA"} 
                                  onChange={(e) => handleUbahJenjangPendamping(p.id, e.target.value)}
                                  style={{ padding: '4px', border: '1px solid #3498db', borderRadius: '4px', backgroundColor: '#eaf4fc', fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '120px', fontSize: '0.75rem', color: '#2c3e50' }}
                                >
                                  <option value="MAPABA">MAPABA</option>
                                  <option value="PKD">PKD</option>
                                  <option value="SIG">SIG</option>
                                  <option value="SKP">SKP</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <button onClick={() => handleUbahStatusAkun(p.id, p.status || 'Aktif')} style={{ padding: '4px 8px', border: 'none', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: (!p.status || p.status === 'Aktif') ? '#e8f5e9' : '#ffebee', color: (!p.status || p.status === 'Aktif') ? '#2e7d32' : '#c62828' }}>
                                  {(!p.status || p.status === 'Aktif') ? '🟢 Aktif' : '🔴 Pasif'}
                                </button>
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <button onClick={() => handleHapusAkun(p.id, p.nama)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus Permanen">🗑️</button>
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

          {/* ========================================================= */}
          {/* MENU 3: KURIKULUM (SISTEM CEKLIS & LOKAL) */}
          {/* ========================================================= */}
          {activeMenu === 'kurikulum' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '500px', overflow: 'hidden' }}>
              <div style={{ padding: '20px' }}>
                <p style={{fontSize: '0.85rem', color: '#666', marginBottom: '15px'}}>Pilih materi dari referensi pusat, atau tambahkan materi muatan lokal khusus rayon Anda.</p>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button onClick={() => setTabKurikulum('MAPABA')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'MAPABA' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'MAPABA' ? 'white' : '#555', fontSize: '0.85rem' }}>📘 MAPABA</button>
                  <button onClick={() => setTabKurikulum('PKD')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'PKD' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'PKD' ? 'white' : '#555', fontSize: '0.85rem' }}>📙 PKD</button>
                  <button onClick={() => setTabKurikulum('SIG')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'SIG' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'SIG' ? 'white' : '#555', fontSize: '0.85rem' }}>📕 SIG</button>
                  <button onClick={() => setTabKurikulum('SKP')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'SKP' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'SKP' ? 'white' : '#555', fontSize: '0.85rem' }}>👩 SKP</button>
                  <button onClick={() => setTabKurikulum('NONFORMAL')} style={{ padding: '8px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabKurikulum === 'NONFORMAL' ? '#1e824c' : '#f4f6f9', color: tabKurikulum === 'NONFORMAL' ? 'white' : '#555', fontSize: '0.85rem' }}>📗 Non-Formal</button>
                </div>
                
                <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{backgroundColor: '#eef2f3', padding: '12px 15px', borderBottom: '1px solid #ddd'}}>
                    <h4 style={{margin: 0, color: '#0d1b2a', fontSize: '0.9rem'}}>✅ Kurikulum Rayon Saat Ini ({tabKurikulum})</h4>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', minWidth: '450px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                        <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '40px' }}>No</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Kode</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Nama Kegiatan & Muatan</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Bobot</th><th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!listKurikulum[tabKurikulum] || listKurikulum[tabKurikulum].length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Rayon belum memiliki kurikulum di jenjang ini.</td></tr>
                      ) : (
                        listKurikulum[tabKurikulum].map((materi, idx) => (
                          <tr key={materi.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{idx + 1}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#004a87' }}>{materi.kode}</td>
                            <td style={{ padding: '10px' }}>
                              <div style={{color: '#333', fontWeight: 'bold'}}>{materi.nama}</div>
                              <div style={{color: '#777', fontSize: '0.7rem', whiteSpace: 'pre-wrap'}}>{materi.muatan || '-'}</div>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{materi.bobot}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={() => handleHapusMateri(materi.id)} style={{ color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Hapus</button></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 400px', backgroundColor: '#fdfdfd', padding: '15px', borderRadius: '8px', border: '1px dashed #b2c2cf' }}>
                    <h4 style={{ color: '#0d1b2a', marginTop: 0, marginBottom: '10px', fontSize: '0.9rem' }}>📌 Referensi Kurikulum Standar Pusat</h4>
                    <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #eee' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                        <thead><tr style={{ backgroundColor: '#0d1b2a', color: 'white' }}><th style={{ padding: '8px' }}>Kode</th><th style={{ padding: '8px' }}>Materi Pusat</th><th style={{ padding: '8px', textAlign: 'center' }}>Aksi</th></tr></thead>
                        <tbody>
                          {masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).length === 0 ? (
                            <tr><td colSpan={3} style={{ textAlign: 'center', padding: '15px', color: '#999' }}>Pusat belum menetapkan standar materi ini.</td></tr>
                          ) : (
                            masterKurikulumPusat.filter(m => m.jenjang === tabKurikulum).map((materiPusat) => {
                              const currentList = listKurikulum[tabKurikulum] || [];
                              const isAlreadyAdded = currentList.some(m => m.kode === materiPusat.kode || m.nama === materiPusat.nama);

                              return (
                                <tr key={materiPusat.id} style={{ borderBottom: '1px solid #eee', backgroundColor: isAlreadyAdded ? '#f9f9f9' : 'white' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold', color: isAlreadyAdded ? '#999' : '#333' }}>{materiPusat.kode}</td>
                                  <td style={{ padding: '8px' }}>
                                    <div style={{fontWeight: 'bold', color: isAlreadyAdded ? '#999' : '#333'}}>{materiPusat.nama}</div>
                                    <div style={{fontSize: '0.7rem', color: '#888', whiteSpace: 'pre-wrap'}}>{materiPusat.muatan}</div>
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center' }}>
                                    {isAlreadyAdded ? (
                                      <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.75rem' }}>✅ Dipakai</span>
                                    ) : (
                                      <button 
                                        onClick={() => handleTarikMateriPusat(materiPusat)} 
                                        disabled={isSavingKurikulum}
                                        style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem' }}
                                      >
                                        ➕ Pakai
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ flex: '1 1 250px', backgroundColor: '#f0fbf4', padding: '15px', border: '1px solid #c8e6c9', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    <h4 style={{ marginTop: 0, color: '#1e824c', borderBottom: '1px dashed #a5d6a7', paddingBottom: '8px', fontSize: '0.9rem' }}>📝 Tambah Materi Lokal/Lainnya</h4>
                    <form onSubmit={handleTambahMateriLokal} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                      <input type="text" placeholder="Kode (Misal: LOKAL-01)" required value={formMateri.kode} onChange={(e) => setFormMateri({...formMateri, kode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem' }} />
                      <input type="text" placeholder="Nama Materi Lokal" required value={formMateri.nama} onChange={(e) => setFormMateri({...formMateri, nama: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem' }} />
                      <textarea rows={2} placeholder="Muatan / Pembahasan (Opsional)" value={formMateri.muatan} onChange={(e) => setFormMateri({...formMateri, muatan: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontSize: '0.8rem' }} />
                      <input type="number" placeholder="Bobot SKS/Jam" required value={formMateri.bobot} onChange={(e) => setFormMateri({...formMateri, bobot: Number(e.target.value)})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem' }} />
                      <button disabled={isSavingKurikulum} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Tambahkan Lokal</button>
                    </form>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MENU 4: PANTAU NILAI / RAPORT KADER (UPDATE PRINT PDF) */}
          {/* ========================================================= */}
          {activeMenu === 'pantau-nilai' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 0', gap: '15px', borderBottom: '1px solid #ddd', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Pilih Kader:</span>
                  <select value={selectedKaderNilai} onChange={(e) => setSelectedKaderNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', minWidth: '180px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {dataKader.length === 0 && <option value="">Tidak ada kader</option>}
                    {dataKader.map(k => {
                      const thnMasuk = k.createdAt ? new Date(k.createdAt).getFullYear() : '-';
                      return <option key={k.nim} value={k.nim}>{k.nama} ({thnMasuk})</option>
                    })}
                  </select>
                  
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginLeft: '5px' }}>Jenjang:</span>
                  <select value={selectedJenjangNilai} onChange={(e) => setSelectedJenjangNilai(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #2c3e50', borderRadius: '4px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', backgroundColor: '#eef2f3', color: '#2c3e50', fontSize: '0.85rem' }}>
                    <option value="MAPABA">MAPABA</option><option value="PKD">PKD</option><option value="SIG">SIG</option><option value="SKP">SKP</option><option value="NONFORMAL">Non-Formal</option>
                  </select>
                  
                  {/* TOMBOL CETAK ADMIN RAYON */}
                  {tabRaportAdmin === 'raport' && selectedKaderNilai && (
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                      🖨️ Cetak KHS
                    </button>
                  )}
                </div>
              </div>
              
              <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '15px', flexWrap: 'wrap' }}>
                <button onClick={() => setTabRaportAdmin('raport')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'raport' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'raport' ? '#fff' : 'transparent', color: tabRaportAdmin === 'raport' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>📑 Raport Kaderisasi</button>
                <button onClick={() => setTabRaportAdmin('persentase')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'persentase' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'persentase' ? '#fff' : 'transparent', color: tabRaportAdmin === 'persentase' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', fontSize: '0.85rem' }}>📊 Evaluasi Keaktifan</button>
                
                {/* TAB PENGATURAN KOP CETAK */}
                <button onClick={() => setTabRaportAdmin('pengaturan')} style={{ padding: '10px 15px', border: '1px solid', borderColor: tabRaportAdmin === 'pengaturan' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaportAdmin === 'pengaturan' ? '#fff' : 'transparent', color: tabRaportAdmin === 'pengaturan' ? '#555' : '#e67e22', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderRadius: '4px 4px 0 0', marginLeft: 'auto', fontSize: '0.85rem' }}>⚙️ Pengaturan Cetak</button>
              </div>

              {tabRaportAdmin === 'raport' && (
                <div id="area-cetak-raport" style={{ overflowX: 'auto', padding: '10px 0' }}>
                  
                  <div className="print-only-container" style={{ display: 'none' }}>
                    {pengaturanCetak.kopSuratUrl && (
                      <div className="print-kop-surat">
                        <img src={pengaturanCetak.kopSuratUrl} alt="Kop Surat" />
                      </div>
                    )}
                  </div>
                  
                  <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '15px 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI</h3>
                  
                  <table className="tabel-biodata">
                    <tbody>
                      <tr><td style={{width: '200px'}}>Nama Kader</td><td style={{width: '15px'}}>:</td><td>{kaderDicetak.nama || '-'}</td></tr>
                      <tr><td>NIM</td><td>:</td><td>{kaderDicetak.nim || '-'}</td></tr>
                      <tr><td>Angkatan</td><td>:</td><td>{kaderDicetak.createdAt ? new Date(kaderDicetak.createdAt).getFullYear() : '-'}</td></tr>
                      <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{selectedJenjangNilai}</td></tr>
                    </tbody>
                  </table>

                  {/* TABEL TUNGGAL ADMIN MIRIP KADER */}
                  <table className="tabel-utama">
                    <thead>
                      <tr>
                        <th style={{ width: '5%' }}>No</th>
                        <th style={{ width: '20%', textAlign: 'left' }}>Kode Matakuliah</th>
                        <th style={{ width: '45%', textAlign: 'left' }}>Nama Matakuliah</th>
                        <th style={{ width: '10%' }}>SKS</th>
                        <th className="no-print" style={{ width: '10%' }}>Nilai / Input</th>
                        <th className="print-only-header" style={{ display: 'none', width: '10%' }}>Nilai Huruf</th>
                        <th style={{ width: '10%' }}>SKS x Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiAktif.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur oleh Pengurus Rayon.</td></tr>
                      ) : barisRaportRender}
                      
                      <tr style={{ borderTop: '2px solid #ccc' }}>
                        <td colSpan={3} className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                        <td className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                        <td className="no-print"></td>
                        <td className="print-only-col col-cetak" style={{ display: 'none' }}></td>
                        <td className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                      </tr>
                      <tr style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}>
                        <td colSpan={5} className="no-print col-cetak" style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>IPK (Indeks Prestasi Kader)</td>
                        <td colSpan={5} className="print-only-col col-cetak" style={{ display: 'none', padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '11pt' }}>IPK (Indeks Prestasi Kader)</td>
                        <td className="col-cetak" style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>{ipKader}</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <div className="print-only-container" style={{ display: 'none' }}>
                    <div className="print-footer-container">
                      {pengaturanCetak.footerUrl && (
                        <img src={pengaturanCetak.footerUrl} alt="Footer / Tanda Tangan" />
                      )}
                    </div>
                  </div>

                </div>
              )}

              {tabRaportAdmin === 'persentase' && (
                <div style={{ overflowX: 'auto', padding: '10px 0' }}>
                  
                  {/* FORM INPUT EVALUASI (KHUSUS ADMIN/PENDAMPING) */}
                  <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '15px', background: '#f8f9fa', padding: '15px', borderRadius: '6px', border: '1px solid #eee', flexWrap: 'wrap' }}>
                    <input type="text" placeholder="Kategori (Cth: Pre-Test, Presensi)" value={formKeaktifan.kategori} onChange={e => setFormKeaktifan({...formKeaktifan, kategori: e.target.value})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: '1 1 200px', fontSize: '0.85rem' }} />
                    <input type="number" placeholder="Nilai %" value={formKeaktifan.nilai || ''} onChange={e => setFormKeaktifan({...formKeaktifan, nilai: Number(e.target.value)})} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: '0 0 100px', fontSize: '0.85rem' }} />
                    <button onClick={handleSimpanEvaluasi} disabled={isSavingEvaluasi || !selectedKaderNilai} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: (!selectedKaderNilai || isSavingEvaluasi) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>➕ Tambah Nilai</button>
                  </div>

                  <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ width: '3%' }}>No</th>
                        <th rowSpan={2} style={{ width: '12%', textAlign: 'left' }}>Kode Matakuliah</th>
                        <th rowSpan={2} style={{ width: '20%', textAlign: 'left' }}>Nama Matakuliah</th>
                        <th colSpan={kategoriPenilaian.length} style={{ borderBottom: '1px solid #ddd' }}>Persentase</th>
                        <th colSpan={kategoriPenilaian.length} style={{ borderBottom: '1px solid #ddd' }}>Nilai Detil</th>
                        <th rowSpan={2} style={{ width: '5%' }}>SKS</th>
                        <th colSpan={2} style={{ borderBottom: '1px solid #ddd' }}>Nilai Akhir</th>
                        <th rowSpan={2} style={{ width: '8%' }}>SKS x Nilai Huruf</th>
                      </tr>
                      <tr>
                        {/* Sub-Header Persentase */}
                        {kategoriPenilaian.map(kat => <th key={`p-${kat}`} style={{ fontSize: '0.7rem', padding: '4px 5px', color: '#555' }}>
                          {kat} 
                          <button className="no-print" onClick={() => handleHapusEvaluasi(evaluasiKader.listKeaktifan.find(k => k.kategori === kat)?.id)} style={{ display: 'block', margin: '4px auto 0', color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem' }}>Hapus</button>
                        </th>)}
                        {/* Sub-Header Nilai Detil */}
                        {kategoriPenilaian.map(kat => <th key={`n-${kat}`} style={{ fontSize: '0.7rem', padding: '4px 5px', color: '#555' }}>{kat}</th>)}
                        {/* Sub-Header Nilai Akhir */}
                        <th style={{ fontSize: '0.7rem', padding: '4px 5px', color: '#555' }}>Angka</th>
                        <th style={{ fontSize: '0.7rem', padding: '4px 5px', color: '#555' }}>Huruf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiAktif.length === 0 ? (
                        <tr><td colSpan={6 + (kategoriPenilaian.length * 2)} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada rincian nilai.</td></tr>
                      ) : (
                        materiAktif.map((materi, index) => {
                          const nilaiHuruf = nilaiKaderRealtime[materi.kode] || "-";
                          const angkaNilai = konversiHurufKeAngka(nilaiHuruf);
                          const sksKaliNilai = (materi.bobot || 0) * angkaNilai;
                          
                          return (
                            <tr key={`rinci-${materi.kode}`}>
                              <td>{index + 1}</td>
                              <td style={{ textAlign: 'left' }}>{materi.kode}</td>
                              <td style={{ textAlign: 'left' }}>{materi.nama}</td>
                              
                              {/* Mapping Persentase (Mock Tampilan Berdasarkan Data Keaktifan) */}
                              {kategoriPenilaian.map((kat, i) => {
                                const nilaiPersen = evaluasiKader.listKeaktifan.find(k => k.kategori === kat)?.nilai || 0;
                                return <td key={`vp-${i}`} style={{ color: '#888', fontSize: '0.8rem' }}>{nilaiPersen}%</td>
                              })}
                              
                              {/* Mapping Nilai Detil (Mock Tampilan) */}
                              {kategoriPenilaian.map((_, i) => <td key={`vn-${i}`} style={{ color: '#888', fontSize: '0.8rem' }}>-</td>)}
                              
                              <td>{materi.bobot}</td>
                              <td>{nilaiHuruf !== '-' ? (angkaNilai * 25) : '-'}</td>
                              <td style={{ fontWeight: 'bold' }}>
                                {/* Fitur Edit Nilai di Tab Evaluasi */}
                                <select 
                                  className="no-print"
                                  value={nilaiHuruf === "-" ? "" : nilaiHuruf} 
                                  onChange={(e) => handleUbahNilai(materi.kode, e.target.value)} 
                                  style={{ padding: '2px', border: `1px solid ${nilaiHuruf !== '-' ? '#f39c12' : '#ccc'}`, borderRadius: '4px', cursor: 'pointer', outline: 'none' }}
                                >
                                  <option value="">-</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                                </select>
                                <span className="print-only-inline" style={{ display: 'none' }}>{nilaiHuruf === "-" ? "" : nilaiHuruf}</span>
                              </td>
                              <td>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
                            </tr>
                          )
                        })
                      )}
                      <tr>
                        <td colSpan={3 + (kategoriPenilaian.length * 2)} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                        <td colSpan={2}></td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                      </tr>
                      <tr>
                        <td colSpan={5 + (kategoriPenilaian.length * 2)} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kaderisasi)</td>
                        <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{ipKader}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="no-print" style={{ marginTop: '20px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Catatan Khusus untuk Kader Ini:</label>
                    <textarea 
                      value={evaluasiKader.catatan} 
                      onChange={e => handleSimpanCatatan(e.target.value)} 
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', height: '60px', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box' }} 
                      placeholder="Tulis catatan perkembangan kader disini..." 
                    />
                  </div>
                </div>
              )}

              {/* TAB PENGATURAN KOP CETAK */}
              {tabRaportAdmin === 'pengaturan' && (
                <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}>
                  <form onSubmit={handleSimpanPengaturanCetak} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
                    <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px', borderLeft: '4px solid #f1c40f', fontSize: '0.8rem', color: '#856404', lineHeight: '1.4' }}>
                      <b>PENTING:</b> Gunakan Gambar <b>Ukuran Kertas A4 (PNG/JPG)</b> yang berisi desain KOP SURAT di bagian atas dan TANDA TANGAN di bagian bawah. Bagian tengah gambar harus putih kosong. Gambar ini akan menjadi background pada saat cetak PDF.
                    </div>

                    <div>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#333', fontSize: '0.85rem' }}>Upload Template Background A4</label>
                      {pengaturanCetak.kopSuratUrl && <img src={pengaturanCetak.kopSuratUrl} alt="Kop Saat Ini" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '10px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '5px' }} />}
                      <input type="file" accept="image/png, image/jpeg" onChange={(e) => setFileKop(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #ccc', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box', fontSize: '0.8rem' }} />
                    </div>
                    
                    <button type="submit" disabled={isSavingPengaturan} style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingPengaturan ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                      {isSavingPengaturan ? 'Mengupload...' : '💾 Simpan Template A4'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* MENU 6: MANAJEMEN TES PEMAHAMAN (MENU BARU) */}
          {/* ========================================================= */}
          {activeMenu === 'manajemen-tes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {selectedTesHasil ? (
                // TAMPILAN LIHAT HASIL TES KADER
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', padding: '20px' }}>
                  <button className="no-print" onClick={() => setSelectedTesHasil(null)} style={{ marginBottom: '15px', padding: '6px 12px', backgroundColor: '#f1c40f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                    ⬅️ Kembali
                  </button>
                  
                  <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ color: '#1e824c', margin: '0 0 10px 0', fontSize: '1.1rem' }}>Data Hasil: {selectedTesHasil.judul} ({selectedTesHasil.jenjang})</h3>
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                      🖨️ Cetak Semua Hasil
                    </button>
                  </div>
                  
                  <div style={{ overflowX: 'auto' }} id="area-cetak-tes">
                    <div className="print-only-container" style={{ display: 'none' }}>
                      {pengaturanCetak.kopSuratUrl && (
                        <div className="print-kop-surat">
                          <img src={pengaturanCetak.kopSuratUrl} alt="Kop Surat" />
                        </div>
                      )}
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '15px 0 15px 0', fontSize: '12pt', textTransform: 'uppercase' }}>REKAP JAWABAN: {selectedTesHasil.judul}</h3>
                    </div>

                    <table className="tabel-utama" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '800px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '15%' }}>Waktu Submit</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '15%' }}>NIM</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '25%' }}>Nama Kader</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '45%' }}>Jawaban Kader</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jawabanTesViewer.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada jawaban terkumpul.</td></tr>
                        ) : (
                          jawabanTesViewer.map((jawab: any) => (
                            <tr key={jawab.nim} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px', verticalAlign: 'top' }}>{jawab.tanggal}</td>
                              <td style={{ padding: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nim}</td>
                              <td style={{ padding: '10px', color: '#004a87', fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nama}</td>
                              <td style={{ padding: '10px', verticalAlign: 'top' }}>
                                <div className="no-print">
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
                                </div>
                                <div className="print-only-container" style={{ display: 'none' }}>
                                  {(selectedTesHasil.daftar_soal || []).map((soal: string, i: number) => (
                                    <div key={i} style={{ marginBottom: '10px' }}>
                                      <div style={{ fontWeight: 'bold', color: '#000' }}>Q: {soal}</div>
                                      <div style={{ fontStyle: 'italic', whiteSpace: 'pre-wrap', color: '#333' }}>A: {jawab.jawaban[i] || '- Kosong -'}</div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    <div className="print-only-container" style={{ display: 'none' }}>
                      <div className="print-footer-container">
                        {pengaturanCetak.footerUrl && (
                          <img src={pengaturanCetak.footerUrl} alt="Footer / Tanda Tangan" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // TAMPILAN UTAMA MANAJEMEN TES
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  
                  {/* FORM BUAT TES */}
                  <div style={{ flex: '1 1 250px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', alignSelf: 'flex-start' }}>
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

                  {/* TABEL DAFTAR TES */}
                  <div style={{ flex: '2 1 450px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', overflowX: 'auto', alignSelf: 'flex-start' }}>
                    <h4 style={{ color: '#4a637d', margin: '0 0 15px 0', borderBottom: '1px dashed #ccc', paddingBottom: '8px' }}>Daftar Tes Rayon</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '500px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Judul & Jenjang</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Soal</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listTes.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Belum ada tes pemahaman yang dibuat.</td></tr>
                        ) : (
                          listTes.map((tes) => (
                            <tr key={tes.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px' }}>
                                <div style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{tes.judul}</div>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>Sasaran: {tes.jenjang}</div>
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#e67e22' }}>{tes.daftar_soal?.length || 0}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <button 
                                  onClick={() => handleToggleStatusTes(tes.id, tes.status)}
                                  style={{ padding: '4px 8px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: tes.status === 'Buka' ? '#e8f5e9' : '#ffebee', color: tes.status === 'Buka' ? '#2e7d32' : '#c62828' }}
                                >
                                  {tes.status === 'Buka' ? '🔓 Dibuka' : '🔒 Ditutup'}
                                </button>
                              </td>
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

          {/* ========================================================= */}
          {/* MENU 7: MASTER TUGAS */}
          {/* ========================================================= */}
          {activeMenu === 'master-tugas' && (
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <h4 style={{marginTop: 0, marginBottom: '15px', color: '#1e824c', borderBottom: '1px dashed #ccc', paddingBottom: '8px'}}>➕ Tambah Tugas</h4>
                  <form onSubmit={handleTambahTugas} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="text" placeholder="Nama Tugas (Misal: Resume NDP)" required value={formTugas.nama_tugas} onChange={(e) => setFormTugas({...formTugas, nama_tugas: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Batas Waktu (Deadline)</label>
                      <input type="date" required value={formTugas.deadline} onChange={(e) => setFormTugas({...formTugas, deadline: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    </div>
                    <button type="submit" style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Buat Tugas Baru</button>
                  </form>
                </div>
                <div style={{ flex: '2 1 400px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', minWidth: '400px' }}>
                    <thead><tr style={{ backgroundColor: '#f8f9fa' }}><th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Nama Tugas</th><th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Deadline</th><th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Aksi</th></tr></thead>
                    <tbody>
                      {listMasterTugas.length === 0 ? (<tr><td colSpan={3} style={{textAlign: 'center', padding: '20px'}}>Belum ada tugas.</td></tr>) : listMasterTugas.map((tugas) => (
                        <tr key={tugas.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: '#0d1b2a' }}>{tugas.nama_tugas}</td><td style={{ padding: '12px', color: '#e74c3c', fontWeight: 'bold' }}>{tugas.deadline}</td><td style={{ padding: '12px', textAlign: 'center' }}><button onClick={() => handleHapusTugas(tugas.id)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Hapus</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MENU 8: KELOLA PERPUSTAKAAN */}
          {/* ========================================================= */}
          {activeMenu === 'perpus' && (
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 250px', backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', alignSelf: 'flex-start' }}>
                  <h4 style={{marginTop: 0, marginBottom: '15px', color: '#1e824c', borderBottom: '1px dashed #ccc', paddingBottom: '8px'}}>📤 Upload Materi Baru</h4>
                  <form onSubmit={handleTambahPerpus} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="text" placeholder="Nama Folder (Cth: Modul MAPABA)" required value={formPerpus.folder} onChange={(e) => setFormPerpus({...formPerpus, folder: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                    <input type="text" placeholder="Judul Buku/Materi" required value={formPerpus.nama_file} onChange={(e) => setFormPerpus({...formPerpus, nama_file: e.target.value})} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }} />
                    <input type="file" required accept=".pdf,.doc,.docx" onChange={(e) => setFilePerpus(e.target.files ? e.target.files[0] : null)} style={{ padding: '8px', border: '1px dashed #ccc', borderRadius: '4px', backgroundColor: '#fff', fontSize: '0.8rem' }} />
                    <button disabled={isUploadingPerpus} type="submit" style={{ backgroundColor: isUploadingPerpus ? '#95a5a6' : '#004a87', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isUploadingPerpus ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>{isUploadingPerpus ? 'Mengupload ke Server...' : 'Upload ke Perpus'}</button>
                  </form>
                </div>
                <div style={{ flex: '2 1 450px', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                  {Object.keys(groupedPerpus).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Perpustakaan masih kosong.</div>
                  ) : (
                    Object.keys(groupedPerpus).map(folderName => (
                      <div key={folderName} style={{ marginBottom: '20px' }}>
                        <div style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px 15px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          📁 Folder: {folderName}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                          <tbody>
                            {groupedPerpus[folderName].map((item: any) => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px' }}>{item.nama_file}</td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                  <a href={item.link_file} target="_blank" style={{ display: 'inline-block', backgroundColor: '#3498db', color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', marginRight: '5px' }}>Buka</a>
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
          )}

          {/* ========================================================= */}
          {/* MENU 9: SARAN MASUK */}
          {/* ========================================================= */}
          {activeMenu === 'saran' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                {saranMasuk.length === 0 ? <p style={{ color: '#999' }}>Belum ada saran masuk dari kader.</p> : saranMasuk.map((saran) => (
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

      {/* PERBAIKAN 2: STRUKTUR HIDDEN HTML KHUSUS UNTUK PRINT PDF DENGAN BACKGROUND GAMBAR A4 */}
      <div id="hidden-print-container" className="print-layout-container">
        
        {/* GAMBAR FULL A4 (Diambil dari input Kop Surat Admin) */}
        {pengaturanCetak.kopSuratUrl && (
          <div className="bg-kertas-a4">
            <img src={pengaturanCetak.kopSuratUrl} alt="Background A4" />
          </div>
        )}

        {/* AREA KONTEN (Tabel, Teks, dll) */}
        <div className="print-content-area">
          
          {/* JIKA MENCETAK KHS RAPORT */}
          {activeMenu === 'raport' && tabRaportAdmin === 'raport' && (
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
                  <tr>
                    <th style={{ width: '5%' }}>No</th>
                    <th style={{ width: '20%', textAlign: 'left' }}>Kode Matakuliah</th>
                    <th style={{ width: '45%', textAlign: 'left' }}>Nama Matakuliah</th>
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

          {/* JIKA MENCETAK HASIL TES PEMAHAMAN */}
          {activeMenu === 'manajemen-tes' && selectedTesId && riwayatTes.find(r => r.id_tes === selectedTesId) && (
            <div>
              {(() => {
                const currentTes = listTes.find(t => t.id === selectedTesId);
                const sudahMengerjakan = riwayatTes.find(r => r.id_tes === selectedTesId);
                if (!currentTes || !sudahMengerjakan) return null;
                
                return (
                  <>
                    <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt', textTransform: 'uppercase' }}>REKAP JAWABAN: {currentTes.judul}</h3>
                    <table className="tabel-utama">
                      <thead>
                        <tr>
                          <th style={{ width: '15%' }}>Waktu Submit</th>
                          <th style={{ width: '15%' }}>NIM</th>
                          <th style={{ width: '25%' }}>Nama Kader</th>
                          <th style={{ width: '45%' }}>Jawaban Kader</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jawabanTesViewer.map((jawab: any) => (
                          <tr key={jawab.nim}>
                            <td style={{ verticalAlign: 'top' }}>{jawab.tanggal}</td>
                            <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nim}</td>
                            <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>{jawab.nama}</td>
                            <td style={{ verticalAlign: 'top' }}>
                              {(currentTes.daftar_soal || []).map((soal: string, i: number) => (
                                <div key={i} style={{ marginBottom: '10px' }}>
                                  <div style={{ fontWeight: 'bold' }}>Q: {soal}</div>
                                  <div style={{ fontStyle: 'italic' }}>A: {jawab.jawaban[i] || '- Kosong -'}</div>
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )
              })()}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}