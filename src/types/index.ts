export interface BusinessConfig {
  id: string;
  name: string;
  phoneNumber: string;
  timezone: string;
  hours: Record<string, string>;
  services: string[];
  faq: Array<{ question: string; answer: string }>;
  instructions?: string | null;
}

export type TranscriptRole = "caller" | "agent";

export interface TranscriptEntry {
  role: TranscriptRole;
  text: string;
  at: string; // ISO timestamp
}

export type CallOutcome =
  | "in_progress"
  | "message_taken"
  | "appointment_requested"
  | "faq_answered"
  | "no_answer"
  | "no_business_configured"
  | "other";

export interface CapturedLead {
  name?: string;
  callbackNumber?: string;
  reason?: string;
  notes?: string;
}

/** Structured result the agent brain returns for each conversational turn. */
export interface AgentTurnResult {
  message: string;
  outcome: CallOutcome;
  endCall: boolean;
  lead?: CapturedLead;
}
