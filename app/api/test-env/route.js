import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get environment variables with sensitive data masked
    const envVariables = {
      // Email config
      EMAIL_USER: process.env.EMAIL_USER || 'not set',
      EMAIL_PASS: process.env.EMAIL_PASS ? '****' + (process.env.EMAIL_PASS.slice(-4) || '') : 'not set',
      EMAIL_FROM: process.env.EMAIL_FROM || 'not set',
      
      // Other config
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'not set',
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ? 'set (masked)' : 'not set',
      
      // Node environment
      NODE_ENV: process.env.NODE_ENV || 'not set'
    };
    
    return NextResponse.json({
      success: true,
      env: envVariables,
      message: 'Environment variables loaded. Check if the values match what you expected.'
    });
  } catch (error) {
    console.error('Error checking environment:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An error occurred while checking environment variables'
    }, { status: 500 });
  }
} 