"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryServices = void 0;
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
/**
 * Add Category
 */
const addCategory = async (payload) => {
    const existingCategory = await prisma_client_1.prismaC.category.findFirst({
        where: {
            title: payload.title,
            isActive: true,
        },
    });
    if (existingCategory) {
        throw new apiAppError_1.ApiAppError(409, "Category with this title already exists");
    }
    const category = await prisma_client_1.prismaC.category.create({
        data: payload,
    });
    return category;
};
/**
 * Bulk Add Categories
 */
const bulkAddCategories = async (payload) => {
    const { categories } = payload;
    if (!Array.isArray(categories) || categories.length === 0) {
        throw new apiAppError_1.ApiAppError(400, "Categories array is required");
    }
    if (categories.length > 50) {
        throw new apiAppError_1.ApiAppError(400, "Bulk category limit exceeded (max 50 at once)");
    }
    const normalizedTitles = categories.map((category, index) => {
        const title = category?.title?.trim();
        if (!title) {
            throw new apiAppError_1.ApiAppError(400, `Category title is required at index ${index}`);
        }
        return title;
    });
    const uniqueTitles = new Set(normalizedTitles);
    if (uniqueTitles.size !== normalizedTitles.length) {
        throw new apiAppError_1.ApiAppError(400, "Duplicate category titles found in request");
    }
    const existingCategories = await prisma_client_1.prismaC.category.findMany({
        where: {
            title: { in: normalizedTitles },
            isActive: true,
        },
        select: {
            title: true,
        },
    });
    if (existingCategories.length > 0) {
        throw new apiAppError_1.ApiAppError(409, `Category already exists: ${existingCategories
            .map((category) => category.title)
            .join(", ")}`);
    }
    const createdCategories = await prisma_client_1.prismaC.$transaction(categories.map((category, index) => prisma_client_1.prismaC.category.create({
        data: {
            title: normalizedTitles[index],
            description: category.description,
        },
    })));
    return {
        message: "Categories added successfully",
        count: createdCategories.length,
        data: createdCategories,
    };
};
/**
 * Get All Categories
 */
const getCategories = async (query) => {
    const includeInactive = query?.includeInactive === "true";
    const categories = await prisma_client_1.prismaC.category.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { title: "asc" },
    });
    return categories;
};
/**
 * Update Category
 */
const updateCategory = async (categoryId, payload) => {
    const categoryExists = await prisma_client_1.prismaC.category.findUnique({
        where: { id: categoryId },
    });
    if (!categoryExists || !categoryExists.isActive) {
        throw new apiAppError_1.ApiAppError(404, "Category not found");
    }
    if (payload.title) {
        const duplicateCategory = await prisma_client_1.prismaC.category.findFirst({
            where: {
                title: payload.title,
                isActive: true,
                NOT: { id: categoryId },
            },
        });
        if (duplicateCategory) {
            throw new apiAppError_1.ApiAppError(409, "Category with this title already exists");
        }
    }
    const updatedCategory = await prisma_client_1.prismaC.category.update({
        where: { id: categoryId },
        data: payload,
    });
    return updatedCategory;
};
/**
 * Delete Category (Soft Delete)
 */
const deleteCategory = async (categoryId) => {
    const categoryExists = await prisma_client_1.prismaC.category.findUnique({
        where: { id: categoryId },
        include: {
            products: {
                where: { isActive: true },
            },
        },
    });
    if (!categoryExists || !categoryExists.isActive) {
        throw new apiAppError_1.ApiAppError(404, "Category not found");
    }
    if (categoryExists.products.length > 0) {
        throw new apiAppError_1.ApiAppError(400, "Cannot delete category with active products");
    }
    const deletedCategory = await prisma_client_1.prismaC.category.update({
        where: { id: categoryId },
        data: { isActive: false },
    });
    return deletedCategory;
};
exports.categoryServices = {
    addCategory,
    bulkAddCategories,
    getCategories,
    updateCategory,
    deleteCategory,
};
