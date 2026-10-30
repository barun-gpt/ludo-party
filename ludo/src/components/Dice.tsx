import { useEffect, useRef, useState, type CSSProperties } from 'react';

const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

interface Props {
  value: number;
  rollId: number;
  rollMs: number;
  rolling: boolean;
  size: number;
  faceColor: string;
  pipColor: string;
  accent: string;
  active: boolean;
  onRoll: () => void;
}

export default function Dice({ value, rollId, rollMs, rolling, size, faceColor, pipColor, accent, active, onRoll }: Props) {
  const rotRef = useRef(FACE_ROT[value] ?? FACE_ROT[6]);
  const [rot, setRot] = useState(rotRef.current);
  const lastRoll = useRef(rollId);
  const bounceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rollId === lastRoll.current) return;
    lastRoll.current = rollId;
    const base = FACE_ROT[value] ?? FACE_ROT[6];
    const cur = rotRef.current;
    const nx = (Math.floor(cur.x / 360) + 2 + (Math.random() < 0.5 ? 1 : 0)) * 360 + base.x;
    const ny = (Math.floor(cur.y / 360) + 2 + (Math.random() < 0.5 ? 1 : 0)) * 360 + base.y;
    rotRef.current = { x: nx, y: ny };
    setRot(rotRef.current);
    bounceRef.current?.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-42%) scale(1.12)', offset: 0.3 },
        { transform: 'translateY(0) scale(1.1, 0.9)', offset: 0.6 },
        { transform: 'translateY(-12%) scale(1)', offset: 0.76 },
        { transform: 'translateY(0) scale(1.05, 0.95)', offset: 0.9 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: rollMs, easing: 'ease-out' },
    );
  }, [rollId, value, rollMs]);

  const cubeStyle = {
    '--half': `${size / 2}px`,
    transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
    transition: `transform ${Math.round(rollMs)}ms cubic-bezier(.15,.72,.25,1)`,
  } as CSSProperties;

  return (
    <button
      type="button"
      aria-label="Roll the dice"
      disabled={!active}
      onPointerDown={(e) => {
        if (!active) return;
        e.preventDefault();
        onRoll();
      }}
      onClick={(e) => (e.currentTarget as HTMLElement).blur()}
      className={`relative shrink-0 touch-none outline-none ${active ? 'dice-ready' : ''}`}
      style={{ width: size, height: size }}
    >
      {active && <span className="dice-glow" style={{ boxShadow: `0 0 0 4px ${accent}, 0 0 26px ${accent}` }} />}
      <div ref={bounceRef} className="h-full w-full">
        <div className="dice-scene h-full w-full">
          <div className="dice-tilt">
            <div className="dice-cube" style={cubeStyle}>
              {[1, 2, 3, 4, 5, 6].map((f) => (
                <div key={f} className={`dice-face f${f}`} style={{ background: faceColor }}>
                  {PIPS[f].map((i) => (
                    <span
                      key={i}
                      className="pip"
                      style={{
                        gridRow: Math.floor(i / 3) + 1,
                        gridColumn: (i % 3) + 1,
                        background: f === 1 ? '#ef4444' : pipColor,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {!rolling && value === 6 && rollId > 0 && <span key={rollId} className="six-ring" />}
    </button>
  );
}
