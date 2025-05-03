'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DigestView from './components/DigestView';
import WeekSelector from './components/WeekSelector';
import Header from './components/Header';
import { initializeStorage, getDigests, getArticlesByDigestId } from './utils/localStorage';

export default function Home() {
  const router = useRouter();
  const [currentDigest, setCurrentDigest] = useState(null);
  const [digestWeeks, setDigestWeeks] = useState([]);
  const [featuredArticles, setFeaturedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullDigest, setShowFullDigest] = useState(false);

  // Fetch the list of available digest weeks
  useEffect(() => {
    const fetchDigestWeeks = () => {
      try {
        // Initialize localStorage
        initializeStorage();
        
        // Get digests from localStorage
        const digests = getDigests();
        
        // Sort digests by weekEnd (most recent first) instead of weekStart
        const sortedDigests = [...digests].sort((a, b) => {
          return new Date(b.weekEnd) - new Date(a.weekEnd);
        });
        
        setDigestWeeks(sortedDigests);
        
        // Set the current digest to the most recent one
        if (sortedDigests.length > 0) {
          setCurrentDigest(sortedDigests[0]);
          
          // Get featured articles from the most recent digest
          const recentArticles = getArticlesByDigestId(sortedDigests[0].id);
          setFeaturedArticles(recentArticles.slice(0, 3)); // Get first 3 articles
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching digest weeks:', err);
        setError('Failed to load digest weeks. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDigestWeeks();
  }, []);

  const handleWeekChange = (weekId) => {
    const selectedWeek = digestWeeks.find(week => week.id === weekId);
    if (selectedWeek) {
      setCurrentDigest(selectedWeek);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="spinner"></div>
            <p className="mt-4 text-gray-600">Loading the latest oncology research...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p>{error}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If user clicks "View Full Digest", show the traditional digest view
  if (showFullDigest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          {digestWeeks.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Weekly Digest</h2>
                <button
                  onClick={() => setShowFullDigest(false)}
                  className="text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Home
                </button>
              </div>
              <WeekSelector weeks={digestWeeks} currentWeekId={currentDigest?.id} onWeekChange={handleWeekChange} />
              <DigestView digestId={currentDigest?.id} />
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">No digests available yet. Please go to the Admin page to generate a digest.</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Modern, beautiful homepage
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section with Gradient Background */}
      <section className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Stay Informed in Oncology Research</h1>
            <p className="text-xl mb-8">Weekly summaries of the latest breakthrough research papers, delivered straight to your inbox.</p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/dashboard" 
                className="px-6 py-3 bg-white text-indigo-600 font-medium rounded-md hover:bg-gray-100 transition-colors shadow-md"
              >
                Go to Dashboard
              </Link>
              <Link href="/topic-explorer" 
                className="px-6 py-3 bg-transparent border-2 border-white text-white font-medium rounded-md hover:bg-white/10 transition-colors"
              >
                Explore Research Topics
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      {/* Featured Articles Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Featured Research</h2>
            <p className="text-gray-600">Explore the latest discoveries in oncology</p>
          </div>
          
          {featuredArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredArticles.map((article) => (
                <div key={article.pmid} className="bg-white rounded-lg overflow-hidden shadow-md transform transition-transform hover:scale-105">
                  <div className="p-6">
                    <div className="text-xs font-semibold text-indigo-600 uppercase mb-1">{article.journal}</div>
                    <h3 className="text-xl font-bold mb-3 line-clamp-2">{article.title}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {article.aiSummary || article.abstract.substring(0, 150) + '...'}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{article.pubYear}</span>
                      <Link 
                        href="/dashboard"
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        Read More
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No articles available yet. Generate your first digest.</p>
            </div>
          )}
          
          <div className="text-center mt-10">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors shadow-md"
            >
              View All Articles
            </Link>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">How OncoBrief Works</h2>
            <p className="text-gray-600">Stay on top of the latest research with our advanced features</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Weekly Digests</h3>
              <p className="text-gray-600">Curated summaries of the most important oncology research papers from top journals.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Summaries</h3>
              <p className="text-gray-600">Each article comes with an AI-generated summary highlighting key findings and implications.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 017.072 0m-9.9-2.828a9 9 0 0112.728 0" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Audio Podcasts</h3>
              <p className="text-gray-600">Listen to the research summaries as a podcast, perfect for busy professionals on the go.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Topic Explorer</h3>
              <p className="text-gray-600">Search and explore specific oncology topics with our advanced visualization tools.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Topic Explorer Feature Highlight */}
      <section className="py-16 bg-gradient-to-b from-indigo-50 to-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Introducing Topic Explorer</h2>
              <p className="text-gray-600 mb-6">
                Our new Topic Explorer feature allows you to dive deep into specific oncology research areas. Search across multiple journals, visualize publication timelines, and get AI-generated summaries of the latest findings.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Interactive timeline visualization of publications</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>AI-generated meta-analysis of research trends</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Filter by journals, date ranges, and keywords</span>
                </li>
              </ul>
              <Link 
                href="/topic-explorer"
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors shadow-md inline-flex items-center"
              >
                Try Topic Explorer
                <svg className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
              </Link>
            </div>
            <div className="md:w-1/2">
              <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                <div className="p-2 bg-indigo-600">
                  <div className="flex space-x-1">
                    <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                    <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
                    <p className="text-gray-500 text-center">Topic Explorer Timeline Visualization</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Stay Current with Oncology Research?</h2>
            <p className="text-xl mb-8">Generate your first digest or explore our latest summaries.</p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/admin" className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors shadow-md">
                Generate Digest
              </Link>
              <button
                onClick={() => setShowFullDigest(true)}
                className="px-6 py-3 bg-transparent border-2 border-white text-white font-medium rounded-md hover:bg-white/10 transition-colors"
              >
                View Latest Research
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 