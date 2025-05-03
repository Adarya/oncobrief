import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

// Initialize AWS Polly Client
// Credentials sourced from environment variables
const pollyClient = new PollyClient({});

// Helper function to sanitize text for SSML
function sanitizeForSSML(text) {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')     // & must be escaped as &amp;
    .replace(/</g, '&lt;')      // < must be escaped as &lt;
    .replace(/>/g, '&gt;')      // > must be escaped as &gt;
    .replace(/"/g, '&quot;')    // " must be escaped as &quot;
    .replace(/'/g, '&apos;')    // ' must be escaped as &apos;
    .replace(/\[\^.*?\]/g, '')  // Remove citation markers like [^1]
    .replace(/\((?:[^()]*|\([^()]*\))*\)/g, '')  // Remove content in parentheses
    .replace(/[\u2018\u2019]/g, "'")  // Replace smart quotes
    .replace(/[\u201C\u201D]/g, '"'); // Replace smart double quotes
}

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
    VoiceId: 'Matthew', // Standard male voice 
    TextType: 'ssml', // Indicate that the input text contains SSML tags
    Engine: 'standard' // Use the standard engine
  });

  try {
    console.log(`Sending chunk to Polly: ${textChunk.substring(0, 100)}... (${textChunk.length} chars)`);
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
    
    const MAX_CHUNK_SIZE = 2500; // Reduced from 3000 for safety
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
      
      try {
        const audioBase64 = await synthesizeSpeechChunk(chunks[i]);
        audioChunks.push(Buffer.from(audioBase64, 'base64'));
      } catch (error) {
        console.error(`Error processing chunk ${i+1}:`, error);
        
        // Attempt to fix common SSML issues and retry
        try {
          console.log('Attempting to fix SSML and retry...');
          // Make sure the SSML is valid by using only basic tags
          const fixedChunk = `<speak>${chunks[i].replace(/<\/?speak>/g, '').replace(/<[^>]*>/g, '')}</speak>`;
          const audioBase64 = await synthesizeSpeechChunk(fixedChunk);
          audioChunks.push(Buffer.from(audioBase64, 'base64'));
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          // Skip this chunk rather than failing the entire process
          console.log('Skipping problematic chunk and continuing...');
        }
      }
    }
    
    if (audioChunks.length === 0) {
      throw new Error('No audio chunks were successfully processed');
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

// Generate a podcast script from research summary
function generatePodcastScript(summary) {
  if (!summary || !summary.sections) {
    throw new Error("Invalid summary data");
  }
  
  const { overview, keyFindings, researchTrends, clinicalImplications, futureDirections } = summary.sections;
  const topic = summary.topic || "APOBEC research";
  
  // Create intro with pauses for more natural rhythm
  let script = `<speak>Welcome to this special OncoBrief podcast episode, <break time="200ms"/> focusing on a research summary about ${sanitizeForSSML(topic)}. <break time="500ms"/>`;
  
  // Add overview section
  if (overview) {
    script += `Let's begin with an overview. <break time="300ms"/>\n\n${sanitizeForSSML(overview)}<break time="700ms"/>\n\n`;
  }
  
  // Add key findings section
  if (keyFindings) {
    script += `Now, let's explore the key findings. <break time="300ms"/>\n\n${sanitizeForSSML(keyFindings)}<break time="700ms"/>\n\n`;
  }
  
  // Add research trends section
  if (researchTrends) {
    script += `Let's examine the current research trends in this field. <break time="300ms"/>\n\n${sanitizeForSSML(researchTrends)}<break time="700ms"/>\n\n`;
  }
  
  // Add clinical implications section
  if (clinicalImplications) {
    script += `Now for the clinical implications of this research. <break time="300ms"/>\n\n${sanitizeForSSML(clinicalImplications)}<break time="700ms"/>\n\n`;
  }
  
  // Add future directions section
  if (futureDirections) {
    script += `Finally, let's consider future directions for research. <break time="300ms"/>\n\n${sanitizeForSSML(futureDirections)}<break time="700ms"/>\n\n`;
  }
  
  // Add conclusion
  script += `<break time="500ms"/>That concludes this research summary podcast. <break time="300ms"/> Thank you for listening. <break time="300ms"/> For more detailed information, please refer to the original research papers and visit the OncoBrief website.</speak>`;

  console.log(`Generated podcast script with ${script.length} characters`);
  return script;
}

// Function to make the public directory if it doesn't exist
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.promises.access(dirPath);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Endpoint to generate a podcast from a research summary
export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();
    const { summary } = body;
    
    // Validate request data
    if (!summary) {
      return NextResponse.json(
        { error: 'Research summary data is required' },
        { status: 400 }
      );
    }
    
    // Generate a unique ID for this podcast
    const podcastId = Date.now().toString();
    
    // Generate the podcast script
    const script = generatePodcastScript(summary);
    
    // Save the script to a file
    const publicDir = path.join(process.cwd(), 'public');
    const scriptFilename = `research-podcast-script-${podcastId}.txt`;
    
    await ensureDirectoryExists(publicDir);
    await fs.promises.writeFile(path.join(publicDir, scriptFilename), script);
    console.log(`Script saved to ${scriptFilename}`);
    
    // Convert the script to speech
    const audioBase64 = await textToSpeech(script);
    
    // Ensure podcasts directory exists
    const audioDir = path.join(publicDir, 'podcasts');
    await ensureDirectoryExists(audioDir);
    
    // Save the audio file
    const filename = `research-podcast-${podcastId}.mp3`;
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    await fs.promises.writeFile(path.join(audioDir, filename), audioBuffer);
    console.log(`Audio saved to podcasts/${filename}`);
    
    // Return success response with audio and script URLs
    return NextResponse.json({
      success: true,
      audioUrl: `/podcasts/${filename}`,
      scriptUrl: `/${scriptFilename}`,
      message: 'Research podcast generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating research podcast:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'An error occurred during podcast generation'
      },
      { status: 500 }
    );
  }
} 