# AI Powered Gym Management SaaS Platform — Backend

Production-grade Node.js / Express / TypeScript / MongoDB backend for a multi-branch, multi-tenant AI-powered Gym Management SaaS.

---

## 🏗️ Architecture Summary

- **Layered Pattern**: `Route → Validator (Zod) → Controller → Service → Model (Mongoose) → Database`
- **Multi-Tenancy**: Hierarchy: `Gym (Organization) → Branch → Members/Trainers/...`
- **Strict Role-Based Access Control (RBAC)**: `SUPER_ADMIN`, `GYM_OWNER`, `BRANCH_MANAGER`, `TRAINER`, `MEMBER`.
- **Validation**: Zod schema validation on `body`, `query`, and `params`.
- **API Response Envelope**:
  - Success: `{ success: true, data: <payload>, message?: string, meta?: { pagination } }`
  - Error: `{ success: false, error: { code: string, message: string, details?: any } }`

---

## 🚀 Environment Setup & Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

4. **Type Check**:
   ```bash
   npm run type-check
   ```

5. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

---

## 📂 Module Execution Sequence

1. `01-project-setup` ✅ (Base Scaffolding & Architecture)
2. `02-auth-user` (User & Auth Module)
3. `03-gym-branch` (Gym & Branch Multi-Tenancy Core)
4. `04-member-trainer` (Member & Trainer Profiles)
5. `05-attendance-qr` (QR Check-in/out Workflow)
6. `06-workout-diet` (Workout Plans, Exercises, Logs & Diet)
7. `07-progress-gamification` (Progress, Streaks, XP, Badges, Leaderboards)
8. `08-payment-subscription` (Subscriptions & Invoices)
9. `09-ai-coach` (AI Recommendations, Chatbot, Injury Detection)
10. `10-notification` (FCM Push Notifications)
11. `11-reports-analytics` (Analytics Dashboard & PDF Export)
