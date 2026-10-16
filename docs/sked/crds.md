---
id: crds
title: CRD reference
---

# CRD reference

sked defines one custom resource: `Scheduler`. The trust policy is a ConfigMap, not another CRD.

## `Scheduler`

| Property | Value |
| --- | --- |
| API version | `sked.schedkit.io/v1` |
| Kind / list kind | `Scheduler` / `SchedulerList` |
| Plural / singular | `schedulers` / `scheduler` |
| CRD name | `schedulers.sked.schedkit.io` |
| Scope | Cluster |
| Subresource | `status` |
| Printer columns | Ready, Desired, Available, Age |

There are no short names. Scheduler objects have no namespace. Their DaemonSets run in the controller's workload namespace: the Helm release namespace by default, or the namespace set by `controller.workloadNamespace` / `--workload-namespace`.

```yaml
apiVersion: sked.schedkit.io/v1
kind: Scheduler
metadata:
  name: scx-rusty
spec:
  sched: ghcr.io/schedkit/scx_rusty:latest
  nodeSelector:
    schedkit.io/pool: batch
```

This creates a DaemonSet named `scx-rusty` in the workload namespace, targeting nodes labelled `schedkit.io/pool=batch`, subject to taints and [conflict handling](#overlapping-selectors). Use a verified digest rather than a mutable tag when you need repeatable deployments.

## Spec fields

| Field | Type | Required | Behaviour |
| --- | --- | --- | --- |
| `spec.sched` | string | Yes | OCI image reference. Tags are accepted; if a digest is supplied, it must be `sha256:` followed by exactly 64 hex characters. |
| `spec.nodeSelector` | map of strings | No | Every label must match. An omitted or empty selector matches all nodes for conflict arbitration; pod placement also depends on tolerations and Kubernetes scheduling. |
| `spec.tolerations` | Kubernetes `Toleration[]` | No | Passed to the pod. Allows placement on matching tainted nodes; does not select nodes. Standard DaemonSet tolerations also apply. |
| `spec.args` | string array | No | Arguments for the `scx` container. The image's entrypoint is unchanged. |
| `spec.env` | Kubernetes `EnvVar[]` | No | Container environment, including `valueFrom` references. |
| `spec.imagePullSecrets` | `LocalObjectReference[]` | No | Named pull secrets in the **workload namespace**. Used by the kubelet, not by the controller's signature verifier. |
| `spec.resources` | Kubernetes `ResourceRequirements` | No | Compute resources for the scheduler container, including requests and limits. These do not set CPU policy for other workloads. |

The CRD does not expose `priority`, `imagePullPolicy`, `command`, `affinity`, `volumes`, `serviceAccountName`, probes, or an update strategy. Fields inherited from Kubernetes types may depend on cluster feature gates. There is no general-purpose pod template.

### Container configuration example

```yaml
apiVersion: sked.schedkit.io/v1
kind: Scheduler
metadata:
  name: scx-rusty-batch
spec:
  sched: ghcr.io/schedkit/scx_rusty:latest
  nodeSelector:
    schedkit.io/pool: batch
  tolerations:
    - key: dedicated
      operator: Equal
      value: batch
      effect: NoSchedule
  args:
    - --verbose
  env:
    - name: RUST_LOG
      value: info
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
```

Choose CPU and memory requests for your scheduler, and check its supported flags. Use this manifest instead of the first example; applying both targets the same nodes.

### Validation

The CRD schema rejects empty or malformed image references and invalid digest formats. The validating webhook also checks:

- node-selector label keys and values;
- environment-variable names and duplicate names;
- nonempty, valid image-pull-secret names;
- the caller's identity, the image repository allowlist, and its signature according to the [trust policy](./trust-policy).

The webhook handles creates and updates with `failurePolicy: Fail`. If it cannot be reached or verification fails, the API request is rejected. It does not validate Scheduler deletion. Kubernetes still validates the generated DaemonSet and pods; admission of a Scheduler does not guarantee its pod configuration will run.

## Status fields

| Field | Meaning |
| --- | --- |
| `status.observedGeneration` | Scheduler generation most recently processed by the reconciler, including failed attempts. |
| `status.resolvedImage` | Image reference last successfully written to the DaemonSet. Digest-pinned when signature verification is enabled; otherwise the requested reference. Cleared when all selected nodes are lost to conflicts. |
| `status.nodes.desired` | DaemonSet `desiredNumberScheduled`. |
| `status.nodes.ready` | DaemonSet `numberReady`. |
| `status.nodes.available` | DaemonSet `numberAvailable`. |
| `status.nodes.unavailable` | DaemonSet `numberUnavailable`. |
| `status.conditions` | Conditions keyed by `type`, with `status`, `reason`, `message`, `observedGeneration`, and `lastTransitionTime`. |

There is no phase or per-node status list. The counts describe DaemonSet pods, not kernel attachment. After a reconcile failure, the image and counts may still reflect the last successful reconciliation. Read the conditions too.

### Conditions

| Type | Meaning when `True` |
| --- | --- |
| `Active` | The Scheduler has not lost all selected nodes to another Scheduler. It can also be true when no nodes match, or when image verification fails; it is not a health signal. |
| `Ready` | The DaemonSet has observed its current generation, has at least one desired node, and all desired pods are updated and available. |
| `Progressing` | The DaemonSet rollout is incomplete. |
| `Degraded` | A conflict, reconcile failure, or unavailable pods need attention. |

Common reasons are `ActiveScheduler`, `SchedulerConflict`, `NoNodesScheduled`, `RolloutInProgress`, `DaemonSetReady`, `NodesUnavailable`, `SpecInvalid`, `ImageVerificationFailed`, `ReconcileFailed`, and `ReconcileSucceeded`.

With partial conflicts, `Active` remains true and `Degraded=True` reports `SchedulerConflict`. `Ready` can also be true if the rollout on the remaining nodes is complete. With no desired nodes, `Ready=False` reports `NoNodesScheduled`.

:::warning
`Ready=True` does not prove that the scheduler attached to the kernel. sked adds no kernel-aware readiness probe. Verify `/sys/kernel/sched_ext` on the nodes as described in [Usage](./usage#verify-the-kernel-state).
:::

## Generated workload

Each Scheduler normally owns one DaemonSet with:

- the Scheduler's name, in the configured workload namespace;
- a controller owner reference to the cluster-scoped Scheduler;
- `managed-by: sked-controller` on the DaemonSet;
- pod labels `name: <scheduler-name>` and `managed-by: sked-controller`;
- a selector matching the `name` label;
- one privileged container named `scx`;
- the spec fields above copied into the pod and container, plus node affinity excluding conflict nodes when needed.

Kubernetes supplies the default DaemonSet rollout behaviour. Edit the Scheduler, not its generated DaemonSet: reconciliation replaces the DaemonSet spec. Deleting the Scheduler lets Kubernetes garbage-collect its DaemonSet and pods; sked has no custom cleanup finalizer.

## Overlapping selectors

For each node, the oldest matching Scheduler wins. Equal creation timestamps are ordered lexicographically by name. Schedulers being deleted are ignored.

- **Partial overlap:** the losing Scheduler excludes conflict nodes through required node affinity on `kubernetes.io/hostname`, and runs on the remaining nodes.
- **Complete overlap:** the losing Scheduler's DaemonSet is deleted. Its node counts become zero, `resolvedImage` is cleared, and `Active=False`, `Ready=False`, and `Degraded=True` report `SchedulerConflict`.

Arbitration compares node labels only. It does not consider tolerations, kernel support, image validity, or pod health. An older Scheduler that cannot run can still block a newer one. Use non-overlapping selectors. Label changes trigger reassignment, but pods stop and start asynchronously; a scheduler handoff is not atomic.

## Migrating from `SchedExt`

The old namespaced `SchedExt` kind is not served by the current CRD. There is no conversion webhook or automatic workload adoption.

Export the old resources before removing the old installation. Recreate each as a cluster-scoped `Scheduler`: change the kind, remove `metadata.namespace`, and add an explicit node selector. Check image references against the current trust policy. Stop the legacy DaemonSets before creating replacement workloads so both do not attempt to attach on the same nodes. Plan for a gap in `sched_ext` scheduling during the cutover.
