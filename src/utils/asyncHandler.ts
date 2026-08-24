import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express route handler so a rejected promise is forwarded
 * to `next(err)` instead of becoming an unhandled rejection. Express 4
 * doesn't do this automatically, and an unhandled rejection crashes the
 * whole Node process by default — which would drop every in-progress call.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
