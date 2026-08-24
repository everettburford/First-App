import { env } from "../config/env";
import { logger } from "../utils/logger";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

/**
 * Converts text to speech via ElevenLabs, requesting mu-law 8kHz output
 * so the bytes can be sent straight back into a Twilio Media Stream
 * with no transcoding step.
 */
export async function textToSpeechMulaw(text: string): Promise<Buffer> {
  const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${env.elevenLabsVoiceId}?output_format=ulaw_8000`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": env.elevenLabsApiKey,
      "Content-Type": "application/json",
      Accept: "audio/basic",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("ElevenLabs TTS request failed", { status: response.status, body });
    throw new Error(`ElevenLabs TTS failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
