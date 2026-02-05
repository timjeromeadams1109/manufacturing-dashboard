# Manufacturing Performance Dashboard

A production-ready web application for visualizing manufacturing performance metrics including PPLH (Pounds Per Labor Hour), work order tracking, and MRP health monitoring. Built with Simpson Strong-Tie brand styling.

## Features

- **Executive Summary**: KPI tiles for Today/WTD PPLH, scan vs. Kronos variance, late WO count, and more
- **Productivity Analysis**: Hourly and daily PPLH trends, cost center breakdown, variance analysis
- **Work Order Management**: Track released, created, and late work orders with detailed drilldowns
- **MRP Health**: Monitor material requirements, shortages, and late MRP items
- **Data Quality**: Join coverage metrics, exception management, and mapping configuration
- **Data Upload**: Wizard-based file upload with column mapping and validation

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite (development) / PostgreSQL (production-ready)
- **Charts**: Chart.js with react-chartjs-2
- **Containerization**: Docker + Docker Compose

## Quick Start

### Using Docker (Recommended)

```bash
# Clone and navigate to the project
cd manufacturing-dashboard

# Start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:3001
```

### Manual Setup

#### Backend

```bash
cd backend

# Install dependencies
npm install

# Run migrations
npm run migrate

# Start development server
npm run dev
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

## Sample Data

Generate sample data for testing:

```bash
# Generate mock CSV files
node scripts/generateMockData.js --output-dir ./sample-data --rows 1000

# Files generated:
# - work_orders.csv
# - confirmations.csv
# - kronos_hours.csv
# - scanning.csv
# - mrp.csv
```

Upload these files through the Data Upload page in the application.

## Data Contracts

See `docs/B_DATA_CONTRACTS.md` for detailed schema definitions for each data type:

1. **SAP_WO_EXPORT**: Work order master data
2. **SAP_CONFIRMATIONS_EXPORT**: Production confirmations (pounds)
3. **KRONOS_HOURS_EXPORT**: Labor hours from Kronos
4. **WO_SCANNING_EXPORT**: Work order scan events
5. **SAP_MRP_EXPORT**: Material requirements planning

## API Endpoints

### KPI
- `GET /api/kpi/summary` - KPI summary cards
- `GET /api/kpi/timeseries` - PPLH timeseries data
- `GET /api/kpi/productivity` - Productivity by cost center
- `GET /api/kpi/top-drivers` - Top variance drivers
- `GET /api/kpi/coverage` - Join coverage metrics

### Work Orders
- `GET /api/work-orders` - List work orders (with filters)
- `GET /api/work-orders/summary` - Work order summary stats
- `GET /api/work-orders/:wo_number` - Work order detail

### MRP
- `GET /api/mrp/summary` - MRP summary
- `GET /api/mrp/items` - MRP items list
- `GET /api/mrp/trend` - MRP trend over time

### Upload
- `POST /api/upload/parse` - Parse uploaded file
- `POST /api/upload/ingest` - Process file with mapping
- `GET /api/upload/templates` - Saved mapping templates
- `GET /api/upload/history` - Upload history

### Data Quality
- `GET /api/data-quality/summary` - Data quality summary
- `GET /api/data-quality/exceptions` - Exception list
- `POST /api/data-quality/exceptions/:id/resolve` - Resolve exception

### Mappings
- `GET /api/mappings/cost-centers` - Cost center mappings
- `POST /api/mappings/cost-centers` - Add/update mapping
- `GET /api/mappings/work-centers` - Work center mappings
- `GET /api/mappings/statuses` - Status configuration

## Configuration

### Environment Variables

**Backend:**
- `NODE_ENV`: Environment (development/production)
- `PORT`: API port (default: 3001)
- `CORS_ORIGIN`: Allowed CORS origin
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL config (production)

**Frontend:**
- `REACT_APP_API_URL`: Backend API URL

## Testing

```bash
# Backend tests
cd backend
npm test

# Run specific test file
npm test -- tests/timeBucketing.test.js
```

## Key Metrics Definitions

### PPLH (Pounds Per Labor Hour)
```
PPLH = SUM(pounds) / SUM(kronos_hours)
```
- Returns `null` if kronos_hours = 0
- Negative pounds (reversals) are included in calculations

### Variance
```
Variance = scanning_hours - kronos_hours
Variance % = (Variance / kronos_hours) * 100
```
- Positive variance: more scanning than labor logged
- Negative variance: less scanning than labor

### Late Work Order
```
Late = NOW() > due_date AND status NOT IN (terminal_statuses)
```
- Terminal statuses are configurable (default: Closed, CLSD, TECO, DLT)
- Status comparison is case-insensitive

## Architecture

```
manufacturing-dashboard/
├── backend/
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Database access
│   │   ├── migrations/      # Database migrations
│   │   └── utils/           # Utility functions
│   └── tests/               # Backend tests
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── ui/          # Reusable UI components
│   │   │   ├── layout/      # Layout components
│   │   │   ├── charts/      # Chart components
│   │   │   └── pages/       # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client
│   │   ├── types/           # TypeScript types
│   │   └── styles/          # CSS and Tailwind
│   └── public/              # Static assets
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
└── docker-compose.yml       # Docker configuration
```

## Design System

Built with Simpson Strong-Tie brand colors:
- **Primary Orange**: #FF5308
- **Black**: #000000
- **Clean white-forward layout**

Components follow WCAG accessibility guidelines:
- Proper color contrast
- Keyboard navigation
- ARIA labels
- Focus indicators

## License

Proprietary - Simpson Strong-Tie
