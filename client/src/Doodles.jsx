// Scattered background doodles (?, ⚡, ✦, 〰) matching the reference art style.
const BITS = [
  { t: '?', c: '#7c5cff', x: '4%', y: '12%', s: 2.2, r: -14 },
  { t: '?', c: '#ff4d8d', x: '90%', y: '18%', s: 1.6, r: 12 },
  { t: '⚡', c: '#ffd230', x: '86%', y: '38%', s: 1.3, r: 8 },
  { t: '〰', c: '#4fc3f7', x: '6%', y: '46%', s: 1.4, r: -6 },
  { t: '✦', c: '#ffd230', x: '10%', y: '78%', s: 1.1, r: 0 },
  { t: '⚡', c: '#ff4d8d', x: '88%', y: '80%', s: 1.2, r: -10 },
  { t: '〰', c: '#7c5cff', x: '80%', y: '62%', s: 1.2, r: 14 },
  { t: '✦', c: '#4fc3f7', x: '14%', y: '28%', s: 0.9, r: 20 },
];

export default function Doodles() {
  return (
    <div className="doodles" aria-hidden="true">
      {BITS.map((b, i) => (
        <span key={i} style={{
          left: b.x, top: b.y, color: b.c,
          fontSize: `${b.s}rem`, transform: `rotate(${b.r}deg)`,
        }}>{b.t}</span>
      ))}
    </div>
  );
}
