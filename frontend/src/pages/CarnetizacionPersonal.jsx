import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { useParams } from 'react-router-dom';

const ROLE_LABELS = {
  supervisor: 'Supervisor Global (Reportes/Sedes)',
  gerente: 'Gerente de Sede (Administrador de Sede)',
  medico: 'Personal Médico (Triaje y Reporte)',
  seguridad: 'Personal de Seguridad (Control QR)',
  cocina: 'Personal Cocina (Comedor)',
  almacen: 'Personal Almacén',
  registro: 'Personal Registro (Recepción/Camas)',
  apoyo: 'Apoyo Social',
  admin: 'Administrador General'
};

const ROLE_OPTIONS = [
  { value: 'supervisor', label: ROLE_LABELS.supervisor },
  { value: 'gerente', label: ROLE_LABELS.gerente },
  { value: 'medico', label: ROLE_LABELS.medico },
  { value: 'seguridad', label: ROLE_LABELS.seguridad },
  { value: 'cocina', label: ROLE_LABELS.cocina },
  { value: 'almacen', label: ROLE_LABELS.almacen },
  { value: 'registro', label: ROLE_LABELS.registro },
  { value: 'apoyo', label: ROLE_LABELS.apoyo }
];

const ROLE_ORDER = ROLE_OPTIONS.reduce((order, role, index) => {
  order[role.value] = index;
  return order;
}, { admin: ROLE_OPTIONS.length });

