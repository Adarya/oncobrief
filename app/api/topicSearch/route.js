import { NextResponse } from 'next/server';
import axios from 'axios';
import { format } from 'date-fns';

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

// Function to search PubMed for articles based on topic
async function searchPubMedByTopic(topic, additionalKeywords, journals, timeRange, maxResults = 100, fallbackToAllJournals = false) {
  console.log(`Searching PubMed for topic: '${topic}' with additional keywords: ${additionalKeywords.join(', ')}`);
  
  // Perform initial search with journals if provided
  const results = await attemptPubMedSearch(topic, additionalKeywords, journals, timeRange, maxResults);
  
  // Only perform fallback if explicitly requested via parameter
  // This allows the caller to control whether to fallback or not
  if (results.pmids.length === 0 && fallbackToAllJournals && journals && journals.length > 0) {
    console.log("No results found with journal filter. Trying search without journal restrictions...");
    const widerResults = await attemptPubMedSearch(topic, additionalKeywords, [], timeRange, maxResults);
    
    // Return both the results and a flag indicating we removed the journal filter
    return {
      ...widerResults,
      journalFilterRemoved: true
    };
  }
  
  // Return results with a flag indicating we used the journal filter as requested
  return {
    ...results,
    journalFilterRemoved: false
  };
}

// Helper function to perform PubMed search with given parameters
async function attemptPubMedSearch(topic, additionalKeywords, journals, timeRange, maxResults = 100) {
  // Prepare search terms
  let searchTerms = `${topic}[Title/Abstract]`;
  
  // Add additional keywords if provided
  if (additionalKeywords && additionalKeywords.length > 0) {
    const keywordTerms = additionalKeywords
      .filter(kw => kw.trim() !== '')
      .map(kw => `${kw.trim()}[Title/Abstract]`)
      .join(' OR ');
    
    if (keywordTerms) {
      searchTerms = `${searchTerms} AND (${keywordTerms})`;
    }
  }
  
  // Track if we're using a journal filter
  const usingJournalFilter = journals && journals.length > 0;
  
  // Add journal filter if provided
  if (usingJournalFilter) {
    const journalTerms = journals
      .filter(j => j.trim() !== '')
      .map(j => `"${j.trim()}"[Journal]`)
      .join(' OR ');
    
    if (journalTerms) {
      searchTerms = `${searchTerms} AND (${journalTerms})`;
    }
  }
  
  // Add date range if provided
  if (timeRange) {
    let dateFilter = '';
    
    if (timeRange.type === 'relative') {
      // For relative time ranges like "last 6 months"
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - timeRange.months);
      
      // Format dates as YYYY/MM/DD for PubMed
      const fromDateStr = fromDate.toISOString().split('T')[0].replace(/-/g, '/');
      const toDateStr = toDate.toISOString().split('T')[0].replace(/-/g, '/');
      
      dateFilter = `${fromDateStr}:${toDateStr}[Date - Publication]`;
    } else if (timeRange.type === 'absolute') {
      // For absolute date ranges, convert format from YYYY-MM-DD to YYYY/MM/DD
      // Also ensure we're not using future dates
      const today = new Date();
      const endDate = new Date(timeRange.end);
      
      // Use the earlier of the two - requested end date or today
      const actualEndDate = endDate > today ? today : endDate;
      
      const fromDateStr = timeRange.start.replace(/-/g, '/');
      const toDateStr = format(actualEndDate, 'yyyy/MM/dd');
      
      dateFilter = `${fromDateStr}:${toDateStr}[Date - Publication]`;
    }
    
    if (dateFilter) {
      searchTerms = `${searchTerms} AND ${dateFilter}`;
    }
  }
  
  // Log the constructed query
  console.log(`PubMed search query: ${searchTerms}`);
  
  const searchUrl = `${BASE_URL}esearch.fcgi`;
  const params = {
    db: 'pubmed',
    term: searchTerms,
    retmax: maxResults.toString(),
    usehistory: 'y',
    api_key: PUBMED_API_KEY,
    sort: 'date',
  };
  
  try {
    const response = await axios.get(searchUrl, { params });
    
    // Parse the XML response
    const responseText = response.data;
    
    // Extract count of total results
    const countMatch = responseText.match(/<Count>(\d+)<\/Count>/);
    const totalResults = countMatch ? parseInt(countMatch[1]) : 0;
    console.log(`Total results found: ${totalResults}`);
    
    // Extract PMIDs
    const idListMatch = responseText.match(/<IdList>(.*?)<\/IdList>/s);
    
    if (!idListMatch) {
      console.log('No IdList found in response');
      return { pmids: [], totalResults, journalFilterRemoved: false };
    }
    
    const idList = idListMatch[1];
    const pmids = [];
    
    const idRegex = /<Id>(\d+)<\/Id>/g;
    let match;
    
    while ((match = idRegex.exec(idList)) !== null) {
      pmids.push(match[1]);
    }
    
    console.log(`Found ${pmids.length} PMIDs in current batch.`);
    
    await delay(REQUEST_DELAY_MS);
    
    return { 
      pmids, 
      totalResults,
      journalFilterRemoved: false // This function itself doesn't remove journal filters
    };
  } catch (error) {
    console.error('Error searching PubMed:', error);
    return { 
      pmids: [], 
      totalResults: 0,
      journalFilterRemoved: false 
    };
  }
}

