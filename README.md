# Folio

**Answers from your files. Sources included.**

Folio is a local-first document Q&A assistant. Choose files or a folder, ask a question, and get a concise answer grounded in the passages it used.

## Run it

1. Copy `.env.example` to `.env`.
2. Add one or more provider keys as `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY` in `.env`. Do not put keys in frontend code or commit `.env`.
3. Run `npm run dev` and open the local URL shown by Vite.

Choose Gemini, OpenAI, or Claude (Anthropic) in the sidebar. In local mode, Folio uses the selected provider's key from `.env` first. If it is not configured, Folio can use a key saved for the current browser tab; tab keys are kept in `sessionStorage` and sent only to the localhost service. Keys from `.env` stay on the server. With **Choose folder** or **Add files**, Folio reads and searches selected files in browser memory. With a typed folder path, the localhost service reads and searches that folder on disk. Neither mode sends full files: only your question and up to five matching excerpts go to the selected provider. Browser-selected files are cleared on refresh; the path index is cleared when the local service restarts.

Supported formats: PDF, DOCX, TXT, Markdown, CSV, JSON, LOG, YAML, XML, and HTML. Limits: 120 files, 8 MB per file, and 60 MB total file size. Browsers do not disclose a selected folder's absolute path to web apps; the chooser grants Folio permission to read its files locally.

## GitHub Pages

Run `npm run build:pages` to build the static site at the `/folio/` project path. Pages mode supports browser-selected files and folders only; browsers cannot grant a web app access to an absolute folder path. Since Pages has no local server or `.env`, each browser tab must provide its own key for Gemini, OpenAI, or Claude. Keys are stored in that tab's `sessionStorage` and sent directly to the selected provider with matching excerpts; they are not embedded in the repository or build output. Browser keys are visible to the browser and must be restricted to the Pages site's HTTP referrer where the provider supports it. Claude (Anthropic) browser requests explicitly opt into direct-browser access.

GitHub Pages sites are public even when their source repository is private. GitHub requires an eligible paid plan to publish Pages from a private repository. After enabling Pages with **GitHub Actions** as the source, add the repository Actions variable `ENABLE_PAGES` with value `true` to allow the deployment job to run. The workflow builds on pushes to `main` but leaves deployment disabled until that variable is set.

Local development continues to use `.env`, the localhost API, and typed folder paths. Desktop packaging is not configured.
