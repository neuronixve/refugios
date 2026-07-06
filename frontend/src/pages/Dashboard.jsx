import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function Dashboard({ token, selectedRefugio }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen'); // 'resumen', 'salud', 'socio'

  // General counts
  const [stats, setStats] = useState({ residentsCount: 0, bedsAvailable: 0, criticalItemsCount: 0, healthCriticalCount: 0 });
  const [criticalItems, setCriticalItems] = useState([]);
  const [healthDistribution, setHealthDistribution] = useState({ Stable: 0, Observation: 0, Critical: 0 });

  // Detailed indicators from JSON metadata
  const [demographics, setDemographics] = useState({ male: 0, female: 0, other: 0 });
  const [chronicConditions, setChronicConditions] = useState({ 
    diabetes: 0, 
    hypertension: 0, 
    asthma: 0, 
    epoc: 0,
    cardiovascular: 0,
    renal: 0,
    tuberculosis: 0,
    escabiosis: 0,
    gastrointestinal: 0,
    epilepsia: 0,
    psiquiatrico: 0,
    inmunocomprometido: 0,
    endemica: 0
  });
  const [disabilities, setDisabilities] = useState({ motora: 0, visual: 0, auditiva: 0, ninguna: 0 });
  const [nutritionalAlerts, setNutritionalAlerts] = useState({ madreLactante: 0, embarazada: 0, lactanteBebe: 0, adultoDietaBlanda: 0, allergiesCount: 0 });
  const [logisticsAlerts, setLogisticsAlerts] = useState({ requiresDiapers: 0, lostDocs: 0 });
  const [housingStatus, setHousingStatus] = useState({ destruida: 0, inhabitable: 0, leve: 0 });
  const [housingTenure, setHousingTenure] = useState({ propietario: 0, inquilino: 0, familiares: 0 });
  const [employmentStatus, setEmploymentStatus] = useState({ employed: 0, unemployed: 0 });
  const [petsCensus, setPetsCensus] = useState({ countWithPets: 0, list: [] });
  const [totalMinors, setTotalMinors] = useState(0);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    if (refugioId) {
      fetchDashboardData();
    }
  }, [refugioId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get residents
      const resResidents = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const residents = resResidents.ok ? await resResidents.json() : [];
      const activeResidents = residents.filter(d => d.status === 'Activo');

      // 2. Get beds
      const resBeds = await fetch(`${API_BASE}/refugios/${refugioId}/beds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const beds = resBeds.ok ? await resBeds.json() : [];
      const bedsAvailable = beds.filter(b => b.status === 'Disponible').length;

      // 3. Get inventory
      const resInventory = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const inventory = resInventory.ok ? await resInventory.json() : [];
      const critItems = inventory.filter(i => i.status === 'Stock Crítico' || i.status === 'Sin Stock');

      // Reset detailed metrics
      let stable = 0, observation = 0, critical = 0;
      let countMale = 0, countFemale = 0, countOtherGender = 0;
      let countDiabetes = 0, countHypertension = 0, countAsthma = 0, countEpoc = 0;
      let countCardiovascular = 0, countRenal = 0;
      let countTuberculosis = 0, countEscabiosis = 0, countGastrointestinal = 0;
      let countEpilepsia = 0, countPsiquiatrico = 0;
      let countInmunocomprometido = 0, countEndemica = 0;
      let countDisabilityMotora = 0, countDisabilityVisual = 0, countDisabilityAuditiva = 0;
      let countNutriMadreLactante = 0, countNutriEmbarazada = 0, countNutriLactanteBebe = 0, countNutriAdultoBlanda = 0, allergiesCount = 0;
      let countRequiresDiapers = 0, countLostDocs = 0;
      let countHousingDestruida = 0, countHousingInhabitable = 0, countHousingLeve = 0;
      let countTenurePropietario = 0, countTenureInquilino = 0, countTenureFamiliares = 0;
      let countEmployed = 0, countUnemployed = 0;
      let countWithPets = 0;
      let petsList = [];
      let totalMinorsCount = 0;

      activeResidents.forEach(r => {
        // Gender demographics
        if (r.gender === 'Masculino') countMale++;
        else if (r.gender === 'Femenino') countFemale++;
        else countOtherGender++;

        // General Health status
        if (r.health_status === 'Estable') stable++;
        else if (r.health_status === 'Bajo Observación') observation++;
        else if (r.health_status === 'Crítico') critical++;
        else stable++;

        // Parse special needs metadata
        let meta = {};
        try {
          meta = r.special_needs ? JSON.parse(r.special_needs) : {};
        } catch {
          meta = {};
        }

        // Chronic illness check (supporting both array and legacy fields)
        const preexisting = meta.preexisting || [];
        if (preexisting.includes('Diabetes') || meta.diabetes) countDiabetes++;
        if (preexisting.includes('Hipertensión') || meta.hypertension) countHypertension++;
        if (preexisting.includes('Asma') || meta.asthma) countAsthma++;
        if (preexisting.includes('EPOC') || meta.epoc) countEpoc++;
        if (preexisting.includes('Cardiovascular') || meta.cardiovascular) countCardiovascular++;
        if (preexisting.includes('Renal (Diálisis)') || meta.renal) countRenal++;
        if (preexisting.includes('Tuberculosis') || meta.tuberculosis) countTuberculosis++;
        if (preexisting.includes('Escabiosis/Pediculosis') || meta.escabiosis) countEscabiosis++;
        if (preexisting.includes('Gastrointestinal Recurrente') || meta.gastrointestinal) countGastrointestinal++;
        if (preexisting.includes('Epilepsia') || meta.epilepsia) countEpilepsia++;
        if (preexisting.includes('Psiquiátrico') || meta.psiquiatrico) countPsiquiatrico++;
        if (preexisting.includes('Inmunodeficiencia (VIH/Onco)') || meta.inmunocomprometido) countInmunocomprometido++;
        if (preexisting.includes('Dengue/Paludismo') || meta.endemica) countEndemica++;

        // Mobility check
        const disc = meta.discapacidad || 'Ninguna';
        if (disc === 'Motora') countDisabilityMotora++;
        else if (disc === 'Visual') countDisabilityVisual++;
        else if (disc === 'Auditiva') countDisabilityAuditiva++;

        // Nutritional check
        const nutri = meta.nutricion_especial || 'Ninguno';
        if (nutri === 'Madre lactante') countNutriMadreLactante++;
        else if (nutri === 'Embarazada') countNutriEmbarazada++;
        else if (nutri === 'Lactante (0-12 meses)') countNutriLactanteBebe++;
        else if (nutri === 'Adulto mayor con dieta blanda') countNutriAdultoBlanda++;

        // Minor children
        if (meta.menores_a_cargo) totalMinorsCount++;

        // Allergies
        if (meta.allergies && meta.allergies.length > 0) allergiesCount++;

        // Logistics (diapers & formulas & lost docs)
        if (meta.requiere_pañales_formula === 'Sí') countRequiresDiapers++;
        if (meta.documento_perdido === true) countLostDocs++;

        // Housing Condition
        const cond = meta.estado_vivienda || 'Daño leve / En evaluación';
        if (cond === 'Colapso total / Destruida') countHousingDestruida++;
        else if (cond === 'Daño estructural grave (Inhabitable)') countHousingInhabitable++;
        else countHousingLeve++;

        // Housing Tenure
        const tenure = meta.tenencia_vivienda || 'Propietario';
        if (tenure === 'Propietario') countTenurePropietario++;
        else if (tenure === 'Inquilino') countTenureInquilino++;
        else if (tenure === 'Vivo en casa de familiares') countTenureFamiliares++;

        // Employment
        const job = meta.empleo?.tiene_empleo || 'No';
        if (job === 'Sí') countEmployed++;
        else countUnemployed++;

        // Pets
        if (meta.mascotas?.tiene_mascotas === 'Sí') {
          countWithPets++;
          if (meta.mascotas.nombre) {
            petsList.push({
              name: meta.mascotas.nombre,
              species: meta.mascotas.especie || 'Mascota',
              breed: meta.mascotas.raza || 'Mestizo',
              owner: `${r.first_name} ${r.last_name}`
            });
          }
        }
      });

      // Update state states
      setStats({
        residentsCount: activeResidents.length,
        bedsAvailable: beds.length > 0 ? bedsAvailable : (selectedRefugio ? (selectedRefugio.capacity - activeResidents.length) : 0),
        criticalItemsCount: critItems.length,
        healthCriticalCount: critical + observation
      });

      setCriticalItems(critItems);
      setHealthDistribution({ Stable: stable, Observation: observation, Critical: critical });

      setDemographics({ male: countMale, female: countFemale, other: countOtherGender });
      setChronicConditions({ 
        diabetes: countDiabetes, 
        hypertension: countHypertension, 
        asthma: countAsthma, 
        epoc: countEpoc,
        cardiovascular: countCardiovascular,
        renal: countRenal,
        tuberculosis: countTuberculosis,
        escabiosis: countEscabiosis,
        gastrointestinal: countGastrointestinal,
        epilepsia: countEpilepsia,
        psiquiatrico: countPsiquiatrico,
        inmunocomprometido: countInmunocomprometido,
        endemica: countEndemica
      });
      setDisabilities({ motora: countDisabilityMotora, visual: countDisabilityVisual, auditiva: countDisabilityAuditiva });
      setNutritionalAlerts({
        madreLactante: countNutriMadreLactante,
        embarazada: countNutriEmbarazada,
        lactanteBebe: countNutriLactanteBebe,
        adultoDietaBlanda: countNutriAdultoBlanda,
        allergiesCount
      });
      setLogisticsAlerts({ requiresDiapers: countRequiresDiapers, lostDocs: countLostDocs });
      setHousingStatus({ destruida: countHousingDestruida, inhabitable: countHousingInhabitable, leve: countHousingLeve });
      setHousingTenure({ propietario: countTenurePropietario, inquilino: countTenureInquilino, familiares: countTenureFamiliares });
      setEmploymentStatus({ employed: countEmployed, unemployed: countUnemployed });
      setPetsCensus({ countWithPets, list: petsList });
      setTotalMinors(totalMinorsCount);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const occupancyPercent = selectedRefugio && selectedRefugio.capacity > 0
    ? Math.round((stats.residentsCount / selectedRefugio.capacity) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-primary font-bold text-xs tracking-widest uppercase block">Refugio Seleccionado</span>
          <h2 className="text-3xl font-extrabold text-on-background mt-1">{selectedRefugio ? selectedRefugio.name : 'Cargando Sede...'}</h2>
          <p className="text-body-sm text-on-surface-variant max-w-2xl mt-1">
            Panel de control operativo de necesidades, vulnerabilidades de salud y riesgos socio-demográficos.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate(`/refugio/${refugioId}/registro`)}
            className="px-6 py-3 bg-primary text-on-primary font-bold rounded-lg shadow-sm hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Registrar Ingreso
          </button>
        </div>
      </header>

      {/* Primary KPIs Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">groups</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Censo Población Activa</p>
            <h3 className="text-xl font-bold text-on-surface">{stats.residentsCount} personas</h3>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-success/15 rounded-full flex items-center justify-center text-success">
            <span className="material-symbols-outlined text-2xl">single_bed</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Disponibilidad de Camas</p>
            <h3 className="text-xl font-bold text-success">{stats.bedsAvailable} libres</h3>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-warning/15 rounded-full flex items-center justify-center text-warning-variant">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Stock Crítico Insumos</p>
            <h3 className={`text-xl font-bold ${stats.criticalItemsCount > 0 ? 'text-error animate-pulse' : 'text-on-surface'}`}>
              {stats.criticalItemsCount} Alertas
            </h3>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-2xl">health_and_safety</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Alertas Sanitarias / Médicas</p>
            <h3 className="text-xl font-bold text-error">{stats.healthCriticalCount} Casos</h3>
          </div>
        </div>
      </section>

      {/* Tabs Menu */}
      <div className="flex border-b border-outline-variant mb-6 text-xs font-bold gap-2">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`pb-3 px-4 border-b-2 transition-all ${activeTab === 'resumen' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
        >
          Resumen General y Ocupación
        </button>
        <button
          onClick={() => setActiveTab('salud')}
          className={`pb-3 px-4 border-b-2 transition-all ${activeTab === 'salud' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
        >
          Salud y Logística (Riesgos)
        </button>
        <button
          onClick={() => setActiveTab('socio')}
          className={`pb-3 px-4 border-b-2 transition-all ${activeTab === 'socio' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
        >
          Socioeconómico y Vivienda (Recuperación)
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs font-bold text-on-surface-variant">Actualizando panel de control...</div>
      ) : (
        <>
          {/* TAB 1: RESUMEN GENERAL */}
          {activeTab === 'resumen' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
              
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs lg:col-span-2">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">analytics</span>
                  Capacidad de Alojamiento de la Sede
                </h3>
                <div className="flex flex-col md:flex-row items-center gap-8 py-4">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-8 border-secondary-container"></div>
                    <div className="text-center">
                      <span className="text-3xl font-extrabold text-primary">{occupancyPercent}%</span>
                      <span className="text-xs text-on-surface-variant block font-bold">Capacidad</span>
                    </div>
                  </div>
                  <div className="flex-1 w-full flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-on-surface-variant">Capacidad Máxima Configurada:</span>
                      <span className="text-on-surface">{selectedRefugio ? selectedRefugio.capacity : 0} camas</span>
                    </div>
                    <div className="w-full h-2 bg-secondary-container rounded-full overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-500" style={{ width: `${Math.min(100, occupancyPercent)}%` }}></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="border border-outline-variant p-3 rounded-lg text-center">
                        <span className="text-xs text-on-surface-variant block font-bold">Camas Asignadas</span>
                        <span className="text-lg font-bold text-primary">{stats.residentsCount}</span>
                      </div>
                      <div className="border border-outline-variant p-3 rounded-lg text-center">
                        <span className="text-xs text-on-surface-variant block font-bold">Camas Libres</span>
                        <span className="text-lg font-bold text-on-surface">{stats.bedsAvailable}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">wc</span>
                  Distribución Demográfica
                </h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1 font-bold">
                      <span className="text-on-surface-variant">Femenino</span>
                      <span>{demographics.female} ({stats.residentsCount > 0 ? Math.round((demographics.female / stats.residentsCount) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-2 bg-secondary-container rounded-full overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${stats.residentsCount > 0 ? (demographics.female / stats.residentsCount) * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs mb-1 font-bold">
                      <span className="text-on-surface-variant">Masculino</span>
                      <span>{demographics.male} ({stats.residentsCount > 0 ? Math.round((demographics.male / stats.residentsCount) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-2 bg-secondary-container rounded-full overflow-hidden">
                      <div className="bg-secondary h-full" style={{ width: `${stats.residentsCount > 0 ? (demographics.male / stats.residentsCount) * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs mb-1 font-bold">
                      <span className="text-on-surface-variant">Otros / Sin Registrar</span>
                      <span>{demographics.other} ({stats.residentsCount > 0 ? Math.round((demographics.other / stats.residentsCount) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-2 bg-secondary-container rounded-full overflow-hidden">
                      <div className="bg-outline-variant h-full" style={{ width: `${stats.residentsCount > 0 ? (demographics.other / stats.residentsCount) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs lg:col-span-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary">inventory_2</span>
                    Alertas de Suministros Críticos
                  </h3>
                  <button 
                    onClick={() => navigate(`/refugio/${refugioId}/inventario`)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Gestionar Inventario
                  </button>
                </div>
                
                {criticalItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {criticalItems.map((item) => (
                      <div 
                        key={item.id}
                        className={`p-4 rounded-lg border flex items-center justify-between gap-4 ${item.status === 'Sin Stock' ? 'bg-error-container/20 border-error/20' : 'bg-tertiary-container/10 border-tertiary/20'}`}
                      >
                        <div>
                          <h4 className="text-body-sm font-bold text-on-surface">{item.item_name}</h4>
                          <span className="text-xs text-on-surface-variant block">{item.category}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-md font-extrabold block ${item.status === 'Sin Stock' ? 'text-error' : 'text-tertiary'}`}>
                            {item.quantity} {item.unit}
                          </span>
                          <span className="text-xs text-on-surface-variant">Min: {item.min_threshold}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-outline-variant rounded-lg text-center text-on-surface-variant text-body-sm">
                    <span className="material-symbols-outlined text-4xl block mb-2 text-success">check_circle</span>
                    Todos los niveles de insumos y suministros están por encima de los mínimos críticos.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SALUD Y LOGÍSTICA (RIESGOS) */}
          {activeTab === 'salud' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
              
              {/* Chronic Illness Card */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-error">monitor_heart</span>
                  Crónicas No Transmisibles
                </h3>
                <div className="flex flex-col gap-3 text-xs font-semibold">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Pacientes con Diabetes:</span>
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">{chronicConditions.diabetes} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Pacientes con Hipertensión:</span>
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">{chronicConditions.hypertension} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Pacientes con Asma:</span>
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">{chronicConditions.asthma} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Pacientes con EPOC:</span>
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">{chronicConditions.epoc} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Pacientes Cardiovasculares:</span>
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">{chronicConditions.cardiovascular} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Pacientes Renales (Diálisis):</span>
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">{chronicConditions.renal} casos</span>
                  </div>
                </div>
              </div>

              {/* Infection & Outbreak Risk Card */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-warning-variant">coronavirus</span>
                  Brotes & Riesgo Infeccioso
                </h3>
                <div className="flex flex-col gap-3 text-xs font-semibold">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Casos de Tuberculosis (Aislamiento):</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${chronicConditions.tuberculosis > 0 ? 'bg-error text-on-error animate-pulse' : 'bg-success/15 text-success'}`}>
                      {chronicConditions.tuberculosis} casos
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Escabiosis (Sarna) / Pediculosis:</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${chronicConditions.escabiosis > 0 ? 'bg-warning text-warning-variant' : 'bg-success/15 text-success'}`}>
                      {chronicConditions.escabiosis} casos
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Afecciones Gastrointestinales:</span>
                    <span className="bg-warning/10 text-warning-variant px-2 py-0.5 rounded-full font-bold">{chronicConditions.gastrointestinal} casos</span>
                  </div>
                </div>
              </div>

              {/* Neurological & Mental Health Card */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">psychology</span>
                  Salud Mental & Neurológica
                </h3>
                <div className="flex flex-col gap-3 text-xs font-semibold">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Epilepsia / Crisis Convulsivas:</span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{chronicConditions.epilepsia} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Trastornos Psiquiátricos (Crisis):</span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{chronicConditions.psiquiatrico} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Inmunocomprometidos (VIH/Onco):</span>
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">{chronicConditions.inmunocomprometido} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Endémicas (Dengue/Paludismo):</span>
                    <span className="bg-warning/10 text-warning-variant px-2 py-0.5 rounded-full font-bold">{chronicConditions.endemica} casos</span>
                  </div>
                </div>
              </div>

              {/* Disability & Mobility Card */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">accessible</span>
                  Discapacidad y Movilidad
                </h3>
                <div className="flex flex-col gap-3 text-xs font-semibold">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Discapacidad Motora:</span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{disabilities.motora} personas</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Discapacidad Visual:</span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{disabilities.visual} personas</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Discapacidad Auditiva:</span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{disabilities.auditiva} personas</span>
                  </div>
                </div>
              </div>

              {/* Nutritional Alerts Card */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary">nutrition</span>
                  Alertas Nutricionales y Alergias
                </h3>
                <div className="flex flex-col gap-3 text-xs font-semibold">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Madres Lactantes:</span>
                    <span className="bg-tertiary/15 text-tertiary px-2 py-0.5 rounded-full font-bold">{nutritionalAlerts.madreLactante} registradas</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Embarazadas:</span>
                    <span className="bg-tertiary/15 text-tertiary px-2 py-0.5 rounded-full font-bold">{nutritionalAlerts.embarazada} registradas</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Lactantes (0-12 meses):</span>
                    <span className="bg-tertiary/15 text-tertiary px-2 py-0.5 rounded-full font-bold">{nutritionalAlerts.lactanteBebe} bebés</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Dietas Blandas (Adulto Mayor):</span>
                    <span className="bg-tertiary/15 text-tertiary px-2 py-0.5 rounded-full font-bold">{nutritionalAlerts.adultoDietaBlanda} casos</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Alergias Reportadas:</span>
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full font-bold">{nutritionalAlerts.allergiesCount} casos</span>
                  </div>
                </div>
              </div>

              {/* Critical Supplies Logistics (Diapers & Formulas) */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-md font-bold text-primary mb-3">Suministros Críticos Prioritarios</h4>
                  <div className="border border-outline-variant p-4 rounded-xl flex items-center justify-between bg-primary/5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary block">Demanda Estimada de Pañales / Fórmulas</span>
                      <p className="text-xs text-on-surface-variant mt-0.5">Familias albergadas que requieren pañales o formulas de apoyo.</p>
                    </div>
                    <span className="text-2xl font-black text-primary bg-surface border border-primary/20 px-4 py-2 rounded-xl">
                      {logisticsAlerts.requiresDiapers} Fam.
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-bold text-primary mb-3">Espacios de Juego & Escolarización</h4>
                  <div className="border border-outline-variant p-4 rounded-xl flex items-center justify-between bg-success/5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-success block">Censo de Niños y Menores</span>
                      <p className="text-xs text-on-surface-variant mt-0.5">Menores a cargo que requieren kits escolares o actividades recreativas.</p>
                    </div>
                    <span className="text-2xl font-black text-success bg-surface border border-success/20 px-4 py-2 rounded-xl">
                      {totalMinors} Niños
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SOCIOECONÓMICO Y VIVIENDA */}
          {activeTab === 'socio' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
              
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-warning-variant">assignment_ind</span>
                  Protección & Documentación
                </h3>
                <div className="flex flex-col gap-4 text-xs font-semibold">
                  <div className="bg-warning/10 border border-warning/20 p-4 rounded-xl flex flex-col gap-2">
                    <span className="text-xl font-bold text-warning-variant">{logisticsAlerts.lostDocs} indocumentados</span>
                    <p className="text-[10px] text-on-surface-variant font-medium leading-relaxed">
                      Residentes que perdieron su cédula física. Coordine un operativo del SAIME en el campamento temporal para agilizar su documentación.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">home_work</span>
                  Estatus Vivienda de Procedencia
                </h3>
                <div className="flex flex-col gap-4 text-xs font-semibold">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Colapso Total / Destruida:</span>
                    <span className="bg-error/15 text-error px-2 py-0.5 rounded-full font-bold">{housingStatus.destruida} viviendas</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Daño Estructural (Inhabitable):</span>
                    <span className="bg-warning/15 text-warning-variant px-2 py-0.5 rounded-full font-bold">{housingStatus.inhabitable} viviendas</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Daño Leve / Evaluando:</span>
                    <span className="bg-success/15 text-success px-2 py-0.5 rounded-full font-bold">{housingStatus.leve} viviendas</span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">work</span>
                  Situación Laboral & Tenencia
                </h3>
                <div className="flex flex-col gap-4 text-xs font-semibold">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Tiene Empleo Activo:</span>
                    <span className="bg-success/15 text-success px-2 py-0.5 rounded-full font-bold">{employmentStatus.employed} personas</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Desempleados / Sin Empleo:</span>
                    <span className="bg-error/15 text-error px-2 py-0.5 rounded-full font-bold">{employmentStatus.unemployed} personas</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Propietarios de Vivienda:</span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{housingTenure.propietario} familias</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                    <span className="text-on-surface-variant">Inquilinos anteriores:</span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{housingTenure.inquilino} familias</span>
                  </div>
                </div>
              </div>

              {/* Pets Census - Mision Nevado */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs lg:col-span-3">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-success">pets</span>
                  Censo de Mascotas (Coordinación Misión Nevado)
                </h3>
                <div className="flex justify-between items-center bg-success/5 p-4 rounded-xl border border-success/20 mb-4 text-xs font-bold">
                  <span>Familias con Mascotas en el Refugio:</span>
                  <span className="text-md text-success">{petsCensus.countWithPets} núcleos familiares</span>
                </div>

                {petsCensus.list.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {petsCensus.list.map((pet, idx) => (
                      <div key={idx} className="p-3 border border-outline-variant rounded-lg bg-surface flex flex-col gap-1">
                        <p className="font-bold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">sound_detection_dog_barking</span>
                          {pet.name}
                        </p>
                        <p><strong>Especie:</strong> {pet.species} | <strong>Raza:</strong> {pet.breed}</p>
                        <p className="text-[10px] text-on-surface-variant"><strong>Representante:</strong> {pet.owner}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant italic text-center py-6">No se reportan mascotas albergadas en esta sede.</p>
                )}
              </div>

            </div>
          )}
        </>
      )}

    </div>
  );
}
