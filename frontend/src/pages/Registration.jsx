import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const VENEZUELA_STATES = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 
  'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 
  'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 
  'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'
];

// Helper function to compress image file to lightweight base64 string
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg
        resolve(dataUrl);
      };
    };
  });
};

export default function Registration({ token }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Personal, 2: Family, 3: Salud & Assignment
  
  // Data lists
  const [families, setFamilies] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // --- STEP 1: PERSONAL, ORIGIN, EMPLOYMENT & DEMOGRAPHICS ---
  const [fullName, setFullName] = useState('');
  const [docId, setDocId] = useState('');
  const [gender, setGender] = useState('Masculino');
  const [birthDate, setBirthDate] = useState('');
  const [calculatedAge, setCalculatedAge] = useState('--');
  
  // Photo state (Head)
  const [photo, setPhoto] = useState('');
  
  // Demographics & Contact
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
  const [totalPeopleUnderCharge, setTotalPeopleUnderCharge] = useState('0');
  const [requiresDiapersFormula, setRequiresDiapersFormula] = useState('No');
  const [hasPets, setHasPets] = useState('No');
  const [petSpecies, setPetSpecies] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petName, setPetName] = useState('');

  // Origin & Visits
  const [procedenciaEstado, setProcedenciaEstado] = useState('Distrito Capital');
  const [municipio, setMunicipio] = useState('');
  const [barrioSector, setBarrioSector] = useState('');
  const [hasFamilyCaracas, setHasFamilyCaracas] = useState('No');
  const [familyCaracasDetails, setFamilyCaracasDetails] = useState('');
  const [authorizedVisitors, setAuthorizedVisitors] = useState('');

  // Schooling for minor head of family
  const [escolarizado, setEscolarizado] = useState('No');
  const [centroEducativo, setCentroEducativo] = useState('');
  const [gradoCursado, setGradoCursado] = useState('');

  // Employment
  const [hasJob, setHasJob] = useState('No');
  const [jobCompany, setJobCompany] = useState('');
  const [jobSchedule, setJobSchedule] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [oficioProfesion, setOficioProfesion] = useState('');

  // --- STEP 2: FAMILY GROUP STATE ---
  const [familyOption, setFamilyOption] = useState('none');
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);

  // --- STEP 3: MEDICAL & DYNAMIC SPACE ASSIGNMENT STATE ---
  // Expanded Chronic Illnesses (Head)
  const [diabetes, setDiabetes] = useState(false);
  const [hypertension, setHypertension] = useState(false);
  const [asthma, setAsthma] = useState(false);
  const [epoc, setEpoc] = useState(false);
  const [cardiovascular, setCardiovascular] = useState(false);
  const [renal, setRenal] = useState(false);

  // Health Outbreak Risk & Infectious
  const [tuberculosis, setTuberculosis] = useState(false);
  const [escabiosis, setEscabiosis] = useState(false);
  const [gastrointestinal, setGastrointestinal] = useState(false);

  // Mental Health & Neurological
  const [epilepsia, setEpilepsia] = useState(false);
  const [psiquiatrico, setPsiquiatrico] = useState(false);

  // Immunodeficiencies & Endemic
  const [inmunocomprometido, setInmunocomprometido] = useState(false);
  const [endemica, setEndemica] = useState(false);

  // Other pathology (Head)
  const [otrasPatologias, setOtrasPatologias] = useState(false);
  const [especificarOtras, setEspecificarOtras] = useState('');

  const [treatments, setTreatments] = useState('');
  const [diet, setDiet] = useState('Ninguna / General');
  const [allergyInput, setAllergyInput] = useState('');
  const [allergies, setAllergies] = useState([]);

  // Multi-bed assignments linked to actual spaces
  const [activeSpace, setActiveSpace] = useState(''); 
  const [assignments, setAssignments] = useState({}); 
  const [activeAssigneeIndex, setActiveAssigneeIndex] = useState('head');
  const [welcomeKit, setWelcomeKit] = useState(false);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchFamilies();
    fetchBeds();
  }, [refugioId]);

  useEffect(() => {
    if (beds.length > 0) {
      const uniqueSpaces = Array.from(new Set(beds.map(b => b.room_number)));
      if (uniqueSpaces.length > 0 && !activeSpace) {
        setActiveSpace(uniqueSpaces[0]);
      }
    }
  }, [beds]);

  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      setCalculatedAge(age >= 0 ? `${age} Años` : '0 Años');
    } else {
      setCalculatedAge('--');
    }
  }, [birthDate]);

  const fetchFamilies = async () => {
    try {
      const res = await fetch(`${API_BASE}/family-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFamilies(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBeds = async () => {
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBeds(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePhotoUpload = async (e, isHead, index = null) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await compressImage(file);
      if (isHead) {
        setPhoto(base64);
      } else {
        handleUpdateMember(index, 'photo', base64);
      }
    }
  };

  const handleAddMemberRow = () => {
    setFamilyMembers([
      ...familyMembers,
      { 
        tempId: Date.now() + Math.random(), 
        name: '', 
        docId: '', 
        birthDate: '', 
        relation: 'Hijo/a',
        gender: 'Femenino',
        healthStatus: 'Estable',
        specialNeeds: '',
        treatments: '',
        diet: 'Ninguna / General',
        allergies: '',
        contactPhone: '',
        emergencyContact: '',
        nutritionalRequirement: 'Ninguno',
        disabilityType: 'Ninguna',
        lostDocumentation: false,
        photo: '',
        escolarizado: 'No',
        centro_educativo: '',
        grado_cursado: '',
        // Accompanying member medical checkboxes
        diabetes: false,
        hypertension: false,
        asthma: false,
        epoc: false,
        cardiovascular: false,
        renal: false,
        tuberculosis: false,
        escabiosis: false,
        gastrointestinal: false,
        epilepsia: false,
        psiquiatrico: false,
        inmunocomprometido: false,
        endemica: false,
        otrasPatologias: false,
        especificarOtras: ''
      }
    ]);
  };

  const handleUpdateMember = (index, field, value) => {
    const updated = [...familyMembers];
    updated[index][field] = value;
    setFamilyMembers(updated);
  };

  const handleRemoveMemberRow = (index) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
    const newAssigns = { ...assignments };
    delete newAssigns[index];
    setAssignments(newAssigns);
    setActiveAssigneeIndex('head');
  };

  const handleAddAllergy = (e) => {
    e.preventDefault();
    if (allergyInput.trim() !== '' && !allergies.includes(allergyInput.trim().toUpperCase())) {
      setAllergies([...allergies, allergyInput.trim().toUpperCase()]);
      setAllergyInput('');
    }
  };

  const handleRemoveAllergy = (name) => {
    setAllergies(allergies.filter(a => a !== name));
  };

  const uniqueSpacesList = Array.from(new Set(beds.map(b => b.room_number))).sort();

  const sortedBeds = [...beds.filter(b => b.room_number === activeSpace)].sort((a, b) => {
    const numA = parseInt(a.bed_number.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.bed_number.replace(/\D/g, '')) || 0;
    return numA - numB;
  });
  const totalBedsInSpace = sortedBeds.length;
  const freeBedsInSpace = sortedBeds.filter(b => b.status === 'Disponible').length;

  const handleNextStep = () => {
    if (step === 1) {
      if (!fullName || !docId) {
        setError('El nombre completo y la cédula son requeridos.');
        return;
      }
      setError('');
      setStep(2);
    } else if (step === 2) {
      if (familyOption === 'new' && familyMembers.length === 0) {
        setError('Por favor, añada al menos un miembro familiar o seleccione residente individual.');
        return;
      }
      setError('');
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSelectBed = (bed) => {
    const updated = { ...assignments };
    const isAssigned = Object.keys(updated).find(key => updated[key]?.bedId === bed.id);
    if (isAssigned && isAssigned !== activeAssigneeIndex.toString()) {
      alert("Esta cama ya fue asignada a otro miembro de la familia en este registro.");
      return;
    }

    updated[activeAssigneeIndex] = { bedId: bed.id, bedNum: `${bed.room_number} - ${bed.bed_number}` };
    setAssignments(updated);
  };

  const handleFinishRegistration = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      let finalFamilyId = null;

      if (familyOption === 'new') {
        const familyNameUnique = `Familia de ${fullName} (C.I. ${docId})`;
        const resFamily = await fetch(`${API_BASE}/family-groups`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            family_name: familyNameUnique,
            block_assignment: activeSpace || 'Espacio General'
          })
        });
        if (resFamily.ok) {
          const familyData = await resFamily.json();
          finalFamilyId = familyData.id;
        } else {
          setError('Error al crear el grupo familiar único.');
          setLoading(false);
          return;
        }
      } else if (familyOption === 'existing') {
        finalFamilyId = parseInt(selectedFamilyId);
      }

      const headPreexisting = [];
      if (diabetes) headPreexisting.push('Diabetes');
      if (hypertension) headPreexisting.push('Hipertensión');
      if (asthma) headPreexisting.push('Asma');
      if (epoc) headPreexisting.push('EPOC');
      if (cardiovascular) headPreexisting.push('Cardiovascular');
      if (renal) headPreexisting.push('Renal (Diálisis)');
      if (tuberculosis) headPreexisting.push('Tuberculosis');
      if (escabiosis) headPreexisting.push('Escabiosis/Pediculosis');
      if (gastrointestinal) headPreexisting.push('Gastrointestinal Recurrente');
      if (epilepsia) headPreexisting.push('Epilepsia');
      if (psiquiatrico) headPreexisting.push('Psiquiátrico');
      if (inmunocomprometido) headPreexisting.push('Inmunodeficiencia (VIH/Onco)');
      if (endemica) headPreexisting.push('Dengue/Paludismo');
      if (otrasPatologias && especificarOtras) headPreexisting.push(`Otros: ${especificarOtras}`);

      const headMedical = {
        photo,
        preexisting: headPreexisting,
        treatments,
        diet,
        allergies,
        procedencia_estado: procedenciaEstado,
        municipio,
        barrioSector,
        tiene_familiares_caracas: hasFamilyCaracas,
        detalles_familiares_caracas: familyCaracasDetails,
        visitas_autorizadas: authorizedVisitors,
        escolarizado: calculatedAge < 18 ? escolarizado : undefined,
        centro_educativo: calculatedAge < 18 ? centroEducativo : undefined,
        grado_cursado: calculatedAge < 18 ? gradoCursado : undefined,
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
        welcome_kit: welcomeKit
      };

      const headNameParts = fullName.trim().split(' ');
      const headFirstName = headNameParts[0];
      const headLastName = headNameParts.slice(1).join(' ') || ' ';

      const resHead = await fetch(`${API_BASE}/damnificados`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          document_id: docId,
          first_name: headFirstName,
          last_name: headLastName,
          birth_date: birthDate || null,
          gender,
          health_status: headPreexisting.length > 0 ? 'Bajo Observación' : 'Estable',
          special_needs: JSON.stringify(headMedical),
          refugio_id: parseInt(refugioId),
          family_group_id: finalFamilyId
        })
      });

      if (!resHead.ok) {
        const errorData = await resHead.json();
        setError(errorData.error || 'Error al registrar al cabeza de familia.');
        setLoading(false);
        return;
      }

      const headData = await resHead.json();

      if (assignments['head']) {
        await fetch(`${API_BASE}/beds/${assignments['head'].bedId}/assign`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ resident_id: headData.id })
        });
      }

      if (familyOption === 'new' && familyMembers.length > 0) {
        for (let i = 0; i < familyMembers.length; i++) {
          const m = familyMembers[i];
          const mNameParts = m.name.trim().split(' ');
          const mFirstName = mNameParts[0] || 'Miembro';
          const mLastName = mNameParts.slice(1).join(' ') || 'Familiar';

          const preexisting = [];
          if (m.diabetes) preexisting.push('Diabetes');
          if (m.hypertension) preexisting.push('Hipertensión');
          if (m.asthma) preexisting.push('Asma');
          if (m.epoc) preexisting.push('EPOC');
          if (m.cardiovascular) preexisting.push('Cardiovascular');
          if (m.renal) preexisting.push('Renal (Diálisis)');
          if (m.tuberculosis) preexisting.push('Tuberculosis');
          if (m.escabiosis) preexisting.push('Escabiosis/Pediculosis');
          if (m.gastrointestinal) preexisting.push('Gastrointestinal Recurrente');
          if (m.epilepsia) preexisting.push('Epilepsia');
          if (m.psiquiatrico) preexisting.push('Psiquiátrico');
          if (m.inmunocomprometido) preexisting.push('Inmunodeficiencia (VIH/Onco)');
          if (m.endemica) preexisting.push('Dengue/Paludismo');
          if (m.otrasPatologias && m.especificarOtras) preexisting.push(`Otros: ${m.especificarOtras}`);

          const memberMetadata = {
            photo: m.photo || '',
            parentesco: m.relation,
            procedencia_estado: procedenciaEstado,
            municipio,
            barrioSector,
            welcome_kit: welcomeKit,
            needs: m.specialNeeds,
            preexisting,
            treatments: m.treatments,
            diet: m.diet,
            allergies: m.allergies ? m.allergies.split(',').map(a => a.trim().toUpperCase()).filter(Boolean) : [],
            telefono_contacto: m.contactPhone,
            contacto_emergencia: m.emergencyContact,
            nutricion_especial: m.nutritionalRequirement,
            discapacidad: m.disabilityType,
            documento_perdido: m.lostDocumentation,
            escolarizado: m.birthDate && (new Date().getFullYear() - new Date(m.birthDate).getFullYear()) < 18 ? m.escolarizado : undefined,
            centro_educativo: m.birthDate && (new Date().getFullYear() - new Date(m.birthDate).getFullYear()) < 18 ? m.centro_educativo : undefined,
            grado_cursado: m.birthDate && (new Date().getFullYear() - new Date(m.birthDate).getFullYear()) < 18 ? m.grado_cursado : undefined
          };

          const resMember = await fetch(`${API_BASE}/damnificados`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              document_id: m.docId || null,
              first_name: mFirstName,
              last_name: mLastName,
              birth_date: m.birthDate || null,
              gender: m.gender || 'Femenino',
              health_status: preexisting.length > 0 ? 'Bajo Observación' : (m.healthStatus || 'Estable'),
              special_needs: JSON.stringify(memberMetadata),
              refugio_id: parseInt(refugioId),
              family_group_id: finalFamilyId
            })
          });

          if (resMember.ok) {
            const memberData = await resMember.json();
            if (assignments[i]) {
              await fetch(`${API_BASE}/beds/${assignments[i].bedId}/assign`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ resident_id: memberData.id })
              });
            }
          }
        }
      }

      if (welcomeKit) {
        await fetch(`${API_BASE}/refugios/${refugioId}/deliveries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            resident_id: headData.id,
            item_name: 'Kit de Bienvenida',
            quantity: 1 + (familyOption === 'new' ? familyMembers.length : 0)
          })
        });
      }

      setMessage(`El ingreso del núcleo familiar de ${fullName} ha sido finalizado con éxito.`);
      
      // Clear values
      setStep(1);
      setFullName('');
      setDocId('');
      setBirthDate('');
      setGender('Masculino');
      setMunicipio('');
      setBarrioSector('');
      setProcedenciaEstado('Distrito Capital');
      setHasFamilyCaracas('No');
      setAuthorizedVisitors('');
      setHasJob('No');
      setJobCompany('');
      setJobSchedule('');
      setJobAddress('');
      setPhoto('');
      
      setContactPhone('');
      setEmergencyContact('');
      setMinorChildrenUnderCharge('');
      setNutritionalRequirement('Ninguno');
      setDisabilityType('Ninguna');
      setLostDocumentation(false);
      setHousingCondition('Daño leve / En evaluación');
      setHousingTenure('Propietario');
      setTotalPeopleUnderCharge('0');
      setRequiresDiapersFormula('No');
      setHasPets('No');
      setPetSpecies('');
      setPetBreed('');
      setPetName('');

      setFamilyOption('none');
      setSelectedFamilyId('');
      setFamilyMembers([]);
      
      setDiabetes(false);
      setHypertension(false);
      setAsthma(false);
      setEpoc(false);
      setCardiovascular(false);
      setRenal(false);
      setTuberculosis(false);
      setEscabiosis(false);
      setGastrointestinal(false);
      setEpilepsia(false);
      setPsiquiatrico(false);
      setInmunocomprometido(false);
      setEndemica(false);
      setOtrasPatologias(false);
      setEspecificarOtras('');

      setTreatments('');
      setDiet('Ninguna / General');
      setAllergies([]);
      setAssignments({});
      setActiveAssigneeIndex('head');
      setWelcomeKit(false);

      setTimeout(() => navigate(`/refugio/${refugioId}/dashboard`), 1500);

    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al guardar el registro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Title */}
      <header className="mb-8">
        <h2 className="text-2xl font-extrabold text-primary">Recepción y Registro</h2>
        <p className="text-xs text-on-surface-variant">Proceso de admisión estandarizado para nuevos refugiados.</p>
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

      {/* Main Layout Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-4 min-h-[500px]">
        
        {/* Left Side: Wizard Timeline */}
        <div className="bg-surface border-r border-outline-variant p-6 flex flex-col gap-6">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pasos de Registro</h3>
          
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step === 1 ? 'bg-primary text-on-primary' : (step > 1 ? 'bg-primary-container text-on-primary-container' : 'border border-outline-variant text-on-surface-variant')}`}>
                1
              </span>
              <span className={`text-xs font-bold ${step === 1 ? 'text-primary' : 'text-on-surface-variant'}`}>Datos Personales</span>
            </div>

            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step === 2 ? 'bg-primary text-on-primary' : (step > 2 ? 'bg-primary-container text-on-primary-container' : 'border border-outline-variant text-on-surface-variant')}`}>
                2
              </span>
              <span className={`text-xs font-bold ${step === 2 ? 'text-primary' : 'text-on-surface-variant'}`}>Grupo Familiar</span>
            </div>

            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step === 3 ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant'}`}>
                3
              </span>
              <span className={`text-xs font-bold ${step === 3 ? 'text-primary' : 'text-on-surface-variant'}`}>Salud y Asignación</span>
            </div>
          </div>
        </div>

        {/* Right Side: Active Step View */}
        <div className="lg:col-span-3 p-8 flex flex-col justify-between">
          
          {/* STEP 1: DATOS PERSONALES */}
          {step === 1 && (
            <div className="flex flex-col gap-6 overflow-y-auto max-h-[550px] pr-2 custom-scrollbar">
              <div>
                <h3 className="text-md font-bold text-primary">Paso 1: Datos Personales</h3>
                <p className="text-[10px] text-on-surface-variant">Ingrese la información de identificación y procedencia primaria.</p>
              </div>

              {/* Photo upload header */}
              <div className="flex items-center gap-4 bg-surface p-4 rounded-xl border border-outline-variant">
                <div className="w-16 h-16 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center overflow-hidden">
                  {photo ? (
                    <img src={photo} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-on-surface">Foto de Perfil del Residente</span>
                  <label className="px-3 py-1.5 bg-primary text-on-primary text-[10px] font-bold rounded-lg cursor-pointer hover:opacity-90 inline-block text-center w-max">
                    Subir o Tomar Foto 📷
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={(e) => handlePhotoUpload(e, true)}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre Completo *</label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Número de Cédula / Documento *</label>
                  <input 
                    type="text" 
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                    placeholder="Ej. 12345678"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Género</label>
                  <select 
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Fecha de Nacimiento</label>
                  <input 
                    type="date" 
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Edad (Auto-calculada)</label>
                  <div className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-xs font-bold text-primary">
                    {calculatedAge}
                  </div>
                </div>

                {calculatedAge < 18 && (
                  <div className="md:col-span-2 border border-outline-variant p-4 rounded-xl bg-surface-container/20 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">¿Está Escolarizado?</label>
                      <select 
                        value={escolarizado} 
                        onChange={(e) => setEscolarizado(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                      >
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                      </select>
                    </div>
                    {escolarizado === 'Sí' && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant block mb-1">Centro Educativo</label>
                          <input 
                            type="text" 
                            value={centroEducativo} 
                            onChange={(e) => setCentroEducativo(e.target.value)} 
                            placeholder="Ej. U.E.N. Francisco Lazo"
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant block mb-1">Grado Cursado</label>
                          <input 
                            type="text" 
                            value={gradoCursado} 
                            onChange={(e) => setGradoCursado(e.target.value)} 
                            placeholder="Ej. 5to Grado / 3er Año"
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* DEMOGRAPHICS & CONTACT SECTION */}
                <div className="md:col-span-2 border-t border-outline-variant pt-4 mt-2">
                  <h4 className="text-xs font-bold text-primary mb-3">Contacto y Perfil Demográfico</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Teléfono de Contacto</label>
                      <input 
                        type="text" 
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Ej. 0412-5551234"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Contacto de Emergencia</label>
                      <input 
                        type="text" 
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        placeholder="Ej. María Gómez (Hermana) - 0416-1234567"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Menores de edad a cargo</label>
                      <input 
                        type="text" 
                        value={minorChildrenUnderCharge}
                        onChange={(e) => setMinorChildrenUnderCharge(e.target.value)}
                        placeholder="Ej. 2 niños (de 3 y 8 años)"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Requerimientos Nutricionales Especiales</label>
                      <select 
                        value={nutritionalRequirement}
                        onChange={(e) => setNutritionalRequirement(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        <option value="Ninguno">Ninguno</option>
                        <option value="Madre lactante">Madre lactante</option>
                        <option value="Embarazada">Embarazada</option>
                        <option value="Lactante (0-12 meses)">Lactante (0-12 meses)</option>
                        <option value="Adulto mayor con dieta blanda">Adulto mayor con dieta blanda</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* VULNERABILITIES SECTION */}
                <div className="md:col-span-2 border-t border-outline-variant pt-4 mt-2">
                  <h4 className="text-xs font-bold text-primary mb-3">Vulnerabilidades y Enfoque de Protección</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Discapacidad / Movilidad reducida</label>
                      <select 
                        value={disabilityType}
                        onChange={(e) => setDisabilityType(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        <option value="Ninguna">Ninguna</option>
                        <option value="Motora">Motora (Movilidad física reducida)</option>
                        <option value="Visual">Visual</option>
                        <option value="Auditiva">Auditiva</option>
                      </select>
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer mt-4">
                        <input 
                          type="checkbox" 
                          checked={lostDocumentation}
                          onChange={(e) => setLostDocumentation(e.target.checked)}
                          className="accent-primary w-4 h-4"
                        />
                        Documentación Perdida (No posee cédula física)
                      </label>
                    </div>
                  </div>
                </div>

                {/* HOUSING STATUS */}
                <div className="md:col-span-2 border-t border-outline-variant pt-4 mt-2">
                  <h4 className="text-xs font-bold text-primary mb-3">Estado de la Vivienda de Procedencia</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Condición de la vivienda anterior</label>
                      <select 
                        value={housingCondition}
                        onChange={(e) => setHousingCondition(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        <option value="Daño leve / En evaluación">Daño leve / En evaluación</option>
                        <option value="Daño estructural grave (Inhabitable)">Daño estructural grave (Inhabitable)</option>
                        <option value="Colapso total / Destruida">Colapso total / Destruida</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Tenencia de la vivienda</label>
                      <select 
                        value={housingTenure}
                        onChange={(e) => setHousingTenure(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        <option value="Propietario">Propietario</option>
                        <option value="Inquilino">Inquilino</option>
                        <option value="Vivo en casa de familiares">Vivo en casa de familiares</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* HEAD OF FAMILY CRITICAL LOGISTICS */}
                <div className="md:col-span-2 border-t border-outline-variant pt-4 mt-2 bg-primary/5 p-4 rounded-xl border border-primary/10">
                  <h4 className="text-xs font-bold text-primary mb-3 uppercase tracking-wider">Asistencia Familiar (Solo Jefe de Familia)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Cantidad total de personas a su cargo</label>
                      <input 
                        type="number" 
                        value={totalPeopleUnderCharge}
                        onChange={(e) => setTotalPeopleUnderCharge(e.target.value)}
                        min="0"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">¿Requiere pañales o fórmulas?</label>
                      <select 
                        value={requiresDiapersFormula}
                        onChange={(e) => setRequiresDiapersFormula(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">¿Posee mascotas?</label>
                      <select 
                        value={hasPets}
                        onChange={(e) => setHasPets(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                      </select>
                    </div>

                    {hasPets === 'Sí' && (
                      <div className="col-span-2 grid grid-cols-3 gap-3 border-t border-outline-variant/30 pt-3 mt-1">
                        <div>
                          <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Especie Mascota</label>
                          <input type="text" value={petSpecies} onChange={(e) => setPetSpecies(e.target.value)} placeholder="Ej. Perro" className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Raza Mascota</label>
                          <input type="text" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} placeholder="Ej. Poodle" className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Nombre Mascota</label>
                          <input type="text" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Ej. Toby" className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ORIGIN DATA SECTION */}
                <div className="md:col-span-2 border-t border-outline-variant pt-4 mt-2">
                  <h4 className="text-xs font-bold text-primary mb-3">Dirección de Procedencia</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Estado</label>
                      <select
                        value={procedenciaEstado}
                        onChange={(e) => setProcedenciaEstado(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        {VENEZUELA_STATES.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Municipio</label>
                      <input 
                        type="text" 
                        value={municipio}
                        onChange={(e) => setMunicipio(e.target.value)}
                        placeholder="Ej. Municipio La Guaira"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Barrio / Sector</label>
                      <input 
                        type="text" 
                        value={barrioSector}
                        onChange={(e) => setBarrioSector(e.target.value)}
                        placeholder="Ej. Caribe"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* EMPLOYMENT SECTION */}
                <div className="md:col-span-2 border-t border-outline-variant pt-4 mt-2">
                  <h4 className="text-xs font-bold text-primary mb-3">Situación Laboral</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">¿Tiene empleo?</label>
                      <select 
                        value={hasJob}
                        onChange={(e) => setHasJob(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Oficio o Profesión</label>
                      <input 
                        type="text" 
                        value={oficioProfesion}
                        onChange={(e) => setOficioProfesion(e.target.value)}
                        placeholder="Ej. Plomero, Electricista, Costurera..."
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      />
                    </div>

                    {hasJob === 'Sí' && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant block mb-1">Empresa o Negocio</label>
                          <input 
                            type="text" 
                            value={jobCompany}
                            onChange={(e) => setJobCompany(e.target.value)}
                            placeholder="Ej. Abasto Central"
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant block mb-1">Horario Laboral</label>
                          <input 
                            type="text" 
                            value={jobSchedule}
                            onChange={(e) => setJobSchedule(e.target.value)}
                            placeholder="Ej. 8:00 AM - 5:00 PM"
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="md:col-span-3 mt-2">
                          <label className="text-xs font-bold text-on-surface-variant block mb-1">Dirección del Trabajo</label>
                          <input 
                            type="text" 
                            value={jobAddress}
                            onChange={(e) => setJobAddress(e.target.value)}
                            placeholder="Ej. Av. Principal Francisco de Miranda"
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* EMERGENCY VISITS SECTION */}
                <div className="md:col-span-2 border-t border-outline-variant pt-4 mt-2">
                  <h4 className="text-xs font-bold text-primary mb-3">Vínculos de Apoyo y Visitas</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">¿Tiene familiares en Caracas?</label>
                      <select 
                        value={hasFamilyCaracas}
                        onChange={(e) => setHasFamilyCaracas(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      >
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1">Familiares autorizados para visitas</label>
                      <input 
                        type="text" 
                        value={authorizedVisitors}
                        onChange={(e) => setAuthorizedVisitors(e.target.value)}
                        placeholder="Ej. María Pérez"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                      />
                    </div>
                    {hasFamilyCaracas === 'Sí' && (
                      <div className="col-span-2">
                        <label className="text-xs font-bold text-on-surface-variant block mb-1">Detalle de los Familiares en Caracas (Nombres, Ubicación, Teléfono)</label>
                        <textarea 
                          value={familyCaracasDetails}
                          onChange={(e) => setFamilyCaracasDetails(e.target.value)}
                          placeholder="Ej. Primo: Juan Gómez, habita en Catia, Telf: 0416-1234567"
                          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none h-16 resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STEP 2: GRUPO FAMILIAR */}
          {step === 2 && (
            <div className="flex flex-col gap-6 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
              <div>
                <h3 className="text-md font-bold text-primary">Paso 2: Grupo Familiar</h3>
                <p className="text-[10px] text-on-surface-variant">Configure y asocie a los acompañantes de su núcleo familiar.</p>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                    <input 
                      type="radio" 
                      name="familyOption" 
                      value="none" 
                      checked={familyOption === 'none'}
                      onChange={() => setFamilyOption('none')}
                      className="accent-primary"
                    />
                    Residente Individual
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                    <input 
                      type="radio" 
                      name="familyOption" 
                      value="existing" 
                      checked={familyOption === 'existing'}
                      onChange={() => setFamilyOption('existing')}
                      className="accent-primary"
                    />
                    Vincular a un grupo familiar existente
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
                    <input 
                      type="radio" 
                      name="familyOption" 
                      value="new" 
                      checked={familyOption === 'new'}
                      onChange={() => setFamilyOption('new')}
                      className="accent-primary"
                    />
                    Crear un nuevo grupo familiar
                  </label>
                </div>

                {familyOption === 'existing' && (
                  <div className="border border-outline-variant p-4 rounded-xl bg-surface-container/20 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-xs font-bold text-on-surface-variant block mb-1">Seleccionar Núcleo Familiar Activo</label>
                    <select 
                      value={selectedFamilyId}
                      onChange={(e) => setSelectedFamilyId(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                    >
                      <option value="">-- Seleccione una familia --</option>
                      {families.map(f => (
                        <option key={f.id} value={f.id}>{f.family_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {familyOption === 'new' && (
                  <div className="border border-outline-variant p-4 rounded-xl bg-surface-container/20 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                      <span className="text-[10px] text-primary font-bold uppercase block tracking-wider">Identificador Único Generado</span>
                      <span className="text-xs font-semibold text-on-surface block mt-0.5">
                        Familia de {fullName || '[Su Nombre]'} (C.I. {docId || '[Su Cédula]'})
                      </span>
                    </div>

                    <div className="border-t border-outline-variant pt-2 mt-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-primary uppercase">Miembros Acompañantes ({familyMembers.length})</span>
                        <button
                          type="button"
                          onClick={handleAddMemberRow}
                          className="px-3 py-1.5 bg-primary/10 text-primary font-bold rounded-lg text-[10px] hover:bg-primary/20 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[12px]">add</span>
                          Añadir Familiar
                        </button>
                      </div>

                      {familyMembers.map((member, index) => (
                        <div key={member.tempId} className="bg-surface p-4 rounded-xl border border-outline-variant mb-4 flex flex-col gap-3 relative animate-in fade-in slide-in-from-top-1">
                          
                          <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                            <span className="text-[10px] font-bold text-primary uppercase">Familiar #{index + 1} - {member.relation}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMemberRow(index)}
                              className="p-1 text-error hover:bg-error-container/20 rounded-lg flex items-center justify-center cursor-pointer animate-all"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </div>

                          {/* Member photo upload preview */}
                          <div className="flex items-center gap-3 py-1.5 border-b border-outline-variant/30">
                            <div className="w-12 h-12 bg-surface-container border border-outline-variant rounded-full overflow-hidden flex items-center justify-center">
                              {member.photo ? (
                                <img src={member.photo} alt="Familiar Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-xl text-on-surface-variant">person</span>
                              )}
                            </div>
                            <label className="px-2 py-1 bg-surface border border-outline-variant text-[9px] font-bold rounded-md cursor-pointer hover:bg-surface-container">
                              Subir/Tomar Foto 📷
                              <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                onChange={(e) => handlePhotoUpload(e, false, index)}
                                className="hidden" 
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Nombre Completo *</label>
                              <input 
                                type="text" 
                                value={member.name}
                                onChange={(e) => handleUpdateMember(index, 'name', e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                                required
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Cédula (Opcional)</label>
                              <input 
                                type="text" 
                                value={member.docId}
                                onChange={(e) => handleUpdateMember(index, 'docId', e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Parentesco</label>
                              <select 
                                value={member.relation}
                                onChange={(e) => handleUpdateMember(index, 'relation', e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                              >
                                <option value="Hijo/a">Hijo/a</option>
                                <option value="Cónyuge">Cónyuge / Pareja</option>
                                <option value="Padre/Madre">Padre/Madre</option>
                                <option value="Hermano/a">Hermano/a</option>
                                <option value="Abuelo/a">Abuelo/a</option>
                                <option value="Tío/a">Tío/a</option>
                                <option value="Otro">Otro</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Género</label>
                              <select 
                                value={member.gender}
                                onChange={(e) => handleUpdateMember(index, 'gender', e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                              >
                                <option value="Femenino">Femenino</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Otro">Otro</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Fecha de Nacimiento</label>
                              <input 
                                type="date" 
                                value={member.birthDate}
                                onChange={(e) => handleUpdateMember(index, 'birthDate', e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Estado de Salud</label>
                              <select 
                                value={member.healthStatus}
                                onChange={(e) => handleUpdateMember(index, 'healthStatus', e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                              >
                                <option value="Estable">Estable</option>
                                <option value="Bajo Observación">Bajo Observación</option>
                                <option value="Crítico">Crítico</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Necesidades Especiales / Observaciones</label>
                              <input 
                                type="text" 
                                value={member.specialNeeds}
                                onChange={(e) => handleUpdateMember(index, 'specialNeeds', e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                              />
                            </div>

                            {member.birthDate && (new Date().getFullYear() - new Date(member.birthDate).getFullYear()) < 18 && (
                              <div className="sm:col-span-3 border border-outline-variant/50 p-3 rounded-lg bg-surface-container-low grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[9px] font-bold text-on-surface-variant block mb-1">¿Escolarizado?</label>
                                  <select 
                                    value={member.escolarizado || 'No'} 
                                    onChange={(e) => handleUpdateMember(index, 'escolarizado', e.target.value)}
                                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none font-bold"
                                  >
                                    <option value="No">No</option>
                                    <option value="Sí">Sí</option>
                                  </select>
                                </div>
                                {member.escolarizado === 'Sí' && (
                                  <>
                                    <div className="col-span-2 sm:col-span-1">
                                      <label className="text-[9px] font-bold text-on-surface-variant block mb-1">Centro Educativo</label>
                                      <input 
                                        type="text" 
                                        value={member.centro_educativo || ''} 
                                        onChange={(e) => handleUpdateMember(index, 'centro_educativo', e.target.value)} 
                                        placeholder="Nombre de la escuela"
                                        className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                                      />
                                    </div>
                                    <div className="col-span-3 sm:col-span-1">
                                      <label className="text-[9px] font-bold text-on-surface-variant block mb-1">Grado Cursado</label>
                                      <input 
                                        type="text" 
                                        value={member.grado_cursado || ''} 
                                        onChange={(e) => handleUpdateMember(index, 'grado_cursado', e.target.value)} 
                                        placeholder="Ej: 5to Grado"
                                        className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Member contact & demographics */}
                          <div className="border-t border-outline-variant pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Teléfono Acompañante</label>
                              <input type="text" value={member.contactPhone} onChange={(e) => handleUpdateMember(index, 'contactPhone', e.target.value)} placeholder="Propio o tercero" className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[10px] focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Contacto de Emergencia</label>
                              <input type="text" value={member.emergencyContact} onChange={(e) => handleUpdateMember(index, 'emergencyContact', e.target.value)} placeholder="Nombre y teléfono" className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[10px] focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Requerimientos Nutricionales Especiales</label>
                              <select value={member.nutritionalRequirement} onChange={(e) => handleUpdateMember(index, 'nutritionalRequirement', e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[10px] focus:outline-none">
                                <option value="Ninguno">Ninguno</option>
                                <option value="Madre lactante">Madre lactante</option>
                                <option value="Embarazada">Embarazada</option>
                                <option value="Lactante (0-12 meses)">Lactante (0-12 meses)</option>
                                <option value="Adulto mayor con dieta blanda">Adulto mayor con dieta blanda</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Discapacidad / Movilidad</label>
                              <select value={member.disabilityType} onChange={(e) => handleUpdateMember(index, 'disabilityType', e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[10px] focus:outline-none">
                                <option value="Ninguna">Ninguna</option>
                                <option value="Motora">Motora</option>
                                <option value="Visual">Visual</option>
                                <option value="Auditiva">Auditiva</option>
                              </select>
                            </div>
                            <div className="sm:col-span-2 flex items-center">
                              <label className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface cursor-pointer">
                                <input type="checkbox" checked={member.lostDocumentation} onChange={(e) => handleUpdateMember(index, 'lostDocumentation', e.target.checked)} className="accent-primary" />
                                Documentación Perdida (No posee cédula física)
                              </label>
                            </div>
                          </div>

                          {/* Member Medical Checkboxes */}
                          <div className="border-t border-outline-variant pt-3">
                            <span className="text-[10px] font-bold text-primary block mb-2 uppercase">Historial Clínico del Acompañante</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] mb-3">
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.diabetes} onChange={e => handleUpdateMember(index, 'diabetes', e.target.checked)} className="accent-primary" /> Diabetes</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.hypertension} onChange={e => handleUpdateMember(index, 'hypertension', e.target.checked)} className="accent-primary" /> Hipertensión</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.asthma} onChange={e => handleUpdateMember(index, 'asthma', e.target.checked)} className="accent-primary" /> Asma</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.epoc} onChange={e => handleUpdateMember(index, 'epoc', e.target.checked)} className="accent-primary" /> EPOC</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.cardiovascular} onChange={e => handleUpdateMember(index, 'cardiovascular', e.target.checked)} className="accent-primary" /> Cardiovascular</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.renal} onChange={e => handleUpdateMember(index, 'renal', e.target.checked)} className="accent-primary" /> Renal (Diálisis)</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.tuberculosis} onChange={e => handleUpdateMember(index, 'tuberculosis', e.target.checked)} className="accent-primary" /> Tuberculosis</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.escabiosis} onChange={e => handleUpdateMember(index, 'escabiosis', e.target.checked)} className="accent-primary" /> Escabiosis/Piojos</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.gastrointestinal} onChange={e => handleUpdateMember(index, 'gastrointestinal', e.target.checked)} className="accent-primary" /> Gastrointestinal</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.epilepsia} onChange={e => handleUpdateMember(index, 'epilepsia', e.target.checked)} className="accent-primary" /> Epilepsia</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.psiquiatrico} onChange={e => handleUpdateMember(index, 'psiquiatrico', e.target.checked)} className="accent-primary" /> Psiquiátrico</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.inmunocomprometido} onChange={e => handleUpdateMember(index, 'inmunocomprometido', e.target.checked)} className="accent-primary" /> Inmunodeficiente</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.endemica} onChange={e => handleUpdateMember(index, 'endemica', e.target.checked)} className="accent-primary" /> Dengue/Paludismo</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={member.otrasPatologias} onChange={e => handleUpdateMember(index, 'otrasPatologias', e.target.checked)} className="accent-primary" /> Otras</label>
                            </div>
                            {member.otrasPatologias && (
                              <input 
                                type="text" 
                                value={member.especificarOtras} 
                                onChange={e => handleUpdateMember(index, 'especificarOtras', e.target.value)} 
                                placeholder="Especifique otras..." 
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[10px] focus:outline-none mb-3" 
                              />
                            )}
                          </div>

                          <div className="border-t border-outline-variant pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-[10px] font-bold text-on-surface-variant block mb-1 uppercase font-bold">Tratamientos</span>
                              <input 
                                type="text" 
                                value={member.treatments}
                                onChange={(e) => handleUpdateMember(index, 'treatments', e.target.value)}
                                placeholder="Tratamientos médicos..."
                                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[10px] focus:outline-none"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-on-surface-variant block mb-1 uppercase font-bold">Alimentación</span>
                              <div className="flex flex-col gap-2">
                                <select 
                                  value={member.diet}
                                  onChange={(e) => handleUpdateMember(index, 'diet', e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[10px] focus:outline-none"
                                >
                                  <option value="Ninguna / General">Ninguna / General</option>
                                  <option value="Diabética">Diabética</option>
                                  <option value="Hiposódica">Hiposódica (Baja en sal)</option>
                                  <option value="Sin Gluten">Sin Gluten</option>
                                </select>
                                <input 
                                  type="text" 
                                  value={member.allergies}
                                  onChange={(e) => handleUpdateMember(index, 'allergies', e.target.value)}
                                  placeholder="Alergias (ej. Mariscos, Maní)"
                                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[10px] focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: SALUD Y ASIGNACIÓN */}
          {step === 3 && (
            <div className="flex flex-col gap-6 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
              <div>
                <h3 className="text-md font-bold text-primary">Paso 3: Salud y Asignación</h3>
                <p className="text-[10px] text-on-surface-variant">Evaluación médica inicial y logística de alojamiento.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column 1: Medical Conditions Grouped */}
                <div className="border border-outline-variant p-4 rounded-xl flex flex-col gap-4 bg-surface-container/10 md:col-span-2">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1 border-b border-outline-variant pb-2">
                    <span className="material-symbols-outlined text-sm">local_hospital</span>
                    Historial Clínico Estandarizado (Cabeza de Familia)
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-semibold">
                    
                    {/* Crónicas */}
                    <div>
                      <span className="text-[9px] uppercase font-bold text-primary block mb-2">Crónicas No Transmisibles</span>
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={diabetes} onChange={e => setDiabetes(e.target.checked)} className="accent-primary" /> Diabetes</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={hypertension} onChange={e => setHypertension(e.target.checked)} className="accent-primary" /> Hipertensión</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={asthma} onChange={e => setAsthma(e.target.checked)} className="accent-primary" /> Asma</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={epoc} onChange={e => setEpoc(e.target.checked)} className="accent-primary" /> EPOC</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={cardiovascular} onChange={e => setCardiovascular(e.target.checked)} className="accent-primary" /> Cardiovascular</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={renal} onChange={e => setRenal(e.target.checked)} className="accent-primary" /> Renal (Diálisis)</label>
                      </div>
                    </div>

                    {/* Brotes / Hacinamiento */}
                    <div>
                      <span className="text-[9px] uppercase font-bold text-primary block mb-2">Riesgo Infeccioso (Brotes)</span>
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={tuberculosis} onChange={e => setTuberculosis(e.target.checked)} className="accent-primary" /> Tuberculosis</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={escabiosis} onChange={e => setEscabiosis(e.target.checked)} className="accent-primary" /> Escabiosis/Piojos</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={gastrointestinal} onChange={e => setGastrointestinal(e.target.checked)} className="accent-primary" /> Gastrointestinal</label>
                      </div>
                    </div>

                    {/* Neurológicas y Mental */}
                    <div>
                      <span className="text-[9px] uppercase font-bold text-primary block mb-2">Salud Mental y Neurológica</span>
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={epilepsia} onChange={e => setEpilepsia(e.target.checked)} className="accent-primary" /> Epilepsia</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={psiquiatrico} onChange={e => setPsiquiatrico(e.target.checked)} className="accent-primary" /> Psiquiátrico</label>
                      </div>
                    </div>

                    {/* Inmuno / Endémicas */}
                    <div>
                      <span className="text-[9px] uppercase font-bold text-primary block mb-2">Inmuno & Endémicas</span>
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={inmunocomprometido} onChange={e => setInmunocomprometido(e.target.checked)} className="accent-primary" /> Inmunodeficiente</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={endemica} onChange={e => setEndemica(e.target.checked)} className="accent-primary" /> Dengue/Paludismo</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={otrasPatologias} onChange={e => setOtrasPatologias(e.target.checked)} className="accent-primary" /> Otras Patologías</label>
                      </div>
                    </div>

                  </div>

                  {otrasPatologias && (
                    <div className="mt-2 border-t border-outline-variant/30 pt-3">
                      <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Especifique otras patologías</label>
                      <input 
                        type="text" 
                        value={especificarOtras}
                        onChange={e => setEspecificarOtras(e.target.value)}
                        placeholder="Ej. Hipotiroidismo, Artritis severa..."
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-outline-variant/30">
                    <div>
                      <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Tratamientos Médicos Actuales</label>
                      <textarea 
                        value={treatments}
                        onChange={(e) => setTreatments(e.target.value)}
                        placeholder="Medicamentos y dosis..."
                        rows="2"
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Dieta Especial y Alergias</label>
                      <select 
                        value={diet}
                        onChange={(e) => setDiet(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none mb-2"
                      >
                        <option value="Ninguna / General">Ninguna / General</option>
                        <option value="Diabética">Diabética</option>
                        <option value="Hiposódica">Hiposódica (Baja en sal)</option>
                        <option value="Sin Gluten">Sin Gluten</option>
                      </select>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={allergyInput}
                          onChange={(e) => setAllergyInput(e.target.value)}
                          placeholder="Añadir Alergias..."
                          className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                        />
                        <button onClick={handleAddAllergy} className="px-3 bg-primary text-on-primary font-bold rounded-lg text-xs">Añadir</button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {allergies.map(tag => (
                          <span key={tag} className="bg-error/10 text-error border border-error/20 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1">
                            {tag}
                            <button onClick={() => handleRemoveAllergy(tag)} className="hover:text-red-700 font-bold">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Section 2: Bed Assignment (Full Width) */}
                <div className="md:col-span-2 border border-outline-variant p-4 rounded-xl flex flex-col gap-4 bg-surface-container/10">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">single_bed</span>
                    Asignación Logística Conjunta
                  </h4>

                  {/* Member Assignment Tabs */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-on-surface-variant block">Seleccione quién va a ocupar la cama</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveAssigneeIndex('head')}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${activeAssigneeIndex === 'head' ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-outline-variant'}`}
                      >
                        Cabeza: {fullName || 'Principal'} {assignments['head'] ? `(${assignments['head'].bedNum})` : '(Sin Cama)'}
                      </button>
                      
                      {familyOption === 'new' && familyMembers.map((m, idx) => (
                        <button
                          key={m.tempId}
                          type="button"
                          onClick={() => setActiveAssigneeIndex(idx)}
                          className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${activeAssigneeIndex === idx ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-outline-variant'}`}
                        >
                          {m.relation}: {m.name || `Miembro ${idx+1}`} {assignments[idx] ? `(${assignments[idx].bedNum})` : '(Sin Cama)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Spaces selector */}
                  <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
                    <span className="text-[10px] font-bold text-on-surface-variant block">Espacios de Alojamiento</span>
                    {uniqueSpacesList.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {uniqueSpacesList.map(spName => (
                          <button
                            key={spName}
                            type="button"
                            onClick={() => {
                              setActiveSpace(spName);
                            }}
                            className={`px-4 py-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${activeSpace === spName ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container'}`}
                          >
                            {spName}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-error font-semibold italic">Configure espacios en el Mapa de Camas.</span>
                    )}
                  </div>

                  {/* Bed grid */}
                  <div className="border border-outline-variant p-4 rounded-lg bg-surface-container-lowest flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs border-b border-outline-variant pb-2">
                      <span className="font-bold text-on-surface">DISPONIBILIDAD: {activeSpace || 'Sin Espacio Seleccionado'}</span>
                      <span className="font-bold text-primary">{freeBedsInSpace} / {totalBedsInSpace} Libres</span>
                    </div>

                    {sortedBeds.length > 0 ? (
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 py-2">
                        {sortedBeds.map(bed => {
                          const isOccupied = bed.status === 'Ocupada';
                          
                          let isSelected = false;
                          let assignedName = '';
                          
                          if (assignments['head']?.bedId === bed.id) {
                            isSelected = true;
                            assignedName = 'Cabeza';
                          } else {
                            const foundIdx = Object.keys(assignments).find(k => k !== 'head' && assignments[k]?.bedId === bed.id);
                            if (foundIdx !== undefined) {
                              isSelected = true;
                              assignedName = familyMembers[foundIdx]?.relation || 'Familiar';
                            }
                          }

                          return (
                            <button
                              key={bed.id}
                              type="button"
                              disabled={isOccupied}
                              onClick={() => handleSelectBed(bed)}
                              className={`h-12 rounded-lg font-bold text-[10px] border flex flex-col items-center justify-center transition-all ${
                                isOccupied ? 'bg-secondary-container text-on-secondary-container/40 border-outline-variant cursor-not-allowed' :
                                (isSelected ? 'bg-primary text-on-primary border-primary ring-2 ring-primary/20' : 'bg-success/5 border-success/30 text-success hover:bg-success/15 cursor-pointer')
                              }`}
                            >
                              <span>{bed.bed_number.split(' ')[1] || bed.bed_number}</span>
                              {isSelected && <span className="text-[7px] font-medium block truncate max-w-full uppercase">{assignedName}</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-on-surface-variant py-2 text-center">No hay camas configuradas.</span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-outline-variant pt-4">
                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={welcomeKit} 
                        onChange={(e) => setWelcomeKit(e.target.checked)} 
                        className="accent-primary w-4 h-4" 
                      />
                      Entregar Kit de Bienvenida a todo el núcleo familiar
                    </label>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Navigation Actions Row */}
          <div className="flex justify-between items-center mt-8 border-t border-outline-variant pt-6">
            {step > 1 ? (
              <button 
                onClick={handlePrevStep}
                className="px-6 py-2.5 border border-outline text-primary font-bold rounded-lg text-xs hover:bg-surface-container transition-all flex items-center gap-2 cursor-pointer"
              >
                ← Anterior
              </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button 
                onClick={handleNextStep}
                className="px-6 py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                Siguiente →
              </button>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={() => navigate(`/refugio/${refugioId}/dashboard`)}
                  className="px-6 py-2.5 border border-outline text-primary font-bold rounded-lg text-xs hover:bg-surface-container transition-all cursor-pointer"
                >
                  Guardar Borrador
                </button>
                <button 
                  onClick={handleFinishRegistration}
                  disabled={loading}
                  className="px-6 py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  {loading ? 'Procesando...' : 'Finalizar Registro ✓'}
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
