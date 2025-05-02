'use client';

import { useState, useEffect, useRef } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import {
  saveTopicSearch,
  saveTopicSummary,
  getJournals
} from '../utils/localStorage';

export default function TopicExplorer() {
  // Search parameters
  const [topic, setTopic] = useState('APOBEC');
  const [additionalKeywords, setAdditionalKeywords] = useState(['Cancer', 'Tumor']);
  const [timeRange, setTimeRange] = useState({ type: 'relative', months: 6 });
  const [selectedJournals, setSelectedJournals] = useState([]);
  const [availableJournals, setAvailableJournals] = useState([]);
  const [customDateRange, setCustomDateRange] = useState({ 
    start: format(new Date(new Date().setMonth(new Date().getMonth() - 6)), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [fallbackToAllJournals, setFallbackToAllJournals] = useState(true);
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [journalFilterWasRemoved, setJournalFilterWasRemoved] = useState(false);
  
  // Timeline visualization refs
  const timelineContainerRef = useRef(null);
  
  // Load available journals
  useEffect(() => {
    const journals = getJournals();
    setAvailableJournals(journals);
    if (journals.length > 0) {
      setSelectedJournals(journals.map(j => j.name));
    }
  }, []);
  
  // Handle adding a new keyword
  const handleAddKeyword = () => {
    if (newKeyword.trim() && !additionalKeywords.includes(newKeyword.trim())) {
      setAdditionalKeywords([...additionalKeywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };
  
  // Handle removing a keyword
  const handleRemoveKeyword = (keywordToRemove) => {
    setAdditionalKeywords(additionalKeywords.filter(kw => kw !== keywordToRemove));
  };
  
  // Handle journal selection
  const handleJournalSelection = (journal) => {
    if (selectedJournals.includes(journal)) {
      setSelectedJournals(selectedJournals.filter(j => j !== journal));
    } else {
      setSelectedJournals([...selectedJournals, journal]);
    }
  };
  
  // Calculate position for timeline items
  const calculateTimelinePosition = (pubDate, earliestDate, latestDate) => {
    if (!pubDate) return 50; // Default to middle if no date
    
    try {
      const date = parseISO(pubDate);
      if (!isValid(date)) return 50;
      
      const earliest = earliestDate ? parseISO(earliestDate) : new Date(0);
      const latest = latestDate ? parseISO(latestDate) : new Date();
      
      const totalRange = latest.getTime() - earliest.getTime();
      if (totalRange <= 0) return 50;
      
      const position = ((date.getTime() - earliest.getTime()) / totalRange) * 100;
      return Math.max(0, Math.min(100, position));
    } catch (error) {
      return 50;
    }
  };
  
  // Group articles by publication date (for timeline)
  const groupArticlesByDate = (articles) => {
    const groups = {};
    
    articles.forEach(article => {
      if (!article.pubDate) return;
      
      // Only use year-month for grouping to reduce clutter
      const yearMonth = article.pubDate.substring(0, 7); // "YYYY-MM"
      if (!groups[yearMonth]) {
        groups[yearMonth] = [];
      }
      groups[yearMonth].push(article);
    });
    
    return groups;
  };

  // Validate dates to ensure they're not in the future
  const validateDateRange = (range) => {
    const today = new Date();
    
    if (range.type === 'absolute') {
      // Convert end date if it's in the future
      const endDate = new Date(range.end);
      if (endDate > today) {
        return {
          ...range,
          end: format(today, 'yyyy-MM-dd')
        };
      }
    }
    
    return range;
  };
  
  // Handle search submission
  const handleSearch = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSearchResults(null);
    setJournalFilterWasRemoved(false);
    
    try {
      // Validate timeRange to avoid future dates
      const validatedTimeRange = validateDateRange(
        timeRange.type === 'custom' 
          ? { type: 'absolute', start: customDateRange.start, end: customDateRange.end }
          : { type: 'relative', months: timeRange.months }
      );
      
      // Prepare search parameters
      const searchParams = {
        topic: topic.trim(),
        additionalKeywords: additionalKeywords.filter(kw => kw.trim() !== ''),
        journals: selectedJournals,
        timeRange: validatedTimeRange,
        fallbackToAllJournals
      };
      
      // Call the API
      const response = await fetch('/api/topicSearch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to search for topic');
      }
      
      if (!data.success) {
        throw new Error(data.error || 'No results found');
      }
      
      // Save successful search to localStorage
      if (data.articles && data.articles.length > 0) {
        // Save the search
        const savedSearch = saveTopicSearch({
          ...data.searchParams,
          articleCount: data.articles.length,
        });
        
        // Save the summary
        if (data.summary) {
          saveTopicSummary({
            searchId: savedSearch.id,
            ...data.summary
          });
        }
        
        // Update the searchId in the results
        data.searchId = savedSearch.id;
      }
      
      // Check if journal filter was bypassed to get results
      setJournalFilterWasRemoved(data.journalFilterRemoved === true);
      
      // Set the search results
      setSearchResults(data);
      
    } catch (err) {
      console.error('Error in topic search:', err);
      setError(err.message || 'Failed to complete the search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'MMM d, yyyy') : 'Unknown date';
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Topic Explorer</h1>
        
        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Search Parameters</h2>
          
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Main Topic */}
            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
                Main Topic
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., APOBEC"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            
            {/* Additional Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Keywords
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {additionalKeywords.map((keyword, index) => (
                  <span 
                    key={index} 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-indigo-400 hover:text-indigo-700"
                    >
                      <span className="sr-only">Remove {keyword}</span>
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add a keyword..."
                  className="flex-1 min-w-0 block px-3 py-2 border border-gray-300 rounded-none rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none"
                >
                  Add
                </button>
              </div>
            </div>
            
            {/* Time Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Range
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="last6months"
                    name="timeRange"
                    checked={timeRange.type === 'relative' && timeRange.months === 6}
                    onChange={() => setTimeRange({ type: 'relative', months: 6 })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="last6months" className="ml-2 block text-sm text-gray-700">
                    Last 6 months
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="last12months"
                    name="timeRange"
                    checked={timeRange.type === 'relative' && timeRange.months === 12}
                    onChange={() => setTimeRange({ type: 'relative', months: 12 })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="last12months" className="ml-2 block text-sm text-gray-700">
                    Last 12 months
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="custom"
                    name="timeRange"
                    checked={timeRange.type === 'custom'}
                    onChange={() => setTimeRange({ type: 'custom' })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="custom" className="ml-2 block text-sm text-gray-700">
                    Custom range
                  </label>
                </div>
              </div>
              
              {timeRange.type === 'custom' && (
                <div className="mt-3 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange({...customDateRange, start: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      value={customDateRange.end}
                      onChange={(e) => setCustomDateRange({...customDateRange, end: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Journals */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Journals to Search
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                {availableJournals.length === 0 ? (
                  <p className="text-gray-500 text-sm">No journals configured. Please add journals in the Admin page.</p>
                ) : (
                  availableJournals.map(journal => (
                    <div key={journal.id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={`journal-${journal.id}`}
                        checked={selectedJournals.includes(journal.name)}
                        onChange={() => handleJournalSelection(journal.name)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`journal-${journal.id}`} className="ml-2 block text-sm text-gray-700">
                        {journal.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {selectedJournals.length} journals selected
              </p>
              
              <div className="mt-2 flex items-center">
                <input
                  type="checkbox"
                  id="fallbackToAllJournals"
                  checked={fallbackToAllJournals}
                  onChange={() => setFallbackToAllJournals(!fallbackToAllJournals)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="fallbackToAllJournals" className="ml-2 text-sm text-gray-700">
                  Search all journals if no results found in selected journals
                </label>
              </div>
            </div>
            
            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </>
                ) : 'Search Topic'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Results */}
        {searchResults && searchResults.articles && searchResults.articles.length > 0 && (
          <div className="space-y-8">
            {journalFilterWasRemoved && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      No results found in your selected journals. Showing results from all available journals.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Meta Analysis Summary */}
            {searchResults.summary && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Research Summary: {searchResults.searchParams.topic}</h2>
                
                {(searchResults.summary.sections && 
                  Object.values(searchResults.summary.sections).some(section => !section.includes('No') && !section.includes('Unable'))) ? (
                  <div className="space-y-4">
                    {/* Overview Section */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">Overview</h3>
                      <p className="text-gray-700">{searchResults.summary.sections.overview}</p>
                    </div>
                    
                    {/* Key Findings Section */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">Key Findings</h3>
                      <p className="text-gray-700">{searchResults.summary.sections.keyFindings}</p>
                    </div>
                    
                    {/* Research Trends Section */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">Research Trends</h3>
                      <p className="text-gray-700">{searchResults.summary.sections.researchTrends}</p>
                    </div>
                    
                    {/* Clinical Implications Section */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">Clinical Implications</h3>
                      <p className="text-gray-700">{searchResults.summary.sections.clinicalImplications}</p>
                    </div>
                    
                    {/* Future Directions Section */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">Future Directions</h3>
                      <p className="text-gray-700">{searchResults.summary.sections.futureDirections}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Summary Generation Failed</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>
                            We couldn't generate a summary for these search results. This might be because:
                          </p>
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            <li>The search returned articles with future publication dates</li>
                            <li>The articles don't have enough content for analysis</li>
                            <li>There was an issue with the summary generation service</li>
                          </ul>
                          <p className="mt-2">
                            You can still browse the articles below.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Timeline Visualization */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Publication Timeline
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({searchResults.articles.length} publications)
                </span>
              </h2>
              
              <div 
                ref={timelineContainerRef} 
                className="relative h-96 overflow-x-hidden border-t border-b border-gray-200 my-4"
              >
                {/* Timeline Line */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-300"></div>
                
                {/* Date markers first */}
                {(() => {
                  // Find earliest and latest dates
                  const dates = searchResults.articles
                    .map(a => a.pubDate)
                    .filter(Boolean)
                    .sort();
                  
                  const earliestDate = dates[0];
                  const latestDate = dates[dates.length - 1];
                  
                  // Group articles by year-month
                  const articlesByDate = groupArticlesByDate(searchResults.articles);
                  const dateKeys = Object.keys(articlesByDate).sort();
                  
                  // Render each date marker
                  return dateKeys.map((dateKey, index) => {
                    const articles = articlesByDate[dateKey];
                    const position = calculateTimelinePosition(
                      `${dateKey}-15`, // use middle of month for positioning
                      earliestDate,
                      latestDate
                    );
                    
                    // Format date as "Mon YYYY"
                    const formattedDate = format(parseISO(`${dateKey}-15`), 'MMM yyyy');
                    
                    return (
                      <div
                        key={dateKey}
                        className="absolute z-20"
                        style={{
                          left: `${position}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {/* Date marker line */}
                        <div className="h-10 w-0.5 bg-gray-400"></div>
                        
                        {/* Date label */}
                        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                          <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-1 rounded-md">
                            {formattedDate}
                            <span className="ml-1 text-xs text-indigo-600">({articles.length})</span>
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
                
                {/* Article points */}
                {searchResults.articles.map((article, index) => {
                  // Find earliest and latest dates
                  const dates = searchResults.articles
                    .map(a => a.pubDate)
                    .filter(Boolean)
                    .sort();
                  
                  const earliestDate = dates[0];
                  const latestDate = dates[dates.length - 1];
                  
                  // Calculate horizontal position based on publication date
                  const position = calculateTimelinePosition(article.pubDate, earliestDate, latestDate);
                  
                  // Calculate vertical positions with more spacing
                  // Alternate above and below the timeline, but with more spacing
                  const verticalPosition = index % 2 === 0 
                    ? 30 - (Math.floor(index / 10) * 5) 
                    : 70 + (Math.floor(index / 10) * 5);
                  
                  return (
                    <div 
                      key={article.pmid}
                      className={`absolute cursor-pointer transition-all duration-200 ${selectedArticle?.pmid === article.pmid ? 'z-30' : 'z-10'}`}
                      style={{ 
                        left: `${position}%`, 
                        top: `${verticalPosition}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      onClick={() => setSelectedArticle(selectedArticle?.pmid === article.pmid ? null : article)}
                    >
                      {/* Dot */}
                      <div 
                        className={`h-4 w-4 rounded-full border-2 ${selectedArticle?.pmid === article.pmid 
                          ? 'border-indigo-600 bg-indigo-200 ring-4 ring-indigo-100' 
                          : 'border-gray-400 bg-white hover:border-indigo-400 hover:bg-indigo-50'}`}
                      ></div>
                      
                      {/* Article Detail Popup */}
                      {selectedArticle?.pmid === article.pmid && (
                        <div 
                          className={`absolute ${
                            verticalPosition < 50 ? 'bottom-full mb-3' : 'top-full mt-3'
                          } left-1/2 transform -translate-x-1/2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-40`}
                        >
                          <div className="text-xs font-semibold text-gray-500 mb-1">
                            {article.journal} · {formatDate(article.pubDate)}
                          </div>
                          <h4 className="text-sm font-medium text-gray-800 mb-2">{article.title}</h4>
                          <div className="text-xs text-gray-600 line-clamp-3 mb-2">
                            {article.abstract.substring(0, 150)}...
                          </div>
                          <a 
                            href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            View on PubMed →
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-between text-xs text-gray-500 mt-4">
                <span className="font-medium">
                  {searchResults.articles.reduce((earliest, article) => {
                    if (!article.pubDate) return earliest;
                    return !earliest || article.pubDate < earliest ? article.pubDate : earliest;
                  }, null) ? formatDate(searchResults.articles.reduce((earliest, article) => {
                    if (!article.pubDate) return earliest;
                    return !earliest || article.pubDate < earliest ? article.pubDate : earliest;
                  }, null)) : 'Unknown date'}
                </span>
                <span className="font-medium">
                  {searchResults.articles.reduce((latest, article) => {
                    if (!article.pubDate) return latest;
                    return !latest || article.pubDate > latest ? article.pubDate : latest;
                  }, null) ? formatDate(searchResults.articles.reduce((latest, article) => {
                    if (!article.pubDate) return latest;
                    return !latest || article.pubDate > latest ? article.pubDate : latest;
                  }, null)) : 'Unknown date'}
                </span>
              </div>
            </div>
            
            {/* Articles List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Publications
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({searchResults.articles.length} results)
                </span>
              </h2>
              
              <div className="space-y-4">
                {searchResults.articles.map(article => (
                  <div 
                    key={article.pmid}
                    className="border-b border-gray-200 pb-4 last:border-0 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => window.open(`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}`, '_blank')}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="text-md font-medium text-gray-800">{article.title}</h3>
                      <span className="text-sm text-gray-500 whitespace-nowrap ml-2">
                        {formatDate(article.pubDate)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{article.authors}</div>
                    <div className="text-sm font-medium text-indigo-600 mt-1">{article.journal}</div>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">{article.abstract}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 