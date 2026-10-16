---
id: overview
title: sked
sidebar_label: Overview
slug: /sked/overview
---

# sked

sked runs OCI-packaged `sched_ext` CPU schedulers on Kubernetes nodes. A cluster-scoped `Scheduler` resource specifies the image and node labels to target. The operator verifies the image, creates a privileged DaemonSet, and reports rollout status.

sked does not replace the Kubernetes scheduler. Kubernetes places pods on nodes; a `sched_ext` scheduler controls how a node's Linux kernel allocates CPU time to threads.

## What it manages

- **Node placement:** `spec.nodeSelector` selects a node pool; `spec.tolerations` permits placement on tainted nodes.
- **Container configuration:** arguments, environment variables, image pull secrets, and resource requests and limits.
- **Image trust:** an admission webhook checks the caller, image allowlist, and Cosign signature against a ConfigMap policy. Signature verification is enabled by default. The reconciler verifies again and uses the verified digest in the DaemonSet.
- **Conflicts:** when selectors overlap, the oldest Scheduler wins each node, with name order breaking timestamp ties. Other Schedulers exclude those nodes and report a conflict.
- **Status:** node counts, the resolved image, conditions, and Kubernetes events derived from the DaemonSet's rollout.

The [Helm chart](./installation) installs two controller replicas, leader election, admission webhooks, and a PodDisruptionBudget by default. Only the elected leader reconciles; both replicas serve webhooks.

## Limitations

There is no per-node sked agent, and sked does not invoke [schedctl](../schedctl/overview). The kubelet runs the scheduler image directly. schedctl and sked implement their own signature verification and use different trust-policy formats.

sked does not inspect node kernels or confirm that a scheduler has attached. `Ready=True` means the DaemonSet rollout is complete, not that `/sys/kernel/sched_ext/state` is `enabled`. [Check kernel state](./usage#verify-the-kernel-state) on each target node.

Rollouts use Kubernetes' default DaemonSet update strategy. The CRD does not expose rollout tuning, scheduler priority, custom probes, or automatic rollback. Conflict handling covers Scheduler objects, not schedulers started outside sked.

Scheduler containers run privileged and change node-wide kernel behaviour. Restrict who can manage Scheduler resources and the trust policy, and use node pools whose kernels support the images you deploy.

## Start here

1. [Install sked](./installation) with Helm or Kustomize.
2. [Run a scheduler](./usage) on a labelled node pool.
3. Configure it using the [CRD reference](./crds) and [trust policy](./trust-policy).

[Architecture](./architecture) explains reconciliation and failure handling. [Development](./development) covers builds, tests, and generated manifests.
