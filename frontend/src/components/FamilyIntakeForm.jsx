import React from 'react';
import { normalizeFamilyIntake } from '../utils/familyIntakeData';
import { PRIORITY_CONDITIONS } from './PriorityConditionSelector';

const inputClass = 'mt-1 w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20';

function Field({ label, value, onChange, type = 'text', placeholder = '', span = '' }) {
  return (
    <label className={`text-[10px] font-bold text-on-surface-variant ${span}`}>
      {label}
      <input type={type} value={value || ''} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder = '', span = 'md:col-span-2' }) {
  return (
    <label className={`text-[10px] font-bold text-on-surface-variant ${span}`}>
      {label}
      <textarea value={value || ''} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={`${inputClass} min-h-20 resize-y`} />
    </label>
  );
}

function Select({ label, value, onChange, options, span = '' }) {
  const hasLegacyValue = Boolean(value) && !options.includes(value);
  return (
    <label className={`text-[10px] font-bold text-on-surface-variant ${span}`}>
      {label}
      <select value={value || ''} onChange={event => onChange(event.target.value)} className={inputClass}>
        {!value && <option value="">Seleccione una opción</option>}
        {hasLegacyValue && <option value={value}>{value} (registrado previamente)</option>}
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function CheckGroup({ label, values, options, onChange, span = 'md:col-span-2' }) {
  const selected = Array.isArray(values) ? values : [];
  const toggle = option => onChange(
    selected.includes(option) ? selected.filter(item => item !== option) : [...selected, option]
  );
  return (
    <fieldset className={`rounded-xl border border-outline-variant bg-surface-container-low/40 p-3 ${span}`}>
      <legend className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-primary">{label}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
        {options.map(option => (
          <label key={option} className="flex items-start gap-2 text-[10px] font-semibold text-on-surface cursor-pointer">
            <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} className="mt-0.5 accent-primary" />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const EMPTY_FOLLOWUP = {
  fecha: '',
  tipo: '',
  motivo: '',
  instancia: '',
  responsable: '',
  estatus: ''
};

function FollowupEditor({ value, onChange }) {
  const savedRows = Array.isArray(value) ? value : [];
  const rows = savedRows.length ? savedRows : [EMPTY_FOLLOWUP];
  const updateRow = (index, field, nextValue) => {
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: nextValue } : row);
    onChange(nextRows);
  };
  const addRow = () => {
    if (rows.length < 5) onChange([...rows, { ...EMPTY_FOLLOWUP }]);
  };
  const removeRow = index => {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(nextRows.length ? nextRows : []);
  };

  return (
    <div className="md:col-span-2 space-y-3">
      <p className="text-[10px] leading-relaxed text-on-surface-variant">
        Complete una fila por cada atención. Los nombres de los campos permanecen visibles mientras escribe.
      </p>
      {rows.map((row, index) => (
        <div key={index} className="rounded-xl border border-outline-variant bg-surface-container-low/40 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-primary">Atención {index + 1}</span>
            {rows.length > 1 && (
              <button type="button" onClick={() => removeRow(index)} className="text-[10px] font-bold text-error hover:underline">
                Eliminar fila
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Fecha" type="date" value={row.fecha} onChange={nextValue => updateRow(index, 'fecha', nextValue)} />
            <Field label="Tipo de atención" value={row.tipo} onChange={nextValue => updateRow(index, 'tipo', nextValue)} placeholder="Ej. orientación, remisión..." />
            <Field label="Motivo / requerimiento" value={row.motivo} onChange={nextValue => updateRow(index, 'motivo', nextValue)} />
            <Field label="Instancia destino" value={row.instancia} onChange={nextValue => updateRow(index, 'instancia', nextValue)} />
            <Field label="Responsable" value={row.responsable} onChange={nextValue => updateRow(index, 'responsable', nextValue)} />
            <Field label="Estatus / resultado" value={row.estatus} onChange={nextValue => updateRow(index, 'estatus', nextValue)} />
          </div>
        </div>
      ))}
      {rows.length < 5 && (
        <button type="button" onClick={addRow} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-[10px] font-extrabold text-primary hover:bg-primary/5">
          <span className="material-symbols-outlined text-sm">add</span>
          Agregar otra atención
        </button>
      )}
    </div>
  );
}

function Section({ number, title, children }) {
  return (
    <section className="rounded-xl border border-outline-variant bg-surface p-4">
      <h4 className="text-xs font-extrabold text-primary uppercase tracking-wide mb-4">{number}. {title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

export default function FamilyIntakeForm({ value, onChange }) {
  const data = normalizeFamilyIntake(value);
  const setRoot = (field, nextValue) => onChange({ ...data, [field]: nextValue });
  const setNested = (section, field, nextValue) => onChange({
    ...data,
    [section]: { ...data[section], [field]: nextValue }
  });

  return (
    <div className="flex flex-col gap-4">
      <Section number="1" title="Control del ingreso familiar">
        <Field label="Fecha de ingreso" type="date" value={data.fecha_ingreso} onChange={value => setRoot('fecha_ingreso', value)} />
        <Field label="Hora de ingreso" type="time" value={data.hora_ingreso} onChange={value => setRoot('hora_ingreso', value)} />
        <Select label="Tipo de registro" value={data.tipo_registro} onChange={value => setRoot('tipo_registro', value)} options={['Nuevo', 'Actualización', 'Reingreso']} />
        <Field label="De cuál refugio viene" value={data.refugio_origen} onChange={value => setRoot('refugio_origen', value)} />
        <Select label="Prioridad social inicial" value={data.prioridad_social} onChange={value => setRoot('prioridad_social', value)} options={['Inmediata', 'Prioritaria', 'Seguimiento', 'Sin alerta']} />
      </Section>

      <Section number="4" title="Alertas de protección y vulnerabilidad">
        <CheckGroup
          label="Alertas presentes"
          values={data.alertas}
          onChange={value => setRoot('alertas', value)}
          options={PRIORITY_CONDITIONS}
        />
      </Section>

      <Section number="5" title="Salud y requerimientos sanitarios reportados">
        <Select label="Lesión por el sismo" value={data.salud.lesion_sismo} onChange={value => setNested('salud', 'lesion_sismo', value)} options={['No', 'Sí']} />
        <Field label="Persona lesionada" value={data.salud.lesion_persona} onChange={value => setNested('salud', 'lesion_persona', value)} />
        <TextArea label="Descripción de la lesión" value={data.salud.lesion_descripcion} onChange={value => setNested('salud', 'lesion_descripcion', value)} />
        <Select label="Requiere evaluación médica" value={data.salud.evaluacion_medica} onChange={value => setNested('salud', 'evaluacion_medica', value)} options={['No', 'Sí inmediata', 'Sí prioritaria']} />
        <Field label="Enfermedad crónica" value={data.salud.enfermedad_cronica} onChange={value => setNested('salud', 'enfermedad_cronica', value)} />
        <Field label="Tratamiento diario (medicamento/dosis/frecuencia)" value={data.salud.tratamiento_diario} onChange={value => setNested('salud', 'tratamiento_diario', value)} />
        <Field label="Medicamento requerido" value={data.salud.medicamento_requerido} onChange={value => setNested('salud', 'medicamento_requerido', value)} />
        <Select label="Días disponibles" value={data.salud.dias_disponibles} onChange={value => setNested('salud', 'dias_disponibles', value)} options={['Ninguno', '1-3', '4-7', 'Más de 7']} />
        <Field label="Alergias conocidas" value={data.salud.alergias} onChange={value => setNested('salud', 'alergias', value)} />
        <Select label="Requiere refrigeración" value={data.salud.refrigeracion} onChange={value => setNested('salud', 'refrigeracion', value)} options={['No', 'Sí']} />
        <Field label="Medicamento que requiere refrigeración" value={data.salud.medicamento_refrigerado} onChange={value => setNested('salud', 'medicamento_refrigerado', value)} />
        <Field label="Embarazo: semanas" value={data.salud.embarazo_semanas} onChange={value => setNested('salud', 'embarazo_semanas', value)} />
        <Field label="Lactancia: edad del niño/a" value={data.salud.lactancia_edad} onChange={value => setNested('salud', 'lactancia_edad', value)} />
        <Field label="Discapacidad / movilidad" value={data.salud.discapacidad} onChange={value => setNested('salud', 'discapacidad', value)} />
        <Select label="Ayuda técnica requerida" value={data.salud.ayuda_tecnica} onChange={value => setNested('salud', 'ayuda_tecnica', value)} options={['Bastón', 'Silla ruedas', 'Andadera', 'Lentes', 'Audífono', 'Otra']} />
        {data.salud.ayuda_tecnica === 'Otra' && <Field label="Otra ayuda técnica" value={data.salud.ayuda_tecnica_otra} onChange={value => setNested('salud', 'ayuda_tecnica_otra', value)} />}
        <Select label="Apoyo psicosocial" value={data.salud.apoyo_psicosocial} onChange={value => setNested('salud', 'apoyo_psicosocial', value)} options={['No requerido', 'Ansiedad/crisis', 'Duelo/pérdida', 'Otro']} />
        <TextArea label="Observación sanitaria" value={data.salud.observacion} onChange={value => setNested('salud', 'observacion', value)} />
      </Section>

      <Section number="6" title="Situación documental y atención SAREN">
        <Select label="Estatus documental general" value={data.documental.estatus} onChange={value => setNested('documental', 'estatus', value)} options={['Documentos en mano', 'Perdidos', 'Dañados', 'No porta', 'Mixto', 'Por verificar']} />
        <Select label="Urgencia documental" value={data.documental.urgencia} onChange={value => setNested('documental', 'urgencia', value)} options={['Alta', 'Media', 'Baja', 'Por verificar']} />
        <CheckGroup label="Documentos requeridos" values={data.documental.documentos_requeridos} onChange={value => setNested('documental', 'documentos_requeridos', value)} options={['Partida de nacimiento', 'Acta de matrimonio', 'Acta de defunción', 'Documento de propiedad', 'Poder/autorización', 'Documento notariado', 'Registro mercantil']} />
        <Field label="Otros documentos" value={data.documental.otros_documentos} onChange={value => setNested('documental', 'otros_documentos', value)} />
        <Field label="Nombre de la persona que requiere el documento" value={data.documental.persona_nombre} onChange={value => setNested('documental', 'persona_nombre', value)} />
        <Field label="ID del integrante que requiere el documento" value={data.documental.persona_id} onChange={value => setNested('documental', 'persona_id', value)} />
        <Select label="Motivo" value={data.documental.motivo} onChange={value => setNested('documental', 'motivo', value)} options={['Pérdida por desastre', 'Daño físico', 'Trámite pendiente', 'Otro']} />
        {data.documental.motivo === 'Otro' && <Field label="Otro motivo" value={data.documental.motivo_otro} onChange={value => setNested('documental', 'motivo_otro', value)} />}
        <Select label="Acción OAC/SAREN" value={data.documental.accion} onChange={value => setNested('documental', 'accion', value)} options={['Orientación', 'Registro de requerimiento', 'Remisión a registro/notaría', 'Gestión interna']} />
        <Select label="Órgano o instancia" value={data.documental.organo} onChange={value => setNested('documental', 'organo', value)} options={['SAREN', 'Registro Civil', 'SAIME', 'CPNNA', 'Otro']} />
        {data.documental.organo === 'Otro' && <Field label="Otro órgano o instancia" value={data.documental.organo_otro} onChange={value => setNested('documental', 'organo_otro', value)} />}
        <Select label="Estatus de gestión" value={data.documental.estatus_gestion} onChange={value => setNested('documental', 'estatus_gestion', value)} options={['Pendiente', 'En proceso', 'Atendido', 'Cerrado']} />
        <Field label="Fecha compromiso" type="date" value={data.documental.fecha_compromiso} onChange={value => setNested('documental', 'fecha_compromiso', value)} />
        <Field label="Responsable de seguimiento" value={data.documental.responsable} onChange={value => setNested('documental', 'responsable', value)} />
        <TextArea label="Observaciones documentales" value={data.documental.observaciones} onChange={value => setNested('documental', 'observaciones', value)} />
      </Section>

      <Section number="7" title="Situación habitacional y pérdidas del hogar">
        <Field label="Dirección de origen / comunidad / sector" value={data.vivienda.direccion} onChange={value => setNested('vivienda', 'direccion', value)} />
        <Field label="Parroquia / municipio" value={data.vivienda.parroquia_municipio} onChange={value => setNested('vivienda', 'parroquia_municipio', value)} />
        <Field label="Estado" value={data.vivienda.estado} onChange={value => setNested('vivienda', 'estado', value)} />
        <Field label="Referencia / punto cercano" value={data.vivienda.referencia} onChange={value => setNested('vivienda', 'referencia', value)} />
        <Select label="Condición de vivienda" value={data.vivienda.condicion} onChange={value => setNested('vivienda', 'condicion', value)} options={['Pérdida total/colapso', 'Daño severo aparente', 'Daño leve/moderado', 'Sin información']} />
        <Select label="Inspección técnica" value={data.vivienda.inspeccion} onChange={value => setNested('vivienda', 'inspeccion', value)} options={['No realizada', 'Pendiente', 'Realizada']} />
        <Field label="Inspección realizada por" value={data.vivienda.inspeccion_por} onChange={value => setNested('vivienda', 'inspeccion_por', value)} />
        <Field label="Fecha de inspección" type="date" value={data.vivienda.fecha_inspeccion} onChange={value => setNested('vivienda', 'fecha_inspeccion', value)} />
        <Select label="Tenencia de vivienda" value={data.vivienda.tenencia} onChange={value => setNested('vivienda', 'tenencia', value)} options={['Propia', 'Alquilada', 'Familiar', 'Prestada', 'Otra']} />
        {data.vivienda.tenencia === 'Otra' && <Field label="Otra tenencia de vivienda" value={data.vivienda.tenencia_otra} onChange={value => setNested('vivienda', 'tenencia_otra', value)} />}
        <Select label="Puede retornar temporalmente" value={data.vivienda.retorno_temporal} onChange={value => setNested('vivienda', 'retorno_temporal', value)} options={['No', 'Sí', 'Por determinar', 'Requiere evaluación técnica']} />
        <CheckGroup label="Pérdidas críticas" values={data.vivienda.perdidas} onChange={value => setNested('vivienda', 'perdidas', value)} options={['Documentos', 'Medicinas', 'Ropa/calzado', 'Enseres', 'Herramientas de trabajo', 'Ayuda técnica']} />
        <TextArea label="Observación habitacional" value={data.vivienda.observacion} onChange={value => setNested('vivienda', 'observacion', value)} />
        <Select label="Necesidad de visita/inspección" value={data.vivienda.visita_inspeccion} onChange={value => setNested('vivienda', 'visita_inspeccion', value)} options={['No', 'Sí']} />
        <Field label="Motivo de la visita" value={data.vivienda.motivo_visita} onChange={value => setNested('vivienda', 'motivo_visita', value)} />
        <Select label="Registro fotográfico" value={data.vivienda.registro_fotografico} onChange={value => setNested('vivienda', 'registro_fotografico', value)} options={['No', 'Sí']} />
        <Field label="Código / archivo fotográfico" value={data.vivienda.codigo_fotografico} onChange={value => setNested('vivienda', 'codigo_fotografico', value)} />
      </Section>

      <Section number="8" title="Diagnóstico socioeconómico básico">
        <Field label="Ocupación / oficio principal" value={data.socioeconomico.ocupacion} onChange={value => setNested('socioeconomico', 'ocupacion', value)} />
        <Select label="Situación laboral actual" value={data.socioeconomico.situacion_laboral} onChange={value => setNested('socioeconomico', 'situacion_laboral', value)} options={['Activa', 'Suspendida', 'Perdió actividad', 'Informal', 'Sin ingreso']} />
        <CheckGroup label="Fuente de ingreso antes del evento" values={data.socioeconomico.fuente_antes} onChange={value => setNested('socioeconomico', 'fuente_antes', value)} options={['Sueldo', 'Cuenta propia', 'Pensión', 'Bono', 'Remesa', 'Otro']} />
        <Select label="Fuente de ingreso actual" value={data.socioeconomico.fuente_actual} onChange={value => setNested('socioeconomico', 'fuente_actual', value)} options={['Mantiene', 'Parcial', 'Sin ingreso', 'Por verificar']} />
        <Select label="Rango de ingreso mensual aproximado" value={data.socioeconomico.rango_ingreso} onChange={value => setNested('socioeconomico', 'rango_ingreso', value)} options={['Sin ingreso', 'Eventual', 'Bajo', 'Medio', 'NR']} />
        <Field label="Personas dependientes: NNA" type="number" value={data.socioeconomico.dependientes_nna} onChange={value => setNested('socioeconomico', 'dependientes_nna', value)} />
        <Field label="Personas dependientes: adultos mayores" type="number" value={data.socioeconomico.dependientes_adultos} onChange={value => setNested('socioeconomico', 'dependientes_adultos', value)} />
        <Field label="Personas dependientes: discapacidad" type="number" value={data.socioeconomico.dependientes_discapacidad} onChange={value => setNested('socioeconomico', 'dependientes_discapacidad', value)} />
        <CheckGroup label="Red de apoyo" values={data.socioeconomico.red_apoyo} onChange={value => setNested('socioeconomico', 'red_apoyo', value)} options={['Familiar', 'Vecinal', 'Comunitaria', 'Institucional', 'Ninguna']} />
        <Select label="Puede alojarse con familiar" value={data.socioeconomico.alojamiento_familiar} onChange={value => setNested('socioeconomico', 'alojamiento_familiar', value)} options={['Sí', 'No', 'Por verificar']} />
      </Section>

      <Section number="9" title="Requerimientos inmediatos priorizados">
        <CheckGroup label="Requerimientos especiales" values={data.requerimientos} onChange={value => setRoot('requerimientos', value)} options={['Medicamentos / insumos médicos', 'Ropa / calzado', 'Kit de higiene personal', 'Pañales / fórmula / insumos de lactante', 'Toallas sanitarias / higiene menstrual', 'Ayuda técnica o movilidad', 'Gestión documental', 'Atención médica / enfermería', 'Apoyo psicosocial', 'Traslado institucional', 'Comunicación / contacto familiar']} />
        <Field label="Otro requerimiento" value={data.otro_requerimiento} onChange={value => setRoot('otro_requerimiento', value)} />
      </Section>

      <Section number="10" title="Acciones y seguimiento">
        <FollowupEditor value={data.seguimientos} onChange={value => setRoot('seguimientos', value)} />
      </Section>

      <Section number="11" title="Observaciones finales del profesional OAC">
        <TextArea label="Observaciones finales" value={data.observaciones_finales} onChange={value => setRoot('observaciones_finales', value)} />
      </Section>

      <Section number="12" title="Consentimiento, cierre y firmas">
        <label className="md:col-span-2 flex items-start gap-2 rounded-xl border border-outline-variant p-3 text-[10px] font-semibold text-on-surface cursor-pointer">
          <input type="checkbox" checked={Boolean(data.consentimiento)} onChange={event => setRoot('consentimiento', event.target.checked)} className="mt-0.5 accent-primary" />
          La persona entrevistada autoriza el uso institucional de estos datos para atención social, documental, sanitaria, protección y seguimiento.
        </label>
        <Field label="Fecha de cierre o actualización" type="date" value={data.fecha_cierre} onChange={value => setRoot('fecha_cierre', value)} />
        <Select label="Resultado del caso" value={data.resultado_caso} onChange={value => setRoot('resultado_caso', value)} options={['Pendiente', 'En seguimiento', 'Atendido', 'Cerrado']} />
      </Section>
    </div>
  );
}
