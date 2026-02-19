import yaml from "npm:yaml@2.8.2";
import { z, toJSONSchema } from "npm:zod@4.3.6";

const globalSchema = z.object({
	imageRegistry: z.string().default(""),
	storageClass: z.string().default(""),
	imagePullSecrets: z
		.object({
			name: z.string(),
		})
		.array()
		.default([]),
});

const labelsAndAnnotationsSchema = z.object({
	labels: z.record(z.string(),z.string()).prefault({}),
	annotations: z.record(z.string(), z.string()).prefault({}),
});

const commonResourceSchema = z
	.object({
		enabled: z.boolean().default(false),
	})
	.extend(labelsAndAnnotationsSchema.shape);

const ingressBackendSchema = z.object({
	service: z.object({
		name: z.string(),
		port: z.union([
			z.object({ name: z.string() }),
			z.object({ number: z.number() }),
		]),
	}),
});

const ingressSchema = z
	.object({
		apiVersion: z.string().default(""),
		hostname: z.string().default("application.local"),
		pathType: z.string().default("ImplementationSpecific"),
		path: z.string().default("/"),
		tls: z.boolean().default(false),
		existingSecretName: z.string().default(""),
		ingressClassName: z.string().default(""),
		extraPaths: z
			.object({
				path: z.string(),
				pathType: z.string(),
				backend: ingressBackendSchema,
			})
			.array()
			.default([]),
		extraHosts: z
			.object({
				name: z.string(),
				path: z.string(),
				pathType: z.string(),
			})
			.array()
			.default([]),
		extraTls: z
			.object({
				hosts: z.string().array(),
				secretName: z.string(),
			})
			.array()
			.default([]),
		extraRules: z.string().array().default([]),
		selfSigned: z.boolean().default(false),
	})
	.extend(commonResourceSchema.shape)
	.prefault({})

