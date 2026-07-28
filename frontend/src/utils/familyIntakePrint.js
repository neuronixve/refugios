import { normalizeFamilyIntake } from './familyIntakeData';

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const show = value => escapeHtml(value || '—');
const check = (actual, expected) => actual === expected ? '☒' : '☐';
const list = value => Array.isArray(value) && value.length ? value.join(', ') : '—';

const parseMetadata = resident => {
  try {
    return typeof resident.special_needs === 'string'
      ? JSON.parse(resident.special_needs || '{}')
      : (resident.special_needs || {});
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

const followupRows = value => {
  const rows = String(value || '').split('\n').map(line => line.trim()).filter(Boolean).slice(0, 8);
  return [...rows, ...Array(Math.max(0, 5 - rows.length)).fill('')]
    .map(line => {
      const cells = line.split('|').map(item => item.trim());
      return `<tr>${Array.from({ length: 6 }, (_, index) => `<td>${show(cells[index])}</td>`).join('')}</tr>`;
    }).join('');
};

export function printFamilyIntake({ family, members, refugio }) {
  const data = normalizeFamilyIntake(family.intake_data);
  const activeMembers = members.filter(member => member.status === 'Activo');
  const representative = activeMembers.find(member => parseMetadata(member).es_cabeza_familia) || activeMembers[0] || members[0];
  const representativeMeta = representative ? parseMetadata(representative) : {};
  const personPlan = representativeMeta.planilla_persona || {};
  const professional = family.registered_by_name || family.updated_by_name || '—';
  const professionalDocument = family.registered_by_document || '—';
  const professionalFunction = family.registered_by_function || 'Profesional OAC';
  const entryDate = data.fecha_ingreso || String(family.created_at || '').slice(0, 10);

  const memberRows = [...activeMembers, ...Array(Math.max(0, 8 - activeMembers.length)).fill(null)]
    .slice(0, Math.max(8, activeMembers.length))
    .map((member, index) => {
      if (!member) return `<tr><td>${index + 1}</td>${'<td>—</td>'.repeat(7)}</tr>`;
      const meta = parseMetadata(member);
      const plan = meta.planilla_persona || {};
      const priority = [
        meta.discapacidad && meta.discapacidad !== 'Ninguna' ? meta.discapacidad : '',
        ...(meta.preexisting || []),
        meta.nutricion_especial && meta.nutricion_especial !== 'Ninguno' ? meta.nutricion_especial : ''
      ].filter(Boolean).join(', ');
      return `<tr>
        <td>${index + 1}</td>
        <td>${show(`${member.first_name} ${member.last_name}`)}</td>
        <td>${show(`${plan.tipo_documento || 'C.I.'} ${member.document_id || 'N/T'}`)}</td>
        <td>${show(ageFromDate(member.birth_date))}</td>
        <td>${show(member.gender)}</td>
        <td>${show(meta.es_cabeza_familia ? 'Representante' : meta.parentesco)}</td>
        <td>${show(plan.condicion_prioritaria || priority)}</td>
        <td>${show(plan.estatus_documento || (meta.documento_perdido ? 'Perdido' : 'Por verificar'))}</td>
      </tr>`;
    }).join('');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Planilla integral - ${show(family.family_name)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 8.2pt; }
    .page { min-height: 277mm; page-break-after: always; position: relative; padding-bottom: 8mm; }
    .page:last-child { page-break-after: auto; }
    .header { display: grid; grid-template-columns: 32mm 1fr; border: 1px solid #111; background: #e4effa; align-items: center; }
    .header img { width: 27mm; max-height: 24mm; object-fit: contain; margin: 2mm; }
    .header-copy { text-align: center; padding: 2mm; }
    .header h1 { margin: 0; font-size: 13.5pt; color: #235580; line-height: 1.05; }
    .header p { margin: 1mm 0 0; font-size: 8.5pt; }
    h2 { margin: 3mm 0 1.4mm; font-size: 12pt; line-height: 1; color: #235580; }
    p.note { margin: 1mm 0; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 0.6pt solid #111; padding: 1.2mm; vertical-align: middle; overflow-wrap: anywhere; }
    th { background: #235580; color: white; font-weight: 700; text-align: center; }
    td.label { width: 18%; background: #f0f0f0; font-weight: 700; }
    .members { font-size: 7.2pt; }
    .members th:nth-child(1) { width: 4%; }
    .members th:nth-child(2) { width: 20%; }
    .members th:nth-child(3) { width: 14%; }
    .members th:nth-child(4) { width: 6%; }
    .members th:nth-child(5) { width: 8%; }
    .members th:nth-child(6) { width: 12%; }
    .members th:nth-child(7) { width: 22%; }
    .members th:nth-child(8) { width: 14%; }
    .compact td { padding: 1mm; }
    .signature { height: 30mm; vertical-align: bottom; text-align: center; }
    .footer { position: absolute; bottom: 1mm; left: 0; right: 0; text-align: center; color: #666; font-size: 7pt; }
    .screen-actions { position: fixed; z-index: 10; right: 16px; top: 16px; display: flex; gap: 8px; }
    .screen-actions button { border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
    .print { background: #235580; color: white; }
    .close { background: #eee; color: #222; }
    @media print { .screen-actions { display: none; } }
  </style>
</head>
<body>
  <div class="screen-actions"><button class="print" onclick="window.print()">Imprimir planilla</button><button class="close" onclick="window.close()">Cerrar</button></div>

  <section class="page">
    <div class="header">
      <img src="${window.location.origin}/logo-saren.png" alt="SAREN" />
      <div class="header-copy">
        <h1>PLANILLA INTEGRAL DE INGRESO, CARACTERIZACIÓN SOCIAL Y ATENCIÓN DOCUMENTAL</h1>
        <p><em>Protocolo de contingencia OAC SAREN – Familias afectadas por evento sísmico</em></p>
        <p>Registro digital generado por el Sistema de Gestión de Campamentos Temporales</p>
      </div>
    </div>

    <h2>1. DATOS DE CONTROL DEL INGRESO FAMILIAR</h2>
    <table>
      <tr><td class="label">ID Familiar / Código</td><td>HOG-${show(family.id)}</td><td class="label">Fecha de ingreso</td><td>${show(entryDate)}</td></tr>
      <tr><td class="label">Hora de ingreso</td><td>${show(data.hora_ingreso)}</td><td class="label">Tipo de registro</td><td>${show(data.tipo_registro)}</td></tr>
      <tr><td class="label">Profesional OAC</td><td>${show(professional)} · ${show(professionalFunction)}</td><td class="label">De cuál refugio viene</td><td>${show(data.refugio_origen)}</td></tr>
      <tr><td class="label">N° integrantes del hogar</td><td>${activeMembers.length}</td><td class="label">Prioridad social inicial</td><td>${show(data.prioridad_social)}</td></tr>
      <tr><td class="label">Campamento temporal</td><td colspan="3">${show(refugio?.name)} · ${show(refugio?.location)}</td></tr>
    </table>

    <h2>2. REPRESENTANTE O VOCERO DEL GRUPO FAMILIAR</h2>
    <table>
      <tr><td class="label">Nombres</td><td>${show(representative?.first_name)}</td><td class="label">Apellidos</td><td>${show(representative?.last_name)}</td></tr>
      <tr><td class="label">Tipo y N° documento</td><td>${show(`${personPlan.tipo_documento || 'C.I.'} ${representative?.document_id || 'N/T'}`)}</td><td class="label">Posee documento físico</td><td>${show(personPlan.estatus_documento || (representativeMeta.documento_perdido ? 'Perdido' : 'Por verificar'))}</td></tr>
      <tr><td class="label">Fecha nacimiento</td><td>${show(String(representative?.birth_date || '').slice(0, 10))}</td><td class="label">Edad / Género</td><td>${show(ageFromDate(representative?.birth_date))} años · ${show(representative?.gender)}</td></tr>
      <tr><td class="label">Teléfono principal</td><td>${show(representativeMeta.telefono_contacto)}</td><td class="label">Teléfono alterno / contacto</td><td>${show(personPlan.telefono_alterno || representativeMeta.contacto_emergencia)}</td></tr>
      <tr><td class="label">Parentesco / rol</td><td>${show(personPlan.rol_familiar || (representativeMeta.es_cabeza_familia ? 'Jefe(a) de hogar / representante' : representativeMeta.parentesco))}</td><td class="label">Red de apoyo externa</td><td>${show(personPlan.red_apoyo_externa)}</td></tr>
    </table>

    <h2>3. COMPOSICIÓN DEL GRUPO FAMILIAR</h2>
    <table class="members">
      <thead><tr><th>N°</th><th>Nombres y apellidos</th><th>Tipo/N° doc.</th><th>Edad</th><th>Género</th><th>Parentesco</th><th>Condición prioritaria</th><th>Estatus doc.</th></tr></thead>
      <tbody>${memberRows}</tbody>
    </table>

    <h2>4. ALERTAS DE PROTECCIÓN Y VULNERABILIDAD PRIORITARIA</h2>
    <table class="compact"><tr><td>${show(list(data.alertas))}</td></tr></table>
    <div class="footer">OAC SAREN – Instrumento de ingreso familiar y atención social/documental | Uso interno</div>
  </section>

  <section class="page">
    <h2>5. SALUD Y REQUERIMIENTOS SANITARIOS REPORTADOS</h2>
    <table>
      <tr><td class="label">Lesión por el sismo</td><td>${check(data.salud.lesion_sismo, 'No')} No ${check(data.salud.lesion_sismo, 'Sí')} Sí · ${show(data.salud.lesion_persona)} · ${show(data.salud.lesion_descripcion)}</td><td class="label">Evaluación médica</td><td>${show(data.salud.evaluacion_medica)}</td></tr>
      <tr><td class="label">Enfermedad crónica</td><td>${show(data.salud.enfermedad_cronica)}</td><td class="label">Tratamiento diario</td><td>${show(data.salud.tratamiento_diario)}</td></tr>
      <tr><td class="label">Medicamento requerido</td><td>${show(data.salud.medicamento_requerido)}</td><td class="label">Días disponibles</td><td>${show(data.salud.dias_disponibles)}</td></tr>
      <tr><td class="label">Alergias conocidas</td><td>${show(data.salud.alergias)}</td><td class="label">Requiere refrigeración</td><td>${show(data.salud.refrigeracion)}</td></tr>
      <tr><td class="label">Embarazo</td><td>${show(data.salud.embarazo_semanas)} semanas</td><td class="label">Lactancia</td><td>Edad niño/a: ${show(data.salud.lactancia_edad)}</td></tr>
      <tr><td class="label">Discapacidad / movilidad</td><td>${show(data.salud.discapacidad)}</td><td class="label">Ayuda técnica</td><td>${show(data.salud.ayuda_tecnica)}</td></tr>
      <tr><td class="label">Apoyo psicosocial</td><td>${show(data.salud.apoyo_psicosocial)}</td><td class="label">Observación sanitaria</td><td>${show(data.salud.observacion)}</td></tr>
    </table>

    <h2>6. SITUACIÓN DOCUMENTAL Y REQUERIMIENTOS DE ATENCIÓN SAREN</h2>
    <table>
      <tr><td class="label">Estatus documental general</td><td>${show(data.documental.estatus)}</td><td class="label">Urgencia documental</td><td>${show(data.documental.urgencia)}</td></tr>
      <tr><td class="label">Documentos requeridos</td><td>${show(list(data.documental.documentos_requeridos))}</td><td class="label">Otros documentos</td><td>${show(data.documental.otros_documentos)}</td></tr>
      <tr><td class="label">Persona que requiere documento</td><td>${show(data.documental.persona_id)}</td><td class="label">Motivo</td><td>${show(data.documental.motivo)}</td></tr>
      <tr><td class="label">Acción OAC/SAREN</td><td>${show(data.documental.accion)}</td><td class="label">Órgano/instancia</td><td>${show(data.documental.organo)}</td></tr>
      <tr><td class="label">Estatus de gestión</td><td>${show(data.documental.estatus_gestion)}</td><td class="label">Fecha compromiso</td><td>${show(data.documental.fecha_compromiso)}</td></tr>
      <tr><td class="label">Observaciones documentales</td><td>${show(data.documental.observaciones)}</td><td class="label">Responsable seguimiento</td><td>${show(data.documental.responsable)}</td></tr>
    </table>

    <h2>7. SITUACIÓN HABITACIONAL Y PÉRDIDAS DEL HOGAR</h2>
    <table>
      <tr><td class="label">Dirección de origen</td><td>${show(data.vivienda.direccion)}</td><td class="label">Parroquia/Municipio</td><td>${show(data.vivienda.parroquia_municipio)}</td></tr>
      <tr><td class="label">Estado</td><td>${show(data.vivienda.estado)}</td><td class="label">Referencia / punto cercano</td><td>${show(data.vivienda.referencia)}</td></tr>
      <tr><td class="label">Condición de vivienda</td><td>${show(data.vivienda.condicion)}</td><td class="label">Inspección técnica</td><td>${show(data.vivienda.inspeccion)} · ${show(data.vivienda.inspeccion_por)} · ${show(data.vivienda.fecha_inspeccion)}</td></tr>
      <tr><td class="label">Tenencia de vivienda</td><td>${show(data.vivienda.tenencia)}</td><td class="label">Puede retornar temporalmente</td><td>${show(data.vivienda.retorno_temporal)}</td></tr>
      <tr><td class="label">Pérdidas críticas</td><td>${show(list(data.vivienda.perdidas))}</td><td class="label">Observación</td><td>${show(data.vivienda.observacion)}</td></tr>
      <tr><td class="label">Necesidad visita/inspección</td><td>${show(data.vivienda.visita_inspeccion)} · ${show(data.vivienda.motivo_visita)}</td><td class="label">Registro fotográfico</td><td>${show(data.vivienda.registro_fotografico)} · ${show(data.vivienda.codigo_fotografico)}</td></tr>
    </table>

    <h2>8. DIAGNÓSTICO SOCIOECONÓMICO BÁSICO</h2>
    <table>
      <tr><td class="label">Ocupación / oficio</td><td>${show(data.socioeconomico.ocupacion)}</td><td class="label">Situación laboral actual</td><td>${show(data.socioeconomico.situacion_laboral)}</td></tr>
      <tr><td class="label">Fuente ingreso antes</td><td>${show(list(data.socioeconomico.fuente_antes))}</td><td class="label">Fuente ingreso actual</td><td>${show(data.socioeconomico.fuente_actual)}</td></tr>
      <tr><td class="label">Rango ingreso mensual</td><td>${show(data.socioeconomico.rango_ingreso)}</td><td class="label">Personas dependientes</td><td>NNA: ${show(data.socioeconomico.dependientes_nna)} · Adultos mayores: ${show(data.socioeconomico.dependientes_adultos)} · Discapacidad: ${show(data.socioeconomico.dependientes_discapacidad)}</td></tr>
      <tr><td class="label">Red de apoyo</td><td>${show(list(data.socioeconomico.red_apoyo))}</td><td class="label">Puede alojarse con familiar</td><td>${show(data.socioeconomico.alojamiento_familiar)}</td></tr>
    </table>
    <div class="footer">OAC SAREN – Instrumento de ingreso familiar y atención social/documental | Uso interno</div>
  </section>

  <section class="page">
    <h2>9. REQUERIMIENTOS INMEDIATOS PRIORIZADOS</h2>
    <table><tr><td>${show(list(data.requerimientos))}${data.otro_requerimiento ? ` · Otro: ${show(data.otro_requerimiento)}` : ''}</td></tr></table>

    <h2>10. ARTICULACIONES, ATENCIÓN PSICOLÓGICA, ACCIONES Y SEGUIMIENTO</h2>
    <table class="members">
      <thead><tr><th>Fecha</th><th>Tipo de atención</th><th>Motivo / requerimiento</th><th>Instancia destino</th><th>Responsable</th><th>Estatus / resultado</th></tr></thead>
      <tbody>${followupRows(data.seguimientos)}</tbody>
    </table>

    <h2>11. OBSERVACIONES FINALES DEL PROFESIONAL OAC</h2>
    <table><tr><td style="height:35mm;vertical-align:top">${show(data.observaciones_finales)}</td></tr></table>
    <p class="note"><strong>Consentimiento y protección de datos:</strong> ${data.consentimiento ? 'La persona entrevistada autorizó el uso institucional de la información registrada.' : 'Consentimiento pendiente de registrar.'}</p>

    <h2>12. FIRMAS</h2>
    <table>
      <tr><th>Firma del profesional entrevistador OAC</th><th>Firma o huella de la persona entrevistada / representante familiar</th></tr>
      <tr>
        <td class="signature">____________________________<br />Nombre: ${show(professional)}<br />C.I.: ${show(professionalDocument)}</td>
        <td class="signature">____________________________<br />Nombre: ${show(representative ? `${representative.first_name} ${representative.last_name}` : '')}<br />C.I.: ${show(representative?.document_id)}</td>
      </tr>
      <tr><td>Fecha de cierre o actualización: ${show(data.fecha_cierre)}</td><td>Resultado del caso: ${show(data.resultado_caso)}</td></tr>
    </table>
    <div class="footer">OAC SAREN – Instrumento de ingreso familiar y atención social/documental | Uso interno</div>
  </section>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('El navegador bloqueó la ventana de impresión. Habilite las ventanas emergentes para este sitio.');
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
