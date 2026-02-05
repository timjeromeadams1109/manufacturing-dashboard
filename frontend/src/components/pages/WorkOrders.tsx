import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { DataTable, Column, Pagination } from '../ui/DataTable';
import { ChartCard } from '../ui/ChartCard';
import { KPITile } from '../ui/KPITile';
import { StatusBadge, LateBadge } from '../ui/StatusBadge';
import { Drawer, DrawerSection, DrawerField } from '../ui/Drawer';
import { ErrorState } from '../ui/EmptyState';
import { workOrdersApi } from '../../services/api';
import { WorkOrder, WorkOrderSummary, WorkOrderDetail } from '../../types';
import { format, parseISO } from 'date-fns';

export function WorkOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<WorkOrderSummary | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [selectedWO, setSelectedWO] = useState<WorkOrderDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('due_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const lateOnly = searchParams.get('late_only') === 'true';

  useEffect(() => {
    loadData();
  }, [offset, sortColumn, sortDirection, lateOnly]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, listRes] = await Promise.all([
        workOrdersApi.getSummary(),
        workOrdersApi.getList({
          late_only: lateOnly,
          search: search || undefined,
          limit,
          offset,
          sort_by: sortColumn,
          sort_dir: sortDirection,
        }),
      ]);
      setSummary(summaryRes);
      setWorkOrders(listRes.data);
      setTotal(listRes.pagination.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = useCallback(() => {
    setOffset(0);
    loadData();
  }, [search]);

  const handleSort = (column: string) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleRowClick = async (wo: WorkOrder) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const detail = await workOrdersApi.getDetail(wo.wo_number);
      setSelectedWO({
        ...detail.work_order,
        confirmations: detail.confirmations,
        scans: detail.scans,
        totals: detail.totals,
      } as WorkOrderDetail);
    } catch (err) {
      console.error('Failed to load WO detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const toggleLateOnly = () => {
    if (lateOnly) {
      searchParams.delete('late_only');
    } else {
      searchParams.set('late_only', 'true');
    }
    setSearchParams(searchParams);
    setOffset(0);
  };

  const columns: Column<WorkOrder>[] = [
    {
      key: 'wo_number',
      header: 'WO Number',
      accessor: (row) => <span className="font-mono">{row.wo_number}</span>,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />,
      sortable: true,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.due_date ? format(parseISO(row.due_date), 'MMM d, yyyy') : '-'}</span>
          {row.is_late && <LateBadge lateDays={row.late_days} />}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'cost_center',
      header: 'Cost Center',
      accessor: (row) => row.cost_center || '-',
      sortable: true,
    },
    {
      key: 'work_center',
      header: 'Work Center',
      accessor: (row) => row.work_center || '-',
      sortable: true,
    },
    {
      key: 'material',
      header: 'Material',
      accessor: (row) => row.material || '-',
    },
  ];

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
        <p className="text-sm text-gray-500 mt-1">Track and manage work order status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPITile label="Total" value={summary?.total ?? null} loading={loading} />
        <KPITile
          label="Late"
          value={summary?.late ?? null}
          loading={loading}
          onClick={toggleLateOnly}
          className={lateOnly ? 'ring-2 ring-sst-orange-500' : ''}
        />
        <KPITile label="Released Today" value={summary?.released_today ?? null} loading={loading} />
        <KPITile label="Created Today" value={summary?.created_today ?? null} loading={loading} />
        <KPITile label="Currently Released" value={summary?.currently_released ?? null} loading={loading} />
      </div>

      {/* Late buckets */}
      {summary && summary.late > 0 && (
        <ChartCard title="Late Work Order Aging" subtitle="Distribution by days late">
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(summary.late_buckets).map(([bucket, count]) => (
              <div key={bucket} className="text-center">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500">{bucket}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search WO number or material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-sst-orange-500 focus:border-sst-orange-500"
          />
        </div>
        <button onClick={handleSearch} className="btn-primary">
          Search
        </button>
        {lateOnly && (
          <button onClick={toggleLateOnly} className="btn-secondary">
            Show All
          </button>
        )}
      </div>

      {/* Data table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <DataTable
          columns={columns}
          data={workOrders}
          loading={loading}
          rowKey={(row) => row.wo_number}
          onRowClick={handleRowClick}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          emptyMessage="No work orders found"
        />
        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={setOffset}
        />
      </div>

      {/* Detail drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Work Order ${selectedWO?.wo_number || ''}`}
        subtitle={selectedWO?.material || undefined}
      >
        {drawerLoading ? (
          <div className="space-y-4">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        ) : selectedWO ? (
          <div className="space-y-6">
            {/* Status section */}
            <DrawerSection title="Status">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={selectedWO.status} size="md" />
                {selectedWO.is_late && <LateBadge lateDays={selectedWO.late_days} size="md" />}
              </div>
              <DrawerField label="Due Date" value={selectedWO.due_date ? format(parseISO(selectedWO.due_date), 'MMM d, yyyy') : null} />
              <DrawerField label="Created" value={selectedWO.created_date ? format(parseISO(selectedWO.created_date), 'MMM d, yyyy HH:mm') : null} />
              <DrawerField label="Released" value={selectedWO.released_date ? format(parseISO(selectedWO.released_date), 'MMM d, yyyy HH:mm') : null} />
              <DrawerField label="Closed" value={selectedWO.closed_date ? format(parseISO(selectedWO.closed_date), 'MMM d, yyyy HH:mm') : null} />
            </DrawerSection>

            {/* Assignment section */}
            <DrawerSection title="Assignment">
              <DrawerField label="Cost Center" value={selectedWO.cost_center} />
              <DrawerField label="Work Center" value={selectedWO.work_center} />
              <DrawerField label="Area" value={selectedWO.area} />
            </DrawerSection>

            {/* Production summary */}
            <DrawerSection title="Production Summary">
              <DrawerField label="Total Pounds" value={`${selectedWO.totals.pounds.toLocaleString()} lb`} />
              <DrawerField label="Total Scan Time" value={`${selectedWO.totals.scan_hours.toFixed(1)} hrs`} />
              <DrawerField label="Confirmations" value={selectedWO.totals.confirmation_count} />
              <DrawerField label="Scan Events" value={selectedWO.totals.scan_count} />
            </DrawerSection>

            {/* Recent confirmations */}
            {selectedWO.confirmations.length > 0 && (
              <DrawerSection title="Recent Confirmations">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedWO.confirmations.slice(0, 10).map((conf, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-500">
                        {format(parseISO(conf.confirmation_ts), 'MMM d HH:mm')}
                      </span>
                      <span className="font-medium">{conf.pounds.toLocaleString()} lb</span>
                    </div>
                  ))}
                </div>
              </DrawerSection>
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
