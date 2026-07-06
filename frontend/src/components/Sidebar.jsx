import React, { useState, useEffect } from 'react';
import { NavLink, useParams, useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ user, selectedRefugio, onLogout, mobileOpen = false, onMobileClose = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { refugioId } = useParams();

  const [comedorExpanded, setComedorExpanded] = useState(false);
  const [medicoExpanded, setMedicoExpanded] = useState(false);
  const [almacenExpanded, setAlmacenExpanded] = useState(false);
  const [carnetizacionExpanded, setCarnetizacionExpanded] = useState(false);

  const activeClass = "flex items-center gap-3 px-4 py-2.5 bg-primary-container text-on-primary-container font-bold rounded-lg transition-all scale-95 duration-100 text-xs";
  const inactiveClass = "flex items-center gap-3 px-4 py-2.5 text-on-surface-variant hover:bg-secondary-container rounded-lg transition-all text-xs cursor-pointer";
  const subActiveClass = "flex items-center gap-3 pl-8 pr-4 py-2 bg-primary/10 text-primary font-bold rounded-lg transition-all text-[11px]";
  const subInactiveClass = "flex items-center gap-3 pl-8 pr-4 py-2 text-on-surface-variant hover:bg-secondary-container/50 rounded-lg transition-all text-[11px] cursor-pointer";

  // Auto-expand menu if viewing a sub-route on mount or path change
  useEffect(() => {
    if (location.pathname.includes('/comedor/')) {
      setComedorExpanded(true);
    }
    if (location.pathname.includes('/medico/')) {
      setMedicoExpanded(true);
    }
    if (location.pathname.includes('/almacen/')) {
      setAlmacenExpanded(true);
    }
    if (location.pathname.includes('/carnetizacion')) {
      setCarnetizacionExpanded(true);
    }
    onMobileClose();
  }, [location.pathname]);

  return (
    <>
    {mobileOpen && (
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={onMobileClose}
        className="lg:hidden fixed inset-0 z-[55] bg-black/45 backdrop-blur-[1px]"
      />
    )}

    <aside className={`flex flex-col fixed left-0 top-0 lg:top-20 h-screen lg:h-[calc(100vh-80px)] w-[300px] max-w-[86vw] lg:w-[280px] lg:max-w-none p-gutter bg-surface border-r border-outline-variant z-[60] lg:z-40 shadow-2xl lg:shadow-none transition-transform duration-200 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      {/* Brand & Sede Context */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="px-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-black text-primary uppercase tracking-wider">Venezuela Renacerá</h2>
            <button
              type="button"
              onClick={onMobileClose}
              className="lg:hidden w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container flex items-center justify-center"
              aria-label="Cerrar menú"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          {selectedRefugio ? (
            <div className="mt-2 bg-primary-container/20 border border-primary/20 rounded-lg p-3">
              <span className="text-[10px] font-semibold text-primary block">Sede Activa:</span>
              <span className="text-xs font-bold text-on-surface block truncate">{selectedRefugio.name}</span>
              <span className="text-[10px] text-on-surface-variant block mt-1">{selectedRefugio.location}</span>
            </div>
          ) : (
            <span className="text-xs text-on-surface-variant block">Selección de Sede</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
        {selectedRefugio ? (
          <>
            {(user.role === 'admin' || user.role === 'gerente') && (
              <NavLink to={`/refugio/${selectedRefugio.id}/dashboard`} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">dashboard</span>
                <span className="text-label-md">Panel de Control</span>
              </NavLink>
            )}
            
            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'registro') && (
              <NavLink to={`/refugio/${selectedRefugio.id}/registro`} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">person_add</span>
                <span className="text-label-md">Recepción y Registro</span>
              </NavLink>
            )}

            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'registro' || user.role === 'apoyo') && (
              <NavLink to={`/refugio/${selectedRefugio.id}/residentes`} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">groups</span>
                <span className="text-label-md">Residentes</span>
              </NavLink>
            )}

            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'registro') && (
              <NavLink to={`/refugio/${selectedRefugio.id}/camas`} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">single_bed</span>
                <span className="text-label-md">Mapa de Camas</span>
              </NavLink>
            )}

            {/* Collapsible Medical Module Header */}
            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'medico') && (
              <div>
                <button 
                  onClick={() => setMedicoExpanded(!medicoExpanded)}
                  className={`w-full ${location.pathname.includes('/medico/') ? 'bg-primary-container/30 text-primary font-bold' : 'text-on-surface-variant'} flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-secondary-container/60 transition-all text-xs cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm">medical_services</span>
                    <span>Módulo Médico</span>
                  </div>
                  <span className="material-symbols-outlined text-xs">
                    {medicoExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {/* Submenu Links */}
                {medicoExpanded && (
                  <div className="flex flex-col gap-0.5 mt-1 ml-2 pl-2 border-l border-outline-variant/60 animate-in fade-in slide-in-from-top-1 duration-150">
                    <NavLink to={`/refugio/${selectedRefugio.id}/medico/triaje`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">medical_information</span>
                      <span>Historial de Residentes</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/medico/insumos`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">vaccines</span>
                      <span>Alertas de Insumos</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/medico/inventario`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">inventory_2</span>
                      <span>Inventario de Salud</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/medico/entrega-medicamentos`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">medication_liquid</span>
                      <span>Entrega de Medicamentos</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/medico/reporte`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">assignment</span>
                      <span>Reporte de Salud</span>
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'registro') && (
              <div>
                <button 
                  onClick={() => setCarnetizacionExpanded(!carnetizacionExpanded)}
                  className={`w-full ${location.pathname.includes('/carnetizacion') ? 'bg-primary-container/30 text-primary font-bold' : 'text-on-surface-variant'} flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-secondary-container/60 transition-all text-xs cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm">badge</span>
                    <span>Carnetización</span>
                  </div>
                  <span className="material-symbols-outlined text-xs">
                    {carnetizacionExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {carnetizacionExpanded && (
                  <div className="flex flex-col gap-0.5 mt-1 ml-2 pl-2 border-l border-outline-variant/60 animate-in fade-in slide-in-from-top-1 duration-150">
                    <NavLink to={`/refugio/${selectedRefugio.id}/carnetizacion/residentes`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">groups</span>
                      <span>Residentes</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/carnetizacion/personal`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">assignment_ind</span>
                      <span>Personal de Apoyo</span>
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'seguridad') && (
              <NavLink to={`/refugio/${selectedRefugio.id}/control-acceso`} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                <span className="text-label-md">Control de Acceso</span>
              </NavLink>
            )}

            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'almacen') && (
              <NavLink to={`/refugio/${selectedRefugio.id}/donaciones`} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">volunteer_activism</span>
                <span className="text-label-md">Donaciones</span>
              </NavLink>
            )}

            {/* Collapsible Almacén Header */}
            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'almacen') && (
              <div>
                <button 
                  onClick={() => setAlmacenExpanded(!almacenExpanded)}
                  className={`w-full ${location.pathname.includes('/almacen/') ? 'bg-primary-container/30 text-primary font-bold' : 'text-on-surface-variant'} flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-secondary-container/60 transition-all text-xs cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm">warehouse</span>
                    <span>Almacén</span>
                  </div>
                  <span className="material-symbols-outlined text-xs">
                    {almacenExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {/* Submenu Links */}
                {almacenExpanded && (
                  <div className="flex flex-col gap-0.5 mt-1 ml-2 pl-2 border-l border-outline-variant/60 animate-in fade-in slide-in-from-top-1 duration-150">
                    <NavLink to={`/refugio/${selectedRefugio.id}/almacen/inventario`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">inventory</span>
                      <span>Inventario</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/almacen/entrega`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">local_shipping</span>
                      <span>Entrega de Insumos</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/almacen/historial`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">history</span>
                      <span>Historial de Entregas</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/almacen/solicitudes`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">assignment_late</span>
                      <span>Solicitudes</span>
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Dining & Logistics Header */}
            {(user.role === 'admin' || user.role === 'gerente' || user.role === 'cocina') && (
              <div>
                <button 
                  onClick={() => setComedorExpanded(!comedorExpanded)}
                  className={`w-full ${location.pathname.includes('/comedor/') ? 'bg-primary-container/30 text-primary font-bold' : 'text-on-surface-variant'} flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-secondary-container/60 transition-all text-xs cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm">restaurant</span>
                    <span>Comedor y Logística</span>
                  </div>
                  <span className="material-symbols-outlined text-xs">
                    {comedorExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {/* Submenu Links */}
                {comedorExpanded && (
                  <div className="flex flex-col gap-0.5 mt-1 ml-2 pl-2 border-l border-outline-variant/60 animate-in fade-in slide-in-from-top-1 duration-150">
                    <NavLink to={`/refugio/${selectedRefugio.id}/comedor/panel`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">monitoring</span>
                      <span>Panel Operativo</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/comedor/menus`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">menu_book</span>
                      <span>Planificación de Menús</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/comedor/asistencia`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">qr_code_scanner</span>
                      <span>Asistencia de Comedor</span>
                    </NavLink>
                    <NavLink to={`/refugio/${selectedRefugio.id}/comedor/inventario`} className={({ isActive }) => isActive ? subActiveClass : subInactiveClass}>
                      <span className="material-symbols-outlined text-xs">kitchen</span>
                      <span>Inventario de Cocina</span>
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {(user.role === 'admin' || user.role === 'supervisor' || user.role === 'gerente') && (
              <NavLink to={`/refugio/${selectedRefugio.id}/reportes`} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">analytics</span>
                <span className="text-label-md">Reportes</span>
              </NavLink>
            )}

            {(user.role === 'admin' || user.role === 'supervisor') && (
              <NavLink to="/reportes-consolidados" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">public</span>
                <span className="text-label-md">Reporte Consolidado</span>
              </NavLink>
            )}
          </>
        ) : (
          <>
            <NavLink to="/sedes" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
              <span className="material-symbols-outlined text-sm">home</span>
              <span className="text-label-md">Selección de Sede</span>
            </NavLink>
            {(user.role === 'admin' || user.role === 'supervisor') && (
              <NavLink to="/reportes-consolidados" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">public</span>
                <span className="text-label-md">Reporte Consolidado</span>
              </NavLink>
            )}
          </>
        )}
      </nav>

      {/* Footer / Actions */}
      <div className="mt-auto border-t border-outline-variant pt-3 flex flex-col gap-1">
        {selectedRefugio && (
          <>
            {(user.role === 'admin' || user.role === 'supervisor' || user.role === 'gerente') && (
              <NavLink to={`/refugio/${selectedRefugio.id}/configuracion`} className={({ isActive }) => isActive ? activeClass : inactiveClass}>
                <span className="material-symbols-outlined text-sm">settings</span>
                <span className="text-label-md">Configuración</span>
              </NavLink>
            )}
            {(user.role === 'admin' || user.role === 'supervisor') && !user.refugio_id && (
              <button 
                onClick={() => navigate('/sedes')}
                className="flex items-center gap-3 px-4 py-2.5 text-primary hover:bg-primary/10 rounded-lg transition-all text-left w-full font-semibold text-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                <span className="text-label-md">Cambiar Sede</span>
              </button>
            )}
          </>
        )}
        <button 
          onClick={() => {
            onMobileClose();
            onLogout();
          }}
          className="flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error-container/20 rounded-lg transition-all text-left w-full font-semibold text-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span className="text-label-md">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
    </>
  );
}
