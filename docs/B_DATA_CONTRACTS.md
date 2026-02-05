# B) Data Contracts

Each dataset defines required columns, optional columns, data types, common aliases, and example rows.

---

## 1. SAP_WO_EXPORT (Work Order Master)

**Purpose**: Dimension table for work orders including status, dates, and organizational assignment.

### Schema

| Column | Type | Required | Aliases | Description |
|--------|------|----------|---------|-------------|
| `wo_number` | STRING | ✅ | `order`, `work_order`, `aufnr`, `order_number` | Unique work order identifier |
| `status` | STRING | ✅ | `system_status`, `order_status`, `stat` | Current WO status code |
| `due_date` | DATE | ✅ | `finish_date`, `basic_finish`, `end_date`, `scheduled_finish` | Target completion date |
| `created_date` | DATETIME | ✅ | `created_on`, `creation_date`, `erdat` | When WO was created |
| `released_date` | DATETIME | ❌ | `release_date`, `released_on` | When WO was released (null if not released) |
| `closed_date` | DATETIME | ❌ | `actual_finish`, `closed_on`, `completion_date` | When WO was closed (null if open) |
| `work_center` | STRING | ❌ | `workcenter`, `arbpl`, `wc` | SAP work center |
| `cost_center` | STRING | ❌ | `costcenter`, `kostl`, `cc` | Cost center if directly assigned |
| `area` | STRING | ❌ | `department`, `production_area`, `dept` | Logical production area |
| `material` | STRING | ❌ | `material_number`, `matnr`, `part_number` | Material/part being produced |
| `order_type` | STRING | ❌ | `type`, `auart` | Production order type |
| `planned_qty` | NUMBER | ❌ | `target_qty`, `plan_qty`, `gamng` | Planned quantity |
| `unit` | STRING | ❌ | `uom`, `unit_of_measure`, `gmein` | Unit of measure |

### Example Rows

```csv
wo_number,status,due_date,created_date,released_date,closed_date,work_center,cost_center,area,material,planned_qty,unit
1000045678,REL,2024-01-15,2024-01-08 06:30:00,2024-01-09 07:00:00,,WC-PRESS-01,5100,Pressing,MAT-001234,5000,LB
1000045679,CLSD,2024-01-10,2024-01-03 14:22:00,2024-01-04 06:00:00,2024-01-10 16:45:00,WC-WELD-03,5200,Welding,MAT-002345,2500,LB
1000045680,CRTD,2024-01-20,2024-01-12 09:15:00,,,WC-PACK-02,5300,Packaging,MAT-003456,10000,EA
```

### Validation Rules

- `wo_number` must be non-empty and unique per upload
- `status` must be non-empty
- `due_date` must be a valid date
- `created_date` must be <= `released_date` (if present) <= `closed_date` (if present)

---

## 2. SAP_CONFIRMATIONS_EXPORT (Production Confirmations / Pounds)

**Purpose**: Fact table capturing pounds produced by work order and operation, timestamped for hourly bucketing.

### Schema

| Column | Type | Required | Aliases | Description |
|--------|------|----------|---------|-------------|
| `wo_number` | STRING | ✅ | `order`, `work_order`, `aufnr` | Work order reference |
| `operation` | STRING | ❌ | `op`, `operation_number`, `vornr` | Operation/activity number |
| `confirmation_ts` | DATETIME | ✅ | `posting_date`, `budat`, `confirm_date`, `production_ts` | When production occurred |
| `pounds` | NUMBER | ✅ | `quantity`, `yield`, `lmnga`, `confirmed_qty` | Pounds produced (can be negative for reversals) |
| `work_center` | STRING | ❌ | `workcenter`, `arbpl` | Work center where confirmed |
| `cost_center` | STRING | ❌ | `costcenter`, `kostl` | Cost center if available |
| `employee_id` | STRING | ❌ | `pernr`, `user`, `entered_by` | Who made the confirmation |
| `confirmation_number` | STRING | ❌ | `ruession`, `conf_no` | SAP confirmation doc number |

