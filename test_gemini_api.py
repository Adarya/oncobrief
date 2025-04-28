# Import the necessary library
import google.generativeai as genai
import os # Often used for environment variables, though not strictly needed here

# --- Configuration ---
# WARNING: Storing API keys directly in code is insecure.
# Consider using environment variables:
# API_KEY = os.getenv("GEMINI_API_KEY")
# Or other secure methods for production applications.
API_KEY = "AIzaSyBhPw5XyhH9i7i778DsmX1oGa9cPns_wWM" # Your provided API key


# --- Initialize the Gemini Client ---
try:
    # Configure the client library with your API key
    genai.configure(api_key=API_KEY)

    # Create an instance of the GenerativeModel
    # Specify the model name. 'gemini-1.5-pro-latest' is a common choice.
    # Check the Google AI documentation for the latest available model names.
    # model = genai.GenerativeModel('gemini-1.5-pro-latest')
    model = genai.GenerativeModel('gemini-2.5-flash-preview-04-17')

    # --- Define the Test Prompt ---
    test_prompt = "What is the speed of light in a vacuum?"

    print(f"Sending prompt to Gemini: '{test_prompt}'")

    # --- Generate Content ---
    # Send the prompt to the model
    response = model.generate_content(test_prompt)

    # --- Print the Response ---
    # Access the generated text from the response object
    print("\n--- Gemini Response ---")
    # Add basic error checking for the response structure
    if response and response.text:
         print(response.text)
    elif response and response.prompt_feedback:
         print(f"Content generation blocked. Reason: {response.prompt_feedback}")
    else:
         print("Received an empty or unexpected response from the API.")
         # print("Full Response Object:", response) # Uncomment for debugging

except ImportError:
    print("Error: The 'google-generativeai' library is not installed.")
    print("Please install it using: pip install google-generativeai")
except Exception as e:
    # Catch potential errors during API configuration or generation
    print(f"\nAn error occurred: {e}")
    print("Please check your API key, internet connection, and model name.")

print("\n--- Script Finished ---")
