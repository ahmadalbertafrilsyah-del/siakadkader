'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageBerkasTugasPendamping() {
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '' });
  const [berkasTugas, setBerkasTugas] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<'semua' | 'menunggu' | 'selesai'>('semua');
  const [cariBerkas, setCariBerkas] = useState('');

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon });

            const isPendampingSKP = p.id_rayon === 'Komisariat';
            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const emailKaderBinaan: string[] = [];

            snapKader.forEach(d => {
              const data = d.data();
              let isBinaan = false;
              if (isPendampingSKP) {
                  if (Array.isArray(data.pendamping_skp_id)) { if (data.pendamping_skp_id.includes(p.username)) isBinaan = true; }
                  else if (data.pendamping_skp_id === p.username) isBinaan = true;
              } else {
                  const pMapaba = Array.isArray(data.pendamping_mapaba_id) ? data.pendamping_mapaba_id : (data.pendamping_mapaba_id ? [data.pendamping_mapaba_id] : []);
                  const pPkd = Array.isArray(data.pendamping_pkd_id) ? data.pendamping_pkd_id : (data.pendamping_pkd_id ? [data.pendamping_pkd_id] : []);
                  const pSig = Array.isArray(data.pendamping_sig_id) ? data.pendamping_sig_id : (data.pendamping_sig_id ? [data.pendamping_sig_id] : []);
                  if (pMapaba.includes(p.username) || pPkd.includes(p.username) || pSig.includes(p.username) || data.pendampingId === p.username) isBinaan = true;
              }
              if (isBinaan) emailKaderBinaan.push(data.email);
            });

            if (emailKaderBinaan.length > 0) {
              const unsubBerkas = onSnapshot(collection(db, "berkas_kader"), (snap) => {
                 const dataBerkas: any[] = [];
                 snap.forEach(doc => { const d = doc.data(); if (emailKaderBinaan.includes(d.email_kader)) dataBerkas.push({ id: doc.id, ...d }); });
                 dataBerkas.sort((a, b) => b.timestamp - a.timestamp);
                 setBerkasTugas(dataBerkas);
              });
              unsubs.push(unsubBerkas);
            }
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

  const catatLogAktivitas = async (aksi: string) => {
    try { await addDoc(collection(db, "log_aktivitas"), { id_rayon: profilPendamping.id_rayon, aktor: `Pendamping (${profilPendamping.nama})`, username: profilPendamping.username, role: "pendamping", aksi: aksi, timestamp: Date.now(), waktu_format: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }); } catch (e) {}
  };

  const handleVerifikasiTugas = async (idBerkas: string) => {
    try {
      await updateDoc(doc(db, "berkas_kader", idBerkas), { status: 'Selesai' });
      catatLogAktivitas(`Memverifikasi (ACC) tugas kader.`);
    } catch (error) { alert("Error verifikasi tugas."); }
  };

  // ====== Pembantu tampilan (tidak mengubah data) ======
  const infoStatus = (status: string) => {
    if (status === 'Selesai') return { label: '✅ Disetujui', bg: '#e8f7f0', color: '#0b5e4a', border: '#bfe9d7' };
    if (status === 'Ditolak') return { label: '✖ Ditolak', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
    return { label: '⏳ Menunggu Verifikasi', bg: '#fff8db', color: '#8a6d00', border: '#f5c518' };
  };

  const berkasTampil = berkasTugas.filter((b: any) => {
    const cocokStatus =
      filterStatus === 'semua' ? true :
      filterStatus === 'selesai' ? b.status === 'Selesai' : b.status !== 'Selesai';
    const kunci = cariBerkas.trim().toLowerCase();
    const cocokCari = !kunci
      || String(b.email_kader || '').toLowerCase().includes(kunci)
      || String(b.jenis_berkas || '').toLowerCase().includes(kunci)
      || String(b.nama_file_asli || '').toLowerCase().includes(kunci);
    return cocokStatus && cocokCari;
  });

  const jmlMenunggu = berkasTugas.filter((b: any) => b.status !== 'Selesai').length;
  const jmlSelesai = berkasTugas.filter((b: any) => b.status === 'Selesai').length;

  return (
    <>
      <style>{`
        .pdg-page { display: flex; flex-direction: column; gap: 20px; box-sizing: border-box; width: 100%; }
        .pdg-card {
          background: #ffffff; border-radius: 12px; border: 1px solid #eaeaea;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02); box-sizing: border-box;
        }
        .pdg-title { margin: 0 0 6px 0; color: #0b5e4a; font-size: 1.15rem; font-weight: 700; }
        .pdg-desc { margin: 0; font-size: 0.85rem; color: #6b7280; line-height: 1.5; }
        .form-control-custom {
          width: 100%; padding: 11px 14px; border: 1px solid #e5e7eb; background-color: #ffffff;
          border-radius: 8px; font-size: 0.9rem; outline: none; color: #111827;
          transition: border-color 0.2s; box-sizing: border-box; font-family: inherit;
        }
        .form-control-custom:focus { border-color: #139070; box-shadow: 0 0 0 3px rgba(19, 144, 112, 0.12); }

        .modern-tab-container { display: flex; gap: 8px; background: #f1f8f5; padding: 6px; border-radius: 999px; flex-wrap: wrap; }
        .modern-tab {
          padding: 8px 16px; border-radius: 999px; border: none; background: transparent;
          color: #0b5e4a; font-weight: 700; font-size: 0.78rem; cursor: pointer;
          transition: all 0.2s; font-family: inherit; white-space: nowrap;
        }
        .modern-tab.active { background: #0b5e4a; color: #ffffff; box-shadow: 0 2px 6px rgba(11,94,74,0.2); }

        .btn-main {
          background-color: #0b5e4a; color: #ffffff; border: none; padding: 11px 18px;
          border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.82rem;
          transition: background-color 0.2s; display: inline-flex; align-items: center;
          justify-content: center; gap: 6px; font-family: inherit;
        }
        .btn-main:hover { background-color: #139070; }
        .btn-gold {
          background-color: #fff8db; color: #8a6d00; border: 1px solid #f5c518; padding: 9px 14px;
          border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.75rem; text-decoration: none;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit;
        }

        .pdg-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .pdg-table th { background-color: #f1f8f5; color: #0b5e4a; padding: 13px 16px; font-weight: 700; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
        .pdg-table td { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .pdg-table tbody tr:hover td { background-color: #fafdfb; }

        .pdg-badge { display: inline-block; padding: 4px 11px; border-radius: 999px; font-size: 0.68rem; font-weight: 700; white-space: nowrap; }
        .pdg-m-card { background: #ffffff; border: 1px solid #eaeaea; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); padding: 14px; }

        .desktop-view { display: block; }
        .mobile-view { display: none; }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
          .desktop-view { display: none !important; }
          .mobile-view { display: block !important; }
        }
      `}</style>

      {/* ============================ TAMPILAN DESKTOP ============================ */}
      <div className="desktop-view pdg-page">
        <div className="pdg-card" style={{ padding: '22px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '18px' }}>
          <div>
            <h3 className="pdg-title">Verifikasi Tugas Kader Binaan</h3>
            <p className="pdg-desc">Daftar tugas yang telah dikerjakan dan diunggah oleh kader binaan Anda.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span className="pdg-badge" style={{ backgroundColor: '#fff8db', color: '#8a6d00', border: '1px solid #f5c518', fontSize: '0.75rem', padding: '8px 14px' }}>⏳ Menunggu: {jmlMenunggu}</span>
            <span className="pdg-badge" style={{ backgroundColor: '#e8f7f0', color: '#0b5e4a', border: '1px solid #bfe9d7', fontSize: '0.75rem', padding: '8px 14px' }}>✅ Disetujui: {jmlSelesai}</span>
          </div>
        </div>

        <div className="pdg-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="🔍 Cari kader, jenis tugas, atau nama file..." value={cariBerkas} onChange={(e) => setCariBerkas(e.target.value)} className="form-control-custom" style={{ flex: '1 1 280px' }} />
          <div className="modern-tab-container">
            <button className={`modern-tab ${filterStatus === 'semua' ? 'active' : ''}`} onClick={() => setFilterStatus('semua')}>Semua</button>
            <button className={`modern-tab ${filterStatus === 'menunggu' ? 'active' : ''}`} onClick={() => setFilterStatus('menunggu')}>Menunggu Verifikasi</button>
            <button className={`modern-tab ${filterStatus === 'selesai' ? 'active' : ''}`} onClick={() => setFilterStatus('selesai')}>Disetujui</button>
          </div>
        </div>

        <div className="pdg-card hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
          <table className="pdg-table" style={{ minWidth: '750px' }}>
            <thead>
              <tr>
                <th>Kader / Tanggal</th>
                <th>Nama Tugas Berkas</th>
                <th style={{ textAlign: 'center' }}>Dokumen</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {berkasTampil.map(b => {
                const st = infoStatus(b.status);
                return (
                  <tr key={b.id}>
                    <td>
                      <b style={{ color: '#0b5e4a' }}>{String(b.email_kader || '').split('@')[0]}</b>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>{b.tanggal}</div>
                    </td>
                    <td>
                      <b style={{ color: '#111827' }}>{b.jenis_berkas}</b>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontStyle: 'italic', marginTop: '2px' }}>{b.nama_file_asli}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <a href={b.file_link_or_id} target="_blank" rel="noopener noreferrer" className="btn-gold">👁️ Lihat</a>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="pdg-badge" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {b.status === 'Selesai'
                        ? <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Sudah diverifikasi</span>
                        : <button onClick={() => handleVerifikasiTugas(b.id)} className="btn-main" style={{ padding: '8px 14px', fontSize: '0.75rem' }}>Verifikasi Selesai</button>}
                    </td>
                  </tr>
                );
              })}
              {berkasTampil.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#9ca3af' }}>Belum ada berkas tugas yang diunggah oleh kader binaan Anda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================ TAMPILAN MOBILE ============================ */}
      <div className="mobile-view">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="pdg-card" style={{ padding: '16px' }}>
            <h3 className="pdg-title" style={{ fontSize: '1rem' }}>Verifikasi Tugas Kader</h3>
            <p className="pdg-desc" style={{ fontSize: '0.78rem' }}>Tugas yang diunggah oleh kader binaan Anda.</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <span className="pdg-badge" style={{ backgroundColor: '#fff8db', color: '#8a6d00', border: '1px solid #f5c518', padding: '6px 12px' }}>⏳ Menunggu: {jmlMenunggu}</span>
              <span className="pdg-badge" style={{ backgroundColor: '#e8f7f0', color: '#0b5e4a', border: '1px solid #bfe9d7', padding: '6px 12px' }}>✅ Disetujui: {jmlSelesai}</span>
            </div>
          </div>

          <div className="pdg-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="🔍 Cari kader atau tugas..." value={cariBerkas} onChange={(e) => setCariBerkas(e.target.value)} className="form-control-custom" />
            <div className="modern-tab-container">
              <button className={`modern-tab ${filterStatus === 'semua' ? 'active' : ''}`} onClick={() => setFilterStatus('semua')}>Semua</button>
              <button className={`modern-tab ${filterStatus === 'menunggu' ? 'active' : ''}`} onClick={() => setFilterStatus('menunggu')}>Menunggu</button>
              <button className={`modern-tab ${filterStatus === 'selesai' ? 'active' : ''}`} onClick={() => setFilterStatus('selesai')}>Disetujui</button>
            </div>
          </div>

          {berkasTampil.length === 0 && (
            <div className="pdg-card" style={{ padding: '28px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>
              Belum ada berkas tugas yang diunggah oleh kader binaan Anda.
            </div>
          )}

          {berkasTampil.map(b => {
            const st = infoStatus(b.status);
            return (
              <div key={b.id} className="pdg-m-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem', lineHeight: 1.3 }}>{b.jenis_berkas}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontStyle: 'italic', marginTop: '3px', wordBreak: 'break-word' }}>{b.nama_file_asli}</div>
                  </div>
                  <span className="pdg-badge" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                </div>

                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ color: '#6b7280' }}>Kader</span>
                    <span style={{ color: '#0b5e4a', fontWeight: 700, textAlign: 'right' }}>{String(b.email_kader || '').split('@')[0]}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ color: '#6b7280' }}>Tanggal</span>
                    <span style={{ color: '#111827', fontWeight: 600, textAlign: 'right' }}>{b.tanggal}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <a href={b.file_link_or_id} target="_blank" rel="noopener noreferrer" className="btn-gold" style={{ flex: 1, padding: '12px' }}>👁️ Lihat Dokumen</a>
                  {b.status !== 'Selesai' && (
                    <button onClick={() => handleVerifikasiTugas(b.id)} className="btn-main" style={{ flex: 1, padding: '12px' }}>✔ Verifikasi</button>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ height: '80px' }} />
        </div>
      </div>
    </>
  );
}
