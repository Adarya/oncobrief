import { NextResponse } from 'next/server';
import axios from 'axios';

// PubMed API settings
const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
const PUBMED_API_KEY = "77e480329e7293ae3c9984c5346a98cc5b08"; // Replace with environment variable in production
const REQUEST_DELAY_MS = 150; // Delay between PubMed API requests

// Gemini API settings
const GEMINI_API_KEY = "AIzaSyBhPw5XyhH9i7i778DsmX1oGa9cPns_wWM"; // Replace with environment variable in production

// Helper function for delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to clean XML text
function cleanXmlText(text) {
  if (!text) return '';
  
  // Replace XML entities
  let cleaned = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  
  // Remove XML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  return cleaned.trim();
}

// Function to search PubMed for articles
async function searchPubMed(query, maxResults = 100) {
  console.log(`Searching PubMed for: '${query}'`);
  
  const searchUrl = `${BASE_URL}esearch.fcgi`;
  const params = {
    db: 'pubmed',
    term: query,
    retmax: maxResults.toString(),
    usehistory: 'y',
    api_key: PUBMED_API_KEY,
  };
  
  try {
    const response = await axios.get(searchUrl, { params });
    
    // Parse the XML response
    const responseText = response.data;
    
    // Extract count of total results to check if pagination is needed
    const countMatch = responseText.match(/<Count>(\d+)<\/Count>/);
    const totalResults = countMatch ? parseInt(countMatch[1]) : 0;
    console.log(`Total results found: ${totalResults}`);
    
    // Simplistic XML parsing
    const idListMatch = responseText.match(/<IdList>(.*?)<\/IdList>/s);
    
    if (!idListMatch) {
      console.log('No IdList found in response');
      return [];
    }
    
    const idList = idListMatch[1];
    const pmids = [];
    
    const idRegex = /<Id>(\d+)<\/Id>/g;
    let match;
    
    while ((match = idRegex.exec(idList)) !== null) {
      pmids.push(match[1]);
    }
    
    console.log(`Found ${pmids.length} PMIDs in current batch.`);
    
    // If there are more results than we got in this batch and maxResults is less than totalResults,
    // we could implement pagination here in future by using the WebEnv and QueryKey parameters
    if (totalResults > pmids.length && pmids.length < maxResults) {
      console.log(`Note: There are ${totalResults - pmids.length} more results available.`);
      // Future enhancement: Implement pagination for very large result sets
    }
    
    await delay(REQUEST_DELAY_MS);
    
    return pmids;
  } catch (error) {
    console.error('Error searching PubMed:', error);
    return [];
  }
}

