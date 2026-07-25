'use client';

import React from 'react';

interface CompanySwitcherProps {
  empresaId: string | null;
  switchableCompanies: { id: string; nombre: string }[];
  isSwitching: boolean;
  onSwitchCompany: (newEmpresaId: string) => void;
}

export default function CompanySwitcher({
  empresaId,
  switchableCompanies,
  isSwitching,
  onSwitchCompany,
}: CompanySwitcherProps) {
  if (switchableCompanies.length <= 1) {
    return (
      <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0.2 rounded font-semibold uppercase tracking-wide block w-fit mt-0.5">
        Staff
      </span>
    );
  }

  return (
    <div className="mt-0.5 relative">
      <select
        disabled={isSwitching}
        value={empresaId || ''}
        onChange={(e) => onSwitchCompany(e.target.value)}
        className="w-full text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded font-semibold uppercase tracking-wide border-none outline-none cursor-pointer focus:ring-1 focus:ring-amber-500/50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23b45309%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:6px_6px] bg-[right_4px_center] bg-no-repeat pr-4"
      >
        {switchableCompanies.map((c) => (
          <option
            key={c.id}
            value={c.id}
            className="text-gray-900 bg-white dark:bg-gray-950 dark:text-white text-xs"
          >
            {c.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
