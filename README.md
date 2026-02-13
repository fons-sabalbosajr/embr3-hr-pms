# EMBR3 HR-PMS (Human Resource Personnel Management System)

> Daily Time Record Management System with Payroll, Employee Management, and Messaging

## Overview

A full-stack web application for managing HR operations including employee records, daily time records (DTR), payslip generation, announcements, real-time messaging, and administrative settings.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Front-End | React 18, Vite 7, Ant Design 5 |
| Back-End | Node.js 20, Express 5 |
| Database | MongoDB (Mongoose ODM) |
| Real-Time | Socket.IO |
| Auth | JWT + bcrypt |
| Email | Nodemailer (SMTP) |
| Process Mgmt | PM2 |
| Web Server | Nginx (reverse proxy) |

## Project Structure

```
embr3-hr-pms/
├── server/              ← Node.js API (Express)
├── front-end/           ← React SPA (Vite)
├── landing/             ← Public landing page (Vite)
├── nginx/               ← Nginx config template
├── agents/              ← AI agent prompts (dev tooling)
├── ecosystem.config.cjs ← PM2 process config
├── render.yaml          ← Render.com blueprint (UAT)
├── DEPLOYMENT-VPS.md    ← VPS deployment guide (Hostinger)
└── DEPLOYMENT-UAT.md    ← Render UAT deployment guide
```

## Key Features

- **Employee Management** — General info, documents, salary, trainings
- **DTR Processing** — Biometric log import, work calendar, leave/overtime requests
- **Payslip Generation** — PDF generation for regular & contract staff, email delivery
- **Real-Time Messaging** — 1:1 and group chats, @mentions, confidential/urgent flags, E2E encryption (AES-256-GCM)
- **Announcements** — Company-wide announcements with scheduling
- **Admin Settings** — User access/roles, deduction types, backup/restore, system maintenance
- **Security** — Encrypted client storage, JWT auth, CORS, Helmet, rate limiting

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Git

### 1. Clone

```bash
git clone https://github.com/<your-org>/embr3-hr-pms.git
cd embr3-hr-pms
```

### 2. Server

```bash
cd server
npm install
cp .env.example .env    # Edit with your values
npm run dev             # Starts on http://localhost:5000
```

### 3. Front-End

```bash
cd front-end
npm install
cp .env.example .env    # Set VITE_API_URL=http://localhost:5000/api
npm run dev             # Starts on http://localhost:5175
```

### 4. Landing Page (optional)

```bash
cd landing
npm install
npm run dev
```

## Deployment

| Target | Guide |
|--------|-------|
| **Hostinger VPS** (Production) | [DEPLOYMENT-VPS.md](DEPLOYMENT-VPS.md) |
| **Render.com** (UAT) | [DEPLOYMENT-UAT.md](DEPLOYMENT-UAT.md) |

## Environment Variables

See the `.env.example` files in each sub-project:

- [server/.env.example](server/.env.example) — API config, DB, auth, email, storage
- [front-end/.env.example](front-end/.env.example) — API URL, encryption secrets

## Documentation

- [Server README](server/README.md) — API endpoints, storage, email, avatar flow
- [Front-End README](front-end/README.md) — Components, secure storage, conventions
- [Landing README](landing/README.md) — Public landing page

## License

Proprietary — EMB Region III

---

*Last updated: 2026-02-13*
