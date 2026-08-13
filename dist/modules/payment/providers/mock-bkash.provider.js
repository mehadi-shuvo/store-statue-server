"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockBkashProvider = void 0;
class MockBkashProvider {
    constructor() {
        this.name = "mock";
    }
    async createPayment(input) {
        const paymentID = `MOCK-BKASH-${input.invoiceNumber}`;
        const response = {
            paymentID,
            bkashURL: `http://localhost:5000/mock/bkash/pay/${paymentID}`,
            statusCode: "0000",
            statusMessage: "Successful",
        };
        return { ...response, raw: response };
    }
    async executePayment(input) {
        const scenario = input.scenario || "success";
        const transactionStatus = scenario === "failure" ? "Failed" : scenario === "cancel" ? "Cancelled" : "Completed";
        const response = {
            trxID: transactionStatus === "Completed" ? `MOCK-TRX-${Date.now()}` : null,
            paymentID: input.paymentId,
            amount: input.amount,
            transactionStatus,
        };
        return { ...response, raw: response };
    }
    async queryPayment(input) {
        const response = {
            paymentID: input.paymentId,
            transactionStatus: "Pending",
            trxID: null,
        };
        return { ...response, raw: response };
    }
    async verifyPayment(input) {
        const response = {
            paymentID: input.paymentId,
            transactionStatus: input.transactionId ? "Completed" : "Failed",
            trxID: input.transactionId || null,
        };
        return { ...response, raw: response };
    }
}
exports.MockBkashProvider = MockBkashProvider;
