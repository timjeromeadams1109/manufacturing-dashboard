# D) Join and Mapping Strategy

This document defines how data sources relate, join keys, mapping tables, and exception handling.

---

## 1. Entity Relationship Overview

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│   wo_dim        │       │  confirmations_fact  │       │  kronos_fact    │
│  (Work Orders)  │◄──────┤  (Pounds Produced)   │       │  (Labor Hours)  │
│                 │       │                      │       │                 │
│ PK: wo_number   │       │ FK: wo_number        │       │ PK: composite   │
│                 │       │ FK: hour_bucket_ts   │       │ FK: cost_center │
│ work_center     │       │ cost_center          │       │ hour_bucket_ts  │
│ cost_center     │       │                      │       │                 │
└────────┬────────┘       └──────────┬───────────┘       └────────┬────────┘
         │                           │                            │
         │                           │                            │
         │         ┌─────────────────┴────────────────┐          │
         │         │         kpi_hourly               │          │
         │         │   (Pre-aggregated view)          │◄─────────┘
         │         │                                  │
         │         │ hour_bucket_ts                   │
         │         │ cost_center                      │
         │         │ SUM(pounds), SUM(kronos_hours)   │
         │         │ SUM(scanning_hours)              │
         │         └──────────────────────────────────┘
         │
         │       ┌──────────────────┐       ┌──────────────────┐
         │       │   scan_fact      │       │   mrp_fact       │
         └──────►│ (Scanning Hours) │       │ (MRP Snapshots)  │
                 │                  │       │                  │
                 │ FK: wo_number    │       │ PK: composite    │
                 │ hour_bucket_ts   │       │ material         │
                 └──────────────────┘       │ requirement_date │
                                            └──────────────────┘

         ┌──────────────────────────┐
         │ cost_center_mapping      │
         │                          │
         │ cost_center (PK)         │
         │ area                     │
         │ department               │
         │ description              │
         └──────────────────────────┘

         ┌──────────────────────────┐
         │ work_center_mapping      │
         │                          │
         │ work_center (PK)         │
         │ cost_center (FK)         │
         │ area                     │
         │ description              │
         └──────────────────────────┘
```

---

## 2. Join Strategies by Relationship

### 2.1 Confirmations → WO Dimension

**Join Key**: `confirmations_fact.wo_number = wo_dim.wo_number`

**Join Type**: LEFT OUTER JOIN (confirmations may reference WOs not yet in dimension)

**Handling Missing WOs**:
```sql
-- Flag orphan confirmations
INSERT INTO exceptions_log (exception_type, source_table, business_key, details)
SELECT
  'UNKNOWN_WO',
  'confirmations_fact',
  cf.wo_number,
  JSON_OBJECT('confirmation_ts', cf.confirmation_ts, 'pounds', cf.pounds)
FROM confirmations_fact cf
LEFT JOIN wo_dim wd ON cf.wo_number = wd.wo_number
WHERE wd.wo_number IS NULL
  AND cf.processed_at IS NULL;
```

**Resolution Options**:
1. User uploads missing WO data
2. User creates manual WO stub (minimal record)
3. Exclude from KPIs until resolved

### 2.2 Kronos Hours → Cost Center → Area

**Primary Key**: Kronos uses `cost_center` directly from the export

**Mapping to Area/Department**:
```sql
SELECT
  kf.hour_bucket_ts,
  kf.cost_center,
  COALESCE(ccm.area, 'Unmapped') AS area,
  COALESCE(ccm.department, 'Unmapped') AS department,
  kf.hours
