'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageTesPemahamanKader() {
  const [profilKader, setProfilKader] = useState({ nama: '', nim: '', id_rayon: '', jenjang: 'MAPABA' });
  
  const [listTesTersedia, setListTesTersedia] = useState<any[]>([]);
  const [jawabanRiwayatKader, setJawabanRiwayatKader] = useState<string[]>([]);
  
  const [selectedTes, setSelectedTes] = useState<any>(null);
  const [formJawaban, setFormJawaban] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            const jenjangAktif = p.jenjang || 'MAPABA';
            setProfilKader({ nama: p.nama, nim: p.nim, id_rayon: p.id_rayon, jenjang: jenjangAktif });

            // Ambil Soal Tes secara Real-time dari Pusat Komisariat atau Rayon Asal
            if (p.id_rayon === 'Komisariat' || p.id_rayon === 'Pusat Komisariat') {
              const unsubTesPusat = onSnapshot(query(collection(db, "master_tes_pusat"), where("jenjang", "==", jenjangAktif), where("status", "==", "Buka")), (snap) => {
                const dataGabungan: any[] = [];
                snap.forEach(doc => dataGabungan.push({ id: doc.id, ...doc.data() }));
                setListTesTersedia(dataGabungan);
              });
              unsubs.push(unsubTesPusat);
            } else {
              const unsubTesRayon = onSnapshot(query(collection(db, "master_tes"), where("id_rayon", "==", p.id_rayon), where("jenjang", "==", jenjangAktif), where("status", "==", "Buka")), (snap) => {
                const dataGabungan: any[] = [];
                snap.forEach(doc => dataGabungan.push({ id: doc.id, ...doc.data() }));
                setListTesTersedia(dataGabungan);
              });
              unsubs.push(unsubTesRayon);
            }

            // Cek tes mana yang sudah pernah dikerjakan oleh kader ini (mencegah double submit)
            const unsubRiwayat = onSnapshot(query(collection(db, "jawaban_tes"), where("nim", "==", p.nim)), (snap) => {
              const idTesSelesai: string[] = [];
              snap.forEach(doc => idTesSelesai.push(doc.data().id_tes));
              setJawabanRiwayatKader(idTesSelesai);
            });
            unsubs.push(unsubRiwayat);
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(u => u());
    };
  }, []);

  const handleMulaiTes = (tes: any) => {
    setSelectedTes(tes);
    setFormJawaban(new Array(tes.daftar_soal.length).fill(''));
  };

  const handleSubmitJawaban = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi apakah ada jawaban yang masih kosong
    const isAdaKosong = formJawaban.some(jawab => jawab.trim() === '');
    if (isAdaKosong) {
      return alert("Harap isi semua jawaban sebelum mengirimkan tes!");
    }

    if (window.confirm("Pastikan jawaban sudah benar. Anda tidak bisa mengulang tes ini jika sudah dikirim. Lanjutkan?")) {
      setIsSubmitting(true);
      try {
        await addDoc(collection(db, "jawaban_tes"), {
          id_tes: selectedTes.id, 
          judul_tes: selectedTes.judul,
          nim: profilKader.nim, 
          nama: profilKader.nama, 
          id_rayon: profilKader.id_rayon,
          jawaban: formJawaban,
          tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
          timestamp: Date.now()
        });
        alert("Jawaban berhasil dikirim! Silakan menunggu evaluasi dari pendamping Anda.");
        setSelectedTes(null);
      } catch (error) { 
        alert("Gagal mengirim jawaban. Periksa koneksi internet Anda."); 
      } finally { 
        setIsSubmitting(false); 
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', minHeight: '80vh' }}>
        
        {selectedTes ? (
          <div>
             <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
               <div>
                 <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>📝 {selectedTes.judul}</h3>
                 <p style={{ fontSize: '0.85rem', color: '#e74c3c', margin: '5px 0 0 0', fontWeight: 'bold' }}>PERHATIAN: Tes hanya dapat dikerjakan satu kali. Jangan merefresh halaman saat mengerjakan!</p>
               </div>
               <button onClick={() => {
                 if (window.confirm("Yakin ingin membatalkan pengerjaan tes ini? Jawaban Anda akan hilang.")) setSelectedTes(null)
               }} style={{ backgroundColor: '#f8f9fa', color: '#333', border: '1px solid #ccc', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                 ❌ Batal Kerjakan
               </button>
             </div>

             <form onSubmit={handleSubmitJawaban} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               {(selectedTes.daftar_soal || []).map((soal: string, idx: number) => (
                 <div key={idx} style={{ backgroundColor: '#fdfdfd', padding: '20px', border: '1px solid #eee', borderRadius: '8px', borderLeft: '4px solid #3498db' }}>
                   <p style={{ margin: '0 0 15px 0', fontWeight: 'bold', color: '#333', fontSize: '0.95rem', lineHeight: '1.5' }}>
                     {idx + 1}. {soal}
                   </p>
                   <textarea rows={5} required placeholder="Ketikkan jawaban Anda secara mendetail di sini..." value={formJawaban[idx]} onChange={(e) => {
                       const newJawaban = [...formJawaban];
                       newJawaban[idx] = e.target.value;
                       setFormJawaban(newJawaban);
                   }} style={{ width: '100%', padding: '15px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.9rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff', fontFamily: 'inherit' }} />
                 </div>
               ))}
               <button disabled={isSubmitting} type="submit" style={{ backgroundColor: '#1e824c', color: 'white', border: 'none', padding: '15px', borderRadius: '6px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '1rem', marginTop: '10px', transition: '0.2s' }}>
                 {isSubmitting ? 'MENGIRIM JAWABAN...' : 'KIRIM JAWABAN PERMANEN 🚀'}
               </button>
             </form>
          </div>
        ) : (
          <>
            <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
              <h3 style={{ color: '#0d1b2a', margin: 0, fontSize: '1.2rem' }}>📝 Ujian & Evaluasi Pemahaman</h3>
              <p style={{ fontSize: '0.85rem', color: '#777', margin: '5px 0 0 0' }}>Daftar Pre-Test atau Post-Test yang sedang dibuka oleh pengurus sesuai dengan jenjang kaderisasi Anda saat ini.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {listTesTersedia.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: '8px', color: '#999' }}>
                  Belum ada ujian / tes yang dibuka untuk Anda saat ini.
                </div>
              ) : (
                listTesTersedia.map(tes => {
                  const sudahDikerjakan = jawabanRiwayatKader.includes(tes.id);
                  return (
                    <div key={tes.id} style={{ backgroundColor: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 5px 0', color: '#0d1b2a', fontSize: '1.1rem' }}>{tes.judul}</h4>
                        <div style={{ fontSize: '0.75rem', color: '#777' }}>Jumlah Soal: <span style={{fontWeight: 'bold', color: '#e67e22'}}>{tes.daftar_soal?.length || 0} Pertanyaan Isian</span></div>
                      </div>
                      
                      {sudahDikerjakan ? (
                        <div style={{ backgroundColor: '#eaf4fc', color: '#27ae60', padding: '10px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #2ecc71', fontSize: '0.85rem' }}>
                          ✅ Anda sudah menyelesaikan tes ini.
                        </div>
                      ) : (
                        <button onClick={() => handleMulaiTes(tes)} style={{ backgroundColor: '#0000af', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', transition: '0.2s' }}>
                          Mulai Kerjakan Tes ✏️
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}