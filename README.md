# ME\VARS

ME\VARS is a local-first file search assistant. Choose files or a folder, ask a question, and get an answer with the passages it used.

## Run it

1. Copy `.env.example` to `.env`.
2. Add your Gemini API key as `GEMINI_API_KEY` in `.env`. Do not put the key in frontend code or commit `.env`.
3. Run `npm run dev` and open the local URL shown by Vite.

With **Choose folder** or **Add files**, ME\VARS reads and searches selected files in browser memory. With a typed folder path, the localhost service reads and searches that folder on disk. Neither mode sends full files to Gemini: the local API sends only your question and up to five matching excerpts. Gemini requests use `store: false`. Browser-selected files are cleared on refresh; the path index is cleared when the local service restarts.

Supported formats: PDF, DOCX, TXT, Markdown, CSV, JSON, LOG, YAML, XML, and HTML. Limits: 120 files, 8 MB per file, and 60 MB total file size. Browsers do not disclose a selected folder's absolute path to web apps; the chooser grants ME\VARS permission to read its files locally.

## GitHub Pages

Run `npm run build:pages` to build the static site at the `/mevars/` project path. Pages mode supports browser-selected files and folders only; browsers cannot grant a web app access to an absolute folder path. Each browser tab must provide its own Gemini API key. The key is stored in that tab's `sessionStorage` and sent directly to Google with matching excerpts. It is not embedded in the repository or build output. Restrict the key to the Pages site's HTTP referrer in Google AI Studio.

GitHub Pages sites are public even when their source repository is private. GitHub requires an eligible paid plan to publish Pages from a private repository. After enabling Pages with **GitHub Actions** as the source, add the repository Actions variable `ENABLE_PAGES` with value `true` to allow the deployment job to run. The workflow builds on pushes to `main` but leaves deployment disabled until that variable is set.

Local development continues to use `.env`, the localhost API, and typed folder paths. Desktop packaging is not configured.
