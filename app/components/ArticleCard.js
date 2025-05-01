'use client';

import { useState } from 'react';

export default function ArticleCard({ article }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!article) return null;
  
  const {
    title,
    journal,
    authors,
    pubYear,
    abstract,
    aiSummary,
    articleType
  } = article;

  // Shorten long journal names
  const getShortenedJournalName = (journalName) => {
    if (journalName && journalName.toLowerCase().startsWith('journal of clinical oncology')) {
      return 'Journal of clinical oncology';
    }
    return journalName;
  };

  // Use the AI-determined classification if available, otherwise fall back to keyword-based classification
  const getArticleType = (article) => {
    // If the articleType property exists and is not empty, use it directly
    if (article.articleType && article.articleType.trim() !== '') {
      return article.articleType;
    }
    
    // Fall back to keyword-based classification for backward compatibility
    const textToAnalyze = `${article.title} ${article.abstract}`.toLowerCase();
    
    // Clinical trial indicators
    if (
      textToAnalyze.includes('trial') || 
      textToAnalyze.includes('phase') ||
      textToAnalyze.includes('randomized')
    ) {
      return 'Clinical trial';
    }
    
    // Translational research indicators
    if (
      textToAnalyze.includes('biomarker') ||
      textToAnalyze.includes('targeted') ||
      textToAnalyze.includes('mechanism') ||
      textToAnalyze.includes('pathway') ||
      textToAnalyze.includes('expression') ||
      textToAnalyze.includes('mutational')
    ) {
      return 'Translational';
    }
    
    // Basic science indicators
    if (
      textToAnalyze.includes('model') ||
      textToAnalyze.includes('mouse') ||
      textToAnalyze.includes('vitro') ||
      textToAnalyze.includes('vivo') ||
      textToAnalyze.includes('cell') ||
      textToAnalyze.includes('molecular') ||
      textToAnalyze.includes('genetic')
    ) {
      return 'Basic science';
    }
    
    // Default classification
    return 'Other';
  };

  // Get article classification
  const displayArticleType = getArticleType(article);

  // Generate a consistent color based on journal name
  const getJournalColor = (journalName) => {
    // Simple hash function to turn journal name into a hue value (0-360)
    let hash = 0;
    for (let i = 0; i < journalName.length; i++) {
      hash = journalName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsla(${hue}, 70%, 50%, 0.15)`;
  };

  // Get color for article type tag
  const getArticleTypeColor = (type) => {
    switch (type) {
      case 'Clinical trial':
        return { bg: 'bg-blue-100', text: 'text-blue-800' };
      case 'Translational':
        return { bg: 'bg-purple-100', text: 'text-purple-800' };
      case 'Basic science':
        return { bg: 'bg-green-100', text: 'text-green-800' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800' };
    }
  };

  const shortenedJournal = getShortenedJournalName(journal);
  const journalColor = getJournalColor(shortenedJournal);
  const journalTextColor = getJournalColor(shortenedJournal).replace('0.15', '1');
  const typeColors = getArticleTypeColor(displayArticleType);
  
  return (
    <div className={`bg-white border border-gray-100 rounded-lg shadow-md overflow-hidden transition-all duration-200 ${expanded ? 'ring-2 ring-indigo-300' : 'hover:shadow-lg'}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            <span 
              className="inline-block text-xs font-semibold px-2 py-1 rounded-full" 
              style={{ 
                backgroundColor: journalColor,
                color: journalTextColor
              }}
            >
              {shortenedJournal}
            </span>
            <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${typeColors.bg} ${typeColors.text}`}>
              {displayArticleType}
            </span>
          </div>
          <span className="text-sm text-gray-500">{pubYear}</span>
        </div>
        
        <h3 className="text-xl font-bold mb-2 text-gray-800 line-clamp-2 hover:line-clamp-none cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {title}
        </h3>
        
        <p className="text-sm text-gray-500 mb-4 line-clamp-1">
          {authors}
        </p>
        
        {aiSummary ? (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-indigo-600 mb-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Summary
            </h4>
            <div className={`text-sm text-gray-700 ${expanded ? '' : 'line-clamp-3'}`}>
              {aiSummary}
            </div>
          </div>
        ) : null}
        
        {expanded && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Abstract</h4>
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {abstract}
            </p>
          </div>
        )}
        
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center focus:outline-none"
          >
            {expanded ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Show Less
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Show More
              </>
            )}
          </button>
          
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-indigo-600 text-sm flex items-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            PubMed
          </a>
        </div>
      </div>
    </div>
  );
} 