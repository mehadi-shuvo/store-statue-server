import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

/**
 * Add Category
 */
const addCategory = async (payload: {
  title: string;
  description?: string;
}) => {
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
  updateCategory,
  deleteCategory,
};
