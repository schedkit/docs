---
id: architecture
title: Architecture
---

# Architecture

sked is one manager binary built with controller-runtime. The process hosts a Scheduler reconciler, a validating admission webhook, a trust-policy refresher, metrics, and health endpoints. There is no node agent or controller-to-node protocol.

```text
kubectl create/update Scheduler
        |
        v
API server ---> sked validating webhook ---> policy + image verification
        |
        v
cluster-scoped Scheduler
        |
        v
sked leader ---> node assignment + image verification
        |
        v
DaemonSet in workload namespace
        |
        v
kubelet ---> container runtime ---> scheduler binary ---> sched_ext
        |
        +--- DaemonSet rollout status ---> sked ---> Scheduler status/events
```

The kubelet runs the scheduler image directly. sked does not install or invoke schedctl.

## Processes and availability

Helm and Kustomize deploy two manager replicas by default. The lease `b4c95cb3.schedkit.io` elects one reconciler; both replicas serve admission requests and refresh their trust policy. Extra replicas provide failover and webhook capacity, not parallel controller leaders.

The default PodDisruptionBudget keeps one controller available during voluntary evictions. A soft topology-spread rule prefers different nodes but permits co-location. Neither setting protects against all replicas sharing a failed node.

If all controllers stop, existing DaemonSets and scheduler pods keep running. Reconciliation and status updates stop, and Scheduler creates and updates fail because the validating webhook has `failurePolicy: Fail`. Deletion is not handled by the webhook; Kubernetes owner-reference garbage collection does not require sked to be running.

## Admission and image resolution

The API schema validates the image reference. The webhook validates selected spec fields, checks the requesting identity and image repository, and verifies the signature when policy requires it. Admission does not mutate the image reference.

The reconciler verifies again before writing the workload. It uses the digest it verified, so a tag changing after that verification cannot make the kubelet pull different content. The webhook and reconciler may see different digests if a tag moves between requests; each verifies the digest it resolves. Use a digest in `spec.sched` to fix the requested content.

The controller needs registry access as well as Kubernetes API access. [Trust policy](./trust-policy) documents verification, credential handling, policy reloads, and fallback behaviour.

## Reconciliation

The controller watches Scheduler objects, Nodes, and owned DaemonSets. Node and Scheduler events enqueue Schedulers so changes to labels or competing resources can change assignments. DaemonSet status updates trigger reconciliation even though they do not change its generation.

For each Scheduler, the reconciler:

1. Reads the resource and records its generation in status.
2. Lists nodes and Schedulers, then computes conflicts from node selectors. The oldest matching Scheduler wins each node; equal timestamps are ordered by name.
3. Deletes the workload and reports `SchedulerConflict` if it loses every selected node.
4. Otherwise resolves and, by default, verifies the image.
5. Creates or patches a same-named DaemonSet in the workload namespace. It copies container settings from the spec and excludes partially conflicting nodes with required node affinity.
6. Copies DaemonSet counts into status, sets conditions, and records events when the reported state changes.

