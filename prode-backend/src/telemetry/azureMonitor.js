let initialized = false;

function initAzureMonitor() {
  const connectionString =
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ||
    process.env.APPINSIGHTS_CONNECTION_STRING;

  if (initialized || !connectionString || process.env.APPLICATIONINSIGHTS_DISABLED === "true") {
    return false;
  }

  const samplingRatio = Number(process.env.APPLICATIONINSIGHTS_SAMPLING_RATIO || 1);

  try {
    const { useAzureMonitor } = require("@azure/monitor-opentelemetry");
    useAzureMonitor({
      azureMonitorExporterOptions: { connectionString },
      samplingRatio,
    });
    initialized = true;
    return true;
  } catch (error) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      event: "telemetry.azure_monitor_init_failed",
      error: error.message,
    }));
    return false;
  }
}

module.exports = { initAzureMonitor };
