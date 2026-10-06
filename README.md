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

### Database Seeding Commands
- **`npm run demo:reset`**: Clears and reseeds the database with the baseline data *plus* ~150 historical pickup logs over the past 60 days (`--history` flag). This creates realistic compliance trends, ward comparisons, and repeat offender hotspots for the staff dashboard demonstration.
- **`npm run seed -- --reset`** (or `npm --prefix server run seed -- --reset`): Clears and reseeds the baseline dataset only (8 households, 28 pickup logs). Used for clean, predictable automated test runs like `npm --prefix server run smoke`.

### User Roles & Access Matrix

| Role | Interface Route | Access Scope | Authentication |
|---|---|---|---|
| **Frontline Worker** (`worker`) | `/worker` | Assigned ward households, daily pickup logging, offline queue, QR labels | Email + Password |
| **Ward Supervisor** (`supervisor`) | `/dashboard` | Scoped strictly to their own assigned ward (Ward 1) | Email + Password |
| **ULB Administrator** (`ulb_admin`) | `/dashboard` | Municipal-wide overview across all wards with ward filter dropdown | Email + Password |
| **Citizen / Household** | `/citizen` | Household compliance status, collection timeline, eco-points, in-app messages | None (QR Code + Last 4 phone digits) |

### Demo Accounts (Dev / Demo Only)
- **Worker**: `worker@demo.in` / `Demo@1234` (Assigned to Ward 1 - Central)
- **Supervisor**: `supervisor@demo.in` / `Demo@1234` (Assigned to Ward 1 - Central)
- **Admin**: `admin@demo.in` / `Demo@1234` (Municipal-wide ULB Admin)

### Sample Citizen Household Codes
- `HH-W01-001` (Phone last 4: `1001`) — Ananya Raman (Ward 1)
- `HH-W01-002` (Phone last 4: `1002`) — Ravi Kumar (Ward 1)
- `HH-W01-003` (Phone last 4: `1003`) — Mahalakshmi Iyer (Ward 1)
- `HH-W01-004` (Phone last 4: `1004`) — Suresh Nair (Ward 1)
- `HH-W01-005` (Phone last 4: `1005`) — Fathima Begum (Ward 1)
- `HH-W02-001` (Phone last 4: `2001`) — Arjun Selvan (Ward 2)
- `HH-W02-002` (Phone last 4: `2002`) — Lakshmi Devi (Ward 2)
- `HH-W02-003` (Phone last 4: `2003`) — Imran Khan (Ward 2)

*(Note: Citizens can also register new households on the fly at `/citizen`)*

## ULB Dashboard

The ULB Staff Dashboard (`/dashboard`) is a dedicated analytics and monitoring console for municipal administrators and ward supervisors to track segregation compliance and target corrective actions. Access is strictly role-scoped: supervisors only view data from their assigned ward, while ULB admins have a cross-ward overview.

### Features & Visualizations
- **Summary Metrics**: Real-time KPI stat cards displaying total pickups, segregation compliance percentage, segregated pickups, mixed pickups, rejected pickups, and period-over-period trend comparisons. Note: the dashboard deliberately displays **no points** (compliance only).
- **Date Presets & Filtering**: Filter by Last 7 days, Last 30 days, Last 90 days, or a custom date range. Admin view includes a ward selector dropdown.
- **Ward Comparison**: Visual side-by-side progress bars comparing compliance percentages across wards with Good (>=70%), Moderate (40-69%), and Poor (<40%) status indicators.
- **Compliance Trend**: Custom inline accessible SVG line chart tracking compliance over time, with Day/Week granularity toggle.
- **Ward Compliance Heatmap**: A cross-ward matrix showing week-by-week compliance trends color-coded with accessible contrast tokens.
- **Repeat Offenders (Hotspots)**: Ranked list of chronic non-compliant households showing household code, owner name, ward, violation count, and most common violation reason.
- **Violations Log**: Paginated real-time log of every mixed and rejected pickup with timestamp, household code, ward, worker name, and logged rejection reason.
- **Rejection Reasons Breakdown**: Inline SVG horizontal bar chart displaying the frequency of each rejection reason (e.g., hazardous waste, sanitary waste, mixed wet/dry).
- **Swachh Bharat Mission (SBM) CSV Export**: One-click export downloading filtered compliance data in standard municipal CSV format.

## Running Tests & Quality Checks

Run the backend smoke suite (tests API endpoints, role-scoping, immutability, rate limit headers):
```bash
npm --prefix server run smoke
```

Linting and build verification:
```bash
npm --prefix client run lint
npm --prefix client run build
```

### Quality & End-to-End Validation Scripts (`scripts/checks/`)

