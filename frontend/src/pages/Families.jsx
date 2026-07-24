import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function Families({ token }) {
  const { refugioId } = useParams();
  const navigate = useNavigate();
  const [families, setFamilies] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showExistingResidentLink, setShowExistingResidentLink] = useState(false);
  const [residentSearch, setResidentSearch] = useState('');
  const [residentResults, setResidentResults] = useState([]);
  const [searchingResidents, setSearchingResidents] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('Esposa/o o pareja');
  const [linkingResident, setLinkingResident] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState({ type: '', text: '' });

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchFamilies = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/family-groups?refugio_id=${refugioId}`, { headers: authHeaders });
      if (!response.ok) throw new Error('No se pudo obtener el listado de familias.');
      setFamilies(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFamilies(); }, [refugioId]);

  const filteredFamilies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return families;
    return families.filter(family => family.family_name.toLowerCase().includes(query));
  }, [families, search]);

  const openFamily = async (family) => {
    setSelectedFamily(family);
    setEditingName(family.family_name);
    setMembers([]);
    setMergeTargetId('');
    setError('');
    setShowExistingResidentLink(false);
    setResidentSearch('');
    setResidentResults([]);
    setSelectedResidentId('');
    setLinkRelationship('Esposa/o o pareja');
    setLinkFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/damnificados?family_group_id=${family.id}&refugio_id=${refugioId}`, { headers: authHeaders });
      if (!response.ok) throw new Error('No se pudieron cargar los integrantes de la familia.');
      setMembers(await response.json());
    } catch (err) {
      setError(err.message);
    }
  };

  const saveFamily = async () => {
    if (!editingName.trim()) {
      setError('El nombre de la familia no puede quedar vacío.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/family-groups/${selectedFamily.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_name: editingName.trim(), block_assignment: selectedFamily.block_assignment })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo actualizar la familia.');
      }
      const updated = await response.json();
      setSelectedFamily({ ...selectedFamily, ...updated });
      setMessage('Datos de la familia actualizados correctamente.');
      await fetchFamilies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getMetadata = (resident) => {
    try { return JSON.parse(resident.special_needs || '{}'); } catch { return {}; }
  };

  const addMemberToSelectedFamily = () => {
    if (!selectedFamily?.id) return;
    navigate(`/refugio/${refugioId}/registro?family_group_id=${selectedFamily.id}`);
  };

  const searchExistingResidents = async (event) => {
    event.preventDefault();
    const query = residentSearch.trim();
    if (query.length < 2) {
      setLinkFeedback({ type: 'error', text: 'Ingrese al menos 2 caracteres del nombre o la cédula.' });
      return;
    }

    setSearchingResidents(true);
    setSelectedResidentId('');
    setLinkFeedback({ type: '', text: '' });
    try {
      const params = new URLSearchParams({ refugio_id: refugioId, search: query });
      const response = await fetch(`${API_BASE}/damnificados?${params.toString()}`, { headers: authHeaders });
      if (!response.ok) throw new Error('No se pudo buscar residentes.');
      const data = await response.json();
      const results = data
        .filter(resident => String(resident.status || 'Activo').trim().toLowerCase() === 'activo' && resident.family_group_id !== selectedFamily.id)
        .slice(0, 20);
      setResidentResults(results);
      if (results.length === 0) {
        setLinkFeedback({ type: 'info', text: 'No se encontraron residentes activos con ese nombre o cédula.' });
      }
    } catch (err) {
      setLinkFeedback({ type: 'error', text: err.message });
    } finally {
      setSearchingResidents(false);
    }
  };

  const loadUnassignedMinors = async () => {
    setSearchingResidents(true);
    setSelectedResidentId('');
    setResidentSearch('');
    setLinkFeedback({ type: '', text: '' });
    try {
      const params = new URLSearchParams({ refugio_id: refugioId, minors_without_document: 'true' });
      const response = await fetch(`${API_BASE}/damnificados?${params.toString()}`, { headers: authHeaders });
      if (!response.ok) throw new Error('No se pudieron cargar los menores sin cédula.');
      const data = await response.json();
      setResidentResults(data.slice(0, 50));
      if (data.length === 0) {
        setLinkFeedback({ type: 'info', text: 'No hay menores sin cédula pendientes de vincular en esta sede.' });
      }
    } catch (err) {
      setLinkFeedback({ type: 'error', text: err.message });
    } finally {
      setSearchingResidents(false);
    }
  };

  const linkExistingResident = async () => {
    const resident = residentResults.find(item => String(item.id) === String(selectedResidentId));
    if (!resident) {
      setLinkFeedback({ type: 'error', text: 'Seleccione un residente sin grupo familiar.' });
      return;
    }
    if (resident.family_group_id) {
      setLinkFeedback({ type: 'error', text: 'Este residente ya pertenece a otra familia y no puede moverse desde este procedimiento.' });
      return;
    }
    if (!window.confirm(`¿Vincular a ${resident.first_name} ${resident.last_name} con "${selectedFamily.family_name}" como ${linkRelationship}?`)) return;

    setLinkingResident(true);
    setLinkFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/damnificados/${resident.id}/family`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family_group_id: selectedFamily.id,
          refugio_id: parseInt(refugioId),
          parentesco: linkRelationship
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo vincular el residente.');

      setMembers(current => [...current, data]);
      setResidentResults(current => current.filter(item => item.id !== resident.id));
      setSelectedResidentId('');
      setResidentSearch('');
      setLinkFeedback({ type: 'success', text: data.message || 'Residente vinculado correctamente.' });
      await fetchFamilies();
    } catch (err) {
      setLinkFeedback({ type: 'error', text: err.message });
    } finally {
      setLinkingResident(false);
    }
  };

  const familyPets = useMemo(() => members.flatMap(resident => {
    const pet = getMetadata(resident).mascotas;
    if (pet?.tiene_mascotas !== 'Sí') return [];
    return [{
      id: `pet-${resident.id}`,
      name: pet.nombre?.trim() || 'Mascota sin nombre',
      species: pet.especie?.trim() || 'Especie no indicada',
      breed: pet.raza?.trim() || 'Raza no indicada',
      owner: `${resident.first_name} ${resident.last_name}`
    }];
  }), [members]);

  const mergeFamily = async () => {
    if (!mergeTargetId) {
      setError('Seleccione la familia correcta que conservará todos los integrantes.');
      return;
    }
    const target = families.find(family => family.id === parseInt(mergeTargetId));
    if (!target || !window.confirm(`¿Unificar "${selectedFamily.family_name}" dentro de "${target.family_name}"? Los residentes se moverán a la familia seleccionada y el grupo duplicado desaparecerá.`)) return;
    setMerging(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/family-groups/merge`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: selectedFamily.id, target_id: target.id, refugio_id: parseInt(refugioId) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudieron unificar las familias.');
      setSelectedFamily(null);
      setMessage(`Familias unificadas correctamente. Se trasladaron ${data.moved_members} integrantes sin borrar sus fichas.`);
      await fetchFamilies();
    } catch (err) {
      setError(err.message);
    } finally {
      setMerging(false);
    }
  };

  const exportFamilies = async () => {
    setExporting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/family-groups/export?refugio_id=${refugioId}`, { headers: authHeaders });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo generar el reporte Excel.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || 'DATA_UNICA_DE_CAMPAMENTO.xlsx';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Reporte Excel generado correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-primary">Familias Registradas</h2>
          <p className="text-xs text-on-surface-variant">Consulte, corrija y amplíe los núcleos familiares del campamento temporal.</p>
        </div>
        <button type="button" onClick={exportFamilies} disabled={exporting || loading} className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-on-primary border border-primary rounded-lg text-xs font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          <span className="material-symbols-outlined text-base">download</span>
          {exporting ? 'Generando Excel...' : 'Exportar reporte Excel'}
        </button>
      </header>

      {error && <div className="mb-5 p-4 bg-error-container/20 border border-error/25 text-error rounded-xl text-xs font-semibold">{error}</div>}
      {message && <div className="mb-5 p-4 bg-success/10 border border-success/20 text-success rounded-xl text-xs font-semibold">{message}</div>}

      <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl mb-6">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined text-on-surface-variant absolute left-3 top-2.5">search</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar una familia..." className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs text-on-surface-variant">Cargando familias...</div>
      ) : filteredFamilies.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl text-center py-16 text-xs text-on-surface-variant">No se encontraron familias en esta sede.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredFamilies.map(family => (
            <article key={family.id} className={`bg-surface-container-lowest border rounded-2xl p-5 shadow-xs ${family.pets_count > 0 ? 'border-success/50 ring-1 ring-success/10' : 'border-outline-variant'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">family_restroom</span></div>
                  {family.pets_count > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success border border-success/20 rounded-full text-[9px] font-extrabold uppercase tracking-wide">
                      <span className="material-symbols-outlined text-xs">pets</span>
                      Con mascota
                    </span>
                  )}
                </div>
                <span className="px-2 py-1 bg-success/10 text-success rounded-full text-[9px] font-bold">{family.members_count} activos</span>
              </div>
              <h3 className="mt-4 text-sm font-extrabold text-on-surface">{family.family_name}</h3>
              <p className="mt-1 text-[10px] text-on-surface-variant">Total histórico: {family.total_members} personas · {family.pets_count || 0} {(family.pets_count || 0) === 1 ? 'mascota' : 'mascotas'} · Espacio: {family.block_assignment || 'Sin asignar'}</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => openFamily(family)} className="flex-1 px-3 py-2 border border-primary text-primary rounded-lg text-[10px] font-bold">Ver y editar</button>
                <button onClick={() => navigate(`/refugio/${refugioId}/registro?family_group_id=${family.id}`)} className="flex-1 px-3 py-2 bg-primary text-on-primary rounded-lg text-[10px] font-bold">Añadir miembro</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedFamily && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-2xl border border-outline-variant w-full max-w-3xl shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-outline-variant flex justify-between items-start gap-4">
              <div><h3 className="text-lg font-extrabold text-primary">Editar familia</h3><p className="text-[10px] text-on-surface-variant">Puede corregir el nombre, revisar sus integrantes y registrar miembros que lleguen posteriormente.</p></div>
              <button onClick={() => setSelectedFamily(null)} className="p-2 rounded-full hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col md:flex-row gap-3 md:items-end">
                <label className="flex-1 text-[10px] font-bold text-on-surface-variant">Nombre de la familia
                  <input value={editingName} onChange={(event) => setEditingName(event.target.value)} className="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-xs" />
                </label>
                <button disabled={saving} onClick={saveFamily} className="px-4 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-bold disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
              <div>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">Integrantes ({members.length + familyPets.length})</h4>
                    {familyPets.length > 0 && <span className="text-[9px] font-bold text-on-surface-variant">{members.length} personas · {familyPets.length} {familyPets.length === 1 ? 'mascota' : 'mascotas'}</span>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={addMemberToSelectedFamily}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface text-primary border border-primary rounded-lg text-xs font-extrabold hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">person_add</span>
                      Registrar miembro nuevo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExistingResidentLink(current => !current);
                        setLinkFeedback({ type: '', text: '' });
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary border border-primary rounded-lg text-xs font-extrabold shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">person_search</span>
                      Vincular residente existente
                    </button>
                  </div>
                </div>
                {showExistingResidentLink && (
                  <div className="mb-4 p-4 rounded-xl border border-primary/25 bg-primary/5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h5 className="text-xs font-extrabold text-primary">Buscar residente registrado</h5>
                        <p className="text-[10px] text-on-surface-variant mt-1">Busque por nombre completo o número de cédula. La ficha, cama e historial del residente se conservarán.</p>
                      </div>
                      <button type="button" onClick={() => setShowExistingResidentLink(false)} className="p-1 text-on-surface-variant hover:text-on-surface"><span className="material-symbols-outlined text-base">close</span></button>
                    </div>

                    <form onSubmit={searchExistingResidents} className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-base text-on-surface-variant">search</span>
                        <input
                          value={residentSearch}
                          onChange={event => setResidentSearch(event.target.value)}
                          placeholder="Ej. María Pérez o 12345678"
                          className="w-full bg-surface border border-outline-variant rounded-lg pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <button type="submit" disabled={searchingResidents} className="px-4 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-bold disabled:opacity-50">
                        {searchingResidents ? 'Buscando...' : 'Buscar'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={loadUnassignedMinors}
                      disabled={searchingResidents}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 border border-primary text-primary bg-surface rounded-lg text-[10px] font-bold hover:bg-primary/5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">child_care</span>
                      Ver menores sin cédula y sin familia
                    </button>

                    {residentResults.length > 0 && (
                      <div className="mt-3 border border-outline-variant rounded-lg overflow-hidden bg-surface">
                        {residentResults.map(resident => {
                          const unavailable = Boolean(resident.family_group_id);
                          return (
                            <label key={resident.id} className={`p-3 border-b last:border-b-0 border-outline-variant flex items-center gap-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-primary/5'}`}>
                              <input
                                type="radio"
                                name="resident-to-link"
                                value={resident.id}
                                checked={String(selectedResidentId) === String(resident.id)}
                                onChange={event => setSelectedResidentId(event.target.value)}
                                disabled={unavailable}
                                className="accent-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-on-surface truncate">{resident.first_name} {resident.last_name}</p>
                                <p className="text-[10px] text-on-surface-variant">C.I. {resident.document_id || 'N/T'} · {unavailable ? `Pertenece a ${resident.family_name || 'otra familia'}` : 'Sin grupo familiar'}</p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-[9px] font-bold ${unavailable ? 'bg-warning/15 text-warning' : 'bg-success/10 text-success'}`}>
                                {unavailable ? 'No disponible' : 'Disponible'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {selectedResidentId && (
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2">
                        <label className="flex-1 text-[10px] font-bold text-on-surface-variant">Parentesco dentro de esta familia
                          <select value={linkRelationship} onChange={event => setLinkRelationship(event.target.value)} className="mt-1 w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-xs">
                            <option value="Hija/o">Hija/o</option>
                            <option value="Esposa/o o pareja">Esposa/o o pareja</option>
                            <option value="Madre/Padre">Madre/Padre</option>
                            <option value="Hermana/o">Hermana/o</option>
                            <option value="Nieta/o">Nieta/o</option>
                            <option value="Otro familiar">Otro familiar</option>
                          </select>
                        </label>
                        <button type="button" onClick={linkExistingResident} disabled={linkingResident} className="px-4 py-2.5 bg-success text-white rounded-lg text-xs font-extrabold disabled:opacity-50">
                          {linkingResident ? 'Vinculando...' : 'Confirmar vínculo'}
                        </button>
                      </div>
                    )}

                    {linkFeedback.text && (
                      <div className={`mt-3 p-3 rounded-lg text-[10px] font-semibold ${
                        linkFeedback.type === 'error'
                          ? 'bg-error-container/20 text-error border border-error/25'
                          : linkFeedback.type === 'success'
                            ? 'bg-success/10 text-success border border-success/20'
                            : 'bg-surface-container text-on-surface-variant border border-outline-variant'
                      }`}>
                        {linkFeedback.text}
                      </div>
                    )}
                  </div>
                )}
                <div className="border border-outline-variant rounded-xl overflow-hidden">
                  {members.map(resident => {
                    const metadata = getMetadata(resident);
                    return <div key={resident.id} className="p-4 border-b last:border-b-0 border-outline-variant flex items-center justify-between gap-4">
                      <div><p className="text-xs font-bold text-on-surface">{resident.first_name} {resident.last_name}</p><p className="text-[10px] text-on-surface-variant">C.I. {resident.document_id || 'N/T'} · {metadata.es_cabeza_familia ? 'Cabeza de familia' : (metadata.parentesco || 'Familiar')}</p></div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-[9px] font-bold ${resident.status === 'Activo' ? 'bg-success/10 text-success' : 'bg-outline-variant text-on-surface-variant'}`}>{resident.status}</span>
                        <button type="button" onClick={() => navigate(`/refugio/${refugioId}/residentes?edit_resident=${resident.id}`)} className="px-3 py-1.5 border border-primary text-primary rounded-lg text-[10px] font-bold flex items-center gap-1"><span className="material-symbols-outlined text-xs">edit</span>Editar ficha</button>
                      </div>
                    </div>;
                  })}
                  {familyPets.map(pet => (
                    <div key={pet.id} className="p-4 border-b last:border-b-0 border-outline-variant bg-success/5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0"><span className="material-symbols-outlined">pets</span></div>
                        <div>
                          <p className="text-xs font-bold text-on-surface">{pet.name}</p>
                          <p className="text-[10px] text-on-surface-variant">{pet.species} · {pet.breed} · Responsable: {pet.owner}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[9px] font-bold bg-success/10 text-success">Mascota</span>
                    </div>
                  ))}
                  {members.length === 0 && familyPets.length === 0 && <p className="p-6 text-center text-xs text-on-surface-variant">Esta familia no tiene integrantes registrados.</p>}
                </div>
              </div>
              <div className="border border-warning/40 bg-warning/5 rounded-xl p-4">
                <h4 className="text-xs font-extrabold text-on-surface">Corregir familia duplicada</h4>
                <p className="text-[10px] text-on-surface-variant mt-1 mb-3">Seleccione la familia correcta. Todos los integrantes de este grupo se trasladarán allí y este registro duplicado será eliminado.</p>
                <div className="flex flex-col md:flex-row gap-2">
                  <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)} className="flex-1 bg-surface border border-outline-variant rounded-lg p-2.5 text-xs">
                    <option value="">-- Seleccione la familia que se conservará --</option>
                    {families.filter(family => family.id !== selectedFamily.id).map(family => <option key={family.id} value={family.id}>{family.family_name}</option>)}
                  </select>
                  <button type="button" disabled={merging || !mergeTargetId} onClick={mergeFamily} className="px-4 py-2.5 bg-warning text-on-surface rounded-lg text-xs font-bold disabled:opacity-50">{merging ? 'Unificando...' : 'Unificar familias'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
