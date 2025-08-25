import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/User';
import EmailService from './EmailService';

export class PasswordResetService {
  private static readonly TOKEN_EXPIRY_MINUTES = 30;
  private static readonly RATE_LIMIT_MINUTES = 60;
  private static readonly MAX_REQUESTS_PER_HOUR = 3;
  private static emailService = new EmailService();

  /**
   * Generate a secure password reset token
   */
  private static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Check if user has exceeded rate limit for password reset requests
   */
  private static async checkRateLimit(email: string): Promise<boolean> {
    const user = await User.findOne({ email, deleted: false });
    if (!user) return true; // Allow request if user doesn't exist (for security)

    if (user.resetPasswordExpires) {
      const lastRequest =
        user.resetPasswordExpires.getTime() - this.TOKEN_EXPIRY_MINUTES * 60 * 1000;
      const hourAgo = Date.now() - this.RATE_LIMIT_MINUTES * 60 * 1000;

      if (lastRequest > hourAgo) {
        // Check how many requests in the last hour (simplified check)
        return false; // Rate limited
      }
    }

    return true;
  }

  /**
   * Initiate forgot password process
   */
  static async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check rate limiting
      const canProceed = await this.checkRateLimit(email);
      if (!canProceed) {
        return {
          success: false,
          message: 'Too many password reset requests. Please try again later.',
        };
      }

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase(), deleted: false });

      // Always return success for security (don't reveal if email exists)
      if (!user) {
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        };
      }

      // Generate reset token
      const resetToken = this.generateResetToken();
      const resetExpires = new Date(Date.now() + this.TOKEN_EXPIRY_MINUTES * 60 * 1000);

      // Save token to user
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetExpires;
      await user.save();

      // Send reset email
      const resetUrl = `${process.env.WEB_ORIGIN || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

      try {
        await this.emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Clear the token if email fails
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return {
          success: false,
          message: 'Failed to send password reset email. Please try again later.',
        };
      }

      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        message: 'An error occurred. Please try again later.',
      };
    }
  }

  /**
   * Verify reset token validity
   */
  static async verifyResetToken(token: string): Promise<{ valid: boolean; user?: IUser }> {
    try {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
        deleted: false,
      });

      return {
        valid: !!user,
        user: user || undefined,
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false };
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate password strength
      if (newPassword.length < 8) {
        return {
          success: false,
          message: 'Password must be at least 8 characters long.',
        };
      }

      // Find user with valid token
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
        deleted: false,
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired password reset token.',
        };
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update user password and clear reset fields
      user.passwordHash = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      // Send confirmation email
      try {
        await this.emailService.sendPasswordChangeConfirmation(user.email, user.name);
      } catch (emailError) {
        console.error('Failed to send password change confirmation:', emailError);
        // Don't fail the reset if confirmation email fails
      }

      return {
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        message: 'An error occurred while resetting your password. Please try again.',
      };
    }
  }

  /**
   * Clean up expired tokens (can be called periodically)
   */
  static async cleanupExpiredTokens(): Promise<void> {
    try {
      await User.updateMany(
        { resetPasswordExpires: { $lt: Date.now() } },
        {
          $unset: {
            resetPasswordToken: 1,
            resetPasswordExpires: 1,
          },
        }
      );
    } catch (error) {
      console.error('Token cleanup error:', error);
    }
  }
}
