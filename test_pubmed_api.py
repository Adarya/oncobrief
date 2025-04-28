# Import necessary libraries
import requests  # For making HTTP requests to the API
import xml.etree.ElementTree as ET  # For parsing the XML responses from the API
import time  # For adding delays between API calls (politeness)
import re # For regular expression matching (used in date parsing fallback)
import datetime # To help construct date ranges dynamically (optional but good practice)

# --- Configuration ---
# WARNING: Hardcoding API keys is generally insecure. Consider environment variables for production.
API_KEY = "77e480329e7293ae3c9984c5346a98cc5b08" # Your provided NCBI API key
BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/" # Base URL for NCBI E-utilities

# NCBI Usage Policy:
# - Without API key: Max 3 requests per second.
# - With API key: Max 10 requests per second.
# We add a small delay to stay well within the limits.
REQUEST_DELAY_SECONDS = 0.15 # Delay in seconds between consecutive API calls

# It's good practice to identify your script to NCBI via the User-Agent header
HEADERS = {
    'User-Agent': 'PubMedClient/1.0 (Python Script; contact: your_email@example.com)'
    # Replace your_email@example.com with your actual contact if deploying this script
}

# --- Functions ---

def search_pubmed(query, max_results=10):
    """
    Searches PubMed for articles matching the query using NCBI ESearch.

    Args:
        query (str): The search term string (e.g., "cancer therapy[Title/Abstract]").
                     See NCBI documentation for advanced query syntax.
        max_results (int): The maximum number of PubMed IDs (PMIDs) to retrieve.

    Returns:
        list: A list of PubMed IDs (PMIDs) as strings if successful.
        list: An empty list if no results are found.
        None: If an error occurs during the API request or parsing.
    """
    print(f"Searching PubMed for: '{query}' (max_results={max_results})...")
    search_url = BASE_URL + "esearch.fcgi"
    params = {
        'db': 'pubmed',         # Database to search
        'term': query,          # The search query itself
        'retmax': str(max_results), # Maximum number of results to return IDs for
        'usehistory': 'y',      # Use history server (useful for large result sets/batching)
        'api_key': API_KEY      # Your NCBI API key
    }

    try:
        # Make the GET request to the ESearch utility
        # Add a timeout to prevent hanging indefinitely
        response = requests.get(search_url, params=params, headers=HEADERS, timeout=30) # 30 second timeout
        # Raise an HTTPError exception for bad responses (4xx or 5xx)
        response.raise_for_status()

        # Introduce a delay before the next potential request
        time.sleep(REQUEST_DELAY_SECONDS)

        # Parse the XML response content
        root = ET.fromstring(response.content)

        # Find the list of IDs in the XML structure
        id_list_element = root.find('IdList')
        if id_list_element is None:
            # Check if the reason for no IdList is simply zero results
            count_element = root.find('Count')
            if count_element is not None and count_element.text == '0':
                print("Search returned 0 results.")
                return [] # Return empty list for no results
            else:
                # The XML structure might be unexpected (e.g., an error message from NCBI)
                print("Warning: Could not find 'IdList' in the search response XML.")
                # print("Response Text:", response.text) # Uncomment for debugging
                return None # Indicate an issue

        # Extract the text content (PMID) from each 'Id' tag within 'IdList'
        pmids = [id_element.text for id_element in id_list_element.findall('Id') if id_element.text]
        print(f"Found {len(pmids)} PMIDs.")
        return pmids

    except requests.exceptions.Timeout:
        print("Error: The PubMed search request timed out.")
        return None
    except requests.exceptions.RequestException as e:
        # Handle network-related errors (DNS failure, refused connection, etc.)
        print(f"Error during PubMed search request: {e}")
        return None
    except ET.ParseError as e:
        # Handle errors during XML parsing (malformed XML)
        print(f"Error parsing search XML response: {e}")
        # print("Response Text:", response.text) # Uncomment for debugging
        return None
    except Exception as e:
        # Catch any other unexpected errors
        print(f"An unexpected error occurred during search: {e}")
        return None