Conflict arbitration does not consider taints, tolerations, image validity, pod health, or schedulers started outside sked. A blocked older Scheduler does not automatically yield to a healthy newer one. See [overlapping selectors](./crds#overlapping-selectors).

The controller replaces the generated DaemonSet spec on reconciliation. Manual changes to its pod template are not a supported configuration path. Owner references connect Scheduler to DaemonSet to pods; there is no custom cleanup finalizer.

### Rollouts and status

A change to the generated pod template triggers Kubernetes' default DaemonSet rolling update. sked observes that rollout; it does not implement a separate rollout engine, atomic scheduler handoff, or automatic rollback.

`status.nodes` and the `Ready`, `Progressing`, and `Degraded` conditions come from DaemonSet status. `Active` records whether the Scheduler is fully blocked by conflicts. Partial conflicts can produce both `Ready=True` and `Degraded=True`: the remaining workload is ready, but some requested nodes belong to another Scheduler.

There is no direct kernel observation. A container that stays alive after failing to attach can appear ready. Conversely, image-pull failures and crashes appear through pod availability, without a kernel-specific diagnosis. Use pod logs and node kernel state to establish the cause.

Events for cluster-scoped Schedulers are stored in `default`, not the workload namespace. Normal reasons include `RolloutInProgress`, `DaemonSetReady`, and `NoNodesScheduled`; warnings include conflicts, verification and reconcile failures, unavailable nodes, and `StatusUpdateFailed`. State-change events are not repeated just because a pod count changes. Events expire; conditions describe the last recorded state.

## Manager settings

The installed defaults differ from some standalone binary defaults:

| Setting | Standalone default | Helm / Kustomize default |
| --- | --- | --- |
| Leader election | Off | On |
| Workload namespace | `POD_NAMESPACE`, falling back to `default` | Release namespace / `sked-system` |
| Metrics bind address | `0` (disabled) | `:8443` |
| Metrics security | HTTPS with authentication and authorization when enabled | Enabled |
| Health probes | `:8081`, `/healthz` and `/readyz` | Same |
| Webhook | HTTPS on port 9443 | Service port 443 forwards to 9443 |
| HTTP/2 | Disabled | Disabled |
| Logging | Slog JSON at info on stderr | Same |

Both health endpoints use a ping check; they do not certify registry access, image verification, or node scheduler health.

Reconcile controls are exposed as flags and corresponding `controller` chart values:

| Flag | Default |
| --- | --- |
| `--reconcile-timeout` | `1m` |
| `--max-concurrent-reconciles` | `2` |
| `--reconcile-rate-limit-qps` | `5` |
| `--reconcile-rate-limit-burst` | `10` |
| `--reconcile-retry-base-delay` | `1s` |
| `--reconcile-retry-max-delay` | `5m` |

The timeout bounds a reconcile attempt. Failed reconciles use exponential backoff plus a shared retry rate limit. These QPS and burst settings limit failed-reconcile requeues, not all Kubernetes API traffic.

## Failure handling

| Failure | Behaviour |
| --- | --- |
| Leader exits | Another manager can acquire the lease. Existing scheduler pods continue running. |
| Registry or signature verification fails at admission | The create or update is rejected. |
| Image verification fails during reconciliation | `Degraded=True` with `ImageVerificationFailed`; the controller retries. Any existing DaemonSet is left unchanged. |
| API read or DaemonSet write fails | A reconcile error is retried; sked attempts to report `ReconcileFailed`. |
| Status write fails | The attempt returns an error. A `StatusUpdateFailed` event is attempted except for conflict/not-found responses. Status can be stale. |
| Scheduler pod fails to start or attach | DaemonSet availability may expose the failure. Kernel attachment itself is not checked. |
| Policy cannot be reloaded | The previous policy remains, or built-in defaults apply at startup. See [policy failure behaviour](./trust-policy#policy-updates-and-failure-behaviour). |

## Code map

Paths are relative to [schedkit/sked](https://github.com/schedkit/sked):

| Path | Responsibility |
| --- | --- |
| `cmd/main.go` | Manager setup, flags, servers, policy store and verifier wiring. |
| `api/v1/scheduler_types.go` | Spec, status, conditions, and CRD generation markers. |
| `internal/controller/scheduler_controller.go` | Reconciliation, workload creation, watches, and status writes. |
| `internal/controller/nodes.go` | Node selection and winner selection. |
| `internal/controller/status.go`, `events.go` | Conditions, counters, and event transitions. |
| `internal/webhook/v1/scheduler_webhook.go` | Admission checks. |
| `internal/trust/` | Policy parsing, reloads, and Cosign verification. |
| `internal/logging/` | Slog backend and logging flags. |
| `charts/sked/`, `config/` | Helm chart and Kustomize manifests. |
