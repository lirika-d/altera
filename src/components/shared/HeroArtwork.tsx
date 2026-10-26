export interface HeroArtworkProps {
  className?: string
}

/** Restrained architectural still life built from solid, low-chroma planes. */
export function HeroArtwork({ className = '' }: HeroArtworkProps) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 800 450"
        preserveAspectRatio="xMaxYMid slice"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="800" height="450" fill="#121310" />
        <rect x="430" width="370" height="300" fill="#161812" />

        <polygon points="430,44 492,32 492,294 430,306" fill="#20241a" />
        <polygon points="492,32 506,38 506,286 492,294" fill="#0b0c09" />
        <polygon points="430,306 492,294 512,310 414,326" fill="#1c2017" />

        <path d="M 514,-34 C 526,116 602,208 820,244 L 820,-34 Z" fill="#20241a" />
        <path d="M 514,-34 C 526,116 602,208 820,244" fill="none" stroke="#373d2b" strokeWidth="1" opacity="0.66" />

        <polygon points="0,0 430,0 430,304 0,342" fill="#121310" />
        <polygon points="0,300 430,270 430,323 0,362" fill="#10110e" />

        <polygon points="288,294 430,282 445,291 302,305" fill="#25281d" />
        <polygon points="302,305 445,291 445,302 302,317" fill="#0d0e0b" />
        <polygon points="322,317 468,302 484,312 338,329" fill="#202319" />
        <polygon points="338,329 484,312 484,324 338,341" fill="#0b0c09" />

        <rect y="342" width="800" height="108" fill="#0e0f0c" />
        <polygon points="534,302 770,282 796,309 557,332" fill="#262b20" />
        <polygon points="557,332 796,309 796,382 557,409" fill="#151711" />
        <polygon points="534,302 557,332 557,409 534,378" fill="#1d2117" />

        <line x1="430" y1="44" x2="430" y2="306" stroke="#373d2a" opacity="0.55" />
        <line x1="557" y1="332" x2="796" y2="309" stroke="#454c35" opacity="0.45" />
      </svg>
    </div>
  )
}
