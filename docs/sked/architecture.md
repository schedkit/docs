---
id: architecture
title: Architecture
---

# Architecture

This page is for people who want to understand what's actually happening inside sked, either because they're contributing or because they're debugging a behaviour the user-facing docs don't cover.

If you only want to *use* sked, [Usage](./usage) is enough. Come back here when something is doing things you didn't expect.

## A single-process operator

sked is, today, **one binary** running as a Deployment in `sked-system`. There is no per-node agent. There is no controller-to-agent protocol. The operator's only job is to watch `SchedExt` resources and create the corresponding `DaemonSet` for each one. The kubelet on each node then handles starting the scheduler pod, just like any other pod.

It's a kubebuilder-scaffolded operator using `controller-runtime` (currently v0.19.x). The relevant pieces:

- `cmd/main.go` — sets up the manager, registers the `SchedExt` scheme, configures metrics/healthz, optionally enables leader election.
- `internal/controller/schedext_controller.go` — the only reconciler. Watches `SchedExt` and writes `DaemonSet`.
- `api/v1/schedext_types.go` — the CRD type. Single field on the spec, empty status struct.

That's the whole operator. There is no controller-to-agent protocol because there is no agent.

## The reconcile loop

The reconciler is small enough to summarise in a few lines.

```go
func (r *SchedExtReconciler) Reconcile(ctx, req) {
    var scx SchedExt
    if err := r.Get(ctx, req.NamespacedName, &scx); err != nil {
        return // notfound is ignored
    }

    ds := &DaemonSet{Name: req.Name, Namespace: req.Namespace}
    CreateOrPatch(ctx, ds, func() error {
        SetControllerReference(&scx, ds, scheme)
        ds.Labels["managed-by"] = "sked-controller"
        ds.Spec = DaemonSetSpec{
            Selector: matchLabels{"name": req.Name},
            Template: PodTemplate{
                Labels: {"name": req.Name, "managed-by": "sked-controller"},
                Spec: PodSpec{
                    Containers: []Container{{
                        Name:  "scx",
                        Image: scx.Spec.Sched,
                        SecurityContext: {Privileged: true},
                    }},
                },
            },
        }
        return nil
    })
}
```

That's it. There's no status update. No conditions. No selectors derived from the resource. The reconciler is invoked on `SchedExt` events; it watches `SchedExt` resources only via `For(&SchedExt{})` and does not own or watch `DaemonSet` events explicitly. (Owner references mean the kubebuilder default does watch DaemonSets owned by SchedExts implicitly, but the reconciler doesn't react to DaemonSet status changes.)

## What the manager configures

The manager wiring in `cmd/main.go` enables a few standard pieces:

- **Leader election** via `--leader-elect` (off by default). The lease ID is `b4c95cb3.schedkit.io`, in whatever namespace the manager runs.
- **Metrics** on `--metrics-bind-address` (defaults to `0`, i.e. disabled, but the kustomize patch in `config/default` flips it to `:8443`). With `--metrics-secure=true` (default), an authn/authz filter from `controller-runtime/pkg/metrics/filters` is applied.
- **Health probes** on `--health-probe-bind-address` (defaults to `:8081`). Both `/healthz` and `/readyz` are wired to `healthz.Ping`.
- **HTTP/2 disabled by default** for both the metrics and webhook servers (`--enable-http2=false`), as a precaution against the HTTP/2 Stream Cancellation/Rapid Reset CVEs.

There is no webhook server *content* today. Validating/mutating webhook configurations are scaffolded in `config/webhook/` but commented out in the kustomize entrypoint, so the install doesn't deploy them.

## Communication with nodes

There is none, in any direct sense. The operator writes to the API server; the kubelets watch their own DaemonSet pods; the kubelets pull the scheduler image and start the container. From the operator's perspective, the work ends when the DaemonSet object is patched.

This means:

- Changes to `SchedExt.spec.sched` produce a DaemonSet patch, which produces a DaemonSet rolling update, which produces pod restarts on each node — at whatever cadence the DaemonSet's update strategy permits. The operator does not coordinate the rollout itself.
- Failures on a specific node (image pull failure, BPF verifier rejection, etc.) show up on the *pod* on that node, not on the `SchedExt` resource. `kubectl describe pod` and `kubectl logs` are where you look.
- The operator has no view of `/sys/kernel/sched_ext` on any node. It does not know whether the scheduler successfully attached.

## Failure modes

**Controller crash.** Recoverable. The Deployment restarts the manager. Existing DaemonSets keep their pods, so already-attached schedulers stay loaded across the restart.

**API server unreachable.** Standard `controller-runtime` behaviour: the manager retries with backoff. New `SchedExt` events are queued by the watch's resync; existing scheduler pods on the nodes keep running because their lifecycle is now between the kubelet and the kernel.

**Pull failure on a node.** Surfaces on the pod, not the resource. `kubectl describe pod` shows `ErrImagePull` / `ImagePullBackOff`.

**Scheduler fails to attach (BPF verifier, missing CONFIG_*, etc.).** The pod stays running (the entrypoint usually exits non-zero, which CrashLoops the pod) but the kernel does not have a scheduler attached. There's no signal back to the operator. `kubectl logs` on the pod is the only signal.

**Two `SchedExt` resources whose pods land on the same node.** The kernel attaches one and refuses the other. The losing pod will crashloop. Avoid this with cluster-level scheduling rules (taints, labels) until the CRD grows node selection.

**Missing RBAC for DaemonSets.** The shipped ClusterRole grants verbs on `schedexts*` but does not currently include `apps/daemonsets`. On a strict cluster, the controller will get `forbidden` from the apiserver when patching DaemonSets. The fix is a kustomize patch extending the ClusterRole. There's a tracked issue for adding this to the generated manifests.

## What sked is *not* doing

Worth being explicit about a few things, because they come up:

- It's not a Kubernetes scheduler. The Kubernetes scheduler decides which pod runs on which node. sked decides which `sched_ext` scheduler the *kernel* on each node uses to multiplex CPU between threads. The two operate at completely different layers.
- It's not a service mesh, sidecar, or admission controller. The DaemonSet pod does not interpose on workload pods.
- It's not collecting workload telemetry. There is no logic to choose schedulers based on observed workload behaviour; the choice is exactly what you put in `spec.sched`.
- It does not invoke `schedctl`. The host CLI and the operator are independent code paths today.
- It does not verify image signatures. If signature verification is a requirement for your cluster, configure it at admission time (e.g. with `policy-controller`).

If you want any of those things, sked is not the right tool yet, and we'd rather you knew that than tried to make it fit.
