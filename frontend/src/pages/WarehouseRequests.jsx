import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function WarehouseRequests({ token }) {
  const { refugioId } = useParams();

  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    const item = (inventory || []).find(i => 
      i.item_name.toLowerCase() === itemName.toLowerCase() ||
      itemName.toLowerCase().includes(i.item_name.toLowerCase()) ||
      i.item_name.toLowerCase().includes(itemName.toLowerCase())
    );
    return item ? item.quantity : 0;
  };

  const handleProcessRequest = async (id, status) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/warehouse-requests/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
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
                            onClick={() => handleProcessRequest(req.id, 'Aprobada')}
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
    </div>
  );
}
