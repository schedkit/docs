---
id: development
title: Development
---

# Development

This page is for people who want to contribute to schedctl itself, not people who want to use it. If you're in the second group, [Usage](./usage) is more useful.

## Layout

schedctl is a regular Go project, laid out the way most urfave/cli-style CLIs are:

```
schedctl/
├── cmd/
│   ├── schedctl/      # subcommand wiring (root, run, stop, status, doctor, ...)
│   └── gen-man/       # man page generator
├── internal/
│   ├── constants/     # driver name constants
│   ├── containerd/    # containerd client (Run, Stop, List, NewClient)
│   ├── containers/    # shared Container struct
│   ├── doctor/        # host-readiness checks (kernel, caps, runtime)
│   ├── output/        # tiny stdout/stderr helpers
│   ├── podman/        # podman client (Run, Stop, List)
│   ├── sched_ext/     # sysfs reader for /sys/kernel/sched_ext
│   ├── schedulers/    # catalog manifest fetcher and image resolver
│   ├── status/        # report builder and renderers for `status`
│   └── verify/        # cosign signature verification and trust policy
├── test/              # QEMU-driven integration tests
├── testdata/          # mkosi configuration and prebuilt test kernel
├── dist/man/          # checked-in generated man pages
├── main.go
├── go.mod
└── Makefile
```

The `internal/` packages are intentionally not exported. If you find yourself wanting to import something from `internal/` in another project, that's a signal that the package should probably be promoted somewhere public — open an issue and we can talk about it.

## Local build

The development requirements are minimal: Go 1.25+ (the module currently sets `go 1.25.8`), `make`, and a working container runtime (Podman or containerd).

```bash
git clone https://github.com/schedkit/schedctl.git
cd schedctl
make
```

The default Makefile target is `agent`, which runs `go build -o schedctl main.go`. That produces a `schedctl` binary at the project root. Hack on it with whatever editor you prefer. The codebase passes `golangci-lint` cleanly with the configuration in the repo; we expect contributions to do the same.

## Tests

The whole test tree runs from a single make target:

```bash
make test
```

That executes `go test -v -p 1 -race ./...`. The `-p 1` is deliberate — the QEMU integration tests in `test/` cannot share the VM, so packages run sequentially.

Tests fall into two practical categories:

- **Unit tests** live next to the code (`*_test.go` files in `internal/...`). They're plain `go test`, no special setup required.
- **QEMU-driven tests** live in `test/qemu_test.go`. The harness uses [`vmtest`](https://github.com/anatol/vmtest) to boot the prebuilt kernel and rootfs, scp the test binaries into the VM, and run `internal/containerd` and `internal/podman` test packages inside it. The harness skips itself if QEMU, the kernel image, or the rootfs aren't available, so `make test` still works on a developer machine that hasn't built the rootfs yet.

## The QEMU rig

We test the runtime-touching paths against a real kernel because most of what schedctl does is interesting only at the kernel boundary. A unit-test mock of `sched_ext` would be quick to write and, on the question of whether the actual kernel will accept your image, completely useless. So instead we boot a small VM, run the relevant tests inside it, and tear it down.

The VM image is built with [mkosi](https://github.com/systemd/mkosi). The configuration lives in `testdata/`:

```
testdata/
├── mkosi.conf
├── mkosi.repart/
├── mkosi.extra/
├── mkosi.postinst.chroot
├── config             # kernel config for the test kernel
└── bzImage            # prebuilt test kernel
```

In CI the image is rebuilt fresh every run. Locally you'll usually want to build it once and reuse it.

### Building the rootfs

```bash
sudo mkosi --directory testdata --output-dir testdata
```

This produces `testdata/rootfs.raw`, a GPT-partitioned disk image. The test framework wants the root partition extracted as a flat ext4 image, so:

```bash
LOOP=$(sudo losetup --find --show --partscan testdata/rootfs.raw)
sudo dd if="${LOOP}p1" of=testdata/rootfs_ext4.raw bs=4M
sudo losetup -d "$LOOP"
mv testdata/rootfs_ext4.raw testdata/rootfs.raw
qemu-img create -o backing_file=rootfs.raw,backing_fmt=raw -f qcow2 testdata/rootfs.cow
```

The `.cow` overlay means the tests don't mutate `rootfs.raw` — each run gets a fresh disk on top of the same backing file.

### The legacy script

Before we moved to mkosi we built the test image with a shell script and a distrobox container. That path still works, in case you're trying to reproduce an older issue or the mkosi setup is misbehaving on your machine:

```bash
distrobox assemble create --file testdata/distrobox.ini
distrobox enter arch-bootstrap
cd testdata
./prepare_disk_image.sh
```

It's slower and more fragile than the mkosi path. Prefer mkosi for new work.

### The test kernel

We ship a pre-built kernel image so the integration tests run against a known configuration rather than whatever your host happens to have. The config lives in `testdata/config` and the binary at `testdata/bzImage`. To rebuild it:

```bash
distrobox assemble create --file testdata/distrobox.ini
distrobox enter arch-bootstrap
cd testdata
./prepare_kernel_image.sh
```

If you find yourself updating the kernel config, please document why in the commit message. Drift in the test kernel has caused enough debugging sessions that we'd rather have the rationale in the git log.

## Man pages

Man pages are generated from the urfave/cli command tree and checked in under `dist/man`. Regenerate after touching command help text:

```bash
make man
```

CI runs `make man-check`, which regenerates the pages into a temp dir and diffs them against the checked-in copies. If your PR changes a command's help, regenerate and commit; otherwise CI will reject it.

## Code style

Standard Go conventions, with a few project-specific notes:

- `gofmt` is non-negotiable. `make format` runs it.
- `make lint` runs `golangci-lint`. CI runs the same.
- Errors should be wrapped with `fmt.Errorf("...: %w", err)` and a meaningful prefix. Avoid bare `return err`.
- User-facing output goes through `internal/output.Out` (which writes to stdout); diagnostic messages go to stderr. There is no structured logger or `--log-level` flag yet — `internal/output` is intentionally minimal.

## Releasing

Tagged releases drive distribution packages: the openSUSE Factory submission and the AUR `schedctl` package. There is no nightly channel today; main is expected to be releasable.

## Submitting changes

The usual GitHub flow: fork, branch, PR. A few things that make reviews go faster:

- One logical change per PR. If you're refactoring *and* fixing a bug, that's two PRs.
- Tests for new behaviour. We're not pedantic about line coverage, but a feature with no tests is a feature we can't safely refactor later.
- Reasonable commit messages. We're not strict about Conventional Commits, but a commit titled `fix stuff` will get a comment.

If you're not sure whether a change will be welcome, the friendliest path is to open an issue first and outline what you're thinking. Saves both sides time.
