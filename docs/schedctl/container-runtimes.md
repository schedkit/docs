---
id: container-runtimes
title: Container runtimes
---

# Container runtimes

schedctl doesn't pull or run images itself. It talks to a container runtime that does, and you need exactly one set up before schedctl is useful. The two supported runtimes are Podman and containerd.

If you don't have a strong preference, **use Podman**. It's slightly easier to get going with, doesn't require a long-running daemon by default, and matches what most contributors test against.

## Podman

Podman is the default. schedctl talks to it over its API socket at `/run/podman/podman.sock` (the system socket, not the rootless user socket). By default the socket isn't running, so you'll need to start it:

```bash
sudo systemctl start podman.socket
```

To have it come up automatically across reboots:

```bash
sudo systemctl enable podman.socket
```

That's it. With Podman as the default driver schedctl will use this socket without further configuration.

If you want to confirm Podman itself is healthy before involving schedctl:

```bash
sudo podman version
```

### Rootless Podman

schedctl needs root because loading BPF schedulers requires it, and the scheduler container runs privileged. The Podman socket schedctl talks to is therefore the **system socket** (`/run/podman/podman.sock`), not the user-level rootless socket. If you've only ever used rootless Podman before, the relevant unit is `podman.socket` under the system instance, not `--user`.

## containerd

containerd is also supported. It's already a daemon by design, so the setup is just making sure it's running:

```bash
sudo systemctl start containerd
```

And to keep it running across reboots:

```bash
sudo systemctl enable containerd
```

schedctl talks to containerd's standard socket at `/run/containerd/containerd.sock`. The path is currently hard-coded; there is no flag or environment variable to point schedctl at a non-default socket. If you've configured containerd to listen somewhere else, the simplest workaround is a bind mount or symlink to the standard path.

containerd containers managed by schedctl live in the dedicated `schedkit` namespace. You can poke at them directly with `ctr -n schedkit ...` if you need to.

### When to pick containerd over Podman

Pick containerd if:

- You're already running it for other reasons (Kubernetes, for instance).
- You want a single shared image store between schedkit and the rest of your container workloads.
- You don't want a Podman dependency on this machine.

## Docker

Not officially supported. There is no Docker driver in schedctl — only `podman` and `containerd` are valid `--driver` values. Docker users can typically have schedctl drive containerd directly underneath Docker, since modern Docker uses containerd as its runtime, but that path isn't tested in CI.

## Choosing a runtime

The driver is selected with a single flag on the root command:

```bash
sudo schedctl --driver=containerd run scx_rusty
sudo schedctl -d containerd run scx_rusty   # short form
```

Valid values are `podman` (default) and `containerd`. The default suits the openSUSE Tumbleweed and AUR packages that most users start from.

There is no `--socket` or `SCHEDCTL_RUNTIME` flag/env var today — driver selection is via the `--driver` flag, and socket paths are not configurable.

## What schedctl does with the runtime

For the curious: schedctl uses the runtime to pull the scheduler image (if it isn't already cached locally), create a container with `Privileged: true` and the host PID namespace, bind-mount `/var/run/scx` (so scheduler stats sockets are reachable from the host), and start the container's entrypoint. It does *not* use the runtime as a long-term process supervisor — schedctl tracks the running scheduler itself via `schedctl ps` and `schedctl status`, which is what lets it do things like clean shutdown and reconcile its view against `/sys/kernel/sched_ext`. The container is, from the runtime's perspective, just a regular short-to-medium-lived workload tagged with the `provider=schedkit` label (Podman) or living in the `schedkit` namespace (containerd).
