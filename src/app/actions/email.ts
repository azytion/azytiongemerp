'use server';


import { requireSession } from './authz';
import nodemailer from 'nodemailer';
import { getSettings } from './settings';

export interface EmailAttachment {
    filename: string;
    content: string; // Base64 string
    encoding: 'base64';
}

export async function sendEmail(to: string, subject: string, html: string, attachments: EmailAttachment[] = [], isInternal = false) {
    if (!isInternal) {
        await requireSession();
    }
    const settings = await getSettings();

    if (settings.email_notifications !== 'true') {
        console.log('Email notifications are disabled in settings.');
        return { success: false, error: 'Email notifications disabled' };
    }

    // Basic validation
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
        console.error('Missing SMTP configuration');
        return { success: false, error: 'SMTP settings are incomplete. Please configure them in Settings > System.' };
    }

    try {
        const port = parseInt(settings.smtp_port || '587');
        const isSecure = port === 465 ? true : (port === 587 ? false : settings.smtp_secure === 'true');

        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: port,
            secure: isSecure, // true for 465, false for other ports
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Verify connection configuration
        // await transporter.verify(); 

        const info = await transporter.sendMail({
            from: settings.email_from || '"Azytion GemERP" <noreply@azytionapp.com>',
            to,
            subject,
            html,
            attachments: attachments.map(att => ({
                filename: att.filename,
                content: att.content,
                encoding: 'base64'
            }))
        });

        console.log('Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: 'Failed to send email: ' + (error as Error).message };
    }
}
