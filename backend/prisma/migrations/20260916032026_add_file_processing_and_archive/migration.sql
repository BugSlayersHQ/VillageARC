-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'NEEDS_VERIFICATION', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "FilePageStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'NEEDS_VERIFICATION', 'VERIFIED', 'FAILED_PERMANENT');

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" INTEGER,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "FileStatus" NOT NULL DEFAULT 'UPLOADED';

-- CreateTable
CREATE TABLE "FilePage" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "status" "FilePageStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DOUBLE PRECISION,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FilePage_fileId_pageNumber_key" ON "FilePage"("fileId", "pageNumber");

-- AddForeignKey
ALTER TABLE "FilePage" ADD CONSTRAINT "FilePage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
