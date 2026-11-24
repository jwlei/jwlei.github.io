/* Hivemind: a simulated graph of AI agents, each a node on its own GPU pod, working through a hard engineering goal.
   Left: input nodes. Middle: the orchestrator bus. Right: agent nodes in four layer columns (research, build,
   verify, deploy). Bottom: run log, dispatch and costs, then the command line. Plain canvas 2D, no dependencies.
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
    const ZMIN = 0.5, ZMAX = 2.5;
    const MAX_NODES = 17;
    const LOAD = 25; // big workloads: every node pushes 25x more tokens than a single chat would
    const C = {
        bg: '#0a0d12', node: '#111720', nodeHot: '#16202c', line: '#243040', head: '#14303a', headHot: '#1b4a57',
        accent: '#39c5d6', text: '#dfe7ee', dim: '#8a99a8', faint: '#556372', amber: '#ffb547', green: '#5fd38f', red: '#ff6b6b',
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
    const kfmt = (v) => (v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(Math.round(v)));
    const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

    // ---------------------------------------------------------------- models
    // Anthropic list prices per million tokens (input / output). Hardware, speed and quality are simulated.
    const MODELS = [
        { id: 'fable-fast', name: 'Claude Fable 5.2 · fast', short: 'fable 5.2 fast', pin: 16, pout: 80, speed: 1.5, quality: 1, dot: '#e7a6ff',
          note: 'most capable, fast mode · $16 / $80', gpus: 16, gpu: 'H200', kw: 23, tps: 6500 },
        { id: 'fable', name: 'Claude Fable 5.2', short: 'fable 5.2', pin: 8, pout: 40, speed: 0.85, quality: 1, dot: '#c49bff',
          note: 'most capable · $8 / $40', gpus: 16, gpu: 'H200', kw: 21, tps: 2600 },
        { id: 'mythos', name: 'Claude Mythos 5.2', short: 'mythos 5.2', pin: 8, pout: 40, speed: 0.85, quality: 1, dot: '#9f8cff',
          note: 'Fable-class, verified organizations only · $8 / $40', gpus: 16, gpu: 'H200', kw: 21, tps: 2600 },
        { id: 'fable51', name: 'Claude Fable 5.1', short: 'fable 5.1', pin: 10, pout: 50, speed: 0.8, quality: 0.98, dot: '#b48ad8',
          note: 'previous Fable, pricier · $10 / $50', gpus: 16, gpu: 'H200', kw: 21, tps: 2300 },
        { id: 'opus-fast', name: 'Claude Opus 5.5 · fast', short: 'opus 5.5 fast', pin: 8, pout: 40, speed: 1.6, quality: 0.95, dot: '#ffd27a',
          note: 'deep reasoning, fast mode · $8 / $40', gpus: 8, gpu: 'H200', kw: 12, tps: 10500 },
        { id: 'opus', name: 'Claude Opus 5.5', short: 'opus 5.5', pin: 4, pout: 20, speed: 1, quality: 0.95, dot: '#ffb547',
          note: 'deep reasoning · $4 / $20', gpus: 8, gpu: 'H200', kw: 10.5, tps: 4200 },
        { id: 'sonnet', name: 'Claude Sonnet 5.5', short: 'sonnet 5.5', pin: 2, pout: 10, speed: 1.25, quality: 0.86, dot: '#6fb3ff',
          note: 'fast and capable · $2 / $10', gpus: 8, gpu: 'H100', kw: 8.2, tps: 7800 },
        { id: 'haiku', name: 'Claude Haiku 5.5', short: 'haiku 5.5', pin: 0.1, pout: 0.5, speed: 1.7, quality: 0.68, dot: '#5fd38f',
          note: 'fastest, cheapest, more rework · $0.10 / $0.50', gpus: 4, gpu: 'L40S', kw: 1.6, tps: 21000 },
    ];
    const modelById = Object.fromEntries(MODELS.map((m) => [m.id, m]));
    const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1'];

    // ---------------------------------------------------------------- the team; viz = what you see inside the node
    const ROLES = [
        { name: 'Planner', key: 'planner', layer: 0, model: 'fable', viz: 'beam', job: 'breaks goals into milestones' },
        { name: 'Researcher', key: 'researcher', layer: 0, model: 'opus', viz: 'embed', job: 'reads papers, docs and postmortems' },
        { name: 'Architect', key: 'architect', layer: 0, model: 'opus', viz: 'layers', job: 'designs systems and interfaces' },
        { name: 'ML engineer', key: 'ml_engineer', layer: 1, model: 'opus', viz: 'descent', job: 'trains and tunes models' },
        { name: 'Data engineer', key: 'data_engineer', layer: 1, model: 'sonnet', viz: 'tokens', job: 'builds pipelines and datasets' },
        { name: 'Backend', key: 'backend', layer: 1, model: 'sonnet', viz: 'moe', job: 'writes services and APIs' },
        { name: 'Frontend', key: 'frontend', layer: 1, model: 'sonnet', viz: 'sample', job: 'builds dashboards and UI' },
        { name: 'Security', key: 'security', layer: 2, model: 'opus', viz: 'attn', job: 'threat models and audits' },
        { name: 'QA', key: 'qa', layer: 2, model: 'haiku', viz: 'logits', job: 'tests at scale' },
        { name: 'SRE', key: 'sre', layer: 3, model: 'sonnet', viz: 'allreduce', job: 'runs production' },
        { name: 'Release', key: 'release', layer: 3, model: 'sonnet', viz: 'specdec', job: 'ships builds safely, region by region' },
        { name: 'Platform', key: 'platform', layer: 3, model: 'haiku', viz: 'matmul', job: 'keeps the GPU fleet healthy' },
    ];
    const EXTRA_ROLES = [
        { name: 'Performance', key: 'performance', layer: 1, model: 'opus', viz: 'kvcache', job: 'profiles and optimises hot paths' },
        { name: 'DBA', key: 'dba', layer: 1, model: 'sonnet', viz: 'kvcache', job: 'tunes databases and queries' },
        { name: 'Red team', key: 'red_team', layer: 2, model: 'opus', viz: 'attn', job: 'attacks the system before others do' },
        { name: 'Compliance', key: 'compliance', layer: 2, model: 'sonnet', viz: 'logits', job: 'maps work to regulations' },
        { name: 'Tech writer', key: 'tech_writer', layer: 3, model: 'haiku', viz: 'tokens', job: 'writes docs and runbooks' },
    ];
    const COLUMNS = ['layer 1 · research & design', 'layer 2 · build', 'layer 3 · verify', 'layer 4 · deploy'];
    const NCOL = COLUMNS.length;

    // Neighbours in a column affect each other. Unlisted pairs get a small default boost.
    const SYN_PAIRS = [
        ['Architect', 'Researcher', 14, 'research shapes the design'], ['Architect', 'Planner', 10, 'plans match the design'],
        ['Data engineer', 'ML engineer', 22, 'features into training'], ['Backend', 'Data engineer', 12, 'schemas in lockstep'],
        ['Frontend', 'Backend', 10, 'one API contract'], ['ML engineer', 'Backend', 8, 'model serving in one place'],
        ['QA', 'Security', -6, 'overlapping reviews'], ['Release', 'SRE', 16, 'one rollout pipeline'],
        ['Platform', 'SRE', 12, 'shared fleet view'], ['Release', 'Platform', 9, 'capacity ready before deploys'],
        ['DBA', 'Data engineer', 16, 'query plans tuned in place'], ['Performance', 'Backend', 15, 'profiles on the same hosts'],
        ['Red team', 'Security', 18, 'attack and defend'], ['Red team', 'QA', -7, 'duplicate test traffic'],
        ['Data engineer', 'Frontend', -5, 'schema churn'], ['Planner', 'Researcher', -3, 'too many status checks'],
        ['Compliance', 'Security', 12, 'controls map to findings'], ['Tech writer', 'Release', 8, 'release notes on time'],
    ];
    const SYN = new Map(SYN_PAIRS.map(([a, b, pct, why]) => [[a, b].sort().join('|'), { pct, why }]));
    const SYN_LINES = ['same rack now, streaming results straight to you', 'same fabric, no more waiting on the network',
        'co-located, sending my context over directly', 'our KV caches can share prefixes now'];
    const CLASH_LINES = ['we keep evicting each other\'s cache here', 'crowded, my latency just doubled', 'we\'re duplicating work now'];
    const HELP_REPLIES = ['yes please, start with the edge cases', 'thanks, double-check the numbers?', 'that helps, sending my notes',
        'sure, take the second half'];
    const WARN = ['GPU {g} running hot (89 °C), throttling', 'NVLink retries on GPU {g}', 'KV cache pressure at 94%', 'p99 latency spike on {pod}'];
    const ERR = ['GPU {g} ECC error, draining it', 'out of memory on shard {g}, restarting the worker', 'lost heartbeat, failing over to the standby'];
    const FIXES = ['draining GPU {g}, moving your shard to a spare', 'restarting your worker on a fresh host', 'failing you over to the standby pod',
        'lowering your batch size until it cools down', 'rebalancing your KV cache across GPUs'];

    // ---------------------------------------------------------------- goals
    // [stage, task, owner, helper, steps, question, answer, result]
    const SHIP = [4, 'Ship to production', 'Release', 'Platform', ['building release artifacts', 'deploying to the canary pool', 'promoting region by region', 'tagging the release'],
        'are the GPU pools warmed up for the new build?', 'yes, 4 regions warm and ready', 'release live in 4 regions'];
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
            [4, 'Canary, then global', 'SRE', 'Backend', ['routing 5% of traffic', 'watching p99 and errors', 'scaling to every region', 'comparing cost per token'],
                'error rate is flat, okay to go global?', 'go, rollback is one flag away', 'p99 down 54% globally at the same cost'],
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
            [4, 'Shadow, then block', 'SRE', 'Backend', ['shadow mode for 48 hours', 'blocking at 10%', 'scaling to 100%', 'setting up on-call alerts'],
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
    const stats = { spend: 0, monthBase: 184200, budget: 500000, tokens: 0, tasksDone: 0, bucket: 0,
        hist: [], perSec: [], util: [], lastSec: 0, runs: [], runNo: 0, lastShip: null };
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
    let redirect = null; // { t0 (real ms), goal }
    let nextIncident = rand(14, 24);
    let flashCost = 0;
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
            health: 'ok', healthUntil: 0, upSince: -rand(2, 40) * 86400, errRate: rand(0.005, 0.03),
            gpu: Array.from({ length: 16 }, () => rand(5, 15)),
            wire: Array.from({ length: 4 }, () => Array.from({ length: 9 }, () => [randi(0, 11), randi(0, 11)])),
        };
    }
    const nodes = ROLES.map(makeNode);
    const byName = Object.fromEntries(nodes.map((a) => [a.name, a]));
    const cols = Array.from({ length: NCOL }, (_, c) => nodes.filter((a) => a.layer === c));
    const hub = Object.assign(makeNode({ name: 'Orchestrator', key: 'orchestrator', layer: -1, model: 'fable', viz: 'beam', job: 'hands out work and tracks the goal' }),
        { isHub: true, shownProgress: 0, status: 'waiting for a goal' });
    const all = () => [hub, ...nodes];
    const colOf = (a) => cols.findIndex((c) => c.includes(a));

    function charge(a, tin, tout) {
        const m = modelById[a.model];
        const cost = (tin * LOAD * m.pin + tout * LOAD * m.pout) / 1e6;
        a.spend += cost;
        a.tokIn += tin * LOAD;
        a.tokOut += tout * LOAD;
        stats.spend += cost;
        stats.tokens += (tin + tout) * LOAD;
        stats.bucket += cost;
        if (plan && !plan.doneAt) plan.cost += cost;
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
        packets.push({ from, to, k: 0, dur, onArrive });
        charge(from, randi(3000, 14000), randi(80, 500));
        log(`${from.key} → ${to.key}`, from.isHub ? C.amber : C.accent, text);
    }
    function sys(text, kind) { log(kind === 'you' ? 'you' : kind === 'err' ? 'alert' : 'system', kind === 'you' ? C.amber : kind === 'err' ? C.red : C.dim, text); }

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
        const switching = plan && !plan.doneAt;
        for (const a of nodes) { a.task = null; a.helping = null; }
        packets.length = 0;
        const list = defs.some((d) => d[2] === 'Release') ? defs : [...defs, SHIP];
        const tasks = list.filter((d) => byName[d[2]] && byName[d[3]]).map(([phase, name, owner, helper, steps, ask, reply, result]) => ({
            phase, name, key: snake(name), owner: byName[owner], helper: byName[helper], steps, ask, reply, result,
            deps: [], progress: 0, state: 'pending', dur: rand(16, 26), asked: false, deep: false, reworked: false, boost: 1,
        }));
        for (let s = 0; s < STAGES.length; s++) tasks.filter((x) => x.phase === s).forEach((x) => { x.deps = tasks.filter((y) => y.phase === s - 1); });
        const plannedDur = 5 + STAGES.reduce((sum, _, s) => {
            const st = tasks.filter((x) => x.phase === s);
            return sum + (st.length ? Math.max(...st.map((x) => x.dur)) * 1.3 + 4 : 0);
        }, 0);
        stats.runNo++;
        plan = { seq: ++planSeq, goal: goalTitle, tasks, born: t, doneAt: 0, done: 0, plannedDur, gate: 'closed', gateAt: 0, cost: 0 };
        // the whole graph visibly re-routes to the new goal
        redirect = { t0: performance.now(), goal: goalTitle, switching };
        for (const a of nodes) { a.flash = 1; a.status = switching ? 'rerouting' : 'idle'; }
        hub.status = 'planning';
        sys(`${switching ? 'redirecting to' : 'goal accepted'}: ${goalTitle}`);
        toast(`${switching ? 'redirecting →' : 'new goal:'} ${goalTitle}`);
        after(1.2, () => say(hub, byName.Planner, `new goal "${goalTitle}", break it into milestones`));
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

    function approve(byYou) {
        if (!plan || plan.gate !== 'waiting') { if (byYou) toast('nothing is waiting for approval'); return; }
        plan.gate = 'open';
        sys(byYou ? 'you approved the ship stage' : 'no answer at the human gate: auto-approved by policy', byYou ? 'you' : '');
        toast(byYou ? 'approved: shipping' : 'auto-approved by policy');
        say(hub, byName.Release, 'approval received, go ahead and ship');
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
                if (o.loadingUntil > t || o.health === 'err') continue;
                const m = modelById[o.model];
                const helped = task.helper.helping === task && t < task.helper.helpUntil;
                const rate = (m.speed * task.boost * (1 + synergyBonus(o)) * (helped ? 1.2 : 1) * (o.health === 'warn' ? 0.6 : 1)) / task.dur;
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
            hub.status = 'goal shipped';
            const took = t - plan.born;
            const ahead = plan.plannedDur - took;
            stats.runs.push({ took, ahead, cost: plan.cost });
            stats.lastShip = { goal: plan.goal, cost: plan.cost, took };
            flashCost = 3;
            sys(`shipped in ${fmtDur(took)} for ${money(plan.cost)}${ahead > 0 ? `, ${fmtDur(ahead)} ahead of plan` : ''}`);
            toast(`shipped: ${plan.goal} · ${money(plan.cost)}`);
            const seq = plan.seq;
            after(8, () => { if (plan && plan.seq === seq) nextGoal(); });
        }
    }
    function fmtDur(sec) {
        const v = Math.max(0, Math.round(sec));
        return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    }
    function fmtUp(sec) {
        const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
        return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${Math.floor(sec % 60)}s`;
    }

    // ---------------------------------------------------------------- incidents: big fleets have bad minutes
    function incident() {
        const a = pick(nodes.filter((n) => n.health === 'ok' && !n.loadingUntil));
        if (!a) return;
        const severe = Math.random() < 0.3;
        const g = randi(0, modelById[a.model].gpus - 1);
        const text = pick(severe ? ERR : WARN).replace('{g}', g).replace('{pod}', a.podId);
        a.health = severe ? 'err' : 'warn';
        a.healthUntil = t + (severe ? 5 : 7);
        a.errRate = severe ? rand(3, 6) : rand(0.6, 1.4);
        a.flash = 1;
        sys(`${a.key} (${a.podId}): ${text}`, severe ? 'err' : '');
        const fixer = a === byName.Platform ? byName.SRE : byName.Platform;
        if (fixer) after(1, () => say(fixer, a, pick(FIXES).replace('{g}', g)));
        focusOn(a, 3);
    }

    // ---------------------------------------------------------------- interactions
    function askNode(a) {
        a.flash = 1;
        if (a.health !== 'ok') say(a, hub, `${a.health === 'err' ? 'down' : 'degraded'}: platform is on it`);
        else if (a.loadingUntil > t) say(a, hub, `loading ${modelById[a.loadingModel].short} weights, back in a moment`);
        else if (a.task) say(a, hub, `${a.task.key}: ${a.status}, ${Math.round(a.task.progress * 100)}% done`);
        else if (a.helping && t < a.helpUntil) say(a, hub, `helping ${a.helping.owner.key} with ${a.helping.key}`);
        else {
            const next = plan && plan.tasks.find((x) => x.owner === a && x.state === 'pending');
            say(a, hub, next ? `free, next up: ${next.key}` : 'free, happy to help anyone');
        }
    }
    function statusRound() {
        sys('you asked every node for a status update', 'you');
        hub.flash = 1;
        nodes.filter((a) => a.task).slice(0, 5).forEach((a, i) => after(0.6 + i * 1.4, () => {
            if (a.task) say(a, hub, `${a.task.key}: ${Math.round(a.task.progress * 100)}%`);
        }));
    }
    function prioritise(task) {
        if (task.state === 'done') { toast(`${task.key} is already done`); return; }
        task.boost = Math.min(2, task.boost + 0.6);
        sys(`you made ${task.key} the top priority`, 'you');
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
        sys(`you moved ${a.key} to ${m.name}`, 'you');
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
        sys(`you added ${a.key} on ${modelById[a.model].name}`, 'you');
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
    const INPUTS = ['brief', 'budget', 'cluster', 'models', 'prior_runs'];
    function layout(snap = true) {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        L.s = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 12) / 11;
        const s = L.s;
        L.portrait = W < 760;
        const top = ($('topbar').offsetHeight || 40) + 8;
        const cmdTop = $('cmd').getBoundingClientRect().top || H - 60;
        L.bpH = L.portrait ? Math.min(180, H * 0.24) : clamp(H * 0.22, 170, 260 * s);
        L.bpY = cmdTop - 10 - L.bpH;
        L.gx = 12;
        L.gy = top;
        L.gw = W - 24;
        L.gh = L.bpY - 10 - top;

        if (!L.portrait) {
            L.icW = clamp(L.gw * 0.15, 170, 270 * s);
            L.busX = L.gx + L.icW + L.gw * 0.04;
            L.busW = 18 * s;
            L.gridX = L.busX + L.busW + L.gw * 0.035;
            L.colW = (L.gx + L.gw - L.gridX) / NCOL;
        } else {
            // phones: readable columns wider than the screen; swipe empty space (or two fingers) to see the rest
            L.icW = 170;
            L.busX = L.gx + L.icW + 22;
            L.busW = 12;
            L.gridX = L.busX + L.busW + 22;
            L.colW = Math.max(176, (L.gx + L.gw - L.gridX) / 2);
        }
        L.gridW = L.colW * NCOL;
        L.nodeW = L.colW - (L.portrait ? 10 : 18 * s);
        L.colTop = L.gy + 20 * s;
        L.contentL = L.gx;
        L.contentR = L.gridX + L.gridW;

        // node metrics; shrink a little if the tallest column would not fit (scroll covers the rest)
        L.f = 1;
        const rows = L.portrait ? 4 : 5;
        for (let i = 0; i < 5; i++) {
            L.rowH = 15 * s * L.f;
            L.headH = 19 * s * L.f;
            L.stripH = 18 * s * L.f;
            L.gap = 22 * s * L.f;
            L.nodeH = L.headH + L.stripH + rows * L.rowH + 8 * s * L.f;
            L.expH = clamp(L.nodeW * 0.6, 100, 210 * s) * L.f;
            const n = Math.max(...cols.map((c) => c.length));
            const need = n * L.nodeH + (n - 1) * L.gap + L.expH;
            const avail = L.gy + L.gh - L.colTop;
            if (need <= avail) break;
            L.f = Math.max(0.8, L.f * (avail / need));
            if (L.f === 0.8) break;
        }
        L.rows = rows;
        reflow(snap !== false);
        clampCam();
        computeSynergy();
    }

    // stack nodes in their columns; an expanded node pushes the ones below it down
    function reflow(snap) {
        const drag = gesture && gesture.type === 'node' && gesture.moved ? gesture : null;
        let bottom = 0;
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
            bottom = Math.max(bottom, y);
        });
        L.contentB = bottom;
    }

    function clampCam() {
        cam.z = clamp(cam.z, ZMIN, ZMAX);
        const z = cam.z;
        const loX = Math.min(0, W - 12 - L.contentR * z) - W * 0.15, hiX = Math.max(0, 12 - L.contentL * z) + W * 0.15;
        const loY = Math.min(0, L.bpY - 10 - L.contentB * z) - H * 0.1, hiY = Math.max(0, L.gy - L.gy * z) + H * 0.1;
        cam.x = clamp(cam.x, loX, hiX);
        cam.y = clamp(cam.y, loY, hiY);
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
            if (a.health !== 'ok' && t >= a.healthUntil) {
                if (a.health === 'err') a.upSince = t;
                a.health = 'ok';
                a.errRate = rand(0.005, 0.03);
                sys(`${a.key} (${a.podId}) recovered`);
            }
            const helpingNow = a.helping && t < a.helpUntil;
            if (a.helping && !helpingNow) a.helping = null;
            const working = a.isHub ? !!plan && !plan.doneAt : !!a.task || helpingNow || a.loadingUntil > t;
            a.act = lerp(a.act, a.health === 'err' ? 0 : working ? 1 : 0.1, Math.min(1, dt * 1.5));
            const m = modelById[a.model];
            for (let k = 0; k < m.gpus; k++) {
                const target = a.loadingUntil > t ? 35 + 30 * Math.sin(t * 9 + k) : 6 + a.act * (72 + 18 * Math.sin(t * 1.7 + k * 1.3 + a.seed));
                a.gpu[k] += (target - a.gpu[k]) * Math.min(1, dt * 3);
            }
            if (a.isHub) continue;
            if (helpingNow) charge(a, 1200 * dt, 25 * dt);
            if (!working) {
                if (a.status.startsWith('helping') || a.status === 'rerouting' || (plan && plan.tasks.some((x) => x.steps.includes(a.status)))) a.status = 'idle';
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
        nextIncident -= dt;
        if (nextIncident <= 0) { nextIncident = rand(18, 34); incident(); }
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
    const ratePerMin = () => stats.hist.reduce((a, b) => a + b, 0) * (60 / Math.max(1, stats.hist.length)) * SPEEDS[speedIdx];

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
        flashCost = Math.max(0, flashCost - raw);
    }
    function focusNode() {
        if (hovered && (hovered.kind === 'node' || hovered.kind === 'chip') && !hovered.obj.isHub) return hovered.obj;
        if (selected) return selected;
        if (autoFocus && autoFocus.until > t) return autoFocus.node;
        return null;
    }
    const redirectK = () => (redirect ? clamp((performance.now() - redirect.t0) / 2200, 0, 1) : 1);

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
    function busY(frac) { return L.colTop + frac * (Math.max(L.gy + L.gh, L.contentB) - L.colTop); }
    function anchor(a, side) {
        if (a.isHub) return { x: L.busX + L.busW, y: busY(0.5) };
        const x = side === 'left' ? a.x - L.nodeW / 2 : a.x + L.nodeW / 2;
        return { x, y: a.y + L.headH / 2 };
    }
    const scramble = (text, k) => text.split('').map((ch, i) => (ch === ' ' || i / text.length < k ? ch : '#$%&*+=<>/01'[(Math.random() * 12) | 0])).join('');
    const healthColor = (h) => (h === 'err' ? C.red : h === 'warn' ? C.amber : C.green);

    // ---------------------------------------------------------------- draw
    let inputRects = [];
    let particles = [];
    function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * cam.x, DPR * cam.y);
        drawColumnLabels();
        drawInputs();
        drawFlows();
        drawBusWires();
        drawBus();
        drawPackets();
        drawSynergy();
        const focus = focusNode();
        for (const a of nodes) if (!(gesture && gesture.type === 'node' && gesture.moved && gesture.node === a)) drawNode(a, a === focus);
        if (gesture && gesture.type === 'node' && gesture.moved) {
            const g = gesture;
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = C.amber;
            ctx.strokeRect(L.gridX + L.colW * g.col + (L.colW - L.nodeW) / 2 + 0.5, (g.slotY || L.colTop) + 0.5, L.nodeW - 1, L.nodeH - 1);
            ctx.setLineDash([]);
            drawNode(g.node, true, true);
        }
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        drawRedirect();
        drawBottom();
    }

    function drawColumnLabels() {
        ctx.font = font(10, '600');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = C.dim;
        COLUMNS.forEach((label, c) => {
            const x = L.gridX + L.colW * c + (L.colW - L.nodeW) / 2;
            ctx.fillText(fitText(label, L.nodeW), x, L.gy + 8 * L.s);
        });
        ctx.fillText('inputs', L.gx, L.gy + 8 * L.s);
        ctx.textBaseline = 'alphabetic';
    }

    // left column: the inputs the run works from, each with a little bar chart
    function inputRows(key) {
        const month = stats.monthBase + stats.spend;
        switch (key) {
            case 'brief': {
                const stage = plan ? STAGES[Math.max(0, ...plan.tasks.filter((x) => x.state !== 'pending').map((x) => x.phase), 0)] : '-';
                return [['goal', plan ? plan.goal : '-'], ['stage', plan ? `${stage} ${plan.done}/${plan.tasks.length}` : '-'], ['gate', plan ? plan.gate : '-']];
            }
            case 'budget': return [['spent', money(stats.spend)], ['per min', money(ratePerMin())], ['month', `$${kfmt(month)}/$${kfmt(stats.budget)}`]];
            case 'cluster': {
                const u = stats.util[stats.util.length - 1] || 0.6;
                const bad = nodes.filter((a) => a.health !== 'ok').length;
                return [['gpus', '2,048 · 4 regions'], ['util', Math.round(u * 100) + '% · ' + (u * 4).toFixed(1) + ' MW'], ['health', bad ? `${bad} degraded` : 'all green']];
            }
            case 'models': return MODELS.filter((m) => all().some((a) => a.model === m.id)).slice(0, 3)
                .map((m) => [m.short, `$${m.pin}/$${m.pout} ×${all().filter((a) => a.model === m.id).length}`]);
            default: return [['runs', String(stats.runs.length)], ['avg', stats.runs.length ? fmtDur(stats.runs.reduce((a, r) => a + r.took, 0) / stats.runs.length) : '-'],
                ['avg cost', stats.runs.length ? money(stats.runs.reduce((a, r) => a + r.cost, 0) / stats.runs.length, 0) : '-']];
        }
    }
    function inputSpark(key) {
        if (key === 'budget') return stats.perSec;
        if (key === 'cluster') return stats.util;
        if (key === 'prior_runs') return stats.runs.map((r) => r.cost).slice(-20);
        if (key === 'models') return all().map((a) => a.spend);
        return plan ? plan.tasks.map((x) => x.progress) : [];
    }
    function drawInputs() {
        const s = L.s;
        const x = L.gx, w = L.icW;
        const rowH = 15 * s, headH = 19 * s, sparkH = 20 * s;
        const nodeHt = headH + 3 * rowH + sparkH + 12 * s;
        const avail = L.gy + L.gh - L.colTop;
        const n = Math.min(INPUTS.length, Math.max(2, Math.floor((avail + 12 * s) / (nodeHt + 12 * s))));
        const gap = n > 1 ? Math.min(40 * s, (avail - n * nodeHt) / (n - 1)) : 0;
        inputRects = [];
        for (let i = 0; i < n; i++) {
            const key = INPUTS[i];
            const y = L.colTop + i * (nodeHt + gap);
            inputRects.push({ key, x, y, w, h: nodeHt });
            box(x, y, w, nodeHt, C.node, C.line);
            box(x, y, w, headH, C.head);
            ctx.font = fontS(10.5, '700');
            ctx.fillStyle = C.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(key, x + 7 * s, y + headH / 2);
            ctx.font = fontS(10);
            inputRows(key).forEach(([k, v], r) => {
                const yy = y + headH + rowH * (r + 0.6);
                ctx.fillStyle = C.dim;
                ctx.textAlign = 'left';
                ctx.fillText(k, x + 7 * s, yy);
                ctx.fillStyle = C.text;
                ctx.textAlign = 'right';
                ctx.fillText(fitText(v, w - 70 * s), x + w - 7 * s, yy);
            });
            const data = inputSpark(key);
            const max = Math.max(1e-9, ...data);
            const sx = x + 7 * s, sy = y + nodeHt - 6 * s, sw = w - 14 * s;
            const bars = 28;
            for (let k = 0; k < bars; k++) {
                const v = data.length ? data[Math.floor((k / bars) * data.length)] / max : 0.3 + 0.3 * Math.sin(k + t);
                const hh = Math.max(1, v * sparkH * 0.9);
                ctx.fillStyle = rgba(C.accent, 0.35 + 0.6 * v);
                ctx.fillRect(sx + (k * sw) / bars, sy - hh, sw / bars - 1.5, hh);
            }
        }
        ctx.textBaseline = 'alphabetic';
    }

    // the wire bundle: inputs into the bus, the bus out to every node
    function drawBusWires() {
        const s = L.s;
        const bx = L.busX, bw = L.busW;
        const rk = redirectK();
        ctx.lineWidth = 0.8;
        {
            if (!particles.length) particles = Array.from({ length: 220 }, () => ({ w: randi(0, 19), k: Math.random(), v: rand(0.05, 0.25), j: rand(-6, 6) }));
            const wires = [];
            inputRects.forEach((r, i) => {
                for (let k = 0; k < 4; k++) {
                    const y1 = r.y + 19 * s + 15 * s * (Math.min(k, 2) + 0.6);
                    wires.push([r.x + r.w + 1, y1, bx, busY(((i * 4 + k) * 0.37 + 0.05) % 1)]);
                }
            });
            ctx.strokeStyle = rgba(C.accent, 0.14);
            for (const [x1, y1, x2, y2] of wires) { bez(x1, y1, x2, y2); ctx.stroke(); }
            ctx.fillStyle = rgba(C.text, 0.4);
            for (const p of particles) {
                const wv = wires[p.w % wires.length];
                if (!wv) break;
                p.k = (p.k + (p.v * (rk < 1 ? 4 : 1)) / 60) % 1;
                const q = bezPt(wv[0], wv[1], wv[2], wv[3], p.k);
                ctx.fillRect(q.x + p.j * Math.sin(p.k * 3), q.y + p.j * 0.6, 1.3, 1.3);
            }
        }
        for (const a of nodes) {
            const left = anchor(a, 'left');
            const hot = a.task || (a.helping && t < a.helpUntil);
            const gateHot = plan && plan.gate === 'waiting' && plan.tasks.some((x) => x.phase === 4 && x.owner === a);
            for (let k = 0; k < 3; k++) {
                const y1 = busY((a.seed * 0.17 + k * 0.29) % 1);
                ctx.strokeStyle = rk < 1 ? rgba(C.amber, 0.5 * (1 - rk) + 0.1) : gateHot ? rgba(C.amber, 0.5) : hot ? rgba(C.accent, 0.42) : rgba(C.accent, 0.12);
                ctx.lineWidth = hot && k === 0 ? 1.3 : 0.8;
                bez(bx + bw, y1, left.x - 3, left.y + k * L.rowH);
                ctx.stroke();
                if (rk < 1) {
                    // redirect: a pulse races from the bus to every node
                    const q = bezPt(bx + bw, y1, left.x - 3, left.y + k * L.rowH, clamp(rk * 1.4 - k * 0.1, 0, 1));
                    ctx.fillStyle = C.amber;
                    ctx.fillRect(q.x - 3, q.y - 2, 6, 4);
                }
            }
        }
    }

    // data flowing through the network: inputs straight into layer 1, then each layer into the next
    function drawFlows() {
        const s = L.s;
        ctx.lineWidth = 0.9;
        const feed = [];
        inputRects.forEach((r, i) => cols[0].forEach((b, j) => {
            if ((i + j) % 2 === 0) feed.push([r.x + r.w + 1, r.y + r.h * 0.5, b.x - L.nodeW / 2 - 3, b.y + L.headH + L.stripH / 2, false]);
        }));
        for (let c = 0; c < NCOL - 1; c++) {
            for (const a of cols[c]) for (const b of cols[c + 1]) {
                feed.push([a.x + L.nodeW / 2 + 3, a.y + L.headH + L.stripH / 2, b.x - L.nodeW / 2 - 3, b.y + L.headH + L.stripH / 2, !!(a.task || b.task)]);
            }
        }
        for (const [x1, y1, x2, y2, hot] of feed) {
            ctx.strokeStyle = rgba(C.accent, hot ? 0.3 : 0.1);
            bez(x1, y1, x2, y2);
            ctx.stroke();
        }
        feed.forEach(([x1, y1, x2, y2, hot], i) => {
            for (let k = 0; k < (hot ? 3 : 1); k++) {
                const q = bezPt(x1, y1, x2, y2, (t * (hot ? 0.35 : 0.15) + hash(i) + k / 3) % 1);
                ctx.fillStyle = hot ? C.amber : rgba(C.text, 0.45);
                ctx.fillRect(q.x - 1.5 * s, q.y - 1.5 * s, 3 * s, 3 * s);
            }
        });
    }

    function drawBus() {
        const s = L.s;
        const x = L.busX, w = L.busW, y0 = L.colTop - 12 * s, y1 = Math.max(L.gy + L.gh, L.contentB);
        const hot = hovered && hovered.kind === 'hub';
        const rk = redirectK();
        box(x, y0, w, y1 - y0, '#0e141c', hot ? C.accent : C.line);
        const n = Math.floor((y1 - y0 - 8) / (7 * s));
        const sweep = rk < 1 ? y0 + (y1 - y0) * rk : -1e9;
        for (let i = 0; i < n; i++) {
            const py = y0 + 5 + i * 7 * s;
            for (let c = 0; c < 2; c++) {
                const v = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 0.7 + c * 2);
                const near = Math.abs(py - sweep) < 30 * s;
                ctx.fillStyle = near ? C.amber : rgba(v > 0.85 && hub.act > 0.5 ? C.accent : C.text, 0.12 + 0.35 * v * hub.act);
                ctx.fillRect(x + 3 + c * (w / 2 - 2), py, w / 2 - 5, 3.5 * s);
            }
        }
        const target = plan ? (plan.done + plan.tasks.filter((q) => q.state === 'active').reduce((sum, q) => sum + q.progress, 0)) / plan.tasks.length : 0;
        hub.shownProgress = lerp(hub.shownProgress, target, 0.05);
        ctx.fillStyle = rgba(C.amber, 0.85);
        ctx.fillRect(x + w - 3, y1 - (y1 - y0) * hub.shownProgress, 3, (y1 - y0) * hub.shownProgress);
        if (!L.portrait) {
            ctx.font = font(10, '700');
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = C.amber;
            ctx.fillText(`orchestrator · ${modelById[hub.model].short} · ${Math.round(hub.shownProgress * 100)}%`, x - 2, y0 - 3);
            ctx.textBaseline = 'alphabetic';
        }
        hub.rect = { x: x - 4, y: y0, w: w + 8, h: y1 - y0 };
    }

    function drawPackets() {
        for (const p of packets) {
            const a = p.from.isHub ? anchor(p.from) : anchor(p.from, p.to.isHub || p.to.x < p.from.x ? 'left' : 'right');
            const b = p.to.isHub ? anchor(p.to) : anchor(p.to, p.from.isHub || p.from.x < p.to.x ? 'left' : 'right');
            if (Math.abs(a.x - b.x) < 4) { a.x = p.from.x + L.nodeW / 2; b.x = p.to.x + L.nodeW / 2; }
            const e = ease(p.k);
            const c = p.from.isHub ? C.amber : C.accent;
            ctx.strokeStyle = rgba(c, 0.6);
            ctx.lineWidth = 1.4;
            bez(a.x, a.y, b.x, b.y);
            ctx.stroke();
            const q = bezPt(a.x, a.y, b.x, b.y, e);
            ctx.fillStyle = c;
            ctx.fillRect(q.x - 4, q.y - 2.5, 8, 5);
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
            ctx.moveTo(x - L.nodeW * 0.34, y1);
            ctx.lineTo(x - L.nodeW * 0.34, y2);
            ctx.moveTo(x + L.nodeW * 0.34, y1);
            ctx.lineTo(x + L.nodeW * 0.34, y2);
            ctx.stroke();
            ctx.font = font(9.5, '700');
            const txt = fitText(`${l.pct > 0 ? '+' : ''}${l.pct}% ${l.why}`, L.nodeW * 0.62);
            const tw = ctx.measureText(txt).width + 10 * s;
            const my = (y1 + y2) / 2;
            box(x - tw / 2, my - 7.5 * s, tw, 15 * s, l.pct > 0 ? '#0f2a1c' : '#2c1416', c);
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
        ctx.font = font(9, '700');
        const label = fitText(m.short + ' ▾', maxW - 8 * s);
        const w = ctx.measureText(label).width + 10 * s, h = L.headH - 5 * s;
        box(rx - w, cy - h / 2, w, h, '#0a0d12', rgba(m.dot, 0.8));
        ctx.fillStyle = m.dot;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, rx - w + 5 * s, cy + 0.5);
        return { x: rx - w, y: cy - h / 2, w, h };
    }

    function drawNode(a, focused, floating) {
        const s = L.s, w = L.nodeW, h = nodeH(a);
        const x0 = a.x - w / 2, y0 = a.y;
        a.rect = { x: x0, y: y0, w, h };
        const gateHot = plan && plan.gate === 'waiting' && plan.tasks.some((x) => x.phase === 4 && x.owner === a);
        const hc = healthColor(a.health);
        if (floating) box(x0 + 5, y0 + 8, w, h, 'rgba(0,0,0,0.5)');
        const border = gateHot ? C.amber : a.health !== 'ok' ? hc : focused ? C.accent : rgba(C.accent, 0.22 + 0.4 * a.flash);
        box(x0, y0, w, h, focused ? C.nodeHot : C.node, border);
        box(x0, y0, w, L.headH, gateHot ? '#4a3a12' : a.health === 'err' ? '#3a1618' : focused || a.flash > 0.3 ? C.headHot : C.head);
        a.chip = drawChip(a, x0 + w - 4 * s, y0 + L.headH / 2, w * 0.52);
        // health dot, then the name
        ctx.fillStyle = hc;
        ctx.beginPath();
        ctx.arc(x0 + 9 * s, y0 + L.headH / 2, 3.5 * s, 0, TAU);
        ctx.fill();
        ctx.font = font(10.5, '700');
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(fitText(a.key, a.chip.x - x0 - 22 * s), x0 + 17 * s, y0 + L.headH / 2 + 0.5);

        // a strip with this role's own little animation
        drawViz(a, x0 + 1, y0 + L.headH + 1, w - 2, L.stripH - 2, true);

        const rk = redirectK();
        const rows = [];
        const loading = a.loadingUntil > t;
        const said = a.said && a.said.until > t ? a.said : null;
        if (!L.portrait) rows.push(['task', loading ? 'swapping model' : a.task ? a.task.key : a.helping ? `help: ${a.helping.key}` : 'idle']);
        rows.push(['step', rk < 1 ? scramble(a.status, rk) : a.status]);
        rows.push(['prog', null]);
        rows.push(['health', null]);
        rows.push(said ? ['says', `→ ${said.to.key}: ${said.text}`] : ['cost', `${money(a.spend)} · ${kfmt(a.tokIn + a.tokOut)} tok`]);
        ctx.font = font(10);
        const top = y0 + L.headH + L.stripH;
        rows.slice(0, L.rows).forEach(([k, v], r) => {
            const yy = top + L.rowH * (r + 0.6);
            ctx.fillStyle = C.dim;
            ctx.textAlign = 'left';
            ctx.fillText(k, x0 + 7 * s, yy);
            const vx = x0 + 52 * s * L.f, vw = x0 + w - 7 * s - vx;
            if (k === 'prog') {
                const p = loading ? (t - a.loadingFrom) / (a.loadingUntil - a.loadingFrom) : a.task ? a.task.progress : 0;
                const ticks = Math.max(6, Math.floor((vw - 40 * s) / (5 * s)));
                for (let i = 0; i < ticks; i++) {
                    ctx.fillStyle = i / ticks < p ? (loading ? modelById[a.loadingModel].dot : C.accent) : '#1f2a37';
                    ctx.fillRect(vx + i * 5 * s, yy - 4 * s, 3.2 * s, 8 * s);
                }
                ctx.fillStyle = C.text;
                ctx.textAlign = 'right';
                ctx.fillText(Math.round(p * 100) + '%', x0 + w - 7 * s, yy);
            } else if (k === 'health') {
                const label = a.health === 'ok' ? 'ok' : a.health === 'warn' ? 'degraded' : 'down';
                ctx.fillStyle = hc;
                ctx.fillText(label, vx, yy);
                ctx.fillStyle = C.dim;
                ctx.textAlign = 'right';
                ctx.fillText(fitText(`up ${fmtUp(Math.max(0, t - a.upSince))} · err ${a.errRate.toFixed(2)}%`, vw - ctx.measureText(label).width - 8 * s), x0 + w - 7 * s, yy);
            } else {
                ctx.fillStyle = k === 'says' ? C.amber : C.text;
                ctx.textAlign = 'right';
                ctx.fillText(fitText(v, vw), x0 + w - 7 * s, yy);
            }
        });
        if (a.exp > 0.05) drawInside(a, x0 + 5 * s, y0 + L.nodeH - 2 * s, w - 10 * s, a.exp * L.expH - 4 * s);
        ctx.textBaseline = 'alphabetic';
    }

    // Inside an open node: its role's visual large on the left, the hardware it runs on to the right.
    function drawInside(a, x, y, w, h) {
        if (h < 14) return;
        const s = L.s, m = modelById[a.model];
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        box(x, y, w, h, '#0c1219', C.line);
        const split = L.portrait ? w : w * 0.6;
        drawViz(a, x + 2, y + 2, split - 4, h - 4, false);
        if (!L.portrait) {
            const hx = x + split + 6 * s, hw = w - split - 12 * s;
            ctx.font = font(9.5, '700');
            ctx.fillStyle = C.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(fitText(`${a.podId} · ${a.region}`, hw), hx, y + 5 * s);
            ctx.font = font(9);
            ctx.fillStyle = C.dim;
            ctx.fillText(fitText(`${m.gpus}× ${m.gpu} · rack ${a.rack}`, hw), hx, y + 18 * s);
            const gy = y + 32 * s, gh = Math.min(34 * s, h * 0.28), n = m.gpus, bw = Math.max(2, (hw - (n - 1) * 2) / n);
            let sum = 0;
            for (let k = 0; k < n; k++) {
                const u = clamp(a.gpu[k] / 100, 0.03, 1);
                sum += u;
                ctx.fillStyle = '#1a2430';
                ctx.fillRect(hx + k * (bw + 2), gy, bw, gh);
                ctx.fillStyle = rgba(u > 0.85 ? C.amber : C.accent, 0.5 + 0.5 * u);
                ctx.fillRect(hx + k * (bw + 2), gy + gh * (1 - u), bw, gh * u);
            }
            const rows = [
                ['status', a.health === 'ok' ? 'healthy' : a.health === 'warn' ? 'degraded' : 'down'],
                ['uptime', fmtUp(Math.max(0, t - a.upSince))],
                ['errors', a.errRate.toFixed(2) + '%'],
                ['tok/s', a.loadingUntil > t ? 'loading' : kfmt(m.tps * LOAD * (0.15 + 0.85 * a.act))],
                ['power', `${(m.kw * (0.35 + 0.65 * sum / n)).toFixed(1)} kW · ${Math.round(38 + 30 * sum / n)} °C`],
            ];
            let yy = gy + gh + 6 * s;
            for (const [k, v] of rows) {
                if (yy > y + h - 11 * s) break;
                ctx.fillStyle = C.dim;
                ctx.textAlign = 'left';
                ctx.fillText(k, hx, yy);
                ctx.fillStyle = k === 'status' ? healthColor(a.health) : C.text;
                ctx.textAlign = 'right';
                ctx.fillText(fitText(v, hw - 46 * s), hx + hw, yy);
                yy += 12.5 * s;
            }
        }
        ctx.restore();
    }

    // ---------------------------------------------------------------- per-role visuals: things LLM systems actually do
    // Each works as a thin strip on the node and as a big panel when the node is open. Illustrations, not real telemetry.
    const VIZ_CAPTION = {
        beam: 'beam search · width 3', embed: 'embedding space · nearest neighbours', layers: 'transformer layers · attention + MLP',
        descent: 'gradient descent on the loss surface', tokens: 'tokenizer · text to token ids', moe: 'mixture of experts · top-2 routing',
        sample: 'sampling the next token', attn: 'attention matrix · causal mask', logits: 'eval scores vs pass threshold',
        allreduce: 'all-reduce ring across 8 GPUs', specdec: 'speculative decoding · draft and verify', matmul: 'systolic array · matrix multiply',
        kvcache: 'paged KV cache',
    };
    const TOKS = ['the', '▁fast', 'retr', 'ieval', 'shard', '▁KV', 'cache', '##ing', 'token', 'izer', '▁p99', 'lat', 'ency', '▁GPU', 'quant', '▁int8'];
    function drawViz(a, x, y, w, h, mini) {
        if (w < 10 || h < 6) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        if (mini) { ctx.fillStyle = '#0d141c'; ctx.fillRect(x, y, w, h); }
        const act = a.health === 'err' ? 0.05 : 0.2 + 0.8 * a.act;
        const sp = t * (0.4 + act);
        const A = C.accent, AM = C.amber, s = L.s, seed = a.seed;
        let cy0 = y, ch = h;
        if (!mini) {
            ctx.font = font(9, '600');
            ctx.fillStyle = C.dim;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(fitText(VIZ_CAPTION[a.viz] || '', w - 8), x + 4, y + 3);
            cy0 = y + 15 * s;
            ch = h - 17 * s;
        }
        const Y = cy0, Hh = ch;
        ctx.lineWidth = 1;
        ctx.textBaseline = 'middle';
        switch (a.viz) {
            case 'beam': {
                const depth = mini ? 4 : 5;
                const shown = (sp * 0.35) % (depth + 1.5);
                const lv = [];
                for (let l = 0; l <= depth; l++) {
                    const n = l === 0 ? 1 : Math.min(Math.pow(3, l), mini ? 4 : 9);
                    lv.push(Array.from({ length: n }, (_, i) => ({ x: x + 4 + (l / depth) * (w - 8), y: Y + ((i + 0.5) / n) * Hh, score: hash(seed + l * 17 + i) })));
                }
                const best = lv.map((row) => row.reduce((b, p) => (p.score > b.score ? p : b), row[0]));
                for (let l = 1; l <= depth && l <= shown; l++) {
                    lv[l].forEach((p, i) => {
                        const parent = lv[l - 1][Math.floor((i * lv[l - 1].length) / lv[l].length)];
                        const kept = p.score > 0.45;
                        ctx.strokeStyle = rgba(A, kept ? 0.5 : 0.12);
                        ctx.beginPath(); ctx.moveTo(parent.x, parent.y); ctx.lineTo(p.x, p.y); ctx.stroke();
                        ctx.fillStyle = kept ? rgba(A, 0.9) : rgba(C.faint, 0.6);
                        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
                    });
                }
                ctx.strokeStyle = AM;
                ctx.lineWidth = 2;
                ctx.beginPath();
                best.forEach((p, l) => { if (l <= shown) (l ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); });
                ctx.stroke();
                break;
            }
            case 'embed': {
                const n = mini ? 26 : 70;
                const pts = Array.from({ length: n }, (_, i) => {
                    const c = i % 4;
                    return { c, x: x + w * (0.15 + 0.7 * hash(seed + c * 3)) + (hash(seed + i * 7) - 0.5) * w * 0.25,
                        y: Y + Hh * (0.2 + 0.6 * hash(seed + c * 5 + 1)) + (hash(seed + i * 11) - 0.5) * Hh * 0.35 };
                });
                const qx = x + w * (0.5 + 0.38 * Math.sin(sp * 0.3)), qy = Y + Hh * (0.5 + 0.32 * Math.cos(sp * 0.23));
                const near = pts.map((p) => ({ p, d: (p.x - qx) ** 2 + (p.y - qy) ** 2 })).sort((p, q) => p.d - q.d).slice(0, 5);
                ctx.strokeStyle = rgba(AM, 0.7);
                for (const { p } of near) { ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(p.x, p.y); ctx.stroke(); }
                for (const p of pts) {
                    ctx.fillStyle = rgba([A, '#6fb3ff', '#c49bff', C.green][p.c], 0.75);
                    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
                }
                ctx.fillStyle = AM;
                ctx.fillRect(qx - 3, qy - 3, 6, 6);
                break;
            }
            case 'layers': {
                if (mini) {
                    const n = 12, bw = w / n;
                    const lit = Math.floor(sp * 2.5) % n;
                    for (let i = 0; i < n; i++) {
                        ctx.fillStyle = i === lit ? AM : i < lit ? rgba(A, 0.55) : '#16212c';
                        ctx.fillRect(x + i * bw + 1, Y + 3, bw - 2, Hh - 6);
                    }
                    break;
                }
                const sw = w * 0.42, rows = 6, rh = Hh / rows;
                const lit = Math.floor(sp * 1.5) % rows;
                for (let r = 0; r < rows; r++) {
                    const ry = Y + Hh - (r + 1) * rh;
                    const on = r === lit;
                    ctx.font = font(8.5);
                    for (const [k, label] of [[0, 'attn'], [1, 'mlp']]) {
                        const bx = x + 26 * s + k * (sw - 26 * s) / 2;
                        ctx.fillStyle = on ? rgba(AM, 0.35) : '#132030';
                        ctx.fillRect(bx, ry + 2, (sw - 26 * s) / 2 - 4, rh - 4);
                        ctx.strokeStyle = on ? AM : rgba(A, 0.5);
                        ctx.strokeRect(bx + 0.5, ry + 2.5, (sw - 26 * s) / 2 - 5, rh - 5);
                        ctx.fillStyle = C.text;
                        ctx.textAlign = 'center';
                        ctx.fillText(label, bx + ((sw - 26 * s) / 2 - 4) / 2, ry + rh / 2);
                    }
                    ctx.fillStyle = C.dim;
                    ctx.textAlign = 'left';
                    ctx.fillText(r === rows - 1 ? 'L·N' : 'L' + (r + 1), x + 2, ry + rh / 2);
                }
                ctx.strokeStyle = rgba(AM, 0.6);
                ctx.setLineDash([3, 3]);
                ctx.lineDashOffset = -t * 20;
                ctx.beginPath(); ctx.moveTo(x + 22 * s, Y + Hh); ctx.lineTo(x + 22 * s, Y); ctx.stroke();
                ctx.setLineDash([]);
                wireframe(a, x + sw, Y, w - sw, Hh, act);
                break;
            }
            case 'descent': {
                const k = (sp * 0.07) % 1;
                if (mini) {
                    ctx.strokeStyle = AM;
                    ctx.beginPath();
                    for (let i = 0; i <= 40; i++) {
                        const q = i / 40, v = Math.exp(-q * 3 - k) * 0.8 + 0.08 + 0.04 * Math.sin(q * 40 + sp * 4);
                        const px = x + q * w, py = Y + Hh - v * Hh * 0.9 - 1;
                        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                    }
                    ctx.stroke();
                    break;
                }
                const cx = x + w * 0.4, cy = Y + Hh * 0.55, R = Math.min(w * 0.38, Hh * 0.55);
                for (let r = 1; r <= 7; r++) {
                    ctx.strokeStyle = rgba(A, 0.08 + 0.05 * (7 - r));
                    ctx.beginPath(); ctx.ellipse(cx, cy, (R * r) / 7, (R * r) / 7 * 0.6, 0.4, 0, TAU); ctx.stroke();
                }
                const pos = (q) => ({ x: cx + R * (1 - q) * Math.cos(q * 9 + seed), y: cy + R * 0.6 * (1 - q) * Math.sin(q * 9 + seed) });
                ctx.strokeStyle = rgba(AM, 0.6);
                ctx.beginPath();
                for (let i = 0; i <= 60; i++) { const p = pos((i / 60) * k); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
                ctx.stroke();
                const p = pos(k);
                ctx.fillStyle = AM;
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
                const lx = x + w * 0.78, lw = w * 0.2;
                ctx.strokeStyle = A;
                ctx.beginPath();
                for (let i = 0; i <= 30; i++) {
                    const q = (i / 30) * k, v = Math.exp(-q * 3) * 0.8 + 0.1;
                    const px = lx + (i / 30) * lw, py = Y + Hh - v * Hh * 0.8;
                    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                }
                ctx.stroke();
                ctx.font = font(8.5);
                ctx.fillStyle = C.dim;
                ctx.textAlign = 'left';
                ctx.fillText(`loss ${(Math.exp(-k * 3) * 0.8 + 0.1).toFixed(3)}`, lx, Y + 6);
                break;
            }
            case 'tokens': {
                ctx.font = font(mini ? 8.5 : 9.5);
                const gap = 4, chipH = mini ? Hh - 4 : 18 * s;
                const rows = mini ? 1 : Math.max(1, Math.floor(Hh / (chipH + 16 * s)));
                const shift = (sp * 18) % 400;
                for (let r = 0; r < rows; r++) {
                    let cx = x + 2 - ((shift + r * 90) % 120);
                    let i = r * 5 + Math.floor((shift + r * 90) / 120) * 3;
                    const cy = mini ? Y + 2 : Y + 4 + r * (chipH + 16 * s);
                    while (cx < x + w) {
                        const tok = TOKS[Math.floor(hash(i + seed) * TOKS.length)];
                        const tw = ctx.measureText(tok).width + 8;
                        ctx.fillStyle = i % 5 === 0 ? rgba(AM, 0.3) : '#132232';
                        ctx.fillRect(cx, cy, tw, chipH);
                        ctx.fillStyle = C.text;
                        ctx.textAlign = 'left';
                        ctx.fillText(tok, cx + 4, cy + chipH / 2);
                        if (!mini) {
                            ctx.fillStyle = C.dim;
                            ctx.font = font(8);
                            ctx.fillText(String(1000 + Math.floor(hash(i * 3 + seed) * 99000)), cx + 2, cy + chipH + 7 * s);
                            ctx.font = font(9.5);
                        }
                        cx += tw + gap;
                        i++;
                    }
                }
                break;
            }
            case 'moe': {
                const E = 8, step = Math.floor(sp * 1.4);
                const c1 = Math.floor(hash(step + seed) * E), c2 = (c1 + 1 + Math.floor(hash(step * 3 + seed) * (E - 1))) % E;
                if (mini) {
                    const bw = w / E;
                    for (let e = 0; e < E; e++) {
                        const load = 0.25 + 0.6 * hash(e + seed + step * 0.1);
                        const on = e === c1 || e === c2;
                        ctx.fillStyle = on ? AM : rgba(A, 0.35);
                        ctx.fillRect(x + e * bw + 1, Y + Hh * (1 - load), bw - 2, Hh * load);
                    }
                    break;
                }
                const rx = x + w * 0.32, ry = Y + Hh / 2, ex = x + w * 0.62, eh = Hh / E;
                for (let i = 0; i < 6; i++) {
                    const k = (sp * 0.6 + i / 6) % 1;
                    ctx.fillStyle = rgba(C.text, 0.7);
                    ctx.fillRect(x + 4 + k * (rx - x - 14), ry - 2 + (i - 3) * 3, 4, 3);
                }
                ctx.fillStyle = '#132232';
                ctx.strokeStyle = A;
                ctx.beginPath(); ctx.moveTo(rx - 10, ry); ctx.lineTo(rx, ry - 12); ctx.lineTo(rx + 10, ry); ctx.lineTo(rx, ry + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.font = font(8.5);
                for (let e = 0; e < E; e++) {
                    const ey = Y + e * eh + eh / 2, on = e === c1 || e === c2;
                    ctx.strokeStyle = on ? AM : rgba(A, 0.15);
                    ctx.lineWidth = on ? 2 : 1;
                    ctx.beginPath(); ctx.moveTo(rx + 10, ry); ctx.lineTo(ex, ey); ctx.stroke();
                    ctx.lineWidth = 1;
                    ctx.fillStyle = on ? rgba(AM, 0.3) : '#132232';
                    ctx.fillRect(ex, ey - eh / 2 + 1, w * 0.18, eh - 2);
                    ctx.fillStyle = on ? AM : C.dim;
                    ctx.textAlign = 'left';
                    ctx.fillText(`expert ${e}`, ex + 4, ey);
                    const load = 0.2 + 0.7 * hash(e + seed + Math.floor(step / 4));
                    ctx.fillStyle = rgba(A, 0.6);
                    ctx.fillRect(ex + w * 0.2, ey - 2, (w * 0.16) * load, 4);
                }
                break;
            }
            case 'sample': {
                const step = Math.floor(sp * 1.1);
                const cands = Array.from({ length: 5 }, (_, i) => ({ tok: TOKS[Math.floor(hash(step * 7 + i + seed) * TOKS.length)], v: Math.exp(hash(step * 5 + i) * 3) }));
                const sum = cands.reduce((q, c) => q + c.v, 0);
                cands.forEach((c) => { c.p = c.v / sum; });
                const chosen = cands.reduce((b, c) => (c.p > b.p ? c : b), cands[0]);
                if (mini) {
                    const bw = w / 5;
                    cands.forEach((c, i) => {
                        ctx.fillStyle = c === chosen ? AM : rgba(A, 0.45);
                        ctx.fillRect(x + i * bw + 2, Y + Hh * (1 - c.p * 1.4), bw - 4, Hh * c.p * 1.4);
                    });
                    break;
                }
                const bh = (Hh - 26 * s) / 5;
                ctx.font = font(9);
                cands.forEach((c, i) => {
                    const by = Y + i * bh;
                    ctx.fillStyle = C.text;
                    ctx.textAlign = 'right';
                    ctx.fillText(c.tok, x + 56 * s, by + bh / 2);
                    ctx.fillStyle = c === chosen ? AM : rgba(A, 0.5);
                    ctx.fillRect(x + 62 * s, by + 3, (w - 110 * s) * c.p, bh - 6);
                    ctx.fillStyle = C.dim;
                    ctx.textAlign = 'left';
                    ctx.fillText((c.p * 100).toFixed(0) + '%', x + 66 * s + (w - 110 * s) * c.p, by + bh / 2);
                });
                const out = Array.from({ length: 8 }, (_, i) => TOKS[Math.floor(hash((step - 8 + i) * 7 + seed) * TOKS.length)]).join(' ');
                ctx.fillStyle = C.text;
                ctx.textAlign = 'left';
                ctx.fillText(fitText('› ' + out + ' ' + chosen.tok + (Math.floor(t * 2) % 2 ? '▍' : ''), w - 8), x + 4, Y + Hh - 10 * s);
                break;
            }
            case 'attn': {
                const n = mini ? 0 : 14;
                if (mini) {
                    const cols2 = Math.floor(w / 6), rows = 2;
                    for (let i = 0; i < cols2; i++) for (let j = 0; j < rows; j++) {
                        const v = (0.5 + 0.5 * Math.sin(sp * 2 + i * 0.5 + j * 2 + seed)) * act;
                        ctx.fillStyle = rgba(v > 0.85 ? AM : A, 0.1 + 0.8 * v);
                        ctx.fillRect(x + i * 6, Y + j * (Hh / 2) + 1, 5, Hh / 2 - 2);
                    }
                    break;
                }
                const cell = Math.min((w * 0.6) / n, Hh / n), mx = x + 4, my = Y;
                const q = Math.floor(sp * 2) % n;
                for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
                    const v = Math.exp(-Math.abs(i - j) * 0.35) * (0.4 + 0.6 * hash(i * 31 + j + seed)) * act;
                    ctx.fillStyle = i === q ? rgba(AM, 0.25 + 0.75 * v) : rgba(A, 0.08 + 0.85 * v);
                    ctx.fillRect(mx + j * cell, my + i * cell, cell - 1, cell - 1);
                }
                ctx.font = font(8.5);
                ctx.fillStyle = C.dim;
                ctx.textAlign = 'left';
                ctx.fillText(`query ${q} attends to ${q + 1} tokens`, mx + n * cell + 8, my + 10);
                ctx.fillText(`head ${Math.floor(hash(seed) * 64)} of 64`, mx + n * cell + 8, my + 24 * s);
                break;
            }
            case 'logits': {
                const bins = mini ? 24 : 30, bw = w / bins;
                const mean = 0.62 + 0.08 * Math.sin(sp * 0.3), thr = 0.5;
                for (let i = 0; i < bins; i++) {
                    const xv = (i + 0.5) / bins;
                    const v = Math.exp(-((xv - mean) ** 2) / 0.02) * (0.85 + 0.15 * hash(i + Math.floor(sp)));
                    ctx.fillStyle = xv < thr ? rgba(C.red, 0.6) : rgba(C.green, 0.65);
                    ctx.fillRect(x + i * bw + 1, Y + Hh * (1 - v * 0.9), bw - 2, Hh * v * 0.9);
                }
                ctx.strokeStyle = AM;
                ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.moveTo(x + thr * w, Y); ctx.lineTo(x + thr * w, Y + Hh); ctx.stroke();
                ctx.setLineDash([]);
                if (!mini) {
                    ctx.font = font(8.5);
                    ctx.fillStyle = C.dim;
                    ctx.textAlign = 'left';
                    ctx.fillText(`pass rate ${Math.round((1 - (thr - mean + 0.4) / 0.8) * 100)}% · 12k prompts`, x + 4, Y + 8);
                }
                break;
            }
            case 'allreduce': {
                const G = 8;
                if (mini) {
                    const bw = w / G;
                    for (let i = 0; i < G; i++) {
                        ctx.strokeStyle = rgba(A, 0.6);
                        ctx.strokeRect(x + i * bw + 2.5, Y + 2.5, bw - 5, Hh - 5);
                    }
                    for (let i = 0; i < G; i++) {
                        const k = (sp * 0.5 + i / G) % 1;
                        ctx.fillStyle = AM;
                        ctx.fillRect(x + k * w - 2, Y + Hh / 2 - 2, 4, 4);
                    }
                    break;
                }
                const cx = x + w / 2, cy = Y + Hh / 2, R = Math.min(w * 0.36, Hh * 0.42);
                const pos = (i) => ({ x: cx + R * Math.cos((i / G) * TAU - Math.PI / 2), y: cy + R * Math.sin((i / G) * TAU - Math.PI / 2) });
                ctx.strokeStyle = rgba(A, 0.35);
                ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
                ctx.font = font(8.5);
                for (let i = 0; i < G; i++) {
                    const p = pos(i);
                    ctx.fillStyle = '#132232';
                    ctx.fillRect(p.x - 14, p.y - 9, 28, 18);
                    ctx.strokeStyle = A;
                    ctx.strokeRect(p.x - 13.5, p.y - 8.5, 27, 17);
                    ctx.fillStyle = C.text;
                    ctx.textAlign = 'center';
                    ctx.fillText('gpu' + i, p.x, p.y);
                }
                for (let i = 0; i < G; i++) {
                    const k = (sp * 0.4 + i / G) % 1, from = Math.floor(k * G), f = k * G - from;
                    const p = pos(from), q = pos((from + 1) % G);
                    ctx.fillStyle = AM;
                    ctx.fillRect(lerp(p.x, q.x, f) - 3, lerp(p.y, q.y, f) - 3, 6, 6);
                }
                ctx.fillStyle = C.dim;
                ctx.textAlign = 'center';
                ctx.fillText('gradients', cx, cy);
                break;
            }
            case 'specdec': {
                const step = Math.floor(sp * 0.9);
                const accepted = 2 + Math.floor(hash(step + seed) * 4);
                const n = mini ? 8 : 6;
                ctx.font = font(mini ? 8 : 9);
                const drawRow = (yy, rh, label) => {
                    let cx = x + (label ? 64 * s : 2);
                    if (label) { ctx.fillStyle = C.dim; ctx.textAlign = 'left'; ctx.fillText(label, x + 2, yy + rh / 2); }
                    for (let i = 0; i < n; i++) {
                        const tok = TOKS[Math.floor(hash(step * 9 + i + seed) * TOKS.length)];
                        const tw = mini ? (w - 4) / n - 3 : ctx.measureText(tok).width + 10;
                        const state = i < accepted ? 'ok' : i === accepted ? 'no' : 'wait';
                        ctx.fillStyle = state === 'ok' ? rgba(C.green, 0.35) : state === 'no' ? rgba(C.red, 0.45) : '#132232';
                        ctx.fillRect(cx, yy, tw, rh);
                        if (!mini) { ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.fillText(tok, cx + 5, yy + rh / 2); }
                        cx += tw + 3;
                    }
                };
                if (mini) { drawRow(Y + 2, Hh - 4); break; }
                drawRow(Y + 4, 18 * s, 'draft');
                const out = Array.from({ length: 10 }, (_, i) => TOKS[Math.floor(hash((step - 1) * 9 + (i % 6) + seed) * TOKS.length)]).join(' ');
                ctx.fillStyle = C.dim;
                ctx.textAlign = 'left';
                ctx.fillText('verify', x + 2, Y + 36 * s);
                ctx.fillStyle = C.text;
                ctx.fillText(fitText(out, w - 70 * s), x + 64 * s, Y + 36 * s);
                ctx.fillStyle = C.green;
                ctx.fillText(`accepted ${accepted} of ${n} draft tokens · ${(1 + accepted * 0.6).toFixed(1)}x faster`, x + 2, Y + Hh - 8 * s);
                break;
            }
            case 'matmul': {
                const rows = mini ? 2 : 12, cols2 = mini ? Math.floor(w / 6) : 12;
                const cw = mini ? 6 : Math.min((w * 0.62) / cols2, Hh / rows), chh = mini ? Hh / 2 : cw;
                const ox = mini ? x : x + 18 * s, oy = mini ? Y : Y + 4;
                for (let i = 0; i < rows; i++) for (let j = 0; j < cols2; j++) {
                    const v = 0.5 + 0.5 * Math.sin((i + j) * 0.6 - sp * 3);
                    ctx.fillStyle = rgba(v > 0.92 ? AM : A, 0.08 + 0.7 * v * act);
                    ctx.fillRect(ox + j * cw, oy + i * chh, cw - 1, chh - 1);
                }
                if (!mini) {
                    ctx.font = font(8.5);
                    ctx.fillStyle = C.dim;
                    ctx.textAlign = 'left';
                    ctx.fillText('A ↓   B →   C = A·B', ox + cols2 * cw + 8, oy + 10);
                    ctx.fillText(`${(act * 1.9).toFixed(2)} PFLOP/s`, ox + cols2 * cw + 8, oy + 26 * s);
                }
                break;
            }
            case 'kvcache': {
                const rows = mini ? 1 : 8, cols2 = mini ? 24 : 14;
                const cw = w / cols2, chh = Hh / rows;
                const total = rows * cols2, fill = Math.floor((sp * 3) % (total + 8));
                for (let i = 0; i < total; i++) {
                    const evicted = hash(seed + i + Math.floor(sp / 6)) > 0.9;
                    ctx.fillStyle = i < fill ? (evicted ? rgba(AM, 0.7) : rgba(A, 0.55)) : '#16212c';
                    ctx.fillRect(x + (i % cols2) * cw + 1, Y + Math.floor(i / cols2) * chh + 1, cw - 2, chh - 2);
                }
                break;
            }
            default: break;
        }
        ctx.restore();
    }

    // the "neural net" look: tilted planes of units, wired plane to plane, slowly turning (an illustration)
    function wireframe(a, x, y, w, h, act) {
        const cx = x + w / 2, cy = y + h / 2, R = Math.min(w * 0.42, h * 0.7);
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
                const f = (2.4 * R) / (2.4 * R + z2);
                pts[p].push({ x: cx + x1 * f, y: cy + y1 * f, d: f });
            }
        }
        ctx.lineWidth = 0.7;
        for (let p = 0; p < planes; p++) {
            const c = pts[p];
            const corners = [c[0], c[grid[1] - 1], c[c.length - 1], c[c.length - grid[1]]];
            ctx.strokeStyle = rgba(C.accent, 0.5);
            ctx.beginPath();
            corners.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
            ctx.closePath();
            ctx.stroke();
            if (p < planes - 1) {
                for (const [i, j] of a.wire[p]) {
                    const q1 = c[i % c.length], q2 = pts[p + 1][j % c.length];
                    const v = 0.5 + 0.5 * Math.sin(t * 3 - p + i);
                    ctx.strokeStyle = rgba(v > 0.85 ? C.amber : C.accent, (0.1 + 0.4 * v) * act);
                    ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
                }
            }
            for (const q of c) {
                ctx.fillStyle = rgba(C.text, 0.3 + 0.5 * act * q.d);
                ctx.fillRect(q.x - 1.2, q.y - 1.2, 2.4, 2.4);
            }
        }
    }

    // ---------------------------------------------------------------- redirect banner (screen space)
    function drawRedirect() {
        const k = redirectK();
        if (k >= 1 || !redirect || !redirect.switching) return;
        const s = L.s;
        const alpha = Math.min(1, (1 - k) * 3);
        const text = `redirecting → ${redirect.goal}`;
        ctx.font = fontS(12, '700');
        const w = Math.min(W - 40, ctx.measureText(text).width + 40 * s), h = 30 * s;
        const x = (W - w) / 2, y = L.gy + 30 * s;
        ctx.globalAlpha = alpha;
        box(x, y, w, h, '#14110a', C.amber);
        ctx.fillStyle = C.amber;
        ctx.fillRect(x, y + h - 3, w * k, 3);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fitText(text, w - 20), W / 2, y + h / 2 - 1);
        ctx.globalAlpha = 1;
        ctx.textBaseline = 'alphabetic';
    }

    // ---------------------------------------------------------------- bottom panels (screen space)
    function panel(x, y, w, h, title, color) {
        box(x, y, w, h, '#0e141c', color || C.line);
        ctx.font = fontS(10, '700');
        ctx.fillStyle = color || C.dim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, x + 10 * L.s, y + 11 * L.s);
    }
    function drawBottom() {
        const y = L.bpY, h = L.bpH, gap = 10;
        const total = W - 24 - gap * (L.portrait ? 1 : 2);
        const [lw, dw, ow] = (L.portrait ? [0.56, 0, 0.44] : [0.38, 0.33, 0.29]).map((f) => f * total);
        let x = 12;
        drawLog(x, y, lw, h);
        x += lw + gap;
        if (!L.portrait) { drawDispatch(x, y, dw, h); x += dw + gap; }
        drawOutput(x, y, ow, h);
        ctx.textBaseline = 'alphabetic';
    }
    function drawLog(x, y, w, h) {
        const s = L.s;
        panel(x, y, w, h, 'run log');
        const lh = 15 * s, top = y + 24 * s;
        const n = Math.floor((h - 28 * s) / lh);
        const lines = runLog.slice(-n);
        ctx.font = fontS(10);
        ctx.textBaseline = 'middle';
        const whoW = (L.portrait ? 90 : 150) * s;
        lines.forEach((l, i) => {
            const yy = top + i * lh + lh / 2;
            ctx.textAlign = 'left';
            ctx.fillStyle = C.faint;
            if (!L.portrait) ctx.fillText(l.ts, x + 10 * s, yy);
            const wx = x + (L.portrait ? 10 : 52) * s;
            ctx.fillStyle = l.color;
            ctx.fillText(fitText(l.who, whoW - 8 * s), wx, yy);
            ctx.fillStyle = C.text;
            ctx.fillText(fitText(l.text, x + w - 10 * s - wx - whoW), wx + whoW, yy);
        });
    }
    function drawDispatch(x, y, w, h) {
        const s = L.s;
        panel(x, y, w, h, 'dispatch · click a row to prioritise');
        ui.dispatchRows = [];
        if (!plan) return;
        const order = { active: 0, assigning: 1, pending: 2, done: 3 };
        const list = plan.tasks.map((task, i) => ({ task, i })).sort((a, b) => order[a.task.state] - order[b.task.state] || a.i - b.i);
        const lh = 15 * s, top = y + 24 * s;
        const n = Math.max(1, Math.floor((h - 30 * s) / lh));
        ctx.font = fontS(10);
        ctx.textBaseline = 'middle';
        list.slice(0, n).forEach(({ task, i }, r) => {
            const yy = top + r * lh + lh / 2;
            ui.dispatchRows.push({ task, x, y: yy - lh / 2, w, h: lh });
            if (hovered && hovered.kind === 'row' && hovered.obj === task) box(x + 2, yy - lh / 2, w - 4, lh, '#16202c');
            ctx.fillStyle = C.faint;
            ctx.textAlign = 'left';
            ctx.fillText(`#${i + 1}`, x + 10 * s, yy);
            ctx.fillStyle = task.state === 'pending' ? C.dim : C.text;
            ctx.fillText(fitText(task.key, w * 0.36), x + 36 * s, yy);
            const bx = x + w * 0.46, bw = w * 0.32, ticks = Math.floor(bw / (5 * s));
            for (let k = 0; k < ticks; k++) {
                ctx.fillStyle = k / ticks < task.progress ? (task.state === 'done' ? rgba(C.green, 0.7) : C.accent) : '#1a2430';
                ctx.fillRect(bx + k * 5 * s, yy - 3.5 * s, 3.2 * s, 7 * s);
            }
            const label = task.state === 'done' ? 'done' : task.state === 'active' ? (task.boost > 1.4 ? 'run ▲' : 'run') : task.phase === 4 && plan.gate !== 'open' ? 'gate' : 'queued';
            ctx.fillStyle = label === 'gate' ? C.amber : task.state === 'active' ? C.accent : task.state === 'done' ? C.green : C.dim;
            ctx.textAlign = 'right';
            ctx.fillText(label, x + w - 10 * s, yy);
        });
    }
    function drawOutput(x, y, w, h) {
        const s = L.s;
        const gate = plan && plan.gate === 'waiting';
        panel(x, y, w, h, gate ? 'output / human gate' : 'output / costs', gate ? C.amber : null);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = fontS(L.portrait ? 20 : 26, '700');
        ctx.fillStyle = C.text;
        ctx.fillText(money(plan ? plan.cost : 0), x + 10 * s, y + (L.portrait ? 48 : 56) * s);
        ctx.font = fontS(10);
        ctx.fillStyle = C.dim;
        const lines = [
            `this run · ${money(ratePerMin())}/min at this pace`,
            `session ${money(stats.spend)} · ${kfmt(stats.tokens)} tokens`,
            stats.lastShip ? `last shipped ${money(stats.lastShip.cost)} in ${fmtDur(stats.lastShip.took)}` : `month ${money(stats.monthBase + stats.spend, 0)} of ${money(stats.budget, 0)}`,
        ];
        lines.forEach((l, i) => ctx.fillText(fitText(l, w - 20 * s), x + 10 * s, y + (L.portrait ? 66 : 76) * s + i * 15 * s));
        ui.approve = null;
        if (gate) {
            const left = Math.max(0, 18 - (t - plan.gateAt));
            const bw = Math.min(w - 20 * s, 260 * s), bh = 24 * s;
            const bx = x + 10 * s, by = y + h - bh - 10 * s;
            const pulse = 0.6 + 0.4 * Math.sin(t * 4);
            box(bx, by, bw, bh, rgba(C.amber, 0.15 + 0.15 * pulse), C.amber);
            ctx.font = fontS(10.5, '700');
            ctx.fillStyle = C.amber;
            ctx.textBaseline = 'middle';
            ctx.fillText(fitText(`[ approve ship ]  auto in ${Math.ceil(left)}s`, bw - 12 * s), bx + 8 * s, by + bh / 2);
            ui.approve = { x: bx, y: by, w: bw, h: bh };
        }
    }

    // ---------------------------------------------------------------- model menu
    const menuEl = $('model-menu');
    function openModelMenu(a, sx, sy) {
        $('mm-title').textContent = `model for ${a.key} (${a.podId}, ${a.region}) · list prices per 1M tokens`;
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
            note.textContent = `${m.note} · ${m.gpus}× ${m.gpu} pod`;
            b.append(dot, name, note);
            b.addEventListener('click', () => { closeModelMenu(); switchModel(a, m.id); });
            list.append(b);
        }
        menuEl.hidden = false;
        const mw = menuEl.offsetWidth || 260, mh = menuEl.offsetHeight || 360;
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
    function dropSlot(wx, wy) {
        const col = clamp(Math.floor((wx - L.gridX) / L.colW), 0, NCOL - 1);
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
        if (from !== g.col) sys(`you moved ${a.key} to ${COLUMNS[g.col]}`, 'you');
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
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { cam.x -= e.deltaX || step; clampCam(); return; }
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
        if (!raw) { cmdInput.focus(); return; }
        log('you', C.amber, '$ ' + raw);
        const [cmd, ...rest] = raw.split(' ');
        const c = cmd.toLowerCase();
        if (c === 'help') { toggleHelp(true); return; }
        if (c === 'approve') { approve(true); return; }
        if (c === 'spawn') { spawnNode(); return; }
        if (c === 'pause') { setPaused(!paused); return; }
        if (c === 'clear') { runLog.length = 0; return; }
        if (c === 'model') {
            const want = (rest[0] || '').toLowerCase();
            const node = nodes.find((a) => a.key === want || a.name.toLowerCase() === want);
            const m = MODELS.find((x) => x.id === (rest[1] || '').toLowerCase());
            if (!node || !m) { sys(`usage: model <node> <${MODELS.map((x) => x.id).join('|')}>`); return; }
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

    // ---------------------------------------------------------------- header: graph stats, and the cost of the current run
    let headNext = 0;
    function updateHead(raw) {
        headNext -= raw;
        if (headNext > 0) return;
        headNext = 0.25;
        const el = $('graph-line');
        el.innerHTML = '';
        let parts = 0;
        const add = (k, v, cls) => {
            if (parts++) { const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '·'; el.append(sep); }
            if (k) el.append(k + ' ');
            const b = document.createElement('b');
            if (cls) b.className = cls;
            b.textContent = v;
            el.append(b);
        };
        const run = plan ? fmtDur((plan.doneAt || t) - plan.born) : '0:00';
        if (!L.portrait) {
            add('graph', 'hivemind-01');
            add('nodes', String(nodes.length + 1 + INPUTS.length));
            add('workers', String(nodes.length));
            add('orchestrator', modelById[hub.model].short);
            add('run ' + stats.runNo, run);
            add('', `${money(ratePerMin())}/min`, 'money');
        }
        const shipped = flashCost > 0 && stats.lastShip;
        const label = shipped ? `shipped · ${money(stats.lastShip.cost)}` : `run cost ${money(plan ? plan.cost : 0)}`;
        const b = document.createElement('span');
        b.className = 'run-cost' + (shipped ? ' flash' : '');
        b.textContent = label;
        el.append(b);
    }

    // ---------------------------------------------------------------- loop
    let last = performance.now();
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
        ? 'swipe empty space to see layers 3 and 4 · drag nodes to new slots · tap a model tag to switch'
        : 'hover a node to open it · drag nodes into new slots · click a model tag to switch it'), 5000);
    requestAnimationFrame(frame);
})();
