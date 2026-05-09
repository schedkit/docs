---
id: crds
title: CRD reference
---

# CRD reference

This page documents the Custom Resources sked introduces. There is exactly one today.

## `SchedExt`

`SchedExt` is the operator's only CRD. It tells sked: "run *this* scheduler image as a privileged DaemonSet in this namespace."

| | |
| --- | --- |
| Group | `sked.schedkit.io` |
| Version | `v1` |
| Kind | `SchedExt` |
| Plural | `schedexts` |
| Singular | `schedext` |
| Scope | Namespaced |
| Subresources | `status` (declared, but currently never written to) |

The CRD has no short names, no printer columns, and no additional kubectl output customisation. `kubectl get schedexts` lists by name, age, and the standard metadata.

### Example

```yaml
apiVersion: sked.schedkit.io/v1
kind: SchedExt
metadata:
  name: scx-rusty
  namespace: default
spec:
  sched: ghcr.io/schedkit/scheds/scx_rusty:latest
```

Applying this causes the controller to create a DaemonSet named `scx-rusty` in the `default` namespace. Every node that the DaemonSet's pod-scheduling rules let it run on will end up with a privileged pod running the `scx_rusty` scheduler.

### Spec fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `spec.sched` | string | yes | Fully-qualified OCI image reference for the scheduler. Used verbatim as the container image. |

That's the entire spec. There is no `imagePullPolicy`, no `nodeSelector`, no `tolerations`, no `priority`. If you need to constrain which nodes the scheduler runs on, do it at the cluster level (taint the nodes you don't want, or expect a future version of the CRD to expose these fields).

There is also no validation on `spec.sched` — the field accepts any string. If the value isn't a valid image reference, the kubelet will fail to pull at pod creation time, and you'll see the error on the DaemonSet's pods rather than at admission.

### Status fields

`status` is declared on the type, the CRD has the `status` subresource enabled, and the operator never writes to it. Every `SchedExt` you create will report an empty `status: {}` block. Conditions, phase, and matched/running node counts are not reported today.

This is one of the rougher edges of the current operator and is on the to-do list.

### What gets created

When you apply a `SchedExt`, the controller creates (or patches, on update) one resource:

A `DaemonSet` with:

- the same name and namespace as the `SchedExt`;
- an owner reference to the `SchedExt` (so deleting the `SchedExt` cascades to deleting the DaemonSet and its pods);
- a label `managed-by: sked-controller` on the DaemonSet itself;
- a pod selector `matchLabels: {name: <schedext-name>}`;
- pod template labels `name: <schedext-name>` and `managed-by: sked-controller`;
- one container, named `scx`, with `image: <spec.sched>` and `securityContext.privileged: true`.

The DaemonSet has no env vars, no volumes, no init containers, no resource requests, and no node selector or tolerations on the pod template. Pod scheduling is whatever the cluster's defaults are.

## Multiple `SchedExt` resources

The CRD doesn't currently coordinate between resources. If you create two `SchedExt` resources and the resulting DaemonSet pods both end up on the same node, both will try to attach a `sched_ext` scheduler — and the kernel only attaches one at a time. The losing pod will fail to attach and presumably crashloop.

Until the operator gains real node-selection logic, the right way to use it is "one `SchedExt` per intended node set, with cluster-level rules (taints, labels) keeping their pods apart." If you only have one cluster-wide scheduler in mind, the simplest thing is also the working thing: one `SchedExt`, every node gets the same scheduler.
