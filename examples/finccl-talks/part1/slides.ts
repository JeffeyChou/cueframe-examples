import { slide, type B, type SlideDef } from '../deck/deck.js'
import { bars, levels, lines } from '../deck/charts.js'
import { C, MONO } from '../deck/theme.js'

const S0 = '0 · Recap'
const S1 = '1 · The codec in real training'
const S2 = '2 · Two failures'
const S3 = '3 · What the literature predicts'
const S4 = '4 · Diagnosis'
const S5 = '5 · cuTZ iterations'
const S6 = '6 · What q means'
const S7 = '7 · Final cuTZ'
const S8 = '8 · Lessons and open questions'
const BK = 'Backup'

/** Numbered list with large orange numerals. */
function numbered(b: B, items: string[], size = 26): void {
  items.forEach((t, i) => b.row((r) => {
    r.p(String(i + 1), { size: size + 12, width: '56px' }).style.cssText += `font-family:${MONO};font-weight:700;color:${C.fin};flex:none`
    r.p(t, { size, flex: '1' })
  }, { gap: 14 }))
}

export const slides: SlideDef[] = [
  slide({
    id: 'title', section: '', layout: 'title',
    build(b) {
      b.p('FINCCL · group meeting · Part 1', { size: 30, tone: 'fin' })
      b.p('The cuTZ compressor', { size: 112 }).style.cssText += 'font-weight:700;letter-spacing:-0.025em;line-height:1.02'
      b.p('How much error training tolerates, and how that changed the codec', { size: 42 }).style.color = C.dim
      b.add(document.createElement('div')).style.cssText = `height:6px;width:420px;background:${C.fin};margin:18px 0 26px`
      b.row((r) => {
        r.p('**Setup**: Polaris, 4 × A100 per node, Slingshot-11. A dense model (ZGCM-1-7B) and a MoE model (OLMoE-1B-7B) in Megatron-LM.', { size: 28, flex: '1' })
        r.p('**Baseline**: SDP4Bit, the codec of COCCL, the state-of-the-art compressed-collective library.', { size: 28, flex: '1' })
      }, { gap: 64 })
    },
  }),
  slide({
    id: 'agenda', section: 'Plan · 60 min', title: 'Today',
    build(b) {
      b.table(['#', 'Section', 'Min'], [
        ['0', 'Recap of the previous seminar', '5'],
        ['1', 'The error-bounded codec in real training', '7'],
        ['2', 'Two failures, and the fixes that did not work', '6'],
        ['3', 'What the literature predicts, and what reproduced', '7'],
        ['4', 'Diagnosis: group error and persistence', '8'],
        ['5', 'cuTZ iterations v1 to v4', '9'],
        ['6', 'What q means', '5'],
        ['7', 'Final cuTZ: kernels and training', '7'],
        ['8', 'Lessons for compressor design, and open questions', '6'],
      ], { size: 30, widths: ['90px', '', '120px'] })
    },
  }),
  slide({
    id: 'takeaways', section: 'In one slide', title: 'Three findings',
    build(b) {
      b.row((r) => {
        r.card((c) => {
          c.p('An absolute error bound per message is the **wrong target** for training.', { size: 30 })
          c.p('At the same relative L2 as SDP4Bit it did **20×** the loss damage, and made the MoE model diverge.', { size: 26 }).style.color = C.dim
        }, { flex: '1', title: '1 · The bound', tone: 'bad' })
        r.card((c) => {
          c.p('Loss follows the error **per small group** and how much it **repeats across calls**.', { size: 30 })
          c.p('Group error ranks the loss (Spearman 0.98); global relL2 does not (0.50).', { size: 26 }).style.color = C.dim
        }, { flex: '1', title: '2 · The metric', tone: 'warn' })
        r.card((c) => {
          c.p('**cuTZ**: block-relative step, per-call random rotation, fixed rate.', { size: 30 })
          c.p('ZGCM **−8.9%** step vs SDP4Bit at its loss; OLMoE **−25 to −28%** vs stock at stock’s loss.', { size: 26 }).style.color = C.dim
        }, { flex: '1', title: '3 · The codec', tone: 'fin' })
      }, { gap: 28 })
    },
  }),

  // 0 · Recap
  slide({
    id: 'recap-problem', section: S0, title: 'Communication is half the step, and almost none of it is hidden',
    build(b) {
      b.p('32 × A100, two production-shaped training jobs.').style.color = C.dim
      b.row((r) => {
        r.stat('46–70%', 'of every step runs a communication kernel', { flex: '1', size: 96 })
        r.stat('0%', 'overlap on the dense model', { flex: '1', size: 96, tone: 'bad' })
        r.stat('3–4%', 'overlap on the MoE model', { flex: '1', size: 96, tone: 'bad' })
      })
      b.h('Targets')
      b.bullets([
        'Inter-node **fp32 gradient ReduceScatter** (dense)',
        'MoE **expert AllToAll**',
        'Not TP on NVLink: no codec pays at NVLink bandwidth',
      ])
    },
  }),
  slide({
    id: 'recap-corpus', section: S0, title: 'A payload corpus drawn from real training',
    build(b) {
      b.row((r) => {
        r.stat('10,816', 'captured operands', { flex: '1' })
        r.stat('492.6 GiB', 'of payload', { flex: '1' })
        r.card((c) => {
          c.p('**ZGCM-1-7B**, dense, TP4 × DP8', { size: 28 })
          c.p('**OLMoE-1B-7B**, MoE, EP8', { size: 28 })
        }, { flex: '1.4', title: 'Two models' })
      }, { align: 'center' })
      b.h('Data facts that shaped the codec')
      b.row((r) => {
        r.card((c) => c.p('Scale is **block-local**: magnitudes change from one block of values to the next.', { size: 27 }), { flex: '1', title: 'Block-local scale' })
        r.card((c) => c.p('Trained gradients are **heavy-tailed**.', { size: 27 }), { flex: '1', title: 'Heavy tails' })
        r.card((c) => c.p('Many **structural zeros** (padding, unused experts).', { size: 27 }), { flex: '1', title: 'Structural zeros' })
      }, { gap: 28 })
    },
  }),
  slide({
    id: 'recap-ebq', section: S0, title: 'EBQ, the first codec: fewer bits at equal bulk error',
    steps: 1,
    build(b) {
      b.bullets([
        'Error-bounded quantizer: **one step per message**, |x − x′| ≤ step / 2',
        'No predictor; 128-value blocks with fixed-length (w+1)-bit fields',
      ])
      b.p('Offline bits per value on ZGCM gradients, at equal bulk error', { size: 26 }).style.color = C.dim
      b.add(bars({
        width: 1500, labelW: 220, max: 4.6, rows: [
          { label: 'EBQ', bars: [{ v: 3.44, tone: 'fin', text: '3.18–3.44' }] },
          { label: 'SDP4Bit', bars: [{ v: 4.25, tone: 'sdp', text: '4.25' }] },
        ],
      }))
      b.step()
      b.callout('EBQ zeroes **16–60%** of nonzero elements; SDP4Bit zeroes 0–23%.', { tone: 'bad', label: 'Open red flag' })
    },
  }),
  slide({
    id: 'recap-c2', section: S0, title: 'Inside the collective, EBQ already beat SDP4Bit',
    steps: 1,
    build(b) {
      b.row((r) => {
        r.stat('5.3–8.2%', 'faster than SDP4Bit, at equal or lower L2', { flex: '1', size: 120 })
        r.p('Gradient ReduceScatter,<br>8 nodes, real operands', { size: 30, flex: '1' }).style.color = C.dim
      }, { align: 'center' })
      b.step()
      b.callout('How much error does training tolerate?', { label: 'Left open last time', tone: 'warn', size: 36 })
      b.p('Today is the answer, and it changed the codec.', { size: 36 })
    },
  }),

  // 1 · The codec in real training
  slide({
    id: 'frame-step', section: S1, title: 'The codec as deployed: a “frame step”',
    build(b) {
      b.code([
        'per destination frame:',
        '  step = α · sqrt( mean over 128-value blocks of block_absmax² )',
        '  q    = round(x / step)            # |x − x′| ≤ step / 2 for every element',
      ].join('\n'), { size: 30 })
      b.bullets([
        'A classic **absolute error bound per call**, with the bound set relative to a statistic of the whole frame',
        'The step is **lagged**: reused from the previous call, replaced only when it drifts by more than 25%',
        'SZ-style thinking: pick an absolute bound and guarantee every element',
      ])
    },
  }),
  slide({
    id: 'first-results', section: S1, title: 'First results looked good',
    build(b) {
      b.table(['Run', 'Step time', 'Loss'], [
        ['ZGCM, 8 nodes, overlapped, α 0.15', '7.21 s vs stock 7.70 s (**−6.3%**)', '+0.30% at it 20'],
        ['ZGCM, 16 nodes, α 0.08, 1500 it', '4.93 s', '+0.1% vs SDP4Bit, steady'],
      ], { size: 30, num: [] })
      b.p('Faster than stock, and the loss gap looked small and steady.', { size: 30 }).style.color = C.dim
    },
  }),
  slide({
    id: 'equal-error', section: S1, title: 'Compared at equal error, the problem shows',
    steps: 1,
    build(b) {
      b.p('ZGCM, 8 nodes, same traffic, overlaps off', { size: 26 }).style.color = C.dim
      b.row((r) => {
        r.col((c) => {
          c.table(['Arm', 'Step', 'Loss at it 10'], [
            ['stock', '7.90 s', '3.3403 / 3.3450'],
            ['FINCCL, frame step 0.15', '7.24 s (−8.1%)', '**+0.92%**'],
            ['COCCL-SDP4Bit', '7.15 s (−9.0%)', '+0.04%'],
          ], { size: 27 })
          c.p('Relative L2 on this traffic: **0.162** (FINCCL) vs **0.165** (SDP4Bit)', { size: 26 })
        }, { flex: '1.25' })
        r.col((c) => {
          c.p('Loss excess at it 10', { size: 24 }).style.color = C.dim
          c.add(bars({
            width: 640, labelW: 170, max: 1.0, barH: 44, rows: [
              { label: 'FINCCL', bars: [{ v: 0.92, tone: 'fin', text: '+0.92%' }] },
              { label: 'SDP4Bit', bars: [{ v: 0.04, tone: 'sdp', text: '+0.04%' }] },
            ],
          }))
        }, { flex: '1' })
      })
      b.step()
      b.callout('Same size of error, about **20×** the loss damage. The size of the error is not what matters.', { size: 32 })
      b.p('A step sweep matched SDP4Bit’s loss only at step 0.04, where SDP4Bit was then about 2% faster.', { size: 25 }).style.color = C.dim
    },
  }),

  // 2 · Two failures
  slide({
    id: 'olmoe-diverges', section: S2, title: 'Failure 2: OLMoE diverges at 16 nodes',
    build(b) {
      b.row((r) => {
        r.col((c) => {
          c.p('Training loss (±10-iteration mean), 16 nodes', { size: 24 }).style.color = C.dim
          c.add(lines({
            width: 900, height: 470, xs: ['300', '450', '600', '789'], ymin: 2.3, ymax: 2.65, yticks: [2.3, 2.4, 2.5, 2.6],
            yfmt: (v) => v.toFixed(1), xlabel: 'iteration', legend: 'right',
            series: [
              { name: 'stock', tone: 'stock', ys: [2.3895, 2.369, 2.3501, 2.3263] },
              { name: 'frame step 0.07', tone: 'fin', ys: [2.3915, 2.4048, 2.6246, null] },
            ],
          }))
        }, { flex: '1.15' })
        r.col((c) => {
          c.bullets([
            'Backward AllToAll at frame step 0.07: on stock’s curve until ≈ it 300',
            'Then grad norm **0.4 → 2.2**; loss 2.62 vs 2.35 at it 600',
            'A rerun diverged at the same point',
            'At 8 nodes the same setting stayed on stock’s curve',
          ], { size: 27 })
          c.callout('**Not corruption**: 20,000 in-run checks against exact NCCL stayed at relL2 0.034–0.040, no outlier.', { tone: 'good', size: 26 })
        }, { flex: '1' })
      })
    },
  }),
  slide({
    id: 'fixes', section: S2, title: 'Three textbook fixes, all measured, none worked',
    steps: 1,
    build(b) {
      b.table(['Fix', 'Rationale', 'Result'], [
        ['Stochastic rounding', 'Remove the rounding bias and the dead zone', 'Loss 3.2100 vs 3.2109: **no change**. Offline it doubled the per-step error'],
        ['Tile-local step (4096 values)', 'Localise the scale', 'Per-tensor relL2 **+146% to +385%**: rejected'],
        ['Error feedback', 'Biased compressors need EF (EF-signSGD, EF21)', 'Residual correct to half a step; +74 ms per step; **no gain**. 2-bit + EF: +0.54% loss vs 2-bit alone +0.37%'],
      ], { size: 26, widths: ['330px', '440px', ''], num: [] })
      b.step()
      b.callout('Each fix treats the error as a per-call bias or as too large. None changed the loss, so the cause had to be the **structure** of the error.')
    },
  }),

  // 3 · Literature
  slide({
    id: 'literature', section: S3, title: 'Two kinds of advice in the literature',
    build(b) {
      b.row((r) => {
        r.card((c) => {
          c.p('The error is a **bias** that accumulates over steps.', { size: 30 })
          c.bullets([
            '**Error feedback** (EF-signSGD, EF21): carry the residual into the next step',
            '**Unbiased rounding** (QSGD, MARINA): make the error zero-mean',
          ], { size: 27 })
          c.p('Prediction: EF or stochastic rounding should remove the gap.', { size: 26 }).style.color = C.dim
        }, { flex: '1', title: 'Optimization view', tone: 'sdp' })
        r.card((c) => {
          c.p('The error’s **shape** matters, not only its size.', { size: 30 })
          c.bullets([
            '**Per-group scale + Hadamard rotation** (SDP4Bit, THC)',
            '**Fine-grained scales; keep the sensitive return path in BF16** (DeepSeek-V3 FP8)',
            '**Update RMS, gradient-to-noise** thresholds before loss spikes (Wortsman, Chmiel)',
          ], { size: 27 })
          c.p('Prediction: localise the scale, rotate, protect the most sensitive path.', { size: 26 }).style.color = C.dim
        }, { flex: '1', title: 'Structural view', tone: 'fin' })
      }, { gap: 36 })
    },
  }),
  slide({
    id: 'reproduced', section: S3, title: 'What reproduced on our training runs',
    steps: 1,
    build(b) {
      const ok = '<span style="color:#2b8a3e;font-weight:700">Reproduced</span>'
      const no = '<span style="color:#c92a2a;font-weight:700">Not reproduced</span>'
      const part = '<span style="color:#b35c00;font-weight:700">Partly</span>'
      b.table(['Claim', 'Outcome', 'What we saw'], [
        ['EF fixes biased compressors', no, 'Offline the 3-step error drops 30–45%, but 22–31% of elements are still never delivered. No training gain'],
        ['Unbiased rounding fixes bias', no, 'No change in loss'],
        ['Per-group scale + Hadamard', ok, 'Group error ranks the loss; Hadamard cuts q=7 group error 0.183 → 0.126'],
        ['Keep the return path exact', ok, 'Leaving the MoE return path uncompressed removed most of the OLMoE gap'],
        ['Update RMS, gradient-to-noise thresholds', ok, 'All final settings are safely inside both (GNR 7.5, update RMS 1.00 ± 0.05)'],
        ['Steps to converge grow with relL2²', ok, 'q=3 costs +3.3% steps (ZGCM), +5.5% (OLMoE experts): matches our hand choices'],
        ['Few exponents cover > 97% of values', part, 'Holds for parameters and activations; **fails for gradients** (0.25–0.69)'],
      ], { size: 23, widths: ['470px', '230px', ''], num: [] })
      b.step()
      b.callout('The **structural** advice reproduced: scale per small group, rotate, keep the most sensitive path exact. The **bias** advice (EF, unbiased rounding) did not.', { size: 27 })
    },
  }),

  // 4 · Diagnosis
  slide({
    id: 'group-error', section: S4, title: 'Which error metric predicts the loss?',
    steps: 1,
    build(b) {
      b.row((r) => {
        r.col((c) => {
          c.card((k) => {
            k.p('**Group error** = sqrt( mean over 128-value groups of ‖e_g‖² / ‖x_g‖² ), every group weighted alike', { size: 27 })
            k.p('**Erased fraction** = share of groups with ‖e_g‖ > ‖x_g‖ / 2', { size: 27 })
            k.p('**relL2** = ‖e‖ / ‖x‖ over the whole tensor: dominated by the loudest groups', { size: 27 })
          }, { title: 'Definitions' })
        }, { flex: '1' })
        r.col((c) => {
          c.p('Rank correlation with 8-node loss excess, 8 ZGCM settings', { size: 24 }).style.color = C.dim
          c.add(bars({
            width: 820, labelW: 280, max: 1.0, barH: 46, rows: [
              { label: 'Group error', bars: [{ v: 0.98, tone: 'fin', text: '0.98' }] },
              { label: 'Erased fraction', bars: [{ v: 0.9, tone: 'warn', text: '0.90' }] },
              { label: 'relL2, cosine', bars: [{ v: 0.5, tone: 'stock', text: '0.50' }] },
            ],
          }))
        }, { flex: '1' })
      }, { gap: 40 })
      b.step()
      b.callout('Caveat: 8 settings is a small sample. This is a correlation, not a causal proof.', { tone: 'warn', size: 27 })
    },
  }),
  slide({
    id: 'erased-groups', section: S4, title: 'A frame-wide step erases quiet groups',
    steps: 1,
    build(b) {
      b.table(['ZGCM DP gradient RS', 'bits', 'relL2', 'group error', 'erased'], [
        ['SDP4Bit', '4.25', '0.165', '0.165', '0%'],
        ['cuTZ frame step 0.04 / 0.08 / 0.15', '5.21 / 4.29 / 3.50', '0.05 / 0.09 / 0.17', '0.23 / 0.30 / 0.41', '12 / 16 / 23%'],
        ['cuTZ block-relative q=7, Hadamard', '4.14', '0.125', '0.126', '0%'],
        ['cuTZ block-relative q=3, Hadamard', '3.14', '0.293', '0.295', '0%'],
      ], { size: 26, hi: [2, 3], widths: ['560px', '', '', '', ''] })
      b.step()
      b.bullets([
        'A frame-wide absolute step rounds every low-magnitude group (norms, biases, quiet rows) to zero **on every call**: 12% of ZGCM’s gradient groups at step 0.04, **39%** of OLMoE’s',
        'Adam divides each element by its own history, so a persistently zeroed group becomes a large, one-sided update error',
        'In SZ terms: an absolute bound gives an **unbounded relative error** on small sub-blocks',
      ], { size: 27 })
    },
  }),
  slide({
    id: 'persistence', section: S4, title: 'Second mechanism: persistence',
    steps: 1,
    build(b) {
      b.row((r) => {
        r.col((c) => {
          c.table(['3-bit codebook (8 nodes, 400 it)', 'Validation vs stock'], [
            ['fixed rotation, no zero level', '+0.58%'],
            ['fixed rotation, with zero level', '**+1.33%**'],
            ['**rotation redrawn every call**, no zero level', '**+0.04%**'],
          ], { size: 26, hi: [2] })
          c.p('The codebook had *lower* group error than uniform q=3 (0.18–0.21 vs 0.30), yet it degraded training.', { size: 25 })
        }, { flex: '1.2' })
        r.col((c) => {
          c.p('Persistence = |mean error over 8 calls| / |one call’s error|', { size: 23 }).style.color = C.dim
          c.add(bars({
            width: 700, labelW: 270, max: 1.1, barH: 42, rows: [
              { label: 'fixed rotation', bars: [{ v: 1.0, tone: 'bad', text: '1.00' }] },
              { label: 'per-call seeds', bars: [{ v: 0.4, tone: 'good', text: '0.40' }] },
              { label: 'fully independent', bars: [{ v: 0.35, tone: 'stock', text: '0.35' }] },
            ],
          }))
        }, { flex: '1' })
      }, { gap: 40 })
      b.step()
      b.callout('An error that repeats every call accumulates like a **bias**; one that changes every call averages out like **noise**. Rounding randomness is too small; re-randomising the rotation decorrelates the whole block.', { size: 27 })
      b.p('Ruled out: the zero level (it made things worse) and the codebook’s gain shrink (new seeds alone fixed it).', { size: 24 }).style.color = C.dim
    },
  }),

  // 5 · cuTZ iterations
  slide({
    id: 'kernel-rounds', section: S5, title: 'Kernel engineering first: nine rounds',
    build(b) {
      b.row((r) => {
        r.col((c) => {
          c.p('GB/s on A100: <b>compress</b> · <span style="color:#1c1f23;font-weight:700">decompress</span>', { size: 24 })
          c.add(bars({
            width: 820, labelW: 120, max: 1000, barH: 22, gap: 16, font: 22, rows: [
              { label: 'R1', bars: [{ v: 345, tone: 'fin' }, { v: 762, tone: 'ink' }] },
              { label: 'R4', bars: [{ v: 530, tone: 'fin' }, { v: 762, tone: 'ink' }] },
              { label: 'R7', bars: [{ v: 667, tone: 'fin' }, { v: 918, tone: 'ink' }] },
              { label: 'R8', bars: [{ v: 742, tone: 'fin' }, { v: 918, tone: 'ink' }] },
              { label: 'R9', bars: [{ v: 729, tone: 'fin' }, { v: 916, tone: 'ink' }] },
            ],
          }))
        }, { flex: '1' })
        r.col((c) => {
          c.table(['Round', 'Change'], [
            ['1', 'Bit-plane packing, per-tile offset table (enables a one-kernel DOC)'],
            ['4', 'Whole tile in shared memory; look-back overlapped with packing'],
            ['7', 'Field packing instead of bit planes (~24 → 6–8 instructions per value)'],
            ['8', 'Block rate from the max of the |x| bit patterns'],
            ['9', '{offset, step} per tile; a 452-line rewrite'],
          ], { size: 22, widths: ['90px', ''], num: [] })
        }, { flex: '1' })
      }, { gap: 36 })
      b.callout('After round 9: ratio 5.14, compress 729 GB/s, decompress 916, **fused DOC 499 GB/s** (EBQ’s best unfused: 171). DOC = decode, add, compress: what a reduction does at every hop.', { size: 25, tone: 'ink' })
    },
  }),
  slide({
    id: 'versions', section: S5, title: 'Then the diagnosis drove the versions',
    build(b) {
      b.table(['Version', 'What changed, and why', 'Result'], [
        ['v1 frame step', 'Absolute step per frame', 'Erases groups; OLMoE diverges at 16 nodes'],
        ['v2 block-relative + Hadamard', 'Per-128-block step (one code byte) and a randomized Hadamard per block: follows the group-error diagnosis', 'ZGCM 8 nodes q=3: **−8.9%** step vs SDP4Bit at its loss. OLMoE 16 nodes: **divergence gone**'],
        ['v3 codebooks', 'Lloyd-Max levels for rotated Gaussian blocks at the q=3 / q=7 widths', 'Group error 0.184 / 0.093 vs uniform 0.299 / 0.128, but training drifted'],
        ['v3.1 per-call seeds', 'Redraw the rotation every call to break persistence', '+0.04% validation'],
        ['v4 fixed rate (CTZF)', 'Every block has the same width W: no rate bytes, scan, look-back or shared memory', 'Overhead 0.14 → 0.0625 bits/value; much faster kernels'],
      ], { size: 24, widths: ['300px', '640px', ''], hi: [1], num: [] })
    },
  }),
  slide({
    id: 'v4-lessons', section: S5, title: 'Lessons from v4, and what we rejected',
    build(b) {
      b.row((r) => {
        r.card((c) => {
          c.p('The first fixed-rate version made the codec **2× faster** but training **9% slower**.', { size: 29 })
          c.p('AllToAllv frames zero-padded to the largest count were sent at full width: +1.3 ms per call.', { size: 27 })
          c.p('**Fix**: a frame ends after its last nonzero block.', { size: 27 })
          c.p('Kernel benchmarks alone would not have caught this.', { size: 25 }).style.color = C.dim
        }, { flex: '1.2', title: 'A regression worth telling', tone: 'warn' })
        r.card((c) => {
          c.bullets([
            '**Optimal-transport level tables**: after rotation they equal the Gaussian table',
            '**Escape coding** for outliers: 0.221 group error at 3.19 bits, worse than the codebook',
          ], { size: 27 })
        }, { flex: '1', title: 'Tried and rejected' })
      }, { gap: 36 })
    },
  }),
  slide({
    id: 'pipeline', section: S5, title: 'Final pipeline: encoding one 128-value block',
    steps: 1,
    build(b) {
      b.flow([
        { t: 'Block', sub: '128 values · 8 threads × 16 values · 16-byte loads' },
        { t: 'Rotate', sub: 'y = H D x / √128 · per-call seed, same on every rank', tone: 'fin' },
        { t: 'Code e', sub: 'smallest with step(e)·q ≥ max|y| · step(e) = 2^((e−192)/4)' },
        { t: 'Quantize', sub: 'k = round(y / step) · offset-binary, W bits, bit planes' },
        { t: 'Stream', sub: '16 B header · 1 code byte per block · 16·W bytes per block' },
      ], { size: 25, arrow: '›' })
      b.bullets([
        'H = Walsh–Hadamard: 4 butterfly stages in-thread, 3 by warp shuffle. D = random signs from a hash of (position, seed)',
        'Code 0 = all-zero block, 255 = non-finite. The stream ends after the last nonzero block',
        'Decode and DOC are one kernel each. Frames are summed in the rotated domain (rotation is linear) and rotated back once',
      ], { size: 25 })
      b.step()
      b.callout('Block-relative cuTZ is **not homomorphic**: every block on every rank has its own step, so a reduction must decode, add and re-quantize (DOC). The frame-step mode had a shared lattice (error flat from 2 to 16 ranks); we gave that up on purpose, and fused DOC keeps re-quantization cheap.', { tone: 'warn', size: 25, label: 'Trade-off' })
    },
  }),

  // 6 · What q means
  slide({
    id: 'q-def', section: S6, title: 'q: the number of nonzero levels on each side of zero',
    steps: 2,
    build(b) {
      b.p('Each rotated 128-value block gets its own step: the smallest quarter-octave step with max|y| / step ≤ q.', { size: 30 })
      b.add(levels({ q: 3, width: 1300, maxAt: -0.15 }))
      b.step()
      b.bullets([
        'round(y / step) ∈ [−q, q]: **the block’s largest value maps to about ±q**',
        'step ∈ [max|y| / q, 2^¼ · max|y| / q), so |e| ≤ step / 2 < **0.59 · max|y| / q**: a *block-relative* bound',
      ], { size: 29 })
      b.step()
      b.p('Field width **W** = the smallest w ≥ 2 with 2^w ≥ 2q + 1.', { size: 29 })
    },
  }),
  slide({
    id: 'q-table', section: S6, title: 'Doubling q costs one bit and halves the error',
    build(b) {
      b.table(['q', 'W (bits)', 'Bits/value (W + 8/128)', 'bf16 ratio', 'Group error (corpus)', 'Used for'], [
        ['3', '3', '3.06', '5.22', '0.30', 'ZGCM gradients'],
        ['7', '4', '4.06', '3.94 (fp32: 7.88)', '0.128', 'OLMoE backward AllToAll, expert gradients'],
        ['15', '5', '5.06', '', '0.060', ''],
        ['31', '6', '6.06', '', '0.030', 'OLMoE forward AllToAll'],
      ], { size: 28, num: [0, 1, 2, 3, 4] })
      b.bullets([
        'With rotation, W can be up to 6 (q ≤ 31). Without rotation the fixed-rate stream supports only q = 3 or 7',
      ], { size: 27 })
    },
  }),
  slide({
    id: 'tolerance', section: S6, title: 'Different traffic tolerates different error',
    steps: 1,
    build(b) {
      b.table(['Traffic', 'q', 'Why'], [
        ['Gradients (ReduceScatter)', '3 – 7', 'Averaged by the optimizer; error is independent across calls. q=3 costs +3.3% steps (ZGCM)'],
        ['MoE backward of the combine, into the experts', '7', 'Matches stock’s loss at q=7'],
        ['MoE return path to router and attention', '7', 'The most sensitive backward path: compressing it coarsely caused most of the OLMoE gap'],
        ['MoE forward activations', '31', 'Error passes through every later layer and the loss. q=15 already costs +0.15% at it 1'],
      ], { size: 26, widths: ['480px', '120px', ''], hi: [3], num: [] })
      b.step()
      b.row((r) => {
        r.callout('The forward path needs ≈ 6 bits; gradients get by with 3. A single error bound for every tensor would be wrong for one of them.', { size: 27, flex: '1.4' })
        r.callout('Early layers carry **2–4×** the loss excess of the last layers. Per-layer settings are not yet tested in training.', { size: 25, tone: 'warn', flex: '1' })
      }, { gap: 28 })
    },
  }),

  // 7 · Final cuTZ
  slide({
    id: 'final-kernels', section: S7, title: 'Kernels vs SDP4Bit as COCCL configures it',
    steps: 1,
    build(b) {
      b.table(['Operand', 'Codec', 'Ratio', 'Group err', 'Compress', 'Decode', 'DOC'], [
        ['EP AllToAll bf16 8.4M', 'SDP4Bit (2048 groups)', '3.97', '0.301', '40.2', '35.9', '128.9'],
        ['', '**cuTZ q=3**', '**5.22**', '0.300', '**34.0**', '**29.3**', '**49.5**'],
        ['TP ReduceScatter bf16 33.6M', 'SDP4Bit (128 groups)', '3.56', '0.186', '145.6', '106.6', '590.1'],
        ['', '**cuTZ q=7**', '**3.94**', '0.128', '**99.5**', '**85.0**', '**162.6**'],
        ['Param AllGather bf16 19.8M', 'SDP4Bit (2048 groups)', '3.97', '0.404', '82.9', '66.6', '335.5'],
        ['', '**cuTZ q=3**', '**5.22**', '0.300', '**69.3**', '**59.2**', '**112.8**'],
        ['DP gradient RS fp32 33.6M', 'SDP4Bit (128 groups, rotated)', '7.53', '0.166', '231.0', '289.5', '828.1'],
        ['', '**cuTZ q=7**', '**7.88**', '0.138', '**131.0**', '**176.9**', '**182.6**'],
      ], { size: 22, group: true, hi: [1, 3, 5, 7], num: [2, 3, 4, 5, 6] })
      b.p('One captured operand per traffic class · times in µs', { size: 22 }).style.color = C.dim
      b.step()
      b.callout('At SDP4Bit’s error or lower: **1.05–1.32×** the ratio, **1.18–1.76×** faster compress, **1.13–1.64×** faster decode, **2.6–4.5×** faster DOC. fp32 compress runs at ≈ 80% of DRAM bandwidth.', { size: 26 })
    },
  }),
  slide({
    id: 'other-gpu', section: S7, title: 'Other GPU error-bounded compressors on the same data',
    build(b) {
      b.p('Compress / decompress GB/s on A100, gradient operands, same error setting (α 0.04)', { size: 24 }).style.color = C.dim
      b.add(bars({
        width: 1500, labelW: 220, max: 1000, barH: 30, rows: [
          { label: 'FSZ', bars: [{ v: 157, tone: 'stock', text: '157 / 192' }, { v: 192, tone: 'stock', text: '' }] },
          { label: 'cuSZp3', bars: [{ v: 171, tone: 'sdp', text: '171 / 209' }, { v: 209, tone: 'sdp', text: '' }] },
          { label: 'cuTZ', bars: [{ v: 729, tone: 'fin', text: '729 / 916' }, { v: 916, tone: 'fin', text: '' }] },
        ],
      }))
      b.row((r) => {
        r.callout('A collective needs the codec far faster than the link: at 4–5× compression, a 25 GB/s NIC moves ≈ 100–125 GB/s of raw data per direction, and a reduction also pays decode + add + encode.', { size: 25, flex: '1.3' })
        r.callout('cuSZp3 exceeded its error bound by up to **1515×** on some fp32 gradient operands. Not diagnosed; we can share the operands.', { tone: 'warn', size: 25, flex: '1' })
      }, { gap: 28 })
    },
  }),
  slide({
    id: 'final-training', section: S7, title: 'Training with the final cuTZ',
    build(b) {
      b.table(['Model', 'Setting', 'Step time', 'Loss'], [
        ['ZGCM, 8 nodes', 'grad q=3, param 0.6', '3.92 s vs SDP4Bit 4.30 s (**−8.9%**)', '3.1947 vs 3.1953 at it 15'],
        ['ZGCM, 16 nodes', 'same', '4.03–4.07 s vs SDP4Bit 4.48 s (**−9.2 to −9.9%**); stock 7.21 s', ''],
        ['ZGCM, 16 nodes, 800 it', 'same', '', 'validation +0.06% vs SDP4Bit, constant gap'],
        ['OLMoE, 8 nodes, 400 it', 'fwd q=31, bwd q=7, expert grad q=7, per-call seeds', '3.36 s vs stock 4.51 s (**−25.5%**)', 'validation within +0.03%'],
        ['OLMoE, 16 nodes, 3000 it', 'same', 'about **−27.5%** vs stock', 'validation mean −0.017% (−0.038 to +0.009%)'],
      ], { size: 24, num: [], widths: ['260px', '320px', '', ''] })
      b.p('Noise floor: two identical ZGCM stock runs differ by 0.06%; OLMoE stock seed-to-seed spread is −0.95 to +0.70%.', { size: 25 }).style.color = C.dim
    },
  }),
  slide({
    id: 'limits', section: S7, title: 'Honest limits',
    build(b) {
      b.row((r) => {
        r.card((c) => {
          c.p('ZGCM’s **10% target over SDP4Bit is not met**: 8.9% at 8 nodes, 9.2–9.9% at 16.', { size: 27 })
          c.p('Compute is ≈ 3.66 s of the 3.92 s step, so the ceiling is ≈ 13%.', { size: 25 }).style.color = C.dim
        }, { flex: '1', title: 'Target', tone: 'bad' })
        r.card((c) => {
          c.p('OLMoE training loss reads **+0.13–0.16%** because it is computed through the compressed forward pass.', { size: 27 })
          c.p('Validation runs exact.', { size: 25 }).style.color = C.dim
        }, { flex: '1', title: 'Training vs validation', tone: 'warn' })
        r.card((c) => {
          c.p('Inside FINCCL, cuTZ and EBQ differ by only **0–9% per call**: the network exchange is 75–87% of GPU time.', { size: 27 })
          c.p('Much of the end-to-end gain is the transport (Part 2).', { size: 25 }).style.color = C.dim
        }, { flex: '1', title: 'Codec vs transport', tone: 'ink' })
      }, { gap: 28 })
      b.callout('Why OLMoE is compared with stock only: COCCL-SDP4Bit targets dense models. On OLMoE at 2 nodes it took **84 s** per step vs stock’s 30.8 s (2.7× slower), loss +6% at it 1.', { tone: 'sdp', size: 25 })
    },
  }),

  // 8 · Lessons and questions
  slide({
    id: 'lessons', section: S8, title: 'What training asks of a lossy compressor',
    build(b) {
      b.table(['Requirement', 'Why', 'In cuTZ'], [
        ['Bound the error **per small group**, relative to the group', 'A global or absolute bound erases quiet groups; Adam amplifies them', '128-value block-relative step'],
        ['**Decorrelate** the error across calls', 'Repeated error accumulates like bias', 'Rotation redrawn every call'],
        ['Judge by **group error**, not PSNR or global relL2', 'Global metrics are dominated by loud groups', 'Used to pick every setting'],
        ['**Fixed rate**, sizes known ahead', 'AllToAllv and one-sided puts need slot sizes; no size exchange', 'W bits per value + 1 byte per block'],
        ['**Reduction-friendly**', 'ReduceScatter adds frames from every rank', 'Fused decode-add-encode'],
        ['Throughput **≫ link bandwidth**', 'The codec must stay a small part of the collective', '≈ 700–900 GB/s'],
      ], { size: 24, widths: ['520px', '', '420px'], num: [] })
    },
  }),
  slide({
    id: 'questions', section: S8, title: 'Where compression expertise could help',
    build(b) {
      numbered(b, [
        '**Entropy coding with fixed slots.** A rANS version of EBQ saved ≈ 13% but is variable-length. Is there a block-local entropy code cheap enough to keep fixed-size frames?',
        '**A 5–6-bit codebook** to replace q=31 on the forward path? Our study predicts −14 to −17% error. Worth building?',
        '**A loss-aware error metric.** Group error is a correlation over 8 settings. Is a Hessian-weighted metric worth its cost, or is there a cheaper proxy?',
        '**The rotated-domain bound.** With rotation, the guarantee is a per-block L2 bound, not pointwise L∞. Acceptable to the error-bounded community, or present cuTZ as a quantizer?',
        '**Summing without decoding.** Can block-relative frames be added in the integer domain, e.g. with a shared block exponent agreed per call?',
      ])
    },
  }),
  slide({
    id: 'backup', section: BK, title: 'Backup',
    build(b) {
      b.row((r) => {
        r.card((c) => c.p('Lorenzo costs **+11%** bits on MoE traffic and **+8%** on dense. Previous-element context needs 5.21 bits vs 5.00 for block-scale context.', { size: 25 }), { flex: '1', title: 'Why no predictor?' })
        r.card((c) => c.p('Rank 8 captures only 13–60% of the energy of low-kurtosis gradient matrices; per-matrix error 0.41–0.72 vs cuTZ 0.07.', { size: 25 }), { flex: '1', title: 'Why not low rank (PowerSGD)?' })
      }, { gap: 28 })
      b.row((r) => {
        r.card((c) => c.p('The 3-step error drops, but 22–31% of elements are still never delivered after 3 steps; +74 ms per step for the residual buffers.', { size: 25 }), { flex: '1', title: 'Why EF did not help' })
        r.card((c) => c.p('One step per frame quantizes every rank on the same lattice, so integers add exactly: error 0.006385 → 0.006392 from 2 to 16 ranks.', { size: 25 }), { flex: '1', title: 'The shared lattice we gave up' })
      }, { gap: 28 })
    },
  }),
  slide({
    id: 'end', section: '', layout: 'title',
    build(b) {
      b.p('Discussion', { size: 112 }).style.cssText += 'font-weight:700;letter-spacing:-0.025em'
      b.p('Next: Part 2, compressed collectives on the NCCL Device API', { size: 40 }).style.color = C.dim
      b.add(document.createElement('div')).style.cssText = `height:6px;width:420px;background:${C.fin};margin-top:20px`
    },
  }),
]
