---
id: sched-ext
title: sched_ext in three minutes
sidebar_label: What is sched_ext
---

# sched_ext in three minutes

`sched_ext` is a Linux kernel framework that lets you implement a CPU scheduler as a BPF program and attach it to the running kernel without rebooting. It landed upstream in Linux 6.12 after a long period as an out-of-tree patch series, and it's the reason schedkit can exist as a userspace project.

For most of Linux's history, "the scheduler" meant whatever was compiled into the kernel: O(1), then CFS, more recently EEVDF. Swapping it out meant a custom kernel build at minimum, an out-of-tree patch at worst, and either way it was the kind of operation you didn't perform on a Tuesday afternoon. `sched_ext` changes that. A scheduler becomes a regular BPF program that the kernel loads, runs, and unloads on demand. The kernel still owns the safety story (it verifies your scheduler before letting it touch threads), but the policy decisions are now yours.

## What you can do with it

The interesting use cases break down into a few buckets.

**Workload-specific tuning.** A build server, a database, a game, and a Kubernetes worker have very different scheduling needs. Historically you picked one general-purpose scheduler and hoped. With `sched_ext`, you pick the right one for the workload at hand and switch when the workload changes.

**Research and experimentation.** Trying a new scheduling idea used to mean either patching the kernel or simulating the behaviour somewhere else. Now it's a BPF program plus a userspace component, which makes the iteration loop short enough to be productive.

**Production hot-fixes.** If a workload is being pathologically mis-scheduled and a kernel upgrade isn't an option this quarter, a custom `sched_ext` scheduler is a way to deploy a targeted fix without waiting for the next maintenance window.

## What you can't do with it

It's worth being clear about the boundaries.

`sched_ext` is for CPU scheduling specifically. It doesn't replace the I/O scheduler, the memory subsystem, or any of the other things people occasionally call "the scheduler" in casual conversation. If your problem is that the page cache is evicting the wrong things, this is not the tool.

It also isn't free of safety considerations. The verifier prevents kernel crashes from buggy BPF, but it can't prevent your scheduler from making catastrophically bad scheduling decisions and tanking system responsiveness. The kernel has a watchdog: if your scheduler stops doing useful work, the kernel will fall back to its default policy and unload your BPF program. This is a soft floor, not a hard guarantee. Treat scheduler changes the way you treat any production change: with rollback plans and observability.

## Where the schedulers come from

There's a community project called [scx](https://github.com/sched-ext/scx) that maintains a growing set of `sched_ext`-based schedulers, each tuned for a different workload class. A few that come up often:

- `scx_lavd` — latency-sensitive workloads, including interactive desktop and games.
- `scx_rusty` — a balanced general-purpose scheduler written in Rust.
- `scx_bpfland` — interactive workloads with a stronger emphasis on fairness.
- `scx_rustland_core` — a framework for writing the policy in userspace Rust, which is great for prototyping.

schedkit doesn't ship its own schedulers. We package the existing ones (and any others you bring) as OCI images and provide the tooling to actually run them.

## Further reading

- [Kernel documentation for sched_ext](https://docs.kernel.org/scheduler/sched-ext.html) — the canonical reference.
- [The scx repository](https://github.com/sched-ext/scx) — for the schedulers themselves.
- [The LWN coverage](https://lwn.net/Articles/922405/) of the upstream merge, for the historical context.
