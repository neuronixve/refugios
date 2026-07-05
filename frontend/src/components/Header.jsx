import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header({ user, selectedRefugio }) {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-container-margin-desktop bg-white border-b border-outline-variant h-20">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/welcome')}>
        <img src="/logo-ministerio.png" alt="Logo Ministerio" className="h-16 object-contain" />
        <span className="text-headline-md font-bold text-primary dark:text-primary-fixed-dim">Refugios 4.0</span>
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

      {/* User Info & Actions */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-body-sm font-bold text-on-surface">{user.name}</span>
            <span className="text-xs text-on-surface-variant capitalize">{user.role}</span>
          </div>
        )}
        <button className="p-2 text-on-secondary-container hover:bg-surface-container transition-colors rounded-full relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant bg-primary-container flex items-center justify-center text-primary font-bold">
          {user ? user.name.substring(0, 2).toUpperCase() : 'US'}
        </div>
      </div>
    </header>
  );
}
