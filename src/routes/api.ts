import { Router, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { parseLimit } from "../utils/pagination";

export const apiRouter = Router();

/**
 * GET /api/call-logs?businessId=&limit=&unmatched=
 * Pass unmatched=true to list only calls to a number with no configured
 * Business (businessId is null, outcome NO_BUSINESS_CONFIGURED). Takes
 * precedence over businessId if both are given, since they're mutually
 * exclusive filters.
 */
apiRouter.get(
  "/call-logs",
  asyncHandler(async (req: Request, res: Response) => {
    const { businessId, limit, unmatched } = req.query;

    const where =
      unmatched === "true"
        ? { businessId: null }
        : businessId
          ? { businessId: String(businessId) }
          : undefined;

    const callLogs = await prisma.callLog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: parseLimit(limit),
      include: { lead: true },
    });

    res.json(callLogs);
  })
);

/** GET /api/call-logs/:id */
apiRouter.get(
  "/call-logs/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const callLog = await prisma.callLog.findUnique({
      where: { id: req.params.id },
      include: { lead: true, business: true },
    });

    if (!callLog) {
      return res.status(404).json({ error: "Call log not found" });
    }
    res.json(callLog);
  })
);

/** GET /api/leads?businessId=&limit= */
apiRouter.get(
  "/leads",
  asyncHandler(async (req: Request, res: Response) => {
    const { businessId, limit } = req.query;

    const leads = await prisma.lead.findMany({
      where: businessId ? { businessId: String(businessId) } : undefined,
      orderBy: { createdAt: "desc" },
      take: parseLimit(limit),
      include: { callLog: true },
    });

    res.json(leads);
  })
);

/** GET /api/businesses */
apiRouter.get(
  "/businesses",
  asyncHandler(async (_req: Request, res: Response) => {
    const businesses = await prisma.business.findMany({ orderBy: { name: "asc" } });
    res.json(businesses);
  })
);

/**
 * POST /api/businesses — upsert a business config by phone number.
 * Handy for onboarding a business without touching the DB directly.
 */
apiRouter.post(
  "/businesses",
  asyncHandler(async (req: Request, res: Response) => {
    const { name, phoneNumber, timezone, hours, services, faq, instructions } = req.body;

    if (!name || !phoneNumber || !hours || !services || !faq) {
      return res
        .status(400)
        .json({ error: "name, phoneNumber, hours, services, and faq are required" });
    }

    // The agent brain builds the caller-facing system prompt straight from
    // these fields (Object.entries on hours, .map on services/faq) — a
    // wrong shape here doesn't fail loudly, it silently breaks every call
    // to this business the moment a caller says anything.
    if (
      typeof name !== "string" ||
      typeof phoneNumber !== "string" ||
      typeof hours !== "object" ||
      Array.isArray(hours) ||
      !Array.isArray(services) ||
      !Array.isArray(faq)
    ) {
      return res.status(400).json({
        error:
          "name and phoneNumber must be strings; hours must be an object; services and faq must be arrays",
      });
    }

    const business = await prisma.business.upsert({
      where: { phoneNumber },
      update: { name, timezone, hours, services, faq, instructions },
      create: { name, phoneNumber, timezone, hours, services, faq, instructions },
    });

    res.status(201).json(business);
  })
);