// Function to fetch article details from PubMed (same as generateDigest route)
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
      
      // Extract Publication Date for timeline sorting
      let pubDate = null;
      const monthMatch = articleXml.match(/<PubDate>.*?<Month>(.*?)<\/Month>.*?<\/PubDate>/s);
      const dayMatch = articleXml.match(/<PubDate>.*?<Day>(.*?)<\/Day>.*?<\/PubDate>/s);
      
      if (pubYear) {
        const month = monthMatch ? monthMatch[1] : '01';
        const day = dayMatch ? dayMatch[1] : '01';
        
        // Convert month name to number if needed
        let monthNum = month;
        if (isNaN(parseInt(month))) {
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthIndex = monthNames.findIndex(m => month.toLowerCase().startsWith(m));
          monthNum = monthIndex >= 0 ? (monthIndex + 1).toString().padStart(2, '0') : '01';
        }
        
        pubDate = `${pubYear}-${monthNum.padStart(2, '0')}-${day.padStart(2, '0')}`;
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
          pubDate
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

// Function to generate meta-analysis summary for a collection of articles
async function generateMetaAnalysisSummary(articles, topic, additionalKeywords, timeRange) {
  // Maximum number of retries
  const MAX_RETRIES = 3;
  let retryCount = 0;
  let lastError = null;
  
  // Check if we have enough articles with actual content to analyze
  const articlesWithContent = articles.filter(article => 
    article.abstract && 
    article.abstract.length > 50 &&
    article.abstract !== "No abstract available."
  );
  
  if (articlesWithContent.length < 3) {
    console.log(`Not enough articles with content to analyze: ${articlesWithContent.length} of ${articles.length}`);
    return { 
      fullText: `Insufficient content for analysis: ${articlesWithContent.length} of ${articles.length} articles have usable abstracts.`,
      sections: {
        overview: `This is a collection of ${articles.length} research papers about ${topic}, but only ${articlesWithContent.length} have sufficient content for analysis.`,
        keyFindings: "Unable to generate key findings summary due to insufficient content.",
        researchTrends: "Unable to analyze research trends due to insufficient content.",
        clinicalImplications: "Unable to determine clinical implications due to insufficient content.",
        futureDirections: "Unable to suggest future directions due to insufficient content."
      }
    };
  }
  
  // Only process current and past articles - filter out future dates
  const currentDate = new Date();
  const validArticles = articlesWithContent.filter(article => {
    if (!article.pubDate) return true; // Include if no date (conservative approach)
    const articleDate = new Date(article.pubDate);
    return articleDate <= currentDate;
  });
  
  console.log(`Filtering for valid dates: ${validArticles.length} of ${articlesWithContent.length} articles have valid publication dates`);
  
  if (validArticles.length < 3) {
    console.log(`Not enough articles with valid dates to analyze: ${validArticles.length}`);
    return { 
      fullText: `Insufficient content for analysis: found ${validArticles.length} articles with valid publication dates.`,
      sections: {
        overview: `This collection includes ${articles.length} research papers about ${topic}, but many have future publication dates, limiting analysis.`,
        keyFindings: "Unable to generate key findings summary due to insufficient content with valid publication dates.",
        researchTrends: "Unable to analyze research trends due to articles with future publication dates.",
        clinicalImplications: "Unable to determine clinical implications due to insufficient validated content.",
        futureDirections: "Unable to suggest future directions due to data limitations."
      }
    };
  }
  
  // Use a smaller subset of articles if we have too many (to avoid token limits)
  const maxArticlesToAnalyze = 15;
  const selectedArticles = validArticles.length > maxArticlesToAnalyze 
    ? validArticles.slice(0, maxArticlesToAnalyze)
    : validArticles;
  
  // Sort by publication date (newest first) and then extract reduced abstracts
  selectedArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  // Extract and combine all abstracts with more structure
  const combinedAbstracts = selectedArticles.map((a, index) => {
    // Use a max of 500 chars per abstract to avoid hitting token limits
    const truncatedAbstract = a.abstract.length > 500 
      ? a.abstract.substring(0, 500) + '...' 
      : a.abstract;
      
    return `ARTICLE ${index + 1}:
TITLE: ${a.title}
JOURNAL: ${a.journal}
DATE: ${a.pubDate || 'Unknown'}
ABSTRACT: ${truncatedAbstract}
------`;
  }).join('\n\n');
  
  // Format time range for the prompt
  let timeRangeText = 'recent months';
  if (timeRange) {
    if (timeRange.type === 'relative') {
      timeRangeText = `the last ${timeRange.months} months`;
    } else if (timeRange.type === 'absolute' && timeRange.start && timeRange.end) {
      timeRangeText = `the period from ${timeRange.start} to ${timeRange.end}`;
    }
  }
  
  // Additional keywords text for context
  const keywordsText = additionalKeywords && additionalKeywords.length > 0 
    ? ` with a focus on ${additionalKeywords.join(', ')}` 
    : '';
  
  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES} to generate meta-analysis summary for topic: "${topic}"`);
      
      // Simpler, more focused prompt - using direct instructions rather than role-play
      const geminiPrompt = `Analyze the following research abstracts about "${topic}"${keywordsText} and create a research summary with these five specific sections:

1. OVERVIEW: A brief introduction to the research landscape for ${topic}
2. KEY FINDINGS: The most significant discoveries organized by theme
3. RESEARCH TRENDS: Methodological approaches and emerging directions
4. CLINICAL IMPLICATIONS: Relevant findings for medical practice
5. FUTURE DIRECTIONS: Where the field appears to be heading

For each section, provide 3-5 sentences of concise, factual analysis based only on the provided abstracts.

Format your response with section headers clearly marked.

Here are the abstracts to analyze:

${combinedAbstracts}`;

      // Direct API call to Gemini API
      const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
      
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: geminiPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          stopSequences: []
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };
      
      // Log prompt length for debugging
      console.log(`Gemini prompt length: ${geminiPrompt.length} chars`);
      
      console.log("Making API call to Gemini for meta-analysis summary");
      const response = await axios.post(
        `${geminiEndpoint}?key=${GEMINI_API_KEY}`, 
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 90000 // 90 second timeout for longer processing
        }
      );
      
      // Extract the response text
      if (response.data && 
          response.data.candidates && 
          response.data.candidates[0] && 
          response.data.candidates[0].content && 
          response.data.candidates[0].content.parts && 
          response.data.candidates[0].content.parts[0]) {
        
        const summaryText = response.data.candidates[0].content.parts[0].text.trim();
        
        // Check if we got a meaningful response
        if (!summaryText || summaryText.length < 50) {
          console.log(`Empty or very short summary returned: "${summaryText}"`);
          throw new Error("Empty or insufficient summary generated");
        }
        
        // Parse sections from the response
        const sections = {
          overview: extractSection(summaryText, 'OVERVIEW'),
          keyFindings: extractSection(summaryText, 'KEY FINDINGS'),
          researchTrends: extractSection(summaryText, 'RESEARCH TRENDS'),
          clinicalImplications: extractSection(summaryText, 'CLINICAL IMPLICATIONS'),
          futureDirections: extractSection(summaryText, 'FUTURE DIRECTIONS')
        };
        
        // Verify we have at least some content in sections
        const validSections = Object.values(sections).filter(text => 
          text && text.length > 20 && 
          !text.includes("No") && 
          !text.includes("Unable")
        );
        
        if (validSections.length < 3) {
          console.log(`Not enough valid sections in response (${validSections.length}/5)`);
          throw new Error("Insufficient section content generated");
        }
        
        console.log(`Generated meta-analysis summary with ${summaryText.length} chars and ${validSections.length}/5 valid sections`);
        return {
          fullText: summaryText,
          sections
        };
      } else {
        console.error("Unexpected response structure from Gemini API:", JSON.stringify(response.data));
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
  
  // All retries failed, return a basic summary
  console.error('All attempts to generate meta-analysis summary failed:', lastError);
  return { 
    fullText: `Failed to generate a comprehensive meta-analysis for ${topic}. Please try again later.`,
    sections: {
      overview: `This is a collection of ${articles.length} research papers about ${topic} published in ${timeRangeText}.`,
      keyFindings: "Unable to generate key findings summary.",
      researchTrends: "Unable to analyze research trends.",
      clinicalImplications: "Unable to determine clinical implications.",
      futureDirections: "Unable to suggest future directions."
    }
  };
}

// Helper function to extract a section from the summary
function extractSection(text, sectionName) {
  try {
    const regex = new RegExp(`${sectionName}:\\s*(.*?)(?=\\n\\d+\\.\\s+[A-Z]|$)`, 's');
    const match = text.match(regex);
    
    if (match && match[1] && match[1].trim().length > 5) {
      return match[1].trim();
    } else {
      const fallbackRegex = new RegExp(`${sectionName}[:\\s]+(.*?)(?=\\n[A-Z\\d]|$)`, 's');
      const fallbackMatch = text.match(fallbackRegex);
      
      if (fallbackMatch && fallbackMatch[1] && fallbackMatch[1].trim().length > 5) {
        return fallbackMatch[1].trim();
      }
    }
    
    return `No ${sectionName.toLowerCase()} section found.`;
  } catch (error) {
    console.error(`Error extracting ${sectionName} section:`, error);
    return `Error extracting ${sectionName.toLowerCase()} section.`;
  }
}

// Main API handler
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Extract search parameters
    const {
      topic = 'APOBEC',
      additionalKeywords = [],
      journals = [],
      timeRange = { type: 'relative', months: 6 },
      fallbackToAllJournals = true
    } = body;
    
    console.log(`Topic search API called with topic: ${topic}, keywords: ${additionalKeywords.join(', ')}`);
    
    // Validate required parameters
    if (!topic) {
      return NextResponse.json({ success: false, error: 'Topic is required' }, { status: 400 });
    }
    
    // Search PubMed for articles matching the topic with selected journals
    const results = await searchPubMedByTopic(
      topic, 
      additionalKeywords, 
      journals, 
      timeRange,
      50, // Get up to 50 results for a comprehensive analysis
      fallbackToAllJournals
    );
    
    const { pmids, totalResults, journalFilterRemoved } = results;
    
    // If no results, return an error
    if (pmids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No articles found matching the search criteria.',
        searchParams: { topic, additionalKeywords, journals, timeRange },
        totalResults
      });
    }
    
    console.log(`Found ${pmids.length} articles matching the search criteria (${totalResults} total)`);
    
    // Fetch details for the found PMIDs
    const articles = await fetchPubMedDetails(pmids);
    
    if (articles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch article details.',
        searchParams: { topic, additionalKeywords, journals, timeRange },
        totalResults
      });
    }
    
    // Sort articles by publication date (newest first)
    articles.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
      const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
      return dateB - dateA;
    });
    
    // Create a search record for reference
    const searchRecord = {
      topic,
      additionalKeywords,
      journals: journalFilterRemoved ? [] : journals, // Reflect actual journals used
      timeRange,
      resultCount: articles.length,
      totalResults,
      searchDate: new Date().toISOString()
    };
    
    // Generate meta-analysis summary for the collected articles
    const summary = await generateMetaAnalysisSummary(
      articles, 
      topic, 
      additionalKeywords, 
      timeRange
    );
    
    // Return the search results
    return NextResponse.json({
      success: true,
      searchId: Date.now().toString(), // Client can use this to save the search
      searchParams: searchRecord,
      articles,
      summary,
      totalResults,
      journalFilterRemoved
    });
    
  } catch (error) {
    console.error('Error processing topic search:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to process search: ${error.message}`
    }, { status: 500 });
  }
} 