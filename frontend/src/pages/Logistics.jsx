import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function Logistics({ token }) {
  const { refugioId } = useParams();
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'attendance', 'donations'
  
  // Data States
  const [menus, setMenus] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [donations, setDonations] = useState([]);
  const [residents, setResidents] = useState([]);
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Menu Form State
  const [dayOfWeek, setDayOfWeek] = useState('Lunes');
  const [mealType, setMealType] = useState('Almuerzo');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState(650);

  // Attendance Form State
  const [residentDoc, setResidentDoc] = useState('');
  const [attendanceMealType, setAttendanceMealType] = useState('Almuerzo');

  // Donation Form State
  const [donorName, setDonorName] = useState('');
  const [donationItem, setDonationItem] = useState('');
  const [donationQty, setDonationQty] = useState(10);
  const [donationUnit, setDonationUnit] = useState('unidades');

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchResidents();
    if (activeTab === 'menu') fetchMenus();
    else if (activeTab === 'attendance') fetchAttendance();
    else if (activeTab === 'donations') fetchDonations();
  }, [refugioId, activeTab]);

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

  const fetchMenus = async () => {
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/menus`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMenus(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/meals/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAttendance(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDonations = async () => {
    try {
      const res = await fetch(`${API_BASE}/donations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filtrar donaciones de esta sede
        setDonations(data.filter(d => d.refugio_id === parseInt(refugioId)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/menus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          day_of_week: dayOfWeek,
          meal_type: mealType,
          description,
          calories: parseInt(calories)
        })
      });
      if (res.ok) {
        setMessage('Menú actualizado correctamente.');
        setDescription('');
        fetchMenus();
      } else {
        setError('Error al actualizar el menú.');
      }
    } catch (err) {
      setError('Error al conectar con la API.');
    }
  };

  const handleLogAttendance = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/meals/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          document_id: residentDoc,
          refugio_id: parseInt(refugioId),
          meal_type: attendanceMealType
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Asistencia de comedor registrada para ${data.resident.first_name} ${data.resident.last_name}.`);
        setResidentDoc('');
        fetchAttendance();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al registrar asistencia de comedor.');
      }
    } catch (err) {
      setError('Error de conexión.');
    }
  };

  const handleRegisterDonation = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
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
          item_name: donationItem,
          quantity: parseInt(donationQty),
          unit: donationUnit
        })
      });
      if (res.ok) {
        setMessage('Donación registrada e ingresada al inventario.');
        setDonorName('');
        setDonationItem('');
        setDonationQty(10);
        fetchDonations();
      } else {
        setError('Error al guardar donación.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h2 className="text-2xl font-extrabold text-primary">Comedor y Logística</h2>
        <p className="text-xs text-on-surface-variant">Gestione el menú semanal, registre la asistencia a comedor de damnificados y controle donaciones.</p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant mb-6 gap-2">
        <button 
          onClick={() => setActiveTab('menu')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'menu' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          Planificación de Menús
        </button>
        <button 
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'attendance' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          Control de Asistencia (Comedor)
        </button>
        <button 
          onClick={() => setActiveTab('donations')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'donations' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          Control de Donaciones
        </button>
      </div>

      {error && <p className="mb-4 text-xs font-bold text-error">{error}</p>}
      {message && <p className="mb-4 text-xs font-bold text-success">{message}</p>}

      {/* TAB: WEEKLY MENU PLANNER */}
      {activeTab === 'menu' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu form */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
            <h3 className="text-sm font-bold text-primary mb-4">Programar Menú</h3>
            <form onSubmit={handleSaveMenu} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Día de la Semana</label>
                <select 
                  value={dayOfWeek} 
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Lunes">Lunes</option>
                  <option value="Martes">Martes</option>
                  <option value="Miércoles">Miércoles</option>
                  <option value="Jueves">Jueves</option>
                  <option value="Viernes">Viernes</option>
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Comida</label>
                <select 
                  value={mealType} 
                  onChange={(e) => setMealType(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Desayuno">Desayuno</option>
                  <option value="Almuerzo">Almuerzo</option>
                  <option value="Cena">Cena</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Descripción del Plato</label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ej. Arroz con pollo, ensalada rallada y plátano cocido."
                  rows="3"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Calorías Estimadas</label>
                <input 
                  type="number" 
                  value={calories} 
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  min="0"
                />
              </div>

              <button 
                type="submit" 
                className="mt-2 w-full py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer"
              >
                Guardar Planificación
              </button>
            </form>
          </div>

          {/* Menu displays */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
            <h3 className="text-sm font-bold text-primary mb-4">Menú de la Semana Programado</h3>
            
            {menus.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {menus.map((menu) => (
                  <div key={menu.id} className="p-4 border border-outline-variant rounded-lg bg-surface-container/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-primary">{menu.day_of_week}</span>
                      <span className="bg-primary-container/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{menu.meal_type}</span>
                    </div>
                    <p className="text-xs text-on-surface mb-2">{menu.description}</p>
                    <span className="text-[10px] text-on-surface-variant font-medium">Estimado: {menu.calories} kcal</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 border border-dashed border-outline-variant text-center rounded-lg text-on-surface-variant text-xs">
                No se ha programado ningún menú para esta sede todavía.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: COMEDOR ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Scanner Simulator Form */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
            <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
              Registrar Asistencia (Simulador QR)
            </h3>
            
            <form onSubmit={handleLogAttendance} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Buscar Beneficiario (Cédula)</label>
                <select 
                  value={residentDoc} 
                  onChange={(e) => setResidentDoc(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                  required
                >
                  <option value="">-- Seleccione Residente --</option>
                  {residents.map(r => (
                    <option key={r.id} value={r.document_id}>
                      {r.first_name} {r.last_name} (C.I. {r.document_id || 'N/T'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Servicio de Comida</label>
                <select 
                  value={attendanceMealType} 
                  onChange={(e) => setAttendanceMealType(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                >
                  <option value="Desayuno">Desayuno</option>
                  <option value="Almuerzo">Almuerzo</option>
                  <option value="Cena">Cena</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="mt-2 w-full py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Registrar Consumo de Alimentos
              </button>
            </form>
          </div>

          {/* Attendance list */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
            <h3 className="text-sm font-bold text-primary mb-4">Consumos Registrados Hoy</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                    <th className="py-2.5 px-4">Beneficiario</th>
                    <th className="py-2.5 px-4">Cédula</th>
                    <th className="py-2.5 px-4">Tipo Comida</th>
                    <th className="py-2.5 px-4">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length > 0 ? (
                    attendance.map((att) => (
                      <tr key={att.id} className="border-b border-outline-variant hover:bg-surface-container/20">
                        <td className="py-2.5 px-4 font-bold text-primary">{att.first_name} {att.last_name}</td>
                        <td className="py-2.5 px-4 font-semibold text-on-surface-variant">{att.document_id || 'N/T'}</td>
                        <td className="py-2.5 px-4 font-bold">{att.meal_type}</td>
                        <td className="py-2.5 px-4 text-on-surface-variant">
                          {new Date(att.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-on-surface-variant font-medium">No se han registrado consumos en el comedor hoy.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DONATIONS */}
      {activeTab === 'donations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Donation Form */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
            <h3 className="text-sm font-bold text-primary mb-4">Registrar Donación</h3>
            <form onSubmit={handleRegisterDonation} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre del Donante / Institución</label>
                <input 
                  type="text" 
                  value={donorName} 
                  onChange={(e) => setDonorName(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                  placeholder="ej. Cruz Roja Venezolana"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Artículo Donado</label>
                <input 
                  type="text" 
                  value={donationItem} 
                  onChange={(e) => setDeliveryItem(e.target.value) /* Wait: donationItem and donationQty needs setting. Let's fix that below */} 
                  onChange={(e) => setDonationItem(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                  placeholder="ej. Pañales desechables"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Cantidad</label>
                  <input 
                    type="number" 
                    value={donationQty} 
                    onChange={(e) => setDonationQty(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Unidad</label>
                  <input 
                    type="text" 
                    value={donationUnit} 
                    onChange={(e) => setDonationUnit(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none"
                    placeholder="ej. und, cajas"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="mt-2 w-full py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer"
              >
                Ingresar Donación
              </button>
            </form>
          </div>

          {/* Donations List */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
            <h3 className="text-sm font-bold text-primary mb-4">Donaciones Recibidas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                    <th className="py-2.5 px-4">Donante</th>
                    <th className="py-2.5 px-4">Artículo</th>
                    <th className="py-2.5 px-4 text-center">Cantidad</th>
                    <th className="py-2.5 px-4">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.length > 0 ? (
                    donations.map((don) => (
                      <tr key={don.id} className="border-b border-outline-variant hover:bg-surface-container/20">
                        <td className="py-2.5 px-4 font-bold text-primary">{don.donor_name}</td>
                        <td className="py-2.5 px-4 text-on-surface">{don.item_name}</td>
                        <td className="py-2.5 px-4 text-center font-semibold">{don.quantity} {don.unit}</td>
                        <td className="py-2.5 px-4 text-on-surface-variant">
                          {new Date(don.received_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-on-surface-variant font-medium">No se han registrado donaciones todavía.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
