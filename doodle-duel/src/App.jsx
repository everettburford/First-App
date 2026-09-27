import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Copy, Check, Undo2, Trash2, Eraser, LogOut, WifiOff, Pencil, Send, RotateCcw, Clock } from "lucide-react";

// ---------- Config ----------
const WORDS = [
  "apple","banana","pizza","cake","donut","cookie","carrot","cheese","egg","ice cream",
  "sun","moon","star","cloud","rainbow","snowman","tree","flower","cactus","mushroom",
  "cat","dog","fish","bird","snake","spider","turtle","octopus","rabbit","elephant",
  "giraffe","penguin","frog","bee","butterfly","snail","whale","house","castle","tent",
  "bridge","car","bus","bicycle","boat","train","airplane","rocket","robot","ghost",
  "dragon","crown","hat","shoe","glasses","umbrella","key","clock","book","pencil",
  "scissors","guitar","drum","balloon","kite","ladder","lamp","candle","camera","phone",
  "computer","television","chair","bed","door","window","heart","smile","eye","hand",
  "tooth","skull","anchor","sword","shield","ball","trophy","gift","lollipop","hamburger",
  "hot dog","volcano","island","mountain","lightning","fire","snowflake","spoon","cup","toothbrush",
];
const PALETTE = ["#1b1340", "#ff3d7f", "#ff8a00", "#ffd23f", "#19c39c", "#2f7bff", "#7b4dff", "#8d5a3b", "#ffffff"];
const SIZES = [{ w: 6, label: "Small" }, { w: 14, label: "Medium" }, { w: 30, label: "Large" }];
const ROUNDS = 5;
const ROUND_MS = 60000;
const READY_MS = 3000;
const RESULT_MS = 6000;
const POLL_MS = 1100;
const FLUSH_MS = 550;
const HEARTBEAT_MS = 4000;
const STALE_MS = 15000;
const EXPIRE_MS = 3 * 60 * 60 * 1000;

// ---------- Helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const genCode = () => {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 4; i++) s += L[Math.floor(Math.random() * L.length)];
  return s;
};
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
const isMatch = (guess, word) => {
  const w = norm(word);
  const cands = [norm(guess), ...String(guess || "").toLowerCase().split(/\s+/).map(norm)];
  return cands.some((g) => g && (g === w || g === w + "s" || g === w + "es"));
};

async function sGet(key) {
  try {
    const r = await window.storage.get(key, true);
    if (!r || r.value == null) return { ok: false };
    return { ok: true, data: JSON.parse(r.value) };
  } catch (e) {
    return { ok: false };
  }
}
async function sSet(key, obj) {
  try {
    const r = await window.storage.set(key, JSON.stringify(obj), true);
    return !!r;
  } catch (e) {
    return false;
  }
}
async function sDel(key) {
  try {
    await window.storage.delete(key, true);
  } catch (e) {}
}

