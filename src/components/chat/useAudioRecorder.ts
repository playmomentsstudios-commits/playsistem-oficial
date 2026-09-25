import { useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_SECONDS } from '../../lib/attachments'

export function useAudioRecorder(onReady: (file: File) => void) {
  const [recording, setRecording] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const cancelled = useRef(false)
  const mounted = useRef(true)
  const requestingRef = useRef(false)
  const ready = useRef(onReady)
  ready.current = onReady

  const release = () => {
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }
  function stop(discard = false) {
    cancelled.current = discard
    if (recorder.current?.state === 'recording') recorder.current.stop()
    release()
  }
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; cancelled.current = true; stop(true) }
  }, [])
  useEffect(() => {
    if (!recording) return
    const started = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000)
      setSeconds(Math.min(elapsed, MAX_RECORDING_SECONDS))
      if (elapsed >= MAX_RECORDING_SECONDS) stop()
    }, 250)
    return () => window.clearInterval(timer)
  }, [recording])

  async function start() {
    if (requestingRef.current || recorder.current?.state === 'recording') return
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador não permite gravar aqui. Você pode anexar um áudio salvo no aparelho.')
      return
    }
    requestingRef.current = true
    setRequesting(true)
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return }
      stream.current = input
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
      const media = new MediaRecorder(input, mime ? { mimeType: mime } : undefined)
      recorder.current = media
      const chunks: Blob[] = []
      cancelled.current = false
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      media.onerror = () => {
        stop(true)
        if (mounted.current) setError('Não foi possível concluir a gravação. Tente novamente.')
      }
      media.onstop = () => {
        release()
        if (!mounted.current) return
        setRecording(false)
        if (cancelled.current) return
        const type = media.mimeType || chunks[0]?.type || 'audio/webm'
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const file = new File(chunks, `audio-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`, { type })
        if (file.size) ready.current(file)
        else setError('A gravação ficou vazia. Tente novamente.')
      }
      setSeconds(0)
      media.start(1000)
      setRecording(true)
    } catch (cause) {
      release()
      if (mounted.current) setError(cause instanceof DOMException && cause.name === 'NotAllowedError'
        ? 'Permita o acesso ao microfone no navegador para gravar áudio.'
        : 'Não foi possível acessar o microfone. Verifique se ele está disponível.')
    } finally {
      requestingRef.current = false
      if (mounted.current) setRequesting(false)
    }
  }
  return { recording, requesting, seconds, error, start, stop }
}
