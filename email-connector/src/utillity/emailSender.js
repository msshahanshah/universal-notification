const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');
const sgMail = require('@sendgrid/mail');
const Mailgun = require('mailgun.js');
const formData = require('form-data');


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
        } else {
            throw new Error('No valid email service configuration found');
        }
    }

    async setupAmazonSES() {
        const { USER_NAME,PASSWORD } = this.clientConfig.AWS;
      
        this.transporter= nodemailer.createTransport({
            host: 'email-smtp.us-east-1.amazonaws.com', // or region-specific
            port: 465,
            secure: true, // use TLS
            auth: {
              user: USER_NAME,
              pass: PASSWORD,
            },
          });
        this.provider = 'AmazonSES';
    }

    async setupSendGrid() {
        const { SENDGRID: sgConfig } = this.clientConfig.EMAIL;
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
        const { MAILGUN: mgConfig } = this.clientConfig.EMAIL;
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
        const { GMAIL: gmailConfig } = this.clientConfig.EMAIL;
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

    async sendEmail({ to, subject, text, html, from = "test@gmil.com" }) {
        if (!this.transporter) {
            throw new Error('Email transporter not initialized');
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
            console.log(`Email sent via ${this.provider}:`, result);
            return result;
        } catch (error) {
            console.error(`Error sending email via ${this.provider}:`, error);
            throw error;
        }
    }
}
module.exports={
    EmailSender
}