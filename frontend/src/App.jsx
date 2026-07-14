import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';

// Pages
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import Registration from './pages/Registration';
import BedsManagement from './pages/BedsManagement';
import Triage from './pages/Triage';
import MedicalAlerts from './pages/MedicalAlerts';
import InventarioSalud from './pages/InventarioSalud';
import MedicationDelivery from './pages/MedicationDelivery';
import MedicalReport from './pages/MedicalReport';
import Inventory from './pages/Inventory';
import WarehouseRequests from './pages/WarehouseRequests';
import LogisticsPanel from './pages/LogisticsPanel';
import LogisticsMenus from './pages/LogisticsMenus';
import LogisticsAttendance from './pages/LogisticsAttendance';
import InventarioCocina from './pages/InventarioCocina';
import Reports from './pages/Reports';
import Configuracion from './pages/Configuracion';
import Residents from './pages/Residents';
import Families from './pages/Families';
import ControlAcceso from './pages/ControlAcceso';
import Donaciones from './pages/Donaciones';
import Carnetizacion from './pages/Carnetizacion';
import CarnetizacionPersonal from './pages/CarnetizacionPersonal';
import PersonalList from './pages/PersonalList';
import ConsolidatedReports from './pages/ConsolidatedReports';

const hasAccess = (user, path, refugioId) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  // If user is tied to a specific refugio, block access to any other refugioId
  if (user.refugio_id && refugioId && parseInt(user.refugio_id) !== parseInt(refugioId)) {
    return false;
  }

  const role = user.role;
  if (role === 'supervisor') {
    // Supervisor only sees Sede list, reports and user management (config)
    return path.includes('/reportes') || path.includes('/configuracion') || path === '/sedes' || path === '/welcome';
  }
  if (role === 'gerente') {
    // Gerente can access all pages for their assigned refugio
    return true;
  }
  if (role === 'medico') {
    return path.includes('/medico/');
  }
  if (role === 'seguridad') {
    return path.includes('/control-acceso');
  }
  if (role === 'cocina') {
    return path.includes('/comedor/');
  }
  if (role === 'almacen') {
    return path.includes('/almacen/') || path.includes('/donaciones');
  }
  if (role === 'registro') {
    return path.includes('/registro') || path.includes('/residentes') || path.includes('/familias') || path.includes('/camas') || path.includes('/carnetizacion');
  }
  if (role === 'apoyo') {
    return path.includes('/residentes');
  }
  return false;
};

const getDefaultPath = (user, refugioId) => {
  if (!user) return '/sedes';
  const role = user.role;
  const rid = user.refugio_id || refugioId || '';
  
  if (role === 'admin') return rid ? `/refugio/${rid}/dashboard` : '/sedes';
  if (role === 'supervisor') return '/sedes';
  if (!rid) return '/sedes';

  if (role === 'gerente') return `/refugio/${rid}/dashboard`;
  if (role === 'medico') return `/refugio/${rid}/medico/triaje`;
  if (role === 'seguridad') return `/refugio/${rid}/control-acceso`;
  if (role === 'cocina') return `/refugio/${rid}/comedor/panel`;
  if (role === 'almacen') return `/refugio/${rid}/almacen/inventario`;
  if (role === 'registro') return `/refugio/${rid}/registro`;
  if (role === 'apoyo') return `/refugio/${rid}/residentes`;
  return '/sedes';
};

