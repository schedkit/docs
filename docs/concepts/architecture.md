---
id: architecture
title: Architecture overview
sidebar_label: Architecture
---

# Architecture overview

schedkit runs OCI-packaged `sched_ext` CPU schedulers with two tools: schedctl on a host and sked in Kubernetes.

## On one host: schedctl

schedctl talks to a local Podman or containerd runtime. It verifies scheduler images, starts and stops containers, and provides host diagnostics and status commands.

```text
user -> schedctl -> Podman/containerd -> scheduler binary -> sched_ext
```

Use [schedctl](../schedctl/overview) on a workstation or server, directly or from scripts. It does not require Kubernetes.

## In Kubernetes: sked

sked watches cluster-scoped `Scheduler` resources that specify an image, node selection, and container settings.

```text
cluster administrator
        |
        v
API server <-> sked admission webhook <-> trust policy + image registry
        |
        v
Scheduler resource
        |
        v
sked leader: assign nodes, verify image, reconcile workload
        |
        v
DaemonSet in the configured workload namespace
        |
        v
kubelet -> container runtime -> scheduler binary -> sched_ext
```

The [Helm chart](../sked/installation) installs two controller replicas with leader election and a PodDisruptionBudget. Both replicas serve admission webhooks; only the leader reconciles. The kubelet runs the privileged scheduler pods directly. There is no per-node sked agent and no schedctl invocation.

sked verifies signatures at admission and during reconciliation, then places the verified digest in the DaemonSet. It resolves overlapping node selections by creation time and reports DaemonSet rollout counts, conditions, and events. It does not inspect node kernels: a ready pod is not proof that its scheduler attached.

See [sked architecture](../sked/architecture) for the reconcile loop and failure handling, and the [CRD reference](../sked/crds) for the API.

## What the tools share

Both tools accept OCI scheduler images. sked does not import or invoke schedctl; each tool has its own signature verifier, trust-policy format, and defaults.

Do not let both manage a scheduler on the same node. sked's conflict handling only sees Scheduler resources; it cannot account for a scheduler started by schedctl or another host process.

Neither tool replaces Kubernetes pod scheduling. They manage Linux CPU schedulers, which allocate CPU time to threads after workloads have been placed on a node.

## Repositories

| Repository | Role |
| --- | --- |
| [schedkit/schedctl](https://github.com/schedkit/schedctl) | Host CLI, container runtime clients, image verification, and diagnostics. |
| [schedkit/sked](https://github.com/schedkit/sked) | Scheduler CRD, operator, admission validation, trust policy, and Helm chart. |
| [schedkit/plumbing](https://github.com/schedkit/plumbing) | Scheduler image publishing and the catalog mapping names to image references. |
| [schedkit/docs](https://github.com/schedkit/docs) | This documentation site. |
