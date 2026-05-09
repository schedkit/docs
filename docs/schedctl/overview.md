---
id: overview
title: schedctl
sidebar_label: Overview
slug: /schedctl/overview
---

# schedctl

`schedctl` is the host-side CLI for schedkit. You point it at an OCI-packaged `sched_ext` scheduler, and it pulls the image, runs the binary inside with the right capabilities, and attaches the scheduler to your kernel. Stopping the scheduler is symmetric: `schedctl stop` shuts the binary down cleanly and the kernel reverts to its default policy.

If that sentence makes sense to you, you can probably skip ahead to [Installation](./installation) and [Usage](./usage). The rest of this page is for context.

## What schedctl is for

The honest description: it's a small, opinionated wrapper around your container runtime that knows about the specific things `sched_ext` schedulers need.

The things it knows about, that a generic `podman run` doesn't, are things like:

- starting the scheduler container with the elevated privileges it needs to load a BPF program into the kernel,
- inspecting the kernel for `sched_ext` support and host readiness before trying to attach (`schedctl doctor`),
- reading kernel sched_ext state from sysfs and reconciling it against what schedctl thinks it's managing (`schedctl status`),
- verifying image signatures with cosign before running anything (containers run privileged and load eBPF, so this matters),
- presenting the catalog of available schedulers to a user who'd rather not memorise image paths (`schedctl list`, `schedctl versions`).

The things it doesn't try to do — at least not yet — are things like fleet management (that's [sked](../sked/overview)), scheduler authoring (the [scx](https://github.com/sched-ext/scx) project does that better), and replacing your distribution's package manager (it's a complement, not a competitor; we ship through the same package managers everyone else does).

## What you'll need

The hard requirements:

- A Linux kernel with `sched_ext` support. In practice this means 6.12 or later, with the relevant kernel config flags compiled in. Most modern openSUSE Tumbleweed and Arch Linux kernels have this turned on; some long-term-support distributions don't.
- A working container runtime. We currently support Podman and containerd. Docker isn't directly tested but has been reported to work.
- Root, or equivalent capabilities. Loading BPF schedulers is a privileged operation no matter how you slice it.

The soft requirements:

- A CPU that isn't ancient. `sched_ext` schedulers tend to assume reasonably modern features (per-CPU run queues, working topology information, often perf counters).
- Enough RAM to keep your scheduler image cached. Most are small (tens of megabytes) but pulling them on a laggy network during a hot-swap is nobody's idea of a good time.

## Where to start

- New to schedkit entirely? [The concepts pages](../concepts/sched-ext) explain `sched_ext` itself before diving into tooling.
- Want to install it and try it? [Installation](./installation) and then [Usage](./usage).
- Want to package your own scheduler? [Packaging a scheduler](./packaging-a-scheduler).
- Something not working? [Troubleshooting](./troubleshooting) before you open an issue.
