# application-chart
> Generic Helm Chart for deploying applications

## Installation

To install the chart with the release name `my-application` in namespace test:

```bash
helm repo add michaelmass https://michaelmass.github.io/application-chart
helm repo update
helm install my-application michaelmass/application --namespace test
```

## Credits

This chart was inspired by:
- https://github.com/stakater/application
- https://github.com/bitnami/charts
- https://github.com/gimlet-io/onechart
