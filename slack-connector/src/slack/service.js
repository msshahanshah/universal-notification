const { where } = require("sequelize");
const RedisHelper = require("../../helpers/redis.helper");

class SlackService {
  static async getSlackReplyMessage(payload) {
    try {
      const clientId = await RedisHelper.getValue(payload?.team_id);

      const dbConnect = await global.connectionManager.getModels(clientId);
      const ThreadReplyMessage = dbConnect.ThreadReplyMessage;
      const ThreadReplyReaction = dbConnect.ThreadReplyReaction;

      const { event } = payload;

      switch (event.type) {
        case "app_mention": {
          try {
            const {
              thread_ts: parentThreadId,
              ts: childThreadId,
              text: message,
              user: userId,
            } = event;

            // Check if replyed is already exist
            const existingMessageRecord = await ThreadReplyMessage.findOne({
              where: {
                parentThreadId,
                childThreadId,
              },
            });

            // then update existing repled message
            if (existingMessageRecord) {
              await ThreadReplyMessage.update(
                { message: message },
                {
                  where: { childThreadId },
                },
              );

              return;
            }

            //Add new replyed message
            const newReplyedMessageRecord = await ThreadReplyMessage.create({
              parentThreadId,
              childThreadId,
              userId,
              message,
            });

            await newReplyedMessageRecord.save();
            break;
          } catch (err) {
            throw err;
          }
        }

        case "reaction_added": {
          try {
            const { reaction, user: userId } = event;
            const { ts: threadId } = event.item;
            let reactionsArr = [];

            const existingReactionRecord = await ThreadReplyReaction.findOne({
              where: {
                threadId,
                userId,
              },
            });

            if (existingReactionRecord) {
              const newArr = [...existingReactionRecord.message, reaction];

              await ThreadReplyReaction.update(
                {
                  message: newArr,
                },
                {
                  where: {
                    threadId,
                    userId,
                  },
                },
              );

              return;
            }

            //create new replyed reaction record
            reactionsArr.push(reaction);
            const newReactionRecord = await ThreadReplyReaction.create({
              threadId,
              userId,
              message: reactionsArr,
            });
            await newReactionRecord.save();
            break;
          } catch (err) {
            throw err;
          }
        }
        case "reaction_removed": {
          try {
            const { user: userId, reaction } = event;
            const { ts: threadId } = event.item;
            const existingReactionRecord = await ThreadReplyReaction.findOne({
              where: {
                threadId,
                userId,
              },
            });
            if (existingReactionRecord) {
              //removing the reaction and taking new array
              const newReactionArr = existingReactionRecord.message.filter(
                (item) => item != reaction,
              );

              await ThreadReplyReaction.update(
                {
                  message: newReactionArr,
                },
                {
                  where: {
                    threadId,
                    userId,
                  },
                },
              );
            }
            break;
          } catch (err) {
            throw err;
          }
        }

        default:
          throw { statusCode: 400, message: "Event type is wrong" };
      }

      return {
        success: true,
        message: "Successfully Operation Performed",
      };
    } catch (err) {
      console.log(err.message);
      err.statusCode = err?.statusCode || 500;
      err.message = err?.message || "Internal server error";
      throw err;
    }
  }
}

module.exports = SlackService;