FROM kronos_fact kf
LEFT JOIN cost_center_mapping ccm ON kf.cost_center = ccm.cost_center
```

**Handling Unmapped Cost Centers**:
1. Default to `area = 'Unmapped'`
2. Create exception record
3. Present in Data Quality page with "Add Mapping" action
4. User maps → future uploads auto-apply

**Mapping Table Schema**:
```sql
CREATE TABLE cost_center_mapping (
  cost_center VARCHAR(20) PRIMARY KEY,
  area VARCHAR(50),
  department VARCHAR(50),
  description VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 Scanning → Work Order

**Join Key**: `scan_fact.wo_number = wo_dim.wo_number`

**Join Type**: LEFT OUTER JOIN

**Cost Center Derivation** (priority order):
1. `scan_fact.cost_center` if present
2. `wo_dim.cost_center` if present
3. `work_center_mapping.cost_center` via `wo_dim.work_center`
4. `'Unmapped'` with exception logged

```sql
SELECT
  sf.wo_number,
  sf.hour_bucket_ts,
  sf.scanning_hours,
  COALESCE(
    sf.cost_center,
    wd.cost_center,
    wcm.cost_center,
    'Unmapped'
  ) AS derived_cost_center
FROM scan_fact sf
LEFT JOIN wo_dim wd ON sf.wo_number = wd.wo_number
LEFT JOIN work_center_mapping wcm ON wd.work_center = wcm.work_center
```

### 2.4 Scanning Hours → Hour Buckets

Scanning events span time; must distribute to hourly buckets:

```javascript
function distributeScansToHourBuckets(scanIn, scanOut) {
  const buckets = [];
  let current = truncateToHour(scanIn);
  const end = scanOut;

  while (current < end) {
    const bucketEnd = addHours(current, 1);
    const overlapStart = max(current, scanIn);
    const overlapEnd = min(bucketEnd, end);
    const hours = diffInHours(overlapEnd, overlapStart);

    buckets.push({
      hour_bucket_ts: current,
      scanning_hours: hours
    });

    current = bucketEnd;
  }

  return buckets;
}
```

**Example**:
```
scan_in:  08:30
scan_out: 11:15
Total: 2.75 hours

Distribution:
- 08:00 bucket: 0.5 hrs  (08:30-09:00)
- 09:00 bucket: 1.0 hrs  (09:00-10:00)
- 10:00 bucket: 1.0 hrs  (10:00-11:00)
- 11:00 bucket: 0.25 hrs (11:00-11:15)
```

### 2.5 Hour Bucket Alignment

All fact tables use the same hour bucket format for joining in `kpi_hourly`:

```sql
-- Common bucket format
DATETIME_TRUNC(timestamp, HOUR, 'America/Los_Angeles') AS hour_bucket_ts
```

**KPI Hourly Aggregation View**:
```sql
CREATE VIEW kpi_hourly AS
SELECT
  COALESCE(c.hour_bucket_ts, k.hour_bucket_ts, s.hour_bucket_ts) AS hour_bucket_ts,
  COALESCE(c.cost_center, k.cost_center, s.cost_center) AS cost_center,
  COALESCE(SUM(c.pounds), 0) AS pounds,
  COALESCE(SUM(k.hours), 0) AS kronos_hours,
  COALESCE(SUM(s.scanning_hours), 0) AS scanning_hours
FROM (
  SELECT hour_bucket_ts, cost_center, SUM(pounds) AS pounds
  FROM confirmations_fact GROUP BY 1, 2
) c
FULL OUTER JOIN (
  SELECT hour_bucket_ts, cost_center, SUM(hours) AS hours
  FROM kronos_fact GROUP BY 1, 2
) k ON c.hour_bucket_ts = k.hour_bucket_ts AND c.cost_center = k.cost_center
FULL OUTER JOIN (
  SELECT hour_bucket_ts, cost_center, SUM(scanning_hours) AS scanning_hours
  FROM scan_fact GROUP BY 1, 2
) s ON COALESCE(c.hour_bucket_ts, k.hour_bucket_ts) = s.hour_bucket_ts
   AND COALESCE(c.cost_center, k.cost_center) = s.cost_center
GROUP BY 1, 2;
```

---

## 3. Mapping Tables

### 3.1 Cost Center Mapping

| cost_center | area | department | description |
|-------------|------|------------|-------------|
| 5100 | Pressing | Production | Press Line 1 |
| 5200 | Welding | Production | Weld Cell A |
| 5300 | Packaging | Shipping | Pack Line 1 |
| 5400 | Quality | QA | Inspection |
| 9100 | Maintenance | Support | Facility |

**Seeding Strategy**:
1. Pre-load common Simpson cost centers if known
2. Auto-detect from uploaded data
3. Present unmapped for user action

### 3.2 Work Center → Cost Center Mapping

| work_center | cost_center | area | description |
|-------------|-------------|------|-------------|
| WC-PRESS-01 | 5100 | Pressing | Hydraulic Press 1 |
| WC-PRESS-02 | 5100 | Pressing | Hydraulic Press 2 |
| WC-WELD-01 | 5200 | Welding | Robot Weld A |
| WC-WELD-02 | 5200 | Welding | Robot Weld B |
| WC-PACK-01 | 5300 | Packaging | Auto Packer |

### 3.3 Status Configuration

| status_code | status_label | is_terminal | is_released |
|-------------|--------------|-------------|-------------|
| CRTD | Created | false | false |
| REL | Released | false | true |
| PCNF | Partially Confirmed | false | true |
| CNF | Confirmed | false | true |
| TECO | Tech Complete | true | false |
| CLSD | Closed | true | false |
| DLT | Deleted | true | false |

---

## 4. Exception Queue & Resolution

### 4.1 Exception Types

| Type | Severity | Auto-Resolution | User Action |
|------|----------|-----------------|-------------|
| `UNKNOWN_WO` | High | No | Upload WO or create stub |
| `UNMAPPED_COST_CENTER` | Medium | No | Add to mapping table |
| `UNMAPPED_WORK_CENTER` | Medium | No | Add to mapping table |
| `ORPHAN_SCAN` | Medium | Close scan at +8hrs | Provide scan_out or mark invalid |
| `NEGATIVE_HOURS` | High | No | Correct source data |
| `FUTURE_TIMESTAMP` | Medium | Reject record | Correct source data |
| `DUPLICATE_KEY` | Low | Upsert (latest wins) | Review if unexpected |

### 4.2 Exception Table Schema

```sql
CREATE TABLE exceptions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'Medium',
  source_table VARCHAR(50),
  business_key VARCHAR(100),
  details JSON,
  upload_id INTEGER REFERENCES uploads(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(50),
  resolution_notes TEXT
);
```

### 4.3 Resolution Workflow

```
User views Data Quality page
    ↓
Sees "47 Unmapped Cost Centers"
    ↓
Clicks → Modal shows unique unmapped values
    ↓
User selects cost center → Enters area mapping
    ↓
System saves to cost_center_mapping
    ↓
Exceptions auto-resolved; KPIs recalculated
```

---

## 5. Join Coverage Calculation

### Formula

```sql
SELECT
  'confirmations_to_wo' AS join_type,
  COUNT(CASE WHEN wd.wo_number IS NOT NULL THEN 1 END) AS matched,
  COUNT(*) AS total,
  ROUND(COUNT(CASE WHEN wd.wo_number IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS coverage_pct
FROM confirmations_fact cf
LEFT JOIN wo_dim wd ON cf.wo_number = wd.wo_number

UNION ALL

SELECT
  'kronos_to_costcenter' AS join_type,
  COUNT(CASE WHEN ccm.cost_center IS NOT NULL THEN 1 END) AS matched,
  COUNT(*) AS total,
  ROUND(COUNT(CASE WHEN ccm.cost_center IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS coverage_pct
FROM kronos_fact kf
LEFT JOIN cost_center_mapping ccm ON kf.cost_center = ccm.cost_center

UNION ALL

SELECT
  'scan_to_wo' AS join_type,
  COUNT(CASE WHEN wd.wo_number IS NOT NULL THEN 1 END) AS matched,
  COUNT(*) AS total,
  ROUND(COUNT(CASE WHEN wd.wo_number IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS coverage_pct
FROM scan_fact sf
LEFT JOIN wo_dim wd ON sf.wo_number = wd.wo_number;
```

### Coverage Targets

| Join | Target | Action if Below |
|------|--------|-----------------|
| Confirmations → WO | 98% | Review missing WOs urgently |
| Kronos → Cost Center | 95% | Map new cost centers |
| Scan → WO | 95% | Review scan data quality |

---

## 6. Incremental Load Strategy

### Business Keys for Upsert

| Table | Business Key | Upsert Behavior |
|-------|--------------|-----------------|
| `wo_dim` | `wo_number` | Update all fields; preserve first `created_date` |
| `confirmations_fact` | `wo_number + confirmation_ts + operation` (or `confirmation_number` if present) | Replace entire record |
| `kronos_fact` | `employee_id + punch_in` (or `punch_date + cost_center + hours` hash) | Replace entire record |
| `scan_fact` | `wo_number + scan_in` | Update `scan_out` and `scanning_hours` |
| `mrp_fact` | `material + requirement_date + extracted_ts` | Insert only (snapshot model) |

### Deduplication on Load

```sql
-- Deduplicate confirmations before insert
INSERT INTO confirmations_fact (wo_number, confirmation_ts, pounds, ...)
SELECT DISTINCT ON (wo_number, confirmation_ts, operation)
  wo_number, confirmation_ts, pounds, ...
FROM staging_confirmations
ORDER BY wo_number, confirmation_ts, operation, upload_id DESC;
```

---

## 7. Query Optimization

### Indexes (SQLite/Postgres)

```sql
-- wo_dim
CREATE INDEX idx_wo_dim_status ON wo_dim(status);
CREATE INDEX idx_wo_dim_due_date ON wo_dim(due_date);
CREATE INDEX idx_wo_dim_cost_center ON wo_dim(cost_center);

-- confirmations_fact
CREATE INDEX idx_conf_hour_bucket ON confirmations_fact(hour_bucket_ts);
CREATE INDEX idx_conf_wo ON confirmations_fact(wo_number);
CREATE INDEX idx_conf_cost_center ON confirmations_fact(cost_center);

-- kronos_fact
CREATE INDEX idx_kronos_hour_bucket ON kronos_fact(hour_bucket_ts);
CREATE INDEX idx_kronos_cost_center ON kronos_fact(cost_center);

-- scan_fact
CREATE INDEX idx_scan_hour_bucket ON scan_fact(hour_bucket_ts);
CREATE INDEX idx_scan_wo ON scan_fact(wo_number);

-- kpi_hourly (materialized)
CREATE INDEX idx_kpi_hourly_bucket_cc ON kpi_hourly(hour_bucket_ts, cost_center);
```

### Pre-Aggregation Refresh

```sql
-- Refresh KPI hourly (run after each upload or on schedule)
REFRESH MATERIALIZED VIEW kpi_hourly;

-- Or for SQLite, truncate and reinsert
DELETE FROM kpi_hourly WHERE hour_bucket_ts >= :affected_start;
INSERT INTO kpi_hourly SELECT ... FROM base tables ...;
```

---

## 8. API Response Structure

### KPI Endpoint Example

```json
{
  "filters_applied": {
    "date_range": ["2024-01-15", "2024-01-15"],
    "cost_centers": ["5100", "5200"],
    "hour_range": [6, 18]
  },
  "kpis": {
    "pplh": {
      "value": 123.45,
      "unit": "lb/hr",
      "trend": "+2.3%",
      "confidence": "high",
      "coverage_pct": 98.2
    },
    "variance_pct": {
      "value": -3.1,
      "unit": "%",
      "confidence": "high"
    },
    "late_wo_count": {
      "value": 47,
      "confidence": "high"
    }
  },
  "timeseries": {
    "hourly_pplh": [
      {"hour": "2024-01-15T06:00:00-08:00", "pplh": 115.2, "pounds": 2304, "hours": 20},
      {"hour": "2024-01-15T07:00:00-08:00", "pplh": 128.7, "pounds": 3861, "hours": 30}
    ]
  },
  "metadata": {
    "query_time_ms": 142,
    "data_freshness": "2024-01-15T14:30:00-08:00"
  }
}
```

---

## 9. Mapping UI Flow

### Column Mapping Dialog

```
┌─────────────────────────────────────────────────────────┐
│  Map Columns: SAP Confirmations Export                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Your Column          →    System Field                 │
│  ─────────────────────────────────────────────────      │
│  [Order Number    ▼]  →    wo_number (required)         │
│  [Posting Date    ▼]  →    confirmation_ts (required)   │
│  [Yield Qty       ▼]  →    pounds (required)            │
│  [Work Ctr        ▼]  →    work_center                  │
│  [Cost Ctr        ▼]  →    cost_center                  │
│  [-- Skip --      ▼]  →    employee_id                  │
│                                                         │
│  ☑ Save as template: [SAP_CONF_Standard________]        │
│                                                         │
│  [Cancel]                          [Validate & Import]  │
└─────────────────────────────────────────────────────────┘
```

---

## 10. Error Recovery

| Failure | Recovery |
|---------|----------|
| Partial upload (network) | Resume from checkpoint; staging table preserves progress |
| Bad row in middle | Skip row, log exception, continue; report count at end |
| Mapping changed mid-load | Reject; user must re-upload with consistent mapping |
| DB constraint violation | Log, skip record, continue |
| Full disk | Fail gracefully with clear message; no partial state |
