/**
 * Mock Data Generator for Manufacturing Dashboard
 *
 * Generates realistic CSV and XLSX sample data files for testing.
 *
 * Usage:
 *   node scripts/generateMockData.js [--output-dir ./sample-data] [--rows 1000]
 */

const fs = require('fs');
const path = require('path');

// Parse command line args
const args = process.argv.slice(2);
const outputDir = args.includes('--output-dir')
  ? args[args.indexOf('--output-dir') + 1]
  : './sample-data';
const rowCount = args.includes('--rows')
  ? parseInt(args[args.indexOf('--rows') + 1])
  : 1000;

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Helper functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

function padZero(num, len = 2) {
  return String(num).padStart(len, '0');
}

// Data generators
const COST_CENTERS = ['5100', '5200', '5300', '5400', '5500', '5600', '5700'];
const WORK_CENTERS = [
  'WC-PRESS-01', 'WC-PRESS-02', 'WC-PRESS-03',
  'WC-WELD-01', 'WC-WELD-02', 'WC-WELD-03',
  'WC-PACK-01', 'WC-PACK-02',
  'WC-ASSY-01', 'WC-ASSY-02'
];
const AREAS = ['Pressing', 'Welding', 'Packaging', 'Assembly', 'Quality'];
const STATUSES = ['CRTD', 'REL', 'PCNF', 'CNF', 'TECO', 'CLSD'];
const SHIFTS = ['1st', '2nd', '3rd'];
const MATERIALS = [];

// Generate material numbers
for (let i = 1; i <= 50; i++) {
  MATERIALS.push(`MAT-${padZero(i, 6)}`);
}

// Generate Work Orders
function generateWorkOrders(count) {
  const rows = [];
  const now = new Date();
  const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  for (let i = 1; i <= count; i++) {
    const woNumber = `100004${padZero(i, 4)}`;
    const status = randomChoice(STATUSES);
    const createdDate = randomDate(startDate, now);
    const dueDate = new Date(createdDate.getTime() + randomInt(7, 30) * 24 * 60 * 60 * 1000);

    let releasedDate = null;
    let closedDate = null;

    if (['REL', 'PCNF', 'CNF', 'TECO', 'CLSD'].includes(status)) {
      releasedDate = new Date(createdDate.getTime() + randomInt(1, 3) * 24 * 60 * 60 * 1000);
    }

    if (['TECO', 'CLSD'].includes(status)) {
      closedDate = new Date(releasedDate.getTime() + randomInt(3, 14) * 24 * 60 * 60 * 1000);
    }

    rows.push({
      wo_number: woNumber,
      status,
      due_date: formatDate(dueDate),
      created_date: formatDateTime(createdDate),
      released_date: releasedDate ? formatDateTime(releasedDate) : '',
      closed_date: closedDate ? formatDateTime(closedDate) : '',
      work_center: randomChoice(WORK_CENTERS),
      cost_center: randomChoice(COST_CENTERS),
      area: randomChoice(AREAS),
      material: randomChoice(MATERIALS),
      planned_qty: randomInt(500, 10000),
      unit: 'LB'
    });
  }

  return rows;
}

// Generate Confirmations
function generateConfirmations(workOrders, confirmationsPerWO = 3) {
  const rows = [];

  for (const wo of workOrders) {
    if (!['REL', 'PCNF', 'CNF', 'TECO', 'CLSD'].includes(wo.status)) {
      continue;
    }

    const numConfirmations = randomInt(1, confirmationsPerWO);
    const startDate = wo.released_date ? new Date(wo.released_date) : new Date(wo.created_date);
    const endDate = wo.closed_date ? new Date(wo.closed_date) : new Date();

    for (let i = 0; i < numConfirmations; i++) {
      const confirmationTs = randomDate(startDate, endDate);
      confirmationTs.setHours(randomInt(6, 20), randomInt(0, 59), randomInt(0, 59));

      rows.push({
        wo_number: wo.wo_number,
        operation: padZero(randomInt(1, 3) * 10, 4),
        confirmation_ts: formatDateTime(confirmationTs),
        pounds: randomFloat(200, 2000, 1),
        work_center: wo.work_center,
        cost_center: wo.cost_center,
        employee_id: `EMP${padZero(randomInt(1, 50), 3)}`,
        confirmation_number: `450000${randomInt(10000, 99999)}`
      });
    }
  }

  return rows;
}

