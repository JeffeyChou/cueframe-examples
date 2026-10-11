import { el, md, slide, type B, type SlideDef } from '../deck/deck.js'
import { bars, lines } from '../deck/charts.js'
import { C, MONO, TONE, type Tone } from '../deck/theme.js'

const S1 = '1 · Recap of Part 1'
const S2 = '2 · Why our own collectives'
const S3 = '3 · Architecture'
const S4 = '4 · Device API primer'
const S5 = '5 · The collectives'
const S6 = '6 · Synchronisation'
const S7 = '7 · Performance'
const S8 = '8 · Bugs and questions'
const S9 = '9 · Backup'

/** Two nodes of four ranks; `kinds[i]` colours rank i. */
function nodes(b: B, kinds: [string, Tone | 'self'][], caption: [string, Tone | 'self'][]): void {
  const wrap = el('div', { display: 'flex', flexDirection: 'column', gap: '18px' })
  const row = el('div', { display: 'flex', gap: '36px' }, undefined, wrap)
  for (let n = 0; n < 2; n++) {
    const box = el('div', { flex: '1', border: `2px dashed ${C.faint}`, borderRadius: '16px', padding: '16px 20px 20px' }, undefined, row)
    el('div', { font: `700 20px ${MONO}`, color: C.dim, marginBottom: '12px', letterSpacing: '0.08em' }, `NODE ${n}`, box)
    const g = el('div', { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }, undefined, box)
    for (let i = 0; i < 4; i++) {
      const [label, k] = kinds[n * 4 + i]!
      const t = k === 'self' ? { fg: C.panel, bg: C.ink } : TONE[k]
      el('div', { background: k === 'self' ? C.ink : t.bg, color: k === 'self' ? C.panel : t.fg, border: `2px solid ${k === 'self' ? C.ink : t.fg}`, borderRadius: '10px', padding: '12px 0', textAlign: 'center', font: `700 24px ${MONO}` }, label, g)
    }
  }
  const leg = el('div', { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '23px' }, undefined, wrap)
  for (const [t, k] of caption) {
    const c = k === 'self' ? C.ink : TONE[k].fg
    el('span', { color: c, fontWeight: '600' }, `■ ${md(t)}`, leg)
  }
  b.add(wrap)
}

