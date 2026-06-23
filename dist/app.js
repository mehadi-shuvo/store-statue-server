"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./app/routes"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_config_1 = require("./utils/env-config");
const app = (0, express_1.default)();
const normalizeOrigin = (origin) => origin.replace(/\/+$/, "");
const allowedOrigins = [
    env_config_1.ENV.CLIENT_URL,
    "https://store-statue-client.vercel.app",
    "http://localhost:3000",
].filter(Boolean).map(normalizeOrigin);
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        const normalizedOrigin = normalizeOrigin(origin);
        if (allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
app.use("/api", routes_1.default);
app.get("/", (req, res) => {
    res.send(`game express server is running ...`);
});
exports.default = app;
