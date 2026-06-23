import { ApiAppError } from "../../utils/apiAppError";
import { ENV } from "../../utils/env-config";
import { prismaC } from "../../utils/prisma-client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../utils/sendEmail";
import { generateOtp } from "../../utils/generateOTP";

type CreateUserPayload = {
  email: string;
  name: string;
  phone?: string;
  password: string;
};

const createUser = async (payload: CreateUserPayload) => {
  // 1. Check if user already exists (Business Rule)
  const existingUser = await prismaC.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new ApiAppError(409, "User with this email already exists");
  }

  // 2. Hash password
  let hashedPassword: string;
  try {
    hashedPassword = await bcrypt.hash(payload.password, ENV.BCRYPT_SALT);
  } catch (error) {
    throw new ApiAppError(500, "Failed to hash password", error);
  }

  // 3. Create user
  try {
    const user = await prismaC.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        phone: payload.phone,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
      },
    });

    return user;
  } catch (error) {
    throw new ApiAppError(500, "Failed to create user", error);
  }
};

const loginUser = async (email: string, password: string) => {
  const user = await prismaC.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiAppError(401, "Invalid email or password");
  }
  const isPasswordMatched = await bcrypt.compare(password, user.password);
  if (!isPasswordMatched) {
    throw new ApiAppError(401, "Invalid email or password");
  }

  if (!ENV.JWT_SECRET) {
    throw new ApiAppError(
      500,
      "JWT secret is not configured. Set JWT_SECRET or JWT_ACCESS_SECRET in .env",
    );
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    ENV.JWT_SECRET,
    { expiresIn: "3d", algorithm: "HS256" },
  );
  return {
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    },
  };
};
const forgotPassword = async (email: string) => {
  const user = await prismaC.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiAppError(404, "User not found");
  }

  const otp = generateOtp();
  const expireTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prismaC.oTP.create({
    data: {
      code: otp,
      type: "AUTHENTICATION",
      expiresAt: expireTime,
      userId: user.id,
    },
  });

  await sendEmail(
    email,
    "Password Reset OTP",
    `Your password reset OTP is ${otp}. It will expire in 5 minutes.`,
  );

  return { message: "OTP sent to your email" };
};

const verifyOtp = async (
  userId: string,
  otpCode: string,
  type: "AUTHENTICATION",
) => {
  const otp = await prismaC.oTP.findFirst({
    where: {
      userId,
      code: otpCode,
      type,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!otp) {
    throw new ApiAppError(400, "Invalid or expired OTP");
  }

  await prismaC.oTP.update({
    where: { id: otp.id },
    data: { used: true },
  });

  return true;
};

const getUsers = async () => {
  return prismaC.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      createdAt: true,
    },
  });
};

export const userService = {
  createUser,
  loginUser,
  forgotPassword,
  verifyOtp,
  getUsers,
};
