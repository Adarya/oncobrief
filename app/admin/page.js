'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { initializeStorage, getJournals, addJournal, removeJournal, addDigest, addArticles } from '../utils/localStorage';
import { format, subDays } from 'date-fns';
import Link from 'next/link';

// Define journal tiers
const JOURNAL_TIERS = {
  tier1: {
    name: 'Tier 1 - High Impact Clinical',
    journals: [
      'N Engl J Med',
      'Lancet',
      'J Clin Oncol',
      'Lancet Oncol',
      'JAMA Oncol'
    ]
  },
  tier2: {
    name: 'Tier 2 - High Impact Science',
    journals: [
      'Nature',
      'Science',
      'Cell',
      'Nature Medicine',
      'Cancer Cell'
    ]
  },
  tier3: {
    name: 'Tier 3 - Specialty Journals',
    journals: [
      'Cancer Discov',
      'Blood',
      'Ann Oncol',
      'JAMA',
      'BMJ'
    ]
  }
};

export default function AdminPage() {
  const router = useRouter();
  const [journals, setJournals] = useState([]);
  const [newJournal, setNewJournal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [processingDigest, setProcessingDigest] = useState(false);
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generatedDigestId, setGeneratedDigestId] = useState(null);
  const [redirectCountdown, setRedirectCountdown] = useState(null);
  
  // Add state for journal selection method and selected tiers
  const [journalSelectionMethod, setJournalSelectionMethod] = useState('manual'); // 'manual', 'tiers'
  const [selectedTiers, setSelectedTiers] = useState({
    tier1: true,
    tier2: false,
    tier3: false
  });

  useEffect(() => {
    fetchJournals();
  }, []);

  // Handle countdown timer and auto-redirect
  useEffect(() => {
    if (redirectCountdown !== null) {
      if (redirectCountdown <= 0) {
        router.push('/'); // Redirect to dashboard
        return;
      }
      
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [redirectCountdown, router]);

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

  const handleAddJournal = () => {
    if (!newJournal.trim()) {
      return;
    }
    
    try {
      addJournal(newJournal.trim());
      setNewJournal('');
      fetchJournals(); // Refresh the list
      setSuccess('Journal added successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error adding journal:', err);
      setError(`Failed to add journal: ${err.message}`);
    }
  };

  const handleRemoveJournal = (journalId) => {
    try {
      removeJournal(journalId);
      fetchJournals(); // Refresh the list
      setSuccess('Journal removed successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error removing journal:', err);
      setError(`Failed to remove journal: ${err.message}`);
    }
  };

  // Handle tier checkbox change
  const handleTierChange = (tierId) => {
    setSelectedTiers({
      ...selectedTiers,
      [tierId]: !selectedTiers[tierId]
    });
  };

  // Get journals from selected tiers
  const getJournalsFromSelectedTiers = () => {
    let selectedJournals = [];
    
    Object.keys(selectedTiers).forEach(tierId => {
      if (selectedTiers[tierId] && JOURNAL_TIERS[tierId]) {
        selectedJournals = [...selectedJournals, ...JOURNAL_TIERS[tierId].journals];
      }
    });
    
    return selectedJournals;
  };

  const triggerManualDigest = async () => {
    // Clear any existing states
    setError(null);
    setSuccess(null);
    setRedirectCountdown(null);
    setGeneratedDigestId(null);
    
    // Get journals based on selection method
    let journalNames = [];
    if (journalSelectionMethod === 'manual') {
      // For manual selection, ensure we have at least one journal configured
      if (journals.length === 0) {
        setError('Please add at least one journal before generating a digest.');
        return;
      }
      journalNames = journals.map(journal => journal.name);
    } else {
      // For tier selection, ensure at least one tier is selected
      if (!Object.values(selectedTiers).some(selected => selected)) {
        setError('Please select at least one journal tier.');
        return;
      }
      journalNames = getJournalsFromSelectedTiers();
    }
    
    setProcessingDigest(true);
    console.log('Generating digest with journals:', journalNames);
    
    try {
      // Prepare date range
      let dateRange = {};
      if (useCustomDateRange) {
        dateRange = {
          startDate,
          endDate
        };
      }
      
      // Make the API request to generate the digest
      const response = await fetch('/api/generateDigest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journals: journalNames,
          dateRange
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate digest');
      }
      
      // If articles were found, save the digest and articles to localStorage
      if (data.digestId && data.articles.length > 0) {
        // Add the digest to localStorage
        addDigest(data.digest);
        
        // Add the articles to localStorage
        addArticles(data.articles);
        
        setSuccess(`Digest generated successfully with ${data.articles.length} articles!`);
        setGeneratedDigestId(data.digestId);
        
        // Start the countdown for auto-redirect
        setRedirectCountdown(3);
      } else {
        setSuccess('Digest request completed, but no articles were found for the selected date range.');
      }
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
            
            {/* Journal Selection Method */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Journal Selection Method
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="manualSelection"
                    name="journalSelectionMethod"
                    checked={journalSelectionMethod === 'manual'}
                    onChange={() => setJournalSelectionMethod('manual')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="manualSelection" className="ml-2 block text-sm text-gray-700">
                    Manual selection (from your journal list)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="tierSelection"
                    name="journalSelectionMethod"
                    checked={journalSelectionMethod === 'tiers'}
                    onChange={() => setJournalSelectionMethod('tiers')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="tierSelection" className="ml-2 block text-sm text-gray-700">
                    Predefined journal tiers
                  </label>
                </div>
              </div>
            </div>
            
            {/* Journal Tiers Selection */}
            {journalSelectionMethod === 'tiers' && (
              <div className="mb-6 bg-white p-4 rounded-md border border-gray-200">
                <h4 className="font-medium text-gray-700 mb-3">Select Journal Tiers</h4>
                
                {Object.entries(JOURNAL_TIERS).map(([tierId, tier]) => (
                  <div key={tierId} className="mb-4 last:mb-0">
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={`tier-${tierId}`}
                        checked={selectedTiers[tierId]}
                        onChange={() => handleTierChange(tierId)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`tier-${tierId}`} className="ml-2 block font-medium text-gray-700">
                        {tier.name}
                      </label>
                    </div>
                    <div className="ml-6 text-sm text-gray-500">
                      {tier.journals.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
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
              {processingDigest ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : 'Generate Digest Now'}
            </button>
          </div>
          
          {/* Journal Management - Only show if manual selection is active */}
          {journalSelectionMethod === 'manual' && (
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Journal Management
              </h3>
              
              {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
                  <p className="font-medium">Error</p>
                  <p>{error}</p>
                </div>
              )}
              
              {success && (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded">
                  <p className="font-medium">Success</p>
                  <p>{success}</p>
                  
                  {redirectCountdown !== null && (
                    <div className="mt-2 flex items-center">
                      <p>Redirecting to dashboard in {redirectCountdown} seconds</p>
                      <button 
                        onClick={() => router.push('/')}
                        className="ml-4 text-sm bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded transition-colors"
                      >
                        Go now
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Add New Journal Form */}
              <div className="mb-6">
                <label htmlFor="new-journal" className="block text-sm font-medium text-gray-700 mb-1">
                  Add New Journal
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="new-journal"
                    value={newJournal}
                    onChange={(e) => setNewJournal(e.target.value)}
                    placeholder="e.g. 'J Clin Oncol' or 'Blood'"
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <button
                    onClick={handleAddJournal}
                    className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                  >
                    Add
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Use the exact journal name as it appears in PubMed (e.g., "N Engl J Med", "Lancet", "J Clin Oncol")
                </p>
              </div>
              
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
                  <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                    {journals.map((journal) => (
                      <li key={journal.id} className="py-3 px-4 flex justify-between items-center hover:bg-gray-50">
                        <span className="text-gray-700">{journal.name}</span>
                        <button
                          onClick={() => handleRemoveJournal(journal.id)}
                          className="text-red-600 hover:text-red-800 flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 