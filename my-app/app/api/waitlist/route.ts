import { neon } from '@neondatabase/serverless';
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 });
    }

    // Database connection
    const sql = neon(process.env.DATABASE_URL);

    // Verify OTP
    const otpResult = await sql`
      SELECT * FROM waitlist_otps 
      WHERE email = ${email} AND otp = ${otp}
    `;

    if (otpResult.length === 0) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    const otpData = otpResult[0];
    if (new Date() > new Date(otpData.expires_at)) {
      return NextResponse.json({ error: 'OTP has expired' }, { status: 400 });
    }

    // OTP is valid, delete it
    await sql`DELETE FROM waitlist_otps WHERE email = ${email}`;

    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert email or get existing
    let user;
    try {
      const result = await sql`
        INSERT INTO waitlist (email) 
        VALUES (${email}) 
        RETURNING id
      `;
      user = result[0];
    } catch (e: any) {
      // Unique violation
      if (e.code === '23505') {
        const existing = await sql`SELECT id FROM waitlist WHERE email = ${email}`;
        user = existing[0];
      } else {
        throw e;
      }
    }

    // Get total count
    const countResult = await sql`SELECT COUNT(*) as count FROM waitlist`;
    const count = countResult[0].count;

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '"Conexion" <noreply@conexion.app>',
      to: email,
      subject: 'Welcome to the Conexion Waitlist!',
      text: `Welcome to Conexion!\n\nYou have successfully joined the Conexion waitlist! You are #${count} on the waitlist.\n\nWe're putting the final touches on our encrypted peer-to-peer network. An entirely new way to experience human connection is coming to your browser. We will let you know when you can access the platform.\n\nBest regards,\nThe Conexion Team`,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F8F5F2; padding: 40px; border-radius: 16px; color: #1a1a1a;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-family: Georgia, serif; font-size: 32px; color: #1a1a1a; margin: 0;">Cone<span style="color: #d4916a; font-style: italic;">x</span>ion</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.04);">
            <h2 style="font-size: 24px; color: #1a1a1a; margin-top: 0; font-weight: 600;">You're on the list! 🎉</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #4a4a4a; margin-bottom: 24px;">
              Thank you for joining the Conexion waitlist. You are officially number <strong>#${count}</strong> in line.
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #4a4a4a; margin-bottom: 24px;">
              We're putting the final touches on our encrypted peer-to-peer network. An entirely new way to experience human connection is coming to your browser.
            </p>
            <div style="background-color: #F8F5F2; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Position</p>
              <p style="margin: 10px 0 0 0; font-size: 36px; font-weight: bold; color: #d4916a;">#${count}</p>
            </div>
            <p style="font-size: 16px; line-height: 1.6; color: #4a4a4a; margin-bottom: 32px;">
              We'll send you an exclusive invite as soon as it's your turn to access the platform. Stay tuned!
            </p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin-bottom: 24px;" />
            <p style="font-size: 14px; color: #888; margin: 0;">
              Best regards,<br/>
              <strong>The Conexion Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 12px; color: #aaa;">
              © ${new Date().getFullYear()} Conexion. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    // If EMAIL_USER is not set, we skip sending email so the app doesn't crash during dev
    if (process.env.EMAIL_USER) {
      await transporter.sendMail(mailOptions);
    } else {
      console.warn("EMAIL_USER not set, skipping email sending.");
    }

    return NextResponse.json({ success: true, count, waitlistNumber: user.id });
  } catch (error) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
