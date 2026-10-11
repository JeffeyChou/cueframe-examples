## board/pain

Autoregressive generation: every request has a different prompt, and nobody knows how long the
answer will be. The memory manager has to decide how much KV cache to give each request before
the output exists. Guess low and the request runs out mid-answer; guess high and the GPU fills
up with reservations. That is where OOM comes from.

## board/drawers

The classic answer is static pre-allocation: reserve `max_seq_len` (say 2048 tokens) of
contiguous KV cache per request. User A writes two drawers' worth; the other eight stay empty
but nobody else may use them. Measured systems wasted 60–80% of KV memory this way. User B is
turned away while the cabinet is mostly air: internal and external fragmentation.

## board/paging

Operating systems solved this decades ago with virtual memory and paging. Do not hand out one
big contiguous cabinet; hand out fixed-size loose pages. PagedAttention splits the KV cache into
blocks (for example 16 tokens each). The scheduler grabs a free block whenever a sequence needs
one, wherever it is.

## board/page-table

Logically a sequence still sees blocks 0, 1, 2 in order. Physically they sit in any free slot of
GPU memory; a per-request block table maps logical to physical blocks. Waste is limited to the
last, partly filled block of each sequence (under 4% in the vLLM paper).

## board/sharing

Because blocks are indirect, requests can share them. Two users with the same system prompt
point at the same physical blocks for that prefix, with copy-on-write when they diverge. More
requests fit in the same memory, so batches grow: the vLLM paper reports 2–4× throughput over
earlier systems. The gain depends on the workload (sequence lengths, prefix reuse).

## board/overview

The whole board: unknown lengths, wasted reservations, paging, the block table, shared prefixes.
