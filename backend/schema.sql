-- Esquema base de base de datos para Refugios 4.0

-- Tabla de Refugios
CREATE TABLE IF NOT EXISTS refugios (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    location TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    contact_phone VARCHAR(20),
    status VARCHAR(50) DEFAULT 'Operativo', -- 'Operativo', 'Alerta Suministros', 'Inactivo'
    image_url TEXT,
    estado VARCHAR(100),
    staff_config TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'volunteer', -- 'admin', 'coordinator', 'volunteer'
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Grupos Familiares
CREATE TABLE IF NOT EXISTS family_groups (
    id SERIAL PRIMARY KEY,
    family_name VARCHAR(100) NOT NULL,
    block_assignment VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Damnificados (Residentes)
CREATE TABLE IF NOT EXISTS damnificados (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(20) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    gender VARCHAR(20),
    health_status VARCHAR(100) DEFAULT 'Estable', -- 'Estable', 'Bajo Observación', 'Crítico'
    special_needs TEXT,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE SET NULL,
    family_group_id INTEGER REFERENCES family_groups(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'Activo', -- 'Activo', 'Trasladado', 'Egreso'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Camas
CREATE TABLE IF NOT EXISTS beds (
    id SERIAL PRIMARY KEY,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    bed_number VARCHAR(50) NOT NULL,
    resident_id INTEGER REFERENCES damnificados(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'Disponible', -- 'Disponible', 'Ocupada', 'Mantenimiento'
    CONSTRAINT unique_bed_per_refugio UNIQUE (refugio_id, room_number, bed_number)
);

-- Tabla de Inventario de Insumos
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Alimentos', 'Medicinas', 'Higiene', 'Camas/Colchones', 'Ropa'
    quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 5,
    unit VARCHAR(20) DEFAULT 'unidades',
    status VARCHAR(50) DEFAULT 'Stock Suficiente', -- 'Stock Suficiente', 'Stock Crítico', 'Sin Stock'
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Entrega de Insumos
CREATE TABLE IF NOT EXISTS supply_deliveries (
    id SERIAL PRIMARY KEY,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    resident_id INTEGER REFERENCES damnificados(id) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    delivered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    delivered_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Planificación de Menús
CREATE TABLE IF NOT EXISTS menus (
    id SERIAL PRIMARY KEY,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL, -- 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
    meal_type VARCHAR(20) NOT NULL, -- 'Desayuno', 'Almuerzo', 'Cena'
    description TEXT NOT NULL,
    ingredients TEXT,
    CONSTRAINT unique_menu_per_day_meal UNIQUE (refugio_id, day_of_week, meal_type)
);

-- Tabla de Asistencia a Comedor
CREATE TABLE IF NOT EXISTS meal_attendance (
    id SERIAL PRIMARY KEY,
    resident_id INTEGER REFERENCES damnificados(id) ON DELETE CASCADE,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    meal_date DATE DEFAULT CURRENT_DATE,
    meal_type VARCHAR(20) NOT NULL, -- 'Desayuno', 'Almuerzo', 'Cena'
    attended_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_attendance_per_meal_day UNIQUE (resident_id, meal_date, meal_type)
);

-- Tabla de Registro de Donaciones
DROP TABLE IF EXISTS donations CASCADE;
CREATE TABLE donations (
    id SERIAL PRIMARY KEY,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE SET NULL,
    donor_name VARCHAR(100) NOT NULL,
    donor_organization VARCHAR(100),
    donor_email VARCHAR(100),
    donor_phone VARCHAR(50),
    items_json TEXT NOT NULL,
    destination_warehouse VARCHAR(100) DEFAULT 'Bodega Central',
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Bitácora de Acceso (Entradas/Salidas)
CREATE TABLE IF NOT EXISTS access_logs (
    id SERIAL PRIMARY KEY,
    resident_id INTEGER REFERENCES damnificados(id) ON DELETE CASCADE,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL, -- 'entrada', 'salida'
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Depósitos de Destino (Almacenes)
CREATE TABLE IF NOT EXISTS depositos (
    id SERIAL PRIMARY KEY,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    capacity_percent INTEGER DEFAULT 0,
    CONSTRAINT unique_deposito_name_per_refugio UNIQUE (refugio_id, name)
);

-- Tabla de Solicitudes al Almacén
CREATE TABLE IF NOT EXISTS warehouse_requests (
    id SERIAL PRIMARY KEY,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    area VARCHAR(100) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'Unidades',
    details TEXT,
    status VARCHAR(30) DEFAULT 'Pendiente',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Reporte de Incidencias de Seguridad
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    refugio_id INTEGER REFERENCES refugios(id) ON DELETE CASCADE,
    resident_id INTEGER REFERENCES damnificados(id) ON DELETE SET NULL,
    reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    incident_type VARCHAR(50) DEFAULT 'Novedad', -- 'Novedad', 'Altercado', 'Emergencia'
    description TEXT NOT NULL,
    action_taken TEXT,
    involved_residents TEXT DEFAULT '[]',
    logged_at TIMESTAMP DEFAULT NOW()
);
