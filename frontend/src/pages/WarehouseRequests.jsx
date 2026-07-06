import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function WarehouseRequests({ token }) {
  const { refugioId } = useParams();

  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Approval modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedSourceDeposito, setSelectedSourceDeposito] = useState('');

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchRequests();
  }, [refugioId]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/warehouse-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRequests(await res.json());
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

  const getInventoryQty = (itemName) => {
    if (!itemName) return 0;
    const cleanReqName = itemName.replace(/\s*\(.*?\)\s*/g, '').toLowerCase().trim();
    return (inventory || [])
      .filter(i => {
        if (i.deposito_name && i.deposito_name.toLowerCase().includes('cocina')) {
          return false;
        }
        const cleanItemName = i.item_name.replace(/\s*\(.*?\)\s*/g, '').toLowerCase().trim();
        return cleanItemName === cleanReqName || cleanReqName.includes(cleanItemName) || cleanItemName.includes(cleanReqName);
      })
      .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  };

  const getAvailableDepositosForRequest = (req) => {
    if (!req || !req.item_name) return [];
    const cleanReqName = req.item_name.replace(/\s*\(.*?\)\s*/g, '').toLowerCase().trim();
    return (inventory || []).filter(item => {
      if (!item.deposito_name || item.deposito_name.toLowerCase().includes('cocina')) {
        return false;
      }
      const cleanItemName = item.item_name.replace(/\s*\(.*?\)\s*/g, '').toLowerCase().trim();
      return cleanItemName === cleanReqName || cleanReqName.includes(cleanItemName) || cleanItemName.includes(cleanReqName);
    });
  };

  const handleProcessRequest = async (id, status, depositoId = null) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/warehouse-requests/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status,
          deposito_id: depositoId ? parseInt(depositoId) : null
        })
      });
      if (res.ok) {
        setMessage(`Solicitud #${id} marcada como ${status} correctamente.`);
        fetchRequests();
      } else {
        setError('Error al procesar la solicitud.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8 border-b border-outline-variant/30 pb-4">
        <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Solicitudes de Transferencia</h2>
        <p className="text-xs text-on-surface-variant mt-1.5 font-mono">Bandeja de entrada de solicitudes de insumos provenientes de comedor y servicios médicos.</p>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-error/15 border border-error/35 text-error rounded-xl text-xs font-bold animate-fade-in">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 bg-success/15 border border-success/35 text-success rounded-xl text-xs font-bold animate-fade-in">
          {message}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-on-surface-variant">Cargando solicitudes...</div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                  <th className="pb-3 pl-2">ID</th>
                  <th className="pb-3">Área Solicitante</th>
                  <th className="pb-3">Insumo Requerido</th>
                  <th className="pb-3 text-center">Cantidad</th>
                  <th className="pb-3">Fecha Solicitud</th>
                  <th className="pb-3 text-center">Estado</th>
                  <th className="pb-3 text-center">Stock Almacén</th>
                  <th className="pb-3 pr-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const stock = getInventoryQty(req.item_name);
                  const insufficient = stock < req.quantity;
                  return (
                    <tr key={req.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-all">
                      <td className="py-4 pl-2 font-mono font-bold text-[#0b2347]">#{req.id}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                          req.area === 'Comedor' ? 'bg-amber-600/15 text-amber-700' : 'bg-primary/10 text-primary'
                        }`}>{req.area}</span>
                      </td>
                      <td className="py-4 font-bold text-on-surface">{req.item_name}</td>
                      <td className="py-4 text-center font-bold font-mono">{req.quantity}</td>
                      <td className="py-4 text-on-surface-variant">
                        {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                          req.status === 'Pendiente' ? 'bg-surface-container-high text-on-surface-variant' :
                          req.status === 'Aprobada' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
                        }`}>{req.status}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className={`font-mono font-bold text-xs ${insufficient && req.status === 'Pendiente' ? 'text-error font-extrabold' : 'text-on-surface'}`}>
                          {stock} uds
                        </span>
                        {insufficient && req.status === 'Pendiente' && (
                          <span className="block text-[7px] text-error font-black uppercase mt-0.5 tracking-wider">¡Insuficiente!</span>
                        )}
                      </td>
                    <td className="py-4 pr-2 text-right">
                      {req.status === 'Pendiente' ? (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedRequest(req);
                              setSelectedSourceDeposito('');
                              setShowApproveModal(true);
                            }}
                            style={{ backgroundColor: '#2e7d32' }}
                            className="px-2.5 py-1.5 text-white font-bold rounded-lg text-[10px] hover:opacity-90 cursor-pointer shadow-2xs"
                          >
                            Aprobar
                          </button>
                          <button 
                            onClick={() => handleProcessRequest(req.id, 'Rechazada')}
                            style={{ backgroundColor: '#c62828' }}
                            className="px-2.5 py-1.5 text-white font-bold rounded-lg text-[10px] hover:opacity-90 cursor-pointer shadow-2xs"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant italic font-semibold">Procesada</span>
                      )}
                    </td>
                  </tr>
                )})}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-on-surface-variant italic font-semibold">No hay solicitudes de transferencia pendientes en este momento.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modal: Aprobar Solicitud con Selección de Depósito */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#0b2347] uppercase">
                  Aprobar Solicitud #{selectedRequest.id}
                </h3>
                <p className="text-[10px] text-on-surface-variant font-bold mt-0.5">Área Solicitante: {selectedRequest.area}</p>
              </div>
              <button 
                onClick={() => setShowApproveModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 cursor-pointer border-0 bg-transparent flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 py-2">
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/40">
                <span className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Insumo Requerido</span>
                <span className="text-xs font-bold text-on-surface">{selectedRequest.item_name}</span>
                <span className="text-xs font-mono font-black text-primary block mt-1">Cantidad Solicitada: {selectedRequest.quantity}</span>
              </div>

              <div>
                <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Seleccionar Depósito de Origen</label>
                {getAvailableDepositosForRequest(selectedRequest).length > 0 ? (
                  <select 
                    value={selectedSourceDeposito}
                    onChange={e => setSelectedSourceDeposito(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                    required
                  >
                    <option value="">-- Seleccionar Depósito --</option>
                    {getAvailableDepositosForRequest(selectedRequest).map(dep => (
                      <option key={dep.id} value={dep.deposito_id}>
                        {dep.deposito_name || 'Bodega Central'} (Disponible: {dep.quantity} {dep.unit})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-warning/15 border border-warning/35 text-amber-800 rounded-lg text-xs font-bold">
                    No se encontró stock registrado de este insumo en los depósitos del Almacén. Se procesará la transferencia creando/buscando el insumo correspondiente.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-outline-variant/60 pt-4 mt-2">
              <button 
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 bg-surface border border-outline-variant text-on-surface font-bold rounded-lg text-xs cursor-pointer hover:bg-surface-container"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowApproveModal(false);
                  handleProcessRequest(selectedRequest.id, 'Aprobada', selectedSourceDeposito);
                }}
                disabled={getAvailableDepositosForRequest(selectedRequest).length > 0 && !selectedSourceDeposito}
                className="px-4 py-2 bg-[#2e7d32] text-white font-bold rounded-lg text-xs cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed border-0"
              >
                Confirmar y Despachar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
