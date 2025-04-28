'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { initializeStorage, getJournals, addJournal, removeJournal, addDigest, addArticles } from '../utils/localStorage';
import { format, subDays } from 'date-fns';
import Link from 'next/link';

export default function AdminPage() {
  const [journals, setJournals] = useState([]);
  const [newJournal, setNewJournal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [processingDigest, setProcessingDigest] = useState(false);
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showDashboardButton, setShowDashboardButton] = useState(false);

  useEffect(() => {
    fetchJournals();
  }, []);

  const fetchJournals = () => {
    try {
      setLoading(true);
      // Initialize localStorage and get journals
      initializeStorage();
      const journalsList = getJournals();
      setJournals(journalsList);
      setError(null);
    } catch (err) {
      console.error('Error fetching journals:', err);
      setError('Failed to load journals. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddJournal = (e) => {
    e.preventDefault();
    
    if (!newJournal.trim()) {
      setError('Please enter a journal name');
      return;
    }
    
    try {
      setLoading(true);
      
      // Add the new journal to localStorage
      addJournal(newJournal.trim());
      
      // Clear the input and show success message
      setNewJournal('');
      setSuccess('Journal added successfully');
      
      // Re-fetch the journals list
      fetchJournals();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error adding journal:', err);
      setError('Failed to add journal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveJournal = (id) => {
    if (!confirm('Are you sure you want to remove this journal?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Remove the journal from localStorage
      removeJournal(id);
      
      // Show success message
      setSuccess('Journal removed successfully');
      
      // Re-fetch the journals list
      fetchJournals();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error removing journal:', err);
      setError('Failed to remove journal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const triggerManualDigest = async () => {
    if (!confirm('Are you sure you want to manually generate a digest? This may take a few minutes.')) {
      return;
    }
    
    try {
      setProcessingDigest(true);
      setError(null);
      
      // Get the current journals to send to the API
      const currentJournals = getJournals();
      
      if (currentJournals.length === 0) {
        setError('No journals configured. Please add at least one journal first.');
        setProcessingDigest(false);
        return;
      }

      // Validate date range
      if (useCustomDateRange) {
        if (!startDate || !endDate) {
          setError('Please select both start and end dates.');
          setProcessingDigest(false);
          return;
        }

        const startObj = new Date(startDate);
        const endObj = new Date(endDate);
        
        if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
          setError('Invalid date format. Please use YYYY-MM-DD format.');
          setProcessingDigest(false);
          return;
        }
        
        if (startObj > endObj) {
          setError('Start date cannot be after end date.');
          setProcessingDigest(false);
          return;
        }
      }
      
      // Call the API route to generate a digest
      const response = await fetch('/api/generateDigest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          journals: currentJournals,
          dateRange: useCustomDateRange ? {
            startDate,
            endDate
          } : null 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate digest');
      }
      
      // If articles were found, save the digest and articles to localStorage
      if (data.digestId && data.articles.length > 0) {
        // Add the digest to localStorage
        addDigest(data.digest);
        
        // Add the articles to localStorage
        addArticles(data.articles);
        
        setSuccess(`Digest generated successfully with ${data.articles.length} articles!`);
        setShowDashboardButton(true);
      } else {
        setSuccess('Digest request completed, but no articles were found for the selected date range.');
        setShowDashboardButton(false);
      }
      
      // Clear success message after more time when dashboard button is shown
      setTimeout(() => {
        setSuccess(null);
        setShowDashboardButton(false);
      }, showDashboardButton ? 10000 : 5000); // 10 seconds if dashboard button is shown, 5 seconds otherwise
    } catch (err) {
      console.error('Error triggering digest generation:', err);
      setError(`Failed to generate digest: ${err.message}`);
    } finally {
      setProcessingDigest(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Admin Dashboard
          </h2>
          
          {/* Manual Digest Trigger */}
          <div className="mb-10 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Manual Digest Generation
            </h3>
            <p className="mb-4 text-gray-600">
              Click the button below to manually trigger the generation of a weekly digest. 
              This will fetch articles from the selected journals.
            </p>
            
            {/* Date Range Selection */}
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="useCustomDateRange"
                  checked={useCustomDateRange}
                  onChange={() => setUseCustomDateRange(!useCustomDateRange)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="useCustomDateRange" className="ml-2 block text-sm text-gray-700">
                  Use custom date range
                </label>
              </div>
              
              {useCustomDateRange && (
                <div className="flex flex-col sm:flex-row gap-4 mt-2">
                  <div className="flex-1">
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              )}
              
              {!useCustomDateRange && (
                <p className="text-sm text-gray-500 italic">
                  Using default date range: last 7 days
                </p>
              )}
            </div>
            
            <button
              onClick={triggerManualDigest}
              disabled={processingDigest}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                processingDigest
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {processingDigest ? 'Processing...' : 'Generate Digest Now'}
            </button>
          </div>
          
          {/* Journal Management */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Journal Management
            </h3>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>{success}</p>
                
                {showDashboardButton && (
                  <div className="mt-3">
                    <Link 
                      href="/" 
                      className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                      View on Dashboard
                    </Link>
                  </div>
                )}
              </div>
            )}
            
            {/* Add New Journal Form */}
            <form onSubmit={handleAddJournal} className="mb-6">
              <div className="flex">
                <input
                  type="text"
                  value={newJournal}
                  onChange={(e) => setNewJournal(e.target.value)}
                  placeholder="Enter journal name (e.g., 'N Engl J Med')"
                  className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 rounded-r-md text-white font-medium ${
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  Add Journal
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Use the exact journal name as it appears in PubMed.
              </p>
            </form>
            
            {/* Journals List */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">
                Current Journals
              </h4>
              
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner"></div>
                  <p className="mt-2 text-gray-600">Loading journals...</p>
                </div>
              ) : journals.length === 0 ? (
                <p className="text-gray-500 italic">No journals configured. Add your first journal above.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {journals.map((journal) => (
                    <li key={journal.id} className="py-3 flex justify-between items-center">
                      <span className="text-gray-700">{journal.name}</span>
                      <button
                        onClick={() => handleRemoveJournal(journal.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 