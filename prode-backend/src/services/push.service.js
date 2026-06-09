const { Expo } = require("expo-server-sdk");
const logger = require("../utils/logger");

const expo = new Expo();

/**
 * Sends a push notification to a single Expo push token.
 * Returns { sent: true } on success.
 * Returns { sent: false, reason: 'expired' } when the token is no longer valid.
 * Returns { sent: false, reason: 'error' } for other failures.
 */
async function sendNotification(token, payload) {
  if (!Expo.isExpoPushToken(token)) {
    logger.warn("push.invalid_token", { token });
    return { sent: false, reason: "invalid-token" };
  }

  const message = {
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sound: "default",
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          const isExpired =
            ticket.details?.error === "DeviceNotRegistered" ||
            ticket.details?.error === "InvalidCredentials";
          if (isExpired) return { sent: false, reason: "expired" };
          logger.warn("push.send_error", { error: ticket.message, details: ticket.details });
          return { sent: false, reason: "error", error: ticket.message };
        }
      }
    }
    return { sent: true };
  } catch (err) {
    logger.warn("push.send_exception", { error: err.message });
    return { sent: false, reason: "error", error: err.message };
  }
}

module.exports = { sendNotification };
