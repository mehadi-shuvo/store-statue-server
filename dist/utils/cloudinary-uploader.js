"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageBufferToCloudinary = void 0;
const cloudinary_config_1 = require("../config/cloudinary.config");
const env_config_1 = require("./env-config");
const uploadImageBufferToCloudinary = async (file, folder = env_config_1.ENV.CLOUDINARY_PRODUCT_FOLDER) => {
    (0, cloudinary_config_1.assertCloudinaryConfigured)();
    return new Promise((resolve, reject) => {
        const stream = cloudinary_config_1.cloudinary.uploader.upload_stream({
            folder,
            resource_type: "image",
            transformation: [{ quality: "auto", fetch_format: "auto" }],
        }, (error, result) => {
            if (error || !result) {
                reject(error);
                return;
            }
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
            });
        });
        stream.end(file.buffer);
    });
};
exports.uploadImageBufferToCloudinary = uploadImageBufferToCloudinary;
