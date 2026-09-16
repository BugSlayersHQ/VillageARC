# File Management

## Overview

The File Management feature allows land records (PDFs and images) to be uploaded
to AWS S3, stored securely, and selectively shared with registered users
through an assignment system. Admins control uploads, deletions, and assignments.
Users can only access files that have been explicitly assigned to them.

---

## Architecture

```
Frontend (Next.js)
       ↓
Express API  (backend/src/app.ts  →  /api/files)
       ↓
Multer  (memory storage, MIME + size validation)
       ↓
AWS SDK v3  (S3Client in src/lib/storage.ts)
       ↓
AWS S3  (private bucket, object stored under land-records/<unique-key>)
       ↓
PostgreSQL / Prisma  (File + FileAssignment metadata only — no URLs stored)
```

---

## Storage Strategy

- AWS S3 is used for object storage.
<<<<<<< Updated upstream
- The AWS SDK v3 `S3Client` communicates with AWS S3 using standard IAM credentials.
- PostgreSQL stores only the `storageKey` (e.g. `land-records/<unique-filename>`).
- No AWS S3 URLs or credentials are ever stored in the database.
- Presigned download URLs are generated on demand and expire after 300 seconds.
=======
- The AWS SDK v3 `S3Client` communicates with AWS S3 using IAM credentials.
- PostgreSQL stores only the `storageKey` required to locate the S3 object.
- No AWS S3 URLs or credentials are stored in the database.
- The S3 bucket remains private.
- Presigned download URLs are generated on demand.
- Presigned URLs expire after 300 seconds (5 minutes).
- Archiving a file does **not** delete its S3 object.
- Restoring a file makes the archived record available again without re-uploading the document.

Example storage key:

```text
land-records/<unique-filename>
```
>>>>>>> Stashed changes

---

## Folder Structure

```
backend/
├── src/
│   ├── controllers/
│   │   └── file.controller.ts     # All file-management business logic
│   ├── routes/
│   │   └── file.routes.ts         # Express router wiring for /api/files
│   ├── middleware/
│   │   ├── auth.middleware.ts      # protect + authorize (Clerk)
│   │   └── upload.middleware.ts   # Multer memory storage, MIME + size validation
│   ├── lib/
│   │   └── storage.ts             # S3Client initialisation
│   └── types/
│       ├── error.types.ts         # AppError interface
│       └── express.d.ts           # Express Request augmentation (userId)
├── prisma/
│   ├── schema.prisma              # File + FileAssignment models
│   └── migrations/
│       └── 20260913005730_add_file_management/
│           └── migration.sql
```

> **No `config/` files are created for this feature.**  
> Environment variables are read directly from `process.env` (loaded by `dotenv` in `server.ts`).

---

## Environment Variables

Add these to your `.env` file (see `.env.example` for placeholders):

| Variable                    | Description               | Example                                    |
| --------------------------- | ------------------------- | ------------------------------------------ |
| `STORAGE_REGION`            | AWS S3 region             | `ap-south-1`                               |
| `STORAGE_ACCESS_KEY_ID`     | AWS IAM Access Key ID     | `AKIAIOSFODNN7EXAMPLE`                     |
| `STORAGE_SECRET_ACCESS_KEY` | AWS IAM Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `STORAGE_BUCKET`            | Name of the AWS S3 bucket | `villagearc-land-records`                  |

> **Never commit real credentials.** The `.env` file is git-ignored.

---

## AWS S3 Setup

