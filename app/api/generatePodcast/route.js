import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { PollyClient, SynthesizeSpeechCommand, TextType } from '@aws-sdk/client-polly';

// Initialize AWS Polly Client
// Credentials will be automatically sourced from environment variables:
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
const pollyClient = new PollyClient({});

// Helper function to convert text to speech using AWS Polly
async function textToSpeech(text) {
  try {
    // Polly's SynthesizeSpeech has a 3000 character limit for SSML
    // If text is longer than that, split it and make multiple requests
    if (text.length <= 3000) {
      return await synthesizeSpeechChunk(text);
    } else {
      console.log(`Text length ${text.length} exceeds Polly's 3000 character limit. Splitting into chunks...`);
      return await processLongText(text);
    }
  } catch (error) {
    console.error('Error in AWS Polly API call:', error);
    throw new Error('Failed to convert text to speech using AWS Polly');
  }
}

// Function to process a single chunk with Polly
async function synthesizeSpeechChunk(textChunk) {
  const command = new SynthesizeSpeechCommand({
    Text: textChunk,
    OutputFormat: 'mp3',
    VoiceId: 'Matthew', // Standard male voice (others available: Joanna, Amy, Brian, etc.)
    TextType: TextType.SSML, // Indicate that the input text contains SSML tags
    Engine: 'standard' // Explicitly use the standard engine
  });

  try {
    const { AudioStream } = await pollyClient.send(command);

    if (!AudioStream) {
      throw new Error('Polly did not return an audio stream.');
    }

    // Convert the stream to a buffer
    const chunks = [];
    for await (const chunk of AudioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    return audioBuffer.toString('base64');
  } catch (error) {
    console.error('Error in AWS Polly API call for chunk:', error);
    throw error;
  }
}

// Function to split and process long text
async function processLongText(text) {
  try {
    // Remove the outer <speak> tags - we'll add them to each chunk
    let processedText = text.replace(/<\/?speak>/g, '');
    
    // Split text into paragraphs for more natural breaks
    const paragraphs = processedText.split(/\n+/);
    
    const MAX_CHUNK_SIZE = 2800; // Keeping a buffer below the 3000 limit for safety
    let chunks = [];
    let currentChunk = '';
    
    // Group paragraphs into chunks
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed limit, save the chunk and start a new one
      if (currentChunk.length + paragraph.length + 16 > MAX_CHUNK_SIZE) { // +16 for the <speak> tags
        if (currentChunk.length > 0) {
          chunks.push(`<speak>${currentChunk}</speak>`);
          currentChunk = '';
        }
        
        // If a single paragraph is too long, we need to split it by sentences
        if (paragraph.length + 16 > MAX_CHUNK_SIZE) {
          const sentences = paragraph.split(/(?<=[.!?])\s+/);
          let sentenceChunk = '';
          
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length + 16 > MAX_CHUNK_SIZE) {
              chunks.push(`<speak>${sentenceChunk}</speak>`);
              sentenceChunk = sentence;
            } else {
              sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
            }
          }
          
          if (sentenceChunk.length > 0) {
            currentChunk = sentenceChunk;
          }
        } else {
          currentChunk = paragraph;
        }
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n' : '') + paragraph;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(`<speak>${currentChunk}</speak>`);
    }
    
    console.log(`Split text into ${chunks.length} chunks for Polly TTS processing`);
    
    // Process each chunk and collect audio data
    let audioChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing Polly chunk ${i+1}/${chunks.length} (${chunks[i].length} chars)`);
      const audioBase64 = await synthesizeSpeechChunk(chunks[i]);
      audioChunks.push(Buffer.from(audioBase64, 'base64'));
    }
    
    // Concatenate all audio chunks
    console.log(`Concatenating ${audioChunks.length} audio segments`);
    const concatAudio = Buffer.concat(audioChunks);
    
    return concatAudio.toString('base64');
  } catch (error) {
    console.error('Error processing long text for Polly:', error);
    throw error;
  }
}

// Helper function to get first author from authors string
function getFirstAuthor(authors) {
  if (!authors) return null;
  
  // Try to extract the first author
  // Common formats: "Smith J, Johnson A, et al." or "Smith J., Johnson A., et al."
  const match = authors.match(/^([^,;]+)/);
  return match ? match[1].trim() : null;
}

// No need for the formatForSpeech function that stripped SSML for Google TTS
// The script generation already uses SSML tags compatible with Polly

// Generate a podcast script from article data
function generatePodcastScript(digestTitle, articles) {
  // Create intro with pauses for more natural rhythm
  let script = `<speak>Welcome to OncoBrief, <break time="200ms"/> your weekly podcast summarizing the latest oncology research. `;
  script += `This episode covers ${digestTitle}. <break time="300ms"/> `;
  script += `We'll discuss ${articles.length} recent publications from top oncology journals.<break time="700ms"/>\n\n`;

  // Add overview of all articles first (like a table of contents)
  script += `Here's a quick overview of the articles we'll cover:<break time="300ms"/>\n\n`;
  
  articles.forEach((article, index) => {
    // Add brief article intro with number, title and journal
    script += `Article ${index + 1}: ${article.title}. Published in ${article.journal}.\n`;
  });
  
  script += `<break time="1000ms"/>Now, let's explore each article in more detail.<break time="700ms"/>\n\n`;

  // Removed the previous character limit calculation based on MAX_CHARACTERS
  // Polly's SynthesizeSpeech limit (6000 chars) will be checked by the API call itself.
  // For much longer texts (>6k chars), StartSpeechSynthesisTask would be needed.

  // Now add each article with detailed information
  articles.forEach((article, index) => {
    let articleScript = `<emphasis level="strong">Article ${index + 1}:</emphasis> ${article.title}.\n`;
    
    // Add only the first author if available
    if (article.authors) {
      const firstAuthor = getFirstAuthor(article.authors);
      if (firstAuthor) {
        articleScript += `From ${firstAuthor} and colleagues.\n`;
      }
    }
    
    // Add journal info with better speech flow
    articleScript += `Published in ${article.journal}`;
    if (article.pubYear) {
      articleScript += ` in ${article.pubYear}`;
    }
    articleScript += `.<break time="300ms"/>\n`;
    
    // Add AI summary if available, otherwise use a portion of the abstract
    if (article.aiSummary) {
      articleScript += `${article.aiSummary}\n\n<break time="700ms"/>`;
    } else if (article.abstract) {
      // Use first ~100 words of abstract if AI summary isn't available
      // Removing the strict character limit per article calculation
      const words = article.abstract.split(' ');
      const wordLimit = 100; 
      const shortAbstract = words.slice(0, wordLimit).join(' ') + (words.length > wordLimit ? '...' : '');
      articleScript += `${shortAbstract}\n\n<break time="700ms"/>`;
    } else {
      articleScript += `No abstract available for this article.\n\n<break time="700ms"/>`;
    }
    
    // Add this article's script to the main script
    script += articleScript;
  });
  
  // Add conclusion with more natural phrasing
  script += `<break time="500ms"/>That concludes this episode of OncoBrief. <break time="300ms"/> Thank you for listening. <break time="300ms"/> For more detailed information on these articles, please visit the OncoBrief website or check the original publications. <break time="300ms"/> Stay tuned for next week's update on the latest oncology research.</speak>`;

  console.log(`Podcast script length: ${script.length} characters`);
  return script;
}

