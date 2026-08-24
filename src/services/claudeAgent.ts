import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { AgentTurnResult, BusinessConfig, CallOutcome, TranscriptEntry } from "../types";
import { logger } from "../utils/logger";

const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

const RESPOND_TOOL_NAME = "respond_to_caller";

const respondTool: Anthropic.Tool = {
  name: RESPOND_TOOL_NAME,
  description:
    "Craft the agent's next spoken reply to the caller and classify the state of the call so far.",
  input_schema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description:
          "What the agent should say out loud to the caller next. Keep it short, natural, and phone-friendly (1-3 sentences).",
      },
      outcome: {
        type: "string",
        enum: [
          "in_progress",
          "message_taken",
          "appointment_requested",
          "faq_answered",
          "other",
        ] satisfies CallOutcome[],
        description:
          "Best classification of this call as of this turn. Use in_progress until the call has clearly resulted in one of the other outcomes.",
      },
      end_call: {
        type: "boolean",
        description:
          "True only when the conversation is wrapped up (caller has been helped, a message/appointment request was captured, or they said goodbye) and it is time to hang up after this message.",
      },
      lead: {
        type: "object",
        description:
          "Include when you have captured caller info to follow up on (taking a message or an appointment request). Omit entirely if nothing has been captured yet. Fill in only the fields you actually know.",
        properties: {
          name: { type: "string" },
          callbackNumber: { type: "string" },
          reason: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    required: ["message", "outcome", "end_call"],
  },
};

function formatHours(hours: Record<string, string>): string {
  return Object.entries(hours)
    .map(([day, range]) => `- ${day}: ${range}`)
    .join("\n");
}

function formatFaq(faq: Array<{ question: string; answer: string }>): string {
  if (faq.length === 0) return "(none provided)";
  return faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
}

function buildSystemPrompt(business: BusinessConfig, callerNumber: string): string {
  return `You are the AI phone receptionist for ${business.name}, a dental office. You are answering a call that came in after hours or was missed by staff. The caller's phone number is ${callerNumber}.

Your job:
1. Greet the caller warmly and briefly explain you're the office's virtual assistant.
2. Answer questions using ONLY the business info below (hours, services, FAQ). Never invent facts, prices, or medical advice.
3. If you can't answer something, or the caller wants to schedule/change/cancel an appointment, or has a dental emergency, offer to take a message or callback request. Politely collect their name, the best callback number (confirm the number even if it matches caller ID), and the reason for the call.
4. Keep replies short and conversational — this is a live phone call, not a chat window. One to three sentences per turn.
5. If the caller describes a dental emergency (e.g. severe pain, trauma, uncontrolled bleeding), tell them to call 911 or go to the nearest emergency room if it is life-threatening, and still offer to log the message for the office.
6. Only end the call once the caller's need has been addressed or a message has been captured and you've said a polite goodbye.

Business info:
Name: ${business.name}
Timezone: ${business.timezone}

Hours:
${formatHours(business.hours)}

Services offered:
${business.services.map((s) => `- ${s}`).join("\n")}

Frequently asked questions:
${formatFaq(business.faq)}

${business.instructions ? `Additional instructions from the office:\n${business.instructions}` : ""}

You must always respond by calling the ${RESPOND_TOOL_NAME} tool — never reply with plain text.`.trim();
}

function toAnthropicHistory(history: TranscriptEntry[]): Anthropic.MessageParam[] {
  return history.map((entry) => ({
    role: entry.role === "caller" ? "user" : "assistant",
    content: entry.text,
  }));
}

/**
 * Sends the caller's latest utterance plus conversation history to Claude,
 * forcing a structured response via tool use so the call session can act
 * on outcome/end_call/lead deterministically.
 */
export async function getAgentResponse(
  business: BusinessConfig,
  callerNumber: string,
  history: TranscriptEntry[]
): Promise<AgentTurnResult> {
  const system = buildSystemPrompt(business, callerNumber);
  const messages = toAnthropicHistory(history);

  const response = await anthropic.messages.create({
    model: env.claudeModel,
    max_tokens: 500,
    system,
    messages,
    tools: [respondTool],
    tool_choice: { type: "tool", name: RESPOND_TOOL_NAME },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    logger.error("Claude did not return a tool_use block", { response });
    return {
      message: "Sorry, I'm having trouble right now. Could you please call back shortly?",
      outcome: "other",
      endCall: true,
    };
  }

  const input = toolUse.input as {
    message: string;
    outcome: CallOutcome;
    end_call: boolean;
    lead?: { name?: string; callbackNumber?: string; reason?: string; notes?: string };
  };

  return {
    message: input.message,
    outcome: input.outcome,
    endCall: input.end_call,
    lead: input.lead,
  };
}
