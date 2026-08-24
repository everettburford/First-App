import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(optional("PORT", "3000")),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "",

  databaseUrl: required("DATABASE_URL"),

  twilioAccountSid: required("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: required("TWILIO_AUTH_TOKEN"),
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER ?? "",

  deepgramApiKey: required("DEEPGRAM_API_KEY"),
  deepgramModel: optional("DEEPGRAM_MODEL", "nova-2"),

  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  claudeModel: optional("CLAUDE_MODEL", "claude-sonnet-5"),

  elevenLabsApiKey: required("ELEVENLABS_API_KEY"),
  elevenLabsVoiceId: required("ELEVENLABS_VOICE_ID"),
};
