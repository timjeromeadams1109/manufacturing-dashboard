import React from 'react';
import clsx from 'clsx';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/20/solid';

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const variantConfig: Record<
  StatusVariant,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  success: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ExclamationTriangleIcon },
  error: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon },
  info: { bg: 'bg-blue-100', text: 'text-blue-800', icon: InformationCircleIcon },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-800', icon: InformationCircleIcon },
};

// Auto-detect variant from common status strings
function getVariantFromStatus(status: string): StatusVariant {
  const upper = status.toUpperCase();

  // Success statuses
  if (['CLOSED', 'CLSD', 'TECO', 'COMPLETED', 'DONE', 'SUCCESS'].includes(upper)) {
    return 'success';
  }

  // Warning statuses
  if (['PCNF', 'CNF', 'IN_PROGRESS', 'PENDING', 'PROCESSING'].includes(upper)) {
    return 'warning';
  }

  // Error statuses
  if (['FAILED', 'ERROR', 'DLT', 'DELETED', 'LATE'].includes(upper)) {
    return 'error';
  }

  // Info statuses
  if (['REL', 'RELEASED', 'CRTD', 'CREATED', 'NEW'].includes(upper)) {
    return 'info';
  }

  return 'neutral';
}

export function StatusBadge({ status, variant, showIcon = true, size = 'sm' }: StatusBadgeProps) {
  const resolvedVariant = variant || getVariantFromStatus(status);
  const config = variantConfig[resolvedVariant];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        config.bg,
        config.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      )}
    >
      {showIcon && <Icon className={clsx('mr-1', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />}
      {status}
    </span>
  );
}

interface LateBadgeProps {
  lateDays: number;
  size?: 'sm' | 'md';
}

export function LateBadge({ lateDays, size = 'sm' }: LateBadgeProps) {
  if (lateDays <= 0) return null;

  let variant: StatusVariant = 'warning';
  if (lateDays > 7) variant = 'error';

  return (
    <StatusBadge
      status={`${lateDays}d late`}
      variant={variant}
      showIcon={true}
      size={size}
    />
  );
}
