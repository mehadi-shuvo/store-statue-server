import assert from "node:assert/strict";
import test from "node:test";
import {
  emailVerificationTemplate,
  gameTopUpCompletedTemplate,
  giftCardDeliveryTemplate,
  passwordResetTemplate,
} from "../../../utils/email-templates";

test("email templates provide text and escaped HTML alternatives", () => {
  const verification = emailVerificationTemplate({
    customerName: "<Customer>",
    otp: "123456",
    expiresInMinutes: 10,
  });
  const passwordReset = passwordResetTemplate({ otp: "654321", expiresInMinutes: 5 });
  const giftCard = giftCardDeliveryTemplate({
    orderNumber: "ORDER-1",
    transactionId: "TRX-1",
    items: [{
      product: "Card <One>",
      brand: "Brand",
      value: "10.00",
      currency: "USD",
      code: "CODE-1",
      pin: "1234",
      expiry: "N/A",
    }],
  });
  const topUp = gameTopUpCompletedTemplate({
    customerName: "Customer",
    orderNumber: "ORDER-2",
    game: "Game",
    packageName: "100 Coins",
    completedAt: new Date("2026-09-15T10:00:00.000Z"),
  });

  for (const template of [verification, passwordReset, giftCard, topUp]) {
    assert.ok(template.subject);
    assert.ok(template.text);
    assert.match(template.html, /<!doctype html>/);
  }
  assert.doesNotMatch(verification.html, /<Customer>/);
  assert.match(verification.html, /&lt;Customer&gt;/);
  assert.doesNotMatch(giftCard.html, /Card <One>/);
});
