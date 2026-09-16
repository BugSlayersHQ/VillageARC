# VillageARC — JWT Authentication API

> **Base URL:** `http://localhost:<PORT>/api`
> All request/response bodies are JSON.
> The auth token is stored as an **HTTP-only cookie** (`accessToken`). The browser sends it automatically — include `credentials: 'include'` in `fetch` or `withCredentials: true` in Axios.

---

## Data Models

### Admin

| Field         | Type             | Notes                       |
| ------------- | ---------------- | --------------------------- |
| `id`          | `number`         | Primary key                 |
| `name`        | `string \| null` | Full name                   |
| `email`       | `string \| null` | Unique                      |
| `passwordHash`| `string \| null` | Never returned in responses |
| `createdAt`   | ISO 8601         |                             |
| `updatedAt`   | ISO 8601         |                             |

### User

| Field         | Type             | Notes                       |
| ------------- | ---------------- | --------------------------- |
| `id`          | `number`         | Primary key                 |
| `name`        | `string`         | Full name                   |
| `email`       | `string`         | Unique                      |
| `passwordHash`| `string \| null` | Never returned in responses |
| `phone`       | `string \| null` |                             |
| `adminId`     | `number`         | Owning admin's ID           |
| `createdAt`   | ISO 8601         |                             |
| `updatedAt`   | ISO 8601         |                             |

---

## Auth Endpoints — `/api/auth`

### `POST /api/auth/register`

Create a new Admin or User account. Sets the `accessToken` cookie on success.

**Request Body**

| Field      | Type     | Required       | Description                                    |
| ---------- | -------- | -------------- | ---------------------------------------------- |
| `email`    | `string` | ✅              | Valid email address                            |
| `password` | `string` | ✅              | Minimum 6 characters                           |
| `name`     | `string` | ❌              | Full name                                      |
| `role`     | `string` | ❌              | `"ADMIN"` or `"USER"` — defaults to `"USER"`  |
| `adminId`  | `number` | ✅ (if USER)   | ID of the admin this user belongs to           |

**Example — Register Admin**

```json
POST /api/auth/register
{
  "email": "admin@example.com",
  "password": "securePass123",
  "name": "Ravi Kumar",
  "role": "ADMIN"
}
```

**Example — Register User**

```json
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securePass123",
  "name": "Priya Sharma",
  "role": "USER",
  "adminId": 1
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": 1,
    "email": "admin@example.com",
    "role": "ADMIN",
    "name": "Ravi Kumar"
  }
}
```

**Error Responses**

| Status | Reason                              |
| ------ | ----------------------------------- |
| `400`  | Validation failed / missing adminId |
| `404`  | `adminId` not found                 |
| `409`  | Email already registered            |

---

### `POST /api/auth/login`

Authenticate with email + password. Sets the `accessToken` cookie (valid 24 hours).

**Request Body**

| Field      | Type     | Required |
| ---------- | -------- | -------- |
| `email`    | `string` | ✅        |
| `password` | `string` | ✅        |

**Example**

```json
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "securePass123"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": 1,
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

**Error Responses**

| Status | Reason                    |
| ------ | ------------------------- |
| `400`  | Validation failed         |
| `401`  | Invalid email or password |

---

### `POST /api/auth/logout`

Clear the auth cookie and end the session. No request body required.

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### `GET /api/auth/me` 🔒

Return the currently authenticated user's profile.

> **Requires:** valid `accessToken` cookie.

**Response `200 OK` — Admin**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Ravi Kumar",
    "email": "admin@example.com",
    "role": "ADMIN",
    "createdAt": "2026-09-16T08:00:00.000Z",
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
}
```

**Response `200 OK` — User**

```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "Priya Sharma",
    "email": "user@example.com",
    "phone": "+91-9876543210",
    "adminId": 1,
    "role": "USER",
    "createdAt": "2026-09-16T08:00:00.000Z",
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
}
```

**Error Responses**

| Status | Reason                   |
| ------ | ------------------------ |
| `401`  | No / invalid token       |
| `404`  | Account no longer exists |

---

## User Management — `/api/users` 🔒 (Admin only)

### `POST /api/users`

Create a new user under the authenticated admin.

**Request Body**

| Field   | Type     | Required |
| ------- | -------- | -------- |
| `email` | `string` | ✅        |
| `name`  | `string` | ❌        |
| `phone` | `string` | ❌        |

**Example**

```json
POST /api/users
{
  "email": "newuser@example.com",
  "name": "Arjun Nair",
  "phone": "+91-9000011111"
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 6,
    "email": "newuser@example.com"
  }
}
```

**Error Responses**

| Status | Reason                  |
| ------ | ----------------------- |
| `400`  | Validation failed       |
| `401`  | Not authenticated       |
| `404`  | Admin account not found |
| `409`  | Email already exists    |

---

### `GET /api/users`

List all users belonging to the authenticated admin.

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": [
    {
      "id": 5,
      "name": "Priya Sharma",
      "email": "user@example.com",
      "phone": null,
      "createdAt": "2026-09-16T08:00:00.000Z",
      "updatedAt": "2026-09-16T08:00:00.000Z"
    }
  ]
}
```

---

## Authentication Flow

```
Client                          Server
  |                               |
  |-- POST /api/auth/login -----> |
  |                               |-- Verify email + bcrypt hash
  |                               |-- Sign JWT {userId, role}
  |<-- 200 OK + Set-Cookie: -----| 
  |   accessToken=<jwt>; HttpOnly |
  |                               |
  |-- GET /api/auth/me ---------->|
  |   (cookie sent automatically) |-- Verify JWT
  |                               |-- Fetch profile from DB
  |<-- 200 OK + profile data -----|
```

---

## Role-Based Access

| Role    | Allowed                                           |
| ------- | ------------------------------------------------- |
| `ADMIN` | All file routes, user management, `/api/auth/me`  |
| `USER`  | Assigned file viewing, `/api/auth/me`             |

---

## Token Details

| Property  | Value                                          |
| --------- | ---------------------------------------------- |
| Algorithm | `HS256`                                        |
| Expiry    | 24 hours                                       |
| Storage   | HTTP-only cookie (`accessToken`)               |
| Payload   | `{ userId: number, role: "ADMIN" \| "USER" }` |

---

## Standard Error Format

All errors follow this shape:

```json
{
  "success": false,
  "message": "Description of what went wrong"
}
```

| Status | Meaning                  |
| ------ | ------------------------ |
| `400`  | Bad request / validation |
| `401`  | Unauthenticated          |
| `403`  | Forbidden (wrong role)   |
| `404`  | Resource not found       |
| `409`  | Conflict (duplicate)     |
| `500`  | Internal server error    |

---

## Frontend Integration

```ts
// Login
const res = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include', // ← required for cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

// Authenticated request (cookie sent automatically)
const profile = await fetch('/api/auth/me', {
  credentials: 'include',
});

// Logout
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include',
});
```
