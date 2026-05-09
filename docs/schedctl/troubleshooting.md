---
id: troubleshooting
title: Troubleshooting
---

# Troubleshooting

A field guide to the failure modes we see most often. If your problem isn't here, the [issue tracker](https://github.com/schedkit/schedctl/issues) is the next stop — please include kernel version, distribution, runtime, and the scheduler image you tried to run.

## Run `schedctl doctor` first

Almost every category below has a corresponding check in `schedctl doctor`. Before reading on, run it:

```bash
sudo schedctl doctor
sudo schedctl doctor -o json
```

If a blocking check fails, the doctor's `remediation` line tells you what to fix. The rest of this page exists for cases where doctor passes but `run` still doesn't work, or where you want to understand the underlying signal.

## "sched_ext is not available on this kernel"

Your kernel either wasn't built with `sched_ext` support, or you're on a kernel older than 6.12. `schedctl doctor` reports both as failed `kernel.version`/`kernel.sched_ext`/`kernel.config` checks.

To check the kernel version:

```bash
uname -r
```

To check whether `sched_ext` is compiled in:

```bash
grep -E 'CONFIG_SCHED_CLASS_EXT' /boot/config-$(uname -r) || \
  zcat /proc/config.gz | grep CONFIG_SCHED_CLASS_EXT
```

You want to see `CONFIG_SCHED_CLASS_EXT=y`. doctor also checks `CONFIG_BPF`, `CONFIG_BPF_SYSCALL`, `CONFIG_BPF_JIT`, and `CONFIG_DEBUG_INFO_BTF`; missing any of those will fail.

On openSUSE Tumbleweed and recent Arch Linux this is a non-issue — both ship with `sched_ext` enabled. On distributions that prioritise long-term support over recency, you may need to install a separate kernel package.

## "BTF is missing"

doctor's `kernel.btf` check verifies that `/sys/kernel/btf/vmlinux` exists and is non-empty. CO-RE BPF programs need it. The fix is rebuilding (or installing) a kernel with `CONFIG_DEBUG_INFO_BTF=y`. Most mainstream distributions enable it; a few minimal-build images don't.

## "cannot connect to container runtime"

schedctl couldn't reach the runtime socket. doctor surfaces this as `runtime.podman_socket`, `runtime.containerd_socket`, and the aggregate `runtime.any` (which is the only blocking one).

For Podman:

```bash
sudo systemctl status podman.socket
sudo systemctl start podman.socket
```

For containerd:

```bash
sudo systemctl status containerd
sudo systemctl start containerd
```

The socket paths are hard-coded today: `/run/podman/podman.sock` for system Podman and `/run/containerd/containerd.sock` for containerd. There is no `--socket` flag — if your daemon listens elsewhere, the simplest workaround is a bind mount or symlink to the standard path.

If both runtimes are running and schedctl is picking the wrong one, set the driver explicitly:

```bash
sudo schedctl --driver=containerd run scx_lavd
sudo schedctl --driver=podman run scx_lavd
```

## "operation not permitted" when running

Almost always a capabilities issue. If you're not running as root, that's the first thing to fix. If you *are* running as root and still seeing this, the most likely causes are:

- A LSM (AppArmor, SELinux) blocking the BPF syscall. Check `dmesg` for denials.
- A kernel that has BPF locked down via `/proc/sys/kernel/unprivileged_bpf_disabled` or similar. The lockdown applies even to root in some configurations.
- A container runtime configured to strip capabilities aggressively despite `Privileged: true`. This is unusual but happens with some hardened configurations.

doctor's `caps.cap_bpf`, `caps.cap_sys_admin`, and `caps.cap_perfmon` checks verify each capability individually. `dmesg | tail -50` immediately after the failure usually points at the actual cause.

## "image signature verification failed"

By default schedctl verifies cosign signatures before running anything, and the built-in trust policy only accepts keyless signatures from `https://github.com/schedkit/...` workflows. If you're running an image that isn't signed under that policy, you have three options:

