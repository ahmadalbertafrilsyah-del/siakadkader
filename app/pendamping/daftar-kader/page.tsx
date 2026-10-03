'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

export default function PageDaftarKaderPendamping() {
  const router = useRouter();
  const [profilPendamping, setProfilPendamping] = useState({ nama: '', username: '', id_rayon: '', jenjangTugas: 'MAPABA' });
  const [kaderBinaan, setKaderBinaan] = useState<any[]>([]);
  const [semuaRayon, setSemuaRayon] = useState<any[]>([]);
  const [listKurikulum, setListKurikulum] = useState<Record<string, any[]>>({ MAPABA: [], PKD: [], SIG: [], SKP: [], NONFORMAL: [] });
  const [kategoriBobotRayon, setKategoriBobotRayon] = useState<Record<string, any[]>>({});
  const [kategoriBobotKomisariat, setKategoriBobotKomisariat] = useState<Record<string, any[]>>({});
  const [cariKader, setCariKader] = useState('');

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubRayon = onSnapshot(query(collection(db, "users"), where("role", "==", "rayon")), (snap) => {
      setSemuaRayon(snap.docs.map(d => ({ username: d.id, ...d.data() })));
    });
    unsubs.push(unsubRayon);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, async (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            setProfilPendamping({ nama: p.nama, username: p.username, id_rayon: p.id_rayon, jenjangTugas: p.jenjangTugas || 'MAPABA' });
            const isPendampingSKP = p.id_rayon === 'Komisariat';

            if (isPendampingSKP) {
              const unsub1 = onSnapshot(doc(db, "pengaturan_sistem", "komisariat_settings"), (docSnap: any) => {
                if (docSnap.exists() && docSnap.data().bobot_penilaian) setKategoriBobotKomisariat(docSnap.data().bobot_penilaian);
              });
              unsubs.push(unsub1);

              const unsub2 = onSnapshot(query(collection(db, "master_kurikulum_pusat"), where("jenjang", "==", "SKP")), (snap: any) => {
                const listMateri: any[] = []; snap.docs.forEach((doc: any) => listMateri.push({ id: doc.id, ...doc.data() }));
                setListKurikulum(prev => ({ ...prev, SKP: listMateri }));
              });
              unsubs.push(unsub2);
            } else {
              const unsub3 = onSnapshot(doc(db, "pengaturan_rayon", p.id_rayon), (docSnap: any) => {
                if (docSnap.exists() && docSnap.data().bobot_penilaian) setKategoriBobotRayon(docSnap.data().bobot_penilaian);
              });
              unsubs.push(unsub3);

              const unsub4 = onSnapshot(doc(db, "kurikulum_rayon", p.id_rayon), (docSnap: any) => {
                if (docSnap.exists()) setListKurikulum(docSnap.data() as Record<string, any[]>);
              });
              unsubs.push(unsub4);
            }

            const qKader = query(collection(db, "users"), where("role", "==", "kader"));
            const snapKader = await getDocs(qKader);
            const listKader: any[] = [];

            for (const d of snapKader.docs) {
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

              if (isBinaan) {
                  const evaluasiSnap = await getDocs(query(collection(db, "evaluasi_kader"), where("__name__", "==", data.nim)));
                  const evaluasiData = evaluasiSnap.empty ? {} : evaluasiSnap.docs[0].data();
                  listKader.push({ id: d.id, evaluasiMaster: evaluasiData, ...data });
              }
            }
            setKaderBinaan(listKader);
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

  const getNamaInstansi = (idData: string) => {
    if (!idData) return "-";
    if (idData === 'Komisariat' || idData === 'Pusat Komisariat') return 'Pusat Komisariat';
    const r = semuaRayon.find((x: any) => x.username === idData || x.id_rayon === idData || x.id === idData);
    return r ? r.nama : idData;
  };

  const getNilaiHuruf = (angka: number) => {
    if (angka >= 76) return "A"; if (angka >= 51) return "B"; if (angka >= 26) return "C"; if (angka >= 10) return "D"; if (angka > 0) return "E"; return "-";
  };
  const konversiHurufKeAngka = (huruf: string) => {
    if(huruf === 'A') return 4; if(huruf === 'B') return 3; if(huruf === 'C') return 2; if(huruf === 'D') return 1; return 0;
  };

  const hitungIpkDinamicTabel = (kaderTarget: any, jenjangTarget: string) => {
    const kurikulumTarget = listKurikulum[jenjangTarget] || [];
    if (kurikulumTarget.length === 0) return "-";

    let tempT_sks = 0; let tempT_bobot = 0; let adaYangDiisi = false;
    const evaluasiMaster = kaderTarget.evaluasiMaster || {};
    const evaluasiDiJenjang = evaluasiMaster[jenjangTarget] || { nilai_mentah: {} };

    const bobotJenjang = jenjangTarget === 'SKP'
      ? (kategoriBobotKomisariat['SKP'] || [])
      : (kategoriBobotRayon[jenjangTarget] || (kategoriBobotRayon['MAPABA'] || []));

    kurikulumTarget.forEach(m => {
        const mentah = evaluasiDiJenjang.nilai_mentah?.[m.kode];
        let huruf = "-";

        if (mentah && Object.keys(mentah).length > 0 && bobotJenjang.length > 0) {
            let num = 0;
            bobotJenjang.forEach((k: any) => { num += (mentah[k.nama] || 0) * (k.persen / 100); });
            huruf = getNilaiHuruf(num);
        }

        tempT_sks += (m.bobot || 0);
        if (huruf !== "-") { adaYangDiisi = true; tempT_bobot += (m.bobot || 0) * konversiHurufKeAngka(huruf); }
    });

    if (!adaYangDiisi) return "-";
    return tempT_sks > 0 ? (tempT_bobot / tempT_sks).toFixed(2) : "0.00";
  };

  const handleExportKaderBinaan = () => {
    if (kaderBinaan.length === 0) return alert("Belum ada data kader binaan!");
    const dataToExport = kaderBinaan.map((k, i) => ({
      "No": i + 1, "NIM": k.nim || '-', "Nama Lengkap": k.nama || '-', "NIA": k.nia || '-', "Asal Rayon": getNamaInstansi(k.id_rayon), "Jenjang Terakhir": k.jenjang || 'MAPABA', "Status": k.status || 'Aktif'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Kader Binaan"); XLSX.writeFile(workbook, `Data_Binaan_${profilPendamping.nama}_${Date.now()}.xlsx`);
  };

  const kaderTampil = kaderBinaan.filter((k: any) => {
    const kunci = cariKader.trim().toLowerCase();
    if (!kunci) return true;
    return String(k.nama || '').toLowerCase().includes(kunci) || String(k.nim || '').toLowerCase().includes(kunci);
  });

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
        .btn-main {
          background-color: #0b5e4a; color: #ffffff; border: none; padding: 11px 18px;
          border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.82rem;
          transition: background-color 0.2s; display: inline-flex; align-items: center;
          justify-content: center; gap: 6px; font-family: inherit;
        }
        .btn-main:hover { background-color: #139070; }
        .pdg-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .pdg-table th { background-color: #f1f8f5; color: #0b5e4a; padding: 13px 16px; font-weight: 700; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
        .pdg-table td { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .pdg-table tbody tr:hover td { background-color: #fafdfb; }
        .pdg-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.68rem; font-weight: 700; }

        .pdg-m-card { background: #ffffff; border: 1px solid #eaeaea; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); padding: 14px; }
        .pdg-m-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 0.78rem; }
        .pdg-m-label { color: #6b7280; }
        .pdg-m-value { color: #111827; font-weight: 600; text-align: right; }

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
            <h3 className="pdg-title">Daftar Kader Binaan</h3>
            <p className="pdg-desc">Daftar kader yang diplotkan langsung kepada Anda sebagai pendamping {profilPendamping.jenjangTugas}.</p>
          </div>
          <button onClick={handleExportKaderBinaan} className="btn-main">📥 Export Excel Binaan</button>
        </div>

        <div className="pdg-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="🔍 Cari nama atau NIM kader..." value={cariKader} onChange={(e) => setCariKader(e.target.value)} className="form-control-custom" style={{ flex: '1 1 280px' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0b5e4a', backgroundColor: '#e8f7f0', border: '1px solid #bfe9d7', padding: '8px 14px', borderRadius: '999px' }}>
            Total: {kaderTampil.length} Kader
          </span>
        </div>

        <div className="pdg-card hide-scroll" style={{ width: '100%', overflowX: 'auto' }}>
          <table className="pdg-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>NIM &amp; Angkatan</th>
                <th>Nama Kader</th>
                <th style={{ textAlign: 'center' }}>Asal Instansi</th>
                <th style={{ textAlign: 'center' }}>IPK Sementara</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {kaderTampil.map((k: any) => {
                const thnMasuk = k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear() : '-');
                const ipkDinamis = hitungIpkDinamicTabel(k, profilPendamping.jenjangTugas);
                return (
                  <tr key={k.nim}>
                    <td style={{ textAlign: 'center' }}>
                      <b style={{ color: '#111827' }}>{k.nim}</b>
                      <div style={{ fontSize: '0.7rem', color: '#139070', marginTop: '2px' }}>Angkatan: {thnMasuk}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0d1b2a' }}>{k.nama}</td>
                    <td style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.75rem' }}>{getNamaInstansi(k.id_rayon)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="pdg-badge" style={{ backgroundColor: '#fff8db', color: '#8a6d00', border: '1px solid #f5c518', fontSize: '0.8rem' }}>{ipkDinamis}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => router.push('/pendamping/input-nilai')} className="btn-main" style={{ padding: '8px 14px', fontSize: '0.75rem' }}>Buka Raport 📝</button>
                    </td>
                  </tr>
                )
              })}
              {kaderTampil.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#9ca3af' }}>Belum ada kader binaan yang diplotkan ke Anda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================ TAMPILAN MOBILE ============================ */}
      <div className="mobile-view">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="pdg-card" style={{ padding: '16px' }}>
            <h3 className="pdg-title" style={{ fontSize: '1rem' }}>Daftar Kader Binaan</h3>
            <p className="pdg-desc" style={{ fontSize: '0.78rem' }}>Kader yang diplotkan kepada Anda sebagai pendamping {profilPendamping.jenjangTugas}.</p>
            <button onClick={handleExportKaderBinaan} className="btn-main" style={{ width: '100%', marginTop: '12px', padding: '12px' }}>📥 Export Excel Binaan</button>
          </div>

          <div className="pdg-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="🔍 Cari nama atau NIM..." value={cariKader} onChange={(e) => setCariKader(e.target.value)} className="form-control-custom" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0b5e4a', backgroundColor: '#e8f7f0', border: '1px solid #bfe9d7', padding: '7px 12px', borderRadius: '999px', alignSelf: 'flex-start' }}>
              Total: {kaderTampil.length} Kader
            </span>
          </div>

          {kaderTampil.length === 0 && (
            <div className="pdg-card" style={{ padding: '28px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>
              Belum ada kader binaan yang diplotkan ke Anda.
            </div>
          )}

          {kaderTampil.map((k: any) => {
            const thnMasuk = k.angkatan || (k.createdAt ? new Date(k.createdAt).getFullYear() : '-');
            const ipkDinamis = hitungIpkDinamicTabel(k, profilPendamping.jenjangTugas);
            return (
              <div key={k.nim} className="pdg-m-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px', marginBottom: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#0d1b2a', fontSize: '0.9rem', lineHeight: 1.3 }}>{k.nama}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '3px' }}>NIM: {k.nim}</div>
                  </div>
                  <span className="pdg-badge" style={{ backgroundColor: '#fff8db', color: '#8a6d00', border: '1px solid #f5c518', whiteSpace: 'nowrap' }}>IPK {ipkDinamis}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <div className="pdg-m-row"><span className="pdg-m-label">Angkatan</span><span className="pdg-m-value">{thnMasuk}</span></div>
                  <div className="pdg-m-row"><span className="pdg-m-label">Asal Instansi</span><span className="pdg-m-value">{getNamaInstansi(k.id_rayon)}</span></div>
                </div>

                <button onClick={() => router.push('/pendamping/input-nilai')} className="btn-main" style={{ width: '100%', marginTop: '12px', padding: '12px' }}>Buka Raport 📝</button>
              </div>
            )
          })}

          <div style={{ height: '80px' }} />
        </div>
      </div>
    </>
  );
}
