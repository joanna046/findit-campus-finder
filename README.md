# FindIt: Smart Lost-and-Found Management System

A campus web application that brings lost-item reporting, discovery, ownership claims and administrator review into one traceable workflow. Built with **React**, **FastAPI** and **MySQL**, and deployed on **Google Cloud**.

**Live site:** https://findit-frontend-71315479004.asia-south1.run.app
**API:** https://findit-backend-71315479004.asia-south1.run.app
**API docs (Swagger):** https://findit-backend-71315479004.asia-south1.run.app/docs
**Health check:** https://findit-backend-71315479004.asia-south1.run.app/api/health

---

## The Problem

Campus lost-and-found is fragmented. Reports are scattered across WhatsApp groups, noticeboards and informal records. Students have no searchable, photo-supported place to publish or find items, and verifying ownership is difficult when claims, evidence and decisions are not tracked together. There is little visibility and no audit trail.

## The Solution

FindIt turns the process into one traceable service:

| Step | What happens |
|------|--------------|
| **Report** | A registered user submits a lost or found item with details and an optional photo. |
| **Discover** | Users search and browse listings. |
| **Claim** | A user submits a written proof-of-ownership claim and follows its status in *My Reports*. |
| **Review** | An administrator approves or rejects the claim, and the decision is recorded. |

---

## Features

- User registration and login with JWT-based sessions
- Report lost or found items with type, description, category, location, date and photo
- Browse and search item listings with status cues
- Submit ownership claims with a written proof message
- *My Reports* view showing submitted items, claims and outcomes
- Admin-only claim review (approve or reject)
- Private photo storage in Google Cloud Storage
- Automated build and deploy pipeline

---

## Architecture

```
Browser
   │
   ▼
React frontend (Cloud Run: findit-frontend)
   │  API calls
   ▼
FastAPI backend (Cloud Run: findit-backend) ──► Cloud Storage (private photo bucket)
   │  SQL
   ▼
MySQL 8.4 on Cloud SQL (findit-db)
```

All services run in **asia-south1 (Mumbai)**.

- The browser talks only to the frontend and the API.
- Photos are uploaded **through the backend** (never directly from the browser) into a private Cloud Storage bucket. Only an `image_key` reference is stored in MySQL.
- Cloud Run containers are stateless. Cloud SQL and Cloud Storage hold all state.

### CI/CD

```
GitHub → Cloud Build → Artifact Registry → Cloud Run
```

Every push to `main` triggers Cloud Build, which builds the container image, pushes it to Artifact Registry and deploys it to Cloud Run. After each deploy, `/api/health` and `/docs` are used to confirm the new revision is serving.

### Cloud service models

- **IaaS:** Cloud Storage (object storage). No virtual machines are provisioned.
- **PaaS:** Cloud Run, Cloud SQL, Cloud Build, Artifact Registry
- **SaaS:** GitHub

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React, Vite, TypeScript, Tailwind CSS, TanStack Start |
| Backend | Python 3.12, FastAPI, Pydantic, SQLAlchemy, PyMySQL, PyJWT, bcrypt |
| Database | MySQL 8.4 (Cloud SQL) |
| Storage | Google Cloud Storage |
| Runtime | Google Cloud Run |
| Delivery | GitHub, Cloud Build, Artifact Registry |

---

## Data Model

Three core tables:

- **users**: `id`, `name`, `email`, `password_hash`, `role`, `is_active`, `created_at`
- **items**: `id`, `title`, `description`, `category`, `report_type`, `location`, `item_date`, `image_key`, `status`, `user_id`, `created_at`
- **claims**: `id`, `item_id`, `claimant_id`, `claim_message`, `claim_status`, `created_at`

One user reports many items and submits many claims. One item can receive many claims.

---

## Security

- **Authentication:** signed JWTs with a 7-day expiry
- **Password storage:** bcrypt hashes (12 rounds) only, never plain text
- **Authorization:** `student` and `admin` roles enforced on protected routes; only admins can approve or reject claims
- **Upload validation:** file type and file header are checked, with a 2 MB limit
- **Secrets:** the JWT secret and database password are set as Cloud Run environment variables, not stored in source code
- **Storage:** the Cloud Storage bucket is private (public access blocked)
- **CORS:** the API allow-list admits only the frontend and local development

---

## Testing and Evaluation

| Function | Local | Live (Cloud) |
|----------|-------|--------------|
| Registration | Passed | HTTP 201 from `POST /api/auth/register` |
| Login (JWT issued) | Passed | Admin login works |
| Report item with photo | Passed | Photo stored in Cloud Storage and served |
| Browse and search | Passed | Reported item appears in Browse |
| Submit claim | Passed | Live-site run pending |
| Admin approve / reject | Passed | Live-site run pending |
| API verification | Passed | `/api/health` healthy; `/docs` lists 16 endpoints |

**Limitations:** the pipeline has no automated test step (post-deploy checks are manual), and no load testing has been performed.

---

## Deployment Details

- **Cloud Run:** request-based billing, 80 concurrent requests per instance, 300 s request timeout, startup CPU boost enabled; the backend autoscales up to 20 instances
- **Cloud SQL:** MySQL 8.4.11, Enterprise edition, 2 vCPU, 8 GB RAM, 10 GB SSD, single zone
- **Cloud Build:** about 2 min 35 s to 2 min 53 s per backend build
- **Cost note:** Cloud SQL is the main cost driver (estimated at about ₹8,000 per month if always on)

---

## Running Locally

> Adjust folder names and commands to match your repository layout.

```bash
# Clone
git clone https://github.com/joanna046/findit-campus-finder.git
cd findit-campus-finder
```

**Backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

**Environment variables** (backend), set locally or in Cloud Run:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Secret used to sign JWTs |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | MySQL credentials |
| `DB_HOST` or Cloud SQL socket | Database connection |
| `BUCKET_NAME` | Cloud Storage bucket for photos |

Never commit real secrets to the repository.

---

## Challenges Solved

- A missing PyJWT dependency, fixed by adding it to the container image
- Startup secrets, fixed by setting them as Cloud Run environment variables
- Cloud Run to Cloud SQL connectivity, fixed with the Cloud SQL connector
- Persistent photo storage, fixed by moving photos to Cloud Storage

## Future Work

- Monitoring and alerting
- Automated database backups
- High availability for Cloud SQL
- Secret Manager for credentials
- Custom domain
- Automated tests in the CI/CD pipeline





Joanna· College project · Google Cloud
