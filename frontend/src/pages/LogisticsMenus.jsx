import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { useParams } from 'react-router-dom';

export default function LogisticsMenus({ token }) {
  const { refugioId } = useParams();

  const [menus, setMenus] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [residents, setResidents] = useState([]);
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDay, setEditDay] = useState('');
  const [editMeal, setEditMeal] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIngredients, setEditIngredients] = useState('');
  const [saving, setSaving] = useState(false);

  // Manual request states
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemUnit, setCustomItemUnit] = useState('Unidades');

  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const DAYS_SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const MEALS = ['Desayuno', 'Almuerzo', 'Cena'];
  const todayName = DAYS[(new Date().getDay() + 6) % 7];
  const [requirementDay, setRequirementDay] = useState(todayName);

  useEffect(() => {
    fetchData();
  }, [refugioId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch menus
      const resMenu = await fetch(`${API_BASE}/refugios/${refugioId}/menus`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resMenu.ok) {
        setMenus(await resMenu.json());
      }

      // 2. Fetch inventory (foods)
      const resInv = await fetch(`${API_BASE}/refugios/${refugioId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resInv.ok) {
        const invData = await resInv.json();
        setInventory(invData.filter(i => i.category === 'Alimentos' && i.deposito_name && i.deposito_name.toLowerCase().includes('cocina')));
      }

      // 3. Fetch residents
      const resRes = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resRes.ok) {
        setResidents(await resRes.json());
      }

      // 4. Fetch support staff count assigned to this shelter
      const resStaff = await fetch(`${API_BASE}/refugios/${refugioId}/staff-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resStaff.ok) {
        const staffData = await resStaff.json();
        setStaffCount(staffData.count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (day, meal) => {
    const activeMenu = menus.find(m => m.day_of_week === day && m.meal_type === meal);
    setEditDay(day);
    setEditMeal(meal);
    setEditDesc(activeMenu ? activeMenu.description : '');
    setEditIngredients(activeMenu ? activeMenu.ingredients || '' : '');
    setShowEditModal(true);
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/menus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          day_of_week: editDay,
          meal_type: editMeal,
          description: editDesc,
          ingredients: editIngredients
        })
      });
      if (res.ok) {
        setMessage(`Menú de ${editMeal} para el ${editDay} actualizado correctamente.`);
        setShowEditModal(false);
        fetchData();
      } else {
        setError('Error al actualizar el menú.');
      }
    } catch (err) {
      setError('Error al conectar con la API.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to find description & ingredients for matrix cells
  const getMenuCell = (day, meal) => {
    return menus.find(m => m.day_of_week === day && m.meal_type === meal) || null;
  };

  // Parse resident diets & conditions
  const activeResidents = residents.filter(r => r.status === 'Activo');
  const totalActive = activeResidents.length;
  const totalStaff = staffCount;
  const totalDiners = totalActive + totalStaff;

  let lactantesCount = 0;
  let hipertensosCount = 0;
  let alergiasCount = 0;
  let diabeticosCount = 0;
  let totalSpecialDiets = 0;

  activeResidents.forEach(r => {
    let meta = {};
    try {
      meta = r.special_needs ? JSON.parse(r.special_needs) : {};
    } catch {
      meta = {};
    }

    const dietText = (meta.diet || '').toLowerCase();
    const nutricionText = (meta.nutricion_especial || '').toLowerCase();
    const conditionText = (r.health_status || '').toLowerCase() + ' ' + (meta.treatments || '').toLowerCase();

    const isLactante = dietText.includes('lactan') || nutricionText.includes('lactan') || dietText.includes('formula') || nutricionText.includes('formula') || (meta.requiere_pañales_formula === 'Sí');
    const isHipertenso = dietText.includes('hiperten') || dietText.includes('bajo en sal') || dietText.includes('sodio') || conditionText.includes('hiperten') || conditionText.includes('presion alta') || conditionText.includes('presión alta');
    const isAlergico = dietText.includes('alerg') || nutricionText.includes('alerg');
    const isDiabetico = dietText.includes('diabet') || dietText.includes('bajo en azucar') || dietText.includes('bajo en azúcar') || conditionText.includes('diabet');

    if (isLactante) lactantesCount++;
    if (isHipertenso) hipertensosCount++;
    if (isAlergico) alergiasCount++;
    if (isDiabetico) diabeticosCount++;

    if (isLactante || isHipertenso || isAlergico || isDiabetico || (meta.diet && meta.diet !== 'Ninguna / General' && meta.diet !== 'Ninguno')) {
      totalSpecialDiets++;
    }
  });

  const normalizeName = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const normalizeUnit = (value = '') => {
    const unit = value.toLowerCase().trim();
    if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(unit)) return 'kg';
    if (['g', 'gr', 'gramo', 'gramos'].includes(unit)) return 'g';
    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unit)) return 'litros';
    if (['ml', 'mililitro', 'mililitros'].includes(unit)) return 'ml';
    if (['paq', 'paquete', 'paquetes'].includes(unit)) return 'paquetes';
    if (['u', 'ud', 'uds', 'unidad', 'unidades'].includes(unit)) return 'Unidades';
    return value.trim() || 'Unidades';
  };

  const formatQuantity = (value) => {
    const num = parseFloat(value) || 0;
    if (Number.isInteger(num)) return num.toString();
    return num.toLocaleString('es-VE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    });
  };

  const parseIngredients = (ingredients) => {
    if (!ingredients) return [];
    const reqs = {};
    const normalizedText = ingredients.replace(/\s+y\s+(?=\d+(?:[.,]\d+)?\s*(?:kg|g|gr|gramos|paquetes|paq|l|lt|litros|ml|unidades|uds|u)\b)/gi, ', ');
    const parts = normalizedText.split(/[;\n]+|,\s+(?=(?:\d|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]))/);

    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;

      let name = '';
      let qty = 1;
      let unit = 'Unidades';

      if (trimmed.includes(':')) {
        const split = trimmed.split(':');
        name = split[0].trim();
        const qtyStr = split.slice(1).join(':').trim();
        const numMatch = qtyStr.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
        if (numMatch) {
          qty = parseFloat(numMatch[1].replace(',', '.'));
          unit = normalizeUnit(numMatch[2]);
        }
      } else {
        const leadMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(?:(kg|g|gr|gramos|paquetes|paq|l|lt|litros|ml|unidades|uds|u))?\s*(?:de\s+)?(.*)$/i);
        const trailMatch = trimmed.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramos|paquetes|paq|l|lt|litros|ml|unidades|uds|u)?$/i);

        if (leadMatch) {
          qty = parseFloat(leadMatch[1].replace(',', '.'));
          unit = normalizeUnit(leadMatch[2] || 'Unidades');
          name = leadMatch[3].trim();
        } else if (trailMatch) {
          name = trailMatch[1].trim();
          qty = parseFloat(trailMatch[2].replace(',', '.'));
          unit = normalizeUnit(trailMatch[3] || 'Unidades');
        } else {
          name = trimmed;
        }
      }

      if (name) {
        name = name.replace(/^(de|del|la|el|los|las)\s+/i, '').trim();
        const key = normalizeName(`${name}_${unit}`);
        if (!reqs[key]) {
          reqs[key] = { name, quantity: 0, unit };
        }
        reqs[key].quantity += qty;
      }
    });

    return Object.values(reqs);
  };

  const getDailyRequiredIngredients = () => {
    const reqs = {};
    menus
      .filter(m => m.day_of_week === requirementDay)
      .forEach(m => {
        parseIngredients(m.ingredients).forEach(ingredient => {
          const key = normalizeName(`${ingredient.name}_${ingredient.unit}`);
          if (!reqs[key]) {
            reqs[key] = {
              name: ingredient.name,
              quantity: 0,
              unit: ingredient.unit,
              perServing: ingredient.quantity
            };
          }
          reqs[key].quantity += ingredient.quantity * totalDiners;
        });
      });
    return Object.values(reqs);
  };

  const dailyRequirements = getDailyRequiredIngredients();

  // Compare requirements with current local stock of Alimentos
  const missingIngredients = dailyRequirements.map(req => {
    const invItem = inventory.find(inv => normalizeName(inv.item_name) === normalizeName(req.name));
    const stock = invItem ? invItem.quantity : 0;
    const missing = Math.max(0, req.quantity - stock);
    return {
      name: req.name,
      required: req.quantity,
      unit: req.unit || (invItem ? invItem.unit : 'Unidades'),
      stock: stock,
      missing: missing
    };
  });

  // Request only missing daily ingredients from the warehouse
  const handleRequestMissingIngredients = async () => {
    const itemsToRequest = missingIngredients.filter(i => i.missing > 0);
    if (itemsToRequest.length === 0) return;

    setError('');
    setMessage('');
    setLoading(true);
    let successCount = 0;

    try {
      for (const item of itemsToRequest) {
        const res = await fetch(`${API_BASE}/refugios/${refugioId}/warehouse-requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            area: 'Comedor',
            item_name: item.name,
            quantity: item.missing,
            unit: item.unit,
            details: `Requerimiento diario ${requirementDay}. Cálculo automático para ${totalActive} residentes + ${totalStaff} personal de apoyo = ${totalDiners} raciones.`
          })
        });
        if (res.ok) {
          successCount++;
        }
      }
      if (successCount > 0) {
        setMessage(`Se enviaron ${successCount} solicitudes del requerimiento diario de ${requirementDay} al almacén central.`);
        fetchData();
      } else {
        setError('Error al enviar las solicitudes al almacén.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al enviar solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  // Custom manual request
  const handleSendCustomRequest = async (e) => {
    e.preventDefault();
    if (!customItemName.trim() || customItemQty <= 0) return;

    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/warehouse-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
          body: JSON.stringify({
            area: 'Comedor',
            item_name: customItemName,
            quantity: customItemQty,
            unit: customItemUnit
          })
        });
      if (res.ok) {
        setMessage(`Solicitud enviada al almacén: ${customItemQty} ${customItemUnit} de ${customItemName}.`);
        setCustomItemName('');
        setCustomItemQty(1);
        setCustomItemUnit('Unidades');
        fetchData();
      } else {
        setError('Error al enviar la solicitud manual.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con la API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Gestión de Menús</h2>
        <p className="text-xs text-on-surface-variant mt-1.5">Prepare y configure la ración nutricional semanal y controle ingredientes.</p>
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
        <div className="py-12 text-center text-xs font-bold text-on-surface-variant">Cargando planificación...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Calendar Planner Grid (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-black text-on-surface uppercase tracking-wider">Calendario Semanal</span>
                <span className="text-[10px] text-on-surface-variant font-bold">Haz clic en una comida para cargar plato e ingredientes por ración</span>
              </div>

              {/* Days Headers */}
              <div className="grid grid-cols-7 gap-2 text-center mb-4">
                {DAYS.map((d, idx) => (
                  <div key={d} className="bg-surface-container-low border border-outline-variant/30 py-2 rounded-lg">
                    <span className="text-[9px] font-black text-[#0b2347] block">{DAYS_SHORT[idx]}</span>
                    <span className="text-[8px] text-on-surface-variant block mt-0.5">{d}</span>
                  </div>
                ))}
              </div>

              {/* Meals Rows */}
              {MEALS.map((meal) => (
                <div key={meal} className="mb-6">
                  <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block mb-2">
                    {meal}
                  </span>
                  
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((day) => {
                      const cell = getMenuCell(day, meal);
                      return (
                        <div 
                          key={day}
                          onClick={() => handleCellClick(day, meal)}
                          className="bg-surface-container-low border border-outline-variant/40 hover:border-primary/50 transition-all rounded-xl p-3 min-h-[95px] flex flex-col justify-between cursor-pointer group shadow-2xs"
                        >
                          <p className="text-[9px] font-bold text-on-surface line-clamp-3 group-hover:text-primary leading-normal">
                            {cell ? cell.description : 'Programar comida...'}
                          </p>
                          {cell && cell.ingredients && (
                            <span className="text-[8px] font-bold text-primary block mt-2 truncate bg-primary/5 px-1 py-0.5 rounded" title={cell.ingredients}>
                              🥕 {cell.ingredients}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            </div>

          </div>

          {/* Logistics & Ingredients sidebar panel (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Ingredients stock widget */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#0b2347]">local_dining</span>
                Stock Cocina (Alimentos)
              </h3>

              <div className="overflow-x-auto max-h-48 custom-scrollbar">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                      <th className="pb-2">Suministro</th>
                      <th className="pb-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item, idx) => {
                      const isLow = item.quantity <= item.min_threshold;
                      return (
                        <tr key={idx} className="border-b border-outline-variant/30">
                          <td className="py-2 flex flex-col">
                            <span className="font-bold text-on-surface">{item.item_name}</span>
                            {isLow && (
                              <span className="text-[7px] font-bold text-error uppercase mt-0.5">
                                Reabastecer urgente
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right font-semibold font-mono text-on-surface">
                            {item.quantity} {item.unit}
                          </td>
                        </tr>
                      );
                    })}
                    {inventory.length === 0 && (
                      <tr>
                        <td colSpan="2" className="py-4 text-center italic text-on-surface-variant">Sin ingredientes registrados en cocina.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weekly menu requirements and request automation */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">analytics</span>
                Requerimiento Diario (Cocina)
              </h3>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-col gap-2">
                <label className="text-[9px] font-black text-on-surface-variant uppercase">Día a calcular</label>
                <select
                  value={requirementDay}
                  onChange={e => setRequirementDay(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                >
                  {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                </select>
                <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-bold text-on-surface-variant">
                  <div className="bg-white/70 rounded-lg p-2">
                    <span className="block text-[#0b2347] font-black text-xs">{totalActive}</span>
                    Residentes
                  </div>
                  <div className="bg-white/70 rounded-lg p-2">
                    <span className="block text-[#0b2347] font-black text-xs">{totalStaff}</span>
                    Personal
                  </div>
                  <div className="bg-white/70 rounded-lg p-2">
                    <span className="block text-[#0b2347] font-black text-xs">{totalDiners}</span>
                    Raciones
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                      <th className="pb-2">Ingrediente</th>
                      <th className="pb-2 text-center">Total Día</th>
                      <th className="pb-2 text-center">Stock</th>
                      <th className="pb-2 text-right">Faltante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingIngredients.map((item, idx) => (
                      <tr key={idx} className="border-b border-outline-variant/30">
                        <td className="py-2 font-bold text-on-surface">{item.name}</td>
                        <td className="py-2 text-center font-mono text-on-surface-variant">{formatQuantity(item.required)}</td>
                        <td className="py-2 text-center font-mono text-on-surface-variant">{formatQuantity(item.stock)}</td>
                        <td className="py-2 text-right">
                          {item.missing > 0 ? (
                            <span className="px-1.5 py-0.5 bg-error-container/20 text-error font-black rounded text-[8px] font-mono">
                              +{formatQuantity(item.missing)} {item.unit}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-success/10 text-success font-black rounded text-[8px]">
                              Cubierto
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {missingIngredients.length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-4 text-center italic text-on-surface-variant">
                          Sin requerimientos para {requirementDay}. Cargue ingredientes por ración en el menú del día.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {missingIngredients.some(i => i.missing > 0) && (
                <button 
                  onClick={handleRequestMissingIngredients}
                  className="w-full py-2 bg-primary text-on-primary font-bold rounded-xl text-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">shopping_cart_checkout</span>
                  Solicitar Requerimiento Diario
                </button>
              )}
            </div>

            {/* Custom request form */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#0b2347]">add_shopping_cart</span>
                Pedir Insumos Adicionales
              </h3>
              
              <form onSubmit={handleSendCustomRequest} className="flex flex-col gap-3">
                <div>
                  <label className="text-[9px] font-black text-on-surface-variant uppercase block mb-1">Nombre del Insumo</label>
                  <input 
                    type="text" 
                    value={customItemName} 
                    onChange={e => setCustomItemName(e.target.value)} 
                    placeholder="Ej. Pollo, Aceite, Harina PAN" 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-on-surface-variant uppercase block mb-1">Cant.</label>
                    <input 
                      type="number" 
                      value={customItemQty} 
                      onChange={e => setCustomItemQty(parseInt(e.target.value) || 1)} 
                      min="1" 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-on-surface-variant uppercase block mb-1">Unidad</label>
                    <input 
                      type="text" 
                      value={customItemUnit} 
                      onChange={e => setCustomItemUnit(e.target.value)} 
                      placeholder="Unidades / kg" 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-2 bg-[#0b2347] text-white font-bold rounded-lg text-xs hover:opacity-95 transition-all flex items-center justify-center gap-1 cursor-pointer mt-1"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  Enviar Solicitud
                </button>
              </form>
            </div>

            {/* Diet stats widget */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider">Estado de Dietas</h3>
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center text-xs font-bold text-on-surface border-b border-outline-variant/30 pb-2">
                  <span>Raciones Totales Activas:</span>
                  <span className="font-mono text-primary font-black text-md">{totalActive}</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-[10px] items-center">
                    <span className="text-on-surface-variant flex items-center gap-1 font-semibold">
                      🍼 Lactantes (Fórmulas):
                    </span>
                    <span className="font-bold font-mono text-[#0b2347]">{lactantesCount}</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <span className="text-on-surface-variant flex items-center gap-1 font-semibold">
                      🧂 Hipertensos (Bajo Sodio):
                    </span>
                    <span className="font-bold font-mono text-[#0b2347]">{hipertensosCount}</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <span className="text-on-surface-variant flex items-center gap-1 font-semibold">
                      🍬 Diabéticos (Bajo Azúcar):
                    </span>
                    <span className="font-bold font-mono text-[#0b2347]">{diabeticosCount}</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center">
                    <span className="text-on-surface-variant flex items-center gap-1 font-semibold">
                      ⚠️ Alergias Alimentarias:
                    </span>
                    <span className="font-bold font-mono text-[#0b2347]">{alergiasCount}</span>
                  </div>
                  <div className="flex justify-between text-[10px] items-center border-t border-outline-variant/30 pt-2 font-bold text-on-surface">
                    <span>Total con Condición Especial:</span>
                    <span className="font-mono text-[#0b2347] font-black">{totalSpecialDiets}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Edit Cell Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-md font-bold text-primary">Programar Menú</h3>
                <p className="text-[10px] text-on-surface-variant font-bold mt-1 font-mono uppercase">
                  {editMeal} • {editDay}
                </p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveMenu} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Descripción del Plato</label>
                <textarea 
                  value={editDesc} 
                  onChange={(e) => setEditDesc(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-20 resize-none font-medium"
                  placeholder="ej. Lentejas guisadas con arroz blanco y ensalada"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Ingredientes por Ración</label>
                <textarea 
                  value={editIngredients} 
                  onChange={(e) => setEditIngredients(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none font-mono"
                  placeholder="Ej: Arroz: 0.12 kg, Pollo: 0.18 kg, Aceite: 0.02 l&#10;(Cantidad para una sola comida/ración)"
                />
                <span className="text-[9px] text-on-surface-variant font-medium mt-1 block leading-tight">
                  Coloca cantidades para 1 ración. El sistema multiplica por residentes activos + personal de apoyo y genera el requerimiento diario.
                </span>
              </div>

              <button 
                type="submit" 
                disabled={saving}
                className="mt-2 w-full py-3 bg-[#0b2347] text-white font-bold rounded-lg shadow-sm hover:opacity-95 transition-all cursor-pointer text-xs"
              >
                {saving ? 'Guardando...' : 'Guardar en Planificación'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
