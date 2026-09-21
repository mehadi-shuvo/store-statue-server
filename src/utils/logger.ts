import pino from "pino";
import pinoHttp from "pino-http";
import fs from "fs";
import path from "path";
import { Writable } from "stream";
import { ENV } from "./env-config";

const LOG_FILE_PREFIX = "app";
const LOG_FILE_EXTENSION = ".log";

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const resolveLogDir = () => path.resolve(process.cwd(), ENV.LOG_DIR);

const isAppLogFile = (fileName: string) =>
  fileName.startsWith(`${LOG_FILE_PREFIX}-`) &&
  fileName.endsWith(LOG_FILE_EXTENSION);

const cleanupOldLogs = async (logDir: string) => {
  const retentionMs = ENV.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;
  const fileNames = await fs.promises.readdir(logDir).catch(() => []);

  await Promise.all(
    fileNames.filter(isAppLogFile).map(async (fileName) => {
      const filePath = path.join(logDir, fileName);
      const stats = await fs.promises.stat(filePath).catch(() => null);

      if (stats && stats.mtimeMs < cutoff) {
        await fs.promises.unlink(filePath).catch(() => undefined);
      }
    }),
  );
};

class DailyRotatingLogStream extends Writable {
  private currentDate = "";
  private currentStream?: fs.WriteStream;
  private readonly logDir = resolveLogDir();

  constructor() {
    super();
    fs.mkdirSync(this.logDir, { recursive: true });
    void cleanupOldLogs(this.logDir);
  }

  _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    try {
      const stream = this.getStream();
      stream.write(chunk, encoding, callback);
    } catch (error) {
      callback(error as Error);
    }
  }

  private getStream() {
    const today = formatDate(new Date());

    if (this.currentDate !== today || !this.currentStream) {
      this.rotate(today);
    }

    return this.currentStream!;
  }

  private rotate(date: string) {
    this.currentStream?.end();
    this.currentDate = date;
    this.currentStream = fs.createWriteStream(
      path.join(this.logDir, `${LOG_FILE_PREFIX}-${date}${LOG_FILE_EXTENSION}`),
      { flags: "a" },
    );
    void cleanupOldLogs(this.logDir);
  }
}

const loggerOptions: pino.LoggerOptions = {
  level: ENV.LOG_LEVEL || (ENV.NODE_ENV === "production" ? "info" : "debug"),
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
      "*.id_token",
      "*.refresh_token",
      "*.otp",
      "req.body.otp",
      "*.verificationToken",
      "*.signature_key",
      "req.body.signature_key",
      "req.query.signature_key",
      "*.AAMARPAY_SIGNATURE_KEY",
      "*.code",
      "*.pin",
      "*.cards[*].code",
      "*.cards[*].pin",
    ],
    censor: "[REDACTED]",
  },
};

export const logger =
  ENV.LOG_TO_FILE
    ? pino(loggerOptions, new DailyRotatingLogStream())
    : pino(loggerOptions);

export const httpLogger = pinoHttp({
  logger,
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
