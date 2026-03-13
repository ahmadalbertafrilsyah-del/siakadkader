'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

export default function DashboardKader() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState('home'); 
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- STATE PROFIL KADER ---
  const [profil, setProfil] = useState({
    fotoUrl: 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO', 
    nama: 'Loading...', nim: '', nia: '-', angkatan: '',
    email: '', tempatLahir: '', tanggalLahir: '',
    alamatAsal: '', alamatDomisili: '', id_rayon: '', jenjang: 'MAPABA',
    status: 'Aktif'
  });
  
  const [namaRayonAsli, setNamaRayonAsli] = useState('Memuat Rayon...');
  const [namaPendamping, setNamaPendamping] = useState('Menunggu Plotting...');
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' }); // Simpan Kop Rayon

  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [isSavingProfil, setIsSavingProfil] = useState(false); 

  // --- STATE SURAT ---
  const [jenisSurat, setJenisSurat] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [riwayatSurat, setRiwayatSurat] = useState<any[]>([]);
  const [opsiJenisSurat, setOpsiJenisSurat] = useState<any[]>([]);
  const [isSubmittingSurat, setIsSubmittingSurat] = useState(false);
  const [showFormSurat, setShowFormSurat] = useState(false);

  // --- STATE UPLOAD BERKAS & TUGAS ---
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [riwayatBerkas, setRiwayatBerkas] = useState<any[]>([]);
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]); 
  
  // --- STATE RAPORT DINAMIS ---
  const [tabRaport, setTabRaport] = useState('raport'); 
  const [filterRaport, setFilterRaport] = useState('MAPABA'); 
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({}); 
  const [nilaiKader, setNilaiKader] = useState<Record<string, string>>({});
  const [evaluasiKader, setEvaluasiKader] = useState<{ listKeaktifan: any[], catatan: string }>({ listKeaktifan: [], catatan: '' });

  // --- STATE PERPUS & SARAN ---
  const [activeFolder, setActiveFolder] = useState('');
  const [listPerpus, setListPerpus] = useState<any[]>([]);
  const [saranText, setSaranText] = useState('');
  const [isSubmittingSaran, setIsSubmittingSaran] = useState(false);

  // ==========================================
  // API HELPER: FUNGSI UPLOAD CLOUDINARY
  // ==========================================
  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "siakad_upload"); 
    
    const res = await fetch("https://api.cloudinary.com/v1_1/dcmdaghbq/auto/upload", {
      method: "POST",
      body: formData,
    });
    
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload ke Cloudinary");
    return data.secure_url;
  };

  // ==========================================
  // 1. CEK LOGIN & DETEKSI DATA RAYON OTOMATIS
  // ==========================================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const dataDB = snap.docs[0].data();
            
            if (dataDB.role !== 'kader') {
              alert(`Akses Ditolak! Anda bukan Kader.`);
              signOut(auth);
              router.push('/');
              return;
            }

            setCurrentUser(user);
            setProfil({
              fotoUrl: dataDB.fotoUrl || 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO',
              nama: dataDB.nama || '', nim: dataDB.nim || '', nia: dataDB.nia || '-', 
              angkatan: dataDB.angkatan || '', email: dataDB.email || '', 
              tempatLahir: dataDB.tempatLahir || '', tanggalLahir: dataDB.tanggalLahir || '',
              alamatAsal: dataDB.alamatAsal || '', alamatDomisili: dataDB.alamatDomisili || '',
              id_rayon: dataDB.id_rayon || '', 
              jenjang: dataDB.jenjang || 'MAPABA',
              status: dataDB.status || 'Aktif'
            });

            if (dataDB.jenjang) setFilterRaport(dataDB.jenjang);

            if(dataDB.id_rayon) {
              onSnapshot(doc(db, "users", dataDB.id_rayon), (rayonSnap) => {
                if (rayonSnap.exists()) {
                   const rData = rayonSnap.data();
                   setNamaRayonAsli(rData.nama || dataDB.id_rayon);
                   setPengaturanCetak({ kopSuratUrl: rData.kopSuratUrl || '', footerUrl: rData.footerUrl || '' });
                }
              });
              jalankanPendengarDataRayon(dataDB.nim, user.email, dataDB.id_rayon);
            }

            if(dataDB.pendampingId) {
               onSnapshot(doc(db, "users", dataDB.pendampingId), (pendampingSnap) => {
                  if(pendampingSnap.exists()) setNamaPendamping(pendampingSnap.data().nama);
               });
            } else {
               setNamaPendamping("Belum Diplotkan");
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
  // 2. FUNGSI PENDENGAR DATA SESUAI RAYON MASING-MASING
  // ==========================================
  const jalankanPendengarDataRayon = (nimKader: string, emailKader: string | null, idRayon: string) => {
    if(!nimKader || !emailKader || !idRayon) return;

    onSnapshot(doc(db, "kurikulum_rayon", idRayon), (docSnap) => {
      if (docSnap.exists()) {
         setListKurikulum(docSnap.data() as Record<string, any[]>);
      }
    });

    onSnapshot(doc(db, "nilai_khs", nimKader), (docSnap) => {
      if (docSnap.exists()) setNilaiKader(docSnap.data());
    });

    const qSurat = query(collection(db, "pengajuan_surat"), where("email_kader", "==", emailKader));
    onSnapshot(qSurat, (snap) => {
      const dataSurat: any[] = [];
      snap.forEach((doc) => dataSurat.push({ id: doc.id, ...doc.data() }));
      dataSurat.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setRiwayatSurat(dataSurat);
    });

    const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", emailKader));
    onSnapshot(qBerkas, (snap) => {
      const dataBerkas: any[] = [];
      snap.forEach((doc) => dataBerkas.push({ id: doc.id, ...doc.data() }));
      dataBerkas.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setRiwayatBerkas(dataBerkas);
    });

    onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", idRayon)), (snap) => {
      const dataTugas: any[] = [];
      snap.forEach((doc) => dataTugas.push({ id: doc.id, ...doc.data() }));
      setListMasterTugas(dataTugas);
    });

    onSnapshot(query(collection(db, "master_jenis_surat"), where("id_rayon", "==", idRayon)), (snap) => {
      setOpsiJenisSurat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    onSnapshot(query(collection(db, "perpustakaan"), where("id_rayon", "==", idRayon)), (snap) => {
      const dataPerpus: any[] = [];
      snap.forEach((doc) => dataPerpus.push({ id: doc.id, ...doc.data() }));
      setListPerpus(dataPerpus);
    });
  };

  useEffect(() => {
    if (!profil.nim) return;
    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", profil.nim), (docSnap) => {
      if (docSnap.exists() && docSnap.data()[filterRaport]) {
        setEvaluasiKader(docSnap.data()[filterRaport]);
      } else {
        setEvaluasiKader({ listKeaktifan: [], catatan: '' });
      }
    });
    return () => unsubscribeKeaktifan();
  }, [profil.nim, filterRaport]);

  // ==========================================
  // LOGIKA PERHITUNGAN IP & KHS SINKRON DENGAN RAYON
  // ==========================================
  const materiAktif = listKurikulum[filterRaport] || [];
  let totalSks = 0;
  let totalBobotNilai = 0;

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4;
    if(huruf === 'B') return 3;
    if(huruf === 'C') return 2;
    if(huruf === 'D') return 1;
    return 0;
  };

  const barisMateriRender = materiAktif.map((materi, index) => {
    const nilaiHuruf = nilaiKader[materi.kode] || "-";
    const angkaNilai = konversiHurufKeAngka(nilaiHuruf);
    const sksKaliNilai = (materi.bobot || 0) * angkaNilai;
    
    totalSks += (materi.bobot || 0);
    if (nilaiHuruf !== "-") totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode} style={{ borderBottom: '1px solid #ccc', backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa' }}>
        <td className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', borderRight: '1px solid #ccc', borderLeft: '1px solid #ccc' }}>{index + 1}</td>
        <td className="col-cetak" style={{ padding: '10px 15px', color: '#333', borderRight: '1px solid #ccc' }}>{materi.kode}</td>
        <td className="col-cetak" style={{ padding: '10px 15px', color: '#333', borderRight: '1px solid #ccc' }}>{materi.nama}</td>
        <td className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', color: '#333', borderRight: '1px solid #ccc' }}>{materi.bobot}</td>
        <td className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', color: '#333', fontWeight: 'bold', borderRight: '1px solid #ccc' }}>{nilaiHuruf === '-' ? '' : nilaiHuruf}</td>
        <td className="col-cetak" style={{ padding: '10px 15px', textAlign: 'center', color: '#333', borderRight: '1px solid #ccc' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });

  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";

  // ==========================================
  // FUNGSI PROFIL & LAINNYA
  // ==========================================
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfil({ ...profil, fotoUrl: URL.createObjectURL(file) });
      setFotoFile(file);
    }
  };

  const handleSimpanProfil = async () => {
    if(!profil.nim) return;
    setIsSavingProfil(true);
    try {
      let finalFotoUrl = profil.fotoUrl;
      if (fotoFile) finalFotoUrl = await uploadToCloudinary(fotoFile); 

      await updateDoc(doc(db, "users", profil.nim), {
        angkatan: profil.angkatan, tempatLahir: profil.tempatLahir, tanggalLahir: profil.tanggalLahir,
        email: profil.email, alamatAsal: profil.alamatAsal, alamatDomisili: profil.alamatDomisili,
        fotoUrl: finalFotoUrl
      });
      alert("Profil berhasil diperbarui!");
      setIsEditingProfil(false); setFotoFile(null);
    } catch (error) { alert("Gagal update profil. Cek koneksi Anda."); } finally { setIsSavingProfil(false); }
  };

  const handleUploadTugas = async (namaTugas: string) => {
    if (!fileToUpload || !currentUser) return alert("Pilih file dokumen terlebih dahulu!");
    setIsUploading(true);
    try {
      const finalFileUrl = await uploadToCloudinary(fileToUpload); 
      const tgl = new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(new Date());
      
      await addDoc(collection(db, "berkas_kader"), {
        email_kader: currentUser.email, nim: profil.nim, jenis_berkas: namaTugas, nama_file_asli: fileToUpload.name, 
        file_link_or_id: finalFileUrl, tipe_storage: "Cloudinary", tanggal: tgl, timestamp: Date.now(),
        status: 'Menunggu Verifikasi'
      });
      alert(`Sukses! File ${namaTugas} berhasil diunggah.`);
      setFileToUpload(null);
    } catch (error) { alert("Error mengunggah berkas."); } finally { setIsUploading(false); }
  };

  const handleAjukanSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jenisSurat || !currentUser) return;
    setIsSubmittingSurat(true);
    try {
      const tgl = new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(new Date());
      await addDoc(collection(db, "pengajuan_surat"), { 
        email_kader: currentUser.email, nim: profil.nim, nama: profil.nama, id_rayon: profil.id_rayon,
        jenis: jenisSurat, keperluan: keperluan, 
        tanggal: tgl, status: 'Menunggu Verifikasi', timestamp: Date.now() 
      });
      alert("Surat berhasil diajukan!");
      setJenisSurat(''); setKeperluan(''); setShowFormSurat(false);
    } catch (error) { alert("Error sistem pengajuan surat."); } finally { setIsSubmittingSurat(false); }
  };

  const handleKirimSaran = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!saranText.trim() || !profil.id_rayon) return;
    setIsSubmittingSaran(true);
    try {
      await addDoc(collection(db, "saran_aspirasi"), {
        nim: profil.nim, nama: profil.nama, id_rayon: profil.id_rayon, saran: saranText,
        timestamp: Date.now(), tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(new Date())
      });
      alert("Saran Anda berhasil dikirim. Terima kasih!");
      setSaranText('');
    } catch (error) { alert("Gagal mengirim saran."); } finally { setIsSubmittingSaran(false); }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  const handleDownloadPDF = () => {
    window.print();
  };

  const tugasRender = listMasterTugas.map((tugas) => {
    const tugasDisubmit = riwayatBerkas.find((b) => b.jenis_berkas === tugas.nama_tugas);
    let statusPengerjaan = 'Belum Mengumpulkan';
    if (tugasDisubmit) {
      statusPengerjaan = tugasDisubmit.status === 'Selesai' ? 'Selesai' : 'Menunggu Verifikasi';
    }
    return { ...tugas, statusPengerjaan, id_berkas_tersimpan: tugasDisubmit?.id, link_file: tugasDisubmit?.file_link_or_id };
  });

  const folderPerpus = Array.from(new Set(listPerpus.map(item => item.folder)));
  const fileDalamFolder = listPerpus.filter(item => item.folder === activeFolder);
  const syaratSuratTerpilih = opsiJenisSurat.find(s => s.jenis === jenisSurat)?.syarat || '';

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* CSS KHUSUS UNTUK PRINT / DOWNLOAD PDF - FORMAT A4 FORMAL */}
      <style>{`
        @media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 260px !important; } .menu-burger { display: none !important; } }
        
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body, html { background-color: #fff !important; margin: 0; padding: 0; }
          body * { visibility: hidden; }
          #area-cetak-raport, #area-cetak-raport * { visibility: visible; color: #000 !important; font-family: "Arial Narrow", Arial, sans-serif !important; }
          #area-cetak-raport { 
            position: absolute; left: 0; top: 0; width: 100%; 
            padding: 0; margin: 0; background-color: white !important; 
            border: none !important; box-shadow: none !important;
          }
          
          /* Menyembunyikan elemen web yang tidak perlu dicetak */
          .no-print { display: none !important; } 
          
          /* Pengaturan Tabel Formal Hitam Putih */
          .tabel-cetak { border-collapse: collapse !important; width: 100% !important; margin-bottom: 20px; border: 1px solid #000 !important; }
          .tabel-cetak th, .tabel-cetak td.col-cetak { border: 1px solid #000 !important; padding: 6px 8px !important; font-size: 11pt !important; color: #000 !important; background-color: #fff !important; }
          .tabel-cetak th { font-weight: bold !important; text-align: center; }
          
          /* Pengaturan Tabel Biodata Tanpa Garis */
          .tabel-biodata td { padding: 4px 0 !important; font-size: 12pt !important; border: none !important; }
          
          /* Tampilkan kolom khusus print */
          .print-kop-surat { display: block !important; margin-bottom: 20px; width: 100%; } 
          .print-footer { display: flex !important; width: 100%; justify-content: center; margin-top: 40px; page-break-inside: avoid; } 
          .print-footer img { width: 100% !important; max-width: 100% !important; object-fit: contain; }
          
          /* Paksa menghilangkan background color dari web saat print */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        
        /* Default sembunyikan area print di web */
        .print-kop-surat { display: none; }
        .print-footer { display: none; }
      `}</style>

      {/* SIDEBAR KADER */}
      <aside className="no-print" style={{ width: '260px', background: 'linear-gradient(180deg, #1e824c 0%, #145a32 100%)', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-260px', zIndex: 50, transition: 'left 0.3s ease', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🎓 SIAKAD PMII</span>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <img src={profil.fotoUrl} alt="Foto" style={{ width: '50px', height: '50px', backgroundColor: '#e74c3c', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f1c40f' }} />
          <div>
            <h4 style={{ fontSize: '0.85rem', margin: '0 0 5px 0', color: '#fff', lineHeight: '1.2' }}>{profil.nama}</h4>
            <p style={{ fontSize: '0.75rem', color: '#f1c40f', margin: 0, fontWeight: 'bold' }}>{profil.jenjang}</p>
          </div>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {[
            { id: 'home', icon: '🏠', label: 'Beranda' },
            { id: 'profil', icon: '👤', label: 'Profil Saya' },
            { id: 'raport', icon: '📊', label: 'KHS & Raport Saya' },
            { id: 'upload', icon: '📤', label: 'Tugas Rayon' },
            { id: 'surat', icon: '✉️', label: 'Layanan Surat' },
            { id: 'perpus', icon: '📚', label: 'Perpustakaan' },
            { id: 'saran', icon: '💬', label: 'Kotak Saran' },
          ].map((item) => (
            <li key={item.id}>
              <button onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeMenu === item.id ? '#f1c40f' : '#ecf0f1', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.9rem', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', transition: '0.2s', fontWeight: activeMenu === item.id ? 'bold' : 'normal' }}>
                <span style={{fontSize: '1.1rem'}}>{item.icon}</span> {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#f1c40f', border: '1px solid #f1c40f', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}>🚪 Keluar Sistem</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '0', width: '100%', overflowX: 'hidden' }}>
        
        <header className="no-print" style={{ backgroundColor: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1.1rem', color: '#333', margin: 0 }}>Ruang {profil.jenjang}</h2>
            <span style={{ fontSize: '0.75rem', color: profil.status === 'Aktif' ? '#1e824c' : '#c62828', backgroundColor: profil.status === 'Aktif' ? '#e8f5e9' : '#ffebee', padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold' }}>Status: {profil.status || 'Aktif'}</span>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          
          {/* MENU 1: HOME */}
          {activeMenu === 'home' && (
            <div>
              <div style={{ backgroundColor: '#1e824c', color: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(30,130,76,0.2)', marginBottom: '20px', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
                <h2 style={{marginTop: 0, fontSize: '1.8rem'}}>Halo, Sahabat/i {profil.nama.split(' ')[0]}! 👋</h2>
                <p style={{margin: '10px 0 0 0', fontSize: '1rem', opacity: 0.9}}>Selamat datang di pusat informasi dan administrasi kader {namaRayonAsli}.</p>
              </div>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
                <div style={{ flex: '1 1 300px', backgroundColor: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #3498db' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#555' }}>📌 Identitas Kaderisasi</h4>
                  <table style={{ width: '100%', fontSize: '0.9rem', lineHeight: '1.8' }}>
                    <tbody>
                      <tr><td style={{ width: '40%', fontWeight: 'bold', color: '#777' }}>Jenjang Saat Ini</td><td style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{profil.jenjang}</td></tr>
                      <tr><td style={{ fontWeight: 'bold', color: '#777' }}>Asal Rayon</td><td style={{ fontWeight: 'bold' }}>{namaRayonAsli}</td></tr>
                      <tr><td style={{ fontWeight: 'bold', color: '#777' }}>Pendamping</td><td style={{ color: '#e67e22', fontWeight: 'bold' }}>{namaPendamping}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ flex: '1 1 200px', backgroundColor: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #f1c40f', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#555' }}>Indeks Prestasi (IP) Saat Ini</h4>
                  <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#1e824c' }}>{ipKader}</div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>SKS Terselesaikan: {totalSks}</p>
                </div>
              </div>
            </div>
          )}

          {/* MENU 2: PROFIL KADER */}
          {activeMenu === 'profil' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', fontWeight: 'bold', fontSize: '0.95rem', letterSpacing: '1px' }}>
                PROFIL ANGGOTA
              </div>
              <div style={{ padding: '30px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 200px', textAlign: 'center' }}>
                  <img src={profil.fotoUrl} alt="Foto Formal" style={{ width: '100%', height: '260px', objectFit: 'cover', border: '4px solid #eee', borderRadius: '8px' }} />
                  {isEditingProfil && (
                    <div style={{ marginTop: '10px', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Unggah Foto Baru:</label>
                      <input type="file" accept="image/*" onChange={handleFotoChange} style={{ width: '100%', fontSize: '0.75rem', marginTop: '5px' }} />
                    </div>
                  )}
                  <button 
                    disabled={isSavingProfil}
                    onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
                    style={{ marginTop: '20px', width: '100%', padding: '12px', backgroundColor: isEditingProfil ? '#2ecc71' : '#1e824c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingProfil ? 'not-allowed' : 'pointer' }}>
                    {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil' : '📝 Ubah Profil Saya'}
                  </button>
                </div>
                <div style={{ flex: '1 1 400px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem', color: '#333' }}>
                    <tbody>
                      {[
                        { label: 'NIM', key: 'nim', readOnly: true },
                        { label: 'Nama Lengkap', key: 'nama', readOnly: true },
                        { label: 'Angkatan / Tahun Masuk', key: 'angkatan' },
                        { label: 'Tempat Lahir', key: 'tempatLahir' },
                        { label: 'Tanggal Lahir', key: 'tanggalLahir' },
                        { label: 'Email Pribadi', key: 'email' },
                        { label: 'Alamat Asal (Lengkap)', key: 'alamatAsal' },
                        { label: 'Alamat Domisili Malang', key: 'alamatDomisili' },
                        { label: 'Nomor Induk Anggota (NIA)', key: 'nia', readOnly: true },
                      ].map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '15px 10px', fontWeight: 'bold', width: '220px', color: '#555' }}>{row.label}</td>
                          <td style={{ padding: '15px 10px' }}>
                            {isEditingProfil && !row.readOnly ? (
                              <input type="text" value={(profil as any)[row.key]} onChange={(e) => setProfil({...profil, [row.key]: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
                            ) : ( 
                              <span style={{ color: row.readOnly ? '#888' : '#333', fontStyle: row.readOnly ? 'italic' : 'normal' }}>{(profil as any)[row.key]}</span> 
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {isEditingProfil && <p style={{ fontSize: '0.8rem', color: '#e74c3c', marginTop: '15px' }}>*NIM, Nama, dan NIA hanya bisa diubah oleh Pengurus Rayon/Cabang.</p>}
                </div>
              </div>
            </div>
          )}

          {/* MENU 3: RAPORT KADERISASI */}
          {activeMenu === 'raport' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '500px' }}>
              <div className="no-print" style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold', letterSpacing: '1px' }}>KARTU HASIL STUDI (KHS) KADERISASI</span>
                
                {/* DROPDOWN FILTER JENJANG & TOMBOL PRINT */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <select value={filterRaport} onChange={(e) => setFilterRaport(e.target.value)} style={{ padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', color: '#0d1b2a' }}>
                    <option value="MAPABA">MAPABA</option>
                    <option value="PKD">PKD</option>
                    <option value="SIG">SIG</option>
                    <option value="SKP">SKP</option>
                    <option value="NONFORMAL">Non-Formal</option>
                  </select>
                  
                  {tabRaport === 'raport' && (
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#f1c40f', color: '#0d1b2a', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      🖨️ Cetak / Download KHS
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: '20px' }}>
                <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>
                  <button onClick={() => setTabRaport('raport')} style={{ padding: '12px 25px', border: '1px solid', borderColor: tabRaport === 'raport' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaport === 'raport' ? '#fff' : 'transparent', color: tabRaport === 'raport' ? '#1e824c' : '#888', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}>
                    📑 Transkrip Nilai ({filterRaport})
                  </button>
                  <button onClick={() => setTabRaport('persentase')} style={{ padding: '12px 25px', border: '1px solid', borderColor: tabRaport === 'persentase' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaport === 'persentase' ? '#fff' : 'transparent', color: tabRaport === 'persentase' ? '#1e824c' : '#888', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}>
                    📊 Evaluasi Keaktifan
                  </button>
                </div>

                {tabRaport === 'raport' && (
                  <div id="area-cetak-raport" style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '4px' }}>
                    
                    {/* KOP SURAT (HANYA MUNCUL SAAT PRINT) */}
                    <div className="print-kop-surat">
                      {pengaturanCetak.kopSuratUrl && (
                        <img src={pengaturanCetak.kopSuratUrl} alt="Kop Surat" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '10px' }} />
                      )}
                      
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '20px 0 20px 0', fontSize: '14pt' }}>RAPORT KADERISASI</h3>
                      
                      <table className="tabel-biodata" style={{ textAlign: 'left', margin: '0 auto 20px 0', width: '100%', maxWidth: '700px', fontSize: '1rem' }}>
                        <tbody>
                          <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{profil.nim || '...........................'}</td></tr>
                          <tr><td>Nomor Induk Anggota</td><td>:</td><td>{profil.nia || '...........................'}</td></tr>
                          <tr><td>Nama Mahasiswa</td><td>:</td><td>{profil.nama || '...........................'}</td></tr>
                          <tr><td>Nama Rayon</td><td>:</td><td>{namaRayonAsli || '...........................'}</td></tr>
                          <tr><td>Angkatan</td><td>:</td><td>{profil.angkatan || '...........................'}</td></tr>
                          <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{filterRaport}</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <table className="tabel-cetak" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '600px' }}>
                      <thead>
                        <tr className="no-print" style={{ backgroundColor: '#1e824c', color: 'white' }}>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>No</th>
                          <th style={{ padding: '12px 15px' }}>Kode Materi</th>
                          <th style={{ padding: '12px 15px' }}>Nama Materi / Kegiatan</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>SKS</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>Nilai Huruf</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>SKS x Nilai</th>
                        </tr>
                        {/* HEADER KHUSUS PRINT (HITAM PUTIH, BORDER JELAS) */}
                        <tr className="print-only-header">
                          <th>No</th>
                          <th>Kode Matakuliah</th>
                          <th>Nama Matakuliah</th>
                          <th>SKS</th>
                          <th>Nilai / Input</th>
                          <th>SKS x Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materiAktif.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Kurikulum belum diatur oleh Pengurus Rayon.</td></tr>
                        ) : barisMateriRender}

                        <tr style={{ borderTop: '1px solid #000' }}>
                          <td colSpan={3} style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333', borderRight: '1px solid #ccc' }}>Jumlah</td>
                          <td className="col-cetak" style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalSks}</td>
                          <td className="col-cetak"></td>
                          <td className="col-cetak" style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalBobotNilai}</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                          <td colSpan={5} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '11pt', borderRight: '1px solid #ccc' }}>IPK (Indeks Prestasi Kader)</td>
                          <td className="col-cetak" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12pt', color: '#333' }}>{ipKader}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* FOOTER PDF (GAMBAR TANDA TANGAN/STEMPEL DARI RAYON) */}
                    {pengaturanCetak.footerUrl && (
                      <div className="print-footer" style={{ width: '100%', marginTop: '30px', display: 'flex', justifyContent: 'center' }}>
                         <img src={pengaturanCetak.footerUrl} alt="Footer / Tanda Tangan" style={{ maxWidth: '100%', objectFit: 'contain' }} />
                      </div>
                    )}

                  </div>
                )}

                {tabRaport === 'persentase' && (
                  <div style={{ backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: '8px', padding: '30px' }}>
                    <h4 style={{ margin: '0 0 20px 0', color: '#333' }}>Rincian Persentase Keaktifan ({filterRaport})</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
                      {evaluasiKader.listKeaktifan && evaluasiKader.listKeaktifan.length > 0 ? (
                        evaluasiKader.listKeaktifan.map((item: any, idx: number) => {
                          const colors = ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'];
                          const barColor = colors[idx % colors.length];
                          return (
                            <div key={item.id || idx}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px', color: '#555' }}>
                                <span style={{fontWeight: 'bold'}}>{item.kategori}</span><span style={{ fontWeight: 'bold', color: barColor }}>{item.nilai}%</span>
                              </div>
                              <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                                <div style={{ width: `${item.nilai}%`, backgroundColor: barColor, height: '100%', transition: 'width 1s' }}></div>
                              </div>
                            </div>
                          )
                        })
                      ) : (<p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem', margin: 0 }}>Pendamping Anda belum menginput nilai keaktifan untuk jenjang ini.</p>)}
                    </div>
                    
                    <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#eef2f3', borderLeft: '5px solid #1e824c', borderRadius: '4px' }}>
                      <h5 style={{ margin: '0 0 10px 0', color: '#1e824c' }}>Catatan Khusus dari Pendamping:</h5>
                      <p style={{ margin: 0, fontSize: '0.95rem', color: '#444', fontStyle: 'italic', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                        {evaluasiKader.catatan ? `"${evaluasiKader.catatan}"` : "Belum ada catatan khusus dari pendamping."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MENU 4: UPLOAD BERKAS & TUGAS */}
          {activeMenu === 'upload' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '500px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', fontWeight: 'bold', fontSize: '0.95rem', letterSpacing: '1px' }}>
                PENGUMPULAN TUGAS RAYON
              </div>
              <div style={{ padding: '20px' }}>
                <p style={{ fontSize: '0.9rem', color: '#777', marginBottom: '20px' }}>Daftar tugas yang diinstruksikan oleh Pengurus Rayon. Pastikan file dalam format PDF/Word/Gambar yang jelas.</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#333', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '15px 10px', fontWeight: 'bold', width: '50px' }}>No</th>
                        <th style={{ padding: '15px 10px', fontWeight: 'bold' }}>Jenis Tugas / Berkas</th>
                        <th style={{ padding: '15px 10px', fontWeight: 'bold' }}>Batas Waktu</th>
                        <th style={{ padding: '15px 10px', fontWeight: 'bold' }}>Status</th>
                        <th style={{ padding: '15px 10px', fontWeight: 'bold', textAlign: 'right' }}>Aksi (Upload / Lihat)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tugasRender.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Belum ada tugas dari Admin Rayon.</td></tr>
                      ) : (
                        tugasRender.map((tugas, index) => (
                          <tr key={tugas.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '15px 10px' }}>{index + 1}</td>
                            <td style={{ padding: '15px 10px', fontWeight: 'bold', color: '#004a87', fontSize: '0.9rem' }}>{tugas.nama_tugas}</td>
                            <td style={{ padding: '15px 10px', color: '#e74c3c', fontWeight: 'bold' }}>{tugas.deadline || '-'}</td>
                            <td style={{ padding: '15px 10px' }}>
                              <span style={{ backgroundColor: tugas.statusPengerjaan === 'Selesai' ? '#e8f5e9' : tugas.statusPengerjaan === 'Menunggu Verifikasi' ? '#fff3e0' : '#f4f6f9', color: tugas.statusPengerjaan === 'Selesai' ? '#27ae60' : tugas.statusPengerjaan === 'Menunggu Verifikasi' ? '#f39c12' : '#7f8c8d', padding: '5px 10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.75rem' }}>
                                {tugas.statusPengerjaan}
                              </span>
                            </td>
                            <td style={{ padding: '15px 10px', textAlign: 'right' }}>
                              {tugas.statusPengerjaan === 'Selesai' ? (
                                <a href={tugas.link_file} target="_blank" style={{ display: 'inline-block', backgroundColor: '#fff', border: '1px solid #27ae60', color: '#27ae60', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', textDecoration: 'none', fontWeight: 'bold' }}>👁️ Lihat File</a>
                              ) : tugas.statusPengerjaan === 'Menunggu Verifikasi' ? (
                                <span style={{ fontStyle: 'italic', color: '#aaa', fontSize: '0.8rem' }}>Sedang dinilai Pendamping...</span>
                              ) : (
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  <input type="file" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} style={{ width: '180px', fontSize: '0.75rem' }} />
                                  <button onClick={() => handleUploadTugas(tugas.nama_tugas)} disabled={isUploading} style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: isUploading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                                    {isUploading ? '...' : '📤 Upload'}
                                  </button>
                                </div>
                              )}
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

          {/* MENU 5: PENGAJUAN SURAT */}
          {activeMenu === 'surat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#1e824c', margin: 0, borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>Pengajuan Layanan Surat</h3>
                
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 350px', backgroundColor: '#fdfdfd', padding: '25px', border: '1px solid #eee', borderRadius: '8px' }}>
                    <form onSubmit={handleAjukanSurat} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <label style={{fontSize: '0.85rem', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '8px'}}>1. Pilih Jenis Layanan Surat</label>
                        <select required value={jenisSurat} onChange={(e) => setJenisSurat(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', cursor: 'pointer', backgroundColor: '#fff', fontSize: '0.9rem' }}>
                          <option value="" disabled>-- Pilih Surat yang Tersedia --</option>
                          {opsiJenisSurat.length === 0 && <option value="" disabled>Belum ada layanan dari Rayon</option>}
                          {opsiJenisSurat.map(s => <option key={s.id} value={s.jenis}>{s.jenis}</option>)}
                        </select>
                      </div>

                      {syaratSuratTerpilih && (
                        <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '4px', borderLeft: '4px solid #f1c40f', fontSize: '0.85rem', color: '#856404' }}>
                          <b>Instruksi Wajib dari Rayon:</b><br/>
                          <span style={{whiteSpace: 'pre-wrap', lineHeight: '1.5'}}>{syaratSuratTerpilih}</span>
                        </div>
                      )}

                      <div>
                        <label style={{fontSize: '0.85rem', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '8px'}}>2. Isi Keperluan / Jawaban Syarat</label>
                        <textarea rows={4} required value={keperluan} onChange={(e) => setKeperluan(e.target.value)} placeholder="Ketik keperluan Anda sesuai instruksi di atas..." style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontSize: '0.9rem', outline: 'none' }} />
                      </div>
                      
                      <button disabled={isSubmittingSurat} type="submit" style={{ backgroundColor: isSubmittingSurat ? '#95a5a6' : '#1e824c', color: 'white', padding: '15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSubmittingSurat ? 'not-allowed' : 'pointer', fontSize: '1rem', marginTop: '10px' }}>
                        {isSubmittingSurat ? 'Mengirim...' : '✉️ Ajukan Surat Sekarang'}
                      </button>
                    </form>
                  </div>

                  <div style={{ flex: '2 1 100%', overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#fff' }}>
                    <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', backgroundColor: '#4a637d', color: 'white' }}>
                      <h4 style={{ margin: 0, letterSpacing: '1px' }}>Riwayat Pengajuan Surat Anda</h4>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#333', minWidth: '500px' }}>
                      <thead><tr style={{ backgroundColor: '#f8f9fa', color: '#555' }}><th style={{ padding: '15px' }}>Jenis Pengajuan</th><th style={{ padding: '15px' }}>Keperluan</th><th style={{ padding: '15px', textAlign: 'center' }}>Status</th><th style={{ padding: '15px', textAlign: 'center' }}>Surat Balasan</th></tr></thead>
                      <tbody>
                        {riwayatSurat.length === 0 ? (<tr><td colSpan={4} style={{textAlign: 'center', padding: '40px', color: '#999'}}>Anda belum pernah mengajukan surat.</td></tr>) : riwayatSurat.map((surat) => (
                          <tr key={surat.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '15px' }}><div style={{fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.9rem'}}>{surat.jenis}</div><div style={{fontSize: '0.75rem', color: '#888', marginTop: '4px'}}>{surat.tanggal}</div></td>
                            <td style={{ padding: '15px', color: '#555', fontStyle: 'italic', maxWidth: '200px', whiteSpace: 'pre-wrap' }}>"{surat.keperluan}"</td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              <span style={{ padding: '6px 12px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: surat.status === 'Disetujui' ? '#e8f5e9' : surat.status === 'Ditolak' ? '#ffebee' : '#fff3e0', color: surat.status === 'Disetujui' ? '#2e7d32' : surat.status === 'Ditolak' ? '#c62828' : '#e67e22' }}>
                                {surat.status}
                              </span>
                            </td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              {surat.status === 'Disetujui' && surat.file_balasan_url ? (
                                <a href={surat.file_balasan_url} target="_blank" style={{ color: 'white', backgroundColor: '#3498db', padding: '8px 15px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.8rem', display: 'inline-block' }}>📥 Download</a>
                              ) : surat.status === 'Ditolak' ? (
                                <span style={{color: '#c62828', fontSize: '0.8rem', fontWeight: 'bold'}}>- Ditolak -</span>
                              ) : (
                                <span style={{color: '#999', fontSize: '0.8rem', fontStyle: 'italic'}}>⏳ Diproses Rayon</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MENU 6: PERPUSTAKAAN */}
          {activeMenu === 'perpus' && (
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#1e824c', margin: 0, borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>Perpustakaan & Modul Materi</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {listPerpus.map(item => (
                  <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ backgroundColor: '#1e824c', color: 'white', padding: '10px 15px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📁 {item.folder}
                    </div>
                    <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '1rem', lineHeight: '1.4' }}>{item.nama_file}</h4>
                      <a href={item.link_file} target="_blank" style={{ display: 'block', textAlign: 'center', backgroundColor: '#f1c40f', color: '#333', padding: '10px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #d4ac0d' }}>
                        📥 Buka / Unduh Modul
                      </a>
                    </div>
                  </div>
                ))}
                {listPerpus.length === 0 && <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999', border: '1px dashed #ccc', borderRadius: '8px' }}>Belum ada buku atau materi di perpustakaan Rayon.</div>}
              </div>
            </div>
          )}

          {/* MENU 7: KOTAK SARAN */}
          {activeMenu === 'saran' && (
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#1e824c', margin: 0, borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>Kotak Saran & Aspirasi</h3>
              <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '25px', lineHeight: '1.6' }}>Punya masukan, kritik membangun, atau ide kegiatan untuk kepengurusan Rayon? Sampaikan melalui form di bawah ini. Aspirasi Anda akan langsung masuk ke Dashboard Admin Rayon.</p>
              
              <form onSubmit={handleKirimSaran} style={{ maxWidth: '600px' }}>
                <textarea 
                  rows={6} 
                  required 
                  value={saranText} 
                  onChange={(e) => setSaranText(e.target.value)} 
                  placeholder="Ketik saran atau aspirasi Anda di sini..." 
                  style={{ width: '100%', padding: '15px', border: '1px solid #ccc', borderRadius: '8px', outline: 'none', fontSize: '1rem', resize: 'vertical', marginBottom: '15px', backgroundColor: '#fdfdfd' }} 
                />
                <button disabled={isSubmittingSaran} type="submit" style={{ backgroundColor: isSubmittingSaran ? '#95a5a6' : '#1e824c', color: 'white', padding: '15px 30px', border: 'none', borderRadius: '30px', fontWeight: 'bold', cursor: isSubmittingSaran ? 'not-allowed' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isSubmittingSaran ? 'Mengirim Aspirasi...' : '🚀 Kirim Aspirasi'}
                </button>
              </form>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}