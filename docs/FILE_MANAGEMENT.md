# File Management

## Overview

The File Management feature allows land records (PDFs and images) to be uploaded to AWS S3, stored securely, and selectively shared with registered users through an assignment system.

Admins control file uploads, metadata updates, archiving, restoration, and assignments.

Users can only access files that have been explicitly assigned to them.

The system does **not permanently delete official files through the normal File Management API**. Instead, files can be archived and later restored. Archived files remain stored in AWS S3 and PostgreSQL so that the document record and processing history are preserved.

The File Management feature also provides database support for page-level document processing through `FilePage`, including page status, confidence, and ML/OCR results.

---

## Architecture

```text
Frontend (Next.js)
        ↓
Express API
(backend/src/app.ts → /api/files)
        ↓
Multer
(memory storage, MIME + size validation)
        ↓
AWS SDK v3
(S3Client in src/lib/storage.ts)
        ↓
AWS S3
(private bucket)
        ↓
PostgreSQL / Prisma
        ↓
File
FileAssignment
FilePage
```

### Processing Architecture

File Management stores the document and provides the database foundation for page-level processing.

```text
PDF / Image Upload
        ↓
Express Backend
        ↓
AWS S3
        ↓
Inngest Workflow
        ↓
FastAPI
(PDF processing / ML)
        ↓
Page-level results
        ↓
FilePage
        ├── pageNumber
        ├── status
        ├── confidence
        └── result
        ↓
File status
```

`File` represents the uploaded document, while `FilePage` represents the processing state and result of each individual page.

---

## Storage Strategy

- AWS S3 is used for object storage.
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

---

## Folder Structure

```text
backend/

├── src/
│   ├── controllers/
│   │   └── file.controller.ts
│   │       # File-management business logic
│   │
│   ├── routes/
│   │   └── file.routes.ts
│   │       # Express router wiring for /api/files
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   │   # protect + authorize (Clerk)
│   │   │
│   │   └── upload.middleware.ts
│   │       # Multer memory storage,
│   │       # MIME + size validation
│   │
│   ├── lib/
│   │   └── storage.ts
│   │       # S3Client initialisation
│   │
│   └── types/
│       ├── error.types.ts
│       │   # AppError interface
│       │
│       └── express.d.ts
│           # Express Request augmentation
│
├── prisma/
│   ├── schema.prisma
│   │   # File, FileAssignment,
│   │   # FilePage and status enums
│   │
│   └── migrations/
│       └── <file-management-migration>/
│           └── migration.sql
```

> **No `config/` files are created for this feature.**

> Environment variables are read directly from `process.env` and loaded by `dotenv` in `server.ts`.

---

## Environment Variables

Add these to your `.env` file. See `.env.example` for placeholders.

| Variable                    | Description               | Example                                    |
| --------------------------- | ------------------------- | ------------------------------------------ |
| `STORAGE_REGION`            | AWS S3 region             | `ap-south-1`                               |
| `STORAGE_ACCESS_KEY_ID`     | AWS IAM Access Key ID     | `AKIAIOSFODNN7EXAMPLE`                     |
| `STORAGE_SECRET_ACCESS_KEY` | AWS IAM Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `STORAGE_BUCKET`            | AWS S3 bucket name        | `villagearc-land-records`                  |

> **Never commit real credentials.**

The `.env` file must remain git-ignored.

---

## AWS S3 Setup

1. Log in to the AWS Management Console.
2. Go to **S3** and create a bucket, for example:
   `villagearc-land-records`.
3. Keep the bucket **private** and enable Block Public Access.
4. Go to **IAM** and create an IAM identity for backend S3 access.
5. Grant only the S3 permissions required by the backend.
6. Add the four `STORAGE_*` variables to `.env`.
7. Start the backend:

```bash
pnpm dev
```

8. Test upload with:

```text
POST /api/files/create
```

An authenticated ADMIN token is required.

### S3 Permissions

The backend currently requires access to objects for:

```text
PutObject
GetObject
```

`DeleteObject` is **not required for normal file archiving**, because archiving intentionally preserves the S3 object.

If permanent deletion is introduced in the future, it should be implemented as a separately controlled operation with appropriate authorization and audit requirements.

---

## Upload Flow

