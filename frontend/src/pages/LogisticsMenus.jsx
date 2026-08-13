import React, { useState, useEffect } from 'react';
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

  // Calendar Date State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editDate, setEditDate] = useState('');

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDay, setEditDay] = useState('');
  const [editMeal, setEditMeal] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIngredients, setEditIngredients] = useState('');
  const [recipeItems, setRecipeItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Manual request states
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemUnit, setCustomItemUnit] = useState('Unidades');

  const getWeekDaysWithDates = () => {
    const base = new Date(selectedDate);
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(base.setDate(diff));
    
    const names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return names.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      return { name, date: dateStr };
    });
  };

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api');

  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const DAYS_SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const MEALS = ['Desayuno', 'Merienda Mañana', 'Almuerzo', 'Merienda', 'Cena'];
  const todayName = DAYS[(new Date().getDay() + 6) % 7];
  const [requirementDay, setRequirementDay] = useState(todayName);
  const [requirementScope, setRequirementScope] = useState('day');

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

  const handleCellClick = (day, meal, dateStr) => {
    const activeMenu = menus.find(m => 
      (m.menu_date && m.menu_date.split('T')[0] === dateStr && m.meal_type === meal) ||
      (!m.menu_date && m.day_of_week === day && m.meal_type === meal)
    );
    setEditDay(day);
    setEditMeal(meal);
    setEditDate(dateStr || '');
    setEditDesc(activeMenu ? activeMenu.description : '');
    setEditIngredients(activeMenu ? activeMenu.ingredients || '' : '');

    const parsed = parseIngredients(activeMenu ? activeMenu.ingredients : '');
    const mapped = parsed.map(item => ({
      ...item,
      isCustom: !inventory.some(inv => inv.item_name === item.name)
    }));
    setRecipeItems(mapped.length > 0 ? mapped : [{ name: '', quantity: 1, unit: 'Unidades', isCustom: false }]);

    setShowEditModal(true);
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);

    const compiledIngredients = recipeItems
      .filter(item => item.name && item.name.trim())
      .map(item => `${item.name}: ${item.quantity} ${item.unit}`)
      .join(', ');

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
          ingredients: compiledIngredients,
          menu_date: editDate || null
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
  const getMenuCell = (day, meal, dateStr) => {
    return menus.find(m => 
      (m.menu_date && m.menu_date.split('T')[0] === dateStr && m.meal_type === meal) ||
      (!m.menu_date && m.day_of_week === day && m.meal_type === meal)
    ) || null;
  };

  // Parse resident diets & conditions
  const activeResidents = residents.filter(r => r.status === 'Activo');
  const totalActive = activeResidents.length;
  const totalStaff = staffCount;

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
    if (['pote', 'potes', 'frasco', 'frascos'].includes(unit)) return 'potes';
    if (['empaque', 'empaques', 'pack', 'packs'].includes(unit)) return 'empaques';
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
    const normalizedText = ingredients.replace(/\s+y\s+(?=\d+(?:[.,]\d+)?\s*(?:kg|g|gr|gramos|paquetes|paq|potes?|frascos?|empaques?|packs?|l|lt|litros|ml|unidades|uds|u)\b)/gi, ', ');
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
        const leadMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(?:(kg|g|gr|gramos|paquetes|paq|potes?|frascos?|empaques?|packs?|l|lt|litros|ml|unidades|uds|u))?\s*(?:de\s+)?(.*)$/i);
        const trailMatch = trimmed.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramos|paquetes|paq|potes?|frascos?|empaques?|packs?|l|lt|litros|ml|unidades|uds|u)?$/i);

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

  const getRequiredIngredients = () => {
    const reqs = {};
    const weekDays = getWeekDaysWithDates();
    
    const targets = requirementScope === 'week' 
      ? weekDays 
      : weekDays.filter(d => d.name === requirementDay);

    targets.forEach(dayObj => {
      MEALS.forEach(meal => {
        const cell = getMenuCell(dayObj.name, meal, dayObj.date);
        if (!cell || !cell.ingredients) return;
        parseIngredients(cell.ingredients).forEach(ingredient => {
          const key = normalizeName(`${ingredient.name}_${ingredient.unit}`);
          if (!reqs[key]) {
            reqs[key] = {
              name: ingredient.name,
              quantity: 0,
              unit: ingredient.unit,
              mealTotal: ingredient.quantity
            };
          }
          reqs[key].quantity += ingredient.quantity;
        });
      });
    });
    return Object.values(reqs);
  };

  const dailyRequirements = getRequiredIngredients();

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
  const handleConsumeIngredients = async () => {
    const weekDays = getWeekDaysWithDates();
    const matchedDayObj = weekDays.find(d => d.name === requirementDay);
    const menu_date = matchedDayObj ? matchedDayObj.date : null;
    const menu_dates = weekDays.map(d => d.date);

    if (dailyRequirements.length === 0) {
      setError('No hay ingredientes para descontar. Agregue preparaciones con ingredientes al menú.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/menus/consume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scope: requirementScope,
          day_of_week: requirementDay,
          menu_date,
          menu_dates,
          ingredients: dailyRequirements.map(req => ({
            name: req.name,
            quantity: req.quantity,
            unit: req.unit
          }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(data.message || 'El consumo del menú fue registrado y los insumos fueron descontados del inventario de cocina.');
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || 'Error al registrar el consumo del menú.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al registrar consumo.');
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
        <p className="text-xs text-on-surface-variant mt-1.5">Registre las cantidades totales utilizadas en cada preparación y controle el inventario real de cocina.</p>
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-outline-variant/30">
                <div>
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider">Planificador de Menús por Fecha</span>
                  <p className="text-[9px] text-on-surface-variant font-bold mt-0.5">Selecciona cualquier fecha para planificar esa semana calendarizada</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-on-surface-variant uppercase">Semana del:</span>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-surface-container border border-outline-variant rounded-xl px-3 py-1.5 text-xs font-bold font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Days Headers */}
              <div className="grid grid-cols-7 gap-2 text-center mb-4">
                {getWeekDaysWithDates().map((d, idx) => (
                  <div key={d.name} className="bg-surface-container-low border border-outline-variant/30 py-2 rounded-lg flex flex-col items-center justify-center">
                    <span className="text-[9px] font-black text-[#0b2347] block">{DAYS_SHORT[idx]}</span>
                    <span className="text-[8px] text-on-surface-variant block font-bold mt-0.5">{d.name}</span>
                    <span className="text-[7.5px] text-primary block mt-0.5 font-mono font-black">{d.date.split('-').slice(1).reverse().join('/')}</span>
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
                    {getWeekDaysWithDates().map((dayObj) => {
                      const cell = getMenuCell(dayObj.name, meal, dayObj.date);
                      const isConsumed = cell ? cell.is_consumed : false;
                      return (
                        <div 
                          key={dayObj.name}
                          onClick={() => handleCellClick(dayObj.name, meal, dayObj.date)}
                          className={`border hover:border-primary/50 transition-all rounded-xl p-3 min-h-[95px] flex flex-col justify-between cursor-pointer group shadow-2xs ${
                            isConsumed ? 'bg-success/5 border-success/30' : 'bg-surface-container-low border-outline-variant/40'
                          }`}
                        >
                          <div>
                            <p className="text-[9px] font-bold text-on-surface line-clamp-3 group-hover:text-primary leading-normal">
                              {cell ? cell.description : 'Programar comida...'}
                            </p>
                            {cell && cell.ingredients && (
                              <span className="text-[8px] font-bold text-primary block mt-2 truncate bg-primary/5 px-1 py-0.5 rounded" title={cell.ingredients}>
                                🥕 {cell.ingredients}
                              </span>
                            )}
                          </div>
                          {isConsumed && (
                            <span className="text-[7px] font-black text-success uppercase mt-1 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[9px]">done_all</span> Consumido
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
                <label className="text-[9px] font-black text-on-surface-variant uppercase">Período a solicitar</label>
                <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setRequirementScope('day')} className={`p-2 rounded-lg text-[10px] font-bold ${requirementScope === 'day' ? 'bg-primary text-on-primary' : 'bg-surface border border-outline-variant'}`}>Por día</button><button type="button" onClick={() => setRequirementScope('week')} className={`p-2 rounded-lg text-[10px] font-bold ${requirementScope === 'week' ? 'bg-primary text-on-primary' : 'bg-surface border border-outline-variant'}`}>Semana completa</button></div>
                <select
                  value={requirementDay}
                  onChange={e => setRequirementDay(e.target.value)}
                  disabled={requirementScope === 'week'}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                >
                  {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2 text-center text-[9px] font-bold text-on-surface-variant">
                  <div className="bg-white/70 rounded-lg p-2">
                    <span className="block text-[#0b2347] font-black text-xs">{totalActive}</span>
                    Residentes
                  </div>
                  <div className="bg-white/70 rounded-lg p-2">
                    <span className="block text-[#0b2347] font-black text-xs">{totalStaff}</span>
                    Personal
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                      <th className="pb-2">Ingrediente</th>
                      <th className="pb-2 text-center">Total {requirementScope === 'week' ? 'Semana' : 'Día'}</th>
                      <th className="pb-2 text-center">Stock</th>
                      <th className="pb-2 text-center">Disponible Restante</th>
                      <th className="pb-2 text-right">Faltante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingIngredients.map((item, idx) => {
                      const diff = item.stock - item.required;
                      return (
                        <tr key={idx} className="border-b border-outline-variant/30">
                          <td className="py-2 font-bold text-on-surface">{item.name}</td>
                          <td className="py-2 text-center font-mono text-on-surface-variant">{formatQuantity(item.required)}</td>
                          <td className="py-2 text-center font-mono text-on-surface-variant">{formatQuantity(item.stock)}</td>
                          <td className={`py-2 text-center font-mono font-bold ${diff < 0 ? 'text-error' : 'text-success'}`}>
                            {diff >= 0 ? '+' : ''}{formatQuantity(diff)} {item.unit}
                          </td>
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
                      );
                    })}
                    {missingIngredients.length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-4 text-center italic text-on-surface-variant">
                          Sin requerimientos para {requirementScope === 'week' ? 'la semana' : requirementDay}. Cargue las cantidades totales de ingredientes en el menú.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {dailyRequirements.length > 0 && (
                <button 
                  onClick={handleConsumeIngredients}
                  className="w-full py-3 bg-[#0b2347] text-white font-bold rounded-xl text-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">restaurant_menu</span>
                  Registrar Consumo / Descontar del Inventario
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
                <label className="text-xs font-bold text-on-surface-variant block mb-2">Ingredientes del Menú</label>
                <div className="max-h-48 overflow-y-auto mb-2 pr-1">
                  {recipeItems.map((item, index) => (
                    <div key={index} className="flex gap-1.5 items-center mb-1.5 bg-surface-container-low/40 p-1.5 rounded-lg border border-outline-variant/30">
                      {item.isCustom ? (
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const updated = [...recipeItems];
                            updated[index].name = e.target.value;
                            setRecipeItems(updated);
                          }}
                          className="flex-grow bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-bold"
                          placeholder="Nombre del alimento..."
                          required
                        />
                      ) : (
                        <select
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = [...recipeItems];
                            if (val === '__custom__') {
                              updated[index].isCustom = true;
                              updated[index].name = '';
                              updated[index].unit = 'Kilos';
                            } else {
                              const invItem = inventory.find(i => i.item_name === val);
                              updated[index].name = val;
                              updated[index].unit = invItem ? invItem.unit : 'Unidades';
                            }
                            setRecipeItems(updated);
                          }}
                          className="flex-grow bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none font-bold"
                        >
                          <option value="">-- Seleccionar alimento --</option>
                          {inventory.map(inv => (
                            <option key={inv.id} value={inv.item_name}>{inv.item_name} ({inv.quantity} {inv.unit})</option>
                          ))}
                          <option value="__custom__">+ Otro alimento (no registrado)...</option>
                        </select>
                      )}

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...recipeItems];
                          updated[index].quantity = parseFloat(e.target.value) || 0;
                          setRecipeItems(updated);
                        }}
                        className="w-16 bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs text-center font-black"
                        placeholder="Cant."
                      />

                      {item.isCustom ? (
                        <select
                          value={item.unit}
                          onChange={(e) => {
                            const updated = [...recipeItems];
                            updated[index].unit = e.target.value;
                            setRecipeItems(updated);
                          }}
                          className="w-24 bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-bold focus:outline-none"
                        >
                          <option value="Kilos">Kilos</option>
                          <option value="Litros">Litros</option>
                          <option value="Paquetes">Paquetes</option>
                          <option value="Unidades">Unidades</option>
                          <option value="Gramos">Gramos</option>
                          <option value="Latas">Latas</option>
                          <option value="Bolsas">Bolsas</option>
                          <option value="Cajas">Cajas</option>
                        </select>
                      ) : (
                        <span className="text-[9px] font-bold text-on-surface-variant w-14 truncate">{item.unit || 'uds'}</span>
                      )}

                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...recipeItems];
                            updated[index].isCustom = false;
                            updated[index].name = '';
                            updated[index].unit = 'Unidades';
                            setRecipeItems(updated);
                          }}
                          className="text-on-surface-variant hover:bg-surface-container-high p-1.5 rounded-full cursor-pointer border-0 bg-transparent flex items-center justify-center shrink-0"
                          title="Volver a seleccionar de inventario"
                        >
                          <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setRecipeItems(recipeItems.filter((_, i) => i !== index))}
                        className="text-error hover:bg-error/10 p-1.5 rounded-full cursor-pointer border-0 bg-transparent flex items-center justify-center shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setRecipeItems([...recipeItems, { name: '', quantity: 1, unit: 'Unidades', isCustom: false }])}
                  className="text-primary text-[10px] font-bold flex items-center gap-1 mt-1 cursor-pointer border-0 bg-transparent"
                >
                  <span className="material-symbols-outlined text-xs">add</span> Añadir ingrediente
                </button>
                <span className="text-[8px] text-on-surface-variant font-medium mt-2 block leading-tight">
                  Coloque la cantidad total usada para preparar esta comida completa (por ejemplo: 10 kilos de harina, 1 pote de mantequilla, 4 litros de leche).
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
