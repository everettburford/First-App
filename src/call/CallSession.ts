import { WebSocket } from "ws";
import { LiveClient } from "@deepgram/sdk";
import { prisma } from "../db/prisma";
import { findBusinessByPhoneNumber } from "../db/business";
import { openDeepgramStream, sendAudioToDeepgram, closeDeepgramStream } from "../services/deepgram";
import { textToSpeechMulaw } from "../services/elevenlabs";
import { getAgentResponse } from "../services/claudeAgent";
import { hangUpCall } from "../services/twilioClient";
import { logger } from "../utils/logger";
import { BusinessConfig, CallOutcome, TranscriptEntry } from "../types";

const GREETING = (businessName: string) =>
  `Thanks for calling ${businessName}. I'm the office's virtual assistant, here to help since we can't get to the phone right now. How can I help you?`;

// Twilio media frames are 20ms of 8kHz mu-law audio = 160 bytes.
const FRAME_SIZE = 160;
const FRAME_DURATION_MS = 20;

interface TwilioStartPayload {
  streamSid: string;
  callSid: string;
  customParameters?: Record<string, string>;
}

export class CallSession {
  private ws: WebSocket;
  private deepgram: LiveClient | null = null;
  private streamSid: string | null = null;
  private callSid: string | null = null;
  private callerNumber = "unknown";
  private business: BusinessConfig | null = null;
  private history: TranscriptEntry[] = [];
  private processingTurn = false;
  private callLogId: string | null = null;
  private finalized = false;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on("message", (raw) => this.handleTwilioMessage(raw));
    this.ws.on("close", () => this.handleClose());
    this.ws.on("error", (err) => logger.error("Twilio media WS error", { err }));
  }

  private async handleTwilioMessage(raw: unknown): Promise<void> {
    let msg: any;
    try {
      msg = JSON.parse(raw as string);
    } catch {
      return;
    }

    try {
      switch (msg.event) {
        case "start":
          await this.handleStart(msg.start as TwilioStartPayload);
          break;
        case "media":
          this.handleMedia(msg.media.payload as string);
          break;
        case "stop":
          await this.handleStop();
          break;
        default:
          break;
      }
    } catch (err) {
      // A DB blip or unexpected payload on one call must not crash the
      // process and drop every other in-progress call.
      logger.error("Error handling Twilio media stream message", { event: msg.event, err });
    }
  }

  private async handleStart(start: TwilioStartPayload): Promise<void> {
    this.streamSid = start.streamSid;
    this.callSid = start.callSid;
    this.callerNumber = start.customParameters?.from ?? "unknown";
    const toNumber = start.customParameters?.to ?? "";

    logger.info("Call stream started", { callSid: this.callSid, from: this.callerNumber, to: toNumber });

    this.business = await findBusinessByPhoneNumber(toNumber);

    const callLog = await prisma.callLog.create({
      data: {
        businessId: this.business?.id ?? null,
        callSid: this.callSid!,
        callerNumber: this.callerNumber,
        transcript: [],
        outcome: this.business ? "IN_PROGRESS" : "NO_BUSINESS_CONFIGURED",
      },
    });
    this.callLogId = callLog.id;

    if (!this.business) {
      logger.error("No business configured for dialed number", { toNumber });
      const message = "Sorry, this office isn't set up yet. Please try again later. Goodbye.";
      this.history.push({ role: "agent", text: message, at: new Date().toISOString() });
      await this.persistTranscript();
      await this.speak(message);
      this.endCall();
      return;
    }

    this.deepgram = openDeepgramStream({
      onFinalTranscript: (text) => this.handleCallerUtterance(text),
      onError: (err) => logger.error("Deepgram stream error", { err }),
    });

    const greeting = GREETING(this.business.name);
    this.history.push({ role: "agent", text: greeting, at: new Date().toISOString() });
    await this.persistTranscript();
    await this.speak(greeting);
  }

  private handleMedia(payloadBase64: string): void {
    if (!this.deepgram) return;
    const chunk = Buffer.from(payloadBase64, "base64");
    sendAudioToDeepgram(this.deepgram, chunk);
  }

  private async handleCallerUtterance(text: string): Promise<void> {
    if (this.processingTurn || !this.business) return;
    this.processingTurn = true;

    try {
      this.history.push({ role: "caller", text, at: new Date().toISOString() });
      await this.persistTranscript();

      const result = await getAgentResponse(this.business, this.callerNumber, this.history);

      this.history.push({ role: "agent", text: result.message, at: new Date().toISOString() });
      await this.persistTranscript();

      await this.speak(result.message);

      if (result.lead?.callbackNumber) {
        await this.upsertLead(result.lead);
      }

      await this.updateOutcome(result.outcome);

      if (result.endCall) {
        this.endCall();
      }
    } catch (err) {
      logger.error("Error handling caller utterance", { err });
    } finally {
      this.processingTurn = false;
    }
  }

  private async speak(text: string): Promise<void> {
    if (!this.streamSid || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const audio = await textToSpeechMulaw(text);
      this.sendAudioFrames(audio);
    } catch (err) {
      logger.error("TTS/playback failed", { err });
    }
  }

  private sendAudioFrames(audio: Buffer): void {
    for (let offset = 0; offset < audio.length; offset += FRAME_SIZE) {
      const frame = audio.subarray(offset, offset + FRAME_SIZE);
      const mediaMessage = {
        event: "media",
        streamSid: this.streamSid,
        media: { payload: frame.toString("base64") },
      };
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(mediaMessage));
      }
    }
  }

  private async upsertLead(lead: {
    name?: string;
    callbackNumber?: string;
    reason?: string;
    notes?: string;
  }): Promise<void> {
    if (!this.business || !lead.callbackNumber) return;
    try {
      await prisma.lead.upsert({
        where: { callLogId: this.callLogId ?? "" },
        update: {
          name: lead.name,
          callbackNumber: lead.callbackNumber,
          reason: lead.reason,
          notes: lead.notes,
        },
        create: {
          businessId: this.business.id,
          callLogId: this.callLogId,
          name: lead.name,
          callbackNumber: lead.callbackNumber,
          reason: lead.reason,
          notes: lead.notes,
        },
      });
    } catch (err) {
      logger.error("Failed to save lead", { err });
    }
  }

  private async updateOutcome(outcome: CallOutcome): Promise<void> {
    if (!this.callLogId) return;
    const prismaOutcome = outcome.toUpperCase() as
      | "IN_PROGRESS"
      | "MESSAGE_TAKEN"
      | "APPOINTMENT_REQUESTED"
      | "FAQ_ANSWERED"
      | "OTHER";
    try {
      await prisma.callLog.update({
        where: { id: this.callLogId },
        data: { outcome: prismaOutcome },
      });
    } catch (err) {
      logger.error("Failed to update call outcome", { err });
    }
  }

  private async persistTranscript(): Promise<void> {
    if (!this.callLogId) return;
    try {
      await prisma.callLog.update({
        where: { id: this.callLogId },
        data: { transcript: this.history as unknown as object },
      });
    } catch (err) {
      logger.error("Failed to persist transcript", { err });
    }
  }

  private endCall(): void {
    // Give the last audio frames time to actually play out before hanging up.
    const estimatedLastUtteranceMs =
      (this.history[this.history.length - 1]?.text.length ?? 0) * 60; // rough speaking-time estimate
    const delay = Math.min(Math.max(estimatedLastUtteranceMs, 1500), 8000);

    setTimeout(async () => {
      if (this.callSid) {
        await hangUpCall(this.callSid);
      }
      this.finalizeCallLog("other");
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    }, delay);
  }

  private async handleStop(): Promise<void> {
    logger.info("Call stream stopped", { callSid: this.callSid });
    if (this.deepgram) {
      closeDeepgramStream(this.deepgram);
    }
    await this.finalizeCallLog();
  }

  private handleClose(): void {
    if (this.deepgram) {
      closeDeepgramStream(this.deepgram);
    }
    void this.finalizeCallLog();
  }

  private async finalizeCallLog(fallbackOutcome?: CallOutcome): Promise<void> {
    if (!this.callLogId || this.finalized) return;
    this.finalized = true;
    try {
      const existing = await prisma.callLog.findUnique({ where: { id: this.callLogId } });
      const data: { endedAt: Date; outcome?: any } = { endedAt: new Date() };
      if (existing?.outcome === "IN_PROGRESS" && fallbackOutcome) {
        data.outcome = fallbackOutcome.toUpperCase();
      }
      await prisma.callLog.update({ where: { id: this.callLogId }, data });
    } catch (err) {
      logger.error("Failed to finalize call log", { err });
    }
  }
}
