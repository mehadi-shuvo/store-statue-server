import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { OtpType } from "../../../generated/prisma/client";
import { prismaC } from "../../../utils/prisma-client";
import type { EmailMessage } from "../../../utils/sendEmail";
import { userEmailSender, userService } from "../user.service";
import { verifyEmailSchema } from "../user.validation";

const run = process.env.RUN_USER_INTEGRATION_TESTS === "true";

const otpFrom = (message: EmailMessage, purpose: "verification" | "password reset") => {
  const match = message.text.match(
    purpose === "verification"
      ? /verification code is (\d{6})/
      : /password reset OTP is (\d{6})/,
  );
  assert.ok(match, `${purpose} OTP must be present in the email only`);
  return match[1];
};

test("email verification and password reset lifecycle", { skip: !run }, async () => {
  const marker = randomUUID();
  const firstEmail = `verify-${marker}@example.test`;
  const cooldownEmail = `cooldown-${marker}@example.test`;
  const recoveryEmail = `recovery-${marker}@example.test`;
  const sent: EmailMessage[] = [];
  const originalSend = userEmailSender.send;
  userEmailSender.send = async (message) => {
    sent.push(message);
  };

  try {
    const registered = await userService.createUser({
      email: firstEmail,
      name: "Verification Test",
      password: "Strong#Password1",
    });
    assert.equal(registered.isEmailVerified, false);
    assert.equal(registered.verificationEmailSent, true);
    assert.equal(sent.length, 1);
    const firstOtp = otpFrom(sent[0], "verification");

    await assert.rejects(
      () => userService.verifyEmail({ email: firstEmail, otp: "000000" }),
      (error: any) => error.code === "INVALID_OR_EXPIRED_VERIFICATION_CODE",
    );

    await prismaC.oTP.updateMany({
      where: {
        userId: registered.id,
        type: OtpType.EMAIL_VERIFICATION,
        used: false,
      },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await assert.rejects(
      () => userService.verifyEmail({ email: firstEmail, otp: firstOtp }),
      (error: any) => error.code === "INVALID_OR_EXPIRED_VERIFICATION_CODE",
    );

    const resend = await userService.resendEmailVerification(firstEmail);
    assert.ok(resend.cooldownSeconds >= 1);
    assert.equal(sent.length, 2);
    const replacementOtp = otpFrom(sent[1], "verification");
    assert.notEqual(replacementOtp, firstOtp);
    assert.deepEqual(await userService.verifyEmail({ email: firstEmail, otp: replacementOtp }), {
      isEmailVerified: true,
    });
    await assert.rejects(
      () => userService.verifyEmail({ email: firstEmail, otp: replacementOtp }),
      (error: any) => error.code === "EMAIL_ALREADY_VERIFIED",
    );
    const login = await userService.loginUser({
      email: firstEmail,
      password: "Strong#Password1",
    });
    assert.equal(login.user.isEmailVerified, true);
    await userService.resendEmailVerification(firstEmail);
    assert.equal(sent.length, 2, "verified accounts must not receive another OTP");

    const cooldownAccount = await userService.createUser({
      email: cooldownEmail,
      name: "Cooldown Test",
      password: "Strong#Password1",
    });
    assert.equal(cooldownAccount.verificationEmailSent, true);
    assert.equal(sent.length, 3);
    await userService.resendEmailVerification(cooldownEmail);
    assert.equal(sent.length, 3, "resend cooldown must suppress immediate duplicate email");

    userEmailSender.send = async () => {
      throw new Error("test email failure");
    };
    const recoveryAccount = await userService.createUser({
      email: recoveryEmail,
      name: "Recovery Test",
      password: "Strong#Password1",
    });
    assert.equal(recoveryAccount.verificationEmailSent, false);
    assert.equal(
      await prismaC.oTP.count({
        where: {
          userId: recoveryAccount.id,
          type: OtpType.EMAIL_VERIFICATION,
          used: false,
        },
      }),
      0,
    );
    userEmailSender.send = async (message) => {
      sent.push(message);
    };
    await userService.resendEmailVerification(recoveryEmail);
    assert.equal(sent.length, 4, "failed registration email must be recoverable by resend");

    await userService.forgotPassword(firstEmail);
    assert.equal(sent.length, 5);
    const passwordOtp = otpFrom(sent[4], "password reset");
    await userService.resetPassword({
      email: firstEmail,
      otp: passwordOtp,
      newPassword: "New#Password2",
    });
    await userService.loginUser({ email: firstEmail, password: "New#Password2" });
  } finally {
    userEmailSender.send = originalSend;
    await prismaC.user.deleteMany({
      where: { email: { in: [firstEmail, cooldownEmail, recoveryEmail] } },
    });
  }
});

test("verification validation rejects malformed input", () => {
  assert.equal(
    verifyEmailSchema.safeParse({ email: "not-an-email", otp: "123" }).success,
    false,
  );
});

test("resend verification route is rate limited", { skip: !run }, async () => {
  const { default: app } = await import("../../../app");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api/user/resend-verification`;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `missing-${attempt}@example.test` }),
      });
      assert.equal(response.status, 200);
    }
    const limited = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "missing-final@example.test" }),
    });
    assert.equal(limited.status, 429);
  } finally {
    server.close();
    await once(server, "close");
  }
});
