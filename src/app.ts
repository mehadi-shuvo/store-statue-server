import express, { Express, Request, Response } from "express";
import cors from "cors";
import router from "./app/routes";

import cookieParser from "cookie-parser";

const app: Express = express();

app.use(express.json());
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(cookieParser());

app.use("/api", router);

app.get("/", (req: Request, res: Response) => {
  res.send(`game express server is running ...`);
});

export default app;
