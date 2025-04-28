'use client';

import { useState, useRef, useEffect } from 'react';

export default function PodcastPlayer({ audioUrl, scriptUrl, digestTitle }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const audioRef = useRef(null);
  
  // Initialize audio element and set up event listeners
  useEffect(() => {
    if (!audioUrl) return;
    
    // Need to return a cleanup function even if we didn't set up listeners yet
    let cleanup = () => {};
    
    // Make sure the audio element exists before adding listeners
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const setAudioData = () => {
        setDuration(audio.duration);
        setLoading(false);
      };
      
      const setAudioTime = () => {
        setCurrentTime(audio.currentTime);
      };
      
      const handleAudioEnd = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        audio.currentTime = 0;
      };
      
      const handleError = (e) => {
        setError('Error loading podcast audio');
        setLoading(false);
        console.error('Audio error:', e);
      };
      
      // Add event listeners
      audio.addEventListener('loadeddata', setAudioData);
      audio.addEventListener('timeupdate', setAudioTime);
      audio.addEventListener('ended', handleAudioEnd);
      audio.addEventListener('error', handleError);
      
      // If audio is already loaded, set the duration
      if (audio.readyState >= 2) {
        setAudioData();
      }
      
      // Clean up event listeners on unmount
      cleanup = () => {
        audio.removeEventListener('loadeddata', setAudioData);
        audio.removeEventListener('timeupdate', setAudioTime);
        audio.removeEventListener('ended', handleAudioEnd);
        audio.removeEventListener('error', handleError);
      };
    }
    
    return cleanup;
  }, [audioUrl, audioRef.current]);
  
  // Format time in MM:SS format
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '00:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
  };
  
  // Handle seeking
  const handleSeek = (e) => {
    if (!audioRef.current) return;
    
    const seekTime = parseFloat(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };
  
  if (!audioUrl) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded mb-6">
        <p>No podcast available for this digest. Generate one from the podcast options.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-indigo-900 mb-3 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
        OncoBrief Podcast: {digestTitle || 'Weekly Digest'}
      </h3>
      
      {/* Add the audio element first, so it's available when the component renders */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {loading ? (
        <div className="flex items-center justify-center h-16">
          <div className="spinner-small"></div>
          <p className="ml-2 text-indigo-600">Loading podcast...</p>
        </div>
      ) : error ? (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      ) : (
        <div>
          {/* Playback controls */}
          <div className="flex items-center mb-3">
            <button 
              onClick={togglePlay}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-10 w-10 flex items-center justify-center mr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <div className="flex-1 mx-2">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="text-sm text-indigo-700 font-mono whitespace-nowrap ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          {/* Download buttons */}
          <div className="flex justify-end space-x-4">
            {scriptUrl && (
              <a
                href={scriptUrl}
                download={`oncobrief-script-${digestTitle?.replace(/\s+/g, '-').toLowerCase() || 'weekly-digest'}.txt`}
                className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" />
                </svg>
                Download Script
              </a>
            )}
            
            <a
              href={audioUrl}
              download={`oncobrief-podcast-${digestTitle?.replace(/\s+/g, '-').toLowerCase() || 'weekly-digest'}.mp3`}
              className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download Podcast
            </a>
          </div>
        </div>
      )}
    </div>
  );
} 