### Example Rows

```csv
wo_number,operation,confirmation_ts,pounds,work_center,cost_center,employee_id,confirmation_number
1000045678,0010,2024-01-15 08:30:00,1250.5,WC-PRESS-01,5100,EMP001,4500001234
1000045678,0010,2024-01-15 10:15:00,1340.0,WC-PRESS-01,5100,EMP001,4500001235
1000045679,0020,2024-01-10 14:45:00,2500.0,WC-WELD-03,5200,EMP002,4500001236
```

### Validation Rules

- `wo_number` must be non-empty
- `confirmation_ts` must be a valid datetime
- `pounds` must be numeric (negatives allowed for reversals)
- Duplicate `confirmation_number` triggers upsert (replace existing)

---

## 3. KRONOS_HOURS_EXPORT (Labor Hours)

**Purpose**: Fact table of employee worked hours from Kronos timekeeping, keyed by cost center.

### Schema

| Column | Type | Required | Aliases | Description |
|--------|------|----------|---------|-------------|
| `punch_date` | DATE | ✅ | `work_date`, `date`, `pay_date` | Date of work |
| `punch_in` | DATETIME | ✅ | `clock_in`, `start_time`, `in_time` | Clock-in timestamp |
| `punch_out` | DATETIME | ✅ | `clock_out`, `end_time`, `out_time` | Clock-out timestamp |
| `hours` | NUMBER | ✅ | `worked_hours`, `total_hours`, `net_hours` | Net hours worked |
| `cost_center` | STRING | ✅ | `costcenter`, `home_cost_center`, `labor_account` | Cost center for labor allocation |
| `employee_id` | STRING | ❌ | `badge`, `emp_id`, `pernr`, `employee_number` | Employee identifier |
| `employee_name` | STRING | ❌ | `name`, `full_name` | Employee name |
| `shift` | STRING | ❌ | `shift_code`, `schedule` | Shift identifier (e.g., "1st", "2nd", "3rd") |
| `pay_type` | STRING | ❌ | `pay_code`, `earnings_code` | Regular, OT, etc. |

### Example Rows

```csv
punch_date,punch_in,punch_out,hours,cost_center,employee_id,employee_name,shift,pay_type
2024-01-15,2024-01-15 06:00:00,2024-01-15 14:30:00,8.0,5100,EMP001,John Smith,1st,REG
2024-01-15,2024-01-15 06:00:00,2024-01-15 14:30:00,0.5,5100,EMP001,John Smith,1st,OT
2024-01-15,2024-01-15 14:00:00,2024-01-15 22:30:00,8.0,5200,EMP002,Jane Doe,2nd,REG
```

### Validation Rules

- `punch_in` must be before `punch_out`
- `hours` must be positive and <= 24
- `cost_center` must be non-empty
- Hours are distributed to hourly buckets based on punch_in/punch_out span

---

## 4. WO_SCANNING_EXPORT (Work Order Scan Events)

**Purpose**: Fact table of work order scan-in/scan-out events for calculating scanning hours.

### Schema

| Column | Type | Required | Aliases | Description |
|--------|------|----------|---------|-------------|
| `wo_number` | STRING | ✅ | `order`, `work_order`, `barcode` | Work order scanned |
| `scan_in` | DATETIME | ✅ | `start_scan`, `scan_start`, `begin_time` | Scan-in timestamp |
| `scan_out` | DATETIME | ❌ | `end_scan`, `scan_end`, `finish_time` | Scan-out timestamp (null if still open) |
| `scanning_hours` | NUMBER | ❌ | `duration`, `elapsed_hours` | Calculated or provided hours |
| `station` | STRING | ❌ | `workstation`, `terminal`, `scan_location` | Scan station/terminal |
| `employee_id` | STRING | ❌ | `badge`, `operator`, `user` | Who scanned |
| `cost_center` | STRING | ❌ | `costcenter` | Cost center if captured |
| `work_center` | STRING | ❌ | `workcenter` | Work center if captured |

