import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function LogisticsPanel({ token }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();

  const [residents, setResidents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchData();
  }, [refugioId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch active residents
      const resRes = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resRes.ok) {
        const data = await resRes.json();
        setResidents(data.filter(r => r.status === 'Activo'));
      }

      // 2. Fetch today's meal attendance
      const resAtt = await fetch(`${API_BASE}/refugios/${refugioId}/meals/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resAtt.ok) {
        setAttendance(await resAtt.json());
      }

      // 3. Fetch food inventory
      const resInv = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resInv.ok) {
        const invData = await resInv.json();
        setInventory(invData.filter(i => i.category === 'Alimentos'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Stats Calculations
  const totalCenso = residents.length || 1;
  const desayunoCount = attendance.filter(a => a.meal_type === 'Desayuno').length;
  const almuerzoCount = attendance.filter(a => a.meal_type === 'Almuerzo').length;
  const cenaCount = attendance.filter(a => a.meal_type === 'Cena').length;

  const desayunoPercent = Math.min(100, Math.round((desayunoCount / totalCenso) * 100));
  const almuerzoPercent = Math.min(100, Math.round((almuerzoCount / totalCenso) * 100));
  const cenaPercent = Math.min(100, Math.round((cenaCount / totalCenso) * 100));

  const totalServidoHoy = desayunoCount + almuerzoCount + cenaCount;
  const totalObjetivoHoy = totalCenso * 3;

  // Dietary constraints counters (using regex on health_status & special_needs)
  const getDietCounts = () => {
    let diabeticos = 0;
    let celiacos = 0;
    let lactantes = 0;
    let alergias = 0;

    residents.forEach(r => {
      const needs = (r.special_needs || '').toLowerCase();
      const health = (r.health_status || '').toLowerCase();

      if (needs.includes('diab') || health.includes('diab')) diabeticos++;
      if (needs.includes('celia') || needs.includes('gluten')) celiacos++;
      if (needs.includes('lactan') || needs.includes('formula') || needs.includes('fórmula')) lactantes++;
      if (needs.includes('alerg') || needs.includes('asma') || needs.includes('asmá')) alergias++;
    });

    return { diabeticos, celiacos, lactantes, alergias };
  };

  const diets = getDietCounts();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Logística y Comedor</h2>
          <p className="text-xs text-on-surface-variant mt-1.5">Panel operativo en tiempo real del comedor central.</p>
        </div>
        <button 
          onClick={() => navigate(`/refugio/${refugioId}/comedor/asistencia`)}
          className="px-5 py-3 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
          Registrar Servicio de Comida
        </button>
      </header>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-on-surface-variant">Cargando panel del comedor...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Dashboard Panel (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* Control de Raciones Diarias */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-6">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-wider">Control de Raciones Diarias</h3>
                  <p className="text-[10px] text-on-surface-variant font-bold mt-1 font-mono">Censo actual: {totalCenso} personas</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-on-surface-variant font-bold block uppercase tracking-wider">Total Servido</span>
                  <span className="text-xl font-black text-[#0b2347] block font-mono leading-none mt-1">
                    {totalServidoHoy} <span className="text-xs text-on-surface-variant font-medium">/ {totalObjetivoHoy}</span>
                  </span>
                </div>
              </div>

              {/* Meals Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Desayuno */}
                <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">Desayuno</span>
                    <span className="text-xs font-black text-primary">{desayunoPercent}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${desayunoPercent}%` }}></div>
                  </div>
                  <span className="text-[10px] text-on-surface-variant font-bold font-mono">
                    {desayunoCount} / {totalCenso} servidos
                  </span>
                </div>

                {/* Almuerzo */}
                <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">Almuerzo</span>
                    <span className="text-xs font-black text-primary">{almuerzoPercent}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${almuerzoPercent}%` }}></div>
                  </div>
                  <span className="text-[10px] text-on-surface-variant font-bold font-mono">
                    {almuerzoCount} / {totalCenso} servidos
                  </span>
                </div>

                {/* Cena */}
                <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">Cena</span>
                    <span className="text-xs font-black text-primary">{cenaPercent}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${cenaPercent}%` }}></div>
                  </div>
                  <span className="text-[10px] text-on-surface-variant font-bold font-mono">
                    {cenaCount} / {totalCenso} servidos
                  </span>
                </div>

              </div>
            </div>

            {/* Turnos de Comida & Inventario Perecedero en fila */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Turnos de Comida */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#0b2347]">schedule</span>
                  Turnos de Comida
                </h3>

                <div className="flex flex-col gap-3 text-xs">
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-[#0b2347] uppercase text-[10px]">Turno Actual (12:30 - 13:15)</span>
                      <span className="material-symbols-outlined text-xs text-primary animate-pulse">sensors</span>
                    </div>
                    <p className="font-bold text-on-surface mt-1">Grupo Sector A y B</p>
                    <div className="w-full bg-surface-container rounded-full h-1 mt-2.5">
                      <div className="bg-primary h-1 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                  </div>

                  <div className="p-4 bg-surface-container-low border border-outline-variant/40 rounded-2xl opacity-75">
                    <span className="font-black text-on-surface-variant uppercase text-[10px]">Próximo Turno (13:15 - 14:00)</span>
                    <p className="font-bold text-on-surface mt-1">Grupo Sector C y Dormitorios</p>
                    <p className="text-[9px] text-on-surface-variant font-mono mt-1">Preparación en curso...</p>
                  </div>
                </div>
              </div>

              {/* Inventario Crítico */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#0b2347]">warning</span>
                    Inventario Perecederos
                  </h3>
                  <button 
                    onClick={() => navigate(`/refugio/${refugioId}/inventario`)}
                    className="text-[9px] font-black text-primary hover:underline uppercase"
                  >
                    Ver Todo
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                        <th className="pb-2">Suministro</th>
                        <th className="pb-2 text-center">Stock</th>
                        <th className="pb-2 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.slice(0, 3).map((item, idx) => {
                        const isLow = item.quantity <= item.min_threshold;
                        return (
                          <tr key={idx} className="border-b border-outline-variant/30">
                            <td className="py-2.5 font-bold text-on-surface">{item.item_name}</td>
                            <td className="py-2.5 text-center font-semibold font-mono">{item.quantity} {item.unit}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-2 py-0.5 rounded font-black uppercase text-[8px] ${
                                isLow ? 'bg-error/15 text-error' : 'bg-success/15 text-success'
                              }`}>
                                {isLow ? 'Alerta' : 'Óptimo'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {inventory.length === 0 && (
                        <tr>
                          <td colSpan="3" className="py-4 text-center italic text-on-surface-variant">Sin insumos de alimentos.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

          {/* Right Column: Special Diets Counter Panel (4 cols) */}
          <div className="lg:col-span-4 bg-[#0b2347] text-white border border-[#0b2347] rounded-2xl p-6 shadow-xs flex flex-col gap-6 relative overflow-hidden">
            {/* Heart symbol watermark */}
            <span className="material-symbols-outlined text-[150px] text-white/5 absolute -right-6 -bottom-6 select-none pointer-events-none">
              favorite
            </span>

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Dietas Especiales</h3>
              <p className="text-[10px] text-white/70 mt-1">Censo nutricional por restricciones de salud.</p>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              
              {/* Diabéticos */}
              <div className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-sm text-amber-300">ac_unit</span>
                  <span className="font-bold">Diabéticos</span>
                </div>
                <span className="font-black text-md font-mono">{diets.diabeticos}</span>
              </div>

              {/* Celiacos */}
              <div className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-sm text-amber-300">grain</span>
                  <span className="font-bold">Celiacos (Sin Gluten)</span>
                </div>
                <span className="font-black text-md font-mono">{diets.celiacos}</span>
              </div>

              {/* Lactantes */}
              <div className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-sm text-amber-300">child_care</span>
                  <span className="font-bold">Lactantes / Fórmula</span>
                </div>
                <span className="font-black text-md font-mono">{diets.lactantes}</span>
              </div>

              {/* Alergias */}
              <div className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-sm text-amber-300">warning</span>
                  <span className="font-bold">Alergias Graves / Asma</span>
                </div>
                <span className="font-black text-md font-mono">{diets.alergias}</span>
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
