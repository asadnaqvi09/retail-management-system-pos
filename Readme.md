# Zyro RMS — Project Context for Cursor

> **Read this file first.** It gives every Cursor chat enough context to work without opening `docs/zyro_rms_prd.pdf`.

---

## What We Are Building

**Zyro RMS** is an offline-first **Retail Management System** for a clothing store (Zyro Fashion). It replaces legacy POS software with a modern desktop app: fast billing, accurate variant-level inventory, exchanges, reports, and daily owner visibility.

**Design reference:** [Figma Make — Zyro RMS Desktop](https://www.figma.com/make/bZxTQeWgghK8vLE9LRQZpo/Zyro-RMS-Desktop-App-Design)

Follow the Figma visual language (indigo `#4F46E5`, Inter font, clean SaaS-style UI). Many Figma screens are mockups with broken flows — fix logic while building; keep the design intent.

---

## Tech Stack (Non-Negotiable)

| Layer | Choice |
|-------|--------|
| Language | **JavaScript only** — `.js` / `.jsx`. **No TypeScript.** |
| Backend | Node.js + Express.js |
| Database | **Raw PostgreSQL** via `pg` — **no ORM** (no Sequelize, Prisma, Knex) |
| Frontend | Electron.js desktop + React (JSX) |
| Offline | Hybrid: SQLite in Electron main process + sync to Express/PostgreSQL when online |
| API calls (renderer) | Native **`fetch` only** — no Axios |
| Real-time | Socket.io (when needed) |
| Cache / rate limits | Redis (`ioredis`) |

---

## Architecture

### Hybrid (approved)

```
Electron Renderer (React JSX, Atomic Design)
        ↓ fetch
Express API (Feature-based MVC, raw PostgreSQL)
        ↓
PostgreSQL (primary DB when online)

Electron Main Process
        ↓
SQLite (better-sqlite3) — offline queue + local cache
        ↓ sync when online → Express API
```

### Backend pattern — Feature-based MVC

- One folder per **module** under `server/modules/<module>/`
- Each module has: `*.routes.js`, `*.controller.js`, `*.model.js`, `*.validation.js`
- Business logic lives in **`.model.js`** (not `.service.js`)
- All module routes are registered in **`server/routes/index.js`**
- Parent entry: `server/index.js` or `server/app.js`

**Search and pagination:** There is **no separate search module**. Write search/filter/pagination logic **inside each controller** that needs it.

### Frontend pattern — Atomic Design

```
client/src/
├── atoms/        → Button, Input, Badge, etc.
├── molecules/    → StatCard, CartItem, FormField, etc.
├── organisms/    → Sidebar, CartPanel, DataTable, etc.
├── templates/    → AppLayout, AuthLayout, SettingsLayout
└── pages/        → One page per major screen/module
```

Electron main process (`client/electron/`) owns: SQLite, IPC, printing, hardware, scheduled jobs, offline sync.

---

## V1 Modules (Only These — 20)

Build **only** these modules. Do not add extra module folders.

| # | Module | Server folder | Client page(s) | Notes |
|---|--------|---------------|----------------|-------|
| 1 | **Authentication** | `modules/auth/` | `LoginPage` | Username + PIN/password, RBAC (Admin, Cashier), session lock |
| 2 | **Dashboard** | `modules/dashboard/` | `DashboardPage` | KPIs, charts, low stock, top products, activity feed |
| 3 | **Products** | `modules/products/` | `ProductsPage`, `ProductDetailPage` | Catalog, images, bulk CSV/XLSX import/export |
| 4 | **Categories** | `modules/categories/` | (under Products / Settings) | Nested-ready category tree |
| 5 | **Brands** | `modules/brands/` | (under Products) | Brand CRUD with logo |
| 6 | **Variant Matrix** | `modules/variants/` | (under Product detail) | Color × Size → auto SKU/barcode generation |
| 7 | **Inventory** | `modules/inventory/` | `InventoryPage` | Stock levels, adjustments, movement history |
| 8 | **Customers** | `modules/customers/` | `CustomersPage` | Profiles + purchase history |
| 9 | **POS / Sales** | `modules/sales/` | `POSPage`, `SalesHistoryPage` | Barcode scan, cart, tax, discount, payments, **Hold Cart** lives here |
| 10 | **Exchange & Returns** | `modules/exchanges/` | `ExchangeReturnPage` | Price difference, inventory correction |
| 11 | **Expenses** | `modules/expenses/` | `ExpensesPage` | Operating cost tracking |
| 12 | **Reports** | `modules/reports/` | `ReportsPage` | Sales, inventory, cashier performance — PDF/CSV export |
| 13 | **Cash Register** | `modules/cash-register/` | `CashRegisterModal` (organism) | Open/close shift, cash variance — modal, not full page |
| 14 | **Barcode Labels** | `modules/barcodes/` | (Settings + Products) | Label generation & printing |
| 15 | **PDF Invoice** | `modules/invoices/` | (POS checkout) | Thermal + A4 invoice with barcode/QR |
| 16 | **WhatsApp Daily Summary** | `modules/whatsapp/` | (Settings / jobs) | Scheduled evening business digest |
| 17 | **Keyboard Shortcuts** | *(part of Settings)* | `SettingsPage` | POS speed keys — no separate module folder |
| 18 | **Backup** | `modules/backup/` | (Settings) | Auto daily backup + manual restore |
| 19 | **Settings** | `modules/settings/` | `SettingsPage` | Business info, receipt, tax, users, language, printer, shortcuts |
| 20 | **Seasonal Sale Engine** | `modules/promotions/` | `SeasonalSalesPage` | Date-bound % or fixed discounts by scope |

### Explicitly NOT separate modules

- ~~Search~~ → inline in controllers
- ~~Users~~ → under Auth + Settings
- ~~Hold Cart~~ → under POS / Sales
- ~~Notifications~~ → UI-only or part of Dashboard
- ~~Licenses~~ → deferred / lightweight in Settings if needed later

---

## Repo Layout

```
Retail-Management-System/
├── Readme.md              ← YOU ARE HERE (project context for Cursor)
├── docs/                  ← Full PRD PDF (gitignored) — deep reference only
├── server/                ← Express API
│   ├── index.js
│   ├── app.js
│   ├── routes/index.js    ← mounts all module routes
│   ├── config/
│   ├── middleware/
│   ├── database/          ← pool, migrations/*.sql, seeds
│   ├── modules/           ← 20 modules (see table above)
│   ├── utils/
│   ├── sockets/
│   ├── jobs/
│   └── uploads/
└── client/                ← Electron + React
    ├── electron/          ← main, preload, ipc, db, jobs, printing, hardware, sync
    └── src/               ← Atomic Design React app
```

**Do not follow** the folder structure inside `docs/zyro_rms_prd.pdf` (it uses TypeScript and a different monorepo layout).

---

## Core Business Rules (Every Chat Should Know)

1. **Variant-level inventory** — Every SKU/barcode = one (product, color, size). Stock moves on every sale, return, exchange, adjustment.
2. **Renderer has no business logic** — Discount math, exchange calculations, cash variance → backend `.model.js` or Electron main for offline.
3. **Offline-first** — POS, inventory, reports must work with zero internet. Network is enhancement only (WhatsApp, future cloud sync).
4. **Transactional writes** — Multi-step operations (sale + stock + cash session) in a single DB transaction.
5. **Two roles (V1)** — Admin (full access), Cashier (POS, hold cart, exchanges, cash register — no Settings/Reports/Expenses).
6. **Payments (V1)** — Cash, Card, JazzCash, EasyPaisa, Bank Transfer recorded as metadata only (no live payment gateway).
7. **i18n** — English + Roman Urdu from day one (`client/src/i18n/`).

---

## API Conventions

- Base path: `/api/v1`
- Response shape:
  ```json
  { "success": true, "data": { } }
  { "success": false, "error": "Message" }
  ```
- Auth: JWT in `Authorization: Bearer <token>`
- Pagination (when needed in a controller): `?page=1&limit=20` with `{ data, meta: { page, limit, total } }`

---

## Design Tokens (from Figma / PRD)

| Token | Value |
|-------|-------|
| Primary | `#4F46E5` |
| Background | `#F8F8FA` |
| Foreground | `#0F0F14` |
| Muted text | `#6B6B80` |
| Border | `#E8E8EE` |
| Success | `#16A34A` |
| Warning | `#D97706` |
| Danger | `#DC2626` |
| Font | Inter |

---

## Development Phases (Suggested Order)

1. Database schema + migrations (`server/database/migrations/`)
2. Authentication
3. Products → Categories → Brands → Variant Matrix
4. Inventory
5. POS / Sales (including Hold Cart)
6. Cash Register modal
7. Exchange & Returns
8. Customers + Expenses
9. Reports + Dashboard
10. Seasonal Sale Engine
11. Barcode Labels + PDF Invoice
12. Backup + WhatsApp Summary + Settings (incl. Keyboard Shortcuts)
13. i18n pass + hardware testing (scanner, printer)

---

## Quick Start

### Server
```bash
cd server
cp .env.example .env
# Set DATABASE_URL to your Supabase connection string in .env
npm run migrate
npm run dev
```

### Client
```bash
cd client
cp .env.example .env
npm run dev
```

| Command | Where | Purpose |
|---------|-------|---------|
| `npm run migrate` | `server/` | Run DB migrations + default seed |
| `npm run dev` | `server/` | API with nodemon |
| `npm run dev` | `client/` | Vite + Electron |
| `npm run build` | `client/` | Production renderer build |
| `npm start` | `client/` | Electron with built renderer |

---

## For Cursor Agents

- **Start here:** This `Readme.md` for scope, stack, modules, and rules.
- **Deep dive:** `docs/zyro_rms_prd.pdf` only when you need full FR IDs, DB schema, or acceptance criteria.
- **UI reference:** Figma link above.
- **Do not:** Add TypeScript, ORMs, Axios, or new module folders beyond the 20 listed.
- **Do:** Match existing naming, keep diffs focused, put search/pagination in controllers as needed.
