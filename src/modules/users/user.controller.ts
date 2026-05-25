import catchAsync from "../../utils/catchAsync";
import { userService } from "./user.service";

const createUser = catchAsync(async (req, res) => {
  const { email, name, phone, password } = req.body;

  const user = await userService.createUser({ email, name, phone, password });
  res.status(201).json({
    success: true,
    message: "successfully created user",
    data: user,
  });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const result = await userService.loginUser(email, password);

  res.cookie("accessToken", result.accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    maxAge: 3 * 24 * 60 * 60 * 1000,
  });

  res.cookie("userInfo", JSON.stringify(result.user), {
    httpOnly: false,
    secure: false, // process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 3 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: result,
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
  forgotPassword,
  getUsers,
};
