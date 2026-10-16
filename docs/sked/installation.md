---
id: installation
title: Installation
---

# Installation

Install sked with the Helm chart or the Kustomize manifests. Use **one installation per cluster**: every controller watches all Scheduler objects. Do not install the chart alongside a Kustomize deployment; Helm does not adopt that installation's resources.

## Prerequisites

- Helm 3 or 4 and `kubectl`, with permission to create CRDs, cluster RBAC, and admission webhooks.
- [cert-manager](https://cert-manager.io/docs/installation/) for the default webhook certificate setup. You can instead [supply a certificate](#webhook-certificates).
- Nodes with `sched_ext` support: Linux 6.12 or later with `CONFIG_SCHED_CLASS_EXT=y`, BPF support, and BTF, plus any requirements of the scheduler image. sked does not check node kernels.
- A workload namespace that permits privileged pods. The manager runs non-root with capabilities dropped; scheduler pods run privileged. Helm does not configure a Pod Security exemption for them.
- Network access from controllers to the image registry and Sigstore trust-root services for verification, and from nodes to the registry for image pulls. See [private and mirrored registries](./trust-policy#private-and-mirrored-registries) for restricted networks.

You do not need schedctl on the nodes.

## Install with Helm

```bash
helm repo add schedkit https://charts.schedkit.io
helm repo update
helm install sked schedkit/sked \
  --namespace sked-system --create-namespace \
  --wait --timeout 5m
```

Add `--version <chart-version>` to pin a release. Prereleases require an explicit version or `--devel`. Chart archives are also attached to [GitHub Releases](https://github.com/schedkit/sked/releases). From a sked checkout, use `./charts/sked` instead of `schedkit/sked` for a local chart install.

With the release name and namespace above, the chart installs:

- `schedulers.sked.schedkit.io`, the cluster-scoped Scheduler CRD;
- `sked-controller-manager`, a two-replica Deployment with leader election;
- a PodDisruptionBudget with `minAvailable: 1` and soft spreading across nodes;
- controller and leader-election RBAC, including DaemonSet access;
- a validating webhook, its Service, and cert-manager certificate resources;
- a default image trust-policy ConfigMap;
- an authenticated HTTPS metrics Service on port 8443, plus health probes on port 8081.

Scheduler DaemonSets run in `sked-system` by default. They are created by the controller, not by Helm.

### Configure the release

Keep overrides in a values file and pass it with `-f my-values.yaml` on install and upgrade. For example, to separate scheduler workloads from the controller:

```yaml
controller:
  workloadNamespace: schedulers
```

Create `schedulers` first and configure its admission policy to permit privileged workloads. Helm does not create a custom workload namespace. Secrets and ConfigMaps referenced by Scheduler pods must exist there too. Choose the namespace before creating Schedulers; changing it is not a workload migration mechanism.

Common values:

| Value | Default / use |
| --- | --- |
| `image.repository` | `ghcr.io/schedkit/sked` |
| `image.tag` | Chart `appVersion` when unset. |
| `image.digest` | Optional digest; takes precedence over the tag. |
| `imagePullSecrets` | Pull secrets for **controller pods**, in the release namespace. |
| `replicaCount` | `2` |
| `controller.leaderElection` | `true`; required by the chart with multiple replicas. |
| `podDisruptionBudget.enabled` / `minAvailable` | `true` / `1` |
| `topologySpreadConstraints` | `null` uses the default soft spread; `[]` disables it. |
| `nodeSelector`, `tolerations`, `affinity`, `resources` | Configure the **controller**, not scheduler pods. |
| `controller.extraArgs` | Additional manager flags, including logging. |
| `trustPolicy.policy` | Override the [trust policy](./trust-policy). |
| `trustPolicy.existingConfigMap` | Use a separately managed policy ConfigMap. |
| `metrics.serviceMonitor.enabled` | `false`; enable when Prometheus Operator is installed. |
| `networkPolicy.enabled` | `false`; when enabled, restricts metrics ingress to namespaces labelled `metrics: enabled` by default. |

The [chart values](https://github.com/schedkit/sked/blob/main/charts/sked/values.yaml) list all settings.

Two schedulable nodes are needed for protection against a node failure. The default spreading rule allows both replicas on one node. The PDB protects against voluntary evictions, not node failures or direct deletion. More replicas add webhook capacity and failover options, not reconciliation throughput. For a single-replica development install, set `replicaCount: 1` and consider disabling the PDB to allow drains.

The published `latest` and `main` image tags follow the main branch, not the latest release. Release charts select the matching release image. Prefer a release or digest over a moving tag.

### Webhook certificates

The webhook is always enabled. By default the chart creates a self-signed cert-manager Issuer. To use your own issuer:

```yaml
webhook:
  certManager:
    issuerRef:
      name: platform-ca
      kind: ClusterIssuer
```

Without cert-manager, set all of:

- `webhook.certManager.enabled: false`
- `webhook.secretName`: a Secret in the release namespace containing `tls.crt` and `tls.key`
- `webhook.caBundle`: the base64-encoded PEM CA certificate

For the default release, the certificate must cover `sked-webhook-service.sked-system.svc` and `sked-webhook-service.sked-system.svc.cluster.local`. Adjust both names if you change the release's fullname or namespace. You are responsible for rotating a supplied certificate.

### Metrics

To enable a ServiceMonitor and authorize a Prometheus service account:

```yaml
metrics:
  serviceMonitor:
    enabled: true
  readerSubjects:
    - kind: ServiceAccount
      name: prometheus
      namespace: monitoring
```

Set `metrics.serviceMonitor.labels` if Prometheus selects monitors by label. The default monitor skips TLS certificate verification because the metrics server uses a self-signed certificate; the webhook certificate does not configure metrics TLS. Setting `metrics.secure: false` removes both TLS and metrics authentication.

## Verify the install

```bash
kubectl rollout status deployment/sked-controller-manager -n sked-system --timeout=5m
kubectl get pods -n sked-system
kubectl get crd schedulers.sked.schedkit.io
kubectl get certificate -n sked-system
```

The certificate command applies to cert-manager installs. If pods cannot start, inspect pod events for image-pull or missing certificate Secret errors. If Scheduler admission fails, check the webhook Service, certificate readiness, and controller logs. See [Usage](./usage) to create the first Scheduler and verify admission as well as reconciliation.

## Install with Kustomize

The default overlay also enables two replicas, leader election, a PDB, trust policy, and cert-manager-backed webhooks. Install cert-manager first, then choose a published controller tag:

```bash
git clone https://github.com/schedkit/sked.git
cd sked
make deploy IMG=ghcr.io/schedkit/sked:<image-tag>
```

`make deploy` updates the image in `config/manager` and applies `config/default`. Do not apply the unmodified overlay: its `controller:latest` image is a placeholder.

For a single rendered file:

```bash
make build-installer IMG=ghcr.io/schedkit/sked:<image-tag>
kubectl apply -f dist/install.yaml
```

Use a source revision and image from the same release.

## Upgrade and rollback

**Helm does not upgrade CRDs.** Apply the CRD from the chart version you intend to install, then upgrade with the same version and your saved values. Replace the example version below with your chosen release:

```bash
version=1.2.3
helm repo update
helm show crds schedkit/sked --version "$version" | kubectl apply -f -
helm upgrade sked schedkit/sked --version "$version" \
  --namespace sked-system -f my-values.yaml \
  --wait --timeout 5m
```

For a local checkout, apply `charts/sked/crds/` before upgrading from `./charts/sked`. Do not change the release name, namespace, `nameOverride`, or `fullnameOverride` during an upgrade; they determine resource names and Deployment selectors.

Remove all `--zap-*` flags from custom Deployments and `controller.extraArgs`, including saved values, before upgrading from a Zap-based controller. They now prevent startup. Use `--log-format=text` and `--log-verbosity=1` to retain the old development output and verbosity, or omit logging flags for JSON/info defaults.

```bash
helm history sked --namespace sked-system
helm rollback sked <revision> --namespace sked-system --wait --timeout 5m
```

Rollback does not restore CRDs or Scheduler objects. Check schema compatibility and restore flags supported by the old binary. Moving from the old `SchedExt` API requires a [separate migration](./crds#migrating-from-schedext), not just a Helm upgrade.

## Uninstall

Helm uninstall removes the operator but **leaves the CRD, Scheduler objects, and scheduler DaemonSets running**. To stop schedulers, delete their Scheduler objects and wait for workload deletion first. For example:

```bash
kubectl delete scheduler scx-rusty
kubectl wait --for=delete daemonset/scx-rusty -n sked-system --timeout=2m
helm uninstall sked --namespace sked-system
```

Repeat the deletion for each Scheduler you intend to stop, using the configured workload namespace. Check that the pods have terminated before treating the nodes as returned to their default CPU scheduler.

For a Kustomize installation, `make undeploy` deletes the default overlay, **including the CRD and namespace**. Unlike Helm uninstall, it removes all Scheduler objects and their owned workloads. Deleting `schedulers.sked.schedkit.io` manually has the same cluster-wide effect on Scheduler objects. Export anything you need to retain before deleting the CRD.
