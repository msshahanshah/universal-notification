const WebhookConfig = require("../models/webhook");
const { encrypt, generateSalt, decrypt } = require("../utils/cryptoUtil");
const { consumeNotification } = require("../services/webhook.service");
const { buildSettings } = require("../helpers/webhook.helper");
const rabbitManager = require("../utils/manager");
const { mongooseInstance } = require("../helpers/mongoose.helper");

async function webhookRoutes(fastify, options) {
  fastify.post("/trigger", async (request, reply) => {
    // for Bearer token
    try {
      const { clientId, status, service } = request.body;
      await consumeNotification({
        clientId,
        status,
        service,
      });
      // const rabbitClient = await rabbitManager.getClient(clientId);
      //       await rabbitClient.consume({
      //         service,
      //         sender: async (payload, messageId) => {
      //           console.log("||||||||||||||")
      //           // if (process.env.NODE_ENV === "testing") {
      //           //   const message = await database.Notification.findOne({
      //           //     where: { messageId: messageId },
      //           //   });

      //           //   if (!message) {
      //           //     logger.error("Message not found for messageId : " + messageId);
      //           //     return;
      //           //   }
      //           //   await database.Notification.update(
      //           //     { status: "sent" },
      //           //     { where: { messageId: messageId } },
      //           //   );
      //           // }
      //           await consumeNotification({
      //             client_id,
      //             status,
      //             service,
      //           });
      //         },
      //         // db: database,
      //         db: mongooseInstance,
      //         maxProcessAttemptCount: 3,
      //       });

      return reply.send({
        success: true,
        message: "Webhook trigger processed",
      });
    } catch (err) {
      console.log(err);
      console.error("Error consuming notification:", err.message);

      return reply.code(400).send({
        success: false,
        error: err.message,
      });
    }
  });

  const SERVICES = ["sms", "email", "slack"];

  fastify.patch("/:webhookId", async (request, reply) => {
    try {
      const { webhookId } = request.params;
      const clientId = request.headers["x-client-id"];
      const {
        webhookUrl,
        serviceTrigger,
        apiKey,
        retryEnabled,
        retryCount,
        isActive,
      } = request.body;

      if (!webhookId) {
        return reply.code(404).send({
          success: false,
          error: "Webhook Id not found",
        });
      }
      if (!clientId) {
        return reply.code(404).send({
          success: false,
          error: "Client Id not found",
        });
      }

      const existingConfig = await WebhookConfig.findOne({
        _id: webhookId,
      });

      if (!existingConfig) {
        return reply.code(404).send({
          success: false,
          error: "Webhook config not found",
        });
      }

      const updatePayload = {};

      // webhook url update
      if (webhookUrl) {
        if (!webhookUrl.startsWith("https://")) {
          return reply.code(400).send({
            success: false,
            error: "Webhook must be HTTPS",
          });
        }

        updatePayload.webhookUrl = webhookUrl;
      }

      // api key encryption
      if (apiKey) {
        const clientIdSalt = generateSalt(clientId);
        const encryptedApiKey = encrypt(apiKey, clientIdSalt);

        updatePayload.encryptedKey = encryptedApiKey;
      }

      // recompute settings if serviceTrigger is sent
      if (serviceTrigger && typeof serviceTrigger === "object") {
        const settings = {};
        const finalServiceTrigger = {};

        SERVICES.forEach((service) => {
          const arr = Array.isArray(serviceTrigger[service])
            ? serviceTrigger[service]
            : [];

          if (arr.length > 0) {
            finalServiceTrigger[service] = arr;
            settings[service] = true;
          } else {
            settings[service] = false;
          }
        });

        updatePayload.service_trigger = finalServiceTrigger;
        updatePayload.settings = settings;
      }

      const { settings, finalServiceTrigger } = buildSettings(serviceTrigger);

      // updatePayload.settings = settings;
      updatePayload.serviceTrigger = finalServiceTrigger;
      if (retryEnabled == false || retryEnabled == true) {
        console.log("retryEnabled", retryEnabled);
        updatePayload.retryEnabled = retryEnabled;
      }
      if (retryCount !== undefined) {
        updatePayload.retryCount = retryCount;
      }
      if (isActive == false || isActive == true) {
        updatePayload.isActive = isActive;
      }

      const updatedConfig = await WebhookConfig.findOneAndUpdate(
        { clientId },
        { $set: updatePayload },
        { new: true, runValidators: true },
      );

      return reply.send({
        success: true,
        message: "Webhook config updated",
        data: updatedConfig,
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  fastify.post("/config", async (request, reply) => {
    const SERVICES = ["sms", "email", "slack"];
    const { clientId, webhookUrl, serviceTrigger, apiKey } = request.body;

    if (!clientId) {
      return reply
        .code(400)
        .send({ success: false, error: "client Id is missing" });
    }

    if (!webhookUrl) {
      return reply
        .code(400)
        .send({ success: false, error: "Webhook URL is missing" });
    }

    if (!webhookUrl.startsWith("https://")) {
      return reply
        .code(400)
        .send({ success: false, error: "Webhook must be HTTPS" });
    }

    if (!apiKey) {
      return reply
        .code(400)
        .send({ success: false, error: "API Key is missing" });
    }

    const clientIdSalt = generateSalt(clientId);
    const encryptedApiKey = encrypt(apiKey, clientIdSalt);

    const settings = {};
    const triggers = serviceTrigger || {};

    const finalServiceTrigger = {};

    SERVICES.forEach((service) => {
      const arr = Array.isArray(triggers[service]) ? triggers[service] : [];

      if (arr.length > 0) {
        finalServiceTrigger[service] = arr;
        settings[service] = true;
      } else {
        settings[service] = false;
      }
    });

    const updatePayload = {
      clientId,
      webhookUrl,
      encryptedKey: encryptedApiKey,
      serviceTrigger: finalServiceTrigger,
      settings,
    };

    const config = await WebhookConfig.findOneAndUpdate(
      { clientId },
      updatePayload,
      { upsert: true, new: true },
    );

    // TODO: GRPC code dependent on notification service proto

    // await new Promise((resolve, reject) => {
    //   client.UpdateWebhookConfig(
    //     {
    //       client_id,
    //       enabled_services, // must match proto (map<string,bool>)
    //     },
    //     (err, response) => {
    //       if (err) {
    //         console.error("gRPC Error:", err.message);
    //         return reject(err);
    //       }

    //       console.log("Notification API synced:", response.message);
    //       resolve(response);
    //     },
    //   );
    // });

    return reply.send({
      success: true,
      message: "Saved webhook config successfully",
      data: config,
    });
  });

  // Delete webhook config by webhook ID
  fastify.delete("/:webhookId", async (request, reply) => {
    try {
      const { webhookId } = request.params;
      console.log("webhookId", webhookId);

      if (!webhookId) {
        return reply.code(400).send({
          success: false,
          error: "Webhook ID is required",
        });
      }

      const deletedConfig = await WebhookConfig.findOneAndDelete({
        _id: webhookId,
      });

      if (!deletedConfig) {
        return reply.code(404).send({
          success: false,
          error: "Webhook config not found",
        });
      }

      return reply.send({
        success: true,
        message: "Webhook config deleted successfully",
        data: deletedConfig,
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  // Fetch all or any client configs
  fastify.get("/configs", async (request, reply) => {
    const clientId = request.headers["x-client-id"];
    const filter = {};

    console.log("clientId..", clientId);

    if (clientId) {
      filter.clientId = clientId;
      const configs = await WebhookConfig.findOne(filter);

      if (configs) {
        const salt = configs?.clientId + process.env.MASTER_ENCRYPTION_KEY;
        const decryptedApiKey = decrypt(configs.encryptedKey, salt);
        console.log("decryptedApiKey", decryptedApiKey);
        return reply.send({
          success: true,
          data: [
            {
              id: configs?._id,
              client: configs?.clientId,
              webhookUrl: configs?.webhookUrl,
              serviceTrigger: configs?.serviceTrigger,
              apiKey: decryptedApiKey,
              isActive: configs?.isActive,
              retryEnabled: configs?.retryEnabled,
              retryCount: configs?.retryCount,
            },
          ],
          message: "Webhook configuration fetched successfully",
        });
      }

      return reply.send({
        success: true,
        message: "Webhook configuration not found for clientId: " + clientId,
      });
    }
    return reply
      .code(400)
      .send({ success: false, error: "client Id is missing" });
  });
}

module.exports = webhookRoutes;
