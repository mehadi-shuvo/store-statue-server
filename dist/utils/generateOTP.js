"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOtp = void 0;
const crypto_1 = require("crypto");
const generateOtp = () => {
    return (0, crypto_1.randomInt)(100000, 1000000).toString();
};
exports.generateOtp = generateOtp;
