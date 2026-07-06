import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function BedsManagement({ token }) {
  const { refugioId } = useParams();
  
  // Data states
  const [beds, setBeds] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Drill-down state
  const [selectedSpace, setSelectedSpace] = useState(null); // String (room_number) or null
  
  // Interaction & Filter States
  const [viewFamilyMode, setViewFamilyMode] = useState(false);
  const [bedSearchQuery, setBedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'Disponible', 'Ocupada', 'Mantenimiento'
  const [activeBedDetail, setActiveBedDetail] = useState(null); // Bed object currently selected in side panel

  // Modal states
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [showEditSpaceModal, setShowEditSpaceModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // Form states
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceBedCount, setNewSpaceBedCount] = useState(10);
  const [editingSpaceName, setEditingSpaceName] = useState('');
  const [editingSpaceNewName, setEditingSpaceNewName] = useState('');
  
  const [assigneeId, setAssigneeId] = useState('');
  const [residentSearchTerm, setResidentSearchTerm] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  useEffect(() => {
    fetchBeds();
    fetchUnassignedResidents();
  }, [refugioId]);

  // Sync active detail if beds list updates
  useEffect(() => {
    if (activeBedDetail && beds.length > 0) {
      const updated = beds.find(b => b.id === activeBedDetail.id);
      if (updated) {
        setActiveBedDetail(updated);
      }
    }
  }, [beds]);

  const fetchBeds = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBeds(data);
        
        // If a space is selected, default activeBedDetail to the first bed in that space
        if (selectedSpace) {
          const spaceBeds = data.filter(b => b.room_number === selectedSpace);
          if (spaceBeds.length > 0) {
            setActiveBedDetail(spaceBeds[0]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedResidents = async () => {
    try {
      const res = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Keep active ones
        setResidents(data.filter(r => r.status === 'Activo'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Group beds by room_number (Space) to build the cards view
  const spaces = {};
  beds.forEach(bed => {
    if (!spaces[bed.room_number]) {
      spaces[bed.room_number] = {
        name: bed.room_number,
        total: 0,
        occupied: 0,
        available: 0,
        bedsList: []
      };
    }
    spaces[bed.room_number].total++;
    if (bed.status === 'Ocupada') {
      spaces[bed.room_number].occupied++;
    } else {
      spaces[bed.room_number].available++;
    }
    spaces[bed.room_number].bedsList.push(bed);
  });

  // Sort beds in each space in natural numerical order
  Object.keys(spaces).forEach(spaceName => {
    spaces[spaceName].bedsList.sort((a, b) => {
      const numA = parseInt(a.bed_number.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.bed_number.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  });

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds/space`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          room_number: newSpaceName,
          bed_count: parseInt(newSpaceBedCount)
        })
      });
      if (res.ok) {
        setMessage(`Espacio '${newSpaceName}' creado exitosamente.`);
        setNewSpaceName('');
        setNewSpaceBedCount(10);
        setShowSpaceModal(false);
        fetchBeds();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al crear el espacio.');
      }
    } catch (err) {
      setError('Error al conectar con la API.');
    }
  };

  const handleOpenEditSpace = (spaceName, e) => {
    e.stopPropagation();
    setEditingSpaceName(spaceName);
    setEditingSpaceNewName(spaceName);
    setShowEditSpaceModal(true);
  };

  const handleRenameSpace = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds/space`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          old_room_number: editingSpaceName,
          new_room_number: editingSpaceNewName
        })
      });
      if (res.ok) {
        setMessage('Espacio renombrado exitosamente.');
        setShowEditSpaceModal(false);
        fetchBeds();
        if (selectedSpace === editingSpaceName) {
          setSelectedSpace(editingSpaceNewName);
        }
      } else {
        setError('Error al renombrar el espacio.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    }
  };

  const handleDeleteSpace = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el espacio '${editingSpaceName}'? Se desvincularán todas las camas asociadas.`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/refugios/${refugioId}/beds/space`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ room_number: editingSpaceName })
      });
      if (res.ok) {
        setMessage('Espacio eliminado correctamente.');
        setShowEditSpaceModal(false);
        setSelectedSpace(null);
        fetchBeds();
      } else {
        setError('Error al eliminar el espacio.');
      }
    } catch (err) {
      setError('Error de conexión.');
    }
  };

  const handleOpenAssign = (bed) => {
    setActiveBedDetail(bed);
  };

  const handleFreeBed = async (bedId) => {
    if (!window.confirm('¿Desea desocupar/liberar esta cama?')) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/beds/${bedId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resident_id: null })
      });
      if (res.ok) {
        fetchBeds();
        fetchUnassignedResidents();
      } else {
        setError('Error al liberar la cama.');
      }
    } catch (err) {
      setError('Error de conexión.');
    }
  };

  const handleMarkMaintenance = async (bedId) => {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/beds/${bedId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resident_id: null, status: 'Mantenimiento' })
      });
      if (res.ok) {
        fetchBeds();
        fetchUnassignedResidents();
      } else {
        setError('Error al poner la cama en mantenimiento.');
      }
    } catch (err) {
      setError('Error de conexión.');
    }
  };

  const handleAssignBed = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/beds/${activeBedDetail.id}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resident_id: assigneeId ? parseInt(assigneeId) : null, status: assigneeId ? 'Ocupada' : 'Disponible' })
      });
      if (res.ok) {
        setShowAssignModal(false);
        fetchBeds();
        fetchUnassignedResidents();
      } else {
        setError('Error al asignar el residente en la cama.');
      }
    } catch (err) {
      setError('Error de conexión.');
    }
  };

  // Find other family members in the same salon
  let selectedBedFamilyGroupId = null;
  let otherFamilyMembersBeds = [];

  if (activeBedDetail && activeBedDetail.status === 'Ocupada' && activeBedDetail.special_needs) {
    try {
      // Find the family_group_id of activeBedDetail resident in the residents list
      const residentObj = residents.find(r => r.id === activeBedDetail.resident_id);
      if (residentObj && residentObj.family_group_id) {
        selectedBedFamilyGroupId = residentObj.family_group_id;
        
        // Find other beds in the same space occupied by residents of the same family_group_id
        if (selectedSpace && spaces[selectedSpace]) {
          otherFamilyMembersBeds = spaces[selectedSpace].bedsList.filter(b => {
            if (b.id === activeBedDetail.id || b.status !== 'Ocupada') return false;
            const bRes = residents.find(r => r.id === b.resident_id);
            return bRes && bRes.family_group_id === selectedBedFamilyGroupId;
          }).map(b => {
            const bRes = residents.find(r => r.id === b.resident_id);
            return {
              bedId: b.id,
              bedNumber: b.bed_number,
              name: `${bRes.first_name} ${bRes.last_name}`,
              bedObj: b
            };
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Filtered beds inside selected space
  const filteredBeds = (spaces[selectedSpace]?.bedsList || []).filter(bed => {
    // Search filter
    const matchesSearch = bed.bed_number.toLowerCase().includes(bedSearchQuery.toLowerCase()) ||
      (bed.first_name && bed.first_name.toLowerCase().includes(bedSearchQuery.toLowerCase())) ||
      (bed.last_name && bed.last_name.toLowerCase().includes(bedSearchQuery.toLowerCase())) ||
      (bed.document_id && bed.document_id.toLowerCase().includes(bedSearchQuery.toLowerCase()));

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'Disponible') {
      matchesStatus = bed.status === 'Disponible';
    } else if (statusFilter === 'Ocupada') {
      matchesStatus = bed.status === 'Ocupada';
    } else if (statusFilter === 'Mantenimiento') {
      matchesStatus = bed.status === 'Mantenimiento';
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-primary">Gestión de Espacios y Camas</h2>
          <p className="text-xs text-on-surface-variant">Gestione la capacidad y disponibilidad de las áreas del campamento temporal.</p>
        </div>
        
        {!selectedSpace ? (
          <button 
            onClick={() => setShowSpaceModal(true)}
            className="px-4 py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Crear Nuevo Espacio
          </button>
        ) : (
          <button 
            onClick={() => {
              setSelectedSpace(null);
              setActiveBedDetail(null);
            }}
            className="px-4 py-2.5 border border-outline text-primary font-bold rounded-lg text-xs hover:bg-surface-container transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Volver a Espacios
          </button>
        )}
      </header>

      {error && <p className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-xs font-bold text-error">{error}</p>}
      {message && <p className="mb-4 p-3 bg-success/10 border border-success/20 rounded-lg text-xs font-bold text-success">{message}</p>}

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant font-medium text-xs">Cargando distribución de alojamiento...</div>
      ) : (
        <>
          {/* VIEW 1: SPACES CARDS GRID */}
          {!selectedSpace ? (
            Object.keys(spaces).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(spaces).sort().map(spaceName => {
                  const space = spaces[spaceName];
                  const occupancy = space.total > 0 ? Math.round((space.occupied / space.total) * 100) : 0;
                  
                  const isGym = spaceName.toLowerCase().includes('gimnasio');
                  const spaceIcon = isGym ? 'fitness_center' : 'domain';
                  const spaceDesc = isGym ? 'Zona de contingencia secundaria' : (spaceName.toLowerCase().includes('principal') ? 'Zona de alojamiento masivo A' : 'Zona de alojamiento activa');

                  return (
                    <div 
                      key={spaceName}
                      onClick={() => {
                        setSelectedSpace(spaceName);
                        const spaceBeds = beds.filter(b => b.room_number === spaceName);
                        if (spaceBeds.length > 0) {
                          setActiveBedDetail(spaceBeds[0]);
                        }
                      }}
                      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs hover:border-primary hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined">{spaceIcon}</span>
                            </div>
                            <div>
                              <h3 className="text-md font-bold text-on-surface">{spaceName}</h3>
                              <p className="text-[10px] text-on-surface-variant">{spaceDesc}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${occupancy >= 100 ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
                            {occupancy >= 100 ? 'LLENO' : 'OPERATIVO'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-y border-outline-variant py-4 my-4 text-center">
                          <div>
                            <span className="text-[10px] text-on-surface-variant block uppercase font-semibold">Capacidad Total</span>
                            <span className="text-md font-bold text-on-surface">{space.total}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-on-surface-variant block uppercase font-semibold">Ocupadas</span>
                            <span className="text-md font-bold text-on-surface">{space.occupied}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-on-surface-variant block uppercase font-semibold">Disponibles</span>
                            <span className="text-md font-bold text-primary">{space.available}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="font-semibold text-on-surface-variant">Nivel de Ocupación</span>
                          <span className="font-bold text-on-surface">{occupancy}%</span>
                        </div>
                        <div className="w-full h-2 bg-secondary-container rounded-full overflow-hidden mb-4">
                          <div className="bg-primary h-full transition-all duration-300" style={{ width: `${occupancy}%` }}></div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={(e) => handleOpenEditSpace(spaceName, e)}
                            className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[12px]">edit</span>
                            Editar Espacio
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border-2 border-dashed border-outline-variant rounded-xl p-12 text-center text-on-surface-variant max-w-xl mx-auto flex flex-col items-center gap-4">
                <span className="material-symbols-outlined text-5xl">holiday_village</span>
                <div>
                  <h4 className="text-md font-bold text-on-surface">No hay espacios configurados</h4>
                  <p className="text-xs text-on-surface-variant mt-1">Crea un espacio para iniciar.</p>
                </div>
                <button 
                  onClick={() => setShowSpaceModal(true)}
                  className="px-4 py-2 bg-primary text-on-primary font-bold rounded-lg text-xs"
                >
                  + Crear Nuevo Espacio
                </button>
              </div>
            )
          ) : (
            // VIEW 2: SPLIT SCREEN LAYOUT (BED MAP + ASSIGNMENT DETAIL PANEL)
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* LEFT & CENTER: BED MAP WITH SEARCH & FILTER */}
              <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-6">
                
                {/* Search, Filter & Toggle Row */}
                <div className="flex flex-wrap justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-outline-variant">
                  <button
                    onClick={() => setViewFamilyMode(!viewFamilyMode)}
                    className={`px-3 py-2 border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewFamilyMode 
                        ? 'bg-primary/10 border-primary text-primary shadow-xs' 
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">groups</span>
                    Vista de Grupo Familiar
                  </button>

                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
                    <input
                      type="text"
                      placeholder="Buscar cama o residente..."
                      value={bedSearchQuery}
                      onChange={e => setBedSearchQuery(e.target.value)}
                      className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs w-full focus:outline-none"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-surface-container border border-outline-variant rounded-lg p-2 text-xs focus:outline-none"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="Disponible">Disponible</option>
                    <option value="Ocupada">Ocupada</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                  </select>
                </div>

                {/* Legend */}
                <div className="flex gap-4 text-[10px] font-bold text-on-surface-variant">
                  <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500/20 border border-green-500/40 rounded"></span> Disponible</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500/20 border border-blue-500/40 rounded"></span> Ocupado</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500/20 border border-red-500/40 rounded"></span> Mantenimiento</div>
                </div>

                {/* Bed Grid Map */}
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-bold mb-3">
                    Mapa de Camas: {selectedSpace}
                  </span>

                  {filteredBeds.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-3">
                      {filteredBeds.map(bed => {
                        const isOccupied = bed.status === 'Ocupada';
                        const isMaint = bed.status === 'Mantenimiento';
                        
                        const isCurrentActive = activeBedDetail && activeBedDetail.id === bed.id;
                        
                        // Check if bed belongs to the same family group when family mode is active
                        let isFamilyRelationMatch = false;
                        if (viewFamilyMode && selectedBedFamilyGroupId && isOccupied) {
                          const bedRes = residents.find(r => r.id === bed.resident_id);
                          if (bedRes && bedRes.family_group_id === selectedBedFamilyGroupId) {
                            isFamilyRelationMatch = true;
                          }
                        }

                        // Colors
                        let bgClass = 'bg-green-500/10 border-green-500/20 text-green-600 hover:border-green-500';
                        if (isOccupied) bgClass = 'bg-blue-500/10 border-blue-500/20 text-blue-600 hover:border-blue-500';
                        if (isMaint) bgClass = 'bg-red-500/10 border-red-500/20 text-red-600 hover:border-red-500';

                        // Apply border rings for selection or relation match
                        let borderRing = '';
                        if (isCurrentActive) {
                          borderRing = 'ring-2 ring-primary border-primary scale-95';
                        } else if (isFamilyRelationMatch) {
                          borderRing = 'ring-2 ring-amber-500 border-amber-500 animate-pulse';
                        }

                        return (
                          <div
                            key={bed.id}
                            onClick={() => handleOpenAssign(bed)}
                            className={`p-3 rounded-lg border h-16 flex flex-col items-center justify-center transition-all cursor-pointer ${bgClass} ${borderRing}`}
                          >
                            <span className="material-symbols-outlined text-sm mb-0.5">
                              {isMaint ? 'build' : 'single_bed'}
                            </span>
                            <span className="text-[10px] font-bold truncate max-w-full">
                              {bed.bed_number.split(' ')[1] || bed.bed_number}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant italic text-center py-6">No se encontraron camas con los filtros aplicados.</p>
                  )}
                </div>
              </div>

              {/* RIGHT SIDE: DETAIL / ASSIGNMENT PANEL */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-5 sticky top-4">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant pb-2">
                  Detalle de Asignación
                </h3>

                {activeBedDetail ? (
                  <div className="flex flex-col gap-4 text-xs">
                    
                    {/* Header info */}
                    <div className="flex justify-between items-center bg-surface p-3 rounded-lg border border-outline-variant">
                      <div>
                        <span className="text-[10px] text-on-surface-variant block font-bold">ID de Cama</span>
                        <span className="text-sm font-black text-primary">{activeBedDetail.bed_number}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[8px] uppercase ${
                        activeBedDetail.status === 'Ocupada' ? 'bg-primary/20 text-primary' :
                        (activeBedDetail.status === 'Mantenimiento' ? 'bg-error/20 text-error' : 'bg-success/20 text-success')
                      }`}>
                        {activeBedDetail.status}
                      </span>
                    </div>

                    {/* Occupant Details if Occupied */}
                    {activeBedDetail.status === 'Ocupada' ? (
                      <>
                        <div className="border border-outline-variant p-4 rounded-xl flex items-center gap-3 bg-surface-container/20">
                          {(() => {
                            let meta = {};
                            try {
                              meta = activeBedDetail.special_needs ? JSON.parse(activeBedDetail.special_needs) : {};
                            } catch {
                              meta = {};
                            }
                            return (
                              <div className="w-12 h-12 rounded-full border border-outline-variant bg-surface-container overflow-hidden flex items-center justify-center shrink-0">
                                {meta.photo ? (
                                  <img src={meta.photo} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-xl text-on-surface-variant">person</span>
                                )}
                              </div>
                            );
                          })()}
                          <div className="truncate min-w-0">
                            <span className="text-[10px] font-bold text-on-surface-variant block uppercase">Ocupante Actual</span>
                            <span className="text-xs font-bold text-primary block truncate">
                              {activeBedDetail.first_name} {activeBedDetail.last_name}
                            </span>
                            <span className="text-[9px] text-on-surface-variant font-medium block mt-0.5">
                              ID: {activeBedDetail.document_id || 'N/T'}
                            </span>
                          </div>
                        </div>

                        {/* Family Section */}
                        {selectedBedFamilyGroupId && (
                          <div className="border-t border-outline-variant pt-3">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-2">
                              <span className="text-on-surface-variant">ID de Familia</span>
                              <span className="text-primary font-black">FAM-{selectedBedFamilyGroupId}</span>
                            </div>

                            <span className="text-[9px] text-on-surface-variant block uppercase font-bold mb-2">
                              Otros miembros en este salón ({otherFamilyMembersBeds.length})
                            </span>

                            {otherFamilyMembersBeds.length > 0 ? (
                              <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                                {otherFamilyMembersBeds.map(member => (
                                  <div
                                    key={member.bedId}
                                    onClick={() => setActiveBedDetail(member.bedObj)}
                                    className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-primary/5 flex justify-between items-center cursor-pointer transition-all text-[10px]"
                                  >
                                    <span className="font-semibold text-on-surface block truncate max-w-[120px]">{member.name}</span>
                                    <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded text-[9px]">{member.bedNumber.split(' ')[1] || member.bedNumber}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-on-surface-variant italic">No hay otros miembros de esta familia en este salón.</p>
                            )}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-outline-variant">
                          <button
                            onClick={() => handleFreeBed(activeBedDetail.id)}
                            className="w-full py-2.5 bg-primary/10 text-primary font-bold rounded-lg text-xs hover:bg-primary/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-sm">logout</span>
                            Liberar Cama
                          </button>

                          <button
                            onClick={() => handleMarkMaintenance(activeBedDetail.id)}
                            className="w-full py-2.5 bg-error/15 text-error font-bold border border-error/25 rounded-lg text-xs hover:bg-error/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-sm">build</span>
                            Marcar Mantenimiento
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="border border-dashed border-outline-variant p-6 rounded-xl text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl mb-1 text-success">check_circle</span>
                          <p className="font-bold text-on-surface">Cama Disponible</p>
                          <p className="text-[10px] mt-0.5">Actualmente libre para albergar a un ciudadano.</p>
                        </div>

                        <div className="flex flex-col gap-2 mt-2 pt-2">
                          <button
                            onClick={() => {
                              setAssigneeId('');
                              setShowAssignModal(true);
                            }}
                            className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg text-xs hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-sm">person_add</span>
                            Asignar Residente
                          </button>

                          {activeBedDetail.status !== 'Mantenimiento' && (
                            <button
                              onClick={() => handleMarkMaintenance(activeBedDetail.id)}
                              className="w-full py-2.5 bg-error/15 text-error font-bold border border-error/25 rounded-lg text-xs hover:bg-error/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-sm">build</span>
                              Marcar Mantenimiento
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant italic text-center py-6">Seleccione una cama del mapa para gestionar.</p>
                )}

              </div>

            </div>
          )}
        </>
      )}

      {/* CREATE SPACE MODAL */}
      {showSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-md font-bold text-primary">Crear Nuevo Espacio</h3>
              <button 
                onClick={() => setShowSpaceModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateSpace} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre del Espacio / Habitación</label>
                <input 
                  type="text" 
                  value={newSpaceName} 
                  onChange={(e) => setNewSpaceName(e.target.value)} 
                  placeholder="ej. Salón Principal o Gimnasio Municipal"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Cantidad de Camas</label>
                <input 
                  type="number" 
                  value={newSpaceBedCount} 
                  onChange={(e) => setNewSpaceBedCount(e.target.value)} 
                  min="1"
                  max="300"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                  required
                />
              </div>

              <button 
                type="submit" 
                className="mt-4 w-full py-3 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer shadow-sm hover:opacity-95"
              >
                Crear Espacio e Insumar Camas
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SPACE MODAL */}
      {showEditSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-md font-bold text-primary">Editar Espacio</h3>
              <button 
                onClick={() => setShowEditSpaceModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleRenameSpace} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre del Espacio</label>
                <input 
                  type="text" 
                  value={editingSpaceNewName} 
                  onChange={(e) => setEditingSpaceNewName(e.target.value)} 
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 mt-4">
                <button 
                  type="button"
                  onClick={handleDeleteSpace}
                  className="py-3 px-4 bg-error-container text-error font-bold rounded-lg hover:opacity-90 transition-all cursor-pointer text-xs"
                >
                  Eliminar Espacio
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN BED RESIDENT MODAL */}
      {showAssignModal && activeBedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-md font-bold text-primary">Gestionar Alojamiento</h3>
                <p className="text-[10px] text-on-surface-variant">{activeBedDetail.room_number} - {activeBedDetail.bed_number}</p>
              </div>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="text-on-surface-variant hover:bg-surface-container rounded-full p-2"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
              <form onSubmit={handleAssignBed} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Asignar Residente</label>
                
                <input 
                  type="text"
                  placeholder="Buscar residente sin asignar por nombre o cédula..."
                  value={residentSearchTerm}
                  onChange={(e) => setResidentSearchTerm(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-t-lg border-b-0 p-3 text-xs focus:outline-none focus:bg-surface-container placeholder:text-on-surface-variant/50"
                />

                <select 
                  size="6"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-b-lg p-2 text-xs focus:outline-none"
                >
                  <option value="" className="py-2 px-2 border-b border-outline-variant/30 text-error font-bold">-- Dejar Cama Libre / Desocupar --</option>
                  
                  {activeBedDetail.resident_id && (
                    <option value={activeBedDetail.resident_id} className="py-2 px-2 font-bold text-primary">
                      [Mantener Actual] {activeBedDetail.first_name} {activeBedDetail.last_name} (C.I. {activeBedDetail.document_id || 'N/T'})
                    </option>
                  )}

                  {residents
                    .filter(r => !beds.some(b => b.resident_id === r.id))
                    .filter(r => r.id !== activeBedDetail.resident_id)
                    .filter(r => {
                      if (!residentSearchTerm) return true;
                      const term = residentSearchTerm.toLowerCase();
                      return (r.first_name || '').toLowerCase().includes(term) ||
                             (r.last_name || '').toLowerCase().includes(term) ||
                             (r.document_id || '').toLowerCase().includes(term);
                    })
                    .map(r => (
                      <option key={r.id} value={r.id} className="py-2 px-2 border-b border-outline-variant/10">
                        {r.first_name} {r.last_name} (C.I. {r.document_id || 'N/T'})
                      </option>
                    ))
                  }
                </select>
              </div>

              <button 
                type="submit" 
                className="mt-4 w-full py-3 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer"
              >
                Actualizar Estado de la Cama
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
