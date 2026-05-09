---
id: oci-schedulers
title: Schedulers as OCI images
sidebar_label: OCI schedulers
---

# Schedulers as OCI images

When we started thinking about how to distribute `sched_ext` schedulers, the obvious options were a custom binary distribution format, package-manager packages (RPM, DEB, etc.), and OCI images. We picked OCI. This page is the long-form answer to why, in case you're trying to decide whether the choice fits your use case.

## The problem

A scheduler in a `sched_ext` world is at minimum a userspace binary, often plus a BPF object file, sometimes plus configuration. We need to:

1. Distribute it. Multiple architectures, multiple versions, mirrored where possible.
2. Pin a specific version to a specific machine, reproducibly.
3. Verify it came from someone we trust before loading it into the kernel.
4. Run it under reasonable lifecycle management (start, stop, restart on crash, capture logs).
5. Roll back when something doesn't work.

Each of these problems has been solved several times in the container ecosystem, and the solutions are both well-tested and operationally familiar to most teams. There's no good reason to reinvent any of them for scheduler binaries specifically.

## What we get for free

Going with OCI as the distribution format means we inherit, without writing any of it ourselves:

**Content-addressable storage.** A scheduler image has a digest. If two machines pull the same digest, they have bit-identical bytes. There is no version-skew ambiguity.

**Distribution infrastructure.** Any OCI registry works. Docker Hub, GHCR, Quay, a private Harbor, an air-gapped registry on the corp network — they all serve schedkit images the same way they serve every other image.

**Signing and verification.** [Cosign](https://github.com/sigstore/cosign) and the broader sigstore ecosystem give us signature verification with established tooling. Given that we're loading code into the kernel, signature verification isn't a nice-to-have, and we'd rather use the existing primitives than build our own.

**Existing runtime tooling.** Both Podman and containerd already know how to pull images, manage their lifecycle, and isolate them. We don't need to write a process supervisor.

**Mental model alignment.** Anyone who has shipped software in 2020s production already understands "image, registry, tag, digest, signature". Onboarding cost on the distribution model is essentially zero.

## What an OCI scheduler image actually contains

The contract is intentionally minimal. An image is a scheduler if it:

- contains an executable that, when run with appropriate capabilities, attaches a `sched_ext` scheduler to the kernel and stays running until it receives a signal,
- declares that executable as its default entrypoint,
- exits cleanly on `SIGTERM` (so we can stop it without orphaning kernel state).

That's the whole interface. There's no schedkit-specific manifest, no annotation requirement, no labels we insist on. An image built with `podman build` from a normal Containerfile that ships any of the [scx](https://github.com/sched-ext/scx) schedulers will work.

We do recommend a few annotations as a matter of good practice (not enforcement):

- `org.opencontainers.image.title` — the scheduler's friendly name.
- `org.opencontainers.image.description` — a one-liner about its workload target.
- `org.opencontainers.image.documentation` — link to the scheduler's own docs.
- `org.schedkit.scheduler.kernel.min-version` — the minimum kernel version the scheduler has been tested against.

These are read by `schedctl list` for richer output but never required.

## What we don't try to do

A few things that might look like obvious extensions, and why we've left them alone (so far):

We don't try to embed the BPF source in the image. The packaged binary has the BPF object linked in already; trying to ship the source separately would just create a second distribution channel to keep in sync.

We don't try to verify kernel compatibility at the image level. Kernel BPF compatibility is fiddly enough that the image format is the wrong place to encode it. `schedctl doctor` (when it lands) will be the right place.

We don't try to be a registry. There are excellent registries in the world. Use one.

## Practical implications

A few things that fall out of this design and are worth keeping in mind:

You need a working container runtime on every machine that runs schedctl. If the host doesn't have Podman or containerd, schedctl can't do anything useful there. This is a deliberate trade-off — we get a lot in exchange — but it's worth saying out loud.

The scheduler runs inside the runtime's view of the host, but with elevated capabilities. It's not a sandbox in the way a regular workload container is; loading a BPF program into the kernel necessarily means giving the binary `CAP_BPF`, `CAP_SYS_ADMIN`, and (often) `CAP_PERFMON`. Treat scheduler images the way you'd treat any privileged workload: signed, pinned by digest, sourced from a registry you control.

Image pull time matters more here than for most workloads. If you're hot-swapping a scheduler under live load, you want the new image already cached. `schedctl pull` (when run ahead of time) is your friend.
