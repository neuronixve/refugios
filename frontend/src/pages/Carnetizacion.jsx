import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function Carnetizacion({ token, selectedRefugio }) {
  const { refugioId } = useParams();
  
  const [residents, setResidents] = useState([]);
  const [beds, setBeds] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Selection & Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [printFilter, setPrintFilter] = useState('pending'); // 'pending', 'printed', 'all'
  const [sortBy, setSortBy] = useState('sector'); // 'sector', 'name'

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://refugios.venexporta.com.ve/api';

  useEffect(() => {
    fetchData();
  }, [refugioId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch residents
      const resRes = await fetch(`${API_BASE}/damnificados?refugio_id=${refugioId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resRes.ok) {
        const data = await resRes.json();
        const activeOnly = data.filter(r => r.status === 'Activo');
        setResidents(activeOnly);
        
        // Auto-select pending ones by default
        const pending = activeOnly.filter(r => {
          try {
            const meta = r.special_needs ? JSON.parse(r.special_needs) : {};
            return !meta.card_printed;
          } catch {
            return true;
          }
        });
        setSelectedIds(pending.map(r => r.id));
      }

      // Fetch beds
      const resBeds = await fetch(`${API_BASE}/refugios/${refugioId}/beds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resBeds.ok) {
        setBeds(await resBeds.json());
      }

      // Fetch family groups
      const resFam = await fetch(`${API_BASE}/family-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resFam.ok) {
        setFamilies(await resFam.json());
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Metadata parsing helper (using function hoisting to prevent TDZ ReferenceErrors)
  function getMetadata(resident) {
    if (!resident || !resident.special_needs) return {};
    try {
      return JSON.parse(resident.special_needs);
    } catch {
      return {};
    }
  }

  // Get bed assignment details
  function getSector(residentId) {
    const bed = beds.find(b => b.resident_id === residentId);
    return bed ? bed.room_number : 'Sin Sector';
  }

  function getBedNumberShort(residentId) {
    const bed = beds.find(b => b.resident_id === residentId);
    if (!bed || !bed.bed_number) return 'S/C';
    const num = bed.bed_number.toString();
    return num.split(' ')[1] || num;
  }

  function getFamilyNameShort(resident) {
    if (!resident || !resident.family_group_id) return 'Sin Grupo';
    const fam = families.find(f => f.id === resident.family_group_id);
    if (!fam || !fam.family_name) return 'Sin Grupo';
    const name = fam.family_name.toString();
    return name.split(' ')[2] || name.split(' (')[0] || 'Grupo';
  }

  function getRefugioAbbreviation(refugioName) {
    if (!refugioName) return 'REF';
    const clean = refugioName.toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9 ]/g, '');
    const words = clean.split(' ').filter(w => w.length > 0 && w !== 'REFUGIO');
    if (words.length >= 2) {
      return (words[0].substring(0, 3) + words[1].substring(0, 3)).substring(0, 6);
    } else if (words.length === 1) {
      return words[0].substring(0, 4);
    }
    return clean.replace(/\s+/g, '').substring(0, 4) || 'REF';
  }

  function getFamilyCount(resident) {
    if (!resident || !resident.family_group_id) return 1;
    const count = residents.filter(r => r.family_group_id === resident.family_group_id).length;
    return count > 0 ? count : 1;
  }

  // Toggle selection
  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Select all or none
  const handleToggleAll = () => {
    if (selectedIds.length === filteredResidents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredResidents.map(r => r.id));
    }
  };

  // Search, print-state filtering, and sorting
  const filteredResidents = residents
    .filter(r => {
      const meta = getMetadata(r);
      const isPrinted = !!meta.card_printed;
      if (printFilter === 'pending') return !isPrinted;
      if (printFilter === 'printed') return isPrinted;
      return true;
    })
    .filter(r => {
      const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
      const doc = (r.document_id || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return !q || fullName.includes(q) || doc.includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'sector') {
        const sectorA = getSector(a.id);
        const sectorB = getSector(b.id);
        return sectorA.localeCompare(sectorB);
      } else {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB);
      }
    });

  // Bulk mark selected as printed
  const handleMarkAsPrinted = async () => {
    if (selectedIds.length === 0) return;
    setUpdating(true);
    try {
      for (const id of selectedIds) {
        const resident = residents.find(r => r.id === id);
        if (!resident) continue;
        const meta = getMetadata(resident);
        const updatedMeta = {
          ...meta,
          card_printed: true
        };
        await fetch(`${API_BASE}/damnificados/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            special_needs: JSON.stringify(updatedMeta),
            status: resident.status // Preserve active status
          })
        });
      }
      // Re-fetch data to update filters
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  // Helpers declared and hoisted above

  // Trigger browser print window
  const handlePrint = () => {
    window.print();
  };

  // Render a single CR80 credential card
  const renderCard = (resident, index) => {
    const meta = getMetadata(resident);
    const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=Sede-${refugioId}-Residente-${resident.id}`;
    
    // Pathologies list generator
    const list = [...(meta.preexisting || [])];
    if (meta.diabetes) list.push('Diabetes');
    if (meta.hypertension) list.push('Hipertensión');
    if (meta.asthma) list.push('Asma');
    if (meta.epoc) list.push('EPOC');
    if (meta.cardiovascular) list.push('Cardiovascular');
    if (meta.renal) list.push('Renal');
    if (meta.tuberculosis) list.push('Tuberculosis');
    if (meta.escabiosis) list.push('Sarna/Escabiosis');
    if (meta.gastrointestinal) list.push('Gastrointestinal');
    if (meta.epilepsia) list.push('Epilepsia');
    if (meta.psiquiatrico) list.push('Psiquiátrico');
    if (meta.inmunocomprometido) list.push('Inmunodeficiencia');
    if (meta.endemica) list.push('Endémica');

    const uniquePathologies = [...new Set(list)];
    const allergiesList = meta.allergies || [];
    const allMedicalRisk = [...uniquePathologies, ...allergiesList];
    const hasAlert = allMedicalRisk.length > 0;
    
    const alertColor = hasAlert ? '#d32f2f' : '#388e3c';
    const alertText = hasAlert 
      ? `Alerta: ${allMedicalRisk.slice(0, 3).join(', ')}`
      : 'Estable / Sin Patologías';

    return (
      <div 
        key={resident.id}
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
        {/* Header - Navy blue */}
        <div 
          style={{ backgroundColor: '#0b2347', height: '11mm' }} 
          className="text-white px-2 flex flex-col justify-center text-center shrink-0 border-b border-[#0b2347]"
        >
          <span style={{ fontSize: '5.5pt', lineHeight: '1.1' }} className="font-black uppercase tracking-wider block">
            {selectedRefugio ? selectedRefugio.name : 'REFUGIO VALENCIA'}
          </span>
          <span style={{ fontSize: '4.5pt', letterSpacing: '0.5px' }} className="text-white/80 block uppercase font-bold tracking-widest mt-0.5">
            IDENTIFICACIÓN OFICIAL • Nro. {index + 1}
          </span>
        </div>

        {/* Side-by-Side Area */}
        <div style={{ height: '22mm' }} className="flex justify-between px-2 items-center">
          {/* Photo */}
          <div style={{ width: '18mm', height: '18mm' }} className="border border-gray-200 rounded-md overflow-hidden bg-surface flex items-center justify-center shrink-0">
            {meta.photo ? (
              <img src={meta.photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-base text-on-surface-variant">person</span>
            )}
          </div>

          {/* QR Code */}
          <div style={{ width: '18mm', height: '18mm' }} className="border border-gray-200 p-0.5 rounded-md bg-white flex items-center justify-center shrink-0">
            <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Resident identity details */}
        <div className="text-center px-1 flex flex-col gap-0.5">
          <span style={{ fontSize: '7.5pt', lineHeight: '1.1' }} className="font-black text-on-surface uppercase block truncate">
            {resident.first_name} {resident.last_name}
          </span>
          <div style={{ fontSize: '5.5pt' }} className="font-bold text-on-surface-variant flex justify-center gap-1.5 leading-none mt-0.5">
            <span>C.I. {resident.document_id || 'N/T'}</span>
            <span>•</span>
            <span>Sangre: {meta.sangre || 'N/R'}</span>
          </div>
          <span style={{ fontSize: '5pt' }} className="text-primary font-bold block mt-0.5">
            Código: {getRefugioAbbreviation(selectedRefugio ? selectedRefugio.name : '')}-{getFamilyCount(resident)}-{resident.id}
          </span>
        </div>

        {/* Medical Alert Strip */}
        <div 
          style={{ backgroundColor: alertColor, height: '4mm' }} 
          className="text-white text-center flex items-center justify-center px-1 shrink-0 w-full"
        >
          <span style={{ fontSize: '5.5pt' }} className="font-black uppercase tracking-wider truncate block w-full">
            {alertText}
          </span>
        </div>

        {/* Location Grid */}
        <div style={{ height: '10mm' }} className="px-2 border-t border-outline-variant/30 flex items-center justify-between">
          <div className="flex-1 text-center border-r border-outline-variant/30 pr-0.5">
            <span style={{ fontSize: '4.5pt' }} className="uppercase font-bold text-on-surface-variant block leading-none">Sector</span>
            <span style={{ fontSize: '6.5pt' }} className="font-extrabold text-primary block leading-none mt-0.5 truncate">{getSector(resident.id)}</span>
          </div>
          <div className="flex-1 text-center border-r border-outline-variant/30 px-0.5">
            <span style={{ fontSize: '4.5pt' }} className="uppercase font-bold text-on-surface-variant block leading-none">Grupo</span>
            <span style={{ fontSize: '6.5pt' }} className="font-extrabold text-primary block leading-none mt-0.5 truncate">{getFamilyNameShort(resident)}</span>
          </div>
          <div className="flex-1 text-center pl-0.5">
            <span style={{ fontSize: '4.5pt' }} className="uppercase font-bold text-on-surface-variant block leading-none">Cama</span>
            <span style={{ fontSize: '6.5pt' }} className="font-extrabold text-primary block leading-none mt-0.5 truncate">{getBedNumberShort(resident.id)}</span>
          </div>
        </div>

      </div>
    );
  };

  const selectedResidents = residents.filter(r => selectedIds.includes(r.id));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Absolute CSS Page Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide all general UI components */
          body * {
            visibility: hidden;
          }
          
          /* Only display print batch container */
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

          /* Force backgrounds and border colors to remain intact */
          .print-card {
            width: 54mm !important;
            height: 86mm !important;
            border: 0.4mm solid #cbd5e1 !important;
            border-radius: 2mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          
          /* Auto page-break after 9 cards (3x3 grid) */
          .print-card:nth-child(9n) {
            page-break-after: always !important;
            break-after: always !important;
          }
        }
      `}} />

      {/* Header */}
      <header className="mb-8 print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-primary">Estación de Impresión por Lotes</h2>
          <p className="text-xs text-on-surface-variant">Generación masiva de credenciales oficiales en tamaño CR80 estándar (54mm x 86mm).</p>
        </div>
        <div className="flex gap-3">
          {selectedResidents.length > 0 && (
            <>
              <button 
                onClick={handleMarkAsPrinted}
                disabled={updating}
                className="py-3 px-5 bg-surface border border-outline text-primary font-bold rounded-xl text-xs hover:bg-surface-container flex items-center gap-2 cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {updating ? 'Procesando...' : `Confirmar y Marcar Impresos (${selectedResidents.length})`}
              </button>
              <button 
                onClick={handlePrint}
                className="py-3 px-6 bg-primary text-on-primary font-bold rounded-xl text-xs hover:opacity-95 flex items-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Imprimir Lote ({selectedResidents.length} Carnets)
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block">
        
        {/* LEFT WORKSPACE: RESIDENT CHECKLIST & SEARCH (4 Cols) */}
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

            {/* Sort Dropdown */}
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-on-surface-variant">Agrupar / Ordenar:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-surface-container border border-outline-variant rounded-lg p-1.5 text-xs text-on-surface focus:outline-none font-bold"
              >
                <option value="sector">Por Sector (Habitación)</option>
                <option value="name">Alfabético por Nombre</option>
              </select>
            </div>
            
            {/* Search */}
            <div className="relative w-full">
              <span className="material-symbols-outlined text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 text-sm">search</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar residente..." 
                className="w-full bg-surface-container border border-outline-variant rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none"
              />
            </div>

            {/* Selection Controls */}
            <div className="flex justify-between items-center py-2 border-b border-outline-variant/30 text-xs">
              <label className="flex items-center gap-2 font-bold text-on-surface cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filteredResidents.length > 0 && selectedIds.length === filteredResidents.length}
                  onChange={handleToggleAll}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                Seleccionar Todos
              </label>
              <span className="text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full font-bold">
                {selectedResidents.length} de {filteredResidents.length}
              </span>
            </div>

            {/* Checklist Box */}
            {loading ? (
              <p className="text-xs text-center py-8 text-on-surface-variant">Cargando...</p>
            ) : filteredResidents.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredResidents.map(r => {
                  const isPrinted = !!getMetadata(r).card_printed;
                  return (
                    <div 
                      key={r.id}
                      onClick={() => handleToggleSelect(r.id)}
                      className={`p-3 border rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:bg-surface-container ${selectedIds.includes(r.id) ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/30 bg-surface-container-lowest'}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(r.id)}
                        onChange={() => {}} // Handled by parent div
                        className="w-3.5 h-3.5 rounded text-primary focus:ring-primary pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-on-surface block truncate">{r.first_name} {r.last_name}</span>
                          <span className="text-[8px] font-bold">
                            {isPrinted ? '🟢 Impreso' : '🔴 Pendiente'}
                          </span>
                        </div>
                        <span className="text-[9px] text-on-surface-variant block mt-0.5">C.I. {r.document_id || 'N/T'} | Sector: {getSector(r.id)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs italic py-8 text-center text-on-surface-variant">No se encontraron residentes en esta categoría.</p>
            )}
          </div>

          {/* Guidelines Box */}
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex gap-3 text-[10px] text-on-surface-variant leading-relaxed">
            <span className="material-symbols-outlined text-primary text-sm">print</span>
            <p><strong>Configuración de Impresión:</strong> Para lograr las dimensiones exactas (5.4cm x 8.6cm), en el diálogo de impresión configure la escala a <strong>"100%" (o "Sin Margen")</strong> y active la opción <strong>"Imprimir gráficos de fondo"</strong>.</p>
          </div>
        </div>

        {/* RIGHT WORKSPACE: LIVE SHEET PREVIEW GRID (8 Cols) */}
        <div className="lg:col-span-8 bg-surface-container-low border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4 print:p-0 print:border-none print:bg-transparent">
          <div className="flex justify-between items-center print:hidden border-b border-outline-variant/30 pb-3">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">view_grid</span>
              Previsualización de Plancha de Impresión (3 Columnas)
            </h3>
            <span className="text-[10px] text-on-surface-variant font-bold">Distribución: 9 Carnets por Hoja</span>
          </div>

          {/* The printable grid of cards */}
          {selectedResidents.length > 0 ? (
            <div 
              id="print-batch-layout"
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4 justify-items-center items-start overflow-y-auto max-h-[640px] p-2 print:overflow-visible print:max-h-none"
            >
              {selectedResidents.map((r, index) => renderCard(r, index))}
            </div>
          ) : (
            <div className="border border-dashed border-outline-variant p-16 rounded-2xl text-center text-on-surface-variant flex flex-col items-center gap-3 print:hidden my-8">
              <span className="material-symbols-outlined text-4xl text-primary">badge</span>
              <div>
                <h4 className="text-xs font-bold text-on-surface">No hay carnets seleccionados</h4>
                <p className="text-[10px] text-on-surface-variant mt-1">Marca los checkboxes de los residentes a la izquierda para armar la plancha de impresión.</p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
