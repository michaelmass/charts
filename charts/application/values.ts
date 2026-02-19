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
		type: z.enum(["ClusterIP", "LoadBalancer"]).default("ClusterIP"),
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
				pullPolicy: z.string().default("IfNotPresent"), // TODO use an enum
				pullSecrets: z.string().array().default([]),
			})
			.prefault({}),

		resourcesPreset: z.enum(["none"]).default("none"), // TODO add the complete definition
		resources: z.object({}).prefault({}), // TODO add the complete definition
		initContainers: z.object({}).array().default([]), // TODO add the complete definition
		sidecars: z.object({}).array().default([]), // TODO add the complete definition
		affinity: z.object({}).prefault({}), // TODO add the complete definition

		affinityPreset: z.enum(["", "soft", "hard"]).default(""),
		antiAffinityPreset: z.enum(["", "soft", "hard"]).default("soft"),
		nodeAffinityPreset: z
			.object({
				type: z.string().default(""),
				key: z.enum(["", "soft", "hard"]).default(""),
				values: z.string().array().default([]),
			})
			.prefault({}),

		nodeSelector: z.object({}).prefault({}), // TODO add the complete definition
		tolerations: z.object({}).array().default([]), // TODO add the complete definition
		topologySpreadConstraints: z.object({}).array().default([]), // TODO add the complete definition

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
				readOnlyRootFilesystem: z.boolean().default(false),
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
		rbac: z
			.object({
				enabled: z.boolean().default(false),
			})
			.prefault({}),
		vpa: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		statefulset: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		servicemonitor: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		secret: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		pvc: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		pdb: z
			.object({
				minAvailable: z.number().default(1),
				maxUnavailable: z.string().default(""),
			})
			.extend(commonResourceSchema.shape)
			.prefault({}),
		networkpolicy: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		hpa: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		daemonset: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		configmap: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		certificate: z.object({}).extend(commonResourceSchema.shape).prefault({}),
		extra: z.string().array().default([]),
	})
	.prefault({});

const jsonSchema = toJSONSchema(valuesSchema);
const defaultValues = valuesSchema.parse({});

await Deno.writeTextFile(
	"values.schema.json",
	JSON.stringify(jsonSchema, null, 2),
);
await Deno.writeTextFile("values.yaml", yaml.stringify(defaultValues));
