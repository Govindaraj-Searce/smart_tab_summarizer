// This script relies on Readability.js being injected first.
// It creates a new Readability object from the document's clone,
// parses it, and returns the extracted text content.

try {
    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone);
    const article = reader.parse();
    // Return the extracted text content
    article.textContent;
  } catch (e) {
    // If Readability fails, return null
    null;
  }