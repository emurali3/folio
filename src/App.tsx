import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertCircle, ArrowUp, FileText, FolderOpen, LoaderCircle, Plus, Search, ShieldCheck, Sparkles } from 'lucide-react'
import './App.css'

type IndexedFile = {
  id: string
  name: string
  path: string
  text?: string
  file?: File
}

type SourceMatch = {
  id: string
  name: string
  path: string
  excerpt: string
  score: number
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceMatch[]
  error?: boolean
}

type Theme = 'forest' | 'ocean' | 'solar'

const themes: Array<{ id: Theme; label: string }> = [
  { id: 'forest', label: 'Forest' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'solar', label: 'Solar' },
]

const maxFiles = 120
const maxFileBytes = 8 * 1024 * 1024
const maxTotalBytes = 60 * 1024 * 1024
const maxTotalCharacters = 24_000_000
const supportedExtensions = new Set(['txt', 'md', 'csv', 'json', 'log', 'yaml', 'yml', 'xml', 'html', 'pdf', 'docx'])
const ignoredDirectories = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.venv', 'venv', 'windows', 'program files', 'program files (x86)', '$recycle.bin', 'system volume information'])
const stopWords = new Set(['about', 'after', 'also', 'and', 'are', 'can', 'did', 'does', 'for', 'from', 'have', 'how', 'into', 'its', 'more', 'not', 'our', 'that', 'the', 'their', 'there', 'this', 'was', 'what', 'when', 'where', 'which', 'who', 'with', 'would', 'you', 'your'])

function fileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

async function extractText(file: File) {
  const extension = fileExtension(file.name)

  if (extension === 'pdf') {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return pages.join('\n\n')
  }

  if (extension === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser')
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
  }

  return file.text()
}

