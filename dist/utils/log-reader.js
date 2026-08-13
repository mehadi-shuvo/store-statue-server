"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readLatestLogs = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_config_1 = require("./env-config");
const LOG_FILE_PREFIX = "app";
const LOG_FILE_EXTENSION = ".log";
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const READ_CHUNK_SIZE = 64 * 1024;
const levelLabels = {
    10: "trace",
    20: "debug",
    30: "info",
    40: "warn",
    50: "error",
    60: "fatal",
};
const resolveLogDir = () => path_1.default.resolve(process.cwd(), env_config_1.ENV.LOG_DIR);
const isAppLogFile = (fileName) => fileName.startsWith(`${LOG_FILE_PREFIX}-`) &&
    fileName.endsWith(LOG_FILE_EXTENSION);
const normalizeLimit = (limit) => {
    if (!limit || !Number.isFinite(limit)) {
        return DEFAULT_LIMIT;
    }
    return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};
const parseLogLine = (line) => {
    try {
        const raw = JSON.parse(line);
        const req = raw.req;
        const res = raw.res;
        const time = typeof raw.time === "number"
            ? new Date(raw.time).toISOString()
            : String(raw.time || "");
        return {
            time,
            level: typeof raw.level === "number"
                ? levelLabels[raw.level] || String(raw.level)
                : String(raw.level || "info"),
            method: req?.method || raw.method,
            url: req?.url || raw.url,
            status: res?.statusCode || raw.statusCode,
            message: String(raw.msg || raw.message || ""),
            raw,
        };
    }
    catch {
        return null;
    }
};
const listLogFiles = async () => {
    const logDir = resolveLogDir();
    const fileNames = await fs_1.default.promises.readdir(logDir).catch(() => []);
    return fileNames
        .filter(isAppLogFile)
        .sort()
        .reverse()
        .map((fileName) => path_1.default.join(logDir, fileName));
};
const readNewestLines = async (filePath, limit) => {
    const file = await fs_1.default.promises.open(filePath, "r");
    try {
        const stats = await file.stat();
        const lines = [];
        let position = stats.size;
        let remainder = "";
        while (position > 0 && lines.length < limit) {
            const bytesToRead = Math.min(READ_CHUNK_SIZE, position);
            position -= bytesToRead;
            const buffer = Buffer.alloc(bytesToRead);
            await file.read(buffer, 0, bytesToRead, position);
            const chunk = buffer.toString("utf8") + remainder;
            const chunkLines = chunk.split("\n");
            remainder = chunkLines.shift() || "";
            for (let index = chunkLines.length - 1; index >= 0; index -= 1) {
                const line = chunkLines[index].trim();
                if (line) {
                    lines.push(line);
                }
                if (lines.length >= limit) {
                    break;
                }
            }
        }
        if (remainder.trim() && lines.length < limit) {
            lines.push(remainder.trim());
        }
        return lines;
    }
    finally {
        await file.close();
    }
};
const readLatestLogs = async (query = {}) => {
    const limit = normalizeLimit(query.limit);
    const requestedLevel = query.level?.toLowerCase();
    const entries = [];
    const files = await listLogFiles();
    for (const filePath of files) {
        const lines = await readNewestLines(filePath, limit - entries.length);
        for (const line of lines) {
            const parsed = parseLogLine(line);
            if (!parsed) {
                continue;
            }
            if (requestedLevel && parsed.level !== requestedLevel) {
                continue;
            }
            entries.push(parsed);
            if (entries.length >= limit) {
                break;
            }
        }
    }
    return entries.slice(0, limit);
};
exports.readLatestLogs = readLatestLogs;
