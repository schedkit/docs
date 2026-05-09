---
id: overview
title: sked
sidebar_label: Overview
slug: /sked/overview
---

# sked

:::info
sked is at an early, scaffolded stage. Today it's a thin Kubernetes operator that runs `sched_ext` scheduler images as privileged DaemonSets, driven by a single `SchedExt` CRD. It does not yet do node selection, image signature verification, status reporting, or coordinated rollouts. These pages document what exists in the operator code as of `v1` of the API; they will grow as the operator does.
:::

sked is the Kubernetes operator side of schedkit. It watches `SchedExt` resources in the API server and, for each one, creates a `DaemonSet` in the same namespace that runs the referenced OCI scheduler image as a privileged container on every node the DaemonSet's pod scheduling rules let it run on.

That's the whole feature set today. There is no separate per-node agent, no `schedctl` invocation on the node, no rolling status, no kernel preflight from the operator. The kernel preflight, signature verification, and lifecycle management story you get from [schedctl](../schedctl/overview) on a single host is *not* what sked currently provides on a cluster — those are independent code paths.

## What sked does

In one sentence: applying a `SchedExt` causes a `DaemonSet` to come into existence whose pods run the referenced scheduler image with `securityContext.privileged: true`.

Slightly less compressed:

- The operator watches `SchedExt` resources in the `sked.schedkit.io/v1` API group.
- For each one, it creates or patches a `DaemonSet` with the same name and namespace as the `SchedExt`.
- That DaemonSet has one container, named `scx`, with the image taken verbatim from `spec.sched`.
- The container runs privileged. Privileged containers get all Linux capabilities, including `CAP_BPF`, `CAP_SYS_ADMIN`, and `CAP_PERFMON`, which is what loading a `sched_ext` scheduler needs.
- The DaemonSet is owned by the `SchedExt`; deleting the `SchedExt` deletes the DaemonSet and its pods via the standard owner-reference cascade.
- Pods inherit the DaemonSet's default scheduling: by default that means every node. There is no built-in node selector, toleration, or priority field on the CRD today.

## What sked does *not* do (yet)

It's important to be precise about this. The CRD has a single field. The status field exists but is never written to. There is no:

- node selector, toleration, or priority field on the CRD;
- mechanism to run different schedulers on different node pools from a single `SchedExt`;
- conditions or status reporting back to the resource;
- coordination with `schedctl` on the node;
- image signature verification (cosign) on the cluster path;
- rolling rollout strategy beyond Kubernetes' default DaemonSet rolling update;
- finalizer or cleanup logic beyond owner references;
- validation on `spec.sched` (any string is accepted; the kubelet will fail to pull a malformed reference at pod creation time).

Some of this is on the roadmap, some isn't. If a feature you need isn't listed, file an issue.

## When sked is the right tool

For now, sked is the right tool when:

- You're already running Kubernetes and you want to use the cluster as the deployment substrate for `sched_ext` schedulers.
- You're comfortable defining your own scheduling rules — taints, node labels, the DaemonSet's pod-spec — at the cluster level rather than expecting the operator to provide them on the CRD.
- You're OK with the privileged DaemonSet model and the security implications that come with it.

If you want fine-grained, declarative control over which scheduler runs on which node pool, with rollouts and status, you're either ahead of the operator or ahead of the project. The schedctl path on individual hosts may serve you better today, possibly driven by your existing configuration management.

## How it relates to schedctl

They don't currently share code or a runtime contract. schedctl is the host CLI; sked is a Kubernetes operator that runs scheduler images directly via the kubelet's container runtime. A future iteration could plausibly use schedctl as the in-pod runtime to pick up its kernel preflight, signature verification, and discrepancy reporting — but that integration does not exist today. The two projects are aligned in design (both run OCI-packaged sched_ext schedulers) but independent in implementation.

If a scheduler refuses to load on a particular node, the debugging path is the same as if you were running it directly with the container runtime — `kubectl logs` on the DaemonSet pod, `dmesg` on the node, `cat /sys/kernel/sched_ext/state` to confirm what (if anything) the kernel has attached. The [schedctl troubleshooting guide](../schedctl/troubleshooting) covers the kernel-side failure modes that show up the same way under sked.

## Where to start

- [Installation](./installation) walks through deploying the operator into a cluster.
- [CRD reference](./crds) documents the `SchedExt` resource as it exists today.
- [Usage](./usage) is the practical "how do I apply one" walkthrough.
- [Architecture](./architecture) covers how the controller actually works internally.
- [Development](./development) is for contributors.
