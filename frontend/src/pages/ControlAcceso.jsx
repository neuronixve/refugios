import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function ControlAcceso({ token }) {
  const { refugioId } = useParams();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('entrada'); // 'entrada' or 'salida'
  // Feedback Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [manualCode, setManualCode] = useState('');
  
  // Scanner state & error modal
  const [scanning, setScanning] = useState(true);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalErrorText, setModalErrorText] = useState('');

  // Tab controls & Visitor/Incident states
  const [activeTab, setActiveTab] = useState('transito');
  const [visitorSearchQuery, setVisitorSearchQuery] = useState('');
  const [selectedResidentForVisits, setSelectedResidentForVisits] = useState(null);
  const [residents, setResidents] = useState([]);
  const [refugioIncidents, setRefugioIncidents] = useState([]);
  const [incidentType, setIncidentType] = useState('Novedad');
  
  // Multiple Involved Residents State
  const [involvedResidents, setInvolvedResidents] = useState([]);
  const [involvedSearchQuery, setInvolvedSearchQuery] = useState('');
  
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentActionTaken, setIncidentActionTaken] = useState('');
  const [incidentSuccess, setIncidentSuccess] = useState('');
  const [incidentError, setIncidentError] = useState('');
  
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ id: null, time: 0, type: '' });

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchLogs();
    fetchResidents();
    fetchIncidents();
  }, [refugioId]);

  const fetchResidents = async () => {
    try {
      const res = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResidents(data.filter(d => d.status === 'Activo'));
      }
    } catch (err) {
      console.error("Error fetching residents for access control:", err);
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/incidents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRefugioIncidents(await res.json());
      }
    } catch (err) {
      console.error("Error fetching incidents:", err);
    }
  };

  const handleIncidentSubmit = async (e) => {
    e.preventDefault();
    setIncidentSuccess('');
    setIncidentError('');

    if (!incidentDescription) {
      setIncidentError('La descripción es obligatoria.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/incidents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          resident_id: involvedResidents.length > 0 ? involvedResidents[0].id : null,
          incident_type: incidentType,
          description: incidentDescription,
          action_taken: incidentActionTaken,
          involved_residents: JSON.stringify(involvedResidents)
        })
      });

      if (res.ok) {
        setIncidentSuccess('Incidencia de seguridad registrada exitosamente.');
        setIncidentDescription('');
        setIncidentActionTaken('');
        setInvolvedResidents([]);
        fetchIncidents();
      } else {
        const errData = await res.json();
        setIncidentError(errData.error || 'Error al guardar la incidencia.');
      }
    } catch (err) {
      console.error(err);
      setIncidentError('Error de red al guardar la incidencia.');
    }
  };

  const handleAddInvolvedResident = (res) => {
    if (involvedResidents.some(r => r.id === res.id)) return;
    setInvolvedResidents([...involvedResidents, {
      id: res.id,
      name: `${res.first_name} ${res.last_name}`,
      doc_id: res.document_id,
      role: 'Víctima'
    }]);
    setInvolvedSearchQuery('');
  };

  const handleUpdateInvolvedRole = (id, role) => {
    setInvolvedResidents(involvedResidents.map(r => r.id === id ? { ...r, role } : r));
  };

  const handleRemoveInvolvedResident = (id) => {
    setInvolvedResidents(involvedResidents.filter(r => r.id !== id));
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/access-logs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const parseCredentialQr = (decodedText) => {
    const normalized = decodedText.includes('-') ? decodedText.split('-') : decodedText.split('_');
    if (normalized[0] !== 'Sede' || normalized.length < 4) {
      throw new Error('Código QR inválido o corrupto.');
    }

    const qrSedeId = normalized[1];
    const credentialType = normalized[2];
    const personId = parseInt(normalized[3]);

    if (qrSedeId !== refugioId) {
      throw new Error(`Esta credencial pertenece a otra sede (Sede ID: ${qrSedeId}).`);
    }
    if (!['Residente', 'Personal'].includes(credentialType) || isNaN(personId)) {
      throw new Error('Código QR inválido o corrupto.');
    }

    return {
      personType: credentialType === 'Personal' ? 'staff' : 'resident',
      personId
    };
  };

  const registerTransit = async (personId, personType = 'resident') => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/access-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          resident_id: personType === 'resident' ? parseInt(personId) : undefined,
          staff_id: personType === 'staff' ? parseInt(personId) : undefined,
          person_type: personType,
          type: mode
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Registro exitoso: ${(data.person_name || data.resident_name)} ha registrado su ${mode}.`);
        fetchLogs();
      } else {
        setModalErrorText(data.error || 'Error al registrar tránsito.');
        setShowErrorModal(true);
      }
    } catch (err) {
      console.error(err);
      setModalErrorText('Error de conexión con el servidor.');
      setShowErrorModal(true);
    }
  };

  useEffect(() => {
    if (activeTab !== 'transito' || !scanning) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
        scannerRef.current = null;
      }
      return;
    }

    const scannerElement = document.getElementById('qr-reader');
    if (!scannerElement) return;

    const scanner = new Html5QrcodeScanner("qr-reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true
    }, false);

    scanner.render((decodedText) => {
      const now = Date.now();
      const lastScan = lastScanRef.current;
      
      if (lastScan.id === decodedText && lastScan.type === mode && (now - lastScan.time) < 5000) {
        return;
      }

      lastScanRef.current = { id: decodedText, time: now, type: mode };
      
      try {
        const credential = parseCredentialQr(decodedText);
        registerTransit(credential.personId, credential.personType);
      } catch (err) {
        setModalErrorText(err.message || 'Código QR inválido o corrupto.');
        setShowErrorModal(true);
      }
    }, () => {
      // quiet scan error
    });

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
        scannerRef.current = null;
      }
    };
  }, [mode, activeTab, scanning]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    registerTransit(manualCode.trim(), 'resident');
    setManualCode('');
  };

  // Search filter for involved residents inside incident form
  const filteredResidentsForInvolved = involvedSearchQuery.trim() === ''
    ? []
    : residents.filter(r => {
        const q = involvedSearchQuery.toLowerCase();
        return (
          r.first_name.toLowerCase().includes(q) ||
          r.last_name.toLowerCase().includes(q) ||
          (r.document_id && r.document_id.toLowerCase().includes(q))
        );
      });

  // Search filter for visitors tab (fixing the broken reference)
  const filteredResidentsForVisits = residents.filter(r => {
    if (!visitorSearchQuery) return true;
    const q = visitorSearchQuery.toLowerCase();
    return (
      r.first_name.toLowerCase().includes(q) ||
      r.last_name.toLowerCase().includes(q) ||
      (r.document_id && r.document_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <header className="mb-8 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">shield</span>
          <h2 className="text-xl font-black text-on-surface uppercase tracking-tight">Control de Acceso y Seguridad</h2>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">Bitácora de tránsitos, consulta rápida de autorizaciones de visitas y registro de incidencias del centro.</p>
      </header>

      {/* Tabs selector */}
      <div className="flex border-b border-outline-variant mb-6 no-print">
        <button 
          onClick={() => setActiveTab('transito')}
          className={`px-4 py-2.5 text-xs font-black tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'transito' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
          Tránsito de Residentes
        </button>
        <button 
          onClick={() => setActiveTab('visitas')}
          className={`px-4 py-2.5 text-xs font-black tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'visitas' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined text-sm">badge</span>
          Consultar Visitas y Apoyos
        </button>
        <button 
          onClick={() => setActiveTab('incidencias')}
          className={`px-4 py-2.5 text-xs font-black tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'incidencias' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined text-sm">assignment_late</span>
          Reportar Incidencias
        </button>
      </div>

      {/* TAB 1: TRANSITS */}
      {activeTab === 'transito' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-200">
          
          {/* CONTROL SWITCH & SCANNER (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Mode selection switches */}
            <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl shadow-xs">
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block mb-3">Modo del Operativo</span>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setMode('entrada')}
                  className={`py-3 px-4 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    mode === 'entrada'
                      ? 'bg-success text-on-success border-success shadow-sm font-black'
                      : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">login</span>
                  Registrar Entrada
                </button>
                
                <button 
                  onClick={() => setMode('salida')}
                  className={`py-3 px-4 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    mode === 'salida'
                      ? 'bg-error text-on-error border-error shadow-sm font-black'
                      : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  Registrar Salida
                </button>
              </div>
            </div>

            {/* QR scanner block */}
            <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">photo_camera</span>
                  Escanear Carnet Código QR
                </span>
                
                <button 
                  onClick={() => setScanning(!scanning)}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md cursor-pointer ${scanning ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-surface-container-high text-on-surface'}`}
                >
                  {scanning ? 'Apagar Cámara' : 'Encender Cámara'}
                </button>
              </div>

              {scanning ? (
                <div className="overflow-hidden rounded-xl border border-outline-variant bg-black/5 p-2 flex justify-center">
                  <div id="qr-reader" className="w-full max-w-[320px]"></div>
                </div>
              ) : (
                <div className="py-12 text-center text-on-surface-variant/80 border border-dashed border-outline-variant rounded-xl text-xs italic">
                  La cámara se encuentra apagada. Enciéndala para escanear.
                </div>
              )}

              {/* Feedback Alert alerts */}
              {successMsg && (
                <div className="p-3 bg-success/15 border border-success/35 rounded-xl text-xs text-success font-semibold flex gap-2 animate-in slide-in-from-bottom-2 duration-250">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-error/15 border border-error/35 rounded-xl text-xs text-error font-semibold flex gap-2 animate-in slide-in-from-bottom-2 duration-250">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Manual entry fallback */}
            <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl shadow-xs">
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block mb-2">Ingreso Manual (ID de Residente)</span>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="Código numérico o ID..."
                  className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button 
                  type="submit"
                  className="bg-primary text-on-primary px-4 rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                >
                  Registrar
                </button>
              </form>
            </div>

          </div>

          {/* TRANSIT LOGS LIST (7 cols) */}
          <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3 mb-4">Bitácora de Tránsito Operativo</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface/30">
                    <th className="py-2 px-3 rounded-l-lg">Nombre</th>
                    <th className="py-2 px-3">Identificación</th>
                    <th className="py-2 px-3 text-center">Tipo de Movimiento</th>
                    <th className="py-2 px-3 rounded-r-lg">Hora y Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="py-10 text-center text-on-surface-variant italic">Cargando tránsitos recientes...</td>
                    </tr>
                  ) : logs.length > 0 ? (
                    logs.map(log => {
                      const dateStr = new Date(log.logged_at).toLocaleDateString();
                      const timeStr = new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={log.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-all">
                          <td className="py-3 px-3 font-bold text-primary">
                            {log.first_name} {log.last_name}
                            {log.person_type === 'staff' && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-black uppercase">Personal</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-on-surface-variant">C.I. {log.document_id || 'N/T'}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                              log.type === 'entrada' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
                            }`}>
                              {log.type === 'entrada' ? 'Ingreso' : 'Salida'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-on-surface-variant font-medium">{dateStr} {timeStr}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-on-surface-variant italic">No se han registrado tránsitos en la sede operativa hoy.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: VISITAS Y APOYOS */}
      {activeTab === 'visitas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-200">
          {/* SEARCH SIDE (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">Buscar Residente</h3>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
              <input 
                type="text" 
                value={visitorSearchQuery}
                onChange={e => setVisitorSearchQuery(e.target.value)}
                placeholder="Nombre, Apellido o Cédula..."
                className="w-full bg-surface-container border border-outline-variant rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
              />
            </div>

            <div className="max-h-[350px] overflow-y-auto flex flex-col gap-2 mt-2 custom-scrollbar">
              {filteredResidentsForVisits.length > 0 ? (
                filteredResidentsForVisits.map(r => (
                  <button 
                    key={r.id}
                    onClick={() => setSelectedResidentForVisits(r)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex justify-between items-center ${selectedResidentForVisits?.id === r.id ? 'bg-primary/10 border-primary font-bold' : 'bg-surface border-outline-variant/40 hover:bg-surface-container'}`}
                  >
                    <div>
                      <span className="block font-bold text-on-surface">{r.first_name} {r.last_name}</span>
                      <span className="text-[10px] text-on-surface-variant">C.I. {r.document_id || 'N/T'}</span>
                    </div>
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-on-surface-variant italic text-center py-6">No se encontraron residentes con ese nombre o identificación.</p>
              )}
            </div>
          </div>

          {/* DETAIL VIEW (7 Cols) */}
          <div className="lg:col-span-7">
            {selectedResidentForVisits ? (() => {
              let meta = {};
              try {
                meta = selectedResidentForVisits.special_needs ? JSON.parse(selectedResidentForVisits.special_needs) : {};
              } catch {
                meta = {};
              }

              return (
                <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs flex flex-col gap-6 animate-in fade-in duration-200">
                  <div className="flex items-center gap-4 border-b border-outline-variant/30 pb-4">
                    <div className="w-14 h-14 rounded-full bg-surface-container border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
                      {meta.photo ? (
                        <img src={meta.photo} alt="Foto" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-on-surface-variant">person</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-md font-black text-on-surface uppercase">{selectedResidentForVisits.first_name} {selectedResidentForVisits.last_name}</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">C.I. {selectedResidentForVisits.document_id || 'No posee'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* VISITOR AUTHORIZATION CARD */}
                    <div className="bg-success/5 border border-success/20 rounded-xl p-4 flex flex-col gap-2">
                      <span className="text-[10px] text-success block font-black uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">lock_open</span>
                        Visitas Autorizadas
                      </span>
                      <p className="text-on-surface font-bold text-xs mt-1 leading-relaxed">
                        {meta.visitas_autorizadas || 'Sin familiares específicamente autorizados para visitas (Restringido).'}
                      </p>
                    </div>

                    {/* CARACAS FAMILIARS */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col gap-2">
                      <span className="text-[10px] text-primary block font-black uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">home_pin</span>
                        Familiares en Caracas
                      </span>
                      <span className="text-on-surface font-bold">¿Tiene familiares en Caracas?: {meta.tiene_familiares_caracas || 'No'}</span>
                      {meta.tiene_familiares_caracas === 'Sí' && (
                        <p className="text-on-surface-variant text-[11px] mt-1 leading-relaxed border-t border-primary/10 pt-2 italic">
                          {meta.detalles_familiares_caracas || 'No se ingresaron detalles.'}
                        </p>
                      )}
                    </div>

                    {/* CONTACTS INFO */}
                    <div className="md:col-span-2 border-t border-outline-variant/30 pt-4 flex flex-col gap-3">
                      <h5 className="text-[10px] font-bold text-on-surface uppercase tracking-wider">Contactos de Emergencia y Enlace</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <strong className="text-[10px] text-on-surface-variant block">Teléfono de Contacto:</strong>
                          <span className="font-bold text-on-surface text-xs">{meta.telefono_contacto || 'No registrado'}</span>
                        </div>
                        <div>
                          <strong className="text-[10px] text-on-surface-variant block">Contacto de Emergencia:</strong>
                          <span className="font-bold text-on-surface text-xs">{meta.contacto_emergencia || 'No registrado'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="bg-surface-container-lowest border border-outline-variant p-12 rounded-2xl shadow-xs text-center text-on-surface-variant italic text-xs">
                Seleccione un residente del panel de búsqueda para consultar sus autorizaciones de visitas y familiares de apoyo.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: INCIDENCIAS */}
      {activeTab === 'incidencias' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-200">
          
          {/* REGISTRATION FORM (5 Cols) */}
          <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs flex flex-col gap-4">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3">Registrar Novedad o Incidencia</h3>
            
            {incidentSuccess && (
              <div className="p-3 bg-success/10 border border-success/30 rounded-xl text-xs text-success font-semibold flex gap-2">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>{incidentSuccess}</span>
              </div>
            )}

            {incidentError && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-xs text-error font-semibold flex gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{incidentError}</span>
              </div>
            )}

            <form onSubmit={handleIncidentSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Tipo de Incidencia *</label>
                <select 
                  value={incidentType} 
                  onChange={e => setIncidentType(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none font-bold"
                >
                  <option value="Novedad">Novedad Operativa / General</option>
                  <option value="Altercado">Altercado / Novedad de Convivencia</option>
                  <option value="Emergencia">Emergencia Médica / Seguridad</option>
                </select>
              </div>

              {/* SEARCH AND SELECT INVOLVED RESIDENTS (MULTIPLE) */}
              <div className="flex flex-col gap-2 border border-outline-variant/40 rounded-xl p-3 bg-surface/50">
                <label className="text-[10px] font-black text-primary uppercase tracking-wider block">Residentes Involucrados</label>
                
                {/* Search query box */}
                <div className="relative mt-1">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-sm">person_search</span>
                  <input 
                    type="text"
                    value={involvedSearchQuery}
                    onChange={e => setInvolvedSearchQuery(e.target.value)}
                    placeholder="Escriba nombre o cédula para agregar..."
                    className="w-full bg-surface-container border border-outline-variant rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:outline-none"
                  />
                  
                  {/* Suggestion list */}
                  {filteredResidentsForInvolved.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-[160px] overflow-y-auto z-10 text-xs custom-scrollbar">
                      {filteredResidentsForInvolved.map(res => (
                        <button
                          type="button"
                          key={res.id}
                          onClick={() => handleAddInvolvedResident(res)}
                          className="w-full text-left px-3 py-2 hover:bg-primary/5 border-b border-outline-variant/30 flex justify-between items-center"
                        >
                          <span className="font-bold">{res.first_name} {res.last_name}</span>
                          <span className="text-[10px] text-on-surface-variant">C.I. {res.document_id || 'N/T'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected involved list with roles dropdown */}
                <div className="flex flex-col gap-2 mt-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                  {involvedResidents.length > 0 ? (
                    involvedResidents.map(res => (
                      <div key={res.id} className="bg-surface border border-outline-variant/40 rounded-lg p-2 flex justify-between items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <strong className="block text-on-surface truncate text-xs">{res.name}</strong>
                          <span className="text-[9px] text-on-surface-variant">C.I. {res.doc_id || 'N/T'}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <select
                            value={res.role}
                            onChange={e => handleUpdateInvolvedRole(res.id, e.target.value)}
                            className="bg-surface-container border border-outline-variant rounded px-1.5 py-1 text-[10px] focus:outline-none font-bold text-primary"
                          >
                            <option value="Víctima">Víctima</option>
                            <option value="Denunciante">Denunciante</option>
                            <option value="Agresor">Agresor</option>
                            <option value="Testigo">Testigo</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveInvolvedResident(res.id)}
                            className="text-error hover:bg-error/10 p-1 rounded transition-all cursor-pointer flex items-center justify-center shrink-0"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-[10px] text-on-surface-variant italic text-center py-4">No se han seleccionado personas involucradas.</span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Descripción de lo Ocurrido *</label>
                <textarea 
                  value={incidentDescription} 
                  onChange={e => setIncidentDescription(e.target.value)}
                  placeholder="Detalle los hechos, hora aproximada, personas involucradas y la situación..."
                  className="w-full bg-surface-container border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none h-24 resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Acción Tomada</label>
                <textarea 
                  value={incidentActionTaken} 
                  onChange={e => setIncidentActionTaken(e.target.value)}
                  placeholder="Ej. Se llamó a emergencias médicas / Se medió y resolvió de forma pacífica / Coordinación con policía..."
                  className="w-full bg-surface-container border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none h-16 resize-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 transition-all cursor-pointer text-xs mt-2 uppercase tracking-wider"
              >
                Guardar Incidencia
              </button>
            </form>
          </div>

          {/* INCIDENTS LIST LOG (7 Cols) */}
          <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3 mb-4">Bitácora de Novedades e Incidencias</h3>
            
            <div className="flex flex-col gap-4 max-h-[580px] overflow-y-auto custom-scrollbar pr-1">
              {refugioIncidents.length > 0 ? (
                refugioIncidents.map(inc => {
                  const date = new Date(inc.logged_at).toLocaleDateString();
                  const time = new Date(inc.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  let involvedList = [];
                  try {
                    involvedList = JSON.parse(inc.involved_residents || '[]');
                  } catch {
                    involvedList = [];
                  }

                  return (
                    <div key={inc.id} className="border border-outline-variant/40 rounded-xl p-4 bg-surface/50 flex flex-col gap-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          inc.incident_type === 'Emergencia' ? 'bg-error text-on-error animate-pulse' :
                          inc.incident_type === 'Altercado' ? 'bg-warning/20 text-warning' : 'bg-surface-container-high text-on-surface'
                        }`}>
                          {inc.incident_type}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-bold">{date} {time}</span>
                      </div>
                      
                      <p className="text-on-surface font-medium leading-relaxed">{inc.description}</p>
                      
                      {inc.action_taken && (
                        <div className="bg-surface-container/20 border border-outline-variant/30 rounded-lg p-2.5 text-[10px] text-on-surface-variant italic">
                          <strong>Acción tomada:</strong> {inc.action_taken}
                        </div>
                      )}

                      {/* Render involved list with roles */}
                      {involvedList.length > 0 && (
                        <div className="flex flex-col gap-1.5 border-t border-outline-variant/20 pt-2">
                          <strong className="text-[9px] text-on-surface-variant uppercase tracking-wider">Personas Involucradas:</strong>
                          <div className="flex flex-wrap gap-1.5">
                            {involvedList.map(inv => (
                              <span 
                                key={inv.id} 
                                className={`text-[9px] px-2 py-0.5 rounded border ${
                                  inv.role === 'Agresor' ? 'bg-error/10 border-error/30 text-error font-bold' :
                                  inv.role === 'Víctima' ? 'bg-success/15 border-success/30 text-success' :
                                  inv.role === 'Denunciante' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-high border-outline-variant text-on-surface'
                                }`}
                              >
                                {inv.name} ({inv.role})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-[9px] text-on-surface-variant/80 border-t border-outline-variant/10 pt-2 flex justify-between items-center">
                        <span>Registrado por: <strong>{inc.reporter_name || 'Personal'}</strong></span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-on-surface-variant italic text-center py-12">No se han registrado incidencias o novedades en esta sede operativa.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ERROR MODAL */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface border border-outline-variant rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in scale-in duration-200 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-error">cancel</span>
            <h4 className="text-sm font-black text-on-surface uppercase tracking-wide">Error en Operación</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">{modalErrorText}</p>
            <button 
              onClick={() => setShowErrorModal(false)}
              className="mt-2 w-full bg-error text-on-error py-2.5 rounded-xl font-bold text-xs uppercase hover:opacity-90 transition-all cursor-pointer"
            >
              Cerrar Mensaje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
