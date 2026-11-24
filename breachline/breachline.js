/* Breachline: mash keys on the left, watch the "hack" happen on the right.
   Each phase runs the moment its code is written, while you write the next one. Enter fast-forwards the current phase. */
(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const rand = (a, b) => a + Math.random() * (b - a);
    const randi = (a, b) => Math.floor(rand(a, b + 1));
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, k) => a + (b - a) * k;
    const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
    const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    // Written against the fictional "ghostwire" toolkit: it reads like a real script and does nothing real.
    const STAGES = [
        { id: 'recon', name: 'recon', title: 'map the perimeter', code: `import sys
from ghostwire import recon, net, crypto, ops
from ghostwire.stealth import Mask, Jitter

TARGET = "{HOST}"
CIDR = "10.44.0.0/16"
mask = Mask(hops=7, jitter=Jitter(120, 340))

async def sweep(cidr):
    async for h in recon.Sweep(cidr, mask=mask, passive=True).discover():
        if h.alive and not h.honeypot:
            yield ops.mark(h, tag="perimeter")

perimeter = [h async for h in sweep(CIDR)]
gw = recon.pick(perimeter, role="gateway")
ops.log(f"[+] {len(perimeter)} hosts, gw={gw.addr}")
` },
        { id: 'ports', name: 'port scan', title: 'knock on every door, quietly', code: `def knock(h, ports=range(1, 1 << 14), t=0.08):
    hits = []
    for p in net.shuffle(ports):
        r = net.Probe(h, p, flags="S", ttl=mask.ttl()).send(timeout=t)
        if r and r.flags == "SA":
            hits.append((p, net.banner(h, p)))
        mask.sleep()
    return sorted(hits)

doors = knock(gw)
ops.table(doors, cols=("port", "service"))
` },
        { id: 'wall', name: 'firewall', title: 'take down the wall', code: `fw = net.Firewall(gw, vendor=recon.fingerprint(gw))
rules = fw.dump(via=doors[0])
for r in rules.sorted("prio"):
    if r.action == "DROP" and r.matches(mask.sig):
        fw.inject(crypto.forge_rule(r, allow=mask.sig), at=r.idx - 1)
        ops.log(f"[~] rule {r.idx:04d} neutralised")
assert fw.passes(mask), "wall up"
tun = fw.tunnel(port=4443)
` },
        { id: 'crack', name: 'credentials', title: 'borrow an identity', code: `vault = ops.connect(gw, via=tun)
svc = vault.accounts(match="svc_*").least_watched()
ck = crypto.Cracker(svc.hash, lists=["leaks.txt", "seasons.rules"], gpus=crypto.rent(8))
while not ck.done:
    ck.step(1 << 24)
    ops.status(f"{ck.rate_h} {ck.tried:,}")
sess = vault.login(svc.name, ck.result)
` },
        { id: 'cams', name: 'cameras', title: 'blind the eyes', code: `cams = sess.facility.cameras(zone="*")
for c in cams:
    c.substitute(ops.Loop(c.record(90), xfade=0.4, ts="live"))
    ops.log(f"[~] {c.id} looped {c.loop.secs}s")
assert all(c.substituted for c in cams)
` },
        { id: 'decrypt', name: 'decrypt', title: 'open the files', code: `blob = sess.fs.open("/srv/archive/orpheus.enc")
hdr = blob.header
k = crypto.derive(sess.keyring["archive-master"], salt=hdr.salt, rounds=hdr.rounds)
doc = crypto.AES256_GCM(k).open(blob.body, tag=hdr.tag)
ops.page(doc.lines()[:12])
` },
        { id: 'exfil', name: 'exfiltrate', title: 'take what we came for', code: `drop = net.DeadDrop("ghost://relay-7", chunk=1 << 16)
loot = sess.fs.glob("/srv/archive/**/*.{pdf,db,key,mbox}")
with drop.channel(cover="video") as ch:
    for f in loot:
        for b in f.chunks(drop.chunk):
            ch.send(crypto.seal(b, mask.key))
        ops.log(f"[>] {f.name:<24}{f.size_h:>8}")
` },
        { id: 'sat', name: 'uplink', title: 'buy some sky', code: `sat = net.uplink.acquire("LEO-relay", lease="borrowed")
sat.slew(to=recon.geo(gw), rate=0.6)
while sat.snr < 0.95:
    sat.trim(az=+0.02, el=-0.01)
    ops.status(f"snr {sat.snr:.0%}")
ops.reroute(mask, via=sat)
` },
        { id: 'clean', name: 'cover tracks', title: 'we were never here', code: `for lg in sess.host.logs(since=ops.t0):
    for e in lg.entries():
        if mask.sig in e or e.src in mask.hops:
            lg.redact(e, sub=lg.forge_benign(e))
    lg.rehash()
sess.host.history.clear()
fw.restore(rules)
` },
        { id: 'root', name: 'root', title: 'the keys to everything', code: `root = sess.escalate("kernel", fallback="sudo-cache")
assert root.uid == 0
ops.persist(root, implant=None)
ops.log(f"root@{TARGET} in {ops.elapsed()}")
sys.exit(0)
` },
    ];

    // ------------------------------------------------------------------ syntax highlighting
    const TOKEN = /(#.*$)|(f?"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|\b(\d[\d_.]*)\b|\b(from|import|as|def|async|await|for|in|if|elif|else|not|and|or|is|return|yield|while|with|assert|True|False|None|lambda)\b|([A-Za-z_]\w*)(?=\()|\b([A-Z][A-Z0-9_]{2,})\b/g;
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
    // What each phase writes to ghost.log while it runs, one line at a time.
    const OUT = {
        recon: ['ghost: routing through 7 hops (jitter 120-340 ms)', '[*] passive sweep of 10.44.0.0/16',
            '[*] 10.44.3.17    up  linux 6.1          gateway', '[*] 10.44.3.22    up  linux 6.1',
            '[*] 10.44.7.104   up  windows srv 2022', '[!] 10.44.9.200   honeypot signature, skipped', '[+] 27 live hosts behind {HOST}'],
        ports: ['[*] SYN scan 1-16383 on 10.44.3.17, shuffled', '    22/tcp    open  ssh       OpenSSH 9.6',
            '    443/tcp   open  https     nginx 1.25', '    3306/tcp  open  mysql     MariaDB 10.11',
            '[~] 6379/tcp  open  redis     Redis 7.2 (no auth)', '    9200/tcp  open  elastic   Elasticsearch 8.13', '[+] 7 open, 16376 filtered'],
        wall: ['[*] vendor: Palisade NGFW 11.2', '[*] ruleset dumped: 128 rules', '[~] rule 0042 neutralised',
            '[~] rule 0097 neutralised', '[~] rule 0113 neutralised', '[+] wall passes mask, tunnel up on :4443'],
        crack: ['[*] svc_backup, last login 211 days ago', '[*] 8 gpus leased, sha512crypt',
            '[~] 38.9 GH/s  412,331,008,512 tried', '[~] 41.2 GH/s  1,207,912,448,000 tried', '[+] match after 14m 02s', '[+] session open as svc_backup'],
        cams: ['[*] 6 cameras on the facility bus', '[~] CAM-01 looped 90s', '[~] CAM-02 looped 90s', '[~] CAM-03 looped 90s',
            '[~] CAM-04 looped 90s', '[~] CAM-05 looped 90s', '[~] CAM-06 looped 90s', '[+] all feeds substituted'],
        decrypt: ['[*] orpheus.enc  AES-256-GCM  600,000 rounds', '[*] key derived from keyring "archive-master"',
            '[*] tag verified', '[+] 10 lines paged'],
        exfil: ['[*] dead drop ghost://relay-7, cover: video', '[>] orpheus_budget.pdf        38 MB',
            '[>] board_minutes.db         912 MB', '[>] relay_sites.kml            6 MB', '[>] payroll_2026.db          1.5 GB',
            '[>] gardener_comms.mbox       2.2 GB', '[+] 4.7 GB at the drop'],
        sat: ['[*] leased LEO relay KESTREL-9', '[*] slewing 41.2 deg', '[~] snr 38%', '[~] snr 71%', '[~] snr 97%',
            '[+] route via KESTREL-9'],
        clean: ['[*] 14 log streams since t0', '[~] auth.log    3 entries rewritten', '[~] kern.log    2 entries rewritten',
            '[~] egress.log  4 entries rewritten', '[*] shell history cleared', '[+] ruleset restored, integrity green'],
        root: ['[*] escalating via kernel path', 'uid=0(root) gid=0(root) groups=0(root)', '[+] root@{HOST} in {ELAPSED}', 'ghost: exit 0'],
    };

    // ------------------------------------------------------------------ panel helpers
    const sp = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;
    const kv = (k, v, cls) => sp('mut', k.padEnd(11)) + (cls ? sp(cls, v) : esc(v));
    const meter = (p, w = 24) => { const n = Math.round(clamp(p, 0, 1) * w); return sp('acc', '━'.repeat(n)) + sp('dim', '━'.repeat(w - n)); };
    const pct = (p) => String(Math.round(clamp(p, 0, 1) * 100)).padStart(3) + '%';
    const head = (p, rest) => `${meter(p)} ${pct(p)}   ${sp('mut', rest)}`;
    // A value that changes every `sec` seconds, like a tool refreshing its numbers.
    function ticker(sec, make) {
        let at = -1e9, v;
        return () => { if (time - at >= sec) { at = time; v = make(); } return v; };
    }
    const clock = (d) => d.toTimeString().slice(0, 8);

    // Each panel factory returns render(p): p is how far the running phase has got (0..1).
    const PANELS = {
        standby(t) {
            const asn = 'AS' + randi(20000, 64000);
            return () => [
                kv('target', t.name, 'hi'), kv('host', t.host), kv('range', '10.44.0.0/16'), kv('asn', asn),
                kv('route', '7 hops, jitter 120-340 ms'), kv('toolkit', 'ghostwire 4.2'), '',
                sp('mut', run.started ? 'phase 1 is being written' : 'waiting for the operator'),
            ].join('\n');
        },

        recon() {
            const OS = ['linux 6.1', 'linux 5.15', 'windows srv 2022', 'freebsd 14.1', 'routeros 7.14'];
            const ROLE = ['web', 'db', 'files', 'print', 'mail', 'ci', '-'];
            const hosts = Array.from({ length: 14 }, (_, i) => ({
                addr: i === 0 ? '10.44.3.17' : `10.44.${randi(0, 12)}.${randi(2, 254)}`,
                os: i === 0 ? 'linux 6.1' : pick(OS), rtt: randi(3, 48), role: i === 0 ? 'gateway' : pick(ROLE),
                honey: i === 8, th: (i + 1) / 16,
            }));
            return (p) => {
                const out = [head(p, `live ${Math.round(p * 27)}  skipped ${p >= hosts[8].th ? 1 : 0}`), '',
                    sp('mut', 'ADDR            STATE   RTT    OS                ROLE')];
                for (const h of hosts) {
                    if (p < h.th) break;
                    const l = h.addr.padEnd(16) + (h.honey ? 'skip' : 'up').padEnd(8) + `${h.rtt}ms`.padEnd(7) + h.os.padEnd(18) + (h.honey ? 'honeypot' : h.role);
                    out.push(h.honey ? sp('bad', l) : h.role === 'gateway' ? sp('hi', l) : esc(l));
                }
                return out.join('\n');
            };
        },

        ports() {
            const OPEN = [[22, 'ssh', 'OpenSSH 9.6'], [80, 'http', 'nginx 1.25'], [443, 'https', 'nginx 1.25'], [3306, 'mysql', 'MariaDB 10.11'],
                [6379, 'redis', 'Redis 7.2 (no auth)'], [8080, 'http-alt', 'Jetty 12'], [9200, 'elastic', 'Elasticsearch 8.13']];
            const MAX = 16383;
            const th = OPEN.map(() => rand(0.05, 0.95));
            return (p) => {
                const probes = Math.round(p * MAX);
                const open = OPEN.filter((_, i) => p >= th[i]);
                const out = [head(p, `probes ${probes}/${MAX}  open ${open.length}  filtered ${Math.max(0, probes - open.length)}`), '',
                    sp('mut', 'PORT       STATE   SERVICE    VERSION')];
                for (const [port, svc, ver] of open) {
                    const l = `${port}/tcp`.padEnd(11) + 'open'.padEnd(8) + svc.padEnd(11) + ver;
                    out.push(svc === 'redis' ? sp('warn', l) : esc(l));
                }
                return out.join('\n');
            };
        },

        wall() {
            const IDX = [12, 18, 27, 42, 55, 61, 77, 89, 97, 104, 113, 120];
            const HIT = [42, 97, 113];
            const th = [rand(0.1, 0.3), rand(0.4, 0.6), rand(0.7, 0.9)];
            const rules = IDX.map((idx) => {
                const hit = HIT.indexOf(idx);
                return {
                    idx, hit, act: hit >= 0 ? 'DROP' : pick(['ACCEPT', 'ACCEPT', 'DROP', 'LOG']),
                    src: hit >= 0 ? 'ext:any' : pick(['10.44.0.0/16', 'ext:any', 'vpn:*', 'any']),
                    dst: pick(['gw:22', 'gw:443', 'dmz:*', 'core:*', 'gw:4443']),
                };
            });
            return (p) => {
                const patched = th.filter((t) => p >= t).length;
                const out = [head(p, `ruleset 128  patched ${patched}/3  tunnel ${p >= 1 ? 'up :4443' : 'down'}`), '',
                    sp('mut', 'IDX    ACTION   SRC             DST       STATE')];
                for (const r of rules) {
                    const done = r.hit >= 0 && p >= th[r.hit];
                    const l = String(r.idx).padStart(4, '0').padEnd(7) + (done ? 'ALLOW' : r.act).padEnd(9) + r.src.padEnd(16) + r.dst.padEnd(10) +
                        (done ? 'patched' : r.hit >= 0 ? 'match' : '-');
                    out.push(done ? sp('warn', l) : r.hit >= 0 ? sp('hi', l) : esc(l));
                }
                return out.join('\n');
            };
        },

        crack() {
            const hash = '$6$' + hex(8) + '$' + hex(22) + '…';
            const gpus = ticker(0.8, () => Array.from({ length: 8 }, () => ({ util: randi(94, 100), temp: randi(71, 83), rate: rand(4.6, 5.4) })));
            return (p) => {
                const live = p < 1;
                const gs = gpus();
                const rate = live ? gs.reduce((s, x) => s + x.rate, 0) : 0;
                return [
                    kv('account', 'svc_backup', 'hi') + sp('mut', '   last login 211 days ago'),
                    kv('hash', hash),
                    kv('mode', 'sha512crypt, leaks.txt + seasons.rules'),
                    kv('rate', `${rate.toFixed(1)} GH/s`),
                    kv('tried', Math.floor(p * 1207912448000).toLocaleString('en-US')),
                    kv('progress', '') + meter(p) + ' ' + pct(p),
                    kv('status', live ? 'running' : 'match, session open', live ? 'warn' : 'acc'),
                    '',
                    sp('mut', 'GPU  UTIL  TEMP  RATE'),
                    ...gs.map((x, i) => esc(String(i).padEnd(5) + `${live ? x.util : 0}%`.padEnd(6) + `${live ? x.temp : 41}C`.padEnd(6) +
                        `${live ? x.rate.toFixed(2) : '0.00'} GH/s`)),
                ].join('\n');
            };
        },

        cams() {
            const ZONES = ['lobby', 'corridor B', 'server room', 'loading dock', 'stairwell 2', 'archive'];
            const cams = ZONES.map((z, i) => ({ id: `CAM-0${i + 1}`, z, th: (i + 1) / 7, feed: `${pick(['1080p', '1080p', '720p'])} ${pick([15, 25, 30])}fps` }));
            return (p) => {
                const k = cams.filter((c) => p >= c.th).length;
                const out = [head(p, `looped ${k}/6`), '', sp('mut', 'CAM     ZONE           FEED          SOURCE')];
                for (const c of cams) {
                    const looped = p >= c.th;
                    const l = c.id.padEnd(8) + c.z.padEnd(15) + c.feed.padEnd(14) + (looped ? 'loop 90s' : 'live');
                    out.push(looped ? sp('acc', l) : esc(l));
                }
                return out.join('\n');
            };
        },

        decrypt() {
            const LINES = ['ORPHEUS // EYES ONLY', '', 'phase 3 budget ........ 41.2M', 'launch window ......... Q3, new moon',
                'relay sites ........... 7 active, 2 dark', 'board vote ............ 6-1 in favour', 'backup keys ........... cold storage B4',
                'contact ............... "the gardener"', 'cover story ........... routine maintenance', 'status ................ GREENLIT'];
            const enc = LINES.map((l) => (l ? hex(l.length).replace(/(.{4})/g, '$1 ').slice(0, l.length) : ''));
            return (p) => {
                const out = [kv('file', '/srv/archive/orpheus.enc'), kv('cipher', 'AES-256-GCM'), kv('kdf', 'pbkdf2, 600,000 rounds'),
                    kv('progress', '') + meter(p) + ' ' + pct(p), ''];
                LINES.forEach((l, r) => {
                    const ok = p >= (r + 1) / (LINES.length + 1);
                    out.push(!ok ? sp('dim', enc[r]) : r === 0 || r === LINES.length - 1 ? sp('hi', l) : esc(l));
                });
                return out.join('\n');
            };
        },

        exfil() {
            const FILES = [['orpheus_budget.pdf', 38], ['board_minutes.db', 912], ['relay_sites.kml', 6], ['master.key', 1],
                ['payroll_2026.db', 1480], ['launch_plan_v9.pdf', 64], ['gardener_comms.mbox', 2210]];
            const total = FILES.reduce((s, f) => s + f[1], 0);
            const size = (mb) => (mb >= 1000 ? (mb / 1000).toFixed(1) + ' GB' : mb + ' MB');
            const rate = ticker(0.7, () => rand(180, 420));
            return (p) => {
                const sent = p * total;
                const out = [head(p, `${(sent / 1000).toFixed(2)} / ${(total / 1000).toFixed(1)} GB  ${p < 1 ? rate().toFixed(0) + ' MB/s' : 'done'}  ghost://relay-7`), '',
                    sp('mut', 'FILE                    SIZE')];
                let cum = 0;
                for (const [name, mb] of FILES) {
                    const fp = clamp((sent - cum) / mb, 0, 1);
                    cum += mb;
                    const l = name.padEnd(22) + size(mb).padStart(8) + '  ';
                    out.push((fp > 0 ? esc(l) : sp('dim', l)) + meter(fp, 16) + ' ' + sp(fp >= 1 ? 'acc' : 'mut', pct(fp)));
                }
                return out.join('\n');
            };
        },

        sat() {
            const now = Date.now();
            const passes = [0, 94, 188].map((m, i) => {
                const aos = new Date(now + (m - 6) * 60000), los = new Date(aos.getTime() + randi(8, 12) * 60000);
                return `${('#' + (4411 + i)).padEnd(7)}${clock(aos).padEnd(10)}${clock(los).padEnd(10)}${randi(38, 71)}°`;
            });
            return (p) => {
                const e = ease(p);
                const snr = p * 0.97;
                return [
                    kv('relay', 'KESTREL-9', 'hi') + sp('mut', '   LEO, leased'),
                    kv('azimuth', lerp(212.4, 253.6, e).toFixed(1) + '°'),
                    kv('elevation', lerp(12, 53.2, e).toFixed(1) + '°'),
                    kv('snr', '') + meter(snr) + ' ' + pct(snr),
                    kv('latency', `${Math.round(lerp(610, 38, e) + Math.sin(time * 3) * 4)} ms`),
                    kv('route', p >= 1 ? 'via KESTREL-9' : 'direct', p >= 1 ? 'acc' : ''),
                    '',
                    sp('mut', 'PASS   AOS       LOS       MAX EL'),
                    ...passes.map((l, i) => (i === 0 ? sp('hi', l) : esc(l))),
                ].join('\n');
            };
        },

        clean() {
            const STREAMS = [['auth.log', 3], ['kern.log', 2], ['egress.log', 4], ['nginx/access.log', 0], ['syslog', 0], ['audit.log', 0]]
                .map(([n, k]) => ({ n, k, total: randi(400, 9000) }));
            const DIFF = [['sshd[2241]: Accepted password for svc_backup', 'cron[812]: (root) CMD (logrotate)'],
                ['kernel: nf_tables: rule 42 replaced', 'kernel: eth0: link up'],
                ['egress: 4.7 GB to relay-7', 'ntpd[455]: clock synced'],
                ['sudo: svc_backup : COMMAND=/bin/sh', 'systemd[1]: Started session cleanup.']];
            return (p) => {
                const q = clamp(p * 1.1, 0, 1);
                const out = [head(p, `streams 14  rewritten ${Math.round(q * 9)}/9  history ${p >= 0.9 ? 'cleared' : 'kept'}`), '',
                    sp('mut', 'STREAM              ENTRIES  REWRITTEN')];
                for (const s of STREAMS) {
                    const r = Math.round(q * s.k);
                    const l = s.n.padEnd(20) + String(s.total).padStart(7) + String(r).padStart(11);
                    out.push(r ? sp('warn', l) : esc(l));
                }
                out.push('');
                for (const [a, b] of DIFF.slice(0, Math.floor(p * DIFF.length + 1e-6))) out.push(sp('bad', '- ' + a), sp('mut', '+ ' + b));
                return out.join('\n');
            };
        },

        root(t) {
            const T = [['hi', '$ id'], ['', 'uid=1003(svc_backup) gid=1003(svc_backup) groups=1003(svc_backup),34(backup)'],
                ['hi', '$ ghost escalate --kernel'], ['mut', '[*] kernel 6.1.0-18, path ok'], ['mut', '[*] spawning shell'],
                ['hi', '# id'], ['acc', 'uid=0(root) gid=0(root) groups=0(root)'],
                ['hi', '# hostname -f'], ['', t.host],
                ['hi', '# uptime'], ['', ` ${clock(new Date())} up 211 days,  2 users,  load average: 0.12, 0.09, 0.08`]];
            return (p) => T.slice(0, Math.ceil(p * T.length)).map(([c, l]) => (c ? sp(c, l) : esc(l))).join('\n') +
                (p < 1 ? '' : '\n' + sp('hi', '# ') + '<span class="caret"></span>');
        },
    };

    // ------------------------------------------------------------------ state
    const codeEl = $('code');
    const scrollEl = $('code-scroll');
    const sink = $('sink');
    const feedEl = $('feed');
    const listEl = $('checklist');
    const panelEl = $('panel');
    const overlay = $('overlay');

    let run = null;
    let cpk = 5;
    let lineEl = null, lineText = '';
    let logN = 0;
    const keyTimes = [];
    let time = 0;
    let targetIdx = randi(0, TARGETS.length - 1);

    // A run: you write phase 1, it runs while you write phase 2, and so on. Nothing waits for anything but your typing.
    function newRun() {
        targetIdx = (targetIdx + 1) % TARGETS.length;
        const target = TARGETS[targetIdx];
        run = {
            target, typeIdx: 0, pos: 0, keys: 0, started: 0, state: 'idle', autofill: false,
            texts: STAGES.map((s) => s.code.replace('{HOST}', target.host)),
            exec: null, shown: -1, panel: PANELS.standby(target), panelP: 0, done: [], typedAt: [],
        };
        $('t-name').textContent = target.name;
        $('t-host').textContent = target.host;
        codeEl.innerHTML = '';
        lineEl = null;
        newLine();
        lineEl.innerHTML = '<span class="caret"></span>';
        feedEl.innerHTML = '';
        logN = 0;
        log('', `ghost: session opened against ${target.host}`);
        refreshUi();
        renderPanel();
    }

    function log(cls, text) {
        if (!text) return;
        const li = document.createElement('li');
        if (cls) li.className = cls;
        const ts = document.createElement('span');
        ts.className = 'ts';
        ts.textContent = clock(new Date());
        li.append(ts, text);
        feedEl.appendChild(li);
        while (feedEl.children.length > 80) feedEl.removeChild(feedEl.firstChild);
        $('log-count').textContent = `${++logN} lines`;
    }
    const tone = (l) => (l.startsWith('[+]') ? 'ok' : l.startsWith('[!]') ? 'bad' : l.startsWith('[~]') ? 'warn' : '');

    function refreshUi() {
        const ex = run.exec;
        const idx = ex ? ex.idx : run.shown;
        const st = STAGES[Math.max(0, idx)];
        $('stage-num').textContent = idx < 0 ? 'standby' : `phase ${idx + 1}/${STAGES.length}`;
        $('stage-name').textContent = idx < 0 ? '' : st.name;
        $('stage-title').textContent = idx < 0 ? '' : st.title;
        listEl.innerHTML = STAGES.map((s, k) => {
            const cls = run.done[k] ? 'done' : ex && ex.idx === k ? 'run' : k === run.typeIdx && run.started ? 'cur' : '';
            const mk = { done: '[x]', run: '[>]', cur: '[~]', '': '[ ]' }[cls];
            const t = run.typedAt[k] != null ? fmtTime(run.typedAt[k]) : '';
            return `<li class="${cls}"><span class="mk">${mk}</span><span>${esc(s.name)}</span><span class="t">${t}</span></li>`;
        }).join('');
        const status = run.state === 'done' ? 'done' : ex ? 'running' : run.started ? 'typing' : 'idle';
        $('status').textContent = status;
        $('status').className = 'st-' + status;
    }

    function renderPanel() {
        panelEl.innerHTML = run.panel(run.panelP);
    }

    // ------------------------------------------------------------------ typing
    function newLine() {
        if (lineEl) {
            lineEl.classList.remove('cur');
            lineEl.innerHTML = highlight(lineText);
        }
        lineEl = document.createElement('div');
        lineEl.className = 'line cur';
        lineText = '';
        codeEl.appendChild(lineEl);
        while (codeEl.children.length > 600) codeEl.removeChild(codeEl.firstChild);
    }

    function type(n, auto) {
        if (!run || !overlay.hidden || run.typeIdx >= STAGES.length) return;
        if (!run.started) {
            run.started = performance.now();
            run.state = 'typing';
            $('hint').classList.add('gone');
            refreshUi();
        }
        if (!auto) {
            run.keys++;
            keyTimes.push(performance.now());
        }
        const text = run.texts[run.typeIdx];
        for (let i = 0; i < n && run.pos < text.length; i++) {
            const ch = text[run.pos++];
            if (ch === '\n') newLine(); else lineText += ch;
        }
        if (run.pos >= text.length) phaseWritten();
        lineEl.innerHTML = highlight(lineText) + '<span class="caret"></span>';
        scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    // The phase is fully written: it runs straight away, and the next one starts on a fresh line.
    function phaseWritten() {
        const idx = run.typeIdx;
        run.typedAt[idx] = performance.now() - run.started;
        run.typeIdx++;
        run.pos = 0;
        run.autofill = false;
        if (run.typeIdx < STAGES.length) newLine();
        startExec(idx);
    }

    function startExec(idx) {
        if (run.exec) finishExec();
        const st = STAGES[idx];
        const elapsed = fmtTime(performance.now() - run.started);
        const lines = OUT[st.id].map((l) => l.replace('{HOST}', run.target.host).replace('{ELAPSED}', elapsed));
        log('cmd', `$ ghost run breach.ghost --phase ${idx + 1}`);
        run.exec = { idx, p: 0, speed: 1, lines, printed: 0, dur: Math.max(4, lines.length * 0.8) };
        run.panel = PANELS[st.id](run.target);
        run.panelP = 0;
        run.shown = idx;
        refreshUi();
        renderPanel();
    }

    // Progress is uneven on purpose: real tools stall, then rush.
    function updateExec(dt) {
        const ex = run.exec;
        ex.speed = clamp(ex.speed + rand(-2.5, 2.5) * dt * 3, 0.15, 2);
        ex.p = Math.min(1, ex.p + (dt / ex.dur) * ex.speed);
        while (ex.printed < ex.lines.length && ex.p >= ex.printed / ex.lines.length) {
            const l = ex.lines[ex.printed++];
            log(tone(l), l);
        }
        run.panelP = ex.p;
        if (ex.p >= 1) finishExec();
    }

    function finishExec() {
        const ex = run.exec;
        while (ex.printed < ex.lines.length) { const l = ex.lines[ex.printed++]; log(tone(l), l); }
        run.exec = null;
        run.panelP = 1;
        run.done[ex.idx] = true;
        renderPanel();
        if (ex.idx === STAGES.length - 1) {
            run.state = 'done';
            lineEl.innerHTML = highlight(lineText);
            setTimeout(granted, 900);
        }
        refreshUi();
    }

    function fmtTime(ms) {
        const s = Math.round(ms / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function granted() {
        const took = performance.now() - run.started;
        showOverlay(false, 'ACCESS GRANTED',
            `${run.target.name} is yours.\n${fmtTime(took)} · ${run.keys.toLocaleString('en-US')} keystrokes · ${STAGES.length} phases`,
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

    // Enter fast-forwards: the rest of the phase writes itself in a quick burst (and so runs), or the last phase finishes now.
    function fastForward() {
        if (!run || !overlay.hidden) return;
        if (run.typeIdx < STAGES.length) run.autofill = true;
        else if (run.exec) finishExec();
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
        if (e.key === 'Enter') { e.preventDefault(); fastForward(); }
        else if (e.key.length === 1 || e.key === 'Backspace') { e.preventDefault(); type(cpk); }
    });
    sink.addEventListener('input', (e) => {
        const data = e.data || '';
        const enter = e.inputType === 'insertLineBreak' || data.includes('\n');
        sink.value = '';
        if (!overlay.hidden) return;
        if (enter) { fastForward(); return; }
        for (let i = 0; i < Math.min(Math.max(1, data.length), 4); i++) type(cpk);
    });
    // Tapping the code types too, so a phone works without opening the keyboard.
    scrollEl.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') { sink.focus({ preventScroll: true }); return; }
        type(cpk);
    });
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

    // ------------------------------------------------------------------ loop
    let last = performance.now();
    let panelNext = 0, uiNext = 0;
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;
        if (run.autofill && run.typeIdx < STAGES.length) {
            const left = run.texts[run.typeIdx].length - run.pos;
            type(Math.max(4, Math.ceil(left / 18)), true);
        }
        if (run.exec) updateExec(dt);

        panelNext -= dt;
        if (panelNext <= 0) { panelNext = 1 / 15; renderPanel(); }

        uiNext -= dt;
        if (uiNext <= 0) {
            uiNext = 0.1;
            while (keyTimes.length && keyTimes[0] < now - 2000) keyTimes.shift();
            $('kps').textContent = (keyTimes.length / 2).toFixed(0);
            $('stage-pct').textContent = run.exec ? `running ${pct(run.exec.p).trim()}` : run.shown >= 0 ? 'exit 0' : '';
            $('type-pct').textContent = run.typeIdx < STAGES.length
                ? `phase ${run.typeIdx + 1}/${STAGES.length} · ${pct(run.pos / run.texts[run.typeIdx].length).trim()}`
                : 'all phases written';
        }
        requestAnimationFrame(frame);
    }

    newRun();
    if (!window.matchMedia('(pointer: coarse)').matches) sink.focus({ preventScroll: true });
    requestAnimationFrame(frame);
})();
