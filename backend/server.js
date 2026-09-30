import dns from "node:dns";
import app from "./app.js";
import { env, validateProductionConfig } from "./config/env.js";

dns.setDefaultResultOrder("ipv4first");

try {
  validateProductionConfig();

  const server = app.listen(env.port, () => {
    console.log(`VeriFlow API listening on port ${env.port}`);
  });

  const shutdown = (signal) => {
    server.close(() => {
      console.log(`${signal}: server closed`);
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}