function findRelevantPassages(question: string, files: IndexedFile[]) {
  const terms = [...new Set((question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((term) => !stopWords.has(term)))]
  if (!terms.length) return []

  const normalizedQuestion = question.toLowerCase().trim()
  const bestByFile = new Map<string, SourceMatch>()

  for (const file of files) {
    if (!file.text) continue
    for (let offset = 0; offset < file.text.length; offset += 1800) {
      const passage = file.text.slice(offset, offset + 2400).trim()
      if (!passage) continue
      const lowerPassage = passage.toLowerCase()
      const lowerPath = file.path.toLowerCase()
      let score = 0

      for (const term of terms) {
        score += Math.min(lowerPassage.split(term).length - 1, 4) * 2
        if (lowerPath.includes(term)) score += 3
      }
      if (normalizedQuestion.length > 5 && lowerPassage.includes(normalizedQuestion)) score += 10
      if (score > (bestByFile.get(file.id)?.score ?? 0)) {
        bestByFile.set(file.id, {
          id: file.id,
          name: file.name,
          path: file.path,
          excerpt: passage.slice(0, 1250),
          score,
        })
      }
    }
  }

  return [...bestByFile.values()].sort((first, second) => second.score - first.score).slice(0, 5)
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = window.localStorage.getItem('mevars-theme')
    return themes.some((option) => option.id === storedTheme) ? storedTheme as Theme : 'forest'
  })
  const [files, setFiles] = useState<IndexedFile[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [folderPath, setFolderPath] = useState('')
  const [sourceMode, setSourceMode] = useState<'selection' | 'path'>('selection')
  const [isIndexing, setIsIndexing] = useState(false)
  const [isAsking, setIsAsking] = useState(false)
  const [indexNotice, setIndexNotice] = useState('Choose files or a folder, or enter a folder path.')
  const [apiReady, setApiReady] = useState<boolean | null>(null)
  const folderPickerRef = useRef<HTMLInputElement>(null)
  const filePickerRef = useRef<HTMLInputElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('mevars-theme', theme)
  }, [theme])

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then((data: { configured?: boolean; files?: IndexedFile[]; folderName?: string }) => {
        setApiReady(Boolean(data.configured))
        if (data.files?.length) {
          setFiles(data.files)
          setSourceMode('path')
          setIndexNotice(`${data.files.length} files indexed from ${data.folderName ?? 'folder'}`)
        }
      })
      .catch(() => setApiReady(false))
  }, [])

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isAsking])

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!selectedFiles.length || isIndexing) return

    setIsIndexing(true)
    let skipped = 0
    let addedCharacters = files.reduce((total, file) => total + (file.text?.length ?? 0), 0)
    let addedBytes = files.reduce((total, file) => total + (file.file?.size ?? 0), 0)
    const indexed: IndexedFile[] = []
    const alreadyIndexed = new Set(files.map((file) => file.path))

    for (const file of selectedFiles) {
      const relativePath = file.webkitRelativePath || file.name
      const extension = fileExtension(file.name)
      const pathSegments = relativePath.split(/[\\/]/)
      if (pathSegments.some((segment) => segment.startsWith('.') || ignoredDirectories.has(segment.toLowerCase()))) {
        skipped += 1
        continue
      }
      if (!supportedExtensions.has(extension) || alreadyIndexed.has(relativePath)) {
        if (!alreadyIndexed.has(relativePath)) skipped += 1
        continue
      }
      if (files.length + indexed.length >= maxFiles || file.size > maxFileBytes || addedBytes + file.size > maxTotalBytes || addedCharacters >= maxTotalCharacters) {
        skipped += 1
        continue
      }

      setIndexNotice(`Reading ${indexed.length + 1} of ${selectedFiles.length} selected files...`)
      try {
        const text = (await extractText(file)).slice(0, maxTotalCharacters - addedCharacters)
        if (!text.trim()) {
          skipped += 1
          continue
        }
        indexed.push({
          id: `${relativePath}:${file.lastModified}`,
          name: file.name,
          path: relativePath,
          text,
          file,
        })
        alreadyIndexed.add(relativePath)
        addedCharacters += text.length
        addedBytes += file.size
      } catch {
        skipped += 1
      }
    }

    if (indexed.length) {
      await fetch('/api/index', { method: 'DELETE' })
      setFiles((current) => sourceMode === 'path' ? indexed : [...current, ...indexed])
      setSourceMode('selection')
      setMessages([])
      const fileCount = sourceMode === 'path' ? indexed.length : files.length + indexed.length
      setIndexNotice(`${fileCount} files indexed${skipped ? ` | ${skipped} skipped` : ''}`)
    } else {
      setIndexNotice(skipped ? `No supported files added | ${skipped} skipped` : 'Those files are already in your index.')
    }
    setIsIndexing(false)
  }

  async function indexFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const folder = folderPath.trim().replace(/^(["']).*\1$/, (value) => value.slice(1, -1))
    if (!folder || isIndexing) return

    setIsIndexing(true)
    setIndexNotice('Reading supported files from that folder on this PC...')
    try {
      const response = await fetch('/api/index-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: folder }),
      })
      const data = await response.json() as { files?: IndexedFile[]; folderName?: string; skipped?: number; error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not read that folder.')
      const indexedFiles = data.files ?? []
      setFiles(indexedFiles)
      setSourceMode('path')
      setMessages([])
      setIndexNotice(`${indexedFiles.length} files indexed from ${data.folderName ?? 'folder'}${data.skipped ? ` | ${data.skipped} skipped` : ''}`)
    } catch (error) {
      setIndexNotice(error instanceof Error ? error.message : 'Could not read that folder.')
    } finally {
      setIsIndexing(false)
    }
  }

  async function removeFile(fileId: string) {
    if (sourceMode === 'path') await fetch(`/api/index/${encodeURIComponent(fileId)}`, { method: 'DELETE' })
    const remaining = files.filter((file) => file.id !== fileId)
    setFiles(remaining)
    setIndexNotice(remaining.length ? `${remaining.length} files indexed` : 'Choose files or a folder, or enter a folder path.')
  }

  function openSource(sourceId: string) {
    if (sourceMode === 'path') {
      window.open(`/api/open/${encodeURIComponent(sourceId)}`, '_blank', 'noopener,noreferrer')
      return
    }
    const source = files.find((file) => file.id === sourceId)
    if (!source?.file) return
    const url = URL.createObjectURL(source.file)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const currentQuestion = question.trim()
    if (!currentQuestion || isAsking || isIndexing) return

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: currentQuestion }
    setMessages((current) => [...current, userMessage])
    setQuestion('')
    const sources = sourceMode === 'selection' ? findRelevantPassages(currentQuestion, files) : undefined
    if (sourceMode === 'selection' && !sources?.length) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I could not find a matching passage in the files you selected. Try different wording or add another folder.',
      }])
      return
    }

    setIsAsking(true)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sources ? { question: currentQuestion, sources } : { question: currentQuestion }),
      })
      const data = await response.json() as { answer?: string; sources?: SourceMatch[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'The answer could not be generated.')
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer || 'Gemini returned an empty answer. Try asking another way.',
        sources: data.sources,
      }])
    } catch (error) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Could not reach the local Gemini service.',
        error: true,
      }])
    } finally {
      setIsAsking(false)
    }
  }

  function askSuggestion(value: string) {
    setQuestion(value)
  }

  return (
    <main className="app-shell">
      <aside className="library-rail">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <span className="brand-name">ME\VARS</span>
          <span className="brand-edition">LOCAL</span>
        </div>

        <div className="library-heading">
          <span>YOUR LIBRARY</span>
          <span className="file-count">{files.length.toString().padStart(2, '0')}</span>
        </div>
        <div className="library-actions">
          <button className="folder-action" type="button" onClick={() => folderPickerRef.current?.click()} disabled={isIndexing}>
            {isIndexing ? <LoaderCircle className="spin" size={17} /> : <FolderOpen size={17} />}
            <span>{isIndexing ? 'Reading files' : 'Choose folder'}</span>
          </button>
          <button className="file-action" type="button" onClick={() => filePickerRef.current?.click()} disabled={isIndexing}><Plus size={16} /> Add files</button>
          <input ref={(element) => { folderPickerRef.current = element; element?.setAttribute('webkitdirectory', '') }} className="hidden-input" type="file" multiple onChange={addFiles} />
          <input ref={filePickerRef} className="hidden-input" type="file" multiple accept=".txt,.md,.csv,.json,.log,.yaml,.yml,.xml,.html,.pdf,.docx" onChange={addFiles} />
        </div>
        <form className="folder-form" onSubmit={indexFolder}>
          <label htmlFor="folder-path">OR ENTER A FOLDER PATH</label>
          <input id="folder-path" value={folderPath} onChange={(event) => setFolderPath(event.target.value)} placeholder="C:\\Users\\you\\Documents" disabled={isIndexing} />
          <button className="folder-action" type="submit" disabled={!folderPath.trim() || isIndexing}>
            {isIndexing ? <LoaderCircle className="spin" size={17} /> : <FolderOpen size={17} />}
            <span>{isIndexing ? 'Indexing folder' : sourceMode === 'path' ? 'Re-index path' : 'Index this path'}</span>
          </button>
        </form>

        <div className="indexed-list" aria-live="polite">
          {files.length ? files.map((file) => (
            <div className="indexed-file" key={file.id} title={file.path}>
              <FileText size={16} aria-hidden="true" />
              <span className="indexed-file-name" title={file.path}>{file.name}</span>
              <button type="button" className="remove-file" onClick={() => removeFile(file.id)} aria-label={`Remove ${file.name}`} title="Remove from this index">x</button>
            </div>
          )) : (
            <div className="empty-library">
              <div className="empty-library-icon"><FolderOpen size={19} /></div>
              <p>No files yet</p>
              <span>Choose files, choose a folder, or enter its path.</span>
            </div>
          )}
        </div>

        <div className="rail-footer">
          <div className="privacy-note"><ShieldCheck size={16} /><span>Files stay on this device</span></div>
          <div className={`connection-state ${apiReady ? 'connected' : ''}`}>
            <span className="connection-dot" />
            {apiReady === null ? 'Checking Gemini...' : apiReady ? 'Gemini connected' : 'Gemini needs a key'}
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Library</span><span className="breadcrumb-slash">/</span><strong>Ask your files</strong></div>
          <div className="topbar-right">
            <div className="theme-picker" role="group" aria-label="Choose color theme">
              {themes.map((option) => (
                <button
                  key={option.id}
                  className={`theme-button theme-button-${option.id}`}
                  type="button"
                  title={`${option.label} theme`}
                  aria-label={`${option.label} color theme`}
                  aria-pressed={theme === option.id}
                  onClick={() => setTheme(option.id)}
                >
                  <span className="theme-swatch" aria-hidden="true" />
                </button>
              ))}
            </div>
            <span className="local-pill"><span /> LOCAL INDEX</span>
            <button className="search-icon" type="button" title="Search indexed files" onClick={() => document.querySelector<HTMLTextAreaElement>('#question-input')?.focus()}><Search size={18} /></button>
          </div>
        </header>

        <div className={`conversation ${messages.length ? 'has-messages' : ''}`}>
          {!messages.length ? (
            <div className="welcome-screen">
              <div className="eyebrow"><Sparkles size={14} /> YOUR FILES, IN CONTEXT</div>
              <h1>Find the thread.<br /><em>Get the answer.</em></h1>
              <p className="welcome-copy">Choose files or a folder, or enter a folder path. Ask a question and Folio shows exactly where each answer came from.</p>
              <div className="suggestion-label">TRY A QUESTION</div>
              <div className="suggestions">
                {['What are the main deadlines?', 'Summarize the latest notes', 'Find mentions of the budget'].map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => askSuggestion(suggestion)} disabled={!files.length}>{suggestion}<ArrowUp size={14} /></button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article className={`message ${message.role} ${message.error ? 'message-error' : ''}`} key={message.id}>
                  {message.role === 'assistant' && <div className="assistant-marker"><span className="brand-mark mini" aria-hidden="true"><span /><span /><span /></span><span>ME\VARS</span>{message.error && <AlertCircle size={14} />}</div>}
                  <div className="message-content">{message.content}</div>
                  {message.sources?.length ? (
                    <div className="source-block">
                      <div className="source-heading"><span>FOUND IN</span><span>{message.sources.length} {message.sources.length === 1 ? 'SOURCE' : 'SOURCES'}</span></div>
                      {message.sources.map((source, index) => (
                        <div className="source-row" key={`${message.id}-${source.id}`}>
                          <span className="source-number">{String(index + 1).padStart(2, '0')}</span>
                          <div className="source-copy"><strong title={source.path}>{source.name}</strong><p>{source.excerpt}{source.excerpt.length >= 1250 ? '...' : ''}</p></div>
                          <button type="button" className="open-source" onClick={() => openSource(source.id)} aria-label={`Open ${source.name}`} title="Open original file"><ArrowUp size={15} /></button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
              {isAsking && <div className="thinking"><span className="brand-mark mini" aria-hidden="true"><span /><span /><span /></span><LoaderCircle className="spin" size={16} /> Finding an answer in your files...</div>}
              <div ref={conversationEndRef} />
            </div>
          )}
        </div>

        <div className="composer-area">
          {!files.length && <p className="composer-hint">Choose files or a folder, or enter a folder path.</p>}
          {files.length > 0 && !apiReady && <p className="composer-hint key-hint">{apiReady === null ? 'Checking the local Gemini connection...' : 'Add GEMINI_API_KEY to .env, then restart the app.'}</p>}
          <form className="composer" onSubmit={askQuestion}>
            <textarea id="question-input" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }} placeholder={files.length ? 'Ask something about your files...' : 'Index a folder to begin...'} rows={2} disabled={!files.length || isIndexing || isAsking} />
            <div className="composer-footer"><span>{indexNotice}</span><button type="submit" className="send-button" aria-label="Ask Folio" disabled={!files.length || !question.trim() || isIndexing || isAsking}><ArrowUp size={18} /></button></div>
          </form>
          <div className="disclosure"><ShieldCheck size={13} /> Only matching excerpts are sent to Gemini for an answer.</div>
        </div>
      </section>
    </main>
  )
}

export default App
