import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function Trazabilidad({ token }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();

  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inventoryType, setInventoryType] = useState('');
  const [movementType, setMovementType] = useState('');
  const [depositos, setDepositos] = useState([]);
  const [selectedDeposito, setSelectedDeposito] = useState('');

  // Data states
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api');

  useEffect(() => {
    fetchDepositos();
    fetchMovements();
  }, [refugioId, startDate, endDate, inventoryType, movementType, selectedDeposito]);

  const fetchDepositos = async () => {
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/depositos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDepositos(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMovements = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let queryParams = [];
      if (startDate) queryParams.push(`start_date=${startDate}`);
      if (endDate) queryParams.push(`end_date=${endDate}`);
      if (inventoryType) queryParams.push(`inventory_type=${inventoryType}`);
      if (movementType) queryParams.push(`movement_type=${movementType}`);
      if (selectedDeposito) queryParams.push(`deposito_id=${selectedDeposito}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/inventory/movements${queryString}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMovements(await res.json());
      } else {
        setErrorMsg('Error al cargar historial de trazabilidad.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de conexión al cargar la trazabilidad.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    let queryParams = [];
    if (startDate) queryParams.push(`start_date=${startDate}`);
    if (endDate) queryParams.push(`end_date=${endDate}`);
    if (inventoryType) queryParams.push(`inventory_type=${inventoryType}`);
    if (movementType) queryParams.push(`movement_type=${movementType}`);
    if (selectedDeposito) queryParams.push(`deposito_id=${selectedDeposito}`);

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    window.open(`${API_BASE}/refugios/${refugioId}/inventory/movements/download${queryString}`, '_blank');
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setInventoryType('');
    setMovementType('');
    setSelectedDeposito('');
  };

  const getInventoryLabel = (type) => {
    switch (type) {
      case 'salud': return 'Servicio Médico';
      case 'cocina': return 'Cocina / Comedor';
      default: return 'Almacén Central';
    }
  };

  const getMovementLabel = (type) => {
    switch (type) {
      case 'ingreso_donacion': return 'Donación';
      case 'ajuste_manual': return 'Ajuste de Stock';
      case 'consumo_menu': return 'Consumo Comedor';
      case 'entrega_medicina': return 'Entrega Medicina';
      case 'entrega_insumo': return 'Entrega Insumo';
      case 'eliminacion': return 'Eliminación';
      default: return type.toUpperCase();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
        <div>
          <span className="text-[10px] uppercase font-bold text-on-surface-variant/75 tracking-widest block">Reportes y Auditoría</span>
          <h2 className="text-2xl font-extrabold text-primary mt-1">Trazabilidad de Movimientos</h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadExcel}
            className="py-3 px-5 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            style={{ backgroundColor: '#10b981' }}
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Descargar Excel
          </button>
          <button 
            onClick={() => window.print()}
            className="py-3 px-5 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            style={{ backgroundColor: '#0b2347' }}
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4 mb-8 print:hidden">
        <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-primary">filter_alt</span>
          Filtros de Auditoría
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

          <div className="flex flex-col gap-1 text-xs">
            <label className="font-bold text-on-surface-variant">Inventario / Depósito</label>
            <select
              value={inventoryType}
              onChange={(e) => setInventoryType(e.target.value)}
              className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none font-bold"
            >
              <option value="">Todos los Inventarios</option>
              <option value="almacen">Almacén Central</option>
              <option value="salud">Servicio Médico (Salud)</option>
              <option value="cocina">Cocina / Comedor (Alimentos)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <label className="font-bold text-on-surface-variant">Tipo de Movimiento</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none font-bold"
            >
              <option value="">Todos los Movimientos</option>
              <option value="ingreso_donacion">Donaciones Recibidas</option>
              <option value="ajuste_manual">Ajustes Manuales de Inventario</option>
              <option value="consumo_menu">Consumo Comedor (Planificación)</option>
              <option value="entrega_medicina">Entregas a Damnificados (Medicina)</option>
              <option value="entrega_insumo">Entregas a Damnificados (Insumo)</option>
              <option value="eliminacion">Insumos Eliminados</option>
            </select>
          </div>

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
        <div className="p-4 bg-error/15 border border-error/35 rounded-xl text-xs text-error font-semibold mb-6">
          {errorMsg}
        </div>
      )}

      {/* Movements list card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
        
        {/* Printable header */}
        <div className="hidden print:flex flex-col gap-2 p-6 border-b border-outline-variant">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-[#0b2347]">CAMPAMENTOS TEMPORALES</span>
            <span className="text-xs font-bold text-on-surface-variant">SAREN AUDIT SYSTEM</span>
          </div>
          <h2 className="text-xl font-black text-center text-primary py-4 uppercase">Reporte Histórico de Trazabilidad</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div><span className="font-bold">Filtros Activos:</span> {inventoryType ? getInventoryLabel(inventoryType) : 'Todos los Inventarios'}</div>
            <div className="text-right"><span className="font-bold">Fecha de Emisión:</span> {new Date().toLocaleString()}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/60">
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Fecha / Hora</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Inventario</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Movimiento</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Insumo</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Categoría</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Depósito</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider text-right">Cantidad</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Unidad</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Responsable</th>
                <th className="p-4 text-xs font-black text-on-surface-variant uppercase tracking-wider">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-xs text-on-surface-variant/80 font-bold">
                    Cargando movimientos...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-xs text-on-surface-variant/80 font-bold">
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
                      <td className="p-4 text-xs font-bold text-on-surface">
                        {getInventoryLabel(m.inventory_type)}
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
                      <td className="p-4 text-xs font-medium text-on-surface-variant">
                        {m.category}
                      </td>
                      <td className="p-4 text-xs font-medium text-on-surface-variant">
                        {m.deposito_name || 'Almacén Central'}
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
    </div>
  );
}
