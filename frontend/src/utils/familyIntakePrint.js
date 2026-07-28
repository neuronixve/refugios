import { normalizeFamilyIntake } from './familyIntakeData.js';

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const valuesOf = value => Array.isArray(value) ? value : [value];

const matches = (actual, option, aliases = []) => {
  const expected = [option, ...aliases].map(normalize);
  return valuesOf(actual).some(value => {
    const normalizedValue = normalize(value);
    return expected.some(item => normalizedValue === item || normalizedValue.includes(item));
  });
};

const box = checked => `<span class="box">${checked ? '[X]' : '[ ]'}</span>`;
const choice = (actual, option, aliases = []) => `${box(matches(actual, option, aliases))} ${escapeHtml(option)}`;
const shown = value => value === 0 || String(value ?? '').trim() ? escapeHtml(value) : '&nbsp;';
const filled = value => `<span class="filled">${shown(value)}</span>`;
const listValue = value => Array.isArray(value) ? value.join(', ') : String(value || '');

const formatDate = value => {
  const raw = String(value || '').slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]} / ${match[2]} / ${match[1]}` : raw;
};

const parseMetadata = resident => {
  try {
    return typeof resident?.special_needs === 'string'
      ? JSON.parse(resident.special_needs || '{}')
      : (resident?.special_needs || {});
  } catch {
    return {};
  }
};

const ageFromDate = value => {
  if (!value) return '';
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return Math.max(0, age);
};

const yesNo = (value, yesAliases = ['Sí']) => {
  const isYes = yesAliases.some(alias => matches(value, alias));
  return `${box(!isYes)} No&nbsp;&nbsp;${box(isYes)} Sí`;
};

const fixedOptions = (actual, options) => options
  .map(option => choice(actual, option.label || option, option.aliases || []))
  .join('&nbsp;&nbsp;');

const followupRows = value => {
  const rows = Array.isArray(value)
    ? value.slice(0, 5).map(item => [
      item.fecha, item.tipo, item.motivo, item.instancia, item.responsable, item.estatus
    ])
    : String(value || '').split('\n').map(line => line.trim()).filter(Boolean).slice(0, 5)
      .map(line => line.split('|').map(item => item.trim()));
  return Array.from({ length: 5 }, (_, rowIndex) => {
    const cells = rows[rowIndex] || [];
    return `<tr>${Array.from({ length: 6 }, (_, columnIndex) => `<td>${shown(cells[columnIndex])}</td>`).join('')}</tr>`;
  }).join('');
};

const renderMemberRows = members => {
  const activeMembers = members.filter(member => member.status === 'Activo');
  return Array.from({ length: 8 }, (_, index) => {
    const member = activeMembers[index];
    if (!member) return `<tr><td class="center">${index + 1}</td>${'<td>&nbsp;</td>'.repeat(8)}</tr>`;
    const metadata = parseMetadata(member);
    const plan = metadata.planilla_persona || {};
    const conditions = [
      plan.condicion_prioritaria,
      metadata.discapacidad && metadata.discapacidad !== 'Ninguna' ? metadata.discapacidad : '',
      ...(metadata.preexisting || []),
      metadata.nutricion_especial && metadata.nutricion_especial !== 'Ninguno' ? metadata.nutricion_especial : ''
    ].filter(Boolean).join(', ');
    return `<tr>
      <td class="center">${index + 1}</td>
      <td>${shown(`${member.first_name || ''} ${member.last_name || ''}`.trim())}</td>
      <td>${shown(`${plan.tipo_documento || 'C.I.'} ${member.document_id || 'N/T'}`)}</td>
      <td class="center">${shown(ageFromDate(member.birth_date))}</td>
      <td class="center">${shown(member.gender)}</td>
      <td>${shown(metadata.es_cabeza_familia ? 'Representante' : metadata.parentesco)}</td>
      <td>${shown(conditions)}</td>
      <td>${shown(plan.estatus_documento || (metadata.documento_perdido ? 'Perdido' : 'Por verificar'))}</td>
      <td>${shown(plan.observaciones)}</td>
    </tr>`;
  }).join('');
};

export function buildFamilyIntakeHtml({ family, members = [], refugio, assetBase = '' }) {
  const data = normalizeFamilyIntake(family.intake_data);
  const activeMembers = members.filter(member => member.status === 'Activo');
  const representative = activeMembers.find(member => parseMetadata(member).es_cabeza_familia)
    || activeMembers[0]
    || members[0];
  const representativeMeta = parseMetadata(representative);
  const personPlan = representativeMeta.planilla_persona || {};
  const professional = family.registered_by_name || family.updated_by_name || '';
  const professionalDocument = family.registered_by_document || '';
  const professionalFunction = family.registered_by_function || 'Profesional OAC';
  const entryDate = data.fecha_ingreso || String(family.created_at || '').slice(0, 10);
  const logoUrl = `${assetBase}/logo-saren-planilla.jpeg`;

  const health = data.salud;
  const documentary = data.documental;
  const housing = data.vivienda;
  const socioeconomic = data.socioeconomico;
  const chronicPresent = Boolean(String(health.enfermedad_cronica || '').trim());
  const medicationPresent = Boolean(String(health.medicamento_requerido || '').trim());
  const allergiesPresent = Boolean(String(health.alergias || '').trim());
  const pregnancyPresent = Boolean(String(health.embarazo_semanas || '').trim());
  const lactationPresent = Boolean(String(health.lactancia_edad || '').trim());
  const disabilityPresent = Boolean(String(health.discapacidad || '').trim());

  const roleOptions = [
    { label: 'Jefe(a) de hogar', aliases: ['jefe', 'cabeza'] },
    { label: 'Madre/Padre', aliases: ['madre', 'padre'] },
    { label: 'Representante' },
    { label: 'Otro' }
  ];
  const knownRoles = roleOptions.some(option => matches(personPlan.rol_familiar, option.label, option.aliases));
  const otherRole = knownRoles ? '' : personPlan.rol_familiar;

  const documentaryMotives = ['Pérdida por desastre', 'Daño físico', 'Trámite pendiente'];
  const actionOptions = ['Orientación', 'Registro de requerimiento', 'Remisión a registro/notaría', 'Gestión interna'];
  const organOptions = ['SAREN', 'Registro Civil', 'SAIME', 'CPNNA'];
  const otherTechnicalAidSelected = health.ayuda_tecnica === 'Otra';
  const technicalAid = otherTechnicalAidSelected
    ? health.ayuda_tecnica_otra
    : (health.ayuda_tecnica || '');
  const knownTechnicalAid = ['Bastón', 'Silla ruedas', 'Andadera', 'Lentes', 'Audífono']
    .some(item => matches(technicalAid, item));
  const otherMotiveSelected = documentary.motivo === 'Otro';
  const documentaryMotive = otherMotiveSelected ? documentary.motivo_otro : documentary.motivo;
  const otherOrganSelected = documentary.organo === 'Otro';
  const documentaryOrgan = otherOrganSelected ? documentary.organo_otro : documentary.organo;
  const otherTenureSelected = housing.tenencia === 'Otra';
  const housingTenure = otherTenureSelected ? housing.tenencia_otra : housing.tenencia;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Planilla integral - ${escapeHtml(family.family_name)}</title>
  <style>
    @page { size: Letter portrait; margin: 0.35in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 8pt; line-height: 1.12; }
    .page { position: relative; width: 7.8in; min-height: 10.3in; padding-bottom: 0.22in; break-after: page; page-break-after: always; }
    .page:last-of-type { break-after: auto; page-break-after: auto; }
    h2 { margin: 0.09in 0 0.045in; color: #1f4e79; font-size: 10pt; line-height: 1.05; font-weight: 700; }
    p { margin: 0; }
    .note { margin: 0 0 0.045in; font-size: 8pt; }
    .header { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 0.01in; }
    .header td { border: 0.65pt solid #111; }
    .header-logo { width: 1.25in; background: white; text-align: center; padding: 0.025in; }
    .header-logo img { width: 0.95in; height: 0.76in; object-fit: fill; display: inline-block; }
    .header-copy { background: #dbe8f4; text-align: center; vertical-align: middle; padding: 0.035in 0.06in; }
    .header-copy h1 { margin: 0; color: #1f4e79; font-size: 12.5pt; line-height: 1.02; font-weight: 700; }
    .header-copy .subtitle { margin-top: 0.035in; font-size: 8.5pt; font-style: italic; }
    .header-copy .description { margin-top: 0.015in; font-size: 8pt; }
    .instruction { font-size: 8pt; margin: 0 0 0.08in; line-height: 1.2; }
    table.form { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.form td, table.form th { border: 0.55pt solid #111; padding: 0.025in 0.035in; vertical-align: middle; overflow-wrap: anywhere; }
    table.form td.label { background: #efefef; font-weight: 700; }
    table.form th { background: #1f4e79; color: #fff; font-weight: 700; text-align: center; }
    table.form tr { break-inside: avoid; page-break-inside: avoid; }
    .compact td, .compact th { padding-top: 0.018in !important; padding-bottom: 0.018in !important; }
    .member-table { font-size: 7.1pt; }
    .member-table tbody tr { height: 0.19in; }
    .alerts td { height: 0.19in; }
    .page-two { font-size: 7.55pt; }
    .page-two h2 { margin-top: 0.065in; margin-bottom: 0.03in; }
    .page-two .note { font-size: 7.4pt; }
    .page-two table.form td { padding: 0.02in 0.03in; }
    .page-three h2 { margin-top: 0.095in; }
    .requirements td { height: 0.20in; }
    .tracking { font-size: 7.4pt; }
    .tracking tbody tr { height: 0.31in; }
    .observations td { height: 0.22in; }
    .signature-heading { text-align: center; font-weight: 700; }
    .signature-space { height: 0.72in; vertical-align: bottom !important; text-align: center; }
    .filled { display: inline-block; min-width: 0.38in; border-bottom: 0.5pt solid #222; padding: 0 0.02in 0.005in; }
    .box { font-family: Arial, Helvetica, sans-serif; white-space: nowrap; font-weight: 400; }
    .center { text-align: center; }
    .footer { position: absolute; left: 0; right: 0; bottom: 0.02in; text-align: center; color: #666; font-size: 7pt; }
    .screen-actions { position: fixed; z-index: 20; right: 16px; top: 16px; display: flex; gap: 8px; }
    .screen-actions button { border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
    .print { background: #1f4e79; color: #fff; }
    .close { background: #eee; color: #222; }
    @media screen { body { background: #d7d7d7; } .page { margin: 18px auto; padding: 0.35in 0.35in 0.22in; width: 8.5in; min-height: 11in; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.18); } }
    @media print { .screen-actions { display: none; } .page { width: auto; min-height: 10.3in; padding: 0 0 0.22in; margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="screen-actions"><button class="print" onclick="window.print()">Imprimir planilla</button><button class="close" onclick="window.close()">Cerrar</button></div>

  <section class="page">
    <table class="header">
      <tr>
        <td class="header-logo"><img src="${logoUrl}" alt="SAREN" /></td>
        <td class="header-copy">
          <h1>PLANILLA INTEGRAL DE INGRESO, CARACTERIZACIÓN SOCIAL Y ATENCIÓN<br />DOCUMENTAL</h1>
          <p class="subtitle">Protocolo de contingencia OAC SAREN - Familias afectadas por evento sísmico</p>
          <p class="description">Instrumento físico para entrevista de ingreso y posterior vaciado en base de datos Excel.</p>
        </td>
      </tr>
    </table>
    <p class="instruction"><strong>Instrucción de llenado:</strong> registre información clara, verificable y legible. Cuando no aplique, marque N/A; cuando la persona no sepa, marque NS; cuando no responda, marque NR. La condición de vivienda es referida por la familia y no sustituye inspección técnica.</p>

    <h2>1. DATOS DE CONTROL DEL INGRESO FAMILIAR</h2>
    <table class="form compact">
      <colgroup><col style="width:17.5%"><col style="width:31.8%"><col style="width:17.5%"><col style="width:33.2%"></colgroup>
      <tr><td class="label">ID Familiar / Código</td><td>HOG-${shown(family.id)}</td><td class="label">Fecha de ingreso</td><td>${filled(formatDate(entryDate))}</td></tr>
      <tr><td class="label">Hora de ingreso</td><td>${filled(data.hora_ingreso)}</td><td class="label">Tipo de registro</td><td>${fixedOptions(data.tipo_registro, ['Nuevo', 'Actualización', 'Reingreso'])}</td></tr>
      <tr><td class="label">Profesional OAC</td><td>${filled(`${professional}${professional ? ` - ${professionalFunction}` : ''}`)}</td><td class="label">De cual refugio viene</td><td>${filled(data.refugio_origen)}</td></tr>
      <tr><td class="label">N° integrantes del hogar</td><td>${filled(activeMembers.length)}</td><td class="label">Prioridad social inicial</td><td>${fixedOptions(data.prioridad_social, ['Inmediata', 'Prioritaria', 'Seguimiento', 'Sin alerta'])}</td></tr>
    </table>

    <h2>2. REPRESENTANTE O VOCERO DEL GRUPO FAMILIAR</h2>
    <table class="form compact">
      <colgroup><col style="width:17.5%"><col style="width:31.8%"><col style="width:17.5%"><col style="width:33.2%"></colgroup>
      <tr><td class="label">Nombres</td><td>${filled(representative?.first_name)}</td><td class="label">Apellidos</td><td>${filled(representative?.last_name)}</td></tr>
      <tr>
        <td class="label">Tipo y N° documento</td>
        <td>${fixedOptions(personPlan.tipo_documento || 'C.I.', ['C.I.', 'Pasaporte', 'Otro'])}&nbsp;&nbsp; N° ${filled(representative?.document_id || 'N/T')}</td>
        <td class="label">Posee cédula física</td>
        <td>${fixedOptions(personPlan.estatus_documento || (representativeMeta.documento_perdido ? 'Perdido' : 'Por verificar'), ['En mano', 'Perdido', 'Dañado', 'No porta', 'En trámite'])}</td>
      </tr>
      <tr>
        <td class="label">Fecha nacimiento</td><td>${filled(formatDate(representative?.birth_date))}</td>
        <td class="label">Edad / Género</td>
        <td>${filled(ageFromDate(representative?.birth_date))} años&nbsp;&nbsp;${box(matches(representative?.gender, 'Masculino'))} M&nbsp;&nbsp;${box(matches(representative?.gender, 'Femenino'))} F&nbsp;&nbsp;${box(matches(representative?.gender, 'Otro'))} Otro&nbsp;&nbsp;${box(!representative?.gender)} NR</td>
      </tr>
      <tr><td class="label">Teléfono principal</td><td>${filled(representativeMeta.telefono_contacto)}</td><td class="label">Teléfono alterno / contacto</td><td>${filled(personPlan.telefono_alterno || representativeMeta.contacto_emergencia)}</td></tr>
      <tr>
        <td class="label">Parentesco / rol</td>
        <td>${roleOptions.map(option => choice(personPlan.rol_familiar || (representativeMeta.es_cabeza_familia ? 'Jefe(a) de hogar' : representativeMeta.parentesco), option.label, option.aliases)).join('&nbsp;&nbsp;')} ${otherRole ? filled(otherRole) : ''}</td>
        <td class="label">Red de apoyo externa</td>
        <td>${fixedOptions(personPlan.red_apoyo_externa, ['Sí', 'No', 'Por verificar'])}</td>
      </tr>
    </table>

    <h2>3. COMPOSICIÓN DEL GRUPO FAMILIAR</h2>
    <p class="note">Registre a todos los integrantes, incluso niñas, niños, adolescentes, adultos mayores y personas temporalmente ausentes del refugio.</p>
    <table class="form member-table compact">
      <colgroup><col style="width:4.2%"><col style="width:21.4%"><col style="width:13.6%"><col style="width:5.8%"><col style="width:7.1%"><col style="width:11%"><col style="width:17.5%"><col style="width:11%"><col style="width:9.4%"></colgroup>
      <thead><tr><th>N°</th><th>Nombres y apellidos</th><th>Tipo/N° doc.</th><th>Edad</th><th>Género</th><th>Parentesco</th><th>Condición prioritaria</th><th>Estatus doc.</th><th>Obs.</th></tr></thead>
      <tbody>${renderMemberRows(members)}</tbody>
    </table>

    <h2>4. ALERTAS DE PROTECCIÓN Y VULNERABILIDAD PRIORITARIA</h2>
    <table class="form alerts compact">
      <tr><td>${choice(data.alertas, 'Niño, Niña o Adolescente (NNA) no acompañado', ['NNA no acompañado'])}</td><td>${choice(data.alertas, 'NNA separado bajo cuidado de familiar lejano, vecino u otra persona', ['NNA separado bajo cuidado de tercero'])}</td></tr>
      <tr><td>${choice(data.alertas, 'NNA sin documento o con documento perdido/dañado')}</td><td>${choice(data.alertas, 'Adulto mayor solo, sin cuidador o en abandono evidente', ['Adulto mayor solo o sin cuidador'])}</td></tr>
      <tr><td>${choice(data.alertas, 'Persona con discapacidad o movilidad reducida')}</td><td>${choice(data.alertas, 'Embarazo o lactancia')}</td></tr>
      <tr><td>${choice(data.alertas, 'Persona con enfermedad crónica o tratamiento permanente', ['Enfermedad crónica o tratamiento permanente'])}</td><td>${choice(data.alertas, 'Riesgo de protección / violencia / situación familiar sensible', ['Riesgo de protección, violencia o situación familiar sensible'])}</td></tr>
    </table>
    <div class="footer">OAC SAREN - Instrumento de ingreso familiar y atención social/documental | Uso interno</div>
  </section>

  <section class="page page-two">
    <h2>5. SALUD Y REQUERIMIENTOS SANITARIOS REPORTADOS</h2>
    <p class="note">Esta sección no sustituye evaluación médica. Registre solo información necesaria para priorizar atención, tratamientos y derivaciones.</p>
    <table class="form compact">
      <colgroup><col style="width:18.3%"><col style="width:28.4%"><col style="width:18.3%"><col style="width:35%"></colgroup>
      <tr><td class="label">Lesión por el sismo</td><td>${yesNo(health.lesion_sismo)} ¿Quién? ${filled(health.lesion_persona)}&nbsp; Descripción: ${filled(health.lesion_descripcion)}</td><td class="label">Requiere evaluación médica</td><td>${fixedOptions(health.evaluacion_medica, ['No', 'Sí inmediata', 'Sí prioritaria'])}</td></tr>
      <tr><td class="label">Enfermedad crónica</td><td>${box(!chronicPresent)} No&nbsp;&nbsp;${box(chronicPresent)} Sí: ${filled(health.enfermedad_cronica)}</td><td class="label">Tratamiento diario</td><td>Medicamento/dosis/frecuencia: ${filled(health.tratamiento_diario)}</td></tr>
      <tr><td class="label">Medicamento requerido</td><td>${box(!medicationPresent)} No&nbsp;&nbsp;${box(medicationPresent)} Sí: ${filled(health.medicamento_requerido)}</td><td class="label">Días disponibles</td><td>${fixedOptions(health.dias_disponibles, ['Ninguno', '1-3', '4-7', 'Más de 7'])}</td></tr>
      <tr><td class="label">Alergias conocidas</td><td>${box(!allergiesPresent)} No&nbsp;&nbsp;${box(allergiesPresent)} Sí: ${filled(health.alergias)}</td><td class="label">Requiere refrigeración</td><td>${yesNo(health.refrigeracion)}&nbsp; Medicamento: ${filled(health.refrigeracion === 'Sí' ? (health.medicamento_refrigerado || health.medicamento_requerido) : '')}</td></tr>
      <tr><td class="label">Embarazo</td><td>${box(!pregnancyPresent)} No&nbsp;&nbsp;${box(pregnancyPresent)} Sí&nbsp; Semanas: ${filled(health.embarazo_semanas)}</td><td class="label">Lactancia</td><td>${box(!lactationPresent)} No&nbsp;&nbsp;${box(lactationPresent)} Sí&nbsp; Edad del niño/a: ${filled(health.lactancia_edad)}</td></tr>
      <tr><td class="label">Discapacidad / movilidad</td><td>${box(!disabilityPresent)} No&nbsp;&nbsp;${box(disabilityPresent)} Sí: ${filled(health.discapacidad)}</td><td class="label">Ayuda técnica requerida</td><td>${fixedOptions(technicalAid, ['Bastón', 'Silla ruedas', 'Andadera', 'Lentes', 'Audífono'])}&nbsp;&nbsp;${box(otherTechnicalAidSelected || (Boolean(technicalAid) && !knownTechnicalAid))} Otra: ${filled(knownTechnicalAid ? '' : technicalAid)}</td></tr>
      <tr><td class="label">Apoyo psicosocial</td><td>${fixedOptions(health.apoyo_psicosocial, ['No requerido', 'Ansiedad/crisis', 'Duelo/pérdida', 'Otro'])}</td><td class="label">Observación sanitaria</td><td>${filled(health.observacion)}</td></tr>
    </table>

    <h2>6. SITUACIÓN DOCUMENTAL Y REQUERIMIENTOS DE ATENCIÓN SAREN</h2>
    <table class="form compact">
      <colgroup><col style="width:17.9%"><col style="width:36.1%"><col style="width:18.3%"><col style="width:27.7%"></colgroup>
      <tr><td class="label">Estatus documental general</td><td>${fixedOptions(documentary.estatus, ['Documentos en mano', 'Perdidos', 'Dañados', 'No porta', 'Mixto'])}</td><td class="label">Urgencia documental</td><td>${fixedOptions(documentary.urgencia, ['Alta', 'Media', 'Baja', 'Por verificar'])}</td></tr>
      <tr><td class="label">Documento requerido</td><td>${fixedOptions(documentary.documentos_requeridos, ['Partida de nacimiento', 'Acta de matrimonio', 'Acta de defunción', 'Documento de propiedad'])}</td><td class="label">Otros documentos</td><td>${fixedOptions(documentary.documentos_requeridos, ['Poder/autorización', 'Documento notariado', 'Registro mercantil'])}&nbsp;&nbsp;${box(Boolean(documentary.otros_documentos))} Otro: ${filled(documentary.otros_documentos)}</td></tr>
      <tr><td class="label">Persona que requiere el documento</td><td>Nombre: ${filled(documentary.persona_nombre)}&nbsp; ID integrante: ${filled(documentary.persona_id)}</td><td class="label">Motivo</td><td>${fixedOptions(documentaryMotive, documentaryMotives)}&nbsp;&nbsp;${box(otherMotiveSelected || (Boolean(documentaryMotive) && !documentaryMotives.some(option => matches(documentaryMotive, option))))} Otro ${documentaryMotives.some(option => matches(documentaryMotive, option)) ? '' : filled(documentaryMotive)}</td></tr>
      <tr><td class="label">Acción OAC/SAREN</td><td>${fixedOptions(documentary.accion, actionOptions)}</td><td class="label">Órgano/instancia</td><td>${fixedOptions(documentaryOrgan, organOptions)}&nbsp;&nbsp;${box(otherOrganSelected || (Boolean(documentaryOrgan) && !organOptions.some(option => matches(documentaryOrgan, option))))} Otro: ${filled(organOptions.some(option => matches(documentaryOrgan, option)) ? '' : documentaryOrgan)}</td></tr>
      <tr><td class="label">Estatus de gestión</td><td>${fixedOptions(documentary.estatus_gestion, ['Pendiente', 'En proceso', 'Atendido', 'Cerrado'])}</td><td class="label">Fecha compromiso</td><td>${filled(formatDate(documentary.fecha_compromiso))}</td></tr>
      <tr><td class="label">Observaciones documentales</td><td>${filled(documentary.observaciones)}</td><td class="label">Responsable seguimiento</td><td>${filled(documentary.responsable)}</td></tr>
    </table>

    <h2>7. SITUACIÓN HABITACIONAL Y PÉRDIDAS DEL HOGAR</h2>
    <table class="form compact">
      <colgroup><col style="width:18.2%"><col style="width:28.2%"><col style="width:18.7%"><col style="width:34.9%"></colgroup>
      <tr><td class="label">Dirección de origen</td><td>Comunidad/Sector: ${filled(housing.direccion)}</td><td class="label">Parroquia/Municipio</td><td>${filled(housing.parroquia_municipio)}</td></tr>
      <tr><td class="label">Estado</td><td>${filled(housing.estado)}</td><td class="label">Referencia / punto cercano</td><td>${filled(housing.referencia)}</td></tr>
      <tr><td class="label">Condición de vivienda referida por la familia</td><td>${fixedOptions(housing.condicion, ['Pérdida total/colapso', 'Daño severo aparente', 'Daño leve/moderado', 'Sin información'])}</td><td class="label">Inspección técnica</td><td>${fixedOptions(housing.inspeccion, ['No realizada', 'Pendiente', 'Realizada'])} por: ${filled(housing.inspeccion_por)}&nbsp; Fecha: ${filled(formatDate(housing.fecha_inspeccion))}</td></tr>
      <tr><td class="label">Tenencia de vivienda</td><td>${fixedOptions(housingTenure, ['Propia', 'Alquilada', 'Familiar', 'Prestada'])}&nbsp;&nbsp;${box(otherTenureSelected || (Boolean(housingTenure) && !['Propia', 'Alquilada', 'Familiar', 'Prestada'].some(option => matches(housingTenure, option))))} Otra: ${filled(['Propia', 'Alquilada', 'Familiar', 'Prestada'].some(option => matches(housingTenure, option)) ? '' : housingTenure)}</td><td class="label">Puede retornar temporalmente</td><td>${fixedOptions(housing.retorno_temporal, ['No', 'Sí', 'Por determinar', 'Requiere evaluación técnica'])}</td></tr>
      <tr><td class="label">Pérdidas críticas</td><td>${fixedOptions(housing.perdidas, ['Documentos', 'Medicinas', 'Ropa/calzado', 'Enseres', 'Herramientas de trabajo', 'Ayuda técnica'])}</td><td class="label">Observación</td><td>${filled(housing.observacion)}</td></tr>
      <tr><td class="label">Necesidad de visita/inspección</td><td>${yesNo(housing.visita_inspeccion)}&nbsp; Motivo: ${filled(housing.motivo_visita)}</td><td class="label">Registro fotográfico</td><td>${yesNo(housing.registro_fotografico)}&nbsp; Código/archivo: ${filled(housing.codigo_fotografico)}</td></tr>
    </table>

    <h2>8. DIAGNÓSTICO SOCIOECONÓMICO BÁSICO</h2>
    <table class="form compact">
      <colgroup><col style="width:18.6%"><col style="width:36.1%"><col style="width:18.8%"><col style="width:26.5%"></colgroup>
      <tr><td class="label">Ocupación / oficio principal</td><td>${filled(socioeconomic.ocupacion)}</td><td class="label">Situación laboral actual</td><td>${fixedOptions(socioeconomic.situacion_laboral, ['Activa', 'Suspendida', 'Perdió actividad', 'Informal', 'Sin ingreso'])}</td></tr>
      <tr><td class="label">Fuente ingreso antes del evento</td><td>${fixedOptions(socioeconomic.fuente_antes, ['Sueldo', 'Cuenta propia', 'Pensión', 'Bono', 'Remesa', 'Otro'])}</td><td class="label">Fuente ingreso actual</td><td>${fixedOptions(socioeconomic.fuente_actual, ['Mantiene', 'Parcial', 'Sin ingreso', 'Por verificar'])}</td></tr>
      <tr><td class="label">Rango ingreso mensual aprox.</td><td>${fixedOptions(socioeconomic.rango_ingreso, ['Sin ingreso', 'Eventual', 'Bajo', 'Medio', 'NR'])}</td><td class="label">Personas dependientes</td><td>NNA: ${filled(socioeconomic.dependientes_nna)}&nbsp; Adultos mayores: ${filled(socioeconomic.dependientes_adultos)}&nbsp; Discapacidad: ${filled(socioeconomic.dependientes_discapacidad)}</td></tr>
      <tr><td class="label">Red de apoyo</td><td>${fixedOptions(socioeconomic.red_apoyo, ['Familiar', 'Vecinal', 'Comunitaria', 'Institucional', 'Ninguna'])}</td><td class="label">Puede alojarse con familiar</td><td>${fixedOptions(socioeconomic.alojamiento_familiar, ['Sí', 'No', 'Por verificar'])}</td></tr>
    </table>
    <div class="footer">OAC SAREN - Instrumento de ingreso familiar y atención social/documental | Uso interno</div>
  </section>

  <section class="page page-three">
    <h2>9. REQUERIMIENTOS INMEDIATOS PRIORIZADOS</h2>
    <p class="note">No se incluye alimentación regular, porque será garantizada dentro de la organización del refugio. Marque únicamente requerimientos adicionales o especiales.</p>
    <table class="form requirements compact">
      <tr><td>${choice(data.requerimientos, 'Medicamentos / insumos médicos')}</td><td>${choice(data.requerimientos, 'Ropa / calzado')}</td><td>${choice(data.requerimientos, 'Kit de higiene personal')}</td></tr>
      <tr><td>${choice(data.requerimientos, 'Pañales / fórmula / insumos de lactante')}</td><td>${choice(data.requerimientos, 'Toallas sanitarias / higiene menstrual')}</td><td>${choice(data.requerimientos, 'Ayuda técnica o movilidad')}</td></tr>
      <tr><td>${choice(data.requerimientos, 'Gestión documental')}</td><td>${choice(data.requerimientos, 'Atención médica / enfermería')}</td><td>${choice(data.requerimientos, 'Apoyo psicosocial')}</td></tr>
      <tr><td>${choice(data.requerimientos, 'Traslado institucional')}</td><td>${choice(data.requerimientos, 'Comunicación / contacto familiar')}</td><td>${box(Boolean(data.otro_requerimiento))} Otro: ${filled(data.otro_requerimiento)}</td></tr>
    </table>

    <h2>10. ARTICULACIONES, REQUIERE ATENCIÓN PSICOLÓGICA, ACCIONES Y SEGUIMIENTO</h2>
    <table class="form tracking compact">
      <colgroup><col style="width:10.4%"><col style="width:15.6%"><col style="width:20.1%"><col style="width:17.5%"><col style="width:18.2%"><col style="width:18.2%"></colgroup>
      <thead><tr><th>Fecha</th><th>Tipo de atención</th><th>Motivo / requerimiento</th><th>Instancia destino</th><th>Responsable</th><th>Estatus / resultado</th></tr></thead>
      <tbody>${followupRows(data.seguimientos)}</tbody>
    </table>

    <h2>11. OBSERVACIONES FINALES DEL PROFESIONAL OAC</h2>
    <table class="form observations compact">
      <tr><td>${shown(data.observaciones_finales)}</td></tr><tr><td>&nbsp;</td></tr><tr><td>&nbsp;</td></tr><tr><td>&nbsp;</td></tr>
    </table>
    <p class="note" style="margin-top:.06in"><strong>Consentimiento y protección de datos:</strong> La persona entrevistada autoriza el uso de estos datos exclusivamente para atención social, documental, sanitaria, protección y seguimiento institucional. La información debe resguardarse y no difundirse por canales no autorizados. ${data.consentimiento ? '<strong>[X] Consentimiento registrado</strong>' : '<strong>[ ] Consentimiento pendiente</strong>'}</p>

    <h2>12. FIRMAS</h2>
    <table class="form compact">
      <tr><td class="signature-heading">Firma del profesional entrevistador OAC</td><td class="signature-heading">Firma o huella de la persona entrevistada / representante familiar</td></tr>
      <tr>
        <td class="signature-space">____________________________<br />Nombre: ${filled(professional)}<br />C.I.: ${filled(professionalDocument)}</td>
        <td class="signature-space">____________________________<br />Nombre: ${filled(representative ? `${representative.first_name} ${representative.last_name}` : '')}<br />C.I.: ${filled(representative?.document_id)}</td>
      </tr>
      <tr><td>Fecha de cierre o actualización: ${filled(formatDate(data.fecha_cierre))}</td><td>Resultado del caso: ${fixedOptions(data.resultado_caso, ['Pendiente', 'En seguimiento', 'Atendido', 'Cerrado'])}</td></tr>
    </table>
    <div class="footer">OAC SAREN - Instrumento de ingreso familiar y atención social/documental | Uso interno</div>
  </section>
</body>
</html>`;
}

export function printFamilyIntake({ family, members, refugio }) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('El navegador bloqueó la ventana de impresión. Habilite las ventanas emergentes para este sitio.');
  printWindow.opener = null;
  const html = buildFamilyIntakeHtml({
    family,
    members,
    refugio,
    assetBase: window.location.origin
  });
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
