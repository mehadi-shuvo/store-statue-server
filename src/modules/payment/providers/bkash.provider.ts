import { ENV } from "../../../utils/env-config";
import { IPaymentProvider } from "../interfaces/payment-provider.interface";
import {
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResponse,
  ProviderExecutePaymentInput,
  ProviderExecutePaymentResponse,
  ProviderQueryPaymentInput,
  ProviderQueryPaymentResponse,
  ProviderVerifyPaymentInput,
} from "../types/payment.types";
import { isRecord } from "../utils/payment.utils";
import { PaymentProviderError } from "../utils/payment-provider-error";

type BkashTokenResponse = {
  id_token?: string;
  token?: string;
};

export class BkashProvider implements IPaymentProvider {
  readonly name = "bkash" as const;
  private token: string | null = null;

  private get baseUrl() {
    return ENV.BKASH_BASE_URL.replace(/\/+$/, "");
  }

  private ensureConfig() {
    const missing = [
      ["BKASH_BASE_URL", ENV.BKASH_BASE_URL],
      ["BKASH_APP_KEY", ENV.BKASH_APP_KEY],
      ["BKASH_APP_SECRET", ENV.BKASH_APP_SECRET],
      ["BKASH_USERNAME", ENV.BKASH_USERNAME],
      ["BKASH_PASSWORD", ENV.BKASH_PASSWORD],
      ["BKASH_CALLBACK_URL", ENV.BKASH_CALLBACK_URL],
    ].filter(([, value]) => !value);

    if (missing.length > 0) {
      throw new PaymentProviderError("bKash provider is not configured", this.name, {
        missing: missing.map(([key]) => key),
      });
    }
  }

  private async request<T extends Record<string, unknown>>(
    path: string,
    body: Record<string, unknown>,
    token?: string,
  ): Promise<T> {
    this.ensureConfig();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        username: ENV.BKASH_USERNAME,
        password: ENV.BKASH_PASSWORD,
        ...(token ? { authorization: token, "x-app-key": ENV.BKASH_APP_KEY } : {}),
      },
      body: JSON.stringify(body),
    });

    const payload: unknown = await response.json().catch(() => ({}));

    if (!response.ok || !isRecord(payload)) {
      throw new PaymentProviderError("bKash request failed", this.name, {
        status: response.status,
        path,
      });
    }

    return payload as T;
  }

  async getToken() {
    if (this.token) {
      return this.token;
    }

    const payload = await this.request<BkashTokenResponse & Record<string, unknown>>(
      "/tokenized/checkout/token/grant",
      {
        app_key: ENV.BKASH_APP_KEY,
        app_secret: ENV.BKASH_APP_SECRET,
      },
    );

    const token = payload.id_token || payload.token;

    if (!token) {
      throw new PaymentProviderError("bKash token response is invalid", this.name);
    }

    this.token = token;
    return token;
  }

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResponse> {
    const token = await this.getToken();
    const payload = await this.request<Record<string, unknown>>(
      "/tokenized/checkout/create",
      {
        mode: "0011",
        payerReference: input.orderId,
        callbackURL: ENV.BKASH_CALLBACK_URL,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        intent: "sale",
        merchantInvoiceNumber: input.invoiceNumber,
      },
      token,
    );

    const paymentID = String(payload.paymentID || "");
    const bkashURL = String(payload.bkashURL || "");

    if (!paymentID || !bkashURL) {
      throw new PaymentProviderError("bKash create payment response is invalid", this.name);
    }

    return {
      paymentID,
      bkashURL,
      statusCode: String(payload.statusCode || ""),
      statusMessage: String(payload.statusMessage || ""),
      raw: payload,
    };
  }

  async executePayment(input: ProviderExecutePaymentInput): Promise<ProviderExecutePaymentResponse> {
    const token = await this.getToken();
    const payload = await this.request<Record<string, unknown>>(
      "/tokenized/checkout/execute",
      { paymentID: input.paymentId },
      token,
    );

    return {
      trxID: typeof payload.trxID === "string" ? payload.trxID : null,
      paymentID: String(payload.paymentID || input.paymentId),
      amount: Number(payload.amount || input.amount),
      transactionStatus:
        payload.transactionStatus === "Completed" ? "Completed" : "Failed",
      raw: payload,
    };
  }

  async queryPayment(input: ProviderQueryPaymentInput): Promise<ProviderQueryPaymentResponse> {
    const token = await this.getToken();
    const payload = await this.request<Record<string, unknown>>(
      "/tokenized/checkout/payment/status",
      { paymentID: input.paymentId },
      token,
    );

    return {
      paymentID: String(payload.paymentID || input.paymentId),
      transactionStatus:
        payload.transactionStatus === "Completed" ? "Completed" : "Pending",
      trxID: typeof payload.trxID === "string" ? payload.trxID : null,
      amount: Number(payload.amount || 0),
      raw: payload,
    };
  }

  async verifyPayment(input: ProviderVerifyPaymentInput): Promise<ProviderQueryPaymentResponse> {
    return this.queryPayment({ paymentId: input.paymentId });
  }
}
