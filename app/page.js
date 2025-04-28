'use client';

import { useState, useEffect } from 'react';
import DigestView from './components/DigestView';
import WeekSelector from './components/WeekSelector';
import Header from './components/Header';
import { initializeStorage, getDigests } from './utils/localStorage';

export default function Home() {
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
        
        // Sort digests by weekStart (most recent first)
        const sortedDigests = [...digests].sort((a, b) => {
          return new Date(b.weekStart) - new Date(a.weekStart);
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