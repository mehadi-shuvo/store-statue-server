"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageUpload = exports.imageUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const apiAppError_1 = require("../utils/apiAppError");
const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);
exports.imageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10,
    },
    fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            callback(new apiAppError_1.ApiAppError(400, "Only JPG, PNG, WEBP, and GIF images are allowed"));
            return;
        }
        callback(null, true);
    },
});
exports.productImageUpload = exports.imageUpload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "photos", maxCount: 8 },
]);
