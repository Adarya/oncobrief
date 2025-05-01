'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDownIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function WeekSelector({ weeks, currentWeekId, onWeekChange }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Find the current week object
  const currentWeek = weeks.find(week => week.id === currentWeekId) || weeks[0];
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!weeks || weeks.length === 0) {
    return null;
  }

  const formatWeekRange = (week) => {
    try {
      // First check if we have a title field (for custom date ranges)
      if (week.title) {
        return week.title;
      }
      
      // Ensure dates are valid Date objects
      const startDate = week.weekStart instanceof Date ? week.weekStart : new Date(week.weekStart);
      const endDate = week.weekEnd instanceof Date ? week.weekEnd : new Date(week.weekEnd);
      
      // Check if dates are valid before formatting
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return "Invalid date range";
      }
      
      return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Invalid date range";
    }
  };

  // Limit dropdown height based on number of weeks (max 5 visible at once)
  const dropdownMaxHeight = Math.min(weeks.length * 48, 5 * 48);

  return (
    <div className="mb-6 relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Week
      </label>
      
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full flex items-center justify-between bg-white px-4 py-3 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
      >
        <span className="flex items-center text-gray-900">
          <CalendarIcon className="w-5 h-5 text-gray-400 mr-2" />
          <span>Week of {formatWeekRange(currentWeek)}</span>
        </span>
        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
      </button>
      
      {isDropdownOpen && (
        <div 
          className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
          style={{ maxHeight: `${dropdownMaxHeight}px` }}
          role="listbox"
        >
          {weeks.map((week) => (
            <div
              key={week.id}
              className={`cursor-pointer select-none relative py-3 pl-3 pr-9 hover:bg-indigo-50 ${
                week.id === currentWeekId ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
              }`}
              onClick={() => {
                onWeekChange(week.id);
                setIsDropdownOpen(false);
              }}
              role="option"
              aria-selected={week.id === currentWeekId}
            >
              <div className="flex items-center">
                <span className={`block truncate ${week.id === currentWeekId ? 'font-medium' : 'font-normal'}`}>
                  Week of {formatWeekRange(week)}
                </span>
                
                {week.id === currentWeekId && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 