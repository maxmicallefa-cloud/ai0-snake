import { useEffect, useRef, useState, useCallback } from 'react'

const GRID = 18
const CELL = 20
const CANVAS_SIZE = GRID * CELL

const DIFF_CONFIG = {
  easy:   { baseSpeed: 140, speedDecrement: 5,  minSpeed: 90,  scoreMult: 1 },
  medium: { baseSpeed: 95,  speedDecrement: 5,  minSpeed: 55,  scoreMult: 2 },
  hard:   { baseSpeed: 55,  speedDecrement: 4,  minSpeed: 28,  scoreMult: 3 },
}

const LEVEL_THRESHOLDS = [0, 3, 6, 10, 15, 21, 28, 36, 45, 55]

function calcLevel(eaten) {
  let l = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (eaten >= LEVEL_THRESHOLDS[i]) l = i + 1
  }
  return Math.min(l, 10)
}

function randPos(snake) {
  for (let i = 0; i < 500; i++) {
    const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }
    if (!snake.some(s => s.x === p.x && s.y === p.y)) return p
  }
  return { x: 0, y: 0 }
}

function drawGame(ctx, snake, food, dir) {
  // Background
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'
  ctx.lineWidth = 0.5
  for (let x = 0; x <= GRID; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, CANVAS_SIZE); ctx.stroke()
  }
  for (let y = 0; y <= GRID; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(CANVAS_SIZE, y * CELL); ctx.stroke()
  }

  // Snake
  snake.forEach((seg, i) => {
    const alpha = 1 - (i / snake.length) * 0.65
    ctx.fillStyle = i === 0 ? '#b8ff57' : `rgba(184,255,87,${alpha})`
    const pad = i === 0 ? 1 : 2
    const r = i === 0 ? 4 : 2
    ctx.beginPath()
    ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, r)
    ctx.fill()

    // Eyes on head
    if (i === 0) {
      const cx = seg.x * CELL + CELL / 2
      const cy = seg.y * CELL + CELL / 2
      const eyeOffset = dir.x !== 0 ? { x: 0, y: 3 } : { x: 3, y: 0 }
      const eyeFwd = { x: dir.x * 4, y: dir.y * 4 }
      ctx.fillStyle = '#0a0a0a'
      ctx.beginPath()
      ctx.arc(cx + eyeFwd.x + eyeOffset.x, cy + eyeFwd.y + eyeOffset.y, 1.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx + eyeFwd.x - eyeOffset.x, cy + eyeFwd.y - eyeOffset.y, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  // Food
  if (food) {
    const fx = food.x * CELL + CELL / 2
    const fy = food.y * CELL + CELL / 2
    ctx.fillStyle = '#ff5757'
    ctx.beginPath()
    ctx.arc(fx, fy, CELL / 2 - 3, 0, Math.PI * 2)
    ctx.fill()
    // Shine
    ctx.fillStyle = 'rgba(255,180,180,0.7)'
    ctx.beginPath()
    ctx.arc(fx - 2, fy - 2, 2.5, 0, Math.PI * 2)
    ctx.fill()
    // Stem
    ctx.fillStyle = '#4caf50'
    ctx.fillRect(fx - 1, food.y * CELL + 2, 2, 5)
  }
}

export default function SnakePage() {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: null,
    running: false,
    foodEaten: 0,
  })
  const loopRef = useRef(null)

  const [screen, setScreen] = useState('start') // 'start' | 'playing' | 'gameover'
  const [diff, setDiff] = useState('easy')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => parseInt(localStorage.getItem('ai0_snake_best') || '0'))
  const [level, setLevel] = useState(1)
  const [isNewBest, setIsNewBest] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [finalLevel, setFinalLevel] = useState(1)

  const stopLoop = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null }
  }, [])

  const startLoop = useCallback((speed) => {
    stopLoop()
    loopRef.current = setInterval(tick, speed)
  }, [])

  function tick() {
    const st = stateRef.current
    if (!st.running) return

    st.dir = st.nextDir
    const head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y }

    // Wall collision
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
      endGame(); return
    }
    // Self collision
    if (st.snake.some(s => s.x === head.x && s.y === head.y)) {
      endGame(); return
    }

    st.snake.unshift(head)

    if (head.x === st.food.x && head.y === st.food.y) {
      st.foodEaten++
      const cfg = DIFF_CONFIG[diff]
      const lv = calcLevel(st.foodEaten)
      const pts = 10 * lv * cfg.scoreMult
      st.food = randPos(st.snake)

      setScore(prev => {
        const next = prev + pts
        return next
      })
      setLevel(lv)

      // Speed up on level change
      const newSpeed = Math.max(cfg.minSpeed, cfg.baseSpeed - (lv - 1) * cfg.speedDecrement)
      startLoop(newSpeed)
    } else {
      st.snake.pop()
    }

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawGame(ctx, st.snake, st.food, st.dir)
  }

  function startGame() {
    const st = stateRef.current
    st.snake = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }]
    st.dir = { x: 1, y: 0 }
    st.nextDir = { x: 1, y: 0 }
    st.food = randPos(st.snake)
    st.running = true
    st.foodEaten = 0

    setScore(0)
    setLevel(1)
    setIsNewBest(false)
    setScreen('playing')

    const cfg = DIFF_CONFIG[diff]
    startLoop(cfg.baseSpeed)

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawGame(ctx, st.snake, st.food, st.dir)
  }

  function endGame() {
    const st = stateRef.current
    st.running = false
    stopLoop()

    setScore(prev => {
      const s = prev
      setBest(prevBest => {
        const nb = s > prevBest
        if (nb) {
          localStorage.setItem('ai0_snake_best', String(s))
          setIsNewBest(true)
        }
        setFinalScore(s)
        setFinalLevel(calcLevel(st.foodEaten))
        setScreen('gameover')
        return nb ? s : prevBest
      })
      return s
    })
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      // Draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= GRID; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, CANVAS_SIZE); ctx.stroke()
      }
      for (let y = 0; y <= GRID; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(CANVAS_SIZE, y * CELL); ctx.stroke()
      }
    }
  }, [])

  useEffect(() => {
    function onKey(e) {
      const st = stateRef.current
      if (!st.running) return
      const map = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
        a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
      }
      const nd = map[e.key]
      if (nd && !(nd.x === -st.dir.x && nd.y === -st.dir.y)) {
        st.nextDir = nd
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
          e.preventDefault()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => stopLoop(), [])

  function mobileDir(x, y) {
    const st = stateRef.current
    if (!st.running) return
    if (st.dir.x === -x && st.dir.y === -y) return
    st.nextDir = { x, y }
  }

  return (
    <div style={css.page}>
      <div style={css.gridBg} />

      {/* Header */}
      <div style={css.header}>
        <a href={import.meta.env.VITE_LANDING_URL || 'https://ai0-landing.pages.dev'} style={css.backBtn}>
          ← Dashboard
        </a>
        <div style={css.logo}>SNAKE<span style={{ color: '#fff', opacity: 0.35 }}>.AI0</span></div>
        <div style={css.stats}>
          <div style={css.stat}>
            <div style={css.statLabel}>Score</div>
            <div style={css.statVal}>{score}</div>
          </div>
          <div style={css.stat}>
            <div style={css.statLabel}>Best</div>
            <div style={css.statVal}>{best}</div>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div style={css.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={css.canvas}
        />

        {/* Start overlay */}
        {screen === 'start' && (
          <div style={css.overlay}>
            <div style={css.overlayTitle}>SNAKE</div>
            <div style={css.overlaySub}>choose difficulty</div>
            <div style={css.diffRow}>
              {['easy', 'medium', 'hard'].map(d => (
                <button
                  key={d}
                  style={{ ...css.diffBtn, ...(diff === d ? css.diffBtnActive : {}) }}
                  onClick={() => setDiff(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <button style={css.startBtn} onClick={startGame}>START GAME</button>
          </div>
        )}

        {/* Game over overlay */}
        {screen === 'gameover' && (
          <div style={css.overlay}>
            <div style={css.overlayTitle}>GAME OVER</div>
            <div style={css.overlaySub}>level {finalLevel} · {diff}</div>
            {isNewBest && <div style={css.hiBadge}>new high score!</div>}
            <div style={css.goScore}>{finalScore}</div>
            <div style={css.diffRow}>
              {['easy', 'medium', 'hard'].map(d => (
                <button
                  key={d}
                  style={{ ...css.diffBtn, ...(diff === d ? css.diffBtnActive : {}) }}
                  onClick={() => setDiff(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <button style={css.startBtn} onClick={startGame}>PLAY AGAIN</button>
          </div>
        )}
      </div>

      {/* Level bar */}
      <div style={css.levelRow}>
        <div style={css.levelDots}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ ...css.dot, ...(i < level ? css.dotActive : {}) }} />
          ))}
        </div>
        <span style={css.levelLabel}>Level {level}</span>
        <span style={css.hint}>Arrow keys / WASD</span>
      </div>

      {/* Mobile d-pad */}
      <div style={css.dpad}>
        <div style={css.dpadRow}>
          <button style={css.dpadBtn} onClick={() => mobileDir(0, -1)}>↑</button>
        </div>
        <div style={css.dpadRow}>
          <button style={css.dpadBtn} onClick={() => mobileDir(-1, 0)}>←</button>
          <button style={css.dpadBtn} onClick={() => mobileDir(0, 1)}>↓</button>
          <button style={css.dpadBtn} onClick={() => mobileDir(1, 0)}>→</button>
        </div>
      </div>
    </div>
  )
}

const css = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 16px 32px',
    fontFamily: "'Syne', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  gridBg: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
    `,
    backgroundSize: '28px 28px',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 360,
    marginBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  backBtn: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textDecoration: 'none',
    letterSpacing: 0.5,
    transition: 'color 0.15s',
  },
  logo: {
    fontWeight: 800,
    fontSize: 18,
    color: '#b8ff57',
    letterSpacing: -0.5,
  },
  stats: {
    display: 'flex',
    gap: 16,
  },
  stat: {
    textAlign: 'right',
  },
  statLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statVal: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1,
  },
  canvasWrap: {
    position: 'relative',
    zIndex: 1,
    border: '1px solid rgba(184,255,87,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  canvas: {
    display: 'block',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10,10,10,0.9)',
    zIndex: 10,
  },
  overlayTitle: {
    fontWeight: 800,
    fontSize: 36,
    color: '#b8ff57',
    letterSpacing: -1,
    marginBottom: 4,
  },
  overlaySub: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  diffRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
  },
  diffBtn: {
    padding: '7px 16px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: 1,
    transition: 'all 0.15s',
  },
  diffBtnActive: {
    borderColor: '#b8ff57',
    color: '#b8ff57',
    background: 'rgba(184,255,87,0.08)',
  },
  startBtn: {
    padding: '12px 36px',
    background: '#b8ff57',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: 4,
    fontFamily: "'Syne', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.5,
  },
  hiBadge: {
    background: 'rgba(184,255,87,0.12)',
    border: '1px solid rgba(184,255,87,0.35)',
    color: '#b8ff57',
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    letterSpacing: 2,
    padding: '3px 12px',
    borderRadius: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  goScore: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 52,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1,
    marginBottom: 24,
  },
  levelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 360,
    marginTop: 12,
    position: 'relative',
    zIndex: 1,
  },
  levelDots: {
    display: 'flex',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
    transition: 'background 0.2s',
  },
  dotActive: {
    background: '#b8ff57',
  },
  levelLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
  },
  hint: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    color: 'rgba(255,255,255,0.18)',
  },
  dpad: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
    position: 'relative',
    zIndex: 1,
  },
  dpadRow: {
    display: 'flex',
    gap: 4,
  },
  dpadBtn: {
    width: 48,
    height: 48,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
