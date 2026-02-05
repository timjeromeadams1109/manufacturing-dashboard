import React, { useEffect, useState } from 'react';
import { useFilters } from '../../hooks/useFilters';
import { kpiApi } from '../../services/api';
import { TimeseriesPoint, ProductivityRow } from '../../types';
import { ChartCard } from '../ui/ChartCard';
import { DataTable, Column } from '../ui/DataTable';
import { PPLHLineChart, ProductivityBarChart } from '../charts/PPLHChart';
import { ErrorState } from '../ui/EmptyState';
import clsx from 'clsx';

export function ProductivityPage() {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<'hourly' | 'daily'>('daily');
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [productivity, setProductivity] = useState<ProductivityRow[]>([]);

  useEffect(() => {
    loadData();
  }, [filters, granularity]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [tsRes, prodRes] = await Promise.all([
        kpiApi.getTimeseries(filters, granularity),
        kpiApi.getProductivity(filters),
      ]);
      setTimeseries(tsRes.data);
      setProductivity(prodRes.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const columns: Column<ProductivityRow>[] = [
    {
      key: 'cost_center',
      header: 'Cost Center',
      accessor: (row) => <span className="font-mono">{row.cost_center}</span>,
      sortable: true,
    },
    {
      key: 'area',
      header: 'Area',
      accessor: (row) => row.area || '-',
    },
    {
      key: 'pounds',
      header: 'Pounds',
      accessor: (row) => row.pounds.toLocaleString(),
      align: 'right',
      sortable: true,
    },
    {
      key: 'kronos_hours',
      header: 'Kronos Hrs',
      accessor: (row) => row.kronos_hours.toFixed(1),
      align: 'right',
      sortable: true,
    },
    {
      key: 'scanning_hours',
      header: 'Scan Hrs',
      accessor: (row) => row.scanning_hours.toFixed(1),
      align: 'right',
    },
    {
      key: 'pplh',
      header: 'PPLH',
      accessor: (row) => (
        <span className="font-semibold text-sst-orange-600">
          {row.pplh?.toFixed(1) ?? 'N/A'}
        </span>
      ),
      align: 'right',
      sortable: true,
    },
    {
      key: 'variance',
      header: 'Variance',
      accessor: (row) => (
        <span className={clsx(row.variance > 0 ? 'text-green-600' : row.variance < 0 ? 'text-red-600' : '')}>
          {row.variance >= 0 ? '+' : ''}{row.variance.toFixed(1)}
        </span>
      ),
      align: 'right',
    },
    {
      key: 'variance_pct',
      header: 'Var %',
      accessor: (row) => (
        <span className={clsx(
          row.variance_pct === null ? 'text-gray-400' :
          row.variance_pct > 0 ? 'text-green-600' :
          row.variance_pct < 0 ? 'text-red-600' : ''
        )}>
          {row.variance_pct !== null ? `${row.variance_pct >= 0 ? '+' : ''}${row.variance_pct.toFixed(1)}%` : 'N/A'}
        </span>
      ),
      align: 'right',
    },
  ];

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  // Prepare chart data
  const topCostCenters = productivity.slice(0, 10).map((p) => ({
    label: p.cost_center,
    pounds: p.pounds,
    kronos_hours: p.kronos_hours,
    pplh: p.pplh,
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productivity</h1>
          <p className="text-sm text-gray-500 mt-1">PPLH analysis by hour, day, and cost center</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGranularity('hourly')}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              granularity === 'hourly'
                ? 'bg-sst-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Hourly
          </button>
          <button
            onClick={() => setGranularity('daily')}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              granularity === 'daily'
                ? 'bg-sst-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Daily
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title={`PPLH Trend (${granularity === 'hourly' ? 'Hourly' : 'Daily'})`}
          loading={loading}
        >
          <PPLHLineChart data={timeseries} granularity={granularity} showVariance />
        </ChartCard>

        <ChartCard title="PPLH by Cost Center (Top 10)" loading={loading}>
          <ProductivityBarChart data={topCostCenters} />
        </ChartCard>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Pounds</p>
          <p className="text-2xl font-bold text-gray-900">
            {productivity.reduce((sum, p) => sum + p.pounds, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Kronos Hours</p>
          <p className="text-2xl font-bold text-gray-900">
            {productivity.reduce((sum, p) => sum + p.kronos_hours, 0).toFixed(1)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Scanning Hours</p>
          <p className="text-2xl font-bold text-gray-900">
            {productivity.reduce((sum, p) => sum + p.scanning_hours, 0).toFixed(1)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Overall PPLH</p>
          <p className="text-2xl font-bold text-sst-orange-600">
            {(() => {
              const totalPounds = productivity.reduce((sum, p) => sum + p.pounds, 0);
              const totalHours = productivity.reduce((sum, p) => sum + p.kronos_hours, 0);
              return totalHours > 0 ? (totalPounds / totalHours).toFixed(1) : 'N/A';
            })()}
          </p>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Productivity by Cost Center</h3>
        </div>
        <DataTable
          columns={columns}
          data={productivity}
          loading={loading}
          rowKey={(row) => row.cost_center}
          emptyMessage="No productivity data available"
        />
      </div>
    </div>
  );
}