// Function to fetch article details from PubMed
async function fetchPubMedDetails(pmids) {
  if (!pmids || pmids.length === 0) {
    return [];
  }
  
  console.log(`Fetching details for ${pmids.length} PMIDs...`);
  
  const fetchUrl = `${BASE_URL}efetch.fcgi`;
  const data = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
    api_key: PUBMED_API_KEY,
  });
  
  try {
    const response = await axios.post(fetchUrl, data);
    const responseText = response.data;
    
    // Process each article
    const articles = [];
    const articleRegex = /<PubmedArticle>.*?<\/PubmedArticle>/gs;
    let articleMatch;
    
    while ((articleMatch = articleRegex.exec(responseText)) !== null) {
      const articleXml = articleMatch[0];
      
      // Extract PMID
      const pmidMatch = articleXml.match(/<PMID.*?>(\d+)<\/PMID>/);
      const pmid = pmidMatch ? pmidMatch[1] : null;
      
      // Extract Title
      const titleMatch = articleXml.match(/<ArticleTitle>(.*?)<\/ArticleTitle>/s);
      const title = titleMatch ? cleanXmlText(titleMatch[1]) : null;
      
      // Extract Abstract
      let abstract = 'No abstract available.';
      const abstractMatch = articleXml.match(/<Abstract>.*?<\/Abstract>/s);
      
      if (abstractMatch) {
        const abstractTextMatches = abstractMatch[0].match(/<AbstractText.*?>(.*?)<\/AbstractText>/gs);
        
        if (abstractTextMatches) {
          const abstractParts = abstractTextMatches.map(match => {
            const labelMatch = match.match(/<AbstractText Label="(.*?)".*?>/);
            const label = labelMatch ? labelMatch[1].toUpperCase() + ': ' : '';
            
            const textMatch = match.match(/<AbstractText.*?>(.*?)<\/AbstractText>/s);
            const text = textMatch ? cleanXmlText(textMatch[1]) : '';
            
            return label + text;
          });
          
          abstract = abstractParts.join('\n');
        }
      }
      
      // Extract Authors
      const authorsList = [];
      const authorListMatch = articleXml.match(/<AuthorList.*?>.*?<\/AuthorList>/s);
      
      if (authorListMatch) {
        const authorMatches = authorListMatch[0].match(/<Author.*?>.*?<\/Author>/gs);
        
        if (authorMatches) {
          for (const authorMatch of authorMatches) {
            const lastNameMatch = authorMatch.match(/<LastName>(.*?)<\/LastName>/);
            const initialsMatch = authorMatch.match(/<Initials>(.*?)<\/Initials>/);
            
            if (lastNameMatch && initialsMatch) {
              authorsList.push(`${cleanXmlText(lastNameMatch[1])}, ${cleanXmlText(initialsMatch[1])}`);
            } else if (lastNameMatch) {
              authorsList.push(cleanXmlText(lastNameMatch[1]));
            }
          }
        }
      }
      
      // Extract Journal
      const journalMatch = articleXml.match(/<Journal>.*?<Title>(.*?)<\/Title>.*?<\/Journal>/s);
      const journal = journalMatch ? cleanXmlText(journalMatch[1]) : null;
      
      // Extract Publication Year
      let pubYear = null;
      const yearMatch = articleXml.match(/<PubDate>.*?<Year>(.*?)<\/Year>.*?<\/PubDate>/s);
      
      if (yearMatch) {
        pubYear = yearMatch[1];
      } else {
        const medlineDateMatch = articleXml.match(/<PubDate>.*?<MedlineDate>(.*?)<\/MedlineDate>.*?<\/PubDate>/s);
        
        if (medlineDateMatch) {
          const yearInMedlineMatch = medlineDateMatch[1].match(/(\d{4})/);
          
          if (yearInMedlineMatch) {
            pubYear = yearInMedlineMatch[1];
          }
        }
      }
      
      // Add the article if we have at least the PMID and title
      if (pmid && title) {
        articles.push({
          pmid,
          title,
          abstract,
          authors: authorsList.join('; '),
          journal,
          pubYear,
        });
      }
    }
    
    await delay(REQUEST_DELAY_MS);
    return articles;
  } catch (error) {
    console.error('Error fetching PubMed details:', error);
    return [];
  }
}

// Function to generate AI summary and classification using Gemini
async function generateAISummaryWithClassification(abstract, title) {
  // Maximum number of retries
  const MAX_RETRIES = 3;
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES} to generate summary and classification for: "${title.substring(0, 50)}..."`);
      
      // Direct API call to Gemini API
      const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent";
      
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: `Analyze the following medical research abstract and perform two tasks:

TASK 1: Summarize the abstract in 3-5 concise sentences. Focus on the key findings, methodology, and implications. Use clear, professional language suitable for medical professionals.

