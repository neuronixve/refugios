import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function Donaciones({ token }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();

  // Donor state
  const [donorName, setDonorName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Items list state
  const [items, setItems] = useState([
    { name: '', category: 'Medicinas', quantity: 0, unit: 'Cajas', lot: '', expiration: '', refrigeration: false }
  ]);

  // Destination deposit selection (dynamic)
  const [depositos, setDepositos] = useState([]);
  const [warehouse, setWarehouse] = useState(''); // Selected deposit name

  // Loading & logs state
  const [recentDonations, setRecentDonations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : '/refugios/api';

  useEffect(() => {
    fetchRecentDonations();
    fetchDepositos();
  }, [refugioId]);

  const fetchRecentDonations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/donations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter donations for the current refugio (if assigned)
        const currentRefugioDonations = data.filter(d => !d.refugio_id || d.refugio_id.toString() === refugioId.toString());
        setRecentDonations(currentRefugioDonations.slice(0, 4));
      }
    } catch (err) {
      console.error("Error fetching donations:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepositos = async () => {
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/depositos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepositos(data);
        if (data.length > 0) {
          setWarehouse(data[0].name);
        }
      }
    } catch (err) {
      console.error("Error fetching depositos:", err);
    }
  };

  // Add a new row to items list
  const handleAddItem = () => {
    setItems([
      ...items,
      { name: '', category: 'Alimentos', quantity: 1, unit: 'Unidades', lot: '', expiration: '', refrigeration: false }
    ]);
  };

  // Remove a row from items list
  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Update item properties
  const handleUpdateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Submit donation form to backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!donorName.trim()) {
      setErrorMsg('Por favor ingrese el nombre del donante.');
      return;
    }

    const invalidItem = items.some(item => !item.name.trim() || item.quantity <= 0);
    if (invalidItem) {
      setErrorMsg('Asegúrese de ingresar un nombre válido y cantidad mayor a cero para todos los artículos.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/donations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          refugio_id: parseInt(refugioId),
          donor_name: donorName,
          donor_organization: organization,
          donor_email: email,
          donor_phone: phone,
          items: items,
          destination_warehouse: warehouse
        })
      });

      if (res.ok) {
        setSuccessMsg('¡Donación registrada con éxito en el depósito e inventario!');
        
        // Reset form fields
        setDonorName('');
        setOrganization('');
        setEmail('');
        setPhone('');
        setItems([{ name: '', category: 'Medicinas', quantity: 0, unit: 'Cajas', lot: '', expiration: '', refrigeration: false }]);
        if (depositos.length > 0) {
          setWarehouse(depositos[0].name);
        }

        // Refresh list
        fetchRecentDonations();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Error al guardar la donación.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de red al conectar con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculators
  const totalQuantity = items.reduce((acc, curr) => acc + (parseInt(curr.quantity) || 0), 0);
  const totalCategories = [...new Set(items.map(item => item.category))].length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Top Navigation / Breadcrumb */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
        <div>
          <span className="text-[10px] uppercase font-bold text-on-surface-variant/75 tracking-widest block">Panel / Nueva Donación</span>
          <h2 className="text-2xl font-extrabold text-primary mt-1">Registro de Donación</h2>
        </div>
        <div className="flex gap-3">
          <button 
            type="button"
            onClick={() => navigate(`/refugio/${refugioId}/dashboard`)}
            className="py-3 px-5 bg-surface border border-outline-variant/60 text-on-surface-variant font-bold rounded-xl text-xs hover:bg-surface-container cursor-pointer transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={submitting}
            className="py-3 px-6 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 flex items-center gap-2 cursor-pointer shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-sm">volunteer_activism</span>
            {submitting ? 'Guardando...' : 'Registrar Donación'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-success/15 border border-success/35 rounded-xl flex gap-3 text-xs text-success font-semibold items-center animate-fade-in print:hidden">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-error/15 border border-error/35 rounded-xl flex gap-3 text-xs text-error font-semibold items-center animate-fade-in print:hidden">
          <span className="material-symbols-outlined">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT FORM WORKSPACE (8 Columns) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Card 1: Donor Information */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-5">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">1</span>
              Información del Donante
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 text-xs">
                <label className="font-bold text-on-surface-variant">Nombre Completo / Contacto *</label>
                <input 
                  type="text" 
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="Ej. Roberto Jiménez"
                  className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <label className="font-bold text-on-surface-variant">Organización (Opcional)</label>
                <input 
                  type="text" 
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Ej. Fundación Salud Para Todos"
                  className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <label className="font-bold text-on-surface-variant">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@ejemplo.com"
                  className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <label className="font-bold text-on-surface-variant">Teléfono de Contacto</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+58 412-000-0000"
                  className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Donated Items List */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">2</span>
                Artículos Donados
              </h3>
              <button 
                type="button"
                onClick={handleAddItem}
                className="text-xs font-black text-primary flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Añadir Artículo
              </button>
            </div>

            {/* Items Table container */}
            <div className="flex flex-col gap-4">
              {items.map((item, index) => (
                <div key={index} className="p-4 border border-outline-variant/30 rounded-xl bg-surface-container-low flex flex-col gap-3">
                  
                  {/* Primary Item Row */}
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-12 md:col-span-5 flex flex-col gap-1 text-xs">
                      <label className="font-bold text-on-surface-variant">Nombre del Artículo *</label>
                      <input 
                        type="text" 
                        value={item.name}
                        onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                        placeholder="Ej. Amoxicilina 500mg o Kit Higiene"
                        className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-3 flex flex-col gap-1 text-xs">
                      <label className="font-bold text-on-surface-variant">Categoría</label>
                      <select 
                        value={item.category}
                        onChange={(e) => handleUpdateItem(index, 'category', e.target.value)}
                        className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none font-bold"
                      >
                        <option value="Medicinas">Medicinas</option>
                        <option value="Alimentos">Alimentos</option>
                        <option value="Higiene">Higiene</option>
                        <option value="Camas/Colchones">Camas/Colchones</option>
                        <option value="Ropa">Ropa</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>

                    <div className="col-span-3 md:col-span-2 flex flex-col gap-1 text-xs">
                      <label className="font-bold text-on-surface-variant">Cantidad</label>
                      <input 
                        type="number" 
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, 'quantity', Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="col-span-3 md:col-span-2 flex items-center gap-2">
                      <div className="flex flex-col gap-1 text-xs flex-grow">
                        <label className="font-bold text-on-surface-variant">Unidad</label>
                        <select 
                          value={item.unit}
                          onChange={(e) => handleUpdateItem(index, 'unit', e.target.value)}
                          className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-xs focus:outline-none"
                        >
                          <option value="unidades">Unidades</option>
                          <option value="Cajas">Cajas</option>
                          <option value="Kilos">Kilos</option>
                          <option value="Litros">Litros</option>
                        </select>
                      </div>
                      
                      {items.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="w-9 h-9 rounded-xl bg-error/10 hover:bg-error/15 text-error flex items-center justify-center shrink-0 cursor-pointer self-end"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Secondary Specs Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-t border-outline-variant/30 pt-3 mt-1">
                    <div className="md:col-span-4 flex flex-col gap-1 text-xs">
                      <label className="font-bold text-on-surface-variant text-[10px]">Lote</label>
                      <input 
                        type="text" 
                        value={item.lot}
                        onChange={(e) => handleUpdateItem(index, 'lot', e.target.value)}
                        placeholder="Lote de lote"
                        className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-4 flex flex-col gap-1 text-xs">
                      <label className="font-bold text-on-surface-variant text-[10px]">Fecha Expiración</label>
                      <input 
                        type="date" 
                        value={item.expiration}
                        onChange={(e) => handleUpdateItem(index, 'expiration', e.target.value)}
                        className="bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-4 flex items-center gap-3 self-end py-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface-variant">
                        <input 
                          type="checkbox"
                          checked={item.refrigeration}
                          onChange={(e) => handleUpdateItem(index, 'refrigeration', e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        Requiere Refrigeración
                      </label>
                      {item.refrigeration && (
                        <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase animate-pulse">
                          Temperatura Controlada
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Storage Depositos (Dynamic selection) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-5">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">3</span>
              Depósito de Almacenamiento Destino
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {depositos.length > 0 ? (
                depositos.map(dep => (
                  <div 
                    key={dep.id}
                    onClick={() => setWarehouse(dep.name)}
                    className={`p-4 border rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:bg-surface-container ${warehouse === dep.name ? 'border-[#0b2347] bg-primary/5 shadow-xs' : 'border-outline-variant/30 bg-surface-container-lowest'}`}
                  >
                    <div className="flex items-center gap-2.5 text-xs font-black text-[#0b2347]">
                      <span className="material-symbols-outlined">warehouse</span>
                      <span className="truncate">{dep.name}</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-medium leading-relaxed line-clamp-2">
                      {dep.description || 'Sin descripción o ubicación registrada.'}
                    </p>
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-4 text-center text-xs italic text-on-surface-variant">
                  No hay depósitos configurados. Configure uno en el panel de configuración de la sede.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT SIDEBAR PANEL (4 Columns) */}
        <div className="lg:col-span-4 flex flex-col gap-6 print:hidden">
          
          {/* Summary stats widget */}
          <div className="bg-[#0b2347] text-white border border-[#0b2347] rounded-2xl p-6 shadow-md flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-white/80">Resumen de Registro</h3>
            
            <div className="flex justify-between items-center border-b border-white/10 pb-3 text-xs">
              <span className="text-white/60">Total Artículos</span>
              <span className="text-md font-black">{totalQuantity}</span>
            </div>

            <div className="flex justify-between items-center border-b border-white/10 pb-3 text-xs">
              <span className="text-white/60">Categorías Involucradas</span>
              <span className="text-md font-black">{totalCategories}</span>
            </div>

            <div className="flex justify-between items-center border-b border-white/10 pb-3 text-xs">
              <span className="text-white/60">Depósito Destino</span>
              <span className="text-md font-black uppercase text-amber-300 truncate max-w-[150px]">{warehouse || 'Ninguno'}</span>
            </div>

            {/* Small delivery warehouse illustration vector/mockup placeholder */}
            <div className="h-28 mt-2 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden border border-white/5 relative">
              <span className="material-symbols-outlined text-4xl text-white/30 animate-pulse">local_shipping</span>
              <span className="text-[10px] text-white/50 absolute bottom-3 uppercase font-bold tracking-wider font-mono">Inventario Integrado</span>
            </div>
          </div>

          {/* Recent Donations history */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Donaciones Recientes</h3>
              <span className="text-[10px] text-primary font-bold hover:underline cursor-pointer">Ver Todas</span>
            </div>

            <div className="flex flex-col gap-3">
              {loading ? (
                <p className="text-xs text-center py-4 text-on-surface-variant">Cargando bitácora...</p>
              ) : recentDonations.length > 0 ? (
                recentDonations.map((don) => {
                  let parsedItems = [];
                  try {
                    parsedItems = JSON.parse(don.items_json);
                  } catch {
                    parsedItems = [];
                  }
                  const date = new Date(don.received_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  return (
                    <div key={don.id} className="p-3 border border-outline-variant/30 rounded-xl bg-surface-container-low flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-sm">handshake</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-on-surface block truncate">{don.donor_name}</span>
                          <span className="text-[9px] text-on-surface-variant block mt-0.5 truncate">{don.donor_organization || 'Donación Anónima'}</span>
                          <span className="text-[8px] text-on-surface-variant/80 block">{parsedItems.length} tipos de artículo • {date}</span>
                        </div>
                      </div>
                      <span className="bg-success/15 text-success font-black text-[9px] px-2 py-0.5 rounded uppercase font-mono">Éxito</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs italic text-center py-4 text-on-surface-variant">No se han registrado donaciones recientemente.</p>
              )}
            </div>
          </div>

          {/* Warehouse Capacity meter state */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Estado de Capacidad de Depósitos</h3>
            
            <div className="flex flex-col gap-3.5 text-xs">
              {depositos.length > 0 ? (
                depositos.map(dep => (
                  <div key={dep.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-on-surface-variant truncate max-w-[180px]">{dep.name}</span>
                      <span className="font-black text-primary">{dep.capacity_percent}%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${dep.capacity_percent > 80 ? 'bg-error' : dep.capacity_percent > 40 ? 'bg-primary' : 'bg-success'}`} 
                        style={{ width: `${dep.capacity_percent}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-center py-2 italic text-on-surface-variant">No hay depósitos activos.</p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
