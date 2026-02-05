# C) Metric Definitions + Edge Cases

This document defines all KPIs, their calculations, edge case handling, and business rules.

---

## 1. PPLH (Pounds Per Labor Hour)

### Definition
**PPLH** = Total Pounds Produced ÷ Total Kronos Labor Hours

### Granularities

| Level | Formula | Use Case |
|-------|---------|----------|
| **Hourly** | `SUM(pounds in hour bucket) / SUM(kronos_hours in hour bucket)` | Intra-day productivity tracking |
| **Daily** | `SUM(pounds for day) / SUM(kronos_hours for day)` | Shift-level and daily reporting |
| **Work Order** | `SUM(pounds for WO) / SUM(kronos_hours allocated to WO)` | WO-level efficiency analysis |
| **Cost Center** | `SUM(pounds for CC) / SUM(kronos_hours for CC)` | Cost center benchmarking |

### Hour Bucketing Logic

```
hour_bucket_ts = TRUNC(timestamp, 'hour') in America/Los_Angeles

Example:
  confirmation_ts = 2024-01-15 08:47:32 PST
  hour_bucket_ts  = 2024-01-15 08:00:00 PST
```

### Pounds Attribution
- Pounds are attributed to the hour when `confirmation_ts` falls
- If WO has confirmations across multiple hours, pounds split naturally by confirmation record

### Labor Hours Attribution
- Kronos hours are distributed across hour buckets proportionally based on punch span
- Example: Punch 06:00-14:30 (8.5 hrs) distributes:
  - 06:00 bucket: 1.0 hr
  - 07:00 bucket: 1.0 hr
  - ...
  - 13:00 bucket: 1.0 hr
  - 14:00 bucket: 0.5 hr

### Edge Cases

| Scenario | Handling |
|----------|----------|
| **Kronos hours = 0 for bucket** | PPLH = NULL (not zero); display as "N/A" with tooltip |
| **Pounds = 0, hours > 0** | PPLH = 0 (valid—no production during labor) |
| **Negative pounds (reversal)** | Include in sum; may result in negative PPLH for bucket |
| **No confirmations for period** | PPLH = NULL; pounds = 0 |
| **Cross-midnight punch** | Split hours at midnight boundary into separate day buckets |
| **DST transition** | Handle 2am gap/repeat correctly; hour bucket uses local time |

### SQL Example (Hourly)

```sql
SELECT
  hour_bucket_ts,
  cost_center,
  SUM(pounds) AS total_pounds,
  SUM(kronos_hours) AS total_labor_hours,
  CASE
    WHEN SUM(kronos_hours) > 0 THEN SUM(pounds) / SUM(kronos_hours)
    ELSE NULL
  END AS pplh
FROM kpi_hourly
WHERE hour_bucket_ts BETWEEN :start AND :end
GROUP BY hour_bucket_ts, cost_center
```

---

## 2. Scanning Hours vs Kronos Hours Variance

### Definitions

| Metric | Formula |
|--------|---------|
| **Scanning Hours** | Sum of (scan_out - scan_in) converted to decimal hours |
| **Kronos Hours** | Sum of labor hours from Kronos for same bucket/filters |
| **Variance** | `Scanning Hours - Kronos Hours` |
| **Variance %** | `(Scanning Hours - Kronos Hours) / Kronos Hours * 100` |

### Interpretation

| Variance | Meaning |
|----------|---------|
| **Positive** | More scanning time than labor logged; potential overtime not captured or scanning inefficiency |
| **Negative** | Less scanning than labor; labor doing non-WO work or scanning not captured |
| **Zero** | Perfect alignment (rare) |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| **Kronos hours = 0** | Variance % = NULL; absolute variance still calculated |
| **Scanning hours = 0** | Variance = -Kronos; Variance % = -100% |
| **Both = 0** | Variance = 0, Variance % = NULL |
| **Orphan scan (no scan_out)** | Exclude from scanning hours; flag as exception |
| **Overlapping scans for same WO** | Each scan event counted separately; may indicate multi-station |

### Calculation at Cost Center Level

