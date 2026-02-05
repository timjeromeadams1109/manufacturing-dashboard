# A) Implementation Assumptions Checklist

## Data Source Assumptions

1. **Single Plant/Site Scope**: Dashboard serves one manufacturing plant; multi-plant support is out of scope for v1.

2. **Timestamp Precision**: All source timestamps include date AND time (not date-only); hour bucketing depends on this.

3. **Kronos Cost Center Authoritative**: Kronos export's `cost_center` field is the source of truth for labor allocation; SAP work center maps to cost center via a user-maintained mapping table.

4. **No Real-Time Integration**: Data arrives via file uploads (batch); there is no live SAP/Kronos API connection.

5. **Confirmation Timestamp = Production Time**: The `confirmation_timestamp` in SAP confirmations represents when pounds were actually produced (not when data was entered).

6. **Pounds Are Additive**: Confirmations are delta records (not cumulative totals); we SUM pounds directly.

7. **Kronos Hours Are Net Worked**: Kronos export provides already-calculated worked hours per punch pair (breaks excluded).

8. **Scanning Events Are Paired**: Each work order has scan-in followed by scan-out; orphan scans are flagged as exceptions.

9. **Work Order Status Values Known**: Statuses include at minimum: `REL` (Released), `CRTD` (Created), `TECO` (Technically Complete), `CLSD`/`Closed`. Terminal statuses are configurable but default to `Closed`, `CLSD`, `TECO`.

10. **MRP Snapshot Model**: Each MRP upload is a point-in-time snapshot; we keep only the latest snapshot per requirement date for current-state views but retain history for trend analysis.

## Technical Assumptions

11. **Browser Support**: Modern evergreen browsers (Chrome, Firefox, Edge, Safari latest 2 versions); no IE11.

12. **File Size Limits**: Maximum 50MB per upload (~500k rows typical); larger files chunked client-side.

13. **Timezone Uniform**: All UI display and bucketing in `America/Los_Angeles`; source data may be UTC or local (user specifies during mapping).

14. **SQLite for Dev**: Development uses SQLite; production uses Postgres. Migrations are written in Knex for portability.

15. **Authentication Deferred**: v1 is single-user/no-auth; enterprise SSO integration is a future enhancement.

---

## Assumptions Requiring User Validation

| # | Assumption | Impact if Wrong |
|---|------------|-----------------|
| 2 | Timestamps have time component | Cannot bucket hourly; would need date-only mode |
| 5 | Confirmation TS = production time | PPLH timing would be misaligned |
| 7 | Kronos hours are net worked | Would double-count breaks |
| 8 | Scans are paired | Variance calc would fail for orphan scans |
| 9 | Status values known | Late WO filter would miss records |

---

**Total Assumptions: 15**
