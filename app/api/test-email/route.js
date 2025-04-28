import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER || 'your-email@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your-app-password';
const EMAIL_FROM = process.env.EMAIL_FROM || 'OncoBrief <your-email@gmail.com>';

// Create a transporter (for Gmail, you should use application-specific password)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Simple GET endpoint to test email sending
export async function GET(request) {
  try {
    console.log('Test email endpoint called');
    
    // Get the test recipient from the URL params
    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to');
    
    if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
      console.log('Invalid email address:', to);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid email address. Use ?to=your@email.com' 
      }, { status: 400 });
    }
    
    console.log('Email credentials:', {
      user: EMAIL_USER,
      pass: EMAIL_PASS ? 'Provided (hidden)' : 'Missing'
    });
    
    // Send a simple test email
    const mailOptions = {
      from: EMAIL_FROM,
      to: to,
      subject: 'OncoBrief Test Email',
      html: `
        <html>
          <body>
            <h1>OncoBrief Email Test</h1>
            <p>This is a test email to verify that the email sending functionality is working.</p>
            <p>If you're seeing this, the email configuration is correct!</p>
            <p>Time: ${new Date().toISOString()}</p>
          </body>
        </html>
      `
    };
    
    console.log('Sending test email to:', to);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${to}`,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An error occurred while sending the test email'
    }, { status: 500 });
  }
} 