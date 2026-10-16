---
id: intro
title: Introduction
slug: /intro
---

# Introduction

schedkit distributes and runs Linux `sched_ext` CPU schedulers as OCI images.

On a kernel with `sched_ext` support, a BPF-based scheduler can attach at runtime without a reboot or a custom kernel module. schedkit provides image verification, container lifecycle management, and tools to check scheduler status.

## What's in this site

- **[Concepts](./concepts/sched-ext)** explains `sched_ext`, the OCI image format, and how the tools fit together.
- **[schedctl](./schedctl/overview)** is the host CLI. Use it to check a Linux host, run a scheduler image with Podman or containerd, and inspect or stop the scheduler.
- **[sked](./sked/overview)** is the Kubernetes operator. Use cluster-scoped Scheduler resources to select node pools, configure scheduler containers, and track DaemonSet rollouts. [Install it with Helm](./sked/installation).

## Audience

The guides assume familiarity with Linux and containers. The sked guides also assume experience with Kubernetes. You do not need to have written a scheduler.

## Where to file things

Report documentation problems in the [docs repository](https://github.com/schedkit/docs/issues). Report tool bugs in [schedctl](https://github.com/schedkit/schedctl/issues) or [sked](https://github.com/schedkit/sked/issues).
