# Manufacturing Dashboard — Claude Code Context

## What This Is
A manufacturing performance analytics dashboard for an Inland Empire fabrication client — tracks production metrics, KPIs, and operational data with charts and data import.

## Stack
- **Frontend**: React 18 (CRA), TypeScript, Tailwind CSS v3, Chart.js (react-chartjs-2), React Router v6, React Table, HeadlessUI
- **Backend**: Express.js (Node), Helmet, Morgan, express-validator
- **Database**: SQLite (dev) / PostgreSQL (prod) via Knex.js
- **Data Import**: CSV (csv-parse), Excel (xlsx), file upload (Multer)
- **Testing**: Jest + Supertest (backend)
- **Containerization**: Docker (see `docker/` and `docker-compose.yml`)

## Rules for This Repo
- **CLIENT PROJECT** — all changes require Tim's approval
- Frontend: `cd frontend && npm install && npm start`
- Backend: `cd backend && npm install && npm run dev`
- DB migrations: `cd backend && npm run migrate` (rollback: `npm run migrate:rollback`)
- Seed data: `cd backend && npm run seed`
- Sample data in `sample-data/` directory
- Docker: `docker-compose up` for full stack
- Backend tests: `cd backend && npm test`
- Keep frontend and backend dependencies separate — they have independent package.json files

## Maven Context
This is a Studio Tim client project managed by the Maven agent system.
Client: Inland Empire fabrication | Operator: Tim Adams | Studio Tim