```text
Client
(multipart/form-data, field: file)
        ↓
Multer
        ↓
MIME validation
        ↓
20 MB size validation
        ↓
Controller reads req.file.buffer
        ↓
Generate unique filename
        ↓
Build storage key
        ↓
PutObjectCommand
        ↓
AWS S3
        ↓
prisma.file.create()
        ↓
File metadata stored in PostgreSQL
        ↓
201 response
```

Generated storage key:

```text
land-records/<timestamp>-<random>-<originalname>
```

The database stores metadata such as:

```text
originalName
fileName
mimeType
size
storageKey
uploadedById
status
```

---

## Download Flow

```text
Client
GET /api/files/:id/download
        ↓
protect middleware
        ↓
Controller checks caller
        ↓
ADMIN
  → allowed

USER
  → FileAssignment checked
  → assigned → allowed
  → not assigned → 403
        ↓
Check archive status
        ↓
Active file
        ↓
GetObjectCommand
        ↓
getSignedUrl()
        ↓
Presigned URL
        ↓
Client downloads directly from S3
```

Presigned URL configuration:

```text
Expiration: 300 seconds
```

Archived files cannot be downloaded by normal users.

Admins can download archived files for administrative access.

The S3 bucket itself remains private.

---

## Archive Flow

The normal File Management API does **not permanently delete official files**.

Instead, an Admin can archive a file.

```text
Admin
PATCH /api/files/:id/archive
        ↓
protect
        ↓
authorize('ADMIN')
        ↓
Find file
        ↓
Verify Admin owns file
        ↓
Check current archive state
        ↓
isArchived = true
archivedAt = current timestamp
archivedById = current Admin ID
        ↓
Database updated
        ↓
200 response
```

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

---

## Assignment Flow

An Admin can assign an active file to a registered user.

```text
Admin
POST /api/files/:id/assign
{
  "userId": 123
}
        ↓
Verify file exists
        ↓
Verify file is not archived
        ↓
Verify Admin owns file
        ↓
Verify target user belongs to Admin
        ↓
Check unique constraint
        ↓
Create FileAssignment
        ↓
201 response
```

A file can be assigned to multiple users.

However, the same file cannot be assigned to the same user more than once.

This is enforced by:

```text
@@unique([fileId, userId])
```

---

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

## API Endpoints

| Method   | Endpoint                        | Auth     | Role  | Description                     |
| -------- | ------------------------------- | -------- | ----- | ------------------------------- |
| `POST`   | `/api/files/create`             | Required | ADMIN | Upload a new file to S3         |
| `GET`    | `/api/files`                    | Required | ADMIN | List active files               |
| `GET`    | `/api/files/archived`           | Required | ADMIN | List archived files             |
| `GET`    | `/api/files/user/:userId`       | Required | Any   | Get files assigned to a user    |
| `GET`    | `/api/files/:id`                | Required | Any   | Get file details                |
| `PATCH`  | `/api/files/:id`                | Required | ADMIN | Update file metadata            |
| `PATCH`  | `/api/files/:id/archive`        | Required | ADMIN | Archive a file                  |
| `PATCH`  | `/api/files/:id/restore`        | Required | ADMIN | Restore an archived file        |
| `GET`    | `/api/files/:id/download`       | Required | Any   | Generate presigned download URL |
| `POST`   | `/api/files/:id/assign`         | Required | ADMIN | Assign file to a user           |
| `DELETE` | `/api/files/:id/assign/:userId` | Required | ADMIN | Remove file assignment          |
| `GET`    | `/api/files/:id/assignments`    | Required | Any   | List file assignments           |

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

---

## Request Examples

### Upload a File

```http
POST /api/files/create
Authorization: Bearer <admin-clerk-token>
Content-Type: multipart/form-data
```

Form field:

```text
file = land_record.pdf
```

---

### Update File Metadata

```http
PATCH /api/files/42
Authorization: Bearer <admin-clerk-token>
Content-Type: application/json
```

```json
{
  "originalName": "Khasra_Plot_42_Updated.pdf"
}
```

---

### Archive a File

```http
PATCH /api/files/42/archive
Authorization: Bearer <admin-clerk-token>
```

Example response:

```json
{
  "success": true,
  "message": "File archived successfully"
}
```

---

### Restore a File

```http
PATCH /api/files/42/restore
Authorization: Bearer <admin-clerk-token>
```

Example response:

```json
{
  "success": true,
  "message": "File restored successfully"
}
```

---

### Assign a File

