import axios, { AxiosError } from 'axios';
import {
  KPISummary,
  TimeseriesPoint,
  ProductivityRow,
  VarianceDriver,
  JoinCoverage,
  WorkOrder,
  WorkOrderDetail,
  WorkOrderSummary,
  MRPSummary,
  MRPItem,
  UploadParseResult,
  UploadIngestResult,
  Upload,
  MappingTemplate,
  DataQualitySummary,
  Exception,
  CostCenterMapping,
  WorkCenterMapping,
  StatusConfig,
  FilterState,
  DatasetType,
  PaginatedResponse,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handling interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const message = (error.response?.data as any)?.error?.message || error.message;
    console.error('API Error:', message);
    throw new Error(message);
  }
);

// Helper to build query params from filters
function buildFilterParams(filters: Partial<FilterState>): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.startDate) params.start_date = filters.startDate;
  if (filters.endDate) params.end_date = filters.endDate;
  if (filters.period) params.period = filters.period;
  if (filters.costCenters?.length) params.cost_centers = filters.costCenters.join(',');
  if (filters.areas?.length) params.areas = filters.areas.join(',');
  if (filters.workCenters?.length) params.work_centers = filters.workCenters.join(',');
  if (filters.shifts?.length) params.shifts = filters.shifts.join(',');
  if (filters.hourStart != null) params.hour_start = String(filters.hourStart);
  if (filters.hourEnd != null) params.hour_end = String(filters.hourEnd);

  return params;
}

// KPI API
export const kpiApi = {
  getSummary: async (filters: Partial<FilterState> = {}): Promise<{ kpis: KPISummary }> => {
    const { data } = await api.get('/kpi/summary', { params: buildFilterParams(filters) });
    return data;
  },

  getTimeseries: async (
    filters: Partial<FilterState> = {},
    granularity: 'hourly' | 'daily' = 'daily'
  ): Promise<{ data: TimeseriesPoint[] }> => {
    const params = { ...buildFilterParams(filters), granularity };
    const { data } = await api.get('/kpi/timeseries', { params });
    return data;
  },

  getProductivity: async (filters: Partial<FilterState> = {}): Promise<{ data: ProductivityRow[] }> => {
    const { data } = await api.get('/kpi/productivity', { params: buildFilterParams(filters) });
    return data;
  },

  getTopDrivers: async (filters: Partial<FilterState> = {}, limit = 5): Promise<{ data: VarianceDriver[] }> => {
    const params = { ...buildFilterParams(filters), limit: String(limit) };
    const { data } = await api.get('/kpi/top-drivers', { params });
    return data;
  },

  getCoverage: async (): Promise<{ data: JoinCoverage }> => {
    const { data } = await api.get('/kpi/coverage');
    return data;
  },
};

// Work Orders API
export const workOrdersApi = {
  getList: async (params: {
    status?: string;
    late_only?: boolean;
    cost_center?: string;
    area?: string;
    work_center?: string;
    due_date_start?: string;
    due_date_end?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
  } = {}): Promise<PaginatedResponse<WorkOrder>> => {
    const queryParams: Record<string, string> = {};
    if (params.status) queryParams.status = params.status;
    if (params.late_only) queryParams.late_only = 'true';
    if (params.cost_center) queryParams.cost_center = params.cost_center;
    if (params.area) queryParams.area = params.area;
    if (params.work_center) queryParams.work_center = params.work_center;
    if (params.due_date_start) queryParams.due_date_start = params.due_date_start;
    if (params.due_date_end) queryParams.due_date_end = params.due_date_end;
    if (params.search) queryParams.search = params.search;
    if (params.limit) queryParams.limit = String(params.limit);
    if (params.offset) queryParams.offset = String(params.offset);
    if (params.sort_by) queryParams.sort_by = params.sort_by;
    if (params.sort_dir) queryParams.sort_dir = params.sort_dir;

    const { data } = await api.get('/work-orders', { params: queryParams });
    return data;
  },

  getSummary: async (): Promise<WorkOrderSummary> => {
    const { data } = await api.get('/work-orders/summary');
    return data;
  },

  getDetail: async (woNumber: string): Promise<{ work_order: WorkOrderDetail; confirmations: any[]; scans: any[]; totals: any }> => {
    const { data } = await api.get(`/work-orders/${encodeURIComponent(woNumber)}`);
    return data;
  },
};

