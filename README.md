# GYM AI SaaS — All-in-One AI-Powered Gym Management Platform

A production-grade, full-stack multi-tenant Gym Management SaaS platform built with TypeScript, Node.js, Express, MongoDB, and React.

---

## 🚀 Key Features

- **Multi-Tenant & Multi-Branch Architecture**: Manage multiple gyms, branches, and franchises with strict organization-level isolation.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions across 6 roles:
  - `SUPER_ADMIN`: Global platform oversight, gym approvals, SaaS inquiries.
  - `GYM_OWNER`: Organization-wide analytics, branch comparisons, billing, staff control.
  - `BRANCH_MANAGER`: Branch operations, member oversight, capacity tracking.
  - `TRAINER`: Client assignment, workout/diet plan creation, session tracking.
  - `RECEPTIONIST`: Fast QR check-in scanner, walk-in registrations, invoice collection.
  - `MEMBER`: Personal dashboard, QR pass, AI fitness coach, workout & diet tracking, progress logs.
- **Fast QR Check-in & Attendance**: Real-time receptionist scanner, automated check-in timestamps, monthly attendance heatmaps, and streak tracking.
- **AI-Powered Fitness & Nutrition**: AI workout plan generation, custom macro/diet plans, 24/7 in-app conversational AI coach, and recovery recommendations.
- **Gamification & Retention**: Workout streaks, attendance points, milestone badges, and gym-wide leaderboards.
- **POS & Merchandise Inventory**: Manage protein supplements, gear, and drinks with quick front-desk billing.
- **Financial Accounting & Invoicing**: Automated branded PDF invoices, split/partial payments, and comprehensive overhead expense tracking (rent, electricity, salaries).
- **Business Analytics**: Real-time revenue reports, retention/churn metrics, peak-hour heatmaps, and one-click PDF report generation.

---

## 🛠️ Technology Stack

### Backend
- **Runtime & Language**: Node.js, TypeScript
- **Framework**: Express.js
- **Database & ODM**: MongoDB, Mongoose
- **Validation**: Zod schema validation
- **Security**: Helmet, Rate Limiting, Mongo Sanitize, BcryptJS, JWT
- **Testing**: Jest, Supertest, Mongo Memory Server

### Frontend
- **Framework & Language**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Routing**: React Router v7
- **Icons & UI**: Lucide React, Sonner (Toasts), clsx

---

## 📂 Project Structure

```
gym_ai_SaaS/
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── common/           # Middleware, utils, constants, error handlers
│   │   ├── config/           # Database, env configs
│   │   ├── modules/          # Domain-driven feature modules
│   │   │   ├── aiCoach/      # AI fitness coach & chatbot
│   │   │   ├── attendance/   # QR check-in & heatmaps
│   │   │   ├── auth/         # JWT authentication & password reset
│   │   │   ├── diet/         # Diet plans & nutrition
│   │   │   ├── expense/      # Operational expense management
│   │   │   ├── gamification/ # Badges, streaks, leaderboards
│   │   │   ├── gym/          # Gyms, branches & trial engine
│   │   │   ├── member/       # Member CRM & profiles
│   │   │   ├── notification/ # Push & renewal alerts
│   │   │   ├── payment/      # Subscriptions & invoices
│   │   │   ├── product/      # Pro-shop & inventory POS
│   │   │   ├── progress/     # Body metrics & weight logs
│   │   │   ├── report/       # Analytics & PDF exporter
│   │   │   ├── saasInquiry/  # B2B trial inquiries
│   │   │   ├── trainer/      # Trainer rosters & ratings
│   │   │   ├── user/         # Privacy & GDPR exports
│   │   │   └── workout/      # Workout routines & exercise library
│   │   └── scripts/          # Database seed scripts
│   └── tests/                # Unit and integration test suites
│
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI & role-specific widgets
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Role pages (Admin, Owner, Trainer, Reception, Member, Auth)
│   │   ├── store/            # Zustand global stores
│   │   └── types/            # Shared TypeScript interfaces
│   └── index.html
│
└── .gitignore
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB running locally or MongoDB Atlas connection URI

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env     # Configure your MONGO_URI and JWT_SECRET
npm run dev              # Runs on http://localhost:5000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev              # Runs on http://localhost:5173
```

---

## 🧪 Running Tests & Checks

```bash
# Backend tests
cd backend
npm test

# Backend type check
npm run type-check

# Frontend type check
cd ../frontend
npx tsc --noEmit
```

---

## 📄 License
ISC License
