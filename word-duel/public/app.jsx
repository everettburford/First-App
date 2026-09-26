const { useState, useEffect, useRef, useCallback } = React;

const ANSWERS = "about above actor acute adopt adult after again agent agree alarm album alert alien alive alley allow alone amber angel anger angle angry ankle apple apron arena argue arrow aside audio award awful bacon badge bagel baker basic beach beard beast begin being bench berry birth black blade blame blank blast blaze bless blind block blond blood bloom board boast bonus boost booth brain brave bread break brick bride brief bring broad brook broom brown brush buddy build bunch burst cabin cable camel candy canoe cargo carry catch cause chain chair chalk charm chart chase cheap cheek cheer chess chest chick chief child chili chill chirp choir chunk cider cigar civil claim clash class clean clear clerk click cliff climb clock close cloth cloud clown coach coast cobra comet coral couch cough count court cover crack craft crane crash crate crawl crazy cream creek crest crisp crowd crown crumb crush crust curve cycle daily dairy daisy dance delay depth diary dizzy dodge dough dozen draft drain drama dream dress drift drill drink drive eager eagle early earth eight elbow elder empty enjoy enter equal error essay event every exact exist extra fable faint fairy faith false fancy feast fence ferry fever fiber field fifty fight final flame flash flock flood floor flour fluid flute focus force forge forty found frame fresh frost fruit funny gauge ghost giant given glass gleam globe glory glove grace grade grain grand grape grass gravy great greed green grill groan group grove guard guess guest guide habit happy harsh haste haunt heart heavy hedge hello hobby honey horse hotel house human humor hurry ideal image index inner irony ivory jelly jewel joint judge juice jumbo kayak knife knock label large laser later laugh layer learn lemon level light limit liver lobby local lodge logic loose lucky lunar lunch magic major maple march match mayor medal melon mercy metal meter might mimic minor model money month moose motor mount mouse mouth movie muddy mural music nerve never night ninja noble noise north novel nurse ocean offer olive onion opera orbit order other otter outer owner paint panda panel paper party pasta patch peace peach pearl pedal penny perch phone photo piano piece pilot pinch pixel pizza place plain plane plant plate plaza point polar porch pound power press price pride prize proof proud prune pulse punch puppy queen quest quick quiet quilt quota radar radio raise rally ranch range rapid raven reach ready realm rebel relax reply rhyme rider ridge rifle right risky rival river roast robin robot rocky round route royal rugby ruler rural salad sandy sauce scale scarf scene scent score scout screw seize sense serve seven shade shake shape share shark sharp sheep shelf shell shine shiny shirt shock shore short shout shrub sight silly since skate skill skirt skull slate sleep slice slide slope small smart smile smoke snack snake sneak solar solid solve sorry sound south space spare spark speak spear speed spell spend spice spike spine spoon sport spray squad stack staff stage stair stamp stand start state steak steam steel steep stick still sting stock stone stool storm story stove straw strip stuck study style sugar sunny super surge swamp sweat sweep sweet swift swing sword table taste teach tempo thank theme thick thief thing think thorn three throw thumb tiger tight timer toast today token tooth topic torch total touch tough towel tower toxic trace track trade trail train treat trend trial tribe trick truck truly trunk trust truth tulip tutor twist uncle under union unity until upper upset urban usual valid value vapor vault video vigor viral visit vital vivid vocal voice wagon waste watch water whale wheat wheel while whisk white whole witch woman world worry worth wound woven wrist write wrong yacht yield young youth zebra"
  .split(" ").filter((w) => w.length === 5);

const C = {
  bg: "#2b2d6e", panel: "#35388a", hit: "#2ec4a0", near: "#ffb627",
  miss: "#4a4d7a", empty: "#3f4296", text: "#f7f3ff", you: "#ff6b8b", them: "#7ad3ff",
};
const pick = () => ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
const newCode = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");

