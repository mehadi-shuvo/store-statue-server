"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const stream_1 = require("stream");
const env_config_1 = require("./env-config");
const LOG_FILE_PREFIX = "app";
const LOG_FILE_EXTENSION = ".log";
const formatDate = (date) => date.toISOString().slice(0, 10);
const resolveLogDir = () => path_1.default.resolve(process.cwd(), env_config_1.ENV.LOG_DIR);
const isAppLogFile = (fileName) => fileName.startsWith(`${LOG_FILE_PREFIX}-`) &&
    fileName.endsWith(LOG_FILE_EXTENSION);
const cleanupOldLogs = async (logDir) => {
    const retentionMs = env_config_1.ENV.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    const fileNames = await fs_1.default.promises.readdir(logDir).catch(() => []);
    await Promise.all(fileNames.filter(isAppLogFile).map(async (fileName) => {
        const filePath = path_1.default.join(logDir, fileName);
        const stats = await fs_1.default.promises.stat(filePath).catch(() => null);
        if (stats && stats.mtimeMs < cutoff) {
            await fs_1.default.promises.unlink(filePath).catch(() => undefined);
        }
    }));
};
class DailyRotatingLogStream extends stream_1.Writable {
    constructor() {
        super();
        this.currentDate = "";
        this.logDir = resolveLogDir();
        fs_1.default.mkdirSync(this.logDir, { recursive: true });
        void cleanupOldLogs(this.logDir);
    }
    _write(chunk, encoding, callback) {
        try {
            const stream = this.getStream();
            stream.write(chunk, encoding, callback);
        }
        catch (error) {
            callback(error);
        }
    }
    getStream() {
        const today = formatDate(new Date());
        if (this.currentDate !== today || !this.currentStream) {
            this.rotate(today);
        }
        return this.currentStream;
    }
    rotate(date) {
        this.currentStream?.end();
        this.currentDate = date;
        this.currentStream = fs_1.default.createWriteStream(path_1.default.join(this.logDir, `${LOG_FILE_PREFIX}-${date}${LOG_FILE_EXTENSION}`), { flags: "a" });
        void cleanupOldLogs(this.logDir);
    }
}
const loggerOptions = {
    level: env_config_1.ENV.LOG_LEVEL || (env_config_1.ENV.NODE_ENV === "production" ? "info" : "debug"),
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie",
            "*.password",
            "*.currentPassword",
            "*.newPassword",
            "*.accessToken",
            "*.refreshToken",
        ],
        censor: "[REDACTED]",
    },
};
exports.logger = env_config_1.ENV.NODE_ENV === "production"
    ? (0, pino_1.default)(loggerOptions, new DailyRotatingLogStream())
    : (0, pino_1.default)(loggerOptions);
exports.httpLogger = (0, pino_http_1.default)({
    logger: exports.logger,
    customLogLevel: (req, res, error) => {
        if (error || res.statusCode >= 500) {
            return "error";
        }
        if (res.statusCode >= 400) {
            return "warn";
        }
        return "info";
    },
});
