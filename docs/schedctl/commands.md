---
id: commands
title: Command reference
---

# Command reference

This page documents the subcommands schedctl currently exposes. The reference here is intentionally terse — for worked examples, see [Usage](./usage); for the *why* behind a command, see [Overview](./overview).

When this page and the output of `schedctl --help` disagree, trust `--help`. The binary is the source of truth.

## Global flags

The root command exposes one persistent flag, plus the standard urfave/cli help affordance:

| Flag | Default | Description |
| --- | --- | --- |
| `--driver`, `-d` | `podman` | Container runtime to use. Valid values: `podman`, `containerd`. |
| `--help`, `-h` | — | Print help and exit. |

There is no `--version`, `--socket`, `--registry`, or `--log-level` flag today, and no `SCHEDCTL_RUNTIME`/`SCHEDCTL_SOCKET`/`SCHEDCTL_REGISTRY`/`SCHEDCTL_LOG_LEVEL` environment variables. The two environment variables schedctl does honour are `SCHEDCTL_TRUST_POLICY` and `SCHEDCTL_ALLOW_UNSIGNED`, both scoped to the `run` subcommand.

## `schedctl list`

Lists schedulers available in the schedkit catalog.

```bash
sudo schedctl list
```

Output is one scheduler name per line. Names map to OCI image URIs in the catalog manifest (currently published at `https://raw.githubusercontent.com/schedkit/plumbing/refs/heads/main/manifest.json`). The list reflects what's published, not what's already pulled to your local cache; pulling happens on `run`.

The catalog URL is hard-coded in the current build. If the scheduler you want isn't in the catalog, you can still run it by passing a fully-qualified OCI image reference to `schedctl run` (see below).

## `schedctl versions`

Lists the available image tags for a scheduler.

```bash
sudo schedctl versions <scheduler>
```

Where `<scheduler>` is either a name from the catalog or a fully-qualified image repo. schedctl resolves the underlying image repo and queries the registry for its tags, then prints them sorted. Useful for picking a `--version` to pass to `run`.

## `schedctl run`

Starts a scheduler.

```bash
sudo schedctl run <scheduler> [-- <scheduler-args>...]
```

`<scheduler>` is either:

- a name from `schedctl list` (resolved against the catalog manifest), or
- a fully-qualified OCI image reference, like `ghcr.io/some/path/scx_lavd:1.0.0`. Use this for schedulers you've packaged yourself or that aren't in the catalog.

Anything after `--` is forwarded to the scheduler binary inside the container.

### `run` flags

| Flag | Environment | Default | Description |
| --- | --- | --- | --- |
| `--attach`, `-a` | — | `false` | Stay attached to the container's stdio instead of detaching. |
| `--version` | — | — | Image tag to pin (e.g. `v1.0.0`). Without it, schedctl uses `:latest` (or the tag from the manifest entry). |
| `--trust-policy` | `SCHEDCTL_TRUST_POLICY` | built-in default | Path to a YAML trust policy for cosign signature verification. |
| `--allow-unsigned` | `SCHEDCTL_ALLOW_UNSIGNED` | `false` | Skip signature verification. Not recommended; the container runs privileged and loads eBPF. |

The default trust policy trusts keyless signatures from GitHub Actions workflows in the `schedkit` GitHub organisation, with Rekor entries on `rekor.sigstore.dev`.

### What `run` actually does

1. Resolves the argument to an OCI image (manifest lookup or direct).
2. Verifies the cosign signature against the trust policy, unless `--allow-unsigned` is set. Aborts on failure.
3. Pulls the image via the selected driver if it isn't cached.
4. Creates a privileged container with the host PID namespace, a `/var/run/scx` bind mount, and (for Podman) the `provider=schedkit` label. containerd containers live in the `schedkit` namespace.
5. Starts the entrypoint. With `--attach` the command stays attached and exits with the container's exit code; without it, `run` returns once the container is started.

Only one schedctl-managed scheduler should be running at a time — the kernel only attaches one `sched_ext` ops at a time. `schedctl status` reports a `multiple-managed` discrepancy if more than one is found.

## `schedctl ps`

Lists running scheduler containers managed by schedctl.

```bash
sudo schedctl ps
```

