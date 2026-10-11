# Speaker notes: FINCCL Part 2, Device-API collectives (40 min max)

Speaker notes are in English; the talk is given in Chinese. Audience: advisor, the SZ developers and
an NCCL engineer. What the NCCL engineer wants: how we use the Device API, where it worked, where it
did not, and concrete questions. "Likely Q" lines come from the companion study guide ("FINCCL
collectives: design notes and Q&A prep").

## title
Nothing in NCCL is modified. Every arm links the same NCCL 2.31.2.
Likely Q "why one NCCL version?": releases differ by 3–6% inter-node on this machine.

## agenda
At most 40 minutes. The autotuner is backup only.

## takeaways
Three points: no host in the loop, one-shot instead of ring, results. The rest of the talk is how.

## recap
**2 min.** The codec is cuTZ. Two traffic classes matter. Today's question: how the codec gets inside
the collective without a CPU in the loop.

## three-designs
**Section 2, 5 min.** Neither we nor COCCL use NCCL's Primitives. COCCL wraps codec kernels around stock
host-API collectives; we write exchange kernels on the public Device API.
Likely Q "did you follow NCCL's primitive style?": No, and neither does COCCL.

## coccl-measured
For a variable-size codec COCCL copies frame sizes to the host and synchronises the stream every call,
decodes all P inputs into scratch, then reduces in a separate kernel.
(Build) Say: "The codec was not the problem; the schedule around it was."

## one-shot
A lossy ring re-quantizes at every hop: error grows from 0.0080 to 0.0189 relative L2 between 2 and
16 ranks. Our integer-lattice ring was bit-exact but moved 1.3–3.3× the bytes.
The exchange kernel starts from NCCL's example `06_device_api/03_alltoall_hybrid`; we changed the
synchronisation (section 6).

## shim
**Section 3, 4 min.** A preload between the training side and standard NCCL. It takes a call only on a
communicator that spans nodes; everything else is forwarded unchanged.
Likely Q "why not compress NVLink?": NVLink delivers about 115–180 GB/s; every codec we tried cost
0.04–0.8% of the step on TP traffic.

## classes
One codec setting per class. AllReduce is not replaced in training.

## a2a-capture
`all_to_all_single` arrives as grouped send/recv. Members that decide differently deadlock, so every
decision is symmetric: a shared tag, setup success agreed by one AllReduce(max), capacity overflow
aborts, the autotuner AllReduces its decisions.

## setup
**Section 4, 5 min.** One window per collective: four collectives with three or four windows each
exhausted the NIC's memory registrations.
`ncclDevCommCreate` must come after a window is registered, and outside an NCCL group.
Likely Q "why a symmetric window?": GIN puts and LSA pointers need registered symmetric memory.

## device-api
GIN is in proxy mode on Polaris: the GPU posts a descriptor; an NCCL CPU thread issues the RDMA write.
Likely Q "why Weak signal ops?": they are what NCCL's examples use for arrival counting; visibility
comes from waiting on the signal, then flush and barrier. **Check the ordering semantics in the 2.31.2
device headers before claiming more.**

## exchange
**Section 5, 10 min.** Walk the six steps. The key ideas for the NCCL engineer:
- the sender reads the frame length from the header on the device;
- every frame adds the same count to the receiver's signal whatever its size, so the receiver needs
  no sizes;
- signals are never reset; the host keeps running totals.

## rs-flat
Encode, exchange, one fused decode-sum. In place: this rank's own frame is skipped.

## rs-hier
Benchmarked, not used in training. Each value is quantized once, as a node partial.
The compressed on-node stage adds codec work to avoid reading raw fp32 over NVLink; at DP=32 it wins.
For the SZ developers: the fine-then-coarse quantization is a two-level error budget.

## a2av
3 node peers get raw stores; 4 off-node peers get cuTZ frames. No size agreement, sparse sends and
receives, step computed every call.

## ag-delta
For the SZ developers: this is the closed loop of SZ-style prediction. Everyone predicts from the
reconstructed value, so the error does not accumulate.

## allreduce
Benchmark only. Each rank keeps exactly what others will decode, so all ranks end identical.

## sync
**Section 6, 4 min.**
(Build) Credits are NCCL's head/tail flow control at the granularity of a whole call. They bound
run-ahead to one call, which is why running-total signals are safe.

## micro
**Section 7, 5 min.** Be upfront about small messages: fixed costs (launches, credit wait, flush)
dominate below 0.5 MiB per rank.

## scaling
The ReduceScatter grows slowly with node count; stock jumps at 16 nodes. The EP AllToAll stays flat.

## e2e
Likely Q "codec or transport?": mostly transport and schedule. Inside FINCCL, codecs differ by 0–9% per
call because the exchange is 75–87% of GPU time.
Likely Q "why overlaps off for ZGCM?": COCCL-SDP4Bit hangs in the overlapped gradient ReduceScatter at
8 nodes. FINCCL runs overlapped: −6.3% vs stock.

## gin-slingshot
**Section 8, 5 min.** All fixes are outside NCCL. Bit-exact at 2, 8 and 32 ranks.
Likely Q "GIN bandwidth?": one context 5.2 GB/s vs 8.2 for send/recv; 2–4 contexts reach 7.8 GB/s.

## train-bugs
GIN progress threads: SCHED_IDLE plus a `sched_yield` interposer that naps when FINCCL is idle;
ZGCM forward overhead fell from 123 ms to 29 ms.
Not on the slide: a plugin crash with all ranks on one node, a silent socket fallback, an EP AllToAll
startup stall (open).

## nccl-questions
Ask these directly; the right column is what an answer would unblock. Before the talk, verify whether
2.31.2 has a non-proxy GIN backend that could work with cxi.

## autotuner
**Backup, only if time remains.** It re-derives the hand settings and extends to new workloads, all
at stock's validation loss.

## end
Questions. Point to the companion study guide for code-level detail.
