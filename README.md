# Folio

**Answers from your sources. Sources included.**

Folio is a local-first document Q&A app. Attach a local file or folder path, or a public webpage URL, ask a question, and get a concise answer grounded in the passages Folio found.

## Features

- Ask Gemini, OpenAI, or Claude (Anthropic).
- Search PDF, DOCX, TXT, Markdown, CSV, JSON, LOG, YAML, XML, and HTML files.
- Review the source passages behind each answer.
- Index a local file or folder path without uploading documents through the browser.
- Fetch public webpage and document URLs in the browser when the site permits cross-origin access (CORS).

Folio supports up to 120 sources, 8 MB per source, and 60 MB total per index.

## Run locally

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env`.
3. Add one or more provider keys to `.env`: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`. Never commit `.env`.
4. Run `npm run dev` and open the local address printed by Vite.

The selected provider's key in `.env` takes priority. If it is not configured, Folio uses the key saved for the current browser tab. Tab keys are stored in `sessionStorage` and sent to the local Folio service; keys from `.env` stay on the server. Model overrides are listed in `.env.example`.

## Files and privacy

The local service reads file and folder paths on disk. Public URLs are fetched directly into browser memory and must allow cross-origin requests. Folio sends only your question and up to five matching excerpts to the selected AI provider, not full documents.

Local paths are available only when running Folio on the same machine as the files. A local path index is cleared when the service restarts; URL sources are kept in the current browser tab and cleared on refresh. Browser-only deployments cannot read arbitrary machine paths, so use public HTTPS URLs with CORS enabled there. URLs and local documents are never uploaded to Folio; only matching excerpts are sent to the selected provider.

## Development

- `npm run build` typechecks and builds the local app.
- `npm run lint` runs the project linter.
