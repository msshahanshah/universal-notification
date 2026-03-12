require("dotenv").config();

const fastify = require("fastify")({ logger: true });
const mongoose = require("mongoose");

const webhookRoutes = require("./routes/webhookRoutes");
const {connectMongoose} = require('./helpers/mongoose.helper')

/**
 * ✅ Enable CORS
 */
fastify.register(require("@fastify/cors"), {
  origin: true, // allow all origins (POC)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
});

fastify.register(webhookRoutes, { prefix: "/api/webhook" });

const start = async () => {
  try {
    await connectMongoose();
    await fastify.listen({ port: 3000 });
    console.log("Server running on port 3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
