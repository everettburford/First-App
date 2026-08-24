import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { voiceRouter } from "./routes/voice";
import { apiRouter } from "./routes/api";
import { logger } from "./utils/logger";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false })); // Twilio webhooks post form-encoded bodies

  app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "dental-ai-phone-agent" });
  });

  app.use("/voice", voiceRouter);
  app.use("/api", apiRouter);

  // Last-resort handler: catches anything forwarded via next(err) (e.g. from
  // asyncHandler-wrapped routes) so a request-level error returns a 500
  // instead of crashing the process and dropping every in-progress call.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled request error", { err });
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
