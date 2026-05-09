---
id: packaging-a-scheduler
title: Packaging a scheduler
---

# Packaging a scheduler

If you've written or modified a `sched_ext` scheduler and want schedctl to be able to run it, you need to package it as an OCI image. The good news: there's nothing schedkit-specific you have to do. Any image that ships your scheduler binary and starts it on entry will work.

This page covers the conventions we recommend, the things that will trip you up if you skip them, and how to publish the image so that `schedctl list` picks it up.

## The minimum viable image

Here's a Containerfile that ships an `scx_rusty` scheduler binary you've built yourself:

```dockerfile
FROM scratch

COPY scx_rusty /usr/bin/scx_rusty

ENTRYPOINT ["/usr/bin/scx_rusty"]
```

Build it:

```bash
podman build -t my-registry.example.com/scx_rusty:1.0.0 .
podman push my-registry.example.com/scx_rusty:1.0.0
```

And run it through schedctl:

```bash
sudo schedctl run my-registry.example.com/scx_rusty:1.0.0
```

That's it. The image works, the scheduler attaches, your kernel runs your code. Most of the rest of this page is about doing it well rather than doing it at all.

## Why `FROM scratch`?

Because a `sched_ext` scheduler binary is the workload. It's a single statically-linked (or near enough) executable that loads a BPF program and stays running. There's no shell to drop into, no other processes, no configuration files to read at runtime. A base image just adds attack surface and pull time.

If your scheduler depends on shared libraries that aren't in the binary, you have two options:

1. Build it statically. For Rust schedulers, this is the path of least resistance — `cargo build --release` plus the right linker flags.
2. Use a minimal base image like `gcr.io/distroless/static` or `registry.suse.com/bci/bci-micro`. Avoid full distribution images.

If your scheduler dynamically links against `libelf`, `libbpf`, or similar, you'll know — the binary won't run on `scratch`. Pick a minimal base in that case and don't feel bad about it.

## Capabilities

Don't try to encode capabilities in the image itself. schedctl runs the scheduler container as `Privileged: true`, with the host PID namespace and a bind mount of `/var/run/scx`. Privileged containers get all capabilities, so the ones that actually matter for sched_ext schedulers — `CAP_BPF`, `CAP_SYS_ADMIN`, and usually `CAP_PERFMON` — are present without you having to declare them.

`schedctl doctor` separately verifies that those three capabilities are available to schedctl itself before any of this happens. If you have a scheduler that genuinely needs to *drop* privileges in some controlled way, that's a conversation worth having on an issue rather than something to bake into the image.

## Recommended annotations

Not required, but they make `schedctl list` output more useful:

```dockerfile
LABEL org.opencontainers.image.title="scx_rusty"
LABEL org.opencontainers.image.description="General-purpose Rust scheduler with reasonable defaults."
LABEL org.opencontainers.image.documentation="https://github.com/sched-ext/scx/tree/main/scheds/rust/scx_rusty"
LABEL org.opencontainers.image.source="https://github.com/example/my-rusty-fork"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.schedkit.scheduler.kernel.min-version="6.12"
```

The first five are standard OCI image annotations and most registries display them prominently. The last one is schedkit-specific and is intended for tooling that wants to warn users on older kernels before they pull the image. (Today `schedctl doctor` checks the running kernel rather than the image; image-driven kernel-floor checks are still on the roadmap.)

## Multi-architecture builds

`sched_ext` schedulers vary in architecture support. If you maintain a scheduler that's portable, building a multi-arch image is straightforward:

```bash
podman build \
  --platform linux/amd64,linux/arm64 \
  --manifest my-registry.example.com/scx_rusty:1.0.0 \
  .

podman manifest push my-registry.example.com/scx_rusty:1.0.0
```

If your scheduler is only built for a single architecture, ship a single-arch image and label it accordingly. schedctl will refuse to run an image whose platform doesn't match the host, with a clear error.

## Signing

Required, in practice. schedctl verifies cosign signatures before running anything, and the default trust policy rejects unsigned images. Users can opt out with `--allow-unsigned`, but you shouldn't expect them to.

The simplest path is keyless signing from a CI workflow:

```bash
cosign sign my-registry.example.com/scx_rusty:1.0.0
```

If you're building from GitHub Actions and want to match how the schedkit catalog images are signed (so the default trust policy will accept them out of the box), the issuer to look for is `https://token.actions.githubusercontent.com` and the subject is the workflow URL.

For tooling that consumes signatures from elsewhere, schedctl accepts a YAML trust policy via `--trust-policy` or `SCHEDCTL_TRUST_POLICY`. Schema:

```yaml
keys:
  - path: /etc/schedctl/keys/my-org.pem
identities:
  - issuer: https://token.actions.githubusercontent.com
    subjectRegExp: '^https://github\.com/my-org/my-repo/.*'
rekorURL: https://rekor.sigstore.dev   # optional
```

A policy must have at least one entry under `keys` or `identities`. Both PEM-encoded public keys and keyless OIDC identities are supported, including regex matchers (`issuerRegExp`, `subjectRegExp`).

## Publishing to the schedkit catalog

If you want your scheduler to show up in `schedctl list` for everyone, not just on machines you control, you can submit it to the schedkit catalog. The catalog is a JSON manifest in [schedkit/plumbing](https://github.com/schedkit/plumbing) (`manifest.json`) that maps short names to image URIs:

```json
{
  "scx_rusty": { "imageURI": "ghcr.io/schedkit/scheds/scx_rusty:latest" }
}
```

File a PR against `manifest.json` with the entry, a short description in the PR body, and a kernel version range you've tested against. We're conservative about what lands here because users trust it; a scheduler that crashes hosts is bad press for everyone.

You don't have to be in the catalog to be useful. `schedctl run` accepts a fully-qualified image reference directly, so plenty of teams run schedctl against private registries with internally-maintained schedulers and never touch the catalog.

## Things that will bite you

A non-exhaustive list of mistakes we've seen:

**Forgetting to test on a clean kernel.** Schedulers tend to be developed against very recent kernels. Make sure yours actually works on the lowest kernel version you're claiming to support.

**Shipping a debug build.** They're slower and they have larger BPF programs that occasionally hit verifier limits the release build doesn't.

**Including a `USER` directive in the Containerfile.** schedctl needs to start the binary as root inside the container. A `USER` line will fight that.

**Putting the BPF object in a separate file alongside the binary, then forgetting to copy both.** If your build pipeline produces a binary plus a `.bpf.o` file, double-check that both end up in the image. The binary will fail to attach if the BPF object is missing, and the error message can be surprising.

**Tagging only `latest`.** Please version your images. Pinning by tag is much friendlier than pinning by digest, and `latest` only is friendly to nobody.
