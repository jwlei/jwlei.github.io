/* Breachline: mash keys on the left, watch the "hack" happen on the right.
   Type a phase at your own pace, press Enter to run it, and watch its output and its scene play out. */
(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const TAU = Math.PI * 2;
    const MONO = '"JetBrains Mono","Cascadia Code","SF Mono",Consolas,Menlo,monospace';
    const G = '#39ff88', AMBER = '#ffb020', RED = '#ff4060', CYAN = '#4de1ff', WHITE = '#e9fff1';
    const rand = (a, b) => a + Math.random() * (b - a);
    const randi = (a, b) => Math.floor(rand(a, b + 1));
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, k) => a + (b - a) * k;
    const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');
    const GLYPHS = '#$%&@*+=<>?/\\|01ABCDEFabcdef{}[]~^';
    const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
    function rgba(h, a) {
        const n = parseInt(h.slice(1), 16);
        return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
    }

    // Fictional targets on the reserved .example domain.
    const TARGETS = [
        { name: 'Umbral Dynamics', host: 'gw.umbral.example' },
        { name: 'Oberon Deep Storage', host: 'vault.oberon.example' },
        { name: 'Halcyon Grid Authority', host: 'scada.halcyon.example' },
        { name: 'Nimbus Orbital Freight', host: 'ops.nimbus.example' },
        { name: 'Vesper Mutual', host: 'core.vesper.example' },
        { name: 'Cobalt Archive Trust', host: 'files.cobalt.example' },
    ];

    // ------------------------------------------------------------------ the script
    // Fictional "ghostwire" toolkit: reads like a movie hack, does nothing real.
    const STAGES = [
        { id: 'recon', name: 'RECON', title: 'Map the perimeter', feed: [
            ['info', 'passive sweep of 10.44.0.0/16 started'], ['ok', '[+] gateway candidate found'], ['ok', '[+] {n} live hosts mapped'], ['warn', '[!] 2 honeypots flagged and skipped']],
          code: `#!/usr/bin/env ghost
# ghostwire v4.2 :: operator session
from ghostwire import recon, net, crypto, ops
from ghostwire.stealth import Mask, Jitter

TARGET = "{HOST}"
mask = Mask(hops=7, jitter=Jitter(120, 340))

async def map_perimeter(cidr):
    sweep = recon.Sweep(cidr, mask=mask, passive=True)
    async for host in sweep.discover():
        if host.alive and not host.honeypot:
            ops.mark(host, tag="perimeter")
            yield host

perimeter = [h async for h in map_perimeter("10.44.0.0/16")]
print(f"[+] {len(perimeter)} live hosts behind {TARGET}")
` },
        { id: 'ports', name: 'PORT SCAN', title: 'Knock on every door, quietly', feed: [
            ['info', 'SYN probes jittered 80–340 ms'], ['ok', '[+] 22/tcp open  ssh'], ['ok', '[+] 443/tcp open  https'], ['ok', '[+] 6379/tcp open  redis (no auth!)']],
          code: `# --- phase 2: knock on every door, quietly
def knock(host, ports=range(1, 1024)):
    open_ports = []
    for port in net.shuffle(ports):
        probe = net.Probe(host, port, flags="SYN", ttl=mask.ttl())
        if probe.send(timeout=0.08).reply == "SYN-ACK":
            open_ports.append((port, net.banner(host, port)))
        mask.sleep()
    return open_ports

gateway = recon.pick(perimeter, role="gateway")
doors = knock(gateway)
for port, banner in doors:
    print(f"    {port:>5}/tcp  open  {banner}")
` },
        { id: 'wall', name: 'FIREWALL', title: 'Take down the wall', feed: [
            ['info', 'ruleset dumped: 128 rules'], ['warn', '[~] rule 0042 neutralised'], ['warn', '[~] rule 0097 neutralised'], ['ok', '[+] firewall breached, tunnel up on :4443']],
          code: `# --- phase 3: the wall
wall = net.Firewall(gateway, vendor=recon.fingerprint(gateway))
rules = wall.dump_ruleset(via=doors[0])

for rule in rules.sorted(by="priority"):
    if rule.action == "DROP" and rule.matches(mask.signature):
        shim = crypto.forge_rule(rule, allow=mask.signature)
        wall.inject(shim, position=rule.index - 1)
        print(f"[~] rule {rule.index:04d} neutralised")

assert wall.lets_through(mask), "wall still standing"
print("[+] firewall breached :: tunnel up on", wall.tunnel.port)
` },
        { id: 'crack', name: 'CREDENTIALS', title: 'Borrow an identity', feed: [
            ['info', 'target: svc_backup (last login 211 days ago)'], ['info', '8 GPUs rented in region "nowhere"'], ['warn', '[~] 41.7 GH/s, 1.2 trillion tried'], ['ok', '[+] password recovered, logged in as svc_backup']],
          code: `# --- phase 4: borrow an identity
vault = ops.connect(gateway, tunnel=wall.tunnel)
user = vault.find_service_account(pattern="svc_*", least_watched=True)

cracker = crypto.Cracker(
    target=user.hash,
    wordlists=["corp_leaks.txt", "seasons+years.rules"],
    gpus=crypto.rent(8, region="nowhere"),
)
while not cracker.done:
    cracker.step(batch=2**24)
    ops.status(f"{cracker.rate} H/s :: {cracker.tried:,} tried")

session = vault.login(user.name, cracker.result)
print(f"[+] logged in as {user.name}")
` },
        { id: 'cams', name: 'CAMERAS', title: 'Blind the eyes', feed: [
            ['info', '6 cameras on the facility bus'], ['warn', '[~] CAM-02 looping 90 s of nothing'], ['warn', '[~] CAM-05 looping 90 s of nothing'], ['ok', '[+] facility blind, guards watching reruns']],
          code: `# --- phase 5: blind the eyes
cams = session.facility.cameras(zone="all")
for cam in cams:
    feed = cam.record(seconds=90)
    loop = ops.Loop(feed, crossfade=0.4, timestamp="live")
    cam.substitute(loop)
    ops.log(f"[~] {cam.id} looping {loop.duration}s of nothing")

assert all(c.substituted for c in cams)
print("[+] facility blind. guards watching reruns")
` },
        { id: 'decrypt', name: 'DECRYPT', title: 'Open the files', feed: [
            ['info', 'orpheus.enc: AES-256-GCM, 600k rounds'], ['warn', '[~] master key derived from keyring'], ['ok', '[+] archive decrypted: 12 lines of trouble']],
          code: `# --- phase 6: open the files
archive = session.fs.open("/srv/archive/orpheus.enc")
key = crypto.derive(
    session.keyring.get("archive-master"),
    salt=archive.header.salt,
    rounds=archive.header.rounds,
)
plain = crypto.AES256_GCM(key).decrypt(archive.body)
for line in plain.splitlines()[:12]:
    print("    |", line)
` },
        { id: 'exfil', name: 'EXFILTRATE', title: 'Take what we came for', feed: [
            ['info', 'dead drop: ghost://relay-7 (disguised as a video stream)'], ['ok', '[>] orpheus_budget.pdf sent'], ['ok', '[>] board_minutes.db sent'], ['ok', '[+] exfil complete: 4.7 GB at the drop']],
          code: `# --- phase 7: take what we came for
drop = net.DeadDrop("ghost://relay-7", chunk=64 * 1024)
payload = session.fs.glob("/srv/archive/**/*.{pdf,db,key}")

with drop.channel(cover="video-stream") as ch:
    for f in payload:
        for chunk in f.chunks(drop.chunk):
            ch.send(crypto.seal(chunk, mask.key))
        ops.log(f"[>] {f.name:<28} {f.size_h:>8} sent")

print(f"[+] exfil complete :: {drop.received_h} at the drop")
` },
        { id: 'sat', name: 'UPLINK', title: 'Buy some sky', feed: [
            ['info', 'leased LEO relay KESTREL-9'], ['warn', '[~] slewing 41° to the target region'], ['ok', '[+] uplink 97%, traffic now bounces off orbit']],
          code: `# --- phase 8: buy some sky
sat = net.uplink.acquire(constellation="LEO-relay", lease="borrowed")
sat.slew(to=recon.geo(gateway), max_rate=0.6)
while sat.signal < 0.95:
    sat.trim(azimuth=+0.02, elevation=-0.01)
    ops.status(f"uplink {sat.signal:.0%}")

ops.reroute(mask, via=sat)
print("[+] traffic now bounces off", sat.callsign)
` },
        { id: 'clean', name: 'COVER TRACKS', title: 'We were never here', feed: [
            ['info', 'auditing 14 log streams since session start'], ['warn', '[~] 9 entries rewritten as routine noise'], ['ok', '[+] tracks covered, integrity checks green']],
          code: `# --- phase 9: we were never here
for log in session.host.logs(since=ops.session_start):
    for entry in log.entries():
        if mask.signature in entry or entry.src in mask.hops:
            log.redact(entry, replace_with=log.forge_benign(entry))
    log.rehash()

session.host.shell_history.clear()
wall.restore(original=rules)
print("[+] tracks covered :: integrity checks green")
` },
        { id: 'root', name: 'ROOT', title: 'The keys to everything', feed: [
            ['warn', '[~] kernel path chosen over sudo cache'], ['ok', '[+] uid=0(root) gid=0(root)'], ['ok', '[+] ACCESS GRANTED']],
          code: `# --- phase 10: the keys to everything
root = session.escalate(method="kernel", fallback="sudo-cache")
assert root.uid == 0

ops.persist(root, implant=None)  # no souvenirs
print("\\n  ACCESS GRANTED :: root@" + TARGET)
print("  time to coffee:", ops.elapsed())
` },
    ];

    // ------------------------------------------------------------------ syntax highlighting
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const TOKEN = /(#.*$)|(f?"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|\b(\d[\d_.]*)\b|\b(from|import|as|def|async|await|for|in|if|not|and|or|return|yield|while|with|assert|True|False|None|lambda)\b|([A-Za-z_]\w*)(?=\()|\b([A-Z][A-Z0-9_]{2,})\b/g;
    function highlight(line) {
        let out = '', last = 0;
        line.replace(TOKEN, (m, c, s, n, k, f, K, off) => {
            out += esc(line.slice(last, off));
            const cls = c ? 'c' : s ? 's' : n ? 'n' : k ? 'k' : f ? 'f' : 'K';
            out += `<span class="${cls}">${esc(m)}</span>`;
            last = off + m.length;
            return m;
        });
        return out + esc(line.slice(last));
    }

    // ------------------------------------------------------------------ program output
    // What each phase prints to the terminal while it runs, one line at a time.
    const OUT = {
        recon: ['ghost: routing through 7 hops (jitter 120-340 ms)', '[*] passive sweep of 10.44.0.0/16 started',
            '[*] 10.44.3.17     up    linux 6.1          <- gateway?', '[*] 10.44.3.22     up    linux 6.1',
            '[*] 10.44.7.104    up    windows srv 2022', '[!] 10.44.9.200    honeypot signature, skipped', '[+] 27 live hosts behind {HOST}'],
        ports: ['[*] SYN scan 1-1023 on 10.44.3.17, randomised order', '       22/tcp  open  ssh        OpenSSH 9.6',
            '       80/tcp  open  http       nginx 1.25', '      443/tcp  open  https      nginx 1.25',
            '     3306/tcp  open  mysql      MariaDB 10.11', '     6379/tcp  open  redis      Redis 7.2 (no auth)', '[+] 7 open, 1016 filtered'],
        wall: ['[*] vendor fingerprint: Palisade NGFW 11.2', '[*] ruleset dumped: 128 rules', '[~] rule 0042 neutralised',
            '[~] rule 0097 neutralised', '[~] rule 0113 neutralised', '[+] firewall breached :: tunnel up on 4443'],
        crack: ['[*] service account: svc_backup (last login 211 days ago)', '[*] 8 GPUs online, hash: sha512crypt',
            '[~] 38.9 GH/s :: 412,331,008,512 tried', '[~] 41.2 GH/s :: 1,207,912,448,000 tried', '[+] match after 14m 02s', '[+] logged in as svc_backup'],
        cams: ['[*] 6 cameras on the facility bus (zone=all)', '[~] CAM-01 looping 90s of nothing', '[~] CAM-02 looping 90s of nothing',
            '[~] CAM-03 looping 90s of nothing', '[~] CAM-04 looping 90s of nothing', '[~] CAM-05 looping 90s of nothing',
            '[~] CAM-06 looping 90s of nothing', '[+] facility blind. guards watching reruns'],
        decrypt: ['[*] orpheus.enc  AES-256-GCM  600,000 rounds', '[*] deriving key from keyring "archive-master"',
            '    | ORPHEUS // EYES ONLY', '    | phase 3 budget ........ 41.2M', '    | board vote ............ 6-1 in favour', '    | status ................ GREENLIT'],
        exfil: ['[*] dead drop ghost://relay-7 (cover: video-stream)', '[>] orpheus_budget.pdf            38 MB sent',
            '[>] board_minutes.db             912 MB sent', '[>] relay_sites.kml                6 MB sent', '[>] payroll_2026.db              1.5 GB sent',
            '[>] gardener_comms.mbox           2.2 GB sent', '[+] exfil complete :: 4.7 GB at the drop'],
        sat: ['[*] leased LEO relay KESTREL-9', '[*] slewing 41.2 deg toward the target region', '[~] uplink 38%', '[~] uplink 71%', '[~] uplink 97%',
            '[+] traffic now bounces off KESTREL-9'],
        clean: ['[*] 14 log streams since session start', '[~] auth.log    3 entries rewritten', '[~] kern.log    2 entries rewritten',
            '[~] egress.log  4 entries rewritten', '[*] shell history cleared', '[+] tracks covered :: integrity checks green'],
        root: ['[*] escalating via kernel path', 'uid=0(root) gid=0(root) groups=0(root)', '', '  ACCESS GRANTED :: root@{HOST}', '  time to coffee: {ELAPSED}'],
    };

    // ------------------------------------------------------------------ state
    const codeEl = $('code');
    const scrollEl = $('code-scroll');
    const sink = $('sink');
    const feedEl = $('feed');
    const listEl = $('checklist');
    const runBtn = $('run-hint');
    const cv = $('ops');
    const g = cv.getContext('2d');
    const overlay = $('overlay');
    let W = 0, H = 0, DPR = 1;

    let run = null;
    let cpk = 5;
    let lineEl = null, lineText = '';
    const keyTimes = [];
    let heat = 0;
    let glitch = 0;
    let time = 0;
    let targetIdx = randi(0, TARGETS.length - 1);

    // A run goes: type a phase -> it is "ready" -> Enter runs it -> output + scene play -> type the next phase.
    function newRun() {
        targetIdx = (targetIdx + 1) % TARGETS.length;
        const target = TARGETS[targetIdx];
        run = {
            target, typeIdx: 0, pos: 0, keys: 0, started: 0, state: 'typing',
            texts: STAGES.map((s) => s.code.replace('{HOST}', target.host)),
            exec: null, shown: -1, scene: SCENES.standby(), sceneP: 0,
        };
        $('t-name').textContent = target.name;
        $('t-host').textContent = target.host;
        listEl.innerHTML = '';
        STAGES.forEach((s) => { const li = document.createElement('li'); li.textContent = s.name; listEl.appendChild(li); });
        codeEl.innerHTML = '';
        lineEl = null;
        newLine();
        feed('info', `target loaded: ${target.name} (${target.host})`);
        refreshUi();
    }

    function feed(cls, text) {
        const li = document.createElement('li');
        li.className = cls;
        li.textContent = text;
        feedEl.appendChild(li);
        while (feedEl.children.length > 30) feedEl.removeChild(feedEl.firstChild);
    }

    function refreshUi() {
        const shownIdx = run.exec ? run.exec.idx : run.shown;
        const st = STAGES[Math.max(0, shownIdx)];
        $('stage-num').textContent = shownIdx < 0 ? 'STANDBY' : `PHASE ${shownIdx + 1}/${STAGES.length}`;
        $('stage-name').textContent = shownIdx < 0 ? 'AWAITING COMMAND' : st.name;
        $('stage-title').textContent = shownIdx < 0 ? '' : st.title;
        [...listEl.children].forEach((li, k) => {
            const running = run.exec && run.exec.idx === k;
            li.className = running ? 'active' : k < run.typeIdx ? 'done' : '';
        });
        $('status').textContent = { typing: 'TYPING', ready: 'READY ⏎', running: 'RUNNING', done: 'DONE' }[run.state];
        $('status').className = 'st-' + run.state;
        runBtn.hidden = run.state !== 'ready';
        runBtn.textContent = `⏎  Run phase ${run.typeIdx + 1}: ${STAGES[Math.min(run.typeIdx, STAGES.length - 1)].name.toLowerCase()}`;
    }

    // ------------------------------------------------------------------ typing
    function newLine(cls) {
        if (lineEl) {
            lineEl.classList.remove('cur');
            if (!lineEl.classList.contains('out')) lineEl.innerHTML = highlight(lineText);
        }
        lineEl = document.createElement('div');
        lineEl.className = cls ? 'line ' + cls : 'line cur';
        lineText = '';
        codeEl.appendChild(lineEl);
        while (codeEl.children.length > 600) codeEl.removeChild(codeEl.firstChild);
    }

    function outLine(text, cls = 'out') {
        newLine(cls);
        lineEl.textContent = text;
    }

    function type(n) {
        if (!run || !overlay.hidden) return;
        if (run.state !== 'typing') { if (run.state === 'ready') nudge(); return; }
        if (!run.started) { run.started = performance.now(); $('hint').classList.add('gone'); }
        run.keys++;
        keyTimes.push(performance.now());
        heat = Math.min(1, heat + 0.12);
        const text = run.texts[run.typeIdx];
        for (let i = 0; i < n && run.pos < text.length; i++) {
            const ch = text[run.pos++];
            if (ch === '\n') newLine(); else lineText += ch;
        }
        if (run.pos >= text.length) { run.state = 'ready'; refreshUi(); }
        lineEl.innerHTML = highlight(lineText) + '<span class="caret"></span>';
        scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    function nudge() {
        runBtn.classList.remove('nudge');
        void runBtn.offsetWidth; // restart the animation
        runBtn.classList.add('nudge');
    }

    function execute() {
        if (!run || run.state !== 'ready') return;
        const idx = run.typeIdx;
        const st = STAGES[idx];
        const elapsed = fmtTime(performance.now() - run.started);
        const lines = OUT[st.id].map((l) => l.replace('{HOST}', run.target.host).replace('{ELAPSED}', elapsed));
        outLine(`$ ghost run breach.ghost --phase ${idx + 1}`, 'out cmd');
        run.state = 'running';
        run.exec = { idx, p: 0, speed: 1, lines, printed: 0, fed: 0, dur: Math.max(5, lines.length * 0.95) };
        run.scene = SCENES[st.id]();
        run.shown = idx;
        glitch = 0.4;
        refreshUi();
        scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    // Progress is jittery on purpose: real tools stall, then rush.
    function updateExec(dt) {
        const ex = run.exec;
        ex.speed = clamp(ex.speed + rand(-2.5, 2.5) * dt * 3, 0.15, 2);
        ex.p = Math.min(1, ex.p + (dt / ex.dur) * ex.speed);
        while (ex.printed < ex.lines.length && ex.p >= ex.printed / ex.lines.length) {
            const l = ex.lines[ex.printed++];
            const tone = l.startsWith('[+]') || l.includes('ACCESS') ? ' ok' : l.startsWith('[!]') ? ' bad' : l.startsWith('[~]') ? ' warn' : '';
            outLine(l, 'out' + tone);
            scrollEl.scrollTop = scrollEl.scrollHeight;
        }
        const st = STAGES[ex.idx];
        while (ex.fed < st.feed.length && ex.p >= (ex.fed + 1) / (st.feed.length + 1)) {
            const [cls, text] = st.feed[ex.fed++];
            feed(cls, text.replace('{n}', '27'));
        }
        run.sceneP = ex.p;
        if (ex.p >= 1) finishExec();
    }

    function finishExec() {
        const ex = run.exec;
        while (ex.printed < ex.lines.length) outLine(ex.lines[ex.printed++], 'out');
        run.exec = null;
        run.sceneP = 1;
        run.typeIdx++;
        run.pos = 0;
        if (run.typeIdx >= STAGES.length) {
            run.state = 'done';
            refreshUi();
            feed('ok', `[+] ${run.target.name} owned`);
            setTimeout(granted, 900);
            return;
        }
        run.state = 'typing';
        outLine('', 'out');
        newLine();
        lineEl.innerHTML = '<span class="caret"></span>';
        refreshUi();
        scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    function fmtTime(ms) {
        const s = Math.round(ms / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function granted() {
        const took = performance.now() - run.started;
        showOverlay(false, 'ACCESS GRANTED',
            `${run.target.name} is yours.\n${fmtTime(took)} · ${run.keys.toLocaleString('en-US')} keystrokes · 10 phases`,
            'Next target', newRun);
    }

    let overlayAction = null;
    function showOverlay(bad, title, text, btn, action) {
        $('ov-box').classList.toggle('bad', bad);
        $('ov-title').textContent = title;
        $('ov-text').textContent = text;
        $('ov-btn').textContent = btn + ' (Enter)';
        overlayAction = action;
        overlay.hidden = false;
    }
    function closeOverlay() {
        overlay.hidden = true;
        const a = overlayAction;
        overlayAction = null;
        if (a) a();
    }
    $('ov-btn').addEventListener('click', closeOverlay);

    // Alt ×3 and Caps Lock ×3 are the classic shortcuts for the big messages.
    const combo = { key: '', n: 0, at: 0 };
    function comboKey(k) {
        const now = performance.now();
        if (combo.key === k && now - combo.at < 1200) combo.n++; else { combo.key = k; combo.n = 1; }
        combo.at = now;
        if (combo.n < 3) return;
        combo.n = 0;
        if (k === 'Alt') showOverlay(false, 'ACCESS GRANTED', 'Welcome back, operator.', 'Carry on', null);
        else showOverlay(true, 'ACCESS DENIED', 'Credentials rejected. This attempt has been logged.', 'Carry on', null);
    }

    function enterOrType() {
        if (run.state === 'ready') execute(); else type(cpk);
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Alt' || e.key === 'CapsLock') { e.preventDefault(); comboKey(e.key); return; }
        if (!overlay.hidden) {
            if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = e.target.tagName;
        if (tag === 'SELECT') return;
        if ((tag === 'BUTTON' || tag === 'A') && (e.key === 'Enter' || e.key === ' ')) return;
        if (e.key === 'Tab' || e.key === 'Escape' || (e.key.startsWith('F') && e.key.length > 1)) return;
        if (e.key === 'Unidentified' || e.keyCode === 229) return; // phone keyboards: handled by the input event
        if (e.key === 'Enter') { e.preventDefault(); enterOrType(); }
        else if (e.key.length === 1 || e.key === 'Backspace') { e.preventDefault(); type(cpk); }
    });
    sink.addEventListener('input', (e) => {
        const data = e.data || '';
        const enter = e.inputType === 'insertLineBreak' || data.includes('\n');
        sink.value = '';
        if (!overlay.hidden) return;
        if (enter) { enterOrType(); return; }
        for (let i = 0; i < Math.min(Math.max(1, data.length), 4); i++) type(cpk);
    });
    // Tapping the code types too, so a phone works without opening the keyboard.
    scrollEl.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') { sink.focus({ preventScroll: true }); return; }
        type(cpk);
    });
    runBtn.addEventListener('click', (e) => { e.currentTarget.blur(); execute(); });
    $('btn-kbd').addEventListener('click', () => { sink.focus({ preventScroll: true }); });
    $('cpk').addEventListener('change', (e) => { cpk = Number(e.target.value); e.target.blur(); });
    const fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    if (!fsOK) document.documentElement.classList.add('no-fullscreen');
    $('btn-full').addEventListener('click', (e) => {
        const r = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else (r.requestFullscreen || r.webkitRequestFullscreen).call(r);
        e.currentTarget.blur();
    });
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    // ------------------------------------------------------------------ scenes
    // Each scene factory returns draw(p, dt): p is how far through the stage you have typed (0..1).
    function frameBox() {
        const pad = Math.max(14, Math.min(W, H) * 0.05);
        return { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
    }
    function label(text, x, y, color = G, size = 11, align = 'left', weight = '') {
        g.font = `${weight} ${Math.round(size * fs())}px ${MONO}`;
        g.textAlign = align;
        g.fillStyle = color;
        g.fillText(text, x, y);
    }
    const fs = () => clamp(Math.min(W, H) / 520, 0.8, 1.9);

    const SCENES = {
        recon() {
            const nodes = Array.from({ length: 28 }, (_, i) => ({
                a: rand(0, TAU), r: rand(0.18, 0.95), th: (i + 1) / 29, t0: -1,
                ip: `10.44.${randi(0, 254)}.${randi(1, 254)}`, honey: Math.random() < 0.08,
            }));
            return (p) => {
                const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.42;
                g.strokeStyle = rgba(G, 0.18);
                g.lineWidth = 1;
                for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(cx, cy, (R * k) / 4, 0, TAU); g.stroke(); }
                g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
                const sweep = time * 1.8;
                for (let k = 0; k < 24; k++) {
                    g.fillStyle = rgba(G, 0.16 * (1 - k / 24));
                    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sweep - (k + 1) * 0.03, sweep - k * 0.03); g.closePath(); g.fill();
                }
                g.strokeStyle = rgba(G, 0.9);
                g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); g.stroke();
                const found = nodes.filter((n) => p >= n.th);
                for (const n of found) {
                    if (n.t0 < 0) n.t0 = time;
                    const x = cx + Math.cos(n.a) * n.r * R, y = cy + Math.sin(n.a) * n.r * R;
                    n.x = x; n.y = y;
                    g.strokeStyle = rgba(n.honey ? RED : G, 0.12);
                    g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke();
                }
                for (const n of found) {
                    const age = time - n.t0;
                    const c = n.honey ? RED : G;
                    if (age < 1) { g.strokeStyle = rgba(c, 1 - age); g.beginPath(); g.arc(n.x, n.y, 4 + age * 24, 0, TAU); g.stroke(); }
                    g.fillStyle = c;
                    g.beginPath(); g.arc(n.x, n.y, 3.5, 0, TAU); g.fill();
                    label(n.honey ? 'HONEYPOT' : n.ip, n.x + 7, n.y - 6, rgba(c, 0.85), 9);
                }
                g.fillStyle = WHITE;
                g.beginPath(); g.arc(cx, cy, 5, 0, TAU); g.fill();
                label('YOU', cx + 8, cy + 14, WHITE, 10, 'left', '700');
                label(`HOSTS ${found.length}/${nodes.length}`, 16, H - 16, G, 12, 'left', '700');
            };
        },

        ports() {
            const OPEN = [[22, 'ssh', 'OpenSSH 9.6'], [80, 'http', 'nginx 1.25'], [443, 'https', 'nginx 1.25'], [3306, 'mysql', 'MariaDB 10.11'],
                [6379, 'redis', 'Redis 7.2 (no auth)'], [8080, 'http-alt', 'Jetty 12'], [9200, 'elastic', 'Elasticsearch 8']];
            const cells = 1024;
            const openAt = new Map(OPEN.map((o) => [o[0] < 1024 ? o[0] : randi(100, 1000), o]));
            return (p) => {
                const b = frameBox();
                const cols = 64, rows = cells / cols;
                const gridH = b.h * 0.55;
                const cw = b.w / cols, ch = gridH / rows;
                const scanned = Math.floor(p * cells);
                for (let i = 0; i < cells; i++) {
                    const x = b.x + (i % cols) * cw, y = b.y + Math.floor(i / cols) * ch;
                    const open = openAt.has(i);
                    if (i < scanned) g.fillStyle = open ? G : rgba(G, 0.14);
                    else g.fillStyle = 'rgba(255,255,255,0.03)';
                    g.fillRect(x + 1, y + 1, cw - 2, ch - 2);
                    if (open && i < scanned) { g.fillStyle = rgba(G, 0.25); g.fillRect(x - 3, y - 3, cw + 4, ch + 4); }
                }
                if (scanned < cells) {
                    const x = b.x + (scanned % cols) * cw, y = b.y + Math.floor(scanned / cols) * ch;
                    g.fillStyle = WHITE;
                    g.fillRect(x, y, cw, ch);
                }
                label(`SCANNED ${Math.min(scanned, cells)}/1023 PORTS`, b.x, b.y + gridH + 26 * fs(), G, 12, 'left', '700');
                let y = b.y + gridH + 52 * fs();
                for (const [i, o] of openAt) {
                    if (i >= scanned) continue;
                    label(`${String(o[0]).padStart(5)}/tcp  open  ${o[1].padEnd(9)} ${o[2]}`, b.x, y, o[1] === 'redis' ? AMBER : WHITE, 12);
                    y += 18 * fs();
                }
            };
        },

        wall() {
            const rows = 9, cols = 12;
            const bricks = [];
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                bricks.push({ r, c, th: rand(0.02, 0.97), label: hex(4), fall: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0 });
            }
            return (p, dt) => {
                const b = frameBox();
                const bw = b.w / cols, bh = (b.h * 0.8) / rows;
                const top = b.y + b.h * 0.05;
                g.fillStyle = rgba(G, 0.08 + 0.3 * p);
                g.fillRect(b.x, top, b.w, rows * bh);
                label('TUNNEL :4443', W / 2, top + (rows * bh) / 2, rgba(G, p), 28, 'center', '700');
                let down = 0;
                for (const k of bricks) {
                    const hx = b.x + k.c * bw - (k.r % 2 ? bw / 2 : 0), hy = top + k.r * bh;
                    if (p >= k.th && !k.fall) { k.fall = true; k.x = hx; k.y = hy; k.vx = rand(-60, 60); k.vy = rand(-120, -20); k.vr = rand(-3, 3); }
                    if (k.fall) {
                        down++;
                        k.vy += 900 * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
                        if (k.y > H + 60) continue;
                        g.save(); g.translate(k.x + bw / 2, k.y + bh / 2); g.rotate(k.rot);
                        g.fillStyle = 'rgba(90,30,30,0.9)'; g.fillRect(-bw / 2 + 2, -bh / 2 + 2, bw - 4, bh - 4);
                        g.restore();
                        continue;
                    }
                    g.fillStyle = '#2a0f14';
                    g.fillRect(hx + 2, hy + 2, bw - 4, bh - 4);
                    g.strokeStyle = rgba(RED, 0.55);
                    g.strokeRect(hx + 2.5, hy + 2.5, bw - 5, bh - 5);
                    if (bw > 34) label(k.label, hx + bw / 2, hy + bh / 2 + 4, rgba(RED, 0.7), 9, 'center');
                }
                label(`RULES NEUTRALISED ${Math.round((down / bricks.length) * 128)}/128`, b.x, H - 16, down === bricks.length ? G : AMBER, 12, 'left', '700');
            };
        },

        crack() {
            const pw = Array.from({ length: 14 }, () => pick('abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!$#%')).join('');
            const tried = Array.from({ length: 40 }, () => pick(['Summer', 'Winter', 'Autumn', 'Spring', 'Backup', 'Passw0rd', 'Welcome', 'Admin']) + randi(2015, 2026) + pick(['!', '#', '', '?', '$']));
            let shown = pw.split('').map(() => glyph()), tick = 0;
            return (p, dt) => {
                const b = frameBox();
                g.font = `${Math.round(12 * fs())}px ${MONO}`;
                const scroll = (time * 60) % 20;
                for (let i = 0; i < 26; i++) {
                    label(tried[(i + Math.floor(time * 6)) % tried.length], b.x, b.y + i * 20 * fs() - scroll, 'rgba(57,255,136,0.08)', 12);
                }
                const n = pw.length, box = Math.min((b.w * 0.9) / n, 56 * fs()), x0 = W / 2 - (box * n) / 2, y0 = H / 2 - box / 2;
                const locked = Math.floor(p * n);
                tick += dt;
                if (tick > 0.05) { tick = 0; shown = shown.map((c, i) => (i < locked ? pw[i] : glyph())); }
                label('user: svc_backup', W / 2, y0 - box * 0.8, WHITE, 14, 'center', '700');
                for (let i = 0; i < n; i++) {
                    const ok = i < locked;
                    g.strokeStyle = ok ? G : rgba(G, 0.3);
                    g.lineWidth = ok ? 2 : 1;
                    g.strokeRect(x0 + i * box + 3, y0, box - 6, box);
                    if (ok) { g.fillStyle = rgba(G, 0.12); g.fillRect(x0 + i * box + 3, y0, box - 6, box); }
                    g.font = `700 ${Math.round(box * 0.55)}px ${MONO}`;
                    g.textAlign = 'center';
                    g.fillStyle = ok ? G : rgba(WHITE, 0.45);
                    g.fillText(ok ? pw[i] : shown[i], x0 + i * box + box / 2, y0 + box * 0.68);
                }
                g.lineWidth = 1;
                const tries = Math.floor(p * 1.21e12);
                label(`8× GPU · ${(38 + Math.sin(time * 3) * 4).toFixed(1)} GH/s · ${tries.toLocaleString('en-US')} tried`, W / 2, y0 + box * 1.8, AMBER, 12, 'center');
                if (locked === n) label('MATCH', W / 2, y0 + box * 2.6, G, 22, 'center', '700');
            };
        },

        cams() {
            const feeds = Array.from({ length: 6 }, (_, i) => ({ id: `CAM-0${i + 1}`, ph: rand(0, TAU), sp: rand(0.3, 0.8), looped: false, st: 0, room: randi(0, 2) }));
            return (p) => {
                const portrait = H > W;
                const cols = portrait ? 2 : 3, rows = portrait ? 3 : 2;
                const b = frameBox();
                const fw = b.w / cols, fh = b.h / rows;
                feeds.forEach((f, i) => {
                    if (!f.looped && p >= (i + 1) / 7) { f.looped = true; f.st = time; }
                    const x = b.x + (i % cols) * fw + 4, y = b.y + Math.floor(i / cols) * fh + 4, w = fw - 8, h = fh - 8;
                    g.save();
                    g.beginPath(); g.rect(x, y, w, h); g.clip();
                    g.fillStyle = '#0a0f0c'; g.fillRect(x, y, w, h);
                    // a corridor in perspective
                    const vx = x + w / 2, vy = y + h * 0.42;
                    g.strokeStyle = 'rgba(160,200,180,0.18)';
                    g.beginPath();
                    for (const [ex, ey] of [[x, y + h], [x + w, y + h], [x, y], [x + w, y]]) { g.moveTo(vx, vy); g.lineTo(ex, ey); }
                    for (let k = 1; k < 5; k++) { const s = k / 5; g.rect(vx - (w / 2) * s, vy - h * 0.42 * s, w * s, h * s); }
                    g.stroke();
                    // a guard walking up and down (on a looped feed he walks the same 90 seconds forever)
                    const tt = f.looped ? (time - f.st) % 3 : time;
                    const gx = vx + Math.sin(tt * f.sp * 2 + f.ph) * w * 0.3, gy = y + h * 0.72, s = h * 0.2;
                    g.fillStyle = 'rgba(200,220,210,0.55)';
                    g.fillRect(gx - s * 0.18, gy - s, s * 0.36, s * 0.75);
                    g.beginPath(); g.arc(gx, gy - s * 1.12, s * 0.16, 0, TAU); g.fill();
                    // noise lines
                    g.fillStyle = 'rgba(255,255,255,0.04)';
                    for (let k = 0; k < 6; k++) g.fillRect(x, y + ((time * 80 + k * 37) % h), w, 1);
                    if (f.looped && time - f.st < 0.6) {
                        for (let k = 0; k < 220; k++) {
                            g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`;
                            g.fillRect(x + Math.random() * w, y + Math.random() * h, rand(2, 8), rand(1, 4));
                        }
                    }
                    g.restore();
                    g.strokeStyle = f.looped ? G : 'rgba(255,255,255,0.2)';
                    g.lineWidth = f.looped ? 2 : 1;
                    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
                    g.lineWidth = 1;
                    label(f.id, x + 8, y + 16 * fs(), WHITE, 10, 'left', '700');
                    if (f.looped) label('⟲ LOOPED', x + w - 8, y + 16 * fs(), G, 10, 'right', '700');
                    else if ((time * 2 | 0) % 2) label('● REC', x + w - 8, y + 16 * fs(), RED, 10, 'right', '700');
                    label('LIVE 02:14:' + String(Math.floor(time) % 60).padStart(2, '0'), x + 8, y + h - 8, 'rgba(255,255,255,0.5)', 9);
                });
            };
        },

        decrypt() {
            const lines = ['ORPHEUS // EYES ONLY', '', 'phase 3 budget ........ 41.2M', 'launch window ......... Q3, night of the new moon',
                'relay sites ........... 7 active, 2 dark', 'board vote ............ 6-1 in favour', 'backup keys ........... cold storage B4',
                'contact ............... "the gardener"', 'cover story ........... routine maintenance', 'status ................ GREENLIT'];
            const cells = [];
            lines.forEach((l, r) => [...l].forEach((ch, c) => cells.push({ r, c, ch, th: clamp(r * 0.07 + Math.random() * 0.35, 0, 0.98), g: glyph() })));
            return (p) => {
                const b = frameBox();
                const lh = Math.min(b.h / (lines.length + 1), 30 * fs());
                const size = Math.min(lh * 0.62, (b.w / 52) * 1.6);
                g.font = `${Math.round(size)}px ${MONO}`;
                g.textAlign = 'left';
                const cw = g.measureText('M').width;
                const x0 = b.x + Math.max(0, (b.w - cw * 50) / 2), y0 = b.y + lh;
                for (const k of cells) {
                    const ok = p >= k.th;
                    if (!ok && Math.random() < 0.15) k.g = glyph();
                    g.fillStyle = ok ? (k.r === 0 || k.r === lines.length - 1 ? AMBER : G) : rgba(G, 0.22);
                    g.fillText(ok ? k.ch : k.g, x0 + k.c * cw, y0 + k.r * lh);
                }
                label(`DECRYPTED ${Math.round(p * 100)}% · AES-256-GCM`, b.x, H - 16, G, 12, 'left', '700');
            };
        },

        exfil() {
            const files = [['orpheus_budget.pdf', 38], ['board_minutes.db', 912], ['relay_sites.kml', 6], ['master.key', 1], ['payroll_2026.db', 1480],
                ['launch_plan_v9.pdf', 64], ['gardener_comms.mbox', 2210]];
            const total = files.reduce((s, f) => s + f[1], 0);
            const parts = [];
            let lastP = 0;
            return (p, dt) => {
                const b = frameBox();
                const listW = W > 640 ? b.w * 0.52 : b.w;
                const rowH = Math.min(b.h / (files.length + 2), 34 * fs());
                let cum = 0;
                files.forEach(([name, mb], i) => {
                    const fp = clamp((p * total - cum) / mb, 0, 1);
                    cum += mb;
                    const y = b.y + i * rowH;
                    label(name, b.x, y + rowH * 0.45, fp >= 1 ? G : WHITE, 11);
                    label(mb >= 1000 ? (mb / 1000).toFixed(1) + ' GB' : mb + ' MB', b.x + listW, y + rowH * 0.45, 'rgba(255,255,255,0.5)', 10, 'right');
                    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(b.x, y + rowH * 0.6, listW, 4);
                    g.fillStyle = fp >= 1 ? G : CYAN; g.fillRect(b.x, y + rowH * 0.6, listW * fp, 4);
                });
                label(`${((p * total) / 1000).toFixed(2)} / ${(total / 1000).toFixed(1)} GB AT THE DROP`, b.x, b.y + (files.length + 1) * rowH, G, 13, 'left', '700');
                if (W <= 640) return;
                const ax = b.x + b.w * 0.62, bx = b.x + b.w * 0.95, ay = H * 0.3, by = H * 0.7;
                for (const [x, y, t, c] of [[ax, ay, 'TARGET', RED], [bx, by, 'DROP', G]]) {
                    g.strokeStyle = c; g.strokeRect(x - 34, y - 20, 68, 40);
                    label(t, x, y + 4, c, 10, 'center', '700');
                }
                const spawn = Math.min(40, Math.max(0, (p - lastP) * 900));
                lastP = p;
                for (let i = 0; i < spawn; i++) parts.push({ k: 0, v: rand(0.8, 1.6), off: rand(-40, 40) });
                for (let i = parts.length - 1; i >= 0; i--) {
                    const q = parts[i];
                    q.k += q.v * dt;
                    if (q.k >= 1) { parts.splice(i, 1); continue; }
                    const cx = (ax + bx) / 2 + q.off - 60, cy = (ay + by) / 2 + q.off;
                    const u = 1 - q.k;
                    const x = u * u * ax + 2 * u * q.k * cx + q.k * q.k * bx, y = u * u * ay + 2 * u * q.k * cy + q.k * q.k * by;
                    g.fillStyle = rgba(CYAN, 0.9);
                    g.fillRect(x - 1.5, y - 1.5, 3, 3);
                }
            };
        },

        sat() {
            const stars = Array.from({ length: 120 }, () => [Math.random(), Math.random(), Math.random()]);
            const a0 = rand(-2.6, -2), a1 = rand(-1.2, -0.6);
            return (p) => {
                for (const [x, y, s] of stars) { g.fillStyle = `rgba(255,255,255,${0.15 + s * 0.4})`; g.fillRect(x * W, y * H, 1 + s, 1 + s); }
                const R = Math.min(W, H) * 0.3, cx = W * 0.5, cy = H * 0.62;
                const grd = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
                grd.addColorStop(0, '#0f3b2a'); grd.addColorStop(1, '#03110b');
                g.fillStyle = grd;
                g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
                g.strokeStyle = rgba(G, 0.25);
                for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(cx, cy + (k * R) / 3, Math.sqrt(1 - (k / 3) ** 2) * R, R * 0.08, 0, 0, TAU); g.stroke(); }
                for (let k = 0; k < 6; k++) {
                    const w = Math.cos(time * 0.3 + (k * Math.PI) / 6) * R;
                    g.beginPath(); g.ellipse(cx, cy, Math.abs(w), R, 0, 0, TAU); g.stroke();
                }
                const orx = R * 1.6, ory = R * 1.05;
                g.strokeStyle = rgba(CYAN, 0.25);
                g.setLineDash([4, 6]);
                g.beginPath(); g.ellipse(cx, cy, orx, ory, 0, 0, TAU); g.stroke();
                g.setLineDash([]);
                const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
                const a = lerp(a0, a1, e);
                const sx = cx + Math.cos(a) * orx, sy = cy + Math.sin(a) * ory;
                const dx = cx + R * 0.35, dy = cy - R * 0.94;
                if (p > 0.35) {
                    g.strokeStyle = rgba(G, clamp((p - 0.35) * 2, 0, 1) * (0.6 + 0.4 * Math.sin(time * 12)));
                    g.lineWidth = 2;
                    g.beginPath(); g.moveTo(dx, dy); g.lineTo(sx, sy); g.stroke();
                    g.lineWidth = 1;
                }
                g.fillStyle = AMBER;
                g.beginPath(); g.arc(dx, dy, 4, 0, TAU); g.fill();
                g.save(); g.translate(sx, sy); g.rotate(a + Math.PI / 2);
                g.fillStyle = WHITE; g.fillRect(-5, -5, 10, 10);
                g.fillStyle = CYAN; g.fillRect(-22, -3, 14, 6); g.fillRect(8, -3, 14, 6);
                g.restore();
                label('KESTREL-9', sx + 16, sy - 12, CYAN, 11, 'left', '700');
                label('TARGET', dx + 8, dy - 8, AMBER, 10, 'left', '700');
                const b = frameBox();
                label(`UPLINK ${Math.round(p * 97)}%`, b.x, b.y + 14 * fs(), p > 0.95 ? G : AMBER, 14, 'left', '700');
                g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(b.x, b.y + 22 * fs(), 160 * fs(), 5);
                g.fillStyle = G; g.fillRect(b.x, b.y + 22 * fs(), 160 * fs() * p, 5);
            };
        },

        clean() {
            const now = new Date();
            const ts = (k) => { const d = new Date(now - (14 - k) * 47000); return d.toTimeString().slice(0, 8); };
            const BAD = ['sshd[2241]: Accepted password for svc_backup from 185.', 'kernel: nf_tables: rule 42 replaced', 'facility-cam: CAM-02 stream source changed',
                'archive: orpheus.enc opened by svc_backup', 'egress: 4.7 GB to unknown host relay-7', 'sudo: svc_backup : TTY=pts/3 ; COMMAND=/bin/sh',
                'auditd: integrity check skipped', 'redis: CONFIG SET dir /tmp', 'uplink: route changed via KESTREL-9'];
            const OK = ['systemd[1]: Started Daily apt upgrade.', 'cron[812]: (root) CMD (logrotate)', 'ntpd[455]: clock synced', 'systemd[1]: Started session cleanup.',
                'kernel: eth0: link up', 'postfix: queue empty'];
            const rows = Array.from({ length: 15 }, (_, k) => {
                const bad = k % 2 === 0 || k === 7;
                return { ts: ts(k), text: bad ? pick(BAD) : pick(OK), bad, th: bad ? rand(0.05, 0.95) : 2, done: -1, alt: pick(OK) };
            });
            return (p) => {
                const b = frameBox();
                const lh = Math.min(b.h / (rows.length + 2), 26 * fs());
                rows.forEach((r, i) => {
                    const y = b.y + (i + 1) * lh;
                    if (r.bad && p >= r.th && r.done < 0) r.done = time;
                    const age = r.done < 0 ? -1 : time - r.done;
                    label(r.ts, b.x, y, 'rgba(255,255,255,0.35)', 11);
                    const tx = b.x + 80 * fs();
                    if (age < 0) label(r.text, tx, y, r.bad ? AMBER : rgba(G, 0.55), 11);
                    else if (age < 0.5) {
                        label(r.text, tx, y, RED, 11);
                        g.fillStyle = RED;
                        g.fillRect(tx, y - 4 * fs(), Math.min(b.w - 90 * fs(), r.text.length * 6.6 * fs()) * (age / 0.5), 1.5);
                    } else label(r.alt, tx, y, rgba(G, 0.55), 11);
                });
                const left = rows.filter((r) => r.bad && r.done < 0).length;
                label(left ? `${left} INCRIMINATING ENTRIES LEFT` : 'LOGS CLEAN · INTEGRITY GREEN', b.x, H - 16, left ? AMBER : G, 12, 'left', '700');
            };
        },

        root() {
            return (p) => {
                const cx = W / 2, cy = H * 0.48, R = Math.min(W, H) * 0.3;
                const open = clamp((p - 0.75) / 0.25, 0, 1);
                label('uid=0(root) gid=0(root)', cx, cy, rgba(G, open), 18, 'center', '700');
                label('root@' + run.target.host + ':~#', cx, cy + 28 * fs(), rgba(WHITE, open), 13, 'center');
                g.save();
                g.translate(cx - R * open * 1.2, cy);
                g.scale(1 - open * 0.75, 1);
                g.rotate(p * TAU * 1.5);
                g.fillStyle = '#0d1a14';
                g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
                g.strokeStyle = G; g.lineWidth = 3;
                g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
                g.lineWidth = 1.5;
                g.beginPath(); g.arc(0, 0, R * 0.72, 0, TAU); g.stroke();
                for (let k = 0; k < 12; k++) {
                    const a = (k / 12) * TAU;
                    const lit = p * 12 > k;
                    g.fillStyle = lit ? G : '#20342a';
                    g.beginPath(); g.arc(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86, R * 0.05, 0, TAU); g.fill();
                }
                g.strokeStyle = rgba(G, 0.8);
                g.lineWidth = 6;
                for (let k = 0; k < 3; k++) {
                    const a = (k / 3) * TAU;
                    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55); g.stroke();
                }
                g.fillStyle = G;
                g.beginPath(); g.arc(0, 0, R * 0.1, 0, TAU); g.fill();
                g.restore();
                g.lineWidth = 1;
                const b = frameBox();
                label(`TUMBLERS ${Math.min(12, Math.floor(p * 12))}/12`, b.x, H - 16, open >= 1 ? G : AMBER, 12, 'left', '700');
            };
        },
    };


    // The screen before the first command: the target's dossier and an idle radar.
    SCENES.standby = () => () => {
        const cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.3;
        g.strokeStyle = rgba(G, 0.12);
        for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(cx, cy, (R * k) / 3, 0, TAU); g.stroke(); }
        const a = time * 0.7;
        g.strokeStyle = rgba(G, 0.5);
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
        label(run.target.name.toUpperCase(), cx, cy - 6, WHITE, 20, 'center', '700');
        label(run.target.host, cx, cy + 20 * fs(), rgba(G, 0.8), 12, 'center');
        const blink = ((time * 1.5) | 0) % 2 === 0;
        const ready = run.state === 'ready';
        label(ready ? 'PHASE 1 READY · PRESS ENTER' : 'AWAITING OPERATOR' + (blink ? ' _' : ''), cx, cy + R + 30 * fs(),
            ready ? AMBER : rgba(G, 0.7), 13, 'center', '700');
    };

    // ------------------------------------------------------------------ loop
    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        const r = cv.getBoundingClientRect();
        W = Math.max(1, r.width);
        H = Math.max(1, r.height);
        cv.width = Math.round(W * DPR);
        cv.height = Math.round(H * DPR);
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe($('viewport'));
    window.addEventListener('resize', resize);

    let last = performance.now();
    let uiNext = 0;
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;
        heat = Math.max(0, heat - dt * 0.9);
        document.documentElement.style.setProperty('--heat', heat.toFixed(2));
        if (run && run.exec) updateExec(dt);

        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        g.clearRect(0, 0, W, H);
        if (run && run.scene) run.scene(run.sceneP, dt);
        // phase change glitch: shift a few horizontal slices of the frame
        if (glitch > 0) {
            glitch -= dt;
            for (let k = 0; k < 7; k++) {
                const y = Math.random() * H, h = rand(4, 30), off = rand(-40, 40);
                g.drawImage(cv, 0, y * DPR, W * DPR, h * DPR, off, y, W, h);
            }
            g.fillStyle = rgba(G, Math.max(0, glitch) * 0.25);
            g.fillRect(0, 0, W, H);
        }

        uiNext -= dt;
        if (uiNext <= 0 && run) {
            uiNext = 0.1;
            while (keyTimes.length && keyTimes[0] < now - 2000) keyTimes.shift();
            $('kps').textContent = (keyTimes.length / 2).toFixed(0);
            let txt = 'complete';
            if (run.exec) txt = `running ${Math.round(run.exec.p * 100)}%`;
            else if (run.state === 'typing') txt = `typing phase ${run.typeIdx + 1}: ${Math.round((run.pos / run.texts[run.typeIdx].length) * 100)}%`;
            else if (run.state === 'ready') txt = 'ready, press Enter';
            $('stage-pct').textContent = txt;
        }
        requestAnimationFrame(frame);
    }

    resize();
    newRun();
    if (!window.matchMedia('(pointer: coarse)').matches) sink.focus({ preventScroll: true });
    requestAnimationFrame(frame);
})();
