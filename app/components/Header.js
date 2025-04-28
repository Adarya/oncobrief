'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  
  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div>
            <Link href="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-500">
              OncoBrief
            </Link>
            <p className="text-sm text-gray-500">Weekly Oncology Research Digest</p>
          </div>
          
          <nav className="flex space-x-4">
            <Link href="/" className={`px-3 py-2 rounded-md text-sm font-medium ${
              pathname === '/' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-indigo-500'
            }`}>
              Dashboard
            </Link>
            <Link href="/admin" className={`px-3 py-2 rounded-md text-sm font-medium ${
              pathname === '/admin' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-indigo-500'
            }`}>
              Admin
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
} 