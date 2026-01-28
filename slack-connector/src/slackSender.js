// ./slack-connector/src/slackSender.js
const { WebClient } = require("@slack/web-api");
const config = require("./config");
const logger = require("./logger");
// Map to cache Slack clients per bot token
const slackClients = new Map();

function getSlackClient(botToken) {
  if (!botToken) {
    logger.error("Slack Bot Token is not provided!");
    throw new Error("Missing Slack configuration: Bot Token");
  }

  // Check if we already have a client for this token
  if (slackClients.has(botToken)) {
    return slackClients.get(botToken);
  }

  // Log only a portion to avoid exposing the full token in logs
  const tokenSnippet = `${botToken.substring(0, 10)}...${botToken.substring(botToken.length - 4)}`;
  logger.info(`Initializing Slack WebClient. Token snippet: [${tokenSnippet}]`);

  const client = new WebClient(botToken);
  slackClients.set(botToken, client);
  logger.info("Slack WebClient initialized and cached.");

  return client;
}

async function sendSlackMessage(authToken, channel, message, messageId) {
  const client = getSlackClient(authToken); // Get initialized client

  logger.debug(`Attempting to send message to Slack channel: ${channel}`, {
    messageId,
  });

  try {
    if (process.env.NODE_ENV === "testing") {
      const result = {
        ok: true,
        channel: "C0AAQJRGF6K",
        ts: "1769585676.071389",
        message: {
          user: "U08LH6S3667",
          type: "message",
          ts: "1769585676.071389",
          bot_id: "B08LH6S1D0T",
          app_id: "A08M2U89YCQ",
          text: "Test",
          team: "T0XMQFKA8",
          bot_profile: {
            id: "B08LH6S1D0T",
            app_id: "A08M2U89YCQ",
            user_id: "U08LH6S3667",
            name: "universal-notification",
            icons: [Object],
            deleted: false,
            updated: 1743597891,
            team_id: "T0XMQFKA8",
          },
          blocks: [[Object]],
        },
        response_metadata: {
          scopes: ["chat:write"],
          acceptedScopes: ["chat:write"],
        },
      };
      if (result.ok) {
        logger.info(`Message sent successfully to Slack channel: ${channel}`, {
          messageId,
          slackMessageTs: result.ts,
        });
        return { success: true, response: result };
      }
    } else {
      const result = await client.chat.postMessage({
        channel: channel, // Slack channel ID or name (ID preferred)
        text: message,
        // blocks: [] // Optional: Use Slack Block Kit for richer messages
      });
      // Check success from Slack API response
      if (result.ok) {
        logger.info(`Message sent successfully to Slack channel: ${channel}`, {
          messageId,
          slackMessageTs: result.ts,
        });
        return { success: true, response: result }; // Return success and the full response
      } else {
        // This path might not be hit often if errors throw exceptions, but handle defensively
        logger.error(
          `Slack API indicated failure, but no exception was thrown.`,
          { messageId, channel, error: result.error, response: result },
        );
        return {
          success: false,
          error: `Slack API error: ${result.error || "Unknown error"}`,
          response: result,
        };
      }
    }
  } catch (error) {
    logger.error(`Error sending message to Slack via API`, {
      messageId,
      channel,
      errorCode: error.code, // e.g., 'slack_error_code'
      errorMessage: error.message,
      // errorData: error.data, // Contains detailed error info from Slack API
      slackErrorCode: error.data?.error, // Specific slack error like 'channel_not_found'
      stack: error.stack,
    });

    // Rethrow a structured error or return failure info
    // Include specific Slack error if available (e.g., channel_not_found, invalid_auth)
    const errorMessage = `Slack API Error: ${error.data?.error || error.message}`;
    return { success: false, error: errorMessage, rawError: error }; // Return failure and the original error
  }
}

module.exports = { sendSlackMessage };
