# Manufacturing Dashboard

Full-stack manufacturing analytics dashboard with real-time KPI tracking, CSV/Excel data import, and interactive Chart.js visualizations. Express backend with React frontend.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Create React App |
| Backend | Node.js + Express |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | Knex.js query builder |
| Charts | Chart.js + react-chartjs-2 |
| Styling | Tailwind CSS 3 |
| Testing | Jest + Supertest (backend), React Testing Library (frontend) |


## Features

- **KPI Dashboard** — Real-time manufacturing metrics with interactive Chart.js visualizations
- **Data Import** — Upload CSV and Excel files for bulk data ingestion
- **Production Tracking** — Monitor production lines, throughput, and efficiency
- **Quality Metrics** — Track defect rates, yield, and quality trends
- **RESTful API** — Express-based API with validation and error handling
- **Mock Data Generation** — Script to generate realistic test data for development


## Getting Started

### Prerequisites

- Node.js 18+

### Installation

```bash
git clone https://github.com/timjeromeadams1109/manufacturing-dashboard.git
cd manufacturing-dashboard
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

| Variable | Description |
|----------|-------------|
| `PORT` | Backend server port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string (production) |
| `NODE_ENV` | Environment: development or production |

### Run

```bash
npm run dev
```


## Project Structure

```
manufacturing-dashboard/
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   └── utils/         # Helper functions
│   └── public/            # Static assets
├── backend/
│   ├── src/
│   │   ├── routes/        # Express route handlers
│   │   ├── models/        # Database models
│   │   └── middleware/    # Express middleware
│   ├── migrations/        # Knex migrations
│   └── seeds/             # Seed data
└── scripts/               # Data generation scripts
```


## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | react-scripts start |
| `npm run build` | react-scripts build |
| `npm run test` | react-scripts test |
| `npm run eject` | react-scripts eject |


## Deployment

**Frontend**: Can be deployed to any static host (Netlify, Vercel, S3).
**Backend**: Deploy to any Node.js host (Railway, Render, EC2).

For local development:
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm start
```


## Links

- [GitHub](https://github.com/timjeromeadams1109/manufacturing-dashboard)


## License

MIT

---
*Auto-generated from project.meta.json — do not edit manually.*