1. **Use a custom trust policy.** Write a YAML policy with the keys/identities you trust and pass `--trust-policy=/path/to/policy.yaml` (or set `SCHEDCTL_TRUST_POLICY`). See [Packaging a scheduler](./packaging-a-scheduler#signing) for the schema.
2. **Sign the image** under a workflow that matches the default policy, or under your own policy.
3. **Skip verification.** `--allow-unsigned` (or `SCHEDCTL_ALLOW_UNSIGNED=1`) opts out. Not recommended; the container runs privileged and loads eBPF. Use only for one-off testing.

The verification error message includes the underlying cosign reason. Common ones: missing signature, mismatched issuer, Rekor entry not found.

## "image pull failed: unauthorized"

The registry needs credentials and your runtime doesn't have them.

For Podman, log in once and the credentials persist:

```bash
sudo podman login <registry>
```

For containerd, credentials are configured in `/etc/containerd/config.toml` or via `crictl`. Refer to the containerd documentation for the version you're running — the configuration story has changed across releases.

## "the scheduler attached, but my system feels worse"

This is feedback from the `sched_ext` scheduler itself, not a schedctl bug. Different schedulers are tuned for different workloads, and "feels worse" is a real signal — your workload may not match what the scheduler was designed for.

Things to try, in order:

1. Confirm what's actually running: `sudo schedctl status`. The text output covers the container, image digest, and what the kernel reports.
2. Stop the scheduler (`sudo schedctl ps` to get the ID, then `sudo schedctl stop <ID>`) and confirm the system feels better. If it doesn't, the scheduler isn't your problem.
3. Try a different scheduler. `scx_bpfland` and `scx_lavd` have different latency-vs-throughput trade-offs.
4. Check `dmesg` for `sched_ext`-related warnings. The kernel will sometimes log when a scheduler is misbehaving badly enough that the watchdog is concerned.
5. If you suspect a real bug in the scheduler, file it with the scheduler's upstream project — for the `scx` family, that's at [github.com/sched-ext/scx](https://github.com/sched-ext/scx). schedctl can't fix scheduler bugs.

## "schedctl says it's running but the kernel disagrees"

`schedctl status` is built specifically for this case. It compares schedctl's view (the running container) against the kernel's view (`/sys/kernel/sched_ext`) and reports a status code. The codes that indicate trouble:

| Status | Meaning |
| --- | --- |
| `orphaned-kernel-state` | Kernel has a scheduler attached but schedctl isn't managing one. Usually a previous schedctl invocation that didn't clean up. |
| `managed-detached` | Container is running but the kernel reports nothing attached. The scheduler probably failed to attach (BPF verifier rejected it, missing capability, etc.) — check the container's logs. |
| `managed-mismatch` | Container is running and the kernel has *something* attached, but the names don't line up. Most often a sign that another scheduler was loaded out-of-band. |
| `multiple-managed` | More than one schedctl-managed container is running. Only one sched_ext ops can be attached at a time. |

Each exits with code 2 (rather than 0). The JSON output includes a human-readable `discrepancy` string and stable identifiers in the `status` field.

## "the kernel still shows my scheduler attached after I ran schedctl stop"

This usually means the scheduler binary didn't exit cleanly and `sched_ext` didn't release the attachment. Force-detach:

```bash
echo "0" | sudo tee /sys/kernel/sched_ext/state
```

Then check `sudo schedctl ps` (or `sudo podman ps -a` / `nerdctl -n schedkit ps -a`) for orphaned containers and remove them. After that, schedctl should be back in a clean state.

If this happens repeatedly with the same scheduler, the scheduler's signal handling is probably broken — and it's worth noting that the containerd driver currently issues `SIGKILL` rather than `SIGTERM` on stop, which gives the scheduler less of a chance to detach gracefully than the Podman driver does. File issues against the scheduler upstream when you see persistent dirty exits.

## Getting more output

schedctl does not currently expose a `--log-level` flag or per-call verbosity controls. For debugging, the JSON outputs of `status` and `doctor` are the most useful structured signal, alongside:

- `dmesg | tail -50` immediately after a failed run.
- The container's stdout/stderr, accessible via `podman logs <id>` or `ctr -n schedkit tasks attach <id>`.
- `cat /sys/kernel/sched_ext/state` and `cat /sys/kernel/sched_ext/root/ops`.

If you file an issue, those four pieces of information cover what we'd ask for anyway.
