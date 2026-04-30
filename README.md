# RFID Linen Management — Backend API

A RESTful backend server for an **RFID-based linen tracking and management system**. Built with Express.js, MySQL, and WebSockets, it handles user authentication, linen inventory, batch processing (in/out/usage), and real-time data synchronisation with connected clients. The application is fully containerised with Docker and ships with a GitLab CI/CD pipeline for automated testing, building, and deployment.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Local Development](#local-development)
  - [Docker (Production)](#docker-production)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Health Check](#health-check)
  - [Authentication](#authentication)
  - [Linens](#linens)
  - [Batch In](#batch-in)
  - [Batch Out](#batch-out)
  - [Storage](#storage)
  - [Batch Usage](#batch-usage)
  - [Real-Time Triggers](#real-time-triggers)
- [WebSocket Protocol](#websocket-protocol)
- [Database Schema](#database-schema)
- [Stored Procedures](#stored-procedures)
- [CI/CD Pipeline](#cicd-pipeline)
- [Project Structure](#project-structure)
- [License](#license)

---

## Architecture Overview

```
┌──────────────┐         ┌──────────────────┐         ┌──────────┐
│  Mobile App  │◄──WS──► │  Express Server  │◄──SQL──► │  MySQL   │
│  / Frontend  │◄─HTTP──►│  (Node.js)       │         │ Database │
└──────────────┘         └──────────────────┘         └──────────┘
                                 │
                          Docker Container
                          (node:20-alpine)
                                 │
                ┌────────────────┴────────────────┐
                │       GitLab CI/CD Pipeline      │
                │  Test ─► Build Image ─► Deploy   │
                └─────────────────────────────────┘
```

The server exposes a REST API over HTTP and a WebSocket server on the **same port**. When data changes (batch operations, etc.), a `data_changed` event is broadcast to all connected WebSocket clients, allowing frontends to refresh in real time.

The application is packaged as a multi-stage Docker image (`node:20-alpine`) and deployed automatically via a GitLab CI/CD pipeline to a remote server.

---

## Tech Stack

| Layer            | Technology                        |
| ---------------- | --------------------------------- |
| Runtime          | Node.js 20 (Alpine)               |
| Framework        | Express.js 5                      |
| Database         | MySQL (via `mysql2` connection pool) |
| Auth             | bcrypt (password hashing)         |
| Real-time        | WebSocket (`ws`)                  |
| Config           | dotenv                            |
| Dev tooling      | nodemon                           |
| Containerisation | Docker (multi-stage build)        |
| Orchestration    | Docker Compose                    |
| CI/CD            | GitLab CI/CD                      |

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9 (for local development)
- **Docker** and **Docker Compose** (for containerised deployment)
- **MySQL** server (local, remote, or Docker-based)

---

## Getting Started

### Local Development

#### 1. Clone the repository

```bash
git clone <repository-url>
cd gun_app_backend
```

#### 2. Install dependencies

```bash
cd backend
npm install
```

#### 3. Configure environment variables

```bash
cp ../.env.example .env
# Edit .env with your actual database credentials
```

See [Environment Variables](#environment-variables) for the full list.

#### 4. Run the server

**Development** (auto-restart on file changes):

```bash
npm run dev
```

**Production**:

```bash
npm start
```

The server will start on the port specified in your `.env` (default: **5002**).

---

### Docker (Production)

The project includes a multi-stage `Dockerfile` and a `docker-compose.yml` for streamlined deployment.

#### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your production database credentials
```

#### 2. Build and run

```bash
docker compose up -d --build
```

This will:
- Build a production-optimised image using the multi-stage `Dockerfile`
- Start the container on port **5002** (mapped to the host)
- Automatically restart the container unless manually stopped

#### 3. View logs

```bash
docker compose logs -f backend
```

#### 4. Stop

```bash
docker compose down
```

> **Note:** The Dockerfile runs the application as a non-root user (`appuser`) for security.

---

## Environment Variables

Create a `.env` file in the project root (for Docker Compose) or in the `backend/` directory (for local development). A template is provided in `.env.example`.

| Variable         | Description                                    | Default  |
| ---------------- | ---------------------------------------------- | -------- |
| `PORT`           | Server listen port                             | `5002`   |
| `DB_HOST`        | MySQL host address                             | —        |
| `DB_PORT`        | MySQL port                                     | `3306`   |
| `DB_USER`        | MySQL username                                 | —        |
| `DB_PASS`        | MySQL password                                 | —        |
| `DB_NAME`        | MySQL database name                            | —        |
| `TRIGGER_SECRET` | Shared secret for the internal trigger endpoint | —        |

**Example `.env`:**

```env
PORT=5002
DB_HOST=host.docker.internal
DB_PORT=3306
DB_USER=gun_app
DB_PASS=your_secure_password_here
DB_NAME=gun_app_db
TRIGGER_SECRET=your_secure_trigger_secret_here
```

> ⚠️ The `.env` file is excluded from version control via `.gitignore`. Never commit secrets.

---

## API Reference

Base URL: `http://localhost:5002`

### Health Check

#### `GET /`

Returns a simple status message to confirm the server is running.

**Response:** `200 OK`
```
RFID Backend Server is running 🚀
```

---

### Authentication

#### `POST /api/login`

Authenticate a user with username and password. Passwords are compared against bcrypt hashes stored in the database.

**Request Body:**

```json
{
  "username": "john",
  "password": "secret123"
}
```

**Success Response:** `200 OK`

```json
{
  "message": "Login successful",
  "token": "fake-jwt-token-for-john",
  "user": {
    "username": "john",
    "name": "John Doe"
  }
}
```

**Error Responses:**

| Status | Condition                    |
| ------ | ---------------------------- |
| `400`  | Missing username or password |
| `401`  | Invalid credentials          |
| `500`  | Database / server error      |

> **Note:** The current token implementation is a placeholder (`fake-jwt-token-for-*`). Replace with proper JWT generation for production use.

---

#### `POST /api/register`

Register a new user. Passwords are hashed with bcrypt (10 salt rounds).

**Request Body:**

```json
{
  "username": "john",
  "password": "secret123",
  "name": "John Doe"
}
```

**Success Response:** `201 Created`

```json
{
  "message": "User registered successfully."
}
```

**Error Responses:**

| Status | Condition               |
| ------ | ----------------------- |
| `400`  | Missing required fields |
| `409`  | Username already exists |
| `500`  | Database / server error |

---

### Linens

#### `GET /api/linens`

Retrieve all linen items from the inventory.

**Success Response:** `200 OK`

```json
[
  {
    "LINEN_ID": "EPC-001",
    "LINEN_TYPE": "Bed Sheet",
    "LINEN_HEIGHT": 200,
    "LINEN_WIDTH": 150,
    "LINEN_MAX_CYCLE": 100,
    "LINEN_DESCRIPTION": "Standard white bed sheet",
    "LINEN_CREATED_DATE": "2026-01-15T00:00:00.000Z",
    "LINEN_SIZE_CATEGORY": "Large"
  }
]
```

---

### Batch In

#### `GET /api/batch-in`

Retrieve all batch-in records (incoming linen batches from laundry).

**Success Response:** `200 OK`

```json
[
  {
    "BATCH_IN_ID": "BIN-001",
    "BATCH_IN_DATETIME": "2026-04-10T08:00:00.000Z"
  }
]
```

#### `GET /api/batch-in-details`

Retrieve detail-level records linking batches to individual linen items.

**Success Response:** `200 OK`

```json
[
  {
    "BATCH_IN_ID": "BIN-001",
    "LINEN_ID": "EPC-001"
  }
]
```

---

### Batch Out

#### `POST /api/batch-out`

Process a batch-out operation. For each EPC tag, this calls two stored procedures:
1. `BATCH_OUT_READ` — records the batch-out event
2. `STORAGE_IN_READ` — records the linen entering storage

**Request Body:**

```json
{
  "batch_out_id": "BOUT-001",
  "epcs": ["EPC-001", "EPC-002", "EPC-003"],
  "storage_type": "Clean",
  "petugas_name": "Operator A"
}
```

**Success Response:** `200 OK`

```json
{
  "message": "Batch out and storage update process completed successfully."
}
```

**Error Responses:**

| Status | Condition                                              |
| ------ | ------------------------------------------------------ |
| `400`  | Missing or invalid fields (`epcs` must be a non-empty array) |
| `500`  | Database / stored procedure error                      |

---

### Storage

#### `POST /api/storage-out`

Process a storage-out operation. Calls `STORAGE_OUT_READ` for each EPC tag.

**Request Body:**

```json
{
  "epcs": ["EPC-001", "EPC-002"],
  "petugas_name": "Operator B"
}
```

**Success Response:** `200 OK`

```json
{
  "message": "Storage out process completed successfully."
}
```

**Error Responses:**

| Status | Condition                         |
| ------ | --------------------------------- |
| `400`  | Missing or invalid fields         |
| `500`  | Database / stored procedure error |

---

### Batch Usage

#### `GET /api/batch-usage`

Retrieve all batch usage records.

**Success Response:** `200 OK` — Array of batch usage objects.

#### `GET /api/batch-usage-details`

Retrieve all batch usage detail records.

**Success Response:** `200 OK` — Array of batch usage detail objects.

#### `POST /api/batch-usage`

Record linen usage/distribution by calling `BATCH_USAGE_READ` for each EPC tag.

**Request Body:**

```json
{
  "batch_usage_id": "BU-001",
  "epcs": ["EPC-001", "EPC-002"],
  "petugas_name": "Operator A",
  "receiver_name": "Ward B Staff",
  "receiver_location": "Building 2, Floor 3"
}
```

**Success Response:** `200 OK`

```json
{
  "message": "Batch usage process completed successfully."
}
```

**Error Responses:**

| Status | Condition                         |
| ------ | --------------------------------- |
| `400`  | Missing or invalid fields         |
| `500`  | Database / stored procedure error |

---

### Real-Time Triggers

#### `GET /api/force-refresh`

Manually trigger a WebSocket broadcast to all connected clients. Useful for debugging or admin-triggered refreshes.

**Response:** `200 OK`
```
Broadcast event "data_changed" has been sent to all connected clients.
```

#### `POST /api/internal-trigger-refresh`

Server-to-server endpoint to trigger a data-refresh broadcast. Protected by a shared secret header.

**Required Header:**

```
x-trigger-secret: <your TRIGGER_SECRET value>
```

**Success Response:** `200 OK`
```
Broadcast initiated.
```

**Error Response:** `403 Forbidden` — Invalid or missing secret.

---

## WebSocket Protocol

The WebSocket server runs on the **same port** as the HTTP server.

**Connection URL:** `ws://<host>:5002`

### Events (Server → Client)

| Event          | Payload                       | Description                                                    |
| -------------- | ----------------------------- | -------------------------------------------------------------- |
| `data_changed` | `{ "event": "data_changed" }` | Emitted when data is modified; clients should re-fetch relevant data. |

### Example Client Usage

```javascript
const ws = new WebSocket('ws://localhost:5002');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'data_changed') {
    // Refresh your data from the REST API
    fetchLatestData();
  }
};
```

---

## Database Schema

The application expects the following MySQL tables to be pre-created:

| Table                 | Key Columns                                         | Description                                       |
| --------------------- | --------------------------------------------------- | ------------------------------------------------- |
| `users_gun`           | `username`, `password_hash`, `name`                 | User accounts for authentication                  |
| `linens`              | `LINEN_ID`, `LINEN_TYPE`, `LINEN_HEIGHT`, `LINEN_WIDTH`, `LINEN_MAX_CYCLE`, `LINEN_DESCRIPTION`, `LINEN_CREATED_DATE`, `LINEN_SIZE_CATEGORY` | Linen inventory master data |
| `batch_in`            | `BATCH_IN_ID`, `BATCH_IN_DATETIME`                  | Incoming batch header records                     |
| `batch_in_details`    | `BATCH_IN_ID`, `LINEN_ID`                           | Incoming batch line items (linen ↔ batch mapping) |
| `batch_usage`         | `*` (all columns)                                   | Linen usage/distribution header records           |
| `batch_usage_details` | `*` (all columns)                                   | Linen usage line items                            |

---

## Stored Procedures

The following MySQL stored procedures are called by the API and **must be pre-created** in your database:

| Procedure          | Parameters                                                                 | Called By              |
| ------------------ | -------------------------------------------------------------------------- | ---------------------- |
| `BATCH_OUT_READ`   | `(batch_out_id, epc)`                                                      | `POST /api/batch-out`  |
| `STORAGE_IN_READ`  | `(epc, storage_type, petugas_name)`                                        | `POST /api/batch-out`  |
| `STORAGE_OUT_READ` | `(epc, petugas_name)`                                                      | `POST /api/storage-out`|
| `BATCH_USAGE_READ` | `(batch_usage_id, epc, petugas_name, receiver_name, receiver_location)`    | `POST /api/batch-usage`|

---

## CI/CD Pipeline

The project includes a `.gitlab-ci.yml` that defines a three-stage pipeline triggered on the `main` branch:

```
Test ──► Build ──► Deploy
```

### Stages

| Stage    | Description                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------- |
| **Test** | Installs dependencies (`npm ci`) and runs `npm test`. Also runs on merge requests.                  |
| **Build**| Builds the Docker image from `backend/Dockerfile`, tags it with the commit SHA and `latest`, and pushes to the GitLab Container Registry. |
| **Deploy**| SSHs into the production server, pulls the latest image, and restarts the container via Docker Compose. |

### Required CI/CD Variables

The following variables must be configured in **GitLab → Settings → CI/CD → Variables**:

| Variable               | Description                                   |
| ---------------------- | --------------------------------------------- |
| `CI_REGISTRY`          | GitLab Container Registry URL (auto-provided) |
| `CI_REGISTRY_USER`     | Registry username (auto-provided)             |
| `CI_REGISTRY_PASSWORD` | Registry password (auto-provided)             |
| `DEPLOY_KEY`           | SSH private key file for the production server |
| `DEPLOY_USER`          | SSH username for the production server        |
| `DEPLOY_HOST`          | Hostname/IP of the production server          |

### Deployment Target

The deploy stage expects the following on the production server:
- Docker and Docker Compose installed
- A `docker-compose.yml` file at `/opt/gun_app/docker-compose.yml`

---

## Project Structure

```
gun_app_backend/
├── .env.example           # Environment variable template
├── .gitignore             # Git ignore rules
├── .gitlab-ci.yml         # CI/CD pipeline definition
├── docker-compose.yml     # Docker Compose orchestration
├── README.md              # This file
│
└── backend/
    ├── .dockerignore      # Files excluded from Docker build context
    ├── Dockerfile         # Multi-stage production Docker image
    ├── package.json       # Dependencies and npm scripts
    ├── package-lock.json  # Locked dependency tree
    └── server.js          # Main application entry point
```

---

## License

ISC