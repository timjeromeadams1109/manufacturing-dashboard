import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { TimeseriesPoint } from '../../types';
import { format, parseISO } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PPLHLineChartProps {
  data: TimeseriesPoint[];
  granularity: 'hourly' | 'daily';
  showVariance?: boolean;
}

export function PPLHLineChart({ data, granularity, showVariance = false }: PPLHLineChartProps) {
  const labels = data.map((point) => {
    const dateStr = point.timestamp || point.date;
    if (!dateStr) return '';
    try {
      const date = parseISO(dateStr);
      return granularity === 'hourly'
        ? format(date, 'HH:mm')
        : format(date, 'MMM d');
    } catch {
      return dateStr;
    }
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: 'PPLH',
        data: data.map((p) => p.pplh),
        borderColor: '#FF5308',
        backgroundColor: 'rgba(255, 83, 8, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      ...(showVariance
        ? [
            {
              label: 'Kronos Hours',
              data: data.map((p) => p.kronos_hours),
              borderColor: '#3B82F6',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              tension: 0.3,
              pointRadius: 2,
              yAxisID: 'y1',
            },
            {
              label: 'Scanning Hours',
              data: data.map((p) => p.scanning_hours),
              borderColor: '#10B981',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              tension: 0.3,
              pointRadius: 2,
              yAxisID: 'y1',
            },
          ]
        : []),
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#111827',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.raw;
            if (label === 'PPLH') {
              return `${label}: ${value?.toFixed(1) ?? 'N/A'} lb/hr`;
            }
            return `${label}: ${value?.toFixed(1) ?? 'N/A'} hrs`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'PPLH (lb/hr)',
        },
        grid: {
          color: '#F3F4F6',
        },
      },
      ...(showVariance
        ? {
            y1: {
              type: 'linear' as const,
              display: true,
              position: 'right' as const,
              title: {
                display: true,
                text: 'Hours',
              },
              grid: {
                drawOnChartArea: false,
              },
            },
          }
        : {}),
    },
  };

  return (
    <div style={{ height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

interface ProductivityBarChartProps {
  data: {
    label: string;
    pounds: number;
    kronos_hours: number;
    pplh: number | null;
  }[];
}

export function ProductivityBarChart({ data }: ProductivityBarChartProps) {
  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: 'PPLH',
        data: data.map((d) => d.pplh),
        backgroundColor: '#FF5308',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#111827',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const item = data[context.dataIndex];
            return [
              `PPLH: ${item.pplh?.toFixed(1) ?? 'N/A'} lb/hr`,
              `Pounds: ${item.pounds.toLocaleString()}`,
              `Hours: ${item.kronos_hours.toFixed(1)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        title: {
          display: true,
          text: 'PPLH (lb/hr)',
        },
        grid: {
          color: '#F3F4F6',
        },
      },
    },
  };

  return (
    <div style={{ height: '300px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

interface VarianceChartProps {
  data: {
    label: string;
    variance: number;
    variance_pct: number | null;
  }[];
}

export function VarianceChart({ data }: VarianceChartProps) {
  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: 'Variance %',
        data: data.map((d) => d.variance_pct),
        backgroundColor: data.map((d) =>
          (d.variance_pct || 0) >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
        ),
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#111827',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Variance %',
        },
        grid: {
          color: '#F3F4F6',
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div style={{ height: '200px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
