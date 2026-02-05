import React, { useEffect, useState } from 'react';
import { mrpApi } from '../../services/api';
import { MRPSummary, MRPItem } from '../../types';
import { ChartCard } from '../ui/ChartCard';
import { KPITile } from '../ui/KPITile';
import { DataTable, Column, Pagination } from '../ui/DataTable';
import { StatusBadge, LateBadge } from '../ui/StatusBadge';
import { ErrorState, EmptyState } from '../ui/EmptyState';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';

export function MRPPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MRPSummary | null>(null);
  const [items, setItems] = useState<MRPItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [lateOnly, setLateOnly] = useState(false);
  const [shortageOnly, setShortageOnly] = useState(false);

  useEffect(() => {
    loadData();
  }, [offset, lateOnly, shortageOnly]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, itemsRes] = await Promise.all([
        mrpApi.getSummary(),
        mrpApi.getItems({
          late_only: lateOnly,
          shortage_only: shortageOnly,
          limit: 50,
          offset,
        }),
      ]);
      setSummary(summaryRes);
      setItems(itemsRes.data);
      setTotal(itemsRes.pagination.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const columns: Column<MRPItem>[] = [
    {
      key: 'material',
      header: 'Material',
      accessor: (row) => <span className="font-mono">{row.material}</span>,
      sortable: true,
    },
    {
      key: 'requirement_date',
      header: 'Required Date',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <span>{format(parseISO(row.requirement_date), 'MMM d, yyyy')}</span>
          {row.is_late && <LateBadge lateDays={row.late_days} />}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'pounds_required',
      header: 'Required',
      accessor: (row) => row.pounds_required.toLocaleString(),
      align: 'right',
      sortable: true,
    },
    {
      key: 'pounds_available',
      header: 'Available',
      accessor: (row) => row.pounds_available.toLocaleString(),
      align: 'right',
      sortable: true,
    },
    {
      key: 'shortage',
      header: 'Shortage',
      accessor: (row) => (
        <span className={clsx(
          'font-medium',
          row.shortage < 0 ? 'text-red-600' : 'text-green-600'
        )}>
          {row.shortage < 0 ? row.shortage.toLocaleString() : '-'}
        </span>
      ),
      align: 'right',
      sortable: true,
    },
    {
      key: 'area',
      header: 'Area',
      accessor: (row) => row.area || '-',
    },
  ];

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  if (!loading && !summary) {
    return (
      <EmptyState
        variant="no-data"
        title="No MRP Data"
        description="Upload an MRP export to see material requirements planning data."
        action={{ label: 'Upload Data', onClick: () => window.location.href = '/upload' }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">MRP Health</h1>
        <p className="text-sm text-gray-500 mt-1">
          Material requirements and shortage analysis
          {summary?.snapshot_date && (
            <span className="ml-2 text-gray-400">
              (Snapshot: {format(parseISO(summary.snapshot_date), 'MMM d, yyyy HH:mm')})
            </span>
          )}
        </p>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPITile
            label="Total Items"
            value={summary.totals.items}
            loading={loading}
          />
          <KPITile
            label="Late Items"
            value={summary.totals.late_items}
            loading={loading}
            onClick={() => setLateOnly(!lateOnly)}
            className={lateOnly ? 'ring-2 ring-sst-orange-500' : ''}
          />
          <KPITile
            label="Pounds Required"
            value={summary.totals.required.toLocaleString()}
            loading={loading}
          />
          <KPITile
            label="Pounds Available"
            value={summary.totals.available.toLocaleString()}
            loading={loading}
          />
          <KPITile
            label="Total Shortage"
            value={summary.totals.shortage.toLocaleString()}
            loading={loading}
            onClick={() => setShortageOnly(!shortageOnly)}
            className={shortageOnly ? 'ring-2 ring-sst-orange-500' : ''}
          />
        </div>
      )}

      {/* Late buckets and area breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {summary && (
          <ChartCard title="Late MRP Aging" subtitle="Days past requirement date">
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(summary.late_buckets).map(([bucket, count]) => (
                <div key={bucket} className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-sm text-gray-500">{bucket}</p>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {summary && summary.by_area.length > 0 && (
          <ChartCard title="Shortage by Area" subtitle="Areas with material shortages">
            <div className="space-y-3">
              {summary.by_area
                .filter((a) => a.shortage > 0)
                .slice(0, 5)
                .map((area) => (
                  <div key={area.area || 'Unmapped'} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{area.area || 'Unmapped'}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">{area.items} items</span>
                      <span className="text-sm font-medium text-red-600">
                        -{area.shortage.toLocaleString()} lb
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </ChartCard>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => { setLateOnly(!lateOnly); setOffset(0); }}
          className={clsx(
            'px-3 py-1.5 text-sm rounded-lg transition-colors',
            lateOnly
              ? 'bg-sst-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          Late Only
        </button>
        <button
          onClick={() => { setShortageOnly(!shortageOnly); setOffset(0); }}
          className={clsx(
            'px-3 py-1.5 text-sm rounded-lg transition-colors',
            shortageOnly
              ? 'bg-sst-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          Shortage Only
        </button>
        {(lateOnly || shortageOnly) && (
          <button
            onClick={() => { setLateOnly(false); setShortageOnly(false); setOffset(0); }}
            className="text-sm text-sst-orange-600 hover:text-sst-orange-700"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Data table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          rowKey={(row) => `${row.material}-${row.requirement_date}`}
          emptyMessage="No MRP items found"
        />
        <Pagination
          total={total}
          limit={50}
          offset={offset}
          onPageChange={setOffset}
        />
      </div>
    </div>
  );
}
