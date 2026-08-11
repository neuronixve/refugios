import React, { useEffect, useMemo, useState } from 'react';
import { downloadExcel } from '../utils/exportExcel';

const PRIORITY_CONDITIONS = [
  'Niño, Niña o Adolescente (NNA) no acompañado',
  'NNA separado bajo cuidado de familiar lejano, vecino u otra persona',
  'NNA sin documento o con documento perdido/dañado',
  'Adulto mayor solo, sin cuidador o en abandono evidente',
  'Persona con discapacidad o movilidad reducida',
  'Embarazo o lactancia',
  'Persona con enfermedad crónica o tratamiento permanente',
  'Riesgo de protección / violencia / situación familiar sensible'
];
const isBedOccupied = bed => bed?.resident_id !== null && bed?.resident_id !== undefined;

const COLORS = ['#0b3a75', '#2563eb', '#f59e0b', '#ef4444', '#16a34a', '#7c3aed', '#0891b2', '#db2777'];

const safeJson = value => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const ageOf = birthDate => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

const dateKey = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const formatNumber = value => new Intl.NumberFormat('es-VE').format(Math.round(Number(value) || 0));
const percentage = (value, total) => total ? Math.round((value / total) * 100) : 0;
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const display = value => value === undefined || value === null || value === '' ? 'No registrado' : String(value);
const yesNo = value => ['si', 'sí', 'true'].includes(normalize(value)) ? 'Sí' : 'No';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[character]));
const countBy = (rows, valueGetter, emptyLabel = 'No registrado') => {
  const totals = {};
  rows.forEach(row => {
    const label = display(valueGetter(row)) === 'No registrado' ? emptyLabel : display(valueGetter(row));
    totals[label] = (totals[label] || 0) + 1;
  });
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
};
const toChartData = (rows, getter, limit = 8) => countBy(rows, getter).slice(0, limit)
  .map(([label, value], index) => ({ label, value, color: COLORS[index % COLORS.length] }));
const donationItems = donation => {
  const parsed = safeJson(donation.items_json);
  return Array.isArray(parsed) ? parsed : [];
};
const donationItemsText = donation => donationItems(donation)
  .map(item => `${item.name || item.item || 'Artículo'}: ${item.quantity || 0} ${item.unit || 'unidades'}`)
  .join(' · ') || 'Sin artículos registrados';

const residentProfile = resident => {
  const meta = safeJson(resident.special_needs);
  const age = ageOf(resident.birth_date);
  const employment = meta.empleo || {};
  const plan = meta.planilla_persona || {};
  const priorityText = plan.condicion_prioritaria || '';
  const pregnancyWeeks = Number(plan.embarazo_semanas || meta.embarazo_semanas) || null;
  const lactationAge = plan.lactancia_edad || meta.lactancia_edad || '';
  const explicitMaternityStatus = [
    pregnancyWeeks || meta.nutricion_especial === 'Embarazada' || meta.embarazo ? 'Embarazada' : '',
    lactationAge || meta.nutricion_especial === 'Madre lactante' || meta.lactancia ? 'En lactancia' : ''
  ].filter(Boolean).join(' y ');
  const maternityStatus = explicitMaternityStatus || (normalize(priorityText).includes('embarazo') ? 'Sin especificar (alerta embarazo/lactancia)' : 'No aplica');
  return {
    ...resident,
    meta,
    age,
    fullName: `${resident.first_name || ''} ${resident.last_name || ''}`.trim(),
    profession: employment.oficio_profesion || meta.oficio_profesion || 'No indicada',
    employed: employment.tiene_empleo === 'Sí' || meta.tiene_empleo === 'Sí',
    priorityText,
    pathologies: Array.isArray(meta.preexisting) ? meta.preexisting : [],
    dietaryNeed: meta.nutricion_especial || meta.diet || 'Ninguna / General',
    housing: meta.estado_vivienda || 'Sin información',
    documentMissing: !resident.document_id || meta.documento_perdido === true || ['perdido', 'no porta', 'sin documento'].includes(normalize(plan.estatus_documento)),
    schoolStatus: meta.escolarizado || '',
    disability: meta.discapacidad || plan.ayuda_tecnica || 'Ninguna',
    requiresMedical: plan.requiere_evaluacion_medica || 'No',
    psychosocial: plan.apoyo_psicosocial || 'No requerido',
    pregnancyWeeks,
    lactationAge,
    maternityStatus,
    technicalAid: plan.ayuda_tecnica || 'No registrada',
    treatment: meta.treatments || plan.tratamiento_diario || 'No registrado',
    refrigeration: plan.requiere_refrigeracion || 'No',
    observations: plan.observaciones || '',
    documentStatus: plan.estatus_documento || (!resident.document_id ? 'Sin documento' : 'En mano'),
    documentType: plan.tipo_documento || (resident.document_id ? 'C.I.' : 'No registrado'),
    schoolName: meta.centro_educativo || 'No registrado',
    schoolGrade: meta.grado_cursado || 'No registrado',
    tenure: meta.tenencia_vivienda || 'No registrada',
    origin: [meta.procedencia_estado, meta.municipio, meta.barrioSector].filter(Boolean).join(' · ') || 'No registrada',
    sector: meta.barrioSector || 'No registrado',
    municipality: meta.municipio || 'No registrado',
    dependents: meta.personas_a_cargo ?? meta.menores_a_cargo ?? 'No registrado',
    company: employment.empresa || 'No registrada',
    schedule: employment.horario || 'No registrado',
    allergies: Array.isArray(meta.allergies) ? meta.allergies : [],
    admissionDate: dateKey(resident.created_at)
  };
};

const BASE_COLUMNS = [
  { key: 'name', label: 'Persona / familia', value: row => `${row.fullName} · ${row.family_name || 'Sin grupo familiar'}` },
  { key: 'document', label: 'Documento', value: row => row.document_id || 'Sin documento', mono: true },
  { key: 'ageGender', label: 'Edad / sexo', value: row => `${row.age ?? 'N/R'} años · ${row.gender || 'N/R'}` },
  { key: 'site', label: 'Sede', value: row => row.refugio_name || 'N/R' }
];

const makeSummary = (label, value, detail = '') => ({ label, value, detail });
const topSummary = (rows, getter, limit = 4) => countBy(rows, getter).slice(0, limit)
  .map(([label, value]) => makeSummary(label, formatNumber(value), `${percentage(value, rows.length)}% del detalle`));

