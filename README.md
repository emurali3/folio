# Folio

**Answers from your sources. Sources included.**

Folio is a local-first document Q&A app. Attach a local file or folder path, or a public webpage URL, ask a question, and get a concise answer grounded in the passages Folio found.

## Features

- Ask Gemini, OpenAI, or Claude (Anthropic).
- Search PDF, DOCX, TXT, Markdown, CSV, JSON, LOG, YAML, XML, and HTML files.
- Review the source passages behind each answer.
- Select a local file or folder with the Windows path picker, or enter its path manually.
- Read local documents from disk through Folio's local service; the browser does not upload file contents.
- Fetch public webpage and document URLs in the browser when the site permits cross-origin access (CORS). Pages that require client-side JavaScript to render content may not be readable.

Folio supports up to 120 sources, 8 MB per source, and 60 MB total per index.

## Run locally

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env`.
3. Add one or more provider keys to `.env`: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`. Never commit `.env`.
4. Run `npm run dev` and open the local address printed by Vite.

The selected provider's key in `.env` takes priority. If it is not configured, Folio uses the key saved for the current browser tab. Tab keys are stored in `sessionStorage` and sent to the local Folio service; keys from `.env` stay on the server. Model overrides are listed in `.env.example`.

## Files and privacy

The local service reads selected file or folder paths directly from disk. Public URLs are fetched by the browser and must allow cross-origin requests. Folio sends only your question and up to five matching excerpts to the selected AI provider, not full documents.

Local path selection is available when Folio runs on the same Windows machine as the files. The native picker passes only the selected path to Folio; document contents stay on disk and are read by the local service. A local index is cleared when the service restarts. The browser-only site cannot access machine paths, so use a public HTTPS URL with CORS enabled there. Source files are never uploaded to Folio; only matching excerpts are sent to the selected provider.

## Development

- `npm run build` typechecks and builds the local app.
- `npm run lint` runs the project linter.
