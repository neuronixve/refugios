import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';

const MEAL_WINDOWS = [
  { mealType: 'Desayuno', label: '06:00 AM - 11:00 AM', start: 6 * 60, end: 11 * 60 },
  { mealType: 'Almuerzo', label: '11:30 AM - 04:30 PM', start: 11 * 60 + 30, end: 16 * 60 + 30 },
  { mealType: 'Cena', label: '05:30 PM - 10:00 PM', start: 17 * 60 + 30, end: 22 * 60 }
];

const getCurrentMealWindow = (date = new Date()) => {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return MEAL_WINDOWS.find(window => minutes >= window.start && minutes <= window.end) || null;
};

export default function LogisticsAttendance({ token }) {
  const { refugioId } = useParams();

  // Data States
  const [residents, setResidents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Scanning State
  const [scanning, setScanning] = useState(true);
  const [currentMealWindow, setCurrentMealWindow] = useState(getCurrentMealWindow());
  const [scannedPerson, setScannedPerson] = useState(null);
  
  // Autocomplete Manual Entry States
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedManualResident, setSelectedManualResident] = useState(null);

  // Scanner reference
  const scannerRef = useRef(null);
  const lastScanRef = useRef(0);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchData();
  }, [refugioId]);

  useEffect(() => {
    const updateMealWindow = () => {
      const activeWindow = getCurrentMealWindow();
      setCurrentMealWindow(activeWindow);
      if (!activeWindow) {
        setScanning(false);
      }
    };

    updateMealWindow();
    const timer = window.setInterval(updateMealWindow, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scanning && currentMealWindow && !scannerRef.current) {
      startScanner();
    } else if (!scanning && scannerRef.current) {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [scanning, currentMealWindow?.mealType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch residents
      const resRes = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resRes.ok) {
        setResidents(await resRes.json());
      }

      const resStaff = await fetch(`${API_BASE}/refugios/${refugioId}/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resStaff.ok) {
        setStaff(await resStaff.json());
      }

      // 2. Fetch today's meal attendance for residents and staff
      const resAtt = await fetch(`${API_BASE}/refugios/${refugioId}/meals/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resAtt.ok) {
        setAttendance(await resAtt.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Web Audio Synth Warning Sound (beep alert)
  const playAlertSound = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch beep
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // Double low pitch alert beep for critical diets or duplicate warning
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.error("Audio synth error:", e);
    }
  };

  const startScanner = () => {
    setTimeout(() => {
      const container = document.getElementById('comedor-qr-reader');
      if (!container) return;

      scannerRef.current = new Html5QrcodeScanner(
        'comedor-qr-reader',
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      );

      scannerRef.current.render(handleScanSuccess, handleScanError);
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(err => console.error("Error clearing scanner:", err));
      scannerRef.current = null;
    }
  };

  const handleScanSuccess = async (decodedText) => {
    const now = Date.now();
    if (now - lastScanRef.current < 4000) return; // 4 second cooldown
    lastScanRef.current = now;

    setError('');
    setMessage('');

    try {
      // Parse official QR code format (Sede-[SedeID]-Residente/Personal-[ID])
      const parts = decodedText.split('-');
      if (parts[0] !== 'Sede' || !['Residente', 'Personal'].includes(parts[2])) {
        throw new Error('Código QR inválido. No es una credencial oficial de refugio.');
      }

      const qrSedeId = parts[1];
      const credentialType = parts[2];
      const personId = parseInt(parts[3]);

      if (qrSedeId !== refugioId) {
        throw new Error(`Esta credencial pertenece a otra sede (Sede ID: ${qrSedeId}).`);
      }

      if (isNaN(personId)) {
        throw new Error('Código QR no contiene un identificador válido.');
      }

      if (credentialType === 'Personal') {
        let staffObj = staff.find(s => s.id.toString() === personId.toString());
        if (!staffObj) {
          const resStaff = await fetch(`${API_BASE}/refugios/${refugioId}/staff`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (resStaff.ok) {
            const staffData = await resStaff.json();
            setStaff(staffData);
            staffObj = staffData.find(s => s.id.toString() === personId.toString());
          }
        }

        if (!staffObj) {
          throw new Error('Personal no registrado en esta sede.');
        }

        setScannedPerson({ ...staffObj, person_type: 'staff' });
        await registerAttendance(staffObj.document_id, staffObj.id, 'staff');
        return;
      }

      let resObj = residents.find(r => r.id.toString() === personId.toString());
      if (!resObj) {
        const resSingle = await fetch(`${API_BASE}/damnificados?search=${personId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resSingle.ok) {
          const searchData = await resSingle.json();
          resObj = searchData.find(r => r.id.toString() === personId.toString());
        }
      }

      if (!resObj) {
        throw new Error('Residente no registrado en esta sede.');
      }

      setScannedPerson({ ...resObj, person_type: 'resident' });
      await registerAttendance(resObj.document_id, resObj.id, 'resident');
    } catch (err) {
      console.error(err);
      playAlertSound('error');
      setError(err.message || 'Código QR inválido.');
      setScanning(false); // Pause scanner for review
    }
  };

  const handleScanError = () => {
    // Suppress console flood of scanning feedback
  };

  const registerAttendance = async (docId, personId = null, personType = 'resident') => {
    if (!currentMealWindow) {
      playAlertSound('error');
      setError('Fuera del horario de servicio. Desayuno 06:00-11:00, Almuerzo 11:30-16:30, Cena 17:30-22:00.');
      setScanning(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/meals/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          document_id: docId,
          resident_id: personType === 'resident' ? personId : null,
          staff_id: personType === 'staff' ? personId : null,
          person_type: personType,
          refugio_id: parseInt(refugioId),
          meal_type: currentMealWindow.mealType
        })
      });

      if (res.ok) {
        playAlertSound('success');
        const data = await res.json();
        setMessage(`Asistencia a ${data.attendance?.meal_type || currentMealWindow.mealType} registrada correctamente.`);
        fetchData();
      } else {
        const errData = await res.json();
        playAlertSound('error');
        setError(errData.error || 'Error al registrar la asistencia.');
        setScanning(false); // Pause scanner to display error modal
      }
    } catch (err) {
      playAlertSound('error');
      setError('Error al conectar con el servidor.');
      setScanning(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!selectedManualResident) {
      setError('Por favor, busque y seleccione un residente del listado.');
      return;
    }
    setError('');
    setMessage('');

    setScannedPerson({ ...selectedManualResident, person_type: 'resident' });
    await registerAttendance(selectedManualResident.document_id, selectedManualResident.id, 'resident');
    setSelectedManualResident(null);
    setSearchQuery('');
  };

  const handleResumeScan = () => {
    setError('');
    setMessage('');
    setScannedPerson(null);
    if (currentMealWindow) {
      setScanning(true);
    }
  };

  // Get family count for resident
  const getFamilyCount = (resObj) => {
    if (!resObj || !resObj.family_group_id) return 1;
    const count = residents.filter(r => r.family_group_id === resObj.family_group_id).length;
    return count > 0 ? count : 1;
  };

  // Get custom code abbreviating Sede
  const getResidentCode = (resObj) => {
    if (!resObj) return '';
    const abrev = 'VALE';
    const famCount = getFamilyCount(resObj);
    return `${abrev}-${famCount}-${resObj.id}`;
  };

  // Resident profile photo helper
  const getResidentPhoto = (resObj) => {
    if (!resObj || !resObj.special_needs) return null;
    try {
      const meta = JSON.parse(resObj.special_needs);
      return meta.photo || null;
    } catch {
      return null;
    }
  };

  const getPersonName = (person) => {
    if (!person) return '';
    if (person.person_type === 'staff' || person.staff_id) return person.name || person.staff_name || person.first_name || 'Personal';
    return `${person.first_name || ''} ${person.last_name || ''}`.trim();
  };

  const getPersonPhoto = (person) => {
    if (!person) return null;
    if (person.person_type === 'staff' || person.staff_id) return person.photo || person.staff_photo || null;
    return getResidentPhoto(person);
  };

  // Get Diet restriction highlights
  const getDietLabel = (resObj) => {
    if (!resObj) return null;
    const needs = (resObj.special_needs || '').toLowerCase();
    const health = (resObj.health_status || '').toLowerCase();

    if (needs.includes('diab') || health.includes('diab')) return 'Dieta Especial: Diabético';
    if (needs.includes('celia') || needs.includes('gluten')) return 'Dieta Especial: Celiaco (Sin Gluten)';
    if (needs.includes('lactan') || needs.includes('formula') || needs.includes('fórmula')) return 'Dieta Especial: Lactante';
    if (needs.includes('alerg') || needs.includes('asma')) return 'Dieta Especial: Alergias/Asma';

    return null;
  };

  // Counters
  const totalActive = residents.filter(r => r.status === 'Activo').length + staff.length;
  const mealType = currentMealWindow?.mealType || 'Sin turno';
  const servidosHoy = attendance.filter(a => a.meal_type === mealType).length;
  const pendientesHoy = Math.max(0, totalActive - servidosHoy);

  // Diet alerts count
  const dietAlertsCount = attendance.filter(a => {
    const resObj = residents.find(r => r.id === a.resident_id);
    return getDietLabel(resObj) !== null;
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Asistencia de Comedor</h2>
          <p className="text-xs text-on-surface-variant mt-1.5 font-mono">Control de entrega de comidas en tiempo real.</p>
        </div>

        {/* Automatic Meal Window */}
        <div className={`rounded-xl px-4 py-3 border text-xs font-bold ${
          currentMealWindow ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-error/10 border-error/20 text-error'
        }`}>
          <span className="block text-[9px] uppercase tracking-wider text-on-surface-variant font-black">Turno automático por hora</span>
          <span className="block mt-0.5">
            {currentMealWindow ? `${currentMealWindow.mealType} (${currentMealWindow.label})` : 'Fuera de horario de comida'}
          </span>
        </div>
      </header>

      {/* Counters widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Raciones Servidas */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-md">restaurant</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Raciones Servidas</span>
              <span className="text-md font-black text-[#0b2347] block font-mono mt-0.5">{servidosHoy} / {totalActive}</span>
            </div>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded">
            En Vivo
          </span>
        </div>

        {/* Pendientes */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-md">assignment_late</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Pendientes</span>
              <span className="text-md font-black text-amber-600 block font-mono mt-0.5">{pendientesHoy}</span>
            </div>
          </div>
        </div>

        {/* Dietas Especiales Servidas */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-md">favorite</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Dietas Especiales</span>
              <span className="text-md font-black text-error block font-mono mt-0.5">{dietAlertsCount}</span>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: QR CAMERA SCANNER & MANUAL FALLBACK (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* QR Scanner Container */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#0b2347]">photo_camera</span>
                Escaneo de Carnet QR ({mealType})
              </h3>
              {!scanning && currentMealWindow && (
                <button 
                  onClick={handleResumeScan}
                  className="px-3 py-1 bg-primary text-on-primary font-bold text-[10px] rounded-lg cursor-pointer"
                >
                  Reactivar Cámara
                </button>
              )}
            </div>

            {scanning && currentMealWindow ? (
              <div className="relative aspect-square max-w-[320px] mx-auto w-full bg-black rounded-2xl overflow-hidden border border-outline-variant">
                <div id="comedor-qr-reader" className="w-full h-full"></div>
                <div className="absolute top-4 left-4 bg-error text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                  En Vivo
                </div>
              </div>
            ) : (
              <div className="aspect-square max-w-[320px] mx-auto w-full bg-surface-container border border-outline-variant rounded-2xl flex flex-col items-center justify-center p-6 text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">pause_circle</span>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-on-surface">
                    {currentMealWindow ? 'Escáner en Pausa' : 'Servicio Cerrado'}
                  </h4>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-1 leading-relaxed">
                    {currentMealWindow
                      ? 'Se detuvo el lector para revisar los datos de la última credencial. Presione "Reanudar" para continuar.'
                      : 'El registro de comida solo está disponible en estos horarios: desayuno 06:00-11:00, almuerzo 11:30-16:30 y cena 17:30-22:00.'}
                  </p>
                </div>
                {currentMealWindow && (
                  <button 
                    onClick={handleResumeScan}
                    className="px-4 py-2 bg-[#0b2347] text-white font-bold text-xs rounded-xl hover:opacity-95 transition-all cursor-pointer"
                  >
                    Reanudar Escaneo
                  </button>
                )}
              </div>
            )}
            
            <p className="text-[10px] text-on-surface-variant text-center font-medium italic">
              Coloque el código QR del carnet del residente frente a la cámara para registrar su servicio de comida.
              También puede escanear credenciales del personal activo en la sede.
            </p>
          </div>

          {/* Manual Entry Fallback */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4 relative">
            <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#0b2347]">keyboard</span>
              Buscador de Residente (Nombre o Cédula)
            </h3>
            
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-3 relative text-xs">
              <div className="relative">
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                    setSelectedManualResident(null);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Escriba nombre, apellido o C.I. (ej: Camila Perez)..."
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                />

                {/* Clear Selected Indicator */}
                {selectedManualResident && (
                  <div className="absolute right-3 top-2.5 flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-lg font-bold text-[10px]">
                    <span>Seleccionado: {selectedManualResident.first_name}</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        setSelectedManualResident(null);
                        setSearchQuery('');
                      }} 
                      className="text-primary hover:text-primary-dark font-black"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Dropdown list */}
                {showDropdown && searchQuery && (
                  <div className="absolute left-0 right-0 top-12 mt-1 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    {residents
                      .filter(r => r.status === 'Activo')
                      .filter(r => {
                        const q = searchQuery.toLowerCase();
                        const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
                        const doc = (r.document_id || '').toLowerCase();
                        return fullName.includes(q) || doc.includes(q);
                      })
                      .slice(0, 8)
                      .map((res) => (
                        <div
                          key={res.id}
                          onClick={() => {
                            setSelectedManualResident(res);
                            setSearchQuery(`${res.first_name} ${res.last_name} (${res.document_id || 'Sin C.I.'})`);
                            setShowDropdown(false);
                          }}
                          className="px-4 py-2.5 hover:bg-secondary-container/60 cursor-pointer border-b border-outline-variant/30 last:border-b-0 text-left"
                        >
                          <span className="font-bold text-on-surface block text-xs">{res.first_name} {res.last_name}</span>
                          <span className="text-[9px] text-on-surface-variant font-mono">C.I: {res.document_id || 'Sin Cédula'} • Sector: {res.room_number || 'N/R'}</span>
                        </div>
                      ))}
                    {residents.filter(r => r.status === 'Activo').filter(r => {
                      const q = searchQuery.toLowerCase();
                      const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
                      const doc = (r.document_id || '').toLowerCase();
                      return fullName.includes(q) || doc.includes(q);
                    }).length === 0 && (
                      <p className="p-3 text-center italic text-on-surface-variant text-[10px]">No se encontraron residentes activos.</p>
                    )}
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={!selectedManualResident || !currentMealWindow}
                className="w-full py-3 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {currentMealWindow ? 'Registrar Asistencia' : 'Registro fuera de horario'}
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: LAST SCANNED PROFILE & TODAY'S HISTORIAL FEED (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Last Scanned Resident Profile Card with Diet warning */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-5 relative overflow-hidden">
            <h3 className="text-xs font-black text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3">
              Ficha de Credencial Escaneada
            </h3>

            {scannedPerson ? (
              <div className="flex flex-col items-center text-center gap-4">
                
                {/* Photo */}
                <div className="w-16 h-16 rounded-full border border-[#0b2347]/20 bg-surface-container overflow-hidden flex items-center justify-center shrink-0">
                  {getPersonPhoto(scannedPerson) ? (
                    <img 
                      src={getPersonPhoto(scannedPerson)} 
                      alt="Foto Perfil" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-[#0b2347]">
                      {scannedPerson.person_type === 'staff' ? 'badge' : 'person'}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-md font-black text-on-surface uppercase leading-none">
                    {getPersonName(scannedPerson)}
                  </h4>
                  <p className="text-[10px] text-on-surface-variant font-bold mt-1.5 font-mono">
                    {scannedPerson.person_type === 'staff'
                      ? `C.I. ${scannedPerson.document_id || 'Sin C.I.'} • ${scannedPerson.staff_function || 'Personal'}`
                      : `ID: ${getResidentCode(scannedPerson)} • Sector ${scannedPerson.room_number || 'Sin Sector'}`}
                  </p>
                </div>

                {/* Critical Diet Alert Box */}
                {scannedPerson.person_type !== 'staff' && getDietLabel(scannedPerson) ? (
                  <div className="w-full p-4 bg-error/10 border border-error/20 rounded-2xl text-xs text-left flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-error/15 text-error flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-sm">local_hospital</span>
                    </div>
                    <div>
                      <span className="font-black text-error uppercase text-[9px] tracking-wider block">ALERTA MÉDICA NUTRICIONAL</span>
                      <span className="font-bold text-on-surface text-[11px] block mt-1">{getDietLabel(scannedPerson)}</span>
                      <span className="text-[10px] text-on-surface-variant block mt-0.5 leading-normal">
                        Evite ingredientes procesados, alérgenos o grasas no aptas para su diagnóstico.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full p-3.5 bg-success/15 border border-success/35 text-success rounded-2xl text-xs text-center font-bold">
                    {scannedPerson.person_type === 'staff' ? 'Personal de la sede validado para comedor.' : 'Sin restricciones alimentarias. Dieta libre.'}
                  </div>
                )}

                <div className="flex gap-2 w-full mt-1">
                  <button 
                    onClick={handleResumeScan}
                    className="flex-1 py-2.5 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 cursor-pointer"
                  >
                    Confirmar Servicio
                  </button>
                </div>

              </div>
            ) : (
              <div className="py-12 text-center text-xs font-bold text-on-surface-variant flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">qr_code_2</span>
                Esperando escaneo de credencial...
              </div>
            )}
          </div>

          {/* Today's Attendance Historial Feed */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <h3 className="text-xs font-black text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3">
              Historial Reciente ({mealType.toUpperCase()})
            </h3>

            <div className="max-h-56 overflow-y-auto pr-1 flex flex-col gap-2">
              {attendance.filter(a => a.meal_type === mealType).map((att) => {
                const resObj = residents.find(r => r.id === att.resident_id);
                const diet = getDietLabel(resObj);
                
                return (
                  <div 
                    key={att.id} 
                    className="p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-on-surface">
                        {att.first_name} {att.last_name}
                        {att.person_type === 'staff' && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-black uppercase">Personal</span>
                        )}
                      </span>
                      {diet && (
                        <span className="text-[8px] font-black text-error uppercase">
                          {diet.split(':')[1] || diet}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold font-mono text-on-surface-variant block">
                        {new Date(att.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[9px] bg-success/15 text-success font-black px-1.5 py-0.5 rounded font-mono block mt-1 uppercase text-[8px]">
                        Entregado
                      </span>
                    </div>
                  </div>
                );
              })}
              {attendance.filter(a => a.meal_type === mealType).length === 0 && (
                <p className="py-8 text-center text-xs italic text-on-surface-variant">Sin raciones servidas hoy para {mealType}.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Error Popup Alert overlay if needed */}
      {error && !scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-sm shadow-lg text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-error/15 text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">error</span>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-on-surface">Registro Rechazado</h4>
              <p className="text-[11px] text-error font-bold mt-2 leading-relaxed">{error}</p>
            </div>
            <button 
              onClick={handleResumeScan}
              className="w-full py-2.5 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 cursor-pointer"
            >
              Entendido / Reintentar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
