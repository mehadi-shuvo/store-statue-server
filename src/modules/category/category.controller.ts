import { UserRole } from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import catchAsync from "../../utils/catchAsync";
import { categoryServices } from "./category.service";

/**
 * Add Category
 */
const addCategory = catchAsync(async (req, res) => {
  const result = await categoryServices.addCategory(req.body);

  res.status(201).json({
    success: true,
    message: "Category added successfully",
    data: result,
  });
});

/**
 * Bulk Add Categories
 */
const bulkAddCategories = catchAsync(async (req, res) => {
  const result = await categoryServices.bulkAddCategories(req.body);

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
const getCategories = catchAsync(async (req, res) => {
  const wantsInactive = req.query.includeInactive === "true";
  const isAdmin =
    req.authUser?.role === UserRole.ADMIN ||
    req.authUser?.role === UserRole.SUPER_ADMIN;

  if (wantsInactive && !isAdmin) {
    throw new ApiAppError(403, "Only admins can view inactive categories");
  }

  const result = await categoryServices.getCategories(req.query);

  res.status(200).json({
    success: true,
    message: "Categories fetched successfully",
    data: result,
  });
});

/**
 * Update Category
 */
const updateCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await categoryServices.updateCategory(id, req.body);

  res.status(200).json({
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

/**
 * Delete Category
 */
const deleteCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await categoryServices.deleteCategory(id);

  res.status(200).json({
    success: true,
    message: "Category deleted successfully",
    data: result,
  });
});

export const categoryControllers = {
  addCategory,
  bulkAddCategories,
  getCategories,
  updateCategory,
  deleteCategory,
};
