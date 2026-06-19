'use client';
// app/admin/_components/SearchInput.tsx
// Campo de búsqueda con ícono de lupa reutilizable en todas las listas del ERP.

import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput({ value, onChange, placeholder = 'Buscar...', className = '' }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
      />
    </div>
  );
}
