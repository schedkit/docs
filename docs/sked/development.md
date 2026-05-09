---
id: development
title: Development
---

# Development

This page is for contributors to sked itself. If you're trying to use sked, [Usage](./usage) and [Installation](./installation) are the right places.

## Layout

sked is a kubebuilder v4 project. The layout is the standard one:

```
sked/
├── api/v1/                 # CRD types (SchedExt)
├── cmd/main.go             # the manager entrypoint (one binary)
├── config/                 # kustomize manifests for deployment
│   ├── crd/                # CRD YAML (controller-gen output)
│   ├── default/            # the kustomize entrypoint installed by `make deploy`
│   ├── manager/            # Deployment + Service + Service for metrics
│   ├── rbac/               # ClusterRole, RoleBinding, ServiceAccount, leader-election RBAC
│   ├── prometheus/         # ServiceMonitor (commented out by default)
│   ├── webhook/            # webhook scaffolding (commented out by default)
│   ├── network-policy/     # optional NetworkPolicies (commented out by default)
│   └── samples/            # sample SchedExt YAML
├── internal/controller/    # the reconciler
├── test/e2e/               # ginkgo e2e suite (kind-based)
├── hack/                   # boilerplate header for generated files
├── Dockerfile              # single-stage builder + distroless runtime
├── Makefile                # standard kubebuilder make targets
├── go.mod
└── PROJECT                 # kubebuilder project metadata
```

There is one binary, `manager`, built from `cmd/main.go`. The "agent" implied by older docs and earlier designs does not exist as a separate binary: the per-node component is the scheduler image itself, run as a privileged DaemonSet pod.

## Module info

- Module: `github.com/schedkit/sked`
- Go: 1.22 (`go 1.22.0` in go.mod)
- controller-runtime: v0.19.0
- kubebuilder layout: `go.kubebuilder.io/v4`
- API group: `sked.schedkit.io`, version `v1`
- Single Kind: `SchedExt`

## Building locally

You'll need Go 1.22+, `make`, and either Docker or Podman for building images. For testing, [kind](https://kind.sigs.k8s.io/) is the path of least friction.

```bash
git clone https://github.com/schedkit/sked.git
cd sked
make build
```

`make build` runs `manifests`, `generate`, `fmt`, `vet`, then `go build -o bin/manager cmd/main.go`. The first call seeds tools (`kustomize`, `controller-gen`, `setup-envtest`, `golangci-lint`) into `./bin/`.

To build a container image:

```bash
make docker-build IMG=<your-tag>
```

Defaults to `IMG=controller:latest` if you don't override. The Makefile also exposes a `docker-buildx` target for multi-arch images (`linux/arm64,linux/amd64,linux/s390x,linux/ppc64le`).

## Running against a cluster

The fastest dev loop runs the controller from your laptop against a real cluster:

```bash
make install              # install CRDs into the cluster
make run                  # run the controller locally with `go run`
```

`make run` runs the same `cmd/main.go` you'd run in the manager pod, but against your local kubeconfig. Apply a `SchedExt` from another terminal and watch the reconcile log on stdout.

To deploy the controller into the cluster proper:

```bash
make deploy IMG=<your-tag>
```

`make deploy` patches `config/manager` with the image you pass, then applies `config/default`. `make undeploy` reverses it.

Note: kind nodes don't have `sched_ext` and the kernel can't host a `sched_ext` scheduler regardless. For testing the *operator's* logic — that the right DaemonSet gets created — kind is fine. For end-to-end testing with an actual scheduler attached, you need a cluster running on machines (or VMs) with `sched_ext` kernels.

## Code generation

CRD types live in `api/v1/`. After editing a type:

```bash
make generate             # regenerate zz_generated.deepcopy.go
make manifests            # regenerate CRD YAML and RBAC
```

Both invocations are `controller-gen` wrappers (`v0.16.4` is pinned by the Makefile). The build target depends on these, so `make build` and `make test` regenerate before running. Commit the regenerated files alongside your type changes; CI will fail if they drift.

## Tests

```bash
make test                 # unit tests + envtest-backed integration
make test-e2e             # full kind cluster, ginkgo
```

`make test` runs `go test` with `KUBEBUILDER_ASSETS` pointed at a downloaded `setup-envtest` binary, which spins up a local etcd + apiserver pair to test the reconciler against. It excludes the `test/e2e` package.

`make test-e2e` requires a running kind cluster (`kind create cluster`). It builds the manager image, loads it into kind, deploys, and runs the ginkgo suite. By default it also installs Prometheus Operator and CertManager — both can be skipped with environment variables:

```bash
PROMETHEUS_INSTALL_SKIP=true CERT_MANAGER_INSTALL_SKIP=true make test-e2e
```

## Code style

Standard Go style plus what `golangci-lint` enforces. The Makefile pins lint version `v1.59.1`.

- `make fmt` and `make vet` run before `make build`. Don't push code that fails them.
- `make lint` for the full linter set.
- `make lint-fix` applies the auto-fixable subset.

Project-shape opinions:

- Keep the reconciler small. Right now it's about 60 lines; if it grows past ~150, that's a sign to factor.
- Avoid log-and-return-nil. If reconciliation can't proceed, return the error so the manager can requeue.
- New fields on `SchedExtSpec` need a real reason — once a field is published it has to be supported. New CRDs even more so.

## Manifests

The `make manifests` target regenerates:

- `config/crd/bases/sked.schedkit.io_schedexts.yaml` — the CRD itself.
- `config/rbac/role.yaml` — the ClusterRole derived from `+kubebuilder:rbac` markers in `internal/controller/`.

Note that the rbac markers in the reconciler currently only declare verbs on `schedexts*` resources. The reconciler creates DaemonSets, but no RBAC marker covers that — so the generated `role.yaml` does not authorise DaemonSet writes. Adding the missing marker (and regenerating) is on the to-do list. Until it's done, real-cluster installs need a kustomize patch granting `apps/daemonsets` to the controller's ClusterRole.

## Building a single-file installer

```bash
make build-installer IMG=<your-tag>
```

Writes `dist/install.yaml`, the kustomize-rendered output of `config/default` with the controller image patched. This is the file to ship for users who want a single `kubectl apply -f` install.

## Submitting changes

Fork, branch, PR. One logical change per PR. Tests for new behaviour. Reasonable commit messages.

If your change crosses the schedctl/sked boundary — for example, growing schedctl with a feature that the operator wants to consume — expect that to be coordinated work across the two repos. Today the two are independent (sked does not depend on schedctl as a Go module), so the integration is mostly conceptual; that may change as the two converge.
