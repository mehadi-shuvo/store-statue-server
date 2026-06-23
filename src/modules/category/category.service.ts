import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

interface CategoryPayload {
  title: string;
  description?: string;
}

interface BulkCategoryPayload {
  categories: CategoryPayload[];
}

interface GetCategoriesQuery {
  includeInactive?: string;
}

/**
 * Add Category
 */
const addCategory = async (payload: CategoryPayload) => {
  const existingCategory = await prismaC.category.findFirst({
    where: {
      title: payload.title,
      isActive: true,
    },
  });

  if (existingCategory) {
    throw new ApiAppError(409, "Category with this title already exists");
  }

  const category = await prismaC.category.create({
    data: payload,
  });

  return category;
};

/**
 * Bulk Add Categories
 */
const bulkAddCategories = async (payload: BulkCategoryPayload) => {
  const { categories } = payload;

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new ApiAppError(400, "Categories array is required");
  }

  if (categories.length > 50) {
    throw new ApiAppError(400, "Bulk category limit exceeded (max 50 at once)");
  }

  const normalizedTitles = categories.map((category, index) => {
    const title = category?.title?.trim();

    if (!title) {
      throw new ApiAppError(400, `Category title is required at index ${index}`);
    }

    return title;
  });
  const uniqueTitles = new Set(normalizedTitles);

  if (uniqueTitles.size !== normalizedTitles.length) {
    throw new ApiAppError(400, "Duplicate category titles found in request");
  }

  const existingCategories = await prismaC.category.findMany({
    where: {
      title: { in: normalizedTitles },
      isActive: true,
    },
    select: {
      title: true,
    },
  });

  if (existingCategories.length > 0) {
    throw new ApiAppError(
      409,
      `Category already exists: ${existingCategories
        .map((category) => category.title)
        .join(", ")}`,
    );
  }

  const createdCategories = await prismaC.$transaction(
    categories.map((category, index) =>
      prismaC.category.create({
        data: {
          title: normalizedTitles[index],
          description: category.description,
        },
      }),
    ),
  );

  return {
    message: "Categories added successfully",
    count: createdCategories.length,
    data: createdCategories,
  };
};

/**
 * Get All Categories
 */
const getCategories = async (query?: GetCategoriesQuery) => {
  const includeInactive = query?.includeInactive === "true";

  const categories = await prismaC.category.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { title: "asc" },
  });

  return categories;
};

/**
 * Update Category
 */
const updateCategory = async (
  categoryId: string,
  payload: Partial<{
    title: string;
    description: string;
    isActive: boolean;
  }>
) => {
  const categoryExists = await prismaC.category.findUnique({
    where: { id: categoryId },
  });

  if (!categoryExists || !categoryExists.isActive) {
    throw new ApiAppError(404, "Category not found");
  }

  if (payload.title) {
    const duplicateCategory = await prismaC.category.findFirst({
      where: {
        title: payload.title,
        isActive: true,
        NOT: { id: categoryId },
      },
    });

    if (duplicateCategory) {
      throw new ApiAppError(409, "Category with this title already exists");
    }
  }

  const updatedCategory = await prismaC.category.update({
    where: { id: categoryId },
    data: payload,
  });

  return updatedCategory;
};

/**
 * Delete Category (Soft Delete)
 */
const deleteCategory = async (categoryId: string) => {
  const categoryExists = await prismaC.category.findUnique({
    where: { id: categoryId },
    include: {
      products: {
        where: { isActive: true },
      },
    },
  });

  if (!categoryExists || !categoryExists.isActive) {
    throw new ApiAppError(404, "Category not found");
  }

  if (categoryExists.products.length > 0) {
    throw new ApiAppError(400, "Cannot delete category with active products");
  }

  const deletedCategory = await prismaC.category.update({
    where: { id: categoryId },
    data: { isActive: false },
  });

  return deletedCategory;
};

export const categoryServices = {
  addCategory,
  bulkAddCategories,
  getCategories,
  updateCategory,
  deleteCategory,
};