TASK 2: Classify this paper into ONE of these categories:
- Clinical trial (if it describes a clinical study with patients, trials, treatments, or outcomes)
- Translational (if it bridges basic science and clinical applications, involves biomarkers, pathways, or mechanisms with clinical relevance)
- Basic science (if it focuses on fundamental biology, laboratory experiments, animal models, cellular/molecular mechanisms)
- Other (if it doesn't clearly fit any of the above categories)

Title: ${title}
Abstract:
${abstract}

Format your response exactly like this:
SUMMARY: [Your 3-5 sentence summary]
CLASSIFICATION: [Single category name]`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1500
        }
      };
      
      console.log("Making API call to Gemini for summary and classification");
      const response = await axios.post(
        `${geminiEndpoint}?key=${GEMINI_API_KEY}`, 
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );
      
      // Extract the response text
      if (response.data && 
          response.data.candidates && 
          response.data.candidates[0] && 
          response.data.candidates[0].content && 
          response.data.candidates[0].content.parts && 
          response.data.candidates[0].content.parts[0]) {
        
        const responseText = response.data.candidates[0].content.parts[0].text.trim();
        
        // Parse the response to extract summary and classification
        const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]*?)(?=CLASSIFICATION:|$)/i);
        const classificationMatch = responseText.match(/CLASSIFICATION:\s*(.*?)(?:\n|$)/i);
        
        const summary = summaryMatch ? summaryMatch[1].trim() : generateFallbackSummary(abstract);
        
        // Validate the classification to ensure it's one of our expected categories
        let classification = 'Other';
        if (classificationMatch) {
          const rawClassification = classificationMatch[1].trim();
          if (/clinical\s*trial/i.test(rawClassification)) {
            classification = 'Clinical trial';
          } else if (/translational/i.test(rawClassification)) {
            classification = 'Translational';
          } else if (/basic\s*science/i.test(rawClassification)) {
            classification = 'Basic science';
          }
        }
        
        console.log(`Generated summary (${summary.length} chars) and classification: ${classification}`);
        return { summary, classification };
      } else {
        throw new Error("Unexpected response structure from Gemini API");
      }
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${retryCount + 1}/${MAX_RETRIES} failed:`, error.message);
      
      // Exponential backoff with jitter for retries
      if (retryCount < MAX_RETRIES - 1) {
        const backoffTime = Math.floor(Math.random() * 1000 + 1000 * Math.pow(2, retryCount));
        console.log(`Retrying in ${backoffTime}ms...`);
        await delay(backoffTime);
      }
      retryCount++;
    }
  }
  
  // All retries failed, use fallback
  console.error('All attempts to generate AI summary failed:', lastError.response?.data || lastError.message || lastError);
  return { 
    summary: generateFallbackSummary(abstract),
    classification: 'Other'
  };
}

// Fallback summary generation when Gemini API fails
function generateFallbackSummary(abstract) {
  try {
    console.log("Using fallback summary generation method");
    
    // Very basic approach: Extract the first sentence of each paragraph
    const paragraphs = abstract.split('\n').filter(p => p.trim().length > 0);
    
    // For each paragraph, extract the first sentence
    const firstSentences = paragraphs.map(paragraph => {
      // Split by common sentence-ending punctuation
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      if (sentences.length > 0) {
        // Get the first sentence, or truncate if it's too long
        let firstSentence = sentences[0];
        if (firstSentence.length > 100) {
          firstSentence = firstSentence.substring(0, 97) + '...';
        }
        return firstSentence;
      }
      return '';
    }).filter(sentence => sentence.length > 0);
    
    // Join first sentences from each paragraph, limiting to 3 sentences max
    let summary = firstSentences.slice(0, 3).join(' ');
    
    // Add disclaimer
    summary += ' (Note: This is an extractive summary due to AI model unavailability)';
    
    return summary;
  } catch (err) {
    console.error('Error in fallback summary generation:', err);
    return "Summary unavailable. Please read the abstract for details about this research.";
  }
}