function score(guess, ans) {
  const r = Array(5).fill("b"), a = ans.split(""), g = guess.split("");
  for (let i = 0; i < 5; i++) if (g[i] === a[i]) { r[i] = "g"; a[i] = null; g[i] = null; }
  for (let i = 0; i < 5; i++) if (g[i]) { const j = a.indexOf(g[i]); if (j > -1) { r[i] = "y"; a[j] = null; } }
  return r.join("");
}

// ---------- shared storage helpers ----------
async function sget(k) { try { const r = await window.storage.get(k, true); return r ? JSON.parse(r.value) : null; } catch { return null; } }
async function sset(k, v) { try { await window.storage.set(k, JSON.stringify(v), true); } catch (e) { console.error(e); } }
async function sdel(k) { try { await window.storage.delete(k, true); } catch {} }

// A player is "over" if they finished, or the opponent already solved in fewer/equal rows
const isOver = (x, y) => x.done || (y.solved && !x.solved && x.rows.length >= y.rows.length);
function outcome(a, b) {
  if (a.solved && !b.solved) return "win";
  if (!a.solved && b.solved) return "lose";
  if (!a.solved && !b.solved) return "draw";
  if (a.rows.length !== b.rows.length) return a.rows.length < b.rows.length ? "win" : "lose";
  return a.finishedAt <= b.finishedAt ? "win" : "lose";
}

// ---------- board logic ----------
function useBoard(answer, resetKey, locked, onRows) {
  const [rows, setRows] = useState([]);
  const [cur, setCur] = useState("");
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
  const cb = useRef(onRows); cb.current = onRows;
  useEffect(() => { setRows([]); setCur(""); }, [answer, resetKey]);
  const solved = rows.some((r) => r.p === "ggggg");
  const done = solved || rows.length >= 6;
  const flash = (t) => { setToast(t); setShake(true); setTimeout(() => setShake(false), 400); setTimeout(() => setToast(""), 1400); };

  const press = useCallback((k) => {
    if (!answer || done || locked) return;
    if (k === "enter") {
      if (cur.length < 5) return flash("Not enough letters");
      if (!/[aeiouy]/.test(cur)) return flash("Not a word");
      const nr = [...rows, { w: cur, p: score(cur, answer) }];
      setRows(nr); setCur(""); cb.current && cb.current(nr);
    } else if (k === "back") setCur((c) => c.slice(0, -1));
    else if (/^[a-z]$/.test(k) && cur.length < 5) setCur((c) => c + k);
  }, [answer, done, locked, cur, rows]);

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "Enter") press("enter");
      else if (e.key === "Backspace") press("back");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [press]);

  return { rows, cur, toast, shake, solved, done, press };
}

const tileColor = (p) => (p === "g" ? C.hit : p === "y" ? C.near : p === "b" ? C.miss : C.empty);

