---
id: usage
title: Usage
---

# Usage

This page is a practical walkthrough: from a freshly-installed sked to a running scheduler on every node in the cluster.

It assumes you've already installed the operator ([Installation](./installation)) and have `kubectl` access to the cluster. It also assumes you're comfortable with the operator's current scope: a single `SchedExt` resource creates a privileged DaemonSet that runs a `sched_ext` scheduler everywhere the DaemonSet's default pod-scheduling rules let it run. There is no node selector or priority on the CRD today — see [CRD reference](./crds) for the precise shape.

## Step 1: confirm the operator is healthy

Before applying any `SchedExt`, make sure the controller is up:

```bash
kubectl get pods -n sked-system
kubectl get crd schedexts.sked.schedkit.io
```

Look for one `sked-controller-manager-*` pod in `Running` and the CRD listed. If the controller pod is in `CrashLoopBackOff`, fix that before applying anything — without a controller, an applied `SchedExt` won't create its DaemonSet.

## Step 2: confirm the nodes can run a sched_ext scheduler

The operator does not preflight the kernel for you. The scheduler container will simply fail to attach if the kernel can't host it. A quick spot check on a node before rolling sked out widely:

```bash
kubectl debug node/<node-name> --image=alpine -- ls /host/sys/kernel/sched_ext
```

(or SSH into the node and `ls /sys/kernel/sched_ext`). On every node where you'd run a scheduler, you want that directory to exist. If your fleet is heterogeneous, you'll want a node selector at the cluster level keeping the DaemonSet pods away from kernels that don't support sched_ext — see *Constraining where the scheduler runs* below.

## Step 3: apply your first `SchedExt`

Create a file called `scx-rusty.yaml`:

```yaml
apiVersion: sked.schedkit.io/v1
kind: SchedExt
metadata:
  name: scx-rusty
  namespace: default
spec:
  sched: ghcr.io/schedkit/scheds/scx_rusty:latest
```

Apply it:

```bash
kubectl apply -f scx-rusty.yaml
```

Within a few seconds the controller will reconcile and create the DaemonSet:

```bash
kubectl get schedexts -A
kubectl get daemonset scx-rusty -n default
kubectl get pods -l name=scx-rusty -n default
```

You should see one DaemonSet, and one pod per node where the DaemonSet was scheduled. The pods are owned by the DaemonSet, which is owned by the `SchedExt`.

Important: `kubectl get schedexts` will not report any status today. The CRD has a status subresource declared but the controller never writes to it. To gauge health, look at the DaemonSet's `numberReady` / `desiredNumberScheduled` and the pods' state directly.

## Step 4: verify on a node

To confirm the scheduler is actually loaded on a node:

```bash
kubectl exec -n default <pod-name> -- cat /sys/kernel/sched_ext/state
kubectl exec -n default <pod-name> -- cat /sys/kernel/sched_ext/root/ops
```

Because the pod runs privileged, it has access to the host's `/sys` and the values you read are the kernel's view. `state` should be `enabled`, and `ops` should be the scheduler's struct_ops name.

If `state` is `disabled`, look at the pod's logs:

```bash
kubectl logs -n default <pod-name>
```

A scheduler container can fail to attach for the same reasons a host-side `schedctl run` can fail: BPF verifier rejecting the program, missing CONFIG_*, missing BTF, or LSM denials. The [schedctl troubleshooting guide](../schedctl/troubleshooting) covers the kernel-side modes; they apply identically here.

## Common operations

### Update a scheduler image

Edit the resource and re-apply:

```bash
kubectl edit schedext scx-rusty
```

Change `spec.sched`. The controller patches the DaemonSet, which triggers a rolling pod update. The default DaemonSet update strategy applies — that's what governs how the rollout proceeds. The operator does not currently expose any roll-out tuning of its own.

### Stop a scheduler

Delete the `SchedExt`:

```bash
kubectl delete schedext scx-rusty
```

The owner reference cascade deletes the DaemonSet and its pods. As pods exit, `sched_ext` ops detach in the kernel and the affected nodes revert to their default scheduling policy.

### Constraining where the scheduler runs

Because the CRD has no `nodeSelector` field, you can't tell sked "only run on these nodes" via the resource itself. The current options are:

1. **Taint the nodes you don't want the DaemonSet on.** Without a corresponding toleration on the pod template, the DaemonSet won't schedule there. The operator has no way to add tolerations today, so this is one-directional — you exclude nodes, you can't include otherwise-tainted nodes.
2. **Run only one scheduler cluster-wide.** This is the simplest path and works fine when your cluster is homogeneous.
3. **Wait for the CRD to grow these fields.** They're on the to-do list. Pinning yourself to clever workarounds is probably not worth it unless you have to ship today.

### Multiple scheduler images on different node sets

Today, ill-advised. The kernel attaches one `sched_ext` scheduler at a time per node, and applying two `SchedExt` resources without keeping their DaemonSet pods apart will land both on the same nodes — only one will attach, the other will fail. If you really need this before the CRD grows node selection, your options are:

- Use node taints/labels and the cluster's own DaemonSet scheduling rules (which sked can't influence per-resource today) to ensure the two `SchedExt` resources' pods don't overlap. In practice that means you need to *patch* the generated DaemonSet to add a node selector after the fact, which is fragile.
- Run only one `SchedExt` and accept a single cluster-wide scheduler.

## Things to know

A few practical notes that aren't quite "troubleshooting" but are worth absorbing early.

**There is no status to look at on the resource.** Until the controller writes status, `kubectl describe schedext` is mostly an echo of `spec`. Look at the DaemonSet and its pods for actual health.

**There is no image signature verification on the cluster path.** schedctl verifies cosign signatures on the host; sked currently does not. If supply-chain integrity matters for your cluster, you'll want admission-controller-level image policy (e.g. `policy-controller`, `cosign-controller`) until the operator gains its own verification.

**Privileged pods are required.** The DaemonSet creates pods with `securityContext.privileged: true`. If your cluster's Pod Security admission level is set to `baseline` or `restricted`, the pods will be rejected. The `sked-system` namespace itself is *not* labelled to bypass admission, so the *namespace where you create `SchedExt` resources* needs to permit privileged workloads.

**`kubectl describe daemonset <name>`** is the most useful command when something looks wrong. The events show pull errors, admission rejections, and node-selection issues in plain language.

## Where to next

- [CRD reference](./crds) for the full field-by-field schema.
- [Architecture](./architecture) if you want to understand what the controller is actually doing.
- [schedctl troubleshooting](../schedctl/troubleshooting) if a node's scheduler refuses to attach — those are kernel-layer problems, not sked-layer ones.
