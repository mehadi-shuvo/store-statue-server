import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

/**
 * Add Product
 */
const addProduct = async (payload: {
  title: string;
  description?: string;
  price: number;
  stockQuantity: number;
  categoryId: string;
}) => {
  const categoryExists = await prismaC.category.findUnique({
    where: { id: payload.categoryId, isActive: true },
  });

  if (!categoryExists) {
    throw new ApiAppError(404, "Category not found");
  }

  const product = await prismaC.product.create({
    data: payload,
  });

  return product;
};

/**
 * Update Product
 */
const updateProduct = async (
  productId: string,
  payload: Partial<{
    title: string;
    description: string;
    price: number;
    stockQuantity: number;
    isActive: boolean;
    categoryId: string;
  }>,
) => {
  const productExists = await prismaC.product.findUnique({
    where: { id: productId },
  });

  if (!productExists) {
    throw new ApiAppError(404, "Product not found");
  }

  if (payload.categoryId) {
    const categoryExists = await prismaC.category.findUnique({
      where: { id: payload.categoryId },
    });

    if (!categoryExists) {
      throw new ApiAppError(404, "Category not found");
    }
  }

  const updatedProduct = await prismaC.product.update({
    where: { id: productId },
    data: payload,
  });

  return updatedProduct;
};

/**
 * Delete Product (Soft Delete)
 */
const deleteProduct = async (productId: string) => {
  const productExists = await prismaC.product.findUnique({
    where: { id: productId },
  });

  if (!productExists) {
    throw new ApiAppError(404, "Product not found");
  }

  const deletedProduct = await prismaC.product.update({
    where: { id: productId },
    data: { isActive: false },
  });

  return deletedProduct;
};
type SortField = "createdAt" | "price" | "title";
type SortOrder = "asc" | "desc";

const ALLOWED_SORT_FIELDS: SortField[] = ["createdAt", "price", "title"];
const ALLOWED_SORT_ORDER: SortOrder[] = ["asc", "desc"];

interface GetProductsQuery {
  search?: string;
  categories?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
  order?: string;
  page?: string;
  limit?: string;
}

const getProducts = async (query: GetProductsQuery) => {
  // -------------------------------
  // Pagination (safe defaults)
  // -------------------------------
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Number(query.limit) || 12, 100);
  const skip = (page - 1) * limit;

  // -------------------------------
  // Secure sorting (allow-list)
  // -------------------------------
  const sortField: string | undefined = ALLOWED_SORT_FIELDS.includes(
    query.sort as SortField,
  )
    ? (query.sort as SortField)
    : "createdAt";

  const sortOrder = ALLOWED_SORT_ORDER.includes(query.order as SortOrder)
    ? (query.order as SortOrder)
    : "desc";

  // -------------------------------
  // WHERE clause builder
  // -------------------------------
  const where: any = {
    isActive: true,
  };

  // 🔍 Search
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  // 📂 Category filter
  if (query.categories) {
    where.categoryId = {
      in: query.categories.split(","),
    };
  }

  // 💰 Price range filter
  if (query.minPrice || query.maxPrice) {
    where.price = {
      ...(query.minPrice && { gte: Number(query.minPrice) }),
      ...(query.maxPrice && { lte: Number(query.maxPrice) }),
    };
  }

  // 📦 Stock filter
  if (query.inStock === "true") {
    where.stockQuantity = { gt: 0 };
  }

  // -------------------------------
  // Execute queries in parallel
  // -------------------------------
  const [products, total] = await prismaC.$transaction([
    prismaC.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortField]: sortOrder,
      },
      include: {
        category: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    prismaC.product.count({ where }),
  ]);

  // -------------------------------
  // Response
  // -------------------------------
  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
      appliedFilters: {
        search: query.search || null,
        categories: query.categories || null,
        priceRange: {
          min: query.minPrice || null,
          max: query.maxPrice || null,
        },
        inStock: query.inStock || null,
      },
      sorting: {
        sortBy: sortField,
        order: sortOrder,
      },
    },
    data: products,
  };
};

const RELATED_PRODUCTS_LIMIT = 6;

const getSingleProductWithRelated = async (productId: string) => {
  // -------------------------------
  // Fetch main product
  // -------------------------------
  const product = await prismaC.product.findFirst({
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
    throw new ApiAppError(404, "Product not found");
  }

  // -------------------------------
  // Fetch related products
  // -------------------------------
  const relatedProducts = await prismaC.product.findMany({
    where: {
      isActive: true,
      categoryId: product.categoryId,
      NOT: {
        id: product.id,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: RELATED_PRODUCTS_LIMIT,
    select: {
      id: true,
      title: true,
      price: true,
      stockQuantity: true,
      createdAt: true,
    },
  });

  // -------------------------------
  // Metadata (useful for frontend)
  // -------------------------------
  const metadata = {
    productId: product.id,
    categoryId: product.categoryId,
    relatedCount: relatedProducts.length,
    fetchedAt: new Date().toISOString(),
  };

  return {
    product,
    relatedProducts,
    metadata,
  };
};

export const productServices = {
  addProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getSingleProductWithRelated,
};
