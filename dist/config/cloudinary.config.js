"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = exports.assertCloudinaryConfigured = void 0;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const apiAppError_1 = require("../utils/apiAppError");
const env_config_1 = require("../utils/env-config");
cloudinary_1.v2.config({
    cloud_name: env_config_1.ENV.CLOUDINARY_CLOUD_NAME,
    api_key: env_config_1.ENV.CLOUDINARY_API_KEY,
    api_secret: env_config_1.ENV.CLOUDINARY_API_SECRET,
    secure: true,
});
const assertCloudinaryConfigured = () => {
    if (!env_config_1.ENV.CLOUDINARY_CLOUD_NAME ||
        !env_config_1.ENV.CLOUDINARY_API_KEY ||
        !env_config_1.ENV.CLOUDINARY_API_SECRET) {
        throw new apiAppError_1.ApiAppError(500, "Cloudinary credentials are not configured");
    }
};
exports.assertCloudinaryConfigured = assertCloudinaryConfigured;
