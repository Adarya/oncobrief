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

// Function to search PubMed for articles based on topic
async function searchPubMedByTopic(topic, additionalKeywords, journals, timeRange, maxResults = 100) {
  console.log(`Searching PubMed for topic: '${topic}' with additional keywords: ${additionalKeywords.join(', ')}`);
  
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
  
  // Add journal filter if provided
  if (journals && journals.length > 0) {
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
      const relativeDate = new Date();
      relativeDate.setMonth(relativeDate.getMonth() - timeRange.months);
      const fromDate = relativeDate.toISOString().split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];
      
      dateFilter = `${fromDate}:${toDate}[Date - Publication]`;
    } else if (timeRange.start && timeRange.end) {
      // For absolute date ranges
      dateFilter = `${timeRange.start}:${timeRange.end}[Date - Publication]`;
    }
    
    if (dateFilter) {
      searchTerms = `${searchTerms} AND ${dateFilter}`;
    }
  }
  
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
    console.log(`PubMed search query: ${searchTerms}`);
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
      return { pmids: [], totalResults };
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
    
    return { pmids, totalResults };
  } catch (error) {
    console.error('Error searching PubMed:', error);
    return { pmids: [], totalResults: 0 };
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
  
  // Extract and combine all abstracts
  const combinedAbstracts = articles.map(a => {
    return `TITLE: ${a.title}\nJOURNAL: ${a.journal}\nABSTRACT: ${a.abstract}\n---`;
  }).join('\n\n');
  
  // Format time range for the prompt
  let timeRangeText = 'recent months';
  if (timeRange) {
    if (timeRange.type === 'relative') {
      timeRangeText = `the last ${timeRange.months} months`;
    } else if (timeRange.start && timeRange.end) {
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
      
      // Direct API call to Gemini API
      const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent";
      
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: `You are a medical research analyst specializing in oncology. Analyze the following collection of research abstracts about "${topic}"${keywordsText} published during ${timeRangeText}.

Task: Create a comprehensive yet concise meta-analysis summary that:
1. Identifies major discoveries and advances related to ${topic}
2. Highlights consistent findings across multiple papers
3. Notes any contradictory results or open questions
4. Summarizes the most promising research directions
5. Identifies key methodological approaches being used
6. Suggests implications for clinical practice when relevant

Format your response in these sections:
1. OVERVIEW: A brief introduction to the research landscape for ${topic} during this period
2. KEY FINDINGS: The most significant discoveries, organized by theme
3. RESEARCH TRENDS: Methodological approaches and emerging directions
4. CLINICAL IMPLICATIONS: Relevant findings for medical practice (if applicable)
5. FUTURE DIRECTIONS: Where the field appears to be heading

Here are the research abstracts:

${combinedAbstracts}

Provide a scholarly, objective analysis suitable for medical professionals.`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000
        }
      };
      
      console.log("Making API call to Gemini for meta-analysis summary");
      const response = await axios.post(
        `${geminiEndpoint}?key=${GEMINI_API_KEY}`, 
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout for longer processing
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
        
        // Parse sections from the response
        const sections = {
          overview: extractSection(summaryText, 'OVERVIEW'),
          keyFindings: extractSection(summaryText, 'KEY FINDINGS'),
          researchTrends: extractSection(summaryText, 'RESEARCH TRENDS'),
          clinicalImplications: extractSection(summaryText, 'CLINICAL IMPLICATIONS'),
          futureDirections: extractSection(summaryText, 'FUTURE DIRECTIONS')
        };
        
        console.log(`Generated meta-analysis summary with ${summaryText.length} chars`);
        return {
          fullText: summaryText,
          sections
        };
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
  
  // All retries failed, return a basic summary
  console.error('All attempts to generate meta-analysis summary failed:', lastError.response?.data || lastError.message || lastError);
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
  const regex = new RegExp(`${sectionName}:\\s*(.*?)(?=\\n\\d+\\.\\s+[A-Z]|$)`, 's');
  const match = text.match(regex);
  return match ? match[1].trim() : `No ${sectionName.toLowerCase()} section found.`;
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
      timeRange = { type: 'relative', months: 6 }
    } = body;
    
    console.log(`Topic search API called with topic: ${topic}, keywords: ${additionalKeywords.join(', ')}`);
    
    // Validate required parameters
    if (!topic) {
      return NextResponse.json({ success: false, error: 'Topic is required' }, { status: 400 });
    }
    
    // Search PubMed for articles matching the topic
    const { pmids, totalResults } = await searchPubMedByTopic(
      topic, 
      additionalKeywords, 
      journals, 
      timeRange,
      50 // Get up to 50 results for a comprehensive analysis
    );
    
    console.log(`Found ${pmids.length} articles matching the search criteria (${totalResults} total)`);
    
    if (pmids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No articles found matching the search criteria.',
        searchParams: { topic, additionalKeywords, journals, timeRange },
        totalResults
      });
    }
    
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
      journals,
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
      totalResults
    });
    
  } catch (error) {
    console.error('Error processing topic search:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to process search: ${error.message}`
    }, { status: 500 });
  }
} 