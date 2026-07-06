import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const HEALTH_UNITS = ['Unidades', 'Cajas', 'Blisters', 'Frascos', 'Viales', 'Ampollas', 'Tabletas', 'Litros', 'Kilos', 'Packs'];

export default function InventarioSalud({ token }) {
  const { refugioId } = useParams();

  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [healthDeposito, setHealthDeposito] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showItemModal, setShowItemModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [minThreshold, setMinThreshold] = useState(5);
  const [unit, setUnit] = useState('Unidades');
  const [requestDetails, setRequestDetails] = useState('');

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchData();
  }, [refugioId]);

  const findOrCreateHealthDeposito = async () => {
    const resDep = await fetch(`${API_BASE}/refugios/${refugioId}/depositos`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resDep.ok) return null;

    const depList = await resDep.json();
    let dep = depList.find(d => {
      const name = (d.name || '').toLowerCase();
      return name.includes('médico') || name.includes('medico') || name.includes('salud');
    });

    if (!dep) {
      const createRes = await fetch(`${API_BASE}/refugios/${refugioId}/depositos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Servicio Médico',
          description: 'Depósito local del servicio médico para insumos de salud',
          capacity_percent: 100
        })
      });
      if (createRes.ok) dep = await createRes.json();
    }

    setHealthDeposito(dep || null);
    return dep || null;
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const dep = await findOrCreateHealthDeposito();

      const resInv = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resInv.ok) {
        const invData = await resInv.json();
        setInventory(dep ? invData.filter(i => i.deposito_id === dep.id) : []);
      }

      const resReq = await fetch(`${API_BASE}/refugios/${refugioId}/warehouse-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resReq.ok) {
        const reqData = await resReq.json();
        setRequests(reqData.filter(req => {
          const area = (req.area || '').toLowerCase();
          return area.includes('médico') || area.includes('medico');
        }));
      }
    } catch (err) {
      console.error(err);
      setError('Error al obtener el inventario de salud.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItemName('');
    setQuantity(0);
    setMinThreshold(5);
    setUnit('Unidades');
    setRequestDetails('');
    setEditingItemId(null);
    setIsEditing(false);
  };

  const openCreateItem = () => {
    resetForm();
    setShowItemModal(true);
  };

  const openEditItem = (item) => {
    setIsEditing(true);
    setEditingItemId(item.id);
    setItemName(item.item_name || '');
    setQuantity(item.quantity || 0);
    setMinThreshold(item.min_threshold || 5);
    setUnit(item.unit || 'Unidades');
    setShowItemModal(true);
  };

  const openRequest = (item = null) => {
    resetForm();
    if (item) {
      setItemName(item.item_name || '');
      setUnit(item.unit || 'Unidades');
      setQuantity(Math.max((parseFloat(item.min_threshold) || 5) - (parseFloat(item.quantity) || 0), 1));
    }
    setShowRequestModal(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim() || !healthDeposito) return;

    setSaving(true);
    setError('');
    setMessage('');
    const qty = parseFloat(quantity) || 0;
    const min = parseFloat(minThreshold) || 0;

    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: isEditing ? editingItemId : undefined,
          item_name: itemName,
          category: 'Medicinas',
          quantity: qty,
          min_threshold: min,
          unit,
          status: qty === 0 ? 'Sin Stock' : qty <= min ? 'Stock Crítico' : 'Stock Suficiente',
          deposito_id: healthDeposito.id
        })
      });

      if (res.ok) {
        setMessage('Insumo de salud guardado correctamente.');
        setShowItemModal(false);
        resetForm();
        fetchData();
      } else {
        setError('Error al guardar el insumo de salud.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con la API.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestWarehouse = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    setSaving(true);
    setError('');
    setMessage('');
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
          quantity: parseFloat(quantity) || 1,
          unit,
          details: requestDetails || null
        })
      });

      if (res.ok) {
        setMessage(`Solicitud de ${itemName} enviada al almacén.`);
        setShowRequestModal(false);
        resetForm();
        fetchData();
      } else {
        setError('Error al enviar la solicitud al almacén.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al enviar solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const filteredInventory = inventory.filter(item =>
    (item.item_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const criticalCount = inventory.filter(i => (parseFloat(i.quantity) || 0) <= (parseFloat(i.min_threshold) || 0)).length;
  const pendingRequests = requests.filter(req => req.status === 'Pendiente').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Inventario de Salud</h2>
          <p className="text-xs text-on-surface-variant mt-1.5 font-medium">
            Control local de medicamentos, material médico e insumos transferidos desde almacén al servicio médico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openRequest()}
            className="px-5 py-3 bg-surface border border-[#0b2347] text-[#0b2347] font-bold rounded-lg text-xs hover:bg-primary/5 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">assignment_late</span>
            Solicitar al Almacén
          </button>
          <button
            onClick={openCreateItem}
            className="px-5 py-3 bg-[#0b2347] text-white font-bold rounded-lg text-xs hover:bg-[#0b2347]/95 transition-all shadow-md flex items-center gap-2 cursor-pointer border-0"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Registrar Insumo
          </button>
        </div>
      </header>

      {error && <div className="mb-4 p-3 bg-error/15 border border-error/35 text-error rounded-xl text-xs font-bold">{error}</div>}
      {message && <div className="mb-4 p-3 bg-success/15 border border-success/35 text-success rounded-xl text-xs font-bold">{message}</div>}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <span className="text-[10px] font-black text-on-surface-variant uppercase">Insumos en Servicio Médico</span>
          <p className="text-2xl font-black text-[#0b2347] mt-1">{inventory.length}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <span className="text-[10px] font-black text-on-surface-variant uppercase">Stock Crítico</span>
          <p className="text-2xl font-black text-error mt-1">{criticalCount}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <span className="text-[10px] font-black text-on-surface-variant uppercase">Solicitudes Pendientes</span>
          <p className="text-2xl font-black text-amber-700 mt-1">{pendingRequests}</p>
        </div>
      </section>

      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-surface-container-lowest border border-outline-variant/60 p-4 rounded-xl">
        <div className="relative w-full md:max-w-md flex items-center">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
          <input
            type="text"
            placeholder="Buscar insumo médico..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          />
        </div>
        <span className="text-xs font-bold text-on-surface-variant">
          Depósito local: <span className="text-[#0b2347] font-black">{healthDeposito?.name || 'Servicio Médico'}</span>
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-on-surface-variant">Cargando inventario de salud...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                    <th className="pb-3 pl-2">Insumo Médico</th>
                    <th className="pb-3 text-center">Stock</th>
                    <th className="pb-3 text-center">Unidad</th>
                    <th className="pb-3 text-center">Mínimo</th>
                    <th className="pb-3 text-center">Estado</th>
                    <th className="pb-3 pr-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map(item => {
                    const qty = parseFloat(item.quantity) || 0;
                    const min = parseFloat(item.min_threshold) || 0;
                    const isCritical = qty <= min;
                    return (
                      <tr key={item.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-all">
                        <td className="py-4 pl-2 font-bold text-on-surface">{item.item_name}</td>
                        <td className="py-4 text-center font-bold font-mono text-primary text-sm">{item.quantity}</td>
                        <td className="py-4 text-center font-medium text-on-surface-variant">{item.unit || 'Unidades'}</td>
                        <td className="py-4 text-center font-mono text-on-surface-variant">{item.min_threshold}</td>
                        <td className="py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded font-black text-[9px] uppercase ${
                            qty === 0 ? 'bg-error/15 text-error' :
                            isCritical ? 'bg-amber-600/15 text-amber-700' : 'bg-success/15 text-success'
                          }`}>
                            {qty === 0 ? 'Sin Stock' : isCritical ? 'Stock Crítico' : 'Stock Suficiente'}
                          </span>
                        </td>
                        <td className="py-4 pr-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => openRequest(item)} className="text-amber-700 hover:bg-amber-600/10 p-1.5 rounded-full cursor-pointer border-0 bg-transparent" title="Solicitar al almacén">
                              <span className="material-symbols-outlined text-sm">assignment_late</span>
                            </button>
                            <button onClick={() => openEditItem(item)} className="text-[#0b2347] hover:bg-primary-container/20 p-1.5 rounded-full cursor-pointer border-0 bg-transparent" title="Editar insumo">
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-on-surface-variant italic font-semibold">
                        No hay insumos registrados en el inventario de salud.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="xl:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs">
            <h3 className="text-xs font-black text-[#0b2347] uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">history</span>
              Solicitudes al Almacén
            </h3>
            <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
              {requests.slice(0, 12).map(req => (
                <div key={req.id} className="border border-outline-variant/60 rounded-xl p-3 bg-surface-container-low">
                  <div className="flex justify-between gap-3">
                    <span className="text-xs font-black text-on-surface">{req.item_name}</span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${
                      req.status === 'Pendiente' ? 'bg-amber-600/15 text-amber-700' :
                      req.status === 'Aprobada' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-bold mt-1">
                    {req.quantity} {req.unit || 'Unidades'} - #{req.id}
                  </p>
                </div>
              ))}
              {requests.length === 0 && (
                <p className="text-xs text-center text-on-surface-variant py-10 italic">Aún no hay solicitudes del servicio médico.</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {showItemModal && (
        <HealthItemModal
          title={isEditing ? 'Editar Insumo de Salud' : 'Registrar Insumo de Salud'}
          itemName={itemName}
          setItemName={setItemName}
          quantity={quantity}
          setQuantity={setQuantity}
          minThreshold={minThreshold}
          setMinThreshold={setMinThreshold}
          unit={unit}
          setUnit={setUnit}
          saving={saving}
          onClose={() => setShowItemModal(false)}
          onSubmit={handleSaveItem}
        />
      )}

      {showRequestModal && (
        <HealthRequestModal
          itemName={itemName}
          setItemName={setItemName}
          quantity={quantity}
          setQuantity={setQuantity}
          unit={unit}
          setUnit={setUnit}
          requestDetails={requestDetails}
          setRequestDetails={setRequestDetails}
          saving={saving}
          onClose={() => setShowRequestModal(false)}
          onSubmit={handleRequestWarehouse}
        />
      )}
    </div>
  );
}

function HealthItemModal({ title, itemName, setItemName, quantity, setQuantity, minThreshold, setMinThreshold, unit, setUnit, saving, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
        <ModalHeader title={title} onClose={onClose} />
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField label="Nombre del Insumo" value={itemName} onChange={setItemName} placeholder="ej. Insulina rápida, Gasas, Solución fisiológica" />
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Cantidad" value={quantity} onChange={setQuantity} />
            <UnitSelect unit={unit} setUnit={setUnit} />
          </div>
          <NumberField label="Alerta Mínima de Stock" value={minThreshold} onChange={setMinThreshold} />
          <ModalActions saving={saving} onClose={onClose} submitLabel="Guardar Inventario" />
        </form>
      </div>
    </div>
  );
}

function HealthRequestModal({ itemName, setItemName, quantity, setQuantity, unit, setUnit, requestDetails, setRequestDetails, saving, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
        <ModalHeader title="Solicitar Insumo al Almacén" onClose={onClose} />
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField label="Insumo Requerido" value={itemName} onChange={setItemName} placeholder="ej. Insulina rápida" />
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Cantidad Solicitada" value={quantity} onChange={setQuantity} />
            <UnitSelect unit={unit} setUnit={setUnit} />
          </div>
          <div>
            <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Detalle / Justificación</label>
            <textarea
              value={requestDetails}
              onChange={e => setRequestDetails(e.target.value)}
              rows={3}
              placeholder="Motivo de la solicitud, pacientes asociados o urgencia operativa."
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium resize-none"
            />
          </div>
          <ModalActions saving={saving} onClose={onClose} submitLabel="Enviar Solicitud" />
        </form>
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div className="flex justify-between items-center border-b border-outline-variant/60 pb-3">
      <h3 className="text-sm font-extrabold text-[#0b2347] uppercase">{title}</h3>
      <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer border-0 bg-transparent" type="button">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
        required
      />
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">{label}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center"
        required
      />
    </div>
  );
}

function UnitSelect({ unit, setUnit }) {
  return (
    <div>
      <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Unidad</label>
      <select
        value={unit}
        onChange={e => setUnit(e.target.value)}
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold"
      >
        {HEALTH_UNITS.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function ModalActions({ saving, onClose, submitLabel }) {
  return (
    <div className="flex gap-2 justify-end border-t border-outline-variant/60 pt-4 mt-2">
      <button type="button" onClick={onClose} className="px-5 py-2.5 bg-surface border border-outline-variant text-on-surface font-bold rounded-lg text-xs cursor-pointer hover:bg-surface-container">
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#0b2347] text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50 border-0">
        <span className="material-symbols-outlined text-xs">save</span>
        {saving ? 'Guardando...' : submitLabel}
      </button>
    </div>
  );
}
