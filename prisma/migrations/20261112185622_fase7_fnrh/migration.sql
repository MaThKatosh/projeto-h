-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "address" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "docIssuer" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "zipCode" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "arrivingFrom" TEXT,
ADD COLUMN     "nextDestination" TEXT,
ADD COLUMN     "transport" TEXT,
ADD COLUMN     "travelPurpose" TEXT;
