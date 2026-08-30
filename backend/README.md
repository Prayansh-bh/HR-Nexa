# HR Nexa — Backend (Native Node.js & NestJS Setup)

HR Nexa is a multi-tenant Human Resource Management System (HRMS) built with NestJS, Prisma ORM, and PostgreSQL.

---

## 🚀 Local Development Setup (Native — No Docker Required)

### Prerequisites
- **Node.js**: v20.x or higher
- **Package Manager**: npm v10.x+
- **Database**: PostgreSQL v15+ (Local installation or Cloud PostgreSQL such as AWS RDS / Neon)

---

### Step-by-Step Native Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables (`.env`)**
   Create a `.env` file inside `backend/` with native PostgreSQL credentials:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/hrms_db?schema=public"
   JWT_SECRET="your_jwt_secret_key"
   JWT_EXPIRATION="24h"
   PORT=3001
   NODE_ENV="development"
   STORAGE_DRIVER="local" # or "s3"
   ```

3. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

4. **Database Schema Sync**
   ```bash
   npx prisma db push
   ```

5. **Start Development Server**
   ```bash
   npm run start:dev
   ```

The API will be live at:
- **Base API:** `http://localhost:3001/api`
- **Swagger Documentation:** `http://localhost:3001/api/docs`
- **Health Check:** `http://localhost:3001/health`

---

## ☁️ Production Manual Deployment Guide (AWS EC2 + PM2 + AWS RDS)

HR Nexa uses a controlled **Manual Production Deployment Process** (Build ➔ Migration ➔ PM2 Restart ➔ Health Verification):

### 1. SSH into EC2 Production Server
```bash
ssh -i /path/to/key.pem ubuntu@api.hrnexa.com
```

### 2. Pull Latest Source Code
```bash
cd /var/www/hrNexa/backend
git pull origin main
```

### 3. Install Dependencies & Generate Prisma ORM Client
```bash
npm install
npx prisma generate
```

### 4. Execute Database Schema Migrations (AWS RDS)
```bash
npx prisma migrate deploy
```

### 5. Build Production Application
```bash
npm run build
```

### 6. Reload PM2 Process Manager with Zero Downtime
```bash
pm2 reload hr-nexa-backend --update-env
```

### 7. Verify Health Status
```bash
curl -f http://localhost:3001/health
```

Expected Response:
```json
{
  "status": "ok",
  "subsystems": {
    "api": { "status": "up" },
    "database": { "status": "up", "driver": "PostgreSQL" },
    "storage": { "status": "up", "driver": "s3" }
  }
}
```
