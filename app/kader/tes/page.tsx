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

            if (p.id_rayon === 'Komisariat' || p.id_rayon === 'Pusat Komisariat') {
              const unsubTesPusat = onSnapshot(query(collection(db, "master_tes_pusat"), where("jenjang", "==", jenjangAktif), where("status", "==", "Buka")), (snap) => {
                const dataGabungan: any[] = []; snap.forEach(doc => dataGabungan.push({ id: doc.id, ...doc.data() })); setListTesTersedia(dataGabungan);
              });
              unsubs.push(unsubTesPusat);
            } else {
              const unsubTesRayon = onSnapshot(query(collection(db, "master_tes"), where("id_rayon", "==", p.id_rayon), where("jenjang", "==", jenjangAktif), where("status", "==", "Buka")), (snap) => {
                const dataGabungan: any[] = []; snap.forEach(doc => dataGabungan.push({ id: doc.id, ...doc.data() })); setListTesTersedia(dataGabungan);
              });
              unsubs.push(unsubTesRayon);
            }

            const unsubRiwayat = onSnapshot(query(collection(db, "jawaban_tes"), where("nim", "==", p.nim)), (snap) => {
              const idTesSelesai: string[] = []; snap.forEach(doc => idTesSelesai.push(doc.data().id_tes)); setJawabanRiwayatKader(idTesSelesai);
            });
            unsubs.push(unsubRiwayat);
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => { unsubscribeAuth(); unsubs.forEach(u => u()); };
  }, []);

  const handleMulaiTes = (tes: any) => { setSelectedTes(tes); setFormJawaban(new Array(tes.daftar_soal.length).fill('')); };

  const handleSubmitJawaban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formJawaban.some(jawab => jawab.trim() === '')) return alert("Harap isi semua jawaban sebelum mengirimkan tes!");

    if (window.confirm("Pastikan semua jawaban sudah benar. Anda tidak bisa mengulang tes ini. Lanjutkan kirim?")) {
      setIsSubmitting(true);
      try {
        await addDoc(collection(db, "jawaban_tes"), {
          id_tes: selectedTes.id, judul_tes: selectedTes.judul, nim: profilKader.nim, nama: profilKader.nama, id_rayon: profilKader.id_rayon,
          jawaban: formJawaban, tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), timestamp: Date.now()
        });
        alert("Jawaban berhasil dikirim! Silakan menunggu evaluasi dari pendamping Anda.");
        setSelectedTes(null);
      } catch (error) { alert("Gagal mengirim jawaban. Periksa koneksi internet Anda."); } finally { setIsSubmitting(false); }
    }
  };

  return (
    <>
      <style>{`
        /* RESPONSIVE LAYOUT & HIDE SCROLLBAR */
        .page-wrapper { display: flex; flex-direction: column; gap: 20px; }
        
        .header-card { background: white; padding: 20px 25px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .table-container { width: 100%; overflow-x: auto; border: 1px solid #eaeaea; border-radius: 12px; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.01); padding: 15px; min-height: 50vh; }
        
        /* STYLE TABEL */
        .tabel-tes { width: 100%; border-collapse: collapse; min-width: 750px; text-align: left; }
        .tabel-tes th { background-color: #f0f4f8; color: #555; padding: 12px 15px; font-size: 0.85rem; white-space: nowrap; }
        .tabel-tes td { padding: 15px; border-bottom: 1px solid #eee; color: #333; font-size: 0.9rem; vertical-align: middle; }
        .tabel-tes tr:last-child td { border-bottom: none; }
        .tabel-tes tr:hover { background-color: #fdfdfd; }

        /* STYLE FORM PENGERJAAN TES (ISIAN) */
        .form-container { background: transparent; }
        .question-card { 
          background: #fff; border: 1px solid #e0e4e8; border-radius: 10px; padding: 25px; margin-bottom: 20px; 
          box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: border-color 0.3s;
        }
        .question-card:focus-within { border-color: #3498db; }
        
        .question-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 15px; }
        .question-badge { background: #f0f4f8; color: #0000af; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; white-space: nowrap; }
        .question-text { font-size: 0.95rem; font-weight: bold; color: #1a252f; line-height: 1.5; margin: 0; padding-top: 2px; }
        
        .answer-input { 
          width: 100%; padding: 15px; border: 1px solid #ced4da; border-radius: 8px; font-size: 0.9rem; 
          resize: vertical; outline: none; background-color: #fdfdfd; transition: all 0.3s; 
          font-family: inherit; line-height: 1.6; color: #333; box-sizing: border-box;
        }
        .answer-input:focus { border-color: #3498db; background-color: #fff; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1); }
        .answer-input::placeholder { color: #aab7b8; }

        /* TOMBOL */
        .btn-mulai { background-color: #0000af; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem; transition: 0.2s; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,175,0.15); }
        .btn-mulai:hover { background-color: #00008a; }
        
        .btn-batal { background-color: #fff; color: #555; border: 1px solid #ccc; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.85rem; transition: 0.2s; }
        .btn-batal:hover { background-color: #f8f9fa; color: #e74c3c; border-color: #e74c3c; }
        
        .btn-submit { background-color: #27ae60; color: white; border: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 0.95rem; transition: 0.3s; box-shadow: 0 4px 10px rgba(39, 174, 96, 0.2); }
        .btn-submit:hover:not(:disabled) { background-color: #219653; transform: translateY(-2px); }
        .btn-submit:disabled { background-color: #95a5a6; cursor: not-allowed; box-shadow: none; }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .page-wrapper { padding: 15px; }
           .question-card { padding: 15px; }
        }
      `}</style>

      <div className="page-wrapper">
        
        {/* HEADER */}
        {!selectedTes && (
          <div className="header-card">
            <h3 style={{ color: '#0d1b2a', margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>Ujian & Evaluasi Pemahaman</h3>
            <p style={{ fontSize: '0.85rem', color: '#777', margin: 0 }}>Daftar Pre-Test atau Post-Test yang sedang dibuka sesuai dengan jenjang kaderisasi Anda.</p>
          </div>
        )}

        {selectedTes ? (
          /* ================== MODE PENGERJAAN TES (FORM ISIAN) ================== */
          <div className="form-container">
            <div style={{ background: 'white', padding: '20px 25px', borderRadius: '12px', border: '1px solid #eaeaea', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div>
                <h3 style={{ color: '#0d1b2a', margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>{selectedTes.judul}</h3>
                <div style={{ backgroundColor: '#fff9e6', borderLeft: '3px solid #f39c12', padding: '8px 12px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                  <span style={{ fontSize: '0.8rem', color: '#b9770e', fontWeight: '500' }}>Pastikan koneksi stabil. Jangan memuat ulang (refresh) halaman saat mengerjakan.</span>
                </div>
              </div>
              <button className="btn-batal" onClick={() => { if (window.confirm("Batal mengerjakan? Semua isian Anda yang belum terkirim akan hilang.")) setSelectedTes(null) }}>
                Batal Kerjakan
              </button>
            </div>

            <form onSubmit={handleSubmitJawaban}>
              {(selectedTes.daftar_soal || []).map((soal: string, idx: number) => (
                <div className="question-card" key={idx}>
                  <div className="question-header">
                    <span className="question-badge">Soal {idx + 1}</span>
                    <p className="question-text">{soal}</p>
                  </div>
                  <textarea 
                    rows={4} 
                    required 
                    placeholder="Tuliskan jawaban Anda secara mendetail..." 
                    className="answer-input"
                    value={formJawaban[idx]} 
                    onChange={(e) => {
                      const newJawaban = [...formJawaban]; 
                      newJawaban[idx] = e.target.value; 
                      setFormJawaban(newJawaban);
                    }} 
                  />
                </div>
              ))}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button disabled={isSubmitting} type="submit" className="btn-submit">
                  {isSubmitting ? 'Mengirim Jawaban...' : 'Kirim Jawaban Sekarang 📤'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ================== MODE DAFTAR TES TERSEDIA (TABEL) ================== */
          <div className="table-container">
            <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
              <table className="tabel-tes">
                <thead>
                  <tr>
                    <th style={{ borderRadius: '8px 0 0 8px', textAlign: 'center', width: '5%' }}>No</th>
                    <th style={{ width: '40%' }}>Judul Tes Evaluasi</th>
                    <th style={{ textAlign: 'center', width: '15%' }}>Jumlah Soal</th>
                    <th style={{ textAlign: 'center', width: '20%' }}>Status Anda</th>
                    <th style={{ borderRadius: '0 8px 8px 0', textAlign: 'center', width: '20%' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {listTesTersedia.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                        Belum ada ujian atau tes yang sedang dibuka saat ini.
                      </td>
                    </tr>
                  ) : (
                    listTesTersedia.map((tes, index) => {
                      const sudahDikerjakan = jawabanRiwayatKader.includes(tes.id);
                      return (
                        <tr key={tes.id}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#777' }}>{index + 1}</td>
                          <td>
                            <div style={{ fontWeight: 'bold', color: '#0d1b2a', fontSize: '0.95rem' }}>
                              {tes.judul}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: '#e67e22', fontWeight: 'bold', fontSize: '0.85rem' }}>
                              {tes.daftar_soal?.length || 0} Isian
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {sudahDikerjakan ? (
                              <span style={{ backgroundColor: '#eaf4fc', color: '#27ae60', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #2ecc71', whiteSpace: 'nowrap' }}>✅ Tes Selesai</span>
                            ) : (
                              <span style={{ backgroundColor: '#f4f6f9', color: '#7f8c8d', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #bdc3c7', whiteSpace: 'nowrap' }}>Belum Dikerjakan</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {sudahDikerjakan ? (
                              <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '0.8rem' }}>Tuntas 🎉</span>
                            ) : (
                              <button onClick={() => handleMulaiTes(tes)} className="btn-mulai">
                                Mulai Kerjakan ✏️
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
        )}

        <div style={{ height: '50px' }} className="mobile-only"></div>
      </div>
    </>
  );
}