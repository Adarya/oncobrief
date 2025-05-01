#!/bin/bash
# Script to completely remove sensitive files from Git history

echo "WARNING: This script will rewrite your Git history"
echo "This is a destructive operation that will remove specified files from all commits"
echo "If you've pushed to a remote repository, you'll need to force push after this operation"
echo ""
echo "Files to be purged from history:"
echo "- test_gemini_api.py (contains Google Gemini API key)"
echo "- test_pubmed_api.py (contains NCBI API key)"
echo "- test_podcastify.py"
echo ""
echo "Press Ctrl+C to cancel, or press Enter to continue..."
read

# Create a new branch to work on 
git checkout -b purge-sensitive-files

# Use git filter-repo to completely remove the files from all history
# First make sure git filter-repo is installed
if ! command -v git-filter-repo &> /dev/null
then
    echo "git-filter-repo is not installed. Installing via pip..."
    pip install git-filter-repo
fi

# Now remove files from history
git filter-repo --path test_gemini_api.py --invert-paths --force
git filter-repo --path test_pubmed_api.py --invert-paths --force  
git filter-repo --path test_podcastify.py --invert-paths --force

echo ""
echo "History has been rewritten."
echo ""
echo "To complete the process:"
echo "1. Verify the files are removed from history: git log"
echo "2. Replace the main branch: git branch -D main && git branch -m main"
echo "3. Force push to GitHub: git push -f origin main"
echo ""
echo "IMPORTANT: After this, all collaborators will need to clone the repository again"
echo "as their histories will no longer be compatible." 