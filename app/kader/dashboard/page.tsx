'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, onSnapshot, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import * as XLSX from 'xlsx';

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
    status: 'Aktif', pendampingId: '', pendamping_skp_id: '' 
  });
  
  const [semuaPendamping, setSemuaPendamping] = useState<any[]>([]); 
  const [semuaRayon, setSemuaRayon] = useState<any[]>([]); 
  
  const [pengaturanCetak, setPengaturanCetak] = useState({ kopSuratUrl: '', footerUrl: '' });
  const [pengaturanCetakKomisariat, setPengaturanCetakKomisariat] = useState({ kopSuratUrl: '', footerUrl: '' });

  const [isEditingProfil, setIsEditingProfil] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [isSavingProfil, setIsSavingProfil] = useState(false); 

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
  
  // --- STATE BOBOT DARI RAYON & KOMISARIAT ---
  const [kategoriBobotRayon, setKategoriBobotRayon] = useState<Record<string, any[]>>({});
  const [kategoriBobotKomisariat, setKategoriBobotKomisariat] = useState<Record<string, any[]>>({});
  
  const [evaluasiKaderGlobal, setEvaluasiKaderGlobal] = useState<Record<string, any>>({});

  // --- STATE PERPUS ---
  const [listPerpus, setListPerpus] = useState<any[]>([]);

  // --- STATE TES PEMAHAMAN ---
  const [listTes, setListTes] = useState<any[]>([]);
  const [riwayatTes, setRiwayatTes] = useState<any[]>([]);
  const [selectedTesId, setSelectedTesId] = useState('');
  const [jawabanTes, setJawabanTes] = useState<Record<number, string>>({});
  const [isSubmittingTes, setIsSubmittingTes] = useState(false);

  // --- STATE ENTERPRISE (KALENDER, BROADCAST) ---
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);
  const [notifikasiGlobal, setNotifikasiGlobal] = useState<any[]>([]);

  // ==========================================
  // PENCATAT LOG AKTIVITAS PRIBADI (AUDIT TRAIL)
  // ==========================================
  const catatLogAktivitas = async (aksi: string) => {
    if (!profil.nim) return;
    try {
      await addDoc(collection(db, "log_aktivitas"), {
        id_rayon: profil.id_rayon,
        aktor: `Kader (${profil.nama})`,
        nim: profil.nim,
        role: "kader",
        aksi: aksi,
        timestamp: Date.now(),
        waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
    } catch (e) {}
  };

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "siakad_upload"); 
    const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
    const res = await fetch(`https://api.cloudinary.com/v1_1/dcmdaghbq/${resourceType}/upload`, {
      method: "POST", body: formData,
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Gagal upload ke Cloudinary");
    return data.secure_url.replace("http://", "https://");
  };

  useEffect(() => {
    const qPendamping = query(collection(db, "users"), where("role", "==", "pendamping"));
    const unsubP = onSnapshot(qPendamping, (snap) => {
      setSemuaPendamping(snap.docs.map(d => ({ username: d.id, ...d.data() })));
    });

    const qRayon = query(collection(db, "users"), where("role", "==", "rayon"));
    const unsubR = onSnapshot(qRayon, (snap) => {
      setSemuaRayon(snap.docs.map(d => ({ username: d.id, ...d.data() })));
    });

    return () => { unsubP(); unsubR(); };
  }, []);

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
              status: dataDB.status || 'Aktif',
              pendampingId: dataDB.pendamping_mapaba_id || dataDB.pendampingId || '',
              pendamping_skp_id: dataDB.pendamping_skp_id || '' 
            });

            if (dataDB.jenjang) setFilterRaport(dataDB.jenjang);

            if(dataDB.id_rayon) {
              onSnapshot(doc(db, "users", dataDB.id_rayon), (rayonSnap) => {
                if (rayonSnap.exists()) {
                   const rData = rayonSnap.data();
                   setPengaturanCetak({ kopSuratUrl: rData.kopSuratUrl || '', footerUrl: rData.footerUrl || '' });
                }
              });

              // Gabungkan semua pendamping dari berbagai jenjang kader
              const allP = [
                ...(Array.isArray(dataDB.pendamping_mapaba_id) ? dataDB.pendamping_mapaba_id : (dataDB.pendamping_mapaba_id ? [dataDB.pendamping_mapaba_id] : [])),
                ...(Array.isArray(dataDB.pendamping_pkd_id) ? dataDB.pendamping_pkd_id : (dataDB.pendamping_pkd_id ? [dataDB.pendamping_pkd_id] : [])),
                ...(Array.isArray(dataDB.pendamping_sig_id) ? dataDB.pendamping_sig_id : (dataDB.pendamping_sig_id ? [dataDB.pendamping_sig_id] : [])),
                ...(Array.isArray(dataDB.pendampingId) ? dataDB.pendampingId : (dataDB.pendampingId ? [dataDB.pendampingId] : []))
              ];

              jalankanPendengarDataRayon(dataDB.nim, user.email, dataDB.id_rayon, allP, dataDB.pendamping_skp_id);
            }
          }
        });
        
        onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.bobot_penilaian) setKategoriBobotKomisariat(data.bobot_penilaian);
            setPengaturanCetakKomisariat({ kopSuratUrl: data.kopSuratUrl || '', footerUrl: data.footerUrl || '' });
          }
        });

      } else {
        router.push('/');
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const jalankanPendengarDataRayon = (nimKader: string, emailKader: string | null, idRayon: string, pendampingId: any, pendampingSkpId: any) => {
    if(!nimKader || !emailKader || !idRayon) return;

    onSnapshot(doc(db, "kurikulum_rayon", idRayon), (docSnap) => {
      const dataRayon = docSnap.exists() ? docSnap.data() : {};
      onSnapshot(collection(db, "master_kurikulum_pusat"), (pusatSnap) => {
        const skpMateri: any[] = [];
        pusatSnap.forEach(d => { if (d.data().jenjang === 'SKP') skpMateri.push({ id: d.id, ...d.data() }); });
        skpMateri.sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' }));
        setListKurikulum({ ...dataRayon, SKP: skpMateri } as Record<string, any[]>);
      });
    });

    onSnapshot(doc(db, "pengaturan_rayon", idRayon), (docSnap) => {
      if (docSnap.exists() && docSnap.data().bobot_penilaian) {
        setKategoriBobotRayon(docSnap.data().bobot_penilaian);
      }
    });

    onSnapshot(doc(db, "nilai_khs", nimKader), (docSnap) => {
      if (docSnap.exists()) setNilaiKader(docSnap.data());
    });

    const qBerkas = query(collection(db, "berkas_kader"), where("email_kader", "==", emailKader));
    onSnapshot(qBerkas, (snap) => {
      const dataBerkas: any[] = [];
      snap.forEach((doc) => dataBerkas.push({ id: doc.id, ...doc.data() }));
      dataBerkas.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setRiwayatBerkas(dataBerkas);
    });

    onSnapshot(query(collection(db, "master_tugas"), where("id_rayon", "==", idRayon)), (snapRayon) => {
      const dataTugasRayon: any[] = [];
      snapRayon.forEach((doc) => dataTugasRayon.push({ id: doc.id, ...doc.data() }));

      onSnapshot(query(collection(db, "master_tugas"), where("jenjang", "==", "SKP")), (snapSkp) => {
        const dataTugasSkp: any[] = [];
        snapSkp.forEach((doc) => dataTugasSkp.push({ id: doc.id, ...doc.data() }));
        const mergedTugas = [...dataTugasRayon, ...dataTugasSkp];
        const uniqueTugas = Array.from(new Map(mergedTugas.map(item => [item.id, item])).values());
        setListMasterTugas(uniqueTugas);
      });
    });

    onSnapshot(query(collection(db, "perpustakaan"), where("id_rayon", "==", idRayon)), (snap) => {
      const dataPerpus: any[] = [];
      snap.forEach((doc) => dataPerpus.push({ id: doc.id, ...doc.data() }));
      setListPerpus(dataPerpus);
    });

    onSnapshot(query(collection(db, "master_tes"), where("id_rayon", "==", idRayon)), (snapRayon) => {
      const tesRayon: any[] = [];
      snapRayon.forEach((doc) => tesRayon.push({ id: doc.id, ...doc.data() }));

      onSnapshot(query(collection(db, "master_tes_pusat"), where("jenjang", "==", "SKP")), (snapSkp) => {
        const tesSkp: any[] = [];
        snapSkp.forEach((doc) => tesSkp.push({ id: doc.id, ...doc.data() }));
        const mergedTes = [...tesRayon, ...tesSkp];
        const uniqueTes = Array.from(new Map(mergedTes.map(item => [item.id, item])).values());
        setListTes(uniqueTes);
      });
    });

    onSnapshot(query(collection(db, "jawaban_tes"), where("nim", "==", nimKader)), (snap) => {
      const riwayat: any[] = [];
      snap.forEach((doc) => riwayat.push({ id: doc.id, ...doc.data() }));
      setRiwayatTes(riwayat);
    });

    const pIdRayon = Array.isArray(pendampingId) ? pendampingId : (pendampingId ? [pendampingId] : []);
    const pIdSkp = Array.isArray(pendampingSkpId) ? pendampingSkpId : (pendampingSkpId ? [pendampingSkpId] : []);
    const allPendampingIds = [...pIdRayon, ...pIdSkp].filter(Boolean);

    // Buka Filter Jadwal agar kader melihat event dengan benar
    onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
      const listJadwal: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.pembuat === "Komisariat" || d.pembuat === "Pusat Komisariat" || d.id_rayon === "Komisariat" || d.id_rayon === idRayon) {
          
          if (d.target === "Rayon" || d.target === "Pendamping") return; // Kader tidak bisa melihat
          
          // Jika target binaan, cek apakah pengirim adalah salah satu pendamping kader ini
          if (d.target === "Binaan" || (d.pembuat && d.pembuat.includes("Pendamping"))) {
             if (!allPendampingIds.includes(d.pendamping_id)) return;
          }

          listJadwal.push({ id: doc.id, ...d });
        }
      });
      listJadwal.sort((a, b) => b.timestamp - a.timestamp);
      setJadwalKegiatan(listJadwal);
    });

    // Buka Filter Notifikasi
    onSnapshot(collection(db, "notifikasi_global"), (snap) => {
      const listNotif: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.target === "Semua" || d.target === "Kader" || (d.target === "Binaan" && allPendampingIds.includes(d.pengirim_id))) {
          if (d.pengirim === "Pusat Komisariat" || d.id_rayon === "Komisariat" || d.id_rayon === idRayon || allPendampingIds.includes(d.pengirim_id)) {
            listNotif.push({ id: doc.id, ...d });
          }
        }
      });
      listNotif.sort((a, b) => b.timestamp - a.timestamp);
      setNotifikasiGlobal(listNotif);
    });
  };

  useEffect(() => {
    if (!profil.nim) return;
    const unsubscribeKeaktifan = onSnapshot(doc(db, "evaluasi_kader", profil.nim), (docSnap) => {
      if (docSnap.exists()) {
        setEvaluasiKaderGlobal(docSnap.data());
      } else {
        setEvaluasiKaderGlobal({});
      }
    });
    return () => unsubscribeKeaktifan();
  }, [profil.nim]);


  const getNamaPendamping = (idData: any) => {
    if (!idData || idData.length === 0) return "Belum Diplotkan";
    if (Array.isArray(idData)) {
       if(idData.length === 0) return "Belum Diplotkan";
       return idData.map(id => semuaPendamping.find(p => p.username === id || p.id === id)?.nama || id).join(', ');
    }
    return semuaPendamping.find(p => p.username === idData || p.id === idData)?.nama || idData;
  };

  const getNamaInstansi = (idData: string) => {
    if (!idData) return "Pusat Komisariat";
    if (idData === 'Komisariat' || idData === 'Pusat Komisariat') return 'Pusat Komisariat';
    const r = semuaRayon.find(x => x.username === idData || x.id_rayon === idData || x.id === idData);
    return r ? r.nama : idData;
  };

  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };

  const getNilaiHurufRealtime = (kodeMateri: string, jenjangTujuan: string) => {
    const bobotJenjang = jenjangTujuan === 'SKP' ? (kategoriBobotKomisariat['SKP'] || []) : (kategoriBobotRayon[jenjangTujuan] || []);
    const mentah = evaluasiKaderGlobal[jenjangTujuan]?.nilai_mentah?.[kodeMateri];
    
    if (!bobotJenjang || bobotJenjang.length === 0) return "-";
    if (!mentah || Object.keys(mentah).length === 0) return nilaiKader[kodeMateri] || "-";

    let angkaAkhir = 0;
    bobotJenjang.forEach((kat: any) => {
        const score = mentah[kat.nama] || 0;
        angkaAkhir += (score * (kat.persen / 100));
    });
    return getNilaiHuruf(angkaAkhir);
  };

  const hitungIpkPerJenjang = (jenjang: string) => {
    const materi = listKurikulum[jenjang] || [];
    if (materi.length === 0) return null;
    let tSks = 0; let tBobot = 0; let adaNilai = false;
    
    materi.forEach(m => {
        const huruf = getNilaiHurufRealtime(m.kode, jenjang);
        tSks += (m.bobot || 0);
        if (huruf !== "-") {
            adaNilai = true;
            tBobot += (m.bobot || 0) * konversiHurufKeAngka(huruf);
        }
    });
    if (!adaNilai) return null;
    return tSks > 0 ? (tBobot / tSks).toFixed(2) : "0.00";
  };

  const ipkMapaba = hitungIpkPerJenjang('MAPABA');
  const ipkPkd = hitungIpkPerJenjang('PKD');
  const ipkSig = hitungIpkPerJenjang('SIG');
  const ipkSkp = hitungIpkPerJenjang('SKP');

  const materiAktif = listKurikulum[filterRaport] || [];
  let totalSks = 0;
  let totalBobotNilai = 0;

  const evaluasiKader = evaluasiKaderGlobal[filterRaport] || { nilai_mentah: {}, catatan: '' };
  const nilaiMentah = evaluasiKader.nilai_mentah || {};
  const kategoriBobot = filterRaport === 'SKP' ? (kategoriBobotKomisariat['SKP'] || []) : (kategoriBobotRayon[filterRaport] || []);

  const barisMateriRender = materiAktif.map((materi, index) => {
    const nilaiHuruf = getNilaiHurufRealtime(materi.kode, filterRaport);
    const angkaNilai = konversiHurufKeAngka(nilaiHuruf);
    const sksKaliNilai = (materi.bobot || 0) * angkaNilai;
    
    totalSks += (materi.bobot || 0);
    if (nilaiHuruf !== "-") totalBobotNilai += sksKaliNilai;

    return (
      <tr key={materi.kode}>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{index + 1}</td>
        <td style={{ padding: '6px 10px', textAlign: 'left' }}>{materi.kode}</td>
        <td style={{ padding: '6px 10px', textAlign: 'left' }}>{materi.nama}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{materi.bobot}</td>
        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: nilaiHuruf !== '-' ? '#27ae60' : '#555' }}>
           {nilaiHuruf === '-' ? '' : nilaiHuruf}
        </td>
        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{nilaiHuruf === '-' ? 0 : sksKaliNilai}</td>
      </tr>
    );
  });

  const ipKaderTampilan = totalSks > 0 ? (totalBobotNilai / totalSks).toFixed(2) : "0.00";

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
      catatLogAktivitas("Memperbarui data profil pribadi.");
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
      catatLogAktivitas(`Mengunggah tugas/berkas: ${namaTugas}`);
      alert(`Sukses! File ${namaTugas} berhasil diunggah.`);
      setFileToUpload(null);
    } catch (error) { alert("Error mengunggah berkas."); } finally { setIsUploading(false); }
  };

  const handleKirimJawabanTes = async (e: React.FormEvent, currentTes: any) => {
    e.preventDefault();
    if (!profil.nim || !currentTes) return;

    const totalSoal = currentTes.daftar_soal?.length || 0;
    if (Object.keys(jawabanTes).length < totalSoal) {
      alert("Harap jawab semua pertanyaan sebelum mengirim!"); return;
    }
    setIsSubmittingTes(true);
    try {
      const tgl = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
      await addDoc(collection(db, "jawaban_tes"), {
        nim: profil.nim, nama: profil.nama, id_rayon: profil.id_rayon,
        id_tes: currentTes.id, judul_tes: currentTes.judul, jenjang: currentTes.jenjang || 'Umum',
        jawaban: jawabanTes, tanggal: tgl, timestamp: Date.now()
      });
      catatLogAktivitas(`Menyelesaikan tes pemahaman: ${currentTes.judul}`);
      alert("Jawaban Tes Berhasil Dikirim!");
      setJawabanTes({});
    } catch (error) { alert("Gagal mengirim jawaban tes. Cek koneksi Anda."); } finally { setIsSubmittingTes(false); }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/'); };
  const handleDownloadPDF = () => { window.print(); };

  const handleExportNilaiExcel = () => {
    if (materiAktif.length === 0) return alert("Belum ada data nilai!");
    const dataToExport = materiAktif.map((m, i) => {
      const huruf = getNilaiHurufRealtime(m.kode, filterRaport);
      const angka = konversiHurufKeAngka(huruf);
      return {
        "No": i + 1,
        "Kode Materi": m.kode,
        "Nama Materi": m.nama,
        "Bobot SKS": m.bobot,
        "Nilai Huruf": huruf,
        "SKS x Nilai": (m.bobot || 0) * angka
      };
    });
    
    dataToExport.push({ "No": "" as any, "Kode Materi": "", "Nama Materi": "TOTAL SKS & NILAI", "Bobot SKS": totalSks, "Nilai Huruf": "", "SKS x Nilai": totalBobotNilai });
    dataToExport.push({ "No": "" as any, "Kode Materi": "", "Nama Materi": "INDEKS PRESTASI KADER (IPK)", "Bobot SKS": "" as any, "Nilai Huruf": ipKaderTampilan as any, "SKS x Nilai": "" as any });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Raport_${filterRaport}`);
    XLSX.writeFile(workbook, `Raport_Kader_${profil.nama.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
    catatLogAktivitas("Mengekspor (Download Excel) Transkrip KHS.");
  };

  const tugasRender = listMasterTugas.map((tugas) => {
    const tugasDisubmit = riwayatBerkas.find((b) => b.jenis_berkas === tugas.nama_tugas);
    let statusPengerjaan = 'Belum Mengumpulkan';
    if (tugasDisubmit) { statusPengerjaan = tugasDisubmit.status === 'Selesai' ? 'Selesai' : 'Menunggu Verifikasi'; }
    return { ...tugas, statusPengerjaan, id_berkas_tersimpan: tugasDisubmit?.id, link_file: tugasDisubmit?.file_link_or_id };
  });

  const groupedPerpus = listPerpus.reduce((acc, item) => { if (!acc[item.folder]) acc[item.folder] = []; acc[item.folder].push(item); return acc; }, {});

  const getHeaderTitle = () => {
    switch (activeMenu) {
      case 'home': return 'Dashboard Utama';
      case 'profil': return 'Profil Saya';
      case 'raport': return 'Raport Kaderisasi';
      case 'tes-materi': return 'Tes Pemahaman';
      case 'upload': return 'Tugas Kader';
      case 'perpus': return 'Perpustakaan Digital';
      default: return 'Dashboard Kader';
    }
  };

  return (
    <div className="app-container">
      
      {/* CSS KHUSUS UNTUK TAMPILAN WEB & CETAK PDF A4 BACKGROUND */}
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.4); }
        input, select, textarea { max-width: 100%; }
        @media (min-width: 768px) { aside { left: 0 !important; } main { margin-left: 240px !important; } .menu-burger { display: none !important; } }
        div[style*="overflowX: auto"], div[style*="overflow-x: auto"] { -webkit-overflow-scrolling: touch; }
        
        .app-container { display: flex; background-color: #f4f6f9; height: 100vh; overflow: hidden; font-family: Arial, sans-serif; }
        
        .tabel-utama { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 600px; }
        .tabel-utama thead tr { border-top: 2px solid #555; border-bottom: 2px solid #555; background-color: #fff; }
        .tabel-utama th { padding: 10px; color: #333; text-align: center; font-weight: bold; }
        .tabel-utama td { padding: 8px 10px; border-bottom: 1px solid #ddd; color: #333; }
        
        /* ------------------------------------------------------------- */
        /* PENGATURAN HIDDEN PRINT AGAR BISA MENGAKOMODASI MULTI-PAGE    */
        /* ------------------------------------------------------------- */
        .print-layout-container { 
           position: absolute !important; 
           top: -9999px !important; left: -9999px !important; 
           width: 1px !important; height: 1px !important; 
           overflow: hidden !important; opacity: 0 !important; 
           pointer-events: none !important; z-index: -9999 !important; 
        }

        @media screen { .bg-kertas-a4 { display: none !important; pointer-events: none !important; } }
        
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background-color: transparent !important; background: transparent !important; margin: 0; padding: 0; height: auto !important; overflow: visible !important; }
          
          /* BATALKAN OVERFLOW HIDDEN AGAR HALAMAN TIDAK TERPOTONG / BLANK */
          .app-container {
             display: block !important;
             height: auto !important;
             overflow: visible !important;
             background-color: transparent !important;
             background: transparent !important;
          }

          /* SEMBUNYIKAN SIDEBAR DAN MAIN UI WEB */
          aside, main, header, .no-print { display: none !important; }
          
          /* MUNCULKAN WADAH PRINT SEBAGAI WADAH UTAMA SAAT PRINT */
          .print-layout-container { 
            display: block !important; 
            position: absolute !important; 
            top: 0 !important; left: 0 !important; width: 100% !important;
            height: auto !important;       
            overflow: visible !important;  
            background-color: transparent !important;
            opacity: 1 !important; 
            z-index: 10 !important; 
            visibility: visible !important;
          }
          
          .print-layout-container * {
            color: #000 !important; 
            font-family: "Arial", "Arial Narrow", sans-serif !important; 
          }
          
          /* BACKGROUND HARUS FIXED AGAR MUNCUL DI TIAP HALAMAN */
          .bg-kertas-a4 { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; width: 210mm !important; height: 297mm !important; z-index: -1 !important; }
          .bg-kertas-a4 img { width: 210mm !important; height: 297mm !important; object-fit: fill !important; display: block !important; }

          /* TRICK MASTER TABLE UNTUK MULTI-PAGE PDF */
          table.master-print-table { width: 100% !important; border: none !important; margin: 0 !important; padding: 0 !important; background-color: transparent !important; page-break-inside: auto !important; position: relative !important; z-index: 10 !important; }
          table.master-print-table > thead { display: table-header-group !important; }
          table.master-print-table > tfoot { display: table-footer-group !important; }
          table.master-print-table > tbody { display: table-row-group !important; }
          table.master-print-table > thead > tr > td, 
          table.master-print-table > tbody > tr > td, 
          table.master-print-table > tfoot > tr > td { border: none !important; padding: 0 !important; background-color: transparent !important; }
          
          /* PENGATURAN JARAK KOP ATAS & FOOTER BAWAH DI TIAP HALAMAN (Bisa diubah angkanya di sini) */
          .header-space { height: 55mm !important; } 
          .footer-space { height: 35mm !important; } 

          /* KONTEN TENGAH */
          .print-content-area { position: relative !important; z-index: 10 !important; padding: 0 25mm !important; background-color: transparent !important; }
          
          /* TABEL DATA */
          .tabel-utama { width: 100% !important; border-collapse: collapse !important; background-color: transparent !important; page-break-inside: auto !important; }
          .tabel-utama tr { page-break-inside: avoid !important; page-break-after: auto !important; background-color: transparent !important; }
          .tabel-utama thead { display: table-header-group !important; }
          .tabel-utama tfoot { display: table-footer-group !important; }
          .tabel-utama thead tr { border-top: 1px solid #000 !important; border-bottom: 1px solid #000 !important; } 
          .tabel-utama th, .tabel-utama td { 
             border: 1px solid #000 !important; 
             padding: 4px 6px !important; 
             font-size: 11pt !important; 
             background-color: transparent !important; 
             color: #000 !important; 
          }
          .tabel-utama th { font-weight: bold !important; text-align: center !important; }
          
          .tabel-biodata { margin-bottom: 15px !important; border: none !important; width: 100% !important; }
          .tabel-biodata td, .tabel-biodata tr { border: none !important; padding: 3px 0 !important; text-align: left !important; }
        }
      `}</style>

      {/* OVERLAY HP (Muncul saat sidebar terbuka, klik untuk menutup) */}
      {isSidebarOpen && (
        <div 
          className="no-print"
          onClick={() => setIsSidebarOpen(false)} 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }} 
        />
      )}

      {/* SIDEBAR KADER */}
      <aside className="no-print" style={{ width: '240px', background: 'linear-gradient(100deg, #0000af 100%)', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: isSidebarOpen ? '0' : '-240px', zIndex: 50, transition: 'left 0.3s ease', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '15px', fontSize: '1.1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🎓 SIAKAD PMII</span>
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'block' }}>×</button>
        </div>
        <div style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <img src={profil.fotoUrl} alt="Foto" style={{ width: '45px', height: '45px', backgroundColor: '#e74c3c', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f1c40f' }} />
          <div>
            <h4 style={{ fontSize: '0.8rem', margin: '0 0 3px 0', color: '#fff', lineHeight: '1.2' }}>{profil.nama}</h4>
            <p style={{ fontSize: '0.7rem', color: '#f1c40f', margin: 0, fontWeight: 'bold' }}>{profil.nia}</p>
          </div>
        </div>
        <ul style={{ listStyle: 'none', padding: '10px 0', overflowY: 'auto', flex: 1, margin: 0 }}>
          {[
            { id: 'home', icon: '🏠', label: 'Dashboard Utama' },
            { id: 'profil', icon: '👤', label: 'Profil Saya' },
            { id: 'raport', icon: '📊', label: 'Raport Kaderisasi' },
            { id: 'tes-materi', icon: '📝', label: 'Tes Pemahaman' },
            { id: 'upload', icon: '📤', label: 'Tugas Kader' },
            { id: 'perpus', icon: '📚', label: 'Perpustakaan' },
          ].map((item) => (
            <li key={item.id}>
              <button onClick={() => { setActiveMenu(item.id); setIsSidebarOpen(false); }} style={{ width: '100%', textAlign: 'left', background: activeMenu === item.id ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeMenu === item.id ? '#f1c40f' : '#ecf0f1', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer', borderLeft: activeMenu === item.id ? '4px solid #f1c40f' : '4px solid transparent', transition: '0.2s', fontWeight: activeMenu === item.id ? 'bold' : 'normal' }}>
                <div style={{ display: 'flex', gap: '10px' }}><span style={{fontSize: '1rem'}}>{item.icon}</span> {item.label}</div>
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#f1c40f', border: '1px solid #f1c40f', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', fontSize: '0.85rem' }}>🚪 Keluar Sistem</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="no-print" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '0', width: '100%', overflowX: 'hidden' }}>
        
        {/* HEADER ATAS DINAMIS */}
        <header style={{ backgroundColor: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 40 }}>
          <button className="menu-burger" onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#0d1b2a' }}>☰</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ fontSize: '1rem', color: '#333', margin: 0, textTransform: 'uppercase', fontWeight: 'bold' }}>{getHeaderTitle()}</h2>
            <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', color: profil.status === 'Aktif' ? '#1e824c' : '#c62828', backgroundColor: profil.status === 'Aktif' ? '#e8f5e9' : '#ffebee', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: profil.status === 'Aktif' ? '#2ecc71' : '#e74c3c', borderRadius: '50%' }}></span>
              {profil.status === 'Aktif' ? 'Kader Aktif' : 'Kader Non-Aktif'}
            </span>
          </div>
        </header>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          
          {/* MENU 1: HOME (BERANDA) */}
          {activeMenu === 'home' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
                <h2 style={{marginTop: 0, fontSize: '1.5rem', color: '#0000af'}}>Halo, Sahabat/i {profil.nama.split(' ')[0]}! 👋</h2>
                <p style={{margin: '8px 0 0 0', fontSize: '0.9rem', color: '#555', opacity: 0.9}}>Selamat datang di Sistem Informasi Akademik dan Kaderisasi {getNamaInstansi(profil.id_rayon)}. Berikut adalah ringkasan progres kaderisasi Anda saat ini.</p>
              </div>

              {/* KARTU RINGKASAN (TanPA KARTU JENJANG) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '10px' }}>
                
                {/* KARTU PENDAMPING (MENDUKUNG MULTI-PENDAMPING) */}
                <div style={{ backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', borderLeft: '4px solid #2ecc71', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold' }}>Pendamping Rayon</div>
                  <div style={{ fontSize: '1.1rem', color: '#333', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getNamaPendamping(profil.pendampingId)}
                  </div>
                  
                  <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '8px' }}>Pendamping SKP (Komisariat)</div>
                  <div style={{ fontSize: '1.1rem', color: '#0000af', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getNamaPendamping(profil.pendamping_skp_id)}
                  </div>
                </div>

                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #e74c3c', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 'bold' }}>Tugas Diselesaikan</div>
                  <div style={{ fontSize: '1.5rem', color: '#333', fontWeight: 'bold', marginTop: '5px' }}>
                    {tugasRender.filter(t => t.statusPengerjaan === 'Selesai').length} <span style={{fontSize: '0.8rem', color: '#888'}}>/ {tugasRender.length}</span>
                  </div>
                </div>
              </div>

              {/* IPK PER JENJANG */}
              <h4 style={{ margin: '0 0 5px 0', color: '#0000af', fontSize: '1.1rem' }}>📊 Indeks Prestasi Kader (IPK)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '10px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>IPK MAPABA</div>
                      <div style={{ fontSize: '1.5rem', color: ipkMapaba ? '#0000af' : '#999', fontWeight: 'bold', marginTop: '5px' }}>{ipkMapaba || '-'}</div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>IPK PKD</div>
                      <div style={{ fontSize: '1.5rem', color: ipkPkd ? '#0000af' : '#999', fontWeight: 'bold', marginTop: '5px' }}>{ipkPkd || '-'}</div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>IPK SIG</div>
                      <div style={{ fontSize: '1.5rem', color: ipkSig ? '#0000af' : '#999', fontWeight: 'bold', marginTop: '5px' }}>{ipkSig || '-'}</div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>IPK SKP</div>
                      <div style={{ fontSize: '1.5rem', color: ipkSkp ? '#0000af' : '#999', fontWeight: 'bold', marginTop: '5px' }}>{ipkSkp || '-'}</div>
                  </div>
              </div>

              {/* JADWAL & NOTIFIKASI */}
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {/* NOTIFIKASI */}
                  <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🔔 Pusat Informasi</h3>
                    <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                      {notifikasiGlobal.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Kotak masuk informasi kosong.</div>
                      ) : (
                        notifikasiGlobal.map(notif => (
                          <div key={notif.id} style={{ padding: '15px', backgroundColor: '#fcfcfc', border: '1px solid #eee', borderLeft: '4px solid #1e824c', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                              <strong style={{ color: '#333', fontSize: '0.9rem' }}>{notif.judul}</strong>
                              <span style={{ fontSize: '0.7rem', color: '#888' }}>{notif.tanggal}</span>
                            </div>
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap' }}>{notif.pesan}</p>
                            <div style={{ fontSize: '0.7rem', color: '#3498db', fontWeight: 'bold' }}>Dari: {notif.pengirim}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* JADWAL */}
                  <div style={{ flex: '1 1 350px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ color: '#0d1b2a', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📅 Jadwal Kegiatan</h3>
                    <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                      {jadwalKegiatan.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999', fontSize: '0.85rem' }}>Belum ada agenda kegiatan dalam waktu dekat.</div>
                      ) : (
                        jadwalKegiatan.map(jadwal => {
                          const isKomisariat = jadwal.pembuat === 'Komisariat' || jadwal.pembuat === 'Pusat Komisariat' || jadwal.id_rayon === 'Komisariat';
                          const isPendamping = jadwal.pembuat?.includes('Pendamping');
                          const borderColor = isKomisariat ? '#f1c40f' : isPendamping ? '#3498db' : '#e74c3c';
                          const labelPembuat = isKomisariat ? 'Pusat Komisariat' : isPendamping ? 'Jadwal Mentoring' : 'Pengurus Rayon';

                          return (
                            <div key={jadwal.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderLeft: `4px solid ${borderColor}`, padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                  <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '0.95rem' }}>{jadwal.judul}</h4>
                                  <span style={{ backgroundColor: '#f8f9fa', color: '#555', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{labelPembuat}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 'bold', marginBottom: '5px' }}>🗓️ {jadwal.tanggal.replace('T', ' - ')} | 📍 {jadwal.lokasi}</div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#555', fontStyle: 'italic' }}>{jadwal.deskripsi}</p>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* MENU 4: PROFIL KADER */}
          {activeMenu === 'profil' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
              <div style={{ padding: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 180px', textAlign: 'center' }}>
                  <img src={profil.fotoUrl} alt="Foto Formal" style={{ width: '100%', height: '230px', objectFit: 'cover', border: '4px solid #eee', borderRadius: '8px' }} />
                  {isEditingProfil && (
                    <div style={{ marginTop: '10px', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>Unggah Foto Baru:</label>
                      <input type="file" accept="image/*" onChange={handleFotoChange} style={{ width: '100%', fontSize: '0.7rem', marginTop: '5px' }} />
                    </div>
                  )}
                  <button 
                    disabled={isSavingProfil}
                    onClick={() => isEditingProfil ? handleSimpanProfil() : setIsEditingProfil(true)} 
                    style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: isEditingProfil ? '#f1c40f' : '#0000af', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSavingProfil ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
                    {isSavingProfil ? 'Menyimpan...' : isEditingProfil ? '💾 Simpan Profil' : '📝 Ubah Profil Saya'}
                  </button>
                </div>
                <div style={{ flex: '1 1 350px' }}>
                  <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#333', minWidth: '400px' }}>
                      <tbody>
                        {[
                          { label: 'NIM', key: 'nim', readOnly: true },
                          { label: 'Nomor Induk Anggota (NIA)', key: 'nia', readOnly: true },
                          { label: 'Nama Lengkap', key: 'nama', readOnly: true },
                          { label: 'Angkatan / Tahun Masuk', key: 'angkatan' },
                          { label: 'Tempat Lahir', key: 'tempatLahir' },
                          { label: 'Tanggal Lahir', key: 'tanggalLahir' },
                          { label: 'Asal Instansi/Rayon', key: 'id_rayon', readOnly: true, isInstansi: true },
                          { label: 'Alamat Asal (Lengkap)', key: 'alamatAsal' },
                          { label: 'Alamat Domisili Malang', key: 'alamatDomisili' },
                        ].map((row: any, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold', width: '200px', color: '#555' }}>{row.label}</td>
                            <td style={{ padding: '10px' }}>
                              {isEditingProfil && !row.readOnly ? (
                                <input type="text" value={(profil as any)[row.key]} onChange={(e) => setProfil({...profil, [row.key]: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                              ) : ( 
                                <span style={{ color: row.readOnly ? '#888' : '#333', fontStyle: row.readOnly ? 'italic' : 'normal' }}>
                                  {row.isInstansi ? getNamaInstansi((profil as any)[row.key]) : (profil as any)[row.key]}
                                </span> 
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {isEditingProfil && <p style={{ fontSize: '0.75rem', color: '#e74c3c', marginTop: '10px' }}>*NIM, Nama, dan NIA hanya bisa diubah oleh Pengurus Rayon/Cabang.</p>}
                </div>
              </div>
            </div>
          )}

          {/* MENU 5: RAPORT KADERISASI */}
          {activeMenu === 'raport' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '500px', overflow: 'hidden', paddingBottom: '20px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '15px 20px', gap: '15px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #ddd', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontWeight: 'bold', color: '#333', fontSize: '0.85rem' }}>Pilih Raport Jenjang:</span>
                   <select value={filterRaport} onChange={(e) => setFilterRaport(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#0000af' }}>
                      <option value="MAPABA">MAPABA</option>
                      <option value="PKD">PKD</option>
                      <option value="SIG">SIG</option>
                      <option value="SKP">SKP</option>
                      <option value="NONFORMAL">Non-Formal</option>
                   </select>
                </div>
                
                {/* TOMBOL EXPORT DAN CETAK */}
                {tabRaport === 'raport' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleExportNilaiExcel} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                      📥 Export Excel
                    </button>
                    <button onClick={handleDownloadPDF} style={{ backgroundColor: '#f1c40f', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                      🖨️ Cetak KHS
                    </button>
                  </div>
                )}
              </div>

              <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '0 20px', backgroundColor: '#fff', marginTop: '15px', flexWrap: 'wrap' }}>
                 <button onClick={() => setTabRaport('raport')} style={{ padding: '5px 12px', border: 'none', background: tabRaport === 'raport' ? '#fff' : 'transparent', color: tabRaport === 'raport' ? '#007bff' : '#555', fontWeight: tabRaport === 'raport' ? 'bold' : 'normal', borderTop: tabRaport === 'raport' ? '3px solid #007bff' : '3px solid transparent', borderRight: '1px solid #ddd', borderLeft: '1px solid #ddd', cursor: 'pointer', marginBottom: '-1px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   Raport Kaderisasi
                 </button>
                 <button onClick={() => setTabRaport('persentase')} style={{ padding: '5px 12px', border: 'none', background: tabRaport === 'persentase' ? '#fff' : 'transparent', color: tabRaport === 'persentase' ? '#007bff' : '#555', fontWeight: tabRaport === 'persentase' ? 'bold' : 'normal', borderTop: tabRaport === 'persentase' ? '3px solid #007bff' : '3px solid transparent', borderRight: '1px solid #ddd', cursor: 'pointer', marginBottom: '-1px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   Persentase & Nilai
                 </button>
              </div>

              <div style={{ padding: '3px' }}>

                {/* TAB 1: RAPORT KADERISASI */}
                {tabRaport === 'raport' && (
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
                          <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Kurikulum jenjang ini belum diatur oleh Pengurus.</td></tr>
                        ) : barisMateriRender}
                        
                        <tr style={{ borderTop: '2px solid #ccc' }}>
                          <td colSpan={3} style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                          <td style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                          <td className="no-print"></td>
                          <td style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}>
                          <td colSpan={5} style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>IPK (Indeks Prestasi Kader)</td>
                          <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#333' }}>{ipKaderTampilan}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p style={{fontSize: '0.75rem', color: '#888', marginTop: '15px', fontStyle: 'italic'}}>*Catatan: Nilai Huruf pada tabel ini terisi otomatis berdasarkan perhitungan Matriks di tab "Rincian Persentase & Nilai".</p>
                  </div>
                )}

                {/* TAB 2: INPUT NILAI MATRIKS (EVALUASI) */}
                {tabRaport === 'persentase' && (
                  <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0', boxSizing: 'border-box' }}>
                    <table className="tabel-utama" style={{ textAlign: 'center', minWidth: '900px', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ width: '3%' }}>No</th>
                          <th rowSpan={2} style={{ width: '8%', textAlign: 'left' }}>Kode</th>
                          <th rowSpan={2} style={{ width: '35%', textAlign: 'left' }}>Nama Matakuliah</th>
                          {kategoriBobot.length > 0 && <th colSpan={kategoriBobot.length} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f0fbf4' }}>Nilai Detail (0-100)</th>}
                          <th rowSpan={2} style={{ width: '5%' }}>SKS</th>
                          <th colSpan={2} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#eaf4fc' }}>Hasil Akhir</th>
                          <th rowSpan={2} style={{ width: '8%' }}>SKS x Nilai Huruf</th>
                        </tr>
                        <tr>
                          {kategoriBobot.map((kat: any) => (
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
                          <tr><td colSpan={7 + kategoriBobot.length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada rincian nilai untuk jenjang ini.</td></tr>
                        ) : (
                          materiAktif.map((materi, index) => {
                            let angkaAkhir = 0;
                            kategoriBobot.forEach((kat: any) => {
                                const score = nilaiMentah[materi.kode]?.[kat.nama] || 0;
                                angkaAkhir += (score * (kat.persen / 100));
                            });

                            const hurufAkhir = getNilaiHuruf(angkaAkhir);
                            const angkaNilaiSks = konversiHurufKeAngka(hurufAkhir);
                            const sksKaliNilai = (materi.bobot || 0) * angkaNilaiSks;

                            return (
                              <tr key={`rinci-${materi.kode}`}>
                                <td>{index + 1}</td>
                                <td style={{ textAlign: 'left' }}>{materi.kode}</td>
                                <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{materi.nama}</td>
                                
                                {kategoriBobot.map((kat: any) => (
                                  <td key={kat.id} style={{ backgroundColor: '#fcfcfc', fontWeight: 'bold', color: '#333' }}>
                                    {nilaiMentah[materi.kode]?.[kat.nama] || 0}
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
                          <td colSpan={4 + kategoriBobot.length} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kaderisasi)</td>
                          <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '1.1rem' }}>{ipKaderTampilan}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="no-print" style={{ marginTop: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '15px' }}>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#1e824c' }}>Catatan Khusus dari Pendamping/Instansi:</label>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: evaluasiKader.catatan ? '#333' : '#999', fontStyle: evaluasiKader.catatan ? 'italic' : 'normal' }}>
                        {evaluasiKader.catatan ? `"${evaluasiKader.catatan}"` : 'Belum ada catatan evaluasi.'}
                      </p>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* MENU 6: TES PEMAHAMAN MATERI */}
          {activeMenu === 'tes-materi' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', minHeight: '500px', overflow: 'hidden' }}>
              <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>Pilih Jenis Tes:</span>
                <select 
                  value={selectedTesId} 
                  onChange={(e) => setSelectedTesId(e.target.value)} 
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.85rem', flex: '1 1 200px', maxWidth: '300px' }}
                >
                  <option value="" disabled>-- Pilih Tes Pemahaman --</option>
                  {listTes.length === 0 && <option value="" disabled>Belum ada tes yang dibuat Admin</option>}
                  {listTes.map(tes => <option key={tes.id} value={tes.id}>{tes.judul} ({tes.jenjang || 'Umum'})</option>)}
                </select>
              </div>

              <div style={{ padding: '20px' }}>
                {!selectedTesId ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '1px dashed #ccc', borderRadius: '8px' }}>
                    Silakan pilih tes yang tersedia pada menu dropdown di atas.
                  </div>
                ) : (
                  (() => {
                    const currentTes = listTes.find(t => t.id === selectedTesId);
                    const sudahMengerjakan = riwayatTes.find(r => r.id_tes === selectedTesId);

                    if (!currentTes) return null;

                    // JIKA SUDAH MENGERJAKAN -> TAMPILKAN HASIL CETAK DI WEB
                    if (sudahMengerjakan) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div className="no-print" style={{ backgroundColor: '#e8f5e9', borderLeft: '4px solid #27ae60', padding: '15px', borderRadius: '4px' }}>
                            <h4 style={{ margin: '0 0 5px 0', color: '#27ae60' }}>✅ Anda Sudah Menyelesaikan Tes Ini</h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}>Waktu Submit: {sudahMengerjakan.tanggal}. Silakan cetak/download hasil jawaban Anda untuk diberikan kepada Pendamping.</p>
                            <button onClick={handleDownloadPDF} style={{ marginTop: '10px', backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                              🖨️ Cetak / Download Hasil Tes
                            </button>
                          </div>

                          <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                            <table className="tabel-utama" style={{ minWidth: '700px' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '5%' }}>No</th>
                                  <th style={{ width: '45%', textAlign: 'left' }}>Pertanyaan</th>
                                  <th style={{ width: '50%', textAlign: 'left' }}>Jawaban Kader</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(currentTes.daftar_soal || []).map((soalText: string, i: number) => (
                                  <tr key={i}>
                                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                                    <td style={{ whiteSpace: 'pre-wrap' }}>{soalText}</td>
                                    <td style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', color: '#004a87' }}>{sudahMengerjakan.jawaban[i] || '- Kosong -'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }

                    // JIKA BELUM MENGERJAKAN & STATUS DITUTUP
                    if (currentTes.status === 'Tutup') {
                      return (
                        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', color: '#c62828' }}>
                          <span style={{ fontSize: '2rem' }}>🔒</span>
                          <h4 style={{ margin: '10px 0' }}>Tes Sedang Dikunci</h4>
                          <p style={{ margin: 0, fontSize: '0.9rem' }}>Admin {currentTes.jenjang === 'SKP' ? 'Komisariat' : 'Rayon'} belum membuka akses untuk tes ini. Silakan hubungi pengurus terkait.</p>
                        </div>
                      );
                    }

                    // JIKA BELUM MENGERJAKAN & STATUS DIBUKA (FORM SOAL)
                    return (
                      <form onSubmit={(e) => handleKirimJawabanTes(e, currentTes)} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '100%', overflowX: 'hidden' }}>
                        <div style={{ backgroundColor: '#eef2f3', borderLeft: '4px solid #1e824c', padding: '15px', borderRadius: '4px' }}>
                          <h4 style={{ margin: '0 0 5px 0', color: '#1e824c' }}>{currentTes.judul}</h4>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}>Silakan jawab pertanyaan di bawah ini dengan jelas. Hasil jawaban tidak dapat diubah setelah dikirim.</p>
                        </div>

                        {(currentTes.daftar_soal || []).map((soalText: string, i: number) => (
                          <div key={i} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '15px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', color: '#333', marginBottom: '10px', fontSize: '0.9rem' }}>
                              {i + 1}. {soalText}
                            </label>
                            <textarea 
                              rows={4} 
                              required 
                              value={jawabanTes[i] || ''} 
                              onChange={(e) => setJawabanTes({ ...jawabanTes, [i]: e.target.value })}
                              placeholder="Ketik jawaban Anda di sini..." 
                              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', outline: 'none', fontSize: '0.85rem', backgroundColor: '#fafafa', boxSizing: 'border-box' }} 
                            />
                          </div>
                        ))}

                        <button disabled={isSubmittingTes} type="submit" style={{ backgroundColor: isSubmittingTes ? '#95a5a6' : '#1e824c', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSubmittingTes ? 'not-allowed' : 'pointer', fontSize: '1rem', marginTop: '10px', width: '100%', boxSizing: 'border-box' }}>
                          {isSubmittingTes ? 'Mengirim Jawaban...' : 'Kirim Jawaban Tes'}
                        </button>
                      </form>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* MENU 7: UPLOAD BERKAS & TUGAS */}
          {activeMenu === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem' }}>📤 Tugas & Berkas Kaderisasi</h3>
                <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>Daftar tugas yang diinstruksikan oleh Pengurus. Pastikan file dalam format PDF/Word/Gambar yang jelas.</p>
                
                <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px' }}>
                  <table className="tabel-utama" style={{ minWidth: '800px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', width: '5%' }}>No</th>
                        <th style={{ textAlign: 'left', width: '30%' }}>Jenis Tugas / Berkas</th>
                        <th style={{ textAlign: 'center', width: '20%' }}>Batas Waktu</th>
                        <th style={{ textAlign: 'center', width: '20%' }}>Status</th>
                        <th style={{ textAlign: 'center', width: '25%' }}>Aksi (Upload / Lihat)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tugasRender.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Belum ada instruksi tugas.</td></tr>
                      ) : (
                        tugasRender.map((tugas, index) => (
                          <tr key={tugas.id}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{index + 1}</td>
                            <td style={{ fontWeight: 'bold', color: '#0d1b2a' }}>{tugas.nama_tugas}</td>
                            <td style={{ textAlign: 'center', color: '#e74c3c', fontWeight: 'bold' }}>{tugas.deadline || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: tugas.statusPengerjaan === 'Selesai' ? '#e8f5e9' : tugas.statusPengerjaan === 'Menunggu Verifikasi' ? '#fff3e0' : '#f4f6f9', color: tugas.statusPengerjaan === 'Selesai' ? '#2e7d32' : tugas.statusPengerjaan === 'Menunggu Verifikasi' ? '#e67e22' : '#7f8c8d' }}>
                                {tugas.statusPengerjaan}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {tugas.statusPengerjaan === 'Selesai' ? (
                                <a href={tugas.link_file} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#eaf4fc', color: '#0000af', padding: '6px 15px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.75rem', border: '1px solid #3498db' }}>👁️ Lihat File</a>
                              ) : tugas.statusPengerjaan === 'Menunggu Verifikasi' ? (
                                <span style={{ fontStyle: 'italic', color: '#aaa', fontSize: '0.75rem' }}>Sedang dinilai...</span>
                              ) : (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                  <input type="file" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} style={{ width: '150px', fontSize: '0.75rem', border: '1px dashed #ccc', padding: '4px', borderRadius: '4px' }} />
                                  <button onClick={() => handleUploadTugas(tugas.nama_tugas)} disabled={isUploading} style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: isUploading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>
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

          {/* MENU 9: PERPUSTAKAAN (FOLDER GROUPING) */}
          {activeMenu === 'perpus' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                {Object.keys(groupedPerpus).length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: '#999', border: '1px dashed #ccc', borderRadius: '8px' }}>Belum ada buku atau materi di perpustakaan Rayon.</div>
                ) : (
                  Object.keys(groupedPerpus).map(folderName => (
                    <div key={folderName} style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column' }}>
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
      {/* STRUKTUR HIDDEN HTML KHUSUS UNTUK PRINT PDF DENGAN BACKGROUND GAMBAR A4          */}
      {/* ================================================================================ */}
      <div id="hidden-print-container" className="print-layout-container">
        
        {/* Gambar Background A4 dari Admin Rayon/Komisariat (DIPERBAIKI UNTUK SKP) */}
        {filterRaport === 'SKP' ? (
          pengaturanCetakKomisariat?.kopSuratUrl ? (
            <div className="bg-kertas-a4"><img src={pengaturanCetakKomisariat.kopSuratUrl} alt="Background A4" /></div>
          ) : null
        ) : (
          pengaturanCetak?.kopSuratUrl ? (
            <div className="bg-kertas-a4"><img src={pengaturanCetak.kopSuratUrl} alt="Background A4" /></div>
          ) : null
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
                  
                  {/* CETAK KHS */}
                  {activeMenu === 'raport' && tabRaport === 'raport' && (
                    <div>
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt' }}>RAPORT KADERISASI {filterRaport === 'SKP' ? 'SKP' : ''}</h3>
                      <table className="tabel-biodata">
                        <tbody>
                          <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{profil?.nim || '...........................'}</td></tr>
                          <tr><td>Nomor Induk Anggota</td><td>:</td><td>{profil?.nia || '...........................'}</td></tr>
                          <tr><td>Nama Mahasiswa</td><td>:</td><td>{profil?.nama || '...........................'}</td></tr>
                          <tr><td>Nama Instansi Pelaksana</td><td>:</td><td>{filterRaport === 'SKP' ? 'PK. PMII Sunan Ampel Malang' : getNamaInstansi(profil?.id_rayon)}</td></tr>
                          <tr><td>Angkatan</td><td>:</td><td>{profil?.angkatan || '...........................'}</td></tr>
                          <tr><td>Jenjang Kaderisasi</td><td>:</td><td>{filterRaport}</td></tr>
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
                          ) : barisMateriRender}
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>Jumlah</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalSks}</td>
                            <td></td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{totalBobotNilai}</td>
                          </tr>
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>IPK (Indeks Prestasi Kaderisasi)</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{ipKaderTampilan}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* CETAK HASIL TES */}
                  {activeMenu === 'tes-materi' && selectedTesId && riwayatTes.find(r => r.id_tes === selectedTesId) && listTes.find(t => t.id === selectedTesId) && (
                    <div>
                      <h3 style={{ textAlign: 'center', fontWeight: 'bold', margin: '0 0 15px 0', fontSize: '12pt', textTransform: 'uppercase' }}>LEMBAR JAWABAN {listTes.find(t => t.id === selectedTesId)?.judul}</h3>
                      <table className="tabel-biodata">
                        <tbody>
                          <tr><td style={{width: '200px'}}>Nomor Induk Mahasiswa</td><td style={{width: '15px'}}>:</td><td>{profil?.nim || '...........................'}</td></tr>
                          <tr><td>Nama Mahasiswa</td><td>:</td><td>{profil?.nama || '...........................'}</td></tr>
                          <tr><td>Instansi Pelaksana</td><td>:</td><td>{listTes.find(t => t.id === selectedTesId)?.jenjang === 'SKP' ? 'PK. PMII Sunan Ampel Malang' : getNamaInstansi(profil?.id_rayon)}</td></tr>
                          <tr><td>Waktu Pengerjaan</td><td>:</td><td>{riwayatTes.find(r => r.id_tes === selectedTesId)?.tanggal || '-'}</td></tr>
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
                          {(listTes.find(t => t.id === selectedTesId)?.daftar_soal || []).map((soalText: string, i: number) => (
                            <tr key={i}>
                              <td style={{ textAlign: 'center' }}>{i + 1}</td>
                              <td style={{ whiteSpace: 'pre-wrap' }}>{soalText}</td>
                              <td style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', color: '#000' }}>{riwayatTes.find(r => r.id_tes === selectedTesId)?.jawaban?.[i] || '- Kosong -'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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