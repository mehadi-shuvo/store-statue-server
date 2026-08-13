"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = void 0;
const payment_provider_factory_1 = require("../providers/payment-provider.factory");
const payment_service_1 = require("./payment.service");
exports.paymentService = new payment_service_1.PaymentService((0, payment_provider_factory_1.getPaymentProvider)());
