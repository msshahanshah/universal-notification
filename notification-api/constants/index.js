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
    EMAIL: "email",
    SMS: "sms",
    SLACK: "slack",
    WHATSAPP: "whatsapp",
  },

  SERVICE_PROVIDERS: {
    SMS: ["twilio"],
    EMAIL: ["aws", "mailgun", "sendgrid", "gmail"],
    SLACK: ["slackbot"],
    WHATSAPP: ["twilio"],
  },

  SERVICE_MATCH_KEYS: {
    SMS: ["countryCode"],
    EMAIL: ["domain", "email"],
    SLACK: ["channelId"],
    WHATSAPP: ["countryCode"],
  },
};
