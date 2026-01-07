const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const Mailgun = require('mailgun.js');
const formData = require('form-data');
const logger = require('../logger');


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
            console.error('Invalid email configuration:', JSON.stringify(this.clientConfig, null, 2));
            throw new Error('No valid email service configuration found');
        }
    }

    async setupAmazonSES() {
        const { USER_NAME, PASSWORD, REGION } = this.clientConfig.AWS;
        const sesHost = `email-smtp.${REGION || 'us-east-1'}.amazonaws.com`;

        this.transporter = nodemailer.createTransport({
            host: sesHost,
            port: 465,
            secure: true,
            auth: {
                user: USER_NAME,
                pass: PASSWORD,
            },
        });
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
                    html: mailOptions.html
                };
                return await sgMail.send(msg);
            }
        };
        this.provider = 'SendGrid';
    }

    async setupMailgun() {
        const { MAILGUN: mgConfig } = this.clientConfig;
        const mailgun = new Mailgun(formData);
        const mg = mailgun.client({
            username: 'api',
            key: mgConfig.API_KEY
        });

        this.transporter = {
            sendMail: async (mailOptions) => {
                const msg = {
                    from: mailOptions.from,
                    to: mailOptions.to,
                    subject: mailOptions.subject,
                    text: mailOptions.text,
                    html: mailOptions.html
                };
                return await mg.messages.create(mgConfig.DOMAIN, msg);
            }
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
                refreshToken: gmailConfig.REFRESH_TOKEN
            }
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

    async sendEmail({ to, subject, text, html, from }) {
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
            html
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            logger.info(`Email sent via ${this.provider}`, { to, subject });
            return result;
        } catch (error) {
            logger.error(`Error sending email via ${this.provider}:`, { error: error.message, to, subject });
            throw error;
        }
    }
}
module.exports = {
    EmailSender
}