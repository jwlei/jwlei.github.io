/* Hivemind: a simulated graph of AI agents, each a node on its own GPU pod, working through a hard engineering goal.
   Left: input nodes. Middle: the orchestrator bus. Right: agent nodes in three layer columns. Bottom: run log,
   dispatch and costs, then the command line. Plain canvas 2D, no dependencies.
   The graph uses "world" coordinates (1 unit = 1 CSS px at zoom 1); the header and bottom panels are screen space. */
(() => {
    'use strict';

    // ---------------------------------------------------------------- setup
    const canvas = document.getElementById('sim');
    const ctx = canvas.getContext('2d');
    const $ = (id) => document.getElementById(id);
    const MONO = '"JetBrains Mono","Cascadia Code","SF Mono",Consolas,Menlo,monospace';
    const TAU = Math.PI * 2;
    const SPEEDS = [0.5, 1, 2, 4];
    let speedIdx = 1;
    const ZMIN = 0.6, ZMAX = 2.5;
    const MAX_NODES = 15;
    const C = {
        bg: '#0b0b10', node: '#14141c', nodeHot: '#1a1a25', line: '#2a2331', head: '#5e1f33', headHot: '#8a2a48',
        crimson: '#b8325a', text: '#d8cfd6', dim: '#7d6f7a', faint: '#4d424c', yellow: '#f2c94c', green: '#7bd88f', red: '#ff5470',
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
    const kfmt = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(Math.round(v)));

    // ---------------------------------------------------------------- models
    // Prices are Anthropic list prices per million tokens (input / output). Hardware, speed and quality are simulated.
    const MODELS = [
        { id: 'fable', name: 'Claude Fable 5.2', short: 'fable 5.2', pin: 8, pout: 40, speed: 0.85, quality: 1, dot: '#c49bff',
          note: 'most capable · slower · $8 / $40 per 1M tokens', gpus: 16, gpu: 'h200', kw: 21, tps: 2600 },
        { id: 'opus', name: 'Claude Opus 5.5', short: 'opus 5.5', pin: 4, pout: 20, speed: 1, quality: 0.95, dot: '#f2c94c',
          note: 'deep reasoning · $4 / $20 per 1M tokens', gpus: 8, gpu: 'h200', kw: 10.5, tps: 4200 },
        { id: 'sonnet', name: 'Claude Sonnet 5.5', short: 'sonnet 5.5', pin: 2, pout: 10, speed: 1.25, quality: 0.86, dot: '#6fb3ff',
          note: 'fast and capable · $2 / $10 per 1M tokens', gpus: 8, gpu: 'h100', kw: 8.2, tps: 7800 },
        { id: 'haiku', name: 'Claude Haiku 5.5', short: 'haiku 5.5', pin: 0.1, pout: 0.5, speed: 1.7, quality: 0.68, dot: '#7bd88f',
          note: 'fastest, cheapest · more rework · $0.10 / $0.50 per 1M tokens', gpus: 4, gpu: 'l40s', kw: 1.6, tps: 21000 },
    ];
    const modelById = Object.fromEntries(MODELS.map((m) => [m.id, m]));
    const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1'];

    // ---------------------------------------------------------------- the team
    const ROLES = [
        { name: 'Planner', key: 'planner', layer: 0, model: 'fable', job: 'breaks goals into milestones' },
        { name: 'Researcher', key: 'researcher', layer: 0, model: 'opus', job: 'reads papers, docs and postmortems' },
        { name: 'Architect', key: 'architect', layer: 0, model: 'opus', job: 'designs systems and interfaces' },
        { name: 'ML engineer', key: 'ml_engineer', layer: 1, model: 'opus', job: 'trains and tunes models' },
        { name: 'Data engineer', key: 'data_engineer', layer: 1, model: 'sonnet', job: 'builds pipelines and datasets' },
        { name: 'Backend', key: 'backend', layer: 1, model: 'sonnet', job: 'writes services and APIs' },
        { name: 'Frontend', key: 'frontend', layer: 1, model: 'sonnet', job: 'builds dashboards and UI' },
        { name: 'Security', key: 'security', layer: 2, model: 'opus', job: 'threat models and audits' },
        { name: 'QA', key: 'qa', layer: 2, model: 'haiku', job: 'tests at scale' },
        { name: 'SRE', key: 'sre', layer: 2, model: 'sonnet', job: 'runs production and rollouts' },
    ];
    const EXTRA_ROLES = [
        { name: 'Performance', key: 'performance', layer: 1, model: 'opus', job: 'profiles and optimises hot paths' },
        { name: 'DBA', key: 'dba', layer: 1, model: 'sonnet', job: 'tunes databases and queries' },
        { name: 'Red team', key: 'red_team', layer: 2, model: 'opus', job: 'attacks the system before others do' },
        { name: 'Compliance', key: 'compliance', layer: 2, model: 'sonnet', job: 'maps work to regulations' },
        { name: 'Tech writer', key: 'tech_writer', layer: 2, model: 'haiku', job: 'writes docs and runbooks' },
    ];
    const COLUMNS = ['layer 1 · research & design', 'layer 2 · build', 'layer 3 · verify & ship'];

    // Neighbours in a column affect each other. Unlisted pairs get a small default boost.
    const SYN_PAIRS = [
        ['Architect', 'Backend', 18, 'shared design context'], ['ML engineer', 'Researcher', 20, 'papers into experiments'],
        ['Data engineer', 'ML engineer', 22, 'features into training'], ['Backend', 'SRE', 12, 'shared telemetry'],
        ['SRE', 'Security', 15, 'one incident channel'], ['Frontend', 'QA', 14, 'tests next to the UI'],
        ['Architect', 'Planner', 10, 'plans match the design'], ['Backend', 'Data engineer', 12, 'schemas in lockstep'],
        ['Backend', 'QA', 10, 'faster test loops'], ['DBA', 'Data engineer', 16, 'query plans tuned in place'],
        ['Performance', 'Backend', 15, 'profiles on the same hosts'], ['Red team', 'Security', 18, 'attack and defend'],
        ['QA', 'Security', -6, 'overlapping reviews'], ['Data engineer', 'Frontend', -5, 'schema churn'],
        ['Researcher', 'SRE', -4, 'noisy neighbours'], ['Planner', 'QA', -3, 'too many status checks'],
        ['Red team', 'QA', -7, 'duplicate test traffic'],
    ];
    const SYN = new Map(SYN_PAIRS.map(([a, b, pct, why]) => [[a, b].sort().join('|'), { pct, why }]));
    const SYN_LINES = ['same rack now, streaming results straight to you', 'same fabric, no more waiting on the network',
        'co-located, sending my context over directly', 'our KV caches can share prefixes now'];
    const CLASH_LINES = ['we keep evicting each other\'s cache here', 'crowded, my latency just doubled', 'we\'re duplicating work now'];
    const HELP_REPLIES = ['yes please, start with the edge cases', 'thanks, double-check the numbers?', 'that helps, sending my notes',
        'sure, take the second half'];

    // ---------------------------------------------------------------- goals
    // [stage, task, owner, helper, steps, question, answer, result]
    const GOALS = [
        { title: 'Migrate a 40 TB Postgres cluster to multi-region with zero downtime', tasks: [
            [0, 'Scope the migration', 'Planner', 'Architect', ['reading the current topology', 'listing 212 dependent services', 'ranking the risky steps', 'writing the cutover plan'],
                'can the plan avoid a write freeze entirely?', 'yes, logical replication plus dual writes for 48 h', 'cutover plan: 6 phases, no write freeze'],
            [1, 'Benchmark replication', 'Researcher', 'Data engineer', ['comparing logical and physical replication', 'reading 14 postmortems', 'running cross-region lag tests', 'summarising trade-offs'],
                'what replication lag did you see at peak?', 'p99 lag 180 ms at 42k writes/s', 'logical replication keeps lag under 200 ms'],
            [1, 'Design the topology', 'Architect', 'Backend', ['choosing primary regions', 'designing conflict resolution', 'planning connection routing', 'drawing the failover path'],
                'can services live with sticky-region reads?', 'all but billing; billing needs a quorum read', '3 regions, quorum reads for billing only'],
            [2, 'Build replication', 'Data engineer', 'SRE', ['creating publications for 1,800 tables', 'backfilling 40 TB', 'verifying row checksums', 'wiring lag alerts'],
                'what alert threshold do you want on lag?', 'page at 2 s, warn at 500 ms', 'backfill done, checksums match on 1,800 tables'],
            [2, 'Add dual writes', 'Backend', 'Architect', ['adding a write-through layer', 'making writes idempotent', 'handling partial failures', 'shipping behind a flag'],
                'how do we settle a dual-write conflict?', 'last writer wins, hybrid logical clocks', 'dual writes live for 5% of traffic'],
            [3, 'Chaos-test failover', 'QA', 'SRE', ['killing the primary region', 'measuring recovery time', 'checking for lost writes', 'repeating 50 times'],
                'can you throttle the cross-region link?', 'done: 40% packet loss on the EU link', 'failover in 11 s, zero lost writes in 50 runs'],
            [3, 'Audit encryption', 'Security', 'Data engineer', ['checking TLS between regions', 'rotating replication credentials', 'reviewing replica access', 'writing up findings'],
                'are the replication slots on rotated keys?', 'yes, rotated 20 minutes ago', 'no critical findings, 2 low-risk fixes merged'],
            [4, 'Run the cutover', 'SRE', 'Backend', ['raising dual writes to 100%', 'moving reads region by region', 'watching the error budget', 'retiring the old primary'],
                'ready to switch billing to quorum reads?', 'ready, the flag is on', 'cutover complete with zero downtime'],
            [4, 'Write the postmortem', 'Planner', 'Researcher', ['collecting the timeline', 'summarising what went well', 'listing follow-ups', 'publishing the doc'],
                'can you pull the lag graphs into the doc?', 'added, annotated at each phase', 'postmortem published, 7 follow-ups'],
        ] },
        { title: 'Cut LLM inference p99 latency by 50% at the same cost', tasks: [
            [0, 'Set the latency budget', 'Planner', 'SRE', ['reading 30 days of traces', 'breaking p99 into stages', 'setting a target per stage', 'agreeing on guardrails'],
                'where does most of the p99 go today?', 'queueing: 61% of it, mostly at the batcher', 'target: p99 from 2.4 s to 1.2 s'],
            [1, 'Survey speculative decoding', 'Researcher', 'ML engineer', ['reading 9 recent papers', 'comparing draft-model setups', 'estimating acceptance rates', 'writing a shortlist'],
                'which draft size fits next to the KV cache?', 'a 1B draft fits with room to spare', 'speculative decoding could save 35-45%'],
            [1, 'Profile the serving stack', 'ML engineer', 'Backend', ['capturing GPU kernel timelines', 'finding idle gaps', 'measuring KV-cache misses', 'ranking the hot spots'],
                'can you add request ids to the batcher logs?', 'shipped, traces line up end to end now', 'hot spot: batcher waits 180 ms for full batches'],
            [2, 'Rewrite the batcher', 'Backend', 'ML engineer', ['switching to continuous batching', 'adding priority lanes', 'making preemption safe', 'load-testing at 3x peak'],
                'is it safe to preempt mid-sequence?', 'yes, if the KV pages stay pinned', 'continuous batching cuts queueing by 70%'],
            [2, 'Train the draft model', 'ML engineer', 'Data engineer', ['distilling from production traffic', 'training on 64 GPUs', 'measuring acceptance rate', 'quantising to 8-bit'],
                'can I get a fresh sample of last week\'s prompts?', 'sent 2M prompts, personal data scrubbed', 'draft model accepted on 74% of tokens'],
            [2, 'Ship the latency dashboard', 'Frontend', 'SRE', ['adding per-stage latency charts', 'showing the speculation hit rate', 'linking alerts', 'publishing it'],
                'which percentiles should the charts show?', 'p50, p95 and p99, per region', 'dashboard live for every on-call engineer'],
            [3, 'Check output quality', 'QA', 'ML engineer', ['running 12k eval prompts', 'comparing against the baseline', 'checking edge cases', 'signing off'],
                'are outputs identical with speculation on?', 'yes, rejection sampling keeps them identical', 'no quality change across 12k evals'],
            [3, 'Canary in one region', 'SRE', 'Backend', ['routing 5% of traffic', 'watching p99 and errors', 'scaling to 25%', 'comparing cost per token'],
                'error rate is flat, okay to go to 25%?', 'go, rollback is one flag away', 'canary p99 1.1 s, cost per token unchanged'],
            [4, 'Roll out globally', 'Planner', 'SRE', ['planning the region order', 'rolling out region by region', 'confirming the target', 'writing the summary'],
                'any region we should hold back?', 'hold ap-south until its GPU upgrade on Friday', 'p99 down 54% globally at the same cost'],
        ] },
        { title: 'Ship SOC 2 Type II and EU data residency', tasks: [
            [0, 'Map the controls', 'Planner', 'Security', ['reading 64 SOC 2 controls', 'mapping them to our systems', 'finding the gaps', 'assigning owners'],
                'which controls are we weakest on?', 'access reviews and vendor management', '64 controls mapped, 11 gaps found'],
            [1, 'Study EU residency rules', 'Researcher', 'Architect', ['reading GDPR transfer rules', 'checking sub-processor contracts', 'listing data that must stay in the EU', 'summarising obligations'],
                'do support tickets count as personal data?', 'yes, they contain names and emails', '9 data stores must stay in the EU'],
            [1, 'Design the EU data plane', 'Architect', 'Data engineer', ['splitting storage by region', 'routing users to their home region', 'designing per-region keys', 'reviewing the design'],
                'can analytics run on EU data without moving it?', 'yes, with in-region aggregation only', 'EU data plane design approved'],
            [2, 'Partition data by region', 'Data engineer', 'Backend', ['tagging 1.2B rows by region', 'moving the EU rows', 'verifying nothing leaked', 'deleting copies outside the EU'],
                'which services still read EU rows from the US?', 'only search indexing, fixing it now', '1.2B rows partitioned, zero EU rows outside'],
            [2, 'Add audit logs', 'Backend', 'Security', ['logging every admin action', 'building quarterly access reviews', 'adding break-glass alerts', 'testing tamper-proofing'],
                'should audit logs be write-once?', 'yes, object lock for 7 years', 'every admin action logged and reviewed'],
            [3, 'Penetration test', 'Security', 'QA', ['scanning the external surface', 'testing tenant isolation', 'trying privilege escalation', 'writing the report'],
                'can you reproduce the tenant-isolation finding?', 'reproduced; needs a leaked token first, low risk', '1 medium, 3 low findings, all fixed'],
            [3, 'Collect audit evidence', 'QA', 'SRE', ['gathering logs and screenshots', 'matching evidence to controls', 'filling the gaps', 'packaging for the auditor'],
                'can you export 90 days of change approvals?', 'exported 4,210 changes, all approved', 'evidence ready for 64 of 64 controls'],
            [4, 'Turn on EU residency', 'SRE', 'Data engineer', ['routing EU sign-ups to the EU', 'migrating existing EU customers', 'watching error rates', 'confirming with legal'],
                'error rates okay after the routing change?', 'flat, 0.02% as before', 'EU residency live for 3,400 customers'],
            [4, 'Hand over to the auditor', 'Planner', 'Researcher', ['scheduling the audit window', 'walking through each control', 'answering follow-ups', 'receiving the report'],
                'do we have the vendor list the auditor wants?', 'yes, 37 vendors with their own SOC 2 reports', 'audit passed with no exceptions'],
        ] },
        { title: 'Build real-time fraud detection at 1M events per second', tasks: [
            [0, 'Define detection goals', 'Planner', 'ML engineer', ['reading last year\'s fraud cases', 'setting precision and recall targets', 'defining the latency budget', 'writing the spec'],
                'what false-positive rate can we live with?', 'under 0.1%, or support gets swamped', 'catch 92% of fraud within 50 ms'],
            [1, 'Study fraud patterns', 'Researcher', 'Data engineer', ['clustering 2.3M past transactions', 'finding new attack patterns', 'reading industry reports', 'summarising signals'],
                'can I see device fingerprints for the cluster?', 'sent; 70% share 3 device models', '14 strong fraud signals found'],
            [1, 'Design the stream pipeline', 'Architect', 'Backend', ['choosing the stream processor', 'designing the feature store', 'planning exactly-once delivery', 'sizing the cluster'],
                'can the feature store answer in under 5 ms?', 'with an in-memory tier, p99 is 3 ms', '48 partitions, 3 ms feature lookups'],
            [2, 'Build real-time features', 'Data engineer', 'ML engineer', ['writing 120 streaming features', 'backfilling 2 years of history', 'checking online/offline match', 'publishing the feature set'],
                'do online and offline values match?', '99.97%, fixing a time-zone bug in the rest', '120 features live, 99.99% consistent'],
            [2, 'Train the detector', 'ML engineer', 'Data engineer', ['training gradient-boosted trees', 'training a graph model', 'blending the two', 'calibrating scores'],
                'can I get labels from the last two weeks?', 'sent 1.4M new labels', 'catches 94% of fraud at 0.08% false positives'],
            [2, 'Wire into payments', 'Backend', 'SRE', ['adding a scoring call to checkout', 'adding a fail-open fallback', 'handling timeouts', 'load-testing at 1M events/s'],
                'what happens if scoring times out?', 'fail open and queue for async review', 'scoring adds 11 ms to checkout at 1M events/s'],
            [3, 'Replay last month', 'QA', 'ML engineer', ['replaying 2.6B events', 'comparing decisions to outcomes', 'checking for drift', 'signing off'],
                'any drift on weekend traffic?', 'slightly, recalibrated the weekend scores', 'replay: 93.8% caught, 0.07% false positives'],
            [3, 'Red-team the model', 'Security', 'ML engineer', ['crafting adversarial transactions', 'probing for feature gaming', 'testing rate-limit evasion', 'writing fixes'],
                'can it be fooled by splitting payments?', 'it could; added a velocity feature', '2 evasion tricks found and closed'],
            [4, 'Go live', 'SRE', 'Backend', ['shadow mode for 48 hours', 'blocking at 10%', 'scaling to 100%', 'setting up on-call alerts'],
                'shadow results look good, switch to 10%?', 'switched, watching chargebacks', 'blocking fraud live at 1M events/s'],
        ] },
    ];
    const GENERIC = [
        [0, 'Break into milestones', 'Planner', 'Architect', ['reading the goal', 'splitting it into milestones', 'estimating effort', 'assigning owners'],
            'is this realistic in one quarter?', 'yes, if we cut the stretch goals', '5 milestones, owners assigned'],
        [1, 'Research prior art', 'Researcher', 'ML engineer', ['searching papers and repos', 'reading 18 design docs', 'comparing approaches', 'writing a summary'],
            'has anyone solved this at our scale?', 'two companies; both built on an event log', '3 viable approaches, 1 recommended'],
        [1, 'Design the system', 'Architect', 'Backend', ['sketching the components', 'defining the APIs', 'planning for failure', 'reviewing the design'],
            'can existing services take the new load?', 'most can; auth needs to scale out first', 'design approved, 2 open questions'],
        [2, 'Build the core service', 'Backend', 'Architect', ['scaffolding the service', 'writing the core logic', 'adding retries and timeouts', 'writing tests'],
            'synchronous or event-driven?', 'event-driven, it decouples the slow parts', 'core service built, 412 tests passing'],
        [2, 'Build the data pipeline', 'Data engineer', 'ML engineer', ['defining the schemas', 'backfilling history', 'adding data quality checks', 'publishing the datasets'],
            'which fields do you need first?', 'timestamps, user ids and the payload', 'pipeline live, 99.98% of rows pass checks'],
        [3, 'Load-test at scale', 'QA', 'SRE', ['writing load scenarios', 'ramping to 3x peak', 'finding the bottleneck', 're-testing after the fix'],
            'can I have a full-size staging cluster?', 'provisioned: 64 nodes, same as production', 'holds 3x peak with p99 under 200 ms'],
        [3, 'Security review', 'Security', 'Backend', ['threat modelling', 'reviewing auth and secrets', 'scanning dependencies', 'writing findings'],
            'where are the service credentials stored?', 'in the vault, rotated every 24 hours', 'no critical issues, 3 fixes merged'],
        [4, 'Roll out gradually', 'SRE', 'Backend', ['shipping to 1% of users', 'watching the error budget', 'ramping to 100%', 'setting up alerts'],
            'error budget healthy, ramp to 50%?', 'go ahead', 'fully rolled out, no incidents'],
        [4, 'Report the results', 'Planner', 'Researcher', ['collecting metrics', 'comparing against the goal', 'listing follow-ups', 'sharing the report'],
            'can you add before/after charts?', 'added on the first page', 'report shared: goal met'],
    ];
    const STAGES = ['scope', 'research', 'build', 'verify', 'ship'];
    const snake = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    // ---------------------------------------------------------------- state
    let W = 0, H = 0, DPR = 1;
    const L = { s: 1 };
    let t = 0;
    let paused = false;
    const cam = { x: 0, y: 0, z: 1 };
    const mouse = { sx: -1e4, sy: -1e4, type: 'mouse' };
    const stats = { spend: 0, monthBase: 18420, budget: 50000, tokens: 0, msgTimes: [], tasksDone: 0, bucket: 0,
        hist: [], perSec: [], util: [], lastSec: 0, runs: [], runNo: 0 };
    const timers = [];
    const packets = [];
    const runLog = [];
    let plan = null;
    let planSeq = 0;
    let goalIdx = randi(0, GOALS.length - 1);
    let hovered = null;
    let selected = null;
    let autoFocus = null;
    let gesture = null;
    let synergy = [];
    let committed = new Set();
    const ui = { approve: null, dispatchRows: [] };

    const font = (px, w = '') => `${w} ${Math.round(px * L.s * (L.f || 1) * 10) / 10}px ${MONO}`;
    const fontS = (px, w = '') => `${w} ${Math.round(px * L.s * 10) / 10}px ${MONO}`;
    const toWorld = (sx, sy) => ({ x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z });
    function after(sec, fn) { timers.push({ at: t + sec, fn }); }

    let podSeq = 0;
    function makeNode(role) {
        const region = REGIONS[podSeq++ % REGIONS.length];
        return {
            ...role, x: 0, y: 0, ty: 0, exp: 0, flash: 0, act: 0, status: 'idle', task: null, helping: null, helpUntil: 0,
            nextIdle: rand(8, 18), spend: 0, tokIn: 0, tokOut: 0, sent: 0, said: null, talkUntil: 0,
            loadingUntil: 0, loadingFrom: 0, loadingModel: null, seed: rand(0, 100), chip: null, rect: null,
            podId: `pod-${region.slice(0, 2)}${String(randi(1, 48)).padStart(2, '0')}`, region, rack: randi(3, 40),
            gpu: Array.from({ length: 16 }, () => rand(5, 15)),
            wire: Array.from({ length: 4 }, () => Array.from({ length: 9 }, () => [randi(0, 11), randi(0, 11)])),
        };
    }
    const nodes = ROLES.map(makeNode);
    const byName = Object.fromEntries(nodes.map((a) => [a.name, a]));
    const cols = [0, 1, 2].map((c) => nodes.filter((a) => a.layer === c));
    const hub = Object.assign(makeNode({ name: 'Orchestrator', key: 'orchestrator', layer: -1, model: 'fable', job: 'hands out work and tracks the goal' }),
        { isHub: true, shownProgress: 0, status: 'waiting for a goal' });
    const all = () => [hub, ...nodes];
    const colOf = (a) => cols.findIndex((c) => c.includes(a));

    function charge(a, tin, tout) {
        const m = modelById[a.model];
        const cost = (tin * m.pin + tout * m.pout) / 1e6;
        a.spend += cost;
        a.tokIn += tin;
        a.tokOut += tout;
        stats.spend += cost;
        stats.tokens += tin + tout;
        stats.bucket += cost;
    }

    function focusOn(a, secs) {
        if (a.isHub) return;
        if (autoFocus && autoFocus.until > t && autoFocus.node !== a) return;
        autoFocus = { node: a, until: t + secs };
    }

    // ---------------------------------------------------------------- talking
    function log(who, color, text) {
        const d = new Date();
        runLog.push({ ts: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, who, color, text });
        if (runLog.length > 60) runLog.shift();
    }
    function say(from, to, text, onArrive) {
        if (from === to) { if (onArrive) onArrive(); return; }
        if (from.talkUntil > t) { after(from.talkUntil - t + 0.2, () => say(from, to, text, onArrive)); return; }
        const near = synergy.some((l) => (l.a === from && l.b === to) || (l.a === to && l.b === from));
        const dur = near ? 0.9 : 1.6;
        from.talkUntil = t + dur + 0.9;
        from.said = { to, text, until: t + dur + 3.5 };
        from.flash = 1;
        from.sent++;
        packets.push({ from, to, k: 0, dur, onArrive, you: false });
        charge(from, randi(3000, 14000), randi(80, 500));
        stats.msgTimes.push(t);
        log(`${from.key}→${to.key}`, from.isHub ? C.yellow : C.crimson, text);
    }
    function sys(text, you) { log(you ? 'you' : 'sys', you ? C.yellow : C.dim, text); }

    let toastTimer = 0;
    function toast(text) {
        const el = $('toast');
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
    }

    // ---------------------------------------------------------------- plans
    function newPlan(goalTitle, defs) {
        for (const a of nodes) { a.task = null; a.helping = null; }
        const tasks = defs.filter((d) => byName[d[2]] && byName[d[3]]).map(([phase, name, owner, helper, steps, ask, reply, result]) => ({
            phase, name, key: snake(name), owner: byName[owner], helper: byName[helper], steps, ask, reply, result,
            deps: [], progress: 0, state: 'pending', dur: rand(16, 26), asked: false, deep: false, reworked: false, boost: 1,
        }));
        for (let s = 0; s < STAGES.length; s++) {
            const st = tasks.filter((x) => x.phase === s);
            st.forEach((x) => { x.deps = tasks.filter((y) => y.phase === s - 1); });
        }
        const plannedDur = 5 + STAGES.reduce((sum, _, s) => {
            const st = tasks.filter((x) => x.phase === s);
            return sum + (st.length ? Math.max(...st.map((x) => x.dur)) * 1.3 + 4 : 0);
        }, 0);
        stats.runNo++;
        plan = { seq: ++planSeq, goal: goalTitle, tasks, born: t, doneAt: 0, done: 0, plannedDur, gate: 'closed', gateAt: 0 };
        hub.status = 'planning';
        sys(`goal accepted: ${goalTitle}`);
        toast(`new goal: ${goalTitle}`);
        say(hub, byName.Planner, `new goal "${goalTitle}", break it into milestones`);
    }
    function nextGoal() {
        goalIdx = (goalIdx + 1) % GOALS.length;
        newPlan(GOALS[goalIdx].title, GOALS[goalIdx].tasks);
    }

    function synergyBonus(a) {
        let s = 0;
        for (const l of synergy) if (l.a === a || l.b === a) s += l.pct;
        return clamp(s, -30, 60) / 100;
    }

    // a human approves the ship stage; if nobody does, policy approves it after a while
    function approve(byYou) {
        if (!plan || plan.gate !== 'waiting') { if (byYou) toast('nothing is waiting for approval'); return; }
        plan.gate = 'open';
        if (byYou) sys('you approved the ship stage', true);
        else sys('no answer at the human gate: auto-approved by policy');
        toast(byYou ? 'approved: shipping' : 'auto-approved by policy');
        say(hub, byName.SRE, 'approval received, go ahead and ship');
    }

    function updatePlan(dt) {
        if (!plan) return;
        const current = plan;
        const ready = t - plan.born > 3;
        let done = 0, active = 0;
        for (const task of plan.tasks) {
            const o = task.owner;
            const depsDone = task.deps.every((d) => d.state === 'done');
            if (task.state === 'pending' && ready && depsDone && task.phase === 4 && plan.gate === 'closed') {
                plan.gate = 'waiting';
                plan.gateAt = t;
                sys('human gate: the ship stage needs your approval');
                toast('human gate: approve the ship stage (click approve or type "approve")');
            }
            if (task.state === 'pending' && ready && depsDone && (task.phase < 4 || plan.gate === 'open')) {
                task.state = 'assigning';
                say(hub, o, `take "${task.key}"`, () => {
                    if (plan !== current) return;
                    task.state = 'active';
                    if (!o.task) o.task = task;
                    focusOn(o, 3.5);
                });
            } else if (task.state === 'active') {
                active++;
                if (o.loadingUntil > t) continue;
                const m = modelById[o.model];
                const helped = task.helper.helping === task && t < task.helper.helpUntil;
                const rate = (m.speed * task.boost * (1 + synergyBonus(o)) * (helped ? 1.2 : 1)) / task.dur;
                task.progress = Math.min(1, task.progress + dt * rate);
                if (!o.task) o.task = task;
                if (o.task === task) o.status = task.steps[Math.min(task.steps.length - 1, Math.floor(task.progress * task.steps.length))];
                charge(o, 2600 * dt, 55 * dt);
                if (!task.deep && task.progress > 0.6) { task.deep = true; focusOn(o, 3); }
                if (!task.asked && task.progress > 0.35) {
                    task.asked = true;
                    const h = task.helper;
                    say(o, h, task.ask, () => {
                        h.helping = task;
                        h.helpUntil = t + 8;
                        h.status = `helping ${o.key}`;
                        after(1.4, () => say(h, o, task.reply));
                    });
                }
                if (task.progress >= 1) {
                    const reviewer = o === byName.QA ? byName.Security : byName.QA;
                    if (!task.reworked && reviewer && Math.random() < (1 - m.quality) * 0.9) {
                        task.reworked = true;
                        task.progress = 0.62;
                        say(reviewer, o, `found problems in ${task.key}, sending it back`, () => after(0.8, () => say(o, reviewer, 'on it')));
                        continue;
                    }
                    task.state = 'done';
                    if (o.task === task) o.task = plan.tasks.find((x) => x.state === 'active' && x.owner === o) || null;
                    say(o, hub, `done: ${task.result}`, () => {
                        if (plan !== current) return;
                        stats.tasksDone++;
                        hub.flash = 1;
                    });
                }
            }
            if (task.state === 'done') done++;
        }
        plan.done = done;
        if (plan.gate === 'waiting' && t - plan.gateAt > 18) approve(false);
        if (!plan.doneAt) hub.status = plan.gate === 'waiting' ? 'waiting at the human gate' : active ? `coordinating ${active} task${active > 1 ? 's' : ''}` : 'planning';
        if (done === plan.tasks.length && !plan.doneAt) {
            plan.doneAt = t;
            hub.status = 'goal complete';
            const took = t - plan.born;
            const ahead = plan.plannedDur - took;
            stats.runs.push({ took, ahead });
            sys(`goal complete in ${fmtDur(took)}${ahead > 0 ? `, ${fmtDur(ahead)} ahead of plan` : ''}`);
            toast(`goal complete: ${plan.goal}`);
            const seq = plan.seq;
            after(8, () => { if (plan && plan.seq === seq) nextGoal(); });
        }
    }
    function fmtDur(sec) {
        const v = Math.max(0, Math.round(sec));
        return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    }

    // ---------------------------------------------------------------- interactions
    function askNode(a) {
        a.flash = 1;
        if (a.loadingUntil > t) say(a, hub, `loading ${modelById[a.loadingModel].short} weights, back in a moment`);
        else if (a.task) say(a, hub, `${a.task.key}: ${a.status}, ${Math.round(a.task.progress * 100)}% done`);
        else if (a.helping && t < a.helpUntil) say(a, hub, `helping ${a.helping.owner.key} with ${a.helping.key}`);
        else {
            const next = plan && plan.tasks.find((x) => x.owner === a && x.state === 'pending');
            say(a, hub, next ? `free, next up: ${next.key}` : 'free, happy to help anyone');
        }
    }
    function statusRound() {
        sys('you asked every node for a status update', true);
        hub.flash = 1;
        nodes.filter((a) => a.task).slice(0, 5).forEach((a, i) => after(0.6 + i * 1.4, () => {
            if (a.task) say(a, hub, `${a.task.key}: ${Math.round(a.task.progress * 100)}%`);
        }));
    }
    function prioritise(task) {
        if (task.state === 'done') { toast(`${task.key} is already done`); return; }
        task.boost = Math.min(2, task.boost + 0.6);
        sys(`you made ${task.key} the top priority`, true);
        say(hub, task.owner, `${task.key} is now top priority`, () => { if (task.state === 'active') task.owner.task = task; });
    }
    function idleChat(a) {
        if (!plan) return;
        const active = plan.tasks.filter((x) => x.state === 'active' && x.owner !== a);
        if (active.length && Math.random() < 0.6) {
            const task = pick(active);
            say(a, task.owner, `free, want help with ${task.key}?`, () => after(1.2, () => say(task.owner, a, pick(HELP_REPLIES), () => {
                a.helping = task;
                a.helpUntil = t + 10;
                a.status = `helping ${task.owner.key}`;
                task.boost = Math.min(1.6, task.boost + 0.12);
            })));
        } else a.status = pick(['idle', 'warming the KV cache', 'reading the codebase', 'watching dashboards']);
    }
    function switchModel(a, id) {
        if (a.model === id && !a.loadingUntil) return;
        const m = modelById[id];
        a.loadingModel = id;
        a.loadingFrom = t;
        a.loadingUntil = t + 2.4;
        a.status = `loading ${m.short} weights`;
        sys(`you moved ${a.key} to ${m.name}`, true);
        autoFocus = { node: a, until: t + 4 };
    }
    function spawnNode() {
        const role = EXTRA_ROLES.find((r) => !byName[r.name]);
        if (!role || nodes.length >= MAX_NODES) { toast(`the graph is full (${nodes.length} nodes)`); return; }
        const a = makeNode(role);
        nodes.push(a);
        byName[a.name] = a;
        cols[role.layer].push(a);
        layout();
        a.y = a.ty;
        sys(`you added ${a.key} on ${modelById[a.model].name}`, true);
        toast(`${a.key} online · ${modelById[a.model].name}`);
        focusOn(a, 4);
        commitSynergy();
        after(1, () => say(hub, a, `welcome ${a.key}, jump in where someone needs a hand`));
    }

    // ---------------------------------------------------------------- synergy: neighbours in a column
    function computeSynergy() {
        synergy = [];
        for (const col of cols) {
            for (let i = 0; i < col.length - 1; i++) {
                const a = col[i], b = col[i + 1];
                if (gesture && gesture.type === 'node' && gesture.moved && (gesture.node === a || gesture.node === b)) continue;
                const key = [a.name, b.name].sort().join('|');
                const info = SYN.get(key) || { pct: 4, why: 'shared KV cache' };
                synergy.push({ a, b, key, pct: info.pct, why: info.why });
            }
        }
    }
    function commitSynergy() {
        computeSynergy();
        const now = new Set(synergy.map((l) => l.key));
        for (const l of synergy) {
            if (committed.has(l.key)) continue;
            sys(`${l.a.key} + ${l.b.key}: ${l.pct > 0 ? '+' : ''}${l.pct}% (${l.why})`);
            say(l.a, l.b, pick(l.pct > 0 ? SYN_LINES : CLASH_LINES));
        }
        for (const k of committed) if (!now.has(k)) sys(`${k.split('|').map((n) => (byName[n] ? byName[n].key : n)).join(' + ')}: link lost`);
        committed = now;
    }

    // ---------------------------------------------------------------- layout
    const INPUTS = ['brief', 'constraints', 'budget', 'cluster', 'models', 'prior_runs'];
    function layout(snap = true) {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        L.s = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 11) / 11;
        const s = L.s;
        L.portrait = W < 760;
        const top = ($('topbar').offsetHeight || 34) + 8;
        const cmdTop = $('cmd').getBoundingClientRect().top || H - 40;
        L.bpH = L.portrait ? Math.min(170, H * 0.24) : clamp(H * 0.2, 150, 230 * s);
        L.bpY = cmdTop - 6 - L.bpH;
        L.gx = 10;
        L.gy = top;
        L.gw = W - 20;
        L.gh = L.bpY - 10 - top;

        if (!L.portrait) {
            L.icW = clamp(L.gw * 0.16, 150, 250 * s);
            L.busX = L.gx + L.icW + L.gw * 0.055;
            L.busW = 16 * s;
            L.gridX = L.busX + L.busW + L.gw * 0.045;
        } else {
            L.icW = 0;
            L.busX = L.gx + 2;
            L.busW = 10;
            L.gridX = L.busX + L.busW + 14;
        }
        L.gridW = L.gx + L.gw - L.gridX;
        L.colW = L.gridW / 3;
        L.nodeW = L.colW - (L.portrait ? 6 : 16 * s);
        L.colTop = L.gy + 16 * s;

        // node metrics; shrink rows if the tallest column would not fit
        L.f = 1;
        const rows = L.portrait ? 3 : 5;
        for (let i = 0; i < 6; i++) {
            L.rowH = (L.portrait ? 10.5 : 12) * s * L.f;
            L.headH = (L.portrait ? 13 : 15) * s * L.f;
            L.gap = (L.portrait ? 14 : 18) * s * L.f;
            L.nodeH = L.headH + rows * L.rowH + 6 * s * L.f;
            L.expH = clamp(L.nodeW * 0.5, 60, 140 * s) * L.f;
            const n = Math.max(...cols.map((c) => c.length));
            const need = n * L.nodeH + (n - 1) * L.gap + L.expH;
            const avail = L.gy + L.gh - L.colTop;
            if (need <= avail) break;
            L.f *= Math.max(0.6, avail / need);
        }
        L.rows = rows;
        reflow(snap !== false);
        clampCam();
        computeSynergy();
    }

    // stack nodes in their columns; an expanded node pushes the ones below it down
    function reflow(snap) {
        const drag = gesture && gesture.type === 'node' && gesture.moved ? gesture : null;
        cols.forEach((col, c) => {
            const x = L.gridX + L.colW * c + L.colW / 2;
            let y = L.colTop;
            let slot = 0;
            for (const a of col) {
                if (drag && drag.node === a) continue;
                if (drag && drag.col === c && drag.idx === slot) { drag.slotY = y; y += L.nodeH + L.gap; }
                a.x = x;
                a.ty = y;
                if (snap) a.y = y;
                y += L.nodeH + a.exp * L.expH + L.gap;
                slot++;
            }
            if (drag && drag.col === c && drag.idx >= slot) drag.slotY = y;
        });
    }

    function clampCam() {
        cam.z = clamp(cam.z, ZMIN, ZMAX);
        const cx = W / 2, cy = L.gy + L.gh / 2;
        cam.x = clamp(cam.x, W * 0.1 - cx * cam.z, W * 0.9 - cx * cam.z);
        cam.y = clamp(cam.y, H * 0.05 - cy * cam.z, H * 0.95 - cy * cam.z);
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
    function update(dt) {
        for (let i = timers.length - 1; i >= 0; i--) {
            if (timers[i].at <= t) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
        }
        for (const a of all()) {
            a.flash = Math.max(0, a.flash - dt * 0.9);
            if (a.loadingUntil && t >= a.loadingUntil) {
                a.model = a.loadingModel;
                a.loadingUntil = 0;
                a.flash = 1;
                a.status = a.task ? a.task.steps[0] : 'idle';
                sys(`${a.key} now runs ${modelById[a.model].name}`);
            }
            const helpingNow = a.helping && t < a.helpUntil;
            if (a.helping && !helpingNow) a.helping = null;
            const working = a.isHub ? !!plan && !plan.doneAt : !!a.task || helpingNow || a.loadingUntil > t;
            a.act = lerp(a.act, working ? 1 : 0.1, Math.min(1, dt * 1.5));
            const m = modelById[a.model];
            for (let k = 0; k < m.gpus; k++) {
                const target = a.loadingUntil > t ? 35 + 30 * Math.sin(t * 9 + k) : 6 + a.act * (72 + 18 * Math.sin(t * 1.7 + k * 1.3 + a.seed));
                a.gpu[k] += (target - a.gpu[k]) * Math.min(1, dt * 3);
            }
            if (a.isHub) continue;
            if (helpingNow) charge(a, 1200 * dt, 25 * dt);
            if (!working) {
                if (a.status.startsWith('helping') || (plan && plan.tasks.some((x) => x.steps.includes(a.status)))) a.status = 'idle';
                a.nextIdle -= dt;
                if (a.nextIdle <= 0) { a.nextIdle = rand(12, 22); idleChat(a); }
            }
        }
        if (hub.act > 0.5) charge(hub, 600 * dt, 12 * dt);
        for (let i = packets.length - 1; i >= 0; i--) {
            const p = packets[i];
            p.k += dt / p.dur;
            if (p.k >= 1) {
                packets.splice(i, 1);
                p.to.flash = 1;
                if (p.onArrive) p.onArrive();
            }
        }
        updatePlan(dt);
        if (t - stats.lastSec >= 1) {
            stats.lastSec = t;
            stats.hist.push(stats.bucket);
            stats.perSec.push(stats.bucket);
            stats.bucket = 0;
            if (stats.hist.length > 60) stats.hist.shift();
            if (stats.perSec.length > 40) stats.perSec.shift();
            const util = all().reduce((s2, a) => s2 + a.act, 0) / all().length;
            stats.util.push(0.55 + util * 0.35 + rand(-0.03, 0.03));
            if (stats.util.length > 40) stats.util.shift();
        }
    }

    // expansion follows hover, selection and the node most recently doing something interesting
    function animate(raw) {
        const focus = focusNode();
        for (const a of nodes) {
            const target = a === focus && !(gesture && gesture.type === 'node' && gesture.moved) ? 1 : 0;
            a.exp += (target - a.exp) * Math.min(1, raw * 7);
            if (a.exp < 0.002) a.exp = 0;
        }
        reflow(false);
        for (const a of nodes) {
            if (gesture && gesture.type === 'node' && gesture.moved && gesture.node === a) continue;
            a.y += (a.ty - a.y) * Math.min(1, raw * 10);
        }
    }
    function focusNode() {
        if (hovered && (hovered.kind === 'node' || hovered.kind === 'chip') && !hovered.obj.isHub) return hovered.obj;
        if (selected) return selected;
        if (autoFocus && autoFocus.until > t) return autoFocus.node;
        return null;
    }

    // ---------------------------------------------------------------- draw helpers
    function fitText(text, maxW) {
        if (maxW <= 4) return '';
        if (ctx.measureText(text).width <= maxW) return text;
        let s = text;
        while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
        return s + '…';
    }
    function box(x, y, w, h, fill, stroke) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
    }
    function nodeH(a) { return L.nodeH + a.exp * L.expH; }
    function bez(x1, y1, x2, y2) {
        const mx = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
    }
    function bezPt(x1, y1, x2, y2, k) {
        const mx = (x1 + x2) / 2, u = 1 - k;
        return {
            x: u * u * u * x1 + 3 * u * u * k * mx + 3 * u * k * k * mx + k * k * k * x2,
            y: u * u * u * y1 + 3 * u * u * k * y1 + 3 * u * k * k * y2 + k * k * k * y2,
        };
    }
    function busY(frac) { return L.colTop + frac * (L.gy + L.gh - L.colTop); }
    function anchor(a, side) {
        if (a.isHub) return { x: L.busX + L.busW, y: busY(0.5) };
        const x = side === 'left' ? a.x - L.nodeW / 2 : a.x + L.nodeW / 2;
        return { x, y: a.y + L.headH / 2 };
    }

    // ---------------------------------------------------------------- draw
    let inputRects = [];
    let particles = [];
    function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * cam.x, DPR * cam.y);
        drawColumnLabels();
        if (!L.portrait) drawInputs();
        drawBusWires();
        drawBus();
        drawPackets();
        drawSynergy();
        const focus = focusNode();
        for (const a of nodes) if (!(gesture && gesture.type === 'node' && gesture.moved && gesture.node === a)) drawNode(a, a === focus);
        if (gesture && gesture.type === 'node' && gesture.moved) {
            const g = gesture;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = C.yellow;
            ctx.strokeRect(L.gridX + L.colW * g.col + (L.colW - L.nodeW) / 2 + 0.5, (g.slotY || L.colTop) + 0.5, L.nodeW - 1, L.nodeH - 1);
            ctx.setLineDash([]);
            drawNode(g.node, true, true);
        }
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        drawBottom();
    }

    function drawColumnLabels() {
        ctx.font = font(8.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = C.faint;
        COLUMNS.forEach((label, c) => {
            const x = L.gridX + L.colW * c + (L.colW - L.nodeW) / 2;
            ctx.fillText(fitText(label, L.nodeW), x, L.gy + 6 * L.s);
        });
        if (!L.portrait) ctx.fillText('inputs', L.gx, L.gy + 6 * L.s);
        ctx.textBaseline = 'alphabetic';
    }

    // left column: the inputs the run works from, each with a little bar chart
    function inputRows(key) {
        const month = stats.monthBase + stats.spend;
        const rate = stats.hist.reduce((a, b) => a + b, 0) * (3600 / Math.max(1, stats.hist.length)) * SPEEDS[speedIdx];
        switch (key) {
            case 'brief': return [['goal', plan ? plan.goal : '-'], ['owner', 'you'], ['mode', 'autonomous'], ['stage', plan ? `${STAGES[Math.min(4, Math.max(0, ...plan.tasks.filter((x) => x.state !== 'pending').map((x) => x.phase), 0))]} ${plan.done}/${plan.tasks.length}` : '-']];
            case 'constraints': return [['downtime', '0 s'], ['data', 'public + scrubbed'], ['human gate', 'before ship'], ['max spend', '$400 / run']];
            case 'budget': return [['spent', money(stats.spend)], ['rate', money(rate, 0) + '/h'], ['month', `$${kfmt(month)} / $${kfmt(stats.budget)}`], ['cap', 'ok']];
            case 'cluster': return [['gpus', '2,048'], ['util', Math.round((stats.util[stats.util.length - 1] || 0.6) * 100) + '%'], ['power', ((stats.util[stats.util.length - 1] || 0.6) * 4).toFixed(2) + ' MW'], ['team', `${all().length} pods`]];
            case 'models': return MODELS.map((m) => [m.short, `$${m.pin}/$${m.pout} ·${all().filter((a) => a.model === m.id).length}`]);
            default: return [['runs', String(Math.max(0, stats.runNo - 1))], ['avg', stats.runs.length ? fmtDur(stats.runs.reduce((a, r) => a + r.took, 0) / stats.runs.length) : '-'],
                ['ahead', stats.runs.length ? fmtDur(stats.runs.reduce((a, r) => a + r.ahead, 0) / stats.runs.length) : '-'], ['last', stats.runs.length ? 'ok' : '-']];
        }
    }
    function inputSpark(key) {
        if (key === 'budget') return stats.perSec;
        if (key === 'cluster') return stats.util;
        if (key === 'prior_runs') return stats.runs.map((r) => r.took).slice(-20);
        if (key === 'models') return all().map((a) => a.spend);
        if (key === 'brief') return plan ? plan.tasks.map((x) => x.progress) : [];
        return [0.4, 0.6, 0.5, 0.7, 0.3, 0.8, 0.5, 0.6];
    }
    function drawInputs() {
        const s = L.s;
        const x = L.gx, w = L.icW;
        const rowH = 11 * s, headH = 14 * s, sparkH = 16 * s;
        const nodeHt = headH + 4 * rowH + sparkH + 10 * s;
        const avail = L.gy + L.gh - L.colTop;
        const n = Math.min(INPUTS.length, Math.max(2, Math.floor((avail + 10 * s) / (nodeHt + 10 * s))));
        const gap = n > 1 ? (avail - n * nodeHt) / (n - 1) : 0;
        inputRects = [];
        for (let i = 0; i < n; i++) {
            const key = INPUTS[i];
            const y = L.colTop + i * (nodeHt + Math.min(gap, 40 * s));
            inputRects.push({ key, x, y, w, h: nodeHt });
            box(x, y, w, nodeHt, C.node, C.line);
            box(x, y, w, headH, C.head);
            ctx.font = font(8.5, '600');
            ctx.fillStyle = C.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(key, x + 6 * s, y + headH / 2);
            ctx.font = font(8);
            inputRows(key).slice(0, 4).forEach(([k, v], r) => {
                const yy = y + headH + rowH * (r + 0.6);
                ctx.fillStyle = C.dim;
                ctx.textAlign = 'left';
                ctx.fillText(k, x + 6 * s, yy);
                ctx.fillStyle = C.text;
                ctx.textAlign = 'right';
                ctx.fillText(fitText(v, w - 60 * s), x + w - 6 * s, yy);
                ctx.fillStyle = C.crimson;
                ctx.fillRect(x + w - 1, yy - 1.5, 3, 3);
            });
            const data = inputSpark(key);
            const max = Math.max(1e-9, ...data);
            const sx = x + 6 * s, sy = y + nodeHt - 5 * s, sw = w - 12 * s;
            const bars = 32;
            for (let k = 0; k < bars; k++) {
                const v = data.length ? data[Math.floor((k / bars) * data.length)] / max : 0.3 + 0.3 * Math.sin(k + t);
                const hh = Math.max(1, v * sparkH * 0.9);
                ctx.fillStyle = rgba(C.crimson, 0.45 + 0.5 * v);
                ctx.fillRect(sx + (k * sw) / bars, sy - hh, sw / bars - 1, hh);
            }
        }
        ctx.textBaseline = 'alphabetic';
    }

    // the wire bundle: inputs into the bus, the bus out to every node
    function drawBusWires() {
        const s = L.s;
        const bx = L.busX, bw = L.busW;
        ctx.lineWidth = 0.7;
        if (!L.portrait) {
            if (!particles.length) particles = Array.from({ length: 260 }, () => ({ w: randi(0, 23), k: Math.random(), v: rand(0.05, 0.25), j: rand(-6, 6) }));
            const wires = [];
            inputRects.forEach((r, i) => {
                for (let k = 0; k < 4; k++) {
                    const y1 = r.y + 14 * s + 11 * s * (k + 0.6);
                    const y2 = busY(((i * 4 + k) * 0.37 + 0.05) % 1);
                    wires.push([r.x + r.w + 1, y1, bx, y2]);
                }
            });
            ctx.strokeStyle = 'rgba(184,50,90,0.18)';
            for (const [x1, y1, x2, y2] of wires) { bez(x1, y1, x2, y2); ctx.stroke(); }
            ctx.fillStyle = 'rgba(216,207,214,0.45)';
            for (const p of particles) {
                const wv = wires[p.w % wires.length];
                if (!wv) break;
                p.k = (p.k + p.v / 60) % 1;
                const q = bezPt(wv[0], wv[1], wv[2], wv[3], p.k);
                ctx.fillRect(q.x + p.j * Math.sin(p.k * 3), q.y + p.j * 0.6, 1.2, 1.2);
            }
        }
        for (const a of nodes) {
            const left = anchor(a, 'left');
            const hot = a.task || (a.helping && t < a.helpUntil);
            const gateHot = plan && plan.gate === 'waiting' && plan.tasks.some((x) => x.phase === 4 && x.owner === a);
            for (let k = 0; k < 3; k++) {
                const y1 = busY(((a.seed * 0.17 + k * 0.29) % 1));
                ctx.strokeStyle = gateHot ? rgba(C.yellow, 0.5) : hot ? rgba(C.crimson, 0.45) : 'rgba(184,50,90,0.14)';
                ctx.lineWidth = hot && k === 0 ? 1.2 : 0.7;
                bez(bx + bw, y1, left.x - 3, left.y + k * L.rowH);
                ctx.stroke();
            }
        }
    }

    function drawBus() {
        const s = L.s;
        const x = L.busX, w = L.busW, y0 = L.colTop - 10 * s, y1 = L.gy + L.gh;
        const hot = hovered && hovered.kind === 'hub';
        box(x, y0, w, y1 - y0, '#101017', hot ? C.crimson : C.line);
        // two columns of port squares, lit by traffic
        const n = Math.floor((y1 - y0 - 8) / (6 * s));
        for (let i = 0; i < n; i++) {
            for (let c = 0; c < 2; c++) {
                const v = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 0.7 + c * 2);
                ctx.fillStyle = rgba(v > 0.85 && hub.act > 0.5 ? C.crimson : '#d8cfd6', 0.12 + 0.35 * v * hub.act);
                ctx.fillRect(x + 3 + c * (w / 2 - 2), y0 + 5 + i * 6 * s, w / 2 - 5, 3 * s);
            }
        }
        // label and model chip above the bus
        ctx.font = font(8, '600');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = C.yellow;
        const label = L.portrait ? '' : `orchestrator · ${modelById[hub.model].short} · ${Math.round(hub.shownProgress * 100)}%`;
        ctx.fillText(label, x - 2, y0 - 2);
        ctx.textBaseline = 'alphabetic';
        const target = plan ? (plan.done + plan.tasks.filter((q) => q.state === 'active').reduce((sum, q) => sum + q.progress, 0)) / plan.tasks.length : 0;
        hub.shownProgress = lerp(hub.shownProgress, target, 0.05);
        // progress fill along the bus edge
        ctx.fillStyle = rgba(C.yellow, 0.8);
        ctx.fillRect(x + w - 2, y1 - (y1 - y0) * hub.shownProgress, 2, (y1 - y0) * hub.shownProgress);
        hub.rect = { x: x - 4, y: y0, w: w + 8, h: y1 - y0 };
    }

    function drawPackets() {
        for (const p of packets) {
            const a = p.from.isHub ? anchor(p.from) : anchor(p.from, p.to.isHub || p.to.x < p.from.x ? 'left' : 'right');
            const b = p.to.isHub ? anchor(p.to) : anchor(p.to, p.from.isHub || p.from.x < p.to.x ? 'left' : 'right');
            if (Math.abs(a.x - b.x) < 4) { a.x = p.from.x + L.nodeW / 2; b.x = p.to.x + L.nodeW / 2; }
            const e = ease(p.k);
            const c = p.from.isHub ? C.yellow : C.crimson;
            ctx.strokeStyle = rgba(c, 0.55);
            ctx.lineWidth = 1.2;
            bez(a.x, a.y, b.x, b.y);
            ctx.stroke();
            const q = bezPt(a.x, a.y, b.x, b.y, e);
            ctx.fillStyle = c;
            ctx.fillRect(q.x - 3, q.y - 2, 6, 4);
        }
    }

    function drawSynergy() {
        const s = L.s;
        for (const l of synergy) {
            const top = l.a.y < l.b.y ? l.a : l.b, bot = top === l.a ? l.b : l.a;
            const y1 = top.y + nodeH(top), y2 = bot.y;
            const c = l.pct > 0 ? C.green : C.red;
            const x = top.x;
            ctx.strokeStyle = rgba(c, 0.8);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - L.nodeW * 0.3, y1);
            ctx.lineTo(x - L.nodeW * 0.3, y2);
            ctx.moveTo(x + L.nodeW * 0.3, y1);
            ctx.lineTo(x + L.nodeW * 0.3, y2);
            ctx.stroke();
            ctx.font = font(8, '600');
            const label = `${l.pct > 0 ? '+' : ''}${l.pct}% ${L.portrait ? '' : l.why}`.trim();
            const txt = fitText(label, L.nodeW * 0.55);
            const tw = ctx.measureText(txt).width + 8 * s;
            const my = (y1 + y2) / 2;
            box(x - tw / 2, my - 6 * s, tw, 12 * s, l.pct > 0 ? '#11261a' : '#2c1118', c);
            ctx.fillStyle = c;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, x, my + 0.5);
            ctx.textBaseline = 'alphabetic';
        }
    }

    function drawChip(a, rx, cy, maxW) {
        const m = modelById[a.loadingUntil > t ? a.loadingModel : a.model];
        const s = L.s;
        ctx.font = font(7.5, '600');
        const label = fitText(m.short + ' ▾', maxW - 6 * s);
        const w = ctx.measureText(label).width + 8 * s, h = L.headH - 4 * s;
        box(rx - w, cy - h / 2, w, h, '#0b0b10', rgba(m.dot, 0.7));
        ctx.fillStyle = m.dot;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, rx - w + 4 * s, cy + 0.5);
        return { x: rx - w, y: cy - h / 2, w, h };
    }

    function drawNode(a, focused, floating) {
        const s = L.s, w = L.nodeW, h = nodeH(a);
        const x0 = a.x - w / 2, y0 = a.y;
        a.rect = { x: x0, y: y0, w, h };
        const m = modelById[a.model];
        const gateHot = plan && plan.gate === 'waiting' && plan.tasks.some((x) => x.phase === 4 && x.owner === a);
        if (floating) box(x0 + 4, y0 + 6, w, h, 'rgba(0,0,0,0.5)');
        box(x0, y0, w, h, focused ? C.nodeHot : C.node, gateHot ? C.yellow : focused ? C.crimson : rgba(C.crimson, 0.25 + 0.5 * a.flash * 0.6));
        box(x0, y0, w, L.headH, gateHot ? '#6b5718' : focused || a.flash > 0.3 ? C.headHot : C.head);
        a.chip = drawChip(a, x0 + w - 3 * s, y0 + L.headH / 2, w * 0.5);
        ctx.font = font(8.5, '600');
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(fitText(a.key, a.chip.x - x0 - 8 * s), x0 + 5 * s, y0 + L.headH / 2 + 0.5);

        // key / value rows, with port ticks on both edges
        const rows = [];
        const loading = a.loadingUntil > t;
        const said = a.said && a.said.until > t ? a.said : null;
        if (!L.portrait) rows.push(['task', loading ? 'swapping model' : a.task ? a.task.key : a.helping ? `help:${a.helping.key}` : 'idle']);
        rows.push(['step', a.status]);
        rows.push(['prog', null]);
        if (!L.portrait) rows.push(['gpu', null]);
        rows.push(said ? ['says', `→${said.to.key}: ${said.text}`] : ['cost', `${money(a.spend)} · ${kfmt(a.tokIn + a.tokOut)} tok`]);
        ctx.font = font(8);
        rows.slice(0, L.rows).forEach(([k, v], r) => {
            const yy = y0 + L.headH + L.rowH * (r + 0.6);
            ctx.fillStyle = C.crimson;
            ctx.fillRect(x0 - 2, yy - 1.5, 3, 3);
            ctx.fillRect(x0 + w - 1, yy - 1.5, 3, 3);
            ctx.fillStyle = C.dim;
            ctx.textAlign = 'left';
            ctx.fillText(k, x0 + 5 * s, yy);
            const vx = x0 + 34 * s * L.f, vw = x0 + w - 5 * s - vx;
            if (k === 'prog') {
                const p = loading ? (t - a.loadingFrom) / (a.loadingUntil - a.loadingFrom) : a.task ? a.task.progress : 0;
                const ticks = Math.max(8, Math.floor(vw / (4 * s)));
                for (let i = 0; i < ticks - 6; i++) {
                    ctx.fillStyle = i / (ticks - 6) < p ? (loading ? m.dot : C.crimson) : '#2a2331';
                    ctx.fillRect(vx + i * 4 * s, yy - 3 * s, 2.5 * s, 6 * s);
                }
                ctx.fillStyle = C.text;
                ctx.textAlign = 'right';
                ctx.fillText(Math.round(p * 100) + '%', x0 + w - 5 * s, yy);
            } else if (k === 'gpu') {
                const n = m.gpus;
                const gw = Math.min(vw * 0.55, n * 5 * s);
                const bw = gw / n - 1;
                for (let i = 0; i < n; i++) {
                    const u = clamp(a.gpu[i] / 100, 0.05, 1);
                    ctx.fillStyle = rgba(u > 0.8 ? C.yellow : C.crimson, 0.4 + 0.6 * u);
                    ctx.fillRect(vx + i * (bw + 1), yy + 4 * s - 8 * s * u, bw, 8 * s * u);
                }
                ctx.fillStyle = C.text;
                ctx.textAlign = 'right';
                const util = a.gpu.slice(0, n).reduce((x, y) => x + y, 0) / n;
                ctx.fillText(`${n}×${m.gpu} ${Math.round(util)}%`, x0 + w - 5 * s, yy);
            } else {
                ctx.fillStyle = k === 'says' ? C.yellow : C.text;
                ctx.textAlign = 'right';
                ctx.fillText(fitText(v, vw), x0 + w - 5 * s, yy);
            }
        });
        if (a.exp > 0.05) drawInside(a, x0 + 4 * s, y0 + L.nodeH - 2 * s, w - 8 * s, a.exp * L.expH - 4 * s);
        ctx.textBaseline = 'alphabetic';
    }

    // Inside an open node: a rotating wireframe of layers on the left, an attention heatmap on the right.
    // An illustration, not the real architecture of any model.
    function drawInside(a, x, y, w, h) {
        if (h < 12) return;
        const s = L.s, m = modelById[a.model], act = 0.25 + 0.75 * a.act;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        box(x, y, w, h, '#0d0d13', C.line);
        const split = L.portrait ? w : w * 0.56;
        // wireframe
        const cx = x + split / 2, cy = y + h / 2, R = Math.min(split * 0.42, h * 0.75);
        const th = t * 0.5 + a.seed, cosT = Math.cos(th), sinT = Math.sin(th), tilt = 0.45;
        const planes = 4, grid = [4, 3];
        const pts = [];
        for (let p = 0; p < planes; p++) {
            pts[p] = [];
            const z = (p - (planes - 1) / 2) * R * 0.55;
            for (let i = 0; i < grid[0]; i++) for (let j = 0; j < grid[1]; j++) {
                const X = (i / (grid[0] - 1) - 0.5) * R * 1.2, Y = (j / (grid[1] - 1) - 0.5) * R * 0.7;
                const x1 = X * cosT + z * sinT, z1 = -X * sinT + z * cosT;
                const y1 = Y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = Y * Math.sin(tilt) + z1 * Math.cos(tilt);
                const f = 2.4 * R / (2.4 * R + z2);
                pts[p].push({ x: cx + x1 * f, y: cy + y1 * f, d: f });
            }
        }
        ctx.lineWidth = 0.6;
        for (let p = 0; p < planes; p++) {
            const c = pts[p];
            const corners = [c[0], c[grid[1] - 1], c[c.length - 1], c[c.length - grid[1]]];
            ctx.strokeStyle = rgba(C.crimson, 0.5);
            ctx.beginPath();
            corners.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
            ctx.closePath();
            ctx.stroke();
            if (p < planes - 1) {
                for (const [i, j] of a.wire[p]) {
                    const q1 = c[i % c.length], q2 = pts[p + 1][j % c.length];
                    const v = 0.5 + 0.5 * Math.sin(t * 3 - p + i);
                    ctx.strokeStyle = rgba(v > 0.85 ? C.yellow : C.crimson, (0.1 + 0.4 * v) * act);
                    ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
                }
            }
            for (const q of c) {
                ctx.fillStyle = rgba(C.text, 0.3 + 0.5 * act * q.d);
                ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
            }
        }
        // attention heatmap
        if (!L.portrait) {
            const hx = x + split + 6 * s, hw = w - split - 12 * s, hy = y + 6 * s, hh = h - 22 * s;
            const nc = 10, nr = 7, cw = hw / nc, chh = hh / nr;
            for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) {
                const v = (0.5 + 0.5 * Math.sin(t * (1 + (i % 3) * 0.4) + i * 0.9 + j * 1.7 + a.seed)) * act;
                ctx.fillStyle = rgba(v > 0.8 ? '#ff7a9a' : C.crimson, 0.08 + 0.85 * v);
                ctx.fillRect(hx + i * cw + 1, hy + j * chh + 1, cw - 2, chh - 2);
            }
            ctx.font = font(7);
            ctx.fillStyle = C.dim;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const tps = a.loadingUntil > t ? 'loading weights' : `${kfmt(m.tps * (0.15 + 0.85 * a.act))} tok/s`;
            ctx.fillText(fitText(`attention · ${a.podId} · ${tps}`, hw), hx, y + h - 8 * s);
        }
        ctx.font = font(7);
        ctx.fillStyle = C.faint;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('layers · illustration', x + 4 * s, y + 3 * s);
        ctx.restore();
    }

    // ---------------------------------------------------------------- bottom panels (screen space)
    function panel(x, y, w, h, title) {
        box(x, y, w, h, '#101017', C.line);
        ctx.font = fontS(8, '600');
        ctx.fillStyle = C.dim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, x + 8 * L.s, y + 9 * L.s);
    }
    function drawBottom() {
        const s = L.s, y = L.bpY, h = L.bpH;
        const gap = 8;
        const widths = L.portrait ? [0.56, 0, 0.44] : [0.36, 0.34, 0.3];
        let x = 10;
        const total = W - 20 - gap * (L.portrait ? 1 : 2);
        const [lw, dw, ow] = widths.map((f) => f * total);
        drawLog(x, y, lw, h);
        x += lw + gap;
        if (!L.portrait) { drawDispatch(x, y, dw, h); x += dw + gap; }
        drawOutput(x, y, ow, h);
        ctx.textBaseline = 'alphabetic';
    }
    function drawLog(x, y, w, h) {
        const s = L.s;
        panel(x, y, w, h, 'run log');
        const lh = 11.5 * s, top = y + 20 * s;
        const n = Math.floor((h - 24 * s) / lh);
        const lines = runLog.slice(-n);
        ctx.font = fontS(8);
        ctx.textBaseline = 'middle';
        lines.forEach((l, i) => {
            const yy = top + i * lh + lh / 2;
            ctx.fillStyle = C.faint;
            ctx.textAlign = 'left';
            ctx.fillText(l.ts, x + 8 * s, yy);
            ctx.fillStyle = l.color;
            const who = fitText(l.who, (L.portrait ? 70 : 120) * s);
            ctx.fillText(who, x + 42 * s, yy);
            ctx.fillStyle = C.text;
            const tx = x + 42 * s + (L.portrait ? 74 : 124) * s;
            ctx.fillText(fitText(l.text, x + w - 8 * s - tx), tx, yy);
        });
    }
    function drawDispatch(x, y, w, h) {
        const s = L.s;
        panel(x, y, w, h, 'dispatch');
        ui.dispatchRows = [];
        if (!plan) return;
        const order = { active: 0, assigning: 1, pending: 2, done: 3 };
        const list = plan.tasks.map((task, i) => ({ task, i })).sort((a, b) => order[a.task.state] - order[b.task.state] || a.i - b.i);
        const lh = 12 * s, top = y + 20 * s;
        const n = Math.max(1, Math.floor((h - 38 * s) / lh));
        ctx.font = fontS(8);
        ctx.textBaseline = 'middle';
        list.slice(0, n).forEach(({ task, i }, r) => {
            const yy = top + r * lh + lh / 2;
            ui.dispatchRows.push({ task, x, y: yy - lh / 2, w, h: lh });
            const hot = hovered && hovered.kind === 'row' && hovered.obj === task;
            if (hot) box(x + 2, yy - lh / 2, w - 4, lh, '#1a1a25');
            ctx.fillStyle = C.faint;
            ctx.textAlign = 'left';
            ctx.fillText(`#${i + 1}`, x + 8 * s, yy);
            ctx.fillStyle = task.state === 'pending' ? C.dim : C.text;
            ctx.fillText(fitText(task.key, w * 0.34), x + 30 * s, yy);
            const bx = x + w * 0.45, bw = w * 0.36, ticks = Math.floor(bw / (4 * s));
            for (let k = 0; k < ticks; k++) {
                ctx.fillStyle = k / ticks < task.progress ? (task.state === 'done' ? C.dim : C.crimson) : '#241f2a';
                ctx.fillRect(bx + k * 4 * s, yy - 2.5 * s, 2.5 * s, 5 * s);
            }
            const label = task.state === 'done' ? 'done' : task.state === 'active' ? (task.boost > 1.4 ? 'run ▲' : 'run') : task.phase === 4 && plan.gate !== 'open' ? 'gate' : 'queued';
            ctx.fillStyle = label === 'gate' ? C.yellow : task.state === 'active' ? C.crimson : C.dim;
            ctx.textAlign = 'right';
            ctx.fillText(label, x + w - 8 * s, yy);
        });
        const activeN = plan.tasks.filter((q) => q.state === 'active').length;
        ctx.fillStyle = C.faint;
        ctx.textAlign = 'left';
        ctx.fillText(`parallel ${activeN} · scheduler online · click a row to prioritise`, x + 8 * s, y + h - 9 * s);
    }
    function drawOutput(x, y, w, h) {
        const s = L.s;
        panel(x, y, w, h, plan && plan.gate === 'waiting' ? 'output / human gate' : 'output / costs');
        const rate = stats.hist.reduce((a, b) => a + b, 0) * (3600 / Math.max(1, stats.hist.length)) * SPEEDS[speedIdx];
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = fontS(L.portrait ? 20 : 24, '700');
        ctx.fillStyle = C.text;
        ctx.fillText(money(stats.spend), x + 8 * s, y + (L.portrait ? 44 : 50) * s);
        ctx.font = fontS(8);
        ctx.fillStyle = C.dim;
        const lines = [
            `≈ ${money(rate, 0)}/h at this pace · ${kfmt(stats.tokens)} tokens`,
            `month ${money(stats.monthBase + stats.spend, 0)} of ${money(stats.budget, 0)}`,
            plan ? `${plan.done}/${plan.tasks.length} tasks · ${plan.doneAt ? 'complete' : fmtDur(t - plan.born) + ' elapsed'}` : '',
        ];
        lines.forEach((l, i) => ctx.fillText(fitText(l, w - 16 * s), x + 8 * s, y + (L.portrait ? 58 : 66) * s + i * 12 * s));
        ui.approve = null;
        if (plan && plan.gate === 'waiting') {
            const left = Math.max(0, 18 - (t - plan.gateAt));
            const bw = Math.min(w - 16 * s, 220 * s), bh = 18 * s;
            const bx = x + 8 * s, by = y + h - bh - 8 * s;
            const pulse = 0.6 + 0.4 * Math.sin(t * 4);
            box(bx, by, bw, bh, rgba(C.yellow, 0.15 + 0.15 * pulse), C.yellow);
            ctx.font = fontS(8.5, '700');
            ctx.fillStyle = C.yellow;
            ctx.textBaseline = 'middle';
            ctx.fillText(fitText(`[ approve ship ] auto in ${Math.ceil(left)}s`, bw - 10 * s), bx + 6 * s, by + bh / 2);
            ui.approve = { x: bx, y: by, w: bw, h: bh };
        }
    }

    // ---------------------------------------------------------------- model menu
    const menuEl = $('model-menu');
    function openModelMenu(a, sx, sy) {
        $('mm-title').textContent = `model for ${a.key} (${a.podId}, ${a.region})`;
        const list = $('mm-list');
        list.innerHTML = '';
        for (const m of MODELS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mm-item' + (a.model === m.id ? ' current' : '');
            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.style.background = m.dot;
            const name = document.createElement('b');
            name.textContent = m.name;
            const note = document.createElement('small');
            note.textContent = `${m.note} · ${m.gpus}× ${m.gpu.toUpperCase()} pod`;
            b.append(dot, name, note);
            b.addEventListener('click', () => { closeModelMenu(); switchModel(a, m.id); });
            list.append(b);
        }
        menuEl.hidden = false;
        const mw = menuEl.offsetWidth || 240, mh = menuEl.offsetHeight || 240;
        menuEl.style.left = clamp(sx - mw / 2, 8, W - mw - 8) + 'px';
        menuEl.style.top = clamp(sy + 10, 40, H - mh - 8) + 'px';
    }
    function closeModelMenu() { menuEl.hidden = true; }
    document.addEventListener('pointerdown', (e) => { if (!menuEl.hidden && !menuEl.contains(e.target)) closeModelMenu(); }, true);

    // ---------------------------------------------------------------- input
    const inRect = (r, x, y, m = 0) => r && x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
    function hitTest(sx, sy) {
        if (inRect(ui.approve, sx, sy, 2)) return { kind: 'approve' };
        for (const r of ui.dispatchRows) if (inRect(r, sx, sy)) return { kind: 'row', obj: r.task };
        if (sy >= L.bpY) return { kind: 'panel' };
        const w = toWorld(sx, sy);
        for (let i = nodes.length - 1; i >= 0; i--) {
            const a = nodes[i];
            if (inRect(a.chip, w.x, w.y, 3)) return { kind: 'chip', obj: a };
            if (inRect(a.rect, w.x, w.y)) return { kind: 'node', obj: a };
        }
        if (inRect(hub.rect, w.x, w.y, 4)) return { kind: 'hub', obj: hub };
        return null;
    }
    // where a dragged node would land: column by x, slot by y
    function dropSlot(wx, wy) {
        const col = clamp(Math.floor((wx - L.gridX) / L.colW), 0, 2);
        const list = cols[col].filter((a) => a !== gesture.node);
        let idx = list.length;
        for (let i = 0; i < list.length; i++) if (wy < list[i].ty + L.nodeH / 2) { idx = i; break; }
        return { col, idx };
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
        mouse.type = e.pointerType;
        if (pointers.size === 2) {
            if (gesture && gesture.type === 'node') cancelDrag();
            const s = pinchState();
            gesture = { type: 'pinch', d0: s.d, z0: cam.z, wx: (s.mx - cam.x) / cam.z, wy: (s.my - cam.y) / cam.z, moved: true };
            return;
        }
        if (pointers.size > 2) return;
        const hit = hitTest(e.clientX, e.clientY);
        const w = toWorld(e.clientX, e.clientY);
        const isNode = hit && hit.kind === 'node';
        gesture = { type: isNode ? 'node' : 'pan', hit, node: isNode ? hit.obj : null, touch: e.pointerType !== 'mouse',
            sx: e.clientX, sy: e.clientY, camx: cam.x, camy: cam.y, moved: false,
            ox: isNode ? hit.obj.x - w.x : 0, oy: isNode ? hit.obj.y - w.y : 0, col: 0, idx: 0, slotY: 0 };
    });
    canvas.addEventListener('pointermove', (e) => {
        mouse.sx = e.clientX;
        mouse.sy = e.clientY;
        mouse.type = e.pointerType;
        wake();
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesture;
        if (!g) return;
        if (g.type === 'pinch') {
            if (pointers.size < 2) return;
            const s = pinchState();
            cam.z = clamp(g.z0 * (s.d / g.d0), ZMIN, ZMAX);
            cam.x = s.mx - g.wx * cam.z;
            cam.y = s.my - g.wy * cam.z;
            clampCam();
            return;
        }
        const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
        if (!g.moved && dx * dx + dy * dy > (g.touch ? 64 : 25)) {
            g.moved = true;
            if (g.type === 'node') { g.node.exp = 0; selected = null; }
        }
        if (!g.moved) return;
        if (g.type === 'node') {
            const w = toWorld(e.clientX, e.clientY);
            g.node.x = w.x + g.ox;
            g.node.y = w.y + g.oy;
            Object.assign(g, dropSlot(g.node.x, g.node.y + L.nodeH / 2));
            computeSynergy();
        } else if (g.type === 'pan') {
            cam.x = g.camx + dx;
            cam.y = g.camy + dy;
            clampCam();
        }
    });
    function cancelDrag() {
        gesture = null;
        computeSynergy();
    }
    function dropNode(g) {
        const a = g.node;
        const from = colOf(a);
        cols[from].splice(cols[from].indexOf(a), 1);
        cols[g.col].splice(Math.min(g.idx, cols[g.col].length), 0, a);
        a.layer = g.col;
        if (from !== g.col) sys(`you moved ${a.key} to ${COLUMNS[g.col]}`, true);
        gesture = null;
        layout(false);
        commitSynergy();
    }
    let lastTap = null;
    function pointerEnd(e, cancelled) {
        pointers.delete(e.pointerId);
        const g = gesture;
        if (!g) return;
        if (g.type === 'pinch') { if (pointers.size === 0) gesture = null; return; }
        if (g.type === 'node' && g.moved) { if (cancelled) cancelDrag(); else dropNode(g); return; }
        gesture = null;
        if (cancelled || g.moved) return;
        const hit = g.hit;
        if (g.type === 'node') {
            selected = selected === g.node ? null : g.node;
            askNode(g.node);
            return;
        }
        if (!hit) {
            selected = null;
            if (g.touch) {
                const now = performance.now();
                if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
                    lastTap = null;
                    if (cam.z > 1.4) resetView(); else zoomAt(e.clientX, e.clientY, 2);
                } else lastTap = { t: now, x: e.clientX, y: e.clientY };
            }
            return;
        }
        if (hit.kind === 'chip') { openModelMenu(hit.obj, e.clientX, e.clientY); return; }
        if (hit.kind === 'approve') { approve(true); return; }
        if (hit.kind === 'row') { prioritise(hit.obj); return; }
        if (hit.kind === 'hub') statusRound();
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

    // ---------------------------------------------------------------- command line
    const cmdInput = $('cmd-input');
    $('cmd').addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = cmdInput.value.trim().replace(/\s+/g, ' ');
        cmdInput.value = '';
        if (!raw) return;
        log('you', C.yellow, '$ ' + raw);
        const [cmd, ...rest] = raw.split(' ');
        const c = cmd.toLowerCase();
        if (c === 'help') { toggleHelp(true); return; }
        if (c === 'approve') { approve(true); return; }
        if (c === 'spawn') { spawnNode(); return; }
        if (c === 'pause') { setPaused(!paused); return; }
        if (c === 'clear') { runLog.length = 0; return; }
        if (c === 'model') {
            const node = nodes.find((a) => a.key === (rest[0] || '').toLowerCase() || a.name.toLowerCase() === (rest[0] || '').toLowerCase());
            const m = MODELS.find((x) => x.id === (rest[1] || '').toLowerCase());
            if (!node || !m) { sys('usage: model <node> <fable|opus|sonnet|haiku>'); return; }
            switchModel(node, m.id);
            return;
        }
        const goal = c === 'run' ? rest.join(' ') : raw;
        if (!goal) return;
        cmdInput.blur();
        const preset = GOALS.find((g) => g.title.toLowerCase() === goal.toLowerCase());
        if (preset) newPlan(preset.title, preset.tasks);
        else newPlan(goal.charAt(0).toUpperCase() + goal.slice(1), GENERIC);
    });

    // ---------------------------------------------------------------- controls
    const helpEl = $('help');
    function setPaused(v) { paused = v; $('btn-pause').textContent = paused ? 'resume' : 'pause'; }
    function setSpeed(i) {
        speedIdx = clamp(i, 0, SPEEDS.length - 1);
        $('btn-speed').textContent = SPEEDS[speedIdx] + '×';
        if (paused) setPaused(false);
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
        $('btn-full').textContent = fsElement() ? 'exit full' : 'fullscreen';
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
            if (document.activeElement !== cmdInput && helpEl.hidden && menuEl.hidden) document.body.classList.add('idle');
        }, 3000);
    }
    $('btn-pause').addEventListener('click', () => setPaused(!paused));
    $('btn-speed').addEventListener('click', () => setSpeed((speedIdx + 1) % SPEEDS.length));
    $('btn-spawn').addEventListener('click', spawnNode);
    $('btn-full').addEventListener('click', toggleFull);
    $('btn-help').addEventListener('click', () => toggleHelp(helpEl.hidden));
    $('help-close').addEventListener('click', () => toggleHelp(false));
    helpEl.addEventListener('click', (e) => { if (e.target === helpEl) toggleHelp(false); });
    window.addEventListener('keydown', (e) => {
        wake();
        if (e.key === 'Escape') {
            if (!menuEl.hidden) closeModelMenu();
            else if (!helpEl.hidden) toggleHelp(false);
            else if (document.activeElement === cmdInput) cmdInput.blur();
            else selected = null;
            return;
        }
        if (e.target === cmdInput || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!helpEl.hidden && e.key !== '?') return;
        const onControl = e.target.tagName === 'BUTTON' || e.target.tagName === 'A';
        if ((e.code === 'Space' || e.key === 'Enter') && onControl) return;
        const k = e.key;
        if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
        else if (k === '/' || k === 'Enter') { e.preventDefault(); cmdInput.focus(); }
        else if (k === 'f' || k === 'F') { if (fsSupported) toggleFull(); }
        else if (k === 'n' || k === 'N') spawnNode();
        else if (k === 'a' || k === 'A') approve(true);
        else if (k === '?') toggleHelp(helpEl.hidden);
        else if (k >= '1' && k <= '4') setSpeed(Number(k) - 1);
        else if (k === '0') resetView();
        else if (k === '+' || k === '=') zoomAt(W / 2, H / 2, cam.z * 1.2);
        else if (k === '-' || k === '_') zoomAt(W / 2, H / 2, cam.z / 1.2);
    });
    window.addEventListener('resize', () => layout(true));

    // ---------------------------------------------------------------- loop
    let last = performance.now();
    let headNext = 0;
    function updateHead(raw) {
        headNext -= raw;
        if (headNext > 0) return;
        headNext = 0.5;
        const edges = 24 + nodes.length * 3 + synergy.length + packets.length;
        const run = plan ? fmtDur(t - plan.born) : '0:00';
        const el = $('graph-line');
        el.innerHTML = '';
        const parts = L.portrait
            ? [['hivemind', ''], [`${nodes.length + 1}`, 'nodes'], [money(stats.spend), '', true]]
            : [['graph', 'hivemind-01'], ['nodes', String(nodes.length + 1 + INPUTS.length)], ['edges', String(edges)], ['workers', String(nodes.length)],
                ['orchestrator', modelById[hub.model].short], ['run ' + stats.runNo, run], ['spend', money(stats.spend), true], ['zoom', cam.z.toFixed(1) + '×']];
        parts.forEach(([k, v, isMoney], i) => {
            if (i) { const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '·'; el.append(sep); }
            el.append(k + ' ');
            const b = document.createElement('b');
            if (isMoney) b.className = 'money';
            b.textContent = v;
            el.append(b);
        });
    }
    function frame(now) {
        const raw = Math.min(0.05, (now - last) / 1000);
        last = now;
        const dt = paused ? 0 : raw * SPEEDS[speedIdx];
        if (dt > 0) {
            t += dt;
            update(dt);
        }
        if (!(gesture && gesture.moved)) hovered = mouse.type === 'mouse' ? hitTest(mouse.sx, mouse.sy) : null;
        canvas.style.cursor = gesture && gesture.moved ? (gesture.type === 'node' ? 'grabbing' : 'move')
            : !hovered || hovered.kind === 'panel' ? '' : hovered.kind === 'node' ? 'grab' : 'pointer';
        animate(raw);
        draw();
        updateHead(raw);
        requestAnimationFrame(frame);
    }

    setSpeed(speedIdx);
    layout();
    committed = new Set(synergy.map((l) => l.key));
    sys(`cluster ready · ${all().length} pods online · ${synergy.length} links`);
    after(1, () => newPlan(GOALS[goalIdx].title, GOALS[goalIdx].tasks));
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setTimeout(() => toast(coarse
        ? 'drag nodes between slots to change synergies · tap a node to open it · tap a model tag to switch'
        : 'hover a node to open it · drag nodes into new slots · click a model tag to switch it'), 5000);
    requestAnimationFrame(frame);
})();
