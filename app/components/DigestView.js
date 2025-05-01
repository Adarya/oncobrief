'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import ArticleCard from './ArticleCard';
import PodcastPlayer from './PodcastPlayer';
import { 
  getDigestById, 
  getArticlesByDigestId, 
  getPodcastByDigestId, 
  savePodcast, 
  getAllArticles,
  fixArticlesDigestId
} from '../utils/localStorage';

export default function DigestView({ digestId }) {
  const [digest, setDigest] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [podcast, setPodcast] = useState(null);
  const [generatingPodcast, setGeneratingPodcast] = useState(false);
  const [generatingPodcastStatus, setGeneratingPodcastStatus] = useState('');
  const [podcastError, setPodcastError] = useState(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [fixedArticles, setFixedArticles] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showFilter, setShowFilter] = useState(false);
  const [filterJournal, setFilterJournal] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [showSort, setShowSort] = useState(false);
  const [reportTierView, setReportTierView] = useState(false);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    const fetchDigestData = () => {
      if (!digestId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get the digest
        const digestData = getDigestById(digestId);
        
        if (!digestData) {
          setError('Digest not found');
          setLoading(false);
          return;
        }
        
        setDigest({
          id: digestData.id,
          title: digestData.title,
          weekStart: new Date(digestData.weekStart || Date.now()),
          weekEnd: new Date(digestData.weekEnd || Date.now()),
          articleCount: digestData.articleCount || 0,
        });
        
        // Get all articles for this digest
        let articlesData = getArticlesByDigestId(digestId);
        
        // If no articles found, try to fix the digest ID associations
        if (articlesData.length === 0) {
          console.log('No articles found for digestId:', digestId);
          console.log('Attempting to fix articles without digestId...');
          
          // Fix articles without digestId
          const fixed = fixArticlesDigestId(digestId);
          setFixedArticles(fixed);
          
          if (fixed) {
            console.log('Articles fixed, retrieving updated list');
            articlesData = getArticlesByDigestId(digestId);
          }
          
          // If still no articles, check if any exist at all
          if (articlesData.length === 0) {
            const allArticles = getAllArticles();
            console.log(`Found ${allArticles.length} total articles in storage`);
            
            if (allArticles.length > 0) {
              console.log('Showing all articles as a fallback');
              articlesData = allArticles;
            }
          }
        }
        
        setArticles(articlesData);
        
        // Get podcast if available
        const podcastData = getPodcastByDigestId(digestId);
        setPodcast(podcastData);
      } catch (err) {
        console.error('Error fetching digest data:', err);
        setError('Failed to load digest data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDigestData();
  }, [digestId]);
  
  const handleGeneratePodcast = async () => {
    if (!digest || articles.length === 0) {
      setPodcastError('No articles available to generate podcast');
      return;
    }
    
    setGeneratingPodcast(true);
    setPodcastError(null);
    setGeneratingPodcastStatus('Preparing your podcast...');
    
    try {
      // Call the API to generate a podcast
      const response = await fetch('/api/generatePodcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          digestId: digest.id,
          digestTitle: digest.title || formatDateRange(digest.weekStart, digest.weekEnd),
          articles: articles,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate podcast');
      }
      
      console.log('Podcast generated:', data);
      
      // Update podcast state with the new data
      setPodcast({
        digestId: digest.id,
        audioUrl: data.audioUrl,
        scriptUrl: data.scriptUrl,
        script: data.script,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error generating podcast:', err);
      setPodcastError(`Failed to generate podcast: ${err.message}`);
    } finally {
      setGeneratingPodcast(false);
      setGeneratingPodcastStatus('');
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    
    if (!digest || articles.length === 0 || !emailAddress) {
      setEmailError('Please enter your email address');
      return;
    }
    
    setEmailSending(true);
    setEmailError(null);
    
    try {
      // Call the API to send the email
      const response = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmail: emailAddress,
          digestId: digest.id,
          digestTitle: digest.title || formatDateRange(digest.weekStart, digest.weekEnd),
          articlesOverride: articles,
          podcastUrl: podcast ? window.location.origin + podcast.audioUrl : null,
        }),
      });
      
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send email');
      }
      
      // Show success message and clear email input
      setEmailSuccess(true);
      setEmailAddress('');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setEmailSuccess(false);
      }, 5000);
    } catch (err) {
      console.error('Error sending email:', err);
      setEmailError(err.message || 'An error occurred while sending the email');
    } finally {
      setEmailSending(false);
    }
  };
  
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="spinner"></div>
        <p className="mt-4 text-gray-600">Loading digest content...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
        <p>{error}</p>
      </div>
    );
  }
  
  if (!digest) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No digest selected. Please choose a week from the dropdown.</p>
      </div>
    );
  }
  
  const formatDateRange = (start, end) => {
    try {
      // Ensure both dates are valid
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
        return "Invalid date range";
      }
      return `${format(start, 'MMMM d')} - ${format(end, 'MMMM d, yyyy')}`;
    } catch (error) {
      console.error("Error formatting date range:", error);
      return "Invalid date range";
    }
  };
  
  const digestTitle = digest.title || `Week of ${formatDateRange(digest.weekStart, digest.weekEnd)}`;
  
  // Group articles by type into report tiers
  const getArticlesByTier = () => {
    // Tier 1: Clinical trials and translational research
    const tier1Articles = articles.filter(article => {
      const type = article.articleType || getArticleTypeFromKeywords(article);
      return type === 'Clinical trial' || type === 'Translational';
    });
    
    // Tier 2: Basic science and other
    const tier2Articles = articles.filter(article => {
      const type = article.articleType || getArticleTypeFromKeywords(article);
      return type === 'Basic science' || type === 'Other';
    });
    
    return { tier1Articles, tier2Articles };
  };
  
  // Helper function to get article type from keywords (fallback method)
  const getArticleTypeFromKeywords = (article) => {
    const textToAnalyze = `${article.title} ${article.abstract}`.toLowerCase();
    
    if (textToAnalyze.includes('trial') || textToAnalyze.includes('phase') || textToAnalyze.includes('randomized')) {
      return 'Clinical trial';
    }
    
    if (textToAnalyze.includes('biomarker') || textToAnalyze.includes('targeted') || 
        textToAnalyze.includes('mechanism') || textToAnalyze.includes('pathway')) {
      return 'Translational';
    }
    
    if (textToAnalyze.includes('model') || textToAnalyze.includes('vitro') || 
        textToAnalyze.includes('vivo') || textToAnalyze.includes('cell')) {
      return 'Basic science';
    }
    
    return 'Other';
  };
  
  // Filter articles by type
  const filterArticlesByType = (articlesToFilter) => {
    if (!filterType) return articlesToFilter;
    
    return articlesToFilter.filter(article => {
      const type = article.articleType || getArticleTypeFromKeywords(article);
      return type === filterType;
    });
  };

  // Modify the existing filteredArticles definition to include type filtering:
  const filteredArticles = filterArticlesByType(
    articles.filter(article => {
      // Apply existing journal and year filters
      if (filterJournal && article.journal !== filterJournal) return false;
      if (filterYear && article.pubYear !== filterYear) return false;
      return true;
    })
  );
  
  // Get articles grouped by tier
  const { tier1Articles, tier2Articles } = getArticlesByTier();
  
  const handleSort = (field, direction) => {
    const sortedArticles = [...filteredArticles].sort((a, b) => {
      const valueA = a[field].toLowerCase();
      const valueB = b[field].toLowerCase();
      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setArticles(sortedArticles);
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-100">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{digestTitle}</h2>
          
          <div className="flex space-x-2">
            {podcast ? (
              <button onClick={() => window.open(podcast.audioUrl, '_blank')} className="inline-flex items-center text-indigo-600 hover:text-indigo-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 017.072 0m-9.9-2.828a9 9 0 0112.728 0" />
                </svg>
                Listen to Podcast
              </button>
            ) : (
              <button 
                onClick={handleGeneratePodcast} 
                disabled={generatingPodcast}
                className={`inline-flex items-center ${generatingPodcast ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-800'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 017.072 0m-9.9-2.828a9 9 0 0112.728 0" />
                </svg>
                {generatingPodcast ? 'Generating...' : 'Generate Podcast'}
              </button>
            )}
            
            <button 
              onClick={() => setShowEmailForm(!showEmailForm)} 
              className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Digest
            </button>
          </div>
        </div>
        
        {showEmailForm && (
          <div className="bg-gray-50 p-4 mb-6 rounded-md">
            <form onSubmit={handleSendEmail} className="flex flex-wrap gap-2">
              <div className="flex-grow">
                <input 
                  type="email" 
                  value={emailAddress} 
                  onChange={(e) => setEmailAddress(e.target.value)} 
                  placeholder="Enter your email address" 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={emailSending} 
                className={`px-4 py-2 rounded-md text-white ${emailSending ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {emailSending ? 'Sending...' : 'Send'}
              </button>
            </form>
            
            {emailError && (
              <div className="mt-2 text-red-600 text-sm">{emailError}</div>
            )}
            
            {emailSuccess && (
              <div className="mt-2 text-green-600 text-sm">Email sent successfully!</div>
            )}
          </div>
        )}
        
        {generatingPodcastStatus && (
          <div className="mb-4 bg-indigo-50 p-3 rounded-md text-indigo-700">
            <div className="flex items-center">
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {generatingPodcastStatus}
            </div>
          </div>
        )}
        
        {podcastError && (
          <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
            <p className="font-bold">Error</p>
            <p>{podcastError}</p>
          </div>
        )}
        
        {fixedArticles && (
          <div className="mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
            <p className="font-bold">Note</p>
            <p>We've fixed some article associations for this digest. Please let us know if you notice any issues.</p>
          </div>
        )}
        
        {podcast && (
          <div className="mb-6">
            <PodcastPlayer audioUrl={podcast.audioUrl} />
          </div>
        )}
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">
              Articles ({articles.length})
            </h3>
            
            <div className="flex space-x-3">
              {/* View toggle buttons */}
              <div className="flex bg-gray-100 rounded-md p-1">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
                  aria-label="Grid View"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
                  aria-label="List View"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
              
              {/* Report Tier Toggle */}
              <div className="flex items-center space-x-2 bg-white rounded-md p-2 shadow-sm">
                <span className="text-sm text-gray-600">View Mode:</span>
                <button
                  onClick={() => setReportTierView(false)}
                  className={`px-3 py-1 text-sm rounded-md ${!reportTierView ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  All Articles
                </button>
                <button
                  onClick={() => setReportTierView(true)}
                  className={`px-3 py-1 text-sm rounded-md ${reportTierView ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  By Classification
                </button>
              </div>
              
              {/* Filter and Sort Options */}
              <div className="flex flex-col sm:flex-row mb-6 space-y-2 sm:space-y-0 sm:space-x-2">
                {/* View Mode Toggle */}
                <div className="flex items-center space-x-2 bg-white rounded-md p-2 shadow-sm">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1 rounded-md ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded-md ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                
                {/* Filter Button and Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowFilter(!showFilter);
                      if (showSort) setShowSort(false);
                    }}
                    className="flex items-center justify-center space-x-1 bg-white px-4 py-2 rounded-md shadow-sm text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span>Filter</span>
                  </button>
                  
                  {showFilter && (
                    <div className="absolute z-10 mt-2 w-64 bg-white rounded-md shadow-lg p-4">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Journal</label>
                        <select
                          value={filterJournal}
                          onChange={(e) => setFilterJournal(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">All Journals</option>
                          {Array.from(new Set(articles.map(a => a.journal))).map(journal => (
                            <option key={journal} value={journal}>{journal}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                        <select
                          value={filterYear}
                          onChange={(e) => setFilterYear(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">All Years</option>
                          {Array.from(new Set(articles.map(a => a.pubYear))).sort((a, b) => b - a).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Article Type</label>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">All Types</option>
                          <option value="Clinical trial">Clinical trial</option>
                          <option value="Translational">Translational</option>
                          <option value="Basic science">Basic science</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setFilterJournal('');
                            setFilterYear('');
                            setFilterType('');
                          }}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          Reset Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Replace the articles display section with a conditional rendering based on report tier view */}
          {reportTierView ? (
            <div className="space-y-8">
              {/* Tier 1: Clinical and Translational Articles */}
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
                  Tier 1: Clinical & Translational Research <span className="text-sm font-normal text-gray-500">({tier1Articles.length} articles)</span>
                </h3>
                
                {tier1Articles.length === 0 ? (
                  <p className="text-gray-500 italic">No articles in this category</p>
                ) : (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'}>
                    {tier1Articles.map(article => (
                      <ArticleCard key={article.pmid} article={article} />
                    ))}
                  </div>
                )}
              </div>
              
              {/* Tier 2: Basic Science and Other Articles */}
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
                  Tier 2: Basic Science & Other <span className="text-sm font-normal text-gray-500">({tier2Articles.length} articles)</span>
                </h3>
                
                {tier2Articles.length === 0 ? (
                  <p className="text-gray-500 italic">No articles in this category</p>
                ) : (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'}>
                    {tier2Articles.map(article => (
                      <ArticleCard key={article.pmid} article={article} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'}>
              {filteredArticles.map(article => (
                <ArticleCard key={article.pmid} article={article} />
              ))}
            </div>
          )}
          
          {filteredArticles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No articles match your current filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 