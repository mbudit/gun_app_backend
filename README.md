# RFID Linen Management — Backend API

A RESTful backend server for an **RFID-based linen tracking and management system**. Built with Express.js, MySQL, and WebSockets, it handles user authentication, linen inventory, batch processing (in/out/usage), and real-time data synchronization with connected clients.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
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
- [Project Structure](#project-structure)
- [License](#license)

---

## Architecture Overview

```
┌──────────────┐         ┌──────────────────┐         ┌──────────┐
│  Mobile App  │◄──WS──► │  Express Server  │◄──SQL──► │  MySQL   │
│  / Frontend  │◄─HTTP──►│  (Node.js)       │         │ Database │
└──────────────┘         └──────────────────┘         └──────────┘
```

The server exposes a REST API over HTTP and a WebSocket server on the **same port**. When data changes (batch operations, etc.), a `data_changed` event is broadcast to all connected WebSocket clients, allowing frontends to refresh in real time.

---

## Tech Stack

| Layer          | Technology                 |
| -------------- | -------------------------- |
| Runtime        | Node.js                    |
| Framework      | Express.js 5               |
| Database       | MySQL (via `mysql2` pool)  |
| Auth           | bcrypt (password hashing)  |
| Real-time      | WebSocket (`ws`)           |
| Config         | dotenv                     |
| Dev tooling    | nodemon                    |

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **MySQL** server (local or remote)

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd gun_app_backend
```

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `backend/` directory (see [Environment Variables](#environment-variables) below).

### 4. Run the server

**Development** (auto-restart on file changes):

```bash
npx nodemon server.js
```

**Production**:

```bash
node server.js
```

The server will start on the port specified in your `.env` (default: **5002**).

---

## Environment Variables

Create `backend/.env` with the following variables:

| Variable    | Description                  | Default |
| ----------- | ---------------------------- | ------- |
| `PORT`      | Server port                  | `5002`  |
| `DB_HOST`   | MySQL host                   | —       |
| `DB_PORT`   | MySQL port                   | `3307`  |
| `DB_USER`   | MySQL username               | —       |
| `DB_PASS`   | MySQL password               | —       |
| `DB_NAME`   | MySQL database name          | —       |

**Example `.env`:**

```env
PORT=5002
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASS=your_password
DB_NAME=rfid_linen_db
```

> ⚠️ The `.env` file is excluded from version control via `.gitignore`.

---

## API Reference

Base URL: `http://localhost:5002`

### Health Check

#### `GET /`

Returns a simple status message.

**Response:** `200 OK`
```
RFID Backend Server is running 🚀
```

---

### Authentication

#### `POST /api/login`

Authenticate a user with username and password.

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

| Status | Condition                      |
| ------ | ------------------------------ |
| `400`  | Missing username or password   |
| `401`  | Invalid credentials            |
| `500`  | Database / server error        |

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

| Status | Condition                      |
| ------ | ------------------------------ |
| `400`  | Missing required fields        |
| `409`  | Username already exists         |
| `500`  | Database / server error        |

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

Retrieve all batch-in records (incoming linen batches).

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

Retrieve the detail-level records linking batches to individual linens.

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

Process a batch-out operation. For each EPC, this calls two stored procedures: `BATCH_OUT_READ` and `STORAGE_IN_READ`.

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

| Status | Condition                                       |
| ------ | ----------------------------------------------- |
| `400`  | Missing or invalid fields (epcs must be a non-empty array) |
| `500`  | Database / stored procedure error               |

---

### Storage

#### `POST /api/storage-out`

Process a storage-out operation. Calls `STORAGE_OUT_READ` for each EPC.

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

| Status | Condition                                       |
| ------ | ----------------------------------------------- |
| `400`  | Missing or invalid fields                       |
| `500`  | Database / stored procedure error               |

---

### Batch Usage

#### `GET /api/batch-usage`

Retrieve all batch usage records.

**Success Response:** `200 OK` — Array of batch usage objects.

#### `GET /api/batch-usage-details`

Retrieve all batch usage detail records.

**Success Response:** `200 OK` — Array of batch usage detail objects.

#### `POST /api/batch-usage`

Record linen usage by calling `BATCH_USAGE_READ` for each EPC.

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

| Status | Condition                                       |
| ------ | ----------------------------------------------- |
| `400`  | Missing or invalid fields                       |
| `500`  | Database / stored procedure error               |

---

### Real-Time Triggers

#### `GET /api/force-refresh`

Manually trigger a WebSocket broadcast to all connected clients. Useful for debugging or admin-triggered refreshes.

**Response:** `200 OK`
```
Broadcast event "data_changed" has been sent to all connected clients.
```

#### `POST /api/internal-trigger-refresh`

Server-to-server endpoint to trigger a data refresh broadcast. Protected by a secret header.

**Required Header:**

```
x-trigger-secret: your-very-secret-string
```

**Success Response:** `200 OK`
```
Broadcast initiated.
```

**Error Response:** `403 Forbidden` — Invalid or missing secret.

---

## WebSocket Protocol

The WebSocket server runs on the **same port** as the HTTP server.

**Connection URL:** `ws://localhost:5002`

### Events (Server → Client)

| Event          | Payload                            | Description                               |
| -------------- | ---------------------------------- | ----------------------------------------- |
| `data_changed` | `{ "event": "data_changed" }`      | Emitted when data is modified; clients should re-fetch relevant data. |

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

The application expects the following MySQL tables:

| Table                  | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `users_gun`            | User accounts (`username`, `password_hash`, `name`) |
| `linens`               | Linen inventory master data                    |
| `batch_in`             | Incoming batch header records                  |
| `batch_in_details`     | Incoming batch line items (linen ↔ batch mapping) |
| `batch_usage`          | Linen usage/distribution header records        |
| `batch_usage_details`  | Linen usage line items                         |

---

## Stored Procedures

The following MySQL stored procedures are called by the API:

| Procedure            | Parameters                                                        | Called By              |
| -------------------- | ----------------------------------------------------------------- | ---------------------- |
| `BATCH_OUT_READ`     | `(batch_out_id, epc)`                                             | `POST /api/batch-out`  |
| `STORAGE_IN_READ`    | `(epc, storage_type, petugas_name)`                               | `POST /api/batch-out`  |
| `STORAGE_OUT_READ`   | `(epc, petugas_name)`                                             | `POST /api/storage-out`|
| `BATCH_USAGE_READ`   | `(batch_usage_id, epc, petugas_name, receiver_name, receiver_location)` | `POST /api/batch-usage`|

> These procedures must be pre-created in your MySQL database before using the corresponding API endpoints.

---

## Project Structure

```
gun_app_backend/
├── .gitignore
├── README.md
└── backend/
    ├── .env              # Environment variables (not committed)
    ├── package.json
    ├── package-lock.json
    ├── server.js          # Main application entry point
    └── node_modules/
```