import { useMemo, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  name: string
  alignRight?: boolean
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

export function AudioPlayer({ src, name, alignRight = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)

  const shownTime = isSeeking ? seekValue : currentTime
  const progressPercent = useMemo(() => {
    if (!duration || duration <= 0) return 0
    return Math.min(100, Math.max(0, (shownTime / duration) * 100))
  }, [duration, shownTime])

  const rangeBackground = useMemo(
    () =>
      `linear-gradient(90deg, rgba(0,245,160,0.95) ${progressPercent}%, rgba(255,255,255,0.16) ${progressPercent}%)`,
    [progressPercent],
  )

  const commitSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrentTime(value)
    setSeekValue(value)
    setIsSeeking(false)
  }

  const handleTogglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
      return
    }
    audio.pause()
  }

  const handleToggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    const nextMuted = !audio.muted
    audio.muted = nextMuted
    setIsMuted(nextMuted)
  }

  return (
    <div
      className={`mt-1 inline-block rounded-xl border border-elevated/70 bg-[linear-gradient(180deg,rgba(31,35,40,0.92)_0%,rgba(22,25,30,0.95)_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.28)] ${
        alignRight ? 'ml-auto' : ''
      }`}
    >
      <div className="w-[320px] max-w-[72vw] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[12px] text-text truncate">{name}</p>
          <button
            type="button"
            onClick={handleToggleMute}
            className="w-7 h-7 rounded-md bg-bg/50 hover:bg-bg/75 text-text-secondary hover:text-text flex items-center justify-center transition-colors shrink-0"
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={() => {
            const audio = audioRef.current
            if (!audio) return
            setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
          }}
          onTimeUpdate={() => {
            if (isSeeking) return
            const audio = audioRef.current
            if (!audio) return
            setCurrentTime(audio.currentTime)
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="w-8 h-8 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 flex items-center justify-center transition-colors shrink-0"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
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
            style={{ background: rangeBackground }}
            aria-label="Seek audio"
          />
          <span className="text-[11px] text-text-disabled tabular-nums shrink-0">
            {formatDuration(shownTime)} / {formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
