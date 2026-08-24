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
  // asyncHandler-wrapped routes, or body-parser's malformed-JSON errors) so
  // a request-level error returns a response instead of crashing the
  // process and dropping every in-progress call.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled request error", { err });
    if (res.headersSent) return;

    // Respect a client-error status a lower middleware already computed
    // (e.g. body-parser sets 400 on malformed JSON) instead of always
    // reporting 500 for what's actually a bad request.
    const errWithStatus = err as { status?: unknown; statusCode?: unknown };
    const candidateStatus = errWithStatus?.status ?? errWithStatus?.statusCode;
    const status =
      typeof candidateStatus === "number" && candidateStatus >= 400 && candidateStatus < 500
        ? candidateStatus
        : 500;

    res.status(status).json({ error: status === 500 ? "Internal server error" : "Bad request" });
  });

  return app;
}
