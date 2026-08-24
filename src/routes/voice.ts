import { Router, Request, Response } from "express";
import { twiml as Twiml } from "twilio";
import { logger } from "../utils/logger";

export const voiceRouter = Router();

/**
 * Twilio calls this webhook when a call comes in (configure it as the
 * phone number's "A call comes in" webhook). We respond with TwiML that
 * opens a bidirectional Media Stream back to this server.
 */
voiceRouter.post("/incoming", (req: Request, res: Response) => {
  const callSid = req.body.CallSid as string;
  const from = req.body.From as string;
  const to = req.body.To as string;

  logger.info("Incoming call", { callSid, from, to });

  const response = new Twiml.VoiceResponse();
  const connect = response.connect();
  const stream = connect.stream({
    url: `wss://${req.headers.host}/media-stream`,
  });
  stream.parameter({ name: "callSid", value: callSid });
  stream.parameter({ name: "from", value: from });
  stream.parameter({ name: "to", value: to });

  res.type("text/xml").send(response.toString());
});

/** Optional call status callback (configure alongside the voice webhook). */
voiceRouter.post("/status", (req: Request, res: Response) => {
  logger.info("Call status callback", {
    callSid: req.body.CallSid,
    status: req.body.CallStatus,
  });
  res.sendStatus(200);
});
