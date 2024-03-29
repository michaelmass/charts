# application-chart
> Generic Helm Chart for deploying applications

## Installation

To install the chart with the release name `my-application` in namespace test:

```bash
helm repo add michaelmass https://michaelmass.github.io/application-chart
helm repo update
helm install my-application michaelmass/application --namespace test
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
