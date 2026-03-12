'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
// TAMBAHAN: Import onSnapshot untuk mendengarkan perubahan nilai secara real-time
import { collection, addDoc, getDocs, query, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

export default function DashboardKader() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState('home'); 
  const [currentUser, setCurrentUser] = useState<any>(null);

  // --- STATE PROFIL KADER ---
  const [profil, setProfil] = useState({
    fotoUrl: 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO', 
    nama: 'Loading...', nim: '', nia: '-', angkatan: '',
    email: '', tempatLahir: '', tanggalLahir: '',
    alamatAsal: '', alamatDomisili: '', id_rayon: '' 
  });
  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [isSavingProfil, setIsSavingProfil] = useState(false); 

  // --- STATE SURAT ---
  const [jenisSurat, setJenisSurat] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [riwayatSurat, setRiwayatSurat] = useState<any[]>([]);
  const [isSubmittingSurat, setIsSubmittingSurat] = useState(false);
  const [showFormSurat, setShowFormSurat] = useState(false);

  // --- STATE UPLOAD BERKAS & TUGAS ---
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [jenisBerkas, setJenisBerkas] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [riwayatBerkas, setRiwayatBerkas] = useState<any[]>([]);
  const [listMasterTugas, setListMasterTugas] = useState<any[]>([]); 
  
  // --- STATE RAPORT DINAMIS ---
  const [filterRaport, setFilterRaport] = useState('MAPABA');
  const [tabRaport, setTabRaport] = useState('raport'); 
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], NONFORMAL: [] });
  const [nilaiKader, setNilaiKader] = useState<Record<string, string>>({});
  const [evaluasiKader, setEvaluasiKader] = useState<{ listKeaktifan: any[], catatan: string }>({ listKeaktifan: [], catatan: '' });

  // --- STATE PERPUS & SARAN ---
  const [activeFolder, setActiveFolder] = useState('');
  const [listPerpus, setListPerpus] = useState<any[]>([]);
  const [saranText, setSaranText] = useState('');
  const [isSubmittingSaran, setIsSubmittingSaran] = useState(false);

  // ==========================================
  // 1. CEK LOGIN & DETEKSI DATA RAYON OTOMATIS
  // ==========================================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Deteksi Profil Kader
        const q = query(collection(db, "users"), where("email", "==", user.email));
        onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const dataDB = snap.docs[0].data();
            setProfil({
              fotoUrl: dataDB.fotoUrl || 'https://via.placeholder.com/200x250/e74c3c/fff?text=FOTO',
              nama: dataDB.nama || '', nim: dataDB.nim || '', nia: dataDB.nia || '-', angkatan: dataDB.angkatan || '',
              email: dataDB.email || '', tempatLahir: dataDB.tempatLahir || '', tanggalLahir: dataDB.tanggalLahir || '',
              alamatAsal: dataDB.alamatAsal || '', alamatDomisili: dataDB.alamatDomisili || '',
              id_rayon: dataDB.id_rayon || '' // MENYIMPAN ID RAYON DARI DATABASE
            });

            // Tarik data berdasarkan Rayon aslinya
            if(dataDB.id_rayon) {
              jalankanPendengarDataRayon(dataDB.nim, user.email, dataDB.id_rayon);
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

    // Kurikulum sesuai Rayon
    onSnapshot(doc(db, "kurikulum_rayon", idRayon), (docSnap) => {
      if (docSnap.exists()) setListKurikulum(docSnap.data() as Record<string, any[]>);
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

    // Master Tugas sesuai Rayon
    const qTugas = query(collection(db, "master_tugas"), where("id_rayon", "==", idRayon));
    onSnapshot(qTugas, (snap) => {
      const dataTugas: any[] = [];
      snap.forEach((doc) => dataTugas.push({ id: doc.id, ...doc.data() }));
      setListMasterTugas(dataTugas);
    });

    // Perpus sesuai Rayon
    const qPerpus = query(collection(db, "perpustakaan"), where("id_rayon", "==", idRayon));
    onSnapshot(qPerpus, (snap) => {
      const dataPerpus: any[] = [];
      snap.forEach((doc) => dataPerpus.push({ id: doc.id, ...doc.data() }));
      setListPerpus(dataPerpus);
    });
  };

  useEffect(() => {
    if (!profil.nim) return;
    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", profil.nim), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data[filterRaport]) {
          setEvaluasiKader(data[filterRaport]);
        } else {
          setEvaluasiKader({ listKeaktifan: [], catatan: 'Belum ada catatan dari pendamping.' });
        }
      } else {
        setEvaluasiKader({ listKeaktifan: [], catatan: 'Belum ada catatan dari pendamping.' });
      }
    });
    return () => unsubscribeKeaktifan();
  }, [filterRaport, profil.nim]);


  // ==========================================
  // API HELPER: FUNGSI UPLOAD ASLI CLOUDINARY (BISA UNTUK GAMBAR & PDF)
  // ==========================================
  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    // GANTI: "nama_preset_kamu_disini" dan "your_cloud_name" dengan akun Cloudinary milikmu
    formData.append("upload_preset", "nama_preset_kamu_disini"); 
    
    // Menggunakan endpoint "auto/upload" agar bisa mendeteksi PDF/Word/Gambar secara otomatis
    const res = await fetch("https://api.cloudinary.com/v1_1/your_cloud_name/auto/upload", {
      method: "POST",
      body: formData,
    });
    
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload ke Cloudinary");
    return data.secure_url;
  };


  // ==========================================
  // LOGIKA PERHITUNGAN IP & KHS
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
    const sksKaliNilai = materi.bobot * angkaNilai;
    
    totalSks += materi.bobot;
    if (nilaiHuruf !== "-") {
      totalBobotNilai += sksKaliNilai;
    }

    return (
      <tr key={materi.kode} style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa' }}>
        <td style={{ padding: '12px 8px' }}>{index + 1}</td>
        <td style={{ padding: '12px 8px', color: '#555' }}>{materi.kode}</td>
        <td style={{ padding: '12px 8px', color: '#555', fontWeight: 'bold' }}>{materi.nama}</td>
        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#555' }}>{materi.bobot}</td>
        <td style={{ padding: '12px 8px', textAlign: 'center', color: nilaiHuruf === '-' ? '#ccc' : '#333', fontWeight: 'bold' }}>{nilaiHuruf}</td>
        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#555' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });

  const ipKader = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";

  // ==========================================
  // LOGIKA STATUS TUGAS (GABUNGAN MASTER & RIWAYAT)
  // ==========================================
  const tugasRender = listMasterTugas.map((tugas) => {
    const tugasDisubmit = riwayatBerkas.find((b) => b.jenis_berkas === tugas.nama_tugas);
    let statusPengerjaan = 'Belum Mengumpulkan';
    
    if (tugasDisubmit) {
      statusPengerjaan = tugasDisubmit.status === 'Selesai' ? 'Selesai' : 'Menunggu Verifikasi';
    }
    return { ...tugas, statusPengerjaan, id_berkas_tersimpan: tugasDisubmit?.id, link_file: tugasDisubmit?.file_link_or_id };
  });

  // --- LOGIKA PERPUSTAKAAN ---
  const folderPerpus = Array.from(new Set(listPerpus.map(item => item.folder)));
  const fileDalamFolder = listPerpus.filter(item => item.folder === activeFolder);


  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfil({ ...profil, fotoUrl: URL.createObjectURL(file) });
      setFotoFile(file);
    }
  };

  // --- FUNGSI SIMPAN PROFIL (UPLOAD FOTO ASLI) ---
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

  // --- FUNGSI KIRIM SARAN TEPAT SASARAN KE RAYONNYA ---
  const handleKirimSaran = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!saranText.trim() || !profil.id_rayon) return;
    setIsSubmittingSaran(true);
    try {
      await addDoc(collection(db, "saran_aspirasi"), {
        nim: profil.nim, nama: profil.nama, 
        id_rayon: profil.id_rayon, // Dikirim spesifik ke Rayonnya
        saran: saranText,
        timestamp: Date.now(), tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(new Date())
      });
      alert("Saran Anda berhasil dikirim ke Pengurus Rayon. Terima kasih!");
      setSaranText('');
    } catch (error) { alert("Gagal mengirim saran."); } finally { setIsSubmittingSaran(false); }
  };

  // --- FUNGSI UPLOAD TUGAS ASLI KE CLOUDINARY (PDF/DOKUMEN/FOTO) ---
  const handleUploadTugas = async (namaTugas: string) => {
    if (!fileToUpload || !currentUser) return alert("Pilih file terlebih dahulu!");
    setIsUploading(true);
    try {
      const finalFileUrl = await uploadToCloudinary(fileToUpload); 
      const tgl = new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(new Date());
      
      await addDoc(collection(db, "berkas_kader"), {
        email_kader: currentUser.email, jenis_berkas: namaTugas, nama_file_asli: fileToUpload.name, 
        file_link_or_id: finalFileUrl, tipe_storage: "Cloudinary", tanggal: tgl, timestamp: Date.now(),
        status: 'Menunggu Verifikasi'
      });
      alert(`Sukses! File ${namaTugas} berhasil diunggah.`);
      setFileToUpload(null);
    } catch (error) { alert("Error mengunggah berkas."); } finally { setIsUploading(false); }
  };

  // --- FUNGSI PENGAJUAN SURAT ---
  const handleAjukanSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jenisSurat || !currentUser) return;
    setIsSubmittingSurat(true);
    try {
      const tgl = new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(new Date());
      await addDoc(collection(db, "pengajuan_surat"), { 
        email_kader: currentUser.email, jenis: jenisSurat, keperluan: keperluan, 
        tanggal: tgl, status: 'Menunggu Verifikasi', timestamp: Date.now() 
      });
      alert("Surat berhasil diajukan!");
      setJenisSurat(''); setKeperluan(''); setShowFormSurat(false);
    } catch (error) { alert("Error sistem."); } finally { setIsSubmittingSurat(false); }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };

  return (
    <div style={{ display: 'flex', backgroundColor: '#f4f6f9', height: '100vh', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      
      {/* SIDEBAR KADER */}
      <aside style={{ width: '250px', background: 'linear-gradient(180deg, #2c3e50 0%, #1a252f 100%)', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>💻 SIAKAD PMII</span>
        </div>
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <img src={profil.fotoUrl} alt="Foto" style={{ width: '55px', height: '70px', backgroundColor: '#e74c3c', borderRadius: '4px', objectFit: 'cover' }} />
          <div>
            <h4 style={{ fontSize: '0.8rem', marginBottom: '5px', color: '#fff', lineHeight: '1.2' }}>{profil.nama}</h4>
            <p style={{ fontSize: '0.75rem', color: '#ecf0f1', margin: 0 }}>📋 {profil.nim}</p>
          </div>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {[
            { id: 'home', icon: '🏠', label: 'Home' },
            { id: 'profil', icon: '👤', label: 'Profil Anggota' },
            { id: 'raport', icon: '📊', label: 'Raport Kaderisasi' },
            { id: 'upload', icon: '📤', label: 'Upload Berkas & Tugas' },
            { id: 'surat', icon: '✉️', label: 'Pengajuan Surat' },
            { id: 'perpus', icon: '📚', label: 'Perpustakaan Pergerakan' },
          ].map((item) => (
            <li key={item.id}>
              <button 
                onClick={() => setActiveMenu(item.id)} 
                style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeMenu === item.id ? '#fff' : '#bdc3c7', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.85rem', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', transition: '0.2s', fontWeight: activeMenu === item.id ? 'bold' : 'normal' }}
              >
                <span>{item.icon}</span> {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'none', color: '#e74c3c', border: 'none', cursor: 'pointer', fontWeight: 'bold', textAlign: 'left', display: 'flex', gap: '15px' }}><span>⚙️</span> Logout</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '20px 30px' }}>
          
          {/* MENU 1: HOME */}
          {activeMenu === 'home' && (
            <div>
              <div style={{ backgroundColor: '#4a637d', padding: '15px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', borderRadius: '4px 4px 0 0' }}>
                <span style={{ fontSize: '1rem' }}>Salam, <b>{profil.nama}</b></span>
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', backgroundColor: 'white', padding: '20px', borderRadius: '4px', border: '1px solid #ddd', display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <img src={profil.fotoUrl} alt="Profil" style={{ width: '100px', height: '120px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #eee' }} />
                  <div style={{ fontSize: '0.85rem', color: '#555', lineHeight: '1.8' }}>
                    <b>Info Profil & Berkas, Klik <span style={{ color: '#3498db', cursor: 'pointer' }} onClick={()=>setActiveMenu('profil')}>Di SINI</span></b><br/>
                    - Default password adalah tanggal lahir Anda<br/>
                    - Pastikan selalu update data domisili<br/>
                    - Hubungi Pendamping jika lupa password
                  </div>
                </div>
                <div style={{ flex: '1 1 300px', backgroundColor: 'white', padding: '20px', borderRadius: '4px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p style={{ fontStyle: 'italic', color: '#555', fontSize: '0.95rem', margin: '0 0 10px 0' }}>
                    "Tugas pemuda adalah meruntuhkan kemapanan yang menindas dan membangun tatanan yang membebaskan."
                  </p>
                  <span style={{ fontSize: '0.8rem', color: '#27ae60', fontWeight: 'bold' }}>📚 Quotes Pergerakan</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 500px', backgroundColor: 'white', padding: '20px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'center', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Grafik Indeks KHS Kaderisasi</h3>
                  <div style={{ width: '100%', height: '200px', backgroundColor: '#f8f9fa', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                    [ Area Rendering Grafik Garis KHS ]
                  </div>
                </div>
                <div style={{ flex: '1 1 300px', backgroundColor: 'white', padding: '20px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <h4 style={{ color: '#333', marginTop: 0 }}>Kolom Saran & Aspirasi</h4>
                  <p style={{ fontSize: '0.8rem', color: '#777' }}>Sampaikan saranmu untuk Rayon melalui kolom ini.</p>
                  <form onSubmit={handleKirimSaran}>
                    <textarea rows={4} value={saranText} onChange={(e) => setSaranText(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '10px' }} placeholder="Tuliskan saran Anda..."></textarea>
                    <button disabled={isSubmittingSaran} type="submit" style={{ backgroundColor: '#34495e', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', marginTop: '10px', cursor: isSubmittingSaran ? 'not-allowed' : 'pointer' }}>
                      {isSubmittingSaran ? 'Mengirim...' : 'Kirim Saran'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* MENU 2: PROFIL KADER */}
          {activeMenu === 'profil' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd', minHeight: '500px' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '12px 20px', color: 'white', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '1px' }}>
                PROFIL ANGGOTA
              </div>
              <div style={{ padding: '30px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 200px', textAlign: 'center' }}>
                  <img src={profil.fotoUrl} alt="Foto Formal" style={{ width: '100%', height: '260px', objectFit: 'cover', border: '4px solid #eee', borderRadius: '4px' }} />
                  {isEditingProfil && (
                    <div style={{ marginTop: '10px', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Unggah Foto Baru:</label>
                      <input type="file" accept="image/*" onChange={handleFotoChange} style={{ width: '100%', fontSize: '0.75rem', marginTop: '5px' }} />
                    </div>
                  )}
                  <button 
                    disabled={isSavingProfil}
                    onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
                    style={{ marginTop: '20px', width: '100%', padding: '10px', backgroundColor: isEditingProfil ? '#2ecc71' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingProfil ? 'not-allowed' : 'pointer' }}>
                    {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil' : '📝 Ubah Profil Saya'}
                  </button>
                </div>
                <div style={{ flex: '1 1 400px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: '#333' }}>
                    <tbody>
                      {[
                        { label: 'Angkatan / Tahun Masuk', key: 'angkatan' },
                        { label: 'NIM', key: 'nim', readOnly: true },
                        { label: 'Nama Lengkap', key: 'nama', readOnly: true },
                        { label: 'Tempat Lahir', key: 'tempatLahir' },
                        { label: 'Tanggal Lahir', key: 'tanggalLahir' },
                        { label: 'Email Pribadi', key: 'email' },
                        { label: 'Alamat Asal (Lengkap)', key: 'alamatAsal' },
                        { label: 'Alamat Domisili Malang', key: 'alamatDomisili' },
                        { label: 'Nomor Induk Anggota (NIA)', key: 'nia', readOnly: true },
                      ].map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold', width: '220px', color: '#555' }}>{row.label}</td>
                          <td style={{ padding: '12px' }}>
                            {isEditingProfil && !row.readOnly ? (
                              <input type="text" value={(profil as any)[row.key]} onChange={(e) => setProfil({...profil, [row.key]: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                            ) : ( (profil as any)[row.key] )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU 3: RAPORT KADERISASI */}
          {activeMenu === 'raport' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd', minHeight: '500px' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '1px' }}>RAPORT KADERISASI</span>
              </div>

              <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>Jenjang:</span>
                <select value={filterRaport} onChange={(e) => setFilterRaport(e.target.value)} style={{ padding: '8px 15px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', minWidth: '200px', fontWeight: 'bold', color: '#333' }}>
                  <option value="MAPABA">Kaderisasi Formal: MAPABA</option>
                  <option value="PKD">Kaderisasi Formal: PKD</option>
                  <option value="NONFORMAL">Kaderisasi Non-Formal</option>
                </select>
                <button style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🖨️ Cetak KHS
                </button>
              </div>

              <div style={{ padding: '0 20px 20px 20px' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>
                  <button 
                    onClick={() => setTabRaport('raport')}
                    style={{ padding: '10px 20px', border: '1px solid', borderColor: tabRaport === 'raport' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaport === 'raport' ? '#fff' : 'transparent', color: tabRaport === 'raport' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}
                  >
                    📑 Raport Kaderisasi
                  </button>
                  <button 
                    onClick={() => setTabRaport('persentase')}
                    style={{ padding: '10px 20px', border: '1px solid', borderColor: tabRaport === 'persentase' ? '#ddd #ddd transparent #ddd' : 'transparent', background: tabRaport === 'persentase' ? '#fff' : 'transparent', color: tabRaport === 'persentase' ? '#555' : '#007bff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-1px', borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}
                  >
                    📊 Persentase Keaktifan Kader
                  </button>
                </div>

                {tabRaport === 'raport' && (
                  <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fff', padding: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #ddd', color: '#333' }}>
                          <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>No</th>
                          <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Kode Materi</th>
                          <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Nama Materi / Kegiatan</th>
                          <th style={{ padding: '12px 8px', fontWeight: 'bold', textAlign: 'center' }}>SKS</th>
                          <th style={{ padding: '12px 8px', fontWeight: 'bold', textAlign: 'center' }}>Nilai</th>
                          <th style={{ padding: '12px 8px', fontWeight: 'bold', textAlign: 'center' }}>SKS x Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materiAktif.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada materi untuk jenjang ini.</td></tr>
                        ) : barisMateriRender}

                        {/* Row Jumlah SKS & Total SKSxNilai */}
                        <tr style={{ borderTop: '2px solid #ddd' }}>
                          <td colSpan={3} style={{ padding: '15px 8px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                          <td style={{ padding: '15px 8px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{totalSks}</td>
                          <td style={{ padding: '15px 8px', textAlign: 'center' }}></td>
                          <td style={{ padding: '15px 8px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{totalBobotNilai}</td>
                        </tr>
                        {/* Row Indeks Prestasi */}
                        <tr style={{ borderTop: '1px solid #333' }}>
                          <td colSpan={5} style={{ padding: '20px 8px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>
                            IP (Indeks Prestasi) Kader
                          </td>
                          <td style={{ padding: '20px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#c0392b' }}>
                            {ipKader}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {tabRaport === 'persentase' && (
                  <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}>
                    <h4 style={{ margin: '0 0 20px 0', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Rincian Persentase Keaktifan ({filterRaport})</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px' }}>
                      {evaluasiKader.listKeaktifan && evaluasiKader.listKeaktifan.length > 0 ? (
                        evaluasiKader.listKeaktifan.map((item: any, idx: number) => {
                          const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6610f2'];
                          const barColor = colors[idx % colors.length];
                          return (
                            <div key={item.id || idx}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px', color: '#555' }}>
                                <span>{item.kategori}</span><span style={{ fontWeight: 'bold' }}>{item.nilai}%</span>
                              </div>
                              <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '10px', height: '15px', overflow: 'hidden' }}>
                                <div style={{ width: `${item.nilai}%`, backgroundColor: barColor, height: '100%', transition: 'width 1s' }}></div>
                              </div>
                            </div>
                          )
                        })
                      ) : (<p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>Belum ada tabel penilaian yang diinput oleh Pendamping.</p>)}
                      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderLeft: '4px solid #007bff', fontSize: '0.85rem', color: '#555' }}>
                        <b>Catatan Pendamping:</b><br/>{evaluasiKader.catatan || "Belum ada catatan."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MENU 4: UPLOAD BERKAS & TUGAS */}
          {activeMenu === 'upload' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd', minHeight: '500px' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '12px 20px', color: 'white', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '1px' }}>
                UPLOAD BERKAS & TUGAS RAYON
              </div>
              <div style={{ padding: '20px' }}>
                <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px' }}>Daftar tugas yang diminta oleh Pengurus Rayon. Silakan unggah format yang sesuai.</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#333' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px 8px', fontWeight: 'bold', width: '50px' }}>No</th>
                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Jenis Tugas / Berkas</th>
                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Batas Waktu</th>
                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Status</th>
                        <th style={{ padding: '12px 8px', fontWeight: 'bold', textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tugasRender.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada tugas dari Admin.</td></tr>
                      ) : (
                        tugasRender.map((tugas, index) => (
                          <tr key={tugas.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px 8px' }}>{index + 1}</td>
                            <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#004a87' }}>{tugas.nama_tugas}</td>
                            <td style={{ padding: '12px 8px', color: '#e74c3c' }}>{tugas.deadline || '-'}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{ color: tugas.statusPengerjaan === 'Selesai' ? '#27ae60' : tugas.statusPengerjaan === 'Menunggu Verifikasi' ? '#f39c12' : '#7f8c8d', fontWeight: 'bold' }}>
                                {tugas.statusPengerjaan}
                              </span>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              {tugas.statusPengerjaan === 'Selesai' ? (
                                <a href={tugas.link_file} target="_blank" style={{ backgroundColor: '#fff', border: '1px solid #27ae60', color: '#27ae60', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', textDecoration: 'none' }}>👁️ Lihat File</a>
                              ) : tugas.statusPengerjaan === 'Menunggu Verifikasi' ? (
                                <span style={{ fontStyle: 'italic', color: '#aaa' }}>Sedang dinilai...</span>
                              ) : (
                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  <input type="file" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} style={{ width: '150px', fontSize: '0.7rem' }} />
                                  <button onClick={() => handleUploadTugas(tugas.nama_tugas)} disabled={isUploading} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
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
            <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd', minHeight: '500px' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '1px' }}>PENGAJUAN SURAT</span>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#555' }}>📑 Daftar Pengajuan Surat Anda</h3>
                  <button onClick={() => setShowFormSurat(!showFormSurat)} style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {showFormSurat ? 'Batal' : '➕ Tambah Pengajuan'}
                  </button>
                </div>
                {showFormSurat && (
                  <div style={{ backgroundColor: '#f8f9fa', padding: '20px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '20px' }}>
                    <form onSubmit={handleAjukanSurat} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '5px' }}>Jenis Surat</label>
                        <select required value={jenisSurat} onChange={(e) => setJenisSurat(e.target.value)} style={{ padding: '10px', width: '250px', border: '1px solid #ccc', borderRadius: '4px' }}>
                          <option value="" disabled>-Pilih Satu-</option>
                          <option value="Surat Keterangan Aktif Anggota">Surat Keterangan Aktif Anggota</option>
                          <option value="Surat Rekomendasi Kegiatan">Surat Rekomendasi Kegiatan</option>
                          <option value="Surat Delegasi Kegiatan">Surat Delegasi Kegiatan</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '5px' }}>Keperluan</label>
                        <input type="text" required placeholder="Contoh: Rekomendasi PKD" value={keperluan} onChange={(e) => setKeperluan(e.target.value)} style={{ padding: '10px', width: '300px', border: '1px solid #ccc', borderRadius: '4px' }} />
                      </div>
                      <div style={{ alignSelf: 'flex-end' }}>
                        <button type="submit" disabled={isSubmittingSurat} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: isSubmittingSurat ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                          {isSubmittingSurat ? 'Menyimpan...' : 'Kirim Pengajuan'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#333' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Jenis Pengajuan</th><th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Tanggal Ajuan</th><th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Keperluan</th><th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayatSurat.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada pengajuan surat.</td></tr>
                      ) : (
                        riwayatSurat.map((surat, index) => (
                          <tr key={surat.id} style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                            <td style={{ padding: '12px 8px' }}>{surat.jenis}</td><td style={{ padding: '12px 8px' }}>{surat.tanggal}</td><td style={{ padding: '12px 8px' }}>{surat.keperluan}</td>
                            <td style={{ padding: '12px 8px', fontWeight: 'bold', color: surat.status === 'Menunggu Verifikasi' ? '#f39c12' : surat.status === 'Disetujui' ? '#27ae60' : '#c0392b' }}>{surat.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU 6: PERPUSTAKAAN PERGERAKAN */}
          {activeMenu === 'perpus' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd', minHeight: '500px' }}>
              <div style={{ backgroundColor: '#4a637d', padding: '12px 20px', color: 'white', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '1px' }}>PERPUSTAKAAN PERGERAKAN</div>
              <div style={{ padding: '30px' }}>
                <p style={{ color: '#555', marginBottom: '20px' }}>Pilih folder untuk melihat dokumen dan materi yang dibagikan oleh Admin Rayon:</p>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {folderPerpus.length === 0 ? (
                     <p style={{ color: '#999', fontStyle: 'italic' }}>Belum ada folder perpustakaan yang dibuat Admin.</p>
                  ) : (
                    folderPerpus.map((folderName: any, idx) => (
                      <div key={idx} onClick={() => setActiveFolder(folderName)} style={{ border: activeFolder === folderName ? '2px solid #007bff' : '1px solid #ddd', padding: '20px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', width: '200px', backgroundColor: activeFolder === folderName ? '#eaf2f8' : '#fafafa', transition: '0.2s' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📁</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>{folderName}</div>
                      </div>
                    ))
                  )}
                </div>
                {activeFolder && (
                  <div style={{ marginTop: '30px', borderTop: '2px dashed #eee', paddingTop: '20px' }}>
                    <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>Isi Folder: {activeFolder}</h4>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {fileDalamFolder.map((file, i) => (
                        <li key={i} style={{ padding: '10px', backgroundColor: '#f9f9f9', border: '1px solid #eee', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 'bold', color: '#555' }}>📄 {file.nama_file}</span>
                          <a href={file.link_file} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none', fontWeight: 'bold' }}>Download</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}