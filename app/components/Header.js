'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  
  // Check if the current path matches a specific route
  const isActive = (path) => {
    if (path === '/' && pathname === '/') {
      return true;
    }
    return path !== '/' && pathname.startsWith(path);
  };
  
  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center group">
            <div className="w-10 h-10 relative mr-3 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">
              <span className="group-hover:scale-90 transition-transform duration-200">OB</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-indigo-600 group-hover:text-indigo-500 transition-colors">
                OncoBrief
              </h1>
              <p className="text-sm text-gray-500">Weekly Oncology Research Digest</p>
            </div>
          </Link>
          
          <nav className="flex space-x-2">
            <Link
              href="/dashboard"
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                isActive('/dashboard') 
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'
              }`}
            >
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </span>
            </Link>
            <Link
              href="/topic-explorer"
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                isActive('/topic-explorer') 
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'
              }`}
            >
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Topic Explorer
              </span>
            </Link>
            <Link
              href="/admin"
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                isActive('/admin') 
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'
              }`}
            >
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
} 