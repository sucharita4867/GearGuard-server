# GEARGUARD

## Project Overview

**GEARGUARD** is a full‑stack **Corporate Asset Management System** designed to help organizations manage company assets, employees, and asset distribution efficiently. It provides role‑based access for HR and Employees, secure authentication, asset tracking, request management, and subscription‑based employee limits.

---

## Purpose

The main goal of GEARGUARD is to **digitize and simplify corporate asset management**, reduce manual tracking errors, and provide real‑time visibility of assets, employees, and usage statistics.

---

##  Live Project Links

- **Client (Frontend):** [https://shimmering-gumption-36f8c4.netlify.app]
- **Server (Backend API):** [https://gear-guard-server.vercel.app]

---

##  Key Features

###  Authentication & Authorization

- Firebase Authentication (Email/Password & Google Login)
- JWT‑based secure API access
- Role‑based access control (HR & Employee)

###  HR Features

- Add, update, and delete company assets
- View asset availability and statistics
- Approve or reject asset requests
- Manage employees and team affiliations
- Track assigned and returned assets
- Upgrade subscription packages via Stripe

###  Employee Features

- View available assets
- Request assets
- View assigned assets
- Return assets
- View company/team affiliations

###  Analytics & Dashboard

- Asset type distribution (Returnable / Non‑returnable)
- Top requested assets chart
- Employee usage vs package limit overview

###  Payment System

- Stripe Checkout integration
- Subscription‑based employee limits
- Payment history tracking

---

##  Technologies Used

### Frontend

- React
- React Router DOM
- TanStack React Query
- Axios
- Tailwind CSS
- DaisyUI
- Framer Motion
- Recharts
- SweetAlert2

### Backend

- Node.js
- Express.js
- MongoDB
- JWT (jsonwebtoken)
- Stripe
- Multer
- Axios
- dotenv
- CORS

### Authentication & Hosting

- Firebase Authentication
- Netlify (Frontend Hosting)
- Vercel (Backend Hosting)

---

##  NPM Packages Used 

```bash
# Frontend
react
react-router-dom
@tanstack/react-query
axios
framer-motion
recharts
sweetalert2
firebase

# Backend
express
mongodb
jsonwebtoken
dotenv
cors
stripe
multer
axios
form-data
```

---

##  Setup Instructions

###  Clone the Repository

```bash
git clone <your-repository-url>
cd GEARGUARD
```

---

###  Frontend Setup

```bash
cd client
npm install
npm run dev
```

---

###  Backend Setup

```bash
cd server
npm install
nodemon index.js
```

Server will run at:

```
http://localhost:3000
```

---

##  Environment Variables Configuration

### Frontend `.env`

```env
VITE_API_URL=https://gear-guard-server.vercel.app
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

### Backend `.env`

```env
PORT=3000
DB_USER=your_mongodb_user
DB_PASS=your_mongodb_password
JWT_SECRET=your_jwt_secret
STRIPE_SECRET=your_stripe_secret_key
IMGBB_KEY=your_imgbb_api_key
SITE_DOMAIN=https://shimmering-gumption-36f8c4.netlify.app
```

 

✅ _GEARGUARD – Smart, Secure & Scalable Corporate Asset Management System_
