# 🔷 Team Structure (MERN-Based Modular Split)

## 👤 Member 1 — Backend Lead (Core API & Business Logic)

**Primary Stack:** Node.js + Express.js + MongoDB

### Responsibilities:

* Design REST APIs for:

  * Ratings (create/update/delete)
  * Trust score calculation
  * Reviews/comments
* Implement business logic:

  * Rating aggregation (average, weighted score)
  * Trust score algorithm (e.g., based on history, authenticity)
* Define MongoDB schemas:

  * User
  * Rating
  * Review
  * TrustScore
* Handle data validation & middleware
* API documentation (Postman / Swagger)

### Deliverables:

* Express server
* API endpoints
* Database schema

---

## 👤 Member 2 — Frontend Lead (UI/UX + Integration)

**Primary Stack:** React.js

### Responsibilities:

* Build UI components:

  * Rating UI (stars, sliders, etc.)
  * Review submission form
  * Trust score display dashboard
* Manage state (Redux / Context API)
* Integrate APIs from backend
* Handle form validation & UX
* Responsive design

### Deliverables:

* React components
* API integration
* User interaction flows

---

## 👤 Member 3 — Authentication & Security + Middleware

**Primary Stack:** Node.js + JWT + Security Layer

### Responsibilities:

* Implement:

  * User authentication (JWT)
  * Role-based access (admin/user)
* Secure APIs:

  * Rate limiting
  * Input sanitization
* Prevent:

  * Fake reviews
  * Duplicate ratings
* Logging & error handling

### Deliverables:

* Auth system
* Middleware layer
* Security policies

---

## 👤 Member 4 — DevOps + Data + Testing + Integration

**Primary Stack:** MongoDB + Deployment + Testing Tools

### Responsibilities:

* Database setup & optimization:

  * Indexing
  * Query optimization
* Integration:

  * Connect frontend + backend
* Testing:

  * Unit tests (Jest)
  * API testing
* Deployment:

  * Backend (Render / Railway)
  * Frontend (Vercel / Netlify)
* Monitor performance

### Deliverables:

* Deployed system
* Test cases
* Integration pipeline
