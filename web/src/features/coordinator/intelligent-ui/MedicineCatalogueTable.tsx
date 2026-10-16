import React, { useState, useMemo } from "react";
import { Search, Filter, Pill, ChevronDown, ChevronUp, ArrowUpRight } from "lucide-react";

export interface CatalogueItem {
  name: string;
  category?: string;
  total_stock: number;
  min_stock?: number;
  status?: string;
  unit?: string;
  facilities_count?: number;
}

interface MedicineCatalogueTableProps {
  items: CatalogueItem[];
  onSelectMedicine?: (medicineName: string) => void;
  className?: string;
}

export function MedicineCatalogueTable({
  items,
  onSelectMedicine,
  className = "",
}: MedicineCatalogueTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortField, setSortField] = useState<"name" | "total_stock">("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Derive unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return ["all", ...Array.from(set)];
  }, [items]);

  // Filter & sort
  const filtered = useMemo(() => {
    return items
      .filter((it) => {
        const matchesSearch =
          it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (it.category && it.category.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory =
          selectedCategory === "all" || it.category?.toLowerCase() === selectedCategory.toLowerCase();
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortField === "name") {
          return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        } else {
          return sortAsc ? a.total_stock - b.total_stock : b.total_stock - a.total_stock;
        }
      });
  }, [items, searchTerm, selectedCategory, sortField, sortAsc]);

  const toggleSort = (field: "name" | "total_stock") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div
      className={`my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs ${className}`}
    >
      {/* Search and Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 p-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search medicines..."
            className="w-full rounded-md border border-slate-200 bg-white py-1 pl-8 pr-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <Filter size={11} className="text-slate-400 mr-0.5" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-2 py-0.5 font-medium transition-colors capitalize ${
                selectedCategory === cat
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table Data */}
      <div className="max-h-72 overflow-y-auto">
        <table className="min-w-full divide-y divide-slate-100 text-xs">
          <thead className="sticky top-0 bg-slate-50 z-10 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
            <tr>
              <th
                scope="col"
                onClick={() => toggleSort("name")}
                className="cursor-pointer py-2 px-3 text-left hover:text-slate-900 select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Medicine</span>
                  {sortField === "name" &&
                    (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </div>
              </th>
              <th scope="col" className="py-2 px-3 text-left">
                Category
              </th>
              <th
                scope="col"
                onClick={() => toggleSort("total_stock")}
                className="cursor-pointer py-2 px-3 text-right hover:text-slate-900 select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Total Stock</span>
                  {sortField === "total_stock" &&
                    (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </div>
              </th>
              <th scope="col" className="py-2 px-3 text-center">
                Status
              </th>
              {onSelectMedicine && (
                <th scope="col" className="py-2 px-3 text-right">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={onSelectMedicine ? 5 : 4}
                  className="py-6 text-center text-xs text-slate-400"
                >
                  No medicines match the criteria.
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => {
                const stock = item.total_stock;
                const min = item.min_stock ?? 50;
                const isCritical = stock < min;
                const isLow = stock >= min && stock < min * 1.5;

                const statusBadge = isCritical ? (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    Deficit
                  </span>
                ) : isLow ? (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Low
                  </span>
                ) : (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Adequate
                  </span>
                );

                return (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Pill size={12} className="text-teal-600 flex-shrink-0" />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {item.category || "General"}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-800">
                      {stock.toLocaleString()} units
                    </td>
                    <td className="py-2 px-3 text-center">{statusBadge}</td>
                    {onSelectMedicine && (
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectMedicine(item.name)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-900 transition-colors"
                          title={`Query stock details for ${item.name}`}
                        >
                          <span>Inspect</span>
                          <ArrowUpRight size={11} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">
        <span>
          Showing <strong>{filtered.length}</strong> of <strong>{items.length}</strong> medicines
        </span>
        <span className="text-[10px] text-slate-400">
          Click column headers to sort
        </span>
      </div>
    </div>
  );
}
