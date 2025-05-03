import React, { useState, useEffect } from 'react';
import PodcastPlayer from './PodcastPlayer';

const ResearchSummary = ({ summary }) => {
  if (!summary || !summary.sections) return null;

  // Add state for podcast generation
  const [generating, setGenerating] = useState(false);
  const [podcastData, setPodcastData] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');

  // Function to handle podcast generation
  const handleGeneratePodcast = async () => {
    try {
      setGenerating(true);
      setError(null);
      setStatus('Preparing your research podcast...');

      const response = await fetch('/api/generateResearchPodcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summary }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate podcast');
      }

      setPodcastData(data);
      setStatus('');
    } catch (err) {
      console.error('Error generating podcast:', err);
      setError(`Failed to generate podcast: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Function to parse a section's text into structured points
  const parseSectionText = (text) => {
    if (!text || typeof text !== 'string') return [];

    // 1. Remove common headers/prefixes and asterisks first
    let cleanedText = text
      .replace(/^\*\*\d+\.\s*(?:Overview|Key Findings|Research Trends|Clinical Implications|Future Directions):\*\*\s*/i, '')
      .replace(/^\d+\.\s*/, '') // Remove leading numbers like "1. "
      .replace(/\*\*/g, '') // Remove all double asterisks
      .trim();
      
    // Remove section headers from other sections that might have been included
    const sectionHeaders = [
      /\d+\.\s*KEY FINDINGS:/i,
      /\d+\.\s*RESEARCH TRENDS:/i, 
      /\d+\.\s*CLINICAL IMPLICATIONS:/i,
      /\d+\.\s*FUTURE DIRECTIONS:/i
    ];
    
    // Also look for numeric markers like "2." or "3." at the beginning of a line
    const numericMarkers = /\n\s*\d+\.\s*(?![\d])(?![a-z])/i;
    
    // Find earliest boundary marker and truncate
    let firstHeaderIndex = -1;
    for (const headerPattern of sectionHeaders) {
      const match = cleanedText.match(headerPattern);
      if (match && match.index >= 0) {
        firstHeaderIndex = firstHeaderIndex === -1 ? match.index : Math.min(firstHeaderIndex, match.index);
      }
    }
    const numericMatch = cleanedText.match(numericMarkers);
    if (numericMatch && numericMatch.index >= 0) {
      firstHeaderIndex = firstHeaderIndex === -1 ? numericMatch.index : Math.min(firstHeaderIndex, numericMatch.index);
    }
    if (firstHeaderIndex > -1) {
      cleanedText = cleanedText.substring(0, firstHeaderIndex).trim();
    }
    
    // Finally, split cleanedText into sentences for bullets
    const sentences = cleanedText
      .split(/\.(?=\s)/)                // Split at period followed by space
      .map(s => s.trim())                 // Trim whitespace
      .filter(s => s.length > 0)         // Remove empty
      .map(s => s.endsWith('.') ? s : s + '.'); // Ensure trailing period
    return sentences;
  };

  // Process each section
  const overview = parseSectionText(summary.sections.overview);
  const keyFindings = parseSectionText(summary.sections.keyFindings);
  const researchTrends = parseSectionText(summary.sections.researchTrends);
  const clinicalImplications = parseSectionText(summary.sections.clinicalImplications);
  const futureDirections = parseSectionText(summary.sections.futureDirections);

  const renderSection = (title, points, colorClass) => {
    if (!points || points.length === 0) return null;

    // Define bullet color class based on section color
    let bulletColorClass;
    let headerColorClass;
    switch(colorClass) {
      case 'border-indigo-500':
        bulletColorClass = 'bg-indigo-500';
        headerColorClass = 'text-indigo-700';
        break;
      case 'border-green-500':
        bulletColorClass = 'bg-green-500';
        headerColorClass = 'text-green-700';
        break;
      case 'border-blue-500':
        bulletColorClass = 'bg-blue-500';
        headerColorClass = 'text-blue-700';
        break;
      case 'border-purple-500':
        bulletColorClass = 'bg-purple-500';
        headerColorClass = 'text-purple-700';
        break;
      case 'border-orange-500':
        bulletColorClass = 'bg-orange-500';
        headerColorClass = 'text-orange-700';
        break;
      default:
        bulletColorClass = 'bg-gray-500';
        headerColorClass = 'text-gray-700';
    }

    return (
      <section className={`border-l-4 ${colorClass} pl-4 py-2 mb-4`}>
        <h3 className={`text-lg font-semibold ${headerColorClass} mb-3`}>
          {title}
        </h3>
        <ul className="space-y-3">
          {points.map((point, index) => (
            <li key={index} className="flex items-start">
              <span className={`mt-1.5 mr-3 h-2.5 w-2.5 rounded-full ${bulletColorClass} flex-shrink-0`} aria-hidden="true"/>
              <p className="text-gray-800 text-base leading-relaxed">{point}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg shadow-md">
      <header className="border-b border-gray-200 pb-4 mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Research Summary</h2>
        <p className="text-gray-600 mt-1 text-sm">AI-generated summary of recent research findings</p>
      </header>
      
      {renderSection('Overview', overview, 'border-indigo-500')}
      {renderSection('Key Findings', keyFindings, 'border-green-500')}
      {renderSection('Research Trends', researchTrends, 'border-blue-500')}
      {renderSection('Clinical Implications', clinicalImplications, 'border-purple-500')}
      {renderSection('Future Directions', futureDirections, 'border-orange-500')}
      
      {/* Podcast generation button */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Audio Format</h3>
          
          {!podcastData ? (
            <button
              onClick={handleGeneratePodcast}
              disabled={generating}
              className={`inline-flex items-center px-4 py-2 rounded-md ${
                generating 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {generating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 017.072 0m-9.9-2.828a9 9 0 0112.728 0" />
                  </svg>
                  Generate Research Podcast
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setPodcastData(null)}
              className="text-indigo-600 hover:text-indigo-800"
            >
              Hide Podcast
            </button>
          )}
        </div>
        
        {status && (
          <div className="mt-4 p-3 bg-indigo-50 text-indigo-700 rounded-md">
            <div className="flex items-center">
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {status}
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}
        
        {podcastData && (
          <div className="mt-4">
            <PodcastPlayer 
              audioUrl={podcastData.audioUrl} 
              scriptUrl={podcastData.scriptUrl} 
              digestTitle={summary.topic || "Research Summary"} 
            />
          </div>
        )}
      </div>
      
      {/* Footer with disclaimer */}
      <footer className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 italic">
        <p>This summary was generated using AI and may not capture all nuances of the research. Always refer to the original articles for critical analysis.</p>
      </footer>
    </div>
  );
};

export default ResearchSummary; 