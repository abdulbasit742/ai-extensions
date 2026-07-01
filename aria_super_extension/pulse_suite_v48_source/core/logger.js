// [ARIA] V40 OMNIPOTENCE - Logger
export const Logger = {
  log: (msg, source = "CORE") => {
    console.log(`[${source}] ${msg}`);
  },
  error: (msg, source = "CORE") => {
    console.error(`[${source}] ERROR: ${msg}`);
  }
};
