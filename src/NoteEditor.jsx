import { useEffect, useRef, useState } from 'react'

// Store only text and a small set of formatting tags; no scripts, styles or attributes.
export function cleanHtml(value) {
  const document = new DOMParser().parseFromString(value, 'text/html')
  const allowed = new Set(['P','DIV','BR','STRONG','B','EM','I','U','S','STRIKE','UL','OL','LI','H2','H3','BLOCKQUOTE','A'])
  function clean(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        if (['SCRIPT','STYLE','IFRAME','OBJECT'].includes(child.tagName)) { child.remove(); continue }
        clean(child)
        if (!allowed.has(child.tagName)) child.replaceWith(...child.childNodes)
        else {
          const href = child.tagName === 'A' ? child.getAttribute('href') : null
          for (const attribute of Array.from(child.attributes)) child.removeAttribute(attribute.name)
          if(child.tagName === 'A') {
            try { const url = new URL(href); if(!['https:','http:'].includes(url.protocol))throw new Error(); child.setAttribute('href',url.href);child.setAttribute('target','_blank');child.setAttribute('rel','noopener noreferrer') }
            catch { child.replaceWith(...child.childNodes) }
          }
        }
      } else if (child.nodeType !== 3) child.remove()
    }
  }
  clean(document.body)
  return document.body.innerHTML
}
const tools = [
  ['bold','B','Bold','bold'], ['italic','I','Italic','italic'], ['underline','U','Underline','underline'],
  ['strikeThrough','S','Strikethrough','strike'], ['formatBlock','H','Heading',null,'h2'],
  ['insertUnorderedList','• ≡','Bulleted list'], ['insertOrderedList','1. ≡','Numbered list'],
  ['formatBlock','❝','Quote',null,'blockquote'], ['removeFormat','Tx','Clear formatting'],
  ['undo','↶','Undo'], ['redo','↷','Redo'],
]
export default function NoteEditor({ content, html, onChange, disabled }) {
  const editor = useRef(null), selectedRange = useRef(null)
  const [showLink,setShowLink] = useState(false), [linkUrl,setLinkUrl] = useState(''), [linkError,setLinkError] = useState('')
  const initial = useRef({ content, html })
  useEffect(() => {
    if (initial.current.html) editor.current.innerHTML = cleanHtml(initial.current.html)
    else editor.current.textContent = initial.current.content || ''
  }, [])
  function publish() {
    const text = editor.current.innerText
    if (text.length > 200000) return
    onChange(text, cleanHtml(editor.current.innerHTML))
  }
  function command(name, value) {
    editor.current.focus()
    document.execCommand(name, false, value || null)
    publish()
  }
  function beginLink() {
    const selection = window.getSelection()
    selectedRange.current = selection?.rangeCount && editor.current.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null
    setLinkError('');setLinkUrl('');setShowLink(true)
  }
  function insertLink() {
    try {
      const url = new URL(linkUrl.trim())
      if(!['https:','http:'].includes(url.protocol))throw new Error()
      editor.current.focus()
      const selection = window.getSelection()
      if(selectedRange.current) { selection.removeAllRanges();selection.addRange(selectedRange.current) }
      if(selection && !selection.isCollapsed) document.execCommand('createLink',false,url.href)
      else { const anchor = document.createElement('a');anchor.href=url.href;anchor.textContent=url.href;document.execCommand('insertHTML',false,anchor.outerHTML) }
      publish();setShowLink(false)
    } catch { setLinkError('Enter a valid http:// or https:// link.') }
  }
  function paste(event) {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text.slice(0, Math.max(0, 200000 - editor.current.innerText.length)))
    publish()
  }
  return <div className="note-editor-field"><label id="note-editor-label">Your note</label>
    <div className={`note-editor ${disabled ? 'is-disabled' : ''}`}>
      <div className="note-editor-toolbar" role="toolbar" aria-label="Text formatting">{tools.map(([name, label, title, className, value]) => <button key={name + (value || '')} type="button" title={title} aria-label={title} className={className || ''} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => command(name, value)}>{label}</button>)}<button type="button" title="Insert link" aria-label="Insert link" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={beginLink}>↗ Link</button><button type="button" title="Remove link" aria-label="Remove link" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => command('unlink')}>Unlink</button></div>{showLink && <div className="note-link-input"><input type="url" aria-label="Link URL" placeholder="https://example.com" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} disabled={disabled} /><button type="button" onClick={insertLink} disabled={disabled}>Insert</button><button type="button" onClick={() => setShowLink(false)}>Cancel</button>{linkError && <span role="alert">{linkError}</span>}</div>}
      <div ref={editor} className="note-editor-content" role="textbox" aria-labelledby="note-editor-label" aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning onInput={publish} onPaste={paste} data-placeholder="Start writing…" />
    </div><p className="note-editor-help">Select text to format · Ctrl/⌘ + B, I or U</p>
  </div>
}


