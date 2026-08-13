const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');
const { buildFamilyReport, parseMetadata } = require('./familyReport');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const normalizeResidentDocumentId = value => {
  const documentId = String(value || '').trim();
  if (!documentId) return null;
  const normalized = documentId.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const placeholders = ['nt', 'sc', 'sinc', 'sindocumento', 'sincedula', 'nocedula', 'nottiene'];
  return placeholders.includes(normalized) ? null : documentId;
};

const normalizePersonName = value => String(value || '').trim().toLocaleUpperCase('es-VE');

const writeFamilyAudit = (executor, familyGroupId, userId, action, changes = {}) => executor.query(
  `INSERT INTO family_group_audit (family_group_id, user_id, action, changes)
   VALUES ($1, $2, $3, $4::jsonb)`,
  [familyGroupId, userId || null, action, JSON.stringify(changes || {})]
);

app.use(cors({
  origin: [
    'https://venezuelarenacera.com',
    'http://localhost:5173',
    'http://localhost:5180',
    process.env.LOCAL_FRONTEND_ORIGIN
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const fs = require('fs');
const path = require('path');

// --- INICIALIZACIÓN DE LA BASE DE DATOS ---
async function initDb() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(schemaSql);
      console.log('Esquema de base de datos inicializado/verificado exitosamente.');
    } else {
      console.warn('Advertencia: No se encontró el archivo schema.sql');
    }

    const runMigration = async (description, sql) => {
      try {
        await db.query(sql);
      } catch (err) {
        console.error(`Error en migración "${description}":`, err.message);
      }
    };

    // Dynamic alterations (safe to run on every startup)
    await runMigration('users.refugio_id', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS refugio_id INTEGER REFERENCES refugios(id) ON DELETE SET NULL');
    await runMigration('users.document_id', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS document_id VARCHAR(30)');
    await runMigration('users.photo', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT');
    await runMigration('users.staff_function', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_function VARCHAR(120)');
    await runMigration('users.is_active', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
    await runMigration('users.deleted_at', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP');
    await runMigration('meal_attendance.staff_id', 'ALTER TABLE meal_attendance ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
    await runMigration('meal_attendance.person_type', "ALTER TABLE meal_attendance ADD COLUMN IF NOT EXISTS person_type VARCHAR(20) DEFAULT 'resident'");
    await runMigration('access_logs.staff_id', 'ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
    await runMigration('access_logs.person_type', "ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS person_type VARCHAR(20) DEFAULT 'resident'");
    await runMigration('unique staff meal attendance per day', `CREATE UNIQUE INDEX IF NOT EXISTS unique_staff_meal_attendance_per_day
      ON meal_attendance (staff_id, meal_date, meal_type)
      WHERE staff_id IS NOT NULL`);
    await runMigration('menus.ingredients', 'ALTER TABLE menus ADD COLUMN IF NOT EXISTS ingredients TEXT');
    await runMigration('refugios.estado', 'ALTER TABLE refugios ADD COLUMN IF NOT EXISTS estado VARCHAR(100)');
    await runMigration('refugios.image_url', 'ALTER TABLE refugios ADD COLUMN IF NOT EXISTS image_url TEXT');
    await runMigration('incidents.involved_residents', 'ALTER TABLE incidents ADD COLUMN IF NOT EXISTS involved_residents TEXT DEFAULT \'[]\'');
    await runMigration('inventory.deposito_id', 'ALTER TABLE inventory ADD COLUMN IF NOT EXISTS deposito_id INTEGER REFERENCES depositos(id) ON DELETE SET NULL');
    await runMigration('inventory.quantity to numeric', 'ALTER TABLE inventory ALTER COLUMN quantity TYPE NUMERIC(12,2)');
    await runMigration('inventory.min_threshold to numeric', 'ALTER TABLE inventory ALTER COLUMN min_threshold TYPE NUMERIC(12,2)');
    await runMigration('inventory.units_per_package', 'ALTER TABLE inventory ADD COLUMN IF NOT EXISTS units_per_package INTEGER DEFAULT 1');
    await runMigration('inventory.sub_unit', 'ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sub_unit VARCHAR(20) DEFAULT NULL');
    await runMigration('users.card_printed', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS card_printed BOOLEAN DEFAULT FALSE');
    await runMigration('refugios.staff_config', "ALTER TABLE refugios ADD COLUMN IF NOT EXISTS staff_config TEXT DEFAULT '{}'");
    await runMigration('menus.diets_json', "ALTER TABLE menus ADD COLUMN IF NOT EXISTS diets_json TEXT DEFAULT '{}'");
    await runMigration('warehouse_requests.details', 'ALTER TABLE warehouse_requests ADD COLUMN IF NOT EXISTS details TEXT');
    await runMigration('warehouse_requests.unit', "ALTER TABLE warehouse_requests ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'Unidades'");
    await runMigration('family_groups.intake_data', "ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS intake_data JSONB DEFAULT '{}'::jsonb");
    await runMigration('family_groups.registered_by', 'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await runMigration('family_groups.updated_by', 'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await runMigration('family_groups.updated_at', 'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');
    await runMigration('family_groups.deleted_at', 'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP');
    await runMigration('family_groups.deleted_by', 'ALTER TABLE family_groups ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await runMigration('damnificados.deleted_family_group_id', 'ALTER TABLE damnificados ADD COLUMN IF NOT EXISTS deleted_family_group_id INTEGER REFERENCES family_groups(id) ON DELETE SET NULL');
    await runMigration('damnificados.registered_by', 'ALTER TABLE damnificados ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await runMigration('damnificados.updated_by', 'ALTER TABLE damnificados ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await runMigration('damnificados.updated_at', 'ALTER TABLE damnificados ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');
    await runMigration('resident names uppercase', `UPDATE damnificados
      SET first_name = UPPER(BTRIM(first_name)), last_name = UPPER(BTRIM(last_name))
      WHERE first_name <> UPPER(BTRIM(first_name)) OR last_name <> UPPER(BTRIM(last_name))`);
    await db.query(`CREATE TABLE IF NOT EXISTS family_group_audit (
      id SERIAL PRIMARY KEY,
      family_group_id INTEGER NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(30) NOT NULL,
      changes JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS medication_deliveries (
        id SERIAL PRIMARY KEY,
        refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
        resident_id INTEGER REFERENCES damnificados(id) ON DELETE CASCADE,
        inventory_item_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
        medication_index INTEGER,
        medication_name VARCHAR(150) NOT NULL,
        dose TEXT,
        quantity NUMERIC(10,2) NOT NULL,
        unit VARCHAR(30) DEFAULT 'Dosis',
        delivery_frequency VARCHAR(30) DEFAULT 'Única',
        notes TEXT,
        delivered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        delivered_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Convert inventory quantities to Numeric to support decimals
    await runMigration('inventory.quantity numeric', 'ALTER TABLE inventory ALTER COLUMN quantity TYPE NUMERIC(10,2)');
    await runMigration('inventory.min_threshold numeric', 'ALTER TABLE inventory ALTER COLUMN min_threshold TYPE NUMERIC(10,2)');

    // Migraciones para donantes, trazabilidad, consumo de comedor y asistencia manual
    await runMigration('donors table', `
      CREATE TABLE IF NOT EXISTS donors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        organization VARCHAR(255),
        rif VARCHAR(50) UNIQUE NOT NULL,
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await runMigration('donations.donor_rif', 'ALTER TABLE donations ADD COLUMN IF NOT EXISTS donor_rif VARCHAR(50)');
    await runMigration('inventory_movements table', `
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        refugio_id INTEGER NOT NULL REFERENCES refugios(id) ON DELETE CASCADE,
        inventory_id INTEGER,
        item_name VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        deposito_id INTEGER,
        deposito_name VARCHAR(255),
        inventory_type VARCHAR(50) NOT NULL,
        movement_type VARCHAR(50) NOT NULL,
        quantity NUMERIC(10, 2) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255),
        reference_id INTEGER,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await runMigration('menus.menu_date', 'ALTER TABLE menus ADD COLUMN IF NOT EXISTS menu_date DATE');
    await runMigration('menus.is_consumed', 'ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_consumed BOOLEAN DEFAULT FALSE');
    await runMigration('manual_meals_servings table', `
      CREATE TABLE IF NOT EXISTS manual_meals_servings (
        id SERIAL PRIMARY KEY,
        refugio_id INTEGER NOT NULL REFERENCES refugios(id) ON DELETE CASCADE,
        serving_date DATE NOT NULL,
        meal_type VARCHAR(50) NOT NULL,
        person_type VARCHAR(50) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        registered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_serving_per_day_type UNIQUE(refugio_id, serving_date, meal_type, person_type)
      )
    `);
    
    console.log('Migraciones dinámicas verificadas y aplicadas.');
  } catch (err) {
    console.error('Error al inicializar el esquema de base de datos:', err);
  }
}

// Helper para registrar trazabilidad de movimientos de inventario
async function logInventoryMovement(db, {
  refugio_id,
  inventory_id,
  item_name,
  category,
  deposito_id,
  deposito_name,
  inventory_type,
  movement_type,
  quantity,
  unit,
  user_id,
  user_name,
  reference_id,
  details
}) {
  try {
    let resolvedDepName = deposito_name;
    if (deposito_id && !resolvedDepName) {
      const depRes = await db.query('SELECT name FROM depositos WHERE id = $1', [deposito_id]);
      if (depRes.rows.length > 0) {
        resolvedDepName = depRes.rows[0].name;
      }
    }
    await db.query(
      `INSERT INTO inventory_movements (refugio_id, inventory_id, item_name, category, deposito_id, deposito_name, inventory_type, movement_type, quantity, unit, user_id, user_name, reference_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        parseInt(refugio_id),
        inventory_id ? parseInt(inventory_id) : null,
        item_name,
        category,
        deposito_id ? parseInt(deposito_id) : null,
        resolvedDepName || null,
        inventory_type,
        movement_type,
        parseFloat(quantity) || 0,
        unit || 'Unidades',
        user_id ? parseInt(user_id) : null,
        user_name || 'Sistema',
        reference_id ? parseInt(reference_id) : null,
        details || null
      ]
    );
  } catch (err) {
    console.error('Error al registrar movimiento de inventario en trazabilidad:', err);
  }
}

// Semilla para crear el usuario administrador inicial si no existe ninguno
async function seedAdmin() {
  try {
    const res = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(res.rows[0].count) === 0) {
      const adminEmail = 'admin@mincoex.gob.ve';
      const passwordHash = await bcrypt.hash('admin123', 10);
      await db.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        ['Administrador General', adminEmail, passwordHash, 'admin']
      );
      console.log('Usuario administrador inicial creado: admin@mincoex.gob.ve / admin123');
    }
  } catch (err) {
    console.error('Error al inicializar usuario administrador:', err);
  }
}

// Middleware de Autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no suministrado.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
    req.user = user;
    next();
  });
};

// Middleware para verificar que un usuario solo acceda a su refugio asignado
const checkRefugioAccess = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  if (req.user && req.user.role === 'supervisor') return next();

  let refugioId = req.params.refugioId || req.params.refugio_id || req.query.refugio_id || req.body.refugio_id;
  if (!refugioId) {
    const match = req.originalUrl.match(/\/api\/refugios\/(\d+)/);
    if (match) refugioId = match[1];
  }

  if (req.user && req.user.refugio_id && refugioId && parseInt(req.user.refugio_id) !== parseInt(refugioId)) {
    return res.status(403).json({ error: 'Acceso denegado. No pertenece a esta sede.' });
  }
  next();
};

// Middleware para evitar que un supervisor modifique datos internos del refugio
const restrictSupervisorModify = (req, res, next) => {
  if (req.user && req.user.role === 'supervisor' && req.method !== 'GET') {
    // Supervisor solo puede crear/eliminar usuarios y crear/editar sedes principales
    const isUserAction = req.path.startsWith('/users');
    const isSedeAction = req.path === '/refugios' || req.path.match(/^\/refugios\/\d+$/);

    if (!isUserAction && !isSedeAction) {
      return res.status(403).json({ error: 'El rol Supervisor solo tiene permisos de lectura sobre los datos internos.' });
    }
  }
  next();
};

const getCurrentMealWindow = (date = new Date()) => {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 6 * 60 && minutes <= 11 * 60) {
    return { mealType: 'Desayuno', label: '06:00 AM - 11:00 AM' };
  }
  if (minutes >= 11 * 60 + 30 && minutes < 15 * 60) {
    return { mealType: 'Almuerzo', label: '11:30 AM - 03:00 PM' };
  }
  if (minutes >= 15 * 60 && minutes <= 16 * 60) {
    return { mealType: 'Merienda', label: '03:00 PM - 04:00 PM' };
  }
  if (minutes >= 17 * 60 + 30 && minutes <= 22 * 60) {
    return { mealType: 'Cena', label: '05:30 PM - 10:00 PM' };
  }
  return null;
};

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos.' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE email = $1 AND COALESCE(is_active, TRUE) = TRUE', [email]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const user = userRes.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, refugio_id: user.refugio_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, refugio_id: user.refugio_id }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Aplicar seguridad y validación RBAC de forma global para todos los endpoints de /api (excepto login)
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();

  // Ejecutamos la autenticación de token primero
  authenticateToken(req, res, (err) => {
    if (err) return next(err);

    // Si la autenticación es exitosa, ejecutamos los controles de acceso de refugio y restricciones de supervisor
    checkRefugioAccess(req, res, (err2) => {
      if (err2) return next(err2);
      restrictSupervisorModify(req, res, next);
    });
  });
});

// Obtener info del usuario autenticado (consultando BD para evitar JWT obsoletos)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.query(
      'SELECT id, name, email, role, refugio_id FROM users WHERE id = $1 AND COALESCE(is_active, TRUE) = TRUE',
      [req.user.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json({ user: userRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Cambiar la contraseña de la cuenta autenticada.
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Debe indicar la contraseña actual y la nueva contraseña.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const userRes = await db.query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND COALESCE(is_active, TRUE) = TRUE',
      [req.user.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = userRes.rows[0];
    const validCurrentPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validCurrentPassword) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const repeatsCurrentPassword = await bcrypt.compare(new_password, user.password_hash);
    if (repeatsCurrentPassword) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser diferente de la contraseña actual.' });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, req.user.id]);

    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('Error cambiando contraseña propia:', err);
    res.status(500).json({ error: 'No fue posible actualizar la contraseña.' });
  }
});

// --- RUTAS DE GESTIÓN DE USUARIOS (RBAC) ---

// Obtener listado de usuarios según permisos del rol logueado
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    let queryText = '';
    let queryParams = [];

    if (req.user.role === 'admin') {
      // Superusuario ve todos los usuarios
      queryText = `
        SELECT u.id, u.name, u.email, u.role, u.document_id, NULL as photo, u.staff_function, u.refugio_id, u.card_printed, u.is_active, r.name as refugio_name
        FROM users u 
        LEFT JOIN refugios r ON u.refugio_id = r.id 
        WHERE COALESCE(u.is_active, TRUE) = TRUE
        ORDER BY u.id DESC
      `;
    } else if (req.user.role === 'supervisor') {
      // Supervisor ve solo los gerentes de cada sede
      queryText = `
        SELECT u.id, u.name, u.email, u.role, u.document_id, NULL as photo, u.staff_function, u.refugio_id, u.card_printed, u.is_active, r.name as refugio_name
        FROM users u 
        LEFT JOIN refugios r ON u.refugio_id = r.id 
        WHERE u.role = 'gerente' AND COALESCE(u.is_active, TRUE) = TRUE
        ORDER BY u.id DESC
      `;
    } else if (req.user.role === 'gerente' || req.user.role === 'registro') {
      // Gerente y registro ven todo el personal operativo asignado a su sede.
      queryText = `
        SELECT u.id, u.name, u.email, u.role, u.document_id, NULL as photo, u.staff_function, u.refugio_id, u.card_printed, u.is_active, r.name as refugio_name
        FROM users u 
        LEFT JOIN refugios r ON u.refugio_id = r.id 
        WHERE u.refugio_id = $1 AND COALESCE(u.is_active, TRUE) = TRUE
        ORDER BY u.id DESC
      `;
      queryParams = [req.user.refugio_id];
    } else {
      return res.status(403).json({ error: 'Acceso denegado. No tiene permisos para ver usuarios.' });
    }

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
});

// Obtener un usuario puntual con foto para edición o credencial individual.
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.document_id, u.photo, u.staff_function,
              u.refugio_id, u.card_printed, u.is_active, r.name as refugio_name
       FROM users u
       LEFT JOIN refugios r ON u.refugio_id = r.id
       WHERE u.id = $1 AND COALESCE(u.is_active, TRUE) = TRUE`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const targetUser = result.rows[0];

    if (req.user.role === 'supervisor' && targetUser.role !== 'gerente') {
      return res.status(403).json({ error: 'Supervisor solo puede consultar usuarios Gerentes.' });
    }

    if (req.user.role === 'gerente' || req.user.role === 'registro') {
      if (parseInt(targetUser.refugio_id) !== parseInt(req.user.refugio_id)) {
        return res.status(403).json({ error: 'No puedes consultar personal de otra sede.' });
      }
    } else if (req.user.role !== 'admin' && parseInt(req.user.id) !== parseInt(id)) {
      return res.status(403).json({ error: 'No autorizado para consultar este usuario.' });
    }

    res.json(targetUser);
  } catch (err) {
    console.error('Error al obtener usuario:', err);
    res.status(500).json({ error: 'Error al obtener usuario.' });
  }
});

// Crear usuario según jerarquía
app.post('/api/users', authenticateToken, async (req, res) => {
  let { name, email, password, role, refugio_id, document_id, photo, staff_function } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: 'Nombre y rol son obligatorios.' });
  }

  const cleanDocumentId = (document_id || '').trim();
  const cleanStaffFunction = (staff_function || '').trim();
  const requiresSignatureData = ['registro', 'apoyo'].includes(role);
  if (requiresSignatureData && (!cleanDocumentId || !cleanStaffFunction)) {
    return res.status(400).json({
      error: 'La cédula y la función institucional son obligatorias para el personal de Registro y OAC.'
    });
  }
  if (!email && cleanDocumentId) {
    email = `personal.${cleanDocumentId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@campamento.local`;
  }
  if (!email) {
    email = `personal.${Date.now()}@campamento.local`;
  }
  if (!password) {
    password = Math.random().toString(36).slice(2, 12);
  }

  // Validación de Jerarquía de Creación
  if (req.user.role === 'supervisor') {
    if (role !== 'gerente') {
      return res.status(403).json({ error: 'Supervisor solo tiene autorización para crear usuarios Gerentes.' });
    }
  } else if (req.user.role === 'gerente' || req.user.role === 'registro') {
    const allowedRoles = ['medico', 'seguridad', 'cocina', 'almacen', 'registro', 'apoyo'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Solo puede crear personal operativo para su sede.' });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No autorizado para crear usuarios.' });
  }

  try {
    // Verificar si el email ya existe
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    if (cleanDocumentId) {
      const documentCheck = await db.query(
        'SELECT id FROM users WHERE LOWER(BTRIM(document_id)) = LOWER($1) AND deleted_at IS NULL',
        [cleanDocumentId]
      );
      if (documentCheck.rows.length > 0) {
        return res.status(400).json({ error: 'La cédula ya está registrada para otro funcionario.' });
      }
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Asignación de refugio_id automática si el creador es Gerente
    let targetRefugioId = refugio_id;
    if (req.user.role === 'gerente' || req.user.role === 'registro') {
      targetRefugioId = req.user.refugio_id;
    }

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, refugio_id, document_id, photo, staff_function, is_active, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NULL)
       RETURNING id, name, email, role, refugio_id, document_id, photo, staff_function, card_printed, is_active`,
      [name, email, passwordHash, role, targetRefugioId || null, cleanDocumentId || null, photo || null, cleanStaffFunction || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el usuario.' });
  }
});

// Actualizar usuario según jerarquía
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role, refugio_id, document_id, photo, staff_function } = req.body;
  const shouldUpdatePhoto = Object.prototype.hasOwnProperty.call(req.body, 'photo');
  const cleanDocumentId = (document_id || '').trim();
  const cleanStaffFunction = (staff_function || '').trim();

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Nombre, email y rol son requeridos.' });
  }
  if (parseInt(id) === parseInt(req.user.id) && password && password.trim() !== '') {
    return res.status(400).json({
      error: 'Para cambiar su propia contraseña utilice la sección “Seguridad de mi cuenta”.'
    });
  }
  if (['registro', 'apoyo'].includes(role) && (!cleanDocumentId || !cleanStaffFunction)) {
    return res.status(400).json({
      error: 'La cédula y la función institucional son obligatorias para el personal de Registro y OAC.'
    });
  }

  // Validación de Jerarquía de Creación/Modificación
  if (req.user.role === 'supervisor') {
    if (role !== 'gerente') {
      return res.status(403).json({ error: 'Supervisor solo tiene autorización para gestionar usuarios Gerentes.' });
    }
  } else if (req.user.role === 'gerente' || req.user.role === 'registro') {
    const allowedRoles = ['medico', 'seguridad', 'cocina', 'almacen', 'registro', 'apoyo'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Solo puede gestionar personal operativo para su sede.' });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No autorizado para modificar usuarios.' });
  }

  try {
    // Verificar si el email ya existe para otro usuario
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, id]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario.' });
    }

    if (cleanDocumentId) {
      const documentCheck = await db.query(
        'SELECT id FROM users WHERE LOWER(BTRIM(document_id)) = LOWER($1) AND id <> $2 AND deleted_at IS NULL',
        [cleanDocumentId, id]
      );
      if (documentCheck.rows.length > 0) {
        return res.status(400).json({ error: 'La cédula ya está registrada para otro funcionario.' });
      }
    }

    // Asignación de refugio_id automática si el creador es Gerente
    let targetRefugioId = refugio_id;
    if (req.user.role === 'gerente' || req.user.role === 'registro') {
      targetRefugioId = req.user.refugio_id;
    }

    let queryText = `UPDATE users
      SET name = $1, email = $2, role = $3, refugio_id = $4, document_id = $5,
          photo = CASE WHEN $8::boolean THEN $6 ELSE photo END,
          staff_function = $7
      WHERE id = $9
      RETURNING id, name, email, role, refugio_id, document_id, photo, staff_function`;
    let queryParams = [name, email, role, targetRefugioId || null, cleanDocumentId || null, photo || null, cleanStaffFunction || null, shouldUpdatePhoto, id];

    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      queryText = `UPDATE users
        SET name = $1, email = $2, role = $3, refugio_id = $4, document_id = $5,
            photo = CASE WHEN $9::boolean THEN $6 ELSE photo END,
            staff_function = $7,
            password_hash = $8
        WHERE id = $10
        RETURNING id, name, email, role, refugio_id, document_id, photo, staff_function`;
      queryParams = [name, email, role, targetRefugioId || null, cleanDocumentId || null, photo || null, cleanStaffFunction || null, passwordHash, shouldUpdatePhoto, id];
    }

    const result = await db.query(queryText, queryParams);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el usuario.' });
  }
});

