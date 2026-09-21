const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );

const layout = (title: string, content: string) => `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17212b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:10px;padding:28px">
          <tr><td>
            <h1 style="font-size:22px;line-height:1.3;margin:0 0 20px">${escapeHtml(title)}</h1>
            ${content}
            <p style="font-size:13px;line-height:1.5;color:#667085;margin:28px 0 0">This is an automated message from Ontor.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const greeting = (customerName?: string | null) =>
  customerName ? `Hi ${escapeHtml(customerName)},` : "Hello,";

export const emailVerificationTemplate = (input: {
  customerName?: string | null;
  otp: string;
  expiresInMinutes: number;
}) => ({
  subject: "Verify your Ontor email",
  text: `${input.customerName ? `Hi ${input.customerName},\n\n` : ""}Your email verification code is ${input.otp}. It expires in ${input.expiresInMinutes} minutes. If you did not create this account, you can ignore this email.`,
  html: layout(
    "Verify your email",
    `<p style="font-size:16px;line-height:1.6">${greeting(input.customerName)}</p>
     <p style="font-size:16px;line-height:1.6">Use this one-time code to verify your email address:</p>
     <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:24px 0">${escapeHtml(input.otp)}</p>
     <p style="font-size:15px;line-height:1.6">This code expires in ${input.expiresInMinutes} minutes. If you did not create this account, you can ignore this email.</p>`,
  ),
});

export const passwordResetTemplate = (input: {
  customerName?: string | null;
  otp: string;
  expiresInMinutes: number;
}) => ({
  subject: "Password Reset OTP",
  text: `${input.customerName ? `Hi ${input.customerName},\n\n` : ""}Your password reset OTP is ${input.otp}. It will expire in ${input.expiresInMinutes} minutes. If you did not request a password reset, you can ignore this email.`,
  html: layout(
    "Reset your password",
    `<p style="font-size:16px;line-height:1.6">${greeting(input.customerName)}</p>
     <p style="font-size:16px;line-height:1.6">Use this one-time code to reset your password:</p>
     <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:24px 0">${escapeHtml(input.otp)}</p>
     <p style="font-size:15px;line-height:1.6">This code expires in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
  ),
});

export type GiftCardEmailItem = {
  product: string;
  brand: string;
  value: string;
  currency: string;
  code: string;
  pin: string;
  expiry: string;
};

export const giftCardDeliveryTemplate = (input: {
  orderNumber: string;
  transactionId: string;
  items: GiftCardEmailItem[];
}) => {
  const textItems = input.items
    .map((item) => [
      `Product: ${item.product}`,
      `Brand: ${item.brand}`,
      `Value: ${item.value} ${item.currency}`,
      `Code: ${item.code}`,
      `PIN: ${item.pin}`,
      `Expiry: ${item.expiry}`,
    ].join("\n"))
    .join("\n\n");
  const htmlItems = input.items
    .map((item) => `<div style="border:1px solid #e4e7ec;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px"><strong>${escapeHtml(item.product)}</strong></p>
      <p style="margin:4px 0">Brand: ${escapeHtml(item.brand)}</p>
      <p style="margin:4px 0">Value: ${escapeHtml(item.value)} ${escapeHtml(item.currency)}</p>
      <p style="margin:4px 0">Code: <strong>${escapeHtml(item.code)}</strong></p>
      <p style="margin:4px 0">PIN: <strong>${escapeHtml(item.pin)}</strong></p>
      <p style="margin:4px 0">Expiry: ${escapeHtml(item.expiry)}</p>
    </div>`)
    .join("");

  return {
    subject: `Your gift card order ${input.orderNumber}`,
    text: `Order: ${input.orderNumber}\nTransaction: ${input.transactionId}\n\n${textItems}`,
    html: layout(
      "Your gift card is ready",
      `<p style="font-size:15px;line-height:1.6">Order: <strong>${escapeHtml(input.orderNumber)}</strong><br>Transaction: ${escapeHtml(input.transactionId)}</p>${htmlItems}`,
    ),
  };
};

export const gameTopUpCompletedTemplate = (input: {
  customerName?: string | null;
  orderNumber: string;
  game: string;
  packageName: string;
  completedAt: Date;
}) => {
  const completedAt = input.completedAt.toISOString();
  return {
    subject: `Your ${input.game} top-up is complete`,
    text: `${input.customerName ? `Hi ${input.customerName},\n\n` : ""}Your top-up has been completed.\n\nOrder: ${input.orderNumber}\nGame: ${input.game}\nPackage: ${input.packageName}\nStatus: Completed\nCompleted at: ${completedAt}`,
    html: layout(
      "Top-up completed",
      `<p style="font-size:16px;line-height:1.6">${greeting(input.customerName)}</p>
       <p style="font-size:16px;line-height:1.6">Your top-up has been completed successfully.</p>
       <table role="presentation" width="100%" cellspacing="0" cellpadding="6" style="font-size:15px;line-height:1.5">
         <tr><td><strong>Order</strong></td><td>${escapeHtml(input.orderNumber)}</td></tr>
         <tr><td><strong>Game</strong></td><td>${escapeHtml(input.game)}</td></tr>
         <tr><td><strong>Package</strong></td><td>${escapeHtml(input.packageName)}</td></tr>
         <tr><td><strong>Status</strong></td><td>Completed</td></tr>
         <tr><td><strong>Completed at</strong></td><td>${escapeHtml(completedAt)}</td></tr>
       </table>`,
    ),
  };
};
