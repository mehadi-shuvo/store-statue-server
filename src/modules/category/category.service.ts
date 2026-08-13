import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

interface CategoryPayload {
  title: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

interface BulkCategoryPayload {
  categories: CategoryPayload[];
}

interface GetCategoriesQuery {
  includeInactive?: string;
}

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getAvailableSlug = async (value: string, excludeId?: string) => {
  const baseSlug = toSlug(value);
  if (!baseSlug) throw new ApiAppError(400, "A valid category slug is required");

  let slug = baseSlug;
  let suffix = 2;
  while (
    await prismaC.category.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }
  return slug;
};

const normalizeCategoryPayload = (
  payload: Partial<CategoryPayload>,
  requireTitle = false,
) => {
  const title = payload.title?.trim();

  if (requireTitle && !title) {
    throw new ApiAppError(400, "Category title is required");
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
const addCategory = async (payload: CategoryPayload) => {
  const categoryData = normalizeCategoryPayload(payload, true);
  const title = categoryData.title;

  if (!title) {
    throw new ApiAppError(400, "Category title is required");
  }

  const existingCategory = await prismaC.category.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      isActive: true,
    },
  });

  if (existingCategory) {
    throw new ApiAppError(409, "Category with this title already exists");
  }

  const slug = await getAvailableSlug(categoryData.slug ?? title);
  const category = await prismaC.category.create({
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
  const uniqueTitles = new Set(normalizedTitles.map((title) => title.toLowerCase()));

  if (uniqueTitles.size !== normalizedTitles.length) {
    throw new ApiAppError(400, "Duplicate category titles found in request");
  }

  const existingCategories = await prismaC.category.findMany({
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
    const existingCategoryTitles = existingCategories.map(
      (category: { title: string }) => category.title,
    );

    throw new ApiAppError(
      409,
      `Category already exists: ${existingCategoryTitles.join(", ")}`,
    );
  }

  const slugs: string[] = [];
  for (let index = 0; index < categories.length; index += 1) {
    const requestedSlug = categories[index].slug ?? normalizedTitles[index];
    const baseSlug = toSlug(requestedSlug);
    if (!baseSlug) {
      throw new ApiAppError(400, `A valid category slug is required at index ${index}`);
    }
    let slug = baseSlug;
    let suffix = 2;
    while (slugs.includes(slug) || (await prismaC.category.findUnique({ where: { slug } }))) {
      slug = `${baseSlug}-${suffix++}`;
    }
    slugs.push(slug);
  }

  const createdCategories = await prismaC.$transaction(
    categories.map((category: CategoryPayload, index: number) =>
      prismaC.category.create({
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
  payload: Partial<CategoryPayload>,
) => {
  const categoryExists = await prismaC.category.findUnique({
    where: { id: categoryId },
  });

  if (!categoryExists || !categoryExists.isActive) {
    throw new ApiAppError(404, "Category not found");
  }

  const categoryData = normalizeCategoryPayload(payload);

  if (categoryData.slug) {
    categoryData.slug = await getAvailableSlug(categoryData.slug, categoryId);
  }

  if (categoryData.title) {
    const duplicateCategory = await prismaC.category.findFirst({
      where: {
        title: categoryData.title,
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
    data: categoryData,
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
      giftCards: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } },
      gameTopUps: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } },
      subscriptions: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } },
    },
  });

  if (!categoryExists || !categoryExists.isActive) {
    throw new ApiAppError(404, "Category not found");
  }

  if (
    categoryExists.giftCards.length > 0 ||
    categoryExists.gameTopUps.length > 0 ||
    categoryExists.subscriptions.length > 0
  ) {
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
