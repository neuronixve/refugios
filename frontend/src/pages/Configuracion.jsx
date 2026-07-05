import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function Configuracion({ token, user }) {
  const { refugioId } = useParams();
  
  const [beds, setBeds] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [loadingDepositos, setLoadingDepositos] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Space Form State (Create / Edit)
  const [roomNumber, setRoomNumber] = useState('');
  const [bedCount, setBedCount] = useState(4);
  const [isEditingSpace, setIsEditingSpace] = useState(false);
  const [oldRoomNumber, setOldRoomNumber] = useState('');

  // Deposito Form State (Create / Edit)
  const [depositoName, setDepositoName] = useState('');
  const [depositoDesc, setDepositoDesc] = useState('');
  const [depositoCap, setDepositoCap] = useState(0);
  const [isEditingDeposito, setIsEditingDeposito] = useState(false);
  const [selectedDepositoId, setSelectedDepositoId] = useState(null);

  // RBAC User Management States
  const [activeTab, setActiveTab] = useState('fisica');
  const [usersList, setUsersList] = useState([]);
  const [refugiosList, setRefugiosList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [newUserRefugioId, setNewUserRefugioId] = useState('');
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchBeds();
    fetchDepositos();
    if (user && (user.role === 'admin' || user.role === 'supervisor' || user.role === 'gerente')) {
      fetchUsers();
      fetchRefugiosList();
    }
  }, [refugioId, user]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsersList(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRefugiosList = async () => {
    try {
      const res = await fetch(`${API_BASE}/refugios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRefugiosList(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBeds = async () => {
    setLoadingBeds(true);
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setBeds(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBeds(false);
    }
  };

  const fetchDepositos = async () => {
    setLoadingDepositos(true);
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/depositos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDepositos(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDepositos(false);
    }
  };

  // Create or Edit space
  const handleSpaceSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (isEditingSpace) {
      try {
        const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds/space`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            old_room_number: oldRoomNumber,
            new_room_number: roomNumber,
            bed_count: parseInt(bedCount)
          })
        });

        if (res.ok) {
          setMessage(`Espacio actualizado con éxito a '${roomNumber}' con ${bedCount} camas.`);
          handleCancelEditSpace();
          fetchBeds();
        } else {
          const data = await res.json();
          setError(data.error || 'Error al actualizar espacio.');
        }
      } catch (err) {
        setError('Error de conexión al guardar cambios.');
      }
    } else {
      try {
        const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds/space`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            room_number: roomNumber,
            bed_count: parseInt(bedCount)
          })
        });
        if (res.ok) {
          setMessage(`Espacio '${roomNumber}' con ${bedCount} camas añadido con éxito.`);
          setRoomNumber('');
          setBedCount(4);
          fetchBeds();
        } else {
          const data = await res.json();
          setError(data.error || 'Error al agregar espacio.');
        }
      } catch (err) {
        setError('Error al conectar con el servidor.');
      }
    }
  };

  const handleEditSpaceClick = (roomName, totalCamas) => {
    setError('');
    setMessage('');
    setIsEditingSpace(true);
    setOldRoomNumber(roomName);
    setRoomNumber(roomName);
    setBedCount(totalCamas);
  };

  const handleCancelEditSpace = () => {
    setIsEditingSpace(false);
    setOldRoomNumber('');
    setRoomNumber('');
    setBedCount(4);
  };

  const handleDeleteSpace = async (roomName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el espacio '${roomName}' y todas sus camas? Esto desvinculará a los residentes asignados.`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds/space?room_number=${encodeURIComponent(roomName)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setMessage(`Espacio '${roomName}' eliminado.`);
        if (isEditingSpace && oldRoomNumber === roomName) {
          handleCancelEditSpace();
        }
        fetchBeds();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Error al eliminar el espacio.');
      }
    } catch (err) {
      setError('Error al conectar con la API.');
    }
  };

  // Create or Edit Deposito
  const handleDepositoSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!depositoName.trim()) return;

    if (isEditingDeposito) {
      try {
        const res = await fetch(`${API_BASE}/refugios/${refugioId}/depositos/${selectedDepositoId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: depositoName,
            description: depositoDesc,
            capacity_percent: parseInt(depositoCap) || 0
          })
        });

        if (res.ok) {
          setMessage(`Depósito actualizado exitosamente.`);
          handleCancelEditDeposito();
          fetchDepositos();
        } else {
          const data = await res.json();
          setError(data.error || 'Error al actualizar depósito.');
        }
      } catch (err) {
        setError('Error de conexión al actualizar depósito.');
      }
    } else {
      try {
        const res = await fetch(`${API_BASE}/refugios/${refugioId}/depositos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: depositoName,
            description: depositoDesc,
            capacity_percent: parseInt(depositoCap) || 0
          })
        });

        if (res.ok) {
          setMessage(`Depósito '${depositoName}' configurado exitosamente.`);
          setDepositoName('');
          setDepositoDesc('');
          setDepositoCap(0);
          fetchDepositos();
        } else {
          const data = await res.json();
          setError(data.error || 'Error al configurar depósito.');
        }
      } catch (err) {
        setError('Error de conexión al crear depósito.');
      }
    }
  };

  const handleEditDepositoClick = (dep) => {
    setError('');
    setMessage('');
    setIsEditingDeposito(true);
    setSelectedDepositoId(dep.id);
    setDepositoName(dep.name);
    setDepositoDesc(dep.description || '');
    setDepositoCap(dep.capacity_percent || 0);
  };

  const handleCancelEditDeposito = () => {
    setIsEditingDeposito(false);
    setSelectedDepositoId(null);
    setDepositoName('');
    setDepositoDesc('');
    setDepositoCap(0);
  };

  // Delete Deposito
  const handleDeleteDeposito = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el depósito '${name}'?`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/depositos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage(`Depósito '${name}' eliminado.`);
        if (isEditingDeposito && selectedDepositoId === id) {
          handleCancelEditDeposito();
        }
        fetchDepositos();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Error al eliminar depósito.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    }
  };

  // --- SUBMIT DE USUARIOS ---
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!newUserName.trim() || !newUserEmail.trim() || (!isEditingUser && !newUserPassword.trim()) || !newUserRole) {
      setError('Por favor, complete todos los campos obligatorios.');
      return;
    }

    const needsRefugio = ['gerente', 'medico', 'seguridad', 'cocina', 'almacen', 'registro', 'apoyo'].includes(newUserRole);
    let targetRefugio = newUserRefugioId;
    if (user.role === 'gerente') {
      targetRefugio = refugioId;
    }

    if (needsRefugio && !targetRefugio && user.role !== 'gerente') {
      setError('Debe seleccionar una Sede para este rol.');
      return;
    }

    try {
      const url = isEditingUser ? `${API_BASE}/users/${editingUserId}` : `${API_BASE}/users`;
      const method = isEditingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          refugio_id: needsRefugio ? parseInt(targetRefugio) : null
        })
      });

      if (res.ok) {
        setMessage(isEditingUser ? `Usuario '${newUserName}' actualizado exitosamente.` : `Usuario '${newUserName}' registrado exitosamente.`);
        handleCancelEditUser();
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al procesar el usuario.');
      }
    } catch (err) {
      setError('Error al conectar con la API.');
    }
  };

  const handleEditUserClick = (u) => {
    setError('');
    setMessage('');
    setIsEditingUser(true);
    setEditingUserId(u.id);
    setNewUserName(u.name);
    setNewUserEmail(u.email);
    setNewUserPassword('');
    setNewUserRole(u.role);
    setNewUserRefugioId(u.refugio_id || '');
  };

  const handleCancelEditUser = () => {
    setIsEditingUser(false);
    setEditingUserId(null);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole('');
    setNewUserRefugioId('');
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario '${name}'?`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage(`Usuario '${name}' eliminado.`);
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al eliminar el usuario.');
      }
    } catch (err) {
      setError('Error de conexión al eliminar usuario.');
    }
  };

  const getAllowedRolesToCreate = () => {
    if (!user) return [];
    if (user.role === 'admin') {
      return [
        { value: 'supervisor', label: 'Supervisor Global (Reportes/Sedes)' },
        { value: 'gerente', label: 'Gerente de Sede (Administrador de Sede)' },
        { value: 'medico', label: 'Personal Médico (Triaje y Reporte)' },
        { value: 'seguridad', label: 'Personal de Seguridad (Control QR)' },
        { value: 'cocina', label: 'Personal Cocina (Comedor)' },
        { value: 'almacen', label: 'Personal Almacén' },
        { value: 'registro', label: 'Personal Registro (Recepción/Camas)' },
        { value: 'apoyo', label: 'Apoyo Social' }
      ];
    }
    if (user.role === 'supervisor') {
      return [
        { value: 'gerente', label: 'Gerente de Sede' }
      ];
    }
    if (user.role === 'gerente') {
      return [
        { value: 'medico', label: 'Personal Médico' },
        { value: 'seguridad', label: 'Personal de Seguridad' },
        { value: 'cocina', label: 'Personal Cocina' },
        { value: 'almacen', label: 'Personal Almacén' },
        { value: 'registro', label: 'Personal Registro' },
        { value: 'apoyo', label: 'Apoyo Social' }
      ];
    }
    return [];
  };

  const roleLabels = {
    admin: 'Superusuario',
    supervisor: 'Supervisor Global',
    gerente: 'Gerente de Sede',
    medico: 'Personal Médico',
    seguridad: 'Personal de Seguridad',
    cocina: 'Personal Cocina',
    almacen: 'Personal Almacén',
    registro: 'Personal Registro',
    apoyo: 'Apoyo Social'
  };

  // Group beds by room
  const rooms = {};
  beds.forEach(bed => {
    if (!rooms[bed.room_number]) {
      rooms[bed.room_number] = {
        total: 0,
        occupied: 0,
        available: 0
      };
    }
    rooms[bed.room_number].total++;
    if (bed.status === 'Ocupada') rooms[bed.room_number].occupied++;
    else rooms[bed.room_number].available++;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Header */}
      <header className="mb-8">
        <h2 className="text-2xl font-extrabold text-primary">Configuración General</h2>
        <p className="text-xs text-on-surface-variant">Configure la distribución física de salones, camas, depósitos y administre el personal y cuentas de acceso.</p>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-error-container/20 border border-error/25 text-error rounded-xl text-xs font-semibold animate-fade-in">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-6 p-4 bg-success/10 border border-success/20 text-success rounded-xl text-xs font-semibold animate-fade-in">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/60 mb-8">
        <button 
          onClick={() => setActiveTab('fisica')}
          className={`pb-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'fisica' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
        >
          Distribución Física y Camas
        </button>
        {(user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'gerente') && (
          <button 
            onClick={() => setActiveTab('usuarios')}
            className={`pb-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'usuarios' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            Gestión de Personal y Cuentas
          </button>
        )}
      </div>

      {activeTab === 'fisica' ? (
        <>
          {/* Grid: Space/Beds configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            
            {/* Left Side: Create/Edit Room */}
            <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs h-fit">
              <h3 className="text-sm font-bold text-primary mb-4">
                {isEditingSpace ? `Editar Salón: ${oldRoomNumber}` : 'Configurar Nuevo Salón / Espacio'}
              </h3>
              
              <form onSubmit={handleSpaceSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre del Espacio / Habitación</label>
                  <input 
                    type="text" 
                    value={roomNumber} 
                    onChange={(e) => setRoomNumber(e.target.value)} 
                    placeholder="ej. Habitación 1 o Bloque A"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Cantidad de Camas</label>
                  <input 
                    type="number" 
                    value={bedCount} 
                    onChange={(e) => setBedCount(e.target.value)} 
                    min="1"
                    max="100"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  {isEditingSpace && (
                    <button 
                      type="button" 
                      onClick={handleCancelEditSpace}
                      className="flex-1 py-2.5 bg-surface border border-outline-variant text-on-surface font-bold rounded-lg text-xs cursor-pointer hover:bg-surface-container"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="flex-grow py-2.5 bg-[#0b2347] text-white font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">{isEditingSpace ? 'save' : 'add'}</span>
                    {isEditingSpace ? 'Guardar Cambios' : 'Crear Espacio'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Side: Rooms list */}
            <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
              <h3 className="text-sm font-bold text-primary mb-4">Espacios y Camas Configurados</h3>
              
              {loadingBeds ? (
                <div className="text-center py-8 text-xs text-on-surface-variant">Cargando distribución...</div>
              ) : Object.keys(rooms).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                        <th className="py-2.5 px-4">Espacio / Habitación</th>
                        <th className="py-2.5 px-4 text-center">Total Camas</th>
                        <th className="py-2.5 px-4 text-center">Disponibles</th>
                        <th className="py-2.5 px-4 text-center">Ocupadas</th>
                        <th className="py-2.5 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(rooms).sort().map(rName => (
                        <tr key={rName} className="border-b border-outline-variant hover:bg-surface-container/20">
                          <td className="py-2.5 px-4 font-bold text-primary">{rName}</td>
                          <td className="py-2.5 px-4 text-center font-semibold">{rooms[rName].total}</td>
                          <td className="py-2.5 px-4 text-center text-success font-semibold">{rooms[rName].available}</td>
                          <td className="py-2.5 px-4 text-center text-on-surface-variant font-semibold">{rooms[rName].occupied}</td>
                          <td className="py-2.5 px-4 text-right flex justify-end gap-1.5">
                            <button 
                              onClick={() => handleEditSpaceClick(rName, rooms[rName].total)}
                              className="text-primary hover:bg-primary/10 p-1.5 rounded-full cursor-pointer"
                              title="Editar Espacio"
                            >
                              <span className="material-symbols-outlined text-sm font-bold">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteSpace(rName)}
                              className="text-error hover:bg-error-container/20 p-1.5 rounded-full cursor-pointer"
                              title="Eliminar Espacio"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-outline-variant text-center rounded-lg text-on-surface-variant text-xs">
                  No hay espacios configurados todavía. Utiliza el panel de la izquierda para agregar uno.
                </div>
              )}
            </div>

          </div>

          {/* Grid: Storage warehouses (Depósitos) configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Side: Create/Edit Deposito */}
            <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs h-fit">
              <h3 className="text-sm font-bold text-primary mb-4">
                {isEditingDeposito ? 'Editar Depósito' : 'Configurar Nuevo Depósito de Destino'}
              </h3>
              
              <form onSubmit={handleDepositoSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre del Depósito</label>
                  <input 
                    type="text" 
                    value={depositoName} 
                    onChange={(e) => setDepositoName(e.target.value)} 
                    placeholder="ej. Depósito Principal o Depósito Oeste"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Descripción corta</label>
                  <textarea 
                    value={depositoDesc} 
                    onChange={(e) => setDepositoDesc(e.target.value)} 
                    placeholder="Indique ubicación o tipo de insumos..."
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-20 resize-none font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Porcentaje de Capacidad (%)</label>
                  <input 
                    type="number" 
                    value={depositoCap} 
                    onChange={(e) => setDepositoCap(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} 
                    min="0"
                    max="100"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  {isEditingDeposito && (
                    <button 
                      type="button" 
                      onClick={handleCancelEditDeposito}
                      className="flex-1 py-2.5 bg-surface border border-outline-variant text-on-surface font-bold rounded-lg text-xs cursor-pointer hover:bg-surface-container"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="flex-grow py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">{isEditingDeposito ? 'save' : 'warehouse'}</span>
                    {isEditingDeposito ? 'Guardar Cambios' : 'Registrar Depósito'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Side: Depósitos List */}
            <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
              <h3 className="text-sm font-bold text-primary mb-4">Depósitos Configurados en la Sede</h3>
              
              {loadingDepositos ? (
                <div className="text-center py-8 text-xs text-on-surface-variant">Cargando depósitos...</div>
              ) : depositos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                        <th className="py-2.5 px-4">Depósito</th>
                        <th className="py-2.5 px-4">Descripción</th>
                        <th className="py-2.5 px-4 text-center">Capacidad</th>
                        <th className="py-2.5 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depositos.map(dep => (
                        <tr key={dep.id} className="border-b border-outline-variant hover:bg-surface-container/20">
                          <td className="py-3 px-4 font-bold text-primary flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-[#0b2347]">warehouse</span>
                            {dep.name}
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant max-w-xs truncate">{dep.description || 'Sin descripción'}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-surface-container rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full ${dep.capacity_percent > 80 ? 'bg-error' : dep.capacity_percent > 40 ? 'bg-primary' : 'bg-success'}`} 
                                  style={{ width: `${dep.capacity_percent}%` }}
                                ></div>
                              </div>
                              <span className="font-bold text-[10px]">{dep.capacity_percent}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right flex justify-end gap-1.5">
                            <button 
                              onClick={() => handleEditDepositoClick(dep)}
                              className="text-primary hover:bg-primary/10 p-1.5 rounded-full cursor-pointer"
                              title="Editar Depósito"
                            >
                              <span className="material-symbols-outlined text-sm font-bold">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteDeposito(dep.id, dep.name)}
                              className="text-error hover:bg-error-container/20 p-1.5 rounded-full cursor-pointer"
                              title="Eliminar Depósito"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-outline-variant text-center rounded-lg text-on-surface-variant text-xs">
                  No hay depósitos configurados todavía.
                </div>
              )}
            </div>

          </div>
        </>
      ) : (
        /* TAB DE GESTIÓN DE PERSONAL */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Formulario Registro de Personal */}
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs h-fit">
            <h3 className="text-sm font-bold text-primary mb-4">
              {isEditingUser ? 'Editar Cuenta de Acceso' : 'Registrar Nuevo Personal'}
            </h3>
            
            <form onSubmit={handleUserSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre Completo</label>
                <input 
                  type="text"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Correo Electrónico</label>
                <input 
                  type="email"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="perez@mincoex.gob.ve"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">
                  {isEditingUser ? 'Nueva Contraseña (dejar vacío para conservar)' : 'Contraseña Inicial'}
                </label>
                <input 
                  type="password"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  placeholder={isEditingUser ? 'Opcional' : 'Mínimo 6 caracteres'}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  required={!isEditingUser}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Rol de Acceso</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  required
                >
                  <option value="">-- Seleccionar Rol --</option>
                  {getAllowedRolesToCreate().map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Sede context dropdown (only rendered if role needs a refugio, and creator is admin/supervisor) */}
              {['gerente', 'medico', 'seguridad', 'cocina', 'almacen', 'registro', 'apoyo'].includes(newUserRole) && (user.role === 'admin' || user.role === 'supervisor') && (
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Asignar Sede / Refugio</label>
                  <select
                    value={newUserRefugioId}
                    onChange={e => setNewUserRefugioId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    required
                  >
                    <option value="">-- Seleccionar Sede --</option>
                    {refugiosList.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                {isEditingUser && (
                  <button 
                    type="button" 
                    onClick={handleCancelEditUser}
                    className="flex-1 py-2.5 bg-surface border border-outline-variant text-on-surface font-bold rounded-lg text-xs cursor-pointer hover:bg-surface-container"
                  >
                    Cancelar
                  </button>
                )}
                <button 
                  type="submit" 
                  className="flex-grow py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">{isEditingUser ? 'save' : 'person_add'}</span>
                  {isEditingUser ? 'Guardar Cambios' : 'Crear Cuenta de Acceso'}
                </button>
              </div>
            </form>
          </div>

          {/* Tabla de Usuarios Registrados */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-xs">
            <h3 className="text-sm font-bold text-primary mb-4 font-black">Personal Registrado</h3>
            
            {loadingUsers ? (
              <div className="text-center py-8 text-xs text-on-surface-variant">Cargando cuentas...</div>
            ) : usersList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold">
                      <th className="py-2.5 px-4">Nombre Completo</th>
                      <th className="py-2.5 px-4">Correo</th>
                      <th className="py-2.5 px-4">Rol del Sistema</th>
                      <th className="py-2.5 px-4">Sede / Refugio</th>
                      <th className="py-2.5 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id} className="border-b border-outline-variant hover:bg-surface-container/20">
                        <td className="py-3 px-4 font-bold text-primary">{u.name}</td>
                        <td className="py-3 px-4 text-on-surface-variant font-mono text-[10px]">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                            u.role === 'admin' ? 'bg-primary/10 text-primary' :
                            u.role === 'supervisor' ? 'bg-amber-600/15 text-amber-700' : 'bg-secondary-container text-on-secondary-container'
                          }`}>
                            {roleLabels[u.role] || u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-on-surface-variant font-medium">
                          {u.refugio_name || (u.role === 'admin' || u.role === 'supervisor' ? 'Acceso Global' : 'Sin Sede')}
                        </td>
                        <td className="py-3 px-4 text-right flex justify-end gap-1.5">
                          <button 
                            onClick={() => handleEditUserClick(u)}
                            className="text-primary hover:bg-primary-container/20 p-1.5 rounded-full cursor-pointer"
                            title="Editar Cuenta"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          
                          <button 
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="text-error hover:bg-error-container/20 p-1.5 rounded-full cursor-pointer"
                            title="Eliminar Cuenta"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-outline-variant text-center rounded-lg text-on-surface-variant text-xs">
                No hay personal operativo registrado para esta sede o rango jerárquico.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
