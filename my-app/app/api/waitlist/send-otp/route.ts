import { neon } from '@neondatabase/serverless';
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 });
    }

    // Database connection
    const sql = neon(process.env.DATABASE_URL);

    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist_otps (
        email VARCHAR(255) PRIMARY KEY,
        otp VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `;

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Upsert the OTP
    await sql`
      INSERT INTO waitlist_otps (email, otp, expires_at)
      VALUES (${email}, ${otp}, ${expiresAt.toISOString()})
      ON CONFLICT (email) DO UPDATE 
      SET otp = ${otp}, expires_at = ${expiresAt.toISOString()}
    `;

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
      subject: 'Your Conexion Waitlist OTP',
      text: `Your OTP for the Conexion waitlist is ${otp}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #d4916a;">Conexion Waitlist OTP</h2>
          <p>Your OTP for the Conexion waitlist is:</p>
          <h1 style="font-size: 32px; letter-spacing: 2px;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
          <br/>
          <p>Best regards,<br/><strong>The Conexion Team</strong></p>
        </div>
      `
    };

    if (process.env.EMAIL_USER) {
      await transporter.sendMail(mailOptions);
    } else {
      console.warn("EMAIL_USER not set, skipping OTP email sending. OTP is:", otp);
    }

    const isDev = !process.env.EMAIL_USER;
    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully',
      ...(isDev ? { devOtp: otp } : {})
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
