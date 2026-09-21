import { Request } from "express";
import catchAsync from "../../utils/catchAsync";
import { ApiAppError } from "../../utils/apiAppError";
import { uploadImageBufferToCloudinary } from "../../utils/cloudinary-uploader";
import { productServices } from "./product.service";

type ProductUploadFiles = {
  thumbnail?: Express.Multer.File[];
  bannerImage?: Express.Multer.File[];
  photos?: Express.Multer.File[];
};

const JSON_FIELD_NAMES = new Set([
  "features",
  "giftCard",
  "gameTopUp",
  "subscription",
]);

const NUMBER_FIELD_NAMES = new Set([
  "price",
  "stockQuantity",
  "offerPercent",
  "sortOrder",
]);

const BOOLEAN_FIELD_NAMES = new Set(["isActive"]);

const parseMultipartProductBody = (body: Record<string, unknown>) => {
  const payload: Record<string, unknown> = {};

  Object.entries(body).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    if (JSON_FIELD_NAMES.has(key)) {
      try {
        payload[key] = typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        throw new ApiAppError(400, `${key} must be valid JSON`);
      }
      return;
    }

    if (NUMBER_FIELD_NAMES.has(key)) {
      const parsed = Number(value);

      if (!Number.isFinite(parsed)) {
        throw new ApiAppError(400, `${key} must be a valid number`);
      }

      payload[key] = parsed;
      return;
    }

    if (BOOLEAN_FIELD_NAMES.has(key)) {
      payload[key] = value === "true" || value === true;
      return;
    }

    payload[key] = value;
  });

  return payload;
};

const getProductFiles = (req: Request) => (req.files || {}) as ProductUploadFiles;

const mergeUploadedProductImages = async (
  payload: Record<string, unknown>,
  files: ProductUploadFiles,
) => {
  if (files.photos && files.photos.length > 0) {
    if (files.thumbnail?.[0] || files.photos.length > 1) {
      throw new ApiAppError(
        400,
        "The split digital catalog supports one primary image; use thumbnail or one legacy photos file",
      );
    }
    files.thumbnail = [files.photos[0]];
  }

  const [thumbnail, bannerImage] = await Promise.all([
    files.thumbnail?.[0]
      ? uploadImageBufferToCloudinary(files.thumbnail[0])
      : Promise.resolve(null),
    files.bannerImage?.[0]
      ? uploadImageBufferToCloudinary(files.bannerImage[0])
      : Promise.resolve(null),
  ]);

  if (thumbnail) {
    payload.thumbnail = thumbnail.url;
  }

  if (bannerImage) {
    payload.bannerImage = bannerImage.url;
  }

  return payload;
};

const buildProductPayloadFromRequest = async (req: Request) => {
  const payload = parseMultipartProductBody(req.body);
  return mergeUploadedProductImages(payload, getProductFiles(req));
};

/**
 * Add Product
 */
const addProduct = catchAsync(async (req, res) => {
  const payload = await buildProductPayloadFromRequest(req);
  const result = await productServices.addProduct(payload as any, req.authUser?.id);

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
  const payload = await buildProductPayloadFromRequest(req);
  const result = await productServices.updateProduct(id, payload as any, req.authUser?.id);

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
  const result = await productServices.deleteProduct(id, req.authUser?.id);

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

export const bulkUploadProductsController = catchAsync(async (req, res) => {
  const result = await productServices.bulkUploadProducts(req.body.products, req.authUser?.id);

  res.status(201).json({
    success: true,
    ...result,
  });
});

export const productControllers = {
  addProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getSingleProduct,
  bulkUploadProductsController,
};
