// ./slack-connector/src/slackSender.js
const { WebClient } = require('@slack/web-api');
const config = require('./config');
const logger = require('./logger');

let slackClient = null;

function getSlackClient(botToken) {
    if (!slackClient) {
        const tokenFromConfig =botToken  // Get token from config

        // --- TEMPORARY DEBUG LOGGING ---
        // Log only a portion to avoid exposing the full token in logs
        const tokenSnippet = tokenFromConfig ? `${tokenFromConfig.substring(0, 10)}...${tokenFromConfig.substring(tokenFromConfig.length - 4)}` : 'TOKEN NOT FOUND/LOADED';
        logger.info(`Initializing Slack WebClient. Token snippet from config: [${tokenSnippet}]`);
        // --------------------------------

        if (!botToken) {
            logger.error('Slack Bot Token (SLACK_BOT_TOKEN) is not configured!');
            throw new Error('Missing Slack configuration: Bot Token');
        }
        slackClient = new WebClient(botToken);
         logger.info('Slack WebClient initialized.');
    }
    return slackClient;
}

async function sendSlackMessage(authToken,channel, message, messageId) {
    const client = getSlackClient(authToken); // Get initialized client

    logger.debug(`Attempting to send message to Slack channel: ${channel}`, { messageId });

    try {
        const result = await client.chat.postMessage({
            channel: channel, // Slack channel ID or name (ID preferred)
            text: message,
            // blocks: [] // Optional: Use Slack Block Kit for richer messages
        });

        // Check success from Slack API response
        if (result.ok) {
            logger.info(`Message sent successfully to Slack channel: ${channel}`, { messageId, slackMessageTs: result.ts });
            return { success: true, response: result }; // Return success and the full response
        } else {
            // This path might not be hit often if errors throw exceptions, but handle defensively
            logger.error(`Slack API indicated failure, but no exception was thrown.`, { messageId, channel, error: result.error, response: result });
            return { success: false, error: `Slack API error: ${result.error || 'Unknown error'}`, response: result };
        }
    } catch (error) {
        logger.error(`Error sending message to Slack via API`, {
             messageId,
             channel,
             errorCode: error.code, // e.g., 'slack_error_code'
             errorMessage: error.message,
             // errorData: error.data, // Contains detailed error info from Slack API
             slackErrorCode: error.data?.error, // Specific slack error like 'channel_not_found'
             stack: error.stack
        });

        // Rethrow a structured error or return failure info
        // Include specific Slack error if available (e.g., channel_not_found, invalid_auth)
        const errorMessage = `Slack API Error: ${error.data?.error || error.message}`;
        return { success: false, error: errorMessage, rawError: error }; // Return failure and the original error
    }
}

module.exports = { sendSlackMessage };