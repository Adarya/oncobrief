'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DigestView from '../components/DigestView';
import WeekSelector from '../components/WeekSelector';
import Header from '../components/Header';
import { initializeStorage, getDigests, getArticlesByDigestId } from '../utils/localStorage';

export default function Dashboard() {
  const router = useRouter();
  const [currentDigest, setCurrentDigest] = useState(null);
  const [digestWeeks, setDigestWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {digestWeeks.length > 0 ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Weekly Oncology Digest</h2>
              <div className="flex space-x-4">
                <Link
                  href="/topic-explorer"
                  className="text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Topic Explorer
                </Link>
                <Link
                  href="/admin"
                  className="text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Generate New Digest
                </Link>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Select Week</h3>
              <WeekSelector weeks={digestWeeks} currentWeekId={currentDigest?.id} onWeekChange={handleWeekChange} />
            </div>
            
            <DigestView digestId={currentDigest?.id} />
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-indigo-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Digests Available</h2>
            <p className="text-gray-600 mb-6">You don't have any weekly digests yet. Generate your first digest to get started.</p>
            <Link 
              href="/admin"
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors shadow-md"
            >
              Generate Your First Digest
            </Link>
          </div>
        )}
      </main>
    </div>
  );
} 