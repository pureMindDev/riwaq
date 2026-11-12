import { useCallback, useEffect, useRef, useState } from 'react'

// Microphone recording. The microphone is requested only when start() is called,
// and every stream and audio URL is released when recording ends or the page closes.
export function useRecorder() {
  const [phase, setPhase] = useState('idle') // idle | recording | recorded
  const [blob, setBlob] = useState(null)
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)
  const streamRef = useRef(null)
  const recRef = useRef(null)
  const urlRef = useRef(null)

  const clear = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setUrl(null); setBlob(null); setPhase('idle')
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record audio. Try a recent Chrome, Edge, Firefox or Safari.')
      return false
    }
    try {
      clear()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      const chunks = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const b = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        urlRef.current = URL.createObjectURL(b)
        setBlob(b); setUrl(urlRef.current); setPhase('recorded')
      }
      recRef.current = rec
      rec.start()
      setPhase('recording')
      return true
    } catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser settings to record.' : 'Could not start the microphone.')
      return false
    }
  }, [clear])

  const stop = useCallback(() => recRef.current?.stop(), [])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  return { phase, blob, url, error, start, stop, clear }
}
