import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import {
  ChartBarIcon,
  ClockIcon,
  DocumentTextIcon,
  CubeIcon,
  ShieldCheckIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { FilterBar } from '../ui/FilterBar';

const navigation = [
  { name: 'Executive Summary', href: '/', icon: ChartBarIcon },
  { name: 'Productivity', href: '/productivity', icon: ClockIcon },
  { name: 'Work Orders', href: '/work-orders', icon: DocumentTextIcon },
  { name: 'MRP Health', href: '/mrp', icon: CubeIcon },
  { name: 'Data Quality', href: '/data-quality', icon: ShieldCheckIcon },
  { name: 'Upload Data', href: '/upload', icon: CloudArrowUpIcon },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sst-orange-500 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">Simpson Strong-Tie</span>
              <p className="text-xs text-gray-500">Manufacturing Dashboard</p>
            </div>
          </div>
          <button
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sst-orange-50 text-sst-orange-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Settings link at bottom */}
        <div className="absolute bottom-4 left-4 right-4">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sst-orange-50 text-sst-orange-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <Cog6ToothIcon className="w-5 h-5" />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center h-16 px-4 gap-4">
            <button
              className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <div className="flex-1" />
            {/* Could add user menu, notifications, etc. here */}
          </div>
          <FilterBar />
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