// MRP API
export const mrpApi = {
  getSummary: async (): Promise<MRPSummary> => {
    const { data } = await api.get('/mrp/summary');
    return data;
  },

  getItems: async (params: {
    area?: string;
    late_only?: boolean;
    shortage_only?: boolean;
    material?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
  } = {}): Promise<PaginatedResponse<MRPItem>> => {
    const queryParams: Record<string, string> = {};
    if (params.area) queryParams.area = params.area;
    if (params.late_only) queryParams.late_only = 'true';
    if (params.shortage_only) queryParams.shortage_only = 'true';
    if (params.material) queryParams.material = params.material;
    if (params.limit) queryParams.limit = String(params.limit);
    if (params.offset) queryParams.offset = String(params.offset);
    if (params.sort_by) queryParams.sort_by = params.sort_by;
    if (params.sort_dir) queryParams.sort_dir = params.sort_dir;

    const { data } = await api.get('/mrp/items', { params: queryParams });
    return data;
  },

  getTrend: async (days = 14): Promise<{ data: any[] }> => {
    const { data } = await api.get('/mrp/trend', { params: { days: String(days) } });
    return data;
  },
};

// Upload API
export const uploadApi = {
  parseFile: async (file: File, datasetType: DatasetType): Promise<UploadParseResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataset_type', datasetType);

    const { data } = await api.post('/upload/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  ingestFile: async (
    uploadId: number,
    mapping: Record<string, string>,
    saveTemplate?: boolean,
    templateName?: string
  ): Promise<UploadIngestResult> => {
    const { data } = await api.post('/upload/ingest', {
      upload_id: uploadId,
      mapping,
      save_template: saveTemplate,
      template_name: templateName,
    });
    return data;
  },

  getTemplates: async (datasetType?: DatasetType): Promise<MappingTemplate[]> => {
    const params = datasetType ? { dataset_type: datasetType } : {};
    const { data } = await api.get('/upload/templates', { params });
    return data;
  },

  getHistory: async (params: {
    limit?: number;
    offset?: number;
    dataset_type?: DatasetType;
    status?: string;
  } = {}): Promise<Upload[]> => {
    const { data } = await api.get('/upload/history', { params });
    return data;
  },

  getUpload: async (id: number): Promise<Upload> => {
    const { data } = await api.get(`/upload/${id}`);
    return data;
  },
};

// Data Quality API
export const dataQualityApi = {
  getSummary: async (): Promise<DataQualitySummary> => {
    const { data } = await api.get('/data-quality/summary');
    return data;
  },

  getExceptions: async (params: {
    exception_type?: string;
    severity?: string;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResponse<Exception>> => {
    const queryParams: Record<string, string> = {};
    if (params.exception_type) queryParams.exception_type = params.exception_type;
    if (params.severity) queryParams.severity = params.severity;
    if (params.resolved !== undefined) queryParams.resolved = String(params.resolved);
    if (params.limit) queryParams.limit = String(params.limit);
    if (params.offset) queryParams.offset = String(params.offset);

    const { data } = await api.get('/data-quality/exceptions', { params: queryParams });
    return data;
  },

  resolveException: async (id: number, notes?: string): Promise<void> => {
    await api.post(`/data-quality/exceptions/${id}/resolve`, { resolution_notes: notes });
  },

  getAnomalies: async (): Promise<any> => {
    const { data } = await api.get('/data-quality/anomalies');
    return data;
  },
};

// Mappings API
export const mappingsApi = {
  getCostCenters: async (): Promise<{ data: CostCenterMapping[] }> => {
    const { data } = await api.get('/mappings/cost-centers');
    return data;
  },

  addCostCenter: async (mapping: CostCenterMapping): Promise<void> => {
    await api.post('/mappings/cost-centers', mapping);
  },

  deleteCostCenter: async (costCenter: string): Promise<void> => {
    await api.delete(`/mappings/cost-centers/${encodeURIComponent(costCenter)}`);
  },

  getWorkCenters: async (): Promise<{ data: WorkCenterMapping[] }> => {
    const { data } = await api.get('/mappings/work-centers');
    return data;
  },

  addWorkCenter: async (mapping: WorkCenterMapping): Promise<void> => {
    await api.post('/mappings/work-centers', mapping);
  },

  getStatuses: async (): Promise<{ data: StatusConfig[] }> => {
    const { data } = await api.get('/mappings/statuses');
    return data;
  },

  updateStatus: async (config: StatusConfig): Promise<void> => {
    await api.post('/mappings/statuses', config);
  },

  getUnmapped: async (): Promise<{
    unmapped_cost_centers: { cost_center: string; usage_count: number }[];
    unmapped_work_centers: { work_center: string; usage_count: number }[];
  }> => {
    const { data } = await api.get('/mappings/unmapped');
    return data;
  },

  getAreas: async (): Promise<{ data: string[] }> => {
    const { data } = await api.get('/mappings/areas');
    return data;
  },

  getShifts: async (): Promise<{ data: string[] }> => {
    const { data } = await api.get('/mappings/shifts');
    return data;
  },
};

export default api;
