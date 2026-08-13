"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productControllers = exports.bulkUploadProductsController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const apiAppError_1 = require("../../utils/apiAppError");
const cloudinary_uploader_1 = require("../../utils/cloudinary-uploader");
const product_service_1 = require("./product.service");
const JSON_FIELD_NAMES = new Set([
    "features",
    "giftCard",
    "gameTopUp",
    "subscription",
]);
const NUMBER_FIELD_NAMES = new Set([
    "price",
    "stockQuantity",
    "offerPercent",
    "sortOrder",
]);
const BOOLEAN_FIELD_NAMES = new Set(["isActive"]);
const parseMultipartProductBody = (body) => {
    const payload = {};
    Object.entries(body).forEach(([key, value]) => {
        if (value === undefined || value === "") {
            return;
        }
        if (JSON_FIELD_NAMES.has(key)) {
            try {
                payload[key] = typeof value === "string" ? JSON.parse(value) : value;
            }
            catch {
                throw new apiAppError_1.ApiAppError(400, `${key} must be valid JSON`);
            }
            return;
        }
        if (NUMBER_FIELD_NAMES.has(key)) {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) {
                throw new apiAppError_1.ApiAppError(400, `${key} must be a valid number`);
            }
            payload[key] = parsed;
            return;
        }
        if (BOOLEAN_FIELD_NAMES.has(key)) {
            payload[key] = value === "true" || value === true;
            return;
        }
        payload[key] = value;
    });
    return payload;
};
const getProductFiles = (req) => (req.files || {});
const mergeUploadedProductImages = async (payload, files) => {
    if (files.photos && files.photos.length > 0) {
        if (files.thumbnail?.[0] || files.photos.length > 1) {
            throw new apiAppError_1.ApiAppError(400, "The split digital catalog supports one primary image; use thumbnail or one legacy photos file");
        }
        files.thumbnail = [files.photos[0]];
    }
    const [thumbnail, bannerImage] = await Promise.all([
        files.thumbnail?.[0]
            ? (0, cloudinary_uploader_1.uploadImageBufferToCloudinary)(files.thumbnail[0])
            : Promise.resolve(null),
        files.bannerImage?.[0]
            ? (0, cloudinary_uploader_1.uploadImageBufferToCloudinary)(files.bannerImage[0])
            : Promise.resolve(null),
    ]);
    if (thumbnail) {
        payload.thumbnail = thumbnail.url;
    }
    if (bannerImage) {
        payload.bannerImage = bannerImage.url;
    }
    return payload;
};
const buildProductPayloadFromRequest = async (req) => {
    const payload = parseMultipartProductBody(req.body);
    return mergeUploadedProductImages(payload, getProductFiles(req));
};
/**
 * Add Product
 */
const addProduct = (0, catchAsync_1.default)(async (req, res) => {
    const payload = await buildProductPayloadFromRequest(req);
    const result = await product_service_1.productServices.addProduct(payload, req.authUser?.id);
    res.status(201).json({
        success: true,
        message: "Product added successfully",
        data: result,
    });
});
/**
 * Update Product
 */
const updateProduct = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const payload = await buildProductPayloadFromRequest(req);
    const result = await product_service_1.productServices.updateProduct(id, payload, req.authUser?.id);
    res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: result,
    });
});
/**
 * Delete Product
 */
const deleteProduct = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await product_service_1.productServices.deleteProduct(id);
    res.status(200).json({
        success: true,
        message: "Product deleted successfully",
        data: result,
    });
});
/**
 * get products
 */
const getProducts = (0, catchAsync_1.default)(async (req, res) => {
    const result = await product_service_1.productServices.getProducts(req.query);
    res.status(200).json({
        success: true,
        message: "Products fetched successfully",
        data: result,
    });
});
const getSingleProduct = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await product_service_1.productServices.getSingleProductWithRelated(id);
    res.status(200).json({
        success: true,
        message: "Product fetched successfully",
        data: result,
    });
});
exports.bulkUploadProductsController = (0, catchAsync_1.default)(async (req, res) => {
    const result = await product_service_1.productServices.bulkUploadProducts(req.body.products);
    res.status(201).json({
        success: true,
        ...result,
    });
});
exports.productControllers = {
    addProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getSingleProduct,
    bulkUploadProductsController: exports.bulkUploadProductsController,
};
