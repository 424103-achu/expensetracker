# Personal Expense Tracker

Full-stack personal expense tracker with authentication, shared expense settlements, budgets, dashboard insights, realtime updates, CSV export, and group chat per shared expense.

## Tech Stack

- Frontend: React 19, Vite (rolldown-vite), Tailwind CSS, Chart.js, Axios, Socket.IO client
- Backend: Node.js, Express, PostgreSQL, JWT, bcrypt, Socket.IO
- Database: PostgreSQL (schema in [database/schema.sql](database/schema.sql))

## Core Features

- User signup/login with JWT auth and preferred currency
- Personal expense tracking (add, edit, delete)
- Shared expense tracking with equal/custom split
- Debt settlement flows:
   - Repay by participant
   - Mark received by owner
- Budget planning and progress overview
- Dashboard analytics and charts
- Unified transaction history (expenses, shared share, repayments)
- CSV export for transactions
- Realtime updates for shared expenses, settlements, transactions, and chats
- Shared expense group chat:
   - Owner/admin can delete any message
   - Sender can delete own message
   - Chat is auto-ended when all participant debts are cleared
   - Previous messages remain visible after chat ends

## Project Structure

- [backend](backend): Express API, auth, business logic, websocket events
- [frontend](frontend): React UI and realtime client
- [database](database): SQL schema and setup scripts

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+

## Database Setup

1. Create database and user (adjust as needed).
2. Run schema:

```powershell
$env:PGPASSWORD='your_password'; psql -h localhost -U your_db_user -d expensetracker -f "database\schema.sql"
```

## Environment Setup

Create [backend/.env](backend/.env) from [backend/.env.example](backend/.env.example) and update values:

- PORT: backend port (default 5001)
- HOST: use 0.0.0.0 for LAN/hotspot access
- DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT
- JWT_SECRET: strong random secret
- CLIENT_URLS: comma-separated allowed frontend origins

Example:

```env
PORT=5001
HOST=0.0.0.0
DB_USER=sd_lab_user
DB_HOST=localhost
DB_NAME=expensetracker
DB_PASSWORD=your_password
DB_PORT=5432
JWT_SECRET=replace_with_secret
CLIENT_URLS=http://localhost:5173,http://192.168.137.1:5173
```

## Install Dependencies

From project root:

```bash
npm run install:all
```

Equivalent manual commands:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

## Run Locally

From the project root folder myweb/personalexpensetracker:

```bash
npm run dev
```

This starts:

- Backend: http://localhost:5001
- Frontend: http://localhost:5173

## LAN / Hotspot Access

To open frontend on another device:

1. Keep backend HOST as 0.0.0.0.
2. Add your device frontend origin to CLIENT_URLS.
3. Start frontend with host enabled (already configured in Vite).
4. Open `http://<your-ip>:5173` from the other device.

## API Summary

- Auth: /api/auth
- Users: /api/users
- Expenses: /api/expenses
- Budgets: /api/budgets
- Dashboard: /api/dashboard
- Settlements: /api/settlements
- Transactions: /api/transactions
- Chats: /api/chats

## Chat Behavior Notes

- Chat data is stored in `shared_expense_messages` table.
- When no participant has pending debt for a shared expense, chat is marked ended.
- Ended chat blocks sending new messages but still shows full message history.

## Troubleshooting

- If `npm --prefix frontend run dev` fails from a different working directory, run commands from project root myweb/personalexpensetracker.
- If cross-device requests fail, verify CLIENT_URLS and firewall/network profile.
- If schema updates are added later, re-run [database/schema.sql](database/schema.sql).

## Available Scripts

- Root:
   - `npm run dev`: start backend and frontend concurrently
   - `npm run install:all`: install root, backend, and frontend dependencies
- Backend:
   - `npm --prefix backend run dev`
   - `npm --prefix backend run start`
- Frontend:
   - `npm --prefix frontend run dev`
   - `npm --prefix frontend run build`
   - `npm --prefix frontend run preview`

