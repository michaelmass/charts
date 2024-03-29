load('ext://helm_resource', 'helm_resource', 'helm_repo')
load('ext://namespace', 'namespace_create')

allow_k8s_contexts('kind-local')

namespace_create(name='test')

helm_resource(
  name='app-test',
  namespace='test',
  chart='charts/application',
  pod_readiness='ignore',
  flags=['--values', './values.test.yaml'],
  deps=['./values.test.yaml', './charts/application/templates']
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
