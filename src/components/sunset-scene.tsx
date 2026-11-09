// 첫 화면·로그인 배경: 노을 해와 겹친 언덕, 둥근 구름 띠. 장식이라 스크린리더에는 읽히지 않는다.
// 화면 크기에 맞춰 잘라 채운다(slice). 해는 가운데 위쪽에 두고, 글자는 그 아래에 놓는다.

const CLOUDS = [
  // [x, y, 너비, 높이] — 둥근 띠(pill). 크림색으로 언덕 위에 겹친다.
  [-60, 128, 300, 70],
  [100, 190, 230, 46],
  [-40, 258, 420, 60],
  [800, 360, 320, 64],
  [880, 432, 180, 22],
  [700, 498, 360, 92],
  [-60, 660, 330, 96],
  [150, 760, 400, 64],
  [-20, 840, 380, 56],
] as const;

export function SunsetScene({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde4cc" />
          <stop offset="0.5" stopColor="#fff2df" />
          <stop offset="1" stopColor="#fde0c4" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6e2" stopOpacity="1" />
          <stop offset="0.55" stopColor="#ffeccc" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffeccc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sun" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#f7944f" />
          <stop offset="0.5" stopColor="#f45b4f" />
          <stop offset="1" stopColor="#fbc58a" />
        </linearGradient>
        <linearGradient id="hillCoral" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f45b4f" />
          <stop offset="1" stopColor="#f7944f" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="hillOrange" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7944f" />
          <stop offset="1" stopColor="#fbc58a" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="hillPeach" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fbc58a" />
          <stop offset="1" stopColor="#fde0b4" />
        </linearGradient>
        <linearGradient id="cloud" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff3e3" />
          <stop offset="1" stopColor="#fde6cf" />
        </linearGradient>
      </defs>

      <rect width="1000" height="1000" fill="url(#sky)" />

      {/* 뒤쪽 큰 원(언덕) */}
      <circle cx="130" cy="20" r="230" fill="url(#hillCoral)" opacity="1" />
      <circle cx="420" cy="-60" r="230" fill="url(#hillOrange)" opacity="0.8" />
      <circle cx="1000" cy="110" r="230" fill="url(#hillPeach)" opacity="0.9" />
      <circle cx="790" cy="370" r="260" fill="url(#hillOrange)" opacity="0.85" />
      <circle cx="120" cy="560" r="230" fill="url(#hillCoral)" opacity="0.95" />

      {/* 해 둘레의 번지는 빛과 동심원 */}
      <circle cx="500" cy="400" r="330" fill="url(#glow)" />
      <circle cx="500" cy="400" r="300" fill="#fff4e4" opacity="0.25" />
      <circle cx="500" cy="400" r="230" fill="#fff4e4" opacity="0.3" />

      {/* 앞쪽 언덕 */}
      <circle cx="560" cy="1060" r="380" fill="url(#hillPeach)" opacity="0.9" />
      <circle cx="1000" cy="900" r="320" fill="url(#hillCoral)" opacity="0.9" />
      <circle cx="160" cy="980" r="260" fill="url(#hillOrange)" opacity="0.8" />

      {/* 해 */}
      <circle cx="500" cy="400" r="125" fill="url(#sun)" />

      {CLOUDS.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={h / 2} fill="url(#cloud)" opacity="0.92" />
      ))}
    </svg>
  );
}
