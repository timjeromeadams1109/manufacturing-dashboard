import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScaleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentCheckIcon,
  DocumentPlusIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { KPITile, KPITileGrid } from '../ui/KPITile';
import { ChartCard } from '../ui/ChartCard';
import { PPLHLineChart, VarianceChart } from '../charts/PPLHChart';
import { ErrorState, LoadingState } from '../ui/EmptyState';
import { useFilters } from '../../hooks/useFilters';
import { kpiApi } from '../../services/api';
import { KPISummary, TimeseriesPoint, VarianceDriver } from '../../types';

export function ExecutiveSummary() {
  const navigate = useNavigate();
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<KPISummary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [topDrivers, setTopDrivers] = useState<VarianceDriver[]>([]);

  useEffect(() => {
    loadData();
  }, [filters]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, timeseriesRes, driversRes] = await Promise.all([
        kpiApi.getSummary(filters),
        kpiApi.getTimeseries({ ...filters, period: 'last14' }, 'daily'),
        kpiApi.getTopDrivers(filters, 5),
      ]);
      setSummary(summaryRes.kpis);
      setTimeseries(timeseriesRes.data);
      setTopDrivers(driversRes.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executive Summary</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manufacturing performance overview and key metrics
        </p>
      </div>

      {/* KPI Cards */}
      <KPITileGrid>
        <KPITile
          label="Today PPLH"
          value={summary?.today_pplh.value ?? null}
          unit="lb/hr"
          confidence={summary?.today_pplh.confidence}
          loading={loading}
          onClick={() => navigate('/productivity')}
          icon={<ScaleIcon className="w-6 h-6" />}
        />
        <KPITile
          label="WTD PPLH"
          value={summary?.wtd_pplh.value ?? null}
          unit="lb/hr"
          confidence={summary?.wtd_pplh.confidence}
          loading={loading}
          onClick={() => navigate('/productivity')}
          icon={<ScaleIcon className="w-6 h-6" />}
        />
        <KPITile
          label="Scan vs Kronos"
          value={summary?.variance_pct.value ?? null}
          unit="%"
          confidence={summary?.variance_pct.confidence}
          loading={loading}
          onClick={() => navigate('/productivity')}
          icon={<ClockIcon className="w-6 h-6" />}
        />
        <KPITile
          label="Late WOs"
          value={summary?.late_wo_count.value ?? null}
          confidence={summary?.late_wo_count.confidence}
          loading={loading}
          onClick={() => navigate('/work-orders?late_only=true')}
          icon={<ExclamationTriangleIcon className="w-6 h-6" />}
        />
        <KPITile
          label="Released Today"
          value={summary?.released_today.value ?? null}
          confidence={summary?.released_today.confidence}
          loading={loading}
          onClick={() => navigate('/work-orders')}
          icon={<DocumentCheckIcon className="w-6 h-6" />}
        />
        <KPITile
          label="Created Today"
          value={summary?.created_today.value ?? null}
          confidence={summary?.created_today.confidence}
          loading={loading}
          onClick={() => navigate('/work-orders')}
          icon={<DocumentPlusIcon className="w-6 h-6" />}
        />
      </KPITileGrid>

      {/* Data confidence indicator */}
      {summary && (
        <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">Data Quality Coverage</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>
              Confirmations: <strong>{summary.join_coverage.details.confirmations_to_wo}%</strong>
            </span>
            <span>
              Kronos: <strong>{summary.join_coverage.details.kronos_to_cost_center}%</strong>
            </span>
            <span>
              Scans: <strong>{summary.join_coverage.details.scan_to_wo}%</strong>
            </span>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PPLH Trend */}
        <div className="lg:col-span-2">
          <ChartCard
            title="PPLH Trend"
            subtitle="Last 14 days"
            loading={loading}
          >
            <PPLHLineChart data={timeseries} granularity="daily" />
          </ChartCard>
        </div>

        {/* Top Variance Drivers */}
        <div>
          <ChartCard
            title="Top Variance Drivers"
            subtitle="Cost centers with highest variance"
            loading={loading}
          >
            {topDrivers.length > 0 ? (
              <VarianceChart
                data={topDrivers.map((d) => ({
                  label: d.cost_center,
                  variance: d.variance,
                  variance_pct: d.variance_pct,
                }))}
              />
            ) : (
              <div className="text-center text-gray-500 py-8">
                No variance data available
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Quick stats table */}
      {summary && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Today's Details</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200">
            <div className="p-4">
              <p className="text-sm text-gray-500">Total Pounds</p>
              <p className="text-xl font-bold text-gray-900">
                {summary.today_pplh.pounds.toLocaleString()}
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500">Kronos Hours</p>
              <p className="text-xl font-bold text-gray-900">
                {summary.today_pplh.hours.toLocaleString()}
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500">Scanning Hours</p>
              <p className="text-xl font-bold text-gray-900">
                {summary.variance_pct.scanning_hours.toLocaleString()}
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500">Hours Variance</p>
              <p className="text-xl font-bold text-gray-900">
                {summary.variance_pct.variance >= 0 ? '+' : ''}
                {summary.variance_pct.variance.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