const serviceSchema = z
	.object({
		type: z.enum(["ClusterIP", "LoadBalancer", "NodePort", "ExternalName"]).default("ClusterIP"),
		ports: z
			.object({
				http: z.number().default(80),
				https: z.number().default(443),
			})
			.prefault({}),
		nodePorts: z
			.object({
				http: z.string().default(""),
				https: z.string().default(""),
			})
			.prefault({}),
		protocol: z.enum(["SCTP", "TCP", "UDP"]).default("TCP"),
		clusterIP: z.string().default(""),
		loadBalancerIP: z.string().default(""),
		externalTrafficPolicy: z.string().default("Cluster"),
		sessionAffinity: z.string().default("None"),
		loadBalancerSourceRanges: z.string().array().default([]),
		extraPorts: z
			.object({
				name: z.string(),
				protocol: z.enum(["SCTP", "TCP", "UDP"]).default("TCP"),
				port: z.number(),
				nodePort: z.number().optional(),
				targetPort: z.union([z.string(), z.number()]).optional(),
			})
			.array()
			.default([]),
		sessionAffinityConfig: z
			.object({
				clientIP: z
					.object({
						timeoutSeconds: z.number().optional(),
					})
					.optional(),
			})
			.prefault({}),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const deploymentSchema = z
	.object({
		replicas: z.number().default(1),
		strategy: z
			.object({
				type: z.enum(["RollingUpdate"]).default("RollingUpdate"),
			})
			.prefault({}),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const probeSchema = z.object({
	enabled: z.boolean().default(true),
	initialDelaySeconds: z.number().default(30),
	timeoutSeconds: z.number().default(30),
	periodSeconds: z.number().default(10),
	successThreshold: z.number().default(1),
	failureThreshold: z.number().default(6),
	httpGet: z
		.object({
			path: z.string().default("/"),
			port: z.string().default("http"),
		})
		.prefault({}),
});

const podSchema = z
	.object({
		priorityClassName: z.string().default(""),
		schedulerName: z.string().default(""),
		terminationGracePeriodSeconds: z.number().default(0),

		command: z.string().array().default([]),
		args: z.string().array().default([]),

		containerPorts: z
			.object({
				http: z.number().optional().default(8080),
				https: z.number().optional(),
			})
			.prefault({}),

		env: z
			.object({
				vars: z
					.object({
						name: z.string(),
						value: z.string(),
					})
					.array()
					.default([]),
				configmap: z.string().default(""),
				secret: z.string().default(""),
			})
			.prefault({}),

		probes: z
			.object({
				startup: probeSchema.prefault({ enabled: false }),
				liveness: probeSchema.prefault({}),
				readiness: probeSchema.prefault({}),
			})
			.prefault({}),

		image: z
			.object({
				registry: z.string().default("docker.io"),
				repository: z.string().default(""),
				tag: z.string().default(""),
				digest: z.string().default(""),
				pullPolicy: z.enum(["Always", "IfNotPresent", "Never"]).default("IfNotPresent"),
				pullSecrets: z.string().array().default([]),
			})
			.prefault({}),

		resourcesPreset: z.enum(["none", "nano", "micro", "small", "medium", "large", "xlarge", "2xlarge"]).default("none"),
		resources: z
			.object({
				requests: z
					.object({
						cpu: z.string().default("100m"),
						memory: z.string().default("128Mi"),
					})
					.prefault({}),
				limits: z
					.object({
						cpu: z.string().default("250m"),
						memory: z.string().default("256Mi"),
					})
					.prefault({}),
			})
			.prefault({}),
		initContainers: z.record(z.string(), z.any()).array().default([]),
		sidecars: z.record(z.string(), z.any()).array().default([]),
		affinity: z.record(z.string(), z.any()).prefault({}),

		affinityPreset: z.enum(["", "soft", "hard"]).default(""),
		antiAffinityPreset: z.enum(["", "soft", "hard"]).default("soft"),
		nodeAffinityPreset: z
			.object({
				type: z.string().default(""),
				key: z.enum(["", "soft", "hard"]).default(""),
				values: z.string().array().default([]),
			})
			.prefault({}),

		nodeSelector: z.record(z.string(), z.string()).prefault({}),
		tolerations: z.record(z.string(), z.any()).array().default([]),
		topologySpreadConstraints: z.record(z.string(), z.any()).array().default([]),

		securityContext: z
			.object({
				enabled: z.boolean().default(true),
				fsGroupChangePolicy: z.string().default("Always"),
				sysctls: z
					.object({
						name: z.string(),
						value: z.string(),
					})
					.array()
					.default([]),
				supplementalGroups: z.number().array().default([]),
				fsGroup: z.number().default(1001),
			})
			.prefault({}),

		containerSecurityContext: z
			.object({
				enabled: z.boolean().default(true),
				seLinuxOptions: z
					.object({
						level: z.string(),
						role: z.string(),
						type: z.string(),
						user: z.string(),
					})
					.nullable()
					.optional(),
				runAsUser: z.number().default(1001),
				runAsNonRoot: z.boolean().default(true),
				privileged: z.boolean().default(false),
				readOnlyRootFilesystem: z.boolean().default(true),
				allowPrivilegeEscalation: z.boolean().default(false),
				capabilities: z
					.object({
						drop: z.string().array().default(["ALL"]),
						add: z.string().array().default([]),
					})
					.prefault({}),
				seccompProfile: z
					.object({
						type: z.string().default("RuntimeDefault"),
						localhostProfile: z.string().optional(),
					})
					.prefault({}),
			})
			.prefault({}),
	})
	.extend(labelsAndAnnotationsSchema.shape)
	.prefault({});

const configmapSchema = z
	.object({
		data: z.record(z.string(), z.string()).prefault({}),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const secretSchema = z
	.object({
		type: z.string().default("Opaque"),
		data: z.record(z.string(), z.string()).prefault({}),
		stringData: z.record(z.string(), z.string()).prefault({}),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const roleSchema = z
	.object({
		rules: z
			.object({
				apiGroups: z.string().array(),
				resources: z.string().array(),
				verbs: z.string().array(),
			})
			.array()
			.default([]),
	})
	.extend(labelsAndAnnotationsSchema.shape)
	.prefault({});

const rolebindingSchema = z
	.object({
		roleName: z.string().default(""),
		roleKind: z.enum(["Role", "ClusterRole"]).default("Role"),
	})
	.extend(labelsAndAnnotationsSchema.shape)
	.prefault({});

const clusterrolebindingSchema = z
	.object({
		roleName: z.string().default(""),
		roleKind: z.enum(["ClusterRole"]).default("ClusterRole"),
	})
	.extend(labelsAndAnnotationsSchema.shape)
	.prefault({});

const rbacSchema = z
	.object({
		enabled: z.boolean().default(false),
		role: roleSchema,
		rolebinding: rolebindingSchema,
		clusterrolebinding: clusterrolebindingSchema,
	})
	.prefault({});

const hpaSchema = z
	.object({
		minReplicas: z.number().default(1),
		maxReplicas: z.number().default(3),
		targetCPU: z.number().default(80),
		targetMemory: z.number().default(0),
		behavior: z.record(z.string(), z.any()).prefault({}),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const vpaSchema = z
	.object({
		updateMode: z.enum(["Off", "Initial", "Recreate", "Auto"]).default("Auto"),
		controlledResources: z.string().array().default([]),
		minAllowed: z.record(z.string(), z.string()).prefault({}),
		maxAllowed: z.record(z.string(), z.string()).prefault({}),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const statefulsetSchema = z
	.object({
		replicas: z.number().default(1),
		serviceName: z.string().default(""),
		podManagementPolicy: z.enum(["OrderedReady", "Parallel"]).default("OrderedReady"),
		updateStrategy: z
			.object({
				type: z.enum(["RollingUpdate", "OnDelete"]).default("RollingUpdate"),
			})
			.prefault({}),
		volumeClaimTemplates: z
			.object({
				name: z.string(),
				accessModes: z.string().array().default(["ReadWriteOnce"]),
				size: z.string().default("8Gi"),
				storageClassName: z.string().default(""),
			})
			.array()
			.default([]),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const daemonsetSchema = z
	.object({
		updateStrategy: z
			.object({
				type: z.enum(["RollingUpdate", "OnDelete"]).default("RollingUpdate"),
			})
			.prefault({}),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const pvcSchema = z
	.object({
		accessModes: z.string().array().default(["ReadWriteOnce"]),
		size: z.string().default("8Gi"),
		storageClassName: z.string().default(""),
		volumeMode: z.enum(["Filesystem", "Block"]).default("Filesystem"),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const networkpolicySchema = z
	.object({
		policyTypes: z.enum(["Ingress", "Egress"]).array().default(["Ingress"]),
		allowExternal: z.boolean().default(true),
		ingress: z.record(z.string(), z.any()).array().default([]),
		egress: z.record(z.string(), z.any()).array().default([]),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const servicemonitorSchema = z
	.object({
		namespace: z.string().default(""),
		interval: z.string().default("30s"),
		scrapeTimeout: z.string().default(""),
		endpoints: z
			.object({
				port: z.string(),
				path: z.string().default("/metrics"),
				interval: z.string().optional(),
				scrapeTimeout: z.string().optional(),
			})
			.array()
			.default([]),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const certificateSchema = z
	.object({
		secretName: z.string().default(""),
		issuerRef: z
			.object({
				name: z.string().default(""),
				kind: z.enum(["Issuer", "ClusterIssuer"]).default("ClusterIssuer"),
				group: z.string().default("cert-manager.io"),
			})
			.prefault({}),
		dnsNames: z.string().array().default([]),
		duration: z.string().default(""),
		renewBefore: z.string().default(""),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const valuesSchema = z
	.object({
		global: globalSchema.prefault({}),
		nameOverride: z.string().default(""),
		fullnameOverride: z.string().default(""),
		namespaceOverride: z.string().default(""),
		common: z
			.object({
				exampleValue: z.literal("common-chart").optional(),
				global: globalSchema.optional(),
			})
			.extend(labelsAndAnnotationsSchema.shape)
			.prefault({}),
		deployment: deploymentSchema,
		pod: podSchema,
		service: serviceSchema,
		ingress: ingressSchema,
		serviceaccount: z
			.object({
				name: z.string().default(""),
				automountServiceAccountToken: z.boolean().default(false),
			})
			.extend(commonResourceSchema.shape)
			.prefault({}),
		rbac: rbacSchema,
		vpa: vpaSchema,
		statefulset: statefulsetSchema,
		servicemonitor: servicemonitorSchema,
		secret: secretSchema,
		pvc: pvcSchema,
		pdb: z
			.object({
				minAvailable: z.number().default(1),
				maxUnavailable: z.string().default(""),
			})
			.extend(commonResourceSchema.shape)
			.prefault({}),
		networkpolicy: networkpolicySchema,
		hpa: hpaSchema,
		daemonset: daemonsetSchema,
		configmap: configmapSchema,
		certificate: certificateSchema,
		extra: z.string().array().default([]),
	})
	.prefault({});

const jsonSchema = toJSONSchema(valuesSchema);
const defaultValues = valuesSchema.parse({});

await Deno.writeTextFile(
	"values.schema.json",
	JSON.stringify(jsonSchema, null, 2),
);
const header = "# This file is auto-generated from values.ts. Do not edit directly.\n";
await Deno.writeTextFile("values.yaml", header + yaml.stringify(defaultValues));
