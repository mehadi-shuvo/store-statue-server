"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productControllers = exports.bulkUploadProductsController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const product_service_1 = require("./product.service");
/**
 * Add Product
 */
const addProduct = (0, catchAsync_1.default)(async (req, res) => {
    const result = await product_service_1.productServices.addProduct(req.body);
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
    const result = await product_service_1.productServices.updateProduct(id, req.body);
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
