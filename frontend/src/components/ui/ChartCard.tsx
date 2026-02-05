import React from 'react';
import clsx from 'clsx';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  actions,
  loading,
  children,
  className,
}: ChartCardProps) {
  return (
    <div className={clsx('chart-card', className)}>
      <div className="chart-card-header flex items-center justify-between">
        <div>
          <h3 className="chart-card-title">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="chart-card-body">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="skeleton w-full h-full" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function ChartCardSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="skeleton-title w-48" />
      </div>
      <div className="chart-card-body">
        <div className={clsx('skeleton w-full', height)} />
      </div>
    </div>
  );
}
