# SWS — Student Work Scheduling System (Backend)

SWS is the Student Work Scheduling System for Oklahoma Christian University. This service provides the REST API that powers the SWS frontend: managers create and assign shifts, student workers clock in and out, submit availability, request shift swaps and time off, and receive notifications; the system tracks clock records, break records, and time discrepancies, and exposes payroll-ready reports. Three roles are supported — **student**, **manager**, and **admin** — with JWT-based auth backed by Google OAuth.

## Stack

- **Node.js ≥ 18** — runtime
- **Express 4** — HTTP framework
- **Sequelize 6** — ORM (MySQL / mysql2)
- **MySQL** — relational database
- **JWT** (jsonwebtoken) + **Google OAuth** (googleapis) — authentication
- **Jest 29** + **Supertest** — unit and integration testing
- **Winston** + **Morgan** — structured logging (see `LOGGING.md`)
- **Nodemailer** + **Twilio** — email and SMS notifications
- **web-push** — browser + PWA push notifications (see [docs/PUSH_NOTIFICATIONS.md](docs/PUSH_NOTIFICATIONS.md))
- **Multer** — file uploads (qualification evidence)
- **Sequelize CLI migrations** — schema versioning under `migrations/`

## Getting Started

```sh
# 1. Clone the repo
git clone https://github.com/OC-ComputerScience/sws-backend.git
cd sws-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env   # then fill in your local values
# Required variables include database credentials, Google OAuth client ID/secret,
# JWT secret, and optional Twilio/Nodemailer settings.
# See CONTRIBUTING.md and .env.example for the full variable list.

# 4. Install git hooks (required once per clone)
bash scripts/setup-hooks.sh

# 5. Start the server
npm start
```

To run tests:

```sh
npm test                    # full Jest suite
npm run test:integration    # integration tests only
```

## Branch & PR Workflow

All work happens on feature branches cut from `dev` (`feat/short-description`, `fix/short-description`, `docs/short-description`, etc.). Direct pushes to `dev` and `main` are blocked by the pre-push hook installed via `scripts/setup-hooks.sh`; GitHub branch protection enforces the same rule remotely. Open pull requests against `dev`; stable releases are merged from `dev` into `main`. Commit messages follow conventional-commits style (`type: description`). The commit-msg hook rejects any commit that contains AI attribution lines (`Co-Authored-By: Claude`, `Generated with ChatGPT`, etc.) — see `AGENTS.md` for the full policy.

## Directory Overview

```
app/
├── controllers/       # Request handlers (one per resource)
├── routes/            # Express routers — one file per API area (see below)
├── models/            # Sequelize model definitions and associations
├── middleware/        # Auth, role guards, error handling
├── authorization/     # Permission helpers
├── services/          # Business-logic services (notifications, sync, etc.)
└── config/            # DB config, Sequelize instance, Winston logger

migrations/            # Sequelize CLI migrations (timestamp-prefixed)
__tests__/             # Jest unit and integration tests
scripts/               # setup-hooks.sh, schema sync helpers
server.js              # App entry point
```

Key API areas (all under `/api`):

| Route prefix | Description |
|---|---|
| `/auth` | Google OAuth sign-in, token refresh |
| `/users`, `/employees` | User and employee management |
| `/shifts`, `/schedule-templates` | Shift CRUD and schedule templates |
| `/clock-records`, `/break-records` | Clock-in/out and break tracking |
| `/availabilities` | Student availability submission and approval |
| `/student/*` | Student dashboard aggregates (upcoming shifts, swap board, time-off) |
| `/notifications` | In-app notifications |
| `/time_discrepancies`, `/timecard-approvals` | Payroll discrepancy review and approvals |
| `/reports` | Payroll-ready time reports |
| `/departments`, `/positions`, `/roles` | Org-structure management |
| `/qualifications`, `/position-qualifications` | Position requirement tracking |
| `/manager`, `/admin` | Manager and admin aggregated endpoints |

## Related

- **Frontend:** [sws-frontend](https://github.com/OC-ComputerScience/sws-frontend)
- **Contributor guide:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **AI agent policy:** [AGENTS.md](AGENTS.md)
- **Logging:** [LOGGING.md](LOGGING.md)

## License

ISC
