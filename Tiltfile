if not os.path.exists('extension_tiltfile'):
  local('curl https://raw.githubusercontent.com/michaelmass/tiltfile-extensions/master/Tiltfile > extension_tiltfile', quiet=True)

load(
  './extension_tiltfile',
  'bool_to_string',
  'default_resources',
  'default_settings',
  'define_config',
  'dict_merge',
  'dict_omit',
  'docker_compose_resources',
  'docker_resource',
  'dotenv_watch',
  'open',
  'postgres_uri',
  'redis_uri',
  'resource',
  'set_mode',
  'string_to_bool',
  'write_file',
)

dotenv_watch()
default_settings()

local('deno run -A jsr:@michaelmass/ghf/cli type -o=.ghf.type.ts', quiet=True)
local('deno run -A jsr:@michaelmass/ghf/cli apply', quiet=True)
local('lefthook install', quiet=True)

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

local_resource(
  name='gen-application-chart-package',
  cmd='helm package ./charts/application -d docs',
)

local_resource(
  name='gen-index-yaml',
  dir='docs',
  cmd='helm repo index .',
  deps=['gen-application-chart-package'],
)
