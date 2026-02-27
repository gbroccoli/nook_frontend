import { useRef, useEffect, useState } from 'react'
import { Paperclip, X, FileText, Music, Video, Archive } from 'lucide-react'

const ACCEPTED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain',
  'application/zip', 'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
  'video/mp4', 'video/webm',
].join(',')

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-text-secondary" />
  if (mime.startsWith('video/')) return <Video className="w-5 h-5 text-text-secondary" />
  if (mime.includes('zip')) return <Archive className="w-5 h-5 text-text-secondary" />
  return <FileText className="w-5 h-5 text-text-secondary" />
}

// ── FilePreview — полоса с информацией о файле ──────────────────────────────

interface FilePreviewProps {
  file: File
  onRemove: () => void
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const isImage = file.type.startsWith('image/')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage) return
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  return (
    <div className="px-3 pt-2">
      <div className="flex items-center gap-2.5 rounded-xl border border-elevated/70 bg-elevated/40 px-3 py-2">
        {isImage && objectUrl ? (
          <img src={objectUrl} alt={file.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-bg/50 flex items-center justify-center shrink-0">
            <FileIcon mime={file.type} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text truncate">{file.name}</p>
          <p className="text-[11px] text-text-disabled">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-6 h-6 rounded-md bg-bg/45 hover:bg-bg/70 text-text-secondary hover:text-text flex items-center justify-center shrink-0 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── FileAttachButton — кнопка скрепки ──────────────────────────────────────

interface FileAttachButtonProps {
  onFileChange: (file: File | null) => void
  disabled?: boolean
}

export function FileAttachButton({ onFileChange, disabled }: FileAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          onFileChange(f)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Прикрепить файл"
        className="w-8 h-8 rounded-lg hover:bg-elevated text-text-disabled hover:text-text-secondary flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        <Paperclip className="w-4 h-4" />
      </button>
    </>
  )
}