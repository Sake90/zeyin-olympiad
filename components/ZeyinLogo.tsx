interface ZeyinLogoProps {
  size?: number
}

export default function ZeyinLogo({ size = 36 }: ZeyinLogoProps) {
  return (
    <img
      src="/zeyin-logo.png"
      alt="Zeyin logo"
      width={size}
      height={size}
      style={{ objectFit: 'cover', display: 'block' }}
    />
  )
}
