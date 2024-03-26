import { z } from "https://deno.land/x/zod@v3.22.2/mod.ts";
import { zodToJsonSchema } from 'npm:zod-to-json-schema'
import yaml from 'npm:yaml'

const globalSchema = z.object({
  imageRegistry: z.string().default(''),
  storageClass: z.string().default(''),
  imagePullSecrets: z.object({
    name: z.string(),
  }).array().default([])
})

const labelsAndAnnotationsSchema = z.object({
  labels: z.record(z.string()).default({}),
  annotations: z.record(z.string()).default({}),
})

const commonResourceSchema = z.object({
  enabled: z.boolean().default(false),
}).merge(labelsAndAnnotationsSchema)

const ingressBackendSchema = z.object({
  service: z.object({
    name: z.string(),
    port: z.union([
      z.object({ name: z.string() }),
      z.object({ number: z.number() }),
    ])
  })
})

const ingressSchema = z.object({
  apiVersion: z.string().default(''),
  hostname: z.string().default('application.local'),
  pathType: z.string().default('ImplementationSpecific'),
  path: z.string().default('/'),
  tls: z.boolean().default(false),
  existingSecretName: z.string().default(''),
  ingressClassName: z.string().default(''),
  extraPaths: z.object({
    path: z.string(),
    pathType: z.string(),
    backend: ingressBackendSchema,
  }).array().default([]),
  extraHosts: z.object({
    name: z.string(),
    path: z.string(),
    pathType: z.string(),
  }).array().default([]),
  extraTls: z.object({
    hosts: z.string().array(),
    secretName: z.string(),
  }).array().default([]),
}).merge(commonResourceSchema).default({})

const serviceSchema = z.object({
  type: z.enum(['ClusterIP', 'LoadBalancer']).default('ClusterIP'),
  ports: z.object({
    http: z.number().default(80),
    https: z.number().default(443),
  }).default({}),
  nodePorts: z.object({
    http: z.string().default(''),
    https: z.string().default(''),
  }).default({}),
  clusterIP: z.string().default(''),
  loadBalancerIP: z.string().default(''),
  externalTrafficPolicy: z.string().default('Cluster'),
  sessionAffinity: z.string().default('None'),
  loadBalancerSourceRanges: z.string().array().default([]),
  extraPorts: z.object({
    name: z.string(),
    protocol: z.enum(['TCP']),
    port: z.number(),
    nodePort: z.number(),
    targetPort: z.union([
      z.string(),
      z.number(),
    ]),
  }).array().default([]),
  sessionAffinityConfig: z.object({
    clientIP: z.object({
      timeoutSeconds: z.number().optional(),
    }).optional()
  }).default({})
}).merge(commonResourceSchema).default({})

const deploymentSchema = z.object({
  replicas: z.number().default(1),
  strategy: z.object({
    type: z.enum(['RollingUpdate']).default('RollingUpdate')
  }).default({}),
}).merge(commonResourceSchema).default({})

const probeSchema = z.object({
  enabled: z.boolean().default(true),
  initialDelaySeconds: z.number().default(30),
  timeoutSeconds: z.number().default(30),
  periodSeconds: z.number().default(10),
  successThreshold: z.number().default(1),
  failureThreshold: z.number().default(6),
  httpGet: z.object({
    path: z.string().default('/'),
    port: z.string().default('http'),
  }).default({})
})

