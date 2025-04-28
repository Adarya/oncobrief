// Local storage utility for OncoBrief
// This replaces Firebase Firestore with a simple localStorage implementation

// Default journals
const DEFAULT_JOURNALS = [
  { id: '1', name: 'N Engl J Med' },
  { id: '2', name: 'Lancet' },
  { id: '3', name: 'J Clin Oncol' }
];

// Initialize local storage with default data if not already set
const initializeStorage = () => {
  if (typeof window === 'undefined') return; // Skip on server-side
  
  // Initialize journals if not exist
  if (!localStorage.getItem('journals')) {
    localStorage.setItem('journals', JSON.stringify(DEFAULT_JOURNALS));
  }
  
  // Initialize digests if not exist
  if (!localStorage.getItem('digests')) {
    localStorage.setItem('digests', JSON.stringify([]));
  }
  
  // Initialize articles if not exist
  if (!localStorage.getItem('articles')) {
    localStorage.setItem('articles', JSON.stringify([]));
  }
  
  // Initialize podcasts if not exist
  if (!localStorage.getItem('podcasts')) {
    localStorage.setItem('podcasts', JSON.stringify([]));
  }
};

// Get all journals
const getJournals = () => {
  if (typeof window === 'undefined') return []; // Return empty array on server-side
  initializeStorage();
  return JSON.parse(localStorage.getItem('journals'));
};

// Add a journal
const addJournal = (journalName) => {
  if (typeof window === 'undefined') return null;
  
  const journals = getJournals();
  const newJournal = {
    id: Date.now().toString(),
    name: journalName
  };
  
  journals.push(newJournal);
  localStorage.setItem('journals', JSON.stringify(journals));
  return newJournal;
};

// Remove a journal
const removeJournal = (journalId) => {
  if (typeof window === 'undefined') return false;
  
  const journals = getJournals();
  const filteredJournals = journals.filter(journal => journal.id !== journalId);
  
  localStorage.setItem('journals', JSON.stringify(filteredJournals));
  return true;
};

// Get all digests
const getDigests = () => {
  if (typeof window === 'undefined') return []; // Return empty array on server-side
  initializeStorage();
  return JSON.parse(localStorage.getItem('digests'));
};

// Get a digest by ID
const getDigestById = (digestId) => {
  if (typeof window === 'undefined') return null;
  
  const digests = getDigests();
  return digests.find(digest => digest.id === digestId) || null;
};

// Add a digest
const addDigest = (digest) => {
  if (typeof window === 'undefined') return null;
  
  const digests = getDigests();
  const newDigest = {
    id: Date.now().toString(),
    ...digest,
    createdAt: new Date().toISOString()
  };
  
  digests.push(newDigest);
  localStorage.setItem('digests', JSON.stringify(digests));
  return newDigest;
};

// Get articles by digest ID
const getArticlesByDigestId = (digestId) => {
  if (typeof window === 'undefined') return [];
  
  initializeStorage();
  const articles = JSON.parse(localStorage.getItem('articles'));
  return articles.filter(article => article.digestId === digestId);
};

// Get all articles
const getAllArticles = () => {
  if (typeof window === 'undefined') return [];
  
  initializeStorage();
  return JSON.parse(localStorage.getItem('articles'));
};

// Fix digestId for articles without one - useful for fixing data inconsistencies
const fixArticlesDigestId = (digestId) => {
  if (typeof window === 'undefined') return false;
  
  initializeStorage();
  const articles = JSON.parse(localStorage.getItem('articles'));
  
  // Find articles without digestId 
  const unfilteredArticles = articles.filter(article => !article.digestId);
  
  if (unfilteredArticles.length > 0) {
    console.log(`Found ${unfilteredArticles.length} articles without digestId, fixing...`);
    
    // Update articles with the provided digestId
    const updatedArticles = articles.map(article => {
      if (!article.digestId) {
        return { ...article, digestId };
      }
      return article;
    });
    
    localStorage.setItem('articles', JSON.stringify(updatedArticles));
    return true;
  }
  
  return false;
};

// Add an article
const addArticle = (article) => {
  if (typeof window === 'undefined') return null;
  
  const articles = JSON.parse(localStorage.getItem('articles'));
  const newArticle = {
    id: Date.now().toString(),
    ...article,
    createdAt: new Date().toISOString()
  };
  
  articles.push(newArticle);
  localStorage.setItem('articles', JSON.stringify(articles));
  return newArticle;
};

// Add multiple articles at once
const addArticles = (articlesArray) => {
  if (typeof window === 'undefined') return [];
  
  const articles = JSON.parse(localStorage.getItem('articles'));
  const newArticles = articlesArray.map(article => ({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    ...article,
    createdAt: new Date().toISOString()
  }));
  
  articles.push(...newArticles);
  localStorage.setItem('articles', JSON.stringify(articles));
  return newArticles;
};

// Get podcast by digest ID
const getPodcastByDigestId = (digestId) => {
  if (typeof window === 'undefined') return null;
  
  initializeStorage();
  const podcasts = JSON.parse(localStorage.getItem('podcasts'));
  return podcasts.find(podcast => podcast.digestId === digestId) || null;
};

// Add or update podcast
const savePodcast = (podcast) => {
  if (typeof window === 'undefined') return null;
  
  initializeStorage();
  const podcasts = JSON.parse(localStorage.getItem('podcasts'));
  
  // Check if podcast for this digest already exists
  const existingIndex = podcasts.findIndex(p => p.digestId === podcast.digestId);
  
  if (existingIndex >= 0) {
    // Update existing podcast
    podcasts[existingIndex] = {
      ...podcasts[existingIndex],
      ...podcast,
      updatedAt: new Date().toISOString()
    };
  } else {
    // Add new podcast
    podcasts.push({
      id: Date.now().toString(),
      ...podcast,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  localStorage.setItem('podcasts', JSON.stringify(podcasts));
  return existingIndex >= 0 ? podcasts[existingIndex] : podcasts[podcasts.length - 1];
};

export {
  initializeStorage,
  getJournals,
  addJournal,
  removeJournal,
  getDigests,
  getDigestById,
  addDigest,
  getArticlesByDigestId,
  getAllArticles,
  fixArticlesDigestId,
  addArticle,
  addArticles,
  getPodcastByDigestId,
  savePodcast
}; 