// Eliminar usuario según jerarquía
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const targetUser = userRes.rows[0];

    // Impedir eliminarse a uno mismo
    if (parseInt(req.user.id) === parseInt(id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
    }

    // Reglas de eliminación por rol
    if (req.user.role === 'supervisor') {
      if (targetUser.role !== 'gerente') {
        return res.status(403).json({ error: 'Supervisor solo puede eliminar usuarios con rol Gerente.' });
      }
    } else if (req.user.role === 'gerente' || req.user.role === 'registro') {
      if (parseInt(targetUser.refugio_id) !== parseInt(req.user.refugio_id)) {
        return res.status(403).json({ error: 'No puedes eliminar personal de otra sede.' });
      }
      if (targetUser.role === 'gerente' || targetUser.role === 'admin' || targetUser.role === 'supervisor') {
        return res.status(403).json({ error: 'No tienes permisos para eliminar a este nivel de usuario.' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado para eliminar usuarios.' });
    }

    await db.query('UPDATE users SET is_active = FALSE, deleted_at = NOW() WHERE id = $1', [id]);
    res.json({ message: 'Usuario desactivado exitosamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
});

// Actualizar estado de impresión del carnet del usuario
app.patch('/api/users/:id/print', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { card_printed } = req.body;
  try {
    const result = await db.query(
      'UPDATE users SET card_printed = $1 WHERE id = $2 RETURNING id, card_printed',
      [!!card_printed, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar estado de impresión.' });
  }
});

// --- RUTAS DE REFUGIOS ---

// Obtener todos los refugios
app.get('/api/refugios', authenticateToken, async (req, res) => {
  try {
    // Obtenemos los refugios con el conteo de damnificados actual y alertas
    const queryText = `
      SELECT r.*, COUNT(d.id)::int as damnificados_count 
      FROM refugios r 
      LEFT JOIN damnificados d ON r.id = d.refugio_id AND d.status = 'Activo'
      GROUP BY r.id 
      ORDER BY r.name ASC
    `;
    const result = await db.query(queryText);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los refugios.' });
  }
});

// Obtener un refugio específico
app.get('/api/refugios/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM refugios WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Refugio no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el refugio.' });
  }
});

app.get('/api/refugios/:refugio_id/staff-count', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    const result = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE refugio_id = $1
       AND role NOT IN ('admin', 'supervisor')
       AND COALESCE(is_active, TRUE) = TRUE`,
      [parseInt(refugio_id)]
    );
    res.json({ count: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener conteo de personal.' });
  }
});

app.get('/api/refugios/:refugio_id/staff', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const includePhoto = req.query.include_photo === 'true';
  const photoColumn = includePhoto ? 'photo' : 'NULL as photo';
  try {
    const startedAt = Date.now();
    const result = await db.query(
      `SELECT id, name, email, role, document_id, ${photoColumn}, staff_function, refugio_id, card_printed, is_active
       FROM users
       WHERE refugio_id = $1
       AND role NOT IN ('admin', 'supervisor')
       AND COALESCE(is_active, TRUE) = TRUE
       ORDER BY name ASC`,
      [parseInt(refugio_id)]
    );
    console.log(`Personal de sede ${refugio_id} consultado: ${result.rows.length} registros en ${Date.now() - startedAt}ms`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener personal de la sede:', err);
    res.status(500).json({ error: 'Error al obtener personal de la sede.' });
  }
});

// Crear refugio
app.post('/api/refugios', authenticateToken, async (req, res) => {
  const { name, location, capacity, contact_phone, status, image_url, estado } = req.body;
  if (!name || !location || capacity === undefined) {
    return res.status(400).json({ error: 'Nombre, ubicación y capacidad son requeridos.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO refugios (name, location, capacity, contact_phone, status, image_url, estado) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, location, capacity, contact_phone, status || 'Operativo', image_url || null, estado || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el refugio.' });
  }
});

// Actualizar refugio
app.put('/api/refugios/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, location, capacity, contact_phone, status, image_url, estado, staff_config } = req.body;

  try {
    const result = await db.query(
      'UPDATE refugios SET name = $1, location = $2, capacity = $3, contact_phone = $4, status = $5, image_url = $6, estado = $7, staff_config = $8 WHERE id = $9 RETURNING *',
      [name, location, capacity, contact_phone, status, image_url || null, estado || null, staff_config || '{}', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Refugio no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el refugio.' });
  }
});

// Eliminar refugio
app.delete('/api/refugios/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM refugios WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Refugio no encontrado.' });
    }
    res.json({ message: 'Refugio eliminado exitosamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el refugio.' });
  }
});

// --- RUTAS DE GRUPOS FAMILIARES ---
app.get('/api/family-groups', authenticateToken, async (req, res) => {
  const { refugio_id, include_deleted } = req.query;
  try {
    const params = [];
    const filters = [include_deleted === 'true' ? 'fg.deleted_at IS NOT NULL' : 'fg.deleted_at IS NULL'];
    if (refugio_id) {
      params.push(parseInt(refugio_id));
      filters.push(`EXISTS (SELECT 1 FROM damnificados scoped
        WHERE (scoped.family_group_id = fg.id OR scoped.deleted_family_group_id = fg.id) AND scoped.refugio_id = $1)`);
    }
    const result = await db.query(`
      SELECT fg.*,
             creator.name AS registered_by_name,
             creator.document_id AS registered_by_document,
             creator.staff_function AS registered_by_function,
             updater.name AS updated_by_name,
             updater.document_id AS updated_by_document,
             updater.staff_function AS updated_by_function,
             deleter.name AS deleted_by_name,
             COUNT(d.id) FILTER (WHERE d.status = 'Activo')::int as members_count,
             COUNT(d.id)::int as total_members,
             COUNT(d.id) FILTER (
               WHERE d.status = 'Activo'
                 AND d.special_needs ~ '"tiene_mascotas"\\s*:\\s*"Sí"'
             )::int as pets_count
      FROM family_groups fg
      LEFT JOIN damnificados d ON fg.id = COALESCE(d.family_group_id, d.deleted_family_group_id)
      LEFT JOIN users creator ON creator.id = fg.registered_by
      LEFT JOIN users updater ON updater.id = fg.updated_by
      LEFT JOIN users deleter ON deleter.id = fg.deleted_by
      WHERE ${filters.join(' AND ')}
      GROUP BY fg.id, creator.id, updater.id, deleter.id
      ORDER BY fg.family_name ASC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener grupos familiares.' });
  }
});

app.get('/api/family-groups/export', authenticateToken, async (req, res) => {
  const refugioId = parseInt(req.query.refugio_id);
  if (!refugioId) return res.status(400).json({ error: 'La sede es requerida para generar el reporte.' });

  try {
    const refugioResult = await db.query('SELECT id, name, location FROM refugios WHERE id = $1', [refugioId]);
    if (refugioResult.rows.length === 0) return res.status(404).json({ error: 'Campamento temporal no encontrado.' });

    const residentsResult = await db.query(
      `SELECT d.*, fg.family_name
       FROM damnificados d
       LEFT JOIN family_groups fg ON d.family_group_id = fg.id AND fg.deleted_at IS NULL
       WHERE d.refugio_id = $1 AND d.status = 'Activo'
       ORDER BY (d.family_group_id IS NULL) ASC, fg.family_name ASC, d.created_at ASC`,
      [refugioId]
    );

    const grouped = new Map();
    residentsResult.rows.forEach(resident => {
      const isSolo = !resident.family_group_id;
      const groupKey = isSolo ? `solo-${resident.id}` : `family-${resident.family_group_id}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          id: resident.family_group_id,
          family_name: isSolo ? `FAMILIA UNIPERSONAL - ${resident.first_name} ${resident.last_name}` : resident.family_name,
          isSolo,
          members: []
        });
      }
      grouped.get(groupKey).members.push(resident);
    });

    const families = Array.from(grouped.values()).map(family => ({
      ...family,
      members: family.members.sort((left, right) => {
        const leftHead = parseMetadata(left.special_needs).es_cabeza_familia === true ? 0 : 1;
        const rightHead = parseMetadata(right.special_needs).es_cabeza_familia === true ? 0 : 1;
        return leftHead - rightHead || `${left.first_name} ${left.last_name}`.localeCompare(`${right.first_name} ${right.last_name}`, 'es');
      })
    }));

    const report = await buildFamilyReport({
      refugio: refugioResult.rows[0],
      responsibleName: req.user?.name || '',
      families
    });
    const safeName = refugioResult.rows[0].name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="DATA_UNICA_${safeName}.xlsx"`);
    res.send(Buffer.from(report));
  } catch (err) {
    console.error('Error al exportar reporte de familias:', err);
    res.status(500).json({ error: 'No se pudo generar el reporte Excel de familias.' });
  }
});

app.post('/api/family-groups', authenticateToken, async (req, res) => {
  const { family_name, block_assignment, intake_data = {} } = req.body;
  if (!family_name) return res.status(400).json({ error: 'El nombre de la familia es requerido.' });
  try {
    const duplicate = await db.query('SELECT id, family_name FROM family_groups WHERE deleted_at IS NULL AND LOWER(TRIM(family_name)) = LOWER(TRIM($1)) LIMIT 1', [family_name]);
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una familia con ese mismo nombre. Use la opción de unificar familias si se trata de un duplicado.', existing_family: duplicate.rows[0] });
    }
    const result = await db.query(
      `INSERT INTO family_groups (family_name, block_assignment, intake_data, registered_by, updated_by)
       VALUES ($1, $2, $3::jsonb, $4, $4) RETURNING *`,
      [family_name, block_assignment, JSON.stringify(intake_data || {}), req.user?.id || null]
    );
    await writeFamilyAudit(db, result.rows[0].id, req.user?.id, 'CREATED', { family_name, block_assignment });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear grupo familiar.' });
  }
});

