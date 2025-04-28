const functions = require('@google-cloud/functions-framework');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Firebase Admin
const app = initializeApp();
const db = getFirestore();

// Initialize Gemini API
const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBhPw5XyhH9i7i778DsmX1oGa9cPns_wWM'; // Replace with environment variable in production
const genAI = new GoogleGenerativeAI(API_KEY);

// PubMed API settings
const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
const PUBMED_API_KEY = process.env.PUBMED_API_KEY || "77e480329e7293ae3c9984c5346a98cc5b08"; // Replace with environment variable in production
const REQUEST_DELAY_MS = 150; // Delay between PubMed API requests

// HTTP Cloud Function for manual triggering
functions.http('generateDigest', async (req, res) => {
  try {
    const digestId = await generateWeeklyDigest();
    res.status(200).send({ success: true, digestId });
  } catch (error) {
    console.error('Error generating digest:', error);
    res.status(500).send({ success: false, error: error.message });
  }
});

// Background Cloud Function for scheduled execution
functions.cloudEvent('scheduledDigestGeneration', async (cloudEvent) => {
  try {
    const digestId = await generateWeeklyDigest();
    console.log(`Scheduled digest generation completed. Digest ID: ${digestId}`);
    return { success: true, digestId };
  } catch (error) {
    console.error('Error in scheduled digest generation:', error);
    throw error;
  }
});

// Main function to generate the weekly digest
async function generateWeeklyDigest() {
  console.log('Starting weekly digest generation...');
  
  // Calculate the date range for this week
  const today = new Date();
  const endDate = today;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 7);
  
  console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  // Create a new digest document
  const digestRef = await db.collection('digests').add({
    weekStart: Timestamp.fromDate(startDate),
    weekEnd: Timestamp.fromDate(endDate),
    createdAt: FieldValue.serverTimestamp(),
    articleCount: 0,
  });
  
  console.log(`Created new digest with ID: ${digestRef.id}`);
  
  // Get the list of journals to search
  const journalsSnapshot = await db.collection('journals').get();
  const journals = [];
  journalsSnapshot.forEach(doc => {
    journals.push(doc.data().name);
  });
  
  console.log(`Found ${journals.length} journals to search`);
  
  if (journals.length === 0) {
    console.log('No journals configured. Skipping article fetching.');
    return digestRef.id;
  }
  
  // Build the journal terms for PubMed search
  const journalTerms = journals.map(journal => `"${journal}"[Journal]`).join(' OR ');
  
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
  
  // Format dates for PubMed query
  const formatDate = (date) => {
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  };
  
  const dateRange = `"${formatDate(startDate)}"[Date - Publication] : "${formatDate(endDate)}"[Date - Publication]`;
  
  // Build the full PubMed search query
  const searchQuery = `(${titleAbstractTerms}) AND (${journalTerms}) AND (${dateRange}) AND hasabstract`;
  
  console.log(`PubMed search query: ${searchQuery}`);
  
  // Search PubMed for matching articles
  const pmids = await searchPubMed(searchQuery);
  
  if (!pmids || pmids.length === 0) {
    console.log('No articles found for the current week.');
    return digestRef.id;
  }
  
  console.log(`Found ${pmids.length} articles. Fetching details...`);
  
  // Fetch article details from PubMed
  const articles = await fetchPubMedDetails(pmids);
  
  if (!articles || articles.length === 0) {
    console.log('Failed to fetch article details.');
    return digestRef.id;
  }
  
  console.log(`Successfully fetched details for ${articles.length} articles.`);
  
  // Process each article and add to Firestore
  let processedCount = 0;
  
  for (const article of articles) {
    try {
      // Generate AI summary if abstract is available
      let aiSummary = null;
      
      if (article.abstract && article.abstract !== 'No abstract available.') {
        aiSummary = await generateAISummary(article.abstract);
      }
      
      // Add article to Firestore
      await db.collection('articles').add({
        digestId: digestRef.id,
        pmid: article.pmid,
        title: article.title,
        authors: article.authors,
        journal: article.journal,
        pubYear: article.pub_year,
        abstract: article.abstract,
        aiSummary: aiSummary,
        createdAt: FieldValue.serverTimestamp(),
      });
      
      processedCount++;
    } catch (error) {
      console.error(`Error processing article ${article.pmid}:`, error);
    }
    
    // Add a small delay to avoid overwhelming Firestore
    await delay(50);
  }
  
  // Update the digest with the actual article count
  await digestRef.update({
    articleCount: processedCount,
  });
  
  console.log(`Digest generation completed. Added ${processedCount} articles to digest ${digestRef.id}`);
  
  return digestRef.id;
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
    
    // Simplistic XML parsing (for production, consider a proper XML parser)
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
    return null;
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
          pub_year: pubYear,
        });
      }
    }
    
    await delay(REQUEST_DELAY_MS);
    return articles;
  } catch (error) {
    console.error('Error fetching PubMed details:', error);
    return null;
  }
}

// Function to generate AI summary using Gemini
async function generateAISummary(abstract) {
  try {
    // const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
    
    const prompt = `
      Summarize the following medical research abstract in 3-5 concise sentences. 
      Focus on the key findings, methodology, and implications. 
      Use clear, professional language that would be suitable for medical professionals.
      
      Abstract:
      ${abstract}
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text.trim();
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return null;
  }
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

// Helper function for delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
} 