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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
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
