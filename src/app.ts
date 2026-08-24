import express from "express";
import cors from "cors";
import { voiceRouter } from "./routes/voice";
import { apiRouter } from "./routes/api";

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

  return app;
}
