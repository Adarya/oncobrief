'use client';

import TopicExplorer from '../components/TopicExplorer';
import Header from '../components/Header';

export default function TopicExplorerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <TopicExplorer />
      </div>
    </div>
  );
} 