/* Hivemind: AI agents and neural nets thinking, talking, planning. Plain canvas 2D, no dependencies.
   The scene lives in "world" coordinates (one unit = one CSS pixel at zoom 1); the camera maps them to the screen. */
(() => {
    'use strict';

    // ---------------------------------------------------------------- setup
    const canvas = document.getElementById('sim');
    const ctx = canvas.getContext('2d');
    const $ = (id) => document.getElementById(id);
    const MONO = '"JetBrains Mono","Cascadia Code","SF Mono",Consolas,Menlo,monospace';
    const TAU = Math.PI * 2;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SPEEDS = [0.25, 0.5, 1, 2, 4];
    let speedIdx = reduceMotion ? 1 : 2;
    const ZMIN = 0.6, ZMAX = 3;
    const MAX_AGENTS = 14;

    const COL = {
        cyan: '#38e8ff', blue: '#4d8dff', violet: '#9b6bff', magenta: '#ff4fd8', amber: '#ffb547',
        green: '#46ffa8', red: '#ff5c7a', teal: '#2fffd6', orange: '#ff8a4c', white: '#e8f4ff',
    };

    const rand = (a, b) => a + Math.random() * (b - a);
    const randi = (a, b) => Math.floor(rand(a, b + 1));
    const pick = (arr) => arr[(Math.random() * arr.length) | 0];
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, k) => a + (b - a) * k;
    const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
    const rgbCache = new Map();
    function rgba(hex, a) {
        let c = rgbCache.get(hex);
        if (!c) {
            const n = parseInt(hex.slice(1), 16);
            c = `${n >> 16},${(n >> 8) & 255},${n & 255}`;
            rgbCache.set(hex, c);
        }
        return `rgba(${c},${a})`;
    }

    // Pre-rendered glow sprites: far cheaper than shadowBlur.
    const glowCache = new Map();
    function glowSprite(color) {
        let s = glowCache.get(color);
        if (s) return s;
        s = document.createElement('canvas');
        s.width = s.height = 128;
        const g = s.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, rgba(color, 1));
        gr.addColorStop(0.12, rgba(color, 0.75));
        gr.addColorStop(0.35, rgba(color, 0.22));
        gr.addColorStop(1, rgba(color, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
        glowCache.set(color, s);
        return s;
    }
    function glow(x, y, r, color, a) {
        if (a <= 0.004) return;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = Math.min(1, a) * prev;
        ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = prev;
    }

    // ---------------------------------------------------------------- content
    const ROLES = [
        { name: 'ORACLE', color: COL.cyan, job: 'Forecasts what happens next',
          thoughts: ['sampling 10k futures', 'scanning weak signals', 'forecasting demand shift', 'modelling regime change', 'pricing tail risk'] },
        { name: 'PLANNER', color: COL.amber, job: 'Turns goals into plans',
          thoughts: ['decomposing objective', 'pruning plan tree', 're-sequencing roadmap', 'scheduling subtasks', 'merging plan branches'] },
        { name: 'RESEARCHER', color: COL.teal, job: 'Reads everything, first',
          thoughts: ['reading 3,400 papers', 'cross-checking sources', 'building citation graph', 'extracting claims', 'tracing a rumour'] },
        { name: 'ARCHITECT', color: COL.blue, job: 'Designs the systems',
          thoughts: ['drafting system design', 'stress-testing topology', 'sketching data flow', 'weighing trade-offs'] },
        { name: 'CODER', color: COL.green, job: 'Builds it, fast',
          thoughts: ['writing CUDA kernel', 'refactoring module', 'compiling 212 files', 'optimising hot loop', 'writing tests first'] },
        { name: 'CRITIC', color: COL.red, job: 'Tries to break every plan',
          thoughts: ['red-teaming plan', 'hunting failure modes', 'challenging assumption #4', 'auditing the forecast'] },
        { name: 'STRATEGIST', color: COL.violet, job: 'Plays the long game',
          thoughts: ['gaming competitor moves', 'hedging scenario B', 'mapping 2nd-order effects', 'timing the market'] },
        { name: 'MEMORY', color: COL.magenta, job: 'Remembers every lesson',
          thoughts: ['indexing episode 48,112', 'compressing context', 'recalling precedent', 'consolidating lessons'] },
        { name: 'EXECUTOR', color: COL.orange, job: 'Ships it',
          thoughts: ['deploying build 9.4.1', 'running 512 trials', 'rolling out canary', 'watching live metrics'] },
    ];
    // Spawned on demand with N / "+ Agent".
    const EXTRA_ROLES = [
        { name: 'SCOUT', color: '#a6ff5c', job: 'Goes first, reports back',
          thoughts: ['probing a new market', 'mapping unknown terrain', 'pinging edge sensors', 'scouting talent pools'] },
        { name: 'QUANT', color: '#ffe14d', job: 'Turns noise into numbers',
          thoughts: ['fitting 40 factors', 'backtesting 12 years', 'pricing volatility', 'estimating alpha decay'] },
        { name: 'DIPLOMAT', color: '#ff9ecf', job: 'Negotiates with the outside world',
          thoughts: ['drafting partner terms', 'reading counterpart intent', 'finding the win-win', 'de-escalating conflict'] },
        { name: 'SENTINEL', color: '#5cc8ff', job: 'Watches for threats',
          thoughts: ['scanning attack surface', 'watching anomaly feed', 'patching an exposure', 'auditing permissions'] },
        { name: 'ETHICIST', color: '#d2b6ff', job: 'Keeps the plans honest',
          thoughts: ['weighing side effects', 'checking fairness', 'flagging externalities', 'asking "should we?"'] },
    ];
    const IDLE = ['standing by', 'listening', 'idle · 0.3% load', 'awaiting signal'];
    const TOPICS = ['capacity shift to EU-north', 'pricing curve v12', 'supply shock scenario', 'latency budget',
        'hedge on rate cut', 'new market entry', 'retrain window', 'risk surface map', 'talent allocation',
        'launch sequencing', 'demand inflection', 'compute reservation', 'competitor countermove', 'data moat expansion',
        'energy cost spike', 'regulatory window'];
    const OPEN = ['PROPOSE', 'QUERY', 'FORECAST', 'EVIDENCE', 'CHALLENGE', 'SYNC'];
    const MID = ['COUNTER', 'REFINE', '+EVIDENCE', 'SIMULATE', 'CHALLENGE'];
    const CLOSE = ['AGREE', 'APPROVE', 'COMMIT', 'ACK'];
    const TOKENS = ['∇', 'Σ', 'λ', '∂', '0.97', 'attn', '→', 'if', '⊕', 'κ', 'plan', 'τ+1', '∞', 'Δ', '0x3F', 'p<.01',
        'argmax', 'softmax', 'q̂', 'β', '∴', 'KV', '≈', 'μ', 'σ²'];
    const ADJ = ['Silent', 'Northern', 'Quantum', 'Vector', 'Iron', 'Glass', 'Velvet', 'Zero', 'Crimson', 'Lucid', 'Polar', 'Hidden'];
    const NOUN = ['Horizon', 'Lattice', 'Meridian', 'Cascade', 'Tide', 'Arc', 'Prism', 'Ember', 'Atlas', 'Vanguard', 'Signal', 'Orbit'];
    // [task, owner, phase] phase 0 = early, 1 = middle, 2 = late
    const TASKS = [
        ['scan weak signals', 'ORACLE', 0], ['decompose goal', 'PLANNER', 0], ['literature sweep', 'RESEARCHER', 0],
        ['recall precedents', 'MEMORY', 0], ['acquire data', 'RESEARCHER', 0],
        ['simulate futures', 'ORACLE', 1], ['design system', 'ARCHITECT', 1], ['build prototype', 'CODER', 1],
        ['red-team strategy', 'CRITIC', 1], ['price scenarios', 'STRATEGIST', 1], ['optimise kernels', 'CODER', 1],
        ['game rivals', 'STRATEGIST', 1], ['verify sources', 'RESEARCHER', 1], ['stress-test', 'CRITIC', 1],
        ['train model v2', 'CODER', 1],
        ['deploy', 'EXECUTOR', 2], ['run live trials', 'EXECUTOR', 2], ['compress lessons', 'MEMORY', 2],
        ['final audit', 'CRITIC', 2],
    ];
    const SUBJECTS = ['compute prices', 'EU-north demand', 'rate-cut odds', 'supply-chain stress', 'competitor hiring',
        'energy futures', 'AI-chip sentiment', 'shipping lanes', 'consumer credit', 'open-source momentum', 'freight rates',
        'battery prices', 'cloud spot capacity'];
    const PREDICATES = ['inflects upward', 'peaks', 'reverses', 'decouples from consensus', 'breaks out', 'bottoms out',
        'accelerates', 'stalls'];
    const DECISIONS = ['adopted', 'approved by a wide margin', 'locked in', 'greenlit', 'ratified', 'committed'];
    const OBJECTIVE_IDEAS = ['corner the battery market', 'launch in 40 countries', 'predict the next recession',
        'out-think the competition', 'cure the supply chain', 'build a city on Mars', 'win the chip race'];

    // ---------------------------------------------------------------- state
    let W = 0, H = 0, DPR = 1;
    const L = { s: 1 };
    let t = 0;
    let paused = false;
    let hudOff = false;
    let panelsOn = false;
    const cam = { x: 0, y: 0, z: 1 };
    const mouse = { sx: -1e4, sy: -1e4, px: 0, py: 0, tx: 0, ty: 0 };
    const stats = { tokens: 184220431, msgTimes: [], thoughtTimes: [], plans: 0, epoch: 4812, insights: 2040, lead: 14.2 };
    const timers = [];
    const packets = [];
    const links = new Map();
    const tokens = [];
    const waves = [];
    const dust = [];
    let net = null;
    let netCanvas = null;
    let bgGrad = null;
    let plan = null;
    let planSeq = 0;
    let hovered = null; // { kind: 'agent' | 'task' | 'core', obj }
    let gesture = null;

    const font = (px, weight = '') => `${weight} ${Math.round(px * L.s)}px ${MONO}`;
    const toWorld = (sx, sy) => ({ x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z });
    const toScreen = (wx, wy) => ({ x: wx * cam.z + cam.x, y: wy * cam.z + cam.y });
    function after(sec, fn) { timers.push({ at: t + sec, fn }); }

    // ---------------------------------------------------------------- agents + core
    function makeAgent(role, i) {
        return {
            ...role, i, x: NaN, y: NaN, hx: 0, hy: 0, flash: 0, think: 0, thinking: false, busyUntil: 0,
            thought: pick(IDLE), shown: 0, spin: rand(0, TAU), task: null, nextAct: rand(0.5, 4),
            load: rand(0.3, 0.6), trust: rand(0.9, 0.99), sent: 0, drag: null,
            mini: [3, 4, 3].map((n) => Array.from({ length: n }, () => ({ a: 0, ph: rand(0, TAU), f: rand(2, 7) }))),
        };
    }
    const agents = ROLES.map(makeAgent);
    const byName = Object.fromEntries(agents.map((a) => [a.name, a]));
    const planner = byName.PLANNER;

    const core = { name: 'CORE', color: COL.cyan, x: 0, y: 0, consensus: 0.35, pulse: 0, rot: 0, pts: [], pairs: [] };
    (function buildSphere() {
        const N = 220;
        for (let i = 0; i < N; i++) {
            const y = 1 - (i / (N - 1)) * 2;
            const r = Math.sqrt(1 - y * y);
            const th = i * Math.PI * (3 - Math.sqrt(5));
            core.pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, lit: 0, sx: 0, sy: 0, d: 0 });
        }
        for (let i = 0; i < N; i++) {
            const p = core.pts[i];
            const near = [];
            for (let j = i + 1; j < N; j++) {
                const q = core.pts[j];
                if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 < 0.06) near.push(j);
            }
            near.slice(0, 2).forEach((j) => core.pairs.push([i, j]));
        }
    })();

    function setThought(a, text) {
        if (a.thought === text) return;
        a.thought = text;
        a.shown = 0;
    }

    function cogitate(a, secs, text) {
        a.thinking = true;
        a.busyUntil = Math.max(a.busyUntil, t + secs);
        setThought(a, text || pick(a.thoughts));
        stats.thoughtTimes.push(t);
    }

    function homeOf(a) {
        const ang = -Math.PI / 2 + (a.i * TAU) / agents.length + t * 0.012;
        a.hx = L.cx + Math.cos(ang) * L.rx;
        a.hy = L.cy + Math.sin(ang) * L.ry + Math.sin(t * 0.7 + a.i) * 4;
    }

    function spawnAgent() {
        const role = EXTRA_ROLES.find((r) => !byName[r.name]);
        if (!role || agents.length >= MAX_AGENTS) { toast(`The collective is at full strength (${agents.length} agents)`); return; }
        const a = makeAgent(role, agents.length);
        a.x = L.cx; // emerges from the core and glides to its seat
        a.y = L.cy;
        a.flash = 1;
        agents.push(a);
        byName[a.name] = a;
        waves.push({ x: L.cx, y: L.cy, r: L.coreR, max: L.coreR * 5, life: 1, color: a.color });
        sysLog('SPAWN', `${a.name} joined the collective · ${a.job.toLowerCase()}`, true);
        toast(`${a.name} online · ${a.job}`);
        after(0.8, () => send(planner, a, 'ONBOARD', 'mission brief'));
        after(1.8, () => dialogue(a, byName.MEMORY, 2));
    }

    // ---------------------------------------------------------------- messaging
    function linkKey(a, b) { return a.name < b.name ? a.name + '|' + b.name : b.name + '|' + a.name; }
    function touchLink(a, b) {
        const k = linkKey(a, b);
        const l = links.get(k);
        if (l) l.s = 1; else links.set(k, { a, b, s: 1 });
    }

    function ctrlPoint(a, b) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (a === core || b === core) return { x: mx - (b.y - a.y) * 0.22, y: my + (b.x - a.x) * 0.22 };
        return { x: lerp(mx, L.cx, 0.5), y: lerp(my, L.cy, 0.5) };
    }
    function qpt(a, c, b, k) {
        const u = 1 - k;
        return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
    }

    function send(from, to, kind, detail, onArrive) {
        if (from === to) { if (onArrive) onArrive(); return; }
        packets.push({ from, to, kind, detail, k: 0, dur: rand(0.9, 1.5), color: from.color, onArrive });
        touchLink(from, to);
        if (from.sent !== undefined) from.sent++;
        from.flash = Math.max(from.flash, 0.5);
    }

    function dialogue(a, b, turns, topicIn) {
        const topic = topicIn || pick(TOPICS);
        let turn = 0;
        const step = (s, r) => {
            const kind = turn === 0 ? pick(OPEN) : turn === turns - 1 ? pick(CLOSE) : pick(MID);
            turn++;
            cogitate(s, 1.6, kind === 'CHALLENGE' ? 'challenging: ' + topic : pick(s.thoughts));
            const detail = Math.random() < 0.5 ? `${topic} (p=${rand(0.71, 0.98).toFixed(2)})` : topic;
            send(s, r, kind, detail, () => {
                if (turn < turns) after(rand(0.15, 0.6), () => step(r, s));
                else if (Math.random() < 0.75) vote(r, topic);
            });
        };
        step(a, b);
    }

    function vote(a, topic, weight = 1) {
        send(a, core, 'VOTE', topic, () => {
            if (core.consensus >= 1) return;
            core.consensus += rand(0.07, 0.13) * weight;
            core.pulse = 1;
            if (core.consensus >= 1) consensusReached(topic);
        });
    }

    function consensusReached(topic) {
        core.consensus = 1;
        core.pulse = 1.6;
        after(0.6, () => { core.consensus = 0.22; });
        waves.push({ x: L.cx, y: L.cy, r: L.coreR, max: Math.max(W, H) * 0.7, life: 1, color: COL.green });
        waves.push({ x: L.cx, y: L.cy, r: L.coreR * 0.6, max: Math.max(W, H) * 0.45, life: 1, color: COL.cyan });
        const decision = pick(DECISIONS);
        sysLog('CONSENSUS', `${topic}: ${decision}`);
        toast(`CONSENSUS REACHED · ${topic} · ${decision}`);
        agents.forEach((a, i) => after(i * 0.04, () => send(core, a, 'COMMIT', topic)));
        addInsight();
    }

    function broadcast(a) {
        const idea = pick(TOPICS);
        cogitate(a, 2.5, 'broadcasting: ' + idea);
        a.flash = 1;
        waves.push({ x: a.x, y: a.y, r: L.agentR, max: L.agentR * 9, life: 1, color: a.color });
        sysLog('BROADCAST', `${a.name} shares "${idea}" with everyone`, true);
        agents.forEach((b, i) => {
            if (b === a) return;
            after(i * 0.05, () => send(a, b, 'BROADCAST', idea, () => {
                if (Math.random() < 0.45) after(rand(0.2, 1), () => send(b, a, pick(MID), idea));
            }));
        });
        after(1.8, () => vote(a, idea));
    }

    function callVote() {
        const topic = plan && !plan.doneAt ? (plan.objective || plan.name.toLowerCase()) : pick(TOPICS);
        sysLog('VOTE', `called on ${topic}`, true);
        core.pulse = 1.4;
        waves.push({ x: L.cx, y: L.cy, r: L.coreR, max: L.coreR * 4, life: 1, color: COL.cyan });
        agents.forEach((a, i) => after(0.1 + i * 0.09, () => {
            cogitate(a, 1.5, 'weighing the vote');
            vote(a, topic, 0.9);
        }));
    }

    function signalAt(wx, wy) {
        waves.push({ x: wx, y: wy, r: 4, max: 160, life: 1, color: COL.cyan });
        let near = agents[0], nd = Infinity;
        for (const b of agents) { const d = dist2(b.x, b.y, wx, wy); if (d < nd) { nd = d; near = b; } }
        const sig = `anomaly @ ${Math.round(wx)},${Math.round(wy)}`;
        sysLog('SIGNAL', `${sig} → ${near.name} investigating`, true);
        cogitate(near, 3, 'investigating signal');
        after(1.2, () => send(near, near === byName.ORACLE ? byName.STRATEGIST : byName.ORACLE, 'EVIDENCE', sig));
        after(1.6, () => send(near, near === byName.CRITIC ? byName.MEMORY : byName.CRITIC, 'QUERY', sig));
    }

    // ---------------------------------------------------------------- plans
    function newPlan(objective) {
        if (plan && !plan.doneAt) {
            for (const task of plan.tasks) if (task.owner.task === task) task.owner.task = null;
        }
        const name = `OPERATION ${pick(ADJ)} ${pick(NOUN)}`.toUpperCase();
        const stages = randi(4, 5);
        const used = new Set();
        const tasks = [];
        let order = 0;
        for (let s = 0; s < stages; s++) {
            const phase = s === 0 ? 0 : s === stages - 1 ? 2 : 1;
            const count = s === 0 || s === stages - 1 ? randi(1, 2) : randi(2, 3);
            const pool = TASKS.filter((x) => x[2] === phase && !used.has(x[0]));
            for (let k = 0; k < count && pool.length; k++) {
                const [tname, owner] = pool.splice((Math.random() * pool.length) | 0, 1)[0];
                used.add(tname);
                tasks.push({ name: tname, owner: byName[owner], stage: s, idx: k, count: 0, deps: [], kids: 0, boost: 0,
                    progress: 0, state: 'pending', rate: rand(0.1, 0.2), revealAt: 0.4 + order++ * 0.22, label: '', lw: 0, rect: null });
            }
        }
        for (let s = 0; s < stages; s++) {
            const st = tasks.filter((x) => x.stage === s);
            st.forEach((x, k) => { x.idx = k; x.count = st.length; });
            if (s === 0) continue;
            const prev = tasks.filter((x) => x.stage === s - 1);
            st.forEach((x) => {
                x.deps = prev.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(prev.length, randi(1, 2)));
                x.deps.forEach((d) => d.kids++);
            });
            prev.filter((d) => d.kids === 0).forEach((d) => { const x = pick(st); x.deps.push(d); d.kids++; });
        }
        plan = { seq: ++planSeq, name, objective: objective || '', tasks, stages, born: t, doneAt: 0, done: 0 };
        cogitate(planner, 3, objective ? 'planning: ' + objective : 'laying plan: ' + name.toLowerCase().replace('operation ', 'op. '));
        planner.flash = 1;
        sysLog('PLAN', `${name} drafted${objective ? ` for "${objective}"` : ''} · ${tasks.length} tasks · ${stages} stages`);
        after(0.8, () => send(planner, byName.CRITIC, 'REVIEW', name.toLowerCase()));
        after(1.2, () => send(planner, core, 'REGISTER', name.toLowerCase()));
    }

    function giveObjective(text) {
        sysLog('OBJECTIVE', `"${text}"`, true);
        toast(`OBJECTIVE RECEIVED · ${text}`);
        if (plan && !plan.doneAt) sysLog('REPRIORITISE', `${plan.name} shelved for the new objective`);
        cogitate(planner, 3, 'decomposing: ' + text);
        planner.flash = 1;
        waves.push({ x: planner.x, y: planner.y, r: L.agentR, max: L.agentR * 8, life: 1, color: COL.amber });
        send(core, planner, 'OBJECTIVE', text);
        after(0.7, () => send(planner, byName.ORACLE, 'QUERY', `odds: ${text}`));
        after(0.9, () => send(planner, byName.MEMORY, 'QUERY', `precedents: ${text}`));
        after(1.6, () => newPlan(text));
        after(2.6, () => dialogue(byName.STRATEGIST, byName.CRITIC, 3, text));
    }

    function prioritise(task) {
        if (task.state === 'done') { toast(`${task.name} is already done`); return; }
        task.rate = Math.min(0.9, task.rate * 2.5);
        task.boost = 1;
        task.owner.flash = 1;
        sysLog('PRIORITY', `${task.name} escalated · ${task.owner.name} on it`, true);
        send(planner, task.owner, 'ESCALATE', task.name);
    }

    function updatePlan(dt) {
        if (!plan) return;
        const age = t - plan.born;
        const ready = age > plan.tasks.length * 0.22 + 1.2;
        const current = plan;
        let done = 0;
        for (const task of plan.tasks) {
            task.boost = Math.max(0, task.boost - dt * 0.8);
            if (task.state === 'pending' && ready && task.deps.every((d) => d.state === 'done')) {
                task.state = 'delegating';
                send(planner, task.owner, 'DELEGATE', task.name, () => {
                    if (plan !== current) return; // shelved meanwhile
                    task.state = 'active';
                    task.owner.task = task;
                    cogitate(task.owner, 2, task.name);
                });
            } else if (task.state === 'active') {
                task.progress += task.rate * dt;
                const o = task.owner;
                if (!o.task) o.task = task;
                if (o.task === task) { o.thinking = true; o.busyUntil = t + 0.5; setThought(o, task.name); }
                if (Math.random() < dt * 0.25) send(o, pick(agents), pick(['SYNC', 'QUERY', 'HANDOFF']), task.name);
                if (task.progress >= 1) {
                    task.progress = 1;
                    task.state = 'done';
                    if (o.task === task) o.task = plan.tasks.find((x) => x.state === 'active' && x.owner === o) || null;
                    stats.tokens += randi(200000, 900000);
                    send(o, core, 'RESULT', task.name, () => {
                        if (core.consensus < 1) core.consensus = Math.min(0.98, core.consensus + 0.05);
                        core.pulse = 1;
                    });
                }
            }
            if (task.state === 'done') done++;
        }
        plan.done = done;
        if (done === plan.tasks.length && !plan.doneAt) {
            plan.doneAt = t;
            stats.plans++;
            sysLog('EXECUTED', `${plan.objective ? `"${plan.objective}"` : plan.name} complete · ahead of schedule by ${randi(2, 19)} days`);
            toast(`${plan.objective ? plan.objective.toUpperCase() : plan.name} · EXECUTED`);
            waves.push({ x: L.cx, y: L.planTop + L.planH / 2, r: 10, max: W * 0.5, life: 1, color: COL.amber });
            addInsight();
            const seq = plan.seq;
            after(3.2, () => { if (plan && plan.seq === seq) newPlan(); });
        }
    }

    // ---------------------------------------------------------------- background neural net
    function buildNet() {
        const sizes = L.compact ? [4, 6, 7, 6, 4] : [6, 9, 12, 14, 12, 9, 6];
        net = { layers: [], edges: [], pulses: [], nextFire: 0, nextBack: 3 };
        const x0 = W * 0.04, x1 = W * 0.96, y0 = H * 0.1, y1 = H * 0.93;
        sizes.forEach((n, li) => {
            const x = lerp(x0, x1, li / (sizes.length - 1));
            const layer = [];
            for (let j = 0; j < n; j++) {
                layer.push({ x: x + rand(-14, 14), y: lerp(y0, y1, (j + 0.5) / n) + rand(-10, 10),
                    act: 0, grad: 0, ref: 0, li, out: [], inn: [] });
            }
            net.layers.push(layer);
        });
        for (let li = 0; li < net.layers.length - 1; li++) {
            const next = net.layers[li + 1];
            for (const a of net.layers[li]) {
                for (const b of next.slice().sort(() => Math.random() - 0.5).slice(0, randi(3, 4))) {
                    const e = { a, b, w: rand(0.2, 1) };
                    net.edges.push(e);
                    a.out.push(e);
                    b.inn.push(e);
                }
            }
        }
        netCanvas = document.createElement('canvas');
        netCanvas.width = Math.round(W * DPR);
        netCanvas.height = Math.round(H * DPR);
        const g = netCanvas.getContext('2d');
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        g.lineWidth = 0.7;
        for (const e of net.edges) {
            g.strokeStyle = rgba('#5d8fff', 0.035 + 0.05 * e.w);
            g.beginPath();
            g.moveTo(e.a.x, e.a.y);
            g.lineTo(e.b.x, e.b.y);
            g.stroke();
        }
        g.fillStyle = rgba('#8fb8ff', 0.22);
        for (const layer of net.layers) for (const n of layer) { g.beginPath(); g.arc(n.x, n.y, 1.8, 0, TAU); g.fill(); }
    }

    function fire(node) {
        if (t < node.ref) return;
        node.act = 1;
        node.ref = t + 0.35;
        if (node.li === net.layers.length - 1) { stats.thoughtTimes.push(t); return; }
        for (const e of node.out) {
            if (Math.random() < 0.5 && net.pulses.length < 240) net.pulses.push({ e, k: 0, v: rand(0.7, 1.3), back: false });
        }
    }

    function backprop(node, depth) {
        node.grad = 1;
        if (depth > 6) return;
        for (const e of node.inn) {
            if (Math.random() < 0.45 && net.pulses.length < 260) net.pulses.push({ e, k: 0, v: rand(0.9, 1.4), back: true, depth });
        }
    }

    function updateNet(dt) {
        net.nextFire -= dt;
        if (net.nextFire <= 0) { net.nextFire = rand(0.12, 0.35); fire(pick(net.layers[0])); }
        net.nextBack -= dt;
        if (net.nextBack <= 0) {
            net.nextBack = rand(3, 6);
            stats.epoch++;
            backprop(pick(net.layers[net.layers.length - 1]), 0);
        }
        for (const layer of net.layers) for (const n of layer) {
            n.act = Math.max(0, n.act - dt * 1.3);
            n.grad = Math.max(0, n.grad - dt * 1.1);
        }
        for (let i = net.pulses.length - 1; i >= 0; i--) {
            const p = net.pulses[i];
            p.k += p.v * dt;
            if (p.k >= 1) {
                net.pulses.splice(i, 1);
                if (p.back) backprop(p.e.a, (p.depth || 0) + 1);
                else {
                    const b = p.e.b;
                    b.act = Math.min(1, b.act + 0.55 * p.e.w + 0.2);
                    if (b.act > 0.7) fire(b);
                }
            }
        }
    }

    // ---------------------------------------------------------------- layout
    // Fits the scene into whatever the HUD leaves free, so it fills the screen in fullscreen and with the HUD hidden.
    function layout() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';

        const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 11;
        L.s = rootPx / 11;
        const panel = $('panel-right');
        panelsOn = !hudOff && panel.offsetWidth > 0;
        const side = panelsOn ? W - panel.getBoundingClientRect().left + 14 * L.s : 0;
        L.compact = W < 720;
        L.agentR = L.compact ? 19 : clamp(Math.min(W, H) * 0.03, 22, 56);
        L.left = side;
        L.right = W - side;
        const availW = L.right - L.left;
        L.cx = W / 2;
        L.planTop = ($('topbar').offsetHeight || 52) + 30 * L.s;
        L.planH = L.compact ? 70 : clamp(H * 0.13, 84, 124 * L.s);
        const halfPlan = Math.min(availW * 0.46, 480 * L.s);
        L.planL = L.cx - halfPlan;
        L.planR = L.cx + halfPlan;
        const cmdTop = $('cmd').getBoundingClientRect().top || H - 90;
        const ringTop = L.planTop + L.planH + L.agentR * 1.7 + 22 * L.s;
        const ringBottom = cmdTop - 12 - L.agentR * 1.62 - (L.compact ? 22 : 38) * L.s;
        L.ry = Math.max(70, (ringBottom - ringTop) / 2);
        L.cy = ringTop + L.ry;
        L.rx = Math.max(100, Math.min(availW * 0.5 - L.agentR - (L.compact ? 40 : 100 * L.s), L.ry * 2.1));
        L.coreR = clamp(Math.min(L.rx, L.ry) * 0.36, 30, 140 * L.s);
        core.x = L.cx;
        core.y = L.cy;

        bgGrad = ctx.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, Math.max(W, H) * 0.75);
        bgGrad.addColorStop(0, '#0b1a36');
        bgGrad.addColorStop(0.45, '#060d1d');
        bgGrad.addColorStop(1, '#02040a');

        buildNet();
        dust.length = 0;
        for (let i = 0; i < (L.compact ? 40 : 90); i++) {
            dust.push({ x: rand(0, W), y: rand(0, H), r: rand(0.4, 1.4), a: rand(0.1, 0.5), v: rand(3, 12) });
        }
        for (const a of agents) { homeOf(a); if (Number.isNaN(a.x)) { a.x = a.hx; a.y = a.hy; } }
        clampCam();
        sizeChart(curveCv);
        sizeChart(sparkCv);
    }

    function clampCam() {
        cam.z = clamp(cam.z, ZMIN, ZMAX);
        cam.x = clamp(cam.x, W * 0.1 - L.cx * cam.z, W * 0.9 - L.cx * cam.z);
        cam.y = clamp(cam.y, H * 0.1 - L.cy * cam.z, H * 0.9 - L.cy * cam.z);
    }
    function zoomAt(sx, sy, z) {
        const w = toWorld(sx, sy);
        cam.z = clamp(z, ZMIN, ZMAX);
        cam.x = sx - w.x * cam.z;
        cam.y = sy - w.y * cam.z;
        clampCam();
    }
    function resetView() { cam.x = 0; cam.y = 0; cam.z = 1; }

    // ---------------------------------------------------------------- update
    // Runs every frame, even when paused, so dragged agents follow the pointer.
    function moveAgents(raw) {
        for (const a of agents) {
            homeOf(a);
            const tx = a.drag ? a.drag.x : a.hx, ty = a.drag ? a.drag.y : a.hy;
            const k = Math.min(1, raw * (a.drag ? 18 : 4));
            a.x += (tx - a.x) * k;
            a.y += (ty - a.y) * k;
        }
    }

    function update(dt) {
        for (let i = timers.length - 1; i >= 0; i--) {
            if (timers[i].at <= t) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
        }

        for (const a of agents) {
            a.flash = Math.max(0, a.flash - dt * 1.6);
            a.think += ((a.thinking ? 1 : 0) - a.think) * Math.min(1, dt * 3);
            a.spin += dt * (0.4 + a.think * 2.4);
            a.shown = Math.min(a.thought.length, a.shown + dt * 40);
            a.load = lerp(a.load, a.thinking ? 0.92 : 0.25, dt * 0.6);
            for (const layer of a.mini) for (const m of layer) {
                const target = a.think * (0.5 + 0.5 * Math.sin(t * m.f + m.ph)) * (Math.random() < 0.97 ? 1 : 0.2);
                m.a += (target - m.a) * Math.min(1, dt * 10);
            }
            if (a.thinking && Math.random() < dt * (reduceMotion ? 1.2 : 3.5) * a.think) emitToken(a);
            if (a.thinking && !a.task && t > a.busyUntil) { a.thinking = false; setThought(a, pick(IDLE)); }
            a.nextAct -= dt;
            if (a.nextAct <= 0) {
                a.nextAct = rand(2.5, 7) * (a.task ? 1.8 : 1) * (agents.length / 9);
                if (Math.random() < 0.42) cogitate(a, rand(2, 5));
                else {
                    let b = pick(agents);
                    if (b === a) b = agents[(a.i + 1) % agents.length];
                    dialogue(a, b, randi(2, 4));
                }
            }
        }

        core.rot += dt * 0.22;
        core.pulse = Math.max(0, core.pulse - dt * 1.4);
        if (Math.random() < dt * 8) core.pts[(Math.random() * core.pts.length) | 0].lit = 1;
        for (const p of core.pts) p.lit = Math.max(0, p.lit - dt * 1.5);

        updateNet(dt);

        for (let i = packets.length - 1; i >= 0; i--) {
            const p = packets[i];
            p.k += dt / p.dur;
            if (p.k >= 1) {
                packets.splice(i, 1);
                p.to.flash = 1;
                stats.msgTimes.push(t);
                stats.tokens += randi(800, 6000);
                logMsg(p.from, p.to, p.kind, p.detail);
                if (p.onArrive) p.onArrive();
            }
        }
        for (const [k, l] of links) { l.s -= dt * 0.07; if (l.s <= 0) links.delete(k); }

        for (let i = tokens.length - 1; i >= 0; i--) {
            const tk = tokens[i];
            tk.x += tk.vx * dt; tk.y += tk.vy * dt; tk.life -= dt * 0.5;
            if (tk.life <= 0) tokens.splice(i, 1);
        }
        for (let i = waves.length - 1; i >= 0; i--) {
            const w = waves[i];
            w.r += (w.max - w.r) * dt * 1.6 + dt * 40;
            w.life -= dt * 0.75;
            if (w.life <= 0) waves.splice(i, 1);
        }
        for (const d of dust) { d.y -= d.v * dt; if (d.y < -4) { d.y = H + 4; d.x = rand(0, W); } }

        updatePlan(dt);
        curve.p += dt * 1.6;
        stats.tokens += dt * rand(30000, 60000) * (0.6 + agents.filter((a) => a.thinking).length / agents.length);
        stats.lead = lerp(stats.lead, 14 + Math.sin(t * 0.07) * 3 + core.consensus * 2, dt * 0.5);
    }

    function emitToken(a) {
        if (tokens.length > 160) return;
        const ang = rand(0, TAU);
        tokens.push({
            x: a.x + Math.cos(ang) * L.agentR * 0.9, y: a.y + Math.sin(ang) * L.agentR * 0.9,
            vx: Math.cos(ang) * rand(6, 18) * L.s, vy: (Math.sin(ang) * rand(6, 18) - 10) * L.s,
            life: 1, text: pick(TOKENS), color: a.color,
        });
    }

    // ---------------------------------------------------------------- draw
    function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);
        drawFloor();
        drawDust();
        ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * cam.x, DPR * cam.y);
        drawNet();
        drawLinks();
        drawPlan();
        drawCore();
        drawPackets();
        drawDrag();
        for (const a of agents) drawAgent(a);
        drawTokens();
        drawWaves();
    }

    function drawFloor() {
        const hz = H * 0.6;
        const vx = L.cx + mouse.px * 24;
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(COL.blue, 0.06);
        ctx.beginPath();
        for (let i = -16; i <= 16; i++) {
            ctx.moveTo(vx + i * 5, hz);
            ctx.lineTo(vx + i * W * 0.085, H);
        }
        ctx.stroke();
        const off = (t * 0.22) % 1;
        for (let k = 0; k < 14; k++) {
            const z = (k + off) / 14;
            const y = hz + (H - hz) * z * z;
            ctx.strokeStyle = rgba(COL.blue, 0.015 + 0.085 * z);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    }

    function drawDust() {
        for (const d of dust) {
            ctx.fillStyle = rgba('#9cc4ff', d.a);
            ctx.fillRect(d.x + mouse.px * -6 * d.r, d.y, d.r, d.r);
        }
    }

    function drawNet() {
        const ox = mouse.px * -16, oy = mouse.py * -10;
        ctx.drawImage(netCanvas, ox, oy, W, H);
        ctx.globalCompositeOperation = 'lighter';
        for (const layer of net.layers) for (const n of layer) {
            if (n.act > 0.02) glow(n.x + ox, n.y + oy, 8 + 16 * n.act, COL.blue, n.act * 0.7);
            if (n.grad > 0.02) glow(n.x + ox, n.y + oy, 8 + 14 * n.grad, COL.magenta, n.grad * 0.55);
        }
        for (const p of net.pulses) {
            const a = p.back ? p.e.b : p.e.a, b = p.back ? p.e.a : p.e.b;
            glow(lerp(a.x, b.x, p.k) + ox, lerp(a.y, b.y, p.k) + oy, 7, p.back ? COL.magenta : COL.cyan, 0.75);
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawLinks() {
        ctx.lineWidth = 1;
        for (const l of links.values()) {
            const c = ctrlPoint(l.a, l.b);
            ctx.strokeStyle = rgba(l.a === core ? l.b.color : l.a.color, 0.03 + 0.16 * l.s);
            ctx.beginPath();
            ctx.moveTo(l.a.x, l.a.y);
            ctx.quadraticCurveTo(c.x, c.y, l.b.x, l.b.y);
            ctx.stroke();
        }
    }

    function hudBrackets(x0, y0, x1, y1, color, a) {
        const s = 10 * L.s;
        ctx.strokeStyle = rgba(color, a);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0 + s); ctx.lineTo(x0, y0); ctx.lineTo(x0 + s, y0);
        ctx.moveTo(x1 - s, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + s);
        ctx.moveTo(x1, y1 - s); ctx.lineTo(x1, y1); ctx.lineTo(x1 - s, y1);
        ctx.moveTo(x0 + s, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - s);
        ctx.stroke();
    }

    function fitText(text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        let s = text;
        while (s.length > 3 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
        return s + '…';
    }

    function taskPos(task) {
        const colW = (L.planR - L.planL) / plan.stages;
        const bodyTop = L.planTop + 8 * L.s;
        const bodyH = L.planH - 8 * L.s;
        return { x: L.planL + colW * (task.stage + 0.5), y: bodyTop + bodyH * ((task.idx + 0.5) / task.count) };
    }

    function drawPlan() {
        if (!plan) return;
        let alpha = 1;
        if (plan.doneAt) alpha = clamp(1 - (t - plan.doneAt - 2.2) / 0.9, 0, 1);
        if (alpha <= 0) { plan.tasks.forEach((x) => { x.rect = null; }); return; }
        ctx.globalAlpha = alpha;
        const age = t - plan.born;
        const x0 = L.planL - 14 * L.s, x1 = L.planR + 14 * L.s, y0 = L.planTop - 26 * L.s, y1 = L.planTop + L.planH + 8 * L.s;
        ctx.fillStyle = 'rgba(5,11,22,0.45)';
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        hudBrackets(x0, y0, x1, y1, COL.amber, 0.7);

        ctx.font = font(L.compact ? 9 : 10, '700');
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillStyle = rgba(COL.white, 0.6);
        const status = plan.doneAt ? 'EXECUTED ✓' : `${plan.done}/${plan.tasks.length} TASKS`;
        ctx.fillText(status, x1 - 12 * L.s, y0 + 12 * L.s);
        const statusW = ctx.measureText(status).width + 36 * L.s;
        ctx.textAlign = 'left';
        ctx.fillStyle = COL.amber;
        const title = plan.objective ? `MISSION // ${plan.objective.toUpperCase()}`
            : (L.compact ? plan.name.replace('OPERATION ', 'OP. ') : 'MISSION PLAN // ' + plan.name);
        ctx.fillText(fitText(title, x1 - x0 - statusW), x0 + 12 * L.s, y0 + 12 * L.s);

        const colW = (L.planR - L.planL) / plan.stages;
        const nw = Math.min(124 * L.s, colW - 18 * L.s);
        const nh = (L.compact ? 14 : 20) * L.s;
        const showText = nw >= 70;
        ctx.font = font(L.compact ? 8 : 10);

        ctx.lineWidth = 1.2;
        for (const task of plan.tasks) {
            const rv = clamp((age - task.revealAt) / 0.4, 0, 1);
            if (rv <= 0) continue;
            const p = taskPos(task);
            for (const d of task.deps) {
                const q = taskPos(d);
                const sx = q.x + nw / 2, ex = p.x - nw / 2;
                const live = d.state === 'done' && task.state !== 'pending' && task.state !== 'done';
                ctx.strokeStyle = d.state === 'done' ? rgba(COL.green, live ? 0.75 : 0.35) : rgba('#7fa6d9', 0.3);
                ctx.setLineDash(live ? [4, 5] : []);
                ctx.lineDashOffset = -t * 30;
                ctx.beginPath();
                ctx.moveTo(sx, q.y);
                const ex2 = lerp(sx, ex, rv), ey2 = lerp(q.y, p.y, rv);
                ctx.bezierCurveTo(sx + 18, q.y, ex2 - 18, ey2, ex2, ey2);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);

        for (const task of plan.tasks) {
            const rv = clamp((age - task.revealAt) / 0.4, 0, 1);
            if (rv <= 0) { task.rect = null; continue; }
            const p = taskPos(task);
            const c = task.owner.color;
            const x = p.x - nw / 2, y = p.y - nh / 2;
            task.rect = { x, y, w: nw, h: nh };
            const isHover = hovered && hovered.obj === task;
            ctx.globalAlpha = alpha * rv;
            ctx.fillStyle = isHover ? 'rgba(20,34,58,0.95)' : 'rgba(6,12,24,0.9)';
            ctx.fillRect(x, y, nw, nh);
            if (task.progress > 0) {
                ctx.fillStyle = rgba(task.state === 'done' ? COL.green : c, task.state === 'done' ? 0.2 : 0.32);
                ctx.fillRect(x, y, nw * task.progress, nh);
            }
            ctx.strokeStyle = task.state === 'done' ? COL.green : task.state === 'pending' ? '#4d6588' : c;
            ctx.lineWidth = task.state === 'active' || isHover ? 1.8 : 1;
            ctx.strokeRect(x + 0.5, y + 0.5, nw - 1, nh - 1);
            ctx.globalCompositeOperation = 'lighter';
            if (task.state === 'active') glow(x + nw * task.progress, p.y, 12 * L.s, c, 0.6);
            if (task.boost > 0) glow(p.x, p.y, nw * 0.8, c, task.boost * 0.6);
            ctx.globalCompositeOperation = 'source-over';
            if (showText) {
                if (task.lw !== nw) {
                    task.label = fitText(task.name, nw - 10 * L.s - ctx.measureText('✓ ').width);
                    task.lw = nw;
                }
                ctx.textAlign = 'center';
                ctx.fillStyle = task.state === 'pending' ? '#7e95b8' : '#eaf6ff';
                const mark = task.state === 'done' ? '✓ ' : task.rate > 0.4 ? '» ' : '';
                ctx.fillText(mark + task.label, p.x, p.y + 0.5);
            }
            if (task.state === 'active') {
                ctx.strokeStyle = rgba(c, 0.18);
                ctx.setLineDash([2, 6]);
                ctx.lineDashOffset = t * 20;
                ctx.beginPath();
                ctx.moveTo(p.x, y + nh);
                ctx.lineTo(task.owner.x, task.owner.y - L.agentR * 1.4);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        ctx.globalAlpha = 1;
        ctx.textBaseline = 'alphabetic';
    }

    function drawCore() {
        const { cx, cy } = L;
        const R = L.coreR * (1 + 0.07 * core.pulse + 0.025 * Math.sin(t * 2));
        const hot = hovered && hovered.kind === 'core';
        ctx.globalCompositeOperation = 'lighter';
        glow(cx, cy, R * 3, COL.blue, 0.28 + 0.3 * core.pulse + (hot ? 0.15 : 0));
        glow(cx, cy, R * 1.3, COL.cyan, 0.18 + 0.25 * core.consensus);

        const ry = core.rot, rx = 0.45 + Math.sin(t * 0.13) * 0.15;
        const cyr = Math.cos(ry), syr = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx);
        for (const p of core.pts) {
            const x1 = p.x * cyr + p.z * syr;
            const z1 = -p.x * syr + p.z * cyr;
            const y2 = p.y * cxr - z1 * sxr;
            const z2 = p.y * sxr + z1 * cxr;
            p.sx = cx + x1 * R;
            p.sy = cy + y2 * R;
            p.d = (z2 + 1) / 2;
        }
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = rgba(COL.cyan, 0.16);
        ctx.beginPath();
        for (const [i, j] of core.pairs) {
            const a = core.pts[i], b = core.pts[j];
            if (a.d < 0.45 || b.d < 0.45) continue;
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
        }
        ctx.stroke();
        const ps = Math.max(1, L.s * 0.9);
        for (const p of core.pts) {
            const s = (0.6 + p.d * 1.8) * ps;
            if (p.lit > 0.05) glow(p.sx, p.sy, 6 + 8 * p.lit, COL.green, p.lit * p.d);
            ctx.fillStyle = rgba(p.lit > 0.3 ? COL.green : '#bfefff', 0.12 + 0.75 * p.d);
            ctx.fillRect(p.sx - s / 2, p.sy - s / 2, s, s);
        }
        ctx.globalCompositeOperation = 'source-over';

        for (let k = 0; k < 3; k++) {
            const tilt = k * 1.05 + t * 0.05;
            const rr = R * (1.35 + k * 0.17);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(tilt);
            ctx.scale(1, 0.32);
            ctx.strokeStyle = rgba(k === 1 ? COL.violet : COL.cyan, 0.22);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, rr, 0, TAU);
            ctx.stroke();
            ctx.restore();
            const sa = t * (0.6 + k * 0.25) + k * 2;
            const sx = Math.cos(sa) * rr, sy = Math.sin(sa) * rr * 0.32;
            ctx.globalCompositeOperation = 'lighter';
            glow(cx + sx * Math.cos(tilt) - sy * Math.sin(tilt), cy + sx * Math.sin(tilt) + sy * Math.cos(tilt), 9 * L.s,
                k === 1 ? COL.violet : COL.cyan, 0.9);
            ctx.globalCompositeOperation = 'source-over';
        }

        const gr = R * 1.18;
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(COL.cyan, hot ? 0.6 : 0.25);
        ctx.beginPath();
        for (let i = 0; i < 48; i++) {
            const a = (i / 48) * TAU + (hot ? t * 0.5 : 0);
            const l = (i % 4 === 0 ? 6 : 3) * L.s;
            ctx.moveTo(cx + Math.cos(a) * gr, cy + Math.sin(a) * gr);
            ctx.lineTo(cx + Math.cos(a) * (gr + l), cy + Math.sin(a) * (gr + l));
        }
        ctx.stroke();
        ctx.lineWidth = 2.5 * L.s;
        ctx.strokeStyle = rgba(COL.green, 0.85);
        ctx.beginPath();
        ctx.arc(cx, cy, gr - 4 * L.s, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, core.consensus));
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = font(L.compact ? 9 : 10, '700');
        ctx.fillStyle = rgba(COL.cyan, 0.85);
        ctx.fillText('CONSENSUS CORE', cx, cy + gr + 22 * L.s);
        ctx.font = font(L.compact ? 9 : 10);
        ctx.fillStyle = rgba(COL.white, 0.7);
        ctx.fillText(`${Math.round(Math.min(1, core.consensus) * 100)}% aligned`, cx, cy + gr + 36 * L.s);
    }

    function drawPackets() {
        ctx.lineCap = 'round';
        const labels = !L.compact && packets.length < 20;
        for (const p of packets) {
            const e = ease(p.k);
            const c = ctrlPoint(p.from, p.to);
            const tail = 0.14;
            let prev = qpt(p.from, c, p.to, Math.max(0, e - tail));
            ctx.lineWidth = 2 * Math.max(1, L.s * 0.85);
            for (let k = 1; k <= 8; k++) {
                const pt = qpt(p.from, c, p.to, clamp(e - tail + (tail * k) / 8, 0, 1));
                ctx.strokeStyle = rgba(p.color, (k / 8) * 0.8);
                ctx.beginPath();
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(pt.x, pt.y);
                ctx.stroke();
                prev = pt;
            }
            ctx.globalCompositeOperation = 'lighter';
            glow(prev.x, prev.y, 16 * L.s, p.color, 0.95);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#fff';
            ctx.fillRect(prev.x - 1.5, prev.y - 1.5, 3, 3);
            if (labels) {
                ctx.font = font(9, '700');
                ctx.textAlign = 'left';
                ctx.fillStyle = rgba(p.color, 0.95 * (1 - Math.abs(e - 0.5) * 1.6));
                ctx.fillText(p.kind, prev.x + 9 * L.s, prev.y - 7 * L.s);
            }
        }
        ctx.lineCap = 'butt';
    }

    function dropTarget(a) {
        if (!a || !a.drag) return null;
        let best = null, bd = (L.agentR * 1.8) ** 2;
        for (const b of agents) {
            if (b === a) continue;
            const d = dist2(b.x, b.y, a.x, a.y);
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    }

    function drawDrag() {
        if (!gesture || gesture.type !== 'agent' || !gesture.moved) return;
        const a = gesture.agent;
        ctx.strokeStyle = rgba(a.color, 0.35);
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.hx, a.hy);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const b = dropTarget(a);
        ctx.textAlign = 'center';
        ctx.font = font(10, '700');
        if (b) {
            ctx.strokeStyle = rgba(b.color, 0.9);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, L.agentR * 2.1 + Math.sin(t * 8) * 2, 0, TAU);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.fillText(`RELEASE: ${a.name} ⇄ ${b.name}`, b.x, b.y - L.agentR * 2.4);
        } else {
            ctx.fillStyle = rgba(a.color, 0.8);
            ctx.fillText('DROP ON AN AGENT TO CONNECT', a.x, a.y - L.agentR * 2.2);
        }
    }

    function drawAgent(a) {
        const r = L.agentR;
        const { x, y, color } = a;
        const hot = (hovered && hovered.obj === a) || a.drag;
        const lw = Math.max(1, L.s * 0.85);
        ctx.globalCompositeOperation = 'lighter';
        glow(x, y, r * 3.4, color, 0.14 + 0.22 * a.think + 0.45 * a.flash + (hot ? 0.25 : 0));
        ctx.globalCompositeOperation = 'source-over';

        ctx.lineWidth = 1.3 * lw;
        for (let k = 0; k < 3; k++) {
            const start = a.spin * (k % 2 ? -1.3 : 1) + k * 2.1;
            ctx.strokeStyle = rgba(color, 0.35 + 0.45 * a.think);
            ctx.beginPath();
            ctx.arc(x, y, r * 1.3 + k * 3.5 * L.s, start, start + 0.7 + 0.9 * a.think);
            ctx.stroke();
        }

        ctx.beginPath();
        for (let j = 0; j < 6; j++) {
            const ang = (j * Math.PI) / 3 + Math.PI / 6 + a.spin * 0.08;
            const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
            if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(4,9,19,0.92)';
        ctx.fill();
        ctx.strokeStyle = rgba(color, 0.65 + 0.35 * Math.max(a.think, a.flash, hot ? 1 : 0));
        ctx.lineWidth = 1.6 * lw;
        ctx.stroke();

        // a tiny neural net inside each agent
        const m = r * 0.58;
        const cols = a.mini.length;
        const pos = a.mini.map((layer, li) => layer.map((_, j) => ({
            x: x + lerp(-m, m, li / (cols - 1)),
            y: y + lerp(-m * 0.75, m * 0.75, layer.length === 1 ? 0.5 : j / (layer.length - 1)),
        })));
        ctx.lineWidth = 0.6 * lw;
        for (let li = 0; li < cols - 1; li++) {
            for (let i = 0; i < pos[li].length; i++) {
                for (let j = 0; j < pos[li + 1].length; j++) {
                    const s = (a.mini[li][i].a + a.mini[li + 1][j].a) / 2;
                    ctx.strokeStyle = rgba(color, 0.12 + 0.5 * s);
                    ctx.beginPath();
                    ctx.moveTo(pos[li][i].x, pos[li][i].y);
                    ctx.lineTo(pos[li + 1][j].x, pos[li + 1][j].y);
                    ctx.stroke();
                }
            }
        }
        const nr = r / 26;
        for (let li = 0; li < cols; li++) {
            for (let i = 0; i < pos[li].length; i++) {
                const act = a.mini[li][i].a;
                ctx.fillStyle = act > 0.5 ? '#ffffff' : rgba(color, 0.4 + act);
                ctx.beginPath();
                ctx.arc(pos[li][i].x, pos[li][i].y, (1.3 + act * 1.4) * nr, 0, TAU);
                ctx.fill();
            }
        }

        const pr = r * 1.62 + 6 * L.s;
        if (a.task) {
            ctx.lineWidth = 2.5 * L.s;
            ctx.strokeStyle = rgba(color, 0.2);
            ctx.beginPath();
            ctx.arc(x, y, pr, 0, TAU);
            ctx.stroke();
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, pr, -Math.PI / 2, -Math.PI / 2 + TAU * a.task.progress);
            ctx.stroke();
        }

        const ly = y + pr + 14 * L.s;
        ctx.textAlign = 'center';
        ctx.font = font(L.compact ? 9 : 11, '700');
        ctx.fillStyle = color;
        ctx.fillText(a.name, x, ly);
        if (!L.compact) {
            ctx.font = font(10);
            ctx.fillStyle = rgba('#cfe3ff', a.thinking ? 0.85 : 0.45);
            const typing = a.shown < a.thought.length;
            const cursor = typing || (a.thinking && ((t * 2.5) | 0) % 2 === 0) ? '▍' : ' ';
            ctx.fillText(a.thought.slice(0, a.shown | 0) + cursor, x, ly + 14 * L.s);
        }
    }

    function drawTokens() {
        ctx.textAlign = 'center';
        ctx.font = font(10);
        for (const tk of tokens) {
            ctx.fillStyle = rgba(tk.color, Math.max(0, tk.life) * 0.8);
            ctx.fillText(tk.text, tk.x, tk.y);
        }
    }

    function drawWaves() {
        for (const w of waves) {
            ctx.strokeStyle = rgba(w.color, Math.max(0, w.life) * 0.5);
            ctx.lineWidth = 1 + w.life * 2;
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.r, 0, TAU);
            ctx.stroke();
        }
    }

    // ---------------------------------------------------------------- side charts
    const curveCv = $('curve');
    const sparkCv = $('spark');
    const curve = { vals: [], m: 0, p: 70, lo: 40, hi: 60 };
    const spark = { vals: new Array(60).fill(0), next: 0 };

    function sizeChart(cv) {
        const r = cv.getBoundingClientRect();
        if (!r.width) return;
        cv.width = Math.round(r.width * DPR);
        cv.height = Math.round(r.height * DPR);
        cv.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function curveVal(i) {
        while (curve.vals.length <= i) {
            const last = curve.vals.length ? curve.vals[curve.vals.length - 1] : 50;
            curve.m = curve.m * 0.9 + rand(-1, 1) * 1.1 + (50 - last) * 0.012;
            curve.vals.push(last + curve.m);
        }
        return curve.vals[i];
    }
    const hashNoise = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };

    function drawCurve() {
        const w = curveCv.width / DPR, h = curveCv.height / DPR;
        if (!w) return;
        const g = curveCv.getContext('2d');
        g.clearRect(0, 0, w, h);
        const back = 60, ahead = 22, now = curve.p;
        const start = now - back, span = back + ahead;
        const X = (i) => ((i - start) / span) * w;
        const fc = (i) => curveVal(Math.floor(i)) + hashNoise(Math.floor(i)) * (i - now) * 0.06;

        let lo = Infinity, hi = -Infinity;
        for (let i = Math.floor(start); i <= Math.ceil(now + ahead); i++) {
            const v = curveVal(Math.max(0, i));
            lo = Math.min(lo, v); hi = Math.max(hi, v);
        }
        curve.lo = lerp(curve.lo, lo - 3, 0.08);
        curve.hi = lerp(curve.hi, hi + 3, 0.08);
        const Y = (v) => h - 10 - ((v - curve.lo) / (curve.hi - curve.lo)) * (h - 24);

        g.strokeStyle = 'rgba(80,180,255,0.07)';
        g.lineWidth = 1;
        g.beginPath();
        for (let k = 1; k < 4; k++) { g.moveTo(0, (h * k) / 4); g.lineTo(w, (h * k) / 4); }
        for (let i = Math.ceil(start / 10) * 10; i < now + ahead; i += 10) { g.moveTo(X(i), 0); g.lineTo(X(i), h); }
        g.stroke();

        const nowV = lerp(curveVal(Math.floor(now)), curveVal(Math.floor(now) + 1), now % 1);
        g.fillStyle = 'rgba(56,232,255,0.1)';
        g.beginPath();
        g.moveTo(X(now), Y(nowV));
        for (let i = Math.floor(now) + 1; i <= now + ahead; i++) g.lineTo(X(i), Y(fc(i) + 0.5 + (i - now) * 0.22));
        for (let i = Math.floor(now + ahead); i > now; i--) g.lineTo(X(i), Y(fc(i) - 0.5 - (i - now) * 0.22));
        g.closePath();
        g.fill();

        g.strokeStyle = '#38e8ff';
        g.lineWidth = 1.6;
        g.setLineDash([4, 3]);
        g.beginPath();
        g.moveTo(X(now), Y(nowV));
        for (let i = Math.floor(now) + 1; i <= now + ahead; i++) g.lineTo(X(i), Y(fc(i)));
        g.stroke();
        g.setLineDash([]);

        g.strokeStyle = '#c9d6ea';
        g.lineWidth = 1.4;
        g.beginPath();
        const first = Math.max(0, Math.floor(start));
        for (let i = first; i <= now; i++) {
            if (i === first) g.moveTo(X(i), Y(curveVal(i))); else g.lineTo(X(i), Y(curveVal(i)));
        }
        g.lineTo(X(now), Y(nowV));
        g.stroke();

        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.moveTo(X(now), 0);
        g.lineTo(X(now), h);
        g.stroke();
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(X(now), Y(nowV), 2.5, 0, TAU);
        g.fill();

        g.font = font(9);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.textAlign = 'right';
        g.fillText('NOW', X(now) - 4, 12 * L.s);
        g.textAlign = 'left';
        g.fillStyle = '#38e8ff';
        g.fillText(`+${stats.lead.toFixed(1)}d LEAD`, X(now) + 4, 12 * L.s);
    }

    function drawSpark(dt) {
        spark.next -= dt;
        if (spark.next <= 0) {
            spark.next = 0.5;
            const recent = stats.msgTimes.filter((x) => x > t - 2).length;
            spark.vals.push(recent * 6 + net.pulses.length * 0.4 + packets.length * 3);
            spark.vals.shift();
        }
        const w = sparkCv.width / DPR, h = sparkCv.height / DPR;
        if (!w) return;
        const g = sparkCv.getContext('2d');
        g.clearRect(0, 0, w, h);
        const max = Math.max(10, ...spark.vals);
        g.beginPath();
        spark.vals.forEach((v, i) => {
            const x = (i / (spark.vals.length - 1)) * w, y = h - 4 - (v / max) * (h - 10);
            if (i) g.lineTo(x, y); else g.moveTo(x, y);
        });
        g.strokeStyle = '#46ffa8';
        g.lineWidth = 1.4;
        g.stroke();
        g.lineTo(w, h);
        g.lineTo(0, h);
        g.closePath();
        g.fillStyle = 'rgba(70,255,168,0.1)';
        g.fill();
    }

    // ---------------------------------------------------------------- DOM HUD
    const logEl = $('log');
    const track = $('ticker-track');
    const tip = $('tip');
    const toastEl = $('toast');
    const cmdForm = $('cmd');
    const cmdInput = $('cmd-input');
    const helpEl = $('help');
    let lastLog = 0;

    function stamp() {
        const d = new Date();
        const p = (n, l = 2) => String(n).padStart(l, '0');
        return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
    }
    function span(cls, text, color) {
        const s = document.createElement('span');
        if (cls) s.className = cls;
        if (color) s.style.color = color;
        s.textContent = text;
        return s;
    }
    function pushLog(li) {
        logEl.appendChild(li);
        while (logEl.children.length > 60) logEl.removeChild(logEl.firstChild);
    }
    function logMsg(from, to, kind, detail) {
        if (!panelsOn) return;
        if (t - lastLog < 0.08 && kind !== 'VOTE') return; // keep the stream readable
        lastLog = t;
        const li = document.createElement('li');
        li.append(span('ts', stamp()), span('', from.name, from.color), span('', ' → '), span('', to.name, to.color),
            span('kind', kind), span('detail', detail));
        pushLog(li);
    }
    function sysLog(tag, text, fromYou) {
        const li = document.createElement('li');
        li.append(span('ts', stamp()));
        if (fromYou) li.append(span('you', 'YOU'));
        li.append(span('sys', tag), span('detail', text));
        pushLog(li);
    }

    let toastTimer = 0;
    function toast(text) {
        toastEl.textContent = text;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
    }

    // ticker of forecasts: always a step ahead
    const ticker = { x: 0, items: [] };
    function addInsight() {
        if (hudOff) return;
        stats.insights++;
        const el = document.createElement('span');
        const b = document.createElement('b');
        b.textContent = `INSIGHT #${stats.insights.toLocaleString('en-US')}`;
        el.append(b, `${pick(SUBJECTS)} ${pick(PREDICATES)} in ${randi(3, 40)} days · confidence ${rand(0.82, 0.99).toFixed(2)} · market has not priced it in`);
        track.appendChild(el);
        ticker.items.push({ el, w: el.offsetWidth || 400 });
    }
    function updateTicker(dt) {
        if (hudOff) return;
        let total = ticker.items.reduce((s, it) => s + it.w, 0);
        while (total + ticker.x < W * 1.6) { addInsight(); total += ticker.items[ticker.items.length - 1].w; }
        ticker.x -= dt * 55 * L.s;
        const first = ticker.items[0];
        if (first && -ticker.x > first.w) {
            ticker.x += first.w;
            first.el.remove();
            ticker.items.shift();
        }
        track.style.transform = `translateX(${ticker.x}px)`;
    }

    const mEls = Object.fromEntries(['agents', 'tokens', 'thoughts', 'msgs', 'consensus', 'plans', 'epoch', 'lead']
        .map((k) => [k, $('m-' + k)]));
    let metricsNext = 0;
    function updateMetrics(raw) {
        metricsNext -= raw;
        if (metricsNext > 0) return;
        metricsNext = 0.25;
        stats.msgTimes = stats.msgTimes.filter((x) => x > t - 60);
        stats.thoughtTimes = stats.thoughtTimes.filter((x) => x > t - 3);
        const span60 = Math.min(60, Math.max(5, t));
        mEls.agents.textContent = `${agents.length}/${agents.length}`;
        mEls.tokens.textContent = Math.floor(stats.tokens).toLocaleString('en-US');
        mEls.thoughts.textContent = (stats.thoughtTimes.length / 3 + agents.filter((a) => a.thinking).length * 4.2).toFixed(1);
        mEls.msgs.textContent = Math.round((stats.msgTimes.length * 60) / span60);
        mEls.consensus.textContent = Math.round(Math.min(1, core.consensus) * 100) + '%';
        mEls.plans.textContent = stats.plans;
        mEls.epoch.textContent = stats.epoch.toLocaleString('en-US');
        mEls.lead.textContent = `+${stats.lead.toFixed(1)} d`;
        const d = new Date();
        const s = Math.floor(t);
        const p = (n) => String(n).padStart(2, '0');
        const zoom = Math.abs(cam.z - 1) > 0.02 ? ` · ${cam.z.toFixed(1)}× zoom` : '';
        $('clock').textContent = `T+${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)} · ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${zoom}`;
        fillTip();
    }

    // Tooltip: content refreshes 4× a second, position every frame.
    let tipFor = null;
    function fillTip() {
        tipFor = hovered ? hovered.obj : null;
        if (!hovered || (gesture && gesture.moved)) { tip.hidden = true; return; }
        tip.hidden = false;
        tip.innerHTML = '';
        const row = (label, value) => { const d = document.createElement('div'); d.append(span('', label + ' '), span('', value, '#fff')); return d; };
        const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; return d; };
        const bar = (v) => { const d = document.createElement('div'); d.className = 'bar'; const i = document.createElement('i'); i.style.width = Math.round(v * 100) + '%'; d.append(i); return d; };
        if (hovered.kind === 'agent') {
            const a = hovered.obj;
            tip.style.setProperty('--tip', a.color);
            tip.append(div('t-name', a.name), div('t-role', a.job), row('Thinking:', a.thought),
                row('Task:', a.task ? `${a.task.name} (${Math.round(a.task.progress * 100)}%)` : 'none'),
                row('Load:', Math.round(a.load * 100) + '%'), bar(a.load), row('Trust:', a.trust.toFixed(3)),
                row('Messages sent:', String(a.sent)), div('t-hint', 'Click: broadcast · drag onto an agent: talk'));
        } else if (hovered.kind === 'task') {
            const k = hovered.obj;
            tip.style.setProperty('--tip', k.owner.color);
            tip.append(div('t-name', k.name.toUpperCase()), div('t-role', `owned by ${k.owner.name}`),
                row('State:', k.state), row('Progress:', Math.round(k.progress * 100) + '%'), bar(k.progress),
                row('Depends on:', k.deps.length ? k.deps.map((d) => d.name).join(', ') : 'nothing'),
                div('t-hint', k.state === 'done' ? 'Done' : 'Click: prioritise'));
        } else {
            tip.style.setProperty('--tip', COL.cyan);
            tip.append(div('t-name', 'CONSENSUS CORE'), div('t-role', 'Where the collective makes up its mind'),
                row('Aligned:', Math.round(Math.min(1, core.consensus) * 100) + '%'), bar(Math.min(1, core.consensus)),
                row('Plans executed:', String(stats.plans)), div('t-hint', 'Click: call a vote'));
        }
        placeTip();
    }
    function placeTip() {
        if (!hovered || tip.hidden) return;
        const o = hovered.obj;
        if (hovered.kind === 'task' && !o.rect) return;
        const wx = hovered.kind === 'task' ? o.rect.x + o.rect.w / 2 : hovered.kind === 'core' ? L.cx + L.coreR : o.x;
        const wy = hovered.kind === 'task' ? o.rect.y + o.rect.h : hovered.kind === 'core' ? L.cy : o.y;
        const p = toScreen(wx, wy);
        const tw = tip.offsetWidth || 240, th = tip.offsetHeight || 180;
        const gap = L.agentR * cam.z * 1.8;
        let x = p.x + gap;
        if (x + tw > W - 8) x = p.x - gap - tw;
        tip.style.left = clamp(x, 8, W - tw - 8) + 'px';
        tip.style.top = clamp(hovered.kind === 'task' ? p.y + 10 : p.y - th / 2, 60, H - th - 8) + 'px';
    }

    // ---------------------------------------------------------------- input
    function findAgent(wx, wy) {
        let best = null, bd = (L.agentR * 1.5) ** 2;
        for (const a of agents) {
            const d = dist2(a.x, a.y, wx, wy);
            if (d < bd) { bd = d; best = a; }
        }
        return best;
    }
    function findTask(wx, wy) {
        if (!plan) return null;
        for (const k of plan.tasks) {
            const r = k.rect;
            if (r && wx >= r.x - 3 && wx <= r.x + r.w + 3 && wy >= r.y - 3 && wy <= r.y + r.h + 3) return k;
        }
        return null;
    }
    function hitTest(sx, sy) {
        const w = toWorld(sx, sy);
        const a = findAgent(w.x, w.y);
        if (a) return { kind: 'agent', obj: a };
        const k = findTask(w.x, w.y);
        if (k) return { kind: 'task', obj: k };
        if (dist2(w.x, w.y, L.cx, L.cy) < (L.coreR * 1.2) ** 2) return { kind: 'core', obj: core };
        return null;
    }

    const pointers = new Map();
    function pinchState() {
        const [p1, p2] = [...pointers.values()];
        return { d: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        mouse.sx = e.clientX;
        mouse.sy = e.clientY;
        if (pointers.size === 2) {
            if (gesture && gesture.type === 'agent') gesture.agent.drag = null;
            const s = pinchState();
            gesture = { type: 'pinch', d0: s.d, z0: cam.z, wx: (s.mx - cam.x) / cam.z, wy: (s.my - cam.y) / cam.z, moved: true };
            return;
        }
        if (pointers.size > 2) return;
        const hit = hitTest(e.clientX, e.clientY);
        const touch = e.pointerType !== 'mouse';
        const onAgent = hit && hit.kind === 'agent';
        // Mouse grabs an agent at once; a finger has to hold still on it first, so swiping across the ring still pans.
        gesture = { type: onAgent ? (touch ? 'press' : 'agent') : 'pan', hit, agent: onAgent ? hit.obj : null, touch,
            sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, camx: cam.x, camy: cam.y, moved: false, t0: performance.now() };
    });

    canvas.addEventListener('pointermove', (e) => {
        mouse.sx = e.clientX;
        mouse.sy = e.clientY;
        mouse.tx = (e.clientX / W) * 2 - 1;
        mouse.ty = (e.clientY / H) * 2 - 1;
        wake();
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!gesture) return;
        if (gesture.type === 'pinch') {
            if (pointers.size < 2) return;
            const s = pinchState();
            cam.z = clamp(gesture.z0 * (s.d / gesture.d0), ZMIN, ZMAX);
            cam.x = s.mx - gesture.wx * cam.z;
            cam.y = s.my - gesture.wy * cam.z;
            clampCam();
            return;
        }
        gesture.lx = e.clientX;
        gesture.ly = e.clientY;
        const dx = e.clientX - gesture.sx, dy = e.clientY - gesture.sy;
        if (!gesture.moved && dx * dx + dy * dy > (gesture.touch ? 100 : 36)) {
            if (gesture.type === 'press') gesture.type = 'pan'; // swiped off before the hold: pan instead
            gesture.moved = true;
            tip.hidden = true;
        }
        if (!gesture.moved) return;
        if (gesture.type === 'agent') gesture.agent.drag = toWorld(e.clientX, e.clientY);
        else {
            cam.x = gesture.camx + dx;
            cam.y = gesture.camy + dy;
            clampCam();
        }
    });

    function pointerEnd(e, cancelled) {
        pointers.delete(e.pointerId);
        const g = gesture;
        if (!g) return;
        if (g.type === 'pinch') { if (pointers.size === 0) gesture = null; return; }
        gesture = null;
        if (g.type === 'press') { if (!cancelled) broadcast(g.agent); return; }
        if (g.type === 'agent') {
            const a = g.agent;
            const b = g.moved ? dropTarget(a) : null;
            a.drag = null;
            if (cancelled) return;
            if (!g.moved) broadcast(a);
            else if (b) {
                sysLog('CONNECT', `${a.name} ⇄ ${b.name}`, true);
                waves.push({ x: b.x, y: b.y, r: L.agentR, max: L.agentR * 5, life: 1, color: a.color });
                dialogue(a, b, randi(3, 5));
            }
            return;
        }
        if (cancelled || g.moved) return;
        const w = toWorld(e.clientX, e.clientY);
        if (g.hit && g.hit.kind === 'task') prioritise(g.hit.obj);
        else if (g.hit && g.hit.kind === 'core') callVote();
        else if (g.touch) touchTapEmpty(e.clientX, e.clientY);
        else signalAt(w.x, w.y);
    }

    function pickUp(g) {
        g.type = 'agent';
        g.moved = true;
        g.agent.drag = toWorld(g.lx, g.ly);
        g.agent.flash = 1;
        waves.push({ x: g.agent.x, y: g.agent.y, r: L.agentR, max: L.agentR * 3, life: 1, color: g.agent.color });
        tip.hidden = true;
        if (navigator.vibrate) navigator.vibrate(12);
    }

    // On touch a single tap on empty space waits a moment, so a double tap can zoom instead of dropping a signal.
    let lastTap = null, tapTimer = 0;
    function touchTapEmpty(sx, sy) {
        const nowMs = performance.now();
        if (lastTap && nowMs - lastTap.t < 320 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 40) {
            clearTimeout(tapTimer);
            lastTap = null;
            if (cam.z > 1.4) resetView(); else zoomAt(sx, sy, 2.2);
            return;
        }
        lastTap = { t: nowMs, x: sx, y: sy };
        tapTimer = setTimeout(() => { const w = toWorld(sx, sy); signalAt(w.x, w.y); lastTap = null; }, 320);
    }
    // iOS Safari zooms the page on pinch even with touch-action set; keep the pinch for the scene.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    canvas.addEventListener('pointerup', (e) => pointerEnd(e, false));
    canvas.addEventListener('pointercancel', (e) => pointerEnd(e, true));
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointers.size) mouse.sx = mouse.sy = -1e4; });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomAt(e.clientX, e.clientY, cam.z * Math.exp(-step * 0.0015));
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    cmdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = cmdInput.value.trim().replace(/\s+/g, ' ');
        if (!text) { cmdInput.placeholder = `Try: ${pick(OBJECTIVE_IDEAS)}`; return; }
        cmdInput.value = '';
        cmdInput.blur();
        giveObjective(text);
    });

    function setPaused(v) { paused = v; $('btn-pause').textContent = paused ? 'Resume' : 'Pause'; }
    function setSpeed(i) {
        speedIdx = clamp(i, 0, SPEEDS.length - 1);
        $('btn-speed').textContent = SPEEDS[speedIdx] + '×';
        if (paused) setPaused(false);
    }
    function setHud(off) {
        hudOff = off;
        document.body.classList.toggle('hud-off', off);
        $('btn-hud').textContent = off ? 'Show HUD' : 'Hide HUD';
        layout();
    }
    function toggleHelp(show) {
        helpEl.hidden = !show;
        if (show) $('help-close').focus();
    }

    const fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    if (!fsSupported) document.documentElement.classList.add('no-fullscreen');
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
    function toggleFull() {
        const root = document.documentElement;
        if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    }
    function onFullscreen() {
        $('btn-full').textContent = fsElement() ? 'Exit fullscreen' : 'Fullscreen';
        wake();
        layout();
    }
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('webkitfullscreenchange', onFullscreen);

    // In fullscreen the top bar, objective bar and cursor fade out after a few idle seconds.
    let idleTimer = 0;
    function wake() {
        document.body.classList.remove('idle');
        clearTimeout(idleTimer);
        if (!fsElement()) return;
        idleTimer = setTimeout(() => {
            if (document.activeElement !== cmdInput && helpEl.hidden) document.body.classList.add('idle');
        }, 3000);
    }

    $('btn-pause').addEventListener('click', () => setPaused(!paused));
    $('btn-speed').addEventListener('click', () => setSpeed((speedIdx + 1) % SPEEDS.length));
    $('btn-spawn').addEventListener('click', spawnAgent);
    $('btn-hud').addEventListener('click', () => setHud(!hudOff));
    $('btn-full').addEventListener('click', toggleFull);
    $('btn-help').addEventListener('click', () => toggleHelp(helpEl.hidden));
    $('help-close').addEventListener('click', () => toggleHelp(false));
    helpEl.addEventListener('click', (e) => { if (e.target === helpEl) toggleHelp(false); });

    window.addEventListener('keydown', (e) => {
        wake();
        if (e.key === 'Escape') {
            if (!helpEl.hidden) toggleHelp(false);
            else if (document.activeElement === cmdInput) cmdInput.blur();
            return;
        }
        if (e.target === cmdInput || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!helpEl.hidden && e.key !== '?') return;
        const onControl = e.target.tagName === 'BUTTON' || e.target.tagName === 'A';
        if ((e.code === 'Space' || e.key === 'Enter') && onControl) return;
        const k = e.key;
        if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
        else if (k === '/' || k === 'Enter') { e.preventDefault(); cmdInput.focus(); }
        else if (k === 'h' || k === 'H') setHud(!hudOff);
        else if (k === 'f' || k === 'F') { if (fsSupported) toggleFull(); }
        else if (k === 'n' || k === 'N') spawnAgent();
        else if (k === '?') toggleHelp(helpEl.hidden);
        else if (k >= '1' && k <= '5') setSpeed(Number(k) - 1);
        else if (k === '0') resetView();
        else if (k === '+' || k === '=') zoomAt(W / 2, H / 2, cam.z * 1.2);
        else if (k === '-' || k === '_') zoomAt(W / 2, H / 2, cam.z / 1.2);
    });
    window.addEventListener('resize', layout);

    // ---------------------------------------------------------------- loop
    let last = performance.now();
    function frame(now) {
        const raw = Math.min(0.05, (now - last) / 1000);
        last = now;
        mouse.px = lerp(mouse.px, mouse.tx, raw * 2);
        mouse.py = lerp(mouse.py, mouse.ty, raw * 2);
        const dt = paused ? 0 : raw * SPEEDS[speedIdx];
        if (dt > 0) {
            t += dt;
            update(dt);
        }
        moveAgents(raw);
        if (gesture && gesture.type === 'press' && performance.now() - gesture.t0 > 380) pickUp(gesture);
        if (gesture && gesture.moved) canvas.style.cursor = 'grabbing';
        else {
            hovered = hitTest(mouse.sx, mouse.sy);
            canvas.style.cursor = hovered ? 'pointer' : '';
        }
        if (hovered ? hovered.obj !== tipFor : tipFor) fillTip();
        else placeTip();
        draw();
        if (panelsOn) { drawCurve(); drawSpark(dt); }
        updateTicker(raw);
        updateMetrics(raw);
        requestAnimationFrame(frame);
    }

    setSpeed(speedIdx);
    cmdInput.placeholder = `Give the hivemind a goal, e.g. "${pick(OBJECTIVE_IDEAS)}"`;
    layout();
    for (const a of agents) a.shown = a.thought.length;
    sysLog('BOOT', 'hivemind kernel v9.4 online');
    sysLog('LOAD', 'world model · 1.2T params · 4.1M context');
    sysLog('SYNC', `${agents.length} agents joined the collective`);
    sysLog('ARM', 'consensus core ready');
    after(0.6, () => newPlan());
    after(1.0, () => dialogue(byName.ORACLE, byName.STRATEGIST, 3));
    after(1.8, () => dialogue(byName.RESEARCHER, byName.CRITIC, 3));
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setTimeout(() => toast(coarse
        ? 'Hold an agent to drag it · tap anything · pinch or double-tap to zoom · ? for controls'
        : 'Drag agents · click anything · scroll to zoom · type an objective below · ? for controls'), 900);
    requestAnimationFrame(frame);
})();
