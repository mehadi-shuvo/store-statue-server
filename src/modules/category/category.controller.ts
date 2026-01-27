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
  updateCategory,
  deleteCategory,
};
