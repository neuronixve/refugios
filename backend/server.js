const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

app.use(cors({
  origin: ['https://venezuelarenacera.com', 'http://localhost:5173'], // Tu web en producción y local
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
    await runMigration('users.card_printed', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS card_printed BOOLEAN DEFAULT FALSE');
    await runMigration('refugios.staff_config', "ALTER TABLE refugios ADD COLUMN IF NOT EXISTS staff_config TEXT DEFAULT '{}'");
    await runMigration('menus.diets_json', "ALTER TABLE menus ADD COLUMN IF NOT EXISTS diets_json TEXT DEFAULT '{}'");
    await runMigration('warehouse_requests.details', 'ALTER TABLE warehouse_requests ADD COLUMN IF NOT EXISTS details TEXT');
    await runMigration('warehouse_requests.unit', "ALTER TABLE warehouse_requests ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'Unidades'");
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
    
    console.log('Migraciones dinámicas verificadas y aplicadas.');
  } catch (err) {
    console.error('Error al inicializar el esquema de base de datos:', err);
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
  const token = authHeader && authHeader.split(' ')[1];
  
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
  if (minutes >= 11 * 60 + 30 && minutes <= 16 * 60 + 30) {
    return { mealType: 'Almuerzo', label: '11:30 AM - 04:30 PM' };
  }
  if (minutes >= 17 * 60 + 30 && minutes <= 22 * 60) {
    return { mealType: 'Cena', label: '05:30 PM - 10:00 PM' };
  }
  return null;
};

// --- RUTAS DE AUTENTICACIÓN ---

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

// --- RUTAS DE GESTIÓN DE USUARIOS (RBAC) ---

// Obtener listado de usuarios según permisos del rol logueado
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    let queryText = '';
    let queryParams = [];

    if (req.user.role === 'admin') {
      // Superusuario ve todos los usuarios
      queryText = `
        SELECT u.id, u.name, u.email, u.role, u.document_id, u.photo, u.staff_function, u.refugio_id, u.card_printed, u.is_active, r.name as refugio_name 
        FROM users u 
        LEFT JOIN refugios r ON u.refugio_id = r.id 
        WHERE COALESCE(u.is_active, TRUE) = TRUE
        ORDER BY u.id DESC
      `;
    } else if (req.user.role === 'supervisor') {
      // Supervisor ve solo los gerentes de cada sede
      queryText = `
        SELECT u.id, u.name, u.email, u.role, u.document_id, u.photo, u.staff_function, u.refugio_id, u.card_printed, u.is_active, r.name as refugio_name 
        FROM users u 
        LEFT JOIN refugios r ON u.refugio_id = r.id 
        WHERE u.role = 'gerente' AND COALESCE(u.is_active, TRUE) = TRUE
        ORDER BY u.id DESC
      `;
    } else if (req.user.role === 'gerente' || req.user.role === 'registro') {
      // Gerente y registro ven todo el personal operativo asignado a su sede.
      queryText = `
        SELECT u.id, u.name, u.email, u.role, u.document_id, u.photo, u.staff_function, u.refugio_id, u.card_printed, u.is_active, r.name as refugio_name 
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

// Crear usuario según jerarquía
app.post('/api/users', authenticateToken, async (req, res) => {
  let { name, email, password, role, refugio_id, document_id, photo, staff_function } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: 'Nombre y rol son obligatorios.' });
  }

  const cleanDocumentId = (document_id || '').trim();
  const cleanStaffFunction = (staff_function || '').trim();
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

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Nombre, email y rol son requeridos.' });
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

    // Asignación de refugio_id automática si el creador es Gerente
    let targetRefugioId = refugio_id;
    if (req.user.role === 'gerente' || req.user.role === 'registro') {
      targetRefugioId = req.user.refugio_id;
    }

    let queryText = `UPDATE users
      SET name = $1, email = $2, role = $3, refugio_id = $4, document_id = $5, photo = $6, staff_function = $7
      WHERE id = $8
      RETURNING id, name, email, role, refugio_id, document_id, photo, staff_function`;
    let queryParams = [name, email, role, targetRefugioId || null, document_id || null, photo || null, staff_function || null, id];

    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      queryText = `UPDATE users
        SET name = $1, email = $2, role = $3, refugio_id = $4, document_id = $5, photo = $6, staff_function = $7, password_hash = $8
        WHERE id = $9
        RETURNING id, name, email, role, refugio_id, document_id, photo, staff_function`;
      queryParams = [name, email, role, targetRefugioId || null, document_id || null, photo || null, staff_function || null, passwordHash, id];
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
  try {
    const result = await db.query(
      `SELECT id, name, email, role, document_id, photo, staff_function, refugio_id, card_printed, is_active
       FROM users
       WHERE refugio_id = $1
       AND role NOT IN ('admin', 'supervisor')
       AND COALESCE(is_active, TRUE) = TRUE
       ORDER BY name ASC`,
      [parseInt(refugio_id)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
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
  try {
    const result = await db.query(`
      SELECT fg.*, COUNT(d.id)::int as members_count 
      FROM family_groups fg
      LEFT JOIN damnificados d ON fg.id = d.family_group_id
      GROUP BY fg.id
      ORDER BY fg.family_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener grupos familiares.' });
  }
});

app.post('/api/family-groups', authenticateToken, async (req, res) => {
  const { family_name, block_assignment } = req.body;
  if (!family_name) return res.status(400).json({ error: 'El nombre de la familia es requerido.' });
  try {
    const result = await db.query(
      'INSERT INTO family_groups (family_name, block_assignment) VALUES ($1, $2) RETURNING *',
      [family_name, block_assignment]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear grupo familiar.' });
  }
});

// --- RUTAS DE DAMNIFICADOS ---

// Obtener damnificados
app.get('/api/damnificados', authenticateToken, async (req, res) => {
  const { refugio_id, search, family_group_id } = req.query;
  try {
    let queryText = `
      SELECT d.*, r.name as refugio_name, fg.family_name 
      FROM damnificados d 
      LEFT JOIN refugios r ON d.refugio_id = r.id 
      LEFT JOIN family_groups fg ON d.family_group_id = fg.id
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

    if (search) {
      const parsedSearchId = parseInt(search);
      if (!isNaN(parsedSearchId)) {
        queryText += ` AND (d.id = $${paramIndex} OR d.first_name ILIKE $${paramIndex + 1} OR d.last_name ILIKE $${paramIndex + 1} OR d.document_id ILIKE $${paramIndex + 1})`;
        params.push(parsedSearchId);
        params.push(`%${search}%`);
        paramIndex += 2;
      } else {
        queryText += ` AND (d.first_name ILIKE $${paramIndex} OR d.last_name ILIKE $${paramIndex} OR d.document_id ILIKE $${paramIndex})`;
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
      (document_id, first_name, last_name, birth_date, gender, health_status, special_needs, refugio_id, family_group_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [document_id || null, first_name, last_name, birth_date || null, gender || null, health_status || 'Estable', special_needs || null, refugio_id || null, family_group_id || null]
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
    const result = await db.query(
      `UPDATE damnificados SET 
        document_id = $1, first_name = $2, last_name = $3, birth_date = $4, 
        gender = $5, health_status = $6, special_needs = $7, refugio_id = $8,
        family_group_id = $9, status = $10
      WHERE id = $11 RETURNING *`,
      [document_id || null, first_name, last_name, birth_date || null, gender || null, health_status || 'Estable', special_needs || null, refugio_id || null, family_group_id || null, status || 'Activo', id]
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

app.post('/api/refugios/:refugio_id/inventory', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { id, item_name, category, quantity, min_threshold, unit, deposito_id } = req.body;
  if (!item_name || !category || quantity === undefined) {
    return res.status(400).json({ error: 'Insumo, categoría y cantidad son requeridos.' });
  }

  try {
    const qtyVal = parseFloat(quantity) || 0;
    const minVal = parseFloat(min_threshold) || 0;
    const status = qtyVal === 0 ? 'Sin Stock' : (qtyVal <= minVal ? 'Stock Crítico' : 'Stock Suficiente');
    
    let result;
    if (id) {
      result = await db.query(
        `INSERT INTO inventory (id, refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE 
         SET item_name = EXCLUDED.item_name, category = EXCLUDED.category, quantity = EXCLUDED.quantity, 
             min_threshold = EXCLUDED.min_threshold, unit = EXCLUDED.unit, status = EXCLUDED.status, deposito_id = EXCLUDED.deposito_id, updated_at = NOW()
         RETURNING *`,
        [parseInt(id), parseInt(refugio_id), item_name, category, qtyVal, minVal, unit || 'unidades', status, deposito_id || null]
      );
    } else {
      result = await db.query(
        `INSERT INTO inventory (refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [parseInt(refugio_id), item_name, category, qtyVal, minVal, unit || 'unidades', status, deposito_id || null]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar inventario.' });
  }
});

app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  try {
    const itemRes = await db.query('SELECT min_threshold FROM inventory WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Insumo no encontrado.' });
    
    const min_threshold = itemRes.rows[0].min_threshold;
    const status = quantity === 0 ? 'Sin Stock' : (quantity <= min_threshold ? 'Stock Crítico' : 'Stock Suficiente');
    
    const result = await db.query(
      'UPDATE inventory SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [quantity, status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar inventario.' });
  }
});

