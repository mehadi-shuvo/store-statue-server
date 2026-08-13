import { ApiAppError } from "../../utils/apiAppError";
import { ENV } from "../../utils/env-config";
import { prismaC } from "../../utils/prisma-client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../utils/sendEmail";
import { generateOtp } from "../../utils/generateOTP";
import { OtpType, UserRole } from "../../generated/prisma/client";
import { logger } from "../../utils/logger";
import type {
  CreateCustomerPayload,
  DeleteCustomerProfilePayload,
  LoginPayload,
  ResetPasswordPayload,
  UpdateCustomerProfilePayload,
} from "./user.validation";

const DUMMY_PASSWORD_HASH =
  "$2b$12$h6TRZPS.vxvidI7C2qHZeuVMUVEk0jEGbV4i.LPDQzazE9a.5XFV.";

const userProfileSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

const isPrismaKnownError = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === code;

const getActiveCustomerById = async (userId: string) => {
  const user = await prismaC.user.findFirst({
    where: {
      id: userId,
      role: UserRole.CUSTOMER,
      isActive: true,
      isDeleted: false,
    },
  });

  if (!user) {
    throw new ApiAppError(404, "Customer profile not found");
  }

  return user;
};

const createUser = async (payload: CreateCustomerPayload) => {
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
        role: UserRole.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new ApiAppError(409, "User with this email already exists");
    }

    throw new ApiAppError(500, "Failed to create user", error);
  }
};

const loginUser = async ({ email, password }: LoginPayload) => {
  const user = await prismaC.user.findFirst({
    where: {
      email,
      isActive: true,
      isDeleted: false,
    },
  });

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    logger.warn({ email }, "Failed login attempt: user not found or inactive");
    throw new ApiAppError(401, "Invalid email or password");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);
  if (!isPasswordMatched) {
    logger.warn({ userId: user.id, email: user.email }, "Failed login attempt: invalid password");
    throw new ApiAppError(401, "Invalid email or password");
  }

  if (!ENV.JWT_SECRET) {
    throw new ApiAppError(
      500,
      "JWT secret is not configured. Set JWT_SECRET or JWT_ACCESS_SECRET in .env",
    );
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    ENV.JWT_SECRET,
    {
      expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
      algorithm: "HS256",
    },
  );

  return {
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  };
};

const getCustomerProfile = async (userId: string) => {
  await getActiveCustomerById(userId);

  return prismaC.user.findUnique({
    where: { id: userId },
    select: userProfileSelect,
  });
};

const updateCustomerProfile = async (
  userId: string,
  payload: UpdateCustomerProfilePayload,
) => {
  await getActiveCustomerById(userId);

  return prismaC.user.update({
    where: { id: userId },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
    },
    select: userProfileSelect,
  });
};

const deleteCustomerProfile = async (
  userId: string,
  payload: DeleteCustomerProfilePayload,
) => {
  const user = await getActiveCustomerById(userId);
  const isPasswordMatched = await bcrypt.compare(payload.password, user.password);

  if (!isPasswordMatched) {
    throw new ApiAppError(401, "Invalid password");
  }

  const anonymizedPassword = await bcrypt.hash(
    `deleted:${userId}:${Date.now()}`,
    ENV.BCRYPT_SALT,
  );

  await prismaC.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@deleted.local`,
      name: "Deleted Customer",
      phone: null,
      password: anonymizedPassword,
      isDeleted: true,
    },
  });

  return { deleted: true };
};

const forgotPassword = async (email: string) => {
  const user = await prismaC.user.findUnique({
    where: { email },
  });

  const genericResponse = {
    message: "If an active account exists for that email, an OTP has been sent",
  };

  if (!user || !user.isActive || user.isDeleted) return genericResponse;

  const otp = generateOtp();
  const expireTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  const hashedOtp = await bcrypt.hash(otp, ENV.BCRYPT_SALT);

  await prismaC.oTP.updateMany({
    where: {
      userId: user.id,
      type: OtpType.PASSWORD_RESET,
      used: false,
    },
    data: { used: true },
  });

  await prismaC.oTP.create({
    data: {
      code: hashedOtp,
      type: OtpType.PASSWORD_RESET,
      expiresAt: expireTime,
      userId: user.id,
    },
  });

  await sendEmail(
    email,
    "Password Reset OTP",
    `Your password reset OTP is ${otp}. It will expire in 5 minutes.`,
  );

  return genericResponse;
};

const verifyOtp = async (
  userId: string,
  otpCode: string,
  type: OtpType = OtpType.PASSWORD_RESET,
) => {
  const otp = await prismaC.oTP.findFirst({
    where: {
      userId,
      type,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || !(await bcrypt.compare(otpCode, otp.code))) {
    throw new ApiAppError(400, "Invalid or expired OTP");
  }

  await prismaC.oTP.update({
    where: { id: otp.id },
    data: { used: true },
  });

  return true;
};

const resetPassword = async (payload: ResetPasswordPayload) => {
  const user = await prismaC.user.findFirst({
    where: {
      email: payload.email,
      isActive: true,
      isDeleted: false,
    },
    select: { id: true },
  });

  if (!user) throw new ApiAppError(400, "Invalid or expired OTP");

  const otp = await prismaC.oTP.findFirst({
    where: {
      userId: user.id,
      type: OtpType.PASSWORD_RESET,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || !(await bcrypt.compare(payload.otp, otp.code))) {
    throw new ApiAppError(400, "Invalid or expired OTP");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, ENV.BCRYPT_SALT);
  await prismaC.$transaction(async (tx) => {
    const usedOtp = await tx.oTP.updateMany({
      where: { id: otp.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    if (usedOtp.count !== 1) {
      throw new ApiAppError(400, "Invalid or expired OTP");
    }
    await tx.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
  });

  return { reset: true };
};

const getUsers = async () => {
  return prismaC.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });
};

export const userService = {
  createUser,
  loginUser,
  getCustomerProfile,
  updateCustomerProfile,
  deleteCustomerProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getUsers,
};
