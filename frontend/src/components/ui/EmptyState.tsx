import React from 'react';
import {
  DocumentIcon,
  FolderOpenIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

type EmptyStateVariant = 'no-data' | 'no-results' | 'no-charts' | 'error';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const variantIcons: Record<EmptyStateVariant, React.ComponentType<{ className?: string }>> = {
  'no-data': FolderOpenIcon,
  'no-results': DocumentIcon,
  'no-charts': ChartBarIcon,
  error: ExclamationTriangleIcon,
};

export function EmptyState({ variant = 'no-data', title, description, action }: EmptyStateProps) {
  const Icon = variantIcons[variant];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-sm">{description}</p>}
      {action && (
        <button
          type="button"
          className="btn-primary mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="btn-secondary mt-4 flex items-center gap-2"
          onClick={onRetry}
        >
          <ArrowPathIcon className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-8 h-8 border-4 border-sst-orange-200 border-t-sst-orange-500 rounded-full animate-spin mb-4" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
