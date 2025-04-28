import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getDigestById, getArticlesByDigestId, getPodcastByDigestId } from '../../utils/localStorage';

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

// Helper function to format date range for email
function formatDateRange(start, end) {
  if (!start || !end) return '';
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return '';
  }
  
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
}

// Helper function to generate HTML email content
function generateEmailContent(digest, articles, podcast) {
  const dateRange = formatDateRange(digest.weekStart, digest.weekEnd);
  const digestTitle = digest.title || `Weekly Oncology Digest: ${dateRange}`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const podcastUrl = podcast ? `${baseUrl}${podcast.audioUrl}` : null;
  const podcastScriptUrl = podcast && podcast.scriptUrl ? `${baseUrl}${podcast.scriptUrl}` : null;

  // Create HTML email template
  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          h1 { color: #4338ca; }
          h2 { color: #4f46e5; margin-top: 20px; }
          .article { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
          .article h3 { margin-bottom: 5px; color: #1e40af; }
          .article-meta { color: #6b7280; font-size: 14px; margin-bottom: 10px; }
          .article-summary { font-size: 16px; line-height: 1.6; }
          .podcast-section { margin: 20px 0; padding: 15px; background-color: #eef2ff; border-radius: 8px; }
          .article-list { background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
          .article-list-item { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
          .article-list-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
          .button { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 20px; 
                  text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 10px; }
          .audio-player { width: 100%; margin: 15px 0; background-color: #e0e7ff; border-radius: 4px; }
          footer { margin-top: 30px; font-size: 14px; color: #6b7280; border-top: 1px solid #eee; padding-top: 15px; }
        </style>
      </head>
      <body>
        <h1>OncoBrief</h1>
        <h2>${digestTitle}</h2>
        <p>Here's your weekly summary of the latest oncology research:</p>
  `;

  // Add article list at the beginning (TOC style)
  html += `
    <div class="article-list">
      <h3>Articles in this digest:</h3>
      <ol>
  `;
  
  articles.forEach((article, index) => {
    html += `
      <li class="article-list-item">
        <strong>${article.title}</strong><br>
        <span style="color: #6b7280;">${article.journal} ${article.pubYear ? `(${article.pubYear})` : ''}</span>
      </li>
    `;
  });
  
  html += `
      </ol>
    </div>
  `;

  // Add podcast section if available
  if (podcast) {
    html += `
      <div class="podcast-section">
        <h3>🎧 OncoBrief Podcast</h3>
        <p>Listen to an audio summary of this week's research findings:</p>
    `;

    // If podcast has audio URL, embed audio player
    if (podcast.audioUrl) {
      html += `
        <!-- HTML5 Audio player (works in some email clients) -->
        <audio controls class="audio-player">
          <source src="${podcastUrl}" type="audio/mpeg">
          Your email client does not support HTML5 audio.
        </audio>
        
        <!-- Fallback buttons if audio player doesn't work -->
        <div style="margin-top:15px;">
          <a href="${podcastUrl}" class="button" style="margin-right:10px;">Listen Online</a>
      `;
      
      // Add script download link if available
      if (podcastScriptUrl) {
        html += `
          <a href="${podcastScriptUrl}" style="color:#4338ca; margin-left:10px;">View Transcript</a>
        `;
      }
      
      html += `
        </div>
      `;
    } else {
      html += `
        <p>Podcast is being processed. Please visit the website to listen.</p>
        <a href="${baseUrl}" class="button">Visit OncoBrief</a>
      `;
    }
    
    html += `
      </div>
    `;
  }

  // Add detailed articles section
  html += `<h3>Detailed Research Summaries</h3>`;
  
  // Add each article with full details
  articles.forEach((article, index) => {
    html += `
      <div class="article">
        <h3>${article.title}</h3>
        <div class="article-meta">
          <div><strong>Authors:</strong> ${article.authors || 'Not available'}</div>
          <div><strong>Journal:</strong> ${article.journal} ${article.pubYear ? `(${article.pubYear})` : ''}</div>
          <div><strong>PMID:</strong> <a href="https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/">${article.pmid}</a></div>
        </div>
        <div class="article-summary">
          ${article.aiSummary || (article.abstract ? article.abstract.substring(0, 150) + '...' : 'No summary available')}
        </div>
      </div>
    `;
  });

  // Add footer
  html += `
        <footer>
          <p>This email was sent from OncoBrief, your weekly oncology research digest.</p>
          <p>© ${new Date().getFullYear()} OncoBrief</p>
        </footer>
      </body>
    </html>
  `;

  return html;
}

// POST route handler for sending email
export async function POST(request) {
  try {
    console.log('Email API endpoint called');
    
    // Parse request body
    const body = await request.json();
    console.log('Request body:', body);
    
    const { digestId, recipientEmail, articlesOverride, podcastOverride } = body;
    
    // Validation
    if (!digestId) {
      console.log('Missing digestId parameter');
      return NextResponse.json({ success: false, error: 'Missing digestId parameter' }, { status: 400 });
    }
    
    if (!recipientEmail || !/^\S+@\S+\.\S+$/.test(recipientEmail)) {
      console.log('Invalid email address:', recipientEmail);
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
    }
    
    // Get digest data
    console.log('Getting digest with ID:', digestId);
    const digest = getDigestById(digestId);
    console.log('Digest found:', digest ? 'yes' : 'no');
    
    // Articles can come from the API request or from localStorage
    let articles;
    
    // If articles were provided directly in the request, use those
    if (articlesOverride && Array.isArray(articlesOverride) && articlesOverride.length > 0) {
      console.log(`Using ${articlesOverride.length} articles from the request`);
      articles = articlesOverride;
    } else {
      // Otherwise get articles from localStorage
      articles = getArticlesByDigestId(digestId) || [];
      console.log(`Found ${articles.length} articles in localStorage`);
    }
    
    // Check if we have articles to include
    if (articles.length === 0) {
      console.log('No articles found for digest');
      return NextResponse.json({ 
        success: false, 
        error: 'No articles found for this digest' 
      }, { status: 404 });
    }
    
    // If digest is not found, create a fallback digest
    let digestData = digest;
    if (!digestData) {
      console.log('Creating fallback digest');
      digestData = {
        id: digestId,
        title: 'Weekly Oncology Digest',
        weekStart: new Date(),
        weekEnd: new Date(),
      };
    }
    
    // Podcast can come from the API request or from localStorage
    let podcast;
    
    // If a podcast was provided directly in the request, use it
    if (podcastOverride && podcastOverride.audioUrl) {
      console.log('Using podcast from the request');
      podcast = podcastOverride;
    } else {
      // Otherwise get podcast from localStorage
      podcast = getPodcastByDigestId(digestId);
      console.log('Podcast found in localStorage:', podcast ? 'yes' : 'no');
    }
    
    if (podcast) {
      console.log('Podcast URLs:', {
        audio: podcast.audioUrl,
        script: podcast.scriptUrl
      });
    } else {
      console.log('No podcast available for this digest');
    }
    
    // Generate email content
    console.log('Generating email content');
    const dateRange = formatDateRange(digestData.weekStart, digestData.weekEnd);
    const digestTitle = digestData.title || `Weekly Oncology Digest: ${dateRange}`;
    const htmlContent = generateEmailContent(digestData, articles, podcast);
    
    // Prepare attachments if podcast is available
    let attachments = [];
    
    // Uncomment this block if you want to attach the podcast as a file
    // (note: this can make emails very large and may be rejected by some providers)
    /*
    if (podcast && podcast.audioUrl) {
      try {
        const fs = require('fs');
        const path = require('path');
        const publicDir = path.join(process.cwd(), 'public');
        const audioPath = path.join(publicDir, podcast.audioUrl.replace(/^\//, ''));
        
        if (fs.existsSync(audioPath)) {
          attachments.push({
            filename: `oncobrief-podcast-${digestId}.mp3`,
            path: audioPath
          });
        }
      } catch (err) {
        console.error('Error attaching podcast:', err);
      }
    }
    */
    
    // Send email
    console.log('Sending email to:', recipientEmail);
    const mailOptions = {
      from: EMAIL_FROM,
      to: recipientEmail,
      subject: `OncoBrief: ${digestTitle}`,
      html: htmlContent,
      attachments: attachments
    };
    
    await transporter.sendMail(mailOptions);
    
    // Return success response
    console.log('Email sent successfully');
    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${recipientEmail}`
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An error occurred while sending the email'
    }, { status: 500 });
  }
} 