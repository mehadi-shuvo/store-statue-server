import catchAsync from "../../utils/catchAsync";
import { ENV } from "../../utils/env-config";
import { userService } from "./user.service";
import {
  createCustomerSchema,
  deleteCustomerProfileSchema,
  loginSchema,
  parseRequestBody,
  updateCustomerProfileSchema,
} from "./user.validation";

const ACCESS_TOKEN_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;
const isProduction = ENV.NODE_ENV === "production";
const sameSite = isProduction ? "none" : "lax";

const accessTokenCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite,
  maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
  path: "/",
} as const;

const legacyUserInfoCookieOptions = {
  secure: isProduction,
  sameSite,
  path: "/",
} as const;

const createUser = catchAsync(async (req, res) => {
  const payload = parseRequestBody(createCustomerSchema, req.body);

  const user = await userService.createUser(payload);
  res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: user,
  });
});

const login = catchAsync(async (req, res) => {
  const payload = parseRequestBody(loginSchema, req.body);

  const result = await userService.loginUser(payload);

  res.cookie("accessToken", result.accessToken, accessTokenCookieOptions);
  res.clearCookie("userInfo", legacyUserInfoCookieOptions);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: result.user,
    },
  });
});

const logout = catchAsync(async (req, res) => {
  res.clearCookie("accessToken", accessTokenCookieOptions);
  res.clearCookie("userInfo", legacyUserInfoCookieOptions);

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

const getCustomerProfile = catchAsync(async (req, res) => {
  const profile = await userService.getCustomerProfile(req.authUser!.id);

  res.status(200).json({
    success: true,
    message: "Customer profile retrieved successfully",
    data: profile,
  });
});

const updateCustomerProfile = catchAsync(async (req, res) => {
  const payload = parseRequestBody(updateCustomerProfileSchema, req.body);
  const profile = await userService.updateCustomerProfile(req.authUser!.id, payload);

  res.status(200).json({
    success: true,
    message: "Customer profile updated successfully",
    data: profile,
  });
});

const deleteCustomerProfile = catchAsync(async (req, res) => {
  const payload = parseRequestBody(deleteCustomerProfileSchema, req.body);

  await userService.deleteCustomerProfile(req.authUser!.id, payload);
  res.clearCookie("accessToken", accessTokenCookieOptions);
  res.clearCookie("userInfo", legacyUserInfoCookieOptions);

  res.status(200).json({
    success: true,
    message: "Customer profile deleted successfully",
  });
});

/* ========== FORGOT PASSWORD ========== */
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await userService.forgotPassword(email);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

const getUsers = catchAsync(async (req, res) => {
  const users = await userService.getUsers();
  res.status(200).json({
    success: true,
    message: "successfully retrieved users",
    data: users,
  });
});

export const userController = {
  createUser,
  login,
  logout,
  getCustomerProfile,
  updateCustomerProfile,
  deleteCustomerProfile,
  forgotPassword,
  getUsers,
};