Output columns: `PID`, `ID`, `NAME`. With Podman the list is filtered by the `provider=schedkit` label; with containerd it's filtered by the `schedkit` namespace.

## `schedctl stop`

Stops a running scheduler container by ID (or name).

```bash
sudo schedctl stop <ID>
```

The argument is required — get it from `schedctl ps`. The shutdown path differs slightly between drivers:

- **Podman**: graceful stop via the Podman API, then remove.
- **containerd**: `SIGKILL` (signal 9), wait for the task, then delete the task and container.

After the container exits the kernel detaches `sched_ext` ops on process exit and reverts to its default policy.

## `schedctl status`

Reports what schedctl is managing and what the kernel reports via `/sys/kernel/sched_ext`. Designed to be wrapped by other tooling — the JSON schema is stable across patch releases.

```bash
sudo schedctl status
sudo schedctl status -o json
```

| Flag | Default | Description |
| --- | --- | --- |
| `--output`, `-o` | `text` | Output format. Valid values: `text`, `json`. |

### Status codes

`status` is the place where schedctl's view and the kernel's view get reconciled. The status string in the output is one of:

| Status | Meaning | Exit code |
| --- | --- | --- |
| `idle` | No managed scheduler, kernel reports nothing attached. | 0 |
| `running` | Exactly one managed scheduler, and the kernel ops match. | 0 |
| `orphaned-kernel-state` | Kernel reports a scheduler attached, but schedctl isn't managing one. | 2 |
| `managed-detached` | Container is running but kernel reports no scheduler attached. | 2 |
| `managed-mismatch` | Container is running but the kernel ops name doesn't match. | 2 |
| `multiple-managed` | More than one schedctl-managed container is running. | 2 |

The JSON schema is documented in `schedctl-status(1)` (generated from source via `make man`). The fields and their tags are stable; the schema version is `"1"`.

## `schedctl doctor`

Runs host readiness checks for sched_ext schedulers. Exits non-zero when any blocking check fails.

```bash
sudo schedctl doctor
sudo schedctl doctor -o json
```

| Flag | Default | Description |
| --- | --- | --- |
| `--output`, `-o` | `text` | Output format. Valid values: `text`, `json`. |

### Default checks

| Check ID | Severity | What it verifies |
| --- | --- | --- |
| `kernel.version` | error | Running kernel ≥ 6.12. |
| `kernel.sched_ext` | error | `/sys/kernel/sched_ext` is exposed. |
| `kernel.btf` | error | `/sys/kernel/btf/vmlinux` is present and non-empty (CO-RE BPF programs need this). |
| `kernel.config` | error | `CONFIG_BPF`, `CONFIG_BPF_SYSCALL`, `CONFIG_BPF_JIT`, `CONFIG_DEBUG_INFO_BTF`, `CONFIG_SCHED_CLASS_EXT` are all enabled. |
| `caps.cap_bpf` | error | The process has `CAP_BPF`. |
| `caps.cap_sys_admin` | error | The process has `CAP_SYS_ADMIN`. |
| `caps.cap_perfmon` | error | The process has `CAP_PERFMON`. |
| `runtime.podman_socket` | warn | Podman socket reachable at `/run/podman/podman.sock`. |
| `runtime.containerd_socket` | warn | containerd socket reachable at `/run/containerd/containerd.sock`. |
| `runtime.any` | error | At least one of the above runtime sockets is reachable. |

A failed `error`-severity check counts as blocking; a failed `warn` does not. The JSON output exposes the same fields plus per-check remediation hints, suitable for surfacing in higher-level tools.

## Exit codes

There is no project-wide exit code mapping today. Most failures exit with code 1; `schedctl status` exits 2 specifically for kernel/manager discrepancies (see above); `schedctl doctor` exits 1 when blocking checks fail. If you're scripting around schedctl, prefer the `--output=json` outputs of `status` and `doctor` over inspecting numeric exit codes.

## Roadmap

The CLI is still gaining surface area. Things on our list:

- A `--version` flag and corresponding subcommand.
- A `pull` subcommand to pre-pull an image without starting it.
- An integrated benchmark runner.
- Configurable catalog/registry endpoints.

If you want to track or contribute to any of these, the [issue tracker](https://github.com/schedkit/schedctl/issues) is the right place.