```http
POST /api/files/42/assign
Authorization: Bearer <admin-clerk-token>
Content-Type: application/json
```

```json
{
  "userId": 7
}
```

---

### Remove File Assignment

```http
DELETE /api/files/42/assign/7
Authorization: Bearer <admin-clerk-token>
```

This removes only the assignment relationship.

The official file remains stored.

---

### Download a File

```http
GET /api/files/42/download
Authorization: Bearer <clerk-session-token>
```

Example response:

```json
{
  "success": true,
  "message": "Download URL generated successfully",
  "data": {
    "url": "<presigned-s3-url>",
    "expiresIn": 300
  }
}
```

The client uses `data.url` directly to download the file.

---

## Response Examples

### Successful Upload

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
    "status": "UPLOADED",
    "isArchived": false,
    "createdAt": "2026-09-13T02:00:00.000Z",
    "updatedAt": "2026-09-13T02:00:00.000Z"
  }
}
```

### Successful Archive

```json
{
  "success": true,
  "message": "File archived successfully",
  "data": {
    "id": 1,
    "isArchived": true,
    "archivedAt": "2026-09-16T02:00:00.000Z",
    "archivedById": 3
  }
}
```

### Successful Restore

```json
{
  "success": true,
  "message": "File restored successfully",
  "data": {
    "id": 1,
    "isArchived": false,
    "archivedAt": null,
    "archivedById": null
  }
}
```

### File Assignment

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
    "user": {
      "id": 7,
      "name": "Ramesh Kumar",
      "email": "ramesh@example.com"
    }
  }
}
```

---

## Database Schema

### `File`

| Column         | Type       | Description                            |
| -------------- | ---------- | -------------------------------------- |
| `id`           | Int (PK)   | Auto-increment primary key             |
| `originalName` | String     | Human-readable filename                |
| `fileName`     | String     | Generated filename                     |
| `mimeType`     | String     | Uploaded file MIME type                |
| `size`         | Int        | File size in bytes                     |
| `storageKey`   | String     | AWS S3 object key                      |
| `status`       | FileStatus | Overall file-processing status         |
| `uploadedById` | Int (FK)   | References `Admin.id`                  |
| `isArchived`   | Boolean    | Indicates whether the file is archived |
| `archivedAt`   | DateTime?  | Archive timestamp                      |
| `archivedById` | Int?       | ID of Admin who archived the file      |
| `createdAt`    | DateTime   | Creation timestamp                     |
| `updatedAt`    | DateTime   | Last update timestamp                  |

---

### `FileAssignment`

| Column       | Type     | Description                |
| ------------ | -------- | -------------------------- |
| `id`         | Int (PK) | Auto-increment primary key |
| `fileId`     | Int (FK) | References `File.id`       |
| `userId`     | Int (FK) | References `User.id`       |
| `assignedBy` | Int (FK) | References `Admin.id`      |
| `createdAt`  | DateTime | Assignment timestamp       |

Unique constraint:

```text
(fileId, userId)
```

A file can only be assigned once to the same user.

---

### `FilePage`

| Column       | Type           | Description                     |
| ------------ | -------------- | ------------------------------- |
| `id`         | Int (PK)       | Auto-increment primary key      |
| `fileId`     | Int (FK)       | References `File.id`            |
| `pageNumber` | Int            | Page number within the document |
| `status`     | FilePageStatus | Current page-processing status  |
| `confidence` | Float?         | ML/OCR confidence score         |
| `result`     | Json?          | Page-level processing result    |
| `createdAt`  | DateTime       | Creation timestamp              |
| `updatedAt`  | DateTime       | Last update timestamp           |

Unique constraint:

```text
(fileId, pageNumber)
```

This guarantees that each page number is represented only once for a given file.

---

## File Status

```text
UPLOADED
PROCESSING
COMPLETED
NEEDS_VERIFICATION
VERIFIED
FAILED
```

### Meaning

| Status               | Meaning                                               |
| -------------------- | ----------------------------------------------------- |
| `UPLOADED`           | File has been uploaded but processing has not started |
| `PROCESSING`         | File/page processing is currently running             |
| `COMPLETED`          | Processing completed                                  |
| `NEEDS_VERIFICATION` | Processing produced a result requiring verification   |
| `VERIFIED`           | Result has been verified                              |
| `FAILED`             | File processing failed                                |

---

## File Page Status