function drawStroke(ctx, s, W) {
  const k = W / 1000;
  const p = s.p;
  ctx.strokeStyle = s.c;
  ctx.fillStyle = s.c;
  ctx.lineWidth = s.w * k;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (p.length <= 2) {
    ctx.beginPath();
    ctx.arc(p[0] * k, p[1] * k, (s.w * k) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(p[0] * k, p[1] * k);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * k, p[i + 1] * k);
  ctx.stroke();
}

// ---------- Styles ----------
const CSS = `
.dd-root{min-height:100vh;color:#1b1340;background-color:#eef6ff;
  background-image:linear-gradient(#d6e8ff 1px,transparent 1px),linear-gradient(90deg,#d6e8ff 1px,transparent 1px);
  background-size:26px 26px;font-family:ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Nunito","Varela Round",system-ui,-apple-system,"Segoe UI",sans-serif;
  -webkit-tap-highlight-color:transparent;}
.dd-wrap{max-width:460px;margin:0 auto;padding:14px 14px 90px;}
.card{background:#fff;border:3px solid #1b1340;border-radius:22px;box-shadow:5px 5px 0 #1b1340;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:56px;padding:0 20px;border:3px solid #1b1340;border-radius:16px;
  font-weight:800;font-size:18px;color:#1b1340;box-shadow:4px 4px 0 #1b1340;transition:transform .08s,box-shadow .08s;cursor:pointer;user-select:none;font-family:inherit;}
.btn:active:not(:disabled){transform:translate(3px,3px);box-shadow:1px 1px 0 #1b1340;}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.btn-pink{background:#ff3d7f;color:#fff}.btn-yellow{background:#ffd23f}.btn-mint{background:#19c39c;color:#fff}.btn-white{background:#fff}
.iconbtn{width:48px;height:48px;display:inline-flex;align-items:center;justify-content:center;border:3px solid #1b1340;border-radius:14px;background:#fff;
  box-shadow:3px 3px 0 #1b1340;cursor:pointer;transition:transform .08s,box-shadow .08s;color:#1b1340}
.iconbtn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #1b1340}
.inp{width:100%;min-height:56px;border:3px solid #1b1340;border-radius:16px;padding:0 16px;font-size:18px;font-weight:700;background:#fff;outline:none;color:#1b1340;font-family:inherit;}
.inp:focus{box-shadow:0 0 0 4px #ffd23f;}
.inp:disabled{background:#f1f1f6}
.code-inp{text-align:center;letter-spacing:.4em;font-size:26px;text-transform:uppercase;font-weight:900}
button:focus-visible{outline:3px solid #2f7bff;outline-offset:3px}
.dd-logo{font-weight:900;font-size:46px;line-height:1;-webkit-text-stroke:2px #1b1340;paint-order:stroke fill;text-shadow:3px 3px 0 #1b1340;white-space:nowrap}
.dd-logo.sm{font-size:24px;-webkit-text-stroke:1.5px #1b1340;text-shadow:2px 2px 0 #1b1340}
.dd-letter{display:inline-block}
.chip{display:inline-flex;align-items:center;height:40px;padding:0 12px;border:3px solid #1b1340;border-radius:12px;background:#ffd23f;font-weight:900;letter-spacing:.08em}
.avatar{width:38px;height:38px;border-radius:12px;border:3px solid #1b1340;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;flex-shrink:0}
.is-drawing{background:#fff3f7 !important;border-color:#ff3d7f;box-shadow:5px 5px 0 #ff3d7f}
.turn{border:3px solid #1b1340;border-radius:18px;padding:12px 14px;font-weight:900;font-size:20px;text-align:center;box-shadow:4px 4px 0 #1b1340;margin-bottom:12px}
.rdot{width:12px;height:12px;border-radius:99px;border:2.5px solid #1b1340;display:inline-block}
.codebox{width:62px;height:72px;border:3px solid #1b1340;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;box-shadow:4px 4px 0 #1b1340}
.word{background:#ffd23f;border:2.5px solid #1b1340;border-radius:10px;padding:1px 8px;font-weight:900;letter-spacing:.04em;white-space:nowrap}
.blanks{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end}
.blank{width:18px;height:4px;border-radius:4px;background:#1b1340;display:inline-block}
.timer{display:inline-flex;align-items:center;gap:6px;font-weight:900;font-size:22px;min-width:64px;justify-content:flex-end}
.timer.hurry{color:#ff3d7f;animation:throb .9s ease-in-out infinite}
.timerbar{height:14px;border:3px solid #1b1340;border-radius:99px;overflow:hidden;background:#fff}
.timerfill{height:100%;transition:width .3s linear,background .3s}
.swatch{width:44px;height:44px;border-radius:99px;border:3px solid #1b1340;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:transform .12s;color:#1b1340}
.swatch.on{transform:scale(1.15);box-shadow:0 0 0 3px #fff,0 0 0 6px #1b1340}
.sizebtn{width:52px;height:48px;border:3px solid #1b1340;border-radius:14px;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.sizebtn.on{background:#ffd23f;box-shadow:3px 3px 0 #1b1340}
.gchip{display:inline-block;border:2.5px solid #1b1340;border-radius:12px;padding:4px 10px;font-weight:800;background:#fff;margin:0 6px 6px 0;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.gchip.hit{background:#b8f5d0}
.overlay{position:absolute;inset:0;background:rgba(27,19,64,.72);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center}
.count{font-size:110px;font-weight:900;color:#ffd23f;-webkit-text-stroke:3px #1b1340;paint-order:stroke fill;line-height:1}
.pts{border:2.5px solid #1b1340;border-radius:12px;padding:4px 12px;font-weight:900;background:#fff}
.banner{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;width:calc(100% - 28px);max-width:432px;border:3px solid #1b1340;border-radius:16px;
  padding:12px 14px;font-weight:800;display:flex;align-items:center;gap:10px;box-shadow:4px 4px 0 #1b1340;z-index:40}
.dots{display:inline-flex;gap:4px}.dots i{width:8px;height:8px;border-radius:99px;background:#1b1340;animation:hop 1s infinite}
.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
.confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:30}
.confetti span{position:absolute;top:-24px;border-radius:2px;animation-name:fall;animation-timing-function:linear;animation-iteration-count:infinite;border:1.5px solid #1b1340}
.pop{animation:pop .35s cubic-bezier(.2,1.6,.4,1) both}
.rise{animation:rise .35s ease-out both}
.wiggle{animation:wiggle 2.4s ease-in-out infinite;display:inline-block}
.bob{animation:bob 1.2s ease-in-out infinite}
.err{border:3px solid #1b1340;border-radius:16px;background:#ffe1ea;padding:12px 14px;font-weight:800}
@keyframes pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes rise{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
@keyframes wiggle{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
@keyframes throb{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@keyframes fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}
@media (prefers-reduced-motion:reduce){*{animation:none !important;transition:none !important}}
`;

// ---------- Small components ----------
function Logo({ small }) {
  const cols = ["#ff3d7f", "#ff8a00", "#ffd23f", "#19c39c", "#2f7bff", "#7b4dff"];
  return (
    <div className={`dd-logo ${small ? "sm" : ""}`} aria-label="Doodle Duel">
      {"DOODLE DUEL".split("").map((ch, i) =>
        ch === " " ? (
          <span key={i} style={{ display: "inline-block", width: small ? 6 : 12 }} />
        ) : (
          <span key={i} className="dd-letter" style={{ color: cols[i % cols.length], transform: `rotate(${(i % 2 ? 1 : -1) * (3 + (i % 3) * 2)}deg)` }}>
            {ch}
          </span>
        )
      )}
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2,
        dur: 2.6 + Math.random() * 2.2,
        color: PALETTE[1 + (i % 7)],
        size: 9 + Math.random() * 8,
      })),
    []
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: p.color, width: p.size, height: p.size * 0.6 }} />
      ))}
    </div>
  );
}