const detailPresentation = (type, rows, focus = '', options = {}) => {
  if (type === 'inventory') {
    const deficit = row => Math.max(0, Number(row.min_threshold || 0) - Number(row.quantity || 0));
    return {
      search: 'Buscar por insumo, categoría, sede, estado o unidad…',
      summary: [
        makeSummary('Renglones críticos', formatNumber(rows.length), 'Requieren reposición'),
        makeSummary('Sin existencias', formatNumber(rows.filter(row => Number(row.quantity) === 0).length), 'Agotados'),
        makeSummary('Déficit acumulado', formatNumber(rows.reduce((sum, row) => sum + deficit(row), 0)), 'En las unidades declaradas'),
        makeSummary('Sedes afectadas', formatNumber(new Set(rows.map(row => row.refugio_id)).size), 'Con al menos una alerta')
      ],
      charts: [
        { title: 'Renglones críticos por categoría', type: 'bar', data: toChartData(rows, row => row.category) },
        { title: 'Distribución por estado', type: 'donut', data: toChartData(rows, row => row.status) }
      ],
      columns: [
        { key: 'item', label: 'Insumo', value: row => row.item_name },
        { key: 'category', label: 'Categoría', value: row => row.category },
        { key: 'site', label: 'Sede', value: row => row.refugio_name || 'No registrada' },
        { key: 'stock', label: 'Existencia actual', value: row => `${row.quantity || 0} ${row.unit || 'unidades'}` },
        { key: 'minimum', label: 'Nivel mínimo', value: row => `${row.min_threshold || 0} ${row.unit || 'unidades'}` },
        { key: 'deficit', label: 'Déficit para mínimo', value: row => `${deficit(row)} ${row.unit || 'unidades'}` },
        { key: 'status', label: 'Estado', value: row => row.status || 'No registrado' },
        { key: 'updated', label: 'Actualización', value: row => dateKey(row.updated_at) || 'No registrada' }
      ]
    };
  }
  if (type === 'donations') {
    const totalUnits = rows.reduce((sum, donation) => sum + donationItems(donation).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
    const itemRows = rows.flatMap(donation => donationItems(donation).map(item => ({ ...item, donation })));
    const itemTotals = {};
    itemRows.forEach(item => {
      const label = item.name || item.item || 'Artículo';
      itemTotals[label] = (itemTotals[label] || 0) + Number(item.quantity || 0);
    });
    return {
      search: 'Buscar por donante, organización, artículo, destino, sede o fecha…',
      summary: [
        makeSummary('Donaciones', formatNumber(rows.length), 'En el período'),
        makeSummary('Cantidad declarada', formatNumber(totalUnits), 'Suma en las unidades originales'),
        makeSummary('Organizaciones', formatNumber(new Set(rows.map(row => row.donor_organization).filter(Boolean)).size), 'Tipos de procedencia'),
        makeSummary('Sedes receptoras', formatNumber(new Set(rows.map(row => row.refugio_id).filter(Boolean)).size), 'Destinos atendidos')
      ],
      charts: [
        { title: 'Donaciones por tipo de organización', type: 'donut', data: toChartData(rows, row => row.donor_organization || 'Sin organización') },
        { title: 'Cantidades recibidas por artículo', type: 'bar', data: Object.entries(itemTotals).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8) }
      ],
      columns: [
        { key: 'donor', label: 'Donante', value: row => row.donor_name || 'No registrado' },
        { key: 'organization', label: 'Organización', value: row => row.donor_organization || 'No registrada' },
        { key: 'items', label: 'Artículos / cantidades', value: row => donationItemsText(row) },
        { key: 'site', label: 'Sede', value: row => row.refugio_name || 'No registrada' },
        { key: 'warehouse', label: 'Almacén destino', value: row => row.destination_warehouse || 'No registrado' },
        { key: 'contact', label: 'Contacto', value: row => [row.donor_phone, row.donor_email].filter(Boolean).join(' · ') || 'No registrado' },
        { key: 'date', label: 'Fecha de recepción', value: row => dateKey(row.received_at) || 'No registrada' }
      ]
    };
  }
  if (type === 'incidents') {
    return {
      search: 'Buscar por tipo, persona, descripción, acción, responsable, sede o fecha…',
      summary: [
        makeSummary('Incidencias', formatNumber(rows.length), 'En el período'),
        makeSummary('Emergencias', formatNumber(rows.filter(row => row.incident_type === 'Emergencia').length), 'Atención inmediata'),
        makeSummary('Personas involucradas', formatNumber(new Set(rows.map(row => row.resident_id).filter(Boolean)).size), 'Residentes únicos'),
        makeSummary('Sedes con eventos', formatNumber(new Set(rows.map(row => row.refugio_id).filter(Boolean)).size), 'Distribución territorial')
      ],
      charts: [
        { title: 'Incidencias por tipo', type: 'donut', data: toChartData(rows, row => row.incident_type || 'Novedad') },
        { title: 'Incidencias por sede', type: 'bar', data: toChartData(rows, row => row.refugio_name || 'Sin sede') }
      ],
      columns: [
        { key: 'type', label: 'Tipo', value: row => row.incident_type || 'Novedad' },
        { key: 'date', label: 'Fecha', value: row => dateKey(row.logged_at) || 'No registrada' },
        { key: 'site', label: 'Sede', value: row => row.refugio_name || 'No registrada' },
        { key: 'resident', label: 'Persona vinculada', value: row => [row.resident_first_name, row.resident_last_name].filter(Boolean).join(' ') || 'Sin persona vinculada' },
        { key: 'description', label: 'Descripción', value: row => row.description || 'No registrada' },
        { key: 'action', label: 'Acción tomada', value: row => row.action_taken || 'Pendiente por registrar' },
        { key: 'reporter', label: 'Reportado por', value: row => row.reporter_name || 'No registrado' }
      ]
    };
  }
  if (type === 'occupancy') {
    const occupied = rows.filter(isBedOccupied);
    return {
      search: 'Buscar por sede, pabellón, cama, estado, residente o documento…',
      summary: [
        makeSummary('Plazas', formatNumber(rows.length), 'Capacidad configurada'),
        makeSummary('Ocupadas', formatNumber(occupied.length), `${percentage(occupied.length, rows.length)}% de ocupación`),
        makeSummary('Disponibles', formatNumber(rows.filter(row => row.status === 'Disponible').length), 'Capacidad inmediata'),
        makeSummary('Otros estados', formatNumber(rows.filter(row => !['Ocupada', 'Disponible'].includes(row.status)).length), 'Bloqueadas o mantenimiento')
      ],
      charts: [
        { title: 'Estado de las plazas', type: 'donut', data: toChartData(rows, row => row.status || 'No registrado') },
        { title: 'Ocupación por pabellón o espacio', type: 'bar', data: toChartData(occupied, row => row.room_number || 'Sin espacio', 12) }
      ],
      columns: [
        { key: 'site', label: 'Sede', value: row => row.refugio_name || 'No registrada' },
        { key: 'room', label: 'Pabellón / espacio', value: row => row.room_number || 'No registrado' },
        { key: 'bed', label: 'Cama', value: row => row.bed_number || 'No registrada' },
        { key: 'status', label: 'Estado', value: row => row.status || 'No registrado' },
        { key: 'resident', label: 'Residente asignado', value: row => [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Sin asignación' },
        { key: 'document', label: 'Documento', value: row => row.document_id || 'Sin documento' }
      ]
    };
  }
  if (type === 'meals') {
    const uniqueDays = new Set(rows.map(row => dateKey(row.meal_date)).filter(Boolean)).size || 1;
    const dailyAverage = rows.length / uniqueDays;
    const horizon = Number(options.projectionDays || 7);
    const projectedRations = Math.round(dailyAverage * horizon);
    const requirementRates = [
      ['Cereales, harinas y tubérculos', 0.18],
      ['Proteínas', 0.12],
      ['Vegetales y legumbres', 0.12],
      ['Frutas', 0.08],
      ['Aceites y condimentos', 0.03],
      ['Bebidas y complementos', 0.02]
    ];
    return {
      search: 'Buscar por fecha, comida, persona, documento o sede…',
      summary: [
        makeSummary('Raciones registradas', formatNumber(rows.length), `${uniqueDays} días con actividad`),
        makeSummary('Promedio diario', formatNumber(dailyAverage), 'Raciones por día observado'),
        makeSummary(`Proyección ${horizon} días`, formatNumber(projectedRations), 'Si se mantiene el promedio'),
        makeSummary('Masa alimentaria', `${formatNumber(projectedRations * 0.55)} kg`, 'Proyección a 0,55 kg por ración')
      ],
      charts: [
        { title: 'Raciones por tipo de comida', type: 'donut', data: toChartData(rows, row => row.meal_type || 'No registrada') },
        { title: 'Raciones por sede', type: 'bar', data: toChartData(rows, row => row.refugio_name || 'Sin sede') }
      ],
      projection: {
        horizon,
        projectedRations,
        requirements: requirementRates.map(([label, rate]) => ({ label, value: Math.round(projectedRations * rate), unit: 'kg' }))
      },
      columns: [
        { key: 'date', label: 'Fecha', value: row => dateKey(row.meal_date) || 'No registrada' },
        { key: 'meal', label: 'Comida', value: row => row.meal_type || 'No registrada' },
        { key: 'site', label: 'Sede', value: row => row.refugio_name || 'No registrada' },
        { key: 'person', label: 'Persona atendida', value: row => [row.first_name, row.last_name].filter(Boolean).join(' ') || 'No registrada' },
        { key: 'document', label: 'Documento', value: row => row.document_id || 'Sin documento' },
        { key: 'type', label: 'Tipo de persona', value: row => row.person_type === 'staff' ? 'Personal' : 'Residente' },
        { key: 'time', label: 'Hora de atención', value: row => row.attended_at ? new Date(row.attended_at).toLocaleString('es-VE') : 'No registrada' }
      ]
    };
  }

  const healthAlerts = rows.filter(row => row.pathologies?.length || row.priorityText).length;
  const commonSummary = [
    makeSummary('Personas', formatNumber(rows.length), 'Total del detalle'),
    makeSummary('Mujeres', formatNumber(rows.filter(row => row.gender === 'Femenino').length), `${percentage(rows.filter(row => row.gender === 'Femenino').length, rows.length)}%`),
    makeSummary('Menores de 18', formatNumber(rows.filter(row => row.age !== null && row.age < 18).length), 'Niños y adolescentes'),
    makeSummary('Con alertas', formatNumber(healthAlerts), 'Salud o protección')
  ];
  const definitions = {
    population: {
      search: 'Buscar por persona, documento, sede, edad, sexo o familia…',
      summary: commonSummary,
      columns: [...BASE_COLUMNS, { label: 'Familia / condición', value: row => row.priorityText || 'Sin alerta prioritaria' }, { label: 'Salud', value: row => `${row.health_status || 'N/R'}${row.pathologies.length ? ` · ${row.pathologies.join(', ')}` : ''}` }]
    },
    admission: {
      search: 'Buscar por persona, fecha de ingreso, sede o documento…',
      summary: [
        makeSummary('Ingresos', formatNumber(rows.length), 'En el período seleccionado'),
        ...topSummary(rows, row => row.admissionDate || 'Fecha no registrada', 3)
      ],
      columns: [...BASE_COLUMNS, { label: 'Fecha de ingreso', value: row => row.admissionDate || 'No registrada' }, { label: 'Condición al ingreso', value: row => row.health_status || 'No registrada' }]
    },
    demographic: {
      search: 'Buscar por persona, edad, sexo, documento o sede…',
      summary: [
        makeSummary('Personas', formatNumber(rows.length), focus || 'Segmento demográfico'),
        ...topSummary(rows, row => row.age < 6 ? '0–5 años' : row.age < 12 ? '6–11 años' : row.age < 18 ? '12–17 años' : row.age < 60 ? '18–59 años' : '60 años o más', 5)
      ],
      columns: [...BASE_COLUMNS, { label: 'Documento', value: row => `${row.documentStatus} · ${row.documentType}` }, { label: 'Necesidad relevante', value: row => row.priorityText || row.dietaryNeed || 'Sin necesidad registrada' }]
    },
    children: {
      search: 'Buscar por niño, edad, escolaridad, grado, documento o sede…',
      summary: [
        makeSummary('Niños y adolescentes', formatNumber(rows.length), 'Menores de 18 años'),
        makeSummary('No escolarizados', formatNumber(rows.filter(row => row.age >= 3 && row.schoolStatus !== 'Sí').length), 'Requieren continuidad educativa'),
        makeSummary('Sin documento', formatNumber(rows.filter(row => row.documentMissing).length), 'Brecha de identificación'),
        makeSummary('Necesidad nutricional', formatNumber(rows.filter(row => !['Ninguna', 'Ninguna / General'].includes(row.dietaryNeed)).length), 'Dieta o alimentación especial')
      ],
      columns: [...BASE_COLUMNS, { label: 'Escolaridad', value: row => `${row.schoolStatus || 'No registrada'} · ${row.schoolGrade} · ${row.schoolName}` }, { label: 'Estatus documental', value: row => `${row.documentStatus} · ${row.documentType}` }, { label: 'Cuidado / nutrición', value: row => `${row.dietaryNeed}${row.priorityText ? ` · ${row.priorityText}` : ''}` }]
    },
    elderly: {
      search: 'Buscar por adulto mayor, enfermedad, discapacidad, dieta o sede…',
      summary: [
        makeSummary('Adultos mayores', formatNumber(rows.length), '60 años o más'),
        makeSummary('Con enfermedad crónica', formatNumber(rows.filter(row => row.pathologies.length).length), 'Seguimiento sanitario'),
        makeSummary('Con discapacidad', formatNumber(rows.filter(row => row.disability !== 'Ninguna').length), 'Accesibilidad y apoyo'),
        makeSummary('Dieta especial', formatNumber(rows.filter(row => !['Ninguna', 'Ninguna / General'].includes(row.dietaryNeed)).length), 'Requerimiento nutricional')
      ],
      columns: [...BASE_COLUMNS, { label: 'Salud / tratamiento', value: row => `${row.pathologies.join(', ') || 'Sin patología'} · ${row.treatment}` }, { label: 'Discapacidad / ayuda', value: row => `${row.disability} · ${row.technicalAid}` }, { label: 'Nutrición', value: row => row.dietaryNeed }]
    },
    maternity: {
      search: 'Buscar por mujer, embarazo, lactancia, semanas, edad del lactante o sede…',
      summary: [
        makeSummary('Embarazadas', formatNumber(rows.filter(row => row.maternityStatus.includes('Embarazada')).length), 'Con semanas registradas o alerta'),
        makeSummary('Madres lactantes', formatNumber(rows.filter(row => row.maternityStatus.includes('lactancia')).length), 'Con lactancia registrada'),
        makeSummary('Sin especificar', formatNumber(rows.filter(row => row.maternityStatus.startsWith('Sin especificar')).length), 'Debe precisarse embarazo o lactancia'),
        makeSummary('Promedio de gestación', rows.filter(row => row.pregnancyWeeks).length ? `${Math.round(rows.filter(row => row.pregnancyWeeks).reduce((sum, row) => sum + row.pregnancyWeeks, 0) / rows.filter(row => row.pregnancyWeeks).length)} semanas` : 'Sin dato', 'Solo embarazos con semanas'),
        makeSummary('Evaluación médica', formatNumber(rows.filter(row => row.requiresMedical !== 'No').length), 'Indicada en la ficha')
      ],
      charts: [
        { title: 'Condición materna registrada', type: 'donut', data: toChartData(rows, row => row.maternityStatus) },
        { title: 'Requerimiento nutricional', type: 'bar', data: toChartData(rows, row => row.dietaryNeed) }
      ],
      columns: [...BASE_COLUMNS, { label: 'Condición', value: row => row.maternityStatus }, { label: 'Semanas de embarazo', value: row => row.pregnancyWeeks ? `${row.pregnancyWeeks} semanas` : 'No aplica / no registrado' }, { label: 'Edad del lactante', value: row => row.lactationAge || 'No aplica / no registrada' }, { label: 'Seguimiento', value: row => `${row.requiresMedical} · Nutrición: ${row.dietaryNeed}` }]
    },
    disability: {
      search: 'Buscar por persona, tipo de discapacidad, ayuda técnica, edad o sede…',
      summary: [
        makeSummary('Personas', formatNumber(rows.length), 'Con discapacidad o movilidad reducida'),
        ...topSummary(rows, row => row.disability || 'No especificada', 5)
      ],
      charts: [
        { title: 'Tipos de discapacidad', type: 'bar', data: toChartData(rows, row => row.disability) },
        { title: 'Ayudas técnicas requeridas', type: 'donut', data: toChartData(rows, row => row.technicalAid) }
      ],
      columns: [...BASE_COLUMNS, { label: 'Tipo de discapacidad', value: row => row.disability }, { label: 'Ayuda técnica', value: row => row.technicalAid }, { label: 'Evaluación médica', value: row => row.requiresMedical }, { label: 'Salud asociada', value: row => row.pathologies.join(', ') || row.health_status || 'Sin condición asociada' }]
    },
    pathology: {
      search: 'Buscar por persona, tratamiento, evaluación, patología, documento o sede…',
      summary: [
        makeSummary('Casos', formatNumber(rows.length), focus || 'Condición médica'),
        makeSummary('Con tratamiento', formatNumber(rows.filter(row => row.treatment !== 'No registrado').length), 'Tratamiento declarado'),
        makeSummary('Evaluación indicada', formatNumber(rows.filter(row => row.requiresMedical !== 'No').length), 'Médica o prioritaria'),
        makeSummary('Refrigeración', formatNumber(rows.filter(row => yesNo(row.refrigeration) === 'Sí').length), 'Medicamento que requiere frío')
      ],
      columns: [...BASE_COLUMNS, { label: 'Patologías', value: row => row.pathologies.join(', ') || focus || 'No registrada' }, { label: 'Tratamiento', value: row => row.treatment }, { label: 'Evaluación', value: row => row.requiresMedical }, { label: 'Refrigeración / alergias', value: row => `${row.refrigeration} · ${row.allergies.join(', ') || 'Sin alergias registradas'}` }]
    },
    priority: {
      search: 'Buscar por persona, condición prioritaria, edad, documento o sede…',
      summary: [
        makeSummary('Personas', formatNumber(rows.length), focus || 'Condición prioritaria'),
        makeSummary('Menores', formatNumber(rows.filter(row => row.age < 18).length), 'Niños y adolescentes'),
        makeSummary('Sin documento', formatNumber(rows.filter(row => row.documentMissing).length), 'Gestión documental'),
        makeSummary('Evaluación médica', formatNumber(rows.filter(row => row.requiresMedical !== 'No').length), 'Atención indicada')
      ],
      columns: [...BASE_COLUMNS, { label: 'Condición prioritaria', value: row => row.priorityText || focus }, { label: 'Respuesta requerida', value: row => `${row.requiresMedical} · ${row.psychosocial}${row.observations ? ` · ${row.observations}` : ''}` }]
    },
    alerts: {
      search: 'Buscar por persona, alerta, patología, evaluación, documento o sede…',
      summary: [
        makeSummary('Personas con alertas', formatNumber(rows.length), 'Salud o protección'),
        makeSummary('Condición prioritaria', formatNumber(rows.filter(row => row.priorityText).length), 'Alerta SAREN registrada'),
        makeSummary('Patologías', formatNumber(rows.filter(row => row.pathologies.length).length), 'Seguimiento sanitario'),
        makeSummary('Evaluación indicada', formatNumber(rows.filter(row => row.requiresMedical !== 'No').length), 'Médica o prioritaria'),
        makeSummary('Insumos críticos', formatNumber(options.criticalStockCount || 0), 'Renglones bajo mínimo'),
        makeSummary('Incidencias', formatNumber(options.incidentCount || 0), 'En el período seleccionado')
      ],
      charts: [
        { title: 'Condiciones prioritarias', type: 'bar', data: PRIORITY_CONDITIONS.map(condition => ({ label: condition, value: rows.filter(row => normalize(row.priorityText).includes(normalize(condition))).length })).filter(item => item.value).sort((a, b) => b.value - a.value) },
        { title: 'Estado de salud', type: 'donut', data: toChartData(rows, row => row.health_status || 'No registrado') }
      ],
      columns: [...BASE_COLUMNS, { label: 'Alerta prioritaria', value: row => row.priorityText || 'Sin alerta social' }, { label: 'Patologías / salud', value: row => `${row.pathologies.join(', ') || 'Sin patología'} · ${row.health_status || 'N/R'}` }, { label: 'Respuesta indicada', value: row => `${row.requiresMedical} · ${row.psychosocial}` }]
    },
    medical: {
      search: 'Buscar por persona, prioridad médica, patología, tratamiento o sede…',
      summary: [
        makeSummary('Evaluaciones', formatNumber(rows.length), 'Indicadas en la ficha'),
        ...topSummary(rows, row => row.requiresMedical, 3),
        makeSummary('Con patologías', formatNumber(rows.filter(row => row.pathologies.length).length), 'Condición declarada')
      ],
      columns: [...BASE_COLUMNS, { label: 'Nivel de evaluación', value: row => row.requiresMedical }, { label: 'Patología / estado', value: row => `${row.pathologies.join(', ') || 'Sin patología declarada'} · ${row.health_status || 'N/R'}` }, { label: 'Tratamiento', value: row => row.treatment }, { label: 'Observaciones', value: row => row.observations || 'Sin observaciones' }]
    },
    psychosocial: {
      search: 'Buscar por persona, tipo de apoyo, alerta, observación o sede…',
      summary: [
        makeSummary('Personas', formatNumber(rows.length), 'Con apoyo psicosocial'),
        ...topSummary(rows, row => row.psychosocial, 5)
      ],
      columns: [...BASE_COLUMNS, { label: 'Apoyo requerido', value: row => row.psychosocial }, { label: 'Alerta de protección', value: row => row.priorityText || 'Sin alerta adicional' }, { label: 'Observación profesional', value: row => row.observations || 'No registrada' }]
    },
    nutrition: {
      search: 'Buscar por persona, dieta, alergia, edad, embarazo o sede…',
      summary: [
        makeSummary('Personas', formatNumber(rows.length), 'Con requerimiento nutricional'),
        ...topSummary(rows, row => row.dietaryNeed, 5)
      ],
      columns: [...BASE_COLUMNS, { label: 'Requerimiento nutricional', value: row => row.dietaryNeed }, { label: 'Embarazo / lactancia', value: row => row.maternityStatus }, { label: 'Alergias', value: row => row.allergies.join(', ') || 'Sin alergias registradas' }, { label: 'Salud relacionada', value: row => row.pathologies.join(', ') || 'Sin patología registrada' }]
    },
    employment: {
      search: 'Buscar por persona, situación laboral, oficio, empresa, horario o sede…',
      summary: [
        makeSummary('Personas adultas', formatNumber(rows.length), focus || 'Situación laboral'),
        ...topSummary(rows, row => row.profession, 5)
      ],
      charts: [
        { title: 'Oficios y profesiones', type: 'bar', data: toChartData(rows, row => row.profession) },
        { title: 'Situación laboral', type: 'donut', data: toChartData(rows, row => row.employed ? 'Con empleo' : 'Sin empleo') }
      ],
      columns: [...BASE_COLUMNS, { label: 'Situación laboral', value: row => row.employed ? 'Con empleo' : 'Sin empleo' }, { label: 'Oficio / profesión', value: row => row.profession }, { label: 'Empresa / horario', value: row => row.employed ? `${row.company} · ${row.schedule}` : 'Disponible para inserción laboral' }, { label: 'Personas a cargo', value: row => row.dependents }]
    },
    documentation: {
      search: 'Buscar por persona, estatus documental, tipo requerido, edad o sede…',
      summary: [
        makeSummary('Personas', formatNumber(rows.length), 'Con brecha documental'),
        ...topSummary(rows, row => row.documentStatus, 4)
      ],
      charts: [
        { title: 'Estatus documental', type: 'donut', data: toChartData(rows, row => row.documentStatus) },
        { title: 'Documento requerido', type: 'bar', data: toChartData(rows, row => row.documentType) }
      ],
      columns: [...BASE_COLUMNS, { label: 'Estatus documental', value: row => row.documentStatus }, { label: 'Documento requerido', value: row => row.documentType }, { label: 'Condición prioritaria', value: row => row.priorityText || 'Sin alerta adicional' }, { label: 'Procedencia', value: row => row.origin }]
    },
    housing: {
      search: 'Buscar por persona, condición de vivienda, tenencia, procedencia o sede…',
      summary: [
        makeSummary('Personas afectadas', formatNumber(rows.length), 'Pérdida o daño del hogar'),
        makeSummary('Familias afectadas', formatNumber(new Set(rows.map(row => row.family_group_id).filter(Boolean)).size), 'Núcleos familiares únicos'),
        ...topSummary(rows, row => row.housing, 4)
      ],
      charts: [
        { title: 'Tenencia de la vivienda', type: 'bar', data: toChartData(rows, row => row.tenure) },
        { title: 'Procedencia por sector', type: 'bar', data: toChartData(rows, row => row.sector, 12) },
        { title: 'Procedencia por municipio', type: 'donut', data: toChartData(rows, row => row.municipality) }
      ],
      columns: [...BASE_COLUMNS, { label: 'Condición de vivienda', value: row => row.housing }, { label: 'Tenencia', value: row => row.tenure }, { label: 'Procedencia', value: row => row.origin }, { label: 'Personas a cargo', value: row => row.dependents }]
    },
    education: {
      search: 'Buscar por niño, edad, grado, institución, documento o sede…',
      summary: [
        makeSummary('Menores', formatNumber(rows.length), 'Con brecha de continuidad'),
        ...topSummary(rows, row => row.age < 6 ? 'Edad inicial' : row.age < 12 ? 'Edad primaria' : 'Edad media', 3),
        makeSummary('Sin documento', formatNumber(rows.filter(row => row.documentMissing).length), 'Puede afectar la inscripción')
      ],
      charts: [
        { title: 'Etapa educativa por edad', type: 'bar', data: toChartData(rows, row => row.age < 6 ? 'Edad inicial' : row.age < 12 ? 'Edad primaria' : 'Edad media') },
        { title: 'Estatus documental', type: 'donut', data: toChartData(rows, row => row.documentStatus) }
      ],
      columns: [...BASE_COLUMNS, { label: 'Escolarización', value: row => row.schoolStatus || 'No registrada' }, { label: 'Último grado', value: row => row.schoolGrade }, { label: 'Centro educativo', value: row => row.schoolName }, { label: 'Estatus documental', value: row => row.documentStatus }]
    }
  };
  return definitions[type] || definitions.population;
};

function DonutChart({ segments, centerValue, centerLabel, onSelect }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-44 h-44 shrink-0">
        <svg viewBox="0 0 42 42" className="-rotate-90 w-full h-full" role="img" aria-label={centerLabel}>
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e7ebf2" strokeWidth="6" />
          {segments.map((item, index) => {
            const size = total ? (item.value / total) * 100 : 0;
            const circle = (
              <circle
                key={item.label}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={item.color || COLORS[index % COLORS.length]}
                strokeWidth="6"
                strokeDasharray={`${size} ${100 - size}`}
                strokeDashoffset={-offset}
                className={onSelect ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}
                onClick={() => onSelect?.(item)}
              />
            );
            offset += size;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <strong className="text-2xl font-black text-primary">{formatNumber(centerValue)}</strong>
          <span className="text-[9px] font-bold text-on-surface-variant uppercase max-w-20">{centerLabel}</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2">
        {segments.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect?.(item)}
            className="w-full flex items-center justify-between gap-3 text-left rounded-lg px-2 py-1.5 hover:bg-surface-container disabled:hover:bg-transparent"
            disabled={!onSelect}
          >
            <span className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color || COLORS[index % COLORS.length] }} />
              {item.label}
            </span>
            <span className="text-xs font-black text-on-surface">{formatNumber(item.value)} <small className="text-[9px] text-on-surface-variant">({percentage(item.value, total)}%)</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ data, onSelect, valueSuffix = '' }) {
  const max = Math.max(1, ...data.map(item => Number(item.value) || 0));
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <button
          type="button"
          key={item.label}
          onClick={() => onSelect?.(item)}
          disabled={!onSelect}
          className="w-full text-left group disabled:cursor-default"
        >
          <div className="flex justify-between gap-3 mb-1">
            <span className="text-[10px] font-bold text-on-surface-variant truncate">{item.label}</span>
            <span className="text-[10px] font-black text-on-surface">{formatNumber(item.value)}{valueSuffix}</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full rounded-full transition-all group-hover:brightness-110"
              style={{ width: `${Math.max(item.value ? 3 : 0, (item.value / max) * 100)}%`, background: item.color || COLORS[index % COLORS.length] }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

function LineChart({ data, color = '#2563eb', valueLabel = 'valor' }) {
  const width = 680;
  const height = 190;
  const padX = 32;
  const padY = 22;
  const max = Math.max(1, ...data.map(item => item.value));
  const points = data.map((item, index) => {
    const x = padX + (index / Math.max(1, data.length - 1)) * (width - padX * 2);
    const y = height - padY - (item.value / max) * (height - padY * 2);
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = points.length ? `${path} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z` : '';

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-h-44" role="img" aria-label={`Evolución de ${valueLabel}`}>
        {[0, 0.25, 0.5, 0.75, 1].map(step => {
          const y = height - padY - step * (height - padY * 2);
          return <line key={step} x1={padX} x2={width - padX} y1={y} y2={y} stroke="#d9dfeb" strokeWidth="1" strokeDasharray="3 4" />;
        })}
        {area && <path d={area} fill={color} opacity="0.1" />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="white" stroke={color} strokeWidth="2">
              <title>{point.label}: {formatNumber(point.value)} {valueLabel}</title>
            </circle>
            {(index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 6)) === 0) && (
              <text x={point.x} y={height - 5} textAnchor="middle" fontSize="8" fill="#667085">{point.shortLabel || point.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, tone = 'primary', onClick }) {
  const tones = {
    primary: 'border-primary/20 bg-primary/5 text-primary',
    danger: 'border-error/25 bg-error/5 text-error',
    warning: 'border-amber-500/30 bg-amber-50 text-amber-700',
    success: 'border-success/25 bg-success/5 text-success'
  };
  const content = (
    <>
      <div className="flex justify-between gap-3">
        <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant">{label}</span>
        <span className={`material-symbols-outlined text-lg ${tones[tone].split(' ').at(-1)}`}>{icon}</span>
      </div>
      <strong className="text-3xl font-black text-on-surface mt-2 block">{value}</strong>
      <span className="text-[10px] text-on-surface-variant mt-1 block leading-relaxed">{detail}</span>
      {onClick && <span className="text-[9px] text-primary font-black mt-3 inline-flex items-center gap-1">Ver detalles <span className="material-symbols-outlined text-xs">arrow_forward</span></span>}
    </>
  );
  const className = `rounded-2xl border p-5 text-left shadow-2xs ${tones[tone]} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer' : ''}`;
  return onClick ? <button type="button" onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>;
}

function SectionHeading({ step, eyebrow, title, description }) {
  return (
    <div className="flex items-start gap-4 mb-5">
      <span className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-black shrink-0">{step}</span>
      <div>
        <span className="text-[9px] uppercase tracking-[0.18em] text-primary font-black">{eyebrow}</span>
        <h3 className="text-lg font-black text-on-surface mt-0.5">{title}</h3>
        <p className="text-xs text-on-surface-variant mt-1 max-w-3xl leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function ConsolidatedReports({ token, scopeRefugioId = null }) {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 29);

  const [refugios, setRefugios] = useState([]);
  const [residents, setResidents] = useState([]);
  const [beds, setBeds] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [meals, setMeals] = useState([]);
  const [families, setFamilies] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedState, setSelectedState] = useState('');
  const [selectedRefugioId, setSelectedRefugioId] = useState(scopeRefugioId ? String(scopeRefugioId) : '');
  const [startDate, setStartDate] = useState(monthAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const [detail, setDetail] = useState(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilters, setDetailFilters] = useState({});
  const [detailSort, setDetailSort] = useState({ key: '', direction: 'asc' });
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(25);
  const [projectionDays, setProjectionDays] = useState(7);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api');

  const fetchJson = async (url, headers) => {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    return response.json();
  };

  const fetchGlobalData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const allRefugios = await fetchJson(`${API_BASE}/refugios`, headers);
      const refugioList = scopeRefugioId ? allRefugios.filter(item => Number(item.id) === Number(scopeRefugioId)) : allRefugios;
      const localPrefix = scopeRefugioId ? `/refugios/${scopeRefugioId}` : '';
      const historicStart = new Date();
      historicStart.setDate(historicStart.getDate() - 120);
      const historicQuery = `start_date=${historicStart.toISOString().slice(0, 10)}&end_date=${new Date().toISOString().slice(0, 10)}`;

      const [residentList, incidentList, inventoryList, familyList, donationList, bedGroups, mealGroups] = await Promise.all([
        fetchJson(`${API_BASE}/damnificados${scopeRefugioId ? `?refugio_id=${scopeRefugioId}` : ''}`, headers),
        fetchJson(`${API_BASE}${scopeRefugioId ? `${localPrefix}/incidents` : '/incidents'}`, headers),
        fetchJson(`${API_BASE}${scopeRefugioId ? `${localPrefix}/inventory` : '/inventory'}`, headers),
        fetchJson(`${API_BASE}/family-groups${scopeRefugioId ? `?refugio_id=${scopeRefugioId}` : ''}`, headers),
        fetchJson(`${API_BASE}/donations`, headers),
        Promise.all(refugioList.map(refugio => fetchJson(`${API_BASE}/refugios/${refugio.id}/beds`, headers))),
        Promise.all(refugioList.map(refugio => fetchJson(`${API_BASE}/refugios/${refugio.id}/meals/attendance?${historicQuery}`, headers)))
      ]);

      setRefugios(refugioList);
      setResidents(residentList);
      setIncidents(incidentList);
      setInventory(inventoryList);
      setFamilies(familyList);
      setDonations(scopeRefugioId ? donationList.filter(item => Number(item.refugio_id) === Number(scopeRefugioId)) : donationList);
      setBeds(bedGroups.flat());
      setMeals(mealGroups.flat());
    } catch (err) {
      console.error(err);
      setError('No fue posible consolidar toda la información. Verifique la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, [token, scopeRefugioId]);

  const states = useMemo(() => [...new Set(refugios.map(item => item.estado).filter(Boolean))].sort(), [refugios]);

  const scopedRefugios = useMemo(() => refugios.filter(refugio => {
    if (selectedRefugioId && String(refugio.id) !== String(selectedRefugioId)) return false;
    if (selectedState && normalize(refugio.estado || refugio.location).includes(normalize(selectedState)) === false) return false;
    return true;
  }), [refugios, selectedState, selectedRefugioId]);

  const scopedIds = useMemo(() => new Set(scopedRefugios.map(item => Number(item.id))), [scopedRefugios]);
  const inRange = value => {
    const key = dateKey(value);
    return (!startDate || key >= startDate) && (!endDate || key <= endDate);
  };

  const scopedResidents = useMemo(
    () => residents.filter(item => scopedIds.has(Number(item.refugio_id)) && item.status === 'Activo').map(residentProfile),
    [residents, scopedIds]
  );
  const periodResidents = useMemo(() => scopedResidents.filter(item => inRange(item.created_at)), [scopedResidents, startDate, endDate]);
  const scopedBeds = useMemo(() => beds.filter(item => scopedIds.has(Number(item.refugio_id))), [beds, scopedIds]);
  const scopedIncidents = useMemo(() => incidents.filter(item => scopedIds.has(Number(item.refugio_id)) && inRange(item.logged_at)), [incidents, scopedIds, startDate, endDate]);
  const scopedInventory = useMemo(() => inventory.filter(item => scopedIds.has(Number(item.refugio_id))), [inventory, scopedIds]);
  const scopedMeals = useMemo(() => meals.filter(item => scopedIds.has(Number(item.refugio_id)) && inRange(item.meal_date)), [meals, scopedIds, startDate, endDate]);
  const scopedDonations = useMemo(() => donations.filter(item => scopedIds.has(Number(item.refugio_id)) && inRange(item.received_at)), [donations, scopedIds, startDate, endDate]);

  const totalCapacity = scopedRefugios.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
  const occupiedBeds = scopedBeds.filter(isBedOccupied).length;
  const occupancyRate = percentage(occupiedBeds || scopedResidents.length, scopedBeds.length || totalCapacity);

  const ageGroups = [
    { label: '0–5 años', value: scopedResidents.filter(item => item.age !== null && item.age <= 5).length, color: '#f59e0b' },
    { label: '6–11 años', value: scopedResidents.filter(item => item.age >= 6 && item.age <= 11).length, color: '#eab308' },
    { label: '12–17 años', value: scopedResidents.filter(item => item.age >= 12 && item.age <= 17).length, color: '#2563eb' },
    { label: '18–59 años', value: scopedResidents.filter(item => item.age >= 18 && item.age <= 59).length, color: '#0b3a75' },
    { label: '60 años o más', value: scopedResidents.filter(item => item.age >= 60).length, color: '#7c3aed' }
  ];
  const children = scopedResidents.filter(item => item.age !== null && item.age < 18);
  const adults = scopedResidents.filter(item => item.age === null || item.age >= 18);
  const elderly = scopedResidents.filter(item => item.age >= 60);
  const women = scopedResidents.filter(item => item.gender === 'Femenino');
  const pregnant = women.filter(item => item.maternityStatus !== 'No aplica' || normalize(item.priorityText).includes('embarazo'));
  const disabled = scopedResidents.filter(item => item.disability && item.disability !== 'Ninguna');
  const unschooled = children.filter(item => item.age >= 3 && item.schoolStatus !== 'Sí');
  const undocumented = scopedResidents.filter(item => item.documentMissing);
  const unemployed = adults.filter(item => !item.employed);
  const employed = adults.filter(item => item.employed);
  const destroyedHousing = scopedResidents.filter(item => normalize(item.housing).includes('colapso total') || normalize(item.housing).includes('destruida'));
  const psychosocial = scopedResidents.filter(item => item.psychosocial && item.psychosocial !== 'No requerido');

  const pathologyMap = {};
  scopedResidents.forEach(resident => resident.pathologies.forEach(pathology => {
    const label = pathology.startsWith('Otros:') ? 'Otras patologías' : pathology;
    pathologyMap[label] = (pathologyMap[label] || 0) + 1;
  }));
  const pathologyData = Object.entries(pathologyMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const priorityMap = {};
  scopedResidents.forEach(resident => {
    PRIORITY_CONDITIONS.forEach(condition => {
      if (normalize(resident.priorityText).includes(normalize(condition))) priorityMap[condition] = (priorityMap[condition] || 0) + 1;
    });
  });
  const priorityData = Object.entries(priorityMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const professionMap = {};
  unemployed.forEach(resident => {
    professionMap[resident.profession] = (professionMap[resident.profession] || 0) + 1;
  });
  const professionData = Object.entries(professionMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7);

  const dietMap = {};
  scopedResidents.forEach(resident => {
    const label = resident.dietaryNeed || 'Ninguna / General';
    dietMap[label] = (dietMap[label] || 0) + 1;
  });
  const dietData = Object.entries(dietMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const genderData = [
    { label: 'Mujeres', value: women.length, color: '#db2777' },
    { label: 'Hombres', value: scopedResidents.filter(item => item.gender === 'Masculino').length, color: '#2563eb' },
    { label: 'Otro / sin dato', value: scopedResidents.filter(item => !['Femenino', 'Masculino'].includes(item.gender)).length, color: '#94a3b8' }
  ];

  const buildDailySeries = (items, valueDate) => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : monthAgo;
    const end = endDate ? new Date(`${endDate}T00:00:00`) : today;
    const dayMap = {};
    items.forEach(item => {
      const key = dateKey(valueDate(item));
      dayMap[key] = (dayMap[key] || 0) + 1;
    });
    const result = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      result.push({
        label: key,
        shortLabel: cursor.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
        value: dayMap[key] || 0
      });
    }
    return result;
  };
  const admissionSeries = buildDailySeries(periodResidents, item => item.created_at);
  const mealSeries = buildDailySeries(scopedMeals, item => item.meal_date);
  const mealsByType = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'].map((label, index) => ({
    label,
    value: scopedMeals.filter(item => item.meal_type === label).length,
    color: COLORS[index + 1]
  }));

  const criticalStock = scopedInventory.filter(item => Number(item.quantity) <= Number(item.min_threshold) || item.status === 'Sin Stock' || item.status === 'Stock Crítico');
  const estimatedFoodKg = scopedMeals.length * 0.55;
  const siteNames = new Map(refugios.map(refugio => [Number(refugio.id), refugio.name]));
  const detailBeds = scopedBeds.map(row => ({ ...row, refugio_name: siteNames.get(Number(row.refugio_id)) || 'Sede no registrada' }));
  const detailMeals = scopedMeals.map(row => ({ ...row, refugio_name: siteNames.get(Number(row.refugio_id)) || 'Sede no registrada' }));
  const alertResidents = scopedResidents.filter(item => item.priorityText || item.pathologies.length || item.health_status === 'Crítico' || item.requiresMedical !== 'No');
  const familyIds = new Set(scopedResidents.map(item => item.family_group_id).filter(Boolean));
  const scopedFamilies = families.filter(item => familyIds.has(item.id));
  const unipersonalFamilies = scopedResidents.filter(item => !item.family_group_id).length;
  const activeFamilyCount = scopedFamilies.length + unipersonalFamilies;

  const refugioRows = scopedRefugios.map(refugio => {
    const siteResidents = scopedResidents.filter(item => Number(item.refugio_id) === Number(refugio.id));
    const siteBeds = scopedBeds.filter(item => Number(item.refugio_id) === Number(refugio.id));
    const siteCritical = scopedInventory.filter(item => Number(item.refugio_id) === Number(refugio.id) && (Number(item.quantity) <= Number(item.min_threshold) || item.status !== 'Stock Suficiente'));
    const siteAlerts = siteResidents.filter(item => item.priorityText || item.health_status === 'Crítico').length;
    return {
      ...refugio,
      residents: siteResidents,
      residentsCount: siteResidents.length,
      occupancy: percentage(siteBeds.filter(isBedOccupied).length, siteBeds.length || refugio.capacity),
      criticalStock: siteCritical.length,
      alerts: siteAlerts,
      risk: Math.min(100, Math.round(siteAlerts * 1.5 + siteCritical * 6 + Math.max(0, percentage(siteResidents.length, refugio.capacity) - 80)))
    };
  }).sort((a, b) => b.risk - a.risk);

  const openResidentDetail = (title, subtitle, rows, type = 'population', focus = '', options = {}) => {
    setDetailSearch('');
    setDetailFilters({});
    setDetailSort({ key: '', direction: 'asc' });
    setDetailPage(1);
    setProjectionDays(7);
    setDetail({ title, subtitle, rows, type, focus, options });
  };

  const detailView = useMemo(
    () => detail ? detailPresentation(detail.type, detail.rows, detail.focus, { ...detail.options, projectionDays }) : null,
    [detail, projectionDays]
  );

  const detailFilterOptions = useMemo(() => {
    if (!detail || !detailView) return [];
    return detailView.columns.map(column => {
      const values = [...new Set(detail.rows.map(row => display(column.value(row))))].sort((a, b) => a.localeCompare(b, 'es'));
      return { ...column, values };
    }).filter(column => column.values.length > 1 && column.values.length <= 24).slice(0, 5);
  }, [detail, detailView]);

  const detailRows = useMemo(() => {
    if (!detail || !detailView) return [];
    const query = normalize(detailSearch);
    const filtered = detail.rows.filter(row => {
      if (query && !normalize(detailView.columns.map(column => column.value(row)).join(' ')).includes(query)) return false;
      return Object.entries(detailFilters).every(([key, selected]) => {
        if (!selected) return true;
        const column = detailView.columns.find(item => (item.key || item.label) === key);
        return column ? display(column.value(row)) === selected : true;
      });
    });
    if (!detailSort.key) return filtered;
    const column = detailView.columns.find(item => (item.key || item.label) === detailSort.key);
    if (!column) return filtered;
    return [...filtered].sort((a, b) => {
      const left = display(column.value(a));
      const right = display(column.value(b));
      const numeric = Number.parseFloat(left) - Number.parseFloat(right);
      const comparison = Number.isNaN(numeric) ? left.localeCompare(right, 'es', { numeric: true }) : numeric;
      return detailSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [detail, detailSearch, detailView, detailFilters, detailSort]);

  const detailPageCount = Math.max(1, Math.ceil(detailRows.length / detailPageSize));
  const detailPageRows = detailRows.slice((detailPage - 1) * detailPageSize, detailPage * detailPageSize);
  useEffect(() => {
    if (detailPage > detailPageCount) setDetailPage(detailPageCount);
  }, [detailPage, detailPageCount]);

  const printDetail = () => {
    if (!detail || !detailView) return;
    const popup = window.open('', '_blank');
    if (!popup) return;
    const rows = detailRows.map((resident, index) => `
      <tr>
        <td>${index + 1}</td>
        ${detailView.columns.map(column => `<td>${escapeHtml(column.value(resident))}</td>`).join('')}
      </tr>
    `).join('');
    const summary = detailView.summary.map(item => `
      <div class="summary-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small></div>
    `).join('');
    const chartBreakdowns = (detailView.charts || []).map(chart => `
      <div class="breakdown"><strong>${escapeHtml(chart.title)}</strong>${chart.data.map(item => `<span>${escapeHtml(item.label)}: <b>${formatNumber(item.value)}</b></span>`).join('')}</div>
    `).join('');
    const projectionBreakdown = detailView.projection ? `
      <div class="projection"><strong>Proyección alimentaria para ${detailView.projection.horizon} días · ${formatNumber(detailView.projection.projectedRations)} raciones</strong>
      ${detailView.projection.requirements.map(item => `<span>${escapeHtml(item.label)}: <b>${formatNumber(item.value)} ${escapeHtml(item.unit)}</b></span>`).join('')}</div>
    ` : '';
    popup.document.write(`<!doctype html><html><head><title>${detail.title}</title><style>
      @page{size:letter landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#12213a;font-size:9px;margin:0}
      h1{font-size:16px;color:#0b3a75;margin:0 0 4px}p{margin:0 0 12px;color:#526174}.meta{display:flex;justify-content:space-between;border-bottom:2px solid #0b3a75;padding-bottom:8px;margin-bottom:10px}
      .summary{display:flex;gap:6px;margin:0 0 10px;flex-wrap:wrap}.summary-card{min-width:120px;flex:1;border:1px solid #cfd7e5;border-radius:6px;padding:6px;background:#f5f7fb}.summary-card span,.summary-card small{display:block;color:#667085}.summary-card strong{display:block;color:#0b3a75;font-size:13px;margin:2px 0}
      .breakdowns{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}.breakdown,.projection{flex:1;min-width:240px;border:1px solid #cfd7e5;border-radius:6px;padding:7px}.breakdown strong,.projection strong{display:block;color:#0b3a75;margin-bottom:4px}.breakdown span,.projection span{display:inline-block;margin:2px 10px 2px 0}
      table{width:100%;border-collapse:collapse}th{background:#0b3a75;color:white;text-transform:uppercase;font-size:8px}th,td{border:1px solid #cfd7e5;padding:5px;text-align:left;vertical-align:top}
      tr:nth-child(even){background:#f5f7fb}small{color:#667085}.footer{margin-top:8px;font-size:8px;color:#667085;text-align:right}
    </style></head><body>
      <div class="meta"><div><h1>${escapeHtml(detail.title)}</h1><p>${escapeHtml(detail.subtitle)}</p></div><strong>${detailRows.length} registros</strong></div>
      <div class="summary">${summary}</div>
      <div class="breakdowns">${chartBreakdowns}${projectionBreakdown}</div>
      <table><thead><tr><th>#</th>${detailView.columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Campamento Transitorio SAREN · Generado ${new Date().toLocaleString('es-VE')}</div>
      <script>history.replaceState(null,'','/reporte-detallado-saren');window.onload=()=>{window.print();window.close();}</script>
    </body></html>`);
    popup.document.close();
  };

  const exportDetailExcel = () => {
    if (!detail || !detailView) return;
    downloadExcel(`reporte-consolidado-${Date.now()}.xls`, ['N°', ...detailView.columns.map(column => column.label)], detailRows.map((row, index) => [index + 1, ...detailView.columns.map(column => display(column.value(row)))]), detail.title);
  };

  const executiveAlerts = [
    undocumented.length > 0 && {
      tone: 'danger', icon: 'badge', title: `${undocumented.length} personas requieren gestión documental`,
      text: 'Priorizar jornadas de identificación y recuperación de documentos con SAIME/SAREN.',
      action: () => openResidentDetail('Brecha de identificación', 'Personas sin documento o con documento perdido', undocumented, 'documentation')
    },
    unschooled.length > 0 && {
      tone: 'warning', icon: 'school', title: `${unschooled.length} niños y adolescentes fuera del sistema educativo`,
      text: 'Coordinar cupos, transporte y continuidad escolar con las instituciones cercanas.',
      action: () => openResidentDetail('Continuidad educativa', 'Niños y adolescentes no escolarizados', unschooled, 'education')
    },
    unemployed.length > 0 && {
      tone: 'primary', icon: 'work', title: `${percentage(unemployed.length, adults.length)}% de adultos sin empleo`,
      text: 'Cruzar oficios disponibles con programas de empleabilidad y recuperación de medios de vida.',
      action: () => openResidentDetail('Adultos sin empleo', 'Segmentados por oficio o profesión declarada', unemployed, 'employment', 'Sin empleo')
    },
    criticalStock.length > 0 && {
      tone: 'danger', icon: 'inventory_2', title: `${criticalStock.length} renglones de inventario en nivel crítico`,
      text: 'Revisar reposición priorizada y cobertura estimada antes del siguiente ciclo operativo.',
      action: () => openResidentDetail('Inventario en nivel crítico', 'Renglones que requieren reposición priorizada', criticalStock, 'inventory')
    }
  ].filter(Boolean);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-sm font-bold text-on-surface-variant">Consolidando datos y construyendo la narrativa ejecutiva…</div>;
  }

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 10mm; }
          .no-print, aside, header.fixed, nav { display:none!important; }
          main, .max-w-\\[1500px\\] { margin:0!important; padding:0!important; max-width:none!important; width:100%!important; }
          .report-section { break-inside:avoid; box-shadow:none!important; }
          body { background:white!important; }
        }
      `}</style>

      <header className="relative overflow-hidden rounded-3xl bg-[#082b59] text-white p-7 md:p-9 mb-6 shadow-lg">
        <div className="absolute -right-16 -top-20 w-72 h-72 bg-blue-400/20 rounded-full" />
        <div className="absolute right-40 -bottom-28 w-64 h-64 bg-amber-300/10 rounded-full" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.28em] text-blue-200 font-black">Inteligencia para la decisión pública</span>
            <h1 className="text-3xl md:text-4xl font-black mt-2">Historia operativa de la red de campamentos</h1>
            <p className="text-sm text-blue-100/85 mt-3 max-w-3xl leading-relaxed">
              Del panorama nacional a la persona: población, protección, salud, recuperación socioeconómica y capacidad operativa en una misma lectura.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <button onClick={() => window.print()} className="px-4 py-2.5 rounded-xl bg-white text-[#082b59] text-xs font-black inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-base">picture_as_pdf</span> Exportar resumen
            </button>
            <button onClick={fetchGlobalData} className="px-4 py-2.5 rounded-xl border border-white/25 bg-white/10 text-white text-xs font-black inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-base">refresh</span> Actualizar datos
            </button>
          </div>
        </div>
      </header>

      {error && <div className="mb-6 rounded-xl border border-error/30 bg-error/5 p-4 text-xs font-bold text-error">{error}</div>}

      <section className="no-print bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 mb-7 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-xs">
        <div>
          <label className="text-[9px] font-black uppercase text-on-surface-variant block mb-1">Estado</label>
          <select value={selectedState} onChange={event => { setSelectedState(event.target.value); setSelectedRefugioId(''); }} className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-2.5 text-xs font-bold">
            <option value="">Todos los estados</option>
            {states.map(state => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-black uppercase text-on-surface-variant block mb-1">Sede</label>
          <select value={selectedRefugioId} onChange={event => setSelectedRefugioId(event.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-2.5 text-xs font-bold">
            <option value="">Todas las sedes</option>
            {refugios.filter(item => !selectedState || normalize(item.estado || item.location).includes(normalize(selectedState))).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-black uppercase text-on-surface-variant block mb-1">Desde</label>
          <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-2.5 text-xs" />
        </div>
        <div>
          <label className="text-[9px] font-black uppercase text-on-surface-variant block mb-1">Hasta</label>
          <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-2.5 text-xs" />
        </div>
      </section>

      <div className="space-y-8">
        <section className="report-section">
          <SectionHeading step="1" eyebrow="Panorama" title="¿Cuál es la escala de la operación hoy?" description="La primera lectura dimensiona personas atendidas, presión sobre la capacidad y movimiento del período seleccionado." />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <MetricCard icon="groups" label="Residentes activos" value={formatNumber(scopedResidents.length)} detail={`${formatNumber(activeFamilyCount)} familias (incluye ${unipersonalFamilies} unipersonales) en ${scopedRefugios.length} sedes`} onClick={() => openResidentDetail('Residentes activos', 'Listado completo del ámbito seleccionado', scopedResidents, 'population')} />
            <MetricCard icon="person_add" label="Ingresos del período" value={formatNumber(periodResidents.length)} detail={`${percentage(periodResidents.length, scopedResidents.length)}% de la población actual ingresó en estas fechas`} onClick={() => openResidentDetail('Ingresos del período', `${startDate} al ${endDate}`, periodResidents, 'admission')} />
            <MetricCard icon="bed" label="Ocupación" value={`${occupancyRate}%`} detail={`${formatNumber(occupiedBeds || scopedResidents.length)} ocupaciones sobre ${formatNumber(scopedBeds.length || totalCapacity)} plazas`} tone={occupancyRate >= 85 ? 'danger' : 'success'} onClick={() => openResidentDetail('Ocupación y disponibilidad', 'Estado detallado de plazas por sede y pabellón', detailBeds, 'occupancy')} />
            <MetricCard icon="restaurant" label="Raciones servidas" value={formatNumber(scopedMeals.length)} detail={`≈ ${formatNumber(estimatedFoodKg)} kg planificados a 0,55 kg por ración`} tone="warning" onClick={() => openResidentDetail('Raciones servidas y proyección alimentaria', `${startDate} al ${endDate}`, detailMeals, 'meals')} />
            <MetricCard icon="health_and_safety" label="Alertas prioritarias" value={formatNumber(alertResidents.length)} detail={`${criticalStock.length} insumos críticos y ${scopedIncidents.length} incidencias en el período`} tone={criticalStock.length ? 'danger' : 'primary'} onClick={() => openResidentDetail('Alertas prioritarias de personas', 'Necesidades de salud y protección que requieren seguimiento', alertResidents, 'alerts', '', { criticalStockCount: criticalStock.length, incidentCount: scopedIncidents.length })} />
          </div>
        </section>

        <section className="report-section bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-xs">
          <SectionHeading step="2" eyebrow="Personas" title="¿Quiénes conforman la población atendida?" description="La estructura demográfica permite anticipar necesidades de cuidado, escolaridad, nutrición y accesibilidad." />
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
            <div className="xl:col-span-5">
              <h4 className="text-xs font-black text-primary mb-4 uppercase">Composición por sexo</h4>
              <DonutChart
                segments={genderData}
                centerValue={scopedResidents.length}
                centerLabel="personas"
                onSelect={item => openResidentDetail(`Población: ${item.label}`, 'Detalle por sexo registrado', scopedResidents.filter(resident => item.label === 'Mujeres' ? resident.gender === 'Femenino' : item.label === 'Hombres' ? resident.gender === 'Masculino' : !['Femenino', 'Masculino'].includes(resident.gender)), 'demographic', item.label)}
              />
            </div>
            <div className="xl:col-span-7">
              <h4 className="text-xs font-black text-primary mb-4 uppercase">Ciclo de vida</h4>
              <HorizontalBars
                data={ageGroups}
                onSelect={item => openResidentDetail(`Grupo etario: ${item.label}`, 'Residentes según edad calculada', scopedResidents.filter(resident => {
                  if (item.label === '0–5 años') return resident.age !== null && resident.age <= 5;
                  if (item.label === '6–11 años') return resident.age >= 6 && resident.age <= 11;
                  if (item.label === '12–17 años') return resident.age >= 12 && resident.age <= 17;
                  if (item.label === '18–59 años') return resident.age >= 18 && resident.age <= 59;
                  return resident.age >= 60;
                }), 'demographic', item.label)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-7">
            <MetricCard icon="child_care" label="Niños y adolescentes" value={formatNumber(children.length)} detail={`${percentage(children.length, scopedResidents.length)}% de la población`} onClick={() => openResidentDetail('Niños y adolescentes', 'Personas menores de 18 años', children, 'children')} />
            <MetricCard icon="elderly" label="Adultos mayores" value={formatNumber(elderly.length)} detail={`${percentage(elderly.length, scopedResidents.length)}% requiere enfoque de cuidado`} onClick={() => openResidentDetail('Adultos mayores', 'Personas de 60 años o más', elderly, 'elderly')} />
            <MetricCard icon="pregnant_woman" label="Embarazo/lactancia" value={formatNumber(pregnant.length)} detail="Seguimiento nutricional y sanitario prioritario" tone="warning" onClick={() => openResidentDetail('Embarazo y lactancia', 'Mujeres con alerta o requerimiento registrado', pregnant, 'maternity')} />
            <MetricCard icon="accessible" label="Discapacidad/movilidad" value={formatNumber(disabled.length)} detail="Necesidad potencial de ayudas técnicas y accesibilidad" onClick={() => openResidentDetail('Discapacidad o movilidad reducida', 'Personas con condición registrada', disabled, 'disability')} />
          </div>
        </section>

        <section className="report-section bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-xs">
          <SectionHeading step="3" eyebrow="Protección y salud" title="¿Dónde están las necesidades que no pueden esperar?" description="Las alertas de la ficha SAREN se convierten en grupos accionables para jornadas médicas, protección y seguimiento psicosocial." />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-black text-primary uppercase">Patologías más frecuentes</h4>
                <span className="text-[9px] text-on-surface-variant">Pulse una barra para ver personas</span>
              </div>
              <HorizontalBars
                data={pathologyData.length ? pathologyData : [{ label: 'Sin patologías declaradas', value: 0 }]}
                onSelect={item => openResidentDetail(`Condición médica: ${item.label}`, 'Listado para atención y seguimiento sanitario', scopedResidents.filter(resident => item.label === 'Otras patologías' ? resident.pathologies.some(path => path.startsWith('Otros:')) : resident.pathologies.includes(item.label)), 'pathology', item.label)}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-black text-primary uppercase">Condiciones prioritarias SAREN</h4>
                <span className="text-[9px] text-on-surface-variant">Protección social</span>
              </div>
              <HorizontalBars
                data={priorityData.length ? priorityData : [{ label: 'Sin alertas prioritarias', value: 0 }]}
                onSelect={item => openResidentDetail(item.label, 'Personas marcadas con esta condición prioritaria', scopedResidents.filter(resident => normalize(resident.priorityText).includes(normalize(item.label))), 'priority', item.label)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-7">
            <MetricCard icon="medical_services" label="Evaluación médica" value={formatNumber(scopedResidents.filter(item => item.requiresMedical !== 'No').length)} detail="Personas con evaluación indicada en la ficha" tone="danger" onClick={() => openResidentDetail('Evaluación médica requerida', 'Personas que requieren evaluación o atención', scopedResidents.filter(item => item.requiresMedical !== 'No'), 'medical')} />
            <MetricCard icon="psychology" label="Apoyo psicosocial" value={formatNumber(psychosocial.length)} detail="Ansiedad, crisis, duelo u otra necesidad registrada" tone="warning" onClick={() => openResidentDetail('Apoyo psicosocial', 'Personas con requerimiento psicosocial', psychosocial, 'psychosocial')} />
            <MetricCard icon="nutrition" label="Dietas especiales" value={formatNumber(scopedResidents.filter(item => !['Ninguna', 'Ninguna / General'].includes(item.dietaryNeed)).length)} detail="Planificación diferenciada de alimentación" onClick={() => openResidentDetail('Requerimientos nutricionales', 'Personas con dieta o necesidad especial', scopedResidents.filter(item => !['Ninguna', 'Ninguna / General'].includes(item.dietaryNeed)), 'nutrition')} />
          </div>
        </section>

        <section className="report-section bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-xs">
          <SectionHeading step="4" eyebrow="Recuperación" title="¿Qué barreras dificultan recuperar la autonomía?" description="Empleo, oficio, vivienda, documentación y educación muestran dónde articular respuestas más allá del alojamiento." />
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-4">
              <h4 className="text-xs font-black text-primary uppercase mb-4">Situación laboral adulta</h4>
              <DonutChart
                centerValue={adults.length}
                centerLabel="adultos"
                segments={[
                  { label: 'Con empleo', value: employed.length, color: '#16a34a' },
                  { label: 'Sin empleo', value: unemployed.length, color: '#ef4444' }
                ]}
                onSelect={item => openResidentDetail(item.label, 'Personas adultas según situación laboral', item.label === 'Con empleo' ? employed : unemployed, 'employment', item.label)}
              />
            </div>
            <div className="xl:col-span-8">
              <h4 className="text-xs font-black text-primary uppercase mb-4">Oficios y profesiones entre personas desempleadas</h4>
              <HorizontalBars
                data={professionData.length ? professionData : [{ label: 'Sin información', value: 0 }]}
                onSelect={item => openResidentDetail(`Desempleados: ${item.label}`, 'Personas disponibles con este oficio o profesión', unemployed.filter(resident => resident.profession === item.label), 'employment', item.label)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-7">
            <MetricCard icon="badge" label="Brecha documental" value={formatNumber(undocumented.length)} detail="Sin documento, perdido o no porta" tone="danger" onClick={() => openResidentDetail('Brecha documental', 'Personas que requieren gestión de identificación', undocumented, 'documentation')} />
            <MetricCard icon="home_work" label="Vivienda destruida" value={formatNumber(destroyedHousing.length)} detail="Personas cuyo hogar figura destruido o en colapso total" tone="warning" onClick={() => openResidentDetail('Pérdida total de vivienda', 'Personas afectadas por destrucción del hogar', destroyedHousing, 'housing')} />
            <MetricCard icon="school" label="Brecha educativa" value={formatNumber(unschooled.length)} detail="Niños y adolescentes no escolarizados" tone="danger" onClick={() => openResidentDetail('Continuidad educativa', 'Menores no escolarizados', unschooled, 'education')} />
          </div>
        </section>

        <section className="report-section bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-xs">
          <SectionHeading step="5" eyebrow="Ritmo operativo" title="¿Cómo evolucionó la demanda durante el período?" description="El comportamiento diario ayuda a reconocer picos de ingreso y dimensionar el esfuerzo sostenido del comedor." />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-outline-variant p-4">
              <div className="flex justify-between items-center">
                <div><h4 className="text-xs font-black text-primary uppercase">Ingresos diarios</h4><p className="text-[10px] text-on-surface-variant mt-1">{periodResidents.length} admisiones en el período</p></div>
                <span className="material-symbols-outlined text-primary">trending_up</span>
              </div>
              <LineChart data={admissionSeries} valueLabel="ingresos" />
            </div>
            <div className="rounded-2xl border border-outline-variant p-4">
              <div className="flex justify-between items-center">
                <div><h4 className="text-xs font-black text-primary uppercase">Raciones diarias registradas</h4><p className="text-[10px] text-on-surface-variant mt-1">{formatNumber(scopedMeals.length)} servicios verificados</p></div>
                <span className="material-symbols-outlined text-amber-600">restaurant</span>
              </div>
              <LineChart data={mealSeries} color="#f59e0b" valueLabel="raciones" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-7">
            <div>
              <h4 className="text-xs font-black text-primary uppercase mb-4">Raciones por tipo de comida</h4>
              <HorizontalBars data={mealsByType} />
              <p className="text-[9px] text-on-surface-variant mt-3">Estimación de masa alimentaria: <strong>{formatNumber(estimatedFoodKg)} kg</strong>, usando 0,55 kg promedio por ración para planificación. No sustituye el consumo físico de inventario.</p>
            </div>
            <div>
              <h4 className="text-xs font-black text-primary uppercase mb-4">Requerimientos nutricionales</h4>
              <HorizontalBars
                data={dietData}
                onSelect={item => openResidentDetail(`Nutrición: ${item.label}`, 'Personas asociadas a este requerimiento', scopedResidents.filter(resident => resident.dietaryNeed === item.label), 'nutrition', item.label)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-7">
            <MetricCard icon="inventory_2" label="Inventario crítico" value={formatNumber(criticalStock.length)} detail={`${scopedInventory.length} renglones monitoreados`} tone={criticalStock.length ? 'danger' : 'success'} onClick={() => openResidentDetail('Inventario crítico', 'Existencias por debajo del nivel mínimo configurado', criticalStock, 'inventory')} />
            <MetricCard icon="volunteer_activism" label="Donaciones recibidas" value={formatNumber(scopedDonations.length)} detail="Registros dentro del período seleccionado" tone="success" onClick={() => openResidentDetail('Donaciones recibidas', `${startDate} al ${endDate}`, scopedDonations, 'donations')} />
            <MetricCard icon="shield" label="Incidencias" value={formatNumber(scopedIncidents.length)} detail={`${scopedIncidents.filter(item => item.incident_type === 'Emergencia').length} emergencias`} tone={scopedIncidents.length ? 'warning' : 'success'} onClick={() => openResidentDetail('Incidencias operativas', `${startDate} al ${endDate}`, scopedIncidents, 'incidents')} />
            <MetricCard icon="family_restroom" label="Familias activas" value={formatNumber(activeFamilyCount)} detail={`${scopedFamilies.length} grupos · ${unipersonalFamilies} familias unipersonales`} />
          </div>
        </section>

        <section className="report-section bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-xs">
          <SectionHeading step="6" eyebrow="Territorio" title="¿En qué sede debe profundizar el decisor?" description="La comparación ordena las sedes por presión y alertas. Cada fila abre el listado nominal de residentes para intervención o impresión." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead><tr className="border-b border-outline-variant text-[9px] uppercase text-on-surface-variant">
                <th className="p-3">Sede</th><th className="p-3">Población</th><th className="p-3">Ocupación</th><th className="p-3">Alertas sociales/salud</th><th className="p-3">Stock crítico</th><th className="p-3">Índice de atención</th><th className="p-3 no-print">Acción</th>
              </tr></thead>
              <tbody>{refugioRows.map(row => (
                <tr key={row.id} className="border-b border-outline-variant/60 hover:bg-primary/5">
                  <td className="p-3"><strong className="text-primary">{row.name}</strong><span className="block text-[9px] text-on-surface-variant">{row.estado || row.location}</span></td>
                  <td className="p-3 font-black">{formatNumber(row.residentsCount)}</td>
                  <td className="p-3"><span className={`font-black ${row.occupancy >= 85 ? 'text-error' : 'text-success'}`}>{row.occupancy}%</span></td>
                  <td className="p-3">{row.alerts}</td>
                  <td className="p-3">{row.criticalStock}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-full text-[9px] font-black ${row.risk >= 70 ? 'bg-error/10 text-error' : row.risk >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-success/10 text-success'}`}>{row.risk}/100</span></td>
                  <td className="p-3 no-print"><button onClick={() => openResidentDetail(`Residentes de ${row.name}`, `${row.residentsCount} personas activas en esta sede`, row.residents, 'population', row.name)} className="text-primary font-black text-[10px] inline-flex items-center gap-1">Ver residentes <span className="material-symbols-outlined text-xs">arrow_forward</span></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <section className="report-section rounded-3xl bg-[#f3f6fb] border border-primary/15 p-6">
          <SectionHeading step="7" eyebrow="Agenda de decisión" title="¿Qué acciones deberían entrar primero en la mesa?" description="Las recomendaciones se generan desde las brechas observadas y enlazan directamente con las personas que requieren respuesta." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {executiveAlerts.map((alert, index) => (
              <button key={index} type="button" onClick={alert.action} disabled={!alert.action} className="bg-white rounded-2xl border border-outline-variant p-5 text-left flex gap-4 hover:shadow-md transition-shadow disabled:hover:shadow-none">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${alert.tone === 'danger' ? 'bg-error/10 text-error' : alert.tone === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}><span className="material-symbols-outlined">{alert.icon}</span></span>
                <span><strong className="text-sm text-on-surface block">{alert.title}</strong><span className="text-[11px] leading-relaxed text-on-surface-variant block mt-1">{alert.text}</span>{alert.action && <span className="text-[9px] text-primary font-black mt-2 block">Abrir listado de intervención</span>}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {detail && (
        <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-surface-container-lowest w-full max-w-6xl max-h-[92vh] rounded-3xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col">
            <div className="p-5 border-b border-outline-variant flex justify-between gap-4">
              <div><span className="text-[9px] uppercase tracking-wider text-primary font-black">Nivel de detalle</span><h3 className="text-lg font-black text-on-surface">{detail.title}</h3><p className="text-[10px] text-on-surface-variant mt-1">{detail.subtitle}</p></div>
              <button onClick={() => setDetail(null)} className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="overflow-auto flex-1">
              <div className="p-4 border-b border-outline-variant">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {detailView.summary.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
                      <span className="text-[8px] font-black uppercase tracking-wide text-on-surface-variant block">{item.label}</span>
                      <strong className="text-lg font-black text-primary block mt-0.5">{item.value}</strong>
                      <span className="text-[8px] text-on-surface-variant block">{item.detail}</span>
                    </div>
                  ))}
                </div>

                {detailView.charts?.length > 0 && (
                  <div className={`grid grid-cols-1 ${detailView.charts.length > 1 ? 'lg:grid-cols-2' : ''} gap-3 mb-4`}>
                    {detailView.charts.map((chart, index) => (
                      <div key={`${chart.title}-${index}`} className="rounded-2xl border border-outline-variant bg-white p-4">
                        <h4 className="text-[10px] font-black uppercase text-primary mb-3">{chart.title}</h4>
                        {chart.type === 'donut'
                          ? <DonutChart segments={chart.data} centerValue={chart.data.reduce((sum, item) => sum + item.value, 0)} centerLabel="registros" />
                          : <HorizontalBars data={chart.data} />}
                      </div>
                    ))}
                  </div>
                )}

                {detailView.projection && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div><h4 className="text-xs font-black text-amber-900">Requerimientos alimentarios proyectados</h4><p className="text-[9px] text-amber-800 mt-1">Estimación de planificación basada en el promedio diario observado.</p></div>
                      <div className="inline-flex rounded-xl border border-amber-300 bg-white p-1 self-start">
                        {[7, 30].map(days => <button key={days} type="button" onClick={() => setProjectionDays(days)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${projectionDays === days ? 'bg-amber-500 text-white' : 'text-amber-800'}`}>{days === 7 ? 'Próxima semana' : 'Próximo mes'}</button>)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {detailView.projection.requirements.map(item => (
                        <div key={item.label} className="rounded-xl bg-white border border-amber-200 p-3"><span className="text-[8px] uppercase font-bold text-amber-800 block">{item.label}</span><strong className="text-lg text-amber-950">{formatNumber(item.value)} {item.unit}</strong></div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row justify-between gap-3">
                  <div className="relative flex-1 max-w-2xl"><span className="material-symbols-outlined absolute left-3 top-2.5 text-base text-on-surface-variant">search</span><input value={detailSearch} onChange={event => { setDetailSearch(event.target.value); setDetailPage(1); }} placeholder={detailView.search} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-xs" /></div>
                  <div className="flex items-center gap-2"><span className="text-xs font-black text-primary mr-2">{detailRows.length} registros</span><button onClick={exportDetailExcel} className="px-4 py-2.5 rounded-xl bg-success text-white text-xs font-black inline-flex items-center gap-2"><span className="material-symbols-outlined text-base">table_view</span> Descargar Excel</button><button onClick={printDetail} className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-black inline-flex items-center gap-2"><span className="material-symbols-outlined text-base">picture_as_pdf</span> Descargar PDF</button></div>
                </div>

                {detailFilterOptions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 items-end">
                    {detailFilterOptions.map(filter => (
                      <label key={filter.key || filter.label} className="min-w-40 flex-1 max-w-60">
                        <span className="text-[8px] font-black uppercase text-on-surface-variant block mb-1">{filter.label}</span>
                        <select value={detailFilters[filter.key || filter.label] || ''} onChange={event => { setDetailFilters(current => ({ ...current, [filter.key || filter.label]: event.target.value })); setDetailPage(1); }} className="w-full rounded-lg border border-outline-variant bg-white p-2 text-[10px]">
                          <option value="">Todos</option>
                          {filter.values.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                    ))}
                    {Object.values(detailFilters).some(Boolean) && <button type="button" onClick={() => { setDetailFilters({}); setDetailPage(1); }} className="px-3 py-2 rounded-lg border border-outline-variant text-[9px] font-black text-primary">Limpiar filtros</button>}
                  </div>
                )}
              </div>

              <table className="w-full text-left text-[10px]">
                <thead className="sticky top-0 bg-[#0b3a75] text-white uppercase"><tr>{detailView.columns.map(column => {
                  const columnKey = column.key || column.label;
                  const active = detailSort.key === columnKey;
                  return <th key={columnKey} className="p-0 min-w-32"><button type="button" onClick={() => setDetailSort(current => ({ key: columnKey, direction: current.key === columnKey && current.direction === 'asc' ? 'desc' : 'asc' }))} className="w-full p-3 text-left inline-flex items-center gap-1 hover:bg-white/10">{column.label}<span className="material-symbols-outlined text-xs">{active ? (detailSort.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span></button></th>;
                })}</tr></thead>
                <tbody>{detailPageRows.map((resident, rowIndex) => (
                  <tr key={resident.id || `${detailPage}-${rowIndex}`} className="border-b border-outline-variant hover:bg-primary/5">
                    {detailView.columns.map(column => (
                      <td key={column.key || column.label} className={`p-3 align-top leading-relaxed ${column.mono ? 'font-mono' : ''}`}>
                        {column.key === 'name'
                          ? <><strong className="text-primary">{resident.fullName}</strong><span className="block text-[9px] text-on-surface-variant">{resident.family_name || 'Sin grupo familiar'}</span></>
                          : column.value(resident)}
                      </td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
              {detailPageRows.length === 0 && <div className="p-10 text-center text-xs text-on-surface-variant">No hay registros que coincidan con los filtros seleccionados.</div>}
              <div className="sticky bottom-0 bg-white border-t border-outline-variant p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[9px] text-on-surface-variant">
                  <span>Mostrar</span>
                  <select value={detailPageSize} onChange={event => { setDetailPageSize(Number(event.target.value)); setDetailPage(1); }} className="rounded-lg border border-outline-variant p-1.5 text-[9px]">
                    {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                  <span>por página · {detailRows.length ? (detailPage - 1) * detailPageSize + 1 : 0}–{Math.min(detailPage * detailPageSize, detailRows.length)} de {detailRows.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={detailPage <= 1} onClick={() => setDetailPage(page => page - 1)} className="px-3 py-1.5 rounded-lg border border-outline-variant text-[9px] font-black disabled:opacity-40">Anterior</button>
                  <span className="text-[9px] font-black text-primary">Página {detailPage} de {detailPageCount}</span>
                  <button type="button" disabled={detailPage >= detailPageCount} onClick={() => setDetailPage(page => page + 1)} className="px-3 py-1.5 rounded-lg border border-outline-variant text-[9px] font-black disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