app.post('/api/refugios/:refugio_id/deliveries', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { resident_id, item_name, quantity } = req.body;
  if (!resident_id || !item_name || !quantity) {
    return res.status(400).json({ error: 'Residente, insumo y cantidad son requeridos.' });
  }

  try {
    // Registrar entrega
    const result = await db.query(
      'INSERT INTO supply_deliveries (refugio_id, resident_id, item_name, quantity, delivered_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [refugio_id, resident_id, item_name, quantity, req.user.id]
    );

    // Restar de inventario si existe
    await db.query(
      "UPDATE inventory SET quantity = GREATEST(0, quantity - $1), status = CASE WHEN GREATEST(0, quantity - $1) = 0 THEN 'Sin Stock' WHEN GREATEST(0, quantity - $1) <= min_threshold THEN 'Stock Crítico' ELSE 'Stock Suficiente' END WHERE refugio_id = $2 AND item_name = $3",
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
      `SELECT md.*, d.first_name, d.last_name, d.document_id, i.item_name as inventory_item_name, u.name as delivered_by_name
       FROM medication_deliveries md
       JOIN damnificados d ON md.resident_id = d.id
       LEFT JOIN inventory i ON md.inventory_item_id = i.id
       LEFT JOIN users u ON md.delivered_by = u.id
       ${where}
       ORDER BY md.delivered_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener entregas de medicamentos:', err);
    res.status(500).json({ error: 'Error al obtener historial de medicamentos.' });
  }
});

app.post('/api/refugios/:refugio_id/medication-deliveries', authenticateToken, async (req, res) => {
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

    const totalRequired = treatment ? parseFloat(treatment.totalQuantity) : NaN;
    if (Number.isFinite(totalRequired) && totalRequired > 0) {
      const deliveredParams = [parseInt(refugio_id), parseInt(resident_id), medication_name];
      let deliveredWhere = 'refugio_id = $1 AND resident_id = $2 AND medication_name = $3';
      if (Number.isInteger(medicationIndexValue)) {
        deliveredParams.push(medicationIndexValue);
        deliveredWhere += ` AND medication_index = $${deliveredParams.length}`;
      }
      const deliveredRes = await client.query(
        `SELECT COALESCE(SUM(quantity), 0)::numeric as delivered
         FROM medication_deliveries
         WHERE ${deliveredWhere}`,
        deliveredParams
      );
      const alreadyDelivered = parseFloat(deliveredRes.rows[0].delivered) || 0;
      if (alreadyDelivered + qty > totalRequired) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `La entrega supera lo indicado para este tratamiento. Indicado: ${totalRequired}, entregado: ${alreadyDelivered}, saldo: ${Math.max(totalRequired - alreadyDelivered, 0)}.`
        });
      }
    }

    const inventoryRes = await client.query(
      'SELECT id, item_name, quantity, min_threshold, unit FROM inventory WHERE id = $1 AND refugio_id = $2 FOR UPDATE',
      [parseInt(inventory_item_id), parseInt(refugio_id)]
    );
    if (inventoryRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Medicamento no encontrado en el inventario de salud.' });
    }

    const stock = parseFloat(inventoryRes.rows[0].quantity) || 0;
    if (stock < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${stock} ${inventoryRes.rows[0].unit || unit || 'unidades'}.` });
    }

    const result = await client.query(
      `INSERT INTO medication_deliveries
       (refugio_id, resident_id, inventory_item_id, medication_index, medication_name, dose, quantity, unit, delivery_frequency, notes, delivered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        parseInt(refugio_id),
        parseInt(resident_id),
        parseInt(inventory_item_id),
        Number.isInteger(medicationIndexValue) ? medicationIndexValue : null,
        medication_name,
        dose || treatment?.dose || null,
        qty,
        unit || inventoryRes.rows[0].unit || 'Dosis',
        delivery_frequency || treatment?.deliveryFrequency || 'Única',
        notes || null,
        req.user.id
      ]
    );

    await client.query(
      `UPDATE inventory
       SET quantity = quantity - $1,
           status = CASE
             WHEN quantity - $1 <= 0 THEN 'Sin Stock'
             WHEN quantity - $1 <= min_threshold THEN 'Stock Crítico'
             ELSE 'Stock Suficiente'
           END,
           updated_at = NOW()
       WHERE id = $2`,
      [qty, parseInt(inventory_item_id)]
    );

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
  const { day_of_week, meal_type, description, ingredients, diets_json } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO menus (refugio_id, day_of_week, meal_type, description, ingredients, diets_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (refugio_id, day_of_week, meal_type) DO UPDATE 
       SET description = EXCLUDED.description, ingredients = EXCLUDED.ingredients, diets_json = EXCLUDED.diets_json
       RETURNING *`,
      [refugio_id, day_of_week, meal_type, description, ingredients, diets_json || '{}']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar menú.' });
  }
});

