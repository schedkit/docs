---
id: intro
title: Introduction
slug: /intro
---

# Introduction

schedkit is a small ecosystem of tools for distributing, running, and orchestrating Linux CPU schedulers built on top of `sched_ext`.

The kernel side of pluggable schedulers is solved: recent Linux kernels let you attach a BPF-based scheduler at runtime without rebooting, recompiling, or shipping a custom kernel module. The pieces that aren't solved by the kernel are the boring-but-important ones around it: how do you ship a scheduler binary, how do you decide which one is running on a given machine, how do you roll back when something misbehaves, and how do you do any of this across more than a single host. That's the problem space schedkit lives in.

## What's in this site

The documentation is split into three sections.

**Concepts** is for readers who want to understand the design before touching anything. It covers what `sched_ext` actually is and isn't, why we settled on OCI as the distribution format for schedulers, and how the various components fit together.

**schedctl** documents the host-side command-line tool. If you have a single machine and you want to try out a different scheduler for the duration of a build, a game session, or a test run, this is what you're looking for.

**sked** documents the Kubernetes operator. If your nodes already live in a cluster and you'd like to declare which scheduler runs on them as a Kubernetes resource, this is the layer for that. sked is at an early, deliberately-thin stage today — see its [overview](/docs/sked/overview) for what's actually implemented before planning a rollout.

You can read the sections in order or jump straight to whichever tool you came here for. The Concepts pages are prerequisite-free; the project pages assume you've at least skimmed Concepts but try not to lean on it too hard.

## Audience

We assume you're comfortable on a Linux command line, you've used containers (any runtime is fine), and for the sked sections that you've operated a Kubernetes cluster before. We don't assume you've written a scheduler. We don't even assume you know what `sched_ext` is — that's the very next page.

## Where to file things

Documentation issues belong in the [docs repo](https://github.com/schedkit/docs/issues). Tool issues belong in the relevant project repo: [schedctl](https://github.com/schedkit/schedctl/issues) for the CLI, [sked](https://github.com/schedkit/sked/issues) for the operator. If you're not sure which it is, open it against schedctl and we'll move it if needed.
