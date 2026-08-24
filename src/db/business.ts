import { prisma } from "./prisma";
import { BusinessConfig } from "../types";

/** Looks up the business by the Twilio number that was dialed. */
export async function findBusinessByPhoneNumber(
  phoneNumber: string
): Promise<BusinessConfig | null> {
  const business = await prisma.business.findUnique({
    where: { phoneNumber },
  });

  if (!business) return null;

  return {
    id: business.id,
    name: business.name,
    phoneNumber: business.phoneNumber,
    timezone: business.timezone,
    hours: business.hours as Record<string, string>,
    services: business.services as string[],
    faq: business.faq as Array<{ question: string; answer: string }>,
    instructions: business.instructions,
  };
}
