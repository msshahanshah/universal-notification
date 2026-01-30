const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const Mailgun = require("mailgun.js");
const logger = require("../logger");
const path = require("path");
const {
  deleteLocalFiles,
} = require("../../../notification-api/helpers/fileOperation.helper");

// Email service configuration
class EmailSender {
  constructor(clientConfig) {
    this.clientConfig = clientConfig;
    this.transporter = null;
    this.provider = null;
  }

  async initialize() {
    // Determine which email service to use (default to AWS SES if configured)
    if (this.clientConfig?.AWS?.USER_NAME) {
      await this.setupAmazonSES();
    } else if (this.clientConfig?.SENDGRID?.API_KEY) {
      await this.setupSendGrid();
    } else if (this.clientConfig?.MAILGUN?.API_KEY) {
      await this.setupMailgun();
    } else if (this.clientConfig?.GMAIL?.CLIENT_ID) {
      await this.setupGmail();
    } else if (this.clientConfig?.HOST && this.clientConfig?.PORT) {
      await this.setupSMTP();
    } else {
      console.error(
        "Invalid email configuration:",
        JSON.stringify(this.clientConfig, null, 2),
      );
      throw new Error("No valid email service configuration found");
    }
  }

  async setupAmazonSES() {
    const { USER_NAME, PASSWORD, REGION } = this.clientConfig.AWS;
    const sesHost = `email-smtp.${REGION || "ap-south-1"}.amazonaws.com`;

    const awsTransporter = nodemailer.createTransport({
      host: sesHost,
      port: 465,
      secure: true,
      auth: {
        user: USER_NAME,
        pass: PASSWORD,
      },
    });

    // Standardize the interface so it matches SendGrid/Mailgun
    this.transporter = {
      sendMail: async (mailOptions) => {
        const info = {
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html,
          cc: mailOptions.cc,
          bcc: mailOptions.bcc,
          attachments: mailOptions.attachments,
        };
        try {
          return awsTransporter.sendMail(info);
        } catch (err) {
          console.error("AWS ses mail send failed:");
          throw err;
        }
      },
    };

    this.provider = "AmazonSES";
  }

  async setupSendGrid() {
    const { SENDGRID: sgConfig } = this.clientConfig;
    sgMail.setApiKey(sgConfig.API_KEY);
    this.transporter = {
      sendMail: async (mailOptions) => {
        const msg = {
          to: mailOptions.to,
          from: mailOptions.from,
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html,
        };
        return await sgMail.send(msg);
      },
    };
    this.provider = "SendGrid";
  }

  async setupMailgun() {
    const { MAILGUN: mgConfig } = this.clientConfig;

    if (!mgConfig?.API_KEY || !mgConfig?.DOMAIN) {
      throw new Error("Mailgun API_KEY or DOMAIN missing");
    }

    const mailgun = new Mailgun(FormData);

    const mg = mailgun.client({
      username: "api", // always "api" for Mailgun
      key: mgConfig.API_KEY, // api key from client json
      url: "https://api.mailgun.net", // this is url for US region
    });

    this.transporter = {
      sendMail: async (mailOptions) => {
        const msg = {
          from: mailOptions.from ?? `Vidit <noreply@${mgConfig.DOMAIN}>`,
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text ?? "Hello Universal Notification",
          html: mailOptions.html ?? "<h1>Hello Universal Notification</h1>",
        };

        try {
          return await mg.messages.create(mgConfig.DOMAIN, msg);
        } catch (err) {
          console.error("Mailgun send failed:", err?.message, err?.details);
          throw err;
        }
      },
    };

    this.provider = "Mailgun";
  }

  async setupGmail() {
    const { GMAIL: gmailConfig } = this.clientConfig;
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: gmailConfig.EMAIL,
        clientId: gmailConfig.CLIENT_ID,
        clientSecret: gmailConfig.CLIENT_SECRET,
        refreshToken: gmailConfig.REFRESH_TOKEN,
      },
    });
    this.provider = "Gmail";
  }

  async setupSMTP() {
    const { HOST, PORT, USER, PASSWORD, SECURE } = this.clientConfig;
    this.transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE || false, // default to false if not specified
      auth: {
        user: USER,
        pass: PASSWORD,
      },
    });
    this.provider = "SMTP";
  }

  async sendEmail({
    to,
    subject,
    text,
    html,
    from,
    cc = undefined,
    bcc = undefined,
    attachments,
  }) {
    if (!this.transporter) {
      throw new Error("Email transporter not initialized");
    }

    if (!from) {
      throw new Error("Sender email (from) is required");
    }

    let dir;
    if (attachments?.length) {
      dir = attachments.map((s3Url) => {
        // 1. Remove ?1/ safely
        const cleanUrl = s3Url.replace(/\?.*?\//, "/");

        // 2. Extract relative path after /uploads/
        const relativePath = cleanUrl.split("/uploads/")[1];

        // 3. Build local file path
        const localPath = path.resolve(
          __dirname,
          "..",
          "uploads",
          relativePath,
        );

        return { path: localPath };
      });
    }

    const mailOptions = {
      from,
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      attachments: attachments?.length ? dir : undefined,
    };

    if (attachments) {
      logger.info(`Email send with attachments...picking path`);
    }

    try {
      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent via ${this.provider}`, { to, subject });
      if (attachments) {
        logger.info(
          `Email sent successfully with attachements, picking local path,`,
        );
        logger.info(`Local file deleted successfully, picking local path`);
      }
      return result;
    } catch (error) {
      logger.error(`Error sending email via ${this.provider}:`, {
        error: error.message,
        to,
        subject,
      });
      throw error;
    } finally {
      deleteLocalFiles(attachments);
    }
  }
}
module.exports = {
  EmailSender,
};