export const slides: SlideDef[] = [
  slide({
    id: 'title', section: '', layout: 'title',
    build(b) {
      b.p('FINCCL · group meeting · Part 2', { size: 30, tone: 'fin' })
      b.p('Compressed collectives on the NCCL Device API', { size: 96 }).style.cssText += 'font-weight:700;letter-spacing:-0.025em;line-height:1.04'
      b.p('How the codec gets inside the collective without a CPU in the loop', { size: 40 }).style.color = C.dim
      b.add(document.createElement('div')).style.cssText = `height:6px;width:420px;background:${C.fin};margin:14px 0 22px`
      b.row((r) => {
        r.p('**Polaris**: 4 × A100-40GB per node on an NVLink mesh, 2 Slingshot-11 NICs per node.', { size: 28, flex: '1' })
        r.p('**Nothing in NCCL is modified**: a preload shim plus our own kernels on NCCL 2.31.2’s public Device API. Every arm links the same NCCL.', { size: 28, flex: '1' })
      }, { gap: 64 })
    },
  }),
  slide({
    id: 'agenda', section: 'Plan · 40 min', title: 'Today',
    build(b) {
      b.table(['#', 'Section', 'Min'], [
        ['1', 'Recap of Part 1 in three bullets', '2'],
        ['2', 'Why our own collectives, and why not NCCL’s internal primitives', '5'],
        ['3', 'Architecture: the shim and the traffic classes', '4'],
        ['4', 'Device API primer: the parts we use', '5'],
        ['5', 'The collectives, one pipeline each', '10'],
        ['6', 'Synchronisation design', '4'],
        ['7', 'Performance', '5'],
        ['8', 'Bugs and environment, and questions for NCCL', '5'],
        ['9', '<i>Backup: the autotuner</i>', '<i>if time</i>'],
      ], { size: 30, widths: ['90px', '', '140px'], num: [2] })
    },
  }),

  slide({
    id: 'takeaways', section: 'In one slide', title: 'Three points',
    build(b) {
      b.row((r) => {
        r.card((c) => {
          c.p('**No host in the loop.** Frame sizes travel in frame headers, arrivals are counted with GIN signals, decode-sum is one fused kernel.', { size: 28 })
          c.p('COCCL’s host-orchestrated route cost +1.1–1.3 ms per call with the same codec.', { size: 25 }).style.color = C.dim
        }, { flex: '1', title: '1 · Schedule', tone: 'fin' })
        r.card((c) => {
          c.p('**One-shot, not ring.** A lossy ring re-quantizes at every hop; ours quantizes each value once in ReduceScatter.', { size: 28 })
          c.p('Credits replace the example’s cross-node barriers.', { size: 25 }).style.color = C.dim
        }, { flex: '1', title: '2 · Algorithm', tone: 'sdp' })
        r.card((c) => {
          c.p('Grad RS **1.1–1.2 ms** vs SDP4Bit 2.09 and stock 12.6 (2 nodes). Training: ZGCM **−9%** vs SDP4Bit, OLMoE **−25 to −28%** vs stock.', { size: 28 })
          c.p('Open: proxy-mode GIN bandwidth and small-message latency.', { size: 25 }).style.color = C.dim
        }, { flex: '1', title: '3 · Results', tone: 'good' })
      }, { gap: 28 })
    },
  }),

  // 1 · Recap
  slide({
    id: 'recap', section: S1, title: 'Where Part 1 left us',
    build(b) {
      b.row((r) => {
        r.card((c) => c.p('**cuTZ**: a per-128-block step with a randomized Hadamard rotation, fixed rate (3, 4 or 6 bits per value), one kernel each for encode, decode and fused decode-add-encode (**DOC**).', { size: 28 }), { flex: '1', title: 'The codec', tone: 'fin' })
        r.card((c) => c.p('The inter-node **gradient ReduceScatter** (dense) and the MoE **expert AllToAll**.', { size: 28 }), { flex: '1', title: 'Two traffic classes matter' })
        r.card((c) => c.p('How does the codec get **inside the collective** without a CPU in the loop?', { size: 30 }), { flex: '1', title: 'Today’s question', tone: 'sdp' })
      }, { gap: 28 })
    },
  }),

  // 2 · Why our own collectives
  slide({
    id: 'three-designs', section: S2, title: 'Three designs',
    build(b) {
      b.p('Neither COCCL nor FINCCL modifies NCCL’s `Primitives<>`.', { size: 28 })
      b.table(['', 'NCCL’s own collectives<br><i>Primitives<>; used by neither</i>', 'COCCL<br><i>codec kernels around stock host-API collectives</i>', '<span style="color:#d9480f">FINCCL</span><br><i>codec kernels + own Device-API exchange kernels</i>'], [
        ['Where the code lives', 'Inside libnccl: `Primitives<>`, ring / tree pipelines over channels', 'A fork that adds entry points. compress → `ncclAllToAll` / `ncclAllGather` on bytes → decompress / reduce. **Host-orchestrated**', 'Outside NCCL, on the public Device API: device-initiated **GIN puts** and **LSA stores**'],
        ['Variable-size frames', 'n/a: count × datatype is known', 'D2H metadata copy + **`cudaStreamSynchronize` per call**', 'Exchange kernel reads each frame’s length from its header **on the device**'],
        ['Reducing compressed data', '`reduceCopy` at every step, on raw data', 'Decode all P inputs to scratch, then a separate reduce; two-shot RS = AllToAll, quantizes twice', '**Fused decode-sum** (and DOC) in one kernel'],
        ['Coupling to a release', 'n/a', 'Medium: a fork of 2.21.5; porting to 2.31.2 hit 2 API breaks', 'Low: public API only'],
      ], { size: 21, widths: ['230px', '', '', ''], num: [] })
    },
  }),
  slide({
    id: 'coccl-measured', section: S2, title: 'How COCCL does it, measured',
    steps: 1,
    build(b) {
      b.p('We first ran our codec as a COCCL plugin. For a variable-size codec, COCCL’s schedule is:', { size: 27 })
      b.flow([
        { t: 'compress', sub: 'codec kernel', tone: 'sdp' },
        { t: 'read frame sizes', sub: 'D2H copy + `cudaStreamSynchronize` every call', tone: 'bad' },
        { t: 'stock NCCL', sub: '`ncclAllToAll` / grouped send-recv on `ncclUint8`', tone: 'sdp' },
        { t: 'decode × P', sub: 'into scratch P × the output size', tone: 'bad' },
        { t: 'reduce', sub: 'a separate kernel', tone: 'sdp' },
      ], { size: 23 })
      b.flow([
        { t: 'encode', sub: 'one launch, all destinations', tone: 'fin' },
        { t: 'exchange kernel', sub: 'GIN puts + LSA stores, sizes in frame headers', tone: 'fin' },
        { t: 'fused decode-sum', sub: 'one kernel, no scratch', tone: 'fin' },
      ], { size: 23 })
      b.chips([['COCCL path', 'sdp'], ['FINCCL path', 'fin'], ['where the time goes', 'bad']])
      b.step()
      b.row((r) => {
        r.stat('+1.1–1.3 ms', 'per 4-rank collective vs SDP4Bit at equal error, although our kernels alone were as fast', { flex: '1', size: 72, tone: 'bad' })
        r.callout('The codec was not the problem; the schedule around it was. So we write the schedule ourselves.', { flex: '1.3', size: 30 })
      }, { align: 'center' })
    },
  }),
  slide({
    id: 'one-shot', section: S2, title: 'Why we do not write NCCL-style primitives either',
    build(b) {
      b.row((r) => {
        r.col((c) => {
          c.p('NCCL primitives: ring / tree pipelines over a slot FIFO with head/tail flags, a `reduceCopy` at every hop. **A lossy ring requantizes at every hop.**', { size: 27 })
          c.p('Per-block-absmax relL2 on real operands', { size: 23 }).style.color = C.dim
          c.add(bars({
            width: 760, labelW: 160, max: 0.022, barH: 40, rows: [
              { label: '2 ranks', bars: [{ v: 0.008, tone: 'stock', text: '0.0080' }] },
              { label: '16 ranks', bars: [{ v: 0.0189, tone: 'bad', text: '0.0189' }] },
            ],
          }))
          c.p('Our integer-lattice ring prototype: bit-exact on 4 A100s, but moved **1.3–3.3×** the bytes of a one-shot exchange.', { size: 26 })
        }, { flex: '1' })
        r.card((c) => {
          c.p('Each rank encodes **one frame per destination**, puts it directly; the receiver does **one fused decode-sum**.', { size: 27 })
          c.p('Each value is quantized **once** (ReduceScatter) or twice (AllReduce = RS + AG).', { size: 27 })
          c.p('Multi-rank nodes borrow NCCL’s *idea* of `rsAlgoHier`: node-local sum over NVLink, then a rail exchange.', { size: 25 })
          c.p('The exchange kernel starts from NCCL’s example `06_device_api/03_alltoall_hybrid`, with new synchronisation (§6).', { size: 25 })
        }, { flex: '1', title: 'Our collectives are one-shot', tone: 'fin' })
      }, { gap: 40 })
    },
  }),

  // 3 · Architecture
  slide({
    id: 'shim', section: S3, title: 'The shim: a preload between the tap and NCCL',
    build(b) {
      b.flow([
        { t: 'Megatron', sub: 'PyTorch NCCL process groups' },
        { t: 'class tag', sub: 'training side marks each AllToAll’s class' },
        { t: 'FINCCL shim', sub: 'LD_PRELOAD library', tone: 'fin' },
        { t: 'NCCL 2.31.2', sub: 'standard build', tone: 'stock' },
      ], { size: 28 })
      b.row((r) => {
        r.card((c) => {
          c.p('`ncclReduceScatter` · `ncclAllGather` · `ncclSend` / `ncclRecv` · `ncclGroupStart/End` · `ncclCommDestroy/Abort`', { size: 26 })
          c.p('Everything it does not take is forwarded unchanged via `dlsym(RTLD_NEXT, …)`.', { size: 25 }).style.color = C.dim
        }, { flex: '1.3', title: 'Exported entry points' })
        r.card((c) => {
          c.p('A call is taken **only on a communicator that spans nodes** (more than one LSA team).', { size: 27 })
          c.p('TP collectives on NVLink stay on NCCL.', { size: 25 }).style.color = C.dim
        }, { flex: '1', title: 'Rule', tone: 'fin' })
      }, { gap: 28 })
    },
  }),
  slide({
    id: 'classes', section: S3, title: 'Traffic classes, one codec setting each',
    build(b) {
      b.table(['Class', 'NCCL call', 'What', 'Final setting'], [
        ['**grad**', 'ReduceScatter, fp32', 'DP / expert-DP gradient buckets', 'ZGCM q=3; OLMoE expert grads q=7'],
        ['**param**', 'AllGather, bf16', 'Sharded optimizer’s parameter AllGather (weight differences)', 'ZGCM 0.6 (relative step); OLMoE on NCCL'],
        ['**act**', 'Send/Recv group', 'MoE forward dispatch and combine', 'q=31'],
        ['**actgrad**', 'Send/Recv group', 'Backward of the combine, into the experts', 'q=7'],
        ['**actret**', 'Send/Recv group', 'Backward of the dispatch, return path to router and attention', 'q=7'],
        ['a2a', 'Send/Recv group', 'An untagged AllToAll (or validation)', 'NCCL'],
      ], { size: 26, widths: ['180px', '260px', '', '420px'], num: [] })
      b.p('AllReduce is **not** replaced in training.', { size: 26 })
    },
  }),
  slide({
    id: 'a2a-capture', section: S3, title: 'An AllToAll arrives as grouped Send/Recv',
    build(b) {
      b.row((r) => {
        r.card((c) => {
          c.p('PyTorch’s `all_to_all_single` reaches NCCL as grouped `ncclSend` / `ncclRecv`, not `ncclAllToAll`.', { size: 27 })
          c.p('The shim buffers a group’s sends and receives. At the outermost `ncclGroupEnd` it runs a complete pattern as FINCCL’s **AllToAllv**:', { size: 27 })
          c.bullets(['at most one send and one receive per peer', 'one datatype, one stream'], { size: 25 })
          c.p('Anything else is replayed to NCCL unchanged.', { size: 25 }).style.color = C.dim
        }, { flex: '1.2', title: 'Group capture' })
        r.card((c) => {
          c.p('The class of an AllToAll comes from a **tag the training side writes to shared memory**.', { size: 27 })
          c.p('Every member reads the same tag, so every member classifies the call the same way.', { size: 27 })
          c.callout('Members that decide differently **deadlock**.', { tone: 'bad', size: 27 })
        }, { flex: '1', title: 'Symmetric classification', tone: 'fin' })
      }, { gap: 32 })
    },
  }),

  // 4 · Device API primer
  slide({
    id: 'setup', section: S4, title: 'Setup, once per communicator',
    build(b) {
      b.p('1 · `ncclMemAlloc` one buffer, then `ncclCommWindowRegister(…, NCCL_WIN_COLL_SYMMETRIC)`: a **symmetric window**, the same offsets on every rank', { size: 27 })
      b.segments([
        { label: 'send slots', sub: 'one per peer', flex: 3, tone: 'fin' },
        { label: 'receive slots', sub: 'one per peer', flex: 3, tone: 'sdp' },
        { label: 'signals', sub: '4 KiB', flex: 1, tone: 'warn' },
        { label: 'raw-partial input', sub: 'hierarchical RS', flex: 2, tone: 'stock' },
      ], { height: 110 })
      b.p('Slots are sized by the codec’s maximum frame. **One window per collective**: every window costs NIC memory registrations (§8).', { size: 24 }).style.color = C.dim
      b.row((r) => {
        r.col((c) => {
          c.p('2 · `ncclCommQueryProperties` → `nLsaTeams`, hence ranks per node', { size: 26 })
          c.p('3 · `ncclDevCommCreate`, after a window is registered and **outside an NCCL group**', { size: 26 })
        }, { flex: '1' })
        r.table(['Requirement', 'Value', 'Why'], [
          ['`barrierCount`', '128', 'one world barrier per exchange CTA'],
          ['`lsaBarrierCount`', '216', 'one per CTA of the node-local sum'],
          ['`ginSignalCount`', '17', '16 per-CTA + 1 credit signal'],
          ['`ginContextCount`', '4', 'one context: only 5.2 GB/s in proxy mode'],
          ['`ginConnectionType`', '`FULL`', 'every rank reaches every rank'],
        ], { size: 22, flex: '1.4', num: [1] })
      }, { gap: 40 })
    },
  }),
  slide({
    id: 'device-api', section: S4, title: 'What a kernel can call',
    build(b) {
      b.table(['Device API', 'Meaning', 'Where we use it'], [
        ['`ncclTeamWorld(dev)`, `ncclTeamLsa(dev)`', 'Rank and size in the world, and in this node’s LSA team', 'Every kernel'],
        ['`ncclGetLsaPointer(win, off, lsaPeer)`', 'A plain pointer into a node peer’s window over NVLink', 'Raw stores to node peers; node-local sums'],
        ['`ncclGetLocalPointer(win, off)`', 'Our own window', 'Reading our frame headers'],
        ['`ncclGin{dev, ctx}.put(…, signalAction)`', 'One-sided RDMA write from the GPU, with a signal update at the target', 'Off-node frames'],
        ['`WeakSignalInc` / `WeakSignalAdd` / `WeakVASignalAdd`', 'Increment a signal, add to it, or add to a signal word inside a window', 'Arrival counting'],
        ['`gin.waitSignal`, `gin.readSignal`', 'Wait until a signal reaches a value', 'Receivers'],
        ['`gin.flush`', 'Local completion of our puts (source reusable)', 'End of exchange'],
        ['`gin.signal(team, peer, …)`', 'Signal only, no data', 'Credits'],
        ['`ncclLsaBarrierSession`, `ncclBarrierSession`', 'Node-only barrier, or world barrier (GIN + LSA)', 'Slot reuse and visibility'],
      ], { size: 21, widths: ['620px', '', '400px'], num: [] })
      b.callout('On Polaris GIN runs in **proxy mode** (`ginSupport=proxy`): the GPU posts a descriptor; an NCCL CPU thread issues the RDMA write through aws-ofi-nccl and libfabric cxi.', { size: 24, tone: 'warn' })
    },
  }),

  // 5 · The collectives
  slide({
    id: 'exchange', section: S5, title: 'The exchange kernel, the core of everything',
    build(b) {
      b.p('One launch, 16 CTAs × 512 threads; codec kernels run before and after it. The call never waits on the host.', { size: 23 }).style.color = C.dim
      b.flow([
        { t: '1 · Entry sync', sub: 'LSA barrier; wait for **credits**' },
        { t: '2 · Puts', sub: 'off-node frames, ≤ 32 pieces over GIN contexts', tone: 'fin' },
        { t: '3 · LSA stores', sub: 'raw 16-byte stores to node peers', tone: 'sdp' },
        { t: '4 · Wait', sub: 'signal reaches expected total' },
        { t: '5 · Flush', sub: 'our puts complete' },
        { t: '6 · Exit sync', sub: 'LSA barrier: node stores visible' },
      ], { size: 21, arrow: '›' })
      b.bullets([
        'Frame length is read **from the frame header on the device**: no host size exchange',
        'Node peers get raw values: NVLink is fast enough that a codec does not pay',
        'Every frame adds exactly `pieces` to the receiver’s signal whatever its size, so the receiver knows the expected total without knowing any sizes. The host keeps a running total; **signals are never reset**',
        'Then one fused kernel decode-sums the received frames, and a tiny kernel returns one credit to every off-node peer we received from',
      ], { size: 25 })
    },
  }),
  slide({
    id: 'rs-flat', section: S5, title: 'ReduceScatter, flat: one rank per node',
    build(b) {
      b.p('ZGCM data parallel, OLMoE expert data parallel', { size: 24 }).style.color = C.dim
      b.flow([
        { t: 'encode', sub: 'one frame per off-node destination, one launch', tone: 'fin' },
        { t: 'exchange', sub: 'the kernel on the previous slide' },
        { t: 'fused decode-sum', sub: 'all received frames into the output, one kernel', tone: 'fin' },
      ], { size: 27 })
      b.callout('**In place**: Megatron’s distributed optimizer calls it with the output already holding this rank’s contribution, so this rank’s own frame is neither stored nor decoded.', { size: 27, tone: 'ink' })
    },
  }),
  slide({
    id: 'rs-hier', section: S5, title: 'ReduceScatter, hierarchical: several ranks per node',
    build(b) {
      b.chips([['benchmarked', 'good'], ['not used in training', 'warn']])
      b.flow([
        { t: 'Stage 1 · node-local sum', sub: 'each rank sums, over NVLink, its node peers’ inputs for its rail peers; computes the encoder’s statistic on the fly', tone: 'sdp' },
        { t: 'Stage 2 · encode + rail exchange', sub: 'encode only the node partials, put them to rail peers only', tone: 'fin' },
      ], { size: 25 })
      b.row((r) => {
        r.col((c) => {
          c.bullets([
            'Each value is quantized **once**, as a node partial',
            'Optional compressed on-node stage: encode finely, read peers’ frames by LSA pointer, one DOC per destination node. Spends ≈ 0.3 ms of codec work to avoid reading ≈ 140 MB of raw fp32 over NVLink',
            'Training left OLMoE’s dense DP RS on NCCL: overlapped with backward (exposure ≈ 0.1–0.2); the NIC budget is better spent on expert gradients',
          ], { size: 25 })
        }, { flex: '1.3' })
        r.col((c) => {
          c.p('OLMoE DP=32 vs SDP4Bit', { size: 23 }).style.color = C.dim
          c.stat('7.6% ahead', '1.667 vs 1.804 ms with the compressed on-node stage; 16% behind with the raw one', { size: 72 })
        }, { flex: '1' })
      }, { gap: 36 })
    },
  }),
  slide({
    id: 'a2av', section: S5, title: 'AllToAllv for MoE expert parallelism',
    build(b) {
      b.row((r) => {
        r.col((c) => {
          nodes(c, [['r0', 'self'], ['r1', 'sdp'], ['r2', 'sdp'], ['r3', 'sdp'], ['r4', 'fin'], ['r5', 'fin'], ['r6', 'fin'], ['r7', 'fin']],
            [['this rank', 'self'], ['3 node peers: raw LSA stores', 'sdp'], ['4 off-node peers: cuTZ frames by GIN', 'fin']])
        }, { flex: '1.1' })
        r.col((c) => {
          c.bullets([
            'EP8 spans 2 nodes',
            '**No size agreement**: each rank packs frames to its own epc (largest send count, rounded up to 2048); headers carry the block count',
            '**Sparse**: senders skip zero-count peers; receivers wait only for peers that send them data (2-of-8 split 0.404 → 0.257 ms)',
            'Step computed on every call: send buffers are reused across layers',
          ], { size: 25 })
        }, { flex: '1' })
      }, { gap: 40, align: 'center' })
    },
  }),
  slide({
    id: 'ag-delta', section: S5, title: 'Parameter AllGather by weight differences',
    build(b) {
      b.flow([
        { t: 'previous params', sub: 'every rank already holds them' },
        { t: 'encode Δ', sub: 'only the change of our own segment', tone: 'fin' },
        { t: 'gather exchange', sub: 'every peer off-node' },
        { t: 'add decoded Δ', sub: 'every rank, **owner included**', tone: 'fin' },
      ], { size: 26 })
      b.bullets([
        'Everyone adds what the frame **decodes to**, so all ranks hold bit-identical parameters and the owner knows what the others hold',
        'The next delta is taken against that: **error feedback by construction**',
        'In-run check relL2 **1.4e-6**. Only valid when every peer is off-node',
        '16 nodes, ZGCM: **110.5 ms** vs SDP4Bit 558 ms and stock 1280 ms',
      ], { size: 28 })
    },
  }),
  slide({
    id: 'allreduce', section: S5, title: 'AllReduce = compressed RS + DOC + compressed AG',
    build(b) {
      b.chips([['benchmark only', 'warn']])
      b.flow([
        { t: 'RS exchange', sub: 'compressed frames' },
        { t: 'one DOC', sub: 'decode-sum the RS frames, encode the result as the AG frame', tone: 'fin' },
        { t: 'AG exchange + decode', sub: 'compressed frames' },
      ], { size: 27 })
      b.p('The shard keeps exactly what others will decode, so every rank ends with identical values.', { size: 28 })
      b.p('Versus THCCL at matched error', { size: 23 }).style.color = C.dim
      b.add(bars({
        width: 1500, labelW: 420, max: 4.5, barH: 40, rows: [
          { label: 'ZGCM, 2 nodes', bars: [{ v: 1.2, tone: 'fin', text: '1.1–1.2×' }] },
          { label: 'OLMoE, 8 nodes / 32 ranks', bars: [{ v: 3.8, tone: 'fin', text: '3.7–3.8×' }] },
        ],
      }))
    },
  }),

  // 6 · Synchronisation
  slide({
    id: 'sync', section: S6, title: 'From the example’s barriers to credits',
    steps: 1,
    build(b) {
      b.table(['Mechanism', 'What it solves', 'Measured'], [
        ['Example pattern: world barrier at entry and exit', 'Slot reuse and visibility, but two cross-node round trips per call', 'Round 0'],
        ['**Credit mode** (default)', 'Receiver signals a credit after decoding; a sender waits for credits of calls 0..n−1 before writing call n. No cross-node barrier', 'Part of 2.50 → **1.10–1.22 ms** (ZGCM RS, 2 nodes)'],
        ['32 pieces over up to 4 GIN contexts', 'One context is limited to 5.2 GB/s in proxy mode', '8 pieces 2.3 ms → 32 pieces **1.24 ms**'],
        ['VA signal (one signal word in the window)', 'Each frame adds `pieces` whatever its size; small frames go as one put', 'Small-call floor 0.15–0.34 → ≈ **0.1 ms**'],
        ['Double-buffered slots', 'Avoids credits by alternating slot sets', '<span style="color:#c92a2a;font-weight:700">Rejected</span>: +50 µs on small calls'],
        ['Call ordering across streams', 'Megatron issues AllToAlls from two streams; each call waits on the previous call’s event', 'Correctness'],
      ], { size: 22, widths: ['440px', '', '460px'], hi: [1], num: [] })
      b.step()
      b.callout('Credits are NCCL’s own head/tail flow control, moved to the granularity of a whole call. They also bound run-ahead to one call, which is why signals never need a reset.', { size: 28 })
    },
  }),

  // 7 · Performance
  slide({
    id: 'micro', section: S7, title: 'Collective microbenchmarks, 2 nodes',
    build(b) {
      b.row((r) => {
        r.col((c) => {
          c.add(bars({
            width: 980, labelW: 330, max: 13, barH: 26, gap: 26, font: 23, rows: [
              { label: 'ZGCM grad RS, P=2, 185 MiB', bars: [{ v: 12.6, tone: 'stock', text: '12.6 ms' }, { v: 2.09, tone: 'sdp', text: '2.09' }, { v: 1.22, tone: 'fin', text: '1.10–1.22' }] },
              { label: 'OLMoE grad RS, P=8, 178 MiB', bars: [{ v: 4.93, tone: 'stock', text: '4.93 ms' }, { v: 1.31, tone: 'sdp', text: '1.31' }, { v: 0.92, tone: 'fin', text: '0.92' }] },
              { label: 'EP AllToAll, 8 ranks, 112 MiB', bars: [{ v: 6.6, tone: 'stock', text: '6.6 ms' }, { v: 3.0, tone: 'sdp', text: '3.0' }, { v: 1.94, tone: 'fin', text: '1.94' }] },
            ],
          }))
          c.chips([['stock', 'stock'], ['SDP4Bit', 'sdp'], ['FINCCL', 'fin']])
        }, { flex: '1.4' })
        r.col((c) => {
          c.stat('≈ 10 µs', 'GIN one-way latency, in-kernel, vs 34 µs for host-launched send/recv', { size: 64, tone: 'good' })
          c.callout('**Below 0.5 MiB per rank** the AllToAll is still slower than stock: 0.10 vs 0.066 ms at 128 KiB.', { tone: 'bad', size: 26 })
        }, { flex: '1' })
      }, { gap: 40 })
    },
  }),
  slide({
    id: 'scaling', section: S7, title: 'Scaling',
    build(b) {
      b.row((r) => {
        r.col((c) => {
          c.p('ZGCM gradient ReduceScatter, ms (log scale)', { size: 24 }).style.color = C.dim
          c.add(lines({
            width: 1000, height: 520, xs: ['2', '4', '8', '16'], ymin: 30, ymax: 4000, log: true, yticks: [30, 100, 300, 1000, 3000],
            xlabel: 'nodes',
            series: [
              { name: 'stock', tone: 'stock', ys: [487, 725, 892, 2984] },
              { name: 'SDP4Bit', tone: 'sdp', ys: [101, null, 177, 180] },
              { name: 'FINCCL q=3', tone: 'fin', ys: [49.5, 81.4, 107.9, 113] },
              { name: 'FINCCL param AG', tone: 'fin', ys: [53.6, 77.4, 104.4, 110.5], dash: true },
            ],
          }))
        }, { flex: '1.6' })
        r.col((c) => {
          c.card((k) => {
            k.table(['Nodes', 'FINCCL', 'stock'], [['2', '2.80', '6.62'], ['8', '2.84', '6.74'], ['16', '2.86', '7.05']], { size: 25 })
          }, { title: 'OLMoE EP AllToAll, ms', tone: 'fin' })
          c.p('Stock at 16 nodes: 2984 ± 729 ms. Missing 4-node point: a launcher hang.', { size: 23 }).style.color = C.dim
        }, { flex: '1' })
      }, { gap: 36 })
    },
  }),
  slide({
    id: 'e2e', section: S7, title: 'End to end',
    build(b) {
      b.table(['Model', 'Nodes', 'Step time', 'Loss'], [
        ['ZGCM vs SDP4Bit', '8', '3.92 s vs 4.30 s (**−8.9%**)', 'at SDP4Bit’s loss'],
        ['ZGCM vs SDP4Bit', '16', '4.03–4.07 s vs 4.48 s (**−9.2 to −9.9%**); stock 7.21 s', 'validation +0.06% over 800 it'],
        ['OLMoE vs stock', '8', '3.36 s vs 4.51 s (**−25.5%**)', 'validation within +0.03%'],
        ['OLMoE vs stock', '16', 'about **−27.5%**', 'validation mean −0.017% over 3000 it'],
      ], { size: 26, num: [1], widths: ['260px', '120px', '', '420px'] })
      b.row((r) => {
        r.callout('OLMoE is compared with stock only: COCCL-SDP4Bit targets dense models. On OLMoE at 2 nodes it took **84 s** per step vs stock’s 30.8 s, loss +6% at it 1.', { tone: 'sdp', size: 24, flex: '1' })
        r.callout('COCCL-SDP4Bit **hangs** in Megatron’s overlapped, bucketed gradient RS at 8 nodes, so ZGCM comparisons run with overlaps off. FINCCL runs overlapped.', { tone: 'warn', size: 24, flex: '1' })
      }, { gap: 28 })
    },
  }),

  // 8 · Bugs and questions
  slide({
    id: 'gin-slingshot', section: S8, title: 'Making GIN work on Slingshot',
    build(b) {
      b.table(['Symptom', 'Cause', 'Fix'], [
        ['No GIN: `deviceApiSupport no`', 'Site aws-ofi-nccl 1.9.1 has no GIN exports', 'aws-ofi-nccl **1.21**'],
        ['`fi_getinfo` “No data available”', 'GIN `reg_mr` did not request `FI_MR_ENDPOINT`', 'Plugin patch'],
        ['“Provider does not support FI_RX_CQ_DATA”', 'GIN expects write completions to consume posted receives; cxi delivers them without one', 'Patch: route those completions by immediate data'],
        ['Every `fi_writedata` → `-FI_ENOSYS`', 'Site libfabric 2.3.1 cxi lacks writedata', 'Self-built libfabric **2.7.0**'],
        ['“Failed to find rank”', 'cxi reports no source address', 'Patch: sender rank in-band in header and CQ-data bits'],
      ], { size: 23, num: [], widths: ['480px', '', '520px'] })
      b.callout('All fixes outside NCCL. Bit-exact at 2, 8 and 32 ranks.', { tone: 'good', size: 26 })
    },
  }),
  slide({
    id: 'train-bugs', section: S8, title: 'Problems found in training',
    build(b) {
      b.table(['Symptom', 'Cause', 'Status'], [
        ['Collectives merely existing cost **8.9–9.4%** of an OLMoE step', 'GIN progress threads busy-spin on the GPU-local CPUs', 'Workaround: `SCHED_IDLE` + interposed `sched_yield` that naps when FINCCL is idle'],
        ['`fi_mr_enable rc=-28`, devcomm setup fails, hang', 'A destroyed devcomm does not release endpoints / MRs; too many windows per rank', 'Workaround: create once at final size, one window per collective, ≤ 2 collectives per rank'],
        ['Same rc=-28 when creating late', 'Symmetric window registration triggers an unused host-RMA GIN connect', '<span style="color:#2b8a3e;font-weight:700">Fixed</span>: `NCCL_RMA_DISABLE=1` at load'],
        ['Two GIN proxy threads break window registration with two collectives', 'Not determined', 'Training uses one thread'],
        ['Devcomm setup inside a group fails', 'API constraint', 'Shim closes the group, sets up, reopens it, on every member'],
        ['Odd per-rank count takes the slow path (8.6 vs 5.4 ms)', 'Alignment', 'Shim takes only 16-byte-multiple shares'],
      ], { size: 21, num: [], widths: ['500px', '', '560px'] })
    },
  }),
  slide({
    id: 'nccl-questions', section: S8, title: 'Where NCCL could help',
    build(b) {
      b.table(['Question', 'What it would unblock'], [
        ['**Non-proxy GIN on Slingshot / cxi?** Proxy GIN moves 5.2 GB/s per context vs 8.2 GB/s for send/recv on the same link. What would a GPU-direct path need from the provider?', 'Fewer contexts and pieces; lower per-call cost; the remaining NIC bandwidth'],
        ['**Small messages.** Below 0.5 MiB per rank we are slower than stock (0.10 vs 0.066 ms at 128 KiB). Is there a lower-latency pattern than put-with-signal plus flush?', 'Compressing the many small MoE calls'],
        ['**Teardown.** Is it expected that `ncclDevCommDestroy` keeps its endpoints and memory registrations?', 'Creating collectives on demand instead of once at a fixed size'],
        ['**Idle progress threads.** Is there a supported way to keep GIN progress threads from spinning in a host-paced job?', 'Dropping our `sched_yield` interposer'],
        ['**RMA switch.** Is `NCCL_RMA_DISABLE=1` the intended way to stop symmetric window registration from opening a host-RMA connection?', 'Confidence that the workaround is stable across releases'],
        ['**Upstreaming.** Should the cxi routing patch (completions without posted receives, in-band source rank) go to aws-ofi-nccl?', 'GIN on Slingshot without a private plugin build'],
      ], { size: 22, widths: ['', '520px'], num: [] })
    },
  }),

  // 9 · Backup
  slide({
    id: 'autotuner', section: S9, title: 'Backup: the autotuner',
    build(b) {
      b.p('Decides, inside the training job, which call sites go to FINCCL and at which setting. A site = (communicator, class, size bin).', { size: 26 })
      b.flow([
        { t: 'warmup' },
        { t: 'observe', sub: 'NCCL time per call' },
        { t: 'expose', sub: 'inject a delay; exposure = step increase / delay' },
        { t: 'probe', sub: 'cycle NCCL and menu settings with exact checks', tone: 'fin' },
        { t: 'verify', sub: 'tuned vs NCCL iterations alternate' },
        { t: 'frozen', sub: 'cached' },
      ], { size: 22, arrow: '›' })
      b.p('Every decision is AllReduced over the communicator, so members never split.', { size: 25 }).style.color = C.dim
      b.row((r) => {
        r.card((c) => c.bullets(['OLMoE 3213 vs 3215 ms (8 nodes)', 'OLMoE 1931 vs 1925 ms (16 nodes)', 'ZGCM 4116 vs 4116 ms (16 nodes)'], { size: 25 }), { flex: '1', title: 'Re-derives the hand settings' })
        r.card((c) => c.bullets(['Qwen3-8B **−11.9%** (8 nodes), **−23.9%** (16 nodes)', 'OLMoE EP16 **−27.5%**; EP32 **−31.3%**', 'Mixtral-style 8× top-2 −3.8 to −6.0%'], { size: 25 }), { flex: '1.2', title: 'New workloads, at stock’s validation loss', tone: 'fin' })
      }, { gap: 28 })
    },
  }),
  slide({
    id: 'end', section: '', layout: 'title',
    build(b) {
      b.p('Questions', { size: 112 }).style.cssText += 'font-weight:700;letter-spacing:-0.025em'
      b.p('Companion: “FINCCL collectives: design notes and Q&A prep”', { size: 36 }).style.color = C.dim
      b.add(document.createElement('div')).style.cssText = `height:6px;width:420px;background:${C.fin};margin-top:20px`
    },
  }),
]
