load('ext://helm_resource', 'helm_resource', 'helm_repo')
load('ext://namespace', 'namespace_create')

allow_k8s_contexts('local')

namespace_create(name='test')

values = {
  'deployment.enabled': 'true',
  'pod.image.repository': 'michaelmass/hellomicro',
  'pod.image.tag': 'latest',
  'pod.containerPorts.http': '8080',
  'pod.probes.liveness.httpGet.path': '/v1/ping',
  'pod.probes.readiness.httpGet.path': '/v1/ping',
}

flags = []

for key, value in values.items():
  flags.append('--set')
  flags.append('%s=%s' % (key, value))

helm_resource(
  name='app-test',
  namespace='test',
  chart='charts/application',
  pod_readiness='ignore',
  flags=flags,
)

local_resource(
  name='helm-test',
  cmd='helm unittest .',
  dir='charts/application',
  resource_deps=['app-test'],
  deps=['./charts/application/tests', './charts/application/templates'],
)

local_resource(
  name='gen-values',
  serve_dir='charts/application',
  serve_cmd='deno run --watch -A values.ts',
)
