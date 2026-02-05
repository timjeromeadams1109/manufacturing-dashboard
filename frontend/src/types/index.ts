// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  metadata?: {
    query_time_ms: number;
    data_freshness?: string;
  };
}

export interface ApiError {
  message: string;
  code: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  metadata?: {
    query_time_ms: number;
  };
}

// KPI Types
export type Confidence = 'high' | 'medium' | 'low';

export interface KPIValue {
  value: number | null;
  unit?: string;
  confidence: Confidence;
  trend?: string;
  coverage_pct?: number;
}

export interface KPISummary {
  today_pplh: KPIValue & { pounds: number; hours: number };
  wtd_pplh: KPIValue & { pounds: number; hours: number };
  variance_pct: KPIValue & { scanning_hours: number; kronos_hours: number; variance: number };
  late_wo_count: KPIValue;
  released_today: KPIValue;
  created_today: KPIValue;
  join_coverage: KPIValue & { details: JoinCoverage };
}

export interface JoinCoverage {
  confirmations_to_wo: number;
  kronos_to_cost_center: number;
  scan_to_wo: number;
  min_coverage: number;
}

export interface TimeseriesPoint {
  timestamp?: string;
  date?: string;
  pounds: number;
  kronos_hours: number;
  scanning_hours: number;
  pplh: number | null;
}

export interface ProductivityRow {
  cost_center: string;
  area: string;
  pounds: number;
  kronos_hours: number;
  scanning_hours: number;
  pplh: number | null;
  variance: number;
  variance_pct: number | null;
}

export interface VarianceDriver {
  cost_center: string;
  area: string;
  variance: number;
  variance_pct: number | null;
}

// Work Order Types
export interface WorkOrder {
  wo_number: string;
  status: string;
  due_date: string;
  created_date: string;
  released_date: string | null;
  closed_date: string | null;
  work_center: string | null;
  cost_center: string | null;
  area: string | null;
  material: string | null;
  order_type: string | null;
  planned_qty: number | null;
  unit: string | null;
  is_late: boolean;
  late_days: number;
  late_bucket: string | null;
}

export interface WorkOrderDetail extends WorkOrder {
  confirmations: Confirmation[];
  scans: ScanEvent[];
  totals: {
    pounds: number;
    scan_hours: number;
    confirmation_count: number;
    scan_count: number;
  };
}

export interface Confirmation {
  id: number;
  wo_number: string;
  operation: string | null;
  confirmation_ts: string;
  pounds: number;
  work_center: string | null;
  cost_center: string | null;
  employee_id: string | null;
}

export interface ScanEvent {
  id: number;
  wo_number: string;
  scan_in: string;
  scan_out: string | null;
  scanning_hours: number | null;
  station: string | null;
  employee_id: string | null;
  is_orphan: boolean;
}

export interface WorkOrderSummary {
  total: number;
  late: number;
  released_today: number;
  created_today: number;
  currently_released: number;
  status_distribution: { status: string; count: number }[];
  late_buckets: Record<string, number>;
}

// MRP Types
export interface MRPSummary {
  snapshot_date: string;
  totals: {
    required: number;
    available: number;
    shortage: number;
    items: number;
    late_items: number;
  };
  late_buckets: Record<string, number>;
  by_area: {
    area: string | null;
    required: number;
    available: number;
    shortage: number;
    items: number;
  }[];
}

export interface MRPItem {
  id: number;
  material: string;
  requirement_date: string;
  pounds_required: number;
  pounds_available: number;
  shortage: number;
  area: string | null;
  plant: string | null;
  mrp_controller: string | null;
  is_late: boolean;
  late_days: number;
}

// Upload Types
export type DatasetType =
  | 'SAP_WO_EXPORT'
  | 'SAP_CONFIRMATIONS_EXPORT'
  | 'KRONOS_HOURS_EXPORT'
  | 'WO_SCANNING_EXPORT'
  | 'SAP_MRP_EXPORT';

export interface UploadParseResult {
  upload_id: number;
  filename: string;
  dataset_type: DatasetType;
  total_rows: number;
  headers: string[];
  preview: Record<string, any>[];
  suggested_mapping: Record<string, string>;
}

export interface UploadIngestResult {
  upload_id: number;
  status: string;
  total_rows: number;
  processed_rows: number;
  inserted: number;
  updated: number;
  error_rows: number;
  validation_errors: any[];
  ingestion_errors: any[];
  exceptions_logged: number;
}

export interface Upload {
  id: number;
  filename: string;
  original_filename: string;
  dataset_type: DatasetType;
  status: string;
  total_rows: number;
  processed_rows: number;
  error_rows: number;
  created_at: string;
  completed_at: string | null;
}

export interface MappingTemplate {
  id: number;
  name: string;
  dataset_type: DatasetType;
  mappings: Record<string, string>;
  is_default: boolean;
  created_at: string;
}

// Data Quality Types
export interface DataQualitySummary {
  coverage: JoinCoverage;
  exception_summary: { exception_type: string; severity: string; count: number }[];
  total_unresolved_exceptions: number;
  record_counts: {
    work_orders: number;
    confirmations: number;
    kronos_hours: number;
    scans: number;
    mrp: number;
  };
  recent_uploads: Upload[];
  overall_health: {
    status: 'healthy' | 'warning' | 'critical';
    label: string;
    color: string;
  };
}

export interface Exception {
  id: number;
  exception_type: string;
  severity: string;
  source_table: string;
  business_key: string;
  details: Record<string, any>;
  upload_id: number;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

// Mapping Types
export interface CostCenterMapping {
  cost_center: string;
  area: string | null;
  department: string | null;
  description: string | null;
}

export interface WorkCenterMapping {
  work_center: string;
  cost_center: string | null;
  area: string | null;
  description: string | null;
}

export interface StatusConfig {
  status_code: string;
  status_label: string;
  is_terminal: boolean;
  is_released: boolean;
}

// Filter Types
export interface FilterState {
  startDate: string | null;
  endDate: string | null;
  period: string;
  costCenters: string[];
  areas: string[];
  workCenters: string[];
  shifts: string[];
  hourStart: number | null;
  hourEnd: number | null;
  statuses: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  startDate: null,
  endDate: null,
  period: 'last14',
  costCenters: [],
  areas: [],
  workCenters: [],
  shifts: [],
  hourStart: null,
  hourEnd: null,
  statuses: [],
};
