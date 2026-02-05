import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FilterState, DEFAULT_FILTERS } from '../types';

interface FilterContextValue {
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS);

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilters =
    filters.costCenters.length > 0 ||
    filters.areas.length > 0 ||
    filters.workCenters.length > 0 ||
    filters.shifts.length > 0 ||
    filters.statuses.length > 0 ||
    filters.startDate !== null ||
    filters.endDate !== null ||
    filters.hourStart !== null ||
    filters.hourEnd !== null;

  const activeFilterCount =
    filters.costCenters.length +
    filters.areas.length +
    filters.workCenters.length +
    filters.shifts.length +
    filters.statuses.length +
    (filters.startDate ? 1 : 0) +
    (filters.hourStart != null ? 1 : 0);

  return (
    <FilterContext.Provider
      value={{ filters, setFilters, resetFilters, hasActiveFilters, activeFilterCount }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
