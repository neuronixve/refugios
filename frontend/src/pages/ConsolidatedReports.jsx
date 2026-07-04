import React, { useState, useEffect } from 'react';

export default function ConsolidatedReports({ token }) {
  const [refugios, setRefugios] = useState([]);
  const [residents, setResidents] = useState([]);
  const [beds, setBeds] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [scope, setScope] = useState('Nacional'); // 'Nacional' or a specific Venezuelan State
  const [selectedState, setSelectedState] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Interactive Pathology Modal State
  const [selectedPathology, setSelectedPathology] = useState(null);
  const [showPathologyModal, setShowPathologyModal] = useState(false);

  // Interactive Socio-economic Modal State
  const [selectedSocioCategory, setSelectedSocioCategory] = useState(null); // 'SAIME', 'Trabajo_Con', 'Trabajo_Sin', 'Vivienda'
  const [showSocioModal, setShowSocioModal] = useState(false);

  const [stats, setStats] = useState({
    totalRefugios: 0,
    totalResidents: 0,
    males: 0,
    females: 0,
    kids0_2: { total: 0, M: 0, F: 0 },
    kids3_5: { total: 0, M: 0, F: 0 },
    kids6_11: { total: 0, M: 0, F: 0 },
    kids12_17: { total: 0, M: 0, F: 0 },
    adults: 0,
    elderly: 0,
    totalSchoolAge: 0,
    schooled: 0,
    notSchooled: 0,
    schools: {},
    pregnantCount: 0,
    diabetesCount: 0,
    hypertensionCount: 0,
    asthmaCount: 0,
    renalCount: 0,
    othersCount: 0,

    // New socio-economic metrics
    sinCedulaCount: 0,
    employedCount: 0,
    unemployedCount: 0,
    totalAdults: 0,
    lostHomeFamiliesCount: 0,
    lostHomePeopleCount: 0
  });

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : '/refugios/api';

  // Venezuelan States list for filtering
  const VENEZUELAN_STATES = [
    'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 
    'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'Lara', 'Mérida', 'Miranda', 
    'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Vargas', 'Yaracuy', 'Zulia'
  ];

  useEffect(() => {
    fetchGlobalData();
  }, []);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [resRefugios, resResidents, resBeds, resIncidents, resInv] = await Promise.all([
        fetch(`${API_BASE}/refugios`, { headers }),
        fetch(`${API_BASE}/damnificados`, { headers }),
        fetch(`${API_BASE}/refugios`, { headers }).then(res => res.json()).then(async list => {
          try {
            const bedsList = await Promise.all(list.map(r => 
              fetch(`${API_BASE}/refugios/${r.id}/beds`, { headers }).then(res => res.json()).catch(() => [])
            ));
            return bedsList.flat();
          } catch {
            return [];
          }
        }).catch(() => []),
        fetch(`${API_BASE}/incidents`, { headers }).catch(() => []),
        fetch(`${API_BASE}/inventory`, { headers }).catch(() => [])
      ]);

      if (resRefugios && resRefugios.ok) {
        setRefugios(await resRefugios.json());
      }

      if (resResidents && resResidents.ok) {
        const data = await resResidents.json();
        setResidents(data.filter(d => d.status === 'Activo'));
      }

      if (Array.isArray(resBeds)) {
        setBeds(resBeds);
      }

      if (resIncidents && resIncidents.ok) {
        setIncidents(await resIncidents.json());
      } else if (Array.isArray(resIncidents)) {
        setIncidents(resIncidents);
      }

      if (resInv && resInv.ok) {
        setInventory(await resInv.json());
      } else if (Array.isArray(resInv)) {
        setInventory(resInv);
      }
    } catch (err) {
      console.error("Error loading consolidated reports:", err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic lists filtering based on scope/state & date range
  const getFilteredData = () => {
    let filteredRefugios = [...refugios];
    
    // Filter refugios by State if scope is State
    if (scope === 'Estado' && selectedState) {
      filteredRefugios = filteredRefugios.filter(r => 
        (r.estado && r.estado.toLowerCase() === selectedState.toLowerCase()) ||
        (!r.estado && r.location.toLowerCase().includes(selectedState.toLowerCase()))
      );
    }
    
    const refIds = filteredRefugios.map(r => r.id);

    // Filter residents by Refugios scope
    let resList = residents.filter(r => refIds.includes(r.refugio_id));
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      resList = resList.filter(r => new Date(r.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      resList = resList.filter(r => new Date(r.created_at) <= end);
    }

    // Filter incidents
    let incList = incidents.filter(i => refIds.includes(i.refugio_id));
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      incList = incList.filter(i => new Date(i.logged_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      incList = incList.filter(i => new Date(i.logged_at) <= end);
    }

    // Filter beds
    const bedsList = beds.filter(b => refIds.includes(b.refugio_id));

    // Filter inventory
    const invList = inventory.filter(i => refIds.includes(i.refugio_id));

    return { 
      filteredRefugios, 
      filteredResidents: resList, 
      filteredIncidents: incList, 
      filteredBeds: bedsList, 
      filteredInventory: invList 
    };
  };

  const { 
    filteredRefugios, 
    filteredResidents, 
    filteredIncidents, 
    filteredBeds, 
    filteredInventory 
  } = getFilteredData();

  useEffect(() => {
    calculateStats(filteredResidents);
  }, [residents, scope, selectedState, startDate, endDate]);

  const calculateStats = (list) => {
    let males = 0;
    let females = 0;
    let kids0_2 = { total: 0, M: 0, F: 0 };
    let kids3_5 = { total: 0, M: 0, F: 0 };
    let kids6_11 = { total: 0, M: 0, F: 0 };
    let kids12_17 = { total: 0, M: 0, F: 0 };
    let adults = 0;
    let elderly = 0;

    let totalSchoolAge = 0;
    let schooled = 0;
    let notSchooled = 0;
    let schools = {};

    let pregnantCount = 0;
    let diabetesCount = 0;
    let hypertensionCount = 0;
    let asthmaCount = 0;
    let renalCount = 0;
    let othersCount = 0;

    // Socio-economic
    let sinCedulaCount = 0;
    let employedCount = 0;
    let unemployedCount = 0;
    let totalAdults = 0;
    let lostHomeFamilies = new Set();
    let lostHomePeopleCount = 0;

    list.forEach(r => {
      if (r.gender === 'Masculino') males++;
      else if (r.gender === 'Femenino') females++;

      let meta = {};
      try {
        meta = r.special_needs ? JSON.parse(r.special_needs) : {};
      } catch {
        meta = {};
      }

      // SAIME: People without document ID
      const noCedulaId = !r.document_id || r.document_id.trim() === '' || r.document_id.toLowerCase().startsWith('temp') || r.document_id.toLowerCase().startsWith('sin');
      if (noCedulaId || meta.documento_perdido === true) {
        sinCedulaCount++;
      }

      if (meta.embarazo || meta.embarazada || meta.nutricion_especial === 'Embarazada') {
        pregnantCount++;
      }

      const preexisting = meta.preexisting || [];
      if (preexisting.includes('Diabetes')) diabetesCount++;
      if (preexisting.includes('Hipertensión')) hypertensionCount++;
      if (preexisting.includes('Asma')) asthmaCount++;
      if (preexisting.includes('Renal (Diálisis)')) renalCount++;
      if (preexisting.some(p => p.startsWith('Otros:'))) othersCount++;

      let age = null;
      if (r.birth_date) {
        const birth = new Date(r.birth_date);
        const today = new Date();
        age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
      }

      const isAdult = age !== null ? age >= 18 : true;

      // Employment
      if (isAdult) {
        totalAdults++;
        const jobStatus = meta.empleo?.tiene_empleo || meta.tiene_empleo;
        if (jobStatus === 'Sí') {
          employedCount++;
        } else {
          unemployedCount++;
        }
      }

      // Housing loss
      if (meta.estado_vivienda === 'Colapso total / Destruida') {
        if (r.family_group_id) {
          lostHomeFamilies.add(r.family_group_id);
        } else {
          lostHomeFamilies.add(`single-${r.id}`);
        }
      }

      if (age !== null) {
        if (age < 18) {
          if (age >= 3 && age <= 17) {
            totalSchoolAge++;
            if (meta.escolarizado === 'Sí') {
              schooled++;
              const schoolName = meta.centro_educativo || 'Centro No Especificado';
              schools[schoolName] = (schools[schoolName] || 0) + 1;
            } else {
              notSchooled++;
            }
          }

          if (age <= 2) {
            kids0_2.total++;
            if (r.gender === 'Masculino') kids0_2.M++;
            else kids0_2.F++;
          } else if (age <= 5) {
            kids3_5.total++;
            if (r.gender === 'Masculino') kids3_5.M++;
            else kids3_5.F++;
          } else if (age <= 11) {
            kids6_11.total++;
            if (r.gender === 'Masculino') kids6_11.M++;
            else kids6_11.F++;
          } else {
            kids12_17.total++;
            if (r.gender === 'Masculino') kids12_17.M++;
            else kids12_17.F++;
          }
        } else if (age >= 60) {
          elderly++;
        } else {
          adults++;
        }
      } else {
        adults++;
      }
    });

    // Count people belonging to affected family groups
    list.forEach(r => {
      let meta = {};
      try {
        meta = r.special_needs ? JSON.parse(r.special_needs) : {};
      } catch {
        meta = {};
      }
      const isDirectLoss = meta.estado_vivienda === 'Colapso total / Destruida';
      const belongsToAffectedFamily = r.family_group_id && lostHomeFamilies.has(r.family_group_id);
      const isAffectedSingle = !r.family_group_id && lostHomeFamilies.has(`single-${r.id}`);

      if (isDirectLoss || belongsToAffectedFamily || isAffectedSingle) {
        lostHomePeopleCount++;
      }
    });

    setStats({
      totalRefugios: filteredRefugios.length,
      totalResidents: list.length,
      males,
      females,
      kids0_2,
      kids3_5,
      kids6_11,
      kids12_17,
      adults,
      elderly,
      totalSchoolAge,
      schooled,
      notSchooled,
      schools,
      pregnantCount,
      diabetesCount,
      hypertensionCount,
      asthmaCount,
      renalCount,
      othersCount,

      // Socio-economic
      sinCedulaCount,
      employedCount,
      unemployedCount,
      totalAdults,
      lostHomeFamiliesCount: lostHomeFamilies.size,
      lostHomePeopleCount
    });
  };

  // beds
  const totalBeds = filteredBeds.length;
  const occupiedBeds = filteredBeds.filter(b => b.status === 'Ocupada').length;
  const availableBeds = totalBeds - occupiedBeds;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // incidents
  const safetyEmergencies = filteredIncidents.filter(i => i.incident_type === 'Emergencia').length;
  const safetyAltercations = filteredIncidents.filter(i => i.incident_type === 'Altercado').length;
  const safetyNovedades = filteredIncidents.filter(i => i.incident_type === 'Novedad').length;

  // inventory
  const totalItemsInStock = filteredInventory.reduce((sum, item) => sum + item.quantity, 0);
  const inventoryByCategory = {};
  filteredInventory.forEach(item => {
    inventoryByCategory[item.category] = (inventoryByCategory[item.category] || 0) + item.quantity;
  });

  const criticalMedicines = filteredInventory.filter(item => 
    item.category === 'Medicinas' && (item.quantity <= item.min_threshold || item.quantity === 0)
  );

  const criticalOtherSupplies = filteredInventory.filter(item => 
    item.category !== 'Medicinas' && (item.quantity <= item.min_threshold || item.quantity === 0)
  );

  const printModalList = () => {
    const printContent = document.getElementById('modal-print-area').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Reporte Detallado Consolidado</title>
          <style>
            body { font-family: sans-serif; padding: 25px; color: #333; font-size: 11px; }
            h3 { color: #0f172a; text-transform: uppercase; font-size: 14px; margin-bottom: 2px; }
            p { color: #475569; font-size: 10px; margin-top: 0; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; color: #0f172a; text-transform: uppercase; font-size: 9px; }
            .font-bold { font-weight: bold; }
            .text-primary { color: #0284c7; }
            .text-success { color: #16a34a; }
            .text-error { color: #dc2626; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 8px; font-weight: bold; text-transform: uppercase; }
            .bg-success { background-color: #dcfce7; color: #15803d; }
            .bg-error { background-color: #fee2e2; color: #b91c1c; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // Get list of residents with the selected pathology for the modal view
  const getPathologyResidents = () => {
    if (!selectedPathology) return [];
    return filteredResidents.filter(r => {
      let meta = {};
      try {
        meta = r.special_needs ? JSON.parse(r.special_needs) : {};
      } catch {
        meta = {};
      }
      
      const pre = meta.preexisting || [];
      if (selectedPathology === 'Otras Patologías') {
        return pre.some(p => p.startsWith('Otros:'));
      }
      return pre.includes(selectedPathology);
    });
  };

  // Get list of residents for the socioeconomic modal
  const getSocioResidents = () => {
    if (!selectedSocioCategory) return [];
    return filteredResidents.filter(r => {
      let meta = {};
      try {
        meta = r.special_needs ? JSON.parse(r.special_needs) : {};
      } catch {
        meta = {};
      }

      if (selectedSocioCategory === 'SAIME') {
        const noCedulaId = !r.document_id || r.document_id.trim() === '' || r.document_id.toLowerCase().startsWith('temp') || r.document_id.toLowerCase().startsWith('sin');
        return noCedulaId || meta.documento_perdido === true;
      }

      if (selectedSocioCategory === 'Trabajo_Con' || selectedSocioCategory === 'Trabajo_Sin') {
        let age = null;
        if (r.birth_date) {
          const birth = new Date(r.birth_date);
          const today = new Date();
          age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
        }
        const isAdult = age !== null ? age >= 18 : true;
        if (!isAdult) return false;

        const hasJobVal = meta.empleo?.tiene_empleo || meta.tiene_empleo;
        if (selectedSocioCategory === 'Trabajo_Con') {
          return hasJobVal === 'Sí';
        } else {
          return hasJobVal !== 'Sí';
        }
      }

      if (selectedSocioCategory === 'Vivienda') {
        const lostHomeFamilies = new Set();
        filteredResidents.forEach(curr => {
          let currMeta = {};
          try {
            currMeta = curr.special_needs ? JSON.parse(curr.special_needs) : {};
          } catch {
            currMeta = {};
          }
          if (currMeta.estado_vivienda === 'Colapso total / Destruida') {
            if (curr.family_group_id) {
              lostHomeFamilies.add(curr.family_group_id);
            } else {
              lostHomeFamilies.add(`single-${curr.id}`);
            }
          }
        });

        const belongsToAffectedFamily = r.family_group_id && lostHomeFamilies.has(r.family_group_id);
        const isAffectedSingle = !r.family_group_id && lostHomeFamilies.has(`single-${r.id}`);
        return meta.estado_vivienda === 'Colapso total / Destruida' || belongsToAffectedFamily || isAffectedSingle;
      }

      return false;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Stylesheet dynamically injected for letter printable formatting with 1cm margins */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: letter portrait;
            margin: 18mm 18mm 18mm 18mm;
          }
          body, html {
            background: white !important;
            color: black !important;
            font-size: 10px !important;
          }
          .no-print, header.fixed, aside, nav, .sidebar, .navbar, button, .tabs {
            display: none !important;
          }
          .flex-1.flex.pt-20 {
            padding-top: 0 !important;
          }
          main, .max-w-7xl, .lg\\:ml-\\[280px\\] {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-header {
            display: flex !important;
            flex-direction: column !important;
            margin-bottom: 24px !important;
            border-bottom: 2px solid #000000 !important;
            padding-bottom: 12px !important;
          }
          .grid {
            display: grid !important;
            gap: 16px !important;
          }
          .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .grid.grid-cols-2.md\\:grid-cols-5 {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }
          .grid.grid-cols-2.md\\:grid-cols-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
          .grid.grid-cols-1.lg\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .grid.grid-cols-1.lg\\:grid-cols-12 {
            grid-template-columns: 1fr !important;
          }
          .lg\\:col-span-7, .lg\\:col-span-5, .lg\\:col-span-6 {
            grid-column: span 12 / span 12 !important;
            width: 100% !important;
          }
          .bg-surface-container-lowest, .bg-surface, .bg-primary/5, .bg-error/5, .bg-warning-container/10 {
            background-color: white !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border-bottom: 1px solid #cbd5e1 !important;
            padding: 8px 10px !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          .page-break {
            page-break-before: always !important;
          }
        }
      `}} />

      {/* Official printed header banner */}
      <div className="hidden print-header flex-col gap-2">
        <div className="flex justify-between items-center">
          <h1 className="text-md font-black uppercase text-black tracking-tight">SISTEMA INTEGRAL DE GESTIÓN DE REFUGIOS</h1>
          <span className="text-[9px] font-semibold">{new Date().toLocaleString()}</span>
        </div>
        <div className="text-[10px] text-gray-700">
          <strong>REPORTE OPERATIVO CONSOLIDADO NACIONAL Y ESTADAL</strong>
          <span className="block text-[9px] mt-0.5">Ámbito de Consulta: {scope === 'Nacional' ? 'República Bolivariana de Venezuela (Consolidado Nacional)' : `Estado ${selectedState}`}</span>
        </div>
        {(startDate || endDate) && (
          <div className="text-[9px] text-gray-600">
            Filtro de fecha aplicado: Desde {startDate || 'Inicio'} hasta {endDate || 'Hoy'}
          </div>
        )}
      </div>

      {/* Page Header */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">public</span>
            <h2 className="text-xl font-black text-on-surface uppercase tracking-tight">Reporte Consolidado de País</h2>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">Visión operativa consolidada por Estado y Rango de tiempo para Presidencia de la República.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-success text-on-success text-xs font-black uppercase rounded-lg hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">picture_as_pdf</span>
            Exportar Reporte (PDF)
          </button>
          <button 
            onClick={fetchGlobalData}
            className="px-4 py-2 bg-primary text-on-primary text-xs font-black uppercase rounded-lg hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">refresh</span>
            Recargar
          </button>
        </div>
      </header>

      {/* Scope and Date Filters row */}
      <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl shadow-xs mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 no-print text-xs">
        
        {/* Scope selector */}
        <div>
          <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-1">Ámbito Territorial</label>
          <select 
            value={scope}
            onChange={e => {
              setScope(e.target.value);
              if (e.target.value === 'Nacional') setSelectedState('');
            }}
            className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none font-bold"
          >
            <option value="Nacional">Venezuela (Consolidado Nacional)</option>
            <option value="Estado">Por Estado Específico</option>
          </select>
        </div>

        {/* State select list */}
        <div>
          <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-1">Seleccionar Estado</label>
          <select 
            value={selectedState}
            onChange={e => setSelectedState(e.target.value)}
            disabled={scope === 'Nacional'}
            className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none font-bold disabled:opacity-50"
          >
            <option value="">-- Seleccione un Estado --</option>
            {VENEZUELAN_STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-1">Fecha Inicial (Desde)</label>
          <input 
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-1">Fecha Final (Hasta)</label>
          <input 
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
          />
        </div>

      </div>

      {loading ? (
        <div className="text-center py-20 text-on-surface-variant font-medium text-xs flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          Consolidando datos nacionales...
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* SECTION 1: GLOBAL KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: TOTAL REFUGIOS */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-2xs flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-wider">Refugios Monitoreados</span>
                <span className="material-symbols-outlined text-primary text-lg no-print">corporate_fare</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-on-surface">{stats.totalRefugios}</span>
                <span className="text-[10px] text-on-surface-variant font-bold">Centros Activos</span>
              </div>
              <div className="text-[10px] text-on-surface-variant border-t border-outline-variant/30 pt-2 mt-1 font-semibold">
                Estado seleccionado: <strong className="text-primary">{scope === 'Nacional' ? 'Todos' : selectedState || 'No especificado'}</strong>
              </div>
            </div>

            {/* KPI 2: CENSO POBLACIONAL */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-2xs flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-wider">Población Total</span>
                <span className="material-symbols-outlined text-primary text-lg no-print">groups</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-on-surface">{stats.totalResidents}</span>
                <span className="text-[10px] text-on-surface-variant font-bold">Residentes Activos</span>
              </div>
              <div className="text-[10px] text-on-surface-variant flex gap-3 border-t border-outline-variant/30 pt-2 mt-1 font-semibold">
                <span>Hombres: {stats.males}</span>
                <span>Mujeres: {stats.females}</span>
              </div>
            </div>

            {/* KPI 3: CAPACIDAD Y OCUPACIÓN */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-2xs flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-wider">Ocupación Consolidada</span>
                <span className="material-symbols-outlined text-primary text-lg no-print">bed</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-on-surface">{occupancyRate}%</span>
                <span className="text-[10px] text-on-surface-variant font-bold">Camas Ocupadas</span>
              </div>
              <div className="text-[10px] text-on-surface-variant flex justify-between border-t border-outline-variant/30 pt-2 mt-1">
                <span>Camas Libres: <strong className="text-on-surface">{availableBeds}</strong></span>
                <span>Total: <strong className="text-on-surface">{totalBeds}</strong></span>
              </div>
            </div>

            {/* KPI 4: SEGURIDAD INCIDENCIAS */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-2xs flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-wider">Incidencias Consolidadas</span>
                <span className="material-symbols-outlined text-primary text-lg no-print">assignment_late</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-on-surface">{filteredIncidents.length}</span>
                <span className="text-[10px] text-on-surface-variant font-bold">Casos de Seguridad</span>
              </div>
              <div className="text-[9px] text-on-surface-variant flex gap-2 border-t border-outline-variant/30 pt-2 mt-1 font-semibold">
                <span className="bg-error/15 text-error px-1.5 py-0.5 rounded">{safetyEmergencies} Urgentes</span>
                <span className="bg-warning/20 text-warning px-1.5 py-0.5 rounded">{safetyAltercations} Altercados</span>
              </div>
            </div>

          </div>

          {/* SOCIO-ECONOMIC AND VULNERABILITY METRICS */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-3 mb-4">
              <span className="material-symbols-outlined text-sm text-primary no-print">analytics</span>
              Indicadores Socioeconómicos y de Afectación de Vivienda
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* SAIME Census CARD */}
              <button 
                onClick={() => {
                  setSelectedSocioCategory('SAIME');
                  setShowSocioModal(true);
                }}
                className="bg-surface border border-outline-variant/50 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:bg-primary/5 hover:border-primary transition-all text-left focus:outline-none cursor-pointer"
              >
                <div>
                  <span className="text-[9px] font-black text-error uppercase tracking-wider block mb-1">Censo Nacional SAIME (Identificación)</span>
                  <strong className="text-2xl font-black text-on-surface block mt-1">{stats.sinCedulaCount}</strong>
                  <span className="text-[10px] text-on-surface-variant block mt-1.5">Personas sin cédula o documentación extraviada registradas en el territorio.</span>
                  <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-2 inline-block font-bold no-print">Ver listado completo</span>
                </div>
              </button>

              {/* Employment CARD with split clicks */}
              <div className="bg-surface border border-outline-variant/50 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[9px] font-black text-primary uppercase tracking-wider block mb-1">Situación Laboral (Mayores de Edad)</span>
                  
                  <div className="flex justify-between items-center mt-2 border-b border-outline-variant/20 pb-3">
                    <button 
                      onClick={() => {
                        setSelectedSocioCategory('Trabajo_Con');
                        setShowSocioModal(true);
                      }}
                      className="text-left hover:bg-success/5 p-2 rounded-lg transition-all focus:outline-none cursor-pointer border border-transparent hover:border-success/20 flex-1 mr-1"
                    >
                      <span className="text-xl font-black text-success block">{stats.employedCount}</span>
                      <span className="text-[10px] text-on-surface-variant font-bold">Con Trabajo</span>
                      <span className="text-[8px] text-primary block mt-0.5 underline">Ver lista</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setSelectedSocioCategory('Trabajo_Sin');
                        setShowSocioModal(true);
                      }}
                      className="text-left hover:bg-error/5 p-2 rounded-lg transition-all focus:outline-none cursor-pointer border border-transparent hover:border-error/20 flex-1 ml-1"
                    >
                      <span className="text-xl font-black text-error block">{stats.unemployedCount}</span>
                      <span className="text-[10px] text-on-surface-variant font-bold">Desempleados</span>
                      <span className="text-[8px] text-primary block mt-0.5 underline">Ver lista</span>
                    </button>
                  </div>

                  <span className="text-[10px] text-on-surface-variant block mt-2">
                    Total Evaluados: <strong>{stats.totalAdults} mayores de edad</strong>
                  </span>
                </div>
              </div>

              {/* Housing Loss CARD */}
              <button 
                onClick={() => {
                  setSelectedSocioCategory('Vivienda');
                  setShowSocioModal(true);
                }}
                className="bg-surface border border-outline-variant/50 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:bg-primary/5 hover:border-primary transition-all text-left focus:outline-none cursor-pointer"
              >
                <div>
                  <span className="text-[9px] font-black text-warning uppercase tracking-wider block mb-1">Damnificados Pérdida Total de Vivienda</span>
                  <strong className="text-2xl font-black text-on-surface block mt-1">{stats.lostHomeFamiliesCount} familias</strong>
                  <span className="text-[10px] text-on-surface-variant block mt-1 font-bold text-primary">
                    Personas Afectadas: {stats.lostHomePeopleCount} residentes
                  </span>
                  <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-2 inline-block font-bold no-print">Ver familias damnificadas</span>
                </div>
              </button>

            </div>
          </div>

          {/* SECTION 2: SHELTERS COMPARATIVE LIST */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-3 mb-4">
              <span className="material-symbols-outlined text-sm text-primary no-print">corporate_fare</span>
              Registro Detallado de Centros de Refugio ({filteredRefugios.length})
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface/30">
                    <th className="py-2.5 px-3 rounded-l-lg">Nombre del Refugio</th>
                    <th className="py-2.5 px-3">Ubicación / Estado</th>
                    <th className="py-2.5 px-3 text-center">Censo Activo</th>
                    <th className="py-2.5 px-3 text-center">Ocupación Camas</th>
                    <th className="py-2.5 px-3 text-center">Casos Médicos</th>
                    <th className="py-2.5 px-3 text-center rounded-r-lg">Alertas Críticas Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRefugios.length > 0 ? (
                    filteredRefugios.map(ref => {
                      const refResidents = filteredResidents.filter(r => r.refugio_id === ref.id);
                      const refBeds = filteredBeds.filter(b => b.refugio_id === ref.id);
                      const totalBedsCount = refBeds.length;
                      const occupiedBedsCount = refBeds.filter(b => b.status === 'Ocupada').length;
                      const bedsText = totalBedsCount > 0 ? `${occupiedBedsCount}/${totalBedsCount} (${Math.round((occupiedBedsCount/totalBedsCount)*100)}%)` : '0/0';
                      
                      // Critical cases count
                      const medicalCritical = refResidents.filter(r => r.health_status !== 'Estable').length;
                      
                      // Critical stock warnings count
                      const criticalStock = filteredInventory.filter(i => i.refugio_id === ref.id && (i.quantity <= i.min_threshold || i.quantity === 0)).length;

                      return (
                        <tr key={ref.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-all">
                          <td className="py-3 px-3 font-bold text-primary">{ref.name}</td>
                          <td className="py-3 px-3 text-on-surface-variant font-semibold">{ref.estado || ref.location}</td>
                          <td className="py-3 px-3 text-center font-bold">{refResidents.length} res.</td>
                          <td className="py-3 px-3 text-center font-semibold text-on-surface">{bedsText}</td>
                          <td className="py-3 px-3 text-center">
                            {medicalCritical > 0 ? (
                              <span className="bg-error/15 text-error px-2 py-0.5 rounded font-black text-[9px]">
                                {medicalCritical} Bajo Obs.
                              </span>
                            ) : (
                              <span className="text-success font-bold text-[10px]">Estable</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {criticalStock > 0 ? (
                              <span className="bg-warning/20 text-warning px-2 py-0.5 rounded font-black text-[9px]">
                                {criticalStock} Alertas
                              </span>
                            ) : (
                              <span className="text-success font-bold text-[10px]">Suficiente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-on-surface-variant italic">No se encontraron sedes operativas registradas en el ámbito territorial seleccionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: DEMOGRAPHICS & SCHOOLS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* DEMOGRAPHICS MINORS BREAKDOWN (7 Cols) */}
            <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-3">
                <span className="material-symbols-outlined text-sm text-primary no-print">child_care</span>
                Demografía Nacional de Menores de Edad
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                      <th className="pb-3">Rango de Edad / Categoría</th>
                      <th className="pb-3 text-center">Femenino (Niñas)</th>
                      <th className="pb-3 text-center">Masculino (Niños)</th>
                      <th className="pb-3 text-right">Total Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-outline-variant/30">
                      <td className="py-3 font-semibold text-on-surface flex items-center gap-1">
                        🍼 Primera Infancia <span className="text-[10px] text-on-surface-variant font-normal">(0-2 años)</span>
                      </td>
                      <td className="py-3 text-center font-bold text-primary">{stats.kids0_2.F}</td>
                      <td className="py-3 text-center font-bold text-primary">{stats.kids0_2.M}</td>
                      <td className="py-3 text-right font-black text-on-surface">{stats.kids0_2.total}</td>
                    </tr>
                    <tr className="border-b border-outline-variant/30">
                      <td className="py-3 font-semibold text-on-surface flex items-center gap-1">
                        🧸 Preescolar <span className="text-[10px] text-on-surface-variant font-normal">(3-5 años)</span>
                      </td>
                      <td className="py-3 text-center font-bold text-primary">{stats.kids3_5.F}</td>
                      <td className="py-3 text-center font-bold text-primary">{stats.kids3_5.M}</td>
                      <td className="py-3 text-right font-black text-on-surface">{stats.kids3_5.total}</td>
                    </tr>
                    <tr className="border-b border-outline-variant/30">
                      <td className="py-3 font-semibold text-on-surface flex items-center gap-1">
                        🎒 Primaria <span className="text-[10px] text-on-surface-variant font-normal">(6-11 años)</span>
                      </td>
                      <td className="py-3 text-center font-bold text-primary">{stats.kids6_11.F}</td>
                      <td className="py-3 text-center font-bold text-primary">{stats.kids6_11.M}</td>
                      <td className="py-3 text-right font-black text-on-surface">{stats.kids6_11.total}</td>
                    </tr>
                    <tr className="border-b border-outline-variant/30">
                      <td className="py-3 font-semibold text-on-surface flex items-center gap-1">
                        🛹 Adolescentes / Sec. <span className="text-[10px] text-on-surface-variant font-normal">(12-17 años)</span>
                      </td>
                      <td className="py-3 text-center font-bold text-primary">{stats.kids12_17.F}</td>
                      <td className="py-3 text-center font-bold text-primary">{stats.kids12_17.M}</td>
                      <td className="py-3 text-right font-black text-on-surface">{stats.kids12_17.total}</td>
                    </tr>
                    <tr className="bg-primary/5 font-black text-primary">
                      <td className="py-3.5 px-2 rounded-l-lg uppercase tracking-wider text-[10px]">Total Menores registrados</td>
                      <td className="py-3.5 text-center">
                        {stats.kids0_2.F + stats.kids3_5.F + stats.kids6_11.F + stats.kids12_17.F}
                      </td>
                      <td className="py-3.5 text-center">
                        {stats.kids0_2.M + stats.kids3_5.M + stats.kids6_11.M + stats.kids12_17.M}
                      </td>
                      <td className="py-3.5 text-right pr-2 rounded-r-lg">
                        {stats.kids0_2.total + stats.kids3_5.total + stats.kids6_11.total + stats.kids12_17.total}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* REPRESENTED SCHOOLS LIST (5 Cols) */}
            <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-3">
                <span className="material-symbols-outlined text-sm text-primary no-print">local_library</span>
                Colegios y Matrículas en el Ámbito
              </h3>
              
              <div className="overflow-y-auto max-h-[220px] flex flex-col gap-2.5 custom-scrollbar pr-1">
                {Object.keys(stats.schools).length > 0 ? (
                  Object.entries(stats.schools).map(([schoolName, count]) => (
                    <div key={schoolName} className="bg-surface border border-outline-variant/40 rounded-xl p-3 flex justify-between items-center text-xs shadow-2xs">
                      <span className="font-bold text-on-surface max-w-[80%] truncate">{schoolName}</span>
                      <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-black text-[10px]">
                        {count} {count === 1 ? 'Alumno' : 'Alumnos'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant italic text-center py-10">No hay escolarizaciones registradas en los menores.</p>
                )}
              </div>
            </div>

          </div>

          {/* SECTION 4: CONSOLIDATED HEALTH SUMMARY */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs flex flex-col gap-6 page-break">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary no-print">clinical_notes</span>
                Consolidado de Pacientes y Diagnósticos de Salud
              </h3>
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary font-black text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Embarazadas: {stats.pregnantCount}
                </span>
                <span className="text-[10px] font-black text-on-surface-variant uppercase no-print italic">
                  *Haz clic en una patología para ver la lista de pacientes
                </span>
              </div>
            </div>

            {/* Health indicators as interactive buttons */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button 
                onClick={() => {
                  setSelectedPathology('Hipertensión');
                  setShowPathologyModal(true);
                }}
                className="bg-surface border border-outline-variant/50 rounded-xl p-3.5 text-center shadow-2xs hover:bg-primary/5 hover:border-primary transition-all cursor-pointer flex flex-col items-center justify-center focus:outline-none"
              >
                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Hipertensión</span>
                <span className="text-lg font-black text-primary mt-1 block">{stats.hypertensionCount}</span>
                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-1 font-bold no-print">Ver lista</span>
              </button>
              <button 
                onClick={() => {
                  setSelectedPathology('Diabetes');
                  setShowPathologyModal(true);
                }}
                className="bg-surface border border-outline-variant/50 rounded-xl p-3.5 text-center shadow-2xs hover:bg-primary/5 hover:border-primary transition-all cursor-pointer flex flex-col items-center justify-center focus:outline-none"
              >
                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Diabetes</span>
                <span className="text-lg font-black text-primary mt-1 block">{stats.diabetesCount}</span>
                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-1 font-bold no-print">Ver lista</span>
              </button>
              <button 
                onClick={() => {
                  setSelectedPathology('Asma');
                  setShowPathologyModal(true);
                }}
                className="bg-surface border border-outline-variant/50 rounded-xl p-3.5 text-center shadow-2xs hover:bg-primary/5 hover:border-primary transition-all cursor-pointer flex flex-col items-center justify-center focus:outline-none"
              >
                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Asma / Resp.</span>
                <span className="text-lg font-black text-primary mt-1 block">{stats.asthmaCount}</span>
                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-1 font-bold no-print">Ver lista</span>
              </button>
              <button 
                onClick={() => {
                  setSelectedPathology('Renal (Diálisis)');
                  setShowPathologyModal(true);
                }}
                className="bg-surface border border-outline-variant/50 rounded-xl p-3.5 text-center shadow-2xs hover:bg-primary/5 hover:border-primary transition-all cursor-pointer flex flex-col items-center justify-center focus:outline-none"
              >
                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Renal / Diálisis</span>
                <span className="text-lg font-black text-primary mt-1 block">{stats.renalCount}</span>
                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-1 font-bold no-print">Ver lista</span>
              </button>
              <button 
                onClick={() => {
                  setSelectedPathology('Otras Patologías');
                  setShowPathologyModal(true);
                }}
                className="bg-surface border border-outline-variant/50 rounded-xl p-3.5 text-center shadow-2xs hover:bg-primary/5 hover:border-primary transition-all cursor-pointer flex flex-col items-center justify-center col-span-2 md:col-span-1 focus:outline-none"
              >
                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Otras Patologías</span>
                <span className="text-lg font-black text-primary mt-1 block">{stats.othersCount}</span>
                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-1 font-bold no-print">Ver lista</span>
              </button>
            </div>
          </div>

          {/* SECTION 5: CRITICAL SUPPLY ALERTS (ALL REFUGIOS) */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs flex flex-col gap-6">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-3">
              <span className="material-symbols-outlined text-sm text-primary no-print">warning</span>
              Alertas de Suministros Críticos a Nivel Territorial
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* MEDICINES */}
              <div className="bg-error/5 border border-error/20 p-4 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] text-error font-black uppercase tracking-wider flex items-center gap-1 border-b border-error/15 pb-2">
                  <span className="material-symbols-outlined text-sm">emergency_home</span>
                  Medicamentos Críticos o Agotados
                </span>
                <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                  {criticalMedicines.length > 0 ? (
                    criticalMedicines.map(item => (
                      <div key={item.id} className="bg-surface border border-outline-variant/40 rounded-lg p-2.5 flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-on-surface">{item.item_name}</strong>
                          <span className="block text-[8px] text-primary uppercase font-bold">{item.refugio_name}</span>
                          <span className="block text-[8px] text-on-surface-variant">Min. Requerido: {item.min_threshold} | Stock: {item.quantity}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${item.quantity === 0 ? 'bg-error text-white animate-pulse' : 'bg-warning/20 text-warning'}`}>
                          {item.quantity === 0 ? 'Agotado' : `${item.quantity} u.`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant/80 italic text-center py-8">No hay alertas críticas en insumos de medicina.</p>
                  )}
                </div>
              </div>

              {/* OTHER SUPPLIES */}
              <div className="bg-warning-container/10 border border-warning/20 p-4 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] text-warning font-black uppercase tracking-wider flex items-center gap-1 border-b border-warning/15 pb-2">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Alimentos y Otros Insumos en Alerta
                </span>
                <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                  {criticalOtherSupplies.length > 0 ? (
                    criticalOtherSupplies.map(item => (
                      <div key={item.id} className="bg-surface border border-outline-variant/40 rounded-lg p-2.5 flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-on-surface">{item.item_name}</strong>
                          <span className="block text-[8px] text-primary uppercase font-bold">{item.refugio_name}</span>
                          <span className="block text-[8px] text-on-surface-variant">Categoría: {item.category} | Min. Requerido: {item.min_threshold} | Stock: {item.quantity}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${item.quantity === 0 ? 'bg-error text-white animate-pulse' : 'bg-warning/20 text-warning'}`}>
                          {item.quantity === 0 ? 'Agotado' : `${item.quantity} u.`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant/80 italic text-center py-8">No hay alertas críticas en otros insumos.</p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 6: CONSOLIDATED INCIDENTS LOG */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-3 mb-4">
              <span className="material-symbols-outlined text-sm text-primary no-print">warning</span>
              Historial Consolidado de Incidencias y Seguridad
            </h3>

            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
              {filteredIncidents.length > 0 ? (
                filteredIncidents.map(inc => {
                  const date = new Date(inc.logged_at).toLocaleDateString();
                  const time = new Date(inc.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={inc.id} className="border border-outline-variant/40 rounded-xl p-3 bg-surface/50 flex flex-col gap-2 text-xs">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                            inc.incident_type === 'Emergencia' ? 'bg-error text-on-error' :
                            inc.incident_type === 'Altercado' ? 'bg-warning/20 text-warning' : 'bg-surface-container-high text-on-surface'
                          }`}>
                            {inc.incident_type}
                          </span>
                          <span className="text-[9px] font-black text-primary uppercase">{inc.refugio_name} ({inc.refugio_location})</span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-bold">{date} {time}</span>
                      </div>
                      <p className="text-on-surface font-medium">{inc.description}</p>
                      {inc.action_taken && (
                        <div className="bg-surface-container/20 border border-outline-variant/30 rounded p-2 text-[10px] text-on-surface-variant italic">
                          <strong>Acción tomada:</strong> {inc.action_taken}
                        </div>
                      )}
                      <div className="text-[8px] text-on-surface-variant/80 border-t border-outline-variant/20 pt-1.5 mt-0.5 flex justify-between items-center">
                        <span>Registrado por: <strong>{inc.reporter_name || 'Personal'}</strong></span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-on-surface-variant italic text-center py-12">No se han registrado novedades de seguridad en el rango de tiempo y ámbito seleccionados.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* CONSOLIDATED INTERACTIVE POP-UP MODAL FOR PATHOLOGY RESIDENTS */}
      {showPathologyModal && selectedPathology && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface border border-outline-variant rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in scale-in duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest rounded-t-2xl">
              <div>
                <h3 className="text-base font-black text-primary uppercase tracking-wide">
                  Pacientes Consolidados con {selectedPathology}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Listado nacional/estadal de residentes bajo observación médica.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowPathologyModal(false);
                  setSelectedPathology(null);
                }}
                className="text-on-surface-variant hover:bg-surface-container-high rounded-full p-2 cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body / Table */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface/30">
                      <th className="py-2.5 px-3 rounded-l-lg">Sede / Refugio</th>
                      <th className="py-2.5 px-3">Nombre del Residente</th>
                      <th className="py-2.5 px-3">Identificación</th>
                      <th className="py-2.5 px-3 text-center">Estado de Salud</th>
                      <th className="py-2.5 px-3 rounded-r-lg">Medicamentos / Indicaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPathologyResidents().length > 0 ? (
                      getPathologyResidents().map(res => {
                        let meta = {};
                        try {
                          meta = res.special_needs ? JSON.parse(res.special_needs) : {};
                        } catch {
                          meta = {};
                        }
                        return (
                          <tr key={res.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-all">
                            <td className="py-3 px-3 font-black text-on-surface">{res.refugio_name || 'Desconocido'}</td>
                            <td className="py-3 px-3 font-bold text-primary">{res.first_name} {res.last_name}</td>
                            <td className="py-3 px-3 text-on-surface-variant font-semibold">C.I. {res.document_id || 'N/T'}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                res.health_status === 'Crítico' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'
                              }`}>
                                {res.health_status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-on-surface font-medium italic">{meta.treatments || 'No especificados'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-on-surface-variant italic">
                          No se encontraron residentes con {selectedPathology} registrados en el ámbito territorial seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end rounded-b-2xl">
              <button 
                onClick={() => {
                  setShowPathologyModal(false);
                  setSelectedPathology(null);
                }}
                className="px-4 py-2 bg-primary text-on-primary font-bold text-xs uppercase rounded-lg hover:opacity-90 transition-all cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONSOLIDATED INTERACTIVE POP-UP MODAL FOR SOCIO-ECONOMIC RESIDENTS */}
      {showSocioModal && selectedSocioCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface border border-outline-variant rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in scale-in duration-200">
            
            {/* Printable Content Area */}
            <div id="modal-print-area" className="flex flex-col flex-1 overflow-y-auto">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-outline-variant bg-surface-container-lowest rounded-t-2xl">
                <h3 className="text-base font-black text-primary uppercase tracking-wide">
                  {selectedSocioCategory === 'SAIME' && 'Consolidado SAIME - Residentes sin Cédula de Identidad'}
                  {selectedSocioCategory === 'Trabajo_Con' && 'Consolidado de Situación Laboral - Adultos con Empleo Activo'}
                  {selectedSocioCategory === 'Trabajo_Sin' && 'Consolidado de Situación Laboral - Adultos Desempleados / Sin Trabajo'}
                  {selectedSocioCategory === 'Vivienda' && 'Consolidado de Damnificados por Pérdida Total de Vivienda'}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {selectedSocioCategory === 'SAIME' && 'Listado de personas en el ámbito que no poseen cédula física para los operativos de identidad.'}
                  {selectedSocioCategory === 'Trabajo_Con' && 'Análisis de ocupación laboral consolidada en el territorio.'}
                  {selectedSocioCategory === 'Trabajo_Sin' && 'Población mayor de edad cesante con necesidad de reinserción laboral en el territorio.'}
                  {selectedSocioCategory === 'Vivienda' && 'Población damnificada con pérdida total de su vivienda anterior en el territorio.'}
                </p>
              </div>

              {/* Modal Body / Table */}
              <div className="p-6 bg-surface-container-lowest">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface/30">
                        <th className="py-2.5 px-3 rounded-l-lg">Sede / Refugio</th>
                        <th className="py-2.5 px-3">Nombre del Residente</th>
                        <th className="py-2.5 px-3">Identificación</th>
                        {(selectedSocioCategory === 'Trabajo_Con' || selectedSocioCategory === 'Trabajo_Sin') && <th className="py-2.5 px-3">Oficio / Profesión</th>}
                        {selectedSocioCategory === 'Trabajo_Con' && <th className="py-2.5 px-3">Detalle / Empresa</th>}
                        {selectedSocioCategory === 'Vivienda' && <th className="py-2.5 px-3">Condición Vivienda</th>}
                        <th className="py-2.5 px-3 rounded-r-lg">Contacto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSocioResidents().length > 0 ? (
                        getSocioResidents().map(res => {
                          let meta = {};
                          try {
                            meta = res.special_needs ? JSON.parse(res.special_needs) : {};
                          } catch {
                            meta = {};
                          }
                          
                          return (
                            <tr key={res.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-all">
                              <td className="py-3 px-3 font-black text-on-surface">{res.refugio_name || 'Desconocido'}</td>
                              <td className="py-3 px-3 font-bold text-primary">{res.first_name} {res.last_name}</td>
                              <td className="py-3 px-3 text-on-surface-variant font-semibold">C.I. {res.document_id || 'N/T'}</td>
                              
                              {(selectedSocioCategory === 'Trabajo_Con' || selectedSocioCategory === 'Trabajo_Sin') && (
                                <td className="py-3 px-3 font-bold text-on-surface">
                                  {meta.empleo?.oficio_profesion || 'No especificado'}
                                </td>
                              )}
                              
                              {selectedSocioCategory === 'Trabajo_Con' && (
                                <td className="py-3 px-3 text-on-surface-variant">
                                  {meta.empleo?.empresa || 'Empresa Privada'} ({meta.empleo?.horario || 'N/E'})
                                </td>
                              )}

                              {selectedSocioCategory === 'Vivienda' && (
                                <td className="py-3 px-3 text-error font-bold">
                                  {meta.estado_vivienda || 'Colapso total / Destruida'}
                                </td>
                              )}

                              <td className="py-3 px-3 text-on-surface-variant font-semibold">{meta.telefono_contacto || 'Sin número'}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-on-surface-variant italic">
                            No se encontraron registros consolidados en esta categoría.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer (no-print) */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-2 rounded-b-2xl no-print">
              <button 
                onClick={printModalList}
                className="px-4 py-2 bg-success text-on-success font-bold text-xs uppercase rounded-lg hover:opacity-90 transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">picture_as_pdf</span>
                Descargar PDF
              </button>
              
              <button 
                onClick={() => {
                  setShowSocioModal(false);
                  setSelectedSocioCategory(null);
                }}
                className="px-4 py-2 bg-primary text-on-primary font-bold text-xs uppercase rounded-lg hover:opacity-90 transition-all cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
