'use client';

export default function ArticleCard({ article }) {
  const buildPubMedLink = (pmid) => {
    return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  };

  const buildDoiLink = (doi) => {
    return doi ? `https://doi.org/${doi}` : null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          <a 
            href={article.doi ? buildDoiLink(article.doi) : buildPubMedLink(article.pmid)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-indigo-600 transition-colors"
          >
            {article.title}
          </a>
        </h3>
        
        <div className="text-sm text-gray-600 mb-4">
          <p className="mb-1">
            <span className="font-medium">Authors:</span> {article.authors}
          </p>
          <p className="mb-1">
            <span className="font-medium">Journal:</span> {article.journal} ({article.pubYear})
          </p>
          <p>
            <span className="font-medium">PMID:</span>{' '}
            <a 
              href={buildPubMedLink(article.pmid)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              {article.pmid}
            </a>
          </p>
        </div>
        
        {/* AI Summary Section - Display above the abstract */}
        {article.aiSummary && (
          <div className="mb-4">
            <h4 className="text-md font-semibold text-gray-700 mb-2">AI Summary:</h4>
            <div className="text-sm text-gray-700 bg-indigo-50 p-3 rounded border-l-4 border-indigo-300 mb-4">
              {article.aiSummary}
            </div>
          </div>
        )}
        
        <div className="mb-4">
          <h4 className="text-md font-semibold text-gray-700 mb-2">Abstract:</h4>
          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded" style={{ maxHeight: '10rem', overflow: 'auto' }}>
            {article.abstract?.split('\n').map((paragraph, idx) => (
              <p key={idx} className={idx > 0 ? 'mt-2' : ''}>
                {paragraph}
              </p>
            )) || <p className="italic text-gray-500">No abstract available</p>}
          </div>
        </div>
      </div>
    </div>
  );
} 