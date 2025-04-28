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
async function searchPubMed(query, maxResults = 50) {
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
    
    console.log(`Found ${pmids.length} PMIDs.`);
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

// Function to generate AI summary using Gemini - Direct API implementation
async function generateAISummary(abstract) {
  try {
    // Direct API call to Gemini API matching the Python implementation
    // Bypassing the Node.js SDK implementation that adds "models/" prefix
    // const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent";
    const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent";
    
    const requestData = {
      contents: [
        {
          parts: [
            {
              text: `Summarize the following medical research abstract in 3-5 concise sentences. 
                     Focus on the key findings, methodology, and implications. 
                     Use clear, professional language that would be suitable for medical professionals.
                     Make sure your summary is complete and ends properly with a concluding thought.
                     
                     Abstract:
                     ${abstract}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500 // Increase max tokens to ensure complete summaries
      }
    };
    
    console.log("Making direct API call to Gemini");
    const response = await axios.post(
      `${geminiEndpoint}?key=${GEMINI_API_KEY}`, 
      requestData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract the summary from the response
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0]) {
      return response.data.candidates[0].content.parts[0].text.trim();
    } else {
      console.warn("Unexpected response structure from Gemini API:", JSON.stringify(response.data, null, 2));
      return generateFallbackSummary(abstract);
    }
  } catch (error) {
    console.error('Error generating AI summary:', error.response?.data || error.message || error);
    return generateFallbackSummary(abstract);
  }
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
    const journalTerms = journals.map(journal => `"${journal.name}"[Journal]`).join(' OR ');
    
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
    const processLimit = Math.min(articles.length, 15); // Limit to 15 articles for performance
    
    for (let i = 0; i < processLimit; i++) {
      const article = articles[i];
      
      try {
        // Generate AI summary if abstract is available
        let aiSummary = null;
        
        if (article.abstract && article.abstract !== 'No abstract available.') {
          aiSummary = await generateAISummary(article.abstract);
        }
        
        processedArticles.push({
          ...article,
          aiSummary,
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