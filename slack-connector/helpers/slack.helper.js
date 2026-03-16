const { WebClient } = require("@slack/web-api");
const logger = require("../src/logger");
const { loadClientConfigs } = require("../src/utility/loadClientConfigs");
// Map to cache Slack clients per bot token
const slackClients = new Map();

//to store toke of each client
const slackBotTokenMap = new Map();
let clientConfig = null;

async function storeClientConfig() {
  try {
    clientConfig = await loadClientConfigs();
  } catch (err) {
    logger.error({ message: err.message, stack: err.stack });
    throw err;
  }
}
storeClientConfig();

async function getSlackClient(botToken) {
  try {
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
    logger.info(
      `Initializing Slack WebClient. Token snippet: [${tokenSnippet}]`,
    );

    const client = new WebClient(botToken);
    slackClients.set(botToken, client);
    logger.info("Slack WebClient initialized and cached.");
    return client;
  } catch (err) {
    logger.error({ message: err.message, stack: err.stack });
    throw err;
  }
}

//getting username by giving userId of slack bot
async function getUsername(userId, client) {
  try {
    const result = await client.users.info({
      user: userId,
    });
    return result.user.real_name;
  } catch (err) {
    logger.error({ message: err.message, stack: err.stack });
    throw err;
  }
}

//making unique key to indentify workspace + channelId
function getWorkSpaceChannelIdKey(workspaceId, channelId) {
  return workspaceId + "#" + channelId;
}

function getSlackBotToken(clientId) {
  try {
    if (slackBotTokenMap.has(clientId)) {
      return slackBotTokenMap.get(clientId);
    }
    const config = clientConfig.find((item) => item.ID == clientId);
    const token = config?.SLACKBOT?.TOKEN;
    slackBotTokenMap[clientId] = token;
    return token;
  } catch (err) {
    logger.error({ message: err.message, stack: err.stack });
    throw err;
  }
}

async function replaceUserIdWithName(message, client) {
  const regex = /<@([A-Z0-9]+)>/g; // to find user id

  let match;
  let newMessage = message;

  while ((match = regex.exec(message)) !== null) {
    const userId = match[1];
    const username = await getUsername(userId, client);
    newMessage = newMessage.replace(`<@${userId}>`, `@${username}`);
  }

  return newMessage;
}

module.exports = {
  getUsername,
  getSlackClient,
  getWorkSpaceChannelIdKey,
  getSlackBotToken,
  replaceUserIdWithName,
};
