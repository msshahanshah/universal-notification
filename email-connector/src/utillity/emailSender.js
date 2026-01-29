const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const Mailgun = require('mailgun.js');
const logger = require('../logger');
const path = require('path');

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
        'Invalid email configuration:',
        JSON.stringify(this.clientConfig, null, 2),
      );
      throw new Error('No valid email service configuration found');
    }
  }

  async setupAmazonSES() {
    const { USER_NAME, PASSWORD, REGION } = this.clientConfig.AWS;
    const sesHost = `email-smtp.${REGION || 'ap-south-1'}.amazonaws.com`;

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
          console.error('AWS ses mail send failed:');
          throw err;
        }
      },
    };

    this.provider = 'AmazonSES';
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
    this.provider = 'SendGrid';
  }

  async setupMailgun() {
    const { MAILGUN: mgConfig } = this.clientConfig;

    if (!mgConfig?.API_KEY || !mgConfig?.DOMAIN) {
      throw new Error('Mailgun API_KEY or DOMAIN missing');
    }

    const mailgun = new Mailgun(FormData);

    const mg = mailgun.client({
      username: 'api', // always "api" for Mailgun
      key: mgConfig.API_KEY, // api key from client json
      url: 'https://api.mailgun.net', // this is url for US region
    });

    this.transporter = {
      sendMail: async (mailOptions) => {
        const msg = {
          from: mailOptions.from ?? `Vidit <noreply@${mgConfig.DOMAIN}>`,
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text ?? 'Hello Universal Notification',
          html: mailOptions.html ?? '<h1>Hello Universal Notification</h1>',
        };

        try {
          return await mg.messages.create(mgConfig.DOMAIN, msg);
        } catch (err) {
          console.error('Mailgun send failed:', err?.message, err?.details);
          throw err;
        }
      },
    };

    this.provider = 'Mailgun';
  }

  async setupGmail() {
    const { GMAIL: gmailConfig } = this.clientConfig;
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: gmailConfig.EMAIL,
        clientId: gmailConfig.CLIENT_ID,
        clientSecret: gmailConfig.CLIENT_SECRET,
        refreshToken: gmailConfig.REFRESH_TOKEN,
      },
    });
    this.provider = 'Gmail';
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
    this.provider = 'SMTP';
  }

  async sendEmail({
    to,
    subject,
    text,
    html,
    from,
    cc = undefined,
    bcc = undefined,
    attachments = undefined,
  }) {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    if (!from) {
      throw new Error('Sender email (from) is required');
    }

    const mailOptions = {
      from,
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      attachments,
    };

    try {
      if (process.env.NODE_ENV === 'testing') {
        const result = {
          accepted: ['khandelwal7vidit@gmail.com'],
          rejected: [],
          ehlo: ['8BITMIME', 'AUTH PLAIN LOGIN', 'Ok'],
          envelopeTime: 95,
          messageTime: 197,
          messageSize: 365,
          response:
            '250 Ok 0109019c03052734-b7820738-bb36-420f-88ee-f3ca02161911-000000',
          envelope: {
            from: 'imvidit7@gmail.com',
            to: ['khandelwal7vidit@gmail.com'],
          },
          messageId: '<45a87056-a3cc-2120-e7f7-fed8a783d5c5@gmail.com>',
        };
        
        logger.info(`Email.... sent via ${this.provider}`, { to, subject });
        return result;
      } else {
        const result = await this.transporter.sendMail(mailOptions);
        logger.info(`Email sent via ${this.provider}`, { to, subject });
        return result;
      }
    } catch (error) {
      logger.error(`Error sending email via ${this.provider}:`, {
        error: error.message,
        to,
        subject,
      });
      throw error;
    }
  }
}
module.exports = {
  EmailSender,
};