export default function App() {
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.venezuelarenacera.com/api';

  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Selected Sede (Context)
  const [selectedRefugio, setSelectedRefugio] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync token with localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUser();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    }
  };

  const fetchRefugioDetails = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/refugios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        const found = list.find(r => r.id === id);
        if (found) {
          setSelectedRefugio(found);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
      } else {
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setSelectedRefugio(null);
    localStorage.removeItem('token');
  };

  // If not authenticated, render Login Page (styled premium style)
  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant p-8 rounded-2xl shadow-lg flex flex-col gap-6">
          <div className="text-center flex flex-col gap-2">
            <img src="/logo-renacera.png" alt="Venezuela Renacerá Logo" className="h-28 object-contain mx-auto" />
            <p className="text-xs text-on-surface-variant font-medium mt-1">Sistema de Gestión y Coordinación Sanitaria de Campamentos Temporales</p>
          </div>

          {error && (
            <div className="bg-error-container/20 border border-error/25 text-error p-3 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant block mb-1">Correo Electrónico</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="usuario@mincoex.gob.ve"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface-variant block mb-1">Contraseña</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Ingrese su contraseña"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-[#0b2347] text-white font-bold rounded-lg text-xs hover:bg-[#0b2347]/95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
              <span className="material-symbols-outlined text-sm">login</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If token is present but user profile is not loaded yet, show loading spinner
  if (token && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
        <span className="text-xs font-bold text-on-surface-variant">Cargando perfil de usuario...</span>
      </div>
    );
  }

  // Helper component to bind Selected Refugio context dynamically
  const DashboardWrapper = () => {
    const { refugioId } = useParams();
    useEffect(() => {
      if (refugioId && (!selectedRefugio || selectedRefugio.id !== parseInt(refugioId))) {
        // Fetch specific refugio context
        fetch(`${API_BASE}/refugios`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          const matched = data.find(r => r.id === parseInt(refugioId));
          if (matched) setSelectedRefugio(matched);
        });
      }
    }, [refugioId]);
    return <Dashboard token={token} selectedRefugio={selectedRefugio} />;
  };

  const RegistrationWrapper = () => <Registration token={token} />;
  const BedsWrapper = () => <BedsManagement token={token} />;
  const TriageWrapper = () => <Triage token={token} />;
  const MedicalAlertsWrapper = () => <MedicalAlerts token={token} />;
  const InventarioSaludWrapper = () => <InventarioSalud token={token} />;
  const MedicationDeliveryWrapper = () => <MedicationDelivery token={token} />;
  const MedicalReportWrapper = () => <MedicalReport token={token} />;
  const InventoryWrapper = () => <Inventory token={token} />;
  const WarehouseRequestsWrapper = () => <WarehouseRequests token={token} />;
  const LogisticsPanelWrapper = () => <LogisticsPanel token={token} />;
  const LogisticsMenusWrapper = () => <LogisticsMenus token={token} />;
  const LogisticsAttendanceWrapper = () => <LogisticsAttendance token={token} />;
  const InventarioCocinaWrapper = () => <InventarioCocina token={token} user={user} />;
  const ReportsWrapper = () => <Reports token={token} />;
  const ConfiguracionWrapper = () => <Configuracion token={token} user={user} />;
  const ResidentsWrapper = () => <Residents token={token} />;
  const FamiliesWrapper = () => <Families token={token} />;
  const CarnetizacionWrapper = () => <Carnetizacion token={token} selectedRefugio={selectedRefugio} />;
  const CarnetizacionPersonalWrapper = () => <CarnetizacionPersonal token={token} selectedRefugio={selectedRefugio} />;
  const PersonalListWrapper = () => <PersonalList token={token} />;
  const ControlAccesoWrapper = () => <ControlAcceso token={token} selectedRefugio={selectedRefugio} />;
  const DonacionesWrapper = () => <Donaciones token={token} selectedRefugio={selectedRefugio} />;
  const ConsolidatedReportsWrapper = () => <ConsolidatedReports token={token} />;

  const ProtectedRoute = ({ element, path }) => {
    const { refugioId } = useParams();

    useEffect(() => {
      if (refugioId && token) {
        const rid = parseInt(refugioId);
        if (!selectedRefugio || selectedRefugio.id !== rid) {
          fetchRefugioDetails(rid);
        }
      }
    }, [refugioId, token]);

    if (!user) return <div className="min-h-screen bg-background flex items-center justify-center text-xs font-bold text-on-surface-variant">Cargando perfil...</div>;

    if (!hasAccess(user, path, refugioId)) {
      const defaultHome = getDefaultPath(user, refugioId);
      return <Navigate to={defaultHome} replace />;
    }
    return element;
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-on-surface flex flex-col">
        <Header user={user} selectedRefugio={selectedRefugio} onMenuClick={() => setMobileMenuOpen(true)} />
        
        <div className="flex-1 flex pt-20">
          <Sidebar
            user={user}
            selectedRefugio={selectedRefugio}
            onLogout={handleLogout}
            mobileOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
          
          <main className="flex-1 lg:ml-[280px] p-4 md:p-6 overflow-y-auto min-w-0">
            <Routes>
              {/* Sede Selection Landing */}
              <Route 
                path="/sedes" 
                element={<ProtectedRoute element={<Welcome token={token} user={user} onSelectRefugio={setSelectedRefugio} />} path="/sedes" />} 
              />
              
              {/* Detailed Sede views */}
              <Route path="/refugio/:refugioId/dashboard" element={<ProtectedRoute element={<DashboardWrapper />} path="/refugio/:refugioId/dashboard" />} />
              <Route path="/refugio/:refugioId/registro" element={<ProtectedRoute element={<RegistrationWrapper />} path="/refugio/:refugioId/registro" />} />
              <Route path="/refugio/:refugioId/camas" element={<ProtectedRoute element={<BedsWrapper />} path="/refugio/:refugioId/camas" />} />
              <Route path="/refugio/:refugioId/medico/triaje" element={<ProtectedRoute element={<TriageWrapper />} path="/refugio/:refugioId/medico/triaje" />} />
              <Route path="/refugio/:refugioId/medico/insumos" element={<ProtectedRoute element={<MedicalAlertsWrapper />} path="/refugio/:refugioId/medico/insumos" />} />
              <Route path="/refugio/:refugioId/medico/inventario" element={<ProtectedRoute element={<InventarioSaludWrapper />} path="/refugio/:refugioId/medico/inventario" />} />
              <Route path="/refugio/:refugioId/medico/entrega-medicamentos" element={<ProtectedRoute element={<MedicationDeliveryWrapper />} path="/refugio/:refugioId/medico/entrega-medicamentos" />} />
              <Route path="/refugio/:refugioId/medico/reporte" element={<ProtectedRoute element={<MedicalReportWrapper />} path="/refugio/:refugioId/medico/reporte" />} />
              
              <Route path="/refugio/:refugioId/triaje" element={<Navigate to={selectedRefugio ? `/refugio/${selectedRefugio.id}/medico/triaje` : '/sedes'} replace />} />
              
              <Route path="/refugio/:refugioId/almacen/inventario" element={<ProtectedRoute element={<Inventory token={token} tab="stock" />} path="/refugio/:refugioId/almacen/inventario" />} />
              <Route path="/refugio/:refugioId/almacen/entrega" element={<ProtectedRoute element={<Inventory token={token} tab="deliver" />} path="/refugio/:refugioId/almacen/entrega" />} />
              <Route path="/refugio/:refugioId/almacen/historial" element={<ProtectedRoute element={<Inventory token={token} tab="history" />} path="/refugio/:refugioId/almacen/historial" />} />
              <Route path="/refugio/:refugioId/almacen/solicitudes" element={<ProtectedRoute element={<WarehouseRequestsWrapper />} path="/refugio/:refugioId/almacen/solicitudes" />} />
              
              <Route path="/refugio/:refugioId/inventario" element={<Navigate to={selectedRefugio ? `/refugio/${selectedRefugio.id}/almacen/inventario` : '/sedes'} replace />} />
              
              <Route path="/refugio/:refugioId/comedor/panel" element={<ProtectedRoute element={<LogisticsPanelWrapper />} path="/refugio/:refugioId/comedor/panel" />} />
              <Route path="/refugio/:refugioId/comedor/menus" element={<ProtectedRoute element={<LogisticsMenusWrapper />} path="/refugio/:refugioId/comedor/menus" />} />
              <Route path="/refugio/:refugioId/comedor/asistencia" element={<ProtectedRoute element={<LogisticsAttendanceWrapper />} path="/refugio/:refugioId/comedor/asistencia" />} />
              <Route path="/refugio/:refugioId/comedor/inventario" element={<ProtectedRoute element={<InventarioCocinaWrapper />} path="/refugio/:refugioId/comedor/inventario" />} />
              
              <Route path="/refugio/:refugioId/logistica" element={<Navigate to={selectedRefugio ? `/refugio/${selectedRefugio.id}/comedor/panel` : '/sedes'} replace />} />
              
              <Route path="/refugio/:refugioId/reportes" element={<ProtectedRoute element={<ReportsWrapper />} path="/refugio/:refugioId/reportes" />} />
              <Route path="/refugio/:refugioId/configuracion" element={<ProtectedRoute element={<ConfiguracionWrapper />} path="/refugio/:refugioId/configuracion" />} />
              <Route path="/refugio/:refugioId/residentes" element={<ProtectedRoute element={<ResidentsWrapper />} path="/refugio/:refugioId/residentes" />} />
              <Route path="/refugio/:refugioId/familias" element={<ProtectedRoute element={<FamiliesWrapper />} path="/refugio/:refugioId/familias" />} />
              <Route path="/refugio/:refugioId/carnetizacion" element={<ProtectedRoute element={<CarnetizacionWrapper />} path="/refugio/:refugioId/carnetizacion" />} />
              <Route path="/refugio/:refugioId/carnetizacion/residentes" element={<ProtectedRoute element={<CarnetizacionWrapper />} path="/refugio/:refugioId/carnetizacion/residentes" />} />
              <Route path="/refugio/:refugioId/carnetizacion/personal" element={<ProtectedRoute element={<CarnetizacionPersonalWrapper />} path="/refugio/:refugioId/carnetizacion/personal" />} />
              <Route path="/refugio/:refugioId/carnetizacion/personal/listado" element={<ProtectedRoute element={<PersonalListWrapper />} path="/refugio/:refugioId/carnetizacion/personal/listado" />} />
              <Route path="/refugio/:refugioId/control-acceso" element={<ProtectedRoute element={<ControlAccesoWrapper />} path="/refugio/:refugioId/control-acceso" />} />
              <Route path="/refugio/:refugioId/donaciones" element={<ProtectedRoute element={<DonacionesWrapper />} path="/refugio/:refugioId/donaciones" />} />
              <Route path="/reportes-consolidados" element={<ProtectedRoute element={<ConsolidatedReportsWrapper />} path="/reportes-consolidados" />} />
              
              {/* Fallback routes */}
              <Route path="*" element={<Navigate to="/sedes" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
