import fs from "fs";
import path from "path";
import { ENV } from "./env-config";

export type LogQuery = {
  limit?: number;
  level?: string;
};

export type ParsedLogEntry = {
  time: string;
  level: string;
  method?: string;
  url?: string;
  status?: number;
  message: string;
  raw: Record<string, unknown>;
};

const LOG_FILE_PREFIX = "app";
const LOG_FILE_EXTENSION = ".log";
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const READ_CHUNK_SIZE = 64 * 1024;

const levelLabels: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

const resolveLogDir = () => path.resolve(process.cwd(), ENV.LOG_DIR);

const isAppLogFile = (fileName: string) =>
  fileName.startsWith(`${LOG_FILE_PREFIX}-`) &&
  fileName.endsWith(LOG_FILE_EXTENSION);

const normalizeLimit = (limit: number | undefined) => {
  if (!limit || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

const parseLogLine = (line: string): ParsedLogEntry | null => {
  try {
    const raw = JSON.parse(line) as Record<string, any>;
    const req = raw.req as Record<string, any> | undefined;
    const res = raw.res as Record<string, any> | undefined;
    const time =
      typeof raw.time === "number"
        ? new Date(raw.time).toISOString()
        : String(raw.time || "");

    return {
      time,
      level:
        typeof raw.level === "number"
          ? levelLabels[raw.level] || String(raw.level)
          : String(raw.level || "info"),
      method: req?.method || raw.method,
      url: req?.url || raw.url,
      status: res?.statusCode || raw.statusCode,
      message: String(raw.msg || raw.message || ""),
      raw,
    };
  } catch {
    return null;
  }
};

const listLogFiles = async () => {
  const logDir = resolveLogDir();
  const fileNames = await fs.promises.readdir(logDir).catch(() => []);

  return fileNames
    .filter(isAppLogFile)
    .sort()
    .reverse()
    .map((fileName) => path.join(logDir, fileName));
};

const readNewestLines = async (filePath: string, limit: number) => {
  const file = await fs.promises.open(filePath, "r");

  try {
    const stats = await file.stat();
    const lines: string[] = [];
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
  } finally {
    await file.close();
  }
};

export const readLatestLogs = async (query: LogQuery = {}) => {
  const limit = normalizeLimit(query.limit);
  const requestedLevel = query.level?.toLowerCase();
  const entries: ParsedLogEntry[] = [];
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
