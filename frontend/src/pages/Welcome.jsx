import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Welcome({ token, user, onSelectRefugio }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalRefugios: 0, totalDamnificados: 0, capacidadTotal: 0, capacidadDisponible: 0, sedesCriticas: 0 });
  const [refugios, setRefugios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRefugioToEdit, setSelectedRefugioToEdit] = useState(null);
  const [error, setError] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('Operativo');
  const [estado, setEstado] = useState('Distrito Capital');

  const VENEZUELAN_STATES = [
    'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 
    'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'Lara', 'Mérida', 'Miranda', 
    'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Vargas', 'Yaracuy', 'Zulia'
  ];

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : '/refugios/api';

  useEffect(() => {
    fetchStats();
    fetchRefugios();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRefugios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/refugios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRefugios(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.refugio_id && refugios.length > 0) {
      const myRefugio = refugios.find(r => r.id === parseInt(user.refugio_id));
      if (myRefugio) {
        onSelectRefugio(myRefugio);
        const role = user.role;
        const rid = myRefugio.id;
        let defaultPath = `/refugio/${rid}/dashboard`;
        if (role === 'medico') defaultPath = `/refugio/${rid}/medico/triaje`;
        if (role === 'seguridad') defaultPath = `/refugio/${rid}/control-acceso`;
        if (role === 'cocina') defaultPath = `/refugio/${rid}/comedor/panel`;
        if (role === 'almacen') defaultPath = `/refugio/${rid}/almacen/inventario`;
        if (role === 'registro') defaultPath = `/refugio/${rid}/registro`;
        if (role === 'apoyo') defaultPath = `/refugio/${rid}/residentes`;
        navigate(defaultPath);
      }
    }
  }, [user, refugios]);

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setSelectedRefugioToEdit(null);
    setName('');
    setLocation('');
    setCapacity(100);
    setPhone('');
    setImageUrl('');
    setStatus('Operativo');
    setEstado('Distrito Capital');
    setError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (refugio, e) => {
    e.stopPropagation();
    setIsEditMode(true);
    setSelectedRefugioToEdit(refugio);
    setName(refugio.name);
    setLocation(refugio.location);
    setCapacity(refugio.capacity);
    setPhone(refugio.contact_phone || '');
    setImageUrl(refugio.image_url || '');
    setStatus(refugio.status || 'Operativo');
    setEstado(refugio.estado || 'Distrito Capital');
    setError('');
    setShowModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize using HTML Canvas for optimized base64 string
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const scale = MAX_WIDTH / img.width;
        
        if (img.width > MAX_WIDTH) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to lightweight compressed JPEG
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setImageUrl(base64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateOrUpdateRefugio = async (e) => {
    e.preventDefault();
    setError('');
    
    const bodyData = {
      name,
      location,
      capacity: parseInt(capacity),
      contact_phone: phone,
      image_url: imageUrl,
      status,
      estado
    };

    try {
      let res;
      if (isEditMode && selectedRefugioToEdit) {
        res = await fetch(`${API_BASE}/refugios/${selectedRefugioToEdit.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(bodyData)
        });
      } else {
        res = await fetch(`${API_BASE}/refugios`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(bodyData)
        });
      }

      if (res.ok) {
        setShowModal(false);
        fetchRefugios();
        fetchStats();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al guardar los datos del refugio.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    }
  };

  const handleDeleteRefugio = async () => {
    if (!selectedRefugioToEdit) return;
    if (!window.confirm(`¿Estás completamente seguro de eliminar el refugio '${selectedRefugioToEdit.name}'? Se eliminarán todos los residentes, camas y registros de esta sede permanentemente.`)) {
      return;
    }
    setError('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${selectedRefugioToEdit.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setShowModal(false);
        fetchRefugios();
        fetchStats();
      } else {
        setError('Error al eliminar el refugio.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <header className="mb-10">
        <div>
          <span className="text-primary font-bold text-xs tracking-widest uppercase block">Refugios 4.0</span>
          <h1 className="text-3xl font-extrabold text-primary mt-1">Selección de Sede Operativa</h1>
          <p className="text-body-md text-on-surface-variant max-w-2xl mt-2">
            Supervise el estado general de la red o seleccione una sede específica para gestionar sus recursos, ingresos y suministros en tiempo real.
          </p>
        </div>
      </header>

      {/* Metrics Cards */}
      <section className={`grid grid-cols-1 gap-6 mb-12 ${user?.role === 'admin' || user?.role === 'supervisor' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 bg-surface-container-high rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-3xl">groups</span>
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Capacidad Total Red</p>
            <h3 className="text-2xl font-bold text-on-surface">
              {stats.totalDamnificados} / {stats.capacidadTotal}
            </h3>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 bg-surface-container-high rounded-full flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-3xl">inventory_2</span>
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Alertas de Suministros</p>
            <h3 className={`text-2xl font-bold ${stats.sedesCriticas > 0 ? 'text-error' : 'text-on-surface'}`}>
              {stats.sedesCriticas > 0 ? `${stats.sedesCriticas} Sede(s) Crítica(s)` : 'Todo en Orden'}
            </h3>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 bg-surface-container-high rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-3xl">emergency</span>
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Incidentes Activos</p>
            <h3 className="text-2xl font-bold text-on-surface">0 Reportados</h3>
          </div>
        </div>

        {(user?.role === 'admin' || user?.role === 'supervisor') && (
          <button 
            onClick={() => navigate('/reportes-consolidados')}
            className="bg-primary/5 hover:bg-primary/10 p-6 rounded-xl border border-primary/20 shadow-xs flex items-center gap-4 text-left transition-all hover:scale-102 cursor-pointer focus:outline-none"
          >
            <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl">public</span>
            </div>
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Reporte Consolidado</p>
              <h3 className="text-sm font-black text-on-surface-variant mt-0.5">Acceso Global País</h3>
              <span className="text-[10px] text-primary underline block mt-0.5 font-bold">Ver Reporte Estadal/Nacional</span>
            </div>
          </button>
        )}
      </section>

      {/* Shelter Grid */}
      <section className="bento-grid">
        {refugios.map((refugio) => {
          const occupancyPercent = refugio.capacity > 0 
            ? Math.round((refugio.damnificados_count / refugio.capacity) * 100)
            : 0;

          return (
            <div 
              key={refugio.id}
              className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden group hover:border-primary hover:shadow-md transition-all duration-300 flex flex-col relative"
            >
              {/* Edit Button overlay */}
              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <button 
                  onClick={(e) => handleOpenEditModal(refugio, e)}
                  className="absolute top-4 right-4 z-10 bg-white/80 hover:bg-white text-on-surface p-2 rounded-full shadow-md cursor-pointer hover:scale-105 transition-all flex items-center justify-center"
                  title="Editar Sede"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              )}

              {/* Card Image */}
              <div className="h-44 bg-gradient-to-br from-primary to-primary-container flex items-center justify-center relative overflow-hidden">
                {refugio.image_url ? (
                  <img src={refugio.image_url} alt={refugio.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-white text-5xl opacity-40">domain</span>
                )}
                <div className="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> {refugio.status || 'Operativo'}
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="max-w-[70%]">
                    <h4 className="text-lg font-bold text-on-surface truncate">{refugio.name}</h4>
                    <p className="text-xs text-on-surface-variant truncate">{refugio.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-primary">{occupancyPercent}% Ocupación</p>
                    <div className="w-24 h-1.5 bg-secondary-container rounded-full mt-1 overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${Math.min(100, occupancyPercent)}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-surface-container p-3 rounded-lg">
                    <span className="text-xs text-on-surface-variant block">Residentes</span>
                    <span className="text-lg font-bold text-on-surface">{refugio.damnificados_count}</span>
                  </div>
                  <div className="bg-surface-container p-3 rounded-lg">
                    <span className="text-xs text-on-surface-variant block">Capacidad</span>
                    <span className="text-lg font-bold text-on-surface">{refugio.capacity}</span>
                  </div>
                </div>

                <button 
                  onClick={() => onSelectRefugio(refugio)}
                  className="mt-auto w-full py-3 bg-surface-container-high text-primary font-bold rounded-lg group-hover:bg-primary group-hover:text-on-primary transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  Entrar a Gestión 
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Add New Sede Placeholder Card */}
        {(user?.role === 'admin' || user?.role === 'supervisor') && (
          <button 
            onClick={handleOpenCreateModal}
            className="border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-on-surface-variant hover:bg-surface-container-high hover:border-primary hover:text-primary transition-all duration-300 min-h-[300px] cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl">add_business</span>
            </div>
            <div className="text-center">
              <h4 className="text-lg font-bold">Agregar Nueva Sede</h4>
              <p className="text-xs text-on-surface-variant">Configurar un nuevo centro de refugio en la red global</p>
            </div>
          </button>
        )}
      </section>

      {/* Map Access Callout */}
      <section className="mt-12">
        <div className="bg-primary-container text-on-primary-container rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-md">
            <h3 className="text-xl font-bold mb-2">Visualización Geográfica</h3>
            <p className="text-body-sm opacity-90">Acceda al mapa interactivo para ver la distribución de recursos y traslados activos entre sedes de toda la región.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="bg-white/10 p-4 rounded-xl flex items-center gap-4 border border-white/20">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">location_on</span>
              </div>
              <div>
                <p className="text-xs opacity-80">Sedes Activas</p>
                <p className="text-md font-bold">{refugios.length} Localidades</p>
              </div>
            </div>
            <button 
              onClick={() => {
                if (refugios.length > 0) {
                  onSelectRefugio(refugios[0]);
                  setTimeout(() => navigate(`/refugio/${refugios[0].id}/dashboard`), 100);
                } else {
                  alert("Por favor, cree un refugio primero.");
                }
              }}
              className="px-8 py-4 bg-white text-primary font-bold rounded-xl shadow-md hover:scale-105 transition-transform flex items-center gap-3 cursor-pointer"
            >
              <span className="material-symbols-outlined">map</span>
              Abrir Panel de Control
            </button>
          </div>
        </div>
      </section>

      {/* Create / Edit Shelter Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-primary">{isEditMode ? 'Editar Sede Operativa' : 'Agregar Nueva Sede'}</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {error && <p className="mb-4 text-xs font-bold text-error">{error}</p>}
            
            <form onSubmit={handleCreateOrUpdateRefugio} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre del Refugio</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="ej. Refugio Norte"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Ubicación / Sector</label>
                <input 
                  type="text" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="ej. Distrito Industrial, Sector A"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Estado del País (Venezuela)</label>
                <select 
                  value={estado} 
                  onChange={(e) => setEstado(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold"
                  required
                >
                  <option value="">-- Seleccionar Estado --</option>
                  {VENEZUELAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Capacidad Máxima</label>
                  <input 
                    type="number" 
                    value={capacity} 
                    onChange={(e) => setCapacity(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Teléfono Contacto</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="ej. 0412-1234567"
                  />
                </div>
              </div>

              {/* Photo Upload Container */}
              <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
                <label className="text-xs font-bold text-on-surface-variant block">Foto de la Sede</label>
                
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-outline-variant overflow-hidden bg-surface-container flex items-center justify-center text-on-surface-variant">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Vista previa" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl">image</span>
                    )}
                  </div>

                  <label className="px-4 py-2.5 border border-outline text-primary font-bold rounded-lg text-xs hover:bg-surface-container cursor-pointer transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                    Subir o Tomar Foto
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                  </label>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-error font-semibold hover:underline"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {isEditMode && (
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Estado de la Sede</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm focus:outline-none"
                  >
                    <option value="Operativo">Operativo (Activo)</option>
                    <option value="Lleno">Lleno / Capacidad Máxima</option>
                    <option value="En Mantenimiento">En Mantenimiento</option>
                  </select>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                {isEditMode && (
                  <button 
                    type="button"
                    onClick={handleDeleteRefugio}
                    className="py-3 px-4 bg-error-container text-error font-bold rounded-lg hover:opacity-90 transition-all cursor-pointer text-xs"
                  >
                    Eliminar Sede
                  </button>
                )}
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-lg shadow-sm hover:opacity-95 transition-all cursor-pointer text-xs"
                >
                  {isEditMode ? 'Guardar Cambios' : 'Crear Sede Operativa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
