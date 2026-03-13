module.exports = {
  AUTH_TOKEN: {
    ACCESS_TOKEN: "accessToken",
    REFRESH_TOKEN: "refreshToken",
  },

  LOG_TYPE: {
    SLACK_LOGS: "slack-logs",
    COMMON_LOGS: "common-logs",
  },

  SERVICES: {
    SLACK_SERVICE: "slack",
  },

  SERVICE_PROVIDERS: {
    SMS: ["twilio"],
    EMAIL: ["aws", "mailgun", "sendgrid", "gmail"],
    SLACK: ["slackbot"],
    WHATSAPP: ["twilio"],
  },
};
