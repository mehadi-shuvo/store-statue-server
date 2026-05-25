-- AlterTable
ALTER TABLE "products" ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "offerPercent" INTEGER DEFAULT 0,
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
