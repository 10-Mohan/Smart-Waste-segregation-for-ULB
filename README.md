# Waste Segregation Monitoring

A QR-based municipal solid waste tracking and segregation verification system connecting frontline sanitation workers and urban households. Frontline workers scan household QR codes on collection rounds to record segregation quality (Segregated, Mixed, or Rejected), functioning completely offline when connectivity drops and auto-syncing when restored. Citizens access their household dashboard using their QR code and last four mobile digits to track collection logs, segregation streaks, notifications, and earned eco-points.

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

## Install and Run

Install dependencies for all workspaces:
```bash
npm run install:all
```

Start both the client and server concurrently in development mode:
```bash
npm run dev
```
- Client runs on `http://localhost:5173`
- Server API runs on `http://localhost:5000`

To build the client and serve the entire application from Express on a single port:
```bash
npm run start:prod
```

## Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port for the Express API server |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `JWT_SECRET` | Dev placeholder | Secret key for signing authentication tokens (guarded in production) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (set to production client URL in prod) |
| `DB_DIALECT` | `sqlite` | Database dialect (`sqlite` or `postgres`) |
| `DATABASE_URL` | None | Connection string for PostgreSQL in production |
| `CITIZEN_STATUS_RATE_LIMIT_WINDOW_MINUTES` | `15` | Window size for citizen status queries |
| `CITIZEN_STATUS_RATE_LIMIT_MAX` | `30` | Max status queries per window (strict prod default) |
| `REGISTER_RATE_LIMIT_WINDOW_MINUTES` | `60` | Window size for household registration |
| `REGISTER_RATE_LIMIT_MAX` | `5` | Max registrations per window (strict prod default) |

### Client (`client/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base path for backend API endpoints |

## Seeding & Demo Accounts

Reset and reseed the database at any time:
```bash
npm run demo:reset
```

### Demo Worker Account
- **Role**: Sanitation Worker
- **Email**: `worker@demo.in`
- **Password**: `Demo@1234`

### Sample Citizen Household Codes
- `HH-W01-001` (Last 4 digits: `1001`) — Ananya Raman
- `HH-W01-002` (Last 4 digits: `1002`) — Ravi Kumar
- `HH-W01-003` (Last 4 digits: `1003`) — Mahalakshmi Iyer

*(Note: New households can be registered directly at `/citizen`)*

## Running Tests & Quality Checks

Run the backend smoke suite (tests API endpoints, immutability, rate limit headers):
```bash
npm --prefix server run smoke
```

Linting and build verification:
```bash
npm --prefix client run lint
npm --prefix client run build
```

### Automated UI & Validation Checks

The `scripts/checks/` directory contains Puppeteer scripts to validate critical UI functionality:
- `node scripts/checks/axe_audit.js`: Audits all pages for serious/critical ARIA violations.
- `node scripts/checks/responsive_check.js`: Sweeps viewports (360px to 1280px) for horizontal overflow.
- `node scripts/checks/e2e_smoke.js`: Full end-to-end verification of the production build, CSP headers, offline queue sync, and the DEMO.md workflow.

## Mobile Camera Testing (HTTPS)

To test QR code scanning with a physical mobile camera over your local network:
1. Start the Vite dev server with basic SSL:
   ```bash
   npm --prefix client run dev:https
   ```
2. Note the Network IP URL printed in the terminal (e.g., `https://192.168.1.X:5173`).
3. Open this URL on your phone's browser, accept the local self-signed certificate, and grant camera permissions.

## Architecture

```
waste-segregation-monitoring/
├── client/                 # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/     # UI design system & error boundaries
│   │   ├── pages/          # Home, Login, Citizen (/citizen), Worker (/worker)
│   │   ├── services/       # API clients & IndexedDB offline queue
│   │   └── hooks/          # Title, online status, queue sync hooks
└── server/                 # Node.js + Express backend
    ├── src/
    │   ├── models/         # Sequelize models (Household, PickupLog, etc.)
    │   ├── routes/         # REST API routes
    │   ├── middleware/     # Auth, rate limiting, error handling
    │   └── seed/           # Seed datasets & compliance calculation
```

### API Endpoints
- `GET /api/health` — Service health check
- `POST /api/auth/login` — Worker authentication
- `GET /api/wards` — List municipal wards
- `POST /api/citizen/register` — Citizen self-registration
- `GET /api/citizen/status` — Citizen household status, timeline, & points
- `GET /api/worker/households` — Ward households lookup cache
- `POST /api/pickup-logs` — Record pickup log (immutable, idempotent via `clientUuid`)
- `GET /api/pickup-logs/today` — Worker's daily collection activity

### Offline Queue Behaviour
Frontline collections store logs in client IndexedDB (`idb-keyval`) when offline. Requests are queued with a persistent client UUID. As soon as connectivity returns, background sync replays logs sequentially to `/api/pickup-logs`. Server idempotency guarantees duplicate UUIDs are rejected safely without duplicate points.

## Going to Production Checklist

- [ ] Configure PostgreSQL database using `DB_DIALECT=postgres` and `DATABASE_URL`.
- [ ] Set a cryptographically strong `JWT_SECRET` in environment variables.
- [ ] Restrict `CORS_ORIGIN` strictly to the production frontend domain.
- [ ] Enforce production rate limits (`REGISTER_RATE_LIMIT_MAX=5`, `CITIZEN_STATUS_RATE_LIMIT_MAX=30`).
- [ ] Set up SMS provider credentials for real citizen OTP verification.
- [ ] Serve all traffic strictly over HTTPS.
- [ ] Serve static client assets via CDN or directly through Express with reverse-proxy caching.