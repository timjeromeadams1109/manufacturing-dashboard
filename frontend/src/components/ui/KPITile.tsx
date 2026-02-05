import React from 'react';
import clsx from 'clsx';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { Confidence } from '../../types';

interface KPITileProps {
  label: string;
  value: number | string | null;
  unit?: string;
  trend?: number | string | null;
  trendLabel?: string;
  confidence?: Confidence;
  loading?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

const confidenceColors: Record<Confidence, { bg: string; text: string; dot: string }> = {
  high: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  low: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

export function KPITile({
  label,
  value,
  unit,
  trend,
  trendLabel,
  confidence,
  loading,
  onClick,
  icon,
  className,
}: KPITileProps) {
  if (loading) {
    return (
      <div className={clsx('kpi-tile', className)}>
        <div className="skeleton h-4 w-20 mb-3" />
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-4 w-16" />
      </div>
    );
  }

  const formattedValue = value === null || value === undefined ? 'N/A' : value;
  const trendValue = typeof trend === 'number' ? trend : parseFloat(trend || '0');
  const isPositiveTrend = trendValue > 0;
  const isNegativeTrend = trendValue < 0;

  return (
    <div
      className={clsx(
        'kpi-tile',
        onClick && 'cursor-pointer hover:border-sst-orange-200 border-2 border-transparent',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="kpi-tile-label">{label}</p>
          <p className="kpi-tile-value">
            {formattedValue}
            {unit && value !== null && (
              <span className="text-lg font-normal text-gray-500 ml-1">{unit}</span>
            )}
          </p>

          {trend !== null && trend !== undefined && (
            <div
              className={clsx(
                'kpi-tile-trend flex items-center gap-1',
                isPositiveTrend && 'kpi-tile-trend--positive',
                isNegativeTrend && 'kpi-tile-trend--negative',
                !isPositiveTrend && !isNegativeTrend && 'text-gray-500'
              )}
            >
              {isPositiveTrend && <ArrowTrendingUpIcon className="w-4 h-4" />}
              {isNegativeTrend && <ArrowTrendingDownIcon className="w-4 h-4" />}
              <span>
                {isPositiveTrend ? '+' : ''}
                {typeof trend === 'number' ? trend.toFixed(1) : trend}
                {trendLabel && ` ${trendLabel}`}
              </span>
            </div>
          )}
        </div>

        {icon && <div className="text-gray-400">{icon}</div>}
      </div>

      {confidence && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'w-2 h-2 rounded-full',
                confidenceColors[confidence].dot
              )}
            />
            <span
              className={clsx(
                'text-xs font-medium capitalize',
                confidenceColors[confidence].text
              )}
            >
              {confidence} confidence
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function KPITileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {children}
    </div>
  );
}
