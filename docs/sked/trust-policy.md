---
id: trust-policy
title: Trust policy
---

# Trust policy

Scheduler pods run privileged. sked checks which images and callers are allowed before accepting Scheduler creates and updates, then verifies the image again before writing the DaemonSet.

The policy lives in a ConfigMap, normally `sked-scheduler-trust-policy` in `sked-system`, under the key `policy.yaml`. Helm exposes it through `trustPolicy.policy` or `trustPolicy.existingConfigMap`. It is not a CRD and is not interchangeable with a schedctl trust-policy file.

## Default policy

The shipped policy enables signature verification and allows the Schedkit repositories listed in [`config/trustpolicy/trust_policy.yaml`](https://github.com/schedkit/sked/blob/main/config/trustpolicy/trust_policy.yaml), including `ghcr.io/schedkit/scx_rusty` and `ghcr.io/schedkit/scx_lavd`.

Signatures must use:

- Issuer: `https://token.actions.githubusercontent.com`
- Identity: `https://github.com/schedkit/plumbing/.github/workflows/oci-build-publish.yml@refs/heads/main`

There is no extra caller restriction by default; Kubernetes RBAC still applies. Restrict Scheduler writes to administrators trusted to change node-wide kernel behaviour. Admission restrictions are additional checks, not replacements for RBAC.

## Custom policy

This Helm values example trusts one repository and signing workflow, and limits Scheduler management to a group or service account:

```yaml
trustPolicy:
  policy:
    allowedImages:
      - ghcr.io/my-org/my-scheduler
    verifySignatures: true
    allowedIdentities:
      groups:
        - scheduler-admins
      serviceAccounts:
        - platform:scheduler-deployer
    cosign:
      issuer: https://token.actions.githubusercontent.com
      identity: https://github.com/my-org/my-scheduler/.github/workflows/release.yml@refs/heads/main
```

Replace the repository, workflow identity, and callers with your own. For a separately managed ConfigMap, put the contents of `policy` under `data.policy.yaml` as a YAML string, then set:

```yaml
trustPolicy:
  existingConfigMap: scheduler-trust-policy
  namespace: sked-system
  key: policy.yaml
```

### Policy fields

| Field | Behaviour |
| --- | --- |
| `allowedImages` | Repository patterns using Go `path.Match` syntax. Matching excludes the tag and digest; `*` does not cross `/`. Omitted uses the built-in list. **An explicit empty list allows all repositories.** |
| `verifySignatures` | Defaults to `true`. Setting it to `false` skips signature verification and digest pinning; caller and image-allowlist checks still apply at admission. |
| `allowedIdentities.users` | Exact Kubernetes usernames. |
| `allowedIdentities.groups` | Exact Kubernetes group names. |
| `allowedIdentities.serviceAccounts` | `namespace:name` or `system:serviceaccount:namespace:name`. |
| `cosign.issuer` | Expected certificate OIDC issuer. Defaults to GitHub Actions. |
| `cosign.identity` | Exact signing certificate identity. Defaults to the Schedkit publishing workflow if neither identity field is set. |
| `cosign.identityRegexp` | Signing certificate identity regular expression, as an alternative to an exact identity. Anchor patterns to avoid unintended matches. |
| `cosign.trustedRootPath` | Optional path **inside the controller container** to a Sigstore trusted-root file. Otherwise the verifier fetches the trusted root. |

A caller matching any configured user, group, or service account is allowed. If all three lists are empty, the policy adds no caller restriction. Unknown policy fields and invalid patterns are rejected when parsing the ConfigMap.

The verifier uses Cosign v3 signature bundles through OCI referrers. It resolves the image to a digest, verifies that content, and returns the digest-pinned reference. The reconciler writes that reference to the DaemonSet and `status.resolvedImage`; it does not rewrite `spec.sched`. A tag can resolve differently on a later reconcile, so use an explicit digest when the deployment must stay on fixed content.

## Policy updates and failure behaviour

Each controller replica reloads the ConfigMap every 30 seconds. Allowlist, caller, and verification-enable changes are read from the refreshed policy. The Cosign verifier's issuer, identity, and trusted-root path are configured at process startup: **restart every controller replica after changing `cosign` settings**. Helm changes to a chart-managed policy trigger that restart through a pod-template checksum. Changes to an existing external ConfigMap do not.

A malformed or unreadable policy leaves the last successfully loaded policy in place. At startup, load failures fall back to built-in defaults. A missing ConfigMap or an empty policy document also selects built-in defaults; it is not a deny-all configuration. Check controller logs after policy changes.

Policy refresh does not itself enqueue every Scheduler. Caller and allowlist checks run at admission, not as continuous enforcement against existing resources. If verification fails during reconciliation, sked reports `ImageVerificationFailed` and retries without replacing an existing DaemonSet. Tightening policy does not automatically stop workloads already running; delete their Scheduler objects if they must be removed.

## Private and mirrored registries

There are three separate credential paths:

1. Helm `imagePullSecrets` lets the kubelet pull the **controller image**.
2. `Scheduler.spec.imagePullSecrets` lets the kubelet pull the **scheduler image**, using secrets in the workload namespace.
3. The **controller's verifier** accesses registries with `authn.DefaultKeychain`. It does not load either list of Kubernetes pull secrets. Supply registry credentials separately inside the controller, for example through a mounted Docker configuration and `DOCKER_CONFIG`, using the chart's `extraVolumes`, `extraVolumeMounts`, and `extraEnv`.

For a mirror, copy the scheduler image and its signature/referrer artifacts, allow the mirrored repository in the policy, and keep the expected signing identity checks. Nodes and controllers both need access to the mirror.

For an offline environment, also provision a trusted-root file and set `cosign.trustedRootPath`. sked caches trusted material for 24 hours. Mirroring only the image layers is insufficient for signature verification; test admission and reconciliation with external network access blocked before relying on an offline installation.
