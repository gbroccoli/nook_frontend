import { useEffect, useRef, useState } from 'react'

interface AudioDevice {
  deviceId: string
  label: string
}

interface Settings {
  audioInputId: string
  audioOutputId: string
  noiseSuppression: boolean
  echoCancellation: boolean
  micVolume: number
  speakerVolume: number
}

function readSettings(): Settings {
  const s = (key: string) => localStorage.getItem(key) ?? 'default'
  const b = (key: string, def: boolean) => {
    const v = localStorage.getItem(key)
    return v == null ? def : v !== '0'
  }
  const n = (key: string, def: number) => {
    const v = localStorage.getItem(key)
    if (!v) return def
    const num = Number(v)
    return Number.isFinite(num) ? Math.min(100, Math.max(0, Math.round(num))) : def
  }
  return {
    audioInputId: s('settings.audioInputId'),
    audioOutputId: s('settings.audioOutputId'),
    noiseSuppression: b('settings.noiseSuppression', true),
    echoCancellation: b('settings.echoCancellation', true),
    micVolume: n('settings.micVolume', 100),
    speakerVolume: n('settings.speakerVolume', 100),
  }
}

function saveAndDispatch(key: string, value: string | boolean | number) {
  if (typeof value === 'boolean') {
    localStorage.setItem(`settings.${key}`, value ? '1' : '0')
  } else {
    localStorage.setItem(`settings.${key}`, String(value))
  }
  window.dispatchEvent(new CustomEvent('nook:call-settings-changed', { detail: { [key]: value } }))
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-primary' : 'bg-elevated'}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

export function AudioSettingsPanel({ onClose }: { onClose: () => void }) {
  const [inputs, setInputs] = useState<AudioDevice[]>([])
  const [outputs, setOutputs] = useState<AudioDevice[]>([])
  const [settings, setSettings] = useState<Settings>(readSettings)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [onClose])

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        setInputs(
          all
            .filter((d) => d.kind === 'audioinput')
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Микрофон ${i + 1}` })),
        )
        setOutputs(
          all
            .filter((d) => d.kind === 'audiooutput')
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Динамик ${i + 1}` })),
        )
      })
      .catch(() => {})
  }, [])

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    saveAndDispatch(key, value as string | boolean | number)
  }

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 mb-1 z-50 w-64 bg-[#0A0C0F] border border-elevated rounded-xl shadow-2xl p-4 space-y-4"
    >
      <p className="text-[11px] font-bold text-text-disabled uppercase tracking-[0.9px]">Настройки аудио</p>

      {/* Микрофон — устройство */}
      <div className="space-y-1.5">
        <label className="text-[12px] text-text-secondary">Микрофон</label>
        <select
          value={settings.audioInputId}
          onChange={(e) => set('audioInputId', e.target.value)}
          className="w-full bg-elevated border border-elevated/50 text-text text-[12px] rounded-lg px-2 py-1.5 outline-none cursor-pointer"
        >
          <option value="default">По умолчанию</option>
          {inputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Динамики — устройство */}
      {outputs.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[12px] text-text-secondary">Динамики</label>
          <select
            value={settings.audioOutputId}
            onChange={(e) => set('audioOutputId', e.target.value)}
            className="w-full bg-elevated border border-elevated/50 text-text text-[12px] rounded-lg px-2 py-1.5 outline-none cursor-pointer"
          >
            <option value="default">По умолчанию</option>
            {outputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Громкость микрофона */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-text-secondary">Громкость микрофона</span>
          <span className="text-text-disabled tabular-nums">{settings.micVolume}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={settings.micVolume}
          onChange={(e) => set('micVolume', Number(e.target.value))}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer accent-primary"
        />
      </div>

      {/* Громкость динамиков */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-text-secondary">Громкость динамиков</span>
          <span className="text-text-disabled tabular-nums">{settings.speakerVolume}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={settings.speakerVolume}
          onChange={(e) => set('speakerVolume', Number(e.target.value))}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer accent-primary"
        />
      </div>

      {/* Шумоподавление / эхоподавление */}
      <div className="space-y-2.5 pt-1 border-t border-elevated/40">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-text">Шумоподавление</p>
            <p className="text-[11px] text-text-disabled">Фильтрует фоновый шум</p>
          </div>
          <Toggle value={settings.noiseSuppression} onChange={(v) => set('noiseSuppression', v)} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-text">Эхоподавление</p>
            <p className="text-[11px] text-text-disabled">Устраняет эхо с динамиков</p>
          </div>
          <Toggle value={settings.echoCancellation} onChange={(v) => set('echoCancellation', v)} />
        </div>
      </div>
    </div>
  )
}
