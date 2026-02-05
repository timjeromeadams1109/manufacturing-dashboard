import React, { useState, useEffect } from 'react';
import { XMarkIcon, FunnelIcon, CalendarIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useFilters } from '../../hooks/useFilters';
import { mappingsApi } from '../../services/api';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="filter-chip">
      {label}
      <button
        type="button"
        className="filter-chip-remove"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
      >
        <XMarkIcon className="w-3 h-3" />
      </button>
    </span>
  );
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last14', label: 'Last 14 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'wtd', label: 'Week to Date' },
  { value: 'mtd', label: 'Month to Date' },
  { value: 'custom', label: 'Custom Range' },
];

export function FilterBar() {
  const { filters, setFilters, resetFilters, hasActiveFilters, activeFilterCount } = useFilters();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);

  useEffect(() => {
    // Load filter options
    mappingsApi.getAreas().then((res) => setAreas(res.data)).catch(console.error);
    mappingsApi.getShifts().then((res) => setShifts(res.data)).catch(console.error);
  }, []);

  const handlePeriodChange = (period: string) => {
    if (period === 'custom') {
      setFilters({ period, startDate: null, endDate: null });
    } else {
      setFilters({ period, startDate: null, endDate: null });
    }
  };

  const handleAreaToggle = (area: string) => {
    const newAreas = filters.areas.includes(area)
      ? filters.areas.filter((a) => a !== area)
      : [...filters.areas, area];
    setFilters({ areas: newAreas });
  };

  const handleShiftToggle = (shift: string) => {
    const newShifts = filters.shifts.includes(shift)
      ? filters.shifts.filter((s) => s !== shift)
      : [...filters.shifts, shift];
    setFilters({ shifts: newShifts });
  };

  return (
    <div className="filter-bar">
      <div className="px-4 py-3">
        {/* Main filter row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-400" />
            <select
              value={filters.period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-sst-orange-500 focus:border-sst-orange-500"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom date range */}
          {filters.period === 'custom' && (
            <>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ startDate: e.target.value })}
                className="text-sm border-gray-300 rounded-md focus:ring-sst-orange-500 focus:border-sst-orange-500"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ endDate: e.target.value })}
                className="text-sm border-gray-300 rounded-md focus:ring-sst-orange-500 focus:border-sst-orange-500"
              />
            </>
          )}

          {/* Advanced filters toggle */}
          <button
            type="button"
            className={clsx(
              'btn-ghost text-sm flex items-center gap-1.5',
              showAdvanced && 'bg-gray-100'
            )}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <FunnelIcon className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-sst-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Reset button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="text-sm text-sst-orange-600 hover:text-sst-orange-700 font-medium"
              onClick={resetFilters}
            >
              Reset All
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Applied:</span>
            {filters.areas.map((area) => (
              <FilterChip
                key={area}
                label={`Area: ${area}`}
                onRemove={() => handleAreaToggle(area)}
              />
            ))}
            {filters.shifts.map((shift) => (
              <FilterChip
                key={shift}
                label={`Shift: ${shift}`}
                onRemove={() => handleShiftToggle(shift)}
              />
            ))}
            {filters.costCenters.map((cc) => (
              <FilterChip
                key={cc}
                label={`CC: ${cc}`}
                onRemove={() =>
                  setFilters({ costCenters: filters.costCenters.filter((c) => c !== cc) })
                }
              />
            ))}
          </div>
        )}

        {/* Advanced filter panel */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Area filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Area
                </label>
                <div className="flex flex-wrap gap-1">
                  {areas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      className={clsx(
                        'px-2 py-1 text-xs rounded border transition-colors',
                        filters.areas.includes(area)
                          ? 'bg-sst-orange-100 border-sst-orange-300 text-sst-orange-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      )}
                      onClick={() => handleAreaToggle(area)}
                    >
                      {area}
                    </button>
                  ))}
                  {areas.length === 0 && (
                    <span className="text-xs text-gray-400">No areas configured</span>
                  )}
                </div>
              </div>

              {/* Shift filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Shift
                </label>
                <div className="flex flex-wrap gap-1">
                  {shifts.map((shift) => (
                    <button
                      key={shift}
                      type="button"
                      className={clsx(
                        'px-2 py-1 text-xs rounded border transition-colors',
                        filters.shifts.includes(shift)
                          ? 'bg-sst-orange-100 border-sst-orange-300 text-sst-orange-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      )}
                      onClick={() => handleShiftToggle(shift)}
                    >
                      {shift}
                    </button>
                  ))}
                  {shifts.length === 0 && (
                    <span className="text-xs text-gray-400">No shifts found</span>
                  )}
                </div>
              </div>

              {/* Hour range filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Hour Range
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={filters.hourStart ?? ''}
                    onChange={(e) =>
                      setFilters({ hourStart: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="text-sm border-gray-300 rounded-md focus:ring-sst-orange-500 focus:border-sst-orange-500"
                  >
                    <option value="">Start</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-400">to</span>
                  <select
                    value={filters.hourEnd ?? ''}
                    onChange={(e) =>
                      setFilters({ hourEnd: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="text-sm border-gray-300 rounded-md focus:ring-sst-orange-500 focus:border-sst-orange-500"
                  >
                    <option value="">End</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
