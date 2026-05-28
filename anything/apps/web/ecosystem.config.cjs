const path = require("node:path");

const cwd = __dirname;

module.exports = {
  apps: [
    {
      name: "anything-web",
      cwd,
      script: path.join(cwd, "scripts", "start-production.js"),
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3000",
      },
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
    },
    {
      name: "anything-worker",
      cwd,
      script: path.join(cwd, "scripts", "schedule-worker.js"),
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        SCHEDULE_WORKER_POLL_MS:
          process.env.SCHEDULE_WORKER_POLL_MS || "15000",
        SCHEDULE_WORKER_LIMIT: process.env.SCHEDULE_WORKER_LIMIT || "5",
      },
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
