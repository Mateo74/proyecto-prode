const { initAzureMonitor } = require("./src/telemetry/azureMonitor");
initAzureMonitor();

const env = require("./src/config/env");
const { createApp } = require("./src/app");
const { startExternalMatchSyncJobs } = require("./src/jobs/externalMatchSync.jobs");
const { startNotificationsJob } = require("./src/jobs/notifications.job");

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Servidor en puerto ${env.PORT}`);
  console.log(`Docs: http://localhost:${env.PORT}/api/docs`);
  startExternalMatchSyncJobs();
  startNotificationsJob();
});
