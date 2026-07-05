import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function Triage({ token }) {
  const { refugioId } = useParams();
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);

  // Modals
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);

  // Form states for modals
  // Vitals & General
  const [bloodType, setBloodType] = useState('O+');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  
  // New Evaluation
  const [evalTitle, setEvalTitle] = useState('Control Rutinario');
  const [evalDetails, setEvalDetails] = useState('');
  const [evalDoctor, setEvalDoctor] = useState('');
  const [evalTag, setEvalTag] = useState('Signos Estables');

  // New Medication
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medDate, setMedDate] = useState('');
  const [medEndDate, setMedEndDate] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchResidents();
  }, [refugioId]);

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const activeResidents = data.filter(r => r.status === 'Activo');
        setResidents(activeResidents);
        
        // Default select first resident if available and none selected yet
        if (activeResidents.length > 0 && !selectedResident) {
          setSelectedResident(activeResidents[0]);
        } else if (selectedResident) {
          const updated = activeResidents.find(r => r.id === selectedResident.id);
          if (updated) {
            setSelectedResident(updated);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Autocomplete search suggestions
  const searchSuggestions = residents.filter(r => {
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
    const doc = (r.document_id || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return q && (fullName.includes(q) || doc.includes(q));
  });

  const handleSelectResident = (res) => {
    setSelectedResident(res);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  // Helper to parse JSON metadata
  const getMetadata = (resident) => {
    if (!resident || !resident.special_needs) return {};
    try {
      return JSON.parse(resident.special_needs);
    } catch {
      return {};
    }
  };

  const calculateAge = (birthDateString) => {
    if (!birthDateString) return '--';
    const birth = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? `${age} Años` : '0 Años';
  };

  // Save the updated JSON uploader
  const saveResidentMedicalInfo = async (updatedMeta) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/damnificados/${selectedResident.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...selectedResident,
          special_needs: JSON.stringify(updatedMeta)
        })
      });

      if (res.ok) {
        fetchResidents();
        setMessage('Expediente médico actualizado.');
      } else {
        setError('Error al actualizar el expediente.');
      }
    } catch (err) {
      setError('Error al conectar con la API.');
    }
  };

  const handleOpenVitals = () => {
    const meta = getMetadata(selectedResident);
    setBloodType(meta.sangre || 'O+');
    setWeight(meta.peso || '');
    setHeight(meta.altura || '');
    showAllergiesInput(meta.allergies ? meta.allergies.join(', ') : '');
    showChronicInput(meta.preexisting ? meta.preexisting.join(', ') : '');
    setShowVitalsModal(true);
  };

  // Form handlers for vitals
  const [allergiesInput, showAllergiesInput] = useState('');
  const [chronicInput, showChronicInput] = useState('');

  const handleSaveVitals = async (e) => {
    e.preventDefault();
    const meta = getMetadata(selectedResident);
    const updatedMeta = {
      ...meta,
      sangre: bloodType,
      peso: weight,
      altura: height,
      allergies: allergiesInput.split(',').map(a => a.trim().toUpperCase()).filter(Boolean),
      preexisting: chronicInput.split(',').map(a => a.trim()).filter(Boolean)
    };
    await saveResidentMedicalInfo(updatedMeta);
    setShowVitalsModal(false);
  };

  const handleAddEvaluation = async (e) => {
    e.preventDefault();
    const meta = getMetadata(selectedResident);
    const newEval = {
      title: evalTitle,
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) + `, ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
      details: evalDetails,
      doctor: evalDoctor || 'Médico de Guardia',
      tag: evalTag
    };
    const updatedMeta = {
      ...meta,
      evaluations: [newEval, ...(meta.evaluations || [])]
    };
    await saveResidentMedicalInfo(updatedMeta);
    setEvalDetails('');
    setEvalDoctor('');
    setShowEvalModal(false);
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    const meta = getMetadata(selectedResident);
    const newMed = {
      name: medName,
      dose: medDose,
      date: medDate || new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
      endDate: medEndDate || 'Indefinido'
    };
    const updatedMeta = {
      ...meta,
      medications: [newMed, ...(meta.medications || [])]
    };
    await saveResidentMedicalInfo(updatedMeta);
    setMedName('');
    setMedDose('');
    setMedDate('');
    setMedEndDate('');
    setShowMedModal(false);
  };

  const meta = getMetadata(selectedResident);
  const residentAge = selectedResident ? calculateAge(selectedResident.birth_date) : '--';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Header */}
      <header className="mb-8">
        <h2 className="text-2xl font-extrabold text-primary">Triage y Perfil Médico</h2>
        <p className="text-xs text-on-surface-variant">Gestión de alertas de salud, tratamientos médicos y bitácora clínica de residentes.</p>
      </header>

      {error && <p className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-xs font-bold text-error">{error}</p>}
      {message && <p className="mb-4 p-3 bg-success/10 border border-success/20 rounded-lg text-xs font-bold text-success">{message}</p>}

      {/* SEARCH AUTOCOMPLETE BAR */}
      <div className="relative w-full max-w-2xl mb-8">
        <span className="material-symbols-outlined text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 text-sm">search</span>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSearchResults(true);
          }}
          placeholder="Buscar paciente por cédula o nombre..." 
          className="w-full bg-surface-container border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none"
        />
        {showSearchResults && searchSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-outline-variant rounded-xl shadow-lg overflow-hidden text-xs max-h-60 overflow-y-auto">
            {searchSuggestions.map(res => (
              <div 
                key={res.id}
                onClick={() => handleSelectResident(res)}
                className="p-3 hover:bg-primary/5 cursor-pointer border-b border-outline-variant/30 flex justify-between items-center"
              >
                <span className="font-bold text-on-surface">{res.first_name} {res.last_name}</span>
                <span className="text-[10px] text-on-surface-variant">C.I. {res.document_id || 'N/T'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedResident ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* CARD 1: GENERAL VITALS & DEMOGRAPHIC */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full border border-outline-variant bg-surface-container overflow-hidden flex items-center justify-center">
                {meta.photo ? (
                  <img src={meta.photo} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-on-surface">{selectedResident.first_name} {selectedResident.last_name}</h3>
                <span className="text-[10px] text-on-surface-variant block font-medium">C.I. {selectedResident.document_id || 'N/T'}</span>
                <span className="text-[10px] text-primary font-bold block mt-0.5">ID: #REF-{selectedResident.id}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 border-t border-outline-variant pt-6 text-xs">
              <div>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block">Edad</span>
                <span className="font-bold text-on-surface">{residentAge}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block">Sexo</span>
                <span className="font-bold text-on-surface">{selectedResident.gender || 'Masculino'}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block">Peso</span>
                <span className="font-bold text-on-surface">{meta.peso || '-- kg'}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant block">Altura</span>
                <span className="font-bold text-on-surface">{meta.altura || '-- m'}</span>
              </div>
            </div>

            <button 
              onClick={handleOpenVitals}
              className="mt-6 w-full py-2.5 border border-outline text-primary font-bold rounded-lg text-xs hover:bg-surface-container"
            >
              Editar Ficha Médica / Alertas
            </button>
          </div>

          {/* CARD 2: MEDICAL ALERTS */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Alertas Médicas</h3>
              
              <div className="flex flex-col gap-3">
                {/* Blood Type */}
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-800 rounded-xl">
                  <span className="material-symbols-outlined text-sm">water_drop</span>
                  <div>
                    <span className="text-[9px] block uppercase font-bold">Tipo de Sangre</span>
                    <span className="text-xs font-black">{meta.sangre || 'Sin Registrar'}</span>
                  </div>
                </div>

                {/* Allergies */}
                {meta.allergies && meta.allergies.length > 0 ? (
                  <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 text-red-800 rounded-xl">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    <div>
                      <span className="text-[9px] block uppercase font-bold">Alergias</span>
                      <span className="text-xs font-black">{meta.allergies.join(', ')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 text-green-800 rounded-xl">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <div>
                      <span className="text-[9px] block uppercase font-bold">Alergias</span>
                      <span className="text-xs font-black">No Reporta Alergias</span>
                    </div>
                  </div>
                )}

                {/* Chronic Pre-existing Conditions */}
                {meta.preexisting && meta.preexisting.length > 0 ? (
                  <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 rounded-xl">
                    <span className="material-symbols-outlined text-sm">monitor_heart</span>
                    <div>
                      <span className="text-[9px] block uppercase font-bold">Condición Crónica</span>
                      <span className="text-xs font-black">{meta.preexisting.join(', ')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 text-green-800 rounded-xl">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <div>
                      <span className="text-[9px] block uppercase font-bold">Patologías Crónicas</span>
                      <span className="text-xs font-black">Sano / Sin Patologías Crónicas</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => setShowEvalModal(true)}
              className="mt-6 py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs hover:opacity-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Añadir Evaluación Médica
            </button>
          </div>

          {/* CARD 3: ACTIVE MEDICATIONS / TREATMENTS */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">medication</span>
                Tratamientos Actuales
              </h3>

              {meta.medications && meta.medications.length > 0 ? (
                <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {meta.medications.map((med, idx) => (
                    <div key={idx} className="p-3 border border-outline-variant rounded-xl bg-surface flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-on-surface text-xs">{med.name}</h4>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">{med.dose}</p>
                        <span className="text-[9px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded font-bold mt-2 inline-block">
                          Inicio: {med.date} {med.endDate ? ` - Fin: ${med.endDate}` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic py-6 text-center">No tiene tratamientos activos registrados.</p>
              )}
            </div>

            <button 
              onClick={() => setShowMedModal(true)}
              className="mt-6 py-2.5 bg-surface border border-outline text-primary font-bold rounded-lg text-xs hover:bg-surface-container flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Registrar Medicamento
            </button>
          </div>

          {/* CARD 4: CLINICAL EVALUATION HISTORY */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">history</span>
              Historial de Evaluaciones
            </h3>

            {meta.evaluations && meta.evaluations.length > 0 ? (
              <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1 custom-scrollbar pl-2 border-l border-outline-variant relative">
                {meta.evaluations.map((ev, idx) => (
                  <div key={idx} className="relative pb-1">
                    {/* Circle marker */}
                    <div className="absolute -left-[14px] top-0 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-surface"></div>
                    <div className="bg-surface border border-outline-variant p-3 rounded-xl flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <h4 className="font-bold text-on-surface">{ev.title}</h4>
                        <span className="text-on-surface-variant font-medium">{ev.date}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed">{ev.details}</p>
                      <div className="flex justify-between items-center text-[9px] mt-1 font-bold">
                        <span className="text-on-surface-variant">{ev.doctor}</span>
                        <span className="bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">{ev.tag}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant italic py-8 text-center">No registra evaluaciones clínicas previas.</p>
            )}
          </div>

        </div>
      ) : (
        <div className="border border-dashed border-outline-variant p-16 rounded-2xl text-center text-on-surface-variant max-w-xl mx-auto flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-primary">clinical_notes</span>
          <div>
            <h4 className="text-md font-bold text-on-surface">Módulo de Triaje Médico</h4>
            <p className="text-xs text-on-surface-variant mt-1">Busca a un residente por su cédula o nombre para ver su expediente de salud o registrar tratamientos.</p>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD CLINICAL EVALUATION */}
      {showEvalModal && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-md font-bold text-primary">Añadir Evaluación Clínica</h3>
              <button onClick={() => setShowEvalModal(false)} className="text-on-surface-variant hover:bg-surface-container rounded-full p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleAddEvaluation} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Título de la Evaluación</label>
                <input 
                  type="text" 
                  value={evalTitle} 
                  onChange={e => setEvalTitle(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Detalle del Diagnóstico / Signos Vitales</label>
                <textarea 
                  value={evalDetails} 
                  onChange={e => setEvalDetails(e.target.value)} 
                  placeholder="ej. Presión 120/80. Pulso 72 lpm. Paciente reporta leve mareo."
                  rows="3" 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Médico que Evalúa</label>
                <input 
                  type="text" 
                  value={evalDoctor} 
                  onChange={e => setEvalDoctor(e.target.value)} 
                  placeholder="Ej. Dra. M. Silva" 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Estado de la Evaluación</label>
                <select 
                  value={evalTag} 
                  onChange={e => setEvalTag(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none"
                >
                  <option value="Signos Estables">Signos Estables</option>
                  <option value="Observación Continua">Observación Continua</option>
                  <option value="Derivación de Emergencia">Derivación de Emergencia</option>
                </select>
              </div>

              <button type="submit" className="mt-2 w-full py-3 bg-primary text-on-primary font-bold rounded-lg cursor-pointer">
                Guardar Evaluación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD MEDICATION */}
      {showMedModal && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-md font-bold text-primary">Registrar Medicamento</h3>
              <button onClick={() => setShowMedModal(false)} className="text-on-surface-variant hover:bg-surface-container rounded-full p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleAddMedication} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Nombre del Medicamento</label>
                <input 
                  type="text" 
                  value={medName} 
                  onChange={e => setMedName(e.target.value)} 
                  placeholder="ej. Losartán Potásico" 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Dosis y Frecuencia</label>
                <input 
                  type="text" 
                  value={medDose} 
                  onChange={e => setMedDose(e.target.value)} 
                  placeholder="ej. 50mg - 1 tableta cada 12 horas" 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Fecha de Inicio</label>
                <input 
                  type="text" 
                  value={medDate} 
                  onChange={e => setMedDate(e.target.value)} 
                  placeholder="Ej. 12/Oct/2023 o hoy" 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Fecha de Finalización</label>
                <input 
                  type="text" 
                  value={medEndDate} 
                  onChange={e => setMedEndDate(e.target.value)} 
                  placeholder="Ej. 19/Oct/2023 o 7 días" 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                />
              </div>

              <button type="submit" className="mt-2 w-full py-3 bg-primary text-on-primary font-bold rounded-lg cursor-pointer">
                Registrar Tratamiento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT VITALS & ALERTS */}
      {showVitalsModal && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-md font-bold text-primary">Editar Ficha Sanitaria</h3>
              <button onClick={() => setShowVitalsModal(false)} className="text-on-surface-variant hover:bg-surface-container rounded-full p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveVitals} className="flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Grupo Sangre</label>
                  <select 
                    value={bloodType} 
                    onChange={e => setBloodType(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none"
                  >
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Peso (kg)</label>
                  <input 
                    type="text" 
                    value={weight} 
                    onChange={e => setWeight(e.target.value)} 
                    placeholder="78 kg"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Altura (m)</label>
                  <input 
                    type="text" 
                    value={height} 
                    onChange={e => setHeight(e.target.value)} 
                    placeholder="1.72 m"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Alergias (Separadas por comas)</label>
                <input 
                  type="text" 
                  value={allergiesInput} 
                  onChange={e => showAllergiesInput(e.target.value)} 
                  placeholder="Ej. Penicilina, Ibuprofeno" 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Patologías Crónicas / Antecedentes</label>
                <input 
                  type="text" 
                  value={chronicInput} 
                  onChange={e => showChronicInput(e.target.value)} 
                  placeholder="Ej. Hipertensión, Diabetes, Asma" 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 focus:outline-none" 
                />
              </div>

              <button type="submit" className="mt-2 w-full py-3 bg-primary text-on-primary font-bold rounded-lg cursor-pointer">
                Guardar Ficha Sanitaria
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
