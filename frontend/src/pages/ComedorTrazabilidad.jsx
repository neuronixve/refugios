import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function ComedorTrazabilidad({ token }) {
  const { refugioId } = useParams();

  // Tabs state: 'inventory' or 'meals'
  const [activeTab, setActiveTab] = useState('inventory');

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [movementType, setMovementType] = useState('');

  // Data states
  const [movements, setMovements] = useState([]);
  const [mealReport, setMealReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api');

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchInventoryMovements();
    } else {
      fetchMealReport();
    }
  }, [refugioId, activeTab, startDate, endDate, movementType]);

  const fetchInventoryMovements = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let queryParams = ['inventory_type=cocina'];
      if (startDate) queryParams.push(`start_date=${startDate}`);
      if (endDate) queryParams.push(`end_date=${endDate}`);
      if (movementType) queryParams.push(`movement_type=${movementType}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/inventory/movements${queryString}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMovements(await res.json());
      } else {
        setErrorMsg('Error al cargar trazabilidad de inventario de cocina.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de conexión al cargar la trazabilidad.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMealReport = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let queryParams = [];
      if (startDate) queryParams.push(`start_date=${startDate}`);
      if (endDate) queryParams.push(`end_date=${endDate}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/meals/consolidated-report${queryString}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMealReport(await res.json());
      } else {
        setErrorMsg('Error al cargar reporte consolidado de comidas.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de conexión al cargar el reporte consolidado de comidas.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    let queryParams = [];
    if (startDate) queryParams.push(`start_date=${startDate}`);
    if (endDate) queryParams.push(`end_date=${endDate}`);
    queryParams.push(`token=${token}`);

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    if (activeTab === 'inventory') {
      queryParams.push('inventory_type=cocina');
      if (movementType) queryParams.push(`movement_type=${movementType}`);
      const invQuery = queryParams.join('&');
      window.open(`${API_BASE}/refugios/${refugioId}/inventory/movements/download?${invQuery}`, '_blank');
    } else {
      window.open(`${API_BASE}/refugios/${refugioId}/meals/manual-servings/download${queryString}`, '_blank');
    }
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setMovementType('');
  };

  const getMovementLabel = (type) => {
    switch (type) {
      case 'ingreso_donacion': return 'Donación';
      case 'ajuste_manual': return 'Ajuste de Stock';
      case 'consumo_menu': return 'Consumo Comedor';
      case 'eliminacion': return 'Eliminación';
      default: return type.toUpperCase();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
        <div>
          <span className="text-[10px] uppercase font-bold text-on-surface-variant/75 tracking-widest block">Auditoría de Alimentos</span>
          <h2 className="text-2xl font-extrabold text-primary mt-1">Trazabilidad y Reportes de Comedor</h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadExcel}
            className="py-3 px-5 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm border-0"
            style={{ backgroundColor: '#10b981' }}
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Descargar Excel
          </button>
          <button 
            onClick={() => window.print()}
            className="py-3 px-5 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm border-0"
            style={{ backgroundColor: '#0b2347' }}
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Imprimir Reporte (PDF)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/60 mb-6 print:hidden">
        <button
          onClick={() => { setActiveTab('inventory'); handleClearFilters(); }}
          className={`pb-3 px-6 text-xs font-black transition-all border-b-2 cursor-pointer bg-transparent border-0 ${
            activeTab === 'inventory' ? 'border-primary text-primary border-b-2' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Trazabilidad de Cocina (Inventario)
        </button>
        <button
          onClick={() => { setActiveTab('meals'); handleClearFilters(); }}
          className={`pb-3 px-6 text-xs font-black transition-all border-b-2 cursor-pointer bg-transparent border-0 ${
            activeTab === 'meals' ? 'border-primary text-primary border-b-2' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Historial de Comidas Servidas
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4 mb-8 print:hidden">
        <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-primary">filter_alt</span>
          Filtros del Reporte
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1 text-xs">
            <label className="font-bold text-on-surface-variant">Fecha Desde</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <label className="font-bold text-on-surface-variant">Fecha Hasta</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none"
            />
          </div>

          {activeTab === 'inventory' && (
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-bold text-on-surface-variant">Tipo de Movimiento</label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none font-bold"
              >
                <option value="">Todos los Movimientos</option>
                <option value="ingreso_donacion">Donaciones Recibidas</option>
                <option value="ajuste_manual">Ajustes Manuales</option>
                <option value="consumo_menu">Consumo Comedor</option>
                <option value="eliminacion">Insumos Eliminados</option>
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1 text-xs justify-end">
            <button
              onClick={handleClearFilters}
              className="py-2.5 bg-surface border border-outline text-on-surface hover:bg-surface-container font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-error/15 border border-error/35 rounded-xl text-xs text-error font-semibold mb-6 print:hidden">
          {errorMsg}
        </div>
      )}

      {/* Printable header */}
      <div className="hidden print:flex flex-col gap-2 p-6 border-b border-outline-variant mb-6">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-[#0b2347]">CAMPAMENTOS TEMPORALES</span>
          <span className="text-xs font-bold text-on-surface-variant">SAREN AUDIT SYSTEM</span>
        </div>
        <h2 className="text-xl font-black text-center text-primary py-4 uppercase">
          {activeTab === 'inventory' ? 'Reporte de Trazabilidad de Cocina' : 'Reporte de Comidas Servidas Consolidado'}
        </h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold">Filtros Activos:</span> {startDate || 'Inicio'} al {endDate || 'Fin'} 
            {activeTab === 'inventory' && movementType && ` • Movimiento: ${getMovementLabel(movementType)}`}
          </div>
          <div className="text-right"><span className="font-bold">Fecha de Emisión:</span> {new Date().toLocaleString('es-VE')}</div>
        </div>
      </div>

      {/* Tab 1: Inventory Traceability table */}
      {activeTab === 'inventory' && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/60">
                  <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Fecha / Hora</th>
                  <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Movimiento</th>
                  <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Insumo</th>
                  <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider text-right">Cantidad</th>
                  <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Unidad</th>
                  <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Responsable</th>
                  <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-xs text-on-surface-variant/80 font-bold">
                      Cargando trazabilidad...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-xs text-on-surface-variant/80 font-bold">
                      No se registraron movimientos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const qty = parseFloat(m.quantity) || 0;
                    const isPositive = qty > 0;
                    return (
                      <tr key={m.id} className="border-b border-outline-variant/35 hover:bg-surface-container-lowest/50 transition-all">
                        <td className="p-4 text-xs font-medium text-on-surface-variant">
                          {new Date(m.created_at).toLocaleString('es-VE')}
                        </td>
                        <td className="p-4 text-xs font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black ${
                            m.movement_type === 'ingreso_donacion' ? 'bg-success/10 text-success' :
                            m.movement_type === 'consumo_menu' ? 'bg-warning/10 text-warning' :
                            m.movement_type === 'eliminacion' ? 'bg-error/10 text-error' :
                            'bg-primary/10 text-primary'
                          }`}>
                            {getMovementLabel(m.movement_type)}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-bold text-on-surface">
                          {m.item_name}
                        </td>
                        <td className={`p-4 text-xs font-black text-right ${isPositive ? 'text-success' : 'text-error'}`}>
                          {isPositive ? `+${qty.toFixed(2)}` : qty.toFixed(2)}
                        </td>
                        <td className="p-4 text-xs font-bold text-on-surface-variant">
                          {m.unit}
                        </td>
                        <td className="p-4 text-xs font-bold text-on-surface">
                          {m.user_name || 'Sistema'}
                        </td>
                        <td className="p-4 text-xs text-on-surface-variant max-w-xs truncate" title={m.details}>
                          {m.details}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Meals Traceability table */}
      {activeTab === 'meals' && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/60 font-bold text-on-surface-variant">
                  <th className="p-3 font-black uppercase text-xs">Fecha</th>
                  <th className="p-3 font-black uppercase text-xs">Servicio</th>
                  <th className="p-3 text-center">Afectados</th>
                  <th className="p-3 text-center">GN</th>
                  <th className="p-3 text-center">CICPC</th>
                  <th className="p-3 text-center">Vigilantes</th>
                  <th className="p-3 text-center">Médicos</th>
                  <th className="p-3 text-center">Administradores</th>
                  <th className="p-3 text-center">Comité</th>
                  <th className="p-3 text-center">Cocineras</th>
                  <th className="p-3 text-center">Juventud</th>
                  <th className="p-3 text-center">SAREN</th>
                  <th className="p-3 text-center">Otros</th>
                  <th className="p-3 text-center text-xs font-black">Total</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="14" className="p-8 text-center text-xs text-on-surface-variant/80 font-bold">
                      Cargando reporte de comidas...
                    </td>
                  </tr>
                ) : mealReport.length === 0 ? (
                  <tr>
                    <td colSpan="14" className="p-8 text-center text-xs text-on-surface-variant/80 font-bold">
                      No se registraron comidas servidas en el rango de fechas seleccionado.
                    </td>
                  </tr>
                ) : (
                  mealReport.map((row, index) => {
                    const total = 
                      (row['Afectados'] || 0) +
                      (row['Guardia Nacional'] || 0) +
                      (row['CICPC'] || 0) +
                      (row['Vigilantes'] || 0) +
                      (row['Medicos'] || 0) +
                      (row['Administrativos'] || 0) +
                      (row['Comite'] || 0) +
                      (row['Cocineras'] || 0) +
                      (row['Juventud'] || 0) +
                      (row['SAREN'] || 0) +
                      (row['Otros'] || 0);
                    return (
                      <tr key={index} className="border-b border-outline-variant/35 hover:bg-surface-container-lowest/50 transition-all font-semibold">
                        <td className="p-3 text-xs text-on-surface font-bold">
                          {new Date(row.date + 'T00:00:00').toLocaleDateString('es-VE')}
                        </td>
                        <td className="p-3 text-xs text-primary font-black uppercase">
                          {row.meal_type}
                        </td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Afectados'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Guardia Nacional'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['CICPC'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Vigilantes'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Medicos'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Administrativos'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Comite'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Cocineras'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Juventud'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['SAREN'] || 0}</td>
                        <td className="p-3 text-center font-mono text-on-surface">{row['Otros'] || 0}</td>
                        <td className="p-3 text-center font-mono text-xs font-black text-primary bg-primary/5">{total}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