```sql
SELECT
  cost_center,
  DATE(hour_bucket_ts) AS work_date,
  SUM(scanning_hours) AS total_scanning,
  SUM(kronos_hours) AS total_kronos,
  SUM(scanning_hours) - SUM(kronos_hours) AS variance,
  CASE
    WHEN SUM(kronos_hours) > 0
    THEN ROUND((SUM(scanning_hours) - SUM(kronos_hours)) / SUM(kronos_hours) * 100, 2)
    ELSE NULL
  END AS variance_pct
FROM kpi_hourly
GROUP BY cost_center, DATE(hour_bucket_ts)
```

---

## 3. Late Work Orders

### Definition
A work order is **Late** when:
```
NOW() > due_date AND status NOT IN (terminal_statuses)
```

### Default Terminal Statuses (Configurable)
```
['Closed', 'CLSD', 'TECO', 'DLT', 'Deleted']
```

### Lateness Age Calculation
```
late_days = DATEDIFF(NOW(), due_date)
```

### Age Buckets

| Bucket | Criteria |
|--------|----------|
| 1-3 days late | `late_days BETWEEN 1 AND 3` |
| 4-7 days late | `late_days BETWEEN 4 AND 7` |
| 8-14 days late | `late_days BETWEEN 8 AND 14` |
| 15-30 days late | `late_days BETWEEN 15 AND 30` |
| 30+ days late | `late_days > 30` |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| **No due_date** | Exclude from late calculation; flag as data quality issue |
| **due_date in future** | Not late (even if status odd) |
| **Status case sensitivity** | Case-insensitive comparison; normalize to uppercase |
| **Status = NULL** | Treat as non-terminal (potentially late) |
| **Closed but re-opened** | Use current status; if no longer terminal, evaluate against due_date |

### Query Example

```sql
SELECT
  wo_number,
  status,
  due_date,
  CURRENT_DATE - due_date AS late_days,
  CASE
    WHEN CURRENT_DATE - due_date BETWEEN 1 AND 3 THEN '1-3 days'
    WHEN CURRENT_DATE - due_date BETWEEN 4 AND 7 THEN '4-7 days'
    WHEN CURRENT_DATE - due_date BETWEEN 8 AND 14 THEN '8-14 days'
    WHEN CURRENT_DATE - due_date BETWEEN 15 AND 30 THEN '15-30 days'
    ELSE '30+ days'
  END AS late_bucket
FROM wo_dim
WHERE due_date < CURRENT_DATE
  AND UPPER(status) NOT IN ('CLOSED', 'CLSD', 'TECO', 'DLT', 'DELETED')
```

---

## 4. Released Work Orders

### Definition
A work order is **Released** when:
- `status` indicates released state (`REL`, `Released`, `RELS`) OR
- `released_date IS NOT NULL`

### "Released Today" Metric
```sql
COUNT(*) WHERE DATE(released_date) = CURRENT_DATE
```

### "Currently Released" (Open & Released)
```sql
COUNT(*)
WHERE UPPER(status) IN ('REL', 'RELEASED', 'RELS')
  AND UPPER(status) NOT IN (terminal_statuses)
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| **released_date but status != REL** | Trust released_date for "Released Today"; use status for current state |
| **Multiple releases (re-released)** | Use latest released_date |
| **Released in past, now closed** | Counts in "Released Today" for historical date, not in "Currently Released" |

---

## 5. Created Work Orders

### Definition
A work order is **Created** when the `created_date` timestamp is set.

### "Created Today" Metric
```sql
COUNT(*) WHERE DATE(created_date) = CURRENT_DATE
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| **created_date is NULL** | Exclude; flag as data quality issue |
| **created_date > released_date** | Data anomaly; flag but include in counts |

---

## 6. MRP Pounds Available & Late

### Definitions

| Metric | Formula |
|--------|---------|
| **Pounds Available** | Sum of `pounds_available` from latest MRP snapshot |
| **Pounds Required** | Sum of `pounds_required` from latest MRP snapshot |
| **Shortage** | `pounds_available - pounds_required` (negative = shortage) |
| **Late per MRP** | `requirement_date < extracted_ts::date AND shortage < 0` |

### Late MRP Aging

