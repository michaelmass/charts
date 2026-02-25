# charts

> A collection of helm charts for deploying applications on Kubernetes

## Charts

| Chart                               | Description                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| [application](./charts/application) | Generic helm chart for deploying applications with support for Deployments, Services, and Ingress |

## Usage

```bash
helm repo add michaelmass https://michaelmass.github.io/charts
helm repo update
helm install my-app michaelmass/application --namespace my-namespace
```

## Development

### Prerequisites

- [Helm](https://helm.sh/)
- [Deno](https://deno.land/) (for schema generation)
- [helm-unittest](https://github.com/helm-unittest/helm-unittest) plugin

### Schema Generation

The `values.yaml` and `values.schema.json` files are auto-generated from `values.ts`. Do not edit them directly.

```bash
deno run --no-config --no-lock --node-modules-dir=false -A charts/application/values.ts
```

### Testing

```bash
helm unittest charts/application
```

### Linting

```bash
helm lint charts/application
```
