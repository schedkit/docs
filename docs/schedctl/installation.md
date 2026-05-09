---
id: installation
title: Installation
---

# Installation

schedctl is packaged for a few distributions and can be built from source on anything with a working Go toolchain. Pick the path that matches your environment.

## openSUSE Tumbleweed

schedctl is in openSUSE Factory, so on Tumbleweed it's a one-liner:

```bash
sudo zypper in schedctl
```

This is the recommended path on openSUSE. The package is kept in sync with upstream releases and follows the standard openSUSE update channel.

If you're on Leap, schedctl isn't currently in the Leap repos. You can either build from source (see below) or pull the same package from the openSUSE Build Service if you've enabled the relevant project repository.

## Arch Linux

schedctl is on the AUR. Use your favourite AUR helper:

```bash
paru -S schedctl
```

Or with `yay`:

```bash
yay -S schedctl
```

If you build AUR packages by hand:

```bash
git clone https://aur.archlinux.org/schedctl.git
cd schedctl
makepkg -si
```

## Other distributions

We don't currently maintain packages for other distributions. If you're on something else, your options are:

- **Build from source** (covered below). This is the path most contributors use day-to-day, and it's not painful.
- **Pull a release binary** from the [GitHub releases page](https://github.com/schedkit/schedctl/releases). Drop it in `/usr/local/bin/` and you're done.
- **Open a packaging issue.** If schedctl gets enough traction in your distribution of choice, we're happy to help upstream the packaging work.

## Building from source

You'll need:

- Go 1.25 or later (the module currently targets 1.25.x).
- `make`.
- A C compiler (only used by some indirect dependencies; you almost certainly already have it).

Then:

```bash
git clone https://github.com/schedkit/schedctl.git
cd schedctl
make
```

The default target builds a `schedctl` binary in the project root (the actual recipe is `make agent`, but `make` with no argument runs the same build). Move it somewhere on your `$PATH`:

```bash
sudo install -m 0755 schedctl /usr/local/bin/
```

To run the test suite (which includes a non-trivial QEMU-based integration test rig — see [Development](./development) for the gory details):

```bash
make test
```

## Verifying your install

Once installed, a quick sanity check is to ask schedctl what it can do:

```bash
schedctl --help
```

If that prints a usage summary and exits zero, the binary works. Note that schedctl does not yet expose a `--version` flag — distribution packages are the source of truth for the installed version.

For a deeper readiness check (kernel, capabilities, container runtime sockets), run:

```bash
sudo schedctl doctor
```

`schedctl doctor` is the first thing to reach for if a `run` later fails. It exits non-zero when any blocking check fails, and supports `--output json` for machine-readable output. See [Container runtimes](./container-runtimes) and [Usage](./usage) for what to do next.

## Uninstalling

Use whichever package manager you installed it with. If you installed from source, removing the binary from `/usr/local/bin/` is sufficient — schedctl doesn't write any persistent state to the filesystem outside of what your container runtime stores on its behalf.