// POST route handler to generate a podcast
export async function POST(request) {
  try {
    // Parse the request body
    const { digestId, digestTitle, articles } = await request.json();
    
    // Validation
    if (!digestId) {
      return NextResponse.json({ success: false, error: 'Missing digestId parameter' }, { status: 400 });
    }
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json({ success: false, error: 'No articles provided' }, { status: 400 });
    }
    
    const title = digestTitle || 'Weekly Oncology Digest';
    
    // Generate podcast script from articles
    const script = generatePodcastScript(title, articles);
    
    // Log script length (Polly has much higher limits than Google TTS)
    console.log(`Podcast script length: ${script.length} characters`);
    
    // Save the script to a text file for examination
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }
    
    const scriptFilename = `podcast-script-${digestId}.txt`;
    const scriptFilePath = path.join(publicDir, scriptFilename);
    // Save the script with SSML tags
    fs.writeFileSync(scriptFilePath, script); 
    
    // Convert script to speech using AWS Polly
    try {
      const audioContent = await textToSpeech(script);
      
      // Set up directory for audio files if it doesn't exist
      const audioDir = path.join(publicDir, 'podcasts');
      
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir);
      }
      
      // Save the audio file
      const filename = `podcast-${digestId}.mp3`;
      const filePath = path.join(audioDir, filename);
      
      fs.writeFileSync(filePath, Buffer.from(audioContent, 'base64'));
      
      // Return the URL to the audio file and the script
      return NextResponse.json({
        success: true,
        audioUrl: `/podcasts/${filename}`,
        scriptUrl: `/${scriptFilename}`, // URL to access the script file
        script: script,
        message: 'Podcast generated successfully using AWS Polly'
      });
    } catch (error) {
      console.error('Error during TTS conversion with AWS Polly:', error);
      
      // Even if TTS fails, return the script URL for examination
      return NextResponse.json({
        success: false,
        scriptUrl: `/${scriptFilename}`,
        error: 'Failed to generate TTS audio using AWS Polly. Script is still available.',
        details: error.message || 'Failed to convert text to speech'
      }, { status: 500 }); // Use 500 for server-side TTS error
    }
  } catch (error) {
    console.error('Error generating podcast:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An error occurred during podcast generation'
    }, { status: 500 });
  }
} 