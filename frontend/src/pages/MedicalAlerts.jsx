import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function MedicalAlerts({ token }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();

  const [residents, setResidents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api');

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

  const handleDeleteSupply = async item => {
    if (!window.confirm(`¿Eliminar el insumo médico "${item.item_name}"?`)) return;
    const res = await fetch(`${API_BASE}/refugios/${refugioId}/health-inventory/${item.id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || 'No se pudo eliminar el insumo.');
    setMessage(data.message || 'Insumo médico eliminado.');
    fetchData();
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

      const resInv = await fetch(`${API_BASE}/refugios/${refugioId}/health-inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resInv.ok) {
        const healthData = await resInv.json();
        setInventory(Array.isArray(healthData.items) ? healthData.items : []);
      } else {
        const data = await resInv.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo cargar el inventario de salud.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al cargar las alertas médicas.');
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

  const criticalInventory = inventory.filter(item =>
    (parseFloat(item.quantity) || 0) <= (parseFloat(item.min_threshold) || 0)
  );
  const availableInventory = inventory.filter(item =>
    (parseFloat(item.quantity) || 0) > (parseFloat(item.min_threshold) || 0)
  );

  const suggestedRequest = item => {
    const qty = parseFloat(item.quantity) || 0;
    const min = parseFloat(item.min_threshold) || 0;
    return Math.max((min > 0 ? min * 2 : 1) - qty, 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Alertas de Insumos Médicos Críticos</h2>
          <p className="text-xs text-on-surface-variant mt-1.5 font-mono">Monitoreo de desabastecimiento de medicinas esenciales y censo crítico.</p>
        </div>
        <button 
          onClick={() => navigate(`/refugio/${refugioId}/medico/inventario`)}
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
              {criticalInventory.map(item => {
                const qty = parseFloat(item.quantity) || 0;
                const min = parseFloat(item.min_threshold) || 0;
                const empty = qty <= 0;
                return (
                  <div key={item.id} className={`bg-surface-container-lowest border-l-4 ${empty ? 'border-l-error' : 'border-l-amber-600'} border border-outline-variant/50 rounded-2xl p-5 flex flex-col justify-between shadow-2xs`}>
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${empty ? 'bg-error/15 text-error' : 'bg-amber-600/15 text-amber-700'}`}>
                          <span className="material-symbols-outlined text-sm">medical_services</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-black uppercase text-[8px] ${empty ? 'bg-error/15 text-error' : 'bg-amber-600/15 text-amber-700'}`}>
                          {empty ? 'Sin stock' : 'Bajo umbral'}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-on-surface uppercase">{item.item_name}</h4>
                      <p className="text-[9px] text-on-surface-variant font-medium mt-1 leading-normal">
                        Existencia real: {qty} {item.unit || 'Unidades'}. Umbral configurado: {min}.
                      </p>
                    </div>
                    <div className="flex justify-between items-end mt-4 pt-3 border-t border-outline-variant/30">
                      <span className={`text-md font-black font-mono ${empty ? 'text-error' : 'text-amber-700'}`}>{qty} {item.unit || 'Unidades'}</span>
                      <div className="flex gap-2"><button onClick={() => handleRequestWarehouse(item.item_name, suggestedRequest(item))} className="text-[9px] font-black text-primary hover:underline uppercase">Solicitar</button><button onClick={() => handleDeleteSupply(item)} className="text-[9px] font-black text-error hover:underline uppercase">Eliminar</button></div>
                    </div>
                  </div>
                );
              })}
              {inventory.length === 0 && (
                <div className="md:col-span-3 bg-amber-600/5 border border-amber-600/25 rounded-2xl p-6 flex items-center gap-3 text-amber-800">
                  <span className="material-symbols-outlined">inventory_2</span>
                  <div>
                    <p className="text-xs font-black uppercase">Inventario médico sin renglones</p>
                    <p className="text-[10px] font-medium mt-1">Registre los insumos recibidos por el Servicio Médico para activar el monitoreo de existencias y umbrales.</p>
                  </div>
                </div>
              )}
              {inventory.length > 0 && criticalInventory.length === 0 && (
                <div className="md:col-span-3 bg-success/5 border border-success/25 rounded-2xl p-6 flex items-center gap-3 text-success">
                  <span className="material-symbols-outlined">check_circle</span>
                  <div>
                    <p className="text-xs font-black uppercase">Sin alertas de inventario médico</p>
                    <p className="text-[10px] font-medium mt-1">Todos los insumos registrados están por encima de sus umbrales.</p>
                  </div>
                </div>
              )}
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
                {criticalInventory.slice(0, 5).map(item => {
                  const qty = parseFloat(item.quantity) || 0;
                  return (
                    <div key={item.id} className={`${qty <= 0 ? 'bg-error/5 border-error/25' : 'bg-amber-600/5 border-amber-600/25'} p-3.5 border rounded-xl flex items-start gap-3`}>
                      <span className={`material-symbols-outlined text-sm mt-0.5 ${qty <= 0 ? 'text-error' : 'text-amber-700'}`}>warning</span>
                      <div className="flex-1 text-xs">
                        <div className="flex justify-between items-center gap-2">
                          <span className={`font-black uppercase text-[8px] tracking-wider ${qty <= 0 ? 'text-error' : 'text-amber-700'}`}>{item.item_name}</span>
                          <span className={`px-1.5 py-0.5 rounded font-black text-[7px] uppercase ${qty <= 0 ? 'bg-error/15 text-error' : 'bg-amber-600/15 text-amber-700'}`}>
                            {qty <= 0 ? 'Agotado' : 'Crítico'}
                          </span>
                        </div>
                        <p className="text-[9px] text-on-surface-variant mt-1 leading-normal">
                          Stock {qty} {item.unit || 'Unidades'}; mínimo operativo {parseFloat(item.min_threshold) || 0}.
                        </p>
                      </div>
                    </div>
                  );
                })}
                {inventory.length === 0 && (
                  <div className="p-3.5 bg-amber-600/5 border border-amber-600/25 rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-sm text-amber-700 mt-0.5">inventory_2</span>
                    <div className="flex-1 text-xs">
                      <span className="font-black text-amber-700 uppercase text-[8px] tracking-wider">Monitoreo pendiente de configuración</span>
                      <p className="text-[9px] text-on-surface-variant mt-1 leading-normal">No existen insumos registrados en el depósito médico.</p>
                    </div>
                  </div>
                )}
                {inventory.length > 0 && criticalInventory.length === 0 && (
                  <div className="p-3.5 bg-success/5 border border-success/25 rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-sm text-success mt-0.5">check_circle</span>
                    <div className="flex-1 text-xs">
                      <span className="font-black text-success uppercase text-[8px] tracking-wider">Inventario médico estable</span>
                      <p className="text-[9px] text-on-surface-variant mt-1 leading-normal">{availableInventory.length} insumos por encima de su umbral.</p>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => navigate(`/refugio/${refugioId}/medico/inventario`)}
                className="w-full py-2.5 bg-surface-container-low border border-outline-variant/60 text-[#0b2347] font-black rounded-xl text-[10px] hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                Revisar inventario y umbrales
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
