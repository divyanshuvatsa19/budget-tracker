# AuraBudget — Premium Full-Stack Tracker

A visually stunning glassmorphic personal budget tracker with a **Node.js Express backend** and a **React Vite frontend**. 

The app features dynamic SVG visualizations, category budget limit controls, a real-time searchable transaction ledger, and modal dialog overlays with smooth micro-animations.

---

## Getting Started

Follow these steps to run the application on your system:

### 1. Install Dependencies
In the root directory, run the following command to download and install all packages for both frontend and backend subprojects:
```bash
npm run install-all
```

### 2. Run in Development Mode
To boot up both the frontend client and the backend server concurrently in a single terminal session:
```bash
npm run dev
```
* **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
* **Backend REST API**: [http://localhost:5000](http://localhost:5000)

### 3. Build & Run in Production
To compile the React production bundle and serve it statically from the Express server:
```bash
npm run build:frontend
npm start
```
Once built, you can access the entire application directly on [http://localhost:5000](http://localhost:5000).

---

## Database Slate

The data store is located at `backend/data/db.json` and is currently initialized with **no dummy transactions or budget limits**, ensuring your dashboard starts at exactly `$0.00` across all metrics. The application database schema is:

* **Transactions**: `id`, `description`, `amount`, `type` (`income` | `expense`), `category`, `date`, `notes`.
* **Budgets**: `category`, `limit_amount`, `period` (`monthly`).

---

## API Documentation

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/summary` | `GET` | Compares monthly incomes vs expenses and active budget limits |
| `/api/transactions` | `GET` | Returns list of transactions (supports query filtering: `type`, `category`) |
| `/api/transactions` | `POST` | Adds a new income or expense transaction |
| `/api/transactions/:id` | `PUT` | Updates transaction details |
| `/api/transactions/:id` | `DELETE` | Removes a transaction |
| `/api/budgets` | `GET` | Gets active monthly category limits |
| `/api/budgets` | `POST` | Configures or removes a category budget |
