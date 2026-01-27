import catchAsync from "../../utils/catchAsync";
import { productServices } from "./product.service";

/**
 * Add Product
 */
const addProduct = catchAsync(async (req, res) => {
  const result = await productServices.addProduct(req.body);

  res.status(201).json({
    success: true,
    message: "Product added successfully",
    data: result,
  });
});

/**
 * Update Product
 */
const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await productServices.updateProduct(id, req.body);

  res.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

/**
 * Delete Product
 */
const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await productServices.deleteProduct(id);

  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
    data: result,
  });
});

/**
 * get products
 */

const getProducts = catchAsync(async (req, res) => {
  const result = await productServices.getProducts(req.query);

  res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: result,
  });
});

const getSingleProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await productServices.getSingleProductWithRelated(id);

  res.status(200).json({
    success: true,
    message: "Product fetched successfully",
    data: result,
  });
});

export const productControllers = {
  addProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getSingleProduct,
};
