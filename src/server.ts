import { createApp } from "./app";
import { attachMediaStreamServer } from "./media/mediaStreamServer";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const app = createApp();
const server = app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`);
});

attachMediaStreamServer(server);
