import nodemailer from 'nodemailer';

import type { AppEnv } from '../config/env.js';
import type { Logger } from '../utils/logger.js';
import type { RenderedEmail } from './summary.js';

export async function sendEmail(
  env: AppEnv,
  email: RenderedEmail,
  dryRun: boolean,
  logger: Logger,
): Promise<void> {
  if (dryRun) {
    logger.info('Dry-run email preview', {
      subject: email.subject,
      preview: email.text,
    });
    return;
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: env.EMAIL_TO,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  logger.info('Summary email sent', {
    to: env.EMAIL_TO,
  });
}
