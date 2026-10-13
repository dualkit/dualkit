import { ImageResponse } from 'next/og'

// The home-screen icon: Sam's mark on white, 180px, the size iOS asks for.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const START = 'M 8.9855 18.5469 C 8.9855 19.4675 8.2087 20.1961 7.3483 19.9526 C 3.1124 18.7535 0 14.7519 0 10 C 0 5.2481 3.1124 1.2465 7.3483 0.0474 C 8.2087 -0.1961 8.9855 0.5325 8.9855 1.4531 L 8.9855 18.5469 Z'
const END = 'M 11.0145 1.4531 C 11.0145 0.5325 11.7913 -0.1961 12.6517 0.0474 C 16.8876 1.2465 20 5.2481 20 10 C 20 14.7519 16.8876 18.7535 12.6517 19.9526 C 11.7913 20.1961 11.0145 19.4675 11.0145 18.5469 L 11.0145 1.4531 Z'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
        <svg width="104" height="104" viewBox="0 0 20 20">
          <path d={START} fill="#09090b" />
          <path d={END} fill="#d4d4d8" />
        </svg>
      </div>
    ),
    size,
  )
}
