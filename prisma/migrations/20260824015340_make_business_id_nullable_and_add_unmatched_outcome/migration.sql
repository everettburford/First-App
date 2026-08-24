-- AlterEnum
ALTER TYPE "CallOutcome" ADD VALUE 'NO_BUSINESS_CONFIGURED';

-- DropForeignKey
ALTER TABLE "CallLog" DROP CONSTRAINT "CallLog_businessId_fkey";

-- AlterTable
ALTER TABLE "CallLog" ALTER COLUMN "businessId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
