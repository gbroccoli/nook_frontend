import { useEffect, useMemo, useRef, useState } from 'react'
import { Expand, Maximize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'

interface VideoPlayerProps {
  src: string
  name: string
  alignRight?: boolean
}

interface PlaybackSnapshot {
  startAt: number
  autoPlay: boolean
  muted: boolean
  volume: number
}

interface VideoSurfaceProps {
  src: string
  name: string
  className?: string
  showOpenModalButton?: boolean
  onOpenModal?: (snapshot: PlaybackSnapshot) => void
  onCloseModal?: () => void
  defaultSnapshot?: PlaybackSnapshot
}

function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00'
  const secs = Math.floor(totalSeconds)
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const seconds = secs % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function VideoSurface({
  src,
  name,
  className = '',
  showOpenModalButton = false,
  onOpenModal,
  onCloseModal,
  defaultSnapshot,
}: VideoSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hideControlsTimerRef = useRef<number | null>(null)
  const hasAppliedDefaultRef = useRef(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(defaultSnapshot?.muted ?? false)
  const [volume, setVolume] = useState(defaultSnapshot?.volume ?? 1)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)
  const [showControls, setShowControls] = useState(true)

  const shownTime = isSeeking ? seekValue : currentTime
  const progressPercent = useMemo(() => {
    if (!duration || duration <= 0) return 0
    return Math.min(100, Math.max(0, (shownTime / duration) * 100))
  }, [duration, shownTime])

  const volumePercent = Math.round((isMuted ? 0 : volume) * 100)

  const seekBackground = useMemo(
    () =>
      `linear-gradient(90deg, rgba(0,245,160,0.95) ${progressPercent}%, rgba(255,255,255,0.18) ${progressPercent}%)`,
    [progressPercent],
  )

  const volumeBackground = useMemo(
    () =>
      `linear-gradient(90deg, rgba(0,245,160,0.85) ${volumePercent}%, rgba(255,255,255,0.16) ${volumePercent}%)`,
    [volumePercent],
  )

  const clearControlsTimer = () => {
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current)
      hideControlsTimerRef.current = null
    }
  }

  const armControlsTimer = () => {
    clearControlsTimer()
    if (!isPlaying) return
    hideControlsTimerRef.current = window.setTimeout(() => {
      setShowControls(false)
    }, 2200)
  }

  useEffect(() => {
    return () => clearControlsTimer()
  }, [])

  const showControlsNow = () => {
    setShowControls(true)
    armControlsTimer()
  }

  const captureSnapshot = (): PlaybackSnapshot => {
    const video = videoRef.current
    if (!video) {
      return {
        startAt: 0,
        autoPlay: false,
        muted: isMuted,
        volume,
      }
    }
    return {
      startAt: video.currentTime,
      autoPlay: !video.paused,
      muted: video.muted,
      volume: video.volume,
    }
  }

  const commitSeek = (value: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = value
    setCurrentTime(value)
    setSeekValue(value)
    setIsSeeking(false)
  }

  const handleTogglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
      return
    }
    video.pause()
  }

  const handleToggleMute = () => {
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    setIsMuted(nextMuted)
  }

  const handleVolumeChange = (nextVolume: number) => {
    const video = videoRef.current
    if (!video) return
    const normalized = Math.max(0, Math.min(1, nextVolume))
    video.volume = normalized
    setVolume(normalized)

    if (normalized > 0 && video.muted) {
      video.muted = false
      setIsMuted(false)
    } else if (normalized === 0 && !video.muted) {
      video.muted = true
      setIsMuted(true)
    }
  }

  const toggleFullscreen = async () => {
    const container = containerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      await container.requestFullscreen()
      return
    }
    if (document.fullscreenElement === container) {
      await document.exitFullscreen()
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${className}`}
      onMouseMove={showControlsNow}
      onMouseEnter={showControlsNow}
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        className="w-full max-h-[78vh] bg-black"
        onDoubleClick={() => {
          if (showOpenModalButton && onOpenModal) {
            onOpenModal(captureSnapshot())
          }
        }}
        onLoadedMetadata={() => {
          const video = videoRef.current
          if (!video) return
          setDuration(Number.isFinite(video.duration) ? video.duration : 0)

          if (!hasAppliedDefaultRef.current) {
            hasAppliedDefaultRef.current = true
            if (defaultSnapshot) {
              video.currentTime = defaultSnapshot.startAt
              video.volume = defaultSnapshot.volume
              video.muted = defaultSnapshot.muted
              setCurrentTime(defaultSnapshot.startAt)
              setSeekValue(defaultSnapshot.startAt)
              setVolume(defaultSnapshot.volume)
              setIsMuted(defaultSnapshot.muted)
              if (defaultSnapshot.autoPlay) {
                void video.play()
              }
            } else {
              setVolume(video.volume)
              setIsMuted(video.muted)
            }
          }
        }}
        onTimeUpdate={() => {
          if (isSeeking) return
          const video = videoRef.current
          if (!video) return
          setCurrentTime(video.currentTime)
        }}
        onPlay={() => {
          setIsPlaying(true)
          showControlsNow()
        }}
        onPause={() => {
          setIsPlaying(false)
          setShowControls(true)
          clearControlsTimer()
        }}
        onEnded={() => {
          setIsPlaying(false)
          setShowControls(true)
          clearControlsTimer()
        }}
        onClick={handleTogglePlay}
      />

      {!isPlaying && (
        <button
          type="button"
          onClick={handleTogglePlay}
          className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/55 text-white border border-white/20 flex items-center justify-center hover:bg-black/65 transition-colors"
          aria-label="Play video"
        >
          <Play className="w-6 h-6 ml-0.5 fill-current" />
        </button>
      )}

      {onCloseModal && (
        <button
          type="button"
          onClick={onCloseModal}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 hover:bg-black/72 text-white border border-white/20 flex items-center justify-center"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 p-3 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.74)_70%,rgba(0,0,0,0.92)_100%)] transition-opacity duration-150 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="mb-1 text-[11px] text-white/85 truncate">{name}</div>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 0}
          step={0.01}
          value={shownTime}
          onChange={(e) => {
            setIsSeeking(true)
            setSeekValue(Number(e.currentTarget.value))
          }}
          onMouseUp={(e) => commitSeek(Number(e.currentTarget.value))}
          onTouchEnd={(e) => commitSeek(Number(e.currentTarget.value))}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
          style={{ background: seekBackground }}
          aria-label="Seek video"
        />

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="w-8 h-8 rounded-lg bg-white/14 hover:bg-white/22 text-white flex items-center justify-center transition-colors shrink-0"
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="w-8 h-8 rounded-lg bg-white/14 hover:bg-white/22 text-white flex items-center justify-center transition-colors shrink-0"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.currentTarget.value))}
            className="w-20 h-1.5 appearance-none rounded-full cursor-pointer"
            style={{ background: volumeBackground }}
            aria-label="Volume"
          />

          <span className="text-[11px] text-white/85 tabular-nums ml-auto">
            {formatDuration(shownTime)} / {formatDuration(duration)}
          </span>

          {showOpenModalButton && onOpenModal && (
            <button
              type="button"
              onClick={() => {
                onOpenModal(captureSnapshot())
              }}
              className="w-8 h-8 rounded-lg bg-white/14 hover:bg-white/22 text-white flex items-center justify-center transition-colors shrink-0"
              aria-label="Open in modal"
            >
              <Expand className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void toggleFullscreen()
            }}
            className="w-8 h-8 rounded-lg bg-white/14 hover:bg-white/22 text-white flex items-center justify-center transition-colors shrink-0"
            aria-label="Toggle fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function VideoPlayer({ src, name, alignRight = false }: VideoPlayerProps) {
  const [modalSnapshot, setModalSnapshot] = useState<PlaybackSnapshot | null>(null)

  useEffect(() => {
    if (!modalSnapshot) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalSnapshot(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalSnapshot])

  return (
    <>
      <div
        className={`mt-1 inline-block rounded-xl overflow-hidden border border-elevated/70 bg-black shadow-[0_14px_34px_rgba(0,0,0,0.35)] ${
          alignRight ? 'ml-auto' : ''
        }`}
      >
        <VideoSurface
          src={src}
          name={name}
          className="w-[360px] max-w-[76vw]"
          showOpenModalButton
          onOpenModal={(snapshot) => setModalSnapshot(snapshot)}
        />
      </div>

      {modalSnapshot && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/88 backdrop-blur-[2px]"
          onClick={() => setModalSnapshot(null)}
        >
          <div
            className="w-[min(96vw,1200px)] max-h-[92vh] rounded-xl overflow-hidden border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.65)]"
            onClick={(e) => e.stopPropagation()}
          >
            <VideoSurface
              src={src}
              name={name}
              className="w-full"
              defaultSnapshot={modalSnapshot}
              onCloseModal={() => setModalSnapshot(null)}
            />
          </div>
        </div>
      )}
    </>
  )
}

