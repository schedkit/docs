---
id: architecture
title: Architecture overview
sidebar_label: Architecture
---

# Architecture overview

schedkit has two tools for running OCI-packaged `sched_ext` CPU schedulers: schedctl on a host, and sked in Kubernetes. Both run scheduler images, but they manage them independently.

## On one host: schedctl

schedctl talks to a local Podman or containerd runtime. It verifies scheduler images, starts and stops containers, and provides host diagnostics and status commands.

```text
user -> schedctl -> Podman/containerd -> scheduler binary -> sched_ext
```

The CLI does not require Kubernetes. Use it for a workstation, a standalone server, or host management driven by scripts. See [schedctl](../schedctl/overview).

## In Kubernetes: sked

sked watches cluster-scoped `Scheduler` resources. Each names a scheduler image and can select a node pool, tolerate taints, and configure container arguments, environment, pull secrets, and resources.

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

The common input is an OCI-packaged scheduler, not a controller-to-agent protocol. sked neither imports schedctl nor shells out to it. Both implement signature verification, but their trust-policy formats and defaults differ. Configuring one tool does not configure the other.

Do not let both manage a scheduler on the same node. sked's conflict handling only sees Scheduler resources; it cannot account for a scheduler started by schedctl or another host process.

Neither tool replaces Kubernetes pod scheduling. They manage Linux CPU schedulers, which allocate CPU time to threads after workloads have been placed on a node.

## Repositories

| Repository | Role |
| --- | --- |
| [schedkit/schedctl](https://github.com/schedkit/schedctl) | Host CLI, container runtime clients, image verification, and diagnostics. |
| [schedkit/sked](https://github.com/schedkit/sked) | Scheduler CRD, operator, admission validation, trust policy, and Helm chart. |
| [schedkit/plumbing](https://github.com/schedkit/plumbing) | Scheduler image publishing and the catalog mapping names to image references. |
| [schedkit/docs](https://github.com/schedkit/docs) | This documentation site. |