def fetch_pubmed_details(pmids):
    """
    Fetches article details (title, abstract, authors, etc.) for a list of PMIDs
    using NCBI EFetch.

    Args:
        pmids (list): A list of PubMed IDs (strings) to fetch details for.

    Returns:
        list: A list of dictionaries, where each dictionary contains details
              for one article (keys: pmid, title, abstract, authors, journal, pub_year).
              Returns an empty list if the input pmids list is empty.
        None: If a fatal error occurs during the API request or parsing.
    """
    if not pmids:
        print("No PMIDs provided to fetch details.")
        return [] # Return empty list if no PMIDs are given

    print(f"Fetching details for {len(pmids)} PMIDs...")
    fetch_url = BASE_URL + "efetch.fcgi"

    # Use POST for potentially long lists of PMIDs to avoid overly long URLs
    data = {
        'db': 'pubmed',         # Database to fetch from
        'id': ','.join(pmids),  # Comma-separated list of PMIDs
        'retmode': 'xml',       # Desired return format
        'rettype': 'abstract',  # Desired return type (alternatives: 'medline', 'fasta')
        'api_key': API_KEY      # Your NCBI API key
    }

    try:
        # Make the POST request to the EFetch utility
        # Add a timeout
        response = requests.post(fetch_url, data=data, headers=HEADERS, timeout=60) # 60 second timeout
        # Raise an HTTPError exception for bad responses
        response.raise_for_status()

        # Introduce a delay
        time.sleep(REQUEST_DELAY_SECONDS)

        # Parse the XML response
        root = ET.fromstring(response.content)
        articles_data = [] # List to hold the dictionaries of article details

        # Iterate through each <PubmedArticle> element in the response
        for article_element in root.findall('.//PubmedArticle'):
            # Initialize a dictionary to store details for the current article
            article_info = {
                'pmid': None,
                'title': None,
                'abstract': None,
                'authors': None,
                'journal': None,
                'pub_year': None
            }

            # --- Extract PMID ---
            # Find the PMID within the MedlineCitation element
            pmid_element = article_element.find('.//MedlineCitation/PMID')
            if pmid_element is not None and pmid_element.text:
                article_info['pmid'] = pmid_element.text

            # --- Extract Article Title ---
            # Find the ArticleTitle within the Article element
            title_element = article_element.find('.//Article/ArticleTitle')
            if title_element is not None:
                # Use itertext() to handle potential inline tags (like <i>) within the title
                article_info['title'] = "".join(title_element.itertext()).strip()

            # --- Extract Abstract ---
            abstract_texts = []
            # Find the main Abstract element
            abstract_element = article_element.find('.//Article/Abstract')
            if abstract_element is not None:
                 # Find all AbstractText elements within the Abstract
                 # These can represent different sections (BACKGROUND, METHODS, etc.)
                 for abstract_text_element in abstract_element.findall('.//AbstractText'):
                     # Check for a 'Label' attribute (e.g., "BACKGROUND")
                     label = abstract_text_element.get('Label')
                     text = abstract_text_element.text
                     if text: # Ensure there is text content
                         text = text.strip()
                         if label:
                              # Prepend the label if it exists
                              abstract_texts.append(f"{label.upper()}: {text}")
                         else:
                              abstract_texts.append(text)

            if abstract_texts:
                 # Join the parts of the abstract with newlines
                 article_info['abstract'] = "\n".join(abstract_texts)
            else:
                 # Fallback: Check for abstract text directly within OtherAbstract (less common)
                 other_abstract_element = article_element.find('.//OtherAbstract/AbstractText')
                 if other_abstract_element is not None and other_abstract_element.text:
                     article_info['abstract'] = other_abstract_element.text.strip()
                 else:
                     # If no abstract found anywhere
                     article_info['abstract'] = "No abstract available."

            # --- Extract Authors ---
            # Find the AuthorList element
            author_list_element = article_element.find('.//Article/AuthorList')
            if author_list_element is not None:
                authors = []
                # Iterate through each Author element
                for author_element in author_list_element.findall('.//Author'):
                    # Extract LastName and Initials if available
                    lastname = author_element.findtext('LastName')
                    initials = author_element.findtext('Initials')
                    collective_name = author_element.findtext('CollectiveName') # Handle group authors

                    if lastname and initials:
                        authors.append(f"{lastname}, {initials}")
                    elif lastname: # Handle cases with only last name
                        authors.append(lastname)
                    elif collective_name: # Handle collective/group authors
                         authors.append(collective_name)

                if authors:
                    # Join author names with semicolons
                    article_info['authors'] = "; ".join(authors)

            # --- Extract Journal Title ---
            # Find the Journal Title element
            journal_element = article_element.find('.//Article/Journal/Title')
            if journal_element is not None and journal_element.text:
                article_info['journal'] = journal_element.text

            # --- Extract Publication Year ---
            # Primarily look for the Year element within PubDate
            pub_year_element = article_element.find('.//Article/Journal/JournalIssue/PubDate/Year')
            if pub_year_element is not None and pub_year_element.text:
                article_info['pub_year'] = pub_year_element.text
            else:
                # Fallback: Look for MedlineDate, which might contain the year
                medline_date_element = article_element.find('.//Article/Journal/JournalIssue/PubDate/MedlineDate')
                if medline_date_element is not None and medline_date_element.text:
                    # Use regex to extract the first 4-digit number as the year
                    year_match = re.search(r'(\d{4})', medline_date_element.text)
                    if year_match:
                        article_info['pub_year'] = year_match.group(1)

            # Add the extracted details for this article to our results list
            articles_data.append(article_info)

        print(f"Successfully fetched and parsed details for {len(articles_data)} articles.")
        return articles_data

    except requests.exceptions.Timeout:
         print("Error: The PubMed fetch request timed out.")
         return None
    except requests.exceptions.RequestException as e:
        # Handle network-related errors
        print(f"Error during PubMed fetch request: {e}")
        # print("Response text:", response.text) # Uncomment for debugging
        return None
    except ET.ParseError as e:
        # Handle XML parsing errors
        print(f"Error parsing fetch XML response: {e}")
        # print("Response text:", response.text) # Uncomment for debugging
        return None
    except Exception as e:
        # Catch any other unexpected errors
        print(f"An unexpected error occurred during fetch: {e}")
        return None