// Generate Kronos Hours
function generateKronosHours(days = 30) {
  const rows = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const workDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(workDate);

    // Skip weekends
    if (workDate.getDay() === 0 || workDate.getDay() === 6) {
      continue;
    }

    // Generate employees per cost center
    for (const cc of COST_CENTERS) {
      const employeesInCC = randomInt(5, 15);

      for (let e = 0; e < employeesInCC; e++) {
        const shift = randomChoice(SHIFTS);
        let shiftStart, shiftEnd;

        if (shift === '1st') {
          shiftStart = 6;
          shiftEnd = 14;
        } else if (shift === '2nd') {
          shiftStart = 14;
          shiftEnd = 22;
        } else {
          shiftStart = 22;
          shiftEnd = 6;
        }

        const punchIn = new Date(workDate);
        punchIn.setHours(shiftStart, randomInt(0, 15), 0);

        const punchOut = new Date(workDate);
        if (shiftEnd < shiftStart) {
          punchOut.setDate(punchOut.getDate() + 1);
        }
        punchOut.setHours(shiftEnd, randomInt(15, 45), 0);

        const hours = randomFloat(7.5, 8.5, 1);
        const employeeId = `EMP${padZero(randomInt(1, 100), 3)}`;

        rows.push({
          punch_date: dateStr,
          punch_in: formatDateTime(punchIn),
          punch_out: formatDateTime(punchOut),
          hours,
          cost_center: cc,
          employee_id: employeeId,
          employee_name: `Employee ${employeeId}`,
          shift,
          pay_type: 'REG'
        });

        // Some OT
        if (Math.random() < 0.2) {
          rows.push({
            punch_date: dateStr,
            punch_in: formatDateTime(punchIn),
            punch_out: formatDateTime(punchOut),
            hours: randomFloat(0.5, 2, 1),
            cost_center: cc,
            employee_id: employeeId,
            employee_name: `Employee ${employeeId}`,
            shift,
            pay_type: 'OT'
          });
        }
      }
    }
  }

  return rows;
}

// Generate Scanning Events
function generateScanning(workOrders) {
  const rows = [];

  for (const wo of workOrders) {
    if (!['REL', 'PCNF', 'CNF', 'TECO', 'CLSD'].includes(wo.status)) {
      continue;
    }

    const numScans = randomInt(1, 4);
    const startDate = wo.released_date ? new Date(wo.released_date) : new Date(wo.created_date);
    const endDate = wo.closed_date ? new Date(wo.closed_date) : new Date();

    for (let i = 0; i < numScans; i++) {
      const scanIn = randomDate(startDate, endDate);
      scanIn.setHours(randomInt(6, 18), randomInt(0, 59), 0);

      const scanDuration = randomFloat(1, 4, 2);
      const scanOut = new Date(scanIn.getTime() + scanDuration * 60 * 60 * 1000);

      rows.push({
        wo_number: wo.wo_number,
        scan_in: formatDateTime(scanIn),
        scan_out: formatDateTime(scanOut),
        scanning_hours: scanDuration,
        station: `STATION-${randomChoice(['A', 'B', 'C'])}${randomInt(1, 5)}`,
        employee_id: `EMP${padZero(randomInt(1, 50), 3)}`,
        cost_center: wo.cost_center,
        work_center: wo.work_center
      });
    }
  }

  return rows;
}

// Generate MRP Data
function generateMRP() {
  const rows = [];
  const now = new Date();

  for (const material of MATERIALS) {
    const requirementDate = randomDate(
      new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    );

    const poundsRequired = randomInt(1000, 20000);
    const poundsAvailable = randomInt(500, 25000);

    rows.push({
      material,
      requirement_date: formatDate(requirementDate),
      pounds_required: poundsRequired,
      pounds_available: poundsAvailable,
      plant: '1000',
      area: randomChoice(AREAS),
      shortage: poundsAvailable - poundsRequired,
      mrp_controller: randomChoice(['MRP01', 'MRP02', 'MRP03']),
      extracted_ts: formatDateTime(now)
    });
  }

  return rows;
}

// Write CSV file
function writeCSV(filename, data, headers) {
  const filePath = path.join(outputDir, filename);
  const headerLine = headers.join(',');
  const dataLines = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );

  fs.writeFileSync(filePath, [headerLine, ...dataLines].join('\n'));
  console.log(`Generated: ${filePath} (${data.length} rows)`);
}

// Main execution
console.log(`Generating mock data with ${rowCount} work orders...`);
console.log(`Output directory: ${outputDir}\n`);

// Generate data
const workOrders = generateWorkOrders(rowCount);
const confirmations = generateConfirmations(workOrders);
const kronosHours = generateKronosHours(30);
const scanning = generateScanning(workOrders);
const mrp = generateMRP();

// Write CSV files
writeCSV('work_orders.csv', workOrders, [
  'wo_number', 'status', 'due_date', 'created_date', 'released_date', 'closed_date',
  'work_center', 'cost_center', 'area', 'material', 'planned_qty', 'unit'
]);

writeCSV('confirmations.csv', confirmations, [
  'wo_number', 'operation', 'confirmation_ts', 'pounds', 'work_center',
  'cost_center', 'employee_id', 'confirmation_number'
]);

writeCSV('kronos_hours.csv', kronosHours, [
  'punch_date', 'punch_in', 'punch_out', 'hours', 'cost_center',
  'employee_id', 'employee_name', 'shift', 'pay_type'
]);

writeCSV('scanning.csv', scanning, [
  'wo_number', 'scan_in', 'scan_out', 'scanning_hours', 'station',
  'employee_id', 'cost_center', 'work_center'
]);

writeCSV('mrp.csv', mrp, [
  'material', 'requirement_date', 'pounds_required', 'pounds_available',
  'plant', 'area', 'shortage', 'mrp_controller', 'extracted_ts'
]);

console.log('\nMock data generation complete!');
console.log('\nTo use:');
console.log('1. Start the dashboard: docker-compose up');
console.log('2. Navigate to Upload Data');
console.log('3. Upload each CSV file with the corresponding dataset type');
