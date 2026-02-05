import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FilterProvider } from './hooks/useFilters';
import { Layout } from './components/layout/Layout';
import { ExecutiveSummary } from './components/pages/ExecutiveSummary';
import { ProductivityPage } from './components/pages/Productivity';
import { WorkOrdersPage } from './components/pages/WorkOrders';
import { MRPPage } from './components/pages/MRP';
import { DataQualityPage } from './components/pages/DataQuality';
import { UploadPage } from './components/pages/Upload';

function App() {
  return (
    <BrowserRouter>
      <FilterProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ExecutiveSummary />} />
            <Route path="productivity" element={<ProductivityPage />} />
            <Route path="work-orders" element={<WorkOrdersPage />} />
            <Route path="mrp" element={<MRPPage />} />
            <Route path="data-quality" element={<DataQualityPage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="settings" element={<SettingsPlaceholder />} />
          </Route>
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#111827',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </FilterProvider>
    </BrowserRouter>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">Settings page coming soon.</p>
        <p className="text-sm text-gray-400 mt-2">
          Configuration for terminal statuses, mapping defaults, and other options will be available here.
        </p>
      </div>
    </div>
  );
}

export default App;
