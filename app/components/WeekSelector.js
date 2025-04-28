'use client';

import { format } from 'date-fns';

export default function WeekSelector({ weeks, currentWeekId, onWeekChange }) {
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

  return (
    <div className="mb-6">
      <label htmlFor="week-selector" className="block text-sm font-medium text-gray-700 mb-2">
        Select Week
      </label>
      <select
        id="week-selector"
        value={currentWeekId || ''}
        onChange={(e) => onWeekChange(e.target.value)}
        className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      >
        {weeks.map((week) => (
          <option key={week.id} value={week.id}>
            Week of {formatWeekRange(week)}
          </option>
        ))}
      </select>
    </div>
  );
} 