function GuessFeed({ title, guesses, word }) {
  if (!guesses.length) return null;
  return (
    <div className="card p-3 mb-3 rise">
      <div className="text-sm font-bold mb-2" style={{ opacity: 0.65 }}>{title}</div>
      <div>
        {[...guesses].reverse().slice(0, 20).map((g, i) => (
          <span key={guesses.length - i} className={`gchip ${i === 0 ? "pop" : ""} ${word && isMatch(g.text, word) ? "hit" : ""}`}>
            {g.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Canvas ----------
function DrawCanvas({ editable, getStrokes, version, color, size, onChange }) {
  const cvs = useRef(null);
  const wrap = useRef(null);
  const cur = useRef(null);
  const getRef = useRef(getStrokes);
  getRef.current = getStrokes;
  const opts = useRef({ color, size, onChange });
  opts.current = { color, size, onChange };

  const redraw = useCallback(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, W);
    for (const s of getRef.current() || []) drawStroke(ctx, s, W);
  }, []);

  useEffect(() => {
    const c = cvs.current;
    const w = wrap.current;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const px = Math.max(10, Math.round(w.clientWidth * dpr));
      if (c.width !== px) {
        c.width = px;
        c.height = px;
      }
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(w);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [version, redraw]);

  const pt = (e) => {
    const rc = cvs.current.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(1000, ((e.clientX - rc.left) / rc.width) * 1000)));
    const y = Math.round(Math.max(0, Math.min(1000, ((e.clientY - rc.top) / rc.height) * 1000)));
    return [x, y];
  };

  const down = (e) => {
    if (!editable) return;
    e.preventDefault();
    if (cvs.current.setPointerCapture) {
      try { cvs.current.setPointerCapture(e.pointerId); } catch (err) {}
    }
    const [x, y] = pt(e);
    const s = { c: opts.current.color, w: opts.current.size, p: [x, y] };
    getRef.current().push(s);
    cur.current = s;
    drawStroke(cvs.current.getContext("2d"), s, cvs.current.width);
    opts.current.onChange();
  };
  const move = (e) => {
    const s = cur.current;
    if (!s || !editable) return;
    e.preventDefault();
    const [x, y] = pt(e);
    const n = s.p.length;
    const lx = s.p[n - 2];
    const ly = s.p[n - 1];
    if (Math.abs(x - lx) + Math.abs(y - ly) < 3) return;
    s.p.push(x, y);
    const ctx = cvs.current.getContext("2d");
    const k = cvs.current.width / 1000;
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w * k;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lx * k, ly * k);
    ctx.lineTo(x * k, y * k);
    ctx.stroke();
    opts.current.onChange();
  };
  const up = () => {
    if (cur.current) {
      cur.current = null;
      opts.current.onChange();
    }
  };

  return (
    <div ref={wrap} style={{ width: "100%", aspectRatio: "1 / 1" }}>
      <canvas
        ref={cvs}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        style={{ width: "100%", height: "100%", display: "block", touchAction: editable ? "none" : "auto", cursor: editable ? "crosshair" : "default" }}
        aria-label={editable ? "Drawing canvas" : "Your opponent's drawing"}
      />
    </div>
  );
}

// ---------- Home ----------
function Home({ onEnter }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const noStorage = typeof window === "undefined" || !window.storage;

  const create = async () => {
    setErr("");
    setBusy("create");
    try {
      let c = null;
      for (let i = 0; i < 8 && !c; i++) {
        const t = genCode();
        const r = await sGet(`room:${t}`);
        if (!r.ok || r.data.phase === "closed" || Date.now() - (r.data.updatedAt || 0) > EXPIRE_MS) c = t;
      }
      if (!c) throw new Error("Couldn't find a free room code. Tap Create game again.");
      await sDel(`room:${c}:guest`);
      const now = Date.now();
      const nm = name.trim().slice(0, 16) || "Player 1";
      const room = { code: c, phase: "lobby", hostName: nm, guestName: null, gameId: uid(), round: 0, drawer: null, word: null, scores: { host: 0, guest: 0 }, used: [], result: null, updatedAt: now };
      const me = { id: uid(), name: nm, gameId: room.gameId, round: 0, strokes: [], guesses: [], rematch: null, updatedAt: now };
      const ok1 = await sSet(`room:${c}`, room);
      const ok2 = await sSet(`room:${c}:host`, me);
      if (!ok1 || !ok2) throw new Error("Couldn't reach the game server. Check your connection and try again.");
      onEnter({ code: c, role: "host", room, me });
    } catch (e) {
      setErr(e.message || "Something went wrong creating the game.");
      setBusy(null);
    }
  };

  const join = async () => {
    setErr("");
    const c = code.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(c)) {
      setErr("Room codes are 4 letters, like ABCD.");
      return;
    }
    setBusy("join");
    try {
      const r = await sGet(`room:${c}`);
      if (!r.ok) throw new Error(`No game found with code ${c}. Double-check it with your friend.`);
      const room = r.data;
      if (room.phase === "closed" || Date.now() - (room.updatedAt || 0) > EXPIRE_MS) throw new Error("That game has ended. Ask your friend to create a new one.");
      const g = await sGet(`room:${c}:guest`);
      if (g.ok && g.data.gameId === room.gameId && Date.now() - (g.data.updatedAt || 0) < STALE_MS) throw new Error("That room is full. Two players are already in it.");
      const nm = name.trim().slice(0, 16) || "Player 2";
      const me = { id: uid(), name: nm, gameId: room.gameId, round: room.round, strokes: [], guesses: [], rematch: null, updatedAt: Date.now() };
      if (!(await sSet(`room:${c}:guest`, me))) throw new Error("Couldn't reach the game server. Check your connection and try again.");
      onEnter({ code: c, role: "guest", room, me });
    } catch (e) {
      setErr(e.message || "Something went wrong joining the game.");
      setBusy(null);
    }
  };

  return (
    <div className="dd-wrap" style={{ paddingTop: 36 }}>
      <div className="text-center rise">
        <div className="wiggle" style={{ fontSize: 44 }} aria-hidden="true">✏️</div>
        <Logo />
        <p className="font-bold mt-3" style={{ fontSize: 18, opacity: 0.75 }}>One draws, one guesses. Five rounds. Fastest wins.</p>
      </div>

      <div className="card p-5 mt-6 rise" style={{ animationDelay: "80ms" }}>
        <label className="block font-bold mb-2" htmlFor="dd-name">Your name</label>
        <input id="dd-name" className="inp" value={name} maxLength={16} placeholder="e.g. Sam" onChange={(e) => setName(e.target.value)} autoComplete="off" />

        <button className="btn btn-pink w-full mt-4" onClick={create} disabled={!!busy || noStorage}>
          {busy === "create" ? "Creating…" : "Create game"}
        </button>

        <div className="flex items-center gap-3 my-5" aria-hidden="true">
          <div className="flex-1" style={{ height: 3, background: "#1b1340", borderRadius: 3 }} />
          <span className="font-bold" style={{ opacity: 0.6 }}>or join a friend</span>
          <div className="flex-1" style={{ height: 3, background: "#1b1340", borderRadius: 3 }} />
        </div>

        <label className="sr-only" htmlFor="dd-code">Room code</label>
        <input
          id="dd-code"
          className="inp code-inp"
          value={code}
          maxLength={4}
          placeholder="CODE"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") join(); }}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
        />
        <button className="btn btn-mint w-full mt-3" onClick={join} disabled={!!busy || noStorage || code.length !== 4}>
          {busy === "join" ? "Joining…" : "Join game"}
        </button>
      </div>

      {noStorage && <div className="err mt-4 pop">Shared storage isn't available here. Open the published artifact link to play.</div>}
      {err && <div className="err mt-4 pop" role="alert">{err}</div>}

      <p className="text-center text-sm font-semibold mt-5" style={{ opacity: 0.6 }}>
        Game rooms are shared, so anyone with the code can see the room's drawings and guesses.
      </p>
    </div>
  );
}

// ---------- Game ----------
function Game({ session, onLeave }) {
  const { code, role } = session;
  const oppRole = role === "host" ? "guest" : "host";
  const roomKey = `room:${code}`;
  const myKey = `room:${code}:${role}`;
  const oppKey = `room:${code}:${oppRole}`;

  const [room, setRoom] = useState(session.room);
  const [opp, setOpp] = useState(null);
  const [, setMeV] = useState(0);
  const [canvasV, setCanvasV] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [netFails, setNetFails] = useState(0);
  const [oppSeenAt, setOppSeenAt] = useState(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(14);
  const [guess, setGuess] = useState("");
  const [copied, setCopied] = useState(false);

  const roomRef = useRef(session.room);
  const meRef = useRef(session.me);
  const oppRef = useRef(null);
  const offsetRef = useRef(role === "host" ? 0 : (session.room.updatedAt || Date.now()) - Date.now());
  const dirtyRef = useRef(false);
  const flushingRef = useRef(false);
  const tickingRef = useRef(false);
  const aliveRef = useRef(true);
  const lastOppStamp = useRef(null);
  const viewerStrokesRef = useRef([]);

  // Write my own player key (strokes, guesses, heartbeat). Never touches the other player's data.
  const flushMe = async (force) => {
    const t = Date.now();
    if (flushingRef.current) { dirtyRef.current = true; return; }
    if (!force && !dirtyRef.current && t - (meRef.current.updatedAt || 0) < HEARTBEAT_MS) return;
    flushingRef.current = true;
    dirtyRef.current = false;
    meRef.current = { ...meRef.current, updatedAt: t };
    const ok = await sSet(myKey, meRef.current);
    if (!ok) dirtyRef.current = true;
    flushingRef.current = false;
  };

  // Reset my per-round data whenever the round or game changes.
  const syncMe = (r) => {
    const m = meRef.current;
    if (r && (m.gameId !== r.gameId || m.round !== r.round)) {
      meRef.current = { ...m, gameId: r.gameId, round: r.round, strokes: [], guesses: [], rematch: m.gameId !== r.gameId ? null : m.rematch };
      dirtyRef.current = true;
      setMeV((v) => v + 1);
      setCanvasV((v) => v + 1);
    }
  };

  // ----- Host-only: authoritative game logic -----
  const commitRoom = async (next) => {
    const n = { ...next, updatedAt: Date.now() };
    roomRef.current = n;
    setRoom(n);
    syncMe(n);
    const ok = await sSet(roomKey, n);
    setNetFails((f) => (ok ? 0 : f + 1));
  };
  const pickWord = (used) => {
    const pool = WORDS.filter((w) => !used.includes(w));
    const p = pool.length ? pool : WORDS;
    return p[Math.floor(Math.random() * p.length)];
  };
  const startRound = (r, round, drawer) => {
    const t = Date.now();
    const word = pickWord(r.used || []);
    return { ...r, phase: "playing", round, drawer, word, used: [...(r.used || []), word], startsAt: t + READY_MS, endsAt: t + READY_MS + ROUND_MS, result: null };
  };
  const newGame = (r) => startRound({ ...r, gameId: uid(), scores: { host: 0, guest: 0 }, used: [], result: null }, 1, Math.random() < 0.5 ? "host" : "guest");

  const hostTick = async () => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    try {
      const r = roomRef.current;
      if (!r || r.phase === "closed") return;
      const g = oppRef.current;
      const t = Date.now();
      const gValid = !!(g && g.gameId === r.gameId);
      let next = null;
      if (gValid && g.name && g.name !== r.guestName) next = { ...r, guestName: g.name };
      const base = next || r;

      if (base.phase === "lobby") {
        if (gValid) next = startRound({ ...base, scores: { host: 0, guest: 0 }, used: [] }, 1, "host");
      } else if (base.phase === "playing") {
        const guesserRole = base.drawer === "host" ? "guest" : "host";
        const gd = guesserRole === "host" ? meRef.current : g;
        const hit = gd && gd.gameId === base.gameId && gd.round === base.round && (gd.guesses || []).some((x) => isMatch(x.text, base.word));
        if (hit && t >= base.startsAt) {
          const frac = Math.max(0, Math.min(1, (base.endsAt - t) / ROUND_MS));
          const gp = 50 + Math.round(100 * frac);
          const dp = 25 + Math.round(50 * frac);
          const scores = { ...base.scores };
          scores[guesserRole] += gp;
          scores[base.drawer] += dp;
          next = { ...base, phase: "result", scores, nextAt: t + RESULT_MS, result: { word: base.word, guessed: true, guesser: guesserRole, drawer: base.drawer, gp, dp, secs: Math.max(1, Math.round((t - base.startsAt) / 1000)) } };
        } else if (t >= base.endsAt) {
          next = { ...base, phase: "result", nextAt: t + RESULT_MS, result: { word: base.word, guessed: false, drawer: base.drawer } };
        }
      } else if (base.phase === "result") {
        if (t >= base.nextAt) next = base.round >= ROUNDS ? { ...base, phase: "over" } : startRound(base, base.round + 1, base.drawer === "host" ? "guest" : "host");
      } else if (base.phase === "over") {
        if (gValid && g.rematch === base.gameId) next = newGame(base);
      }

      if (next) await commitRoom(next);
      else if (t - (r.updatedAt || 0) > HEARTBEAT_MS) await commitRoom({ ...r });
    } finally {
      tickingRef.current = false;
    }
  };

  // ----- Polling loop -----
  useEffect(() => {
    aliveRef.current = true;
    let busy = false;
    const poll = async () => {
      if (busy || !aliveRef.current) return;
      busy = true;
      try {
        const [rr, oo] = await Promise.all([sGet(roomKey), sGet(oppKey)]);
        if (!aliveRef.current) return;
        if (rr.ok) {
          setNetFails(0);
          if (role === "guest") {
            const r = rr.data;
            const est = (r.updatedAt || 0) - Date.now();
            if (est > offsetRef.current) offsetRef.current = est;
            roomRef.current = r;
            setRoom(r);
            syncMe(r);
          }
        } else {
          setNetFails((f) => f + 1);
        }
        if (oo.ok) {
          const o = oo.data;
          if (o.updatedAt !== lastOppStamp.current) {
            lastOppStamp.current = o.updatedAt;
            setOppSeenAt(Date.now());
          }
          oppRef.current = o;
          setOpp(o);
        }
        if (role === "host") await hostTick();
        await flushMe(false);
      } finally {
        busy = false;
      }
    };
    poll();
    const a = setInterval(poll, POLL_MS);
    const b = setInterval(() => { if (dirtyRef.current) flushMe(false); }, FLUSH_MS);
    const c = setInterval(() => setNow(Date.now()), 250);
    return () => {
      aliveRef.current = false;
      clearInterval(a);
      clearInterval(b);
      clearInterval(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Actions -----
  const markDirty = () => { dirtyRef.current = true; };
  const undo = () => {
    meRef.current = { ...meRef.current, strokes: meRef.current.strokes.slice(0, -1) };
    dirtyRef.current = true;
    setCanvasV((v) => v + 1);
  };
  const clearCanvas = () => {
    meRef.current = { ...meRef.current, strokes: [] };
    dirtyRef.current = true;
    setCanvasV((v) => v + 1);
  };
  const submitGuess = () => {
    const r = roomRef.current;
    const text = guess.trim().slice(0, 40);
    if (!text || r.phase !== "playing" || r.drawer === role) return;
    if (Date.now() + offsetRef.current < r.startsAt) return;
    if ((meRef.current.guesses || []).some((g) => isMatch(g.text, r.word))) return;
    meRef.current = { ...meRef.current, guesses: [...(meRef.current.guesses || []), { text }] };
    setMeV((v) => v + 1);
    setGuess("");
    flushMe(true);
    if (role === "host") hostTick();
  };
  const rematch = async () => {
    const r = roomRef.current;
    if (r.phase !== "over") return;
    if (role === "host") await commitRoom(newGame(r));
    else {
      meRef.current = { ...meRef.current, rematch: r.gameId };
      setMeV((v) => v + 1);
      flushMe(true);
    }
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setCopied(false);
    }
  };
  const leave = async () => {
    aliveRef.current = false;
    if (role === "host") await sSet(roomKey, { ...roomRef.current, phase: "closed", updatedAt: Date.now() });
    else await sDel(myKey);
    onLeave();
  };

  // ----- Derived view state -----
  const r = room;
  const me = meRef.current;
  const names = { host: r.hostName || "Player 1", guest: r.guestName || "Player 2" };
  const nameOf = (x) => (x === role ? "You" : names[x]);
  const hn = now + (offsetRef.current || 0);
  const inRound = r.phase === "playing" || r.phase === "result";
  const isDrawer = inRound && r.drawer === role;
  const validFor = (d) => d && d.gameId === r.gameId && d.round === r.round;
  const drawerData = isDrawer ? me : opp;
  const guesserData = isDrawer ? opp : me;
  const drawerStrokes = validFor(drawerData) ? drawerData.strokes || [] : [];
  const guessesList = validFor(guesserData) ? guesserData.guesses || [] : [];
  viewerStrokesRef.current = drawerStrokes;
  const strokeSig = drawerStrokes.length + ":" + drawerStrokes.reduce((a, s) => a + s.p.length, 0);
  const readyLeft = r.phase === "playing" && hn < r.startsAt ? Math.ceil((r.startsAt - hn) / 1000) : 0;
  const secsLeft = r.phase === "playing" ? Math.max(0, Math.min(60, Math.ceil((r.endsAt - Math.max(hn, r.startsAt)) / 1000))) : 0;
  const iGotIt = r.phase === "playing" && !isDrawer && guessesList.some((g) => isMatch(g.text, r.word));
  const oppGone = r.phase !== "lobby" && r.phase !== "closed" && (oppSeenAt == null ? false : now - oppSeenAt > STALE_MS);
  const waitingRematch = role === "guest" && r.phase === "over" && me.rematch === r.gameId;

  if (r.phase === "closed") {
    return (
      <div className="dd-wrap" style={{ paddingTop: 40 }}>
        <div className="card p-6 text-center pop">
          <div style={{ fontSize: 56 }} aria-hidden="true">👋</div>
          <h2 className="text-2xl font-black mt-2">{names.host} ended the game</h2>
          <p className="mt-2 font-semibold" style={{ opacity: 0.7 }}>Create a new game or join another one from the start screen.</p>
          <button className="btn btn-yellow w-full mt-5" onClick={onLeave}>Back to start</button>
        </div>
      </div>
    );
  }

  const banner =
    r.phase === "lobby"
      ? { bg: "#ffd23f", fg: "#1b1340", text: role === "host" ? "Waiting for a friend to join" : "You're in! Starting the game…" }
      : r.phase === "playing"
      ? isDrawer
        ? { bg: "#ff3d7f", fg: "#fff", text: "🎨 Your turn to draw" }
        : { bg: "#19c39c", fg: "#fff", text: `🔍 ${names[r.drawer]} is drawing. You guess!` }
      : r.phase === "result"
      ? { bg: "#7b4dff", fg: "#fff", text: r.round >= ROUNDS ? "Last round done" : `Round ${r.round} done` }
      : { bg: "#ffd23f", fg: "#1b1340", text: "Game over" };

  const wordParts = r.word ? r.word.split(" ") : [];

  return (
    <div className="dd-wrap">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Logo small />
        <div className="flex items-center gap-2">
          <span className="chip" aria-label={`Room code ${code}`}>{code}</span>
          <button className="iconbtn" onClick={leave} aria-label="Leave game"><LogOut size={20} /></button>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[role, oppRole].map((pr) => {
          const drawing = r.phase === "playing" && r.drawer === pr;
          const joined = pr === "host" || !!r.guestName;
          return (
            <div key={pr} className={`card px-3 py-2 flex items-center gap-2 ${drawing ? "is-drawing" : ""}`}>
              <div className="avatar" style={{ background: pr === "host" ? "#ff3d7f" : "#2f7bff" }}>{joined ? names[pr][0].toUpperCase() : "?"}</div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="text-sm font-bold truncate" style={{ opacity: 0.65 }}>{pr === role ? "You" : joined ? names[pr] : "Waiting…"}</div>
                <div key={r.scores[pr]} className="text-2xl font-black pop" style={{ lineHeight: 1.1 }}>{r.scores[pr]}</div>
              </div>
              {drawing && <Pencil className="bob" size={20} aria-label="Drawing" />}
            </div>
          );
        })}
      </div>

      {/* Round progress */}
      {r.round > 0 && r.phase !== "over" && (
        <div className="flex items-center justify-center gap-2 mb-3" aria-label={`Round ${r.round} of ${ROUNDS}`}>
          <span className="font-black">Round {r.round} of {ROUNDS}</span>
          {Array.from({ length: ROUNDS }).map((_, i) => (
            <span key={i} className="rdot" style={{ background: i < r.round - 1 ? "#1b1340" : i === r.round - 1 ? "#ffd23f" : "#fff" }} />
          ))}
        </div>
      )}

      {/* Whose turn */}
      <div key={banner.text} className="turn pop" style={{ background: banner.bg, color: banner.fg }} aria-live="polite">{banner.text}</div>

      {/* Lobby */}
      {r.phase === "lobby" && role === "host" && (
        <div className="card p-5 text-center rise">
          <div className="font-bold" style={{ opacity: 0.7 }}>Your room code</div>
          <div className="flex justify-center gap-2 my-4">
            {code.split("").map((ch, i) => (
              <span key={i} className="codebox pop" style={{ animationDelay: `${i * 80}ms`, background: ["#ffd23f", "#b8f5d0", "#ffd6e4", "#d8ccff"][i] }}>{ch}</span>
            ))}
          </div>
          <button className="btn btn-yellow w-full" onClick={copyCode}>
            {copied ? (<><Check size={20} /> Copied</>) : (<><Copy size={20} /> Copy code</>)}
          </button>
          <p className="mt-4 font-semibold" style={{ opacity: 0.8 }}>Send your friend the game link. They enter this code to join, and the first round starts right away.</p>
          <div className="mt-4 flex items-center justify-center gap-3 font-bold">
            Waiting for player 2 <span className="dots" aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>
      )}
      {r.phase === "lobby" && role === "guest" && (
        <div className="card p-6 text-center rise">
          <div style={{ fontSize: 48 }} className="bob" aria-hidden="true">🎉</div>
          <p className="font-black text-xl mt-2">Joined {names.host}'s game</p>
          <div className="mt-3 flex justify-center"><span className="dots" aria-hidden="true"><i /><i /><i /></span></div>
        </div>
      )}

      {/* Round */}
      {inRound && (
        <>
          {r.phase === "playing" && (
            <div className="card p-3 mb-3">
              <div className="flex items-center justify-between gap-2">
                {isDrawer ? (
                  <div className="font-black text-lg">Draw: <span className="word">{r.word.toUpperCase()}</span></div>
                ) : (
                  <div>
                    <div className="blanks" aria-label={`${r.word.replace(/ /g, "").length} letters`}>
                      {wordParts.map((part, pi) => (
                        <span key={pi} className="flex gap-1" style={{ marginRight: 10 }}>
                          {part.split("").map((_, i) => <span key={i} className="blank" />)}
                        </span>
                      ))}
                    </div>
                    <div className="text-sm font-bold mt-2" style={{ opacity: 0.6 }}>
                      {r.word.replace(/ /g, "").length} letters{wordParts.length > 1 ? `, ${wordParts.length} words` : ""}
                    </div>
                  </div>
                )}
                <div className={`timer ${secsLeft <= 10 && !readyLeft ? "hurry" : ""}`} aria-label={`${secsLeft} seconds left`}>
                  <Clock size={20} />{secsLeft}
                </div>
              </div>
              <div className="timerbar mt-2">
                <div className="timerfill" style={{ width: `${(secsLeft / 60) * 100}%`, background: secsLeft <= 10 ? "#ff3d7f" : secsLeft <= 25 ? "#ff8a00" : "#19c39c" }} />
              </div>
            </div>
          )}

          <div className="card mb-3" style={{ position: "relative", overflow: "hidden", padding: 0 }}>
            <DrawCanvas
              key={`${r.gameId}-${r.round}-${isDrawer ? "d" : "v"}`}
              editable={isDrawer && r.phase === "playing" && readyLeft === 0}
              getStrokes={isDrawer ? () => meRef.current.strokes : () => viewerStrokesRef.current}
              version={isDrawer ? `e${canvasV}` : `v${strokeSig}`}
              color={color}
              size={size}
              onChange={markDirty}
            />
            {readyLeft > 0 && (
              <div className="overlay">
                <div key={readyLeft} className="count pop">{readyLeft}</div>
                <div className="font-black text-lg mt-3" style={{ color: "#fff" }}>
                  {isDrawer ? <>Get ready to draw <span className="word" style={{ color: "#1b1340" }}>{r.word.toUpperCase()}</span></> : `Get ready to guess ${names[r.drawer]}'s drawing`}
                </div>
              </div>
            )}
            {r.phase === "playing" && !isDrawer && readyLeft === 0 && drawerStrokes.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <span className="font-bold flex items-center gap-2" style={{ opacity: 0.5 }}>{names[r.drawer]} is picking up the pen <span className="dots"><i /><i /><i /></span></span>
              </div>
            )}
          </div>

          {/* Drawer tools */}
          {r.phase === "playing" && isDrawer && (
            <>
              <div className="card p-3 mb-3">
                <div className="flex flex-wrap gap-2 justify-center">
                  {PALETTE.map((c) => (
                    <button key={c} className={`swatch ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c === "#ffffff" ? "Eraser" : `Color ${c}`} aria-pressed={color === c}>
                      {c === "#ffffff" && <Eraser size={18} />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {SIZES.map((s) => (
                    <button key={s.w} className={`sizebtn ${size === s.w ? "on" : ""}`} onClick={() => setSize(s.w)} aria-label={`${s.label} brush`} aria-pressed={size === s.w}>
                      <span style={{ width: Math.max(6, s.w * 0.8), height: Math.max(6, s.w * 0.8), borderRadius: 99, display: "block", background: color === "#ffffff" ? "#1b1340" : color, border: "2px solid #1b1340" }} />
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button className="iconbtn" onClick={undo} aria-label="Undo last stroke"><Undo2 size={20} /></button>
                  <button className="iconbtn" onClick={clearCanvas} aria-label="Clear canvas"><Trash2 size={20} /></button>
                </div>
              </div>
              <GuessFeed title={`${names[oppRole]}'s guesses`} guesses={guessesList} word={r.word} />
            </>
          )}

          {/* Guesser input */}
          {r.phase === "playing" && !isDrawer && (
            <>
              {iGotIt ? (
                <div className="card p-4 mb-3 text-center pop font-black text-xl" style={{ background: "#b8f5d0" }}>🎉 Correct! Adding up points…</div>
              ) : (
                <div className="flex gap-2 mb-3">
                  <input
                    className="inp"
                    placeholder={readyLeft ? "Get ready…" : "Type your guess"}
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitGuess(); }}
                    disabled={readyLeft > 0}
                    maxLength={40}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="send"
                    aria-label="Your guess"
                  />
                  <button className="btn btn-pink" style={{ padding: "0 16px", flexShrink: 0 }} onClick={submitGuess} disabled={readyLeft > 0 || !guess.trim()} aria-label="Send guess">
                    <Send size={22} />
                  </button>
                </div>
              )}
              <GuessFeed title="Your guesses" guesses={guessesList} word={null} />
            </>
          )}

          {/* Round result */}
          {r.phase === "result" && r.result && (
            <div className="card p-5 text-center pop" style={{ background: r.result.guessed ? "#b8f5d0" : "#ffe0b8" }}>
              <div style={{ fontSize: 48 }} className="bob" aria-hidden="true">{r.result.guessed ? "🎉" : "⏰"}</div>
              <div className="text-2xl font-black mt-1">
                {r.result.guessed ? `${nameOf(r.result.guesser)} got it in ${r.result.secs}s!` : "Time's up!"}
              </div>
              <div className="mt-2 font-bold">The word was <span className="word">{r.result.word.toUpperCase()}</span></div>
              {r.result.guessed && (
                <div className="flex justify-center gap-2 mt-3 flex-wrap">
                  <span className="pts">🔍 {nameOf(r.result.guesser)} +{r.result.gp}</span>
                  <span className="pts">🎨 {nameOf(r.result.drawer)} +{r.result.dp}</span>
                </div>
              )}
              <div className="mt-4 text-sm font-bold" style={{ opacity: 0.7 }}>
                {r.round >= ROUNDS ? "Final scores" : "Next round"} in {Math.max(0, Math.ceil((r.nextAt - hn) / 1000))}…
              </div>
            </div>
          )}
        </>
      )}

      {/* Game over */}
      {r.phase === "over" && (() => {
        const a = r.scores[role];
        const b = r.scores[oppRole];
        const res = a > b ? "win" : a < b ? "lose" : "tie";
        return (
          <div className="rise">
            {res !== "lose" && <Confetti />}
            <div className="card p-6 text-center" style={{ position: "relative", zIndex: 31 }}>
              <div style={{ fontSize: 68 }} className="wiggle" aria-hidden="true">{res === "win" ? "🏆" : res === "tie" ? "🤝" : "🥈"}</div>
              <h2 className="text-3xl font-black mt-2">{res === "win" ? "You win!" : res === "tie" ? "It's a tie!" : `${names[oppRole]} wins!`}</h2>
              <div className="grid grid-cols-2 gap-3 mt-5">
                {[role, oppRole].map((pr) => (
                  <div key={pr} className="card p-3" style={{ background: r.scores[pr] >= Math.max(a, b) ? "#fff4c2" : "#fff", boxShadow: "3px 3px 0 #1b1340" }}>
                    <div className="font-bold truncate" style={{ opacity: 0.65 }}>{nameOf(pr)}</div>
                    <div className="text-3xl font-black">{r.scores[pr]}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-pink w-full mt-6" onClick={rematch} disabled={waitingRematch}>
                <RotateCcw size={20} /> {waitingRematch ? `Starting rematch…` : "Rematch"}
              </button>
              <button className="btn btn-white w-full mt-3" onClick={leave}><LogOut size={20} /> Leave game</button>
            </div>
          </div>
        );
      })()}

      {/* Connection banners */}
      {netFails >= 3 ? (
        <div className="banner pop" style={{ background: "#ffd6e4" }} role="status">
          <WifiOff size={22} /> Connection lost. Reconnecting…
        </div>
      ) : oppGone ? (
        <div className="banner pop" style={{ background: "#fff4c2" }} role="status">
          <WifiOff size={22} /> {names[oppRole]} seems disconnected. Waiting for them to come back…
        </div>
      ) : null}
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const [session, setSession] = useState(null);
  return (
    <div className="dd-root">
      <style>{CSS}</style>
      {session ? <Game key={session.code + session.role} session={session} onLeave={() => setSession(null)} /> : <Home onEnter={setSession} />}
    </div>
  );
}
