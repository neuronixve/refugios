import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const VENEZUELA_STATES = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 
  'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 
  'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 
  'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'
];

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
    };
  });
};

export default function Residents({ token }) {
  const { refugioId } = useParams();
  
  // Resident data states
  const [residents, setResidents] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Modal states
  const [selectedResident, setSelectedResident] = useState(null);
  const isMinor = selectedResident?.birth_date && (new Date().getFullYear() - new Date(selectedResident.birth_date).getFullYear()) < 18;
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Edit Form States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [docId, setDocId] = useState('');
  const [gender, setGender] = useState('Masculino');
  const [birthDate, setBirthDate] = useState('');
  const [healthStatus, setHealthStatus] = useState('Estable');
  const [status, setStatus] = useState('Activo');
  
  // Photo
  const [photo, setPhoto] = useState('');

  // Edit Metadata states
  const [estado, setEstado] = useState('Distrito Capital');
  const [municipio, setMunicipio] = useState('');
  const [barrioSector, setBarrioSector] = useState('');
  const [hasFamilyCaracas, setHasFamilyCaracas] = useState('No');
  const [familyCaracasDetails, setFamilyCaracasDetails] = useState('');
  const [authorizedVisitors, setAuthorizedVisitors] = useState('');

  // Schooling for minor residents
  const [escolarizado, setEscolarizado] = useState('No');
  const [centroEducativo, setCentroEducativo] = useState('');
  const [gradoCursado, setGradoCursado] = useState('');

  // Incidents history for selected resident
  const [incidents, setIncidents] = useState([]);
  
  // Job
  const [hasJob, setHasJob] = useState('No');
  const [jobCompany, setJobCompany] = useState('');
  const [jobSchedule, setJobSchedule] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [oficioProfesion, setOficioProfesion] = useState('');

  // DEMOGRAPHICS & CONTACTS
  const [contactPhone, setContactPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [minorChildrenUnderCharge, setMinorChildrenUnderCharge] = useState('');
  const [nutritionalRequirement, setNutritionalRequirement] = useState('Ninguno');
  
  // Vulnerabilities
  const [disabilityType, setDisabilityType] = useState('Ninguna');
  const [lostDocumentation, setLostDocumentation] = useState(false);

  // Housing status
  const [housingCondition, setHousingCondition] = useState('Daño leve / En evaluación');
  const [housingTenure, setHousingTenure] = useState('Propietario');

  // Head of Family logistics
  const [totalPeopleUnderCharge, setTotalPeopleUnderCharge] = useState(0);
  const [requiresDiapersFormula, setRequiresDiapersFormula] = useState('No');
  const [hasPets, setHasPets] = useState('No');
  const [petSpecies, setPetSpecies] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petName, setPetName] = useState('');
  
  // Health & Diet edit states
  const [diabetes, setDiabetes] = useState(false);
  const [hypertension, setHypertension] = useState(false);
  const [asthma, setAsthma] = useState(false);
  const [epoc, setEpoc] = useState(false);
  const [cardiovascular, setCardiovascular] = useState(false);
  const [renal, setRenal] = useState(false);
  const [tuberculosis, setTuberculosis] = useState(false);
  const [escabiosis, setEscabiosis] = useState(false);
  const [gastrointestinal, setGastrointestinal] = useState(false);
  const [epilepsia, setEpilepsia] = useState(false);
  const [psiquiatrico, setPsiquiatrico] = useState(false);
  const [inmunocomprometido, setInmunocomprometido] = useState(false);
  const [endemica, setEndemica] = useState(false);
  const [otrasPatologias, setOtrasPatologias] = useState(false);
  const [especificarOtras, setEspecificarOtras] = useState('');

  const [treatments, setTreatments] = useState('');
  const [diet, setDiet] = useState('Ninguna / General');
  const [allergies, setAllergies] = useState('');
  
  const [assignedBedId, setAssignedBedId] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchResidentsAndBeds();
  }, [refugioId]);

  const fetchResidentsAndBeds = async () => {
    setLoading(true);
    try {
      const bedsRes = await fetch(`${API_BASE}/refugios/${refugioId}/beds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let activeBeds = [];
      if (bedsRes.ok) {
        const bedsData = await bedsRes.json();
        setBeds(bedsData);
        activeBeds = bedsData;
      }

      const res = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        const mappedResidents = data.map(r => {
          const bedAssigned = activeBeds.find(b => b.resident_id === r.id);
          return {
            ...r,
            bedInfo: bedAssigned ? `${bedAssigned.room_number} - ${bedAssigned.bed_number}` : 'Sin Cama',
            bedId: bedAssigned ? bedAssigned.id : null
          };
        });
        setResidents(mappedResidents);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await compressImage(file);
      setPhoto(base64);
    }
  };

  const filteredResidents = residents.filter(res => {
    if (res.status !== 'Activo') return false;
    const fullName = `${res.first_name} ${res.last_name}`.toLowerCase();
    const doc = (res.document_id || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || doc.includes(query);
  });

  const totalItems = filteredResidents.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentResidents = filteredResidents.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleOpenView = (resident) => {
    setSelectedResident(resident);
    setViewModalOpen(true);
  };

  const handleOpenEdit = (resident) => {
    setSelectedResident(resident);
    setFirstName(resident.first_name);
    setLastName(resident.last_name);
    setDocId(resident.document_id || '');
    setGender(resident.gender || 'Masculino');
    setBirthDate(resident.birth_date ? resident.birth_date.split('T')[0] : '');
    setHealthStatus(resident.health_status || 'Estable');
    setStatus(resident.status || 'Activo');

    let metadata = {};
    try {
      metadata = resident.special_needs ? JSON.parse(resident.special_needs) : {};
    } catch {
      metadata = {};
    }

    setPhoto(metadata.photo || '');
    setEstado(metadata.procedencia_estado || 'Distrito Capital');
    setMunicipio(metadata.municipio || '');
    setBarrioSector(metadata.barrioSector || '');
    setHasFamilyCaracas(metadata.tiene_familiares_caracas || 'No');
    setFamilyCaracasDetails(metadata.detalles_familiares_caracas || '');
    setAuthorizedVisitors(metadata.visitas_autorizadas || '');
    setEscolarizado(metadata.escolarizado || 'No');
    setCentroEducativo(metadata.centro_educativo || '');
    setGradoCursado(metadata.grado_cursado || '');

    // Fetch resident incidents history
    setIncidents([]);
    fetch(`${API_BASE}/residents/${resident.id}/incidents`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setIncidents(data))
      .catch(err => console.error("Error fetching resident incidents:", err));

    setHasJob(metadata.empleo?.tiene_empleo || 'No');
    setJobCompany(metadata.empleo?.empresa || '');
    setJobSchedule(metadata.empleo?.horario || '');
    setJobAddress(metadata.empleo?.direccion || '');
    setOficioProfesion(metadata.empleo?.oficio_profesion || '');
    setTreatments(metadata.treatments || '');
    setDiet(metadata.diet || 'Ninguna / General');
    
    // Set demographics
    setContactPhone(metadata.telefono_contacto || '');
    setEmergencyContact(metadata.contacto_emergencia || '');
    setMinorChildrenUnderCharge(metadata.menores_a_cargo || '');
    setNutritionalRequirement(metadata.nutricion_especial || 'Ninguno');
    
    // Set vulnerabilities
    setDisabilityType(metadata.discapacidad || 'Ninguna');
    setLostDocumentation(metadata.documento_perdido || false);

    // Set housing
    setHousingCondition(metadata.estado_vivienda || 'Daño leve / En evaluación');
    setHousingTenure(metadata.tenencia_vivienda || 'Propietario');

    // Set head assistance
    setTotalPeopleUnderCharge(metadata.personas_a_cargo || 0);
    setRequiresDiapersFormula(metadata.requiere_pañales_formula || 'No');
    setHasPets(metadata.mascotas?.tiene_mascotas || 'No');
    setPetSpecies(metadata.mascotas?.especie || '');
    setPetBreed(metadata.mascotas?.raza || '');
    setPetName(metadata.mascotas?.nombre || '');

    // Set pre-existing conditions checkboxes
    const preexisting = metadata.preexisting || [];
    setDiabetes(preexisting.includes('Diabetes'));
    setHypertension(preexisting.includes('Hipertensión'));
    setAsthma(preexisting.includes('Asma'));
    setEpoc(preexisting.includes('EPOC'));
    setCardiovascular(preexisting.includes('Cardiovascular'));
    setRenal(preexisting.includes('Renal (Diálisis)'));
    setTuberculosis(preexisting.includes('Tuberculosis'));
    setEscabiosis(preexisting.includes('Escabiosis/Pediculosis'));
    setGastrointestinal(preexisting.includes('Gastrointestinal Recurrente'));
    setEpilepsia(preexisting.includes('Epilepsia'));
    setPsiquiatrico(preexisting.includes('Psiquiátrico'));
    setInmunocomprometido(preexisting.includes('Inmunodeficiencia (VIH/Onco)'));
    setEndemica(preexisting.includes('Dengue/Paludismo'));
    
    const hasOtras = preexisting.some(p => p.startsWith('Otros:'));
    setOtrasPatologias(hasOtras);
    if (hasOtras) {
      const foundStr = preexisting.find(p => p.startsWith('Otros:'));
      setEspecificarOtras(foundStr ? foundStr.replace('Otros: ', '') : '');
    } else {
      setEspecificarOtras('');
    }

    setAllergies(metadata.allergies ? metadata.allergies.join(', ') : '');

    setAssignedBedId(resident.bedId || '');
    setError('');
    setEditModalOpen(true);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    let currentMetadata = {};
    try {
      currentMetadata = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
    } catch {
      currentMetadata = {};
    }

    const preexisting = [];
    if (diabetes) preexisting.push('Diabetes');
    if (hypertension) preexisting.push('Hipertensión');
    if (asthma) preexisting.push('Asma');
    if (epoc) preexisting.push('EPOC');
    if (cardiovascular) preexisting.push('Cardiovascular');
    if (renal) preexisting.push('Renal (Diálisis)');
    if (tuberculosis) preexisting.push('Tuberculosis');
    if (escabiosis) preexisting.push('Escabiosis/Pediculosis');
    if (gastrointestinal) preexisting.push('Gastrointestinal Recurrente');
    if (epilepsia) preexisting.push('Epilepsia');
    if (psiquiatrico) preexisting.push('Psiquiátrico');
    if (inmunocomprometido) preexisting.push('Inmunodeficiencia (VIH/Onco)');
    if (endemica) preexisting.push('Dengue/Paludismo');
    if (otrasPatologias && especificarOtras) preexisting.push(`Otros: ${especificarOtras}`);

    const isMinor = selectedResident.birth_date && (new Date().getFullYear() - new Date(selectedResident.birth_date).getFullYear()) < 18;

    const updatedMetadata = {
      ...currentMetadata,
      photo,
      procedencia_estado: estado,
      municipio,
      barrioSector,
      tiene_familiares_caracas: hasFamilyCaracas,
      detalles_familiares_caracas: familyCaracasDetails,
      visitas_autorizadas: authorizedVisitors,
      escolarizado: isMinor ? escolarizado : undefined,
      centro_educativo: isMinor ? centroEducativo : undefined,
      grado_cursado: isMinor ? gradoCursado : undefined,
      empleo: {
        tiene_empleo: hasJob,
        empresa: jobCompany,
        horario: jobSchedule,
        direccion: jobAddress,
        oficio_profesion: oficioProfesion
      },
      telefono_contacto: contactPhone,
      contacto_emergencia: emergencyContact,
      menores_a_cargo: minorChildrenUnderCharge,
      nutricion_especial: nutritionalRequirement,
      discapacidad: disabilityType,
      documento_perdido: lostDocumentation,
      estado_vivienda: housingCondition,
      tenencia_vivienda: housingTenure,
      personas_a_cargo: parseInt(totalPeopleUnderCharge) || 0,
      requiere_pañales_formula: requiresDiapersFormula,
      mascotas: {
        tiene_mascotas: hasPets,
        especie: petSpecies,
        raza: petBreed,
        nombre: petName
      },
      preexisting,
      treatments,
      diet,
      allergies: allergies ? allergies.split(',').map(a => a.trim().toUpperCase()).filter(Boolean) : []
    };

    try {
      const res = await fetch(`${API_BASE}/damnificados/${selectedResident.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          document_id: docId || null,
          birth_date: birthDate || null,
          gender,
          health_status: preexisting.length > 0 ? 'Bajo Observación' : healthStatus,
          status,
          special_needs: JSON.stringify(updatedMetadata),
          refugio_id: parseInt(refugioId),
          family_group_id: selectedResident.family_group_id
        })
      });

      if (res.ok) {
        // Handle bed assignment logic if it changed
        if (assignedBedId !== (selectedResident.bedId || '')) {
          if (assignedBedId === '') {
            // Free the bed
            if (selectedResident.bedId) {
              await fetch(`${API_BASE}/beds/${selectedResident.bedId}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ resident_id: null })
              });
            }
          } else {
            // Assign the new bed
            await fetch(`${API_BASE}/beds/${assignedBedId}/assign`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ resident_id: selectedResident.id })
            });
          }
        }

        setMessage('Perfil de residente actualizado exitosamente.');
        setEditModalOpen(false);
        fetchResidentsAndBeds();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al actualizar el perfil.');
      }
    } catch (err) {
      setError('Error al conectar con la API.');
    }
  };

  const handleRetireResident = async (resident) => {
    const confirmMessage = `¿Estás seguro de egresar (eliminar) a ${resident.first_name} ${resident.last_name} del campamento temporal? Esta acción liberará la cama y cambiará su estado a 'Retirado'.`;
    if (!window.confirm(confirmMessage)) return;

    setError('');
    setMessage('');
    try {
      if (resident.bedId) {
        const bedRes = await fetch(`${API_BASE}/beds/${resident.bedId}/assign`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ resident_id: null })
        });
        if (!bedRes.ok) {
          setError('Error al liberar la cama del residente.');
          return;
        }
      }

      const res = await fetch(`${API_BASE}/damnificados/${resident.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: resident.first_name,
          last_name: resident.last_name,
          document_id: resident.document_id,
          birth_date: resident.birth_date,
          gender: resident.gender,
          health_status: resident.health_status,
          status: 'Retirado',
          special_needs: resident.special_needs,
          refugio_id: parseInt(refugioId),
          family_group_id: resident.family_group_id
        })
      });

      if (res.ok) {
        setMessage('Residente eliminado (egresado) del campamento temporal exitosamente.');
        fetchResidentsAndBeds();
      } else {
        setError('Error al actualizar el estado del residente.');
      }
    } catch (err) {
      setError('Error al procesar el egreso.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Title */}
      <header className="mb-8">
        <h2 className="text-2xl font-extrabold text-primary">Residentes Registrados</h2>
        <p className="text-xs text-on-surface-variant">Gestione los perfiles de los ciudadanos albergados en esta sede.</p>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-error-container/20 border border-error/25 text-error rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-6 p-4 bg-success/10 border border-success/20 text-success rounded-xl text-xs font-semibold">
          {message}
        </div>
      )}

      {/* Table controls */}
      <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96 flex items-center">
          <span className="material-symbols-outlined text-on-surface-variant absolute left-3">search</span>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por nombre o número de cédula..."
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-on-surface-variant font-semibold">Mostrar:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
          >
            <option value="10">10 por página</option>
            <option value="15">15 por página</option>
            <option value="25">25 por página</option>
            <option value="50">50 por página</option>
          </select>
        </div>
      </div>

      {/* Residents Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="text-center py-16 text-xs font-semibold text-on-surface-variant">Cargando residentes...</div>
        ) : currentResidents.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                <th className="p-4">Nombre Completo</th>
                <th className="p-4">Cédula</th>
                <th className="p-4">Cama / Espacio</th>
                <th className="p-4">Salud</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-xs">
              {currentResidents.map(res => {
                const isRetirado = res.status === 'Retirado';
                const healthColor = res.health_status === 'Estable' ? 'bg-success/15 text-success' : (res.health_status === 'Bajo Observación' ? 'bg-warning/15 text-warning-variant text-orange-600' : 'bg-error/15 text-error');

                return (
                  <tr key={res.id} className="hover:bg-surface-container/10 transition-colors">
                    <td className="p-4 font-bold text-on-surface flex items-center gap-3">
                      {(() => {
                        let meta = {};
                        try {
                          meta = res.special_needs ? JSON.parse(res.special_needs) : {};
                        } catch {
                          meta = {};
                        }
                        return (
                          <div className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container overflow-hidden flex items-center justify-center">
                            {meta.photo ? (
                              <img src={meta.photo} alt="Thumb" className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-sm text-on-surface-variant">person</span>
                            )}
                          </div>
                        );
                      })()}
                      {res.first_name} {res.last_name}
                    </td>
                    <td className="p-4 text-on-surface-variant font-medium">
                      {res.document_id || 'N/T'}
                    </td>
                    <td className="p-4 font-semibold text-primary">
                      {res.bedInfo}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${healthColor}`}>
                        {res.health_status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${isRetirado ? 'bg-outline-variant/30 text-on-surface-variant' : 'bg-primary/10 text-primary'}`}>
                        {res.status}
                      </span>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenView(res)}
                        className="px-3 py-1.5 border border-outline text-primary font-bold rounded-lg text-[10px] hover:bg-surface-container cursor-pointer"
                      >
                        Ver Ficha
                      </button>
                      {!isRetirado && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(res)}
                            className="px-3 py-1.5 bg-primary/10 text-primary font-bold rounded-lg text-[10px] hover:bg-primary/20 cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleRetireResident(res)}
                            className="px-3 py-1.5 bg-error-container text-error font-bold rounded-lg text-[10px] hover:opacity-90 cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16 text-xs text-on-surface-variant font-medium">
            No se encontraron residentes registrados.
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6 text-xs font-semibold text-on-surface-variant">
          <span>Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, totalItems)} de {totalItems} registrados</span>
          
          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-outline rounded-lg disabled:opacity-40 cursor-pointer"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => handlePageChange(num)}
                className={`px-3 py-1.5 border rounded-lg cursor-pointer ${currentPage === num ? 'bg-primary text-on-primary border-primary' : 'border-outline hover:bg-surface-container'}`}
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-outline rounded-lg disabled:opacity-40 cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: VER FICHA COMPLETA */}
      {viewModalOpen && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-2xl shadow-lg max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-start mb-6 border-b border-outline-variant pb-3">
              <div className="flex items-center gap-3">
                {(() => {
                  let meta = {};
                  try {
                    meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                  } catch {
                    meta = {};
                  }
                  return (
                    <div className="w-12 h-12 rounded-full border border-outline-variant bg-surface-container overflow-hidden flex items-center justify-center">
                      {meta.photo ? (
                        <img src={meta.photo} alt="Ficha Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-xl text-on-surface-variant">person</span>
                      )}
                    </div>
                  );
                })()}
                <div>
                  <h3 className="text-md font-bold text-primary">{selectedResident.first_name} {selectedResident.last_name}</h3>
                  <p className="text-[10px] text-on-surface-variant">
                    C.I. {selectedResident.document_id || 'N/T'} | Cama: {selectedResident.bedInfo}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewModalOpen(false)} className="text-on-surface-variant hover:bg-surface-container rounded-full p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-6 text-xs text-on-surface">
              
              {/* Personal & Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container/20 p-4 rounded-xl border border-outline-variant">
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-bold mb-1">Contacto y Datos Personales</span>
                  {(() => {
                    let meta = {};
                    try {
                      meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                    } catch {
                      meta = {};
                    }
                    return (
                      <div className="flex flex-col gap-1">
                        <p><strong>Teléfono:</strong> {meta.telefono_contacto || 'N/T'}</p>
                        <p><strong>Contacto Emergencia:</strong> {meta.contacto_emergencia || 'N/T'}</p>
                        <p><strong>Nutrición Especial:</strong> {meta.nutricion_especial || 'Ninguno'}</p>
                        <p><strong>Menores a cargo:</strong> {meta.menores_a_cargo || 'Ninguno'}</p>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-bold mb-1">Identificación y Género</span>
                  <p><strong>Género:</strong> {selectedResident.gender}</p>
                  <p><strong>F. Nacimiento:</strong> {selectedResident.birth_date ? selectedResident.birth_date.split('T')[0] : 'N/T'}</p>
                  {(() => {
                    let meta = {};
                    try {
                      meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                    } catch {
                      meta = {};
                    }
                    return (
                      <>
                        <p><strong>Discapacidad:</strong> {meta.discapacidad || 'Ninguna'}</p>
                        <p className={`font-bold ${meta.documento_perdido ? 'text-error' : 'text-success'}`}>
                          {meta.documento_perdido ? '⚠ Cédula Perdida/No tiene físico' : '✓ Posee cédula física'}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Procedencia & Vivienda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container/20 p-4 rounded-xl border border-outline-variant">
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-bold mb-1">Procedencia</span>
                  {(() => {
                    let meta = {};
                    try {
                      meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                    } catch {
                      meta = {};
                    }
                    return (
                      <p className="font-semibold">
                        {meta.procedencia_estado || 'N/T'}, Mun. {meta.municipio || 'N/T'}, Sector {meta.barrioSector || 'N/T'}
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-bold mb-1">Vivienda Anterior</span>
                  {(() => {
                    let meta = {};
                    try {
                      meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                    } catch {
                      meta = {};
                    }
                    return (
                      <div className="flex flex-col gap-0.5">
                        <p><strong>Condición:</strong> {meta.estado_vivienda || 'Daño leve'}</p>
                        <p><strong>Tenencia:</strong> {meta.tenencia_vivienda || 'Propietario'}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Job Details */}
              <div className="bg-surface-container/20 p-4 rounded-xl border border-outline-variant">
                <span className="text-[10px] text-on-surface-variant block uppercase font-bold mb-2">Situación Laboral</span>
                {(() => {
                  let meta = {};
                  try {
                    meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                  } catch {
                    meta = {};
                  }
                  const tieneEmp = meta.empleo?.tiene_empleo === 'Sí';
                  const oficioStr = meta.empleo?.oficio_profesion || 'No especificado';
                  return (
                    <div className="flex flex-col gap-2">
                      <p><strong>Oficio / Profesión:</strong> <span className="font-bold text-primary">{oficioStr}</span></p>
                      {tieneEmp ? (
                        <div className="grid grid-cols-2 gap-2 border-t border-outline-variant/35 pt-2 mt-1">
                          <p><strong>Empresa:</strong> {meta.empleo.empresa}</p>
                          <p><strong>Horario:</strong> {meta.empleo.horario}</p>
                          <p className="col-span-2"><strong>Dirección Trabajo:</strong> {meta.empleo.direccion}</p>
                        </div>
                      ) : (
                        <p className="italic text-on-surface-variant">Desempleado / Sin empleo activo.</p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Health & Medical details */}
              <div className="grid grid-cols-2 gap-4 bg-surface-container/20 p-4 rounded-xl border border-outline-variant">
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-bold mb-1">Salud y Medicamentos</span>
                  <p><strong>Estado:</strong> {selectedResident.health_status}</p>
                  {(() => {
                    let meta = {};
                    try {
                      meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                    } catch {
                      meta = {};
                    }
                    return (
                      <>
                        <p className="mt-1"><strong>Historial Clínico:</strong> {meta.preexisting?.join(', ') || 'Ninguna'}</p>
                        <p className="mt-1"><strong>Tratamientos:</strong> {meta.treatments || 'Ninguno'}</p>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-bold mb-1">Alimentación</span>
                  {(() => {
                    let meta = {};
                    try {
                      meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                    } catch {
                      meta = {};
                    }
                    return (
                      <>
                        <p><strong>Dieta:</strong> {meta.diet || 'General / Ninguna'}</p>
                        <p className="mt-1"><strong>Alergias:</strong> {meta.allergies?.join(', ') || 'Ninguna'}</p>
                        {meta.parentesco && <p className="mt-1 text-primary"><strong>Relación:</strong> {meta.parentesco}</p>}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Head Exclusive Assistance */}
              {(() => {
                let meta = {};
                try {
                  meta = selectedResident.special_needs ? JSON.parse(selectedResident.special_needs) : {};
                } catch {
                  meta = {};
                }
                if (meta.personas_a_cargo > 0 || meta.requiere_pañales_formula === 'Sí' || meta.mascotas?.tiene_mascotas === 'Sí') {
                  return (
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                      <span className="text-[10px] text-primary block uppercase font-bold mb-2">Asistencia Familiar (Jefe de Familia)</span>
                      <div className="grid grid-cols-2 gap-3">
                        <p><strong>Personas a cargo:</strong> {meta.personas_a_cargo || 0}</p>
                        <p><strong>Requiere pañales o fórmulas:</strong> {meta.requiere_pañales_formula || 'No'}</p>
                        {meta.mascotas?.tiene_mascotas === 'Sí' && (
                          <div className="col-span-2 border-t border-primary/10 pt-2 mt-1">
                            <p className="font-semibold text-primary">Mascota del Núcleo:</p>
                            <p className="mt-0.5">Nombre: {meta.mascotas.nombre} | Especie: {meta.mascotas.especie} | Raza: {meta.mascotas.raza}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR PERFIL */}
      {editModalOpen && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-2xl shadow-lg max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center mb-6 border-b border-outline-variant pb-3">
              <h3 className="text-md font-bold text-primary">Editar Perfil de Residente</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-on-surface-variant hover:bg-surface-container rounded-full p-2">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5 text-xs">
              
              {/* Photo upload header in Edit Form */}
              <div className="flex items-center gap-4 bg-surface p-4 rounded-xl border border-outline-variant">
                <div className="w-16 h-16 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center overflow-hidden">
                  {photo ? (
                    <img src={photo} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-on-surface">Foto de Perfil</span>
                  <label className="px-3 py-1.5 bg-primary text-on-primary text-[10px] font-bold rounded-lg cursor-pointer hover:opacity-90 inline-block text-center w-max">
                    Subir o Capturar Nueva Foto 📷
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handlePhotoUpload}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Personal info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Nombre *</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Apellido *</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Cédula</label>
                  <input type="text" value={docId} onChange={e => setDocId(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Género</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none">
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Fecha de Nacimiento</label>
                  <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Estado de Salud</label>
                  <select value={healthStatus} onChange={e => setHealthStatus(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none">
                    <option value="Estable">Estable</option>
                    <option value="Bajo Observación">Bajo Observación</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>
              </div>

              {/* Contacts & Demographics */}
              <div className="border-t border-outline-variant pt-4">
                <span className="text-[10px] font-bold text-primary block uppercase mb-3">Contacto y Demografía</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Teléfono</label>
                    <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Contacto Emergencia</label>
                    <input type="text" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Menores a Cargo</label>
                    <input type="text" value={minorChildrenUnderCharge} onChange={e => setMinorChildrenUnderCharge(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Nutrición Especial</label>
                    <select value={nutritionalRequirement} onChange={e => setNutritionalRequirement(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none">
                      <option value="Ninguno">Ninguno</option>
                      <option value="Madre lactante">Madre lactante</option>
                      <option value="Embarazada">Embarazada</option>
                      <option value="Lactante (0-12 meses)">Lactante (0-12 meses)</option>
                      <option value="Adulto mayor con dieta blanda">Adulto mayor con dieta blanda</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Información Escolar para Menores */}
              {isMinor && (
                <div className="border-t border-outline-variant pt-4">
                  <span className="text-[10px] font-bold text-primary block uppercase mb-3">Información Escolar (Menor de Edad)</span>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-on-surface-variant block mb-1">¿Está escolarizado?</label>
                      <select value={escolarizado} onChange={e => setEscolarizado(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none font-bold">
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                      </select>
                    </div>
                    {escolarizado === 'Sí' && (
                      <>
                        <div>
                          <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Centro Educativo</label>
                          <input type="text" value={centroEducativo} onChange={e => setCentroEducativo(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Grado Cursado</label>
                          <input type="text" value={gradoCursado} onChange={e => setGradoCursado(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Vulnerabilities */}
              <div className="border-t border-outline-variant pt-4">
                <span className="text-[10px] font-bold text-primary block uppercase mb-3">Vulnerabilidades y Protección</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Discapacidad / Movilidad</label>
                    <select value={disabilityType} onChange={e => setDisabilityType(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none">
                      <option value="Ninguna">Ninguna</option>
                      <option value="Motora">Motora</option>
                      <option value="Visual">Visual</option>
                      <option value="Auditiva">Auditiva</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer mt-4">
                      <input type="checkbox" checked={lostDocumentation} onChange={e => setLostDocumentation(e.target.checked)} className="accent-primary" />
                      Documentación Perdida (No posee cédula física)
                    </label>
                  </div>
                </div>
              </div>

              {/* Procedencia & Vivienda */}
              <div className="border-t border-outline-variant pt-4">
                <span className="text-[10px] font-bold text-primary block uppercase mb-3">Procedencia y Vivienda Anterior</span>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Estado</label>
                    <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none">
                      {VENEZUELA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Municipio</label>
                    <input type="text" value={municipio} onChange={e => setMunicipio(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Barrio / Sector</label>
                    <input type="text" value={barrioSector} onChange={e => setBarrioSector(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Condición Vivienda</label>
                    <select value={housingCondition} onChange={e => setHousingCondition(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none">
                      <option value="Daño leve / En evaluación">Daño leve / En evaluación</option>
                      <option value="Daño estructural grave (Inhabitable)">Daño estructural grave (Inhabitable)</option>
                      <option value="Colapso total / Destruida">Colapso total / Destruida</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Tenencia Vivienda</label>
                    <select value={housingTenure} onChange={e => setHousingTenure(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none">
                      <option value="Propietario">Propietario</option>
                      <option value="Inquilino">Inquilino</option>
                      <option value="Vivo en casa de familiares">Vivo en casa de familiares</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Vínculos de Apoyo y Visitas */}
              <div className="border-t border-outline-variant pt-4">
                <span className="text-[10px] font-bold text-primary block uppercase mb-3">Vínculos de Apoyo y Visitas</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">¿Tiene familiares en Caracas?</label>
                    <select value={hasFamilyCaracas} onChange={e => setHasFamilyCaracas(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none font-bold">
                      <option value="No">No</option>
                      <option value="Sí">Sí</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Familiares autorizados para visitas</label>
                    <input type="text" value={authorizedVisitors} onChange={e => setAuthorizedVisitors(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                  </div>
                  {hasFamilyCaracas === 'Sí' && (
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Detalle de los Familiares en Caracas (Nombres, Ubicación, Teléfono)</label>
                      <textarea 
                        value={familyCaracasDetails} 
                        onChange={e => setFamilyCaracasDetails(e.target.value)} 
                        placeholder="Ej. Primo: Juan Gómez, habita en Catia, Telf: 0416-1234567"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none h-16 resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Empleo */}
              <div className="border-t border-outline-variant pt-4">
                <span className="text-[10px] font-bold text-primary block uppercase mb-3">Situación Laboral</span>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">¿Tiene empleo?</label>
                    <select value={hasJob} onChange={e => setHasJob(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none">
                      <option value="No">No</option>
                      <option value="Sí">Sí</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Oficio o Profesión</label>
                    <input type="text" value={oficioProfesion} onChange={e => setOficioProfesion(e.target.value)} placeholder="Ej. Albañil, Enfermera..." className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                  </div>
                  {hasJob === 'Sí' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Empresa</label>
                        <input type="text" value={jobCompany} onChange={e => setJobCompany(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Horario</label>
                        <input type="text" value={jobSchedule} onChange={e => setJobSchedule(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                      </div>
                      <div className="col-span-3 mt-1">
                        <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Dirección del Trabajo</label>
                        <input type="text" value={jobAddress} onChange={e => setJobAddress(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Health & Diet Details */}
              <div className="border-t border-outline-variant pt-4">
                <span className="text-[10px] font-bold text-primary block mb-3 uppercase">Historial Clínico de Residente</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] mb-4">
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={diabetes} onChange={e => setDiabetes(e.target.checked)} className="accent-primary" /> Diabetes</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hypertension} onChange={e => setHypertension(e.target.checked)} className="accent-primary" /> Hipertensión</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={asthma} onChange={e => setAsthma(e.target.checked)} className="accent-primary" /> Asma</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={epoc} onChange={e => setEpoc(e.target.checked)} className="accent-primary" /> EPOC</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={cardiovascular} onChange={e => setCardiovascular(e.target.checked)} className="accent-primary" /> Cardiovascular</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={renal} onChange={e => setRenal(e.target.checked)} className="accent-primary" /> Renal (Diálisis)</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={tuberculosis} onChange={e => setTuberculosis(e.target.checked)} className="accent-primary" /> Tuberculosis</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={escabiosis} onChange={e => setEscabiosis(e.target.checked)} className="accent-primary" /> Escabiosis/Piojos</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={gastrointestinal} onChange={e => setGastrointestinal(e.target.checked)} className="accent-primary" /> Gastrointestinal</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={epilepsia} onChange={e => setEpilepsia(e.target.checked)} className="accent-primary" /> Epilepsia</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={psiquiatrico} onChange={e => setPsiquiatrico(e.target.checked)} className="accent-primary" /> Psiquiátrico</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={inmunocomprometido} onChange={e => setInmunocomprometido(e.target.checked)} className="accent-primary" /> Inmunodeficiente</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={endemica} onChange={e => setEndemica(e.target.checked)} className="accent-primary" /> Dengue/Paludismo</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={otrasPatologias} onChange={e => setOtrasPatologias(e.target.checked)} className="accent-primary" /> Otras</label>
                </div>
                {otrasPatologias && (
                  <input type="text" value={especificarOtras} onChange={e => setEspecificarOtras(e.target.value)} placeholder="Especifique otras patologías..." className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none mb-3" />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Tratamiento Clínico / Medicamentos</label>
                    <input type="text" value={treatments} onChange={e => setTreatments(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Dieta Especial / Alergias</label>
                    <div className="flex gap-2">
                      <select value={diet} onChange={e => setDiet(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none">
                        <option value="Ninguna / General">Ninguna / General</option>
                        <option value="Diabética">Diabética</option>
                        <option value="Hiposódica">Hiposódica (Baja en sal)</option>
                        <option value="Sin Gluten">Sin Gluten</option>
                      </select>
                      <input type="text" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Alergias..." className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Head Exclusive Assistance Edit */}
              <div className="border-t border-outline-variant pt-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
                <span className="text-[10px] text-primary block uppercase font-bold mb-3">Asistencia Familiar (Solo Jefe de Familia)</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Personas a cargo en el campamento temporal</label>
                    <input type="number" value={totalPeopleUnderCharge} onChange={e => setTotalPeopleUnderCharge(parseInt(e.target.value) || 0)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Requiere pañales o fórmulas</label>
                    <select value={requiresDiapersFormula} onChange={e => setRequiresDiapersFormula(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none">
                      <option value="No">No</option>
                      <option value="Sí">Sí</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">¿Posee mascotas?</label>
                    <select value={hasPets} onChange={e => setHasPets(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none">
                      <option value="No">No</option>
                      <option value="Sí">Sí</option>
                    </select>
                  </div>

                  {hasPets === 'Sí' && (
                    <div className="col-span-2 grid grid-cols-3 gap-3 border-t border-outline-variant/30 pt-3 mt-1">
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Especie Mascota</label>
                        <input type="text" value={petSpecies} onChange={e => setPetSpecies(e.target.value)} placeholder="Ej. Perro" className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Raza Mascota</label>
                        <input type="text" value={petBreed} onChange={e => setPetBreed(e.target.value)} placeholder="Ej. Poodle" className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Nombre Mascota</label>
                        <input type="text" value={petName} onChange={e => setPetName(e.target.value)} placeholder="Ej. Toby" className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Historial de Incidencias */}
              <div className="border-t border-outline-variant pt-4 bg-error/5 p-4 rounded-xl border border-error/15">
                <span className="text-[10px] text-error block uppercase font-bold mb-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Historial de Incidencias / Denuncias ({incidents.length})
                </span>
                {incidents.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                    {incidents.map(inc => {
                      const dateStr = new Date(inc.logged_at).toLocaleDateString() + ' ' + new Date(inc.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={inc.id} className="bg-surface border border-outline-variant rounded-lg p-3 text-[10px] flex flex-col gap-1.5 shadow-2xs">
                          <div className="flex justify-between items-center">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                              inc.incident_type === 'Emergencia' ? 'bg-error text-on-error' :
                              inc.incident_type === 'Altercado' ? 'bg-warning/20 text-warning' : 'bg-surface-container-high text-on-surface'
                            }`}>
                              {inc.incident_type}
                            </span>
                            <span className="text-on-surface-variant font-semibold">{dateStr}</span>
                          </div>
                          
                          {/* Display role tag if resident was registered as involved */}
                          {(() => {
                            try {
                              const involvedList = JSON.parse(inc.involved_residents || '[]');
                              const selfInvolvement = involvedList.find(inv => parseInt(inv.id) === parseInt(selectedResident?.id));
                              if (selfInvolvement) {
                                return (
                                  <div className="mt-0.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${
                                      selfInvolvement.role === 'Agresor' ? 'bg-error/15 border-error/30 text-error' :
                                      selfInvolvement.role === 'Víctima' ? 'bg-success/15 border-success/30 text-success' :
                                      selfInvolvement.role === 'Denunciante' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-high border-outline-variant text-on-surface'
                                    }`}>
                                      Rol registrado: {selfInvolvement.role}
                                    </span>
                                  </div>
                                );
                              }
                            } catch (e) {
                              return null;
                            }
                            return null;
                          })()}

                          <p className="text-on-surface font-medium mt-1 leading-relaxed">
                            {inc.description}
                          </p>
                          {inc.action_taken && (
                            <p className="text-on-surface-variant italic mt-0.5">
                              <strong>Acción tomada:</strong> {inc.action_taken}
                            </p>
                          )}
                          <span className="text-[8px] text-on-surface-variant block mt-0.5">
                            {inc.refugio_name ? `Sede: ${inc.refugio_name} | ` : ''}Reportado por: {inc.reporter_name || 'Personal de Seguridad'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-on-surface-variant italic text-[10px] text-center py-2 bg-surface rounded-lg border border-outline-variant/30">
                    El residente no posee incidencias o denuncias registradas en su historial.
                  </p>
                )}
              </div>

              {/* Bed Assignment */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 mt-6">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-wider mb-3">Asignación de Cama / Alojamiento</h4>
                <div>
                  <select 
                    value={assignedBedId}
                    onChange={e => setAssignedBedId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                  >
                    <option value="">-- Sin Cama Asignada (Desocupar) --</option>
                    
                    {selectedResident?.bedId && (
                      <option value={selectedResident.bedId} className="font-bold">
                        [Mantener Actual] {selectedResident.bedInfo}
                      </option>
                    )}

                    {beds.filter(b => b.status === 'Disponible' && b.id !== selectedResident?.bedId).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.room_number} - {b.bed_number} (Disponible)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <button type="submit" className="mt-4 w-full py-3 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer shadow-sm hover:opacity-95">
                Guardar Modificaciones
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
