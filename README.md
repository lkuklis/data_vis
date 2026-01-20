# CSV Explorer

A lightweight, browser-only data explorer for the bundled `data.csv` file, with the option to paste CSV data or upload a local file:

- Sorting by column (click headers)
- Filtering by column or across all fields
- EDA summaries (row/column counts, missing values, numeric stats)
- Charts (histogram, category counts, scatter plot)

## How to use

1. Start a local web server from this directory:

   ```bash
   python -m http.server 8000
   ```

2. Open `http://localhost:8000` in your browser.
3. The app automatically loads `data.csv` from the repository.
4. Optionally paste CSV data or upload a CSV file to replace it.
5. Use the filter controls and chart selectors to explore your data.

## UI stack

The interface uses Tailwind CSS via the CDN for a modern, responsive layout.

## Why this works without file upload

If you cannot attach a CSV in your environment, the app still loads the bundled `data.csv` automatically, or you can paste CSV text directly into the textarea. All parsing happens in the browser, so nothing is uploaded to a server.
