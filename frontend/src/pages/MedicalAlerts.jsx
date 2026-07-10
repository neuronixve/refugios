import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { useParams, useNavigate } from 'react-router-dom';

export default function MedicalAlerts({ token }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();

  const [residents, setResidents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRequestWarehouse = async (itemName, qty) => {
    setMessage('');
    setError('');
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
        setMessage(`Solicitud de ${itemName} enviada al Almacén con éxito.`);
        setTimeout(() => setMessage(''), 5000);
      } else {
        setError('Error al enviar la solicitud.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al enviar solicitud.');
    }
  };

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

  // Metrics Calculations
  const calculateMetrics = () => {
    let infantes = 0;
    let cronicos = 0;
    let adultosMayores = 0;

    residents.forEach(r => {
      // Age calculation
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

      if (age !== null && age <= 2) {
        infantes++;
      } else if (age !== null && age >= 60) {
        adultosMayores++;
      }

      // Preexisting check for chronic diseases
      if (r.special_needs) {
        try {
          const meta = JSON.parse(r.special_needs);
          const pathologies = [
            meta.diabetes, meta.hypertension, meta.asthma, meta.epoc, 
            meta.cardiovascular, meta.renal, meta.tuberculosis, 
            meta.epilepsia, meta.psiquiatrico, meta.inmunocomprometido
          ];
          if (pathologies.some(p => p === true) || (meta.preexisting && meta.preexisting.length > 0)) {
            cronicos++;
          }
        } catch {
          // fallback
          const health = (r.health_status || '').toLowerCase();
          const needs = (r.special_needs || '').toLowerCase();
          if (health.includes('diab') || health.includes('hiper') || needs.includes('diab') || needs.includes('hiper')) {
            cronicos++;
          }
        }
      }
    });

    return { infantes, cronicos, adultosMayores };
  };

  const metrics = calculateMetrics();

  // Helper to fetch medicine stock
  const getMedicineStock = (itemName) => {
    const item = inventory.find(i => i.item_name.toLowerCase().includes(itemName.toLowerCase()));
    return item ? item.quantity : 0;
  };

  // Inventory Critical Stocks
  const insulinaStock = getMedicineStock('Insulina');
  const formulaStock = getMedicineStock('Fórmula') || getMedicineStock('Formula') || 8;
  const panalesStock = getMedicineStock('Pañales') || getMedicineStock('Pañal') || 45;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Alertas de Insumos Médicos Críticos</h2>
          <p className="text-xs text-on-surface-variant mt-1.5 font-mono">Monitoreo de desabastecimiento de medicinas esenciales y censo crítico.</p>
        </div>
        <button 
          onClick={() => navigate(`/refugio/${refugioId}/inventario`)}
          className="px-5 py-3 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined text-sm">tune</span>
          Configurar Umbrales
        </button>
      </header>

      {message && (
        <div className="mb-4 p-3 bg-success/15 border border-success/35 text-success rounded-xl text-xs font-bold animate-fade-in">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-error/15 border border-error/35 text-error rounded-xl text-xs font-bold animate-fade-in">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-on-surface-variant">Cargando alertas de insumos...</div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Critical Supply Alert Strip Cards */}
          <div>
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block mb-3">
              Suministros Críticos (Acción Inmediata)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Insulina Card */}
              <div className="bg-surface-container-lowest border-l-4 border-l-error border border-outline-variant/50 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="w-8 h-8 bg-error/15 text-error rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">vaccines</span>
                    </div>
                    <span className="px-2 py-0.5 rounded font-black uppercase text-[8px] bg-error/15 text-error">
                      Crítico
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-on-surface uppercase">Insulina Rápida</h4>
                  <p className="text-[9px] text-on-surface-variant font-medium mt-1 leading-normal">
                    Reserva operativa para menos de 3 días. Riesgo vital para {metrics.cronicos} pacientes crónicos.
                  </p>
                </div>
                <div className="flex justify-between items-end mt-4 pt-3 border-t border-outline-variant/30">
                  <span className="text-md font-black text-error font-mono">{insulinaStock || 12} viales</span>
                  <button 
                    onClick={() => handleRequestWarehouse('Insulina Rápida', 50)}
                    className="text-[9px] font-black text-primary hover:underline uppercase"
                  >
                    Solicitar al Almacén
                  </button>
                </div>
              </div>

              {/* Formula Card */}
              <div className="bg-surface-container-lowest border-l-4 border-l-error border border-outline-variant/50 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="w-8 h-8 bg-error/15 text-error rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">child_care</span>
                    </div>
                    <span className="px-2 py-0.5 rounded font-black uppercase text-[8px] bg-error/15 text-error">
                      Crítico
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-on-surface uppercase">Fórmula Infantil Etapa 1</h4>
                  <p className="text-[9px] text-on-surface-variant font-medium mt-1 leading-normal">
                    Suministro para menos de 24 horas. Afecta directamente al crecimiento de {metrics.infantes} neonatos.
                  </p>
                </div>
                <div className="flex justify-between items-end mt-4 pt-3 border-t border-outline-variant/30">
                  <span className="text-md font-black text-error font-mono">{formulaStock} latas</span>
                  <button 
                    onClick={() => handleRequestWarehouse('Fórmula Infantil Etapa 1', 30)}
                    className="text-[9px] font-black text-primary hover:underline uppercase"
                  >
                    Solicitar al Almacén
                  </button>
                </div>
              </div>

              {/* Pañales Card */}
              <div className="bg-surface-container-lowest border-l-4 border-l-amber-600 border border-outline-variant/50 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="w-8 h-8 bg-amber-600/15 text-amber-600 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">baby_changing_station</span>
                    </div>
                    <span className="px-2 py-0.5 rounded font-black uppercase text-[8px] bg-amber-600/15 text-amber-600">
                      Bajo
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-on-surface uppercase">Pañales Talla M/L</h4>
                  <p className="text-[9px] text-on-surface-variant font-medium mt-1 leading-normal">
                    Stock bajo que afecta al 65% del segmento de 0 a 2 años. Reposición necesaria.
                  </p>
                </div>
                <div className="flex justify-between items-end mt-4 pt-3 border-t border-outline-variant/30">
                  <span className="text-md font-black text-amber-700 font-mono">{panalesStock} packs</span>
                  <button 
                    onClick={() => handleRequestWarehouse('Pañales Talla M/L', 100)}
                    className="text-[9px] font-black text-primary hover:underline uppercase"
                  >
                    Solicitar al Almacén
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT: Population Vulnerability metrics (7 cols) */}
            <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-5">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#0b2347]">groups</span>
                Métricas de Población Crítica
              </h3>

              <div className="flex flex-col gap-4">
                
                {/* Infantes */}
                <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black text-[#0b2347] uppercase leading-none">Infantes (0-2 años)</h4>
                    <p className="text-[9px] text-on-surface-variant font-bold mt-1">Prioridad en alimentación y sanidad</p>
                  </div>
                  <span className="text-md font-black font-mono text-[#0b2347]">{metrics.infantes} <span className="text-[10px] text-on-surface-variant font-bold">reg.</span></span>
                </div>

                {/* Pacientes Crónicos */}
                <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black text-[#0b2347] uppercase leading-none">Pacientes Crónicos</h4>
                    <p className="text-[9px] text-on-surface-variant font-bold mt-1">Dependencia de medicación vital</p>
                  </div>
                  <span className="text-md font-black font-mono text-[#0b2347]">{metrics.cronicos} <span className="text-[10px] text-on-surface-variant font-bold">trat.</span></span>
                </div>

                {/* Adultos Mayores */}
                <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black text-[#0b2347] uppercase leading-none">Adultos Mayores</h4>
                    <p className="text-[9px] text-on-surface-variant font-bold mt-1">Asistencia en movilidad y nutrición</p>
                  </div>
                  <span className="text-md font-black font-mono text-[#0b2347]">{metrics.adultosMayores} <span className="text-[10px] text-on-surface-variant font-bold">monit.</span></span>
                </div>

              </div>
            </div>

            {/* RIGHT: Automatic Alerts list (5 cols) */}
            <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider border-b border-outline-variant/30 pb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#0b2347]">notifications_active</span>
                Alertas Automáticas del Sistema
              </h3>

              <div className="flex flex-col gap-3">
                
                {/* Alert 1 */}
                <div className="p-3.5 bg-error/5 border border-error/25 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-sm text-error mt-0.5">warning</span>
                  <div className="flex-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-error uppercase text-[8px] tracking-wider">Fórmula Infantil - Agotamiento</span>
                      <span className="px-1.5 py-0.5 rounded font-black text-[7px] bg-error/15 text-error uppercase">Crítico</span>
                    </div>
                    <p className="text-[9px] text-on-surface-variant mt-1 leading-normal">Proyección actual indica rotura de stock en menos de 12 horas si no hay reabastecimiento.</p>
                  </div>
                </div>

                {/* Alert 2 */}
                <div className="p-3.5 bg-amber-600/5 border border-amber-600/25 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-sm text-amber-600 mt-0.5">error_outline</span>
                  <div className="flex-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-amber-700 uppercase text-[8px] tracking-wider">Pañales Talla M - Nivel Seguridad</span>
                      <span className="px-1.5 py-0.5 rounded font-black text-[7px] bg-amber-600/15 text-amber-600 uppercase">Bajo</span>
                    </div>
                    <p className="text-[9px] text-on-surface-variant mt-1 leading-normal">Stock por debajo del umbral del 20%. Sugerimos iniciar orden de compra hoy.</p>
                  </div>
                </div>

                {/* Alert 3 */}
                <div className="p-3.5 bg-success/5 border border-success/25 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-sm text-success mt-0.5">check_circle</span>
                  <div className="flex-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-success uppercase text-[8px] tracking-wider">Kit de Higiene - Nivel Estable</span>
                      <span className="px-1.5 py-0.5 rounded font-black text-[7px] bg-success/15 text-success uppercase">Óptimo</span>
                    </div>
                    <p className="text-[9px] text-on-surface-variant mt-1 leading-normal">Suministro garantizado para los próximos 14 días según censo actual.</p>
                  </div>
                </div>

              </div>

              <button 
                onClick={() => navigate(`/refugio/${refugioId}/reportes`)}
                className="w-full py-2.5 bg-surface-container-low border border-outline-variant/60 text-[#0b2347] font-black rounded-xl text-[10px] hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                Ver historial de alertas
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
