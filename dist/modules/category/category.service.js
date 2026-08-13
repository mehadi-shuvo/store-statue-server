"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryServices = void 0;
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const toSlug = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const getAvailableSlug = async (value, excludeId) => {
    const baseSlug = toSlug(value);
    if (!baseSlug)
        throw new apiAppError_1.ApiAppError(400, "A valid category slug is required");
    let slug = baseSlug;
    let suffix = 2;
    while (await prisma_client_1.prismaC.category.findFirst({
        where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
    })) {
        slug = `${baseSlug}-${suffix++}`;
    }
    return slug;
};
const normalizeCategoryPayload = (payload, requireTitle = false) => {
    const title = payload.title?.trim();
    if (requireTitle && !title) {
        throw new apiAppError_1.ApiAppError(400, "Category title is required");
    }
    return {
        ...(title ? { title } : {}),
        ...(payload.slug?.trim() ? { slug: payload.slug.trim() } : {}),
        ...(typeof payload.description === "string"
            ? { description: payload.description.trim() || null }
            : {}),
        ...(typeof payload.isActive === "boolean"
            ? { isActive: payload.isActive }
            : {}),
        ...(typeof payload.sortOrder === "number" && Number.isInteger(payload.sortOrder)
            ? { sortOrder: payload.sortOrder }
            : {}),
    };
};
/**
 * Add Category
 */
const addCategory = async (payload) => {
    const categoryData = normalizeCategoryPayload(payload, true);
    const title = categoryData.title;
    if (!title) {
        throw new apiAppError_1.ApiAppError(400, "Category title is required");
    }
    const existingCategory = await prisma_client_1.prismaC.category.findFirst({
        where: {
            title: { equals: title, mode: "insensitive" },
            isActive: true,
        },
    });
    if (existingCategory) {
        throw new apiAppError_1.ApiAppError(409, "Category with this title already exists");
    }
    const slug = await getAvailableSlug(categoryData.slug ?? title);
    const category = await prisma_client_1.prismaC.category.create({
        data: {
            ...categoryData,
            title,
            slug,
        },
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
    const uniqueTitles = new Set(normalizedTitles.map((title) => title.toLowerCase()));
    if (uniqueTitles.size !== normalizedTitles.length) {
        throw new apiAppError_1.ApiAppError(400, "Duplicate category titles found in request");
    }
    const existingCategories = await prisma_client_1.prismaC.category.findMany({
        where: {
            OR: normalizedTitles.map((title) => ({
                title: { equals: title, mode: "insensitive" },
            })),
            isActive: true,
        },
        select: {
            title: true,
        },
    });
    if (existingCategories.length > 0) {
        const existingCategoryTitles = existingCategories.map((category) => category.title);
        throw new apiAppError_1.ApiAppError(409, `Category already exists: ${existingCategoryTitles.join(", ")}`);
    }
    const slugs = [];
    for (let index = 0; index < categories.length; index += 1) {
        const requestedSlug = categories[index].slug ?? normalizedTitles[index];
        const baseSlug = toSlug(requestedSlug);
        if (!baseSlug) {
            throw new apiAppError_1.ApiAppError(400, `A valid category slug is required at index ${index}`);
        }
        let slug = baseSlug;
        let suffix = 2;
        while (slugs.includes(slug) || (await prisma_client_1.prismaC.category.findUnique({ where: { slug } }))) {
            slug = `${baseSlug}-${suffix++}`;
        }
        slugs.push(slug);
    }
    const createdCategories = await prisma_client_1.prismaC.$transaction(categories.map((category, index) => prisma_client_1.prismaC.category.create({
        data: {
            title: normalizedTitles[index],
            slug: slugs[index],
            ...(typeof category.description === "string"
                ? { description: category.description.trim() || null }
                : {}),
            ...(typeof category.isActive === "boolean"
                ? { isActive: category.isActive }
                : {}),
            ...(Number.isInteger(category.sortOrder)
                ? { sortOrder: category.sortOrder }
                : {}),
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
    const categoryData = normalizeCategoryPayload(payload);
    if (categoryData.slug) {
        categoryData.slug = await getAvailableSlug(categoryData.slug, categoryId);
    }
    if (categoryData.title) {
        const duplicateCategory = await prisma_client_1.prismaC.category.findFirst({
            where: {
                title: categoryData.title,
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
        data: categoryData,
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
            giftCards: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } },
            gameTopUps: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } },
            subscriptions: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } },
        },
    });
    if (!categoryExists || !categoryExists.isActive) {
        throw new apiAppError_1.ApiAppError(404, "Category not found");
    }
    if (categoryExists.giftCards.length > 0 ||
        categoryExists.gameTopUps.length > 0 ||
        categoryExists.subscriptions.length > 0) {
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
