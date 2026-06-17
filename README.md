# MediConnect – SaaS Medicine Redistribution & NGO Logistics Platform

MediConnect is a production-quality, secure SaaS-style web platform designed to eliminate medicine waste by facilitating logistics between surplus pharmaceutical/donor inventories and verified NGO distribution demands. 

The application utilizes transaction-safe algorithms to handle batch allocations and provides logistics tracking with a clean, high-performance UI.

---

## 🚀 Tech Stack

### Frontend Client
* **Framework**: React 19 + Vite 8
* **Styling**: Tailwind CSS v4 + PostCSS (Inter typography and modern design patterns)
* **Routing**: React Router DOM v7 (SPA routing with route protection guards)
* **Analytics**: Recharts (interactive dashboards for global stats and top medicines)
* **API Client**: Axios (with global JWT interceptors)
* **Notifications**: SweetAlert2 (confirmations and FEFO allocation preview listings)

### Backend Services
* **Runtime**: Node.js + Express
* **Database Driver**: `pg` (node-postgres with pooling configurations)
* **Authentication**: JWT (JSON Web Tokens) with role-based routing middleware
* **Security**: Bcrypt password hashing, request validation, and environment hardening

### Database Layer
* **DBMS**: PostgreSQL
* **Schema Assets**: Stored procedures, PL/pgSQL database functions, relational triggers, and index optimizations
* **FEFO Allocation Engine**: Automatic batch splitting with earliest-expiry batches deducted first. Powered by `SELECT ... FOR UPDATE` locks inside strict database transactions to guarantee concurrency safety.

---

## 📁 Repository Structure

```
medi-connect/
├── backend/
│   ├── controllers/      # Route handler controllers (analytics, dashboards)
│   ├── middleware/       # JWT auth & role-based validation middleware
│   ├── routes/           # REST API endpoints (users, medicines, transfers)
│   ├── utils/            # DB scripts, FEFO allocation services, migration files
│   ├── db.js             # Centralized PostgreSQL connection pool settings
│   ├── server.js         # Entry point for backend API server
│   └── .env.example      # Environment variables template
│
├── frontend/
│   ├── src/
│   │   ├── components/   # Shared layout elements (Navbar, Sidebar)
│   │   ├── context/      # AuthState & user session managers
│   │   ├── pages/        # Main screens (Dashboards, Claim lists, Trackers)
│   │   ├── services/     # Axios base configuration
│   │   └── main.jsx      # App entry point
│   ├── public/           # Static public assets
│   ├── tailwind.config.js
│   └── vite.config.js    # Vite compilation config
│
└── README.md
```

---

## ⚙️ Environment Variables Setup

Create a file named `.env` in the `backend/` directory based on the `backend/.env.example` template:

```ini
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_signing_key_here

# Option A: Full Connection String (Recommended for Cloud PostgreSQL/Supabase/Neon)
DATABASE_URL=postgresql://postgres:password@localhost:5432/mediconnect

# Option B: Individual PostgreSQL parameters
PGHOST=localhost
PGPORT=5432
PGDATABASE=mediconnect
PGUSER=postgres
PGPASSWORD=your_password_here

# Connection pool configurations
PGMAXPOOL=10
PGIDLETIMEOUT=30000
PGCONNECTTIMEOUT=2000
```

---

## 💻 Local Development Setup

### Prerequisite
* PostgreSQL instance running locally or in the cloud.
* Node.js v18+ installed.

### 1. Database Setup
Create a database named `mediconnect` and initialize it by loading the schema, triggers, and seed scripts:
```bash
# Initialize schema, triggers, and basic seed data
psql -U postgres -d mediconnect -f seed_data.sql

# Run phase updates (V2, V3, and V4 updates)
psql -U postgres -d mediconnect -f backend/utils/migration_v3.sql
psql -U postgres -d mediconnect -f backend/utils/migration_v4.sql
```

### 2. Start the Backend API
```bash
cd backend
npm install
npm run dev
```
The server will start running at `http://localhost:5000/`.

### 3. Start the Frontend Client
```bash
cd frontend
npm install
npm run dev
```
The dev client will launch at `http://localhost:5173/`.

---

## ☁️ Cloud Deployment Instructions

### 1. Database Deployment (Supabase / Neon)
1. Provision a database on Supabase or Neon.
2. Run the SQL initialization script `seed_data.sql` followed by `migration_v3.sql` and `migration_v4.sql` in the SQL Editor of your provider.
3. Retrieve your **Connection String** (`DATABASE_URL`).
4. *Important*: If deploying to a managed database requiring SSL, ensure `rejectUnauthorized: false` is configured under SSL options (this is pre-configured in `backend/db.js`).

### 2. Backend Deployment (Render / Railway)
1. Link your GitHub repository to Render or Railway.
2. Select the Environment type: **Web Service**.
3. Set the Root Directory to `backend/`.
4. Configure the Build Command: `npm install`.
5. Configure the Start Command: `npm run start` (or `node server.js`).
6. Add the following **Environment Variables**:
   - `DATABASE_URL` (Your cloud connection string)
   - `JWT_SECRET` (A strong random string)
   - `NODE_ENV=production`

### 3. Frontend Deployment (Vercel)
1. Create a project on Vercel.
2. Link your repository.
3. Set the Root Directory to `frontend/`.
4. Configure build settings:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Configure the **Environment Variable**:
   - `VITE_API_URL` (Point this to your hosted backend URL, e.g. `https://your-backend.onrender.com`)

---

## 🛡️ Security Best Practices
- **No `.env` files in Git**: Staging excludes all credentials using rules defined in `.gitignore`.
- **JWT Key Extraction**: JWT signing secrets are fully externalized via standard environments.
- **Transactional Row Locks**: Double allocations and transaction leaks are mitigated with concurrency checks and sequential locking during batch processing.
