# LedgerShift — Agent Notes

LedgerShift is a fully self-hosted wholesale payments tracker for Lebanese
wholesalers. There is no Base44 (or any other hosted BaaS) dependency — the
React frontend talks only to the Node/Express backend in `/backend` over JWT
auth.

## Layout

- `/src` — React 18 + Vite frontend (JSX, `@/` alias → `src/`, Tailwind,
  shadcn/radix, react-router-dom v6, bilingual en/ar with RTL).
- `/src/api/backendClient.js` — fetch wrapper that attaches the JWT
  (`localStorage` key `ledgershift_api_token`).
- `/src/api/entities.js` — data layer used by all pages (`db.entities.*`),
  maps between the frontend's snake_case and the API's camelCase.
- `/backend` — Express 4 + TypeScript (CommonJS) + Prisma 6 + PostgreSQL.
  Routes under `/api`, zod-validated inputs, role-based access
  (admin > manager > accountant > viewer).

## Commands

- Frontend dev: `npm run dev` (needs `VITE_API_URL` pointing at the backend).
- Backend dev: `cd backend && npm run dev` (needs `DATABASE_URL`, `JWT_SECRET`).
- Backend tests: `cd backend && npm test` (Jest, money-math coverage).
- Full production build: `npm run build:full` (frontend → `backend/public`).
- Production start: `npm run start:backend`.

## Conventions

- Keep TypeScript types on params/returns in the backend; comment non-trivial
  functions briefly.
- Never trust client data: validate with zod on the backend even when the
  frontend validates too.
- The backend recomputes invoice totals server-side; the frontend's
  `computeInvoiceTotals` is for live preview only.
