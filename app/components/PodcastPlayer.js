'use client';

import { useState, useRef, useEffect } from 'react';

export default function PodcastPlayer({ audioUrl, scriptUrl, digestTitle }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [volume, setVolume] = useState(1);
  
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
      
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      
      // Add event listeners
      audio.addEventListener('loadeddata', setAudioData);
      audio.addEventListener('timeupdate', setAudioTime);
      audio.addEventListener('ended', handleAudioEnd);
      audio.addEventListener('error', handleError);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      
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
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
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
  
  const handleVolumeChange = (e) => {
    if (!audioRef.current) return;
    
    const newVolume = parseFloat(e.target.value);
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };
  
  if (!audioUrl) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded mb-6">
        <p>No podcast available for this digest. Generate one from the podcast options.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
      <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 017.072 0m-9.9-2.828a9 9 0 0112.728 0" />
        </svg>
        OncoBrief Podcast: {digestTitle || 'Weekly Digest'}
      </h3>
      
      {/* Add the audio element first, so it's available when the component renders */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
      
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
              className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 focus:outline-none mr-4"
              aria-label={isPlaying ? 'Pause' : 'Play'}
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
                className="w-full h-2 rounded-lg appearance-none bg-indigo-200 cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(currentTime / (duration || 1)) * 100}%, #e0e7ff ${(currentTime / (duration || 1)) * 100}%, #e0e7ff 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-indigo-800 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            <div className="relative ml-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 ml-2 rounded-lg appearance-none bg-indigo-200 cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${volume * 100}%, #e0e7ff ${volume * 100}%, #e0e7ff 100%)`
                }}
              />
            </div>
          </div>
          
          {/* Download buttons */}
          <div className="flex justify-end space-x-4 mt-4">
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