app.put('/api/family-groups/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { family_name, block_assignment, intake_data } = req.body;
  if (!family_name || !family_name.trim()) return res.status(400).json({ error: 'El nombre de la familia es requerido.' });
  try {
    const duplicate = await db.query(
      'SELECT id FROM family_groups WHERE deleted_at IS NULL AND LOWER(TRIM(family_name)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1',
      [family_name, id]
    );
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe otra familia con ese mismo nombre. Unifique ambos grupos en lugar de renombrarlos igual.' });
    }
    const result = await db.query(
      `UPDATE family_groups
       SET family_name = $1,
           block_assignment = $2,
           intake_data = COALESCE($3::jsonb, intake_data, '{}'::jsonb),
           updated_by = $4,
           updated_at = NOW()
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING *`,
      [family_name.trim(), block_assignment || null, intake_data === undefined ? null : JSON.stringify(intake_data || {}), req.user?.id || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Grupo familiar no encontrado.' });
    await writeFamilyAudit(db, result.rows[0].id, req.user?.id, 'UPDATED', {
      family_name: family_name.trim(), block_assignment: block_assignment || null, intake_data_updated: intake_data !== undefined
    });
    const enriched = await db.query(
      `SELECT fg.*, u.name AS updated_by_name, u.document_id AS updated_by_document,
              u.staff_function AS updated_by_function
       FROM family_groups fg LEFT JOIN users u ON u.id = fg.updated_by WHERE fg.id = $1`,
      [result.rows[0].id]
    );
    res.json(enriched.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el grupo familiar.' });
  }
});

app.get('/api/family-groups/:id/audit', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.action, a.changes, a.created_at, u.name AS user_name,
              u.document_id AS user_document, u.staff_function AS user_function
       FROM family_group_audit a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.family_group_id = $1
       ORDER BY a.created_at DESC, a.id DESC`,
      [parseInt(req.params.id)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo obtener la trazabilidad de la familia.' });
  }
});

app.delete('/api/family-groups/:id', authenticateToken, async (req, res) => {
  const familyId = parseInt(req.params.id);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const family = await client.query(
      `UPDATE family_groups SET deleted_at = NOW(), deleted_by = $2, updated_by = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id, family_name`,
      [familyId, req.user?.id || null]
    );
    if (!family.rows.length) throw Object.assign(new Error('Familia no encontrada o ya eliminada.'), { status: 404 });
    const moved = await client.query(
      `UPDATE damnificados SET deleted_family_group_id = family_group_id, family_group_id = NULL,
       updated_by = $2, updated_at = NOW() WHERE family_group_id = $1 RETURNING id`,
      [familyId, req.user?.id || null]
    );
    await writeFamilyAudit(client, familyId, req.user?.id, 'DELETED', { detached_members: moved.rowCount });
    await client.query('COMMIT');
    res.json({ message: 'Familia eliminada. Sus residentes conservan su ficha y pueden recuperarse al restaurarla.', detached_members: moved.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'No se pudo eliminar la familia.' });
  } finally { client.release(); }
});

app.put('/api/family-groups/:id/restore', authenticateToken, async (req, res) => {
  const familyId = parseInt(req.params.id);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const family = await client.query(
      `UPDATE family_groups SET deleted_at = NULL, deleted_by = NULL, updated_by = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id, family_name`,
      [familyId, req.user?.id || null]
    );
    if (!family.rows.length) throw Object.assign(new Error('Familia no encontrada o ya restaurada.'), { status: 404 });
    const restored = await client.query(
      `UPDATE damnificados SET family_group_id = $1, deleted_family_group_id = NULL,
       updated_by = $2, updated_at = NOW()
       WHERE deleted_family_group_id = $1 AND family_group_id IS NULL RETURNING id`,
      [familyId, req.user?.id || null]
    );
    await writeFamilyAudit(client, familyId, req.user?.id, 'RESTORED', { restored_members: restored.rowCount });
    await client.query('COMMIT');
    res.json({ message: 'Familia restaurada correctamente.', restored_members: restored.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'No se pudo restaurar la familia.' });
  } finally { client.release(); }
});

app.post('/api/family-groups/merge', authenticateToken, async (req, res) => {
  const sourceId = parseInt(req.body.source_id);
  const targetId = parseInt(req.body.target_id);
  const refugioId = parseInt(req.body.refugio_id);
  if (!sourceId || !targetId || !refugioId || sourceId === targetId) {
    return res.status(400).json({ error: 'Seleccione dos familias diferentes y una sede válida.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const groups = await client.query('SELECT id, family_name FROM family_groups WHERE id = ANY($1::int[]) FOR UPDATE', [[sourceId, targetId]]);
    if (groups.rows.length !== 2) throw Object.assign(new Error('Una de las familias no existe.'), { status: 404 });

    const outsideScope = await client.query(
      `SELECT COUNT(*)::int AS count FROM damnificados
       WHERE family_group_id = ANY($1::int[]) AND refugio_id IS DISTINCT FROM $2`,
      [[sourceId, targetId], refugioId]
    );
    if (outsideScope.rows[0].count > 0) {
      throw Object.assign(new Error('No se puede unificar porque una familia contiene residentes de otra sede.'), { status: 409 });
    }

    const sourceMembers = await client.query(
      'SELECT id, special_needs FROM damnificados WHERE family_group_id = $1 AND refugio_id = $2 FOR UPDATE',
      [sourceId, refugioId]
    );
    for (const member of sourceMembers.rows) {
      try {
        const metadata = JSON.parse(member.special_needs || '{}');
        if (metadata.es_cabeza_familia === true) {
          metadata.es_cabeza_familia = false;
          metadata.parentesco = metadata.parentesco || 'Familiar';
          await client.query('UPDATE damnificados SET special_needs = $1 WHERE id = $2', [JSON.stringify(metadata), member.id]);
        }
      } catch {
        // Preserve legacy metadata that is not valid JSON; the family link can still be corrected safely.
      }
    }

    await client.query(
      `UPDATE family_groups AS target
       SET intake_data = CASE
             WHEN target.intake_data IS NULL OR target.intake_data = '{}'::jsonb
               THEN COALESCE(source.intake_data, '{}'::jsonb)
             ELSE target.intake_data
           END,
           registered_by = COALESCE(target.registered_by, source.registered_by),
           updated_by = $3,
           updated_at = NOW()
       FROM family_groups AS source
       WHERE target.id = $1 AND source.id = $2`,
      [targetId, sourceId, req.user?.id || null]
    );

    const moved = await client.query(
      'UPDATE damnificados SET family_group_id = $1, updated_by = $4, updated_at = NOW() WHERE family_group_id = $2 AND refugio_id = $3 RETURNING id',
      [targetId, sourceId, refugioId, req.user?.id || null]
    );
    await client.query('DELETE FROM family_groups WHERE id = $1', [sourceId]);
    await client.query('COMMIT');
    res.json({ message: 'Familias unificadas correctamente.', moved_members: moved.rowCount, target_family_id: targetId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Error al unificar las familias.' });
  } finally {
    client.release();
  }
});

// --- RUTAS DE DAMNIFICADOS ---

// Convertir de forma atómica a un residente en cabeza de familia
app.put('/api/damnificados/:id/promote-head', authenticateToken, async (req, res) => {
  const residentId = parseInt(req.params.id);
  const refugioId = parseInt(req.body.refugio_id);
  if (!residentId || !refugioId) {
    return res.status(400).json({ error: 'Residente y sede son requeridos.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const residentResult = await client.query(
      `SELECT id, document_id, first_name, last_name, family_group_id, special_needs, status
       FROM damnificados
       WHERE id = $1 AND refugio_id = $2
       FOR UPDATE`,
      [residentId, refugioId]
    );
    if (residentResult.rows.length === 0) {
      throw Object.assign(new Error('La residente no existe en esta sede.'), { status: 404 });
    }

    const resident = residentResult.rows[0];
    if (String(resident.status || 'Activo').trim().toLowerCase() !== 'activo') {
      throw Object.assign(new Error('Debe reactivar a la residente antes de convertirla en cabeza de familia.'), { status: 409 });
    }

    let familyGroupId = resident.family_group_id;
    let familyName = '';

    if (!familyGroupId) {
      const baseFamilyName = `Familia de ${resident.first_name} ${resident.last_name} (C.I. ${resident.document_id || 'S/C'})`;
      const duplicateResult = await client.query(
        `SELECT fg.id, fg.family_name,
                (SELECT COUNT(*)::int FROM damnificados d WHERE d.family_group_id = fg.id) AS member_count
         FROM family_groups fg
         WHERE LOWER(TRIM(fg.family_name)) = LOWER(TRIM($1))
         LIMIT 1
         FOR UPDATE`,
        [baseFamilyName]
      );

      if (duplicateResult.rows.length > 0 && duplicateResult.rows[0].member_count === 0) {
        familyGroupId = duplicateResult.rows[0].id;
        familyName = duplicateResult.rows[0].family_name;
        await client.query(
          'UPDATE family_groups SET registered_by = COALESCE(registered_by, $1), updated_by = $1, updated_at = NOW() WHERE id = $2',
          [req.user?.id || null, familyGroupId]
        );
      } else {
        familyName = duplicateResult.rows.length > 0
          ? `${baseFamilyName} - Registro ${resident.id}`
          : baseFamilyName;
        const familyResult = await client.query(
          `INSERT INTO family_groups (family_name, block_assignment, registered_by, updated_by)
           VALUES ($1, $2, $3, $3)
           RETURNING id, family_name`,
          [familyName, 'Por asignar', req.user?.id || null]
        );
        familyGroupId = familyResult.rows[0].id;
        familyName = familyResult.rows[0].family_name;
      }
    } else {
      const familyResult = await client.query(
        'SELECT id, family_name FROM family_groups WHERE id = $1 FOR UPDATE',
        [familyGroupId]
      );
      if (familyResult.rows.length === 0) {
        throw Object.assign(new Error('El grupo familiar asociado ya no existe.'), { status: 404 });
      }
      familyName = familyResult.rows[0].family_name;

      const otherMembers = await client.query(
        'SELECT id, special_needs FROM damnificados WHERE family_group_id = $1 AND id <> $2 FOR UPDATE',
        [familyGroupId, residentId]
      );
      for (const member of otherMembers.rows) {
        const memberMetadata = parseMetadata(member.special_needs);
        if (memberMetadata && typeof memberMetadata === 'object' && memberMetadata.es_cabeza_familia === true) {
          memberMetadata.es_cabeza_familia = false;
          memberMetadata.parentesco = memberMetadata.parentesco || 'Familiar';
          await client.query(
            'UPDATE damnificados SET special_needs = $1 WHERE id = $2',
            [JSON.stringify(memberMetadata), member.id]
          );
        }
      }
    }

    const parsedMetadata = parseMetadata(resident.special_needs);
    const metadata = parsedMetadata && typeof parsedMetadata === 'object' && !Array.isArray(parsedMetadata)
      ? parsedMetadata
      : {};
    metadata.es_cabeza_familia = true;
    delete metadata.parentesco;

    const updated = await client.query(
      `UPDATE damnificados
       SET family_group_id = $1, special_needs = $2
       WHERE id = $3
       RETURNING *`,
      [familyGroupId, JSON.stringify(metadata), residentId]
    );

    await client.query('COMMIT');
    res.json({
      ...updated.rows[0],
      family_name: familyName,
      message: `${resident.first_name} ${resident.last_name} quedó registrada como cabeza de familia.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al convertir residente en cabeza de familia:', err);
    res.status(err.status || 500).json({ error: err.message || 'No se pudo crear o actualizar el grupo familiar.' });
  } finally {
    client.release();
  }
});

// Obtener damnificados
app.get('/api/damnificados', authenticateToken, async (req, res) => {
  const { refugio_id, search, family_group_id, minors_without_document } = req.query;
  try {
    let queryText = `
      SELECT d.*, r.name as refugio_name, fg.family_name,
             creator.name AS registered_by_name,
             updater.name AS updated_by_name
      FROM damnificados d 
      LEFT JOIN refugios r ON d.refugio_id = r.id 
      LEFT JOIN family_groups fg ON d.family_group_id = fg.id
      LEFT JOIN users creator ON creator.id = d.registered_by
      LEFT JOIN users updater ON updater.id = d.updated_by
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (refugio_id) {
      queryText += ` AND d.refugio_id = $${paramIndex}`;
      params.push(refugio_id);
      paramIndex++;
    }

    if (family_group_id) {
      queryText += ` AND d.family_group_id = $${paramIndex}`;
      params.push(family_group_id);
      paramIndex++;
    }

    if (minors_without_document === 'true') {
      queryText += ` AND d.family_group_id IS NULL
                     AND (d.document_id IS NULL OR BTRIM(d.document_id) = '')
                     AND (d.birth_date IS NULL OR d.birth_date > CURRENT_DATE - INTERVAL '18 years')
                     AND LOWER(TRIM(COALESCE(d.status, 'Activo'))) = 'activo'`;
    }

    if (search) {
      const parsedSearchId = parseInt(search);
      if (!isNaN(parsedSearchId)) {
        queryText += ` AND (d.id = $${paramIndex} OR CONCAT_WS(' ', d.first_name, d.last_name) ILIKE $${paramIndex + 1} OR d.document_id ILIKE $${paramIndex + 1})`;
        params.push(parsedSearchId);
        params.push(`%${search}%`);
        paramIndex += 2;
      } else {
        queryText += ` AND (CONCAT_WS(' ', d.first_name, d.last_name) ILIKE $${paramIndex} OR d.document_id ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }
    }

    queryText += ' ORDER BY d.created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener damnificados.' });
  }
});

