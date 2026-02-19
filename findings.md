# Codebase Analysis: `application` Helm Chart

This repo contains a single generic Helm chart (`charts/application/`) for deploying Kubernetes workloads.

## Critical

### 1. Ingress template regression (branch `mm-update`)

The recent changes removed Kubernetes API version compatibility checks (`supportsIngressClassname`, `supportsPathType`). This breaks backward compatibility with clusters < K8s 1.18. The original Bitnami common helper checks were there for a reason.

Snapshot tests are likely out of sync and will fail.

### 2. 15 stub templates that just `fail`

ConfigMap, Secret, ServiceAccount, RBAC, PDB, HPA, VPA, NetworkPolicy, StatefulSet, DaemonSet, PVC, ServiceMonitor, Certificate all return `"not implemented yet"`. Users who enable these features in values will get deployment errors. At minimum, **ConfigMap, Secret, and ServiceAccount** should be implemented for a usable chart.

## High Priority

### 3. Incomplete schema definitions

`values.ts` has several TODOs for generic `object()` types: `pullPolicy` (no enum), `initContainers`, `sidecars`, `affinity`, `nodeSelector`, `tolerations`, `topologySpreadConstraints`, `resourcesPreset`. These allow invalid values to pass schema validation.

### 4. Thin test coverage

Tests only cover snapshot matching and label merging for the 3 implemented templates. Missing tests for:

- Different service types (LoadBalancer, NodePort)
- Ingress with TLS
- Custom image registry overrides
- Security context variations
- Probe configurations
- Resource limits

### 5. No schema validation in CI

The `validate.yml` workflow runs `helm lint` and `helm unittest` but doesn't validate that `values.yaml` and `values.schema.json` are in sync with `values.ts`.

## Medium Priority

### 6. Empty `appVersion` in Chart.yaml

Should be set to something meaningful or templated appropriately.

### 7. Minimal `NOTES.txt`

Only prints chart name/version. Should include instructions on how to access the deployed application, verify the deployment, and troubleshoot.

### 8. Empty `_helpers.tpl`

Fully relies on Bitnami common chart. Any chart-specific helpers should be defined here rather than inlining logic in templates.

### 9. CI gaps

No security scanning (Trivy/Snyk), no dry-run deployment testing against a cluster, no dependency version testing.

### 10. Documentation

No examples for complex configurations (affinity rules, extra resources via `extraList`, TLS ingress setup). No upgrade/migration guide.

## Minor / Nice-to-Have

### 11. Broad dependency constraint

`2.x.x` for Bitnami common allows any v2 release. Consider tightening to `~2.36.0` or testing against a range.

### 12. Schema generation is manual

Running `deno run` to regenerate `values.yaml` and `values.schema.json` from `values.ts` isn't part of any automated workflow. A pre-commit hook or CI check would prevent drift.

### 13. Chart version `0.0.1`

Fine for development, but indicates the chart isn't release-ready yet.

## What's Done Well

- **Security defaults are excellent**: non-root user, read-only root filesystem, drop all capabilities, seccomp RuntimeDefault, no privilege escalation
- **TypeScript + Zod schema generation** is a smart approach for type-safe values
- **Bitnami common chart integration** reduces boilerplate significantly
- **Values structure** is clean and well-organized
- **Resource defaults** are sensible (100m/128Mi requests, 250m/256Mi limits)
