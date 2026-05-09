---
id: usage
title: Usage
---

# Usage

This page is the practical first walkthrough. By the end of it you should have a non-default scheduler running on your machine, and you should know how to stop it again.

It assumes you've already installed schedctl ([Installation](./installation)) and got a container runtime up ([Container runtimes](./container-runtimes)). If you haven't, do those first.

## A quick sanity check

Before pulling anything, run the built-in readiness check:

```bash
sudo schedctl doctor
```

`schedctl doctor` walks through the things schedctl actually needs: a kernel new enough for `sched_ext` (6.12 or later), `/sys/kernel/sched_ext` exposed, vmlinux BTF available for CO-RE BPF programs, the `CONFIG_BPF*` and `CONFIG_SCHED_CLASS_EXT` flags enabled in the running kernel, the `CAP_BPF`/`CAP_SYS_ADMIN`/`CAP_PERFMON` capabilities present, and at least one container runtime socket reachable. It exits non-zero on any blocking failure and supports `--output=json` for machine-readable output.

If you'd rather poke around manually, the underlying signal is just whether the sysfs directory exists:

```bash
ls /sys/kernel/sched_ext
```

If that directory exists you're fine. If you get "No such file or directory", your kernel either doesn't have `sched_ext` compiled in or you're on a kernel older than 6.12. Either way, schedctl can't help until the kernel is sorted out.

## Listing available schedulers

The catalog of schedulers schedkit knows about lives in a manifest published by the project. To list its entries:

```bash
sudo schedctl list
```

The output is one scheduler name per line:

```
scx_lavd
scx_rusty
scx_bpfland
scx_rustland_core
```

The exact list depends on what's currently published in the catalog. To see which versions of a given scheduler are available in its registry:

```bash
sudo schedctl versions scx_rusty
```

## Running a scheduler

Once you've picked one — `scx_lavd` is a good first try if you're on a desktop or workstation — start it:

```bash
sudo schedctl run scx_lavd
```

What this does, in order:

1. Resolves the scheduler name against the manifest to a fully-qualified OCI image reference. (You can also pass a full image reference directly: `sudo schedctl run ghcr.io/myorg/my-scheduler:v1.0.0`.)
2. Verifies the image's cosign signature against the trust policy (more on this below). Aborts if verification fails, unless `--allow-unsigned` is passed.
3. Pulls the image, if it isn't already cached.
4. Creates a privileged container with the host PID namespace and a bind mount of `/var/run/scx` (so the scheduler's stats socket is reachable from the host), then starts the entrypoint.
5. Returns control to your shell with the scheduler running in the background. Pass `--attach` (or `-a`) if you'd rather stay attached to the container's stdio.

You'll notice that we keep saying `sudo`. That's not negotiable: loading BPF schedulers is a privileged operation. If you find yourself wanting to avoid `sudo` for ergonomic reasons, the right answer is usually a polkit rule or a systemd unit, not running schedctl unprivileged.

### Pinning a version

By default schedctl runs the `:latest` tag of the resolved image. To pin to a specific version:

```bash
sudo schedctl run scx_rusty --version v1.0.0
```

The flag accepts any tag the registry knows about; use `schedctl versions <name>` to enumerate them.

### Passing arguments to the scheduler

Anything after `--` is forwarded to the scheduler binary inside the container:

```bash
sudo schedctl run scx_lavd -- --verbose --interval 100
```

### Image signature verification

schedctl verifies image signatures with cosign before running anything. The default policy trusts keyless signatures from GitHub Actions workflows under `https://github.com/schedkit/...`, with Rekor entries on `rekor.sigstore.dev`. This is what the official schedkit catalog images are signed with.

If you're running images from elsewhere, write a YAML trust policy and point schedctl at it:

```bash
sudo schedctl run scx_rusty --trust-policy=/etc/schedctl/trust.yaml
```

Or set `SCHEDCTL_TRUST_POLICY` in the environment. The policy file accepts both `keys` (paths to PEM-encoded public keys) and `identities` (issuer/subject pairs, with optional regex matchers) — see [Packaging a scheduler](./packaging-a-scheduler) for the schema.

To skip verification entirely (not recommended; the container runs privileged and loads eBPF):

```bash
sudo schedctl run scx_rusty --allow-unsigned
```

This is also exposed as `SCHEDCTL_ALLOW_UNSIGNED=1`.

## Confirming it's actually attached

To see what schedctl thinks is going on:

```bash
sudo schedctl status
```

The text output covers the running container (image, digest, PID, started-at), the driver in use, and what the kernel reports via `/sys/kernel/sched_ext`. If schedctl's view and the kernel's view disagree, the command exits with code 2 and reports the discrepancy in plain language. Add `--output=json` for the machine-readable schema (see [Commands](./commands#schedctl-status)).

The two underlying sysfs files are still readable directly if you'd rather skip schedctl:

```bash
cat /sys/kernel/sched_ext/state
cat /sys/kernel/sched_ext/root/ops
```

The kernel is the source of truth; schedctl just reads the same files.

For just the list of running scheduler containers (PID, container ID, name):

```bash
sudo schedctl ps
```

## Stopping a scheduler

`schedctl stop` takes the container ID (or name) you want to stop. The easiest way to find it is `schedctl ps`:

```bash
sudo schedctl ps
sudo schedctl stop <ID>
```

Under Podman this issues a graceful stop and removes the container. Under containerd the current implementation sends `SIGKILL` (signal 9) and removes the container; the scheduler usually still gets to clean up on its way out because the kernel detaches `sched_ext` ops on process exit, but be aware that this is hard kill rather than `SIGTERM` if you're using the containerd driver.

After the scheduler exits, the kernel reverts to its default policy (EEVDF on recent kernels). You can confirm with `cat /sys/kernel/sched_ext/state`.

If something has gone wrong and the kernel still reports a scheduler attached but no container is managing it, `schedctl status` will surface that as an `orphaned-kernel-state` discrepancy. The last-resort detach is via sysfs:

```bash
echo "0" | sudo tee /sys/kernel/sched_ext/state
```

You should not need to touch sysfs in day-to-day use.

## Picking a runtime explicitly

If both Podman and containerd are present, schedctl needs to be told which to use. The driver flag lives on the root command:

```bash
sudo schedctl --driver=podman run scx_lavd
sudo schedctl --driver=containerd run scx_lavd
sudo schedctl -d containerd run scx_lavd
```

The default is `podman`. There is no environment variable for the driver today; pass the flag every invocation, or wrap it in a shell alias.

## What's next

- Curious about all the available subcommands and flags? [Commands reference](./commands).
- Want to package your own scheduler? [Packaging a scheduler](./packaging-a-scheduler).
- Something not working? [Troubleshooting](./troubleshooting).
- Ready to scale this up to a fleet? [sked overview](../sked/overview).
