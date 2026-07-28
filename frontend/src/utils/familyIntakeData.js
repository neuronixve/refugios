export const EMPTY_FAMILY_INTAKE = {
  fecha_ingreso: '',
  hora_ingreso: '',
  tipo_registro: 'Nuevo',
  refugio_origen: '',
  prioridad_social: 'Sin alerta',
  alertas: [],
  salud: {
    lesion_sismo: 'No', lesion_persona: '', lesion_descripcion: '', evaluacion_medica: 'No',
    enfermedad_cronica: '', tratamiento_diario: '', medicamento_requerido: '', dias_disponibles: 'Ninguno',
    alergias: '', refrigeracion: 'No', medicamento_refrigerado: '', embarazo_semanas: '', lactancia_edad: '', discapacidad: '',
    ayuda_tecnica: '', ayuda_tecnica_otra: '', apoyo_psicosocial: 'No requerido', observacion: ''
  },
  documental: {
    estatus: 'Por verificar', urgencia: 'Por verificar', documentos_requeridos: [], otros_documentos: '',
    persona_nombre: '', persona_id: '', motivo: '', motivo_otro: '', accion: '', organo: '', organo_otro: '', estatus_gestion: 'Pendiente',
    fecha_compromiso: '', observaciones: '', responsable: ''
  },
  vivienda: {
    direccion: '', parroquia_municipio: '', estado: '', referencia: '', condicion: 'Sin información',
    inspeccion: 'No realizada', inspeccion_por: '', fecha_inspeccion: '', tenencia: '', tenencia_otra: '',
    retorno_temporal: 'Por determinar', perdidas: [], observacion: '', visita_inspeccion: 'No',
    motivo_visita: '', registro_fotografico: 'No', codigo_fotografico: ''
  },
  socioeconomico: {
    ocupacion: '', situacion_laboral: '', fuente_antes: [], fuente_actual: 'Por verificar',
    rango_ingreso: 'NR', dependientes_nna: '', dependientes_adultos: '', dependientes_discapacidad: '',
    red_apoyo: [], alojamiento_familiar: 'Por verificar'
  },
  requerimientos: [],
  otro_requerimiento: '',
  seguimientos: [],
  observaciones_finales: '',
  consentimiento: false,
  fecha_cierre: '',
  resultado_caso: 'Pendiente'
};

const cloneDefaults = () => JSON.parse(JSON.stringify(EMPTY_FAMILY_INTAKE));

const ALERT_LABEL_MIGRATIONS = {
  'NNA no acompañado': 'Niño, Niña o Adolescente (NNA) no acompañado',
  'NNA separado bajo cuidado de tercero': 'NNA separado bajo cuidado de familiar lejano, vecino u otra persona',
  'Adulto mayor solo o sin cuidador': 'Adulto mayor solo, sin cuidador o en abandono evidente',
  'Enfermedad crónica o tratamiento permanente': 'Persona con enfermedad crónica o tratamiento permanente',
  'Riesgo de protección, violencia o situación familiar sensible': 'Riesgo de protección / violencia / situación familiar sensible'
};

const normalizeAlerts = value => Array.isArray(value)
  ? [...new Set(value.map(item => ALERT_LABEL_MIGRATIONS[item] || item))]
  : [];

const normalizeFollowups = value => {
  if (Array.isArray(value)) {
    return value.slice(0, 5).map(item => ({
      fecha: item?.fecha || '',
      tipo: item?.tipo || '',
      motivo: item?.motivo || '',
      instancia: item?.instancia || '',
      responsable: item?.responsable || '',
      estatus: item?.estatus || ''
    }));
  }
  if (typeof value !== 'string') return [];
  return value.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 5).map(line => {
    const [fecha = '', tipo = '', motivo = '', instancia = '', responsable = '', estatus = ''] =
      line.split('|').map(item => item.trim());
    return { fecha, tipo, motivo, instancia, responsable, estatus };
  });
};

export const normalizeFamilyIntake = value => {
  const incoming = value && typeof value === 'object' ? value : {};
  const defaults = cloneDefaults();
  return {
    ...defaults,
    ...incoming,
    alertas: normalizeAlerts(incoming.alertas),
    salud: { ...defaults.salud, ...(incoming.salud || {}) },
    documental: {
      ...defaults.documental,
      ...(incoming.documental || {}),
      documentos_requeridos: Array.isArray(incoming.documental?.documentos_requeridos)
        ? incoming.documental.documentos_requeridos
        : []
    },
    vivienda: {
      ...defaults.vivienda,
      ...(incoming.vivienda || {}),
      perdidas: Array.isArray(incoming.vivienda?.perdidas) ? incoming.vivienda.perdidas : []
    },
    socioeconomico: {
      ...defaults.socioeconomico,
      ...(incoming.socioeconomico || {}),
      fuente_antes: Array.isArray(incoming.socioeconomico?.fuente_antes) ? incoming.socioeconomico.fuente_antes : [],
      red_apoyo: Array.isArray(incoming.socioeconomico?.red_apoyo) ? incoming.socioeconomico.red_apoyo : []
    },
    requerimientos: Array.isArray(incoming.requerimientos) ? incoming.requerimientos : [],
    seguimientos: normalizeFollowups(incoming.seguimientos)
  };
};
