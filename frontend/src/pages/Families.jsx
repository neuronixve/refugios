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
        <button type="button" onClick={exportFamilies} disabled={exporting || loading} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-success text-white rounded-lg text-xs font-bold disabled:opacity-50">
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
            <article key={family.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">family_restroom</span></div>
                <span className="px-2 py-1 bg-success/10 text-success rounded-full text-[9px] font-bold">{family.members_count} activos</span>
              </div>
              <h3 className="mt-4 text-sm font-extrabold text-on-surface">{family.family_name}</h3>
              <p className="mt-1 text-[10px] text-on-surface-variant">Total histórico: {family.total_members} · Espacio: {family.block_assignment || 'Sin asignar'}</p>
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
              <div><h3 className="text-lg font-extrabold text-primary">Editar familia</h3><p className="text-[10px] text-on-surface-variant">Puede corregir el nombre y revisar todos sus integrantes.</p></div>
              <button onClick={() => setSelectedFamily(null)} className="p-2 rounded-full hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col md:flex-row gap-3 md:items-end">
                <label className="flex-1 text-[10px] font-bold text-on-surface-variant">Nombre de la familia
                  <input value={editingName} onChange={(event) => setEditingName(event.target.value)} className="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-xs" />
                </label>
                <button disabled={saving} onClick={saveFamily} className="px-4 py-2.5 bg-primary text-on-primary rounded-lg text-xs font-bold disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
                <button onClick={() => navigate(`/refugio/${refugioId}/registro?family_group_id=${selectedFamily.id}`)} className="px-4 py-2.5 bg-success text-white rounded-lg text-xs font-bold">Añadir miembro</button>
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-on-surface-variant mb-3">Integrantes ({members.length})</h4>
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
                  {members.length === 0 && <p className="p-6 text-center text-xs text-on-surface-variant">Esta familia no tiene integrantes registrados.</p>}
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
