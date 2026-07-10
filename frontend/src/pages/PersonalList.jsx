import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

const DEFAULT_STAFF_FUNCTIONS = [
  'Personal Médico',
  'Personal de Seguridad',
  'Personal Cocina',
  'Personal Almacén',
  'Personal Registro',
  'Apoyo Social',
  'Coordinación',
  'Logística',
  'Voluntariado'
];

export default function PersonalList({ token }) {
  const { refugioId } = useParams();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', document_id: '', staff_function: '', photo: '' });
  const [newFunctionName, setNewFunctionName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el personal.');
      const activeStaff = data.filter(u =>
        u.refugio_id?.toString() === refugioId?.toString() &&
        !['admin', 'supervisor'].includes(u.role) &&
        u.is_active !== false
      );
      setStaff(activeStaff);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, refugioId, token]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const functionOptions = useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_STAFF_FUNCTIONS,
      ...staff.map(u => u.staff_function).filter(Boolean),
      formData.staff_function
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [staff, formData.staff_function]);

  const filteredStaff = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return staff;
    return staff.filter(u => {
      const name = (u.name || '').toLowerCase();
      const doc = (u.document_id || '').toLowerCase();
      const func = (u.staff_function || u.role || '').toLowerCase();
      return name.includes(cleanQuery) || doc.includes(cleanQuery) || func.includes(cleanQuery);
    });
  }, [staff, query]);

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      document_id: user.document_id || '',
      staff_function: user.staff_function || 'Apoyo Social',
      photo: user.photo || ''
    });
    setNewFunctionName('');
    setMessage('');
    setError('');
  };

  const closeEdit = () => {
    setEditingUser(null);
    setFormData({ name: '', document_id: '', staff_function: '', photo: '' });
    setNewFunctionName('');
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFormData(prev => ({ ...prev, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleAddFunction = () => {
    const clean = newFunctionName.trim();
    if (!clean) return;
    setFormData(prev => ({ ...prev, staff_function: clean }));
    setNewFunctionName('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const cleanDocument = formData.document_id.trim();
      const fallbackEmail = cleanDocument
        ? `personal.${cleanDocument.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.${editingUser.id}@campamento.local`
        : editingUser.email;
      const res = await fetch(`${API_BASE}/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: editingUser.email || fallbackEmail,
          password: '',
          role: editingUser.role || 'apoyo',
          refugio_id: parseInt(refugioId),
          document_id: cleanDocument,
          staff_function: formData.staff_function.trim(),
          photo: formData.photo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el personal.');
      setMessage('Personal actualizado correctamente.');
      closeEdit();
      await fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (user) => {
    const confirmed = window.confirm(`¿Desactivar a ${user.name}? La baja será lógica y se conservarán sus registros históricos.`);
    if (!confirmed) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo desactivar el personal.');
      setMessage('Personal desactivado correctamente. Sus registros históricos se conservan.');
      await fetchStaff();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-primary">Listado de Personal</h2>
          <p className="text-xs text-on-surface-variant font-medium">Busque, edite o desactive personal activo de la sede sin perder trazabilidad histórica.</p>
        </div>
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre, cédula o función..."
            className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          />
        </div>
      </header>

      {message && (
        <div className="mb-5 bg-success/15 border border-success/35 text-success p-3 rounded-xl text-xs font-semibold">{message}</div>
      )}
      {error && (
        <div className="mb-5 bg-error-container/20 border border-error/25 text-error p-3 rounded-xl text-xs font-semibold">{error}</div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant font-black uppercase tracking-wider">
                <th className="py-3 px-4">Personal</th>
                <th className="py-3 px-4">Cédula</th>
                <th className="py-3 px-4">Función</th>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="py-12 text-center text-on-surface-variant italic">Cargando personal...</td></tr>
              ) : filteredStaff.length > 0 ? (
                filteredStaff.map(user => (
                  <tr key={user.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-surface-container border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
                          {user.photo ? (
                            <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-primary">badge</span>
                          )}
                        </div>
                        <div>
                          <span className="font-black text-on-surface block">{user.name}</span>
                          <span className="text-[10px] text-on-surface-variant font-mono">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-on-surface-variant">{user.document_id || 'Sin cédula'}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-black text-[10px] uppercase">{user.staff_function || user.role}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-on-surface-variant">PERS-{String(user.id).padStart(3, '0')}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-full text-primary hover:bg-primary-container/20"
                          title="Editar personal"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(user)}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-full text-error hover:bg-error-container/20"
                          title="Desactivar personal"
                        >
                          <span className="material-symbols-outlined text-base">person_off</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="py-12 text-center text-on-surface-variant italic">No se encontró personal activo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface rounded-2xl border border-outline-variant shadow-lg overflow-hidden">
            <div className="p-5 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-primary">Editar Personal</h3>
                <p className="text-[10px] text-on-surface-variant mt-1">Actualice los datos usados en la credencial.</p>
              </div>
              <button type="button" onClick={closeEdit} className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label className="w-24 h-24 shrink-0 rounded-xl border border-dashed border-outline-variant bg-surface-container-low flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors">
                  {formData.photo ? (
                    <img src={formData.photo} alt="Foto del personal" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-3xl">photo_camera</span>
                  )}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
                <div>
                  <span className="text-xs font-black text-on-surface block">Foto</span>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, photo: '' }))} className="mt-2 text-[10px] font-bold text-error hover:underline">
                    Quitar foto
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Nombre Completo</label>
                <input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium" required />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Cédula</label>
                <input value={formData.document_id} onChange={e => setFormData(prev => ({ ...prev, document_id: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium" required />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Función / Rol en el Campamento</label>
                <select value={formData.staff_function} onChange={e => setFormData(prev => ({ ...prev, staff_function: e.target.value }))} className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium" required>
                  {functionOptions.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                </select>
                <div className="flex gap-2 mt-2">
                  <input value={newFunctionName} onChange={e => setNewFunctionName(e.target.value)} placeholder="Crear función nueva" className="min-w-0 flex-1 bg-surface-container-low border border-outline-variant rounded-lg p-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary font-medium" />
                  <button type="button" onClick={handleAddFunction} className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-primary font-black text-[10px] hover:bg-surface-container">Añadir</button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeEdit} className="px-4 py-2.5 bg-surface border border-outline-variant text-on-surface font-bold rounded-lg text-xs">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
