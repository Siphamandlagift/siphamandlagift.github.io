import nodemailer from 'nodemailer';

type PasswordResetEmailInput = {
  to: string;
  username: string;
  resetUrl: string;
  expiresAt: string;
};

type CourseAssignedEmailInput = {
  to: string;
  studentName: string;
  offeringTitle: string;
  deadline: string;
  appUrl: string;
};

type TrainingRequestEmailInput = {
  to: string;
  managerName: string;
  studentName: string;
  courseName: string;
  provider: string;
  trainingType: string;
  startDate: string;
  endDate: string;
  cost: string;
  appUrl: string;
};

export class PasswordResetEmailService {
  private readonly appName = (process.env['LMS_APP_NAME'] || 'SkillsConnect LMS').trim();
  private readonly mailFrom = process.env['LMS_SMTP_FROM']?.trim();
  private transporter = this.createTransporter();

  private createTransporter() {
    const host = process.env['LMS_SMTP_HOST']?.trim();
    const port = Number((process.env['LMS_SMTP_PORT'] || '587').trim());
    const user = process.env['LMS_SMTP_USER']?.trim();
    const pass = process.env['LMS_SMTP_PASS']?.trim();

    if (!host || !user || !pass || !this.mailFrom) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: (process.env['LMS_SMTP_SECURE'] || 'false').trim().toLowerCase() === 'true',
      requireTLS: true,
      auth: {
        user,
        pass,
      },
    });
  }

  isConfigured() {
    return this.transporter !== null;
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput) {
    if (!this.transporter || !this.mailFrom) {
      throw new Error('SMTP is not configured. Set LMS_SMTP_HOST, LMS_SMTP_PORT, LMS_SMTP_SECURE, LMS_SMTP_USER, LMS_SMTP_PASS, and LMS_SMTP_FROM.');
    }

    await this.transporter.sendMail({
      from: this.mailFrom,
      to: input.to,
      subject: `${this.appName} password reset`,
      text: [
        `Hello ${input.username},`,
        '',
        'We received a request to reset your LMS password.',
        `Open this link to choose a new password: ${input.resetUrl}`,
        `This link expires at ${input.expiresAt}.`,
        '',
        'If you did not request this change, you can ignore this email.',
      ].join('\n'),
      html: `
        <p>Hello ${escapeHtml(input.username)},</p>
        <p>We received a request to reset your LMS password.</p>
        <p><a href="${escapeAttribute(input.resetUrl)}">Choose a new password</a></p>
        <p>This link expires at ${escapeHtml(input.expiresAt)}.</p>
        <p>If you did not request this change, you can ignore this email.</p>
      `,
    });
  }

  async sendCourseAssignedEmail(input: CourseAssignedEmailInput) {
    if (!this.transporter || !this.mailFrom) return;

    await this.transporter.sendMail({
      from: this.mailFrom,
      to: input.to,
      subject: `${this.appName}: New course assigned — ${input.offeringTitle}`,
      text: [
        `Hello ${input.studentName},`,
        '',
        `You have been assigned a new course: ${input.offeringTitle}.`,
        `Please complete it by ${input.deadline}.`,
        '',
        `Log in to get started: ${input.appUrl}`,
      ].join('\n'),
      html: `
        <p>Hello ${escapeHtml(input.studentName)},</p>
        <p>You have been assigned a new course: <strong>${escapeHtml(input.offeringTitle)}</strong>.</p>
        <p>Please complete it by <strong>${escapeHtml(input.deadline)}</strong>.</p>
        <p><a href="${escapeAttribute(input.appUrl)}">Log in to get started</a></p>
      `,
    });
  }

  async sendTrainingRequestEmail(input: TrainingRequestEmailInput) {
    if (!this.transporter || !this.mailFrom) return;

    await this.transporter.sendMail({
      from: this.mailFrom,
      to: input.to,
      subject: `${this.appName}: Training request from ${input.studentName} — ${input.courseName}`,
      text: [
        `Hello ${input.managerName},`,
        '',
        `${input.studentName} has submitted an external training request that requires your review.`,
        '',
        `Course: ${input.courseName}`,
        `Provider: ${input.provider}`,
        `Type: ${input.trainingType}`,
        `Dates: ${input.startDate} to ${input.endDate}`,
        `Cost: ${input.cost}`,
        '',
        `Log in to review the request: ${input.appUrl}`,
      ].join('\n'),
      html: `
        <p>Hello ${escapeHtml(input.managerName)},</p>
        <p>${escapeHtml(input.studentName)} has submitted an external training request that requires your review.</p>
        <table style="border-collapse:collapse;margin:1rem 0;">
          <tr><td style="padding:0.3rem 0.75rem 0.3rem 0;color:#64748b;">Course</td><td><strong>${escapeHtml(input.courseName)}</strong></td></tr>
          <tr><td style="padding:0.3rem 0.75rem 0.3rem 0;color:#64748b;">Provider</td><td>${escapeHtml(input.provider)}</td></tr>
          <tr><td style="padding:0.3rem 0.75rem 0.3rem 0;color:#64748b;">Type</td><td>${escapeHtml(input.trainingType)}</td></tr>
          <tr><td style="padding:0.3rem 0.75rem 0.3rem 0;color:#64748b;">Dates</td><td>${escapeHtml(input.startDate)} to ${escapeHtml(input.endDate)}</td></tr>
          <tr><td style="padding:0.3rem 0.75rem 0.3rem 0;color:#64748b;">Cost</td><td>${escapeHtml(input.cost)}</td></tr>
        </table>
        <p><a href="${escapeAttribute(input.appUrl)}">Log in to review the request</a></p>
      `,
    });
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}