// Vincular un residente ya registrado a un grupo familiar existente
app.put('/api/damnificados/:id/family', authenticateToken, async (req, res) => {
  const residentId = parseInt(req.params.id);
  const familyGroupId = parseInt(req.body.family_group_id);
  const refugioId = parseInt(req.body.refugio_id);
  const parentesco = String(req.body.parentesco || '').trim();

  if (!residentId || !familyGroupId || !refugioId || !parentesco) {
    return res.status(400).json({ error: 'Residente, familia, sede y parentesco son requeridos.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const familyResult = await client.query(
      `SELECT fg.id, fg.family_name
       FROM family_groups fg
       WHERE fg.id = $1
         AND EXISTS (
           SELECT 1 FROM damnificados member
           WHERE member.family_group_id = fg.id AND member.refugio_id = $2
         )
       FOR UPDATE`,
      [familyGroupId, refugioId]
    );
    if (familyResult.rows.length === 0) {
      throw Object.assign(new Error('La familia seleccionada no existe en esta sede.'), { status: 404 });
    }

    const residentResult = await client.query(
      `SELECT id, first_name, last_name, family_group_id, special_needs, status
       FROM damnificados
       WHERE id = $1 AND refugio_id = $2
       FOR UPDATE`,
      [residentId, refugioId]
    );
    if (residentResult.rows.length === 0) {
      throw Object.assign(new Error('El residente no existe en esta sede.'), { status: 404 });
    }

    const resident = residentResult.rows[0];
    if (String(resident.status || 'Activo').trim().toLowerCase() !== 'activo') {
      throw Object.assign(new Error('Solo se pueden vincular residentes activos.'), { status: 409 });
    }
    if (resident.family_group_id === familyGroupId) {
      throw Object.assign(new Error('El residente ya pertenece a esta familia.'), { status: 409 });
    }
    if (resident.family_group_id) {
      throw Object.assign(new Error('El residente ya pertenece a otra familia. Use la opción de unificar familias para corregir ese caso.'), { status: 409 });
    }

    const parsedMetadata = parseMetadata(resident.special_needs);
    const metadata = parsedMetadata && typeof parsedMetadata === 'object' && !Array.isArray(parsedMetadata)
      ? parsedMetadata
      : {};
    metadata.es_cabeza_familia = false;
    metadata.parentesco = parentesco;

    const updated = await client.query(
      `UPDATE damnificados
       SET family_group_id = $1, special_needs = $2
       WHERE id = $3
       RETURNING *`,
      [familyGroupId, JSON.stringify(metadata), residentId]
    );

    await client.query('COMMIT');
    res.json({
      ...updated.rows[0],
      family_name: familyResult.rows[0].family_name,
      message: `${resident.first_name} ${resident.last_name} fue vinculado a la familia correctamente.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'No se pudo vincular el residente a la familia.' });
  } finally {
    client.release();
  }
});

// Crear damnificado
app.post('/api/damnificados', authenticateToken, async (req, res) => {
  const { document_id, first_name, last_name, birth_date, gender, health_status, special_needs, refugio_id, family_group_id } = req.body;
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'Nombre y apellido son requeridos.' });
  }

  try {
    // Validar capacidad del refugio
    if (refugio_id) {
      const refugioRes = await db.query('SELECT capacity FROM refugios WHERE id = $1', [refugio_id]);
      if (refugioRes.rows.length > 0) {
        const capacity = refugioRes.rows[0].capacity;
        const countRes = await db.query("SELECT COUNT(*) FROM damnificados WHERE refugio_id = $1 AND status = 'Activo'", [refugio_id]);
        const currentCount = parseInt(countRes.rows[0].count);
        
        if (currentCount >= capacity) {
          return res.status(400).json({ error: 'El refugio seleccionado ya se encuentra a su máxima capacidad.' });
        }
      }
    }

    const result = await db.query(
      `INSERT INTO damnificados 
      (document_id, first_name, last_name, birth_date, gender, health_status, special_needs, refugio_id, family_group_id, registered_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING *`,
      [normalizeResidentDocumentId(document_id), normalizePersonName(first_name), normalizePersonName(last_name), birth_date || null, gender || null, health_status || 'Estable', special_needs || null, refugio_id || null, family_group_id || null, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un registro con esta Cédula de Identidad.' });
    }
    res.status(500).json({ error: 'Error al registrar damnificado.' });
  }
});

// Actualizar damnificado
app.put('/api/damnificados/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { document_id, first_name, last_name, birth_date, gender, health_status, special_needs, refugio_id, family_group_id, status } = req.body;

  try {
    if ((status || 'Activo') === 'Activo' && refugio_id) {
      const capacityCheck = await db.query(
        `SELECT r.capacity,
                COUNT(d.id) FILTER (WHERE d.status = 'Activo' AND d.id <> $2)::int AS active_count
         FROM refugios r
         LEFT JOIN damnificados d ON d.refugio_id = r.id
         WHERE r.id = $1
         GROUP BY r.id`,
        [refugio_id, id]
      );
      if (capacityCheck.rows.length > 0 && capacityCheck.rows[0].active_count >= capacityCheck.rows[0].capacity) {
        return res.status(400).json({ error: 'No se puede activar al residente porque el campamento temporal alcanzó su capacidad máxima.' });
      }
    }
    const result = await db.query(
      `UPDATE damnificados SET 
        document_id = $1, first_name = $2, last_name = $3, birth_date = $4, 
        gender = $5, health_status = $6, special_needs = $7, refugio_id = $8,
        family_group_id = $9, status = $10, updated_by = $11, updated_at = NOW()
      WHERE id = $12 RETURNING *`,
      [normalizeResidentDocumentId(document_id), normalizePersonName(first_name), normalizePersonName(last_name), birth_date || null, gender || null, health_status || 'Estable', special_needs || null, refugio_id || null, family_group_id || null, status || 'Activo', req.user?.id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un registro con esta Cédula de Identidad.' });
    }
    res.status(500).json({ error: 'Error al actualizar el registro.' });
  }
});

// Eliminar damnificado
app.delete('/api/damnificados/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM damnificados WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }
    res.json({ message: 'Registro de damnificado eliminado exitosamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el registro.' });
  }
});

// --- RUTAS DE CAMAS ---
app.get('/api/refugios/:refugio_id/beds', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    const result = await db.query(`
      SELECT b.*, d.first_name, d.last_name, d.document_id, d.special_needs 
      FROM beds b
      LEFT JOIN damnificados d ON b.resident_id = d.id
      WHERE b.refugio_id = $1
      ORDER BY b.room_number ASC, b.bed_number ASC
    `, [refugio_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener camas.' });
  }
});

app.put('/api/beds/:id/assign', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { resident_id } = req.body;
  try {
    if (resident_id) {
      await db.query('UPDATE beds SET resident_id = NULL, status = $1 WHERE resident_id = $2', ['Disponible', resident_id]);
    }
    const status = resident_id ? 'Ocupada' : 'Disponible';
    const result = await db.query(
      'UPDATE beds SET resident_id = $1, status = $2 WHERE id = $3 RETURNING *',
      [resident_id || null, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cama no encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar cama.' });
  }
});

app.post('/api/refugios/:refugio_id/beds/initialize', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    // Inicializar 10 habitaciones con 4 camas cada una para fines de prueba
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 4; c++) {
        await db.query(`
          INSERT INTO beds (refugio_id, room_number, bed_number, status)
          VALUES ($1, $2, $3, 'Disponible')
          ON CONFLICT (refugio_id, room_number, bed_number) DO NOTHING
        `, [refugio_id, `Habitación ${r}`, `Cama ${c}`]);
      }
    }
    res.json({ message: 'Camas inicializadas exitosamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al inicializar camas.' });
  }
});

// Crear espacio/habitación personalizado con un número de camas
app.post('/api/refugios/:refugio_id/beds/space', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { room_number, bed_count } = req.body;
  if (!room_number || !bed_count) {
    return res.status(400).json({ error: 'El nombre del salón/espacio y la cantidad de camas son requeridos.' });
  }

  try {
    for (let c = 1; c <= parseInt(bed_count); c++) {
      await db.query(`
        INSERT INTO beds (refugio_id, room_number, bed_number, status)
        VALUES ($1, $2, $3, 'Disponible')
        ON CONFLICT (refugio_id, room_number, bed_number) DO NOTHING
      `, [refugio_id, room_number, `Cama ${c}`]);
    }
    res.status(201).json({ message: `Espacio '${room_number}' creado con ${bed_count} camas.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el espacio personalizado.' });
  }
});

// Eliminar un espacio/habitación completo (y sus camas)
app.delete('/api/refugios/:refugio_id/beds/space', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const room_number = req.query.room_number || req.body.room_number;
  if (!room_number) {
    return res.status(400).json({ error: 'El nombre de la habitación es requerido.' });
  }

  try {
    const result = await db.query(
      'DELETE FROM beds WHERE refugio_id = $1 AND room_number = $2 RETURNING *',
      [parseInt(refugio_id), room_number]
    );
    res.json({ message: `Espacio '${room_number}' y sus ${result.rowCount} camas fueron eliminados.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el espacio.' });
  }
});

// Renombrar/actualizar espacio y cantidad de camas
app.put('/api/refugios/:refugio_id/beds/space', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { old_room_number, new_room_number, bed_count } = req.body;
  if (!old_room_number || !new_room_number) {
    return res.status(400).json({ error: 'Nombres antiguos y nuevos del espacio son requeridos.' });
  }

  try {
    // 1. Renombrar el espacio si cambió
    if (old_room_number !== new_room_number) {
      await db.query(
        'UPDATE beds SET room_number = $1 WHERE refugio_id = $2 AND room_number = $3',
        [new_room_number, refugio_id, old_room_number]
      );
    }

    // 2. Si se suministró bed_count, ajustar la cantidad
    if (bed_count) {
      const targetCount = parseInt(bed_count);
      
      const currentBedsRes = await db.query(
        'SELECT id, bed_number, status FROM beds WHERE refugio_id = $1 AND room_number = $2 ORDER BY id ASC',
        [refugio_id, new_room_number]
      );
      const currentCount = currentBedsRes.rows.length;

      if (targetCount > currentCount) {
        for (let c = currentCount + 1; c <= targetCount; c++) {
          await db.query(`
            INSERT INTO beds (refugio_id, room_number, bed_number, status)
            VALUES ($1, $2, $3, 'Disponible')
            ON CONFLICT (refugio_id, room_number, bed_number) DO NOTHING
          `, [refugio_id, new_room_number, `Cama ${c}`]);
        }
      } else if (targetCount < currentCount) {
        const bedsToDelete = currentBedsRes.rows.slice(targetCount);
        const hasOccupied = bedsToDelete.some(b => b.status === 'Ocupada');
        if (hasOccupied) {
          return res.status(400).json({ error: 'No se puede reducir las camas porque hay residentes asignados en las camas sobrantes.' });
        }
        for (const bed of bedsToDelete) {
          await db.query('DELETE FROM beds WHERE id = $1', [bed.id]);
        }
      }
    }

    res.json({ message: `Espacio actualizado a '${new_room_number}' con ${bed_count} camas.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el espacio.' });
  }
});

// --- RUTAS DE INVENTARIO ---
const HEALTH_DEPOSITO_FILTER = `(
  LOWER(COALESCE(d.name, '')) LIKE '%médico%'
  OR LOWER(COALESCE(d.name, '')) LIKE '%medico%'
  OR LOWER(COALESCE(d.name, '')) LIKE '%salud%'
)`;

async function getOrCreateHealthDeposito(queryable, refugioId) {
  const existing = await queryable.query(
    `SELECT d.*
     FROM depositos d
     WHERE d.refugio_id = $1
       AND (
         LOWER(COALESCE(d.name, '')) LIKE '%médico%'
         OR LOWER(COALESCE(d.name, '')) LIKE '%medico%'
         OR LOWER(COALESCE(d.name, '')) LIKE '%salud%'
       )
     ORDER BY d.id ASC
     LIMIT 1`,
    [parseInt(refugioId)]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const created = await queryable.query(
    `INSERT INTO depositos (refugio_id, name, description, capacity_percent)
     VALUES ($1, 'Servicio Médico', 'Depósito local del servicio médico para insumos de salud', 100)
     RETURNING *`,
    [parseInt(refugioId)]
  );
  return created.rows[0];
}

const requireMedicalInventoryWriter = (req, res, next) => {
  if (['admin', 'gerente', 'medico'].includes(req.user?.role)) return next();
  return res.status(403).json({ error: 'No posee permisos para modificar el inventario de salud.' });
};

const denyMedicalGeneralInventoryWrite = (req, res, next) => {
  if (req.user?.role !== 'medico') return next();
  return res.status(403).json({
    error: 'El personal médico debe operar exclusivamente mediante el inventario de salud.'
  });
};

// Inventario aislado del Servicio Médico. El depósito se resuelve siempre en el servidor,
// evitando que el cliente pueda leer o modificar renglones del almacén general.
app.get('/api/refugios/:refugio_id/health-inventory', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    const deposito = await getOrCreateHealthDeposito(db, refugio_id);
    const result = await db.query(
      `SELECT i.*, d.name AS deposito_name
       FROM inventory i
       JOIN depositos d ON i.deposito_id = d.id
       WHERE i.refugio_id = $1 AND i.deposito_id = $2
       ORDER BY i.item_name ASC`,
      [parseInt(refugio_id), deposito.id]
    );
    res.json({ deposito, items: result.rows });
  } catch (err) {
    console.error('Error al obtener inventario de salud:', err);
    res.status(500).json({ error: 'Error al obtener inventario de salud.' });
  }
});
app.post('/api/refugios/:refugio_id/health-inventory', authenticateToken, requireMedicalInventoryWriter, async (req, res) => {
  const { refugio_id } = req.params;
  const { id, item_name, category, quantity, min_threshold, unit, units_per_package, sub_unit } = req.body;
  if (!item_name || quantity === undefined) {
    return res.status(400).json({ error: 'Insumo y cantidad son requeridos.' });
  }

  try {
    const deposito = await getOrCreateHealthDeposito(db, refugio_id);
    const qtyVal = parseFloat(quantity) || 0;
    const minVal = parseFloat(min_threshold) || 0;
    const status = qtyVal === 0 ? 'Sin Stock' : (qtyVal <= minVal ? 'Stock Crítico' : 'Stock Suficiente');
    let result;
    let oldQty = 0;

    if (id) {
      const oldRes = await db.query('SELECT quantity FROM inventory WHERE id = $1', [id]);
      if (oldRes.rows.length > 0) {
        oldQty = parseFloat(oldRes.rows[0].quantity) || 0;
      }

      result = await db.query(
        `UPDATE inventory
         SET item_name = $1, category = $2, quantity = $3, min_threshold = $4,
             unit = $5, status = $6, units_per_package = $7, sub_unit = $8, updated_at = NOW()
         WHERE id = $9 AND refugio_id = $10 AND deposito_id = $11
         RETURNING *`,
        [item_name, category || 'Medicinas', qtyVal, minVal, unit || 'Unidades', status,
          units_per_package || 1, sub_unit || null, parseInt(id), parseInt(refugio_id), deposito.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'El insumo no pertenece al inventario de salud de esta sede.' });
      }

      const diff = qtyVal - oldQty;
      if (diff !== 0) {
        await logInventoryMovement(db, {
          refugio_id,
          inventory_id: id,
          item_name,
          category: category || 'Medicinas',
          deposito_id: deposito.id,
          deposito_name: deposito.name,
          inventory_type: 'salud',
          movement_type: 'ajuste_manual',
          quantity: diff,
          unit: unit || 'Unidades',
          user_id: req.user?.id,
          user_name: req.user?.name,
          details: `Ajuste manual del stock de salud. Cantidad anterior: ${oldQty}, Nueva cantidad: ${qtyVal}.`
        });
      }
    } else {
      result = await db.query(
        `INSERT INTO inventory
         (refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id, units_per_package, sub_unit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [parseInt(refugio_id), item_name, category || 'Medicinas', qtyVal, minVal,
          unit || 'Unidades', status, deposito.id, units_per_package || 1, sub_unit || null]
      );
      const newId = result.rows[0].id;
      await logInventoryMovement(db, {
        refugio_id,
        inventory_id: newId,
        item_name,
        category: category || 'Medicinas',
        deposito_id: deposito.id,
        deposito_name: deposito.name,
        inventory_type: 'salud',
        movement_type: 'ajuste_manual',
        quantity: qtyVal,
        unit: unit || 'Unidades',
        user_id: req.user?.id,
        user_name: req.user?.name,
        details: `Registro inicial de insumo en salud.`
      });
    }

    res.status(id ? 200 : 201).json({ ...result.rows[0], deposito_name: deposito.name });
  } catch (err) {
    console.error('Error al guardar inventario de salud:', err);
    res.status(500).json({ error: 'Error al guardar inventario de salud.' });
  }
});

app.delete('/api/refugios/:refugio_id/health-inventory/:id', authenticateToken, requireMedicalInventoryWriter, async (req, res) => {
  try {
    const deposito = await getOrCreateHealthDeposito(db, req.params.refugio_id);
    const oldRes = await db.query('SELECT item_name, category, quantity, unit FROM inventory WHERE id = $1', [req.params.id]);
    
    const result = await db.query(
      `DELETE FROM inventory WHERE id = $1 AND refugio_id = $2 AND deposito_id = $3 RETURNING id, item_name`,
      [parseInt(req.params.id), parseInt(req.params.refugio_id), deposito.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Insumo médico no encontrado en esta sede.' });

    if (oldRes.rows.length > 0) {
      const item = oldRes.rows[0];
      await logInventoryMovement(db, {
        refugio_id: req.params.refugio_id,
        inventory_id: req.params.id,
        item_name: item.item_name,
        category: item.category,
        deposito_id: deposito.id,
        deposito_name: deposito.name,
        inventory_type: 'salud',
        movement_type: 'eliminacion',
        quantity: -parseFloat(item.quantity),
        unit: item.unit,
        user_id: req.user?.id,
        user_name: req.user?.name,
        details: `Eliminación permanente del insumo médico del inventario. Stock al momento de eliminar: ${item.quantity}.`
      });
    }

    res.json({ message: `El insumo médico ${result.rows[0].item_name} fue eliminado.` });
  } catch (err) {
    console.error('Error al eliminar insumo de salud:', err);
    res.status(500).json({ error: 'No se pudo eliminar el insumo médico.' });
  }
});

app.get('/api/refugios/:refugio_id/inventory', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    const result = await db.query(
      'SELECT i.*, d.name as deposito_name FROM inventory i LEFT JOIN depositos d ON i.deposito_id = d.id WHERE i.refugio_id = $1 ORDER BY i.category ASC, i.item_name ASC',
      [refugio_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inventario.' });
  }
});

app.get('/api/refugios/:refugio_id/inventory/download', authenticateToken, async (req, res) => {
  const refugio_id = parseInt(req.params.refugio_id);
  const type = req.query.type || 'general';
  try {
    const refRes = await db.query('SELECT name FROM refugios WHERE id = $1', [refugio_id]);
    const refugioName = refRes.rows.length > 0 ? refRes.rows[0].name : 'Sede ' + refugio_id;

    let items = [];
    let title = '';
    
    if (type === 'health') {
      title = 'Inventario del Servicio Médico - ' + refugioName;
      const healthDep = await getOrCreateHealthDeposito(db, refugio_id);
      const itemsRes = await db.query(
        'SELECT i.*, d.name as deposito_name ' +
        'FROM inventory i ' +
        'LEFT JOIN depositos d ON i.deposito_id = d.id ' +
        'WHERE i.refugio_id = $1 AND i.deposito_id = $2 ' +
        'ORDER BY i.item_name ASC',
        [refugio_id, healthDep.id]
      );
      items = itemsRes.rows;
    } else if (type === 'kitchen') {
      title = 'Inventario de Cocina - ' + refugioName;
      const cocDepRes = await db.query(
        "SELECT id FROM depositos WHERE refugio_id = $1 AND name ILIKE '%cocina%' LIMIT 1",
        [refugio_id]
      );
      if (cocDepRes.rows.length > 0) {
        const itemsRes = await db.query(
          'SELECT i.*, d.name as deposito_name ' +
          'FROM inventory i ' +
          'LEFT JOIN depositos d ON i.deposito_id = d.id ' +
          'WHERE i.refugio_id = $1 AND i.deposito_id = $2 ' +
          'ORDER BY i.item_name ASC',
          [refugio_id, cocDepRes.rows[0].id]
        );
        items = itemsRes.rows;
      }
    } else {
      title = 'Inventario General de Almacén - ' + refugioName;
      const itemsRes = await db.query(
        'SELECT i.*, d.name as deposito_name ' +
        'FROM inventory i ' +
        'LEFT JOIN depositos d ON i.deposito_id = d.id ' +
        'WHERE i.refugio_id = $1 ' +
        'ORDER BY i.item_name ASC',
        [refugio_id]
      );
      items = itemsRes.rows.filter(function(item) {
        const depName = (item.deposito_name || '').toLowerCase();
        return !depName.includes('cocina') && !depName.includes('médico') && !depName.includes('medico') && !depName.includes('salud');
      });
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario');

    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title.toUpperCase();
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2347' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 45;

    const path = require('path');
    const fs = require('fs');

    const sarenLogoPath = path.join(__dirname, '../frontend/public/logo-saren.png');
    const campamentoLogoPath = path.join(__dirname, '../frontend/public/campamento-logo-transparente.png');

    if (fs.existsSync(campamentoLogoPath)) {
      try {
        const imageId = workbook.addImage({
          filename: campamentoLogoPath,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 0.1, row: 0.15 },
          ext: { width: 42, height: 35 }
        });
      } catch (e) {
        console.error('Error adding campamento logo to excel:', e);
      }
    }

    if (fs.existsSync(sarenLogoPath)) {
      try {
        const imageId = workbook.addImage({
          filename: sarenLogoPath,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 5.2, row: 0.15 },
          ext: { width: 80, height: 35 }
        });
      } catch (e) {
        console.error('Error adding saren logo to excel:', e);
      }
    }

    worksheet.addRow([]);

    const headers = ['Insumo', 'Categoría', 'Depósito', 'Stock Actual', 'Mínimo Crítico', 'Estado'];
    worksheet.addRow(headers);
    
    const headerRow = worksheet.getRow(3);
    headerRow.height = 25;
    headerRow.eachCell(function(cell) {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });

    items.forEach(function(item) {
      const qty = parseFloat(item.quantity) || 0;
      const min = parseFloat(item.min_threshold) || 0;
      const status = qty === 0 ? 'SIN STOCK' : (qty <= min ? 'STOCK CRÍTICO' : 'SUMINISTRO SUFICIENTE');
      const unitStr = item.unit || 'unidades';

      let stockStr = qty + ' ' + unitStr;
      if (item.units_per_package && item.units_per_package > 1 && item.sub_unit) {
        const whole = Math.floor(qty);
        const fraction = qty % 1;
        const subQty = Math.round(fraction * item.units_per_package);
        if (whole > 0 && subQty > 0) {
          stockStr = qty + ' ' + unitStr + ' (' + whole + ' ' + unitStr + ' y ' + subQty + ' ' + item.sub_unit + ')';
        } else if (whole > 0) {
          stockStr = qty + ' ' + unitStr + ' (' + whole + ' ' + unitStr + ')';
        } else {
          stockStr = qty + ' ' + unitStr + ' (' + subQty + ' ' + item.sub_unit + ')';
        }
      }

      const rowData = [
        item.item_name,
        item.category,
        item.deposito_name || 'Bodega Central',
        stockStr,
        min + ' ' + unitStr,
        status
      ];
      worksheet.addRow(rowData);
    });

    for (let i = 4; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.height = 20;
      row.eachCell(function(cell, colIndex) {
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { 
          horizontal: (colIndex === 4 || colIndex === 5 || colIndex === 6) ? 'center' : 'left',
          vertical: 'middle' 
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        if (i % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }

        if (colIndex === 6) {
          const val = String(cell.value);
          if (val === 'SIN STOCK') {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF991B1B' } };
          } else if (val === 'STOCK CRÍTICO') {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF92400E' } };
          } else {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } };
          }
        }
      });
    }

    const colWidths = [30, 20, 25, 35, 20, 25];
    colWidths.forEach(function(w, index) {
      worksheet.getColumn(index + 1).width = w;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventario_' + (type || 'general') + '_sede_' + refugio_id + '.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating inventory Excel:', err);
    res.status(500).json({ error: 'No se pudo generar el reporte en Excel.' });
  }
});

app.post('/api/refugios/:refugio_id/inventory', authenticateToken, denyMedicalGeneralInventoryWrite, async (req, res) => {
  const { refugio_id } = req.params;
  const { id, item_name, category, quantity, min_threshold, unit, deposito_id, units_per_package, sub_unit } = req.body;
  if (!item_name || !category || quantity === undefined) {
    return res.status(400).json({ error: 'Insumo, categoría y cantidad son requeridos.' });
  }

  try {
    const qtyVal = parseFloat(quantity) || 0;
    const minVal = parseFloat(min_threshold) || 0;
    const status = qtyVal === 0 ? 'Sin Stock' : (qtyVal <= minVal ? 'Stock Crítico' : 'Stock Suficiente');
    
    let result;
    let oldQty = 0;

    if (id) {
      const oldRes = await db.query('SELECT quantity FROM inventory WHERE id = $1', [id]);
      if (oldRes.rows.length > 0) {
        oldQty = parseFloat(oldRes.rows[0].quantity) || 0;
      }

      result = await db.query(
        `INSERT INTO inventory (id, refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id, units_per_package, sub_unit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE 
         SET item_name = EXCLUDED.item_name, category = EXCLUDED.category, quantity = EXCLUDED.quantity, 
             min_threshold = EXCLUDED.min_threshold, unit = EXCLUDED.unit, status = EXCLUDED.status, 
             deposito_id = EXCLUDED.deposito_id, units_per_package = EXCLUDED.units_per_package, sub_unit = EXCLUDED.sub_unit, updated_at = NOW()
         RETURNING *`,
        [parseInt(id), parseInt(refugio_id), item_name, category, qtyVal, minVal, unit || 'unidades', status, deposito_id || null, units_per_package || 1, sub_unit || null]
      );

      const diff = qtyVal - oldQty;
      if (diff !== 0) {
        const inventory_type = category === 'Alimentos' ? 'cocina' : (category === 'Medicinas' ? 'salud' : 'almacen');
        await logInventoryMovement(db, {
          refugio_id,
          inventory_id: id,
          item_name,
          category,
          deposito_id,
          inventory_type,
          movement_type: 'ajuste_manual',
          quantity: diff,
          unit: unit || 'unidades',
          user_id: req.user?.id,
          user_name: req.user?.name,
          details: `Ajuste manual de inventario. Cantidad anterior: ${oldQty}, Nueva cantidad: ${qtyVal}.`
        });
      }
    } else {
      result = await db.query(
        `INSERT INTO inventory (refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id, units_per_package, sub_unit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [parseInt(refugio_id), item_name, category, qtyVal, minVal, unit || 'unidades', status, deposito_id || null, units_per_package || 1, sub_unit || null]
      );
      const newId = result.rows[0].id;
      const inventory_type = category === 'Alimentos' ? 'cocina' : (category === 'Medicinas' ? 'salud' : 'almacen');
      await logInventoryMovement(db, {
        refugio_id,
        inventory_id: newId,
        item_name,
        category,
        deposito_id,
        inventory_type,
        movement_type: 'ajuste_manual',
        quantity: qtyVal,
        unit: unit || 'unidades',
        user_id: req.user?.id,
        user_name: req.user?.name,
        details: `Registro inicial de insumo en inventario.`
      });
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar inventario.' });
  }
});

app.delete('/api/refugios/:refugio_id/inventory/:id', authenticateToken, denyMedicalGeneralInventoryWrite, async (req, res) => {
  try {
    const oldRes = await db.query('SELECT item_name, category, quantity, unit, deposito_id FROM inventory WHERE id = $1', [req.params.id]);
    
    const result = await db.query(
      `DELETE FROM inventory WHERE id = $1 AND refugio_id = $2 RETURNING id, item_name`,
      [parseInt(req.params.id), parseInt(req.params.refugio_id)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Insumo no encontrado.' });

    if (oldRes.rows.length > 0) {
      const item = oldRes.rows[0];
      const inventory_type = item.category === 'Alimentos' ? 'cocina' : (item.category === 'Medicinas' ? 'salud' : 'almacen');
      await logInventoryMovement(db, {
        refugio_id: req.params.refugio_id,
        inventory_id: req.params.id,
        item_name: item.item_name,
        category: item.category,
        deposito_id: item.deposito_id,
        inventory_type,
        movement_type: 'eliminacion',
        quantity: -parseFloat(item.quantity),
        unit: item.unit,
        user_id: req.user?.id,
        user_name: req.user?.name,
        details: `Eliminación permanente del insumo de inventario. Stock al momento de eliminar: ${item.quantity}.`
      });
    }

    res.json({ message: `El insumo ${result.rows[0].item_name} fue eliminado.` });
  } catch (err) {
    console.error('Error al eliminar insumo:', err);
    res.status(500).json({ error: 'No se pudo eliminar el insumo.' });
  }
});

app.put('/api/inventory/:id', authenticateToken, denyMedicalGeneralInventoryWrite, async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  try {
    const itemRes = await db.query('SELECT item_name, category, quantity, min_threshold, unit, deposito_id, refugio_id FROM inventory WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Insumo no encontrado.' });
    
    const item = itemRes.rows[0];
    const oldQty = parseFloat(item.quantity) || 0;
    const qtyVal = parseFloat(quantity) || 0;
    const min_threshold = item.min_threshold;
    const status = qtyVal === 0 ? 'Sin Stock' : (qtyVal <= min_threshold ? 'Stock Crítico' : 'Stock Suficiente');
    
    const result = await db.query(
      'UPDATE inventory SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [qtyVal, status, id]
    );

    const diff = qtyVal - oldQty;
    if (diff !== 0) {
      const inventory_type = item.category === 'Alimentos' ? 'cocina' : (item.category === 'Medicinas' ? 'salud' : 'almacen');
      await logInventoryMovement(db, {
        refugio_id: item.refugio_id,
        inventory_id: id,
        item_name: item.item_name,
        category: item.category,
        deposito_id: item.deposito_id,
        inventory_type,
        movement_type: 'ajuste_manual',
        quantity: diff,
        unit: item.unit,
        user_id: req.user?.id,
        user_name: req.user?.name,
        details: `Ajuste directo de stock. Cantidad anterior: ${oldQty}, Nueva cantidad: ${qtyVal}.`
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar inventario.' });
  }
});

app.post('/api/refugios/:refugio_id/deliveries', authenticateToken, denyMedicalGeneralInventoryWrite, async (req, res) => {
  const { refugio_id } = req.params;
  const { resident_id, item_name, quantity } = req.body;
  if (!resident_id || !item_name || !quantity) {
    return res.status(400).json({ error: 'Residente, insumo y cantidad son requeridos.' });
  }

  try {
    const allowedItem = await db.query(
      `SELECT i.id, i.category FROM inventory i
       LEFT JOIN depositos d ON d.id = i.deposito_id
       WHERE i.refugio_id = $1 AND i.item_name = $2
         AND LOWER(COALESCE(i.category, '')) NOT IN ('medicinas', 'medicina', 'alimentos', 'alimento')
         AND NOT (${HEALTH_DEPOSITO_FILTER})
       ORDER BY i.quantity DESC LIMIT 1`,
      [parseInt(refugio_id), item_name]
    );
    if (!allowedItem.rows.length) {
      return res.status(400).json({ error: 'Los medicamentos se entregan exclusivamente en el módulo médico y los alimentos en comedor/logística.' });
    }
    // Registrar entrega
    const result = await db.query(
      'INSERT INTO supply_deliveries (refugio_id, resident_id, item_name, quantity, delivered_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [refugio_id, resident_id, item_name, quantity, req.user.id]
    );

    // Restar únicamente del almacén general. Las entregas médicas tienen su propio
    // endpoint transaccional y nunca deben descontar del depósito de salud.
    await db.query(
      `UPDATE inventory i
       SET quantity = GREATEST(0, i.quantity - $1),
           status = CASE
             WHEN GREATEST(0, i.quantity - $1) = 0 THEN 'Sin Stock'
             WHEN GREATEST(0, i.quantity - $1) <= i.min_threshold THEN 'Stock Crítico'
             ELSE 'Stock Suficiente'
           END,
           updated_at = NOW()
       WHERE i.refugio_id = $2 AND i.item_name = $3
         AND NOT EXISTS (
           SELECT 1 FROM depositos d
           WHERE d.id = i.deposito_id AND ${HEALTH_DEPOSITO_FILTER}
         )`,
      [quantity, refugio_id, item_name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar entrega.' });
  }
});

app.get('/api/refugios/:refugio_id/deliveries', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    const result = await db.query(
      `SELECT sd.*, d.first_name, d.last_name, d.document_id 
       FROM supply_deliveries sd
       JOIN damnificados d ON sd.resident_id = d.id
       WHERE sd.refugio_id = $1
       ORDER BY sd.delivered_at DESC`,
      [parseInt(refugio_id)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener entregas:", err);
    res.status(500).json({ error: 'Error al obtener historial de entregas.' });
  }
});

app.get('/api/refugios/:refugio_id/medication-deliveries', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { resident_id } = req.query;

  try {
    const params = [parseInt(refugio_id)];
    let where = 'WHERE md.refugio_id = $1';
    if (resident_id) {
      params.push(parseInt(resident_id));
      where += ` AND md.resident_id = $${params.length}`;
    }

    const result = await db.query(
      'SELECT md.*, d.first_name, d.last_name, d.document_id, i.item_name as inventory_item_name, u.name as delivered_by_name, ' +
      'i.unit as inventory_unit, i.sub_unit as inventory_sub_unit, i.units_per_package as inventory_units_per_package ' +
      'FROM medication_deliveries md ' +
      'JOIN damnificados d ON md.resident_id = d.id ' +
      'LEFT JOIN inventory i ON md.inventory_item_id = i.id ' +
      'LEFT JOIN users u ON md.delivered_by = u.id ' +
      where + ' ' +
      'ORDER BY md.delivered_at DESC',
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener entregas de medicamentos:', err);
    res.status(500).json({ error: 'Error al obtener historial de medicamentos.' });
  }
});

app.post('/api/refugios/:refugio_id/medication-deliveries', authenticateToken, requireMedicalInventoryWriter, async (req, res) => {
  const { refugio_id } = req.params;
  const {
    resident_id,
    inventory_item_id,
    medication_index,
    medication_name,
    dose,
    quantity,
    unit,
    delivery_frequency,
    notes
  } = req.body;

  const qty = parseFloat(quantity);
  const medicationIndexValue = medication_index === undefined || medication_index === null || medication_index === ''
    ? null
    : parseInt(medication_index);
  if (!resident_id || !inventory_item_id || !medication_name || !Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Residente, medicamento de inventario, tratamiento y cantidad válida son requeridos.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const residentRes = await client.query(
      'SELECT id, first_name, last_name, special_needs FROM damnificados WHERE id = $1 AND refugio_id = $2 AND status = $3',
      [parseInt(resident_id), parseInt(refugio_id), 'Activo']
    );
    if (residentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Residente activo no encontrado en esta sede.' });
    }

    let treatment = null;
    try {
      const meta = JSON.parse(residentRes.rows[0].special_needs || '{}');
      const meds = Array.isArray(meta.medications) ? meta.medications : [];
      treatment = Number.isInteger(medicationIndexValue) ? meds[medicationIndexValue] : null;
      if (!treatment) {
        treatment = meds.find(m => (m.name || '').toLowerCase() === String(medication_name).toLowerCase()) || null;
      }
    } catch {
      treatment = null;
    }

    const inventoryRes = await client.query(
      'SELECT i.id, i.item_name, i.quantity, i.min_threshold, i.unit, i.sub_unit, i.units_per_package ' +
      'FROM inventory i ' +
      'JOIN depositos d ON i.deposito_id = d.id ' +
      'WHERE i.id = $1 AND i.refugio_id = $2 AND ' + HEALTH_DEPOSITO_FILTER + ' ' +
      'FOR UPDATE OF i',
      [parseInt(inventory_item_id), parseInt(refugio_id)]
    );
    if (inventoryRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Medicamento no encontrado en el inventario de salud.' });
    }

    const item = inventoryRes.rows[0];
    const mainUnit = item.unit || 'unidades';
    const subUnit = item.sub_unit;
    const factor = parseInt(item.units_per_package) || 1;

    let qtyToDiscount = qty;
    if (subUnit && unit && unit.toLowerCase() === subUnit.toLowerCase() && factor > 1) {
      qtyToDiscount = qty / factor;
    }

    const totalRequired = treatment ? parseFloat(treatment.totalQuantity) : NaN;
    if (Number.isFinite(totalRequired) && totalRequired > 0) {
      const deliveredParams = [parseInt(refugio_id), parseInt(resident_id), medication_name];
      let deliveredWhere = 'refugio_id = $1 AND resident_id = $2 AND medication_name = $3';
      if (Number.isInteger(medicationIndexValue)) {
        deliveredParams.push(medicationIndexValue);
        deliveredWhere += ' AND medication_index = $' + deliveredParams.length;
      }
      const deliveredRes = await client.query(
        'SELECT quantity, unit ' +
        'FROM medication_deliveries ' +
        'WHERE ' + deliveredWhere,
        deliveredParams
      );

      let alreadyDelivered = 0;
      deliveredRes.rows.forEach(row => {
        const dQty = parseFloat(row.quantity) || 0;
        const dUnit = row.unit;
        if (subUnit && dUnit && dUnit.toLowerCase() === subUnit.toLowerCase() && factor > 1) {
          alreadyDelivered += dQty / factor;
        } else {
          alreadyDelivered += dQty;
        }
      });

      if (alreadyDelivered + qtyToDiscount > totalRequired) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'La entrega supera lo indicado para este tratamiento. Indicado: ' + totalRequired + ' ' + mainUnit + ', entregado: ' + alreadyDelivered.toFixed(2) + ' ' + mainUnit + ', saldo: ' + Math.max(totalRequired - alreadyDelivered, 0).toFixed(2) + ' ' + mainUnit + '.'
        });
      }
    }

    const stock = parseFloat(item.quantity) || 0;
    if (stock < qtyToDiscount) {
      await client.query('ROLLBACK');
      const dispText = factor > 1 && subUnit 
        ? stock + ' ' + mainUnit + ' (equivalente a ' + Math.round(stock * factor) + ' ' + subUnit + ')'
        : stock + ' ' + mainUnit;
      return res.status(400).json({ error: 'Stock insuficiente. Disponible: ' + dispText + '.' });
    }

    const result = await client.query(
      'INSERT INTO medication_deliveries ' +
      '(refugio_id, resident_id, inventory_item_id, medication_index, medication_name, dose, quantity, unit, delivery_frequency, notes, delivered_by) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ' +
      'RETURNING *',
      [
        parseInt(refugio_id),
        parseInt(resident_id),
        parseInt(inventory_item_id),
        Number.isInteger(medicationIndexValue) ? medicationIndexValue : null,
        medication_name,
        dose || treatment?.dose || null,
        qty,
        unit || item.unit || 'Dosis',
        delivery_frequency || treatment?.deliveryFrequency || 'Única',
        notes || null,
        req.user.id
      ]
    );

    await client.query(
      'UPDATE inventory ' +
      'SET quantity = quantity - $1, ' +
      '    status = CASE ' +
      '      WHEN quantity - $1 <= 0 THEN \'Sin Stock\' ' +
      '      WHEN quantity - $1 <= min_threshold THEN \'Stock Crítico\' ' +
      '      ELSE \'Stock Suficiente\' ' +
      '    END, ' +
      '    updated_at = NOW() ' +
      'WHERE id = $2',
      [qtyToDiscount, parseInt(inventory_item_id)]
    );

    const resident = residentRes.rows[0];
    await logInventoryMovement(client, {
      refugio_id,
      inventory_id: inventory_item_id,
      item_name: item.item_name,
      category: 'Medicinas',
      deposito_id: null,
      inventory_type: 'salud',
      movement_type: 'entrega_medicina',
      quantity: -qtyToDiscount,
      unit: item.unit,
      user_id: req.user.id,
      user_name: req.user.name,
      reference_id: result.rows[0].id,
      details: `Entrega de medicamento a ${resident.first_name} ${resident.last_name}.`
    });

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al registrar entrega de medicamento:', err);
    res.status(500).json({ error: 'Error al registrar entrega de medicamento.' });
  } finally {
    client.release();
  }
});

// --- RUTAS DE LOGÍSTICA (MENÚS Y ASISTENCIA) ---
app.get('/api/refugios/:refugio_id/menus', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    const result = await db.query('SELECT * FROM menus WHERE refugio_id = $1 ORDER BY id ASC', [refugio_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener menús.' });
  }
});

app.post('/api/refugios/:refugio_id/menus', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { day_of_week, meal_type, description, ingredients, diets_json, menu_date } = req.body;
  try {
    const cleanDate = menu_date || null;
    let result;
    
    if (cleanDate) {
      const check = await db.query(
        'SELECT id FROM menus WHERE refugio_id = $1 AND menu_date = $2 AND meal_type = $3',
        [refugio_id, cleanDate, meal_type]
      );
      if (check.rows.length > 0) {
        result = await db.query(
          `UPDATE menus 
           SET description = $1, ingredients = $2, diets_json = $3, day_of_week = $4, is_consumed = FALSE
           WHERE id = $5 RETURNING *`,
          [description, ingredients, diets_json || '{}', day_of_week, check.rows[0].id]
        );
      } else {
        result = await db.query(
          `INSERT INTO menus (refugio_id, day_of_week, meal_type, description, ingredients, diets_json, menu_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [refugio_id, day_of_week, meal_type, description, ingredients, diets_json || '{}', cleanDate]
        );
      }
    } else {
      result = await db.query(
        `INSERT INTO menus (refugio_id, day_of_week, meal_type, description, ingredients, diets_json)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (refugio_id, day_of_week, meal_type) DO UPDATE 
         SET description = EXCLUDED.description, ingredients = EXCLUDED.ingredients, diets_json = EXCLUDED.diets_json
         RETURNING *`,
        [refugio_id, day_of_week, meal_type, description, ingredients, diets_json || '{}']
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar menú.' });
  }
});

app.delete('/api/refugios/:refugio_id/menus', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { day_of_week, meal_type, menu_date } = req.query;
  try {
    if (menu_date) {
      await db.query(
        'DELETE FROM menus WHERE refugio_id = $1 AND menu_date = $2 AND meal_type = $3',
        [parseInt(refugio_id), menu_date, meal_type]
      );
    } else {
      await db.query(
        'DELETE FROM menus WHERE refugio_id = $1 AND day_of_week = $2 AND meal_type = $3',
        [parseInt(refugio_id), day_of_week, meal_type]
      );
    }
    res.json({ message: 'Menú eliminado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar menú.' });
  }
});

app.post('/api/refugios/:refugio_id/menus/consume', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { scope, day_of_week, menu_date, menu_dates, ingredients } = req.body;

  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'La lista de ingredientes a descontar es requerida.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Resolve kitchen depósito
    const depRes = await client.query(
      "SELECT id, name FROM depositos WHERE refugio_id = $1 AND name ILIKE '%cocina%' LIMIT 1",
      [parseInt(refugio_id)]
    );
    if (depRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No se encontró el depósito de cocina asignado a esta sede.' });
    }
    const kitchenDep = depRes.rows[0];

    // 2. Iterate and discount each ingredient
    for (const ing of ingredients) {
      const ingName = ing.name.trim();
      const ingQty = parseFloat(ing.quantity) || 0;
      const ingUnit = ing.unit || 'Unidades';

      if (ingQty <= 0) continue;

      // Find in kitchen inventory (case-insensitive name match)
      const checkItem = await client.query(
        `SELECT id, quantity, min_threshold FROM inventory 
         WHERE refugio_id = $1 AND LOWER(item_name) = LOWER($2) AND category = 'Alimentos' AND deposito_id = $3`,
        [parseInt(refugio_id), ingName.toLowerCase(), kitchenDep.id]
      );

      if (checkItem.rows.length > 0) {
        const item = checkItem.rows[0];
        const newQty = Math.max(0, parseFloat(item.quantity) - ingQty);
        const minVal = parseFloat(item.min_threshold) || 5;
        let status = 'Stock Suficiente';
        if (newQty <= 0) status = 'Sin Stock';
        else if (newQty < minVal) status = 'Stock Crítico';

        await client.query(
          'UPDATE inventory SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3',
          [newQty, status, item.id]
        );

        // Log movement
        await logInventoryMovement(client, {
          refugio_id,
          inventory_id: item.id,
          item_name: ingName,
          category: 'Alimentos',
          deposito_id: kitchenDep.id,
          deposito_name: kitchenDep.name,
          inventory_type: 'cocina',
          movement_type: 'consumo_menu',
          quantity: -ingQty,
          unit: ingUnit,
          user_id: req.user?.id,
          user_name: req.user?.name,
          details: `Consumo descontado del menú ${scope === 'week' ? 'semanal' : day_of_week} (${menu_date || 'Rango semanal'}).`
        });
      } else {
        // If it doesn't exist, register with negative balance (deficit)
        const newQty = -ingQty;
        const status = 'Sin Stock';
        const insertRes = await client.query(
          `INSERT INTO inventory (refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id)
           VALUES ($1, $2, 'Alimentos', $3, 5, $4, $5, $6) RETURNING id`,
          [parseInt(refugio_id), ingName, newQty, ingUnit, status, kitchenDep.id]
        );
        const newId = insertRes.rows[0].id;

        // Log movement
        await logInventoryMovement(client, {
          refugio_id,
          inventory_id: newId,
          item_name: ingName,
          category: 'Alimentos',
          deposito_id: kitchenDep.id,
          deposito_name: kitchenDep.name,
          inventory_type: 'cocina',
          movement_type: 'consumo_menu',
          quantity: -ingQty,
          unit: ingUnit,
          user_id: req.user?.id,
          user_name: req.user?.name,
          details: `Consumo descontado (en déficit) del menú ${scope === 'week' ? 'semanal' : day_of_week} (${menu_date || 'Rango semanal'}).`
        });
      }
    }

    // 3. Mark menus as consumed/discounted
    if (scope === 'week') {
      if (menu_dates && Array.isArray(menu_dates) && menu_dates.length > 0) {
        await client.query(
          'UPDATE menus SET is_consumed = TRUE WHERE refugio_id = $1 AND menu_date = ANY($2::date[])',
          [parseInt(refugio_id), menu_dates]
        );
      } else {
        await client.query(
          'UPDATE menus SET is_consumed = TRUE WHERE refugio_id = $1',
          [parseInt(refugio_id)]
        );
      }
    } else {
      if (menu_date) {
        await client.query(
          'UPDATE menus SET is_consumed = TRUE WHERE refugio_id = $1 AND menu_date = $2',
          [parseInt(refugio_id), menu_date]
        );
      } else {
        await client.query(
          'UPDATE menus SET is_consumed = TRUE WHERE refugio_id = $1 AND day_of_week = $2',
          [parseInt(refugio_id), day_of_week]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'El consumo del menú fue registrado y los insumos fueron descontados del inventario de cocina.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al descontar consumo de menú:', err);
    res.status(500).json({ error: 'Error al registrar consumo del menú.' });
  } finally {
    client.release();
  }
});

app.get('/api/refugios/:refugio_id/meals/manual-servings', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { start_date, end_date } = req.query;
  try {
    let queryStr = 'SELECT * FROM manual_meals_servings WHERE refugio_id = $1';
    let params = [parseInt(refugio_id)];
    if (start_date) {
      params.push(start_date);
      queryStr += ` AND serving_date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      queryStr += ` AND serving_date <= $${params.length}`;
    }
    queryStr += ' ORDER BY serving_date DESC, meal_type ASC';
    const result = await db.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener raciones manuales de comida.' });
  }
});

app.post('/api/refugios/:refugio_id/meals/manual-servings', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { serving_date, servings } = req.body;

  if (!serving_date || !servings || !Array.isArray(servings)) {
    return res.status(400).json({ error: 'Fecha y lista de raciones son requeridas.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const s of servings) {
      const { meal_type, person_type, quantity } = s;
      const qty = parseInt(quantity) || 0;
      await client.query(
        `INSERT INTO manual_meals_servings (refugio_id, serving_date, meal_type, person_type, quantity, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (refugio_id, serving_date, meal_type, person_type) DO UPDATE
         SET quantity = EXCLUDED.quantity, registered_by = EXCLUDED.registered_by`,
        [parseInt(refugio_id), serving_date, meal_type, person_type, qty, req.user?.id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Raciones manuales registradas correctamente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al guardar raciones manuales.' });
  } finally {
    client.release();
  }
});

app.get('/api/refugios/:refugio_id/inventory/movements', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { start_date, end_date, deposito_id, inventory_type, movement_type } = req.query;

  try {
    let queryStr = 'SELECT * FROM inventory_movements WHERE refugio_id = $1';
    let params = [parseInt(refugio_id)];

    if (start_date) {
      params.push(start_date);
      queryStr += ` AND created_at >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date + ' 23:59:59');
      queryStr += ` AND created_at <= $${params.length}`;
    }
    if (deposito_id) {
      params.push(parseInt(deposito_id));
      queryStr += ` AND deposito_id = $${params.length}`;
    }
    if (inventory_type) {
      params.push(inventory_type);
      queryStr += ` AND inventory_type = $${params.length}`;
    }
    if (movement_type) {
      params.push(movement_type);
      queryStr += ` AND movement_type = $${params.length}`;
    }

    queryStr += ' ORDER BY created_at DESC';
    const result = await db.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener trazabilidad de inventario.' });
  }
});

app.get('/api/refugios/:refugio_id/inventory/movements/download', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { start_date, end_date, deposito_id, inventory_type, movement_type } = req.query;

  try {
    const refugioRes = await db.query('SELECT name FROM refugios WHERE id = $1', [refugio_id]);
    const refugioName = refugioRes.rows.length > 0 ? refugioRes.rows[0].name : 'Sede';

    let queryStr = 'SELECT * FROM inventory_movements WHERE refugio_id = $1';
    let params = [parseInt(refugio_id)];

    if (start_date) {
      params.push(start_date);
      queryStr += ` AND created_at >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date + ' 23:59:59');
      queryStr += ` AND created_at <= $${params.length}`;
    }
    if (deposito_id) {
      params.push(parseInt(deposito_id));
      queryStr += ` AND deposito_id = $${params.length}`;
    }
    if (inventory_type) {
      params.push(inventory_type);
      queryStr += ` AND inventory_type = $${params.length}`;
    }
    if (movement_type) {
      params.push(movement_type);
      queryStr += ` AND movement_type = $${params.length}`;
    }

    queryStr += ' ORDER BY created_at DESC';
    const result = await db.query(queryStr, params);
    const movements = result.rows;

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Trazabilidad');

    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `REPORTE DE TRAZABILIDAD - INVENTARIOS - ${refugioName.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2347' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 45;

    const path = require('path');
    const fs = require('fs');
    const sarenLogoPath = path.join(__dirname, '../frontend/public/logo-saren.png');
    const campamentoLogoPath = path.join(__dirname, '../frontend/public/campamento-logo-transparente.png');

    if (fs.existsSync(campamentoLogoPath)) {
      try {
        const imageId = workbook.addImage({
          filename: campamentoLogoPath,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 0.1, row: 0.15 },
          ext: { width: 42, height: 35 }
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (fs.existsSync(sarenLogoPath)) {
      try {
        const imageId = workbook.addImage({
          filename: sarenLogoPath,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 9.2, row: 0.15 },
          ext: { width: 80, height: 35 }
        });
      } catch (e) {
        console.error(e);
      }
    }

    worksheet.addRow([]);

    const headers = [
      'Fecha / Hora',
      'Inventario',
      'Tipo de Movimiento',
      'Artículo / Insumo',
      'Categoría',
      'Depósito / Ubicación',
      'Cantidad',
      'Unidad',
      'Responsable',
      'Detalles'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(3);
    headerRow.height = 25;
    headerRow.eachCell(function(cell) {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    movements.forEach(m => {
      let invLabel = 'Almacén';
      if (m.inventory_type === 'salud') invLabel = 'Servicio Médico';
      else if (m.inventory_type === 'cocina') invLabel = 'Cocina / Comedor';

      let typeLabel = m.movement_type;
      if (m.movement_type === 'ingreso_donacion') typeLabel = 'Donación';
      else if (m.movement_type === 'ajuste_manual') typeLabel = 'Ajuste de Stock';
      else if (m.movement_type === 'consumo_menu') typeLabel = 'Consumo Comedor';
      else if (m.movement_type === 'entrega_medicina') typeLabel = 'Entrega Medicina';
      else if (m.movement_type === 'entrega_insumo') typeLabel = 'Entrega Insumo';
      else if (m.movement_type === 'eliminacion') typeLabel = 'Eliminación';

      worksheet.addRow([
        new Date(m.created_at).toLocaleString('es-VE'),
        invLabel,
        typeLabel.toUpperCase(),
        m.item_name,
        m.category,
        m.deposito_name || 'Almacén Central',
        parseFloat(m.quantity),
        m.unit,
        m.user_name || 'Sistema',
        m.details || ''
      ]);
    });

    worksheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const valStr = cell.value ? String(cell.value) : '';
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      column.width = Math.max(12, maxLen + 2);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Trazabilidad_${refugio_id}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel de trazabilidad.' });
  }
});

app.get('/api/refugios/:refugio_id/meals/manual-servings/download', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    const refugioRes = await db.query('SELECT name FROM refugios WHERE id = $1', [refugio_id]);
    const refugioName = refugioRes.rows.length > 0 ? refugioRes.rows[0].name : 'Sede';

    const manualRes = await db.query(
      `SELECT serving_date::date as date, meal_type, person_type, SUM(quantity)::int as quantity 
       FROM manual_meals_servings 
       WHERE refugio_id = $1 AND ($2::date IS NULL OR serving_date >= $2) AND ($3::date IS NULL OR serving_date <= $3)
       GROUP BY serving_date, meal_type, person_type`,
      [parseInt(refugio_id), start_date || null, end_date || null]
    );

    const scannedRes = await db.query(
      `SELECT meal_date::date as date, meal_type, 'Afectados' as person_type, COUNT(*)::int as quantity
       FROM meal_attendance
       WHERE refugio_id = $1 AND resident_id IS NOT NULL AND ($2::date IS NULL OR meal_date >= $2) AND ($3::date IS NULL OR meal_date <= $3)
       GROUP BY meal_date, meal_type`,
      [parseInt(refugio_id), start_date || null, end_date || null]
    );

    const scannedStaff = await db.query(
      `SELECT ma.meal_date::date as date, ma.meal_type, 
              CASE 
                WHEN u.role = 'medico' THEN 'Medicos'
                WHEN u.role = 'cocina' THEN 'Cocineras'
                WHEN u.role = 'seguridad' THEN 'Vigilantes'
                ELSE 'Administrativos'
              END as person_type, 
              COUNT(*)::int as quantity
       FROM meal_attendance ma
       JOIN users u ON ma.staff_id = u.id
       WHERE ma.refugio_id = $1 AND ma.staff_id IS NOT NULL AND ($2::date IS NULL OR ma.meal_date >= $2) AND ($3::date IS NULL OR ma.meal_date <= $3)
       GROUP BY ma.meal_date, ma.meal_type, u.role`,
      [parseInt(refugio_id), start_date || null, end_date || null]
    );

    const data = {};
    const addRow = (dateStr, mealType, personType, quantity) => {
      const key = `${dateStr}_${mealType}`;
      if (!data[key]) {
        data[key] = {
          date: dateStr,
          meal_type: mealType,
          'Afectados': 0,
          'Guardia Nacional': 0,
          'CICPC': 0,
          'Vigilantes': 0,
          'Medicos': 0,
          'Administrativos': 0,
          'Comite': 0,
          'Cocineras': 0,
          'Juventud': 0,
          'SAREN': 0,
          'Otros': 0
        };
      }
      data[key][personType] = (data[key][personType] || 0) + quantity;
    };

    manualRes.rows.forEach(r => addRow(new Date(r.date).toISOString().split('T')[0], r.meal_type, r.person_type, r.quantity));
    scannedRes.rows.forEach(r => addRow(new Date(r.date).toISOString().split('T')[0], r.meal_type, r.person_type, r.quantity));
    scannedStaff.rows.forEach(r => addRow(new Date(r.date).toISOString().split('T')[0], r.meal_type, r.person_type, r.quantity));

    const rows = Object.values(data).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.meal_type.localeCompare(b.meal_type);
    });

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Raciones Servidas');

    worksheet.mergeCells('A1:N1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `REPORTE CONSOLIDADO DE COMIDAS REPARTIDAS - ${refugioName.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2347' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 45;

    const path = require('path');
    const fs = require('fs');
    const sarenLogoPath = path.join(__dirname, '../frontend/public/logo-saren.png');
    const campamentoLogoPath = path.join(__dirname, '../frontend/public/campamento-logo-transparente.png');

    if (fs.existsSync(campamentoLogoPath)) {
      try {
        const imageId = workbook.addImage({
          filename: campamentoLogoPath,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 0.1, row: 0.15 },
          ext: { width: 42, height: 35 }
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (fs.existsSync(sarenLogoPath)) {
      try {
        const imageId = workbook.addImage({
          filename: sarenLogoPath,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 13.2, row: 0.15 },
          ext: { width: 80, height: 35 }
        });
      } catch (e) {
        console.error(e);
      }
    }

    worksheet.addRow([]);

    const headers = [
      'Fecha',
      'Servicio de Comida',
      'Afectados',
      'Guardia Nacional',
      'CICPC',
      'Vigilantes',
      'Médicos',
      'Administrativos',
      'Comité',
      'Cocineras',
      'Juventud',
      'SAREN',
      'Otros',
      'Total Raciones'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(3);
    headerRow.height = 25;
    headerRow.eachCell(function(cell) {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    rows.forEach(r => {
      const total = 
        r['Afectados'] +
        r['Guardia Nacional'] +
        r['CICPC'] +
        r['Vigilantes'] +
        r['Medicos'] +
        r['Administrativos'] +
        r['Comite'] +
        r['Cocineras'] +
        r['Juventud'] +
        r['SAREN'] +
        r['Otros'];

      worksheet.addRow([
        r.date,
        r.meal_type,
        r['Afectados'],
        r['Guardia Nacional'],
        r['CICPC'],
        r['Vigilantes'],
        r['Medicos'],
        r['Administrativos'],
        r['Comite'],
        r['Cocineras'],
        r['Juventud'],
        r['SAREN'],
        r['Otros'],
        total
      ]);
    });

    worksheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const valStr = cell.value ? String(cell.value) : '';
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      column.width = Math.max(12, maxLen + 2);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Comidas_Consolidado_${refugio_id}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel consolidado de comidas.' });
  }
});

app.get('/api/refugios/:refugio_id/meals/attendance', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { start_date, end_date } = req.query;
  try {
    const params = [refugio_id];
    let dateFilter = 'AND ma.meal_date = CURRENT_DATE';
    if (start_date || end_date) {
      dateFilter = '';
      if (start_date) {
        params.push(start_date);
        dateFilter += ` AND ma.meal_date >= $${params.length}`;
      }
      if (end_date) {
        params.push(end_date);
        dateFilter += ` AND ma.meal_date <= $${params.length}`;
      }
    }

    const result = await db.query(`
      SELECT ma.*,
        COALESCE(d.first_name, u.name) as first_name,
        COALESCE(d.last_name, '') as last_name,
        COALESCE(d.document_id, u.document_id) as document_id,
        u.name as staff_name,
        u.staff_function,
        u.photo as staff_photo
      FROM meal_attendance ma
      LEFT JOIN damnificados d ON ma.resident_id = d.id
      LEFT JOIN users u ON ma.staff_id = u.id
      WHERE ma.refugio_id = $1 ${dateFilter}
      ORDER BY ma.attended_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener asistencia del comedor.' });
  }
});

app.post('/api/meals/attendance', authenticateToken, async (req, res) => {
  const { document_id, resident_id, staff_id, person_type = 'resident', refugio_id } = req.body;
  const isStaff = person_type === 'staff' || !!staff_id;
  if ((!document_id && !resident_id && !staff_id) || !refugio_id) {
    return res.status(400).json({ error: 'Cédula/Identificador y Refugio son requeridos.' });
  }

  const currentMeal = getCurrentMealWindow();
  if (!currentMeal) {
    return res.status(400).json({
      error: 'Fuera del horario de servicio de comida. Horarios: Desayuno 06:00-11:00, Almuerzo 11:30-15:00, Merienda 15:00-16:00, Cena 17:30-22:00.'
    });
  }

  try {
    if (isStaff) {
      let staffRes;
      if (staff_id) {
        staffRes = await db.query(
          `SELECT id, name, document_id, staff_function, photo, refugio_id
           FROM users
           WHERE id = $1 AND refugio_id = $2`,
          [staff_id, refugio_id]
        );
      } else {
        staffRes = await db.query(
          `SELECT id, name, document_id, staff_function, photo, refugio_id
           FROM users
           WHERE document_id = $1 AND refugio_id = $2`,
          [document_id, refugio_id]
        );
      }

      if (staffRes.rows.length === 0) {
        return res.status(404).json({ error: 'Personal no encontrado en esta sede.' });
      }

      const staff = staffRes.rows[0];
      const result = await db.query(
        `INSERT INTO meal_attendance (staff_id, person_type, refugio_id, meal_type)
         VALUES ($1, 'staff', $2, $3) RETURNING *`,
        [staff.id, refugio_id, currentMeal.mealType]
      );
      return res.status(201).json({ attendance: result.rows[0], staff });
    }

    let resResident;
    if (resident_id) {
      resResident = await db.query('SELECT id, first_name, last_name FROM damnificados WHERE id = $1 AND refugio_id = $2', [resident_id, refugio_id]);
    } else {
      resResident = await db.query('SELECT id, first_name, last_name FROM damnificados WHERE document_id = $1 AND refugio_id = $2', [document_id, refugio_id]);
    }
    if (resResident.rows.length === 0) {
      return res.status(404).json({ error: 'Residente no encontrado en esta sede.' });
    }
    
    const resident = resResident.rows[0];
    const result = await db.query(
      `INSERT INTO meal_attendance (resident_id, person_type, refugio_id, meal_type)
       VALUES ($1, 'resident', $2, $3) RETURNING *`,
      [resident.id, refugio_id, currentMeal.mealType]
    );
    res.status(201).json({ attendance: result.rows[0], resident });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Esta persona ya registró su asistencia para esta comida hoy.' });
    }
    res.status(500).json({ error: 'Error al registrar asistencia.' });
  }
});

// --- RUTAS DE DONACIONES Y DONANTES ---
app.get('/api/donors', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;
    let queryStr = 'SELECT * FROM donors';
    let params = [];
    if (search) {
      queryStr += ' WHERE name ILIKE $1 OR rif ILIKE $1 OR organization ILIKE $1';
      params.push(`%${search.trim()}%`);
    }
    queryStr += ' ORDER BY name ASC LIMIT 10';
    const result = await db.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener donantes.' });
  }
});

app.get('/api/donations', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT d.*, r.name as refugio_name FROM donations d LEFT JOIN refugios r ON d.refugio_id = r.id ORDER BY d.received_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener donaciones.' });
  }
});

app.post('/api/donations', authenticateToken, async (req, res) => {
  const { refugio_id, donor_name, donor_organization, donor_rif, donor_phone, items, destination_warehouse } = req.body;
  
  if (!donor_name || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El nombre del donante y al menos un artículo son requeridos.' });
  }

  try {
    const cleanName = donor_name.trim().toUpperCase();
    const cleanOrg = donor_organization ? donor_organization.trim().toUpperCase() : null;
    const cleanRif = donor_rif ? donor_rif.trim().toUpperCase() : null;
    const cleanPhone = donor_phone ? donor_phone.trim() : null;

    // 1. Auto-save donor registry
    if (cleanRif) {
      await db.query(
        `INSERT INTO donors (name, organization, rif, phone)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (rif) DO UPDATE
         SET name = EXCLUDED.name, organization = EXCLUDED.organization, phone = EXCLUDED.phone`,
        [cleanName, cleanOrg, cleanRif, cleanPhone]
      );
    }

    // 2. Insert details into donations table
    const result = await db.query(
      `INSERT INTO donations (refugio_id, donor_name, donor_organization, donor_rif, donor_phone, items_json, destination_warehouse)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        refugio_id || null,
        cleanName,
        cleanOrg,
        cleanRif,
        cleanPhone,
        JSON.stringify(items),
        destination_warehouse || 'Bodega Central'
      ]
    );
    const donationId = result.rows[0].id;

    // 3. If donation is assigned to a shelter, sync items to inventory
    if (refugio_id) {
      for (const item of items) {
        const item_name = item.name;
        const category = item.category || 'Donación';
        const quantity = parseFloat(item.quantity) || 0;
        const unit = item.unit || 'unidades';

        let targetDepId = null;
        let targetDepName = destination_warehouse || 'Bodega Central';

        // Auto-routing logic based on category
        if (category === 'Alimentos') {
          const depRes = await db.query(
            "SELECT id FROM depositos WHERE refugio_id = $1 AND name ILIKE '%cocina%' LIMIT 1",
            [refugio_id]
          );
          if (depRes.rows.length > 0) {
            targetDepId = depRes.rows[0].id;
          } else {
            const createDep = await db.query(
              "INSERT INTO depositos (refugio_id, name, capacity_percent) VALUES ($1, 'Cocina', 0) RETURNING id",
              [refugio_id]
            );
            targetDepId = createDep.rows[0].id;
          }
          targetDepName = 'Cocina';
        } else if (category === 'Medicinas') {
          const depRes = await db.query(
            "SELECT id FROM depositos WHERE refugio_id = $1 AND (name ILIKE '%medico%' OR name ILIKE '%médico%' OR name ILIKE '%salud%') LIMIT 1",
            [refugio_id]
          );
          if (depRes.rows.length > 0) {
            targetDepId = depRes.rows[0].id;
          } else {
            const createDep = await db.query(
              "INSERT INTO depositos (refugio_id, name, capacity_percent) VALUES ($1, 'Servicio Médico', 0) RETURNING id",
              [refugio_id]
            );
            targetDepId = createDep.rows[0].id;
          }
          targetDepName = 'Servicio Médico';
        } else if (destination_warehouse) {
          const depRes = await db.query(
            'SELECT id FROM depositos WHERE refugio_id = $1 AND LOWER(name) = LOWER($2)',
            [refugio_id, destination_warehouse.trim()]
          );
          if (depRes.rows.length > 0) {
            targetDepId = depRes.rows[0].id;
          } else {
            const createDep = await db.query(
              'INSERT INTO depositos (refugio_id, name, capacity_percent) VALUES ($1, $2, 0) RETURNING id',
              [refugio_id, destination_warehouse.trim()]
            );
            targetDepId = createDep.rows[0].id;
          }
        }

        // Check if item exists in inventory for this refugio and depósito
        const checkItem = await db.query(
          `SELECT id, quantity, min_threshold FROM inventory 
           WHERE refugio_id = $1 AND LOWER(item_name) = LOWER($2) AND category = $3 
           AND (deposito_id = $4 OR (deposito_id IS NULL AND $4 IS NULL))`,
          [refugio_id, item_name, category, targetDepId]
        );

        let inventoryItemId;
        let finalQty;
        if (checkItem.rows.length > 0) {
          const existing = checkItem.rows[0];
          inventoryItemId = existing.id;
          finalQty = parseFloat(existing.quantity) + quantity;
          const minVal = parseFloat(existing.min_threshold) || 5;
          let status = 'Stock Suficiente';
          if (finalQty <= 0) status = 'Sin Stock';
          else if (finalQty < minVal) status = 'Stock Crítico';

          await db.query(
            'UPDATE inventory SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3',
            [finalQty, status, inventoryItemId]
          );
        } else {
          finalQty = quantity;
          let status = 'Stock Suficiente';
          if (quantity <= 0) status = 'Sin Stock';
          else if (quantity < 5) status = 'Stock Crítico';

          const insertRes = await db.query(
            `INSERT INTO inventory (refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id)
             VALUES ($1, $2, $3, $4, 5, $5, $6, $7) RETURNING id`,
            [refugio_id, item_name, category, quantity, unit, status, targetDepId]
          );
          inventoryItemId = insertRes.rows[0].id;
        }

        // 4. Log movement in inventory_movements
        const inventory_type = category === 'Alimentos' ? 'cocina' : (category === 'Medicinas' ? 'salud' : 'almacen');
        await db.query(
          `INSERT INTO inventory_movements (refugio_id, inventory_id, item_name, category, deposito_id, deposito_name, inventory_type, movement_type, quantity, unit, user_id, user_name, reference_id, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            refugio_id,
            inventoryItemId,
            item_name,
            category,
            targetDepId,
            targetDepName,
            inventory_type,
            'ingreso_donacion',
            quantity,
            unit,
            req.user?.id || null,
            req.user?.name || 'Sistema',
            donationId,
            `Ingreso por donación de ${cleanName}`
          ]
        );
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al registrar donación:", err);
    res.status(500).json({ error: 'Error al registrar donación.' });
  }
});

// --- RUTA DE ESTADÍSTICAS ---
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const refugiosCountRes = await db.query('SELECT COUNT(*)::int FROM refugios');
    const damnificadosCountRes = await db.query("SELECT COUNT(*)::int FROM damnificados WHERE status = 'Activo'");
    const totalCapacityRes = await db.query('SELECT COALESCE(SUM(capacity), 0)::int FROM refugios');
    
    // Obtener sedes críticas con stock crítico o nulo
    const criticalShedRes = await db.query(`
      SELECT COUNT(DISTINCT refugio_id)::int 
      FROM inventory 
      WHERE status IN ('Stock Crítico', 'Sin Stock')
    `);
    
    res.json({
      totalRefugios: refugiosCountRes.rows[0].count,
      totalDamnificados: damnificadosCountRes.rows[0].count,
      capacidadTotal: totalCapacityRes.rows[0].coalesce,
      capacidadDisponible: Math.max(0, totalCapacityRes.rows[0].coalesce - damnificadosCountRes.rows[0].count),
      sedesCriticas: criticalShedRes.rows[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

// --- RUTAS DE BITÁCORA DE ACCESO (CONTROL DE ENTRADAS Y SALIDAS) ---

// Registrar entrada o salida
app.post('/api/refugios/:refugioId/access-logs', authenticateToken, async (req, res) => {
  const { refugioId } = req.params;
  const { resident_id, staff_id, person_type = 'resident', type } = req.body;
  const isStaff = person_type === 'staff' || !!staff_id;

  if ((!resident_id && !staff_id) || !type) {
    return res.status(400).json({ error: 'Falta identificador o tipo de acceso.' });
  }

  try {
    if (isStaff) {
      const staffCheck = await db.query(
        `SELECT id, name, document_id, staff_function, photo, refugio_id
         FROM users
         WHERE id = $1 AND refugio_id = $2`,
        [staff_id, refugioId]
      );
      if (staffCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Personal no encontrado en esta sede.' });
      }

      const staff = staffCheck.rows[0];
      const insertRes = await db.query(
        `INSERT INTO access_logs (staff_id, person_type, refugio_id, type)
         VALUES ($1, 'staff', $2, $3) RETURNING *`,
        [staff.id, refugioId, type]
      );

      return res.status(201).json({
        log: insertRes.rows[0],
        person_type: 'staff',
        resident_name: staff.name,
        person_name: staff.name,
        staff
      });
    }

    // 1. Verificar si el residente existe y está activo
    const residentCheck = await db.query(
      'SELECT id, first_name, last_name, document_id, status FROM damnificados WHERE id = $1 AND refugio_id = $2',
      [resident_id, refugioId]
    );
    if (residentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Residente no encontrado.' });
    }
    const resident = residentCheck.rows[0];
    if (resident.status !== 'Activo') {
      return res.status(400).json({ error: 'El residente no se encuentra activo en el sistema.' });
    }

    // 2. Insertar registro de acceso
    const insertRes = await db.query(
      `INSERT INTO access_logs (resident_id, person_type, refugio_id, type)
       VALUES ($1, 'resident', $2, $3) RETURNING *`,
      [resident_id, refugioId, type]
    );

    // 3. Obtener ubicación asignada (cama)
    const bedCheck = await db.query(
      'SELECT room_number, bed_number FROM beds WHERE resident_id = $1',
      [resident_id]
    );
    const bed = bedCheck.rows[0] || { room_number: 'Sin Sector', bed_number: 'S/C' };

    res.status(201).json({
      log: insertRes.rows[0],
      person_type: 'resident',
      person_name: `${resident.first_name} ${resident.last_name}`,
      resident: {
        id: resident.id,
        first_name: resident.first_name,
        last_name: resident.last_name,
        document_id: resident.document_id,
        room_number: bed.room_number,
        bed_number: bed.bed_number
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar bitácora de acceso.' });
  }
});

// Obtener bitácora de accesos recientes
app.get('/api/refugios/:refugioId/access-logs', authenticateToken, async (req, res) => {
  const { refugioId } = req.params;
  try {
    const result = await db.query(`
      SELECT al.*,
        COALESCE(d.first_name, u.name) as first_name,
        COALESCE(d.last_name, '') as last_name,
        COALESCE(d.document_id, u.document_id) as document_id,
        u.name as staff_name,
        u.staff_function,
        b.room_number,
        b.bed_number 
      FROM access_logs al
      LEFT JOIN damnificados d ON al.resident_id = d.id
      LEFT JOIN users u ON al.staff_id = u.id
      LEFT JOIN beds b ON d.id = b.resident_id
      WHERE al.refugio_id = $1
      ORDER BY al.logged_at DESC
      LIMIT 50
    `, [refugioId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener bitácora de acceso.' });
  }
});

// --- RUTAS DE INCIDENCIAS DE SEGURIDAD ---

// Obtener todas las incidencias de una sede
app.get('/api/refugios/:refugioId/incidents', authenticateToken, async (req, res) => {
  const { refugioId } = req.params;
  try {
    const result = await db.query(`
      SELECT i.*, 
             d.first_name as resident_first_name, d.last_name as resident_last_name, d.document_id as resident_doc_id,
             u.name as reporter_name
      FROM incidents i
      LEFT JOIN damnificados d ON i.resident_id = d.id
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.refugio_id = $1
      ORDER BY i.logged_at DESC
    `, [parseInt(refugioId)]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener incidencias:", err);
    res.status(500).json({ error: 'Error al obtener incidencias de la sede.' });
  }
});

// Obtener todas las incidencias a nivel nacional (Consolidado)
app.get('/api/incidents', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Acceso denegado. Permiso requerido de supervisor global.' });
  }
  try {
    const result = await db.query(`
      SELECT i.*, 
             d.first_name as resident_first_name, d.last_name as resident_last_name, d.document_id as resident_doc_id,
             u.name as reporter_name,
             r.name as refugio_name, r.location as refugio_location
      FROM incidents i
      LEFT JOIN damnificados d ON i.resident_id = d.id
      LEFT JOIN users u ON i.reported_by = u.id
      LEFT JOIN refugios r ON i.refugio_id = r.id
      ORDER BY i.logged_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener incidencias globales:", err);
    res.status(500).json({ error: 'Error al obtener incidencias globales.' });
  }
});

// Obtener inventarios consolidados a nivel nacional
app.get('/api/inventory', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Acceso denegado. Permiso requerido de supervisor global.' });
  }
  try {
    const result = await db.query(`
      SELECT i.*, r.name as refugio_name, r.location as refugio_location
      FROM inventory i
      LEFT JOIN refugios r ON i.refugio_id = r.id
      ORDER BY i.item_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener inventario global:", err);
    res.status(500).json({ error: 'Error al obtener inventario global.' });
  }
});

// Crear una nueva incidencia
app.post('/api/refugios/:refugioId/incidents', authenticateToken, async (req, res) => {
  const { refugioId } = req.params;
  const { resident_id, incident_type, description, action_taken, involved_residents } = req.body;
  const reported_by = req.user.id;

  if (!description) {
    return res.status(400).json({ error: 'La descripción de la incidencia es obligatoria.' });
  }

  try {
    const result = await db.query(`
      INSERT INTO incidents (refugio_id, resident_id, reported_by, incident_type, description, action_taken, involved_residents)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      parseInt(refugioId),
      resident_id ? parseInt(resident_id) : null,
      reported_by,
      incident_type || 'Novedad',
      description,
      action_taken || '',
      involved_residents || '[]'
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al crear incidencia:", err);
    res.status(500).json({ error: 'Error al registrar la incidencia de seguridad.' });
  }
});

// Obtener incidencias asociadas a un residente específico
app.get('/api/residents/:residentId/incidents', authenticateToken, async (req, res) => {
  const { residentId } = req.params;
  try {
    const result = await db.query(`
      SELECT i.*, u.name as reporter_name, r.name as refugio_name
      FROM incidents i
      LEFT JOIN users u ON i.reported_by = u.id
      LEFT JOIN refugios r ON i.refugio_id = r.id
      ORDER BY i.logged_at DESC
    `);
    
    const filtered = result.rows.filter(row => {
      if (row.resident_id && parseInt(row.resident_id) === parseInt(residentId)) return true;
      try {
        const involved = JSON.parse(row.involved_residents || '[]');
        return involved.some(member => parseInt(member.id) === parseInt(residentId));
      } catch {
        return false;
      }
    });

    res.json(filtered);
  } catch (err) {
    console.error("Error al obtener incidencias del residente:", err);
    res.status(500).json({ error: 'Error al obtener incidencias del residente.' });
  }
});

// --- RUTAS DE DEPOSITOS (ALMACENES DE DESTINO) ---

// Obtener depósitos
app.get('/api/refugios/:refugioId/depositos', authenticateToken, async (req, res) => {
  const { refugioId } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM depositos WHERE refugio_id = $1 ORDER BY id ASC',
      [parseInt(refugioId)]
    );
    
    // Semillar si está vacío
    if (result.rows.length === 0) {
      const defaults = [
        { name: 'Depósito Central', description: 'Zona Industrial. Almacén principal de alta capacidad.', capacity_percent: 85 },
        { name: 'Depósito Norte', description: 'Hub de reabastecimiento rápido de insumos.', capacity_percent: 42 },
        { name: 'Depósito Este', description: 'Depósito intermedio para distribución local.', capacity_percent: 12 }
      ];
      for (const d of defaults) {
        await db.query(
          'INSERT INTO depositos (refugio_id, name, description, capacity_percent) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [parseInt(refugioId), d.name, d.description, d.capacity_percent]
        );
      }
      const seeded = await db.query(
        'SELECT * FROM depositos WHERE refugio_id = $1 ORDER BY id ASC',
        [parseInt(refugioId)]
      );
      return res.json(seeded.rows);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener depósitos:", err);
    res.status(500).json({ error: 'Error al obtener depósitos.' });
  }
});

// Crear depósito
app.post('/api/refugios/:refugioId/depositos', authenticateToken, async (req, res) => {
  const { refugioId } = req.params;
  const { name, description, capacity_percent } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre del depósito es requerido.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO depositos (refugio_id, name, description, capacity_percent) VALUES ($1, $2, $3, $4) RETURNING *',
      [parseInt(refugioId), name, description || '', parseInt(capacity_percent) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al crear depósito:", err);
    res.status(500).json({ error: 'Error al crear depósito.' });
  }
});

// Actualizar depósito
app.put('/api/refugios/:refugioId/depositos/:depositoId', authenticateToken, async (req, res) => {
  const { refugioId, depositoId } = req.params;
  const { name, description, capacity_percent } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre del depósito es requerido.' });
  }
  try {
    const result = await db.query(
      'UPDATE depositos SET name = $1, description = $2, capacity_percent = $3 WHERE id = $4 AND refugio_id = $5 RETURNING *',
      [name, description || '', parseInt(capacity_percent) || 0, parseInt(depositoId), parseInt(refugioId)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al actualizar depósito:", err);
    res.status(500).json({ error: 'Error al actualizar depósito.' });
  }
});

// Eliminar depósito
app.delete('/api/refugios/:refugioId/depositos/:depositoId', authenticateToken, async (req, res) => {
  const { refugioId, depositoId } = req.params;
  try {
    await db.query(
      'DELETE FROM depositos WHERE id = $1 AND refugio_id = $2',
      [parseInt(depositoId), parseInt(refugioId)]
    );
    res.json({ message: 'Depósito eliminado con éxito.' });
  } catch (err) {
    console.error("Error al eliminar depósito:", err);
    res.status(500).json({ error: 'Error al eliminar depósito.' });
  }
});

// --- RUTAS DE SOLICITUDES AL ALMACEN ---
// Obtener solicitudes
app.get('/api/refugios/:refugio_id/warehouse-requests', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM warehouse_requests WHERE refugio_id = $1 ORDER BY created_at DESC',
      [parseInt(refugio_id)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener solicitudes:", err);
    res.status(500).json({ error: 'Error al obtener solicitudes al almacén.' });
  }
});

// Crear solicitud
app.post('/api/refugios/:refugio_id/warehouse-requests', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { area, item_name, quantity, details, unit } = req.body;
  if (!area || !item_name || !quantity) {
    return res.status(400).json({ error: 'Área, insumo y cantidad son requeridos.' });
  }
  try {
    const result = await db.query(
      `INSERT INTO warehouse_requests (refugio_id, area, item_name, quantity, details, unit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [parseInt(refugio_id), area, item_name, parseFloat(quantity), details || null, unit || 'Unidades']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al crear solicitud:", err);
    res.status(500).json({ error: 'Error al crear solicitud al almacén.' });
  }
});

// Resetear comedor para pruebas
app.post('/api/refugios/:refugio_id/reset-kitchen-testing', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
    await db.query('DELETE FROM menus WHERE refugio_id = $1', [parseInt(refugio_id)]);
    await db.query("DELETE FROM warehouse_requests WHERE refugio_id = $1 AND area = 'Comedor'", [parseInt(refugio_id)]);
    
    const cocDepRes = await db.query("SELECT id FROM depositos WHERE name ILIKE '%cocina%' AND refugio_id = $1", [parseInt(refugio_id)]);
    if (cocDepRes.rows.length > 0) {
      const cocinaDepId = cocDepRes.rows[0].id;
      await db.query('DELETE FROM inventory WHERE refugio_id = $1 AND category = $2 AND deposito_id = $3', [parseInt(refugio_id), 'Alimentos', cocinaDepId]);
    } else {
      await db.query('DELETE FROM inventory WHERE refugio_id = $1 AND category = $2', [parseInt(refugio_id), 'Alimentos']);
    }
    res.json({ message: 'Comedor reiniciado exitosamente para pruebas.' });
  } catch (err) {
    console.error("Error al reiniciar comedor:", err);
    res.status(500).json({ error: 'Error al reiniciar comedor.' });
  }
});

// Procesar solicitud (Aprobar / Rechazar)
app.put('/api/refugios/:refugio_id/warehouse-requests/:id', authenticateToken, async (req, res) => {
  const { refugio_id, id } = req.params;
  const { status, deposito_id } = req.body; // 'Aprobada', 'Rechazada', optional dispatch source deposito_id
  try {
    if (status === 'Aprobada') {
      const reqResult = await db.query('SELECT * FROM warehouse_requests WHERE id = $1 AND refugio_id = $2', [parseInt(id), parseInt(refugio_id)]);
      if (reqResult.rows.length > 0) {
        const request = reqResult.rows[0];

        const isMedicalRequest = (request.area || '').toLowerCase().includes('médico') || (request.area || '').toLowerCase().includes('medico');
        const targetDepositoName = isMedicalRequest ? 'Servicio Médico' : 'Cocina';
        const targetDepositoSearch = isMedicalRequest ? '%médico%' : '%cocina%';
        const targetDepositoSearchAlt = isMedicalRequest ? '%medico%' : '%cocina%';
        const targetDepositoDescription = isMedicalRequest
          ? 'Depósito local del servicio médico para insumos de salud'
          : 'Depósito local de cocina para raciones diarias';
        const fallbackCategory = isMedicalRequest ? 'Medicinas' : 'Alimentos';

        // 1. Find or create destination service depósito
        let targetDepId = null;
        const depRes = await db.query(
          "SELECT id FROM depositos WHERE refugio_id = $1 AND (name ILIKE $2 OR name ILIKE $3) LIMIT 1",
          [parseInt(refugio_id), targetDepositoSearch, targetDepositoSearchAlt]
        );
        if (depRes.rows.length > 0) {
          targetDepId = depRes.rows[0].id;
        } else {
          const newDep = await db.query(
            "INSERT INTO depositos (refugio_id, name, description, capacity_percent) VALUES ($1, $2, $3, 100) RETURNING id",
            [parseInt(refugio_id), targetDepositoName, targetDepositoDescription]
          );
          targetDepId = newDep.rows[0].id;
        }

        // 2. Prepare items to process (supports both consolidated details and single item)
        const itemsToProcess = [];
        if (request.details) {
          try {
            const parsed = JSON.parse(request.details);
            if (Array.isArray(parsed) && parsed.length > 0) {
              itemsToProcess.push(...parsed);
            }
          } catch (e) {
            console.error("Error parsing details:", e);
          }
        }
        if (itemsToProcess.length === 0) {
          itemsToProcess.push({
            name: request.item_name,
            quantity: request.quantity,
            unit: request.unit || 'Unidades'
          });
        }

        // 3. Process each item transfer
        for (const item of itemsToProcess) {
          const cleanName = item.name.replace(/\s*\(.*?\)\s*/g, '').trim();

          // Find the actual warehouse item to deduct from (and get its unit/category)
          let warehouseItem = null;
          let findQuery = `SELECT * FROM inventory WHERE refugio_id = $1 AND (item_name ILIKE $2 OR item_name ILIKE $3 OR $4 ILIKE '%' || item_name || '%') AND (deposito_id != $5 OR deposito_id IS NULL)`;
          let findParams = [parseInt(refugio_id), `%${cleanName}%`, `%${item.name}%`, item.name, targetDepId];
          
          if (deposito_id) {
            findQuery += ` AND deposito_id = $6`;
            findParams.push(parseInt(deposito_id));
          }
          findQuery += ` ORDER BY quantity DESC LIMIT 1`;

          const whItemRes = await db.query(findQuery, findParams);
          if (whItemRes.rows.length > 0) {
            warehouseItem = whItemRes.rows[0];
          }

          const targetUnit = warehouseItem ? warehouseItem.unit : (item.unit || 'Unidades');
          const targetCategory = warehouseItem ? warehouseItem.category : fallbackCategory;

          // Deduct from warehouse
          if (warehouseItem) {
            await db.query(
              `UPDATE inventory 
               SET quantity = GREATEST(0, quantity - $1),
                   status = CASE WHEN GREATEST(0, quantity - $1) = 0 THEN 'Sin Stock' WHEN GREATEST(0, quantity - $1) <= min_threshold THEN 'Stock Crítico' ELSE 'Stock Suficiente' END
               WHERE id = $2`,
              [parseFloat(item.quantity) || 0, warehouseItem.id]
            );
          }

          // Add to destination service depósito
          const existingTargetItem = await db.query(
            "SELECT id, quantity FROM inventory WHERE refugio_id = $1 AND (item_name ILIKE $2 OR item_name ILIKE $3 OR $4 ILIKE '%' || item_name || '%') AND deposito_id = $5",
            [parseInt(refugio_id), `%${cleanName}%`, `%${item.name}%`, item.name, targetDepId]
          );

          if (existingTargetItem.rows.length > 0) {
            await db.query(
              "UPDATE inventory SET quantity = quantity + $1, status = CASE WHEN (quantity + $1) <= min_threshold THEN 'Stock Crítico' ELSE 'Stock Suficiente' END, updated_at = NOW() WHERE id = $2",
              [parseFloat(item.quantity) || 0, existingTargetItem.rows[0].id]
            );
          } else {
            const qtyVal = parseFloat(item.quantity) || 0;
            const statusStr = qtyVal <= 5 ? 'Stock Crítico' : 'Stock Suficiente';
            await db.query(
              `INSERT INTO inventory (refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id)
               VALUES ($1, $2, $3, $4, 5, $5, $6, $7)`,
              [parseInt(refugio_id), cleanName, targetCategory, qtyVal, targetUnit, statusStr, targetDepId]
            );
          }
        }
      }
    }

    const result = await db.query(
      'UPDATE warehouse_requests SET status = $1 WHERE id = $2 AND refugio_id = $3 RETURNING *',
      [status, parseInt(id), parseInt(refugio_id)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al procesar solicitud:", err);
    res.status(500).json({ error: 'Error al procesar solicitud.' });
  }
});

// Iniciar servidor y sembrar administrador inicial
app.listen(PORT, async () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
  await initDb();
  await seedAdmin();
});

// Trigger reload after database schema migration. (Status added)
