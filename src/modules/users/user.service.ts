import { ApiAppError } from "../../utils/apiAppError";
import { ENV } from "../../utils/env-config";
import { prismaC } from "../../utils/prisma-client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail, type EmailSender } from "../../utils/sendEmail";
import { generateOtp } from "../../utils/generateOTP";
import { OtpType, Prisma, UserRole } from "../../generated/prisma/client";
import { logger } from "../../utils/logger";
import {
  emailVerificationTemplate,
  passwordResetTemplate,
} from "../../utils/email-templates";
import type {
  CreateCustomerPayload,
  DeleteCustomerProfilePayload,
  LoginPayload,
  ResetPasswordPayload,
  UpdateCustomerProfilePayload,
  VerifyEmailPayload,
} from "./user.validation";

const DUMMY_PASSWORD_HASH =
  "$2b$12$h6TRZPS.vxvidI7C2qHZeuVMUVEk0jEGbV4i.LPDQzazE9a.5XFV.";
const EMAIL_VERIFICATION_RESPONSE =
  "If an eligible account exists, a verification email will be sent";
const EMAIL_VERIFICATION_TTL_MINUTES = Math.max(
  1,
  ENV.EMAIL_VERIFICATION_OTP_TTL_MINUTES,
);
const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = Math.max(
  1,
  ENV.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
);

export const userEmailSender: EmailSender = { send: sendEmail };

const userProfileSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  isEmailVerified: true,
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

  // 2. Hash password and the one-time verification code.
  let hashedPassword: string;
  const verificationOtp = generateOtp();
  let hashedVerificationOtp: string;
  try {
    [hashedPassword, hashedVerificationOtp] = await Promise.all([
      bcrypt.hash(payload.password, ENV.BCRYPT_SALT),
      bcrypt.hash(verificationOtp, ENV.BCRYPT_SALT),
    ]);
  } catch (error) {
    throw new ApiAppError(500, "Failed to secure account credentials", error);
  }

  // 3. Atomically create the user and hashed verification credential.
  try {
    const createdAccount = await prismaC.$transaction(async (tx) => {
      const created = await tx.user.create({
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
          isEmailVerified: true,
          createdAt: true,
        },
      });
      const credential = await tx.oTP.create({
        data: {
          code: hashedVerificationOtp,
          type: OtpType.EMAIL_VERIFICATION,
          expiresAt: new Date(
            Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60_000,
          ),
          userId: created.id,
        },
        select: { id: true },
      });
      return { user: created, verificationCredentialId: credential.id };
    });

    const verificationEmailSent = await sendVerificationEmail(
      createdAccount.user,
      verificationOtp,
      createdAccount.verificationCredentialId,
    );
    return { ...createdAccount.user, verificationEmailSent };
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
      isEmailVerified: user.isEmailVerified,
    },
  };
};

const disableVerificationOtp = async (userId: string, credentialId: string) => {
  await prismaC.oTP
    .updateMany({
      where: {
        id: credentialId,
        userId,
        type: OtpType.EMAIL_VERIFICATION,
        used: false,
      },
      data: { used: true },
    })
    .catch((error) => {
      logger.error(
        { userId, errorType: error instanceof Error ? error.name : "UnknownDatabaseError" },
        "Failed to invalidate an undelivered email verification credential",
      );
    });
};

const sendVerificationEmail = async (
  user: { id: string; email: string; name: string },
  otp: string,
  credentialId: string,
) => {
  const template = emailVerificationTemplate({
    customerName: user.name,
    otp,
    expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
  });
  try {
    await userEmailSender.send({ to: user.email, ...template });
    return true;
  } catch (error) {
    await disableVerificationOtp(user.id, credentialId);
    logger.warn(
      { userId: user.id, errorType: error instanceof Error ? error.name : "EmailProviderError" },
      "Email verification message was not delivered",
    );
    return false;
  }
};

const verifyEmail = async (payload: VerifyEmailPayload) => {
  const user = await prismaC.user.findFirst({
    where: { email: payload.email, isActive: true, isDeleted: false },
    select: { id: true, isEmailVerified: true },
  });
  if (!user) {
    throw new ApiAppError(
      400,
      "Invalid or expired verification code",
      undefined,
      "INVALID_OR_EXPIRED_VERIFICATION_CODE",
    );
  }
  if (user.isEmailVerified) {
    throw new ApiAppError(409, "Email is already verified", undefined, "EMAIL_ALREADY_VERIFIED");
  }

  const credential = await prismaC.oTP.findFirst({
    where: { userId: user.id, type: OtpType.EMAIL_VERIFICATION, used: false },
    orderBy: { createdAt: "desc" },
  });
  const valid =
    credential &&
    credential.expiresAt > new Date() &&
    (await bcrypt.compare(payload.otp, credential.code));
  if (!valid) {
    throw new ApiAppError(
      400,
      "Invalid or expired verification code",
      undefined,
      "INVALID_OR_EXPIRED_VERIFICATION_CODE",
    );
  }

  await prismaC.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE`);
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { isEmailVerified: true },
    });
    if (currentUser?.isEmailVerified) {
      throw new ApiAppError(409, "Email is already verified", undefined, "EMAIL_ALREADY_VERIFIED");
    }
    const consumed = await tx.oTP.updateMany({
      where: { id: credential.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    if (consumed.count !== 1) {
      throw new ApiAppError(
        400,
        "Invalid or expired verification code",
        undefined,
        "INVALID_OR_EXPIRED_VERIFICATION_CODE",
      );
    }
    await tx.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });
    await tx.oTP.updateMany({
      where: { userId: user.id, type: OtpType.EMAIL_VERIFICATION, used: false },
      data: { used: true },
    });
  });

  return { isEmailVerified: true };
};

const resendEmailVerification = async (email: string) => {
  const response = {
    message: EMAIL_VERIFICATION_RESPONSE,
    cooldownSeconds: EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
  };
  const user = await prismaC.user.findFirst({
    where: { email, isActive: true, isDeleted: false },
    select: { id: true, email: true, name: true, isEmailVerified: true },
  });
  if (!user || user.isEmailVerified) return response;

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, ENV.BCRYPT_SALT);
  const cooldownStartedAt = new Date(
    Date.now() - EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000,
  );
  const credential = await prismaC.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE`);
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { isEmailVerified: true },
    });
    if (!currentUser || currentUser.isEmailVerified) return null;
    const latest = await tx.oTP.findFirst({
      where: { userId: user.id, type: OtpType.EMAIL_VERIFICATION, used: false },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true },
    });
    if (latest && latest.expiresAt > new Date() && latest.createdAt > cooldownStartedAt) {
      return null;
    }
    await tx.oTP.updateMany({
      where: { userId: user.id, type: OtpType.EMAIL_VERIFICATION, used: false },
      data: { used: true },
    });
    return tx.oTP.create({
      data: {
        code: hashedOtp,
        type: OtpType.EMAIL_VERIFICATION,
        expiresAt: new Date(
          Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60_000,
        ),
        userId: user.id,
      },
      select: { id: true },
    });
  });
  if (!credential) return response;

  await sendVerificationEmail(user, otp, credential.id);
  return response;
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

  const template = passwordResetTemplate({
    customerName: user.name,
    otp,
    expiresInMinutes: 5,
  });
  await userEmailSender.send({ to: email, ...template });

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
      isEmailVerified: true,
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
  verifyEmail,
  resendEmailVerification,
  verifyOtp,
  resetPassword,
  getUsers,
};
