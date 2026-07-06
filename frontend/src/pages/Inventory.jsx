import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function Inventory({ token, tab }) {
  const { refugioId } = useParams();
  const [activeTab, setActiveTab] = useState(tab || 'stock'); // 'stock', 'deliver', 'history'
  const [inventory, setInventory] = useState([]);
  const [residents, setResidents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (tab) {
      setActiveTab(tab);
    }
  }, [tab]);

  // Item Form State
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemId, setItemId] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Alimentos');
  const [quantity, setQuantity] = useState(10);
  const [minThreshold, setMinThreshold] = useState(5);
  const [unit, setUnit] = useState('unidades');

  // Consolidated stock modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedConsolidatedItem, setSelectedConsolidatedItem] = useState(null);

  // Search and Pagination States for Warehouse Stock
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Redesigned Delivery Form State
  const [residentId, setResidentId] = useState('');
  const [searchResidentQuery, setSearchResidentQuery] = useState('');
  const [showResidentDropdown, setShowResidentDropdown] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [motivoEntrega, setMotivoEntrega] = useState('Entrega Periódica (Quincenal)');
  const [deliveryItems, setDeliveryItems] = useState([
    { item_name: '', quantity: 1 }
  ]);
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchInventory();
    fetchResidents();
    fetchFamilies();
    fetchDeliveries();
  }, [refugioId, activeTab]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setInventory(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResidents = async () => {
    try {
      const res = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResidents(data.filter(r => r.status === 'Activo'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFamilies = async () => {
    try {
      const res = await fetch(`${API_BASE}/family-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setFamilies(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDeliveries = async () => {
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/deliveries`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map(d => ({
          id: d.id,
          resident_id: d.resident_id,
          resident_name: `${d.first_name} ${d.last_name}`,
          item_name: d.item_name,
          quantity: d.quantity,
          delivered_at: new Date(d.delivered_at).toLocaleDateString(),
          raw_date: d.delivered_at
        }));
        setDeliveries(mapped);
      }
    } catch (err) {
      console.error("Error fetching deliveries:", err);
    }
  };

  const getConsolidatedInventory = () => {
    const grouped = {};
    inventory.forEach(item => {
      // Exclude items in Cocina deposit if they should only be in Comedor & Logística!
      if (item.deposito_name && item.deposito_name.toLowerCase().includes('cocina')) {
        return;
      }

      const key = `${item.item_name.toLowerCase().trim()}_${item.category.toLowerCase().trim()}`;
      if (!grouped[key]) {
        grouped[key] = {
          item_name: item.item_name,
          category: item.category,
          quantity: 0,
          min_threshold: parseFloat(item.min_threshold) || 0,
          unit: item.unit || 'Unidades',
          items: []
        };
      }
      grouped[key].quantity += parseFloat(item.quantity) || 0;
      grouped[key].items.push(item);
    });
    const list = Object.values(grouped);
    if (!searchQuery.trim()) return list;
    return list.filter(item => 
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Save / Edit stock item
  const handleSaveItem = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: itemId || undefined,
          item_name: itemName,
          category,
          quantity: parseInt(quantity),
          min_threshold: parseInt(minThreshold),
          unit
        })
      });
      if (res.ok) {
        setMessage('Insumo guardado correctamente.');
        setShowItemModal(false);
        setItemId('');
        setItemName('');
        setQuantity(10);
        setMinThreshold(5);
        setUnit('unidades');
        fetchInventory();
      } else {
        setError('Error al guardar el insumo.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    }
  };

  // Add item row to delivery order
  const handleAddDeliveryRow = () => {
    setDeliveryItems([
      ...deliveryItems,
      { item_name: '', quantity: 1 }
    ]);
  };

  // Remove item row from delivery order
  const handleRemoveDeliveryRow = (index) => {
    if (deliveryItems.length === 1) return;
    setDeliveryItems(deliveryItems.filter((_, idx) => idx !== index));
  };

  // Update item row property
  const handleUpdateDeliveryRow = (index, field, value) => {
    const updated = [...deliveryItems];
    updated[index][field] = value;
    setDeliveryItems(updated);
  };

  // Submit multi-item delivery form in batch
  const handleDeliverSupplies = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!residentId) {
      setError('Debe seleccionar un beneficiario.');
      return;
    }

    const invalidItems = deliveryItems.some(i => !i.item_name || i.quantity <= 0);
    if (invalidItems) {
      setError('Asegúrese de seleccionar un insumo válido y cantidad mayor a cero en cada fila.');
      return;
    }

    // Validate stock constraints
    for (const dItem of deliveryItems) {
      const dbItem = inventory.find(i => i.item_name === dItem.item_name);
      if (!dbItem) {
        setError(`El artículo '${dItem.item_name}' no se encuentra en el inventario.`);
        return;
      }
      if (dbItem.quantity < dItem.quantity) {
        setError(`Stock insuficiente para '${dItem.item_name}'. Disponible: ${dbItem.quantity} ${dbItem.unit}.`);
        return;
      }
    }

    setSubmittingDelivery(true);
    try {
      // Loop sequentially to register each item
      for (const dItem of deliveryItems) {
        await fetch(`${API_BASE}/refugios/${refugioId}/deliveries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            resident_id: parseInt(residentId),
            item_name: dItem.item_name,
            quantity: parseInt(dItem.quantity)
          })
        });
      }

      setMessage('Entrega de suministros registrada con éxito en el sistema.');
      setResidentId('');
      setSearchResidentQuery('');
      setDeliveryItems([{ item_name: '', quantity: 1 }]);
      fetchInventory();
      fetchDeliveries();
    } catch (err) {
      console.error(err);
      setError('Error al registrar las entregas en el servidor.');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const handleEditItem = (item) => {
    setItemId(item.id);
    setItemName(item.item_name);
    setCategory(item.category);
    setQuantity(item.quantity);
    setMinThreshold(item.min_threshold);
    setUnit(item.unit);
    setShowItemModal(true);
  };

  // Find active resident detail
  const selectedResident = residents.find(r => r.id.toString() === residentId.toString());

  // Get family count for resident
  const getFamilyCount = (resObj) => {
    if (!resObj || !resObj.family_group_id) return 1;
    const count = residents.filter(r => r.family_group_id === resObj.family_group_id).length;
    return count > 0 ? count : 1;
  };

  // Get last delivery date for selected resident
  const getLastDeliveryDate = (resId) => {
    const userDels = deliveries.filter(d => d.resident_id.toString() === resId.toString());
    if (userDels.length === 0) return 'Ninguna registrada';
    return userDels[0].delivered_at; // Ordered DESC in backend
  };

  // Get custom code abbreviating sede (mocking code format logic)
  const getResidentCode = (resObj) => {
    if (!resObj) return '';
    const abrev = 'VALE';
    const famCount = getFamilyCount(resObj);
    return `${abrev}-${famCount}-${resObj.id}`;
  };

  // Live Metrics Calculations
  const foodStock = inventory.filter(i => i.category === 'Alimentos').reduce((acc, curr) => acc + curr.quantity, 0);
  const foodPercent = Math.min(100, Math.round((foodStock / 5000) * 100)); // Cap limit 5000 units
  
  const medicineAlerts = inventory.filter(i => i.category === 'Medicinas' && i.quantity <= i.min_threshold).length;
  const medicineTotal = inventory.filter(i => i.category === 'Medicinas').length || 1;
  const medicinePercent = Math.round((medicineAlerts / medicineTotal) * 100);

  const deliveriesToday = deliveries.filter(d => {
    const date = new Date(d.raw_date).toDateString();
    const today = new Date().toDateString();
    return date === today;
  }).length;

  const stockAlerts = inventory.filter(i => i.quantity <= i.min_threshold).length;

  // Pagination calculations for Warehouse Stock
  const consolidatedList = getConsolidatedInventory();
  const totalStockItems = consolidatedList.length;
  const totalStockPages = Math.ceil(totalStockItems / itemsPerPage) || 1;
  const indexLastStock = currentPage * itemsPerPage;
  const indexFirstStock = indexLastStock - itemsPerPage;
  const currentStockList = consolidatedList.slice(indexFirstStock, indexLastStock);

  // Filter residents list dynamically according to search input
  const filteredSearchResidents = residents.filter(r => {
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
    const doc = (r.document_id || '').toLowerCase();
    const q = searchResidentQuery.toLowerCase();
    return fullName.includes(q) || doc.includes(q);
  });

  // Extract resident base64 photo if configured in metadata
  const getResidentPhoto = (resObj) => {
    if (!resObj || !resObj.special_needs) return null;
    try {
      const meta = JSON.parse(resObj.special_needs);
      return meta.photo || null;
    } catch {
      return null;
    }
  };

  // History deliveries of the selected resident
  const selectedResidentHistory = selectedResident 
    ? deliveries.filter(d => d.resident_id.toString() === selectedResident.id.toString()) 
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-primary">Insumos e Inventario</h2>
          <p className="text-xs text-on-surface-variant">Gestione el almacén central de la sede y registre la entrega de insumos a damnificados.</p>
        </div>
        {activeTab === 'stock' && (
          <button 
            onClick={() => {
              setItemId('');
              setItemName('');
              setCategory('Alimentos');
              setQuantity(10);
              setMinThreshold(5);
              setUnit('unidades');
              setShowItemModal(true);
            }}
            className="px-4 py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
            Nuevo Insumo
          </button>
        )}
      </header>

      {/* Tabs */}
      {!tab && (
        <div className="flex border-b border-outline-variant mb-6 gap-2">
          <button 
            onClick={() => setActiveTab('stock')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            Inventario en Almacén
          </button>
          <button 
            onClick={() => setActiveTab('deliver')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'deliver' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            Entrega de Suministros
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            Entregas Recientes (Historial)
          </button>
        </div>
      )}

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

      {/* TAB CONTENT: STOCK */}
      {activeTab === 'stock' && (
        <div className="flex flex-col gap-6">
          {/* Table controls */}
          <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-96 flex items-center">
              <span className="material-symbols-outlined text-on-surface-variant absolute left-3">search</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar por nombre o categoría..."
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              />
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-on-surface-variant font-semibold">Mostrar:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none font-bold"
              >
                <option value="10">10 por página</option>
                <option value="15">15 por página</option>
                <option value="25">25 por página</option>
                <option value="50">50 por página</option>
              </select>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-center">Stock Actual</th>
                    <th className="py-3 px-4 text-center">Mínimo Crítico</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-on-surface-variant font-medium">Cargando inventario...</td>
                    </tr>
                  ) : currentStockList.length > 0 ? (
                    currentStockList.map((item, idx) => {
                      const status = item.quantity === 0 ? 'Sin Stock' : (item.quantity <= item.min_threshold ? 'Stock Crítico' : 'Stock Suficiente');
                      return (
                        <tr key={idx} className="border-b border-outline-variant hover:bg-surface-container/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-primary">{item.item_name}</td>
                          <td className="py-3 px-4 text-on-surface-variant">{item.category}</td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-sm">{item.quantity} {item.unit}</td>
                          <td className="py-3 px-4 text-center text-on-surface-variant">{item.min_threshold} {item.unit}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              status === 'Stock Suficiente' ? 'bg-success/15 text-success' :
                              status === 'Stock Crítico' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'
                            }`}>
                              {status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setSelectedConsolidatedItem(item);
                                  setShowDetailModal(true);
                                }}
                                className="px-2.5 py-1 bg-primary text-white rounded font-bold text-[10px] cursor-pointer hover:bg-primary/90 flex items-center gap-1 shadow-xs border-0"
                              >
                                <span className="material-symbols-outlined text-[10px]">visibility</span>
                                Ver Detalle
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-on-surface-variant font-medium">No hay insumos registrados en el inventario.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalStockPages > 1 && (
              <div className="flex justify-between items-center mt-6 text-xs pt-4 border-t border-outline-variant/40">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-surface border border-outline-variant rounded-lg font-bold hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Anterior
                </button>
                <span className="font-semibold text-on-surface-variant">
                  Página <span className="text-[#0b2347] font-black">{currentPage}</span> de <span className="text-[#0b2347] font-black">{totalStockPages}</span>
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalStockPages))}
                  disabled={currentPage === totalStockPages}
                  className="px-4 py-2 bg-surface border border-outline-variant rounded-lg font-bold hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: DELIVER SUPPLIES (REDESIGNED MULTI-ITEM) */}
      {activeTab === 'deliver' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: MULTI-ITEM ORDER FORM (8 columns) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Step 1: Beneficiary Selector */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#0b2347]">person</span>
                1. Selección de Beneficiario
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 text-xs relative">
                  <label className="font-bold text-on-surface-variant">Nombre o Cédula del Beneficiario</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text"
                      value={searchResidentQuery}
                      onChange={(e) => {
                        setSearchResidentQuery(e.target.value);
                        setShowResidentDropdown(true);
                      }}
                      onFocus={() => setShowResidentDropdown(true)}
                      placeholder="Escriba para buscar por nombre o C.I..."
                      className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    />
                    {residentId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setResidentId('');
                          setSearchResidentQuery('');
                          setShowResidentDropdown(false);
                        }}
                        className="absolute right-2 text-on-surface-variant hover:text-on-surface rounded-full p-1 cursor-pointer flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Drodown menu */}
                  {showResidentDropdown && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-surface border border-outline-variant mt-1 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredSearchResidents.length > 0 ? (
                        filteredSearchResidents.map(r => (
                          <div 
                            key={r.id}
                            onClick={() => {
                              setResidentId(r.id);
                              setSearchResidentQuery(`${r.first_name} ${r.last_name} - C.I. ${r.document_id || 'N/T'}`);
                              setShowResidentDropdown(false);
                            }}
                            className="p-3 text-xs hover:bg-primary/5 cursor-pointer border-b border-outline-variant/10 flex justify-between items-center"
                          >
                            <span className="font-bold text-on-surface">{r.first_name} {r.last_name}</span>
                            <span className="font-mono text-on-surface-variant text-[10px]">C.I. {r.document_id || 'N/T'}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-xs text-on-surface-variant italic text-center">No se encontraron residentes.</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <label className="font-bold text-on-surface-variant">Motivo de la Entrega</label>
                  <select 
                    value={motivoEntrega}
                    onChange={(e) => setMotivoEntrega(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  >
                    <option value="Entrega Periódica (Quincenal)">Entrega Periódica (Quincenal)</option>
                    <option value="Emergencia Médica">Emergencia Médica</option>
                    <option value="Ingreso Inicial">Ingreso Inicial al Centro</option>
                    <option value="Apoyo Extraordinario">Apoyo Extraordinario</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Multi-Item Table selection */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-5">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#0b2347]">shopping_cart</span>
                  2. Artículos para Entrega
                </h3>
                <button 
                  type="button"
                  onClick={handleAddDeliveryRow}
                  className="text-xs font-black text-primary flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  + Añadir Artículo
                </button>
              </div>

              {/* Delivery Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                      <th className="pb-3 px-2">Artículo</th>
                      <th className="pb-3 px-2">Categoría</th>
                      <th className="pb-3 px-2">Stock Disponible</th>
                      <th className="pb-3 px-2">Cantidad</th>
                      <th className="pb-3 px-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryItems.map((dItem, index) => {
                      const currentInvItem = inventory.find(i => i.item_name === dItem.item_name);
                      const isLowStock = currentInvItem && currentInvItem.quantity <= currentInvItem.min_threshold;
                      
                      return (
                        <tr key={index} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors">
                          
                          {/* Item selector */}
                          <td className="py-3 px-2">
                            <select 
                              value={dItem.item_name}
                              onChange={(e) => handleUpdateDeliveryRow(index, 'item_name', e.target.value)}
                              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-[200px]"
                            >
                              <option value="">-- Seleccionar --</option>
                              {inventory.map(i => (
                                <option key={i.id} value={i.item_name} disabled={i.quantity <= 0}>
                                  {i.item_name} {i.quantity <= 0 ? '(Agotado)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-2 font-medium text-on-surface-variant">
                            {currentInvItem ? (
                              <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold">
                                {currentInvItem.category}
                              </span>
                            ) : '-'}
                          </td>

                          {/* Available Stock & Warning */}
                          <td className="py-3 px-2 text-on-surface-variant font-medium">
                            {currentInvItem ? (
                              <div className="flex flex-col">
                                <span>{currentInvItem.quantity} {currentInvItem.unit}</span>
                                {isLowStock && (
                                  <span className="text-[9px] font-black text-error uppercase font-mono mt-0.5">
                                    (Bajo Stock)
                                  </span>
                                )}
                              </div>
                            ) : '-'}
                          </td>

                          {/* Quantity input */}
                          <td className="py-3 px-2">
                            <input 
                              type="number" 
                              value={dItem.quantity}
                              min="1"
                              max={currentInvItem ? currentInvItem.quantity : 100}
                              onChange={(e) => handleUpdateDeliveryRow(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-xs focus:outline-none w-16 text-center font-bold"
                            />
                          </td>

                          {/* Delete Action */}
                          <td className="py-3 px-2 text-right">
                            {deliveryItems.length > 1 && (
                              <button 
                                type="button"
                                onClick={() => handleRemoveDeliveryRow(index)}
                                className="w-8 h-8 rounded-lg bg-error/10 hover:bg-error/15 text-error flex items-center justify-center shrink-0 cursor-pointer inline-flex"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 3: Transaction Summary & Submit */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">fact_check</span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-on-surface uppercase">Resumen de la Transacción</h4>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                    {deliveryItems.length} artículos listados para {selectedResident ? `${selectedResident.first_name} ${selectedResident.last_name}` : 'ningún beneficiario seleccionado'}.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  type="button" 
                  onClick={() => {
                    setResidentId('');
                    setSearchResidentQuery('');
                    setDeliveryItems([{ item_name: '', quantity: 1 }]);
                  }}
                  className="flex-1 md:flex-initial py-2.5 px-4 bg-surface border border-outline-variant text-on-surface font-bold rounded-xl text-xs hover:bg-surface-container cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleDeliverSupplies}
                  disabled={submittingDelivery || !residentId}
                  className="flex-grow md:flex-initial py-2.5 px-5 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 cursor-pointer transition-all disabled:opacity-50"
                >
                  {submittingDelivery ? 'Registrando...' : 'Confirmar Entrega'}
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: BENFICIARY PROFILE & STATISTICS (4 columns) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Beneficiary Profile Card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col items-center text-center gap-4 relative overflow-hidden">
              {/* Active Badge */}
              <span className="absolute top-4 right-4 bg-success/15 text-success font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Activo
              </span>

              {/* Profile Photo Rendering */}
              <div className="w-16 h-16 rounded-full border border-[#0b2347]/20 bg-surface-container overflow-hidden flex items-center justify-center shrink-0 mt-2">
                {selectedResident && getResidentPhoto(selectedResident) ? (
                  <img 
                    src={getResidentPhoto(selectedResident)} 
                    alt="Foto Perfil" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-[#0b2347]">person</span>
                )}
              </div>

              <div>
                <h4 className="text-md font-black text-on-surface uppercase leading-none">
                  {selectedResident ? `${selectedResident.first_name} ${selectedResident.last_name}` : 'Elena Rodríguez'}
                </h4>
                <p className="text-[10px] text-on-surface-variant font-bold mt-1.5 font-mono">
                  ID: {selectedResident ? getResidentCode(selectedResident) : '4829-X'} • Sector {selectedResident ? selectedResident.room_number || 'Sin Sector' : 'B-4'}
                </p>
              </div>

              <div className="w-full border-t border-outline-variant/30 pt-4 flex flex-col gap-2.5 text-xs text-left">
                <div className="flex justify-between">
                  <span className="font-bold text-on-surface-variant">Grupo Familiar:</span>
                  <span className="font-black text-on-surface">{selectedResident ? `${getFamilyCount(selectedResident)} Personas` : '4 Personas'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-on-surface-variant">Última Entrega:</span>
                  <span className="font-black text-on-surface">{selectedResident ? getLastDeliveryDate(selectedResident.id) : '10 May 2024'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-on-surface-variant">Estado Médico:</span>
                  <span className={`font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${
                    selectedResident && selectedResident.health_status === 'Crítico' ? 'bg-error/15 text-error font-mono' : 'bg-success/15 text-success font-mono'
                  }`}>
                    {selectedResident ? selectedResident.health_status : 'Tratamiento Crónico'}
                  </span>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => {
                  if (selectedResident) setShowHistoryModal(true);
                }}
                disabled={!selectedResident}
                className="w-full py-2 bg-surface border border-outline-variant/60 text-on-surface-variant font-bold rounded-xl text-[10px] hover:bg-surface-container transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50"
              >
                Ver Historial Completo
              </button>
            </div>

            {/* Center metrics card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Métricas del Centro (Hoy)</h3>
              
              <div className="flex flex-col gap-3.5 text-xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-on-surface-variant">Capacidad de Raciones</span>
                    <span className="font-black text-primary">{foodPercent}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${foodPercent}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-on-surface-variant">Medicamentos Críticos</span>
                    <span className="font-black text-error">{medicinePercent}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5">
                    <div className="bg-error h-1.5 rounded-full" style={{ width: `${medicinePercent}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-center text-xs border-t border-outline-variant/30 mt-1">
                <div className="p-3 bg-surface-container-low border border-outline-variant/40 rounded-xl">
                  <span className="text-[10px] text-on-surface-variant font-medium block">Entregas Hoy</span>
                  <span className="text-md font-black text-primary block mt-0.5">{deliveriesToday}</span>
                </div>
                <div className="p-3 bg-surface-container-low border border-outline-variant/40 rounded-xl">
                  <span className="text-[10px] text-on-surface-variant font-medium block">Alertas Stock</span>
                  <span className="text-md font-black text-error block mt-0.5">{stockAlerts}</span>
                </div>
              </div>
            </div>

            {/* Need help widget */}
            <div className="p-6 bg-[#0b2347] text-white border border-[#0b2347] rounded-2xl shadow-xs flex flex-col gap-3 relative overflow-hidden">
              <span className="material-symbols-outlined text-[60px] text-white/5 absolute -right-4 -bottom-4 rotate-12">help_outline</span>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">¿Necesitas ayuda?</h4>
              <p className="text-[10px] text-white/70 leading-relaxed">
                Consulta el manual de procedimientos para entregas especiales o contacta a soporte técnico.
              </p>
              <a href="#" className="text-[10px] font-black text-amber-300 hover:underline flex items-center gap-1.5 mt-1">
                <span className="material-symbols-outlined text-xs">import_contacts</span>
                Manual de Usuario
              </a>
            </div>

          </div>

        </div>
      )}

      {/* TAB CONTENT: HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                  <th className="py-3 px-4">Beneficiario</th>
                  <th className="py-3 px-4">Insumo</th>
                  <th className="py-3 px-4 text-center">Cantidad</th>
                  <th className="py-3 px-4">Fecha de Entrega</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length > 0 ? (
                  deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-outline-variant hover:bg-surface-container/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-primary">{d.resident_name}</td>
                      <td className="py-3 px-4 text-on-surface-variant">{d.item_name}</td>
                      <td className="py-3 px-4 text-center font-semibold">{d.quantity}</td>
                      <td className="py-3 px-4 text-on-surface-variant">{d.delivered_at}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-on-surface-variant italic">No hay entregas registradas en el historial.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-md font-bold text-primary">{itemId ? 'Editar Insumo' : 'Registrar Nuevo Insumo'}</h3>
              <button 
                onClick={() => setShowItemModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveItem} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre del Insumo / Artículo</label>
                <input 
                  type="text" 
                  value={itemName} 
                  onChange={(e) => setItemName(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="ej. Kit de Higiene Personal"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Categoría</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Alimentos">Alimentos</option>
                  <option value="Medicinas">Medicinas</option>
                  <option value="Higiene">Higiene</option>
                  <option value="Camas/Colchones">Camas/Colchones</option>
                  <option value="Ropa">Ropa</option>
                  <option value="Donación">Donación</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Cantidad Inicial</label>
                  <input 
                    type="number" 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Unidad</label>
                  <input 
                    type="text" 
                    value={unit} 
                    onChange={(e) => setUnit(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="ej. kg, und"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Mínimo Crítico (Alerta)</label>
                <input 
                  type="number" 
                  value={minThreshold} 
                  onChange={(e) => setMinThreshold(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  min="0"
                  required
                />
              </div>

              <button 
                type="submit" 
                className="mt-4 w-full py-3 bg-primary text-on-primary font-bold rounded-lg shadow-sm hover:opacity-95 transition-all cursor-pointer text-xs"
              >
                Guardar Insumo en Almacén
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ver Historial Completo del Residente */}
      {showHistoryModal && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-xl shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-md font-black text-[#0b2347] uppercase leading-none">Historial de Entregas</h3>
                <p className="text-[10px] text-on-surface-variant font-bold mt-1.5 uppercase font-mono">
                  Beneficiario: {selectedResident.first_name} {selectedResident.last_name} • C.I. {selectedResident.document_id || 'N/T'}
                </p>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-outline-variant/65 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-bold">
                    <th className="py-2.5 px-4">Insumo</th>
                    <th className="py-2.5 px-4 text-center">Cantidad</th>
                    <th className="py-2.5 px-4">Fecha de Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResidentHistory.length > 0 ? (
                    selectedResidentHistory.map((d) => (
                      <tr key={d.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors">
                        <td className="py-2.5 px-4 font-bold text-primary">{d.item_name}</td>
                        <td className="py-2.5 px-4 text-center font-semibold">{d.quantity}</td>
                        <td className="py-2.5 px-4 text-on-surface-variant">{d.delivered_at}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-on-surface-variant italic">Este residente aún no ha recibido ningún suministro.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="py-2 px-5 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 cursor-pointer transition-all"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Ver Detalle de Depósitos Consolidados */}
      {showDetailModal && selectedConsolidatedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-lg shadow-lg flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#0b2347] uppercase">
                  Detalle de Stock por Depósito
                </h3>
                <p className="text-[10px] text-on-surface-variant font-bold mt-0.5">{selectedConsolidatedItem.item_name} ({selectedConsolidatedItem.category})</p>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 cursor-pointer border-0 bg-transparent flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-x-auto my-2 border border-outline-variant/60 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-bold">
                    <th className="py-2.5 px-4">Depósito</th>
                    <th className="py-2.5 px-4 text-center">Disponible</th>
                    <th className="py-2.5 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedConsolidatedItem.items.map((dbItem) => (
                    <tr key={dbItem.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors">
                      <td className="py-2.5 px-4 font-bold text-on-surface">{dbItem.deposito_name || 'Bodega Central'}</td>
                      <td className="py-2.5 px-4 text-center font-bold font-mono text-[#0b2347] text-sm">{dbItem.quantity} {dbItem.unit}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button 
                          onClick={() => {
                            setShowDetailModal(false);
                            handleEditItem(dbItem);
                          }}
                          className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded text-[10px] cursor-pointer border-0"
                        >
                          Editar Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-outline-variant/60 pt-4 mt-2">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 bg-surface border border-outline-variant text-on-surface font-bold rounded-lg text-xs cursor-pointer hover:bg-surface-container"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