### Example Rows

```csv
wo_number,scan_in,scan_out,scanning_hours,station,employee_id,cost_center,work_center
1000045678,2024-01-15 07:05:00,2024-01-15 11:30:00,4.42,STATION-A1,EMP001,5100,WC-PRESS-01
1000045678,2024-01-15 12:00:00,2024-01-15 15:45:00,3.75,STATION-A1,EMP001,5100,WC-PRESS-01
1000045679,2024-01-10 14:00:00,2024-01-10 16:30:00,2.50,STATION-B2,EMP002,5200,WC-WELD-03
```

### Validation Rules

- `wo_number` must be non-empty
- `scan_in` must be valid datetime
- `scan_out` must be >= `scan_in` if present
- If `scanning_hours` not provided, calculate as `(scan_out - scan_in)` in decimal hours
- Orphan scans (no scan_out) flagged as exceptions

---

## 5. SAP_MRP_EXPORT (Material Requirements Planning)

**Purpose**: Snapshot fact table of MRP status showing pounds available vs required by date.

### Schema

| Column | Type | Required | Aliases | Description |
|--------|------|----------|---------|-------------|
| `material` | STRING | ✅ | `material_number`, `matnr`, `part` | Material/part number |
| `requirement_date` | DATE | ✅ | `req_date`, `need_date`, `mf_date` | When material is needed |
| `pounds_required` | NUMBER | ✅ | `qty_required`, `demand`, `requirement_qty` | Pounds needed |
| `pounds_available` | NUMBER | ✅ | `qty_available`, `supply`, `available_qty` | Pounds on hand/scheduled |
| `plant` | STRING | ❌ | `werks`, `facility` | Plant code |
| `area` | STRING | ❌ | `mrp_area`, `department` | MRP area/department |
| `shortage` | NUMBER | ❌ | `deficit` | Calculated shortage (derived if not provided) |
| `mrp_controller` | STRING | ❌ | `controller`, `dispo` | MRP controller code |
| `extracted_ts` | DATETIME | ❌ | `extract_date`, `snapshot_date`, `run_date` | When MRP was extracted (defaults to upload time) |

### Example Rows

```csv
material,requirement_date,pounds_required,pounds_available,plant,area,shortage,mrp_controller,extracted_ts
MAT-001234,2024-01-20,5000,4500,1000,Pressing,-500,MRP01,2024-01-15 06:00:00
MAT-002345,2024-01-18,2500,3000,1000,Welding,0,MRP01,2024-01-15 06:00:00
MAT-003456,2024-01-25,10000,6000,1000,Packaging,-4000,MRP02,2024-01-15 06:00:00
```

### Validation Rules

- `material` must be non-empty
- `requirement_date` must be valid date
- `pounds_required` and `pounds_available` must be numeric (>= 0)
- `shortage` calculated as `pounds_available - pounds_required` if not provided
- Late flag: `requirement_date < extracted_ts::date AND shortage < 0`

---

## Common Type Definitions

| Type | Format | Examples |
|------|--------|----------|
| STRING | UTF-8 text | `"1000045678"`, `"WC-PRESS-01"` |
| NUMBER | Decimal (up to 4 decimal places) | `1250.5`, `-100`, `8.0` |
| DATE | `YYYY-MM-DD` | `2024-01-15` |
| DATETIME | `YYYY-MM-DD HH:mm:ss` or ISO 8601 | `2024-01-15 08:30:00`, `2024-01-15T08:30:00Z` |

---

## Column Mapping Templates

The system stores user-defined mappings so repeat uploads auto-map columns.

```json
{
  "template_name": "SAP_WO_Standard",
  "dataset_type": "SAP_WO_EXPORT",
  "mappings": {
    "AUFNR": "wo_number",
    "System Status": "status",
    "Basic Finish": "due_date",
    "Created On": "created_date",
    "Work Center": "work_center"
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```
