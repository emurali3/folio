# ME\VARS

Folio is a local-first file search assistant. Choose a folder on this PC, ask a question, and get an answer with the passages it used.

## Run it

1. Copy `.env.example` to `.env`.
2. Add your Gemini API key as `GEMINI_API_KEY` in `.env`. Do not put the key in frontend code or commit `.env`.
3. Run `npm run dev` and open the local URL shown by Vite.

With **Choose folder** or **Add files**, Folio reads and searches selected files in browser memory. With a typed folder path, the localhost service reads and searches that folder on disk. Neither mode sends full files to Gemini: the local API sends only your question and up to five matching excerpts. Gemini requests use `store: false`. Browser-selected files are cleared on refresh; the path index is cleared when the local service restarts.

Supported formats: PDF, DOCX, TXT, Markdown, CSV, JSON, LOG, YAML, XML, and HTML. Limits: 120 files, 8 MB per file, and 60 MB total file size. Browsers do not disclose a selected folder's absolute path to web apps; the chooser grants Folio permission to read its files locally.

The Gemini endpoint is a local development service. Production deployment and desktop packaging are not configured yet.
