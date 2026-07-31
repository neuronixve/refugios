const bcrypt = require('bcryptjs');
const db = require('../db');

const DEMO_NAME = 'Centro Demostrativo SAREN - La Guaira';
const confirmFlag = process.argv.includes('--confirm-demo');

if (!confirmFlag) {
  console.error('Use --confirm-demo para confirmar la creación o reemplazo de la sede demostrativa.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('La carga demo está bloqueada en producción. Use ALLOW_DEMO_SEED=true únicamente si está autorizado.');
  process.exit(1);
}

let seed = 20260730;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const pick = list => list[Math.floor(random() * list.length)];
const chance = probability => random() < probability;
const daysAgo = (days, hour = 9, minutes = 0) => {
  const date = new Date();
  date.setHours(hour, minutes, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
};
const birthDateForAge = age => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  date.setMonth(Math.floor(random() * 12));
  date.setDate(1 + Math.floor(random() * 27));
  return date.toISOString().slice(0, 10);
};

async function insertMany(client, table, columns, rows, returning = '') {
  const inserted = [];
  const chunkSize = 700;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values = [];
    const placeholders = chunk.map((row, rowIndex) => `(${columns.map((_, columnIndex) => {
      values.push(row[columnIndex]);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    }).join(',')})`).join(',');
    const result = await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders} ${returning ? `RETURNING ${returning}` : ''}`,
      values
    );
    if (returning) inserted.push(...result.rows);
  }
  return inserted;
}

const maleNames = ['José', 'Carlos', 'Luis', 'Miguel', 'Daniel', 'Javier', 'Alejandro', 'Andrés', 'Manuel', 'Rafael', 'Jesús', 'Pedro', 'Diego', 'Samuel', 'Gabriel'];
const femaleNames = ['María', 'Carmen', 'Ana', 'Daniela', 'Sofía', 'Valentina', 'Gabriela', 'Andrea', 'Patricia', 'Laura', 'Isabel', 'Camila', 'Elena', 'Mónica', 'Paola'];
const lastNames = ['González', 'Rodríguez', 'Pérez', 'Hernández', 'García', 'Martínez', 'López', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rojas', 'Mendoza', 'Castillo', 'Suárez'];
const professions = ['Albañil', 'Electricista', 'Docente', 'Costurera', 'Cocinero(a)', 'Enfermero(a)', 'Comerciante', 'Mecánico', 'Plomero', 'Conductor', 'Carpintero', 'Agricultor', 'Peluquero(a)', 'Técnico en computación', 'Administrativo'];
const municipalities = ['Vargas', 'Caraballeda', 'Catia La Mar', 'Maiquetía', 'Naiguatá'];
const sectors = ['La Esperanza', 'Las Tunitas', 'El Cojo', 'Mare Abajo', 'Caribe', 'La Guaira', 'Macuto', 'Quenepe'];
const pathologies = ['Diabetes', 'Hipertensión', 'Asma', 'EPOC', 'Cardiovascular', 'Renal (Diálisis)', 'Epilepsia', 'Gastrointestinal Recurrente'];
const housingOptions = ['Daño leve / En evaluación', 'Daño estructural grave (Inhabitable)', 'Colapso total / Destruida'];

async function seedDemo() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM refugios WHERE name = $1', [DEMO_NAME]);
    if (existing.rows.length) {
      const existingId = existing.rows[0].id;
      const familyRows = await client.query('SELECT DISTINCT family_group_id FROM damnificados WHERE refugio_id = $1 AND family_group_id IS NOT NULL', [existingId]);
      const familyIds = familyRows.rows.map(row => row.family_group_id);
      await client.query('DELETE FROM donations WHERE refugio_id = $1', [existingId]);
      await client.query('DELETE FROM damnificados WHERE refugio_id = $1', [existingId]);
      if (familyIds.length) await client.query('DELETE FROM family_groups WHERE id = ANY($1::int[])', [familyIds]);
      await client.query('DELETE FROM users WHERE refugio_id = $1', [existingId]);
      await client.query('DELETE FROM refugios WHERE id = $1', [existingId]);
    }

    const refugioResult = await client.query(
      `INSERT INTO refugios (name, location, capacity, contact_phone, status, estado, staff_config)
       VALUES ($1, $2, 360, '0212-555-3000', 'Operativo', 'La Guaira', $3) RETURNING id`,
      [DEMO_NAME, 'Av. Soublette, parroquia Maiquetía, estado La Guaira', JSON.stringify({ medicina: 8, registro: 10, seguridad: 12, cocina: 16, apoyo: 14 })]
    );
    const refugioId = refugioResult.rows[0].id;

    const passwordHash = await bcrypt.hash('DemoSaren2026!', 10);
    const staffRows = [
      ['Supervisor Global Demo', 'supervision.demo@saren.local', passwordHash, 'supervisor', 'V-90000000', 'Supervisión global', refugioId],
      ['Coordinadora Demo SAREN', 'coordinacion.demo@saren.local', passwordHash, 'gerente', 'V-90000001', 'Coordinación de sede', refugioId],
      ['Entrevistadora OAC Demo', 'oac.demo@saren.local', passwordHash, 'registro', 'V-90000002', 'Profesional OAC', refugioId],
      ['Médico Demo', 'medico.demo@saren.local', passwordHash, 'medico', 'V-90000003', 'Medicina General', refugioId],
      ['Trabajadora Social Demo', 'social.demo@saren.local', passwordHash, 'apoyo', 'V-90000004', 'Trabajo Social OAC', refugioId]
    ];
    const staff = await insertMany(client, 'users', ['name', 'email', 'password_hash', 'role', 'document_id', 'staff_function', 'refugio_id'], staffRows, 'id, role');
    const registrarId = staff.find(item => item.role === 'registro').id;
    const doctorId = staff.find(item => item.role === 'medico').id;
    const managerId = staff.find(item => item.role === 'gerente').id;

    const familyRows = Array.from({ length: 75 }, (_, index) => {
      const admittedDaysAgo = Math.floor(random() * 30);
      const alerts = [];
      if (chance(0.18)) alerts.push('Persona con enfermedad crónica o tratamiento permanente');
      if (chance(0.08)) alerts.push('Riesgo de protección / violencia / situación familiar sensible');
      const intake = {
        fecha_ingreso: daysAgo(admittedDaysAgo).toISOString().slice(0, 10),
        hora_ingreso: `${String(8 + Math.floor(random() * 10)).padStart(2, '0')}:00`,
        tipo_registro: 'Nuevo',
        prioridad_social: alerts.length ? 'Atención prioritaria' : 'Sin alerta',
        alertas: alerts,
        salud: {
          evaluacion_medica: chance(0.28) ? 'Sí prioritaria' : 'No',
          enfermedad_cronica: alerts.length ? 'Reportada en el núcleo familiar' : '',
          apoyo_psicosocial: chance(0.17) ? pick(['Ansiedad/crisis', 'Duelo/pérdida']) : 'No requerido',
          refrigeracion: chance(0.05) ? 'Sí' : 'No'
        },
        documental: {
          estatus: chance(0.14) ? 'No porta' : 'Documentos en mano',
          urgencia: chance(0.09) ? 'Alta' : 'Baja',
          accion: chance(0.2) ? 'Registro de requerimiento' : 'Orientación',
          estatus_gestion: chance(0.6) ? 'En proceso' : 'Pendiente'
        },
        vivienda: {
          estado: 'La Guaira',
          parroquia_municipio: pick(municipalities),
          condicion: pick(housingOptions),
          tenencia: pick(['Propietario', 'Inquilino', 'Vivo en casa de familiares']),
          inspeccion: chance(0.45) ? 'Realizada' : 'Pendiente'
        },
        socioeconomico: {
          situacion_laboral: chance(0.48) ? 'Con empleo' : 'Sin empleo',
          ocupacion: pick(professions),
          rango_ingreso: pick(['Sin ingreso', 'Menos de 1 salario mínimo', '1 a 2 salarios mínimos']),
          red_apoyo: chance(0.55) ? ['Familiar'] : ['Institucional']
        },
        requerimientos: chance(0.5) ? [pick(['Medicamentos / insumos médicos', 'Ropa / calzado', 'Kit de higiene personal', 'Gestión documental', 'Apoyo psicosocial'])] : [],
        seguimientos: [
          { fecha: daysAgo(Math.max(0, admittedDaysAgo - 2)).toISOString().slice(0, 10), tipo: 'Orientación', motivo: 'Evaluación inicial', instancia: 'OAC SAREN', responsable: 'Equipo OAC', estatus: 'Atendido' }
        ],
        consentimiento: true,
        resultado_caso: chance(0.35) ? 'En seguimiento' : 'Pendiente'
      };
      return [`Familia Demo ${String(index + 1).padStart(3, '0')}`, `Bloque ${String.fromCharCode(65 + (index % 6))}`, JSON.stringify(intake), registrarId, registrarId, daysAgo(admittedDaysAgo), daysAgo(Math.max(0, admittedDaysAgo - 1))];
    });
    const families = await insertMany(
      client,
      'family_groups',
      ['family_name', 'block_assignment', 'intake_data', 'registered_by', 'updated_by', 'created_at', 'updated_at'],
      familyRows,
      'id, family_name, created_at'
    );

    const residentsToInsert = [];
    const residentContext = [];
    let documentSequence = 31000000;
    families.forEach((family, familyIndex) => {
      const familyAdmissionDays = Math.min(29, Math.max(0, Math.round((Date.now() - new Date(family.created_at).getTime()) / 86400000)));
      const agePattern = [
        25 + Math.floor(random() * 35),
        familyIndex < 60 ? 20 + Math.floor(random() * 38) : 60 + Math.floor(random() * 24),
        familyIndex < 60 ? 2 + Math.floor(random() * 16) : 20 + Math.floor(random() * 35),
        familyIndex < 45 ? 1 + Math.floor(random() * 17) : familyIndex < 65 ? 20 + Math.floor(random() * 38) : 60 + Math.floor(random() * 24)
      ];

      agePattern.forEach((age, memberIndex) => {
        const gender = (familyIndex + memberIndex) % 20 === 0 ? 'Otro' : (familyIndex + memberIndex) % 2 === 0 ? 'Femenino' : 'Masculino';
        const firstName = gender === 'Masculino' ? pick(maleNames) : pick(femaleNames);
        const lastName = `${pick(lastNames)} ${pick(lastNames)}`;
        const adult = age >= 18;
        const elder = age >= 60;
        const child = age < 18;
        const hasDocument = adult ? !chance(0.09) : !chance(0.25);
        const documentId = hasDocument ? `V-${documentSequence++}` : null;
        const employed = adult && !elder && chance(0.56);
        const profession = pick(professions);
        const residentPathologies = pathologies.filter((_, pathologyIndex) => {
          const base = elder ? 0.16 : adult ? 0.075 : 0.025;
          return chance(base + (pathologyIndex < 2 ? 0.04 : 0));
        }).slice(0, 3);
        const disability = chance(elder ? 0.18 : 0.07) ? pick(['Motora (Movilidad física reducida)', 'Visual', 'Auditiva']) : 'Ninguna';
        const maternityEligible = gender === 'Femenino' && age >= 18 && age <= 44;
        const pregnant = maternityEligible && chance(0.09);
        const lactating = maternityEligible && !pregnant && chance(0.075);
        const lactationAgeMonths = lactating ? 1 + Math.floor(random() * 18) : null;
        const technicalAid = disability === 'Motora (Movilidad física reducida)'
          ? pick(['Bastón', 'Silla ruedas', 'Andadera'])
          : disability === 'Visual'
            ? 'Lentes'
            : disability === 'Auditiva'
              ? 'Audífono'
              : '';
        const priority = [];
        if (child && !hasDocument) priority.push('NNA sin documento o con documento perdido/dañado');
        if (elder && memberIndex === 0 && chance(0.25)) priority.push('Adulto mayor solo, sin cuidador o en abandono evidente');
        if (disability !== 'Ninguna') priority.push('Persona con discapacidad o movilidad reducida');
        if (pregnant || lactating) priority.push('Embarazo o lactancia');
        if (residentPathologies.length) priority.push('Persona con enfermedad crónica o tratamiento permanente');
        if (chance(0.035)) priority.push('Riesgo de protección / violencia / situación familiar sensible');
        const housing = pick(housingOptions);
        const schoolStatus = child && age >= 3 ? (chance(0.78) ? 'Sí' : 'No') : undefined;
        const nutrition = pregnant
          ? 'Embarazada'
          : lactating
            ? 'Madre lactante'
            : age <= 1
              ? 'Lactante (0-12 meses)'
              : elder && chance(0.38)
                ? 'Adulto mayor con dieta blanda'
                : chance(0.14)
                  ? 'Baja en sodio'
                  : 'Ninguna / General';
        const metadata = {
          photo: '',
          es_cabeza_familia: memberIndex === 0,
          parentesco: memberIndex === 0 ? undefined : pick(['Hijo/a', 'Cónyuge', 'Madre/Padre', 'Hermano/a']),
          preexisting: residentPathologies,
          treatments: residentPathologies.length ? `Control y tratamiento para ${residentPathologies[0]}` : '',
          diet: nutrition,
          allergies: chance(0.12) ? [pick(['PENICILINA', 'MARISCOS', 'LACTOSA'])] : [],
          procedencia_estado: 'La Guaira',
          municipio: pick(municipalities),
          barrioSector: pick(sectors),
          empleo: { tiene_empleo: employed ? 'Sí' : 'No', empresa: employed ? pick(['Comercio local', 'Servicios', 'Construcción', 'Cuenta propia']) : '', horario: employed ? 'Diurno' : '', direccion: 'La Guaira', oficio_profesion: profession },
          telefono_contacto: `0412-${String(1000000 + Math.floor(random() * 8999999))}`,
          contacto_emergencia: `${pick(femaleNames)} ${pick(lastNames)} - 0414-${String(1000000 + Math.floor(random() * 8999999))}`,
          menores_a_cargo: adult ? String(Math.floor(random() * 4)) : '',
          nutricion_especial: nutrition,
          discapacidad: disability,
          documento_perdido: !hasDocument,
          planilla_persona: {
            tipo_documento: hasDocument ? 'C.I.' : child ? 'Partida de nacimiento' : 'Sin documento',
            estatus_documento: hasDocument ? 'En mano' : chance(0.5) ? 'Perdido' : 'No porta',
            rol_familiar: memberIndex === 0 ? 'Jefe(a) de hogar / representante' : 'Integrante familiar',
            red_apoyo_externa: chance(0.55) ? 'Sí' : 'Por verificar',
            condicion_prioritaria: priority.join(' | '),
            requiere_evaluacion_medica: residentPathologies.length > 1 ? 'Sí prioritaria' : residentPathologies.length ? 'Sí' : 'No',
            requiere_refrigeracion: residentPathologies.includes('Diabetes') && chance(0.25) ? 'Sí' : 'No',
            embarazo_semanas: pregnant ? String(8 + Math.floor(random() * 28)) : '',
            lactancia_edad: lactating ? `${lactationAgeMonths} meses` : '',
            ayuda_tecnica: technicalAid,
            apoyo_psicosocial: chance(0.13) ? pick(['Ansiedad/crisis', 'Duelo/pérdida']) : 'No requerido',
            observaciones: priority.length ? 'Requiere seguimiento según condición prioritaria.' : ''
          },
          escolarizado: schoolStatus,
          centro_educativo: schoolStatus === 'Sí' ? pick(['U.E. República de Panamá', 'U.E. José María Vargas', 'U.E. Catia La Mar']) : '',
          grado_cursado: child ? `${Math.max(1, Math.min(11, age - 5))}°` : '',
          estado_vivienda: housing,
          tenencia_vivienda: pick(['Propietario', 'Inquilino', 'Vivo en casa de familiares']),
          personas_a_cargo: adult ? Math.floor(random() * 5) : 0,
          requiere_pañales_formula: child && age <= 2 ? 'Sí' : 'No',
          mascotas: { tiene_mascotas: chance(0.17) ? 'Sí' : 'No', especie: chance(0.6) ? 'Perro' : 'Gato' },
          welcome_kit: true
        };
        const createdAt = daysAgo(familyAdmissionDays, 8 + Math.floor(random() * 10), Math.floor(random() * 60));
        residentsToInsert.push([
          documentId, firstName, lastName, birthDateForAge(age), gender,
          residentPathologies.length ? (residentPathologies.length > 1 ? 'Bajo Observación' : 'Estable con tratamiento') : 'Estable',
          JSON.stringify(metadata), refugioId, family.id, 'Activo', registrarId, registrarId, createdAt, createdAt
        ]);
        residentContext.push({ admissionDaysAgo: familyAdmissionDays, pathologies: residentPathologies, adult });
      });
    });

    const residents = await insertMany(
      client,
      'damnificados',
      ['document_id', 'first_name', 'last_name', 'birth_date', 'gender', 'health_status', 'special_needs', 'refugio_id', 'family_group_id', 'status', 'registered_by', 'updated_by', 'created_at', 'updated_at'],
      residentsToInsert,
      'id, first_name, last_name, document_id'
    );

    const bedRows = [];
    for (let room = 1; room <= 12; room += 1) {
      for (let bed = 1; bed <= 30; bed += 1) {
        bedRows.push([refugioId, `Pabellón ${String(room).padStart(2, '0')}`, `Cama ${String(bed).padStart(2, '0')}`, 'Disponible']);
      }
    }
    const beds = await insertMany(client, 'beds', ['refugio_id', 'room_number', 'bed_number', 'status'], bedRows, 'id');
    for (let start = 0; start < residents.length; start += 500) {
      const pairs = residents.slice(start, start + 500).map((resident, index) => [beds[start + index].id, resident.id]);
      const values = pairs.flat();
      const placeholders = pairs.map((_, index) => `($${index * 2 + 1}::int,$${index * 2 + 2}::int)`).join(',');
      await client.query(`UPDATE beds b SET resident_id = v.resident_id, status = 'Ocupada' FROM (VALUES ${placeholders}) AS v(id, resident_id) WHERE b.id = v.id`, values);
    }

    const depositoResult = await client.query(
      `INSERT INTO depositos (refugio_id, name, description, capacity_percent)
       VALUES ($1, 'Almacén Demostrativo', 'Inventario operacional de la sede demo', 72) RETURNING id`,
      [refugioId]
    );
    const depositoId = depositoResult.rows[0].id;
    const inventorySeed = [
      ['Arroz', 'Alimentos', 860, 300, 'kg'], ['Harina de maíz', 'Alimentos', 620, 250, 'kg'], ['Pasta', 'Alimentos', 410, 180, 'kg'],
      ['Proteína animal', 'Alimentos', 180, 200, 'kg'], ['Leche en polvo', 'Alimentos', 85, 120, 'kg'], ['Aceite', 'Alimentos', 190, 90, 'litros'],
      ['Agua potable', 'Alimentos', 5200, 2000, 'litros'], ['Pañales infantiles', 'Higiene', 420, 500, 'unidades'],
      ['Toallas sanitarias', 'Higiene', 780, 350, 'unidades'], ['Kit de higiene', 'Higiene', 310, 250, 'kits'],
      ['Losartán', 'Medicinas', 260, 300, 'tabletas'], ['Metformina', 'Medicinas', 340, 260, 'tabletas'],
      ['Salbutamol', 'Medicinas', 42, 60, 'unidades'], ['Acetaminofén', 'Medicinas', 900, 300, 'tabletas'],
      ['Solución oral', 'Medicinas', 75, 80, 'sobres'], ['Sábanas', 'Ropa', 190, 120, 'unidades'],
      ['Ropa infantil', 'Ropa', 145, 180, 'piezas'], ['Muletas', 'Ayudas Técnicas', 8, 10, 'unidades']
    ];
    await insertMany(
      client,
      'inventory',
      ['refugio_id', 'item_name', 'category', 'quantity', 'min_threshold', 'unit', 'status', 'deposito_id', 'updated_at'],
      inventorySeed.map(([name, category, quantity, threshold, unit], index) => [refugioId, name, category, quantity, threshold, unit, quantity <= threshold ? (quantity === 0 ? 'Sin Stock' : 'Stock Crítico') : 'Stock Suficiente', depositoId, daysAgo(index % 5)])
    );

    const mealRows = [];
    residents.forEach((resident, index) => {
      const context = residentContext[index];
      for (let day = 0; day <= Math.min(29, context.admissionDaysAgo); day += 1) {
        ['Desayuno', 'Almuerzo', 'Cena'].forEach((mealType, mealIndex) => {
          if (chance(mealType === 'Almuerzo' ? 0.9 : 0.82)) {
            const mealDate = daysAgo(day, 7 + mealIndex * 5, Math.floor(random() * 50));
            mealRows.push([resident.id, 'resident', refugioId, mealDate.toISOString().slice(0, 10), mealType, mealDate]);
          }
        });
      }
    });
    await insertMany(client, 'meal_attendance', ['resident_id', 'person_type', 'refugio_id', 'meal_date', 'meal_type', 'attended_at'], mealRows);

    const supplyRows = [];
    residents.forEach((resident, index) => {
      supplyRows.push([refugioId, resident.id, 'Kit de Bienvenida', 1, registrarId, daysAgo(residentContext[index].admissionDaysAgo)]);
      if (chance(0.35)) supplyRows.push([refugioId, resident.id, pick(['Kit de higiene', 'Ropa / calzado', 'Pañales infantiles']), 1 + Math.floor(random() * 2), registrarId, daysAgo(Math.floor(random() * 25))]);
    });
    await insertMany(client, 'supply_deliveries', ['refugio_id', 'resident_id', 'item_name', 'quantity', 'delivered_by', 'delivered_at'], supplyRows);

    const medicationRows = [];
    residents.forEach((resident, index) => {
      residentContext[index].pathologies.forEach(pathology => {
        const medicine = pathology === 'Diabetes' ? 'Metformina' : pathology === 'Hipertensión' ? 'Losartán' : pathology === 'Asma' ? 'Salbutamol' : 'Tratamiento indicado';
        medicationRows.push([refugioId, resident.id, medicine, 'Según indicación médica', 1, 'Dosis', 'Diaria', `Seguimiento de ${pathology}`, doctorId, daysAgo(Math.floor(random() * 26))]);
      });
    });
    if (medicationRows.length) await insertMany(client, 'medication_deliveries', ['refugio_id', 'resident_id', 'medication_name', 'dose', 'quantity', 'unit', 'delivery_frequency', 'notes', 'delivered_by', 'delivered_at'], medicationRows);

    const accessRows = [];
    residents.filter((_, index) => index % 3 === 0).forEach(resident => {
      for (let visit = 0; visit < 3; visit += 1) {
        const logDay = Math.floor(random() * 28);
        accessRows.push([resident.id, 'resident', refugioId, 'salida', daysAgo(logDay, 8 + visit)]);
        accessRows.push([resident.id, 'resident', refugioId, 'entrada', daysAgo(logDay, 12 + visit)]);
      }
    });
    await insertMany(client, 'access_logs', ['resident_id', 'person_type', 'refugio_id', 'type', 'logged_at'], accessRows);

    const incidentDescriptions = [
      ['Novedad', 'Evaluación preventiva de convivencia en pabellón.', 'Mediación y orientación realizada.'],
      ['Altercado', 'Discusión entre residentes por normas de convivencia.', 'Intervención del equipo de seguridad y trabajo social.'],
      ['Emergencia', 'Residente presentó malestar agudo durante la jornada.', 'Traslado al servicio médico y seguimiento.']
    ];
    const incidentRows = Array.from({ length: 42 }, (_, index) => {
      const definition = index < 5 ? incidentDescriptions[2] : index < 15 ? incidentDescriptions[1] : incidentDescriptions[0];
      const resident = pick(residents);
      return [refugioId, resident.id, managerId, definition[0], definition[1], definition[2], JSON.stringify([{ id: resident.id, name: `${resident.first_name} ${resident.last_name}` }]), daysAgo(Math.floor(random() * 30), 10 + Math.floor(random() * 10))];
    });
    await insertMany(client, 'incidents', ['refugio_id', 'resident_id', 'reported_by', 'incident_type', 'description', 'action_taken', 'involved_residents', 'logged_at'], incidentRows);

    const menuRows = [];
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const mealDescriptions = {
      Desayuno: ['Arepa con queso y fruta', 'Avena y pan', 'Arepa con huevo'],
      Almuerzo: ['Arroz, pollo guisado y ensalada', 'Pasta con carne y vegetales', 'Caraotas, arroz y plátano'],
      Cena: ['Crema de verduras y arepa', 'Arroz con vegetales', 'Sándwich y bebida']
    };
    days.forEach(day => ['Desayuno', 'Almuerzo', 'Cena'].forEach(mealType => {
      menuRows.push([refugioId, day, mealType, pick(mealDescriptions[mealType]), 'Plan nutricional estándar para 300 personas', JSON.stringify({ blanda: true, baja_sodio: true })]);
    }));
    await insertMany(client, 'menus', ['refugio_id', 'day_of_week', 'meal_type', 'description', 'ingredients', 'diets_json'], menuRows);

    const requestRows = Array.from({ length: 24 }, (_, index) => [
      refugioId, pick(['Cocina', 'Servicio Médico', 'Higiene', 'Trabajo Social']), pick(['Proteína animal', 'Leche en polvo', 'Losartán', 'Pañales infantiles', 'Ropa infantil', 'Kit de higiene']),
      20 + Math.floor(random() * 120), pick(['kg', 'unidades', 'cajas']), 'Solicitud operativa generada por consumo del mes', index < 8 ? 'Pendiente' : index < 16 ? 'En proceso' : 'Atendido', daysAgo(Math.floor(random() * 30))
    ]);
    await insertMany(client, 'warehouse_requests', ['refugio_id', 'area', 'item_name', 'quantity', 'unit', 'details', 'status', 'created_at'], requestRows);

    const donationRows = Array.from({ length: 14 }, (_, index) => [
      refugioId, `Donante Solidario ${index + 1}`, pick(['Comunidad organizada', 'Empresa privada', 'Institución pública']), `donante${index + 1}@demo.local`, `0414-${String(1000000 + index)}`,
      JSON.stringify([{ item: pick(['Arroz', 'Ropa infantil', 'Kit de higiene', 'Agua potable']), quantity: 50 + Math.floor(random() * 250), unit: 'unidades' }]),
      'Almacén Demostrativo', daysAgo(Math.floor(random() * 30))
    ]);
    await insertMany(client, 'donations', ['refugio_id', 'donor_name', 'donor_organization', 'donor_email', 'donor_phone', 'items_json', 'destination_warehouse', 'received_at'], donationRows);

    await client.query('COMMIT');
    console.log(JSON.stringify({
      message: 'Sede demostrativa creada correctamente.',
      refugio_id: refugioId,
      sede: DEMO_NAME,
      residentes: residents.length,
      familias: families.length,
      camas: beds.length,
      raciones_registradas: mealRows.length,
      incidencias: incidentRows.length,
      inventario: inventorySeed.length,
      credencial_dashboard: 'supervision.demo@saren.local / DemoSaren2026!',
      credencial_sede: 'coordinacion.demo@saren.local / DemoSaren2026!'
    }, null, 2));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('No fue posible crear la sede demostrativa:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

seedDemo();
