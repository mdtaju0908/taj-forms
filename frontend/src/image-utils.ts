const MAX_COVER_BYTES = 580 * 1024

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The cover image could not be read.'))
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The cover image could not be read.'))
    reader.readAsDataURL(blob)
  })
}

function encodeWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('This browser could not resize the cover image.')), 'image/webp', quality)
  })
}

export async function prepareCoverImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.')
  if (!globalThis.createImageBitmap) throw new Error('This browser cannot resize images. Try a recent version of Chrome, Edge, or Firefox.')

  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not resize the cover image.')

    for (const maxSide of [1600, 1400, 1200, 1000, 800, 640]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await encodeWebp(canvas, quality)
        if (blob.type !== 'image/webp') throw new Error('This browser does not support WebP image uploads.')
        if (blob.size <= MAX_COVER_BYTES) return await toDataUrl(blob)
      }
    }
  } finally {
    bitmap.close()
  }
  throw new Error('This image could not be reduced below 600 KB. Choose a smaller image.')
}