1. Log in to the [AWS Management Console](https://aws.amazon.com/console/).
2. Go to **S3** and create a new bucket (e.g. `villagearc-land-records`).
3. Keep the bucket **private** (Block all public access).
4. Go to **IAM** and create a new user with programmatic access.
5. Attach a policy to the user allowing `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on the bucket.
6. Note the **Access Key ID** and **Secret Access Key**.
7. Add the four `STORAGE_*` variables to your `.env` file.
8. Start the backend: `pnpm dev` (from `backend/`).
9. Test upload with a multipart POST to `POST /api/files/create` (Admin token required).

---

## Upload Flow

```
Client (multipart/form-data, field: file)
  → Multer validates MIME type + size (≤ 20 MB)
  → Controller reads req.file.buffer
  → Generates unique filename:  <timestamp>-<random>-<originalname>
  → Builds storage key:         land-records/<unique-filename>
  → PutObjectCommand → AWS S3 bucket
  → prisma.file.create  (stores metadata + storageKey only)
  → 201 response with file record
```

---

## Download Flow

```
Client  GET /api/files/:id/download
  → protect middleware verifies Clerk session
  → Controller checks caller role:
      ADMIN   → allowed
      USER    → checks FileAssignment; 403 if not assigned
  → GetObjectCommand with ResponseContentDisposition + ResponseContentType
  → getSignedUrl (expiresIn: 300 seconds)
  → 200 response with { url, expiresIn: 300 }
  → Client uses the presigned URL to download directly from AWS S3
```

The AWS S3 bucket is never made public. All access goes through the signed URL.

---

## Delete Flow

```
Client  DELETE /api/files/:id  (Admin only)
  → Controller fetches File record (storageKey)
  → DeleteObjectCommand → removes object from AWS S3
  → prisma.file.delete  → cascades to FileAssignment rows
  → 200 response
```

<<<<<<< Updated upstream
The AWS S3 object is always deleted **before** the database record.
=======
### Important behavior

Archiving:

- Does not delete the S3 object.
- Does not delete the PostgreSQL `File` record.
- Does not remove the file's processing history.
- Does not remove `FilePage` records.
- Prevents normal users from accessing the file.
- Prevents normal file operations such as assignment/update.
- Allows administrators to inspect archived records.
- Allows the file to be restored later.

---

## Restore Flow

An archived file can be restored by an Admin.

```text
Admin
PATCH /api/files/:id/restore
        ↓
protect
        ↓
authorize('ADMIN')
        ↓
Find file
        ↓
Verify Admin owns file
        ↓
Check file is archived
        ↓
isArchived = false
archivedAt = null
archivedById = null
        ↓
Database updated
        ↓
200 response
```

Restoring does not require uploading the document again because the original S3 object was preserved.

---

## File Update Flow

The current update endpoint is limited to metadata.

```text
PATCH /api/files/:id
        ↓
ADMIN authentication
        ↓
Verify Admin owns file
        ↓
Verify file is not archived
        ↓
Update metadata
        ↓
Database
```

Currently supported metadata update:

```json
{
  "originalName": "updated-land-record.pdf"
}
```

The following are **not replaced by this endpoint**:

```text
S3 object
storageKey
fileName
mimeType
size
FilePage processing results
```

Actual document-content replacement is not implemented in the current File Management feature.

If content replacement is required later, it should be implemented as a separate workflow rather than treating it as a simple metadata update. That workflow would need to account for the existing S3 object and page-processing results.
>>>>>>> Stashed changes

---

## Assignment Flow

```
Admin  POST /api/files/:id/assign  { userId: 123 }
  → Validates file exists
  → Validates target user exists
  → Looks up Admin's own Prisma User record for assignedBy
  → Checks FileAssignment unique constraint (fileId, userId)
  → 409 if already assigned
  → prisma.fileAssignment.create
  → 201 response

Admin  DELETE /api/files/:id/assign/:userId
  → Finds assignment by composite key (fileId, userId)
  → 404 if not found
  → prisma.fileAssignment.delete
  → 200 response
```

---

<<<<<<< Updated upstream
=======
## Remove Assignment Flow

Removing an assignment does **not delete the official file**.

```text
Admin
DELETE /api/files/:id/assign/:userId
        ↓
Find FileAssignment
        ↓
404 if not found
        ↓
Delete assignment row
        ↓
200 response
```

The file remains:

- in AWS S3
- in PostgreSQL
- available to the Admin
- available for future assignment

Only the relationship between the file and user is removed.

---

## File Processing and Page Tracking

The database contains two levels of processing state.

### File-level status

`File.status` represents the overall processing state of the document.

```text
UPLOADED
PROCESSING
COMPLETED
NEEDS_VERIFICATION
VERIFIED
FAILED
```

### Page-level status

`FilePage.status` represents the processing state of an individual page.

```text
PENDING
PROCESSING
COMPLETED
NEEDS_VERIFICATION
VERIFIED
FAILED_PERMANENT
```

Each page belongs to exactly one file.

Example:

```text
File
 ├── Page 1 → COMPLETED
 ├── Page 2 → VERIFIED
 ├── Page 3 → NEEDS_VERIFICATION
 └── Page 4 → COMPLETED
```

The `FilePage` record can store:

```text
pageNumber
status
confidence
result
```

This allows the processing system to track results and confidence independently for every page.

---

>>>>>>> Stashed changes
## API Endpoints

| Method   | Endpoint                        | Auth     | Role  | Description                                |
| -------- | ------------------------------- | -------- | ----- | ------------------------------------------ |
| `POST`   | `/api/files/create`             | Required | ADMIN | Upload a new file to AWS S3                |
| `GET`    | `/api/files`                    | Required | ADMIN | List all files with uploader & assignments |
| `GET`    | `/api/files/user/:userId`       | Required | Any   | Get files assigned to a user               |
| `GET`    | `/api/files/:id/download`       | Required | Any   | Generate a presigned download URL          |
| `GET`    | `/api/files/:id`                | Required | Any   | Get file details by ID                     |
| `PATCH`  | `/api/files/:id`                | Required | ADMIN | Update file metadata (originalName)        |
| `DELETE` | `/api/files/:id`                | Required | ADMIN | Delete file from AWS S3 and database       |
| `POST`   | `/api/files/:id/assign`         | Required | ADMIN | Assign file to a user                      |
| `DELETE` | `/api/files/:id/assign/:userId` | Required | ADMIN | Remove file assignment from a user         |
| `GET`    | `/api/files/:id/assignments`    | Required | Any   | List assignments for a file                |

<<<<<<< Updated upstream
> **Authorization notes:**
>
> - `GET /user/:userId` — ADMINs can view any user; USERs can only view their own.
> - `GET /:id/download` — ADMINs always allowed; USERs only if assigned to the file.
> - `GET /:id/assignments` — ADMINs see all; USERs see only their own assignment row.
=======
### Important

There is intentionally **no normal**:

```text
DELETE /api/files/:id
```

endpoint for deleting an official file.

Use:

```text
PATCH /api/files/:id/archive
```

instead.

---

## Authorization Rules

### `GET /api/files`

ADMIN-only.

Returns active files managed by the authenticated Admin.

### `GET /api/files/archived`

ADMIN-only.

Returns archived files managed by the authenticated Admin.

### `GET /api/files/user/:userId`

- ADMIN can view the user's assigned files.
- USER can only access their own user ID.
- Normal users cannot use this endpoint to inspect another user's files.

### `GET /api/files/:id`

- ADMIN can access files they manage.
- USER must have an assignment.
- Archived files are not available to normal users.

### `GET /api/files/:id/download`

- ADMIN can download files they manage.
- USER must be assigned to the file.
- USER cannot download archived files.

### `GET /api/files/:id/assignments`

- ADMIN can view assignments for their file.
- USER can only view their own assignment information.

### Archive / Restore

Only:

```text
ADMIN
```

can archive or restore files.
>>>>>>> Stashed changes

---

## Request Examples

### Upload a file

```
POST /api/files/create
Authorization: Bearer <clerk-session-token>
Content-Type: multipart/form-data

field name: file
file:       land_record.pdf
```

### Update file metadata

```
PATCH /api/files/42
Authorization: Bearer <clerk-session-token>
Content-Type: application/json

{
  "originalName": "Khasra_Plot_42_Updated.pdf"
}
```

> **Note:** File replacement (swapping the actual object in AWS S3) is not implemented
> in this version. Only `originalName` metadata can be updated. To replace the
> file content, delete the existing record and upload a new file.

### Assign a file to a user

```
POST /api/files/42/assign
Authorization: Bearer <clerk-session-token>
Content-Type: application/json

{
  "userId": 7
}
```

### Remove a file assignment

```
DELETE /api/files/42/assign/7
Authorization: Bearer <clerk-session-token>
```

### Download a file

```
GET /api/files/42/download
Authorization: Bearer <clerk-session-token>
```

Response:

```json
{
  "success": true,
  "message": "Download URL generated successfully",
  "data": {
    "url": "https://villagearc-land-records.s3.ap-south-1.amazonaws.com/...<presigned-params>",
    "expiresIn": 300
  }
}
```

The client uses `data.url` directly to download the file. The URL expires after 5 minutes.

---

## Response Examples

### Successful upload (201)

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": 1,
    "originalName": "khasra_42.pdf",
    "fileName": "1726123456789-387261904-khasra_42.pdf",
    "mimeType": "application/pdf",
    "size": 204800,
    "storageKey": "land-records/1726123456789-387261904-khasra_42.pdf",
    "uploadedById": 3,
    "createdAt": "2026-09-13T02:00:00.000Z",
    "updatedAt": "2026-09-13T02:00:00.000Z"
  }
}
```

### File assignment (201)

```json
{
  "success": true,
  "message": "File assigned successfully",
  "data": {
    "id": 5,
    "fileId": 1,
    "userId": 7,
    "assignedBy": 3,
    "createdAt": "2026-09-13T02:05:00.000Z",
    "user": { "id": 7, "name": "Ramesh Kumar", "email": "ramesh@example.com" },
    "assigner": { "id": 3, "name": "Admin User" }
  }
}
```

### Error responses

```json
{ "message": "File not found" }
{ "message": "File already assigned to this user" }
{ "message": "You are not allowed to download this file" }
{ "message": "File type not allowed. Allowed types: application/pdf, image/jpeg, ..." }
```

---

## Database Schema

### `File`

| Column         | Type     | Description                               |
| -------------- | -------- | ----------------------------------------- |
| `id`           | Int (PK) | Auto-increment primary key                |
| `originalName` | String   | Human-readable filename                   |
| `fileName`     | String   | Unique filename used as AWS S3 object key |
| `mimeType`     | String   | MIME type of the uploaded file            |
| `size`         | Int      | File size in bytes                        |
| `storageKey`   | String   | AWS S3 object key (`land-records/<name>`) |
| `uploadedById` | Int (FK) | References `User.id`                      |
| `createdAt`    | DateTime | Creation timestamp                        |
| `updatedAt`    | DateTime | Last update timestamp                     |

### `FileAssignment`

| Column       | Type     | Description                               |
| ------------ | -------- | ----------------------------------------- |
| `id`         | Int (PK) | Auto-increment primary key                |
| `fileId`     | Int (FK) | References `File.id` (cascade delete)     |
| `userId`     | Int (FK) | References `User.id` (cascade delete)     |
| `assignedBy` | Int (FK) | References `User.id` (admin who assigned) |
| `createdAt`  | DateTime | Assignment timestamp                      |

Unique constraint: `(fileId, userId)` — a file can only be assigned once per user.

---

## Security

| Concern                | Implementation                                                    |
| ---------------------- | ----------------------------------------------------------------- |
| Private AWS S3 bucket  | No public access; all downloads via presigned URLs                |
| Presigned URL expiry   | 300 seconds (5 minutes)                                           |
| Credential protection  | Credentials never stored in DB or returned in API responses       |
| storageKey only        | No AWS S3 URLs stored in PostgreSQL                               |
| Upload authorization   | Admin-only (`authorize('ADMIN')` middleware)                      |
| Download authorization | Role checked; non-admins verified against `FileAssignment`        |
| User file isolation    | `GET /user/:userId` enforces caller == target for normal users    |
| Assignment scoping     | `GET /:id/assignments` returns only caller's row for normal users |
| MIME validation        | Multer `fileFilter` rejects non-allowed types (400)               |
| Size limit             | Multer `limits.fileSize` = 20 MB                                  |
| ID validation          | `Number.isNaN()` check before every DB lookup                     |

---

## Error Cases

| Status | Cause                                                                                         |
| ------ | --------------------------------------------------------------------------------------------- |
| `400`  | Invalid file ID or user ID; missing file in request; disallowed MIME type; file exceeds 20 MB |
| `401`  | No valid Clerk session token                                                                  |
| `403`  | Normal user attempting to access another user's files or download an unassigned file          |
| `404`  | File, user, or assignment not found                                                           |
| `409`  | File already assigned to the target user                                                      |
| `500`  | Unexpected server error (AWS S3 connectivity, DB failure, etc.)                               |

---

## Testing

### Manual API testing (e.g. with cURL or Postman)

**Upload**

```bash
curl -X POST http://localhost:4000/api/files/create \
  -H "Authorization: Bearer <admin-clerk-token>" \
  -F "file=@/path/to/document.pdf"
```

<<<<<<< Updated upstream
**List all files (Admin)**
=======
Verify:

- File is accepted.
- S3 object is created.
- PostgreSQL `File` record is created.
- `status` is `UPLOADED`.
- `isArchived` is `false`.

---

### List Active Files
>>>>>>> Stashed changes

```bash
curl http://localhost:4000/api/files \
  -H "Authorization: Bearer <admin-clerk-token>"
```

**Get file by ID**

```bash
curl http://localhost:4000/api/files/1 \
  -H "Authorization: Bearer <user-clerk-token>"
```

**Update metadata**

```bash
curl -X PATCH http://localhost:4000/api/files/1 \
  -H "Authorization: Bearer <admin-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"originalName": "renamed.pdf"}'
```

**Delete**

```bash
curl -X DELETE http://localhost:4000/api/files/1 \
  -H "Authorization: Bearer <admin-clerk-token>"
```

<<<<<<< Updated upstream
**Assign to user**
=======
Verify:

```text
isArchived = true
archivedAt != null
archivedById != null
```

Also verify:

- S3 object still exists.
- File database record still exists.
- FilePage records still exist.

---

### Restore

```bash
curl -X PATCH http://localhost:4000/api/files/1/restore \
  -H "Authorization: Bearer <admin-clerk-token>"
```

Verify:

```text
isArchived = false
archivedAt = null
archivedById = null
```

The original S3 object should still be used.

---

### Assign to User
>>>>>>> Stashed changes

```bash
curl -X POST http://localhost:4000/api/files/1/assign \
  -H "Authorization: Bearer <admin-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": 7}'
```

**Remove assignment**

```bash
curl -X DELETE http://localhost:4000/api/files/1/assign/7 \
  -H "Authorization: Bearer <admin-clerk-token>"
```

**Get user's files**

<<<<<<< Updated upstream
```bash
# As the user themselves:
curl http://localhost:4000/api/files/user/7 \
  -H "Authorization: Bearer <user-7-clerk-token>"
=======
- Assignment is removed.
- File still exists.
- S3 object still exists.
>>>>>>> Stashed changes

# As admin:
curl http://localhost:4000/api/files/user/7 \
  -H "Authorization: Bearer <admin-clerk-token>"
```

**Download (get presigned URL)**

```bash
curl http://localhost:4000/api/files/1/download \
  -H "Authorization: Bearer <user-clerk-token>"
# Use the returned `data.url` to download the file
```

**Download authorization — unassigned user should get 403**

```bash
curl http://localhost:4000/api/files/1/download \
  -H "Authorization: Bearer <unassigned-user-clerk-token>"
# Expected: 403 You are not allowed to download this file
```

---

## Development Checklist

<<<<<<< Updated upstream
- [ ] AWS S3 bucket created and set to **private**
- [ ] AWS IAM user created with `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` permissions
- [ ] Four `STORAGE_*` environment variables added to `.env`
- [ ] `pnpm prisma migrate dev` run successfully (migration `20260913005730_add_file_management`)
- [ ] `pnpm prisma generate` run (Prisma client updated)
- [ ] Backend started with `pnpm dev`
- [ ] Upload tested with a PDF — verify object appears in AWS S3 console
- [ ] Download tested — verify presigned URL expires after 5 minutes
- [ ] Delete tested — verify object disappears from AWS S3 console
- [ ] Assign tested — verify user can download after assignment
- [ ] Unauthorized download tested — verify 403 for unassigned user
- [ ] Cross-user file list tested — verify 403 for normal user accessing another user's files
=======
### AWS

- [ ] AWS S3 bucket created
- [ ] S3 bucket configured as **private**
- [ ] IAM credentials configured
- [ ] Required `STORAGE_*` environment variables added
- [ ] Real credentials are not committed to Git

### Database

- [ ] Prisma schema formatted
- [ ] Prisma schema validated
- [ ] File migration created/applied
- [ ] Prisma Client generated
- [ ] `FileStatus` enum exists
- [ ] `FilePageStatus` enum exists
- [ ] `FilePage` model exists
- [ ] Archive fields exist on `File`
- [ ] `FileAssignment` unique constraint exists

### File Management

- [ ] Backend starts successfully with `pnpm dev`
- [ ] PDF upload tested
- [ ] Image upload tested
- [ ] 20 MB size limit tested
- [ ] MIME validation tested
- [ ] S3 object creation verified
- [ ] Active file listing tested
- [ ] Archived file listing tested
- [ ] File metadata update tested
- [ ] Archive tested
- [ ] Restore tested
- [ ] Assignment tested
- [ ] Assignment removal tested
- [ ] Download tested
- [ ] Presigned URL expiry tested
- [ ] Unauthorized download tested
- [ ] Cross-user access tested
- [ ] Archived-user access tested

### Processing Foundation

- [ ] File-level processing status available
- [ ] Page-level status available
- [ ] `FilePage` unique `(fileId, pageNumber)` constraint verified
- [ ] Page confidence can be stored
- [ ] Page processing result can be stored as JSON
- [ ] Inngest workflow integration tested separately
- [ ] FastAPI page-processing integration tested separately

---

## Data Preservation Principle

The File Management feature treats uploaded land records as persistent records.

The normal lifecycle is:

```text
UPLOAD
   ↓
PROCESSING
   ↓
COMPLETED / NEEDS_VERIFICATION
   ↓
VERIFIED
   ↓
ARCHIVED
   ↓
RESTORED (if required)
```

Archiving changes the availability state of the file without destroying the underlying document or its processing history.

The normal API therefore does not expose permanent deletion of official files.
>>>>>>> Stashed changes