export default function CarnetizacionPersonal({ token, selectedRefugio }) {
  const { refugioId } = useParams();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Selection & Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [printFilter, setPrintFilter] = useState('pending'); // 'pending', 'printed', 'all'
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('role'); // 'role', 'name'

  useEffect(() => {
    fetchUsers();
  }, [refugioId]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter users for the current campamento temporal
        const activeStaff = data.filter(u => u.refugio_id && u.refugio_id.toString() === refugioId.toString());
        setUsers(activeStaff);
        
        // Auto-select pending ones
        const pending = activeStaff.filter(u => !u.card_printed);
        setSelectedIds(pending.map(u => u.id));
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleToggleAll = () => {
    const visibleIds = filteredUsers.map(u => u.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds(selectedIds.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds([...new Set([...selectedIds, ...visibleIds])]);
    }
  };

  // Search, filter, and sort logic
  const filteredUsers = users
    .filter(u => {
      const isPrinted = !!u.card_printed;
      if (printFilter === 'pending') return !isPrinted;
      if (printFilter === 'printed') return isPrinted;
      return true;
    })
    .filter(u => roleFilter === 'all' || u.role === roleFilter)
    .filter(u => {
      const fullName = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return !q || fullName.includes(q) || email.includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'role') {
        const roleA = ROLE_ORDER[a.role] ?? 99;
        const roleB = ROLE_ORDER[b.role] ?? 99;
        if (roleA !== roleB) return roleA - roleB;
        return (a.name || '').localeCompare(b.name || '');
      } else {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
    });

  const handleMarkAsPrinted = async () => {
    if (selectedUsers.length === 0) return;
    setUpdating(true);
    try {
      for (const user of selectedUsers) {
        await fetch(`${API_BASE}/users/${user.id}/print`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ card_printed: true })
        });
      }
      await fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getGroupedUsers = () => {
    const groups = {};
    filteredUsers.forEach(u => {
      const roleLabel = ROLE_LABELS[u.role] || u.role;
      if (!groups[roleLabel]) groups[roleLabel] = [];
      groups[roleLabel].push(u);
    });
    return groups;
  };

  const getRoleCount = (role) => {
    return users.filter(u => {
      if (role !== 'all' && u.role !== role) return false;
      if (printFilter === 'pending') return !u.card_printed;
      if (printFilter === 'printed') return !!u.card_printed;
      return true;
    }).length;
  };

  const renderUserCheckItem = (u) => {
    return (
      <div 
        key={u.id}
        onClick={() => handleToggleSelect(u.id)}
        className={`p-3 border rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:bg-surface-container ${selectedIds.includes(u.id) ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/30 bg-surface-container-lowest'}`}
      >
        <input 
          type="checkbox" 
          checked={selectedIds.includes(u.id)}
          onChange={() => {}}
          className="w-3.5 h-3.5 rounded text-primary focus:ring-primary pointer-events-none"
        />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-on-surface block truncate">{u.name}</span>
            <span className="text-[8px] font-bold">
              {u.card_printed ? '🟢 Impreso' : '🔴 Pendiente'}
            </span>
          </div>
          <span className="text-[9px] text-on-surface-variant block mt-0.5 truncate">{u.email} | Rol: {ROLE_LABELS[u.role] || u.role}</span>
        </div>
      </div>
    );
  };

  const renderCard = (user, index) => {
    const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=Sede-${refugioId}-Personal-${user.id}`;
    
    return (
      <div 
        key={user.id}
        className="print-card"
        style={{
          width: '54mm',
          height: '86mm',
          backgroundColor: '#ffffff',
          border: '0.4mm solid #cbd5e1',
          borderRadius: '2mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          breakInside: 'avoid',
          pageBreakInside: 'avoid'
        }}
      >
        {/* Header */}
        <div 
          style={{ backgroundColor: '#0b2347', height: '12mm' }} 
          className="text-white px-2 flex flex-col justify-center text-center shrink-0 border-b border-[#0b2347]"
        >
          <span style={{ fontSize: '5.5pt', lineHeight: '1.1' }} className="font-black uppercase tracking-wider block">
            {selectedRefugio ? selectedRefugio.name : 'VENEZUELA RENACERÁ'}
          </span>
          <span style={{ fontSize: '4.5pt', letterSpacing: '0.5px' }} className="text-amber-400 block uppercase font-black tracking-widest mt-0.5">
            PERSONAL DE APOYO Y COORDINACIÓN
          </span>
        </div>

        {/* Logo and QR Row */}
        <div style={{ height: '24mm' }} className="flex justify-between px-2 items-center">
          <div style={{ width: '18mm', height: '18mm' }} className="border border-gray-150 rounded-md overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#0b2347] text-4xl">support_agent</span>
          </div>
          
          <div style={{ width: '18mm', height: '18mm' }} className="shrink-0 flex items-center justify-center border border-gray-100 p-0.5 rounded">
            <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Middle Details */}
        <div className="px-3 flex-1 flex flex-col justify-center gap-1">
          <div className="text-center">
            <span style={{ fontSize: '8pt', lineHeight: '1.2' }} className="font-extrabold text-[#0b2347] uppercase block tracking-tight truncate">
              {user.name}
            </span>
            <span style={{ fontSize: '6.5pt' }} className="text-on-surface-variant font-medium block truncate mt-0.5">
              {user.email}
            </span>
          </div>

          <div className="mt-1 border-t border-dashed border-outline-variant/60 pt-1.5 flex justify-between text-[6pt]">
            <div>
              <span className="text-on-surface-variant font-bold block">FUNCIÓN</span>
              <span className="font-extrabold text-[#0b2347] uppercase block mt-0.5">
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <div className="text-right">
              <span className="text-on-surface-variant font-bold block">ID PERSONAL</span>
              <span className="font-mono font-extrabold text-on-surface block mt-0.5">
                PERS-{(user.id || 0).toString().padStart(3, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          style={{ backgroundColor: '#0b2347', height: '9mm' }} 
          className="text-white px-3 flex items-center justify-between shrink-0 border-t border-[#0b2347]"
        >
          <div className="flex items-center gap-1">
            <span style={{ fontSize: '5pt' }} className="font-extrabold uppercase text-white tracking-widest">
              Venezuela Renacerá
            </span>
          </div>
          <span style={{ fontSize: '4.5pt' }} className="font-mono text-white/70">
            CREDENCIAL ACTIVA
          </span>
        </div>
      </div>
    );
  };

  const visibleIds = filteredUsers.map(u => u.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const selectedUsers = filteredUsers.filter(u => selectedIds.includes(u.id));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Print stylesheet layout override */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-batch-layout, #print-batch-layout * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #print-batch-layout {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            display: grid !important;
            grid-template-columns: repeat(3, 54mm) !important;
            grid-gap: 5mm 6mm !important;
            justify-content: center !important;
            align-content: start !important;
          }
          .print-card {
            width: 54mm !important;
            height: 86mm !important;
            border: 0.4mm solid #cbd5e1 !important;
            border-radius: 2mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          .print-card:nth-child(9n) {
            page-break-after: always !important;
            break-after: always !important;
          }
        }
      `}} />

      {/* Screen Header */}
      <header className="mb-8 print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-primary">Carnetización del Personal</h2>
          <p className="text-xs text-on-surface-variant font-medium">Genere e imprima credenciales oficiales de identificación para el personal de apoyo, coordinadores y operarios.</p>
        </div>
        <div className="flex gap-3">
          {selectedUsers.length > 0 && (
            <>
              <button 
                onClick={handleMarkAsPrinted}
                disabled={updating}
                className="py-3 px-5 bg-surface border border-outline text-primary font-bold rounded-xl text-xs hover:bg-surface-container flex items-center gap-2 cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {updating ? 'Procesando...' : `Confirmar y Marcar Impresos (${selectedUsers.length})`}
              </button>
              <button 
                onClick={handlePrint}
                className="py-3 px-6 bg-primary text-on-primary font-bold rounded-xl text-xs hover:opacity-95 flex items-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Imprimir Lote ({selectedUsers.length} Carnets)
              </button>
            </>
          )}
        </div>
      </header>

      {/* Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block">
        
        {/* LEFT WORKSPACE: SIDEBAR CONTROLS & CHECKLIST (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6 print:hidden">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            
            {/* Filter Tabs */}
            <div className="flex border-b border-outline-variant/30">
              <button 
                onClick={() => setPrintFilter('pending')}
                className={`flex-1 pb-2.5 text-[10px] uppercase tracking-wider font-extrabold text-center border-b-2 transition-all ${printFilter === 'pending' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
              >
                Pendientes
              </button>
              <button 
                onClick={() => setPrintFilter('printed')}
                className={`flex-1 pb-2.5 text-[10px] uppercase tracking-wider font-extrabold text-center border-b-2 transition-all ${printFilter === 'printed' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
              >
                Impresos
              </button>
              <button 
                onClick={() => setPrintFilter('all')}
                className={`flex-1 pb-2.5 text-[10px] uppercase tracking-wider font-extrabold text-center border-b-2 transition-all ${printFilter === 'all' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
              >
                Todos
              </button>
            </div>

            {/* Role Filter */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-on-surface-variant text-xs">Rol del Personal:</span>
                <span className="text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full font-bold">
                  {getRoleCount(roleFilter)} registros
                </span>
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-bold"
              >
                <option value="all">-- Todos los Roles --</option>
                {ROLE_OPTIONS.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-on-surface-variant">Agrupar / Ordenar:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-surface-container border border-outline-variant rounded-lg p-1.5 text-xs text-on-surface focus:outline-none font-bold"
              >
                <option value="role">Por Rol / Función</option>
                <option value="name">Alfabético por Nombre</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full">
              <span className="material-symbols-outlined text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 text-sm">search</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar personal..." 
                className="w-full bg-surface-container border border-outline-variant rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none"
              />
            </div>

            {/* Selection Info */}
            <div className="flex justify-between items-center py-2 border-b border-outline-variant/30 text-xs">
              <label className="flex items-center gap-2 font-bold text-on-surface cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={allVisibleSelected}
                  onChange={handleToggleAll}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                Seleccionar Todos
              </label>
              <span className="text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full font-bold">
                {selectedUsers.length} de {filteredUsers.length}
              </span>
            </div>

            {/* Checklist */}
            {loading ? (
              <p className="text-xs text-center py-8 text-on-surface-variant">Cargando...</p>
            ) : filteredUsers.length > 0 ? (
              <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                {sortBy === 'role' ? (
                  Object.entries(getGroupedUsers()).map(([groupName, groupUsers]) => (
                    <div key={groupName} className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-black text-primary/80 uppercase tracking-widest px-1 block mt-2 border-b border-outline-variant pb-1">
                        {groupName}
                      </span>
                      {groupUsers.map(u => renderUserCheckItem(u))}
                    </div>
                  ))
                ) : (
                  filteredUsers.map(u => renderUserCheckItem(u))
                )}
              </div>
            ) : (
              <p className="text-xs text-center py-8 text-on-surface-variant">No se encontraron registros.</p>
            )}

          </div>
        </div>

        {/* RIGHT WORKSPACE: LIVE PRINT PREVIEW AREA (8 Cols) */}
        <div className="lg:col-span-8 print:block">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs min-h-[460px]">
            <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-wider mb-6 print:hidden">
              Vista Previa de Credenciales
            </h3>
            
            {selectedUsers.length > 0 ? (
              <div id="print-batch-layout" className="flex flex-wrap gap-6 justify-center bg-surface-container-low border border-outline-variant rounded-2xl p-6 print:p-0 print:border-none print:bg-transparent">
                {selectedUsers.map((user, idx) => renderCard(user, idx))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center print:hidden">
                <span className="material-symbols-outlined text-[#0b2347] text-5xl mb-4">badge</span>
                <p className="text-xs font-extrabold text-on-surface-variant">No hay credenciales seleccionadas para previsualizar</p>
                <p className="text-[10px] text-on-surface-variant mt-1.5 max-w-xs">Use la lista de la izquierda para seleccionar al personal de apoyo que desea imprimir.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
