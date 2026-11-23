/* Hivemind: a team of AI agents working on a goal, shown the way an onlooker would see it.
   Who is doing what, what they say to each other, how far along it is, and what it costs.
   Plain canvas 2D, no dependencies. The scene uses "world" coordinates (1 unit = 1 CSS px at zoom 1). */
(() => {
    'use strict';

    // ---------------------------------------------------------------- setup
    const canvas = document.getElementById('sim');
    const ctx = canvas.getContext('2d');
    const $ = (id) => document.getElementById(id);
    const SANS = 'Inter,"Segoe UI",system-ui,-apple-system,sans-serif';
    const MONO = '"JetBrains Mono","Cascadia Code",Consolas,Menlo,monospace';
    const TAU = Math.PI * 2;
    const SPEEDS = [0.5, 1, 2, 4];
    let speedIdx = 1;
    const ZMIN = 0.6, ZMAX = 2.5;
    const MAX_AGENTS = 14;
    const C = {
        card: '#131d30', cardHot: '#18253e', line: '#22304a', track: '#1b2740',
        text: '#dbe3ef', muted: '#8391a7', faint: '#5f6d84', accent: '#5b8def', ok: '#4cbf86', warn: '#e0a94a',
    };

    const rand = (a, b) => a + Math.random() * (b - a);
    const randi = (a, b) => Math.floor(rand(a, b + 1));
    const pick = (arr) => arr[(Math.random() * arr.length) | 0];
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, k) => a + (b - a) * k;
    const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
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
    const money = (v, d = 2) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

    // ---------------------------------------------------------------- the team
    // Fictional models with example prices per million tokens (input / output).
    const MODELS = [
        { id: 'large', name: 'Large model', note: 'careful reasoning', pin: 15, pout: 75, base: 2.4,
          layers: [['Input', 3], ['Attention', 5], ['Attention', 5], ['Output', 3]] },
        { id: 'standard', name: 'Standard model', note: 'everyday work', pin: 3, pout: 15, base: 0.9,
          layers: [['Input', 3], ['Attention', 4], ['Output', 3]] },
        { id: 'fast', name: 'Fast model', note: 'quick replies', pin: 0.8, pout: 4, base: 0.3,
          layers: [['Input', 3], ['Attention', 3], ['Output', 2]] },
    ];
    for (const m of MODELS) Object.assign(m, { spend: 0, tokens: 0, bucket: 0, hist: [], reqTimes: [], act: 0, phase: 0 });
    const modelById = Object.fromEntries(MODELS.map((m) => [m.id, m]));

    const ROLES = [
        { name: 'Planner', color: '#e0a94a', model: 'large', job: 'Breaks the goal into steps',
          idle: ['Watching the timeline', 'Checking who is free', 'Waiting for updates'] },
        { name: 'Researcher', color: '#3fb5a5', model: 'standard', job: 'Finds and reads sources',
          idle: ['Keeping an eye on the news', 'Waiting for the next task', 'Tidying up notes'] },
        { name: 'Analyst', color: '#5b8def', model: 'large', job: 'Works out the numbers',
          idle: ['Double-checking last week\'s figures', 'Waiting for data', 'Updating a spreadsheet'] },
        { name: 'Writer', color: '#9b84e6', model: 'standard', job: 'Drafts and edits text',
          idle: ['Collecting ideas for headlines', 'Waiting for research', 'Rereading the brief'] },
        { name: 'Designer', color: '#e08fb5', model: 'standard', job: 'Makes the visuals',
          idle: ['Sketching ideas', 'Waiting for the final text', 'Sorting the photo library'] },
        { name: 'Developer', color: '#5fbf7f', model: 'standard', job: 'Builds and tests',
          idle: ['Updating tools', 'Waiting for the design', 'Reviewing old code'] },
        { name: 'Reviewer', color: '#e0707f', model: 'large', job: 'Checks quality and facts',
          idle: ['Reading the style guide', 'Waiting for drafts', 'Checking earlier work'] },
        { name: 'Assistant', color: '#e3925a', model: 'fast', job: 'Handles email and calendars',
          idle: ['Sorting the inbox', 'Booking a meeting room', 'Waiting for the go-ahead'] },
        { name: 'Archivist', color: '#57b4d9', model: 'fast', job: 'Remembers past projects',
          idle: ['Filing finished work', 'Indexing old reports', 'Waiting for questions'] },
    ];
    const EXTRA_ROLES = [
        { name: 'Translator', color: '#a9c25f', model: 'fast', job: 'Translates text', idle: ['Waiting for text to translate', 'Building a word list'] },
        { name: 'Legal', color: '#d6c062', model: 'large', job: 'Checks rules and contracts', idle: ['Reading the terms of service', 'Waiting for drafts'] },
        { name: 'Marketer', color: '#c77fd0', model: 'standard', job: 'Plans how to reach people', idle: ['Looking at last campaign\'s results', 'Planning social posts'] },
        { name: 'Support', color: '#6fa3e8', model: 'fast', job: 'Answers customer questions', idle: ['Writing FAQ answers', 'Reading support tickets'] },
        { name: 'Data engineer', color: '#4fc1c9', model: 'standard', job: 'Moves and cleans data', idle: ['Cleaning a customer list', 'Checking data pipelines'] },
    ];

    // The work. Each task has an owner, a teammate it asks for help, the steps you see it doing,
    // the short exchange between them, and the result it reports back.
    const TASKS = [
        { phase: 0, name: 'Break the goal into steps', owner: 'Planner', helper: 'Archivist',
          steps: ['Reading the goal carefully', 'Listing what needs to happen', 'Putting the steps in order', 'Choosing who does what'],
          ask: 'Do we have notes from similar projects?', reply: 'Yes, two. Both ran late on design, so start that early.',
          result: 'Plan ready: 12 tasks in 5 stages.' },
        { phase: 0, name: 'Research the market', owner: 'Researcher', helper: 'Archivist',
          steps: ['Searching news and reports', 'Reading 23 articles', 'Comparing customer reviews', 'Writing a one-page summary'],
          ask: 'Have we done anything like this before?', reply: 'A similar launch in 2024. Offering a free first month doubled sign-ups.',
          result: 'Demand is growing about 12% a year. Three main customer groups.' },
        { phase: 1, name: 'Study the competitors', owner: 'Researcher', helper: 'Analyst',
          steps: ['Finding the 5 biggest competitors', 'Collecting their prices', 'Reading what their customers say', 'Making a comparison table'],
          ask: 'Can you sanity-check these prices?', reply: 'Two looked out of date. I updated them from their websites.',
          result: 'Competitors charge between 129 and 249 kr a month.' },
        { phase: 1, name: 'Estimate costs and price', owner: 'Analyst', helper: 'Reviewer',
          steps: ['Collecting cost figures', 'Building a spreadsheet', 'Testing three price points', 'Picking the best price'],
          ask: 'Could you check my spreadsheet formulas?', reply: 'One formula counted shipping twice. Fixed it.',
          result: 'Suggested price 179 kr a month, with a 38% margin.' },
        { phase: 1, name: 'Collect lessons learned', owner: 'Archivist', helper: 'Planner',
          steps: ['Searching old project notes', 'Reading 6 project reviews', 'Picking out what went wrong', 'Writing a list of tips'],
          ask: 'Which of these lessons matter most for us?', reply: 'The ones about deadlines and testing. Put those first.',
          result: '4 lessons shared with the team.' },
        { phase: 2, name: 'Write the announcement', owner: 'Writer', helper: 'Reviewer',
          steps: ['Outlining the main message', 'Writing a first draft', 'Making it shorter and clearer', 'Adding a headline'],
          ask: 'Is the tone right, or too salesy?', reply: 'A little salesy. Drop the exclamation marks and lead with the price.',
          result: 'Announcement drafted, 220 words.' },
        { phase: 2, name: 'Design the web page', owner: 'Designer', helper: 'Writer',
          steps: ['Sketching three layouts', 'Choosing colours and fonts', 'Placing text and photos', 'Checking it on a phone'],
          ask: 'Can I have the final headline?', reply: 'Sending it now, plus a shorter version for phones.',
          result: 'Web page design is ready.' },
        { phase: 2, name: 'Build the sign-up form', owner: 'Developer', helper: 'Designer',
          steps: ['Setting up the form', 'Connecting it to payments', 'Adding a confirmation email', 'Running test sign-ups'],
          ask: 'Which colour should the buttons be?', reply: 'Use the dark green from the web page.',
          result: 'Sign-up form works. 20 test sign-ups went through.' },
        { phase: 3, name: 'Fact-check and proofread', owner: 'Reviewer', helper: 'Researcher',
          steps: ['Reading every page', 'Checking each number against its source', 'Fixing typos', 'Writing a short review note'],
          ask: 'Where does the 12% growth figure come from?', reply: 'An industry report from March. I added the link.',
          result: 'All facts checked, 7 typos fixed.' },
        { phase: 3, name: 'Test on phones and laptops', owner: 'Developer', helper: 'Reviewer',
          steps: ['Testing on iPhone and Android', 'Testing in three browsers', 'Fixing a layout problem', 'Testing everything again'],
          ask: 'Can you try signing up on your phone too?', reply: 'It works, but the button hides behind the keyboard.',
          result: '2 problems fixed. Works on everything we tried.' },
        { phase: 4, name: 'Schedule the emails', owner: 'Assistant', helper: 'Writer',
          steps: ['Building the mailing list', 'Setting up the email template', 'Choosing the best time to send', 'Scheduling the send'],
          ask: 'Could you write a short subject line?', reply: 'How about: "Something new is starting today"?',
          result: 'Emails scheduled for Tuesday 09:00, to 4,800 people.' },
        { phase: 4, name: 'Write the final report', owner: 'Planner', helper: 'Analyst',
          steps: ['Collecting everyone\'s results', 'Summing up what was done', 'Listing risks and next steps', 'Sending the report'],
          ask: 'Can you add a cost summary?', reply: 'Added. We came in 8% under budget.',
          result: 'Final report sent to the team.' },
    ];
    const STAGE_NAMES = ['Plan', 'Research', 'Create', 'Check', 'Launch'];
    const GOALS = ['Launch a coffee subscription in Norway', 'Plan a company trip for 40 people', 'Open a pop-up shop in Bergen',
        'Prepare the quarterly board report', 'Start a newsletter for small businesses', 'Launch a bike repair app'];
    const HELP_REPLIES = ['Yes please, take a look at the draft.', 'Thanks! Could you check the numbers?', 'Sure, start with the second half.',
        'That would help. I\'ll send you what I have.'];

    // ---------------------------------------------------------------- state
    let W = 0, H = 0, DPR = 1;
    const L = { s: 1 };
    let t = 0;
    let paused = false;
    let hudOff = false;
    let panelsOn = false;
    const cam = { x: 0, y: 0, z: 1 };
    const mouse = { sx: -1e4, sy: -1e4 };
    const stats = { spend: 0, monthBase: 412.8, budget: 2000, tokens: 0, msgTimes: [], tasksDone: 0, bucket: 0, hist: [], spendHist: [], lastSec: 0 };
    const timers = [];
    const packets = [];
    const links = new Map();
    let plan = null;
    let planSeq = 0;
    let goalIdx = randi(0, GOALS.length - 1);
    let hovered = null; // { kind: 'agent' | 'task' | 'hub', obj }
    let gesture = null;
    let bgCanvas = null;

    const sans = (px, w = '') => `${w} ${Math.round(px * L.s)}px ${SANS}`;
    const mono = (px, w = '') => `${w} ${Math.round(px * L.s)}px ${MONO}`;
    const toWorld = (sx, sy) => ({ x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z });
    const toScreen = (wx, wy) => ({ x: wx * cam.z + cam.x, y: wy * cam.z + cam.y });
    function after(sec, fn) { timers.push({ at: t + sec, fn }); }

    function makeAgent(role, i) {
        return {
            ...role, i, x: NaN, y: NaN, hx: 0, hy: 0, flash: 0, act: 0, status: pick(role.idle), shown: 99,
            task: null, helping: null, helpUntil: 0, nextIdle: rand(10, 24), spend: 0, tokIn: 0, tokOut: 0, sent: 0,
            drag: null, bubble: null, talkUntil: 0,
            mini: [3, 4, 2].map((n) => Array.from({ length: n }, () => ({ a: 0, ph: rand(0, TAU), f: rand(1, 2.2) }))),
        };
    }
    const agents = ROLES.map(makeAgent);
    const byName = Object.fromEntries(agents.map((a) => [a.name, a]));
    const hub = { name: 'Orchestrator', isHub: true, color: C.accent, model: 'large', job: 'Hands out tasks and keeps track',
        x: 0, y: 0, flash: 0, status: 'Waiting for a goal', shown: 99, spend: 0, tokIn: 0, tokOut: 0, sent: 0,
        bubble: null, talkUntil: 0, shownProgress: 0 };

    function setStatus(a, text) {
        if (a.status === text) return;
        a.status = text;
        a.shown = 0;
    }

    // Every message and every second of work uses tokens on the agent's model, which costs money.
    function charge(a, tin, tout) {
        const m = modelById[a.model];
        const cost = (tin * m.pin + tout * m.pout) / 1e6;
        a.spend += cost;
        a.tokIn += tin;
        a.tokOut += tout;
        m.spend += cost;
        m.tokens += tin + tout;
        m.bucket += cost;
        stats.spend += cost;
        stats.tokens += tin + tout;
        stats.bucket += cost;
    }
    function request(a) {
        const m = modelById[a.model];
        m.reqTimes.push(t);
        m.act = Math.min(1, m.act + 0.4);
    }

    // ---------------------------------------------------------------- talking
    function linkKey(a, b) { return a.name < b.name ? a.name + '|' + b.name : b.name + '|' + a.name; }
    function touchLink(a, b) {
        const k = linkKey(a, b);
        const l = links.get(k);
        if (l) l.s = 1; else links.set(k, { a, b, s: 1 });
    }

    // One agent says something to another: a speech bubble, a dot travelling between them, a line in the chat.
    // An agent finishes one sentence before starting the next, so everything stays readable.
    function say(from, to, text, onArrive) {
        if (from === to) { if (onArrive) onArrive(); return; }
        if (from.talkUntil > t) { after(from.talkUntil - t + 0.3, () => say(from, to, text, onArrive)); return; }
        const dur = 2.6;
        from.talkUntil = t + dur + 1.6;
        from.bubble = { text, to, t0: t, until: t + dur + 4, lines: null, lw: 0 };
        from.flash = 1;
        from.sent++;
        packets.push({ from, to, k: 0, dur, color: from.color, onArrive });
        touchLink(from, to);
        charge(from, randi(2000, 12000), randi(80, 600));
        request(from);
        stats.msgTimes.push(t);
        chat(from, to, text);
    }

    // ---------------------------------------------------------------- plans
    function newPlan(goal) {
        for (const a of agents) { a.task = null; a.helping = null; }
        const tasks = TASKS.map((d) => ({
            ...d, owner: byName[d.owner], helper: byName[d.helper], deps: [], idx: 0, count: 0, progress: 0,
            state: 'pending', dur: rand(26, 40), asked: false, boost: 1, rect: null, label: '', lw: 0,
        }));
        for (let s = 0; s < STAGE_NAMES.length; s++) {
            const st = tasks.filter((x) => x.phase === s);
            st.forEach((x, k) => { x.idx = k; x.count = st.length; x.deps = tasks.filter((y) => y.phase === s - 1); });
        }
        // the schedule a cautious project manager would promise
        const plannedDur = 6 + STAGE_NAMES.reduce((sum, _, s) => sum + Math.max(...tasks.filter((x) => x.phase === s).map((x) => x.dur)) * 1.25 + 5, 0);
        plan = { seq: ++planSeq, goal, tasks, born: t, doneAt: 0, done: 0, plannedDur, hist: [[0, 0]] };
        setStatus(hub, 'Planning the work');
        sysChat(`New goal: ${goal}`);
        toast(`New goal: ${goal}`);
        say(hub, byName.Planner, `New goal: "${goal}". Can you break it into steps?`);
    }

    function nextGoal() {
        goalIdx = (goalIdx + 1) % GOALS.length;
        newPlan(GOALS[goalIdx]);
    }

    function updatePlan(dt) {
        if (!plan) return;
        const current = plan;
        const ready = t - plan.born > 5;
        let done = 0, active = 0;
        for (const task of plan.tasks) {
            const o = task.owner;
            if (task.state === 'pending' && ready && task.deps.every((d) => d.state === 'done')) {
                task.state = 'assigning';
                say(hub, o, `Please ${task.name.charAt(0).toLowerCase() + task.name.slice(1)}.`, () => {
                    if (plan !== current) return;
                    task.state = 'active';
                    if (!o.task) o.task = task;
                });
            } else if (task.state === 'active') {
                active++;
                const helped = task.helper.helping === task && t < task.helper.helpUntil;
                task.progress = Math.min(1, task.progress + (dt / task.dur) * task.boost * (helped ? 1.25 : 1));
                if (!o.task) o.task = task;
                if (o.task === task) setStatus(o, task.steps[Math.min(task.steps.length - 1, Math.floor(task.progress * task.steps.length))] + '…');
                charge(o, 380 * dt, 22 * dt);
                if (!task.asked && task.progress > 0.4) {
                    task.asked = true;
                    const h = task.helper;
                    say(o, h, task.ask, () => {
                        h.helping = task;
                        h.helpUntil = t + 9;
                        setStatus(h, `Helping ${o.name}`);
                        after(2.2, () => say(h, o, task.reply));
                    });
                }
                if (task.progress >= 1) {
                    task.state = 'done';
                    if (o.task === task) o.task = plan.tasks.find((x) => x.state === 'active' && x.owner === o) || null;
                    say(o, hub, `Done: ${task.result}`, () => {
                        if (plan !== current) return;
                        stats.tasksDone++;
                        hub.flash = 1;
                    });
                }
            }
            if (task.state === 'done') done++;
        }
        plan.done = done;
        if (!plan.doneAt) setStatus(hub, active ? `Coordinating ${active} task${active > 1 ? 's' : ''}` : t - plan.born < 6 ? 'Planning the work' : 'Waiting for results');
        if (done === plan.tasks.length && !plan.doneAt) {
            plan.doneAt = t;
            setStatus(hub, 'Goal complete');
            const ahead = plan.plannedDur - (t - plan.born);
            sysChat(`Goal complete: ${plan.goal}. ${ahead > 0 ? `${fmtDur(ahead)} ahead of plan.` : 'Right on time.'}`);
            toast(`Goal complete: ${plan.goal}`);
            const seq = plan.seq;
            after(10, () => { if (plan && plan.seq === seq) nextGoal(); });
        }
    }

    // ---------------------------------------------------------------- interactions
    function askAgent(a) {
        a.flash = 1;
        if (a.task) {
            const pct = Math.round(a.task.progress * 100);
            say(a, hub, `I'm on "${a.task.name}". ${a.status.replace('…', '')}, about ${pct}% done.`);
        } else if (a.helping && t < a.helpUntil) {
            say(a, hub, `I'm helping ${a.helping.owner.name} with "${a.helping.name}".`);
        } else {
            const next = plan && plan.tasks.find((x) => x.owner === a && x.state === 'pending');
            say(a, hub, next ? `Nothing right now. Next up for me: "${next.name}".` : 'Nothing right now. Happy to help anyone.');
        }
        sysChat(`You asked ${a.name} for an update`, true);
    }

    function statusRound() {
        sysChat('You asked everyone for a status update', true);
        hub.flash = 1;
        say(hub, agents[0], 'Quick status round, everyone: where are you at?');
        const busy = agents.filter((a) => a.task);
        busy.slice(0, 5).forEach((a, i) => after(3 + i * 2.5, () => askAgentQuiet(a)));
        if (!busy.length) after(3, () => say(byName.Planner, hub, 'All quiet. We are between tasks.'));
    }
    function askAgentQuiet(a) {
        if (a.task) say(a, hub, `${a.task.name}: ${Math.round(a.task.progress * 100)}% done.`);
    }

    function pairUp(a, b) {
        const task = a.task || b.task;
        sysChat(`You paired ${a.name} with ${b.name}`, true);
        if (!task) { say(a, b, 'We\'re both free. Let\'s look at what\'s coming next.'); return; }
        const owner = task.owner === a ? a : b, other = owner === a ? b : a;
        say(other, owner, `I've been asked to help with "${task.name}". Where can I start?`, () => {
            other.helping = task;
            other.helpUntil = t + 14;
            setStatus(other, `Helping ${owner.name}`);
            task.boost = Math.min(1.8, task.boost + 0.25);
            after(2, () => say(owner, other, pick(HELP_REPLIES)));
        });
    }

    function prioritise(task) {
        if (task.state === 'done') { toast(`"${task.name}" is already done`); return; }
        task.boost = Math.min(2, task.boost + 0.6);
        sysChat(`You made "${task.name}" the top priority`, true);
        say(hub, task.owner, `"${task.name}" is now top priority. Please focus on it.`, () => {
            if (task.state === 'active') task.owner.task = task;
        });
    }

    function idleChat(a) {
        if (!plan) return;
        const active = plan.tasks.filter((x) => x.state === 'active' && x.owner !== a);
        if (active.length && Math.random() < 0.55) {
            const task = pick(active);
            say(a, task.owner, `I'm free. Want help with "${task.name}"?`, () => after(2, () => say(task.owner, a, pick(HELP_REPLIES), () => {
                a.helping = task;
                a.helpUntil = t + 12;
                setStatus(a, `Helping ${task.owner.name}`);
                task.boost = Math.min(1.6, task.boost + 0.15);
            })));
        } else {
            setStatus(a, pick(a.idle));
        }
    }

    function spawnAgent() {
        const role = EXTRA_ROLES.find((r) => !byName[r.name]);
        if (!role || agents.length >= MAX_AGENTS) { toast(`The team is full (${agents.length} agents)`); return; }
        const a = makeAgent(role, agents.length);
        a.x = L.cx;
        a.y = L.cy;
        a.nextIdle = 6;
        agents.push(a);
        byName[a.name] = a;
        sizeCards();
        sysChat(`You added ${a.name} to the team`, true);
        toast(`${a.name} joined the team · ${a.job}`);
        after(1, () => say(hub, a, `Welcome, ${a.name}. Jump in wherever someone needs a hand.`));
    }

    // ---------------------------------------------------------------- layout
    function layout() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';

        L.s = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 11) / 11;
        const panel = $('panel-right');
        panelsOn = !hudOff && panel.offsetWidth > 0;
        const side = panelsOn ? W - panel.getBoundingClientRect().left + 12 * L.s : 0;
        L.compact = W < 760;
        L.left = side;
        L.right = W - side;
        const availW = L.right - L.left;
        L.cx = W / 2;
        L.planTop = ($('topbar').offsetHeight || 52) + 34 * L.s;
        L.planH = L.compact ? 84 : clamp(H * 0.15, 96, 130 * L.s);
        const halfPlan = Math.min(availW * 0.47, 520 * L.s);
        L.planL = L.cx - halfPlan;
        L.planR = L.cx + halfPlan;
        const cmdTop = $('cmd').getBoundingClientRect().top || H - 70;
        // provisional card size, refined by sizeCards once the ring is known
        const ch0 = (L.compact ? 40 : 66) * L.s;
        const cw0 = (L.compact ? 92 : 172) * L.s;
        const ringTop = L.planTop + L.planH + 20 * L.s + ch0 / 2 + 8;
        const ringBottom = cmdTop - 16 - ch0 / 2;
        L.ry = Math.max(80, (ringBottom - ringTop) / 2);
        L.cy = ringTop + L.ry;
        L.rx = Math.max(110, Math.min(availW * 0.5 - cw0 / 2 - 16 * L.s, L.ry * 2.2));
        L.coreR = clamp(Math.min(L.rx, L.ry) * 0.3, 34, 92 * L.s);
        hub.x = L.cx;
        hub.y = L.cy;
        sizeCards();

        bgCanvas = document.createElement('canvas');
        bgCanvas.width = Math.round(W * DPR);
        bgCanvas.height = Math.round(H * DPR);
        const g = bgCanvas.getContext('2d');
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        const grd = g.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#0c1320');
        grd.addColorStop(1, '#0a101b');
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(131,145,167,0.09)';
        const step = 26 * L.s;
        for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) g.fillRect(x, y, 1.2, 1.2);

        for (const a of agents) { homeOf(a); if (Number.isNaN(a.x)) { a.x = a.hx; a.y = a.hy; } }
        clampCam();
        for (const id of ['c-spend', 'c-agents', 'c-progress']) sizeCanvas($(id));
        for (const m of MODELS) if (m.cv) sizeCanvas(m.cv);
    }

    // Cards shrink when the ring gets crowded so neighbours never overlap.
    function sizeCards() {
        const n = agents.length;
        const perim = Math.PI * (3 * (L.rx + L.ry) - Math.sqrt((3 * L.rx + L.ry) * (L.rx + 3 * L.ry)));
        L.cardW = clamp((perim / n) * 0.78, L.compact ? 70 : 104, (L.compact ? 104 : 182) * L.s);
        L.cardH = clamp(L.cardW * 0.4, L.compact ? 34 : 50, 70 * L.s);
        L.tiny = L.cardW < 120;
    }

    function homeOf(a) {
        const ang = -Math.PI / 2 + (a.i * TAU) / agents.length;
        a.hx = L.cx + Math.cos(ang) * L.rx;
        a.hy = L.cy + Math.sin(ang) * L.ry;
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
    function moveAgents(raw) {
        for (const a of agents) {
            homeOf(a);
            const tx = a.drag ? a.drag.x : a.hx, ty = a.drag ? a.drag.y : a.hy;
            const k = Math.min(1, raw * (a.drag ? 18 : 3));
            a.x += (tx - a.x) * k;
            a.y += (ty - a.y) * k;
        }
    }

    function update(dt) {
        for (let i = timers.length - 1; i >= 0; i--) {
            if (timers[i].at <= t) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
        }
        for (const a of [...agents, hub]) {
            a.flash = Math.max(0, a.flash - dt * 0.8);
            a.shown = Math.min(a.status.length, a.shown + dt * 30);
        }
        for (const a of agents) {
            const helpingNow = a.helping && t < a.helpUntil;
            if (a.helping && !helpingNow) a.helping = null;
            const working = !!a.task || helpingNow;
            a.act = lerp(a.act, working ? 1 : 0.12, Math.min(1, dt * 1.5));
            for (const layer of a.mini) for (const m of layer) {
                const target = a.act * (0.5 + 0.5 * Math.sin(t * m.f * 2 + m.ph));
                m.a += (target - m.a) * Math.min(1, dt * 4);
            }
            if (helpingNow) charge(a, 200 * dt, 12 * dt);
            if (!working) {
                if (a.status.endsWith('…') || a.status.startsWith('Helping')) setStatus(a, pick(a.idle));
                a.nextIdle -= dt;
                if (a.nextIdle <= 0) { a.nextIdle = rand(16, 30); idleChat(a); }
            }
        }
        for (let i = packets.length - 1; i >= 0; i--) {
            const p = packets[i];
            p.k += dt / p.dur;
            if (p.k >= 1) {
                packets.splice(i, 1);
                p.to.flash = 1;
                if (p.onArrive) p.onArrive();
            }
        }
        for (const [k, l] of links) { l.s -= dt * 0.05; if (l.s <= 0) links.delete(k); }
        for (const m of MODELS) {
            m.act = Math.max(0, m.act - dt * 0.35);
            m.phase += dt * (0.6 + m.act * 2.2);
        }
        updatePlan(dt);

        // once a second: cost buckets, spend history, progress history
        if (t - stats.lastSec >= 1) {
            stats.lastSec = t;
            stats.hist.push(stats.bucket);
            stats.bucket = 0;
            if (stats.hist.length > 60) stats.hist.shift();
            stats.spendHist.push(stats.spend);
            if (stats.spendHist.length > 180) stats.spendHist.shift();
            for (const m of MODELS) {
                m.hist.push(m.bucket);
                m.bucket = 0;
                if (m.hist.length > 60) m.hist.shift();
            }
            if (plan && !plan.doneAt) plan.hist.push([t - plan.born, plan.done / plan.tasks.length]);
        }
    }

    // ---------------------------------------------------------------- draw
    function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.globalAlpha = 1;
        ctx.drawImage(bgCanvas, 0, 0, W, H);
        ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * cam.x, DPR * cam.y);
        drawLinks();
        drawPlan();
        drawPackets();
        drawHub();
        drawDrag();
        for (const a of agents) drawAgent(a);
        for (const a of [...agents, hub]) drawBubble(a);
    }

    function rr(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function fitText(text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        let s = text;
        while (s.length > 2 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
        return s + '…';
    }

    function wrap(text, maxW, maxLines) {
        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = w;
                if (lines.length === maxLines) break;
            } else line = test;
        }
        if (lines.length < maxLines && line) lines.push(line);
        else if (lines.length === maxLines && line && !lines.includes(line)) lines[maxLines - 1] = fitText(lines[maxLines - 1] + ' ' + line, maxW);
        return lines;
    }

    function edgePoint(a, b) {
        // where the line from a's centre towards b leaves a's card (or the hub's circle)
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        if (a.isHub) { const r = L.coreR * 1.1; return { x: a.x + (dx / d) * r, y: a.y + (dy / d) * r }; }
        const hw = L.cardW / 2, hh = L.cardH / 2;
        const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
        return { x: a.x + dx * k, y: a.y + dy * k };
    }

    function drawLinks() {
        ctx.lineWidth = 1;
        for (const l of links.values()) {
            ctx.strokeStyle = rgba(l.a.isHub ? l.b.color : l.a.color, 0.04 + 0.14 * l.s);
            ctx.beginPath();
            ctx.moveTo(l.a.x, l.a.y);
            ctx.lineTo(l.b.x, l.b.y);
            ctx.stroke();
        }
    }

    function taskPos(task) {
        const colW = (L.planR - L.planL) / STAGE_NAMES.length;
        const bodyTop = L.planTop + 18 * L.s;
        const bodyH = L.planH - 22 * L.s;
        return { x: L.planL + colW * (task.phase + 0.5), y: bodyTop + bodyH * ((task.idx + 0.5) / task.count) };
    }

    function drawPlan() {
        if (!plan) return;
        const s = L.s;
        const x0 = L.planL - 14 * s, x1 = L.planR + 14 * s, y0 = L.planTop - 30 * s, y1 = L.planTop + L.planH + 8 * s;
        ctx.fillStyle = 'rgba(17,26,42,0.92)';
        rr(x0, y0, x1 - x0, y1 - y0, 10);
        ctx.fill();
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textBaseline = 'middle';
        ctx.font = sans(L.compact ? 10 : 12);
        ctx.textAlign = 'right';
        ctx.fillStyle = C.muted;
        const status = plan.doneAt ? 'All done ✓' : `${plan.done} of ${plan.tasks.length} tasks done`;
        ctx.fillText(status, x1 - 12 * s, y0 + 15 * s);
        const sw = ctx.measureText(status).width + 30 * s;
        ctx.textAlign = 'left';
        ctx.font = sans(L.compact ? 10 : 12, '600');
        ctx.fillStyle = C.text;
        ctx.fillText(fitText('Goal: ' + plan.goal, x1 - x0 - sw - 12 * s), x0 + 12 * s, y0 + 15 * s);

        const colW = (L.planR - L.planL) / STAGE_NAMES.length;
        const nw = Math.min(176 * s, colW - 14 * s);
        const nh = (L.compact ? 16 : 22) * s;
        const showText = nw >= 60;

        // stage labels
        ctx.font = sans(L.compact ? 8 : 9.5);
        ctx.textAlign = 'center';
        ctx.fillStyle = C.faint;
        if (!L.compact) STAGE_NAMES.forEach((n, k) => ctx.fillText(n, L.planL + colW * (k + 0.5), L.planTop + 6 * s));

        ctx.lineWidth = 1;
        for (const task of plan.tasks) {
            const p = taskPos(task);
            for (const d of task.deps) {
                const q = taskPos(d);
                const sx = q.x + nw / 2, ex = p.x - nw / 2;
                ctx.strokeStyle = d.state === 'done' ? rgba(C.ok, 0.4) : 'rgba(131,145,167,0.18)';
                ctx.beginPath();
                ctx.moveTo(sx, q.y);
                ctx.bezierCurveTo(sx + 14, q.y, ex - 14, p.y, ex, p.y);
                ctx.stroke();
            }
        }

        ctx.font = sans(L.compact ? 8.5 : 10.5);
        for (const task of plan.tasks) {
            const p = taskPos(task);
            const c = task.owner.color;
            const x = p.x - nw / 2, y = p.y - nh / 2;
            task.rect = { x, y, w: nw, h: nh };
            const hot = hovered && hovered.obj === task;
            rr(x, y, nw, nh, 5);
            ctx.fillStyle = hot ? C.cardHot : C.card;
            ctx.fill();
            if (task.progress > 0) {
                ctx.save();
                rr(x, y, nw, nh, 5);
                ctx.clip();
                ctx.fillStyle = task.state === 'done' ? rgba(C.ok, 0.18) : rgba(c, 0.22);
                ctx.fillRect(x, y, nw * task.progress, nh);
                ctx.restore();
            }
            rr(x + 0.5, y + 0.5, nw - 1, nh - 1, 5);
            ctx.strokeStyle = task.state === 'done' ? rgba(C.ok, 0.7) : task.state === 'pending' ? C.line : rgba(c, hot ? 1 : 0.75);
            ctx.lineWidth = hot ? 1.6 : 1;
            ctx.stroke();
            if (showText) {
                if (task.lw !== nw) { task.label = fitText(task.name, nw - 26 * s); task.lw = nw; }
                ctx.textAlign = 'left';
                ctx.fillStyle = task.state === 'pending' ? C.faint : C.text;
                ctx.fillText((task.state === 'done' ? '✓ ' : '') + task.label, x + 8 * s, p.y + 0.5);
                if (task.boost > 1.4 && task.state !== 'done') {
                    ctx.textAlign = 'right';
                    ctx.fillStyle = C.warn;
                    ctx.fillText('!', x + nw - 7 * s, p.y + 0.5);
                }
            }
        }
        ctx.textBaseline = 'alphabetic';
    }

    function drawPackets() {
        for (const p of packets) {
            const a = edgePoint(p.from, p.to), b = edgePoint(p.to, p.from);
            const e = ease(p.k);
            ctx.strokeStyle = rgba(p.color, 0.35);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(lerp(a.x, b.x, e), lerp(a.y, b.y, e));
            ctx.stroke();
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(lerp(a.x, b.x, e), lerp(a.y, b.y, e), 3.2 * L.s, 0, TAU);
            ctx.fill();
        }
    }

    function drawHub() {
        const { cx, cy } = L;
        const R = L.coreR, lw = R * 0.16, s = L.s;
        const target = plan ? plan.done / plan.tasks.length + (plan.tasks.filter((x) => x.state === 'active').reduce((sum, x) => sum + x.progress, 0) / plan.tasks.length) : 0;
        hub.shownProgress = lerp(hub.shownProgress, target, 0.05);
        const hot = hovered && hovered.kind === 'hub';
        ctx.fillStyle = hot ? C.cardHot : C.card;
        ctx.beginPath();
        ctx.arc(cx, cy, R + lw, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(C.accent, 0.25 + 0.5 * Math.max(hub.flash, hot ? 1 : 0));
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.lineWidth = lw;
        ctx.strokeStyle = C.track;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.stroke();
        ctx.lineCap = 'round';
        ctx.strokeStyle = plan && plan.doneAt ? C.ok : C.accent;
        ctx.beginPath();
        ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.001, Math.min(1, hub.shownProgress)));
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.text;
        ctx.font = `600 ${Math.round(R * 0.42)}px ${SANS}`;
        ctx.fillText(Math.round(hub.shownProgress * 100) + '%', cx, cy + R * 0.12);
        ctx.font = sans(9.5);
        ctx.fillStyle = C.muted;
        ctx.fillText('of goal done', cx, cy + R * 0.42);
        ctx.font = sans(12, '600');
        ctx.fillStyle = C.text;
        ctx.fillText('Orchestrator', cx, cy + R + lw + 18 * s);
        ctx.font = sans(10.5);
        ctx.fillStyle = C.muted;
        ctx.fillText(hub.status.slice(0, Math.ceil(hub.shown)), cx, cy + R + lw + 33 * s);
    }

    function dropTarget(a) {
        if (!a || !a.drag) return null;
        let best = null, bd = (L.cardW * 0.7) ** 2;
        for (const b of agents) {
            if (b === a) continue;
            const d = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    }

    function drawDrag() {
        if (!gesture || gesture.type !== 'agent' || !gesture.moved) return;
        const a = gesture.agent;
        const b = dropTarget(a);
        ctx.textAlign = 'center';
        ctx.font = sans(11, '600');
        if (b) {
            rr(b.x - L.cardW / 2 - 6, b.y - L.cardH / 2 - 6, L.cardW + 12, L.cardH + 12, 10);
            ctx.strokeStyle = rgba(b.color, 0.9);
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = C.text;
            ctx.fillText(`Let go to pair ${a.name} with ${b.name}`, b.x, b.y - L.cardH / 2 - 14 * L.s);
        } else {
            ctx.fillStyle = C.muted;
            ctx.fillText('Drop on a teammate to pair them up', a.x, a.y - L.cardH / 2 - 12 * L.s);
        }
    }

    function drawAgent(a) {
        const w = L.cardW, h = L.cardH, s = L.s;
        const x0 = a.x - w / 2, y0 = a.y - h / 2;
        const hot = (hovered && hovered.obj === a) || !!a.drag;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        rr(x0 + 1, y0 + 3, w, h, 8);
        ctx.fill();
        rr(x0, y0, w, h, 8);
        ctx.fillStyle = hot ? C.cardHot : C.card;
        ctx.fill();
        ctx.strokeStyle = rgba(a.color, 0.28 + 0.55 * Math.max(a.flash * 0.7, hot ? 1 : 0));
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = a.color;
        ctx.fillRect(x0, y0 + 7, 3, h - 14);

        ctx.textBaseline = 'middle';
        const nameY = y0 + (L.tiny ? h * 0.32 : 15 * s);
        ctx.textAlign = 'left';
        ctx.font = sans(L.tiny ? 9.5 : 11.5, '600');
        ctx.fillStyle = C.text;
        ctx.fillText(fitText(a.name, w - 18 * s), x0 + 10 * s, nameY);
        if (!L.tiny) {
            ctx.textAlign = 'right';
            ctx.font = sans(9);
            ctx.fillStyle = C.faint;
            ctx.fillText(modelById[a.model].name.replace(' model', ''), x0 + w - 9 * s, nameY);
        }

        // a small boxed neural net that is busy when the agent is
        const bh = L.tiny ? h * 0.42 : h - 30 * s;
        const bw = Math.min(bh * 1.4, w * 0.3);
        const bx = x0 + 10 * s, by = L.tiny ? y0 + h * 0.5 : y0 + 23 * s;
        rr(bx, by, bw, bh, 3);
        ctx.fillStyle = '#0e1626';
        ctx.fill();
        ctx.strokeStyle = C.line;
        ctx.stroke();
        const cols = a.mini.length;
        const pos = a.mini.map((layer, li) => layer.map((_, j) => ({
            x: bx + bw * (0.18 + (0.64 * li) / (cols - 1)),
            y: by + bh * (layer.length === 1 ? 0.5 : 0.2 + (0.6 * j) / (layer.length - 1)),
        })));
        ctx.lineWidth = 0.6;
        for (let li = 0; li < cols - 1; li++) {
            for (let i = 0; i < pos[li].length; i++) for (let j = 0; j < pos[li + 1].length; j++) {
                ctx.strokeStyle = rgba(a.color, 0.1 + 0.35 * (a.mini[li][i].a + a.mini[li + 1][j].a) / 2);
                ctx.beginPath();
                ctx.moveTo(pos[li][i].x, pos[li][i].y);
                ctx.lineTo(pos[li + 1][j].x, pos[li + 1][j].y);
                ctx.stroke();
            }
        }
        const nr = Math.max(1.2, bh / 14);
        for (let li = 0; li < cols; li++) for (let i = 0; i < pos[li].length; i++) {
            ctx.fillStyle = rgba(a.color, 0.3 + 0.7 * a.mini[li][i].a);
            ctx.beginPath();
            ctx.arc(pos[li][i].x, pos[li][i].y, nr, 0, TAU);
            ctx.fill();
        }

        if (!L.tiny) {
            const tx = bx + bw + 8 * s, tw = x0 + w - 9 * s - tx;
            ctx.textAlign = 'left';
            ctx.font = sans(10);
            ctx.fillStyle = a.task || a.helping ? C.text : C.muted;
            ctx.fillText(fitText(a.status.slice(0, Math.ceil(a.shown)), tw), tx, by + bh * 0.3);
            // progress bar for the task, or a quiet bar when idle
            const barY = by + bh - 4 * s;
            rr(tx, barY, tw, 4 * s, 2);
            ctx.fillStyle = C.track;
            ctx.fill();
            if (a.task) {
                rr(tx, barY, Math.max(4 * s, tw * a.task.progress), 4 * s, 2);
                ctx.fillStyle = a.color;
                ctx.fill();
            }
        }
        ctx.textBaseline = 'alphabetic';
    }

    // Speech bubbles sit on the side of the card that faces the middle, so they don't cover the plan.
    function drawBubble(a) {
        const b = a.bubble;
        if (!b || t > b.until) return;
        const s = L.s;
        const alpha = Math.min(1, (t - b.t0) / 0.4, (b.until - t) / 0.6);
        if (alpha <= 0) return;
        ctx.font = sans(10.5);
        const maxW = Math.min(250 * s, Math.max(140, L.rx * 0.75));
        if (b.lw !== maxW) { b.lines = wrap(b.text, maxW - 20 * s, 3); b.lw = maxW; }
        const lh = 14 * s;
        const bw = Math.min(maxW, Math.max(...b.lines.map((l) => ctx.measureText(l).width)) + 20 * s, maxW);
        const bh = b.lines.length * lh + 26 * s;
        let x, y;
        if (a.isHub) {
            x = a.x - bw / 2;
            y = a.y - L.coreR * 1.2 - bh - 8 * s;
        } else {
            const dx = L.cx - a.x, dy = L.cy - a.y;
            if (Math.abs(dy) > Math.abs(dx) * 0.45) {
                x = a.x - bw / 2;
                y = dy > 0 ? a.y + L.cardH / 2 + 8 * s : a.y - L.cardH / 2 - bh - 8 * s;
            } else {
                y = a.y - bh / 2;
                x = dx > 0 ? a.x + L.cardW / 2 + 10 * s : a.x - L.cardW / 2 - bw - 10 * s;
            }
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        rr(x + 1, y + 3, bw, bh, 8);
        ctx.fill();
        rr(x, y, bw, bh, 8);
        ctx.fillStyle = '#1a2640';
        ctx.fill();
        ctx.strokeStyle = rgba(a.color, 0.6);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = sans(9.5, '600');
        ctx.fillStyle = a.color;
        ctx.fillText(`${a.name} → ${b.to.name}`, x + 10 * s, y + 7 * s);
        ctx.font = sans(10.5);
        ctx.fillStyle = C.text;
        b.lines.forEach((l, i) => ctx.fillText(l, x + 10 * s, y + 21 * s + i * lh));
        ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- side panels
    function sizeCanvas(cv) {
        const r = cv.getBoundingClientRect();
        if (!r.width) return;
        cv.width = Math.round(r.width * DPR);
        cv.height = Math.round(r.height * DPR);
    }
    function chartCtx(cv) {
        const w = cv.width / DPR, h = cv.height / DPR;
        if (!w) return null;
        const g = cv.getContext('2d');
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        g.clearRect(0, 0, w, h);
        return { g, w, h };
    }

    function drawSpendChart() {
        const c = chartCtx($('c-spend'));
        if (!c) return;
        const { g, w, h } = c;
        const data = stats.spendHist;
        const pad = { l: 10, r: 52, t: 10, b: 18 };
        const max = Math.max(0.01, ...data) * 1.15;
        const X = (i) => pad.l + (i / 179) * (w - pad.l - pad.r);
        const Y = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);
        g.strokeStyle = 'rgba(131,145,167,0.15)';
        g.fillStyle = C.faint;
        g.font = `${Math.round(9 * L.s)}px ${MONO}`;
        g.textAlign = 'left';
        for (let k = 0; k <= 2; k++) {
            const v = (max * k) / 2;
            g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(w - pad.r, Y(v)); g.stroke();
            g.fillText(money(v), w - pad.r + 6, Y(v) + 3);
        }
        g.font = `${Math.round(9 * L.s)}px ${SANS}`;
        g.fillText('3 min ago', pad.l, h - 5);
        g.textAlign = 'right';
        g.fillText('now', w - pad.r, h - 5);
        if (data.length < 2) return;
        const off = 180 - data.length;
        g.beginPath();
        data.forEach((v, i) => (i ? g.lineTo(X(i + off), Y(v)) : g.moveTo(X(i + off), Y(v))));
        g.strokeStyle = C.accent;
        g.lineWidth = 1.6;
        g.stroke();
        g.lineTo(X(179), h - pad.b);
        g.lineTo(X(off), h - pad.b);
        g.closePath();
        g.fillStyle = 'rgba(91,141,239,0.12)';
        g.fill();
    }

    function drawAgentBars() {
        const c = chartCtx($('c-agents'));
        if (!c) return;
        const { g, w, h } = c;
        const rows = [...agents, hub].sort((a, b) => b.spend - a.spend).slice(0, 8);
        const max = Math.max(0.0001, rows[0].spend);
        const rowH = (h - 12) / 8;
        const labelW = 82 * L.s, valueW = 54 * L.s;
        g.font = `${Math.round(9.5 * L.s)}px ${SANS}`;
        g.textBaseline = 'middle';
        rows.forEach((a, i) => {
            const y = 6 + i * rowH + rowH / 2;
            g.textAlign = 'left';
            g.fillStyle = C.text;
            g.fillText(a.name, 10, y);
            const bw = (w - labelW - valueW - 20) * (a.spend / max);
            g.fillStyle = C.track;
            g.fillRect(10 + labelW, y - 4, w - labelW - valueW - 20, 8);
            g.fillStyle = a.color;
            g.fillRect(10 + labelW, y - 4, Math.max(1, bw), 8);
            g.textAlign = 'right';
            g.fillStyle = C.muted;
            g.font = `${Math.round(9 * L.s)}px ${MONO}`;
            g.fillText(money(a.spend), w - 8, y);
            g.font = `${Math.round(9.5 * L.s)}px ${SANS}`;
        });
    }

    function fmtDur(sec) {
        const s = Math.max(0, Math.round(sec));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function drawProgressChart() {
        const c = chartCtx($('c-progress'));
        if (!c || !plan) return;
        const { g, w, h } = c;
        const pad = { l: 34, r: 10, t: 10, b: 18 };
        const span = plan.plannedDur * 1.05;
        const X = (sec) => pad.l + (sec / span) * (w - pad.l - pad.r);
        const Y = (v) => h - pad.b - v * (h - pad.t - pad.b);
        g.strokeStyle = 'rgba(131,145,167,0.15)';
        g.fillStyle = C.faint;
        g.font = `${Math.round(9 * L.s)}px ${MONO}`;
        g.textAlign = 'right';
        for (const v of [0, 0.5, 1]) {
            g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(w - pad.r, Y(v)); g.stroke();
            g.fillText(Math.round(v * 100) + '%', pad.l - 5, Y(v) + 3);
        }
        g.font = `${Math.round(9 * L.s)}px ${SANS}`;
        g.textAlign = 'left';
        g.fillText('start', pad.l, h - 5);
        g.textAlign = 'right';
        g.fillText(`planned finish ${fmtDur(plan.plannedDur)}`, w - pad.r, h - 5);
        g.setLineDash([4, 4]);
        g.strokeStyle = C.muted;
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(plan.plannedDur), Y(1)); g.stroke();
        g.setLineDash([]);
        const pts = plan.hist.slice();
        const elapsed = (plan.doneAt || t) - plan.born;
        pts.push([elapsed, plan.done / plan.tasks.length]);
        g.strokeStyle = C.ok;
        g.lineWidth = 2;
        g.beginPath();
        pts.forEach(([sec, v], i) => (i ? g.lineTo(X(Math.min(sec, span)), Y(v)) : g.moveTo(X(sec), Y(v))));
        g.stroke();
        const actual = plan.done / plan.tasks.length;
        const ahead = plan.plannedDur * actual - elapsed;
        $('progress-label').textContent = plan.doneAt
            ? `Finished in ${fmtDur(elapsed)}, ${ahead > 0 ? fmtDur(ahead) + ' ahead of plan' : 'on plan'}`
            : actual === 0 ? 'Just getting started' : ahead >= 0 ? `About ${fmtDur(ahead)} ahead of plan` : `About ${fmtDur(-ahead)} behind plan`;
    }

    // The model fleet: each model drawn as a boxed neural net, busier the more it is being used.
    function buildFleet() {
        const el = $('fleet');
        el.innerHTML = '';
        for (const m of MODELS) {
            const card = document.createElement('div');
            card.className = 'model';
            const head = document.createElement('div');
            head.className = 'model-head';
            const name = document.createElement('b');
            name.textContent = m.name;
            const note = document.createElement('small');
            note.textContent = m.note;
            head.append(name, note);
            m.cv = document.createElement('canvas');
            const st = document.createElement('div');
            st.className = 'model-stats';
            m.stEls = ['Response', 'Requests/min', 'Cost/hour'].map((label) => {
                const span = document.createElement('span');
                const b = document.createElement('b');
                b.className = 'num';
                span.append(label + ' ', b);
                st.append(span);
                return b;
            });
            card.append(head, m.cv, st);
            el.append(card);
        }
    }

    function drawFleet() {
        for (const m of MODELS) {
            const c = chartCtx(m.cv);
            if (!c) continue;
            const { g, w, h } = c;
            const n = m.layers.length;
            const colW = (w - 16) / n;
            const boxW = Math.min(colW * 0.62, 64 * L.s);
            const boxH = h - 20;
            const pos = m.layers.map(([, k], li) => {
                const bx = 8 + colW * li + (colW - boxW) / 2;
                return Array.from({ length: k }, (_, j) => ({ x: bx + boxW / 2, y: 6 + boxH * ((j + 0.5) / k), bx }));
            });
            g.lineWidth = 0.6;
            for (let li = 0; li < n - 1; li++) {
                for (const p of pos[li]) for (const q of pos[li + 1]) {
                    g.strokeStyle = `rgba(91,141,239,${0.08 + 0.2 * m.act})`;
                    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
                }
            }
            m.layers.forEach(([label], li) => {
                const bx = pos[li][0].bx;
                g.fillStyle = '#0e1626';
                g.strokeStyle = C.line;
                g.beginPath();
                if (g.roundRect) g.roundRect(bx, 2, boxW, boxH + 8, 5); else g.rect(bx, 2, boxW, boxH + 8);
                g.fill();
                g.stroke();
                pos[li].forEach((p, j) => {
                    const wave = 0.5 + 0.5 * Math.sin(m.phase * 2.2 - li * 1.1 + j * 0.9);
                    const a = 0.15 + 0.85 * wave * (0.2 + 0.8 * m.act);
                    g.fillStyle = `rgba(91,141,239,${a})`;
                    g.beginPath();
                    g.arc(p.x, p.y, Math.min(5, boxH / (m.layers[li][1] * 3.2)), 0, TAU);
                    g.fill();
                });
                g.fillStyle = C.faint;
                g.font = `${Math.round(8.5 * L.s)}px ${SANS}`;
                g.textAlign = 'center';
                g.fillText(label, bx + boxW / 2, h - 1);
            });
        }
    }

    // ---------------------------------------------------------------- DOM HUD
    const logEl = $('log');
    const tip = $('tip');
    const toastEl = $('toast');
    const cmdForm = $('cmd');
    const cmdInput = $('cmd-input');
    const helpEl = $('help');

    function clock() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    function el(tag, cls, text, color) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        if (color) e.style.color = color;
        return e;
    }
    function pushLog(li) {
        logEl.appendChild(li);
        while (logEl.children.length > 40) logEl.removeChild(logEl.firstChild);
    }
    function chat(from, to, text) {
        const li = el('li');
        const who = el('span', 'who');
        who.append(el('b', '', from.name, from.color), el('span', '', '→'), el('span', '', to.name), el('span', 'ts num', clock()));
        li.append(who, el('span', 'text', text));
        pushLog(li);
    }
    function sysChat(text, fromYou) {
        const li = el('li', fromYou ? 'sys you' : 'sys');
        const who = el('span', 'who');
        who.append(el('b', '', fromYou ? 'You' : 'Workspace'), el('span', 'ts num', clock()));
        li.append(who, el('span', 'text', text));
        pushLog(li);
    }

    let toastTimer = 0;
    function toast(text) {
        toastEl.textContent = text;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4200);
    }

    let hudNext = 0;
    function updateHud(raw) {
        hudNext -= raw;
        if (hudNext > 0) return;
        hudNext = 0.25;
        const rate = stats.hist.reduce((a, b) => a + b, 0) * (3600 / Math.max(1, stats.hist.length)) * SPEEDS[speedIdx];
        $('spend-top').textContent = money(stats.spend);
        $('spend').textContent = money(stats.spend);
        $('spend-rate').textContent = `≈ ${money(rate, 0)} per hour at this pace`;
        const month = stats.monthBase + stats.spend;
        $('budget-bar').style.width = Math.min(100, (month / stats.budget) * 100) + '%';
        $('budget-label').textContent = `This month: ${money(month)} of ${money(stats.budget, 0)} budget`;
        stats.msgTimes = stats.msgTimes.filter((x) => x > t - 60);
        $('m-tasks').textContent = stats.tasksDone;
        $('m-msgs').textContent = Math.round((stats.msgTimes.length * 60) / Math.min(60, Math.max(10, t)));
        const lat = MODELS.reduce((sum, m) => sum + m.base * (1 + 0.25 * m.act), 0) / MODELS.length;
        $('m-latency').textContent = lat.toFixed(1) + ' s';
        $('m-tokens').textContent = Math.round(stats.tokens).toLocaleString('en-US');
        for (const m of MODELS) {
            if (!m.stEls) continue;
            m.reqTimes = m.reqTimes.filter((x) => x > t - 60);
            const mrate = m.hist.reduce((a, b) => a + b, 0) * (3600 / Math.max(1, m.hist.length)) * SPEEDS[speedIdx];
            m.stEls[0].textContent = (m.base * (1 + 0.25 * m.act)).toFixed(1) + ' s';
            m.stEls[1].textContent = String(Math.round((m.reqTimes.length * 60) / Math.min(60, Math.max(10, t))));
            m.stEls[2].textContent = money(mrate, 2);
        }
        const zoom = Math.abs(cam.z - 1) > 0.02 ? ` · ${cam.z.toFixed(1)}× zoom` : '';
        $('clock').textContent = clock() + zoom;
        fillTip();
    }

    let tipFor = null;
    function fillTip() {
        tipFor = hovered ? hovered.obj : null;
        if (!hovered || (gesture && gesture.moved)) { tip.hidden = true; return; }
        tip.hidden = false;
        tip.innerHTML = '';
        const row = (label, value) => { const d = el('div', 'row'); d.append(el('span', '', label), el('span', 'num', value)); return d; };
        if (hovered.kind === 'agent' || hovered.kind === 'hub') {
            const a = hovered.obj;
            tip.style.setProperty('--tip', a.color);
            tip.append(el('div', 't-name', a.name), el('div', 't-role', a.job),
                row('Doing', a.status), row('Model', modelById[a.model].name),
                row('Messages sent', String(a.sent)), row('Tokens used', Math.round(a.tokIn + a.tokOut).toLocaleString('en-US')),
                row('Cost so far', money(a.spend)),
                el('div', 't-hint', a.isHub ? 'Click to ask everyone for an update' : 'Click to ask for an update · drag onto a teammate to pair up'));
            if (a.task) tip.insertBefore(row('Task', `${a.task.name} (${Math.round(a.task.progress * 100)}%)`), tip.children[3]);
        } else {
            const k = hovered.obj;
            tip.style.setProperty('--tip', k.owner.color);
            const state = { pending: 'Waiting', assigning: 'Being handed out', active: 'In progress', done: 'Done' }[k.state];
            tip.append(el('div', 't-name', k.name), el('div', 't-role', `${STAGE_NAMES[k.phase]} stage · ${k.owner.name}, with help from ${k.helper.name}`),
                row('Status', state), row('Progress', Math.round(k.progress * 100) + '%'),
                el('div', 't-hint', k.state === 'done' ? k.result : 'Click to make this the top priority'));
        }
        placeTip();
    }
    function placeTip() {
        if (!hovered || tip.hidden) return;
        const o = hovered.obj;
        let wx, wy, gap;
        if (hovered.kind === 'task') { if (!o.rect) return; wx = o.rect.x + o.rect.w / 2; wy = o.rect.y + o.rect.h; gap = 0; }
        else if (hovered.kind === 'hub') { wx = L.cx + L.coreR * 1.2; wy = L.cy; gap = 10; }
        else { wx = o.x + L.cardW / 2; wy = o.y; gap = 10; }
        const p = toScreen(wx, wy);
        const tw = tip.offsetWidth || 240, th = tip.offsetHeight || 160;
        let x = hovered.kind === 'task' ? p.x - tw / 2 : p.x + gap;
        if (x + tw > W - 8) x = toScreen(hovered.kind === 'agent' ? o.x - L.cardW / 2 : wx, wy).x - gap - tw;
        tip.style.left = clamp(x, 8, W - tw - 8) + 'px';
        tip.style.top = clamp(hovered.kind === 'task' ? p.y + 8 : p.y - th / 2, 60, H - th - 8) + 'px';
    }

    // ---------------------------------------------------------------- input
    function findAgent(wx, wy) {
        for (let i = agents.length - 1; i >= 0; i--) {
            const a = agents[i];
            if (Math.abs(a.x - wx) <= L.cardW / 2 + 4 && Math.abs(a.y - wy) <= L.cardH / 2 + 4) return a;
        }
        return null;
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
        if ((w.x - L.cx) ** 2 + (w.y - L.cy) ** 2 < (L.coreR * 1.25) ** 2) return { kind: 'hub', obj: hub };
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
        // a mouse grabs an agent at once; a finger has to hold still first, so swiping still moves the view
        gesture = { type: onAgent ? (touch ? 'press' : 'agent') : 'pan', hit, agent: onAgent ? hit.obj : null, touch,
            sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, camx: cam.x, camy: cam.y, moved: false, t0: performance.now() };
    });

    canvas.addEventListener('pointermove', (e) => {
        mouse.sx = e.clientX;
        mouse.sy = e.clientY;
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
            if (gesture.type === 'press') gesture.type = 'pan';
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

    function pickUp(g) {
        g.type = 'agent';
        g.moved = true;
        g.agent.drag = toWorld(g.lx, g.ly);
        tip.hidden = true;
        if (navigator.vibrate) navigator.vibrate(12);
    }

    let lastTap = null;
    function pointerEnd(e, cancelled) {
        pointers.delete(e.pointerId);
        const g = gesture;
        if (!g) return;
        if (g.type === 'pinch') { if (pointers.size === 0) gesture = null; return; }
        gesture = null;
        if (g.type === 'press') { if (!cancelled) askAgent(g.agent); return; }
        if (g.type === 'agent') {
            const a = g.agent;
            const b = g.moved ? dropTarget(a) : null;
            a.drag = null;
            if (cancelled) return;
            if (!g.moved) askAgent(a);
            else if (b) pairUp(a, b);
            return;
        }
        if (cancelled || g.moved) return;
        if (g.hit && g.hit.kind === 'task') prioritise(g.hit.obj);
        else if (g.hit && g.hit.kind === 'hub') statusRound();
        else if (g.touch) {
            // double tap on empty space zooms in, or back out
            const now = performance.now();
            if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
                lastTap = null;
                if (cam.z > 1.4) resetView(); else zoomAt(e.clientX, e.clientY, 2);
            } else lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
    }
    canvas.addEventListener('pointerup', (e) => pointerEnd(e, false));
    canvas.addEventListener('pointercancel', (e) => pointerEnd(e, true));
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointers.size) mouse.sx = mouse.sy = -1e4; });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomAt(e.clientX, e.clientY, cam.z * Math.exp(-step * 0.0015));
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    cmdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = cmdInput.value.trim().replace(/\s+/g, ' ');
        if (!text) { cmdInput.placeholder = `Try: ${pick(GOALS)}`; return; }
        cmdInput.value = '';
        cmdInput.blur();
        sysChat(`You set a new goal`, true);
        newPlan(text.charAt(0).toUpperCase() + text.slice(1));
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
        $('btn-hud').textContent = off ? 'Show panels' : 'Hide panels';
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
        else if (k >= '1' && k <= '4') setSpeed(Number(k) - 1);
        else if (k === '0') resetView();
        else if (k === '+' || k === '=') zoomAt(W / 2, H / 2, cam.z * 1.2);
        else if (k === '-' || k === '_') zoomAt(W / 2, H / 2, cam.z / 1.2);
    });
    window.addEventListener('resize', layout);

    // ---------------------------------------------------------------- loop
    let last = performance.now();
    let chartsNext = 0;
    function frame(now) {
        const raw = Math.min(0.05, (now - last) / 1000);
        last = now;
        const dt = paused ? 0 : raw * SPEEDS[speedIdx];
        if (dt > 0) {
            t += dt;
            update(dt);
        }
        moveAgents(raw);
        if (gesture && gesture.type === 'press' && performance.now() - gesture.t0 > 380) pickUp(gesture);
        if (gesture && gesture.moved) canvas.style.cursor = gesture.type === 'agent' ? 'grabbing' : 'move';
        else {
            hovered = hitTest(mouse.sx, mouse.sy);
            canvas.style.cursor = hovered ? 'pointer' : '';
        }
        if (hovered ? hovered.obj !== tipFor : tipFor) fillTip();
        else placeTip();
        draw();
        chartsNext -= raw;
        if (panelsOn && chartsNext <= 0) {
            chartsNext = 1 / 15;
            drawSpendChart();
            drawAgentBars();
            drawProgressChart();
            drawFleet();
        }
        updateHud(raw);
        requestAnimationFrame(frame);
    }

    buildFleet();
    setSpeed(speedIdx);
    cmdInput.placeholder = `Give the team a goal, e.g. "${pick(GOALS)}"`;
    layout();
    sysChat('Workspace ready. 9 agents online.');
    after(1, () => newPlan(GOALS[goalIdx]));
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setTimeout(() => toast(coarse
        ? 'Tap an agent to ask what it is doing · hold and drag to pair agents up · ? for more'
        : 'Click an agent to ask what it is doing · drag one onto another to pair them up · ? for more'), 6000);
    requestAnimationFrame(frame);
})();
