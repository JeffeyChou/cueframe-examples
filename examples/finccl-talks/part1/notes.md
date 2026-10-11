# Speaker notes: FINCCL Part 1, cuTZ (60 min)

Speaker notes are in English; the talk is given in Chinese. Audience: advisor and the SZ developers.
What they want from this talk: what training needs from a lossy compressor, why an error-bounded
codec failed there, and where compression expertise could help. Keep implementation detail for
questions.

## title
Setup and baseline only. SDP4Bit numbers are always COCCL-SDP4Bit with its autotuner disabled.
The previous talk is recapped in section 0; do not re-present it.

## agenda
60 minutes. Sections 4 (diagnosis) and 5 (iterations) are the core; section 6 goes slowly.

## takeaways
State the three findings up front so the rest of the talk is evidence for them.
For the SZ developers: finding 2 is the one aimed at them. Global relL2 and PSNR-style metrics did
not predict training damage; per-group error did.

## recap-problem
**Recap, 5 min for the whole section.** On 32 A100s, a communication kernel runs in 46–70% of every
step, and almost none of it overlaps with compute. Targets: inter-node fp32 gradient ReduceScatter and
the MoE expert AllToAll. TP on NVLink is not worth compressing.

## recap-corpus
Three data facts shaped the codec: block-local scale, heavy-tailed trained gradients, structural zeros.

## recap-ebq
EBQ: one step per message, no predictor, 128-value blocks with fixed-length fields. 3.18–3.44 bits vs
SDP4Bit's 4.25 at equal bulk error.
(Build) The red flag left open: EBQ zeroes 16–60% of nonzero elements.

## recap-c2
Say: "Last time I stopped here. The open question was how much error training tolerates. Today is
the answer, and it changed the codec."

## frame-step
**Section 1, 7 min.** The deployed codec is a classic absolute bound per call, scaled to the frame.
Say: "This is SZ-style thinking: pick an absolute bound and guarantee every element."

## first-results
Faster than stock, loss gap small and steady. This is what made us confident at first.

## equal-error
Same traffic, same relative L2 (0.162 vs 0.165), but +0.92% vs +0.04% loss.
(Build) Say: "Same size of error, twenty times the loss damage."
If asked about a smaller step: at step 0.04 FINCCL matches SDP4Bit's loss, but SDP4Bit is then faster.

## olmoe-diverges
**Section 2, 6 min.** Failure 1 is the ZGCM excess just shown.
Failure 2: the backward AllToAll at frame step 0.07 follows stock until about iteration 300, then the
grad norm grows and the loss leaves. A rerun diverged at the same point. In-run checks against exact
NCCL rule out data corruption.

## fixes
Each fix treats the error as a per-call bias or as too large. None changed the loss.
If asked about EF: the residual was verified correct; the backup slide has why it still did not help.

## literature
**Section 3, 7 min.** Frame the literature as two predictions, then test them on the next slide.
Optimization view: the error is bias, fix it with EF or unbiased rounding.
Structural view: the error's shape matters: per-group scales, rotation, keep the sensitive path exact.

## reproduced
Be honest. The structural advice reproduced; the bias advice did not.
Hessian-weighted error and time-to-target loss were not implemented: do not claim them.

## group-error
**Section 4, 8 min.** Group error weights every 128-value group alike; relL2 is dominated by the
loudest groups.
(Build) Say the caveat aloud: 8 settings is a small sample.

## erased-groups
The frame step at 0.04 has a much smaller relL2 than SDP4Bit (0.05 vs 0.165) but a larger group error
(0.23) and 12% of groups erased.
(Build) The mechanism is a hypothesis backed by correlation. In SZ terms: an absolute bound gives an
unbounded relative error on small sub-blocks. Ask the SZ developers whether they have seen this in
scientific data with quiet regions.

## persistence
The codebook had lower group error than uniform q=3, yet degraded training. Only the rotation seed
changes between the bad and good rows.
Say: "An error that repeats every call accumulates like a bias. One that changes every call averages
out like noise. Stochastic rounding was supposed to give that, but rounding randomness is too small;
re-randomising the rotation decorrelates the whole block."

## kernel-rounds
**Section 5, 9 min.** Nine rounds of kernel work before the design changes. Round 7 (field packing)
and round 8 (block rate from the max of the |x| bit patterns, valid because rounding is monotonic) are
the ones SZ developers will find most reusable.
DOC = decode, add, compress: the operation a reduction does at every hop.

## versions
Each version answers a diagnosis: v2 the group error, v3.1 the persistence, v4 the rate overhead.

## v4-lessons
The regression is the point: a codec benchmark can improve while training gets slower, because padded
frames went over the wire at full width.

## pipeline
Walk the five boxes left to right. The seed is per call and the same on every rank.
(Build) Say plainly: block-relative cuTZ is not homomorphic. We gave up the shared lattice because the
frame-step mode erases groups.

## q-def
**Section 6, 5 min. Go slowly.**
(Build 1) q is the number of nonzero levels on each side of zero; the bound is block-relative.
(Build 2) W follows from q.

## q-table
Rule of thumb: doubling q costs one bit per value and halves the error.

## tolerance
The per-class settings are the practical answer to "how much error does training tolerate":
it depends on where the error goes.
(Build) The forward path needs about 6 bits, gradients 3. Layer sensitivity is measured but per-layer
settings are untested in training.

## final-kernels
**Section 7, 7 min.** One captured operand per class; SDP4Bit as COCCL configures it.
(Build) At SDP4Bit's error or lower, cuTZ is better on every column.

## other-gpu
The throughput argument: the codec has to be several times faster than the link to stay a small part
of the collective.
cuSZp3 exceeded its bound on some fp32 gradient operands; not diagnosed. Offer the operands to the SZ
developers.

## final-training
Quote the noise floor with the results: ZGCM stock arms differ by 0.06%; OLMoE stock seed spread is
−0.95 to +0.70%.

## limits
- The 10% target over SDP4Bit is not met; the ceiling at this scale is about 13%.
- OLMoE training loss reads high because it goes through the compressed forward pass.
- Much of the end-to-end gain is the transport: Part 2.

## lessons
**Section 8, 6 min.** The slide aimed at the SZ developers. Read the six rows as requirements, not as
cuTZ features. Fixed rate is the one most likely to be challenged: explain that a one-sided put needs
the slot size before the data exists.

## questions
Open these as a discussion, one at a time. Question 1 and 4 are the most important to get an
opinion on.

## backup
- No predictor: Lorenzo costs bits on this data.
- No low rank: rank 8 captures too little energy.
- EF: the residual is correct, but too many elements are never delivered in a few steps.
- Shared lattice: what the frame-step mode had, and why we gave it up.

## end
Hand over to Part 2, or open discussion.
