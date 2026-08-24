import { createClient, LiveTranscriptionEvents, LiveClient } from "@deepgram/sdk";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const deepgram = createClient(env.deepgramApiKey);

export interface DeepgramStreamHandlers {
  /** Called whenever a final transcript segment is ready to hand to the agent. */
  onFinalTranscript: (text: string) => void;
  onError?: (err: unknown) => void;
}

/**
 * Opens a Deepgram live transcription connection matched to Twilio's
 * Media Streams audio format (8kHz mono mu-law).
 */
export function openDeepgramStream(handlers: DeepgramStreamHandlers): LiveClient {
  const connection = deepgram.listen.live({
    model: env.deepgramModel,
    encoding: "mulaw",
    sample_rate: 8000,
    channels: 1,
    smart_format: true,
    interim_results: true,
    endpointing: 300,
    utterance_end_ms: 1000,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    logger.info("Deepgram connection opened");
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data.channel?.alternatives?.[0];
    const text = alt?.transcript?.trim();
    if (!text) return;

    // Only act once Deepgram considers the utterance complete, to keep
    // the conversation loop to a simple request/response cycle.
    if (data.is_final && data.speech_final) {
      handlers.onFinalTranscript(text);
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (err) => {
    logger.error("Deepgram error", { err });
    handlers.onError?.(err);
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    logger.info("Deepgram connection closed");
  });

  return connection;
}

export function sendAudioToDeepgram(connection: LiveClient, chunk: Buffer): void {
  const arrayBuffer = chunk.buffer.slice(
    chunk.byteOffset,
    chunk.byteOffset + chunk.byteLength
  ) as ArrayBuffer;
  connection.send(arrayBuffer);
}

export function closeDeepgramStream(connection: LiveClient): void {
  connection.requestClose();
}
