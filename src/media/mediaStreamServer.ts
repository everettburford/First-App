import { Server as HttpServer } from "http";
import { WebSocketServer } from "ws";
import { CallSession } from "../call/CallSession";
import { logger } from "../utils/logger";

const MEDIA_STREAM_PATH = "/media-stream";

/** Wires up the Twilio Media Streams WebSocket endpoint on the given HTTP server. */
export function attachMediaStreamServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws) => {
    logger.info("Media stream WebSocket connected");
    new CallSession(ws);
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== MEDIA_STREAM_PATH) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });
}
