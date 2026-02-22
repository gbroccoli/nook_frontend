import logoSrc from "@/assets/logo.png"

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <img src={logoSrc} alt="Nook" width={size} height={size} style={{ display: 'block' }} />
  )
}
