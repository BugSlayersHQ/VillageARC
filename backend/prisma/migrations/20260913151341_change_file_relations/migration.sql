-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "FileAssignment" DROP CONSTRAINT "FileAssignment_assignedBy_fkey";

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAssignment" ADD CONSTRAINT "FileAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
