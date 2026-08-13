import { UploadApiResponse } from "cloudinary";
import { cloudinary, assertCloudinaryConfigured } from "../config/cloudinary.config";
import { ENV } from "./env-config";

export type UploadedImage = {
  url: string;
  publicId: string;
};

export const uploadImageBufferToCloudinary = async (
  file: Express.Multer.File,
  folder = ENV.CLOUDINARY_PRODUCT_FOLDER,
): Promise<UploadedImage> => {
  assertCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    stream.end(file.buffer);
  });
};