| Bucket | Criteria (days past requirement_date) |
|--------|---------------------------------------|
| 1-3 days | `1 <= days_late <= 3` |
| 4-7 days | `4 <= days_late <= 7` |
| 8-14 days | `8 <= days_late <= 14` |
| 15+ days | `days_late > 14` |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| **Multiple snapshots same day** | Use most recent `extracted_ts` |
| **Negative pounds_available** | Allow (backorder scenario) |
| **pounds_required = 0** | Not late (no demand) |
| **requirement_date = NULL** | Exclude from late calculation |

### Query Example

```sql
SELECT
  material,
  requirement_date,
  pounds_required,
  pounds_available,
  pounds_available - pounds_required AS shortage,
  DATE(extracted_ts) - requirement_date AS days_late,
  CASE
    WHEN requirement_date < DATE(extracted_ts)
     AND pounds_available < pounds_required THEN TRUE
    ELSE FALSE
  END AS is_late
FROM mrp_fact
WHERE extracted_ts = (SELECT MAX(extracted_ts) FROM mrp_fact)
```

---

## 7. Data Quality Metrics

### Join Coverage %

Measures how well fact tables join to dimensions.

| Metric | Formula |
|--------|---------|
| **WO Join Coverage** | `COUNT(confirmations with valid wo_dim match) / COUNT(all confirmations) * 100` |
| **Cost Center Coverage** | `COUNT(kronos records with mapped cost center) / COUNT(all kronos) * 100` |
| **Scan-to-WO Coverage** | `COUNT(scans with valid wo_dim match) / COUNT(all scans) * 100` |

### Exception Types

| Type | Description |
|------|-------------|
| `ORPHAN_SCAN` | scan_in without scan_out |
| `UNKNOWN_WO` | Confirmation/scan references non-existent WO |
| `UNKNOWN_COST_CENTER` | Kronos cost center not in mapping |
| `NEGATIVE_HOURS` | Calculated hours < 0 |
| `FUTURE_TIMESTAMP` | Timestamp > NOW() |
| `DUPLICATE_RECORD` | Same business key uploaded multiple times |

### Calculation

```sql
SELECT
  exception_type,
  COUNT(*) AS exception_count,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM exceptions_log
WHERE resolved_at IS NULL
GROUP BY exception_type
```

---

## 8. Summary KPI Card Definitions

| KPI | Calculation | Display Format |
|-----|-------------|----------------|
| Today PPLH | PPLH for current date (all hours so far) | `123.4 lb/hr` |
| WTD PPLH | PPLH for Mon-Today of current week | `118.7 lb/hr` |
| Variance % | (Scan - Kronos) / Kronos * 100 for today | `+5.2%` or `-3.1%` |
| Late WOs | Count of late work orders as of now | `47` |
| Released Today | Count released with released_date = today | `23` |
| Created Today | Count with created_date = today | `31` |
| Join Coverage | Lowest coverage % across fact tables | `94.2%` |

---

## 9. Confidence Indicators

Each KPI displays a confidence badge based on data quality:

| Badge | Criteria |
|-------|----------|
| 🟢 High | Join coverage >= 95% AND no critical exceptions |
| 🟡 Medium | Join coverage 85-95% OR minor exceptions |
| 🔴 Low | Join coverage < 85% OR critical exceptions |

---

## 10. Filter Interactions

| Filter | Affects |
|--------|---------|
| Date Range | All metrics |
| Hour Range | Hourly PPLH, hourly variance |
| Cost Center | PPLH, variance, Kronos hours |
| Area | PPLH, WO counts, MRP |
| Work Center | PPLH (via WO), WO drilldowns |
| Shift | Kronos hours, variance |
| Status | WO counts, late WO |

---

## Appendix: Unit Test Scenarios

1. **PPLH with zero hours** → returns NULL
2. **PPLH with negative pounds** → returns negative value
3. **Variance % with zero Kronos** → returns NULL
4. **Late WO with various statuses** → correctly filters terminal
5. **Hour bucket at DST boundary** → correct local time
6. **Cross-midnight punch splitting** → correct day attribution
7. **Orphan scan detection** → flagged as exception
8. **Duplicate confirmation upsert** → replaces previous
9. **MRP late with shortage = 0** → not late
10. **Join coverage calculation** → correct percentage
