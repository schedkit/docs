---
id: development
title: Development
---

# Development

Run these commands from the [sked repository](https://github.com/schedkit/sked), not this documentation repository.

The module is `github.com/schedkit/sked`. The current checkout uses Go 1.27 and controller-runtime v0.25.2, with Kubebuilder v4 layout. Check `go.mod` and the Makefile for the versions required by the revision you are building.

## Build

Install Go and a C compiler for race-enabled tests. Docker is used for image and Kind tests; Helm is needed for chart tests. The Makefile downloads Go-based generation and test tools into `bin/` as needed.

```bash
git clone https://github.com/schedkit/sked.git
cd sked
make build
```

`make build` regenerates manifests and deepcopy code, formats and vets Go code, then writes `bin/manager`.

```bash
make docker-build IMG=ghcr.io/your-org/sked:dev
make docker-push IMG=ghcr.io/your-org/sked:dev
```

`CONTAINER_TOOL=podman` selects Podman for image targets, though the cluster tests use Docker and Kind. Published controller images target Linux AMD64 and ARM64.

## Run in a development cluster

Install cert-manager, make the image available to the cluster, then install the local chart:

```bash
helm install sked ./charts/sked \
  --namespace sked-system --create-namespace \
  --set image.repository=ghcr.io/your-org/sked \
  --set image.tag=dev \
  --wait --timeout 5m
```

Alternatively, use `make deploy IMG=ghcr.io/your-org/sked:dev` for Kustomize. Do not run both installations in one cluster.

For host-side debugging, `make install` installs only the CRD, and `make run` starts the manager with your kubeconfig. This is not a complete installation: the always-on webhook server needs `tls.crt` and `tls.key` under `/tmp/k8s-webhook-server/serving-certs`, and admission requests need a webhook endpoint reachable by the API server with the corresponding CA configuration. Set the workload and trust-policy namespaces explicitly when running outside a pod. Avoid running an unelected local reconciler alongside an installed controller.

Kind is useful for API, reconciliation, and chart tests. Its nodes share the host kernel; Kind does not supply `sched_ext` support. Tests that establish actual attachment need a compatible host kernel, scheduler image, and runtime permissions. A passing chart test alone does not establish kernel compatibility.

## Generate manifests

After changing API types or generation markers:

```bash
make generate
make manifests
make helm-sync
```

Generated outputs include:

- `api/v1/zz_generated.deepcopy.go`
- `config/crd/bases/sked.schedkit.io_schedulers.yaml`
- `config/rbac/role.yaml`
- `config/webhook/manifests.yaml`
- `charts/sked/crds/` and `charts/sked/files/`

Edit the API, markers, or source files under `config/`, not the generated chart copies. `make verify-generated` fails if regenerated files under `api/` or `config/` have uncommitted changes; `make verify-helm` checks chart copies. Include generated changes with the source changes.

## Test

```bash
make test
make coverage
go build ./...
make lint
make test-helm
```

- `make test` runs tests excluding `/e2e`, with the race detector and an envtest API server. It writes `cover.out`.
- `make coverage` checks total statement coverage against a 40% minimum. Set `COVERAGE_THRESHOLD` to try another threshold.
- `make lint` runs the pinned golangci-lint version; `make lint-fix` applies supported automatic fixes.
- `make test-helm` checks generated chart files, lints the chart, and tests rendered resources against Kustomize. CI tests Helm 3 and 4.

Cluster tests have separate entrypoints:

```bash
make test-e2e
make test-helm-e2e
```

`make test-e2e` expects an existing Kind cluster named `kind`; it builds and loads the manager image and deploys test dependencies. Prometheus and cert-manager installation can be skipped with `PROMETHEUS_INSTALL_SKIP=true` and `CERT_MANAGER_INSTALL_SKIP=true` when those dependencies are already available.

`make test-helm-e2e` creates a temporary Kind cluster with two workers, exercises installation, leader failover, eviction protection, upgrade, rollback, and uninstall, then removes the cluster.

## Logging

The default is newline-delimited Slog JSON at info level on stderr. For local debugging, pass:

```text
--log-format=text --log-level=debug
```

`--log-level=debug` enables Logr `V(1)` through `V(4)`. Use `--log-verbosity=2` instead for an exact `V(2)` threshold. Do not explicitly combine `--log-level` and `--log-verbosity`; startup rejects that configuration. All legacy `--zap-*` flags are rejected too.

JSON fields include `time`, `level`, `msg`, optional `logger`, and `err`. Logger names are slash-separated and severity names use Slog's native form. No-op reconciles log at `V(1)`; workload changes remain visible at info.

Use `log.FromContext(ctx)` to preserve reconcile context. Log object references or selected fields rather than whole Kubernetes objects. Do not log Secret contents or complete trust policies. See the [upstream logging reference](https://github.com/schedkit/sked#controller-logging) for migration details.

## Package a release

```bash
make build-installer IMG=ghcr.io/your-org/sked:dev
bash hack/package-helm.sh v1.2.3 /tmp/sked-chart
```

The first command renders `dist/install.yaml`. The second illustrates chart packaging for a release tag: `v1.2.3` produces chart version `1.2.3` and `appVersion: v1.2.3` without changing the checked-in `Chart.yaml`.

The release workflow publishes and signs the controller image, attaches the chart to the GitHub Release, and publishes it to `https://charts.schedkit.io`. Chart and controller versions are released together. Follow the [release instructions](https://github.com/schedkit/sked#releases-and-helm-repository) for tag rules and repository setup.