The repository includes a suite of automated Puppeteer checks for accessibility, responsiveness, and end-to-end functionality:

- **Axe Accessibility Audit**:
  ```bash
  node scripts/checks/axe_audit.js
  ```
  Runs `@axe-core/puppeteer` across all pages (Home, Login, Citizen portal tabs, Worker tabs, Worker labels, and Admin/Supervisor dashboards) verifying zero serious or critical WCAG 2 AA violations.

- **Responsive Viewport Sweep**:
  ```bash
  node scripts/checks/responsive_check.js
  ```
  Sweeps viewports (360px, 375px, 412px, 768px, and 1280px) across all views to ensure no unintended horizontal overflow.

- **End-to-End Production Smoke & Demo Walkthrough**:
  ```bash
  node scripts/checks/e2e_smoke.js
  ```
  Comprehensive end-to-end test verifying production asset builds, CSP headers, SPA fallback on hard refreshes, QR code canvas generation, print labels, offline IndexedDB queueing with automatic network recovery, citizen streak bonus mechanics, and both Admin & Supervisor dashboard flows.

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
│   │   ├── components/     # UI kit (Button, Card, Badge, Tabs, Modal, etc.)
│   │   ├── pages/          # Home, Login, Citizen (/citizen), Worker (/worker), Dashboard (/dashboard)
│   │   ├── services/       # API services & IndexedDB offline queue
│   │   └── hooks/          # useDashboard, useOnlineStatus, useQueueSync, useDocumentTitle
├── server/                 # Node.js + Express backend
│   ├── src/
│   │   ├── models/         # Sequelize SQLite models (Ward, User, Household, PickupLog, etc.)
│   │   ├── routes/         # REST API routes (auth, citizen, dashboard, household, pickup, ward)
│   │   ├── controllers/    # Route controllers & CSV streaming
│   │   ├── middleware/     # Auth, role-scoping, rate limiting, error handling
│   │   └── seed/           # Seed datasets with optional --history simulation
└── scripts/
    └── checks/             # axe_audit.js, responsive_check.js, e2e_smoke.js
```

### API Endpoints
- `GET /api/health` — Service health check
- `POST /api/auth/login` — Staff authentication (worker, supervisor, ulb_admin)
- `GET /api/auth/me` — Current authenticated session user profile
- `GET /api/wards` — List municipal wards
- `POST /api/citizen/register` — Citizen self-registration (rate-limited)
- `GET /api/citizen/status` — Citizen household status, timeline, & points (rate-limited)
- `GET /api/citizen/wards` — Public ward list for registration
- `GET /api/households` — Ward households lookup cache
- `GET /api/households/by-qr/:code` — Look up household by QR code string
- `GET /api/households/:id/qr` — Printable QR code SVG payload
- `POST /api/pickup-logs` — Record pickup log (immutable, idempotent via `clientUuid`)
- `POST /api/pickup-logs/batch` — Bulk offline pickup synchronization
- `GET /api/pickup-logs/today` — Worker's daily collection activity
- `GET /api/dashboard/summary` — Overview metrics, totals, compliance %, and period trends
- `GET /api/dashboard/wards` — Ward-by-ward compliance comparison
- `GET /api/dashboard/trends` — Daily or weekly compliance trend timeline
- `GET /api/dashboard/hotspots` — Repeat offender households with highest violation counts
- `GET /api/dashboard/violations` — Paginated list of recent mixed and rejected collections
- `GET /api/dashboard/reasons` — Rejection reasons aggregated breakdown
- `GET /api/dashboard/export.csv` — SBM compliance data download (role-scoped)

### Offline Queue Behaviour
Frontline collections store logs in client IndexedDB (`idb-keyval`) when offline. Requests are queued with a persistent client UUID. As soon as connectivity returns, background sync replays logs sequentially to `/api/pickup-logs`. Server idempotency guarantees duplicate UUIDs are rejected safely without duplicate points or double counts.

## Going to Production Checklist

- [ ] Configure PostgreSQL database using `DB_DIALECT=postgres` and `DATABASE_URL`.
- [ ] Set a cryptographically strong `JWT_SECRET` in environment variables.
- [ ] Restrict `CORS_ORIGIN` strictly to the production frontend domain.
- [ ] Enforce production rate limits (`REGISTER_RATE_LIMIT_MAX=5`, `CITIZEN_STATUS_RATE_LIMIT_MAX=30`).
- [ ] Set up SMS provider credentials for real citizen OTP verification.
- [ ] Serve all traffic strictly over HTTPS.
- [ ] Serve static client assets via CDN or directly through Express with reverse-proxy caching.