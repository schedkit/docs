---
id: architecture
title: Architecture overview
sidebar_label: Architecture
---

# Architecture overview

This page is a single-screen-ish view of how the schedkit components fit together. If the Concepts pages on `sched_ext` and OCI explained the *what*, this one explains the *where*.

## The two layers

schedkit is, deliberately, two pieces of software at two different layers.

**schedctl** is a host-level CLI. It runs on a single machine, talks to a local container runtime (Podman or containerd), and is responsible for verifying the scheduler image's signature, pulling it, starting the binary in a privileged container, and managing its lifecycle. It has no opinion about whether your machine is part of a cluster. As far as schedctl is concerned, it's just a Linux box.

**sked** is a Kubernetes operator. It exposes a CRD (`SchedExt`) that names the scheduler image you want to run, and creates a privileged DaemonSet that runs that image on every node the DaemonSet's pod-scheduling rules allow. The kubelet on each node pulls the image and starts the container; the kernel takes care of attaching `sched_ext` from there.

The two projects are aligned in design — both run OCI-packaged sched_ext schedulers — but **independent in implementation today**. sked does not invoke schedctl, share its trust policy, or use its kernel preflight. A future version of the operator could plausibly use schedctl as the in-pod runtime (and pick up its signature verification and discrepancy reporting for free), but that integration does not exist now.

## A diagram, in words

On a single machine, the chain looks like this:

```
user → schedctl CLI → container runtime (Podman/containerd) → scheduler binary → sched_ext (kernel)
```

In a Kubernetes cluster, sked is the user-facing interface and the chain is shorter than you might expect:

```
cluster admin
    ↓
SchedExt CRD (in the API server)
    ↓
sked controller (one replica, control plane)
    ↓
DaemonSet  (one per SchedExt)
    ↓
kubelet → container runtime → scheduler binary → sched_ext (per node)
```

There is no per-node sked component. The kubelet runs the scheduler pod; the pod runs privileged; the binary inside attaches `sched_ext` directly. schedctl is not in this picture.

## What's in each repository

| Repository | Layer | Language | Role |
| --- | --- | --- | --- |
| [schedkit/schedctl](https://github.com/schedkit/schedctl) | Host | Go | CLI, container runtime client, scheduler lifecycle, cosign verification, kernel preflight |
| [schedkit/sked](https://github.com/schedkit/sked) | Cluster | Go | kubebuilder operator: `SchedExt` CRD, controller that creates a privileged DaemonSet per resource |
| [schedkit/plumbing](https://github.com/schedkit/plumbing) | — | JSON | Catalog manifest (mapping short names to image URIs) consumed by `schedctl list`/`run`/`versions` |
| [schedkit/schedkit-docs](https://github.com/schedkit/schedkit-docs) | — | TypeScript | This site |

The two code repositories are independently versioned and currently independent in their wire-level concerns: sked does not import schedctl as a Go module, nor does it shell out to it. Aligning their lifecycle and trust models is a deliberate longer-term direction; today they coexist rather than co-operate.

## Why the layers are separate

There's a temptation, when designing this kind of system, to do everything in one binary. We didn't, for a few reasons.

The single-machine use case is real and standalone. Plenty of people want to run a different scheduler on their workstation or on a single bare-metal box without any cluster involvement. Forcing them into a Kubernetes operator dependency would be perverse.

The cluster use case has its own complexity surface — CRD design, controller patterns, RBAC, helm charts — that has nothing to do with `sched_ext` itself. Keeping it in a separate repo means we can iterate on it without disturbing schedctl, which can stay small and focused.

The boundary between the two is a stable contract (the schedctl CLI), not a private API. If you wanted to write a different orchestrator that drives schedctl from the outside — Nomad, a custom Ansible setup, whatever — schedctl is happy to be driven by it. We've kept the CLI deliberately scriptable for exactly this reason. (sked itself does not yet drive schedctl; it runs scheduler images directly via the kubelet. The contract is open and stable enough for an operator that *did* want to drive schedctl on each node to do so.)

## What goes where

A rough rule of thumb when deciding which repo a feature belongs in:

- If it's about a single machine, it goes in schedctl.
- If it requires knowing about more than one node, it goes in sked.
- If the answer is "both" — kernel preflight, signature verification, lifecycle/discrepancy reporting — it lives in schedctl today. A longer-term goal is for sked to consume those by driving schedctl on each node, rather than reimplementing them.
