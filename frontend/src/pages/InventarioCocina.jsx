import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function InventarioCocina({ token, user }) {
  const { refugioId } = useParams();

  const [inventory, setInventory] = useState([]);
  const [cocinaDeposito, setCocinaDeposito] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');

  // Form Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  // Form Fields
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [minThreshold, setMinThreshold] = useState(5);
  const [unit, setUnit] = useState('Unidades');
  const [saving, setSaving] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchData();
  }, [refugioId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Find or create Cocina depósito
      let cocDep = null;
      const resDep = await fetch(`${API_BASE}/refugios/${refugioId}/depositos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resDep.ok) {
        const depList = await resDep.json();
        cocDep = depList.find(d => d.name.toLowerCase().includes('cocina'));
        if (cocDep) {
          setCocinaDeposito(cocDep);
        } else {
          // Auto create Cocina depósito if missing
          const createRes = await fetch(`${API_BASE}/refugios/${refugioId}/depositos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: 'Cocina',
              description: 'Depósito local de cocina para raciones diarias',
              capacity_percent: 100
            })
          });
          if (createRes.ok) {
            cocDep = await createRes.json();
            setCocinaDeposito(cocDep);
          }
        }
      }

      // Fetch inventory items
      const resInv = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resInv.ok) {
        const invData = await resInv.json();
        // Show only items belonging to Cocina depósito!
        if (cocDep) {
          setInventory(invData.filter(i => i.deposito_id === cocDep.id));
        } else {
          setInventory([]);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error al obtener el inventario de cocina.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingItemId(null);
    setItemName('');
    setQuantity(0);
    setMinThreshold(5);
    setUnit('Unidades');
    setShowFormModal(true);
  };

  const handleOpenEdit = (item) => {
    setIsEditing(true);
    setEditingItemId(item.id);
    setItemName(item.item_name);
    setQuantity(item.quantity);
    setMinThreshold(item.min_threshold);
    setUnit(item.unit || 'Unidades');
    setShowFormModal(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim() || !cocinaDeposito) return;

    setError('');
    setMessage('');
    setSaving(true);
    try {
      const payload = {
        item_name: itemName,
        category: 'Alimentos',
        quantity: parseFloat(quantity) || 0,
        min_threshold: parseFloat(minThreshold) || 0,
        unit: unit,
        status: (parseFloat(quantity) || 0) <= (parseFloat(minThreshold) || 0) ? 'Stock Crítico' : 'Stock Suficiente',
        deposito_id: cocinaDeposito.id
      };

      if (isEditing) {
        payload.id = editingItemId;
      }

      const res = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setMessage(`Insumo guardado correctamente.`);
        setShowFormModal(false);
        fetchData();
      } else {
        setError('Error al guardar insumo de cocina.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con la API.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de eliminar '${name}' del inventario de la cocina?`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      // In this system, inventory items are usually updated or soft deleted. Let's delete via API
      const res = await fetch(`${API_BASE}/inventory/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage(`Insumo '${name}' eliminado del stock de cocina.`);
        fetchData();
      } else {
        // Fallback: If delete fails or not implemented, set qty to 0
        const item = inventory.find(i => i.id === id);
        if (item) {
          const resetRes = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              ...item,
              quantity: 0,
              status: 'Sin Stock'
            })
          });
          if (resetRes.ok) {
            setMessage(`Insumo '${name}' puesto en cero.`);
            fetchData();
          } else {
            setError('Error al eliminar el insumo.');
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al eliminar insumo.');
    }
  };

  // Filter items
  const filteredInventory = inventory.filter(item => 
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations for Kitchen Stock
  const totalKitchenItems = filteredInventory.length;
  const totalKitchenPages = Math.ceil(totalKitchenItems / itemsPerPage) || 1;
  const indexLastKitchen = currentPage * itemsPerPage;
  const indexFirstKitchen = indexLastKitchen - itemsPerPage;
  const currentKitchenList = filteredInventory.slice(indexFirstKitchen, indexLastKitchen);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Inventario de Cocina</h2>
          <p className="text-xs text-on-surface-variant mt-1.5 font-medium">Control e insumos almacenados físicamente en la cocina y despensa local.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="px-5 py-3 bg-[#0b2347] text-white font-bold rounded-lg text-xs hover:bg-[#0b2347]/95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border-0"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Nuevo Alimento
        </button>
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

      {/* Search and stats bar */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-surface-container-lowest border border-outline-variant/60 p-4 rounded-xl">
        <div className="relative w-full md:max-w-md flex items-center">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
          <input 
            type="text" 
            placeholder="Buscar insumo en cocina..." 
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-surface-container border border-outline-variant rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span>Mostrar:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-surface-container border border-outline-variant rounded-lg p-1.5 text-xs focus:outline-none font-bold"
            >
              <option value="10">10 por página</option>
              <option value="15">15 por página</option>
              <option value="25">25 por página</option>
              <option value="50">50 por página</option>
            </select>
          </div>
          <span>Total Ítems: <span className="text-[#0b2347] font-black">{inventory.length}</span></span>
          <span>Stock Crítico: <span className="text-error font-black">{inventory.filter(i => parseFloat(i.quantity) <= parseFloat(i.min_threshold)).length}</span></span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-on-surface-variant">Cargando inventario local...</div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                  <th className="pb-3 pl-2">Alimento / Insumo</th>
                  <th className="pb-3 text-center">Stock Actual</th>
                  <th className="pb-3 text-center">Unidad</th>
                  <th className="pb-3 text-center">Stock Mínimo</th>
                  <th className="pb-3 text-center">Estado</th>
                  <th className="pb-3 pr-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentKitchenList.map((item) => {
                  const qtyVal = parseFloat(item.quantity) || 0;
                  const minVal = parseFloat(item.min_threshold) || 0;
                  const isCritical = qtyVal <= minVal;
                  return (
                    <tr key={item.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-all">
                      <td className="py-4 pl-2 font-bold text-on-surface">{item.item_name}</td>
                      <td className="py-4 text-center font-bold font-mono text-primary text-sm">{item.quantity}</td>
                      <td className="py-4 text-center font-medium text-on-surface-variant">{item.unit || 'Unidades'}</td>
                      <td className="py-4 text-center font-mono text-on-surface-variant">{item.min_threshold}</td>
                      <td className="py-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded font-black text-[9px] uppercase ${
                          qtyVal === 0 ? 'bg-error/15 text-error' :
                          isCritical ? 'bg-amber-600/15 text-amber-700' : 'bg-success/15 text-success'
                        }`}>
                          {qtyVal === 0 ? 'Sin Stock' : (isCritical ? 'Stock Crítico' : 'Stock Suficiente')}
                        </span>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="text-[#0b2347] hover:bg-primary-container/20 p-1.5 rounded-full cursor-pointer border-0 bg-transparent"
                            title="Editar Insumo"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button 
                            onClick={() => handleDeleteItem(item.id, item.item_name)}
                            className="text-error hover:bg-error-container/20 p-1.5 rounded-full cursor-pointer border-0 bg-transparent"
                            title="Eliminar Insumo"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-on-surface-variant italic font-semibold">No se encontraron productos en el inventario de la cocina.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalKitchenPages > 1 && (
            <div className="flex justify-between items-center mt-6 text-xs pt-4 border-t border-outline-variant/40">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-surface border border-outline-variant rounded-lg font-bold hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Anterior
              </button>
              <span className="font-semibold text-on-surface-variant">
                Página <span className="text-[#0b2347] font-black">{currentPage}</span> de <span className="text-[#0b2347] font-black">{totalKitchenPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalKitchenPages))}
                disabled={currentPage === totalKitchenPages}
                className="px-4 py-2 bg-surface border border-outline-variant rounded-lg font-bold hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit / Create Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-3">
              <h3 className="text-sm font-extrabold text-[#0b2347] uppercase">
                {isEditing ? 'Editar Insumo de Cocina' : 'Registrar Nuevo Insumo'}
              </h3>
              <button 
                onClick={() => setShowFormModal(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer border-0 bg-transparent"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Nombre del Alimento</label>
                <input 
                  type="text"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="ej. Harina PAN, Arroz, Pasta"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Cantidad en Cocina</label>
                  <input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Unidad de Medida</label>
                  <select 
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  >
                    <option value="Unidades">Unidades</option>
                    <option value="Kilos">Kilos</option>
                    <option value="Litros">Litros</option>
                    <option value="Paquetes">Paquetes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Alerta Mínima de Stock</label>
                <input 
                  type="number"
                  min="0"
                  step="0.01"
                  value={minThreshold}
                  onChange={e => setMinThreshold(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-outline-variant/60 pt-4 mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-2.5 bg-surface border border-outline-variant text-on-surface font-bold rounded-lg text-xs cursor-pointer hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#0b2347] text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50 border-0"
                >
                  <span className="material-symbols-outlined text-xs">save</span>
                  {saving ? 'Guardando...' : 'Ajustar Inventario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
