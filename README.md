# OncoBrief

OncoBrief is a web application that provides weekly summaries of new oncology research papers from selected journals. It uses PubMed's API to fetch recent publications and Gemini AI to create concise summaries of research abstracts.

## Features

- **Weekly Digest**: View the most recent weekly digest of oncology publications.
- **Article Summaries**: Each article includes a title, authors, citation, and an AI-generated summary.
- **Journal Management**: Administrators can manage the list of target medical journals.
- **Manual Trigger**: Manually trigger the generation of a new digest.

## Technical Implementation

- **Frontend**: Next.js with Tailwind CSS
- **Data Storage**: Browser localStorage instead of a database
- **APIs**: PubMed E-utilities API for research data, Gemini API for AI summaries

## Getting Started

### Prerequisites

- Node.js 18 or later
- Gemini API key (using the included one for demo purposes)
- PubMed API key (using the included one for demo purposes)

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/oncobrief.git
cd oncobrief
```

2. Install dependencies
```
npm install
```

3. Run the development server
```
npm run dev
```

## How to Use

1. Open the application in your browser at http://localhost:3000
2. Navigate to the Admin page
3. Add journals you want to monitor (e.g., "N Engl J Med", "Lancet", "J Clin Oncol")
4. Click the "Generate Digest Now" button to create your first digest
5. Once the digest is generated, go back to the Dashboard to view the articles

## Data Storage

All data is stored in your browser's localStorage, which means:
- Data persists between browser sessions
- Data is not shared between different devices/browsers
- Clearing browser data will remove all saved digests and journals

## API Usage

The application uses two external APIs:
1. **PubMed E-utilities API**: To search and fetch oncology research papers
2. **Gemini API**: To generate AI summaries of article abstracts

## License

This project is licensed under the MIT License. 