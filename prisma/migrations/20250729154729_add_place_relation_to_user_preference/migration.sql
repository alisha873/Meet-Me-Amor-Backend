/*
  Warnings:

  - Made the column `selectedPlace` on table `UserPreference` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."UserPreference" ALTER COLUMN "selectedPlace" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."UserPreference" ADD CONSTRAINT "UserPreference_selectedPlace_fkey" FOREIGN KEY ("selectedPlace") REFERENCES "public"."Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
