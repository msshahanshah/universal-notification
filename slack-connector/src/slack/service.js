const RedisHelper = require("../../helpers/redis.helper");

class SlackService {
  static async getSlackReplyMessage(payload) {
    try {
      const clientId = await RedisHelper.getValue(payload?.team_id);
      const dbConnect = await global.connectionManager.getModels(clientId);
      const SlackReplyMessage = dbConnect.SlackReplyMessage;

      const service = "slack";
      const { event } = payload;

      if (!event?.type) {
        throw { statusCode: 400, message: "Event type is missing" };
      }

      switch (event.type) {
        // APP MENTION

        case "app_mention": {
          const {
            thread_ts: parentReferenceId,
            ts: childReferenceId,
            text: message,
            user: userReferenceId,
          } = event;

          const existingMessage = await SlackReplyMessage.findOne({
            where: {
              parentReferenceId,
              childReferenceId,
              service,
            },
          });

          const content = { message };

          if (existingMessage) {
            await existingMessage.update({ content });
            return {
              success: true,
              message: "Message updated successfully",
            };
          }

          const newReplyedMessage = await SlackReplyMessage.create({
            parentReferenceId,
            childReferenceId,
            userReferenceId,
            content,
            service,
          });
          await newReplyedMessage.save();
          break;
        }

        // REACTION ADDED

        case "reaction_added": {
          const { reaction, user: userReferenceId } = event;
          const { ts: parentReferenceId } = event.item;

          const existingMessage = await SlackReplyMessage.findOne({
            where: {
              parentReferenceId,
              userReferenceId,
              service,
            },
          });

          if (existingMessage) {
            const existingReactions = existingMessage.content?.reaction || [];

            const newReactionArr = [...existingReactions, reaction];

            await existingMessage.update({
              content: { reaction: newReactionArr },
            });

            return {
              success: true,
              message: "Reaction added successfully",
            };
          }

          const newReplyedMessage = await SlackReplyMessage.create({
            parentReferenceId,
            userReferenceId,
            content: { reaction: [reaction] },
            service,
          });

          await newReplyedMessage.save();
          break;
        }

        // REACTION REMOVED

        case "reaction_removed": {
          const { user: userReferenceId, reaction } = event;
          const { ts: parentReferenceId } = event.item;

          const existingMessage = await SlackReplyMessage.findOne({
            where: {
              parentReferenceId,
              userReferenceId,
              service,
            },
          });

          if (!existingMessage) {
            return {
              success: true,
              message: "No existing reaction found",
            };
          }

          const existingReactions = existingMessage.content?.reaction || [];

          const newReactionArr = existingReactions.filter(
            (item) => item !== reaction,
          );

          await existingMessage.update({
            content: { reaction: newReactionArr },
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
      throw {
        statusCode: err?.statusCode || 500,
        message: err?.message || "Internal server error",
      };
    }
  }
}

module.exports = SlackService;
