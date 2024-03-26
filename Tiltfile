load('ext://helm_resource', 'helm_resource', 'helm_repo')
load('ext://namespace', 'namespace_create')

allow_k8s_contexts('local')

namespace_create(name='test')

helm_resource(
  name='app-test',
  namespace='test',
  chart='charts/application',
  pod_readiness='ignore',
)

local_resource(
  name='helm-test',
  cmd='helm unittest .',
  dir='charts/application',
  resource_deps=['app-test'],
  deps=['./charts/application/tests'],
)

local_resource(
  name='gen-values',
  serve_dir='charts/application',
  serve_cmd='deno run --watch -A values.ts',
)
