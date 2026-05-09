---
id: installation
title: Installation
---

# Installation

sked is currently shipped as Kustomize manifests under `config/` in the [sked repository](https://github.com/schedkit/sked). There is no Helm chart yet. Installing the operator means getting the controller-manager Deployment and the `SchedExt` CRD into the cluster; from there, applying `SchedExt` resources causes per-scheduler DaemonSets to come into existence.

## Cluster prerequisites

Before installing sked, the cluster needs to satisfy a few things:

- Every node where you intend to run a scheduler must have a kernel with `sched_ext` support — 6.12 or later, with `CONFIG_SCHED_CLASS_EXT=y` and the supporting `CONFIG_BPF*` and `CONFIG_DEBUG_INFO_BTF` flags. sked itself does not check this; the scheduler container will simply fail to attach if the kernel can't host it.
- Every node must have a working container runtime (containerd is the typical choice for Kubernetes nodes; this is fine).
- Your cluster needs to allow privileged DaemonSet pods. Each scheduler pod is created with `securityContext.privileged: true`. If you have a Pod Security policy or admission controller that strips privileges, the scheduler will fail to load BPF.

You do *not* need to install schedctl on the nodes. The cluster path runs the OCI scheduler image directly via the kubelet's container runtime; it does not invoke schedctl on the host.

## Installing the operator

Clone the repo and apply the default Kustomize overlay:

```bash
git clone https://github.com/schedkit/sked.git
cd sked
kubectl apply -k config/default
```

This installs:

- The `sked-system` namespace (labelled `control-plane: controller-manager`).
- The `schedexts.sked.schedkit.io` CRD.
- A `sked-controller-manager` Deployment with one replica running the operator binary.
- A `ServiceAccount`, `ClusterRole`, and `ClusterRoleBinding` for the controller (`sked-controller-manager` / `sked-manager-role`).
- Leader-election RBAC (Role + RoleBinding) inside `sked-system`.
- A metrics `Service` (`sked-controller-manager-metrics-service`) on port 8443 (HTTPS, with authn/authz filtering enabled).
- Liveness and readiness probes on port 8081.

By default the controller image is `controller:latest` — a placeholder. To install with a real image, override `IMG` and use `make deploy` (which patches the image reference via `kustomize edit set image`):

```bash
make deploy IMG=ghcr.io/schedkit/sked:v0.x.x
```

`make deploy` does the same `kubectl apply -k config/default` after rewriting the image, and is what most users should run.

## Generating a single install YAML

If you'd rather have a single file to apply (or to ship to an offline cluster), the repo's `make build-installer` target produces one:

```bash
make build-installer IMG=ghcr.io/schedkit/sked:v0.x.x
```

This writes `dist/install.yaml`, which is the kustomize-rendered output of `config/default`. Apply it with `kubectl apply -f dist/install.yaml`.

## Verifying the install

A few seconds after applying:

```bash
kubectl get pods -n sked-system
kubectl get crd schedexts.sked.schedkit.io
```

You should see a single `sked-controller-manager-*` pod running, and the CRD listed. If the pod is in `CrashLoopBackOff`, the most common causes are:

- The image reference is the placeholder `controller:latest` and your cluster can't pull it. Override `IMG` and re-deploy.
- The cluster's Pod Security admission is rejecting the manager pod's security context. The default manifest runs the manager as non-root with all capabilities dropped, but very strict policies still need explicit exceptions.
- RBAC for the leader-election lease can't be acquired — usually a sign that the operator was previously installed in a different namespace and is fighting with a stale lease.

Once the controller is healthy you can apply a `SchedExt`. See [Usage](./usage) for the walkthrough.

## A note on RBAC

The generated `ClusterRole` (`sked-manager-role`) currently grants verbs on `schedexts`, `schedexts/status`, and `schedexts/finalizers`. It does **not** explicitly grant verbs on `apps/daemonsets`, even though the controller creates and patches DaemonSets. In practice this means a strict cluster will refuse those writes — if you see `forbidden: User "system:serviceaccount:sked-system:sked-controller-manager" cannot create resource "daemonsets"`, that's the cause. The fix is to extend the ClusterRole with the missing rule. There's a tracked issue for adding this to the generated manifests; until it lands, a small kustomize patch under your install does the job.

## Air-gapped installs

The cluster path needs:

- The controller image (whatever you pass as `IMG`).
- Every scheduler image you intend to reference from `SchedExt.spec.sched`.

Mirror both into an internal registry, override `IMG` for the controller deploy, and use the mirrored references in your `SchedExt` resources. The controller does not pull scheduler images itself — the kubelet does, on each node — so your nodes need credentialed access to wherever the scheduler images live.

## Uninstalling

```bash
make undeploy
```

`make undeploy` runs `kustomize build config/default | kubectl delete -f -`, which removes the controller, its RBAC, and the CRD. **Deleting the CRD also deletes every `SchedExt` of that kind**, and via owner references that cascades to deleting the corresponding DaemonSets and pods. Schedulers on the nodes will detach as the pods exit; the kernel reverts to its default policy.

If you only want to remove the operator and keep the existing `SchedExt` resources (they'll have no controller and won't be reconciled, but they won't be deleted), use:

```bash
kubectl delete -k config/manager
kubectl delete -k config/rbac
```

This leaves the CRD and any `SchedExt` resources intact. Reinstalling the controller later will pick them back up.
