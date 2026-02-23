const LEGACY_ATTACHMENT_PREFIX = 'nook:attachment:'

interface LegacyAttachmentPayload {
  v: 1
  name: string
  mime: string
  size: number
  data_url: string
}

export interface LegacyAttachment {
  name: string
  mime: string
  size: number
  url: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = reader.result
      if (typeof value === 'string') {
        resolve(value)
        return
      }
      reject(new Error('Failed to read file'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export async function buildLegacyAttachmentContent(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const payload: LegacyAttachmentPayload = {
    v: 1,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    data_url: dataUrl,
  }
  return `${LEGACY_ATTACHMENT_PREFIX}${encodeBase64Utf8(JSON.stringify(payload))}`
}

export function parseLegacyAttachmentContent(content?: string): LegacyAttachment | null {
  if (!content || !content.startsWith(LEGACY_ATTACHMENT_PREFIX)) {
    return null
  }

  const encoded = content.slice(LEGACY_ATTACHMENT_PREFIX.length)

  try {
    const decoded = decodeBase64Utf8(encoded)
    const payload = JSON.parse(decoded) as Partial<LegacyAttachmentPayload>
    if (payload.v !== 1) return null
    if (!payload.name || !payload.mime || typeof payload.size !== 'number' || !payload.data_url) return null
    if (!payload.data_url.startsWith('data:')) return null
    return {
      name: payload.name,
      mime: payload.mime,
      size: payload.size,
      url: payload.data_url,
    }
  } catch {
    return null
  }
}
