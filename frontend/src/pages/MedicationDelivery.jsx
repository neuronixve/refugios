import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:4000/api'
  : 'https://api.venezuelarenacera.com/api';

const DELIVERY_UNITS = ['Dosis', 'Tabletas', 'Pastillas', 'Cajas', 'Blisters', 'Frascos', 'Viales', 'Ampollas'];
const DELIVERY_FREQUENCIES = ['Única', 'Semanal', 'Quincenal', 'Mensual', 'Continuada'];

const getMetadata = (resident) => {
  if (!resident?.special_needs) return {};
  try {
    return JSON.parse(resident.special_needs);
  } catch {
    return {};
  }
};

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatQty = (value) => {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('es-VE', { maximumFractionDigits: 2 });
};

export default function MedicationDelivery({ token }) {
  const { refugioId } = useParams();

  const [residents, setResidents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [selectedTreatmentIndex, setSelectedTreatmentIndex] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('Dosis');
  const [deliveryFrequency, setDeliveryFrequency] = useState('Única');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, [refugioId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [resResidents, resInventory, resDeliveries] = await Promise.all([
        fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, { headers }),
        fetch(`${API_BASE}/refugios/${refugioId}/inventory`, { headers }),
        fetch(`${API_BASE}/refugios/${refugioId}/medication-deliveries`, { headers })
      ]);

      if (resResidents.ok) {
        const data = await resResidents.json();
        const active = data.filter(r => r.status === 'Activo');
        setResidents(active);
        if (!selectedResidentId && active.length > 0) setSelectedResidentId(String(active[0].id));
      }

      if (resInventory.ok) {
        const inv = await resInventory.json();
        const healthItems = inv.filter(item => {
          const category = (item.category || '').toLowerCase();
          const deposito = (item.deposito_name || '').toLowerCase();
          return category.includes('medicina') || deposito.includes('médico') || deposito.includes('medico') || deposito.includes('salud');
        });
        setInventory(healthItems);
      }

      if (resDeliveries.ok) {
        setDeliveries(await resDeliveries.json());
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar el control de medicamentos.');
    } finally {
      setLoading(false);
    }
  };

  const selectedResident = residents.find(r => String(r.id) === String(selectedResidentId));
  const treatments = useMemo(() => {
    const meta = getMetadata(selectedResident);
    return Array.isArray(meta.medications) ? meta.medications : [];
  }, [selectedResident]);

  const selectedTreatment = selectedTreatmentIndex !== '' ? treatments[parseInt(selectedTreatmentIndex)] : null;
  const residentDeliveries = deliveries.filter(d => String(d.resident_id) === String(selectedResidentId));
  const treatmentDeliveries = selectedTreatment
    ? residentDeliveries.filter(d => {
      const sameName = (d.medication_name || '').toLowerCase() === (selectedTreatment.name || '').toLowerCase();
      const sameIndex = d.medication_index === null || d.medication_index === undefined
        ? true
        : parseInt(d.medication_index) === parseInt(selectedTreatmentIndex);
      return sameName && sameIndex;
    })
    : [];
  const deliveredTotal = treatmentDeliveries.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const totalRequired = selectedTreatment ? parseFloat(selectedTreatment.totalQuantity) : NaN;
  const hasTotalControl = Number.isFinite(totalRequired) && totalRequired > 0;
  const remaining = hasTotalControl ? Math.max(totalRequired - deliveredTotal, 0) : null;
  const selectedInventory = inventory.find(item => String(item.id) === String(inventoryItemId));

  const filteredResidents = residents.filter(res => {
    const query = searchTerm.toLowerCase();
    const fullName = `${res.first_name} ${res.last_name}`.toLowerCase();
    const doc = (res.document_id || '').toLowerCase();
    return !query || fullName.includes(query) || doc.includes(query);
  });

  const handleResidentChange = (id) => {
    setSelectedResidentId(id);
    setSelectedTreatmentIndex('');
    setInventoryItemId('');
    setQuantity(1);
    setNotes('');
  };

  const handleTreatmentChange = (index) => {
    setSelectedTreatmentIndex(index);
    const treatment = treatments[parseInt(index)];
    if (!treatment) return;

    const match = inventory.find(item => {
      const invName = (item.item_name || '').toLowerCase();
      const medName = (treatment.name || '').toLowerCase();
      return invName.includes(medName) || medName.includes(invName);
    });
    setInventoryItemId(match ? String(match.id) : '');
    setUnit(treatment.unit || 'Dosis');
    setDeliveryFrequency(treatment.deliveryFrequency || 'Única');
    setQuantity(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedResident || !selectedTreatment || !inventoryItemId) {
      setError('Seleccione residente, tratamiento e insumo del inventario antes de registrar la entrega.');
      return;
    }

    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Ingrese una cantidad válida para la entrega.');
      return;
    }

    if (hasTotalControl && qty > remaining) {
      setError(`No puede entregar más de lo indicado. Saldo disponible para este tratamiento: ${formatQty(remaining)} ${selectedTreatment.unit || unit}.`);
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/medication-deliveries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          resident_id: selectedResident.id,
          inventory_item_id: inventoryItemId,
          medication_index: parseInt(selectedTreatmentIndex),
          medication_name: selectedTreatment.name,
          dose: selectedTreatment.dose,
          quantity: qty,
          unit,
          delivery_frequency: deliveryFrequency,
          notes
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'No se pudo registrar la entrega.');
        return;
      }

      setMessage('Entrega de medicamento registrada y descontada del inventario de salud.');
      setQuantity(1);
      setNotes('');
      await fetchData();
    } catch (err) {
      console.error(err);
      setError('Error al conectar con la API.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b2347] uppercase leading-none">Entrega de Medicamentos</h2>
          <p className="text-xs text-on-surface-variant mt-1.5 font-medium">
            Control de tratamientos activos, inventario médico e historial de entregas por residente.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-[10px] font-bold max-w-xl">
          Este módulo registra entregas contra tratamientos indicados. No sustituye evaluación médica ni modifica dosis prescritas.
        </div>
      </header>

      {error && <div className="mb-4 p-3 bg-error/15 border border-error/35 text-error rounded-xl text-xs font-bold">{error}</div>}
      {message && <div className="mb-4 p-3 bg-success/15 border border-success/35 text-success rounded-xl text-xs font-bold">{message}</div>}

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-on-surface-variant">Cargando control de medicamentos...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs font-black text-[#0b2347] uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">person_search</span>
              Seleccionar Residente
            </h3>
            <div className="relative mb-4">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o C.I..."
                className="w-full bg-surface-container border border-outline-variant rounded-lg pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              />
            </div>
            <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredResidents.map(res => {
                const isActive = String(res.id) === String(selectedResidentId);
                const medsCount = (getMetadata(res).medications || []).length;
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleResidentChange(String(res.id))}
                    className={`text-left border rounded-xl p-3 cursor-pointer transition-all ${
                      isActive ? 'border-[#0b2347] bg-primary/10 text-[#0b2347]' : 'border-outline-variant/60 bg-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-xs font-black">{res.first_name} {res.last_name}</span>
                      <span className="text-[9px] font-bold">{medsCount} trat.</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-bold mt-1">C.I. {res.document_id || 'N/T'} | {res.health_status || 'Estable'}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <main className="xl:col-span-8 flex flex-col gap-6">
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs">
              <h3 className="text-xs font-black text-[#0b2347] uppercase mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">medical_information</span>
                Tratamiento a Entregar
              </h3>

              {selectedResident ? (
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="lg:col-span-2">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Tratamiento Actual</label>
                    <select
                      value={selectedTreatmentIndex}
                      onChange={e => handleTreatmentChange(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none font-bold"
                      required
                    >
                      <option value="">-- Seleccionar tratamiento indicado --</option>
                      {treatments.map((med, idx) => (
                        <option key={`${med.name}-${idx}`} value={idx}>
                          {med.name} | {med.dose || 'Dosis N/R'} | {med.totalQuantity ? `${med.totalQuantity} ${med.unit || 'dosis'}` : 'Cantidad N/R'}
                        </option>
                      ))}
                    </select>
                    {treatments.length === 0 && (
                      <p className="mt-2 text-[10px] font-bold text-amber-700">
                        Este residente no tiene tratamientos activos. Regístrelos primero en Historial de Residentes.
                      </p>
                    )}
                  </div>

                  {selectedTreatment && (
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <InfoPill label="Dosis indicada" value={selectedTreatment.dose || 'N/R'} />
                      <InfoPill label="Total indicado" value={hasTotalControl ? `${formatQty(totalRequired)} ${selectedTreatment.unit || unit}` : 'Sin límite registrado'} />
                      <InfoPill label="Saldo por entregar" value={hasTotalControl ? `${formatQty(remaining)} ${selectedTreatment.unit || unit}` : 'Control por historial'} tone={remaining === 0 ? 'danger' : 'primary'} />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Medicamento del Inventario de Salud</label>
                    <select
                      value={inventoryItemId}
                      onChange={e => setInventoryItemId(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none font-bold"
                      required
                    >
                      <option value="">-- Seleccionar inventario --</option>
                      {inventory.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.item_name} | Stock: {formatQty(item.quantity)} {item.unit || 'unidades'}
                        </option>
                      ))}
                    </select>
                    {selectedInventory && (
                      <p className="mt-1 text-[10px] font-bold text-on-surface-variant">
                        Stock disponible: {formatQty(selectedInventory.quantity)} {selectedInventory.unit || 'unidades'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Cantidad a Entregar</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none font-black text-center"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Unidad</label>
                      <select
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none font-bold"
                      >
                        {DELIVERY_UNITS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Frecuencia de Entrega</label>
                    <select
                      value={deliveryFrequency}
                      onChange={e => setDeliveryFrequency(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none font-bold"
                    >
                      {DELIVERY_FREQUENCIES.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase block mb-1">Observación de Entrega</label>
                    <input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="ej. Retira familiar autorizado, control semanal, indicación médica..."
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !selectedTreatment || (hasTotalControl && remaining === 0)}
                    className="lg:col-span-2 py-3 bg-[#0b2347] text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {saving ? 'Registrando...' : 'Registrar Entrega y Descontar Inventario'}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-on-surface-variant italic py-10 text-center">Seleccione un residente para consultar tratamientos.</p>
              )}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HistoryPanel title="Historial del Residente" items={residentDeliveries} />
              <HistoryPanel title="Historial del Tratamiento" items={treatmentDeliveries} empty="Seleccione un tratamiento para ver sus entregas." />
            </section>
          </main>
        </div>
      )}
    </div>
  );
}

function InfoPill({ label, value, tone = 'primary' }) {
  const color = tone === 'danger' ? 'text-error bg-error/10 border-error/20' : 'text-[#0b2347] bg-primary/5 border-outline-variant';
  return (
    <div className={`border rounded-xl p-3 ${color}`}>
      <span className="text-[9px] font-black uppercase block opacity-80">{label}</span>
      <span className="text-xs font-black mt-1 block">{value}</span>
    </div>
  );
}

function HistoryPanel({ title, items, empty = 'No hay entregas registradas.' }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-xs">
      <h3 className="text-xs font-black text-[#0b2347] uppercase mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">history</span>
        {title}
      </h3>
      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
        {items.map(item => (
          <div key={item.id} className="border border-outline-variant/60 bg-surface rounded-xl p-3">
            <div className="flex justify-between gap-3">
              <span className="text-xs font-black text-on-surface">{item.medication_name}</span>
              <span className="text-[9px] font-black text-[#0b2347]">{formatQty(item.quantity)} {item.unit}</span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-bold mt-1">{item.dose || 'Dosis N/R'} | {item.delivery_frequency || 'Única'}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">{formatDateTime(item.delivered_at)}</p>
            {item.notes && <p className="text-[10px] text-on-surface-variant italic mt-1">{item.notes}</p>}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-center text-on-surface-variant italic py-10">{empty}</p>
        )}
      </div>
    </div>
  );
}
