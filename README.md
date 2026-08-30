# HR Nexa — Multi-Tenant HRMS & Payroll Solution

HR Nexa is an enterprise-grade multi-tenant HRMS platform built with NestJS, Prisma ORM, React (Vite), and Tailwind CSS.

---

## 🛠️ Local Development Setup (Native Setup — No Docker)

### System Requirements
- **Node.js**: v20.x+
- **npm**: v10.x+
- **PostgreSQL**: v15+ (Local installation or Cloud PostgreSQL instance)

---

### Quick Start Guide

#### 1. Backend Setup (`/backend`)
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Generate Prisma ORM client
npx prisma generate

# Start backend dev server
npm run start:dev
```
- API Base URL (Dev): `http://localhost:3001/api`
- API Base URL (Prod): `https://api.hrnexa.com/api`
- Swagger Docs (Dev): `http://localhost:3001/api/docs`
- Swagger Docs (Prod): `https://api.hrnexa.com/api/docs`

---

#### 2. Frontend Setup (`/frontend`)
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start frontend dev server
npm run dev
```
- Application Web UI: `http://localhost:5174`

---

## ☁️ Manual Production Deployment Process

HR Nexa follows a step-by-step manual production deployment workflow:

```text
1. git pull origin main             # Fetch latest code
2. npm install                      # Update dependencies
3. npx prisma migrate deploy        # Run database migrations
4. npm run build                    # Compile production bundle
5. pm2 reload hr-nexa-backend       # Zero-downtime process reload
6. curl /health                     # Verify live API health
```
