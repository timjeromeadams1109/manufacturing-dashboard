import React, { useEffect, useState } from 'react';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { dataQualityApi, mappingsApi } from '../../services/api';
import { DataQualitySummary, Exception, CostCenterMapping } from '../../types';
import { ChartCard } from '../ui/ChartCard';
import { DataTable, Column, Pagination } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { ErrorState, LoadingState } from '../ui/EmptyState';
import toast from 'react-hot-toast';

export function DataQualityPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DataQualitySummary | null>(null);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [exceptionsTotal, setExceptionsTotal] = useState(0);
  const [exceptionsOffset, setExceptionsOffset] = useState(0);
  const [unmappedCC, setUnmappedCC] = useState<{ cost_center: string; usage_count: number }[]>([]);

  const [showAddMapping, setShowAddMapping] = useState(false);
  const [newMapping, setNewMapping] = useState({ cost_center: '', area: '', department: '' });

  useEffect(() => {
    loadData();
  }, [exceptionsOffset]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, exceptionsRes, unmappedRes] = await Promise.all([
        dataQualityApi.getSummary(),
        dataQualityApi.getExceptions({ resolved: false, limit: 20, offset: exceptionsOffset }),
        mappingsApi.getUnmapped(),
      ]);
      setSummary(summaryRes);
      setExceptions(exceptionsRes.data);
      setExceptionsTotal(exceptionsRes.pagination.total);
      setUnmappedCC(unmappedRes.unmapped_cost_centers);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveException(id: number) {
    try {
      await dataQualityApi.resolveException(id, 'Resolved via UI');
      toast.success('Exception resolved');
      loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleAddMapping() {
    if (!newMapping.cost_center) return;
    try {
      await mappingsApi.addCostCenter({
        cost_center: newMapping.cost_center,
        area: newMapping.area || null,
        department: newMapping.department || null,
        description: null,
      });
      toast.success('Mapping added');
      setShowAddMapping(false);
      setNewMapping({ cost_center: '', area: '', department: '' });
      loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const exceptionColumns: Column<Exception>[] = [
    {
      key: 'exception_type',
      header: 'Type',
      accessor: (row) => <StatusBadge status={row.exception_type} />,
    },
    {
      key: 'severity',
      header: 'Severity',
      accessor: (row) => (
        <span className={clsx(
          'text-sm font-medium',
          row.severity === 'High' ? 'text-red-600' : row.severity === 'Medium' ? 'text-yellow-600' : 'text-gray-600'
        )}>
          {row.severity}
        </span>
      ),
    },
    {
      key: 'business_key',
      header: 'Key',
      accessor: (row) => <span className="font-mono text-sm">{row.business_key}</span>,
    },
    {
      key: 'source_table',
      header: 'Source',
      accessor: (row) => row.source_table,
    },
    {
      key: 'actions',
      header: '',
      accessor: (row) => (
        <button
          onClick={() => handleResolveException(row.id)}
          className="text-sm text-sst-orange-600 hover:text-sst-orange-700"
        >
          Resolve
        </button>
      ),
    },
  ];

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  if (loading && !summary) {
    return <LoadingState message="Loading data quality metrics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Quality</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor data health and resolve exceptions</p>
      </div>

      {/* Overall health */}
      {summary && (
        <div className={clsx(
          'p-4 rounded-lg border flex items-center gap-4',
          summary.overall_health.status === 'healthy' ? 'bg-green-50 border-green-200' :
          summary.overall_health.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        )}>
          {summary.overall_health.status === 'healthy' ? (
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          ) : summary.overall_health.status === 'warning' ? (
            <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
          ) : (
            <XCircleIcon className="w-8 h-8 text-red-500" />
          )}
          <div>
            <h3 className="font-semibold text-gray-900">{summary.overall_health.label}</h3>
            <p className="text-sm text-gray-600">
              {summary.total_unresolved_exceptions} unresolved exceptions
            </p>
          </div>
        </div>
      )}

      {/* Coverage metrics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Confirmations → WO</span>
              <span className={clsx(
                'text-lg font-bold',
                summary.coverage.confirmations_to_wo >= 95 ? 'text-green-600' :
                summary.coverage.confirmations_to_wo >= 85 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {summary.coverage.confirmations_to_wo}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full">
              <div
                className={clsx(
                  'h-full rounded-full',
                  summary.coverage.confirmations_to_wo >= 95 ? 'bg-green-500' :
                  summary.coverage.confirmations_to_wo >= 85 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${summary.coverage.confirmations_to_wo}%` }}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Kronos → Cost Center</span>
              <span className={clsx(
                'text-lg font-bold',
                summary.coverage.kronos_to_cost_center >= 95 ? 'text-green-600' :
                summary.coverage.kronos_to_cost_center >= 85 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {summary.coverage.kronos_to_cost_center}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full">
              <div
                className={clsx(
                  'h-full rounded-full',
                  summary.coverage.kronos_to_cost_center >= 95 ? 'bg-green-500' :
                  summary.coverage.kronos_to_cost_center >= 85 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${summary.coverage.kronos_to_cost_center}%` }}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Scans → WO</span>
              <span className={clsx(
                'text-lg font-bold',
                summary.coverage.scan_to_wo >= 95 ? 'text-green-600' :
                summary.coverage.scan_to_wo >= 85 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {summary.coverage.scan_to_wo}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full">
              <div
                className={clsx(
                  'h-full rounded-full',
                  summary.coverage.scan_to_wo >= 95 ? 'bg-green-500' :
                  summary.coverage.scan_to_wo >= 85 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${summary.coverage.scan_to_wo}%` }}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Overall Coverage</span>
              <span className={clsx(
                'text-lg font-bold',
                summary.coverage.min_coverage >= 95 ? 'text-green-600' :
                summary.coverage.min_coverage >= 85 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {summary.coverage.min_coverage}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Unmapped cost centers */}
      {unmappedCC.length > 0 && (
        <ChartCard
          title="Unmapped Cost Centers"
          subtitle={`${unmappedCC.length} cost centers need mapping`}
          actions={
            <button
              onClick={() => setShowAddMapping(true)}
              className="btn-primary text-sm"
            >
              Add Mapping
            </button>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {unmappedCC.map((cc) => (
              <div
                key={cc.cost_center}
                className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm"
              >
                <span className="font-mono font-medium">{cc.cost_center}</span>
                <span className="text-gray-500 ml-2">({cc.usage_count} uses)</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Add mapping modal */}
      {showAddMapping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Cost Center Mapping</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Center
                </label>
                <input
                  type="text"
                  value={newMapping.cost_center}
                  onChange={(e) => setNewMapping((m) => ({ ...m, cost_center: e.target.value }))}
                  className="w-full border-gray-300 rounded-md"
                  placeholder="e.g., 5100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area
                </label>
                <input
                  type="text"
                  value={newMapping.area}
                  onChange={(e) => setNewMapping((m) => ({ ...m, area: e.target.value }))}
                  className="w-full border-gray-300 rounded-md"
                  placeholder="e.g., Pressing"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={newMapping.department}
                  onChange={(e) => setNewMapping((m) => ({ ...m, department: e.target.value }))}
                  className="w-full border-gray-300 rounded-md"
                  placeholder="e.g., Production"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAddMapping(false)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={handleAddMapping} className="btn-primary">
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exceptions table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Unresolved Exceptions</h3>
          <span className="text-sm text-gray-500">{exceptionsTotal} total</span>
        </div>
        <DataTable
          columns={exceptionColumns}
          data={exceptions}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No unresolved exceptions"
        />
        <Pagination
          total={exceptionsTotal}
          limit={20}
          offset={exceptionsOffset}
          onPageChange={setExceptionsOffset}
        />
      </div>

      {/* Record counts */}
      {summary && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Record Counts</h3>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {summary.record_counts.work_orders.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Work Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {summary.record_counts.confirmations.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Confirmations</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {summary.record_counts.kronos_hours.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Kronos Records</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {summary.record_counts.scans.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Scan Events</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {summary.record_counts.mrp.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">MRP Records</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
