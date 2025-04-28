# OncoBrief

OncoBrief is a web application that provides weekly summaries of new oncology research papers from selected journals. It uses PubMed's API to fetch recent publications and Gemini AI to create concise summaries of research abstracts.

## Features

- **Weekly Digest**: View the most recent weekly digest of oncology publications.
- **Article Summaries**: Each article includes a title, authors, citation, and an AI-generated summary.
- **Journal Management**: Administrators can manage the list of target medical journals.
- **Manual Trigger**: Manually trigger the generation of a new digest.
- **Email Delivery**: Send digests directly to your inbox.
- **Podcast Generation**: Create AI-narrated audio summaries of research articles.

## Technical Implementation

- **Frontend**: Next.js with Tailwind CSS
- **Data Storage**: Browser localStorage instead of a database
- **APIs**: PubMed E-utilities API for research data, Gemini API for AI summaries, AWS Polly for text-to-speech

## Getting Started

### Prerequisites

- Node.js 18 or later
- API keys for Gemini, PubMed, and AWS (see Configuration section)
- Email credentials (for email delivery feature)

### Installation

1. Clone the repository
```
git clone https://github.com/Adarya/oncobrief.git
cd oncobrief
```

2. Install dependencies
```
npm install
```

3. Set up configuration (see Configuration section below)

4. Run the development server
```
npm run dev
```

## Configuration

Create a `.env.local` file in the root directory with the following credentials:

### API Keys and Authentication

```
# Google Gemini API Key (for AI summaries)
# Get from: https://ai.google.dev/
GEMINI_API_KEY=your_gemini_api_key_here

# NCBI PubMed API Key
# Get from: https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/
PUBMED_API_KEY=your_pubmed_api_key_here

# ElevenLabs API Key (for high-quality TTS)
# Get from: https://elevenlabs.io/
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# AWS Configuration (for Podcast TTS)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1

# Email Configuration (Gmail)
# Email address you'll use to send from (must be a Gmail account)
EMAIL_USER=your_gmail_address@gmail.com

# For Gmail, you MUST use an App Password (normal password will NOT work)
# This is the 16-character code generated in Google Account settings
EMAIL_PASS=your_gmail_app_password

# Sender name and email that will appear to recipients
EMAIL_FROM=OncoBrief <your_gmail_address@gmail.com>
```

### Setting up Gmail App Password

To send emails through Gmail, you need to:

1. Enable 2-Step Verification on your Google Account
   - Go to: https://myaccount.google.com/security

2. Create an App Password:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" as the app and "Other" as the device (name it "OncoBrief")
   - Click "Generate"
   - Copy the 16-character code and paste it as the EMAIL_PASS value

3. Restart your Next.js server after updating this file

## How to Use

1. Open the application in your browser at http://localhost:3000
2. Navigate to the Admin page
3. Add journals you want to monitor (e.g., "N Engl J Med", "Lancet", "J Clin Oncol")
4. Click the "Generate Digest Now" button to create your first digest
5. Once the digest is generated, go back to the Dashboard to view the articles
6. Optionally generate a podcast or email the digest to yourself

## Data Storage

All data is stored in your browser's localStorage, which means:
- Data persists between browser sessions
- Data is not shared between different devices/browsers
- Clearing browser data will remove all saved digests and journals

## API Usage

The application uses these external APIs:
1. **PubMed E-utilities API**: To search and fetch oncology research papers
2. **Gemini API**: To generate AI summaries of article abstracts
3. **AWS Polly**: For text-to-speech podcast generation

## Security Notes

- **IMPORTANT**: Never commit your `.env.local` file to version control
- API keys in this file grant access to paid services and should be kept secure
- All API keys are included in `.gitignore` to prevent accidental commits

## License

This project is licensed under the MIT License. 