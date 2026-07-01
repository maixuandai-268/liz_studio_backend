/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private logger = new Logger('MailService');

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async send(user: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Liz Studio" <${process.env.EMAIL_USER}>`,
        to: user,
        subject,
        html,
      });
      this.logger.log(`[MAIL] Sent "${subject}" to ${user}`);
    } catch (err) {
      this.logger.error(`[MAIL] Failed to send to ${user}: ${(err as any).message}`);
    }
  }

  async sendNotification(email: string, title: string, message: string): Promise<void> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0d1b2a;color:#d4e4fa;border-radius:12px;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="https://res.cloudinary.com/daq0rvezd/image/upload/v1782897229/logo_hektqx.jpg" alt="Liz Studio" style="width:60px;height:60px;border-radius:12px;" />
          <h2 style="color:#ffb95f;margin:8px 0 0;">Liz Studio</h2>
        </div>
        <div style="background:#122131;padding:20px;border-radius:8px;border:1px solid #424754;">
          <h3 style="margin:0 0 12px;color:#adc6ff;">${title}</h3>
          <p style="margin:0;line-height:1.6;color:#c2c6d6;">${message}</p>
        </div>
        <p style="text-align:center;margin-top:20px;font-size:12px;color:#8b9dc3;">
          Liz Studio — Studio Management Portal
        </p>
      </div>
    `;
    await this.send(email, `[Liz Studio] ${title}`, html);
  }
}

