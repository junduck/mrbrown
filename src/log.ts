import pino from "pino";

let logger: pino.Logger | null = null;

export const getLogger = () => {
  if (!logger) {
    logger = pino({
      level: process.env["MRBROWN_LOG_LEVEL"] ?? "warn",
    });
  }
  return logger;
};
