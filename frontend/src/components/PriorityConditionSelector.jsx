import React from 'react';

export const PRIORITY_CONDITIONS = [
  'Niño, Niña o Adolescente (NNA) no acompañado',
  'NNA separado bajo cuidado de familiar lejano, vecino u otra persona',
  'NNA sin documento o con documento perdido/dañado',
  'Adulto mayor solo, sin cuidador o en abandono evidente',
  'Persona con discapacidad o movilidad reducida',
  'Embarazo o lactancia',
  'Persona con enfermedad crónica o tratamiento permanente',
  'Riesgo de protección / violencia / situación familiar sensible'
];

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export default function PriorityConditionSelector({ value, onChange, label = 'Condición prioritaria' }) {
  const rawValue = String(value || '');
  const selected = PRIORITY_CONDITIONS.filter(option => normalize(rawValue).includes(normalize(option)));
  const parts = rawValue.split(' | ').map(item => item.trim()).filter(Boolean);
  const other = parts.filter(part => !PRIORITY_CONDITIONS.some(option => normalize(part) === normalize(option))).join(' | ');

  const commit = (nextSelected, nextOther = other) => {
    onChange([...nextSelected, nextOther.trim()].filter(Boolean).join(' | '));
  };

  const toggle = option => {
    commit(selected.includes(option)
      ? selected.filter(item => item !== option)
      : [...selected, option]);
  };

  return (
    <fieldset className="rounded-xl border border-outline-variant bg-surface-container-low/40 p-3">
      <legend className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-primary">{label}</legend>
      <p className="mb-3 text-[10px] leading-relaxed text-on-surface-variant">
        Marque todas las condiciones que correspondan. Estas mismas opciones aparecerán en la planilla.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRIORITY_CONDITIONS.map(option => (
          <label key={option} className="flex items-start gap-2 rounded-lg border border-outline-variant/70 bg-surface px-3 py-2 text-[10px] font-semibold text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
              className="mt-0.5 accent-primary"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <label className="mt-3 block text-[10px] font-bold text-on-surface-variant">
        Otra condición u observación
        <input
          value={other}
          onChange={event => commit(selected, event.target.value)}
          placeholder="Especifique únicamente si no aparece entre las opciones"
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>
    </fieldset>
  );
}
