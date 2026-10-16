---
id: usage
title: Usage
---

# Usage

These commands assume sked is [installed](./installation) as release `sked` in `sked-system`, with the default trust policy and workload namespace. Change the namespace arguments if your DaemonSets run elsewhere. Scheduler resources are cluster-scoped.

## Check the controller and nodes

```bash
kubectl rollout status deployment/sked-controller-manager -n sked-system --timeout=5m
kubectl get crd schedulers.sked.schedkit.io
kubectl get schedulers
```

Check existing Schedulers before adding one: an empty selector claims every node for conflict arbitration.

On each intended node, confirm kernel support and check whether another scheduler is already attached. From a shell on the node:

```bash
ls /sys/kernel/sched_ext
cat /sys/kernel/sched_ext/state
```

Check the scheduler's kernel requirements as well; the directory alone does not establish compatibility. Stop schedulers managed outside sked before targeting those nodes. sked cannot detect conflicts with schedctl or manually started schedulers.

Label the nodes you have checked, replacing the example node name:

```bash
kubectl label node worker-1 schedkit.io/pool=batch
```

Repeat for the other nodes you have checked.

## Create a Scheduler

Save as `scx-rusty.yaml`:

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

The default policy allows this repository and requires a trusted signature. The reconciler resolves the tag to a verified digest. Use an explicit `@sha256:...` digest instead of `:latest` for a fixed deployment.

```bash
kubectl apply -f scx-rusty.yaml
kubectl get scheduler scx-rusty
kubectl get daemonset scx-rusty -n sked-system
kubectl get pods -n sked-system -l name=scx-rusty -o wide
kubectl wait --for=condition=Ready scheduler/scx-rusty --timeout=5m
```

`kubectl get scheduler` shows Ready, Desired, Available, and Age. The DaemonSet should have a pod on each eligible node, excluding nodes assigned to an older Scheduler. Read all conditions even if the wait succeeds: a partially conflicting Scheduler can be ready on its remaining nodes while also degraded.

```bash
kubectl describe scheduler scx-rusty
kubectl get scheduler scx-rusty -o jsonpath='{.status.resolvedImage}{"\n"}'
```

## Verify the kernel state

DaemonSet readiness does not prove that the BPF scheduler attached. On each target node, inspect:

```bash
cat /sys/kernel/sched_ext/state
cat /sys/kernel/sched_ext/root/ops
```

Expect `state` to be `enabled` and `ops` to name the scheduler you deployed. If the scheduler image contains `cat` and exposes those sysfs files, you can also read them from its pod:

```bash
kubectl exec -n sked-system <pod-name> -c scx -- cat /sys/kernel/sched_ext/state
kubectl exec -n sked-system <pod-name> -c scx -- cat /sys/kernel/sched_ext/root/ops
```

Otherwise, run the commands from a node shell. For attachment failures, check the scheduler logs and node kernel logs:

```bash
kubectl logs -n sked-system <pod-name> -c scx
```

The kernel checks in [schedctl troubleshooting](../schedctl/troubleshooting) also apply to scheduler images run by sked.

## Change configuration

Edit `scx-rusty.yaml` and reapply it, or run:

```bash
kubectl edit scheduler scx-rusty
```

Changing the image, arguments, environment, or other pod-template fields causes a DaemonSet rolling update. sked does not expose rollout tuning or automatic rollback. To revert, restore the previous Scheduler spec, preferably with its recorded image digest.

After an update, compare `status.observedGeneration` and each condition's `observedGeneration` with `metadata.generation`. Until the controller processes the change, conditions may describe the previous spec.

### Tainted nodes

Add a toleration to the Scheduler when the selected nodes have a matching taint:

```yaml
spec:
  sched: ghcr.io/schedkit/scx_rusty:latest
  nodeSelector:
    schedkit.io/pool: batch
  tolerations:
    - key: dedicated
      operator: Equal
      value: batch
      effect: NoSchedule
```

Keep the selector: a toleration permits placement but does not restrict it. Set these fields on the Scheduler, not on the generated DaemonSet or the chart's controller placement values.

### Different schedulers on different pools

Create one Scheduler per pool, with non-overlapping selectors. For example, keep `scx-rusty` on `schedkit.io/pool=batch` and use a separate Scheduler for nodes labelled `schedkit.io/pool=latency`.

If selectors overlap, the oldest Scheduler wins each node. Losers exclude conflict nodes or lose their entire DaemonSet if all selected nodes conflict. Conflicts appear in `Degraded` with reason `SchedulerConflict`. Tolerations and pod health do not affect the winner. See the [CRD reference](./crds#overlapping-selectors) before changing labels on a live pool.

## Diagnose a failed deployment

Start with the resource, then the DaemonSet and pods:

```bash
kubectl describe scheduler scx-rusty
kubectl describe daemonset scx-rusty -n sked-system
kubectl get pods -n sked-system -l name=scx-rusty -o wide
kubectl get events -n default \
  --field-selector involvedObject.kind=Scheduler,involvedObject.name=scx-rusty \
  --sort-by=.metadata.creationTimestamp
kubectl logs -n sked-system -l control-plane=controller-manager -c manager --tail=100
```

Scheduler events live in `default` because the resource is cluster-scoped. Pod and DaemonSet events live in the workload namespace.

| Symptom | Check |
| --- | --- |
| `kubectl apply` is rejected | Webhook availability, spec validation, caller authorization, allowlist, registry access, and signature identity. Admission failure may mean no Scheduler exists yet. |
| `ImageVerificationFailed` | Controller logs and [trust policy](./trust-policy). Existing workloads are not replaced on verification failure. |
| `SchedulerConflict` | Other Schedulers' selectors and creation times; avoid overlap. |
| `NoNodesScheduled` | Node labels, taints, tolerations, and DaemonSet events. |
| Pods rejected by admission | The **workload namespace** must allow privileged containers. |
| `ErrImagePull` / `ImagePullBackOff` | Pod events, the resolved image, and `spec.imagePullSecrets` in the workload namespace. |
| `NodesUnavailable` or crashing pods | `kubectl describe pod`, container logs, node kernel support, and any competing scheduler outside sked. |
| Ready pods but no attached scheduler | Kernel sysfs and logs. There is no kernel-aware readiness probe. |

Do not patch the generated DaemonSet to fix its configuration; the controller will replace that spec. Use the Scheduler fields listed in the [CRD reference](./crds).

## Stop a scheduler

```bash
kubectl delete scheduler scx-rusty
kubectl wait --for=delete daemonset/scx-rusty -n sked-system --timeout=2m
kubectl get pods -n sked-system -l name=scx-rusty
```

Kubernetes garbage-collects the owned DaemonSet and pods. Wait for the pods to terminate and check kernel state. The kernel returns to its default scheduling policy when the scheduler detaches, unless another scheduler attaches in its place. Deleting the winner can let a previously conflicting Scheduler claim those nodes.

Deleting the operator's Helm release alone does **not** stop scheduler workloads. See [Uninstall](./installation#uninstall).