```text
PENDING
PROCESSING
COMPLETED
NEEDS_VERIFICATION
VERIFIED
FAILED_PERMANENT
```

Each page can move through its own processing lifecycle independently.

This is important for page-level ML/OCR processing because one page can require verification while other pages have already completed successfully.

---

## Security

| Concern                    | Implementation                                         |
| -------------------------- | ------------------------------------------------------ |
| Private AWS S3 bucket      | No public access                                       |
| Presigned URL expiry       | 300 seconds                                            |
| Credential protection      | Credentials never stored in DB or API responses        |
| `storageKey` only          | No S3 URLs stored in PostgreSQL                        |
| Upload authorization       | ADMIN-only                                             |
| Archive authorization      | ADMIN-only                                             |
| Restore authorization      | ADMIN-only                                             |
| Download authorization     | ADMIN or assigned USER                                 |
| User file isolation        | Normal users can only access their own assigned files  |
| Assignment scoping         | Normal users only see their own assignment information |
| MIME validation            | Multer `fileFilter`                                    |
| Size limit                 | 20 MB                                                  |
| ID validation              | Numeric validation before database lookups             |
| Archived-file protection   | Normal users cannot access archived files              |
| Official file preservation | Archive does not delete S3 or DB records               |

---

## Error Cases

| Status | Cause                                                                                       |
| ------ | ------------------------------------------------------------------------------------------- |
| `400`  | Invalid file ID/user ID, missing file, disallowed MIME type, file exceeds 20 MB             |
| `401`  | No valid Clerk session token                                                                |
| `403`  | Unauthorized user access, cross-user access, unassigned download, non-admin archive/restore |
| `404`  | File, user, or assignment not found                                                         |
| `409`  | File already assigned, or conflicting file state                                            |
| `410`  | Archived file requested by an operation that does not allow archived access                 |
| `500`  | Unexpected AWS S3, database, or server failure                                              |

---

## Testing

### Upload

```bash
curl -X POST http://localhost:4000/api/files/create \
  -H "Authorization: Bearer <admin-clerk-token>" \
  -F "file=@/path/to/document.pdf"
```

Verify:

- File is accepted.
- S3 object is created.
- PostgreSQL `File` record is created.
- `status` is `UPLOADED`.
- `isArchived` is `false`.

---

### List Active Files

```bash
curl http://localhost:4000/api/files \
  -H "Authorization: Bearer <admin-clerk-token>"
```

Archived files should not appear in the normal active-file list.

---

### List Archived Files

```bash
curl http://localhost:4000/api/files/archived \
  -H "Authorization: Bearer <admin-clerk-token>"
```

Only archived files should appear.

---

### Update Metadata

```bash
curl -X PATCH http://localhost:4000/api/files/1 \
  -H "Authorization: Bearer <admin-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"originalName": "renamed.pdf"}'
```

Verify that only metadata changes.

---

### Archive

```bash
curl -X PATCH http://localhost:4000/api/files/1/archive \
  -H "Authorization: Bearer <admin-clerk-token>"
```

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

```bash
curl -X POST http://localhost:4000/api/files/1/assign \
  -H "Authorization: Bearer <admin-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": 7}'
```

Verify that the user can subsequently access the assigned file.

---

### Remove Assignment

```bash
curl -X DELETE http://localhost:4000/api/files/1/assign/7 \
  -H "Authorization: Bearer <admin-clerk-token>"
```

Verify:

- Assignment is removed.
- File still exists.
- S3 object still exists.

---

### Download

```bash
curl http://localhost:4000/api/files/1/download \
  -H "Authorization: Bearer <user-clerk-token>"
```

Verify that the returned presigned URL works and expires after 5 minutes.

---

### Unauthorized Download

```bash
curl http://localhost:4000/api/files/1/download \
  -H "Authorization: Bearer <unassigned-user-clerk-token>"
```

Expected:

```text
403
```

---

### Archived File Access

Archive a file and test as a normal user.

Expected:

```text
User list       → file not visible
User details    → access denied
User download   → access denied
User assignment → not allowed
```

Admin should still be able to inspect the archived record.

---

### Archive/Restore Authorization

Test:

```text
USER → archive → 403
USER → restore → 403

ADMIN → archive active file → success
ADMIN → archive archived file → error

ADMIN → restore archived file → success
ADMIN → restore active file → error
```

---

## Development Checklist

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
