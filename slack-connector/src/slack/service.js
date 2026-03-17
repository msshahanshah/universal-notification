const RedisHelper = require("../../helpers/redis.helper");
const SlackHelper = require("../../helpers/slack.helper");
const SlackConstant = require("../../constants/index");

async function slackReplyMessage(payload) {
  try {
    const { event, team_id: workspaceId } = payload;
    //getting clientId by workspaceId
    const clientId = await RedisHelper.getValue(workspaceId);
    const slackBothToken = SlackHelper.getSlackBotToken(clientId);

    const dbConnect = await global.connectionManager.getModels(clientId);
    const SlackReplyMessage = dbConnect.SlackReplyMessage;
    const client = await SlackHelper.getSlackClient(slackBothToken);
    const service = SlackConstant.SERVICE_NAME; //slack service

    if (!event?.type) {
      throw { statusCode: 400, message: "Event type is missing" };
    }

    switch (event.type) {
      // APP MENTION

      //if messages is replyed by mentioning bot
      case "app_mention": {
        const {
          thread_ts: parentReferenceId,
          ts: childReferenceId,
          text,
          user: userReferenceId,
          channel: channelId,
        } = event;

        const message = await SlackHelper.replaceUserIdWithName(text, client);

        //get unique worspace + chnnelId key
        const workspaceChannelKey = SlackHelper.getWorkSpaceChannelIdKey(
          workspaceId,
          channelId,
        );

        //get username by giving slack user bot id
        const userReferenceName = await SlackHelper.getUsername(
          userReferenceId,
          client,
        );

        const existingMessage = await SlackReplyMessage.findOne({
          where: {
            parentReferenceId,
            childReferenceId,
            service,
            workspaceChannelKey,
          },
        });

        const content = {
          message,
          reaction: [],
        };

        if (existingMessage) {
          content.reaction = existingMessage.content?.reaction || [];
          await existingMessage.update({ content });
          return {
            success: true,
            message: "Message updated successfully",
          };
        }

        //creating new record for replyed message
        const newReplyedMessage = await SlackReplyMessage.create({
          parentReferenceId,
          childReferenceId,
          userReferenceId,
          userReferenceName,
          content,
          service,
          workspaceChannelKey,
        });
        await newReplyedMessage.save();
        break;
      }

      // if reactions is added

      case "reaction_added": {
        const { reaction, user: userReferenceId } = event;
        const { ts: childReferenceId, channel: channelId } = event.item;

        const workspaceChannelKey = SlackHelper.getWorkSpaceChannelIdKey(
          workspaceId,
          channelId,
        );
        const userReferenceName = await SlackHelper.getUsername(
          userReferenceId,
          client,
        );
        const result = await SlackReplyMessage.findOne({
          where: { childReferenceId },
        });

        // if result is null it means this is parent id not chile id is present
        // if not null then childReferenceId will be parentReferenceId

        const parentReferenceId = result
          ? result.parentReferenceId
          : childReferenceId;

        const existingMessage = await SlackReplyMessage.findOne({
          where: {
            parentReferenceId,
            userReferenceId, // refernce id can be same
            service,
            childReferenceId,
            workspaceChannelKey,
          },
        });

        // if reaction is already added then add new reactions
        if (existingMessage) {
          const existingReactions = existingMessage.content?.reaction || [];
          const message = existingMessage.content?.message || "";

          const newReactionArr = [...existingReactions, reaction];

          await existingMessage.update({
            content: { reaction: newReactionArr, message },
          });

          return {
            success: true,
            message: "Reaction added successfully",
          };
        }

        //creating new records
        const newReplyedMessage = await SlackReplyMessage.create({
          parentReferenceId,
          userReferenceId,
          userReferenceName,
          childReferenceId,
          content: { reaction: [reaction], message: "" },
          service,
          workspaceChannelKey,
        });

        await newReplyedMessage.save();
        break;
      }

      // if reaction is removed

      case "reaction_removed": {
        const { user: userReferenceId, reaction } = event;
        const { ts: childReferenceId, channel: channelId } = event.item;
        const workspaceChannelKey = SlackHelper.getWorkSpaceChannelIdKey(
          workspaceId,
          channelId,
        );
        const result = await SlackReplyMessage.findOne({
          where: { childReferenceId },
        });

        // if result is null it means this is parent id not chile id
        // if not null then childReferenceId wil be parentReferenceId
        const parentReferenceId = result
          ? result.parentReferenceId
          : childReferenceId;

        const existingMessage = await SlackReplyMessage.findOne({
          where: {
            parentReferenceId,
            userReferenceId,
            childReferenceId,
            service,
            workspaceChannelKey,
          },
        });

        if (!existingMessage) {
          return {
            success: true,
            message: "No existing reaction found",
          };
        }

        const existingReactions = existingMessage.content?.reaction || [];
        const message = existingMessage.content?.message || "";

        const newReactionArr = existingReactions.filter(
          (item) => item !== reaction,
        );

        await existingMessage.update({
          content: { reaction: newReactionArr, message },
        });

        return {
          success: true,
          message: "Reaction removed successfully",
        };
      }

      default:
        throw { statusCode: 400, message: "Invalid event type" };
    }

    return {
      success: true,
      message: "Operation performed successfully",
    };
  } catch (err) {
    console.log(err.message, "error");
    throw {
      statusCode: err?.statusCode || 500,
      message: err?.message || "Internal server error",
    };
  }
}

module.exports = { slackReplyMessage };