# --- Test Execution ---
if __name__ == "__main__":
    # == Parameters for Testing ==
    # Define your search query here. Use PubMed syntax.

    # --- Components of the search query ---
    # 1. Title/Abstract terms (joined by OR)
    title_abstract_terms = (
        "carcinoma[Title/Abstract] OR "
        "adenocarcinoma[Title/Abstract] OR "
        "sarcoma[Title/Abstract] OR "
        "melanoma[Title/Abstract] OR "
        "cancer[Title/Abstract] OR "
        "tumor[Title/Abstract]"
    )

    # 2. Journal names (joined by OR, use quotes for multi-word names)
    journal_terms = (
        '"N Engl J Med"[Journal] OR '
        '"Lancet"[Journal] OR '
        '"J Clin Oncol"[Journal]'
    )

    # 3. Date Range (YYYY/MM/DD:YYYY/MM/DD format using [Date - Publication] or [PDAT] field tag)
    # Example: Last 5 full years (adjust as needed)
    # You can also use relative dates like "last 5 years"[dp] but the explicit range is clearer
    end_date = datetime.date.today()
    # start_date = end_date - datetime.timedelta(days=5*365) # Approximate 5 years back
    start_date = end_date - datetime.timedelta(days=14) # Last 14 days
    date_range = f'"{start_date.strftime("%Y/%m/%d")}"[Date - Publication] : "{end_date.strftime("%Y/%m/%d")}"[Date - Publication]'
    # Or define a fixed range:
    # date_range = '"2020/01/01"[Date - Publication] : "2024/12/31"[Date - Publication]'

    # 4. Other filters
    other_filters = "hasabstract" # Ensure an abstract is available

    # --- Combine the components with AND ---
    search_query = f"({title_abstract_terms}) AND ({journal_terms}) AND ({date_range}) AND {other_filters}"

    number_of_articles_to_fetch = 100 # Set how many articles you want to retrieve

    # == Step 1: Search PubMed for PMIDs ==
    print("--- Starting PubMed Search ---")
    pmids_found = search_pubmed(search_query, max_results=number_of_articles_to_fetch)

    # == Step 2: Fetch Details if PMIDs were found ==
    articles = [] # Initialize empty list for article details
    if pmids_found: # Check if the search returned a non-empty list of PMIDs
        print("\n--- Fetching Article Details ---")
        articles = fetch_pubmed_details(pmids_found)
    elif pmids_found == []: # Handle case where search was successful but found 0 results
        print("\nSearch completed, but no matching articles were found.")
    else: # Handle case where search failed (returned None)
        print("\nPubMed search failed. Cannot proceed to fetch details.")

    # == Step 3: Display Results ==
    if articles: # Check if fetch was successful and returned article data
        print("\n--- Retrieved Article Details ---")
        # Loop through each article dictionary and print its details
        for i, article in enumerate(articles):
            print(f"\n----- Article {i+1} -----")
            print(f"PMID:      {article.get('pmid', 'N/A')}") # Use .get for safe access
            print(f"Title:     {article.get('title', 'N/A')}")
            print(f"Authors:   {article.get('authors', 'N/A')}")
            print(f"Journal:   {article.get('journal', 'N/A')} ({article.get('pub_year', 'N/A')})")
            # Print only the first few lines of the abstract for brevity if desired
            abstract_preview = article.get('abstract', 'N/A').split('\n')[0]
            if len(article.get('abstract', 'N/A')) > len(abstract_preview):
                 abstract_preview += "..."
            print(f"Abstract:  {abstract_preview}")
            # print(f"Abstract:  {article.get('abstract', 'N/A')}") # Uncomment to print full abstract
            print("-" * 20)
    elif pmids_found is not None: # If search was okay but fetch failed or returned empty
        print("\nArticle details could not be retrieved.")

    print("\n--- Script Finished ---")
