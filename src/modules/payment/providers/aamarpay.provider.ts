import { ENV } from "../../../utils/env-config";
import type { IPaymentProvider } from "../interfaces/payment-provider.interface";
import type { ProviderCreatePaymentInput, ProviderCreatePaymentResponse, ProviderQueryPaymentResponse } from "../types/payment.types";
import { PaymentProviderError } from "../utils/payment-provider-error";
import { isRecord } from "../utils/payment.utils";

export class AamarpayProvider implements IPaymentProvider {
  readonly name = "aamarpay" as const;

  private async request(url: URL, init: RequestInit, operation: string) {
    try {
      const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(ENV.AAMARPAY_REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new PaymentProviderError("aamarPay request failed", this.name, { operation, httpStatus: response.status });
      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new PaymentProviderError("Invalid aamarPay response", this.name, { operation });
      return payload;
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;
      // Fetch errors can include the signature-bearing URL; never retain or log them.
      throw new PaymentProviderError("aamarPay request failed or timed out", this.name, { operation });
    }
  }

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResponse> {
    const callback = (outcome: string) => {
      const url = new URL(`${ENV.BACKEND_PUBLIC_URL}/api/v1/payments/aamarpay/${outcome}`);
      // Cancel redirects may have no body. This lookup ID is never proof of payment.
      url.searchParams.set("transactionId", input.transactionId);
      return url.toString();
    };
    const customer = input.customer;
    if (input.currency !== "BDT" || !/^[A-Za-z0-9_-]{1,32}$/.test(input.transactionId)) throw new PaymentProviderError("Invalid payment currency or transaction identifier", this.name);
    if (!customer.phone && ENV.AAMARPAY_MODE === "production") throw new PaymentProviderError("Customer phone is required for production checkout", this.name, { rejected: true });
    const payload = await this.request(new URL(ENV.AAMARPAY_PAYMENT_URL), {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        store_id: ENV.AAMARPAY_STORE_ID, signature_key: ENV.AAMARPAY_SIGNATURE_KEY,
        tran_id: input.transactionId, amount: input.amount, currency: "BDT", type: "json",
        success_url: callback("success"), fail_url: callback("fail"), cancel_url: callback("cancel"),
        desc: `Order ${input.orderId}`, cus_name: customer.name, cus_email: customer.email,
        cus_phone: customer.phone || "01700000000",
        cus_add1: customer.addressLine || "Not provided", cus_add2: "",
        cus_city: customer.city || "Dhaka", cus_state: customer.city || "Dhaka",
        cus_postcode: customer.postalCode || "1200", cus_country: customer.country || "Bangladesh",
      }),
    }, "initiate");
    if (payload.result !== true && payload.result !== "true") throw new PaymentProviderError("aamarPay rejected payment initiation", this.name, { operation: "initiate", rejected: true });
    let paymentUrl: URL;
    try { paymentUrl = new URL(String(payload.payment_url || "")); } catch { throw new PaymentProviderError("Invalid aamarPay payment URL", this.name); }
    if (paymentUrl.origin !== new URL(ENV.AAMARPAY_BASE_URL).origin || paymentUrl.username || paymentUrl.password) throw new PaymentProviderError("Unexpected aamarPay payment URL", this.name);
    return { paymentId: input.transactionId, paymentUrl: paymentUrl.toString() };
  }

  async queryPayment({ paymentId }: { paymentId: string }): Promise<ProviderQueryPaymentResponse> {
    const url = new URL(ENV.AAMARPAY_TRANSACTION_URL);
    url.search = new URLSearchParams({ request_id: paymentId, store_id: ENV.AAMARPAY_STORE_ID, signature_key: ENV.AAMARPAY_SIGNATURE_KEY, type: "json" }).toString();
    const payload = await this.request(url, { method: "GET", headers: { Accept: "application/json" } }, "verify");
    const value = (key: string) => typeof payload[key] === "string" || typeof payload[key] === "number" ? String(payload[key]).trim() : "";
    const statusCode = value("status_code");
    if (value("mer_txnid") !== paymentId || !["0", "2", "3", "7"].includes(statusCode)) throw new PaymentProviderError("Transaction lookup returned invalid or unknown data", this.name, { operation: "verify" });
    const stores = [value("store_id"), value("merchant_id")].filter(Boolean);
    if (!stores.length || stores.some(store => store !== ENV.AAMARPAY_STORE_ID)) throw new PaymentProviderError("Transaction merchant does not match", this.name, { operation: "verify" });
    if (statusCode === "2" && value("pay_status").toLowerCase() !== "successful") throw new PaymentProviderError("Inconsistent transaction status", this.name, { operation: "verify" });
    return {
      paymentId: value("mer_txnid"), transactionId: value("pg_txnid") || null,
      status: statusCode === "2" ? "PAID" : statusCode === "7" ? "FAILED" : statusCode === "3" ? "CANCELLED" : "PENDING",
      amount: value("amount"), currency: value("currency") || undefined, merchantCurrency: value("currency_merchant") || undefined,
      raw: Object.fromEntries(["mer_txnid", "pg_txnid", "status_code", "pay_status", "amount", "currency", "currency_merchant", "store_id", "merchant_id"].map(key => [key, value(key) || null])),
    };
  }
}