app.delete('/api/refugios/:refugio_id/menus', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  const { day_of_week, meal_type } = req.query;
  try {
    await db.query(
      'DELETE FROM menus WHERE refugio_id = $1 AND day_of_week = $2 AND meal_type = $3',
      [parseInt(refugio_id), day_of_week, meal_type]
    );
    res.json({ message: 'Menú eliminado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar menú.' });
  }
});

app.get('/api/refugios/:refugio_id/meals/attendance', authenticateToken, async (req, res) => {
  const { refugio_id } = req.params;
  try {
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
      WHERE ma.refugio_id = $1 AND ma.meal_date = CURRENT_DATE
      ORDER BY ma.attended_at DESC
    `, [refugio_id]);
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
      error: 'Fuera del horario de servicio de comida. Horarios: Desayuno 06:00-11:00, Almuerzo 11:30-16:30, Cena 17:30-22:00.'
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

// --- RUTAS DE DONACIONES ---
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
  const { refugio_id, donor_name, donor_organization, donor_email, donor_phone, items, destination_warehouse } = req.body;
  
  if (!donor_name || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El nombre del donante y al menos un artículo son requeridos.' });
  }

  try {
    // 1. Insert details into donations table
    const result = await db.query(
      `INSERT INTO donations (refugio_id, donor_name, donor_organization, donor_email, donor_phone, items_json, destination_warehouse)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        refugio_id || null,
        donor_name,
        donor_organization || null,
        donor_email || null,
        donor_phone || null,
        JSON.stringify(items),
        destination_warehouse || 'Bodega Central'
      ]
    );

    // 2. If donation is assigned to a shelter, sync items to inventory
    if (refugio_id) {
      // Resolve deposito_id based on destination_warehouse name
      let deposito_id = null;
      if (destination_warehouse) {
        const depRes = await db.query(
          'SELECT id FROM depositos WHERE refugio_id = $1 AND LOWER(name) = LOWER($2)',
          [refugio_id, destination_warehouse.trim()]
        );
        if (depRes.rows.length > 0) {
          deposito_id = depRes.rows[0].id;
        } else {
          const createDep = await db.query(
            'INSERT INTO depositos (refugio_id, name, capacity_percent) VALUES ($1, $2, 0) RETURNING id',
            [refugio_id, destination_warehouse.trim()]
          );
          deposito_id = createDep.rows[0].id;
        }
      }

      for (const item of items) {
        const item_name = item.name;
        const category = item.category || 'Donación';
        const quantity = parseInt(item.quantity) || 0;
        const unit = item.unit || 'unidades';

        // Check if item exists in inventory for this refugio and depósito (case-insensitive name match)
        const checkItem = await db.query(
          `SELECT id, quantity, min_threshold FROM inventory 
           WHERE refugio_id = $1 AND LOWER(item_name) = LOWER($2) AND category = $3 
           AND (deposito_id = $4 OR (deposito_id IS NULL AND $4 IS NULL))`,
          [refugio_id, item_name, category, deposito_id]
        );

        if (checkItem.rows.length > 0) {
          const existing = checkItem.rows[0];
          const newQty = existing.quantity + quantity;
          const minVal = existing.min_threshold || 5;
          let status = 'Stock Suficiente';
          if (newQty <= 0) status = 'Sin Stock';
          else if (newQty < minVal) status = 'Stock Crítico';

          await db.query(
            'UPDATE inventory SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3',
            [newQty, status, existing.id]
          );
        } else {
          let status = 'Stock Suficiente';
          if (quantity <= 0) status = 'Sin Stock';
          else if (quantity < 5) status = 'Stock Crítico';

          await db.query(
            `INSERT INTO inventory (refugio_id, item_name, category, quantity, min_threshold, unit, status, deposito_id)
             VALUES ($1, $2, $3, $4, 5, $5, $6, $7)`,
            [refugio_id, item_name, category, quantity, unit, status, deposito_id]
          );
        }
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