const podSchema = z.object({
  priorityClassName: z.string().default(''),
  schedulerName: z.string().default(''),
  terminationGracePeriodSeconds: z.number().default(0),

  containerPorts: z.object({
    http: z.number().default(80),
    https: z.number().default(443),
  }).default({}),

  env: z.object({
    vars: z.object({
      name: z.string(),
      value: z.string(),
    }).array().default([]),
    configmap: z.string().default(''),
    secret: z.string().default(''),
  }).default({}),

  probes: z.object({
    startup: probeSchema.default({ enabled: false }),
    liveness: probeSchema.default({}),
    readiness: probeSchema.default({}),
  }).default({}),

  image: z.object({}).default({}), // TODO add the complete definition
  resourcesPreset: z.enum(['none']).default('none'), // TODO add the complete definition
  resources: z.object({}).default({}), // TODO add the complete definition
  initContainers: z.object({}).array().default([]), // TODO add the complete definition
  sidecars: z.object({}).array().default([]), // TODO add the complete definition
  extraVolumes: z.object({}).array().default([]), // TODO add the complete definition
  extraVolumeMounts: z.object({}).array().default([]), // TODO add the complete definition
  affinity: z.object({}).default({}), // TODO add the complete definition

  affinityPreset: z.enum(['', 'soft', 'hard']).default(''),
  antiAffinityPreset: z.enum(['', 'soft', 'hard']).default('soft'),
  nodeAffinityPreset: z.object({
    type: z.string().default(''),
    key: z.enum(['', 'soft', 'hard']).default(''),
    values: z.string().array().default([]),
  }).default({}),

  nodeSelector: z.object({}).default({}), // TODO add the complete definition
  tolerations: z.object({}).array().default([]), // TODO add the complete definition
  topologySpreadConstraints: z.object({}).array().default([]), // TODO add the complete definition

  securityContext: z.object({
    enabled: z.boolean().default(true),
    fsGroupChangePolicy: z.string().default('Always'),
    sysctls: z.object({
      name: z.string(),
      value: z.string(),
    }).array().default([]),
    supplementalGroups: z.number().array().default([]),
    fsGroup: z.number().default(1001),
  }).default({}),

  containerSecurityContext: z.object({
    enabled: z.boolean().default(true),
    seLinuxOptions: z.object({
      level: z.string(),
      role: z.string(),
      type: z.string(),
      user: z.string(),
    }).nullable().default(null),
    runAsUser: z.number().default(1001),
    runAsNonRoot: z.boolean().default(true),
    privileged: z.boolean().default(false),
    readOnlyRootFilesystem: z.boolean().default(false),
    allowPrivilegeEscalation: z.boolean().default(false),
    capabilities: z.object({
      drop: z.string().array().default(['ALL']),
      add: z.string().array().default([]),
    }).default({}),
    seccompProfile: z.object({
      type: z.string().default('RuntimeDefault'),
      localhostProfile: z.string().optional(),
    }).default({}),
  }).default({})
}).merge(labelsAndAnnotationsSchema).default({})

const valuesSchema = z.object({
  global: globalSchema.default({}),
  nameOverride: z.string().default(''),
  fullnameOverride: z.string().default(''),
  namespaceOverride: z.string().default(''),
  common: z.object({}).merge(labelsAndAnnotationsSchema).default({}),
  deployment: deploymentSchema,
  pod: podSchema,
  service: serviceSchema,
  ingress: ingressSchema,
  serviceaccount: z.object({
    name: z.string().default(''),
    automountServiceAccountToken: z.boolean().default(false),
  }).merge(commonResourceSchema).default({}),
  rbac: z.object({
    enabled: z.boolean().default(false),
  }).default({}),
  vpa: z.object({}).merge(commonResourceSchema).default({}),
  statefulset: z.object({}).merge(commonResourceSchema).default({}),
  servicemonitor: z.object({}).merge(commonResourceSchema).default({}),
  secret: z.object({}).merge(commonResourceSchema).default({}),
  pvc: z.object({}).merge(commonResourceSchema).default({}),
  pdb: z.object({
    minAvailable: z.number().default(1),
    maxUnavailable: z.string().default(''),
  }).merge(commonResourceSchema).default({}),
  networkpolicy: z.object({}).merge(commonResourceSchema).default({}),
  hpa: z.object({}).merge(commonResourceSchema).default({}),
  daemonset: z.object({}).merge(commonResourceSchema).default({}),
  configmap: z.object({}).merge(commonResourceSchema).default({}),
  certificate: z.object({}).merge(commonResourceSchema).default({}),
  extra: z.string().array().default([]),
}).default({})

// deno-lint-ignore no-explicit-any
const jsonSchema = (zodToJsonSchema as any)(valuesSchema)
const defaultValues = valuesSchema.parse({})

await Deno.writeTextFile('values.schema.json', JSON.stringify(jsonSchema, null, 2))
await Deno.writeTextFile('values.yaml', yaml.stringify(defaultValues))
