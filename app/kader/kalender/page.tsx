'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function PageKalenderKader() {
  const [jadwalKegiatan, setJadwalKegiatan] = useState<any[]>([]);

  // State untuk kalender interaktif
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDateStr, setSelectedDateStr] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  );

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const qRole = query(collection(db, "users"), where("email", "==", user.email));
        const unsubRole = onSnapshot(qRole, (snapRole: any) => {
          if (!snapRole.empty) {
            const p = snapRole.docs[0].data();
            
            let currentPendampingId = '';
            if (p.jenjang === 'MAPABA') currentPendampingId = Array.isArray(p.pendamping_mapaba_id) ? p.pendamping_mapaba_id[0] : p.pendamping_mapaba_id;
            if (p.jenjang === 'PKD') currentPendampingId = Array.isArray(p.pendamping_pkd_id) ? p.pendamping_pkd_id[0] : p.pendamping_pkd_id;
            if (p.jenjang === 'SIG') currentPendampingId = Array.isArray(p.pendamping_sig_id) ? p.pendamping_sig_id[0] : p.pendamping_sig_id;
            if (p.jenjang === 'SKP') currentPendampingId = Array.isArray(p.pendamping_skp_id) ? p.pendamping_skp_id[0] : p.pendamping_skp_id;

            const unsubJadwal = onSnapshot(collection(db, "jadwal_kegiatan"), (snap) => {
              const listJadwal: any[] = [];
              snap.forEach(doc => {
                const d = doc.data();
                if (d.pembuat === "Komisariat" || d.id_rayon === p.id_rayon) {
                  if (d.target === "Rayon" || d.target === "Pendamping") return;
                  if (d.target === "Binaan" && d.pendamping_id !== currentPendampingId) return; 
                  listJadwal.push({ id: doc.id, ...d });
                }
              });
              // Urutkan jadwal berdasarkan jam agar rapi
              listJadwal.sort((a, b) => {
                 const timeA = a.tanggal.split('T')[1] || '';
                 const timeB = b.tanggal.split('T')[1] || '';
                 return timeA.localeCompare(timeB);
              });
              setJadwalKegiatan(listJadwal);
            });
            unsubs.push(unsubJadwal);
          }
        });
        unsubs.push(unsubRole);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  // FUNGSI NAVIGASI KALENDER
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  // VARIABEL PEMBUATAN GRID KALENDER
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0: Min, 1: Sen, ...
  
  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const namaHari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Filter jadwal berdasarkan tanggal yang diklik
  const jadwalTerpilih = jadwalKegiatan.filter(j => j.tanggal.split('T')[0] === selectedDateStr);

  return (
    <>
      <style>{`
        /* RESPONSIVE LAYOUT & HIDE SCROLLBAR */
        .page-wrapper { display: flex; flex-direction: column; gap: 20px; }
        .header-card { background: white; padding: 20px 25px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        
        /* TWO COLUMN LAYOUT (DESKTOP) */
        .calendar-layout { display: flex; gap: 25px; align-items: flex-start; }
        .calendar-section { flex: 0 0 350px; background: #fff; padding: 25px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .events-section { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 15px; }
        
        /* CALENDAR STYLES */
        .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .cal-nav-btn { background: #f0f4f8; border: none; color: #0d1b2a; width: 32px; height: 32px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .cal-nav-btn:hover { background: #0000af; color: white; }
        .cal-title { font-size: 1.1rem; font-weight: bold; color: #0d1b2a; }
        
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
        .cal-day-name { font-size: 0.75rem; font-weight: bold; color: #888; padding-bottom: 10px; }
        .cal-cell { aspect-ratio: 1/1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 500; color: #333; border-radius: 8px; cursor: pointer; transition: 0.2s; position: relative; border: 1px solid transparent; }
        .cal-cell:hover:not(.empty) { background-color: #f0f4f8; border-color: #d6eaf8; }
        .cal-cell.empty { cursor: default; }
        
        /* STATES: Active & Today */
        .cal-cell.today { color: #0000af; font-weight: bold; background-color: #eaf4fc; }
        .cal-cell.selected { background-color: #0000af !important; color: white !important; font-weight: bold; box-shadow: 0 4px 8px rgba(0,0,175,0.2); }
        
        /* EVENT DOT INDICATOR */
        .event-dot { width: 5px; height: 5px; background-color: #e74c3c; border-radius: 50%; position: absolute; bottom: 6px; }
        .cal-cell.selected .event-dot { background-color: #fff; }

        /* EVENT CARD (MODERN) */
        .event-card { 
          background: #fff; border: 1px solid #eaeaea; border-radius: 12px; padding: 20px; 
          border-left: 5px solid #0000af; display: flex; flex-direction: column; gap: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.2s;
        }
        .event-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 767px) {
           body, html, .app-container { overflow-x: hidden; -ms-overflow-style: none; scrollbar-width: none; }
           ::-webkit-scrollbar { display: none; }
           .page-wrapper { padding: 15px; }
           .calendar-layout { flex-direction: column; }
           .calendar-section { flex: auto; width: 100%; padding: 20px; box-sizing: border-box; }
        }
      `}</style>

      <div className="page-wrapper">
        
        {/* HEADER */}
        <div className="header-card">
          <h3 style={{ color: '#0d1b2a', margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>Kalender & Agenda Kegiatan</h3>
          <p style={{ fontSize: '0.85rem', color: '#777', margin: 0 }}>Pilih tanggal pada kalender untuk melihat jadwal resmi dari Komisariat, Rayon, maupun Pendamping.</p>
        </div>

        <div className="calendar-layout">
          
          {/* BAGIAN KIRI: WIDGET KALENDER INTERAKTIF */}
          <div className="calendar-section">
            <div className="cal-header">
              <button onClick={prevMonth} className="cal-nav-btn">❮</button>
              <div className="cal-title">{namaBulan[month]} {year}</div>
              <button onClick={nextMonth} className="cal-nav-btn">❯</button>
            </div>

            <div className="cal-grid">
              {/* Header Hari */}
              {namaHari.map(hari => (
                <div key={hari} className="cal-day-name">{hari}</div>
              ))}

              {/* Sel Kosong (Sebelum tanggal 1) */}
              {blanks.map(b => (
                <div key={`blank-${b}`} className="cal-cell empty"></div>
              ))}

              {/* Tanggal Bulan Aktif */}
              {days.map(day => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                const isSelected = dateStr === selectedDateStr;
                const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                
                // Cek apakah ada jadwal di tanggal ini
                const hasEvent = jadwalKegiatan.some(j => j.tanggal.split('T')[0] === dateStr);

                return (
                  <div 
                    key={day} 
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`cal-cell ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''}`}
                  >
                    {day}
                    {hasEvent && <div className="event-dot"></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* BAGIAN KANAN: DAFTAR AGENDA BERDASARKAN TANGGAL */}
          <div className="events-section">
            <h4 style={{ margin: '0 0 5px 0', color: '#0d1b2a', fontSize: '1.05rem', fontWeight: 'bold' }}>
              Agenda pada {selectedDateStr.split('-').reverse().join(' ')}
            </h4>
            
            {jadwalTerpilih.length === 0 ? (
              <div style={{ backgroundColor: '#fafafa', border: '1px dashed #ccc', padding: '40px 20px', borderRadius: '12px', textAlign: 'center', color: '#777', marginTop: '10px' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>☕</span>
                Tidak ada agenda yang dijadwalkan pada tanggal ini.
              </div>
            ) : (
              jadwalTerpilih.map(jadwal => {
                const isKomisariat = jadwal.pembuat === 'Komisariat';
                const isMentoring = jadwal.target === 'Binaan';
                
                const borderColor = isKomisariat ? '#f39c12' : isMentoring ? '#3498db' : '#2ecc71';
                const labelPembuat = isKomisariat ? 'Pusat Komisariat' : isMentoring ? 'Mentoring Pendamping' : 'Lokal Rayon';
                const bgLabel = isKomisariat ? '#fcf3cf' : isMentoring ? '#eaf4fc' : '#eaeded';

                return (
                  <div key={jadwal.id} className="event-card" style={{ borderLeftColor: borderColor }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, color: '#0d1b2a', fontSize: '1.1rem', fontWeight: 'bold' }}>
                        {jadwal.judul}
                      </h4>
                      <span style={{ backgroundColor: bgLabel, color: borderColor === '#f39c12' ? '#b9770e' : borderColor, padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {labelPembuat}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '5px' }}>
                      <div style={{ fontSize: '0.85rem', color: '#e67e22', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⏰</span> <span>Pukul {jadwal.tanggal.split('T')[1] || '-'}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#555', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span>📍</span> <span>{jadwal.lokasi}</span>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', fontSize: '0.85rem', color: '#444', fontStyle: 'italic', lineHeight: '1.5', marginTop: '5px' }}>
                      "{jadwal.deskripsi}"
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div style={{ height: '50px' }} className="mobile-only"></div>
      </div>
    </>
  );
}