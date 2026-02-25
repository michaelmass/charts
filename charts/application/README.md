# Application Chart
> Generic Helm Chart for deploying applications

## Installation

To install the chart with the release name `my-application` in namespace test:

```bash
helm repo add michaelmass https://michaelmass.github.io/charts
helm repo update
helm install my-app michaelmass/application --namespace test
```

## Examples

### Basic Deployment with Service

```yaml
deployment:
  enabled: true
service:
  enabled: true
pod:
  image:
    repository: nginx
    tag: latest
```

### StatefulSet with Persistent Volume

```yaml
statefulset:
  enabled: true
  replicas: 3
  volumeClaimTemplates:
    - name: data
      size: 10Gi
      storageClassName: standard
service:
  enabled: true
pod:
  image:
    repository: postgres
    tag: "16"
```

### DaemonSet

```yaml
daemonset:
  enabled: true
pod:
  image:
    repository: fluent/fluentd
    tag: latest
```

### Deployment with Ingress and TLS

```yaml
deployment:
  enabled: true
service:
  enabled: true
ingress:
  enabled: true
  hostname: app.example.com
  tls: true
  ingressClassName: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
pod:
  image:
    repository: myapp
    tag: v1.0.0
```

### Deployment with HPA and PDB

```yaml
deployment:
  enabled: true
service:
  enabled: true
hpa:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPU: 70
pdb:
  enabled: true
  minAvailable: 1
pod:
  image:
    repository: myapp
    tag: v1.0.0
```

### RBAC with ServiceAccount

```yaml
deployment:
  enabled: true
serviceaccount:
  enabled: true
  name: my-app-sa
rbac:
  enabled: true
  role:
    rules:
      - apiGroups: [""]
        resources: ["pods", "configmaps"]
        verbs: ["get", "list", "watch"]
pod:
  image:
    repository: myapp
    tag: v1.0.0
```

### ConfigMap and Secret

```yaml
configmap:
  enabled: true
  data:
    APP_ENV: production
    LOG_LEVEL: info
secret:
  enabled: true
  stringData:
    DATABASE_URL: postgres://user:pass@host/db
```

### ServiceMonitor for Prometheus

```yaml
deployment:
  enabled: true
service:
  enabled: true
servicemonitor:
  enabled: true
  interval: 15s
  endpoints:
    - port: http
      path: /metrics
pod:
  image:
    repository: myapp
    tag: v1.0.0
```

## Testing

[unittest](https://github.com/helm-unittest) is used to test the chart. To run the tests:

```bash
helm plugin install https://github.com/helm-unittest/helm-unittest.git
helm unittest .
```

See the [unittest documentation](https://github.com/helm-unittest/helm-unittest/blob/main/DOCUMENT.md) for more information.

More examples are available under the [unittest examples](https://github.com/helm-unittest/helm-unittest/tree/main/test/data).

## Credits

This chart was inspired by:
- https://github.com/stakater/application
- https://github.com/bitnami/charts
- https://github.com/gimlet-io/onechart
