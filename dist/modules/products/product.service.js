"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productServices = void 0;
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
/* ======================================================
   ADD PRODUCT
====================================================== */
const addProduct = async (payload) => {
    // ✅ Category Check
    const categoryExists = await prisma_client_1.prismaC.category.findFirst({
        where: {
            id: payload.categoryId,
            isActive: true,
        },
    });
    if (!categoryExists) {
        throw new apiAppError_1.ApiAppError(404, "Category not found or inactive");
    }
    // ✅ Offer validation
    if (payload.offerPercent && payload.offerPercent > 90) {
        throw new apiAppError_1.ApiAppError(400, "Offer percentage cannot exceed 90%");
    }
    // ✅ Create Product
    const product = await prisma_client_1.prismaC.product.create({
        data: {
            title: payload.title,
            description: payload.description,
            price: payload.price,
            stockQuantity: payload.stockQuantity,
            categoryId: payload.categoryId,
            offerPercent: payload.offerPercent || 0,
            photos: payload.photos || [],
            features: payload.features || [],
        },
    });
    return product;
};
/* ======================================================
   UPDATE PRODUCT
====================================================== */
const updateProduct = async (productId, payload) => {
    // ✅ Product Check
    const productExists = await prisma_client_1.prismaC.product.findFirst({
        where: {
            id: productId,
            isActive: true,
        },
    });
    if (!productExists) {
        throw new apiAppError_1.ApiAppError(404, "Product not found");
    }
    // ✅ Category Validation
    if (payload.categoryId) {
        const categoryExists = await prisma_client_1.prismaC.category.findFirst({
            where: {
                id: payload.categoryId,
                isActive: true,
            },
        });
        if (!categoryExists) {
            throw new apiAppError_1.ApiAppError(404, "Category not found");
        }
    }
    // ✅ Offer validation
    if (payload.offerPercent && payload.offerPercent > 90) {
        throw new apiAppError_1.ApiAppError(400, "Offer percentage cannot exceed 90%");
    }
    // ✅ Update Product
    const updatedProduct = await prisma_client_1.prismaC.product.update({
        where: { id: productId },
        data: payload,
    });
    return updatedProduct;
};
/* ======================================================
   DELETE PRODUCT (SOFT DELETE)
====================================================== */
const deleteProduct = async (productId) => {
    const productExists = await prisma_client_1.prismaC.product.findFirst({
        where: {
            id: productId,
            isActive: true,
        },
    });
    if (!productExists) {
        throw new apiAppError_1.ApiAppError(404, "Product not found");
    }
    const deletedProduct = await prisma_client_1.prismaC.product.update({
        where: { id: productId },
        data: { isActive: false },
    });
    return deletedProduct;
};
const ALLOWED_SORT_FIELDS = ["createdAt", "price", "title"];
const ALLOWED_SORT_ORDER = ["asc", "desc"];
const getProducts = async (query) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Number(query.limit) || 12, 100);
    const skip = (page - 1) * limit;
    const sortField = ALLOWED_SORT_FIELDS.includes(query.sort)
        ? query.sort
        : "createdAt";
    const sortOrder = ALLOWED_SORT_ORDER.includes(query.order)
        ? query.order
        : "desc";
    const where = {
        isActive: true,
    };
    // ✅ Search
    if (query.search?.trim()) {
        const search = query.search.trim();
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ];
    }
    // ✅ Category
    const categoryIds = query.categories
        ?.split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    if (categoryIds?.length) {
        where.categoryId = { in: categoryIds };
    }
    // ✅ Price
    const minPrice = query.minPrice ? Number(query.minPrice) : undefined;
    const maxPrice = query.maxPrice ? Number(query.maxPrice) : undefined;
    if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {
            ...(minPrice !== undefined && { gte: minPrice }),
            ...(maxPrice !== undefined && { lte: maxPrice }),
        };
    }
    // ✅ Stock
    if (query.inStock === "true") {
        where.stockQuantity = { gt: 0 };
    }
    const [products, total] = await prisma_client_1.prismaC.$transaction([
        prisma_client_1.prismaC.product.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortField]: sortOrder },
            include: {
                category: { select: { id: true, title: true } },
                reviews: { select: { rating: true } },
            },
        }),
        prisma_client_1.prismaC.product.count({ where }),
    ]);
    return {
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
        data: products,
    };
};
/* ======================================================
   GET SINGLE PRODUCT + RELATED PRODUCTS
====================================================== */
const RELATED_PRODUCTS_LIMIT = 6;
const getSingleProductWithRelated = async (productId) => {
    // ✅ Main Product
    const product = await prisma_client_1.prismaC.product.findFirst({
        where: {
            id: productId,
            isActive: true,
        },
        include: {
            category: {
                select: {
                    id: true,
                    title: true,
                },
            },
            // ✅ Reviews Include
            reviews: {
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
    });
    if (!product) {
        throw new apiAppError_1.ApiAppError(404, "Product not found");
    }
    // ✅ Related Products
    const relatedProducts = await prisma_client_1.prismaC.product.findMany({
        where: {
            isActive: true,
            categoryId: product.categoryId,
            NOT: { id: product.id },
        },
        take: RELATED_PRODUCTS_LIMIT,
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            title: true,
            price: true,
            stockQuantity: true,
            // ✅ New Fields
            offerPercent: true,
            photos: true,
        },
    });
    return {
        product,
        relatedProducts,
    };
};
const bulkUploadProducts = async (products) => {
    if (!products || products.length === 0) {
        throw new apiAppError_1.ApiAppError(400, "No products provided for bulk upload");
    }
    if (products.length > 20) {
        throw new apiAppError_1.ApiAppError(400, "Bulk upload limit exceeded (max 200 products at once)");
    }
    // ✅ Validate Categories (all unique categoryIds)
    const categoryIds = [...new Set(products.map((p) => p.categoryId))];
    const validCategories = await prisma_client_1.prismaC.category.findMany({
        where: {
            id: { in: categoryIds },
            isActive: true,
        },
        select: { id: true },
    });
    const validCategorySet = new Set(validCategories.map((c) => c.id));
    // ❌ Check invalid categories
    const invalidCategories = categoryIds.filter((id) => !validCategorySet.has(id));
    if (invalidCategories.length > 0) {
        throw new apiAppError_1.ApiAppError(404, `Invalid category IDs: ${invalidCategories.join(", ")}`);
    }
    // ✅ Prepare Data
    const formattedProducts = products.map((p) => ({
        title: p.title,
        description: p.description,
        price: p.price,
        stockQuantity: p.stockQuantity,
        categoryId: p.categoryId,
        offerPercent: p.offerPercent || 0,
        photos: p.photos || [],
        features: p.features || [],
    }));
    // ✅ Bulk Insert (FAST)
    const result = await prisma_client_1.prismaC.product.createMany({
        data: formattedProducts,
        skipDuplicates: true, // avoids duplicate title errors if unique constraint exists
    });
    return {
        message: "Bulk product upload successful (DEV MODE)",
        insertedCount: result.count,
    };
};
/* ======================================================
   EXPORT SERVICES
====================================================== */
exports.productServices = {
    addProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getSingleProductWithRelated,
    bulkUploadProducts,
};