// Main API handler
export async function POST(request) {
  try {
    // Get the journals and date range from the request
    const { journals, dateRange } = await request.json();
    
    if (!journals || journals.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No journals provided' 
      }, { status: 400 });
    }
    
    // Calculate the date range - either custom or default last 7 days
    let startDate, endDate;
    
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      // Use custom date range
      startDate = new Date(dateRange.startDate);
      endDate = new Date(dateRange.endDate);
      
      // Set the end date to the end of the day (23:59:59)
      endDate.setHours(23, 59, 59, 999);
      
      console.log(`Using custom date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      // Use default last 7 days
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);
      
      console.log(`Using default date range (last 7 days): ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }
    
    // Validate dates are proper Date objects
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid date range provided' 
      }, { status: 400 });
    }
    
    // Format dates for PubMed query
    const formatDate = (date) => {
      return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    };
    
    // Build the journal terms for PubMed search
    const journalTerms = journals.map(journal => {
      // Handle both string journals and journal objects with name property
      const journalName = typeof journal === 'string' ? journal : journal.name;
      return `"${journalName}"[Journal]`;
    }).join(' OR ');
    
    // Build the title/abstract terms for oncology-related content
    const titleAbstractTerms = (
      "carcinoma[Title/Abstract] OR " +
      "adenocarcinoma[Title/Abstract] OR " +
      "sarcoma[Title/Abstract] OR " +
      "melanoma[Title/Abstract] OR " +
      "cancer[Title/Abstract] OR " +
      "tumor[Title/Abstract] OR " +
      "oncology[Title/Abstract]"
    );
    
    const pubmedDateRange = `"${formatDate(startDate)}"[Date - Publication] : "${formatDate(endDate)}"[Date - Publication]`;
    
    // Build the full PubMed search query
    const searchQuery = `(${titleAbstractTerms}) AND (${journalTerms}) AND (${pubmedDateRange}) AND hasabstract`;
    
    // Search PubMed for matching articles
    const pmids = await searchPubMed(searchQuery);
    
    if (pmids.length === 0) {
      return NextResponse.json({
        success: true,
        digestId: null,
        message: 'No articles found for the selected date range',
        digest: {
          weekStart: startDate.toISOString(),
          weekEnd: endDate.toISOString(),
          articleCount: 0,
        },
        articles: []
      });
    }
    
    // Fetch article details from PubMed
    const articles = await fetchPubMedDetails(pmids);
    
    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        digestId: null,
        message: 'Failed to fetch article details',
        digest: {
          weekStart: startDate.toISOString(),
          weekEnd: endDate.toISOString(),
          articleCount: 0,
        },
        articles: []
      });
    }
    
    // Process each article and add AI summary
    const processedArticles = [];
    const processLimit = Math.min(articles.length, 50); // Increased from 15 to 50
    
    for (let i = 0; i < processLimit; i++) {
      const article = articles[i];
      
      try {
        // Generate AI summary if abstract is available
        let aiSummary = null;
        let articleType = 'Other'; // Default classification
        
        if (article.abstract && article.abstract !== 'No abstract available.') {
          const { summary, classification } = await generateAISummaryWithClassification(article.abstract, article.title);
          aiSummary = summary;
          articleType = classification;
        }
        
        processedArticles.push({
          ...article,
          aiSummary,
          articleType, // Store the AI-generated classification
          digestId: 'current', // Will be updated with actual digestId
        });
      } catch (error) {
        console.error(`Error processing article ${article.pmid}:`, error);
      }
      
      // Add a small delay between article processing
      await delay(50);
    }
    
    // Create digest data with descriptive name based on date range
    const digestId = Date.now().toString();
    
    // Create a readable date format for display
    const formatDisplayDate = (date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };
    
    const digestTitle = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
    
    const digestData = {
      id: digestId,
      title: digestTitle,
      weekStart: startDate.toISOString(),
      weekEnd: endDate.toISOString(),
      createdAt: new Date().toISOString(),
      articleCount: processedArticles.length,
    };
    
    // Update the digestId for all articles
    const articlesWithDigestId = processedArticles.map(article => ({
      ...article,
      digestId
    }));
    
    return NextResponse.json({
      success: true,
      digestId,
      message: `Successfully generated digest with ${processedArticles.length} articles`,
      digest: digestData,
      articles: articlesWithDigestId
    });
  } catch (error) {
    console.error('Error generating digest:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An error occurred during digest generation'
    }, { status: 500 });
  }
} 