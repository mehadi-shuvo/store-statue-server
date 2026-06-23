"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryControllers = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const category_service_1 = require("./category.service");
/**
 * Add Category
 */
const addCategory = (0, catchAsync_1.default)(async (req, res) => {
    const result = await category_service_1.categoryServices.addCategory(req.body);
    res.status(201).json({
        success: true,
        message: "Category added successfully",
        data: result,
    });
});
/**
 * Bulk Add Categories
 */
const bulkAddCategories = (0, catchAsync_1.default)(async (req, res) => {
    const result = await category_service_1.categoryServices.bulkAddCategories(req.body);
    res.status(201).json({
        success: true,
        message: result.message,
        data: result.data,
        meta: {
            count: result.count,
        },
    });
});
/**
 * Get All Categories
 */
const getCategories = (0, catchAsync_1.default)(async (req, res) => {
    const result = await category_service_1.categoryServices.getCategories(req.query);
    res.status(200).json({
        success: true,
        message: "Categories fetched successfully",
        data: result,
    });
});
/**
 * Update Category
 */
const updateCategory = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await category_service_1.categoryServices.updateCategory(id, req.body);
    res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: result,
    });
});
/**
 * Delete Category
 */
const deleteCategory = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await category_service_1.categoryServices.deleteCategory(id);
    res.status(200).json({
        success: true,
        message: "Category deleted successfully",
        data: result,
    });
});
exports.categoryControllers = {
    addCategory,
    bulkAddCategories,
    getCategories,
    updateCategory,
    deleteCategory,
};