function Grid({ rows, cur, shake }) {
  return (
    <div className="flex flex-col gap-1.5 items-center">
      {Array.from({ length: 6 }, (_, r) => {
        const row = rows[r], isCur = r === rows.length;
        return (
          <div key={r} className="flex gap-1.5" style={isCur && shake ? { animation: "shake .35s" } : {}}>
            {Array.from({ length: 5 }, (_, i) => {
              const ch = row ? row.w[i] : isCur ? cur[i] : "";
              return (
                <div key={i} className="flex items-center justify-center font-black uppercase"
                  style={{
                    width: 54, height: 54, fontSize: 26, borderRadius: 10, color: C.text,
                    background: row ? tileColor(row.p[i]) : C.empty,
                    border: !row && ch ? `2px solid ${C.text}` : "2px solid transparent",
                    animation: row ? `flip .45s ${i * 0.08}s both` : "none",
                  }}>{ch}</div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function MiniGrid({ patterns, color, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs font-bold" style={{ color }}>{label}</div>
      {Array.from({ length: 6 }, (_, r) => (
        <div key={r} className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: patterns[r] ? tileColor(patterns[r][i]) : C.empty }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Keyboard({ rows, press }) {
  const best = {};
  const rank = { g: 3, y: 2, b: 1 };
  rows.forEach(({ w, p }) => w.split("").forEach((ch, i) => { if ((rank[p[i]] || 0) > (rank[best[ch]] || 0)) best[ch] = p[i]; }));
  const lines = ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"];
  return (
    <div className="flex flex-col gap-1.5 w-full" style={{ maxWidth: 480 }}>
      {lines.map((l, li) => (
        <div key={li} className="flex gap-1 justify-center">
          {l.split("").map((k) => {
            const special = k === "+" || k === "-";
            return (
              <button key={k} onClick={() => press(k === "+" ? "enter" : k === "-" ? "back" : k)}
                className="font-bold uppercase active:scale-95"
                style={{
                  flex: special ? 1.5 : 1, height: 52, borderRadius: 8, color: C.text, fontSize: special ? 12 : 16,
                  background: best[k] ? tileColor(best[k]) : "#5a5dab", border: "none",
                }}>{k === "+" ? "Enter" : k === "-" ? "⌫" : k}</button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const Btn = ({ children, onClick, color = C.you, disabled }) => (
  <button onClick={onClick} disabled={disabled}
    className="w-full font-black py-3.5 active:scale-95 disabled:opacity-50"
    style={{ background: color, color: "#1c1d4a", borderRadius: 14, fontSize: 17, border: "none" }}>{children}</button>
);

// ---------- solo ----------
function Solo({ onBack }) {
  const [answer, setAnswer] = useState(pick);
  const [n, setN] = useState(0);
  const b = useBoard(answer, n, false);
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <TopBar onBack={onBack} title="Practice" />
      <div style={{ height: 24, color: C.near }} className="font-bold">
        {b.toast || (b.solved ? `Got it in ${b.rows.length}!` : b.done ? `The word was ${answer.toUpperCase()}` : "")}
      </div>
      <Grid rows={b.rows} cur={b.cur} shake={b.shake} />
      {b.done && <div className="w-48"><Btn color={C.hit} onClick={() => { setAnswer(pick()); setN(n + 1); }}>New word</Btn></div>}
      <Keyboard rows={b.rows} press={b.press} />
    </div>
  );
}

function TopBar({ onBack, title, right }) {
  return (
    <div className="flex items-center justify-between w-full" style={{ maxWidth: 480 }}>
      <button onClick={onBack} className="font-bold text-sm px-3 py-1.5" style={{ background: C.panel, color: C.text, borderRadius: 10, border: "none" }}>Leave</button>
      <div className="font-black text-lg">{title}</div>
      <div style={{ minWidth: 60 }} className="text-right">{right}</div>
    </div>
  );
}

// ---------- duel ----------
function Duel({ code, me, isHost, quick, onLeave }) {
  const [meta, setMeta] = useState(null);
  const [opp, setOpp] = useState(null);
  const mine = useRef({ round: 1, rows: [], solved: false, done: false, finishedAt: 0, ready: 0 });
  const [, force] = useState(0);
  const lastLobby = useRef(0);

  const round = meta?.round || 1;
  const oppState = opp && opp.round === round ? opp : { rows: [], solved: false, done: false };
  const myKey = `room:${code}:${me.id}`;

  const writeMine = (patch) => { mine.current = { ...mine.current, ...patch }; sset(myKey, mine.current); force((x) => x + 1); };

  // reset my state on new round
  useEffect(() => {
    if (meta && mine.current.round !== meta.round) writeMine({ round: meta.round, rows: [], solved: false, done: false, finishedAt: 0 });
  }, [meta?.round]);

  const onRows = (nr) => {
    const solved = nr.some((r) => r.p === "ggggg");
    const done = solved || nr.length >= 6;
    writeMine({ rows: nr.map((r) => r.p), solved, done, finishedAt: done ? Date.now() : 0 });
  };

  const myView = { ...mine.current, rows: mine.current.round === round ? mine.current.rows : [] };
  const iAmOver = meta?.guest ? isOver(myView, oppState) : false;
  const b = useBoard(meta?.word, round, !meta?.guest || iAmOver, onRows);
  const roundOver = meta?.guest && isOver(myView, oppState) && isOver(oppState, myView);
  const result = roundOver ? outcome(myView, oppState) : null;

  useEffect(() => {
    let alive = true;
    sset(myKey, mine.current);
    const tick = async () => {
      const m = await sget(`room:${code}`);
      if (!alive || !m) return;
      setMeta(m);
      const oppId = isHost ? m.guest?.id : m.host.id;
      let o = null;
      if (oppId) { o = await sget(`room:${code}:${oppId}`); if (alive) setOpp(o); }

      if (isHost && quick && !m.guest && Date.now() - lastLobby.current > 8000) {
        lastLobby.current = Date.now();
        sset("lobby:quick", { code, t: Date.now(), host: me.id });
      }
      if (!isHost || !o || o.round !== m.round) return;
      const my = mine.current;
      if (my.round !== m.round) return;
      const over = isOver(my, o) && isOver(o, my);
      // score the round once
      if (over && m.scored !== m.round) {
        const res = outcome(my, o);
        const scores = { ...(m.scores || {}) };
        if (res === "win") scores[me.id] = (scores[me.id] || 0) + 1;
        if (res === "lose") scores[oppId] = (scores[oppId] || 0) + 1;
        const nm = { ...m, scores, scored: m.round };
        await sset(`room:${code}`, nm); setMeta(nm);
      }
      // start next round when both tapped "next"
      if (over && my.ready === m.round && o.ready === m.round) {
        let w = pick(); while (w === m.word) w = pick();
        const nm = { ...m, round: m.round + 1, word: w };
        await sset(`room:${code}`, nm); setMeta(nm);
      }
    };
    tick();
    const iv = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(iv); };
  }, [code]);

  const leave = async () => {
    await sset(myKey, { ...mine.current, left: true });
    if (quick) { const l = await sget("lobby:quick"); if (l?.code === code) sdel("lobby:quick"); }
    onLeave();
  };

  if (!meta) return <div className="mt-20 font-bold">Connecting…</div>;
  const oppInfo = isHost ? meta.guest : meta.host;
  const myScore = meta.scores?.[me.id] || 0, oppScore = oppInfo ? meta.scores?.[oppInfo.id] || 0 : 0;

  if (!meta.guest) {
    return (
      <div className="flex flex-col items-center gap-6 w-full">
        <TopBar onBack={leave} title="Waiting room" />
        {quick ? (
          <div className="text-center mt-10">
            <div className="text-2xl font-black mb-2">Finding an opponent</div>
            <div style={{ opacity: 0.75 }}>Keep this open. The match starts as soon as someone taps Quick match.</div>
          </div>
        ) : (
          <div className="text-center mt-10">
            <div style={{ opacity: 0.75 }}>Send this code to a friend</div>
            <div className="font-black my-3" style={{ fontSize: 64, letterSpacing: 10, color: C.near }}>{code}</div>
            <div style={{ opacity: 0.75 }}>Or send them a link that drops them straight into this match.</div>
            <div className="w-64 mx-auto mt-5"><InviteButton code={code} /></div>
          </div>
        )}
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => <div key={i} style={{ width: 14, height: 14, borderRadius: 4, background: [C.hit, C.near, C.you][i], animation: `bob 1s ${i * 0.15}s infinite` }} />)}
        </div>
      </div>
    );
  }

  const status = opp?.left ? `${oppInfo.name} left the match`
    : b.toast ? b.toast
    : result === "win" ? "You win this round!"
    : result === "lose" ? `${oppInfo.name} wins this round`
    : result === "draw" ? "Nobody got it. Draw."
    : iAmOver ? `${oppInfo.name} got it first`
    : oppState.solved ? `${oppInfo.name} solved it in ${oppState.rows.length}. Beat that!`
    : "";

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <TopBar onBack={leave} title={`Round ${round}`} right={<span className="font-black"><span style={{ color: C.you }}>{myScore}</span> – <span style={{ color: C.them }}>{oppScore}</span></span>} />
      <div className="flex items-center justify-center gap-5 w-full">
        <Grid rows={b.rows} cur={b.cur} shake={b.shake} />
        <MiniGrid patterns={oppState.rows} color={C.them} label={oppInfo.name} />
      </div>
      <div style={{ minHeight: 24, color: result === "win" ? C.hit : C.near }} className="font-bold text-center">{status}</div>
      {roundOver && (
        <div className="flex flex-col items-center gap-2 w-60">
          <div className="text-sm" style={{ opacity: 0.8 }}>The word was <b>{meta.word.toUpperCase()}</b></div>
          {mine.current.ready === round
            ? <div className="text-sm font-bold" style={{ color: C.them }}>Waiting for {oppInfo.name}…</div>
            : <Btn color={C.hit} onClick={() => writeMine({ ready: round })}>Next round</Btn>}
        </div>
      )}
      <Keyboard rows={b.rows} press={b.press} />
    </div>
  );
}

function InviteButton({ code }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: "Word Duel", text: "Play me in Word Duel!", url: link }); return; }
      await navigator.clipboard.writeText(link);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return <Btn onClick={share} color={C.hit}>{copied ? "Link copied" : "Send invite link"}</Btn>;
}

// ---------- home ----------
function App() {
  const [me] = useState(() => ({ id: Math.random().toString(36).slice(2, 10) }));
  const [name, setName] = useState("");
  const [screen, setScreen] = useState("home");
  const [room, setRoom] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite] = useState(() => {
    try { const c = new URLSearchParams(window.location.search).get("room"); return c && /^[A-Z]{4}$/i.test(c) ? c.toUpperCase() : null; } catch { return null; }
  });
  const [showInvite, setShowInvite] = useState(!!invite);
  const clearInvite = () => { setShowInvite(false); try { window.history.replaceState(null, "", window.location.pathname); } catch {} };

  const who = () => ({ id: me.id, name: name.trim() || "Player" });

  const createRoom = async () => {
    const code = newCode();
    await sset(`room:${code}`, { code, host: who(), guest: null, round: 1, word: pick(), scores: {}, scored: 0 });
    return code;
  };
  const joinRoom = async (code) => {
    const m = await sget(`room:${code}`);
    if (!m) return "No room with that code. Check the letters and try again.";
    if (m.guest && m.guest.id !== me.id) return "That room already has two players.";
    await sset(`room:${code}`, { ...m, guest: who() });
    await new Promise((r) => setTimeout(r, 500));
    const check = await sget(`room:${code}`);
    if (check?.guest?.id !== me.id) return "Someone else joined first. Try another room.";
    return null;
  };

  const go = async (fn) => { setErr(""); setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const quickMatch = () => go(async () => {
    const l = await sget("lobby:quick");
    if (l && l.host !== me.id && Date.now() - l.t < 25000) {
      await sdel("lobby:quick");
      const e = await joinRoom(l.code);
      if (!e) { setRoom({ code: l.code, isHost: false, quick: true }); setScreen("duel"); return; }
    }
    const code = await createRoom();
    await sset("lobby:quick", { code, t: Date.now(), host: me.id });
    setRoom({ code, isHost: true, quick: true }); setScreen("duel");
  });
  const create = () => go(async () => { const code = await createRoom(); setRoom({ code, isHost: true, quick: false }); setScreen("duel"); });
  const join = () => go(async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) return setErr("Room codes are 4 letters.");
    const e = await joinRoom(code);
    if (e) return setErr(e);
    setRoom({ code, isHost: false, quick: false }); setScreen("duel");
  });

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-3 py-4" style={{ background: C.bg, color: C.text, fontFamily: "'Rubik', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;700;900&display=swap');
        @keyframes flip { 0% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
        @keyframes shake { 0%,100% { transform: translateX(0);} 25% { transform: translateX(-6px);} 75% { transform: translateX(6px);} }
        @keyframes bob { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-10px);} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        button:focus-visible, input:focus-visible { outline: 3px solid ${C.near}; outline-offset: 2px; }
      `}</style>

      {screen === "solo" && <Solo onBack={() => setScreen("home")} />}
      {screen === "duel" && room && <Duel {...room} me={me} onLeave={() => { setRoom(null); setScreen("home"); }} />}

      {screen === "home" && showInvite && (
        <div className="flex flex-col items-center gap-5 w-full mt-10" style={{ maxWidth: 360 }}>
          <div className="text-2xl font-black text-center">You've been challenged!</div>
          <p className="text-center" style={{ opacity: 0.8, lineHeight: 1.5 }}>
            Same hidden word, six tries each. Fewest guesses wins.
          </p>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} placeholder="Your name"
            className="w-full px-4 py-3 font-bold" style={{ background: C.panel, color: C.text, borderRadius: 14, border: "none", fontSize: 17 }} />
          <Btn disabled={busy} onClick={() => go(async () => {
            const e = await joinRoom(invite);
            if (e) return setErr(e);
            clearInvite(); setRoom({ code: invite, isHost: false, quick: false }); setScreen("duel");
          })}>Join match</Btn>
          {err && <div className="font-bold text-center" style={{ color: C.you }}>{err}</div>}
          <button onClick={() => { setErr(""); clearInvite(); }} className="font-bold underline" style={{ background: "none", border: "none", color: C.text, opacity: 0.8 }}>
            Go to main menu
          </button>
        </div>
      )}

      {screen === "home" && !showInvite && (
        <div className="flex flex-col items-center gap-5 w-full" style={{ maxWidth: 360 }}>
          <div className="flex gap-1.5 mt-6">
            {"DUEL".split("").map((ch, i) => (
              <div key={i} className="flex items-center justify-center font-black"
                style={{ width: 62, height: 62, fontSize: 34, borderRadius: 12, background: [C.hit, C.near, C.miss, C.hit][i], animation: `flip .5s ${i * 0.12}s both` }}>{ch}</div>
            ))}
          </div>
          <p className="text-center" style={{ opacity: 0.8, lineHeight: 1.5 }}>
            Same hidden word, two players, six tries each. Fewest guesses wins. New word every round.
          </p>

          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} placeholder="Your name"
            className="w-full px-4 py-3 font-bold" style={{ background: C.panel, color: C.text, borderRadius: 14, border: "none", fontSize: 17 }} />

          <Btn onClick={quickMatch} disabled={busy}>Quick match</Btn>
          <Btn onClick={create} disabled={busy} color={C.them}>Create room for a friend</Btn>

          <div className="flex gap-2 w-full">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))} placeholder="Code"
              className="flex-1 px-4 py-3 font-black text-center" style={{ background: C.panel, color: C.text, borderRadius: 14, border: "none", fontSize: 20, letterSpacing: 6, minWidth: 0 }} />
            <div style={{ width: 110 }}><Btn onClick={join} disabled={busy} color={C.near}>Join</Btn></div>
          </div>
          {err && <div className="font-bold text-center" style={{ color: C.you }}>{err}</div>}

          <button onClick={() => setScreen("solo")} className="font-bold underline mt-1" style={{ background: "none", border: "none", color: C.text, opacity: 0.8 }}>
            Practice solo
          </button>
          <p className="text-xs text-center" style={{ opacity: 0.55 }}>Your name and guesses are shared with the other player in your match.</p>
        </div>
      )}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
