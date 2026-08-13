"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentProvider = void 0;
const env_config_1 = require("../../../utils/env-config");
const bkash_provider_1 = require("./bkash.provider");
const mock_bkash_provider_1 = require("./mock-bkash.provider");
const getPaymentProvider = () => {
    if (env_config_1.ENV.PAYMENT_PROVIDER === "bkash") {
        return new bkash_provider_1.BkashProvider();
    }
    return new mock_bkash_provider_1.MockBkashProvider();
};
exports.getPaymentProvider = getPaymentProvider;
