import nodemailer from 'nodemailer';
import { IUser } from '../models/User';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Ensure environment variables are loaded
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Email service: SMTP credentials not found in environment variables');
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: parseInt(process.env.SMTP_PORT || '465') === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Log configuration (without password) for debugging
    console.log('Email service initialized with config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      passLength: process.env.SMTP_PASS?.length,
      secure: parseInt(process.env.SMTP_PORT || '465') === 465
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    try {
      const verificationLink = `${process.env.WEB_ORIGIN}/auth/verify-email?token=${token}`;
      
      const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: 'Verify Your Email - TaskTrek',
        html: this.getVerificationEmailTemplate('User', verificationLink),
        text: this.getVerificationEmailText('User', verificationLink)
      };

      console.log('Attempting to send email with config:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        from: process.env.FROM_EMAIL,
        to: email
      });

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
    } catch (error: any) {
      console.error('Detailed email error:', {
        error: error?.message,
        code: error?.code,
        command: error?.command,
        response: error?.response
      });
      throw new Error(`Failed to send verification email: ${error?.message || 'Unknown error'}`);
    }
  }

  async sendWelcomeEmail(user: IUser): Promise<void> {
    const frontendUrl = process.env.WEB_ORIGIN || 'http://localhost:3000';

    const mailOptions = {
      from: {
        name: process.env.FROM_NAME || 'TaskTrek',
        address: process.env.FROM_EMAIL || process.env.SMTP_USER!,
      },
      to: user.email,
      subject: 'Welcome to TaskTrek! 🎉',
      html: this.getWelcomeEmailTemplate(user.name, frontendUrl),
      text: this.getWelcomeEmailText(user.name, frontendUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Don't throw error for welcome email failure
    }
  }

  async sendPasswordResetEmail(email: string, userName: string, resetUrl: string): Promise<void> {
    const mailOptions = {
      from: {
        name: process.env.FROM_NAME || 'TaskTrek',
        address: process.env.FROM_EMAIL || process.env.SMTP_USER!,
      },
      to: email,
      subject: 'Reset Your Password - TaskTrek',
      html: this.getPasswordResetEmailTemplate(userName, resetUrl),
      text: this.getPasswordResetEmailText(userName, resetUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  async sendPasswordChangeConfirmation(email: string, userName: string): Promise<void> {
    const mailOptions = {
      from: {
        name: process.env.FROM_NAME || 'TaskTrek',
        address: process.env.FROM_EMAIL || process.env.SMTP_USER!,
      },
      to: email,
      subject: 'Password Changed Successfully - TaskTrek',
      html: this.getPasswordChangeConfirmationTemplate(userName),
      text: this.getPasswordChangeConfirmationText(userName),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Password change confirmation sent to ${email}`);
    } catch (error) {
      console.error('Error sending password change confirmation:', error);
      throw error;
    }
  }

  private getVerificationEmailTemplate(userName: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - TaskTrek</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { 
            display: inline-block; 
            background: #3b82f6; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
          }
          .footer { margin-top: 20px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔧 TaskTrek</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Thank you for signing up for TaskTrek! To complete your registration and start managing your projects and tasks, please verify your email address.</p>
            
            <p>Click the button below to verify your email:</p>
            
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
            
            <p><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
            
            <div class="footer">
              <p>If you didn't create an account with TaskTrek, you can safely ignore this email.</p>
              <p>Best regards,<br>The TaskTrek Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getVerificationEmailText(userName: string, verificationUrl: string): string {
    return `
Hello ${userName}!

Thank you for signing up for TaskTrek! To complete your registration and start managing your projects and tasks, please verify your email address.

Please click the following link to verify your email:
${verificationUrl}

Important: This verification link will expire in 24 hours for security reasons.

If you didn't create an account with TaskTrek, you can safely ignore this email.

Best regards,
The TaskTrek Team
    `.trim();
  }

  private getWelcomeEmailTemplate(userName: string, frontendUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to TaskTrek!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { 
            display: inline-block; 
            background: #10b981; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
          }
          .feature { margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to TaskTrek!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Welcome to TaskTrek! Your email has been successfully verified and your account is now active.</p>
            
            <p>Here's what you can do with TaskTrek:</p>
            
            <div class="feature">📊 <strong>Manage Projects:</strong> Create and organize your projects efficiently</div>
            <div class="feature">✅ <strong>Track Tasks:</strong> Keep track of your tasks and their progress</div>
            <div class="feature">👥 <strong>Collaborate:</strong> Work with team members in organizations</div>
            <div class="feature">🔔 <strong>Stay Updated:</strong> Get notifications about important updates</div>
            
            <p>Ready to get started?</p>
            
            <a href="${frontendUrl}/dashboard" class="button">Go to Dashboard</a>
            
            <p>If you have any questions or need help getting started, feel free to reach out to our support team.</p>
            
            <p>Happy project managing!</p>
            <p>The TaskTrek Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailText(userName: string, frontendUrl: string): string {
    return `
Welcome to TaskTrek!

Hello ${userName}!

Welcome to TaskTrek! Your email has been successfully verified and your account is now active.

Here's what you can do with TaskTrek:
- Manage Projects: Create and organize your projects efficiently
- Track Tasks: Keep track of your tasks and their progress  
- Collaborate: Work with team members in organizations
- Stay Updated: Get notifications about important updates

Ready to get started? Visit: ${frontendUrl}/dashboard

If you have any questions or need help getting started, feel free to reach out to our support team.

Happy project managing!
The TaskTrek Team
    `.trim();
  }

  private getPasswordResetEmailTemplate(userName: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - TaskTrek</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { 
            display: inline-block; 
            background: #f59e0b; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
          }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 20px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 TaskTrek</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>We received a request to reset the password for your TaskTrek account. If you made this request, click the button below to reset your password.</p>
            
            <a href="${resetUrl}" class="button">Reset Password</a>
            
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">${resetUrl}</p>
            
            <div class="warning">
              <p><strong>⚠️ Important Security Information:</strong></p>
              <ul>
                <li>This password reset link will expire in 30 minutes</li>
                <li>This link can only be used once</li>
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>Your password will remain unchanged until you create a new one</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>If you're having trouble with your account or didn't request this reset, please contact our support team.</p>
              <p>Best regards,<br>The TaskTrek Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetEmailText(userName: string, resetUrl: string): string {
    return `
Reset Your Password - TaskTrek

Hello ${userName}!

We received a request to reset the password for your TaskTrek account. If you made this request, please click the link below to reset your password.

Reset Link: ${resetUrl}

IMPORTANT SECURITY INFORMATION:
- This password reset link will expire in 30 minutes
- This link can only be used once
- If you didn't request this password reset, please ignore this email
- Your password will remain unchanged until you create a new one

If you're having trouble with your account or didn't request this reset, please contact our support team.

Best regards,
The TaskTrek Team
    `.trim();
  }

  private getPasswordChangeConfirmationTemplate(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed Successfully - TaskTrek</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .success { background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 20px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ TaskTrek</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            
            <div class="success">
              <p><strong>✅ Password Changed Successfully!</strong></p>
              <p>Your TaskTrek account password has been updated successfully.</p>
            </div>
            
            <p>This email confirms that your password was changed on ${new Date().toLocaleString()}.</p>
            
            <p><strong>What this means:</strong></p>
            <ul>
              <li>You can now log in with your new password</li>
              <li>Your account remains secure</li>
              <li>All active sessions have been maintained</li>
            </ul>
            
            <p><strong>If you didn't make this change:</strong></p>
            <p>If you did not request this password change, please contact our support team immediately as your account may have been compromised.</p>
            
            <div class="footer">
              <p>If you have any questions or concerns, please don't hesitate to contact our support team.</p>
              <p>Best regards,<br>The TaskTrek Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordChangeConfirmationText(userName: string): string {
    return `
Password Changed Successfully - TaskTrek

Hello ${userName}!

✅ Password Changed Successfully!

Your TaskTrek account password has been updated successfully.

This email confirms that your password was changed on ${new Date().toLocaleString()}.

What this means:
- You can now log in with your new password
- Your account remains secure
- All active sessions have been maintained

If you didn't make this change:
If you did not request this password change, please contact our support team immediately as your account may have been compromised.

If you have any questions or concerns, please don't hesitate to contact our support team.

Best regards,
The TaskTrek Team
    `.trim();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified successfully');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

export default EmailService;
