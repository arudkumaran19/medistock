import React, { type ReactNode } from "react";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterPanelProps {
  title?: string;
  children?: ReactNode;
  onReset?: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  title = "Filters",
  children,
  onReset,
}) => {
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
};

export default FilterPanel;
