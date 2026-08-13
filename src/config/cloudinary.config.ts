import { v2 as cloudinary } from "cloudinary";
import { ApiAppError } from "../utils/apiAppError";
import { ENV } from "../utils/env-config";

cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
  secure: true,
});

export const assertCloudinaryConfigured = () => {
  if (
    !ENV.CLOUDINARY_CLOUD_NAME ||
    !ENV.CLOUDINARY_API_KEY ||
    !ENV.CLOUDINARY_API_SECRET
  ) {
    throw new ApiAppError(500, "Cloudinary credentials are not configured");
  }
};

export { cloudinary };
