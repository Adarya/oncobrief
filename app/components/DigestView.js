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
  const [podcastError, setPodcastError] = useState(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [fixedArticles, setFixedArticles] = useState(false);

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
        setError('Failed to load digest content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDigestData();
  }, [digestId]);
  
  const handleGeneratePodcast = async () => {
    if (!digestId || articles.length === 0) return;
    
    try {
      setGeneratingPodcast(true);
      setPodcastError(null);
      
      const digestTitle = digest.title || `Weekly Oncology Digest: ${formatDateRange(digest.weekStart, digest.weekEnd)}`;
      
      // Call the API route to generate a podcast
      const response = await fetch('/api/generatePodcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          digestId: digestId,
          digestTitle: digestTitle,
          articles: articles
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        // Check if we at least got a script URL even if TTS failed
        if (data.scriptUrl) {
          setPodcastError(`${data.error} You can still download the script.`);
          // Save just the script URL
          const podcastData = {
            digestId: digestId,
            scriptUrl: data.scriptUrl,
            createdAt: new Date().toISOString()
          };
          const savedPodcast = savePodcast(podcastData);
          setPodcast(savedPodcast);
          return;
        }
        throw new Error(data.error || 'Failed to generate podcast');
      }
      
      // Save podcast data to localStorage
      const podcastData = {
        digestId: digestId,
        audioUrl: data.audioUrl,
        scriptUrl: data.scriptUrl,
        script: data.script,
        createdAt: new Date().toISOString()
      };
      
      const savedPodcast = savePodcast(podcastData);
      setPodcast(savedPodcast);
    } catch (err) {
      console.error('Error generating podcast:', err);
      setPodcastError(err.message || 'An error occurred while generating the podcast');
    } finally {
      setGeneratingPodcast(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    
    if (!digestId || !emailAddress) return;
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    try {
      setEmailSending(true);
      setEmailError(null);
      setEmailSuccess(false);
      
      console.log('Sending email for digest:', digestId);
      console.log('Email address:', emailAddress);
      console.log('Articles count:', articles.length);
      
      // If no podcast exists yet, generate one first
      let currentPodcast = podcast;
      if (!currentPodcast && articles.length > 0) {
        try {
          setEmailError('Generating podcast before sending email...');
          
          const digestTitle = digest.title || `Weekly Oncology Digest: ${formatDateRange(digest.weekStart, digest.weekEnd)}`;
          
          // Call the API route to generate a podcast
          const podcastResponse = await fetch('/api/generatePodcast', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              digestId: digestId,
              digestTitle: digestTitle,
              articles: articles
            }),
          });
          
          const podcastData = await podcastResponse.json();
          
          if (podcastResponse.ok && podcastData.success) {
            // Save podcast data to localStorage
            const podcastInfo = {
              digestId: digestId,
              audioUrl: podcastData.audioUrl,
              scriptUrl: podcastData.scriptUrl,
              script: podcastData.script,
              createdAt: new Date().toISOString()
            };
            
            const savedPodcast = savePodcast(podcastInfo);
            setPodcast(savedPodcast);
            currentPodcast = savedPodcast;
            setEmailError(null);
          }
        } catch (err) {
          console.error('Error generating podcast before email:', err);
          // Continue with email sending even if podcast generation fails
        }
      }
      
      // Call the API route to send email
      const response = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          digestId: digestId,
          recipientEmail: emailAddress,
          articlesOverride: articles.length > 0 ? articles : null,
          podcastOverride: currentPodcast // Include the podcast data
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
  
  return (
    <div>
      {fixedArticles && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p>Articles association fixed! The digest now has properly linked articles.</p>
        </div>
      )}
      
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">
          Weekly Oncology Digest
        </h2>
        <p className="text-lg text-gray-600">
          {digestTitle}
        </p>
        
        {/* Email Subscription Form */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            Receive this digest by email
          </h3>
          
          {emailError && (
            <div className="mb-3 text-red-600 text-sm">
              <p>{emailError}</p>
            </div>
          )}
          
          {emailSuccess && (
            <div className="mb-3 text-green-600 text-sm bg-green-50 p-2 rounded">
              <p>Digest sent successfully! Check your inbox.</p>
            </div>
          )}
          
          <form onSubmit={handleSendEmail} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="Enter your email address"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={emailSending}
              required
            />
            <button
              type="submit"
              disabled={emailSending || !emailAddress || articles.length === 0}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                emailSending || !emailAddress || articles.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {emailSending ? (
                <>
                  <span className="inline-block spinner-small mr-2"></span>
                  Sending...
                </>
              ) : (
                'Send to Email'
              )}
            </button>
          </form>
          <p className="mt-2 text-xs text-blue-700">
            Get this week's oncology digest with article summaries and podcast delivered to your inbox.
          </p>
        </div>
        
        {/* Podcast section */}
        {podcast ? (
          <PodcastPlayer audioUrl={podcast.audioUrl} scriptUrl={podcast.scriptUrl} digestTitle={digestTitle} />
        ) : (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 mt-4">
            <h3 className="text-lg font-semibold text-indigo-900 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              OncoBrief Podcast
            </h3>
            
            {podcastError && (
              <div className="mb-3 text-red-600 text-sm">
                <p>{podcastError}</p>
              </div>
            )}
            
            <p className="mb-4 text-indigo-700">
              Generate an AI-narrated podcast summarizing this digest's research articles.
            </p>
            
            <button
              onClick={handleGeneratePodcast}
              disabled={generatingPodcast || articles.length === 0}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                generatingPodcast
                  ? 'bg-gray-400 cursor-not-allowed'
                  : articles.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {generatingPodcast ? (
                <>
                  <span className="inline-block spinner-small mr-2"></span>
                  Generating Podcast...
                </>
              ) : articles.length === 0 ? (
                'No Articles Available'
              ) : (
                'Generate Podcast'
              )}
            </button>
          </div>
        )}
        
        {articles.length === 0 ? (
          <div className="mt-6 text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No articles found for this week.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-1 lg:grid-cols-1">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 