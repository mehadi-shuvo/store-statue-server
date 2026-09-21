import assert from "node:assert/strict";
import test from "node:test";
import { ENV } from "../../../utils/env-config";
import { parsePaymentEnvironment } from "../../../config/payment.config";
import { AamarpayProvider } from "../providers/aamarpay.provider";
import type { ProviderCreatePaymentInput } from "../types/payment.types";
import { PaymentProviderError } from "../utils/payment-provider-error";

const config = {
  PAYMENT_PROVIDER: "aamarpay", AAMARPAY_MODE: "sandbox", AAMARPAY_STORE_ID: "test-store", AAMARPAY_SIGNATURE_KEY: "test-signature",
  AAMARPAY_BASE_URL: "https://sandbox.aamarpay.com", AAMARPAY_PAYMENT_URL: "https://sandbox.aamarpay.com/jsonpost.php",
  AAMARPAY_TRANSACTION_URL: "https://sandbox.aamarpay.com/api/v1/trxcheck/request.php", BACKEND_PUBLIC_URL: "http://localhost:5000", FRONTEND_URL: "http://localhost:3000",
};
const input: ProviderCreatePaymentInput = { orderId: "order-1", transactionId: "GX_123", amount: "500.00", currency: "BDT", customer: { name: "Test Customer", email: "customer@example.test", phone: null } };
const queryResult = { mer_txnid: "GX_123", pg_txnid: "AAM123", merchant_id: "test-store", amount: "500.00", currency: "BDT", status_code: "2", pay_status: "Successful" };
test.beforeEach(() => { Object.assign(ENV, parsePaymentEnvironment(config)); });

test("sandbox initiation sends customer data and returns a normalized payment URL", async t => {
  let requestBody: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    assert.equal(url.toString(), config.AAMARPAY_PAYMENT_URL);
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.ok(init.signal);
    requestBody = JSON.parse(String(init.body));
    return Response.json({ result: "true", payment_url: "https://sandbox.aamarpay.com/paynow.php?track=AAM123" });
  });
  const result = await new AamarpayProvider().createPayment(input);
  assert.equal(result.paymentId, "GX_123");
  assert.ok(result.paymentUrl.startsWith(config.AAMARPAY_BASE_URL));
  assert.equal(requestBody.tran_id, "GX_123");
  assert.equal(requestBody.amount, "500.00");
  assert.equal(requestBody.cus_email, input.customer.email);
  assert.equal(requestBody.cus_phone, "01700000000");
  for (const key of ["success_url", "fail_url", "cancel_url"]) {
    const url = new URL(String(requestBody[key]));
    assert.equal(url.origin, "http://localhost:5000");
    assert.equal(url.searchParams.get("transactionId"), "GX_123");
  }
  assert.equal(JSON.stringify(result).includes("test-signature"), false);
});
test("real profile address and phone are preserved in gateway requests", async t => {
  t.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.cus_phone, "01912345678"); assert.equal(body.cus_add1, "Actual address"); assert.equal(body.cus_city, "Sylhet"); assert.equal(body.cus_postcode, "3100");
    return Response.json({ result: true, payment_url: "https://sandbox.aamarpay.com/paynow.php?track=AAM123" });
  });
  await new AamarpayProvider().createPayment({ ...input, customer: { ...input.customer, phone: "01912345678", addressLine: "Actual address", city: "Sylhet", postalCode: "3100" } });
});
test("verification independently searches the merchant transaction and strips secrets and PII", async t => {
  t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    assert.equal(init.method, "GET"); assert.equal(url.searchParams.get("request_id"), "GX_123");
    assert.equal(url.searchParams.get("signature_key"), "test-signature");
    return Response.json({ ...queryResult, signature_key: "test-signature", cus_email: "private@example.test", cardnumber: "secret-card" });
  });
  const result = await new AamarpayProvider().queryPayment({ paymentId: "GX_123" });
  assert.equal(result.status, "PAID"); assert.equal(result.transactionId, "AAM123");
  assert.equal(JSON.stringify(result).includes("test-signature"), false);
  assert.equal(JSON.stringify(result).includes("private@example.test"), false);
  assert.equal(JSON.stringify(result).includes("secret-card"), false);
});
for (const [name, payload] of [
  ["invalid transaction", { status: "Invalid-Data" }],
  ["wrong merchant transaction", { ...queryResult, mer_txnid: "OTHER" }],
  ["wrong store", { ...queryResult, merchant_id: "OTHER" }],
  ["conflicting store", { ...queryResult, store_id: "OTHER" }],
  ["unknown status", { ...queryResult, status_code: "99" }],
  ["conflicting success status", { ...queryResult, pay_status: "Failed" }],
] as const) test(`rejects ${name}`, async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json(payload));
  await assert.rejects(() => new AamarpayProvider().queryPayment({ paymentId: "GX_123" }), PaymentProviderError);
});
for (const [code, status] of [["0", "PENDING"], ["3", "CANCELLED"], ["7", "FAILED"]] as const) test(`maps authoritative status ${code} to ${status}`, async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ...queryResult, status_code: code, pay_status: status }));
  assert.equal((await new AamarpayProvider().queryPayment({ paymentId: "GX_123" })).status, status);
});
test("gateway rejection is distinguishable from an ambiguous timeout", async t => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({ result: "false", error: "secret" }));
  await assert.rejects(() => new AamarpayProvider().createPayment(input), (e: unknown) => e instanceof PaymentProviderError && e.details?.rejected === true && !e.message.includes("secret"));
  fetchMock.mock.mockImplementation(async () => { throw new Error("test-signature"); });
  await assert.rejects(() => new AamarpayProvider().createPayment(input), (e: unknown) => e instanceof PaymentProviderError && !e.details?.rejected && !e.message.includes("test-signature"));
});
test("rejects gateway HTTP errors, malformed JSON, and unsafe payment URLs", async t => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("bad", { status: 503 }));
  const provider = new AamarpayProvider();
  await assert.rejects(() => provider.createPayment(input), PaymentProviderError);
  fetchMock.mock.mockImplementation(async () => new Response("not JSON"));
  await assert.rejects(() => provider.createPayment(input), PaymentProviderError);
  fetchMock.mock.mockImplementation(async () => Response.json({ result: "true", payment_url: "https://attacker.example/pay" }));
  await assert.rejects(() => provider.createPayment(input), PaymentProviderError);
});
test("payment environment validates credentials, mode, endpoints, and timeouts without printing secrets", () => {
  assert.equal(parsePaymentEnvironment(config).AAMARPAY_MODE, "sandbox");
  for (const patch of [{ AAMARPAY_SIGNATURE_KEY: "" }, { AAMARPAY_MODE: "unknown" }, { PAYMENT_PROVIDER: "other" }, { AAMARPAY_REQUEST_TIMEOUT_MS: "NaN" }, { AAMARPAY_PAYMENT_URL: "https://attacker.example" }, { BACKEND_PUBLIC_URL: "invalid" }, { PAYMENT_PROVIDER: "mock", NODE_ENV: "production" }]) {
    assert.throws(() => parsePaymentEnvironment({ ...config, ...patch }));
  }
});
