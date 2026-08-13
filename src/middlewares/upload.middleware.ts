import multer from "multer";
import { ApiAppError } from "../utils/apiAppError";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(new ApiAppError(400, "Only JPG, PNG, WEBP, and GIF images are allowed"));
      return;
    }

    callback(null, true);
  },
});

export const productImageUpload = imageUpload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
  { name: "photos", maxCount: 8 },
]);
