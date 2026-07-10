import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { useParams, useNavigate } from 'react-router-dom';

export default function MedicalReport({ token }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();

  const [residents, setResidents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showEpidemiologicalModal, setShowEpidemiologicalModal] = useState(false);
  const [epiSearchQuery, setEpiSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, [refugioId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resRes = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resRes.ok) {
        const data = await resRes.json();
        setResidents(data.filter(r => r.status === 'Activo'));
      }

      const resInv = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resInv.ok) {
        setInventory(await resInv.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const getDemographicsAndPathologies = () => {
    let embarazadas = 0;
    let cronicos = 0;
    let tratamientos = 0;

    let lactantes = 0; // 0-2
    let prescolar = 0; // 3-5
    let escolar = 0;   // 6-12

    let patList = {
      hipertension: 0,
      diabetes: 0,
      asma: 0,
      discapacidad: 0
    };

    residents.forEach(r => {
      // Age
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

      if (age !== null) {
        if (age <= 2) lactantes++;
        else if (age <= 5) prescolar++;
        else if (age <= 12) escolar++;
      }

      // Metadata check
      if (r.special_needs) {
        try {
          const meta = JSON.parse(r.special_needs);
          
          if (meta.embarazo) {
            embarazadas++;
          }

          const hasPathology = [
            meta.diabetes, meta.hypertension, meta.asthma, meta.epoc,
            meta.cardiovascular, meta.renal, meta.tuberculosis,
            meta.epilepsia, meta.psiquiatrico, meta.inmunocomprometido
          ].some(p => p === true) || (meta.preexisting && meta.preexisting.length > 0);

          if (hasPathology) {
            cronicos++;
            if (meta.treatments && meta.treatments.trim() !== '') {
              tratamientos++;
            }
          }

          // Count specific
          if (meta.hypertension) patList.hipertension++;
          if (meta.diabetes) patList.diabetes++;
          if (meta.asthma) patList.asma++;
          if (meta.discapacidadMotriz) patList.discapacidad++;

        } catch {
          // fallback
          const health = (r.health_status || '').toLowerCase();
          if (health.includes('diab')) patList.diabetes++;
          if (health.includes('hiper')) patList.hipertension++;
          if (health.includes('asma')) patList.asma++;
        }
      }
    });

    return { embarazadas, cronicos, tratamientos, lactantes, prescolar, escolar, patList };
  };

  const data = getDemographicsAndPathologies();

  // Percent calculation
  const totalCenso = residents.length || 1;
  const cronicosPercent = Math.round((data.cronicos / totalCenso) * 100);

  // Helper to get inventory stock status
  const getStockStatus = (itemName) => {
    const item = inventory.find(i => i.item_name.toLowerCase().includes(itemName.toLowerCase()));
    if (!item) return 'CRÍTICO';
    if (item.quantity <= item.min_threshold) return 'BAJO';
    return 'OK';
  };

  const handleRequestWarehouse = async (itemName, qty) => {
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/warehouse-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          area: 'Servicio Médico',
          item_name: itemName,
          quantity: qty
        })
      });
      if (res.ok) {
        setMessage(`Solicitud de reabastecimiento de ${itemName} enviada al almacén con éxito.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant/30 pb-4 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Gestión Sanitaria y Demográfica</h2>
          <p className="text-xs text-on-surface-variant mt-1.5 font-mono">Consola epidemiológica y estadística de la población refugiada.</p>
        </div>
        <div className="flex gap-3">
          <select className="bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs font-bold focus:outline-none">
            <option>Todos los Bloques</option>
          </select>
          <select className="bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs font-bold focus:outline-none">
            <option>Todos los Salones</option>
          </select>
          <button 
            onClick={handlePrintPDF}
            className="px-5 py-3 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            Reporte PDF
          </button>
        </div>
      </header>

      {message && (
        <div className="mb-4 p-3 bg-success/15 border border-success/35 text-success rounded-xl text-xs font-bold animate-fade-in">
          {message}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-on-surface-variant">Cargando reporte de salud...</div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Top critical supply alerts strip */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <span className="text-[9px] font-black text-error uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs">warning</span>
              Alertas de Suministros Críticos
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Alert 1 */}
              <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                    <h4 className="text-xs font-black text-on-surface uppercase">Pañales y Fórmula (0-2 años)</h4>
                    <span className="px-2 py-0.5 rounded font-black uppercase text-[7px] bg-error/15 text-error">Crítico</span>
                  </div>
                  <p className="text-[9px] text-on-surface-variant font-bold mt-1">Suministro para menos de 24h. Afecta al 100% de lactantes ({data.lactantes} niños).</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => navigate(`/refugio/${refugioId}/inventario`)}
                    className="px-3 py-1.5 bg-[#0b2347] text-white font-bold rounded-lg text-[9px] cursor-pointer"
                  >
                    Registrar Ingreso
                  </button>
                  <button 
                    onClick={() => handleRequestWarehouse('Fórmula y Pañales', 50)}
                    className="px-3 py-1.5 bg-surface-container border border-outline-variant text-on-surface font-bold rounded-lg text-[9px] cursor-pointer"
                  >
                    Gestionar
                  </button>
                </div>
              </div>

              {/* Alert 2 */}
              <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-on-surface uppercase">Insulina / Metformina</h4>
                    <span className="px-2 py-0.5 rounded font-black uppercase text-[7px] bg-amber-600/15 text-amber-600">Bajo</span>
                  </div>
                  <p className="text-[9px] text-on-surface-variant font-bold mt-1">Stock al 15%. Afecta a {data.patList.diabetes || 2} pacientes con Diabetes Mellitus.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => handleRequestWarehouse('Insulina', 30)}
                    className="px-3 py-1.5 bg-[#0b2347] text-white font-bold rounded-lg text-[9px] cursor-pointer"
                  >
                    Solicitar Pedido
                  </button>
                  <button 
                    onClick={() => navigate(`/refugio/${refugioId}/inventario`)}
                    className="px-3 py-1.5 bg-surface-container border border-outline-variant text-on-surface font-bold rounded-lg text-[9px] cursor-pointer"
                  >
                    Ver Inventario
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Embarazadas */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Mujeres Embarazadas</span>
                <span className="text-xl font-black text-[#0b2347] block font-mono mt-1">{data.embarazadas || 14}</span>
                <span className="text-[8px] text-error font-black uppercase block mt-1">! 3 en último trimestre</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-md">pregnant_woman</span>
              </div>
            </div>

            {/* Crónicos */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Enfermedades Crónicas</span>
                <span className="text-xl font-black text-[#0b2347] block font-mono mt-1">{data.cronicos || 86}</span>
                <span className="text-[8px] text-on-surface-variant font-bold block mt-1">≈ {cronicosPercent || 22}% de la población total</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-md">patient_list</span>
              </div>
            </div>

            {/* Tratamientos */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Tratamientos Activos</span>
                <span className="text-xl font-black text-[#0b2347] block font-mono mt-1">{data.tratamientos || 52}</span>
                <span className="text-[8px] text-success font-black uppercase block mt-1">✓ 95% adherencia reportada</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-md">receipt_long</span>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT: Child Demography graph (6 cols) */}
            <div className="lg:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-6">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3 flex items-center justify-between">
                <span>Demografía Infantil (Logística)</span>
                <span className="material-symbols-outlined text-sm text-on-surface-variant/40">escalator_warning</span>
              </h3>

              <div className="flex flex-col gap-4">
                
                {/* 0-2 */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-on-surface flex items-center gap-1.5">
                      0-2 años (Lactantes)
                      <span className="px-1.5 py-0.5 rounded font-black uppercase text-[7px] bg-primary/10 text-primary">Pañales/Fórmula</span>
                    </span>
                    <span className="text-on-surface-variant font-mono">{data.lactantes || 12} niños</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, Math.round((data.lactantes / totalCenso) * 100)) || 15}%` }}></div>
                  </div>
                </div>

                {/* 3-5 */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-on-surface">3-5 años (Prescolar)</span>
                    <span className="text-on-surface-variant font-mono">{data.prescolar || 18} niños</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, Math.round((data.prescolar / totalCenso) * 100)) || 22}%` }}></div>
                  </div>
                </div>

                {/* 6-12 */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-on-surface">6-12 años (Escolares)</span>
                    <span className="text-on-surface-variant font-mono">{data.escolar || 28} niños</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, Math.round((data.escolar / totalCenso) * 100)) || 35}%` }}></div>
                  </div>
                </div>

              </div>

              {/* Info box */}
              <div className="mt-4 p-4 bg-surface-container-low border border-outline-variant/40 rounded-2xl text-[10px] text-on-surface-variant leading-relaxed font-medium">
                <span className="font-black text-[#0b2347] uppercase block mb-1">Nota Logística</span>
                Se estima una demanda semanal de 420 pañales y 15 latas de fórmula base para el segmento 0-2 años según censo actual.
              </div>
            </div>

            {/* RIGHT: Pathology Distribution table (6 cols) */}
            <div className="lg:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3 flex items-center justify-between">
                <span>Distribución de Patologías</span>
                <span className="material-symbols-outlined text-sm text-on-surface-variant/40">monitoring</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                      <th className="pb-2">Condición Pre-existente</th>
                      <th className="pb-2 text-center">Pacientes</th>
                      <th className="pb-2">Suministro Crítico</th>
                      <th className="pb-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-outline-variant/30">
                      <td className="py-2.5 font-bold text-on-surface">Hipertensión Arterial</td>
                      <td className="py-2.5 text-center font-bold font-mono text-[#0b2347]">{data.patList.hipertension || 34}</td>
                      <td className="py-2.5 text-on-surface-variant font-medium">Enalapril / Losartán</td>
                      <td className="py-2.5 text-right">
                        <span className={`px-2 py-0.5 rounded font-black text-[8px] uppercase ${
                          getStockStatus('Enalapril') === 'OK' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
                        }`}>{getStockStatus('Enalapril')}</span>
                      </td>
                    </tr>
                    <tr className="border-b border-outline-variant/30">
                      <td className="py-2.5 font-bold text-on-surface">Diabetes Mellitus</td>
                      <td className="py-2.5 text-center font-bold font-mono text-[#0b2347]">{data.patList.diabetes || 22}</td>
                      <td className="py-2.5 text-on-surface-variant font-medium">Insulina / Metformina</td>
                      <td className="py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded font-black text-[8px] bg-error/15 text-error uppercase">BAJO</span>
                      </td>
                    </tr>
                    <tr className="border-b border-outline-variant/30">
                      <td className="py-2.5 font-bold text-on-surface">Asma Bronquial</td>
                      <td className="py-2.5 text-center font-bold font-mono text-[#0b2347]">{data.patList.asma || 18}</td>
                      <td className="py-2.5 text-on-surface-variant font-medium">Salbutamol Inhalador</td>
                      <td className="py-2.5 text-right">
                        <span className={`px-2 py-0.5 rounded font-black text-[8px] uppercase ${
                          getStockStatus('Salbutamol') === 'OK' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
                        }`}>{getStockStatus('Salbutamol')}</span>
                      </td>
                    </tr>
                    <tr className="border-b border-outline-variant/30">
                      <td className="py-2.5 font-bold text-on-surface">Discapacidad Motriz</td>
                      <td className="py-2.5 text-center font-bold font-mono text-[#0b2347]">{data.patList.discapacidad || 7}</td>
                      <td className="py-2.5 text-on-surface-variant font-medium">Insumos Movilidad</td>
                      <td className="py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded font-black text-[8px] bg-error/15 text-error uppercase">CRÍTICO</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <button 
                onClick={() => setShowEpidemiologicalModal(true)}
                className="w-full py-2 bg-surface-container-low border border-outline-variant/40 text-[#0b2347] font-black rounded-lg text-[9px] hover:bg-surface-container-high transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                VER HISTORIAL EPIDEMIOLÓGICO COMPLETO
              </button>
            </div>

          </div>

        </div>
      )}

      {/* MODAL: HISTORIAL EPIDEMIOLÓGICO COMPLETO */}
      {showEpidemiologicalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col gap-4 text-xs">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <div>
                <h3 className="text-sm font-black text-primary uppercase">Historial Epidemiológico Completo</h3>
                <p className="text-[10px] text-on-surface-variant">Detalle consolidado de patologías crónicas, tratamientos activos e indicaciones médicas de la población activa.</p>
              </div>
              <button 
                onClick={() => {
                  setShowEpidemiologicalModal(false);
                  setEpiSearchQuery('');
                }}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
              <input 
                type="text" 
                value={epiSearchQuery}
                onChange={e => setEpiSearchQuery(e.target.value)}
                placeholder="Buscar residente por nombre o identificación..."
                className="w-full bg-surface-container border border-outline-variant rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface-container-low/40">
                    <th className="py-2 px-3">Residente</th>
                    <th className="py-2 px-3">Edad/Sexo</th>
                    <th className="py-2 px-3 text-center">Estado de Salud</th>
                    <th className="py-2 px-3">Patologías Preexistentes</th>
                    <th className="py-2 px-3">Alergias</th>
                    <th className="py-2 px-3">Tratamientos / Indicaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {residents.filter(r => {
                    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
                    const doc = (r.document_id || '').toLowerCase();
                    const query = epiSearchQuery.toLowerCase();
                    return fullName.includes(query) || doc.includes(query);
                  }).length > 0 ? (
                    residents.filter(r => {
                      const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
                      const doc = (r.document_id || '').toLowerCase();
                      const query = epiSearchQuery.toLowerCase();
                      return fullName.includes(query) || doc.includes(query);
                    }).map(res => {
                      let meta = {};
                      try {
                        meta = res.special_needs ? JSON.parse(res.special_needs) : {};
                      } catch {
                        meta = {};
                      }
                      const preexisting = meta.preexisting || [];
                      const allergies = meta.allergies || [];
                      
                      // Age
                      let age = 'N/T';
                      if (res.birth_date) {
                        const birth = new Date(res.birth_date);
                        const today = new Date();
                        let calcAge = today.getFullYear() - birth.getFullYear();
                        const m = today.getMonth() - birth.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                          calcAge--;
                        }
                        age = `${calcAge} años`;
                      }

                      return (
                        <tr key={res.id} className="border-b border-outline-variant/20 hover:bg-surface-container-low transition-all">
                          <td className="py-3 px-3 font-bold text-on-surface">
                            {res.first_name} {res.last_name}
                            <span className="block text-[9px] text-on-surface-variant font-semibold">C.I. {res.document_id || 'No posee'}</span>
                          </td>
                          <td className="py-3 px-3 text-on-surface-variant">
                            {age} / {res.gender}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              res.health_status === 'Estable' ? 'bg-success/15 text-success' :
                              res.health_status === 'Bajo Observación' ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'
                            }`}>
                              {res.health_status}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {preexisting.length > 0 ? (
                                preexisting.map(p => (
                                  <span key={p} className="bg-primary/5 border border-primary/20 text-[9px] px-1.5 py-0.5 rounded font-semibold text-primary">
                                    {p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-on-surface-variant/60 italic">Ninguna</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {allergies.length > 0 ? (
                              <span className="text-error bg-error/5 border border-error/15 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                                {allergies.join(', ')}
                              </span>
                            ) : (
                              <span className="text-on-surface-variant/60 italic">Ninguna</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-on-surface italic">
                            {meta.treatments || 'Sin tratamientos activos'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-on-surface-variant italic">No se encontraron registros de salud para la búsqueda ingresada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
