import twilio from "twilio";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);

/** Ends an in-progress call from the server side once the agent is done. */
export async function hangUpCall(callSid: string): Promise<void> {
  try {
    await twilioClient.calls(callSid).update({ status: "completed" });
  } catch (err) {
    logger.error("Failed to hang up call via Twilio REST API", { callSid, err });
  }
}
