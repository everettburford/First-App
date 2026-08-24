import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER || "+15555550123";

  const business = await prisma.business.upsert({
    where: { phoneNumber },
    update: {},
    create: {
      name: "Bright Smile Dental",
      phoneNumber,
      timezone: "America/New_York",
      hours: {
        mon: "8:00am-5:00pm",
        tue: "8:00am-5:00pm",
        wed: "8:00am-5:00pm",
        thu: "8:00am-5:00pm",
        fri: "8:00am-2:00pm",
        sat: "closed",
        sun: "closed",
      },
      services: [
        "Routine cleanings & exams",
        "Fillings",
        "Crowns & bridges",
        "Teeth whitening",
        "Invisalign / clear aligners",
        "Emergency tooth pain visits",
      ],
      faq: [
        {
          question: "Do you accept my insurance?",
          answer:
            "We accept most major PPO dental insurance plans. We'll need to verify your specific plan, so we'll take your info and have our team confirm coverage.",
        },
        {
          question: "Do you take walk-ins?",
          answer:
            "We generally require an appointment, but we do our best to fit in urgent or emergency cases the same day.",
        },
        {
          question: "How much does a cleaning cost?",
          answer:
            "Pricing depends on your insurance and specific needs, so we'll have our team follow up with exact costs.",
        },
      ],
      instructions:
        "Be warm and reassuring, especially with anxious or first-time patients. Never quote exact prices — always offer to have the office follow up with details.",
    },
  });

  console.log(`Seeded business: ${business.name} (${business.phoneNumber})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
