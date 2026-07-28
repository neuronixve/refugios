import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header({ user, selectedRefugio, onMenuClick }) {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-container-margin-desktop bg-white border-b border-outline-variant h-20">
      {/* Identidad institucional de SAREN */}
      <div className="flex items-center gap-3">
        {user && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden w-10 h-10 rounded-xl border border-outline-variant bg-surface-container-low text-[#0b2347] flex items-center justify-center shadow-sm"
            aria-label="Abrir menú"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/welcome')}>
          <img
            src="/banner-saren.png"
            alt="Vicepresidencia de la República Bolivariana de Venezuela — Servicio Autónomo de Registros y Notarías"
            className="w-36 sm:w-52 md:w-56 xl:w-80 h-auto object-contain"
          />
        </div>
      </div>

      {/* Global Search (Active only when inside a specific Sede) */}
      <div className="flex-1 max-w-md mx-8 hidden md:block">
        {selectedRefugio && (
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input 
              className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2 pl-10 pr-4 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
              placeholder={`Buscar en ${selectedRefugio.name}...`}
              type="text" 
            />
          </div>
        )}
      </div>

      {/* Logo de SAREN, información del usuario y acciones */}
      <div className="flex items-center gap-4">
        <img src="/logo-saren.png" alt="Logo de SAREN" className="hidden md:block w-28 lg:w-36 xl:w-40 h-auto object-contain mr-2" />
        {user && (
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-body-sm font-bold text-on-surface">{user.name}</span>
            <span className="text-xs text-on-surface-variant capitalize">{user.role}</span>
          </div>
        )}
        <button className="hidden sm:block p-2 text-on-secondary-container hover:bg-surface-container transition-colors rounded-full relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant bg-primary-container flex items-center justify-center text-primary font-bold text-sm">
          {user ? user.name.substring(0, 2).toUpperCase() : 'US'}
        </div>
      </div>
    </header>
  );
}
