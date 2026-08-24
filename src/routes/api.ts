import { Router, Request, Response } from "express";
import { prisma } from "../db/prisma";

export const apiRouter = Router();

/** GET /api/call-logs?businessId=&limit=&cursor= */
apiRouter.get("/call-logs", async (req: Request, res: Response) => {
  const { businessId, limit } = req.query;

  const callLogs = await prisma.callLog.findMany({
    where: businessId ? { businessId: String(businessId) } : undefined,
    orderBy: { startedAt: "desc" },
    take: limit ? Number(limit) : 50,
    include: { lead: true },
  });

  res.json(callLogs);
});

/** GET /api/call-logs/:id */
apiRouter.get("/call-logs/:id", async (req: Request, res: Response) => {
  const callLog = await prisma.callLog.findUnique({
    where: { id: req.params.id },
    include: { lead: true, business: true },
  });

  if (!callLog) {
    return res.status(404).json({ error: "Call log not found" });
  }
  res.json(callLog);
});

/** GET /api/leads?businessId=&limit= */
apiRouter.get("/leads", async (req: Request, res: Response) => {
  const { businessId, limit } = req.query;

  const leads = await prisma.lead.findMany({
    where: businessId ? { businessId: String(businessId) } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit ? Number(limit) : 50,
    include: { callLog: true },
  });

  res.json(leads);
});

/** GET /api/businesses */
apiRouter.get("/businesses", async (_req: Request, res: Response) => {
  const businesses = await prisma.business.findMany({ orderBy: { name: "asc" } });
  res.json(businesses);
});

/**
 * POST /api/businesses — upsert a business config by phone number.
 * Handy for onboarding a business without touching the DB directly.
 */
apiRouter.post("/businesses", async (req: Request, res: Response) => {
  const { name, phoneNumber, timezone, hours, services, faq, instructions } = req.body;

  if (!name || !phoneNumber || !hours || !services || !faq) {
    return res
      .status(400)
      .json({ error: "name, phoneNumber, hours, services, and faq are required" });
  }

  const business = await prisma.business.upsert({
    where: { phoneNumber },
    update: { name, timezone, hours, services, faq, instructions },
    create: { name, phoneNumber, timezone, hours, services, faq, instructions },
  });

  res.status(201).json(business);
});
