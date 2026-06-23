import express, { Express, Request, Response } from "express";
import cors from "cors";
import router from "./app/routes";

import cookieParser from "cookie-parser";
import { ENV } from "./utils/env-config";

const app: Express = express();

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, "");

const allowedOrigins = [
  ENV.CLIENT_URL,
  "https://store-statue-client.vercel.app",
  "http://localhost:3000",
].filter(Boolean).map(normalizeOrigin);

app.use(express.json());
app.use(
  cors({
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
  }),
);
app.use(cookieParser());

app.use("/api", router);

app.get("/", (req: Request, res: Response) => {
  res.send(`game express server is running ...`);
});

export default app;
