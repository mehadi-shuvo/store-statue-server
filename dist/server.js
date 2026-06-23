"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_config_1 = require("./utils/env-config");
const port = env_config_1.ENV.PORT || 5000;
async function main() {
    try {
        app_1.default.listen(port, () => {
            console.log(`[server 🔥⚡]: Server is running at http://localhost:${port}`);
        });
    }
    catch (err) {
        throw new Error("server is down!");
    }
}
main();
