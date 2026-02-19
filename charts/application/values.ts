import yaml from "npm:yaml@2.8.2";
import { z, toJSONSchema } from "npm:zod@4.3.6";

const globalSchema = z.object({
	imageRegistry: z
		.string()
		.default("")
		.describe(
			"Global Docker image registry that overrides all image.registry values. " +
			"Useful in air-gapped environments or when using a private mirror. " +
			'Example: "registry.example.com"',
		),
	storageClass: z
		.string()
		.default("")
		.describe(
			"Global storage class to use for all PersistentVolumeClaims. " +
			"When set, overrides any storageClassName defined at the resource level. " +
			'Example: "gp3"',
		),
	imagePullSecrets: z
		.object({
			name: z.string().describe("Name of the Kubernetes Secret containing Docker registry credentials."),
		})
		.array()
		.default([])
		.describe(
			"Global list of Docker registry pull secrets. Applied to all pods. " +
			"Each entry must have a name field referencing an existing Secret. " +
			'Example: [{ name: "my-registry-secret" }]',
		),
});

const labelsAndAnnotationsSchema = z.object({
	labels: z
		.record(z.string(), z.string())
		.prefault({})
		.describe(
			"Additional labels to add to the resource metadata. " +
			"Merged with common.labels and standard Helm labels. " +
			'Example: { team: "backend", tier: "api" }',
		),
	annotations: z
		.record(z.string(), z.string())
		.prefault({})
		.describe(
			"Additional annotations to add to the resource metadata. " +
			"Merged with common.annotations. Useful for integrations like external-dns, cert-manager, etc. " +
			'Example: { "prometheus.io/scrape": "true" }',
		),
});

const commonResourceSchema = z
	.object({
		enabled: z
			.boolean()
			.default(false)
			.describe(
				"Whether to create this resource. When false, the template is not rendered at all. " +
				"Example: true",
			),
	})
	.extend(labelsAndAnnotationsSchema.shape);

const ingressBackendSchema = z.object({
	service: z
		.object({
			name: z
				.string()
				.describe("Name of the Kubernetes Service to route traffic to."),
			port: z.union([
				z.object({
					name: z
						.string()
						.describe('Named port on the Service. Example: "http"'),
				}),
				z.object({
					number: z
						.number()
						.describe("Numeric port on the Service. Example: 80"),
				}),
			]).describe("Port to use on the backend Service. Specify either name or number."),
		})
		.describe("Backend Service reference for the Ingress path."),
});

const ingressSchema = z
	.object({
		apiVersion: z
			.string()
			.default("")
			.describe(
				"Override the Ingress API version. Leave empty to auto-detect from cluster capabilities. " +
				'Only set this if you need to force a specific version. Example: "networking.k8s.io/v1"',
			),
		hostname: z
			.string()
			.default("application.local")
			.describe(
				"Primary hostname for the Ingress rule. This is used as the Host header match. " +
				'Example: "myapp.example.com"',
			),
		pathType: z
			.string()
			.default("ImplementationSpecific")
			.describe(
				"How the Ingress path should be matched. " +
				'"Prefix" matches URL path prefixes, "Exact" requires an exact match, ' +
				'"ImplementationSpecific" depends on the IngressClass. ' +
				'Example: "Prefix"',
			),
		path: z
			.string()
			.default("/")
			.describe(
				"URL path to match for the primary hostname rule. " +
				'Combined with pathType to determine routing behavior. Example: "/api"',
			),
		tls: z
			.boolean()
			.default(false)
			.describe(
				"Enable TLS for the primary hostname. When true and selfSigned is true, " +
				"a TLS secret named <hostname>-tls is referenced. " +
				"When used with cert-manager annotations, the certificate is provisioned automatically. " +
				"Example: true",
			),
		existingSecretName: z
			.string()
			.default("")
			.describe(
				"Name of an existing TLS Secret to use instead of auto-generated ones. " +
				'Example: "my-tls-secret"',
			),
		ingressClassName: z
			.string()
			.default("")
			.describe(
				"IngressClass resource name. Determines which Ingress controller handles this Ingress. " +
				'Leave empty to use the cluster default. Example: "nginx"',
			),
		extraPaths: z
			.object({
				path: z.string().describe('URL path to match. Example: "/static"'),
				pathType: z.string().describe('Path matching strategy. Example: "Prefix"'),
				backend: ingressBackendSchema.describe("Backend Service to route this path to."),
			})
			.array()
			.default([])
			.describe(
				"Additional paths to add to the primary hostname rule. " +
				"These are rendered before the main path, allowing you to route specific paths to different backends. " +
				'Example: [{ path: "/static", pathType: "Prefix", backend: { service: { name: "static-svc", port: { number: 80 } } } }]',
			),
		extraHosts: z
			.object({
				name: z.string().describe('Hostname for the additional rule. Example: "api.example.com"'),
				path: z.string().describe('URL path to match. Example: "/"'),
				pathType: z.string().describe('Path matching strategy. Example: "Prefix"'),
			})
			.array()
			.default([])
			.describe(
				"Additional hostnames to add as separate Ingress rules. Each entry creates a new rule " +
				"routing to the same backend Service. " +
				'Example: [{ name: "api.example.com", path: "/", pathType: "Prefix" }]',
			),
		extraTls: z
			.object({
				hosts: z.string().array().describe('List of hostnames covered by this TLS certificate. Example: ["api.example.com"]'),
				secretName: z.string().describe('Name of the TLS Secret. Example: "api-tls-secret"'),
			})
			.array()
			.default([])
			.describe(
				"Additional TLS entries for extra hostnames. Each entry references a Secret containing tls.crt and tls.key. " +
				'Example: [{ hosts: ["api.example.com"], secretName: "api-tls" }]',
			),
		extraRules: z
			.string()
			.array()
			.default([])
			.describe(
				"Raw YAML strings for additional Ingress rules. Rendered as-is via tpl. " +
				"Use this for advanced routing not covered by extraHosts.",
			),
		selfSigned: z
			.boolean()
			.default(false)
			.describe(
				"When true and tls is enabled, indicates the TLS certificate is self-signed. " +
				"The TLS secret name is derived from the hostname (<hostname>-tls). " +
				"Example: true",
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const serviceSchema = z
	.object({
		type: z
			.enum(["ClusterIP", "LoadBalancer", "NodePort", "ExternalName"])
			.default("ClusterIP")
			.describe(
				"Kubernetes Service type. " +
				'"ClusterIP" exposes the service on a cluster-internal IP. ' +
				'"LoadBalancer" provisions a cloud load balancer. ' +
				'"NodePort" exposes the service on each node\'s IP at a static port. ' +
				'"ExternalName" maps to an external DNS name. ' +
				'Example: "LoadBalancer"',
			),
		ports: z
			.object({
				http: z
					.number()
					.default(80)
					.describe("Service port for HTTP traffic. Maps to the container's http port. Example: 80"),
				https: z
					.number()
					.default(443)
					.describe("Service port for HTTPS traffic. Maps to the container's https port. Example: 443"),
			})
			.prefault({})
			.describe("Port mappings for the Service. Each key maps to a named port on the container."),
		nodePorts: z
			.object({
				http: z
					.string()
					.default("")
					.describe(
						"Static NodePort for HTTP. Only used when type is NodePort or LoadBalancer. " +
						"Leave empty for auto-assignment. Must be in range 30000-32767. " +
						'Example: "30080"',
					),
				https: z
					.string()
					.default("")
					.describe(
						"Static NodePort for HTTPS. Only used when type is NodePort or LoadBalancer. " +
						'Example: "30443"',
					),
			})
			.prefault({})
			.describe("Static NodePort assignments. Only applicable when service type is NodePort or LoadBalancer."),
		protocol: z
			.enum(["SCTP", "TCP", "UDP"])
			.default("TCP")
			.describe(
				"IP protocol for the Service ports. Most HTTP services use TCP. " +
				"Use UDP for DNS or game servers. Example: \"TCP\"",
			),
		clusterIP: z
			.string()
			.default("")
			.describe(
				"Static ClusterIP address. Only applies when type is ClusterIP. " +
				'Set to "None" for a headless service (used with StatefulSets). ' +
				'Leave empty for auto-assignment. Example: "None"',
			),
		loadBalancerIP: z
			.string()
			.default("")
			.describe(
				"Static IP for the cloud load balancer. Only applies when type is LoadBalancer. " +
				"Not all cloud providers support this. " +
				'Example: "203.0.113.10"',
			),
		externalTrafficPolicy: z
			.string()
			.default("Cluster")
			.describe(
				"How external traffic is routed to pods. Only applies to LoadBalancer and NodePort types. " +
				'"Cluster" distributes to all pods (may add a hop). ' +
				'"Local" routes only to pods on the receiving node (preserves client IP). ' +
				'Example: "Local"',
			),
		sessionAffinity: z
			.string()
			.default("None")
			.describe(
				"Enable session affinity to route requests from the same client to the same pod. " +
				'"None" disables affinity. "ClientIP" enables IP-based session stickiness. ' +
				'Example: "ClientIP"',
			),
		loadBalancerSourceRanges: z
			.string()
			.array()
			.default([])
			.describe(
				"CIDR ranges allowed to access the LoadBalancer. Acts as a firewall rule. " +
				"Only applies when type is LoadBalancer. " +
				'Example: ["10.0.0.0/8", "192.168.0.0/16"]',
			),
		extraPorts: z
			.object({
				name: z.string().describe('Unique name for the port. Example: "grpc"'),
				protocol: z
					.enum(["SCTP", "TCP", "UDP"])
					.default("TCP")
					.describe('Protocol for this port. Example: "TCP"'),
				port: z.number().describe("Service port number. Example: 9090"),
				nodePort: z.number().optional().describe("Static NodePort. Only for NodePort/LoadBalancer. Example: 30090"),
				targetPort: z
					.union([z.string(), z.number()])
					.optional()
					.describe('Container port to target. Can be a number or a named port. Example: "grpc" or 9090'),
			})
			.array()
			.default([])
			.describe(
				"Additional ports to expose on the Service beyond the default http/https. " +
				'Example: [{ name: "grpc", port: 9090, protocol: "TCP" }]',
			),
		sessionAffinityConfig: z
			.object({
				clientIP: z
					.object({
						timeoutSeconds: z
							.number()
							.optional()
							.describe(
								"Timeout in seconds for ClientIP session affinity. " +
								"Default is 10800 (3 hours). Example: 3600",
							),
					})
					.optional()
					.describe("Configuration for ClientIP-based session affinity."),
			})
			.prefault({})
			.describe(
				"Configuration for session affinity. Only relevant when sessionAffinity is ClientIP. " +
				'Example: { clientIP: { timeoutSeconds: 3600 } }',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const deploymentSchema = z
	.object({
		replicas: z
			.number()
			.default(1)
			.describe(
				"Number of pod replicas to run. Set to 0 to stop all pods without deleting the Deployment. " +
				"Ignored when HPA is enabled (HPA manages replica count). " +
				"Example: 3",
			),
		strategy: z
			.object({
				type: z
					.enum(["RollingUpdate"])
					.default("RollingUpdate")
					.describe(
						"Deployment update strategy type. RollingUpdate gradually replaces old pods with new ones. " +
						'Example: "RollingUpdate"',
					),
			})
			.prefault({})
			.describe("Strategy used to replace old pods with new pods during updates."),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const probeSchema = z.object({
	enabled: z
		.boolean()
		.default(true)
		.describe(
			"Whether to configure this probe on the container. " +
			"Disable to skip this probe entirely. Example: true",
		),
	initialDelaySeconds: z
		.number()
		.default(30)
		.describe(
			"Seconds to wait after the container starts before running the first probe. " +
			"Set higher for slow-starting applications. Example: 60",
		),
	timeoutSeconds: z
		.number()
		.default(30)
		.describe(
			"Seconds after which the probe times out if no response is received. " +
			"Example: 5",
		),
	periodSeconds: z
		.number()
		.default(10)
		.describe(
			"How often (in seconds) to perform the probe. " +
			"Lower values detect failures faster but increase load. Example: 10",
		),
	successThreshold: z
		.number()
		.default(1)
		.describe(
			"Minimum consecutive successes for the probe to be considered successful after a failure. " +
			"Must be 1 for liveness and startup probes. Example: 1",
		),
	failureThreshold: z
		.number()
		.default(6)
		.describe(
			"Number of consecutive failures before the probe is considered failed. " +
			"For liveness probes, this triggers a container restart. Example: 3",
		),
	httpGet: z
		.object({
			path: z
				.string()
				.default("/")
				.describe(
					"HTTP path to probe on the container. Should return 2xx/3xx for healthy. " +
					'Example: "/healthz"',
				),
			port: z
				.string()
				.default("http")
				.describe(
					"Named port or port number to probe. Uses the container port name. " +
					'Example: "http"',
				),
		})
		.prefault({})
		.describe("HTTP GET configuration for the probe. The probe sends a GET request to the specified path and port."),
});

const podSchema = z
	.object({
		priorityClassName: z
			.string()
			.default("")
			.describe(
				"PriorityClass name for the pod. Controls scheduling priority and preemption. " +
				"Must reference an existing PriorityClass resource. " +
				'Example: "high-priority"',
			),
		schedulerName: z
			.string()
			.default("")
			.describe(
				"Name of the scheduler to use for pod placement. " +
				"Leave empty to use the default Kubernetes scheduler. " +
				'Example: "custom-scheduler"',
			),
		terminationGracePeriodSeconds: z
			.number()
			.default(0)
			.describe(
				"Seconds to wait for the pod to gracefully shut down before being forcefully killed. " +
				"Set this to give your application time to finish in-flight requests and clean up. " +
				"Example: 30",
			),

		command: z
			.string()
			.array()
			.default([])
			.describe(
				"Override the container entrypoint. Equivalent to Docker ENTRYPOINT. " +
				"When set, the image's default entrypoint is replaced entirely. " +
				'Example: ["/bin/sh", "-c"]',
			),
		args: z
			.string()
			.array()
			.default([])
			.describe(
				"Arguments passed to the container entrypoint. Equivalent to Docker CMD. " +
				"When command is set, these are passed as arguments to it. " +
				'Example: ["--config", "/etc/app/config.yaml"]',
			),

		containerPorts: z
			.object({
				http: z
					.number()
					.optional()
					.default(8080)
					.describe(
						"Primary HTTP port the container listens on. " +
						"This port is always exposed and named 'http'. " +
						"Example: 3000",
					),
				https: z
					.number()
					.optional()
					.describe(
						"HTTPS port the container listens on. " +
						"Only exposed if set. Named 'https' in the container spec. " +
						"Example: 8443",
					),
			})
			.prefault({})
			.describe("Ports the container exposes. The http port is always created; https is optional."),

		env: z
			.object({
				vars: z
					.object({
						name: z.string().describe('Environment variable name. Example: "DATABASE_URL"'),
						value: z.string().describe('Environment variable value. Example: "postgres://db:5432/myapp"'),
					})
					.array()
					.default([])
					.describe(
						"List of environment variables to set on the container. " +
						'Example: [{ name: "LOG_LEVEL", value: "info" }, { name: "PORT", value: "8080" }]',
					),
				configmap: z
					.string()
					.default("")
					.describe(
						"Name of a ConfigMap to load as environment variables via envFrom. " +
						"All keys in the ConfigMap become environment variables. " +
						'Example: "my-app-config"',
					),
				secret: z
					.string()
					.default("")
					.describe(
						"Name of a Secret to load as environment variables via envFrom. " +
						"All keys in the Secret become environment variables. " +
						'Example: "my-app-secrets"',
					),
			})
			.prefault({})
			.describe(
				"Environment variable configuration. Supports direct vars, ConfigMap refs, and Secret refs.",
			),

		probes: z
			.object({
				startup: probeSchema
					.prefault({ enabled: false })
					.describe(
						"Startup probe configuration. Runs once during container startup. " +
						"While the startup probe is running, liveness and readiness probes are disabled. " +
						"Use this for slow-starting containers to avoid premature restarts. " +
						"Disabled by default.",
					),
				liveness: probeSchema
					.prefault({})
					.describe(
						"Liveness probe configuration. Runs periodically to detect deadlocked or stuck containers. " +
						"If the probe fails, the container is restarted. " +
						"Enabled by default with HTTP GET on / port http.",
					),
				readiness: probeSchema
					.prefault({})
					.describe(
						"Readiness probe configuration. Runs periodically to determine if the container can accept traffic. " +
						"If the probe fails, the pod is removed from Service endpoints. " +
						"Enabled by default with HTTP GET on / port http.",
					),
			})
			.prefault({})
			.describe("Health check probes for the container. Controls startup, liveness, and readiness behavior."),

		image: z
			.object({
				registry: z
					.string()
					.default("docker.io")
					.describe(
						"Docker registry hostname. Overridden by global.imageRegistry if set. " +
						'Example: "ghcr.io"',
					),
				repository: z
					.string()
					.default("")
					.describe(
						"Image repository path (without registry or tag). " +
						'Example: "myorg/myapp"',
					),
				tag: z
					.string()
					.default("")
					.describe(
						"Image tag to pull. Ignored if digest is set. " +
						'Example: "v1.2.3"',
					),
				digest: z
					.string()
					.default("")
					.describe(
						"Image digest for immutable deployments. When set, overrides tag. " +
						"Ensures the exact image is used regardless of tag changes. " +
						'Example: "sha256:abc123..."',
					),
				pullPolicy: z
					.enum(["Always", "IfNotPresent", "Never"])
					.default("IfNotPresent")
					.describe(
						"Image pull policy. " +
						'"Always" pulls on every pod start (use with mutable tags like latest). ' +
						'"IfNotPresent" only pulls if the image is not cached locally. ' +
						'"Never" never pulls (image must exist locally). ' +
						'Example: "Always"',
					),
				pullSecrets: z
					.string()
					.array()
					.default([])
					.describe(
						"Names of Secrets for pulling images from private registries. " +
						"Applied in addition to global.imagePullSecrets. " +
						'Example: ["my-registry-secret"]',
					),
			})
			.prefault({})
			.describe(
				"Container image configuration. The final image is assembled as: " +
				"<registry>/<repository>:<tag> or <registry>/<repository>@<digest>.",
			),

		resourcesPreset: z
			.enum(["none", "nano", "micro", "small", "medium", "large", "xlarge", "2xlarge"])
			.default("none")
			.describe(
				"Preset resource configuration from the Bitnami common chart. " +
				'Set to "none" to use the custom resources object below instead. ' +
				'Other values (nano, micro, small, etc.) apply predefined CPU/memory limits. ' +
				'Example: "small"',
			),
		resources: z
			.object({
				requests: z
					.object({
						cpu: z
							.string()
							.default("100m")
							.describe(
								"Minimum CPU the container needs. Used by the scheduler for placement. " +
								'"100m" = 0.1 CPU cores. Example: "250m"',
							),
						memory: z
							.string()
							.default("128Mi")
							.describe(
								"Minimum memory the container needs. Used by the scheduler for placement. " +
								'Example: "256Mi"',
							),
					})
					.prefault({})
					.describe("Minimum resources guaranteed to the container."),
				limits: z
					.object({
						cpu: z
							.string()
							.default("250m")
							.describe(
								"Maximum CPU the container can use. Container is throttled if it exceeds this. " +
								'Example: "1" (1 full core)',
							),
						memory: z
							.string()
							.default("256Mi")
							.describe(
								"Maximum memory the container can use. Container is OOM-killed if it exceeds this. " +
								'Example: "512Mi"',
							),
					})
					.prefault({})
					.describe("Maximum resources the container can consume."),
			})
			.prefault({})
			.describe("CPU and memory resource requests and limits for the container."),
		initContainers: z
			.record(z.string(), z.any())
			.array()
			.default([])
			.describe(
				"List of init containers to run before the main container starts. " +
				"Init containers run sequentially and must complete successfully. " +
				"Use for database migrations, config generation, or waiting on dependencies. " +
				'Example: [{ name: "init-db", image: "busybox:latest", command: ["sh", "-c", "until nc -z db 5432; do sleep 1; done"] }]',
			),
		sidecars: z
			.record(z.string(), z.any())
			.array()
			.default([])
			.describe(
				"Additional containers to run alongside the main container in the same pod. " +
				"Sidecars share the pod network and can access the same volumes. " +
				'Example: [{ name: "log-shipper", image: "fluentd:latest" }]',
			),
		affinity: z
			.record(z.string(), z.any())
			.prefault({})
			.describe(
				"Custom pod affinity rules. When set, overrides affinityPreset, antiAffinityPreset, and nodeAffinityPreset. " +
				"Use for fine-grained control over pod scheduling. " +
				'Example: { nodeAffinity: { requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: [{ matchExpressions: [{ key: "kubernetes.io/arch", operator: "In", values: ["amd64"] }] }] } } }',
			),

		affinityPreset: z
			.enum(["", "soft", "hard"])
			.default("")
			.describe(
				"Simple pod affinity preset. Ignored when affinity is set. " +
				'"soft" prefers co-location (preferredDuringScheduling). ' +
				'"hard" requires co-location (requiredDuringScheduling). ' +
				"Empty string disables pod affinity. " +
				'Example: "soft"',
			),
		antiAffinityPreset: z
			.enum(["", "soft", "hard"])
			.default("soft")
			.describe(
				"Simple pod anti-affinity preset. Ignored when affinity is set. " +
				'"soft" prefers spreading pods across nodes. ' +
				'"hard" requires pods to be on different nodes. ' +
				'Example: "hard"',
			),
		nodeAffinityPreset: z
			.object({
				type: z
					.string()
					.default("")
					.describe(
						"Node affinity type. Ignored when affinity is set. " +
						'"soft" for preferred, "hard" for required. Empty to disable. ' +
						'Example: "hard"',
					),
				key: z
					.enum(["", "soft", "hard"])
					.default("")
					.describe(
						"Node label key to match. " +
						'Example: "kubernetes.io/arch"',
					),
				values: z
					.string()
					.array()
					.default([])
					.describe(
						"Node label values to match against the key. " +
						'Example: ["amd64", "arm64"]',
					),
			})
			.prefault({})
			.describe(
				"Simple node affinity preset. Ignored when affinity is set. " +
				"Schedules pods on nodes matching the specified label key/values.",
			),

		nodeSelector: z
			.record(z.string(), z.string())
			.prefault({})
			.describe(
				"Node labels that pods must match to be scheduled. " +
				"Simpler alternative to node affinity for basic label matching. " +
				'Example: { disktype: "ssd", "node.kubernetes.io/instance-type": "m5.large" }',
			),
		tolerations: z
			.record(z.string(), z.any())
			.array()
			.default([])
			.describe(
				"Tolerations allow pods to be scheduled on tainted nodes. " +
				"Use to run workloads on dedicated or spot nodes. " +
				'Example: [{ key: "dedicated", operator: "Equal", value: "gpu", effect: "NoSchedule" }]',
			),
		topologySpreadConstraints: z
			.record(z.string(), z.any())
			.array()
			.default([])
			.describe(
				"Control how pods are spread across topology domains (zones, nodes, etc.). " +
				"Ensures high availability by distributing pods evenly. " +
				'Example: [{ maxSkew: 1, topologyKey: "topology.kubernetes.io/zone", whenUnsatisfiable: "DoNotSchedule" }]',
			),

		securityContext: z
			.object({
				enabled: z
					.boolean()
					.default(true)
					.describe(
						"Whether to apply the pod-level security context. " +
						"Set to false to skip rendering the securityContext block entirely. " +
						"Example: true",
					),
				fsGroupChangePolicy: z
					.string()
					.default("Always")
					.describe(
						"Policy for changing ownership of volumes. " +
						'"Always" changes ownership on every mount. ' +
						'"OnRootMismatch" only changes if root dir permissions differ. ' +
						'Example: "OnRootMismatch"',
					),
				sysctls: z
					.object({
						name: z.string().describe('Sysctl parameter name. Example: "net.core.somaxconn"'),
						value: z.string().describe('Sysctl parameter value. Example: "1024"'),
					})
					.array()
					.default([])
					.describe(
						"Namespaced sysctl settings for the pod. " +
						'Example: [{ name: "net.core.somaxconn", value: "1024" }]',
					),
				supplementalGroups: z
					.number()
					.array()
					.default([])
					.describe(
						"Additional group IDs applied to all containers in the pod. " +
						"Useful for accessing shared volumes with group permissions. " +
						"Example: [1000, 2000]",
					),
				fsGroup: z
					.number()
					.default(1001)
					.describe(
						"Group ID applied to all volumes mounted by the pod. " +
						"Files created in volumes are owned by this group. " +
						"Example: 1001",
					),
			})
			.prefault({})
			.describe(
				"Pod-level security context. Applied to all containers in the pod. " +
				"Controls filesystem group, sysctls, and supplemental groups.",
			),

		containerSecurityContext: z
			.object({
				enabled: z
					.boolean()
					.default(true)
					.describe(
						"Whether to apply the container-level security context. " +
						"Set to false to skip rendering the securityContext block on the container. " +
						"Example: true",
					),
				seLinuxOptions: z
					.object({
						level: z.string().describe("SELinux level label."),
						role: z.string().describe("SELinux role label."),
						type: z.string().describe("SELinux type label."),
						user: z.string().describe("SELinux user label."),
					})
					.nullable()
					.optional()
					.describe("SELinux options for the container. Usually not needed unless running on SELinux-enabled nodes."),
				runAsUser: z
					.number()
					.default(1001)
					.describe(
						"UID to run the container process as. Use a non-root UID (>= 1000) for security. " +
						"Example: 1000",
					),
				runAsNonRoot: z
					.boolean()
					.default(true)
					.describe(
						"Require the container to run as a non-root user. " +
						"Kubernetes will reject pods that attempt to run as root. " +
						"Example: true",
					),
				privileged: z
					.boolean()
					.default(false)
					.describe(
						"Run the container in privileged mode. Grants full access to the host. " +
						"Almost never needed and is a security risk. " +
						"Example: false",
					),
				readOnlyRootFilesystem: z
					.boolean()
					.default(true)
					.describe(
						"Mount the container's root filesystem as read-only. " +
						"Prevents malicious writes. Use emptyDir volumes for writable directories. " +
						"Example: true",
					),
				allowPrivilegeEscalation: z
					.boolean()
					.default(false)
					.describe(
						"Whether the process can gain more privileges than its parent. " +
						"Should be false for most workloads. Required for some setuid binaries. " +
						"Example: false",
					),
				capabilities: z
					.object({
						drop: z
							.string()
							.array()
							.default(["ALL"])
							.describe(
								"Linux capabilities to drop from the container. " +
								'["ALL"] drops everything for maximum security. ' +
								'Example: ["ALL"]',
							),
						add: z
							.string()
							.array()
							.default([])
							.describe(
								"Linux capabilities to add back after dropping. " +
								"Only add what your application specifically needs. " +
								'Example: ["NET_BIND_SERVICE"]',
							),
					})
					.prefault({})
					.describe("Linux capabilities to add or drop from the container."),
				seccompProfile: z
					.object({
						type: z
							.string()
							.default("RuntimeDefault")
							.describe(
								"Seccomp profile type. " +
								'"RuntimeDefault" uses the container runtime\'s default profile. ' +
								'"Localhost" uses a custom profile from the node. ' +
								'"Unconfined" disables seccomp (not recommended). ' +
								'Example: "RuntimeDefault"',
							),
						localhostProfile: z
							.string()
							.optional()
							.describe(
								"Path to a custom seccomp profile on the node. " +
								'Only used when type is "Localhost". ' +
								'Example: "profiles/my-profile.json"',
							),
					})
					.prefault({})
					.describe("Seccomp profile to apply to the container for syscall filtering."),
			})
			.prefault({})
			.describe(
				"Container-level security context. Applied to the main container. " +
				"Controls user, root access, filesystem, capabilities, and seccomp.",
			),
	})
	.extend(labelsAndAnnotationsSchema.shape)
	.prefault({});

const configmapSchema = z
	.object({
		data: z
			.record(z.string(), z.string())
			.prefault({})
			.describe(
				"Key-value pairs to store in the ConfigMap. Keys become filenames when mounted as a volume, " +
				"or environment variable names when used with envFrom. " +
				'Example: { "config.yaml": "key: value\\nother: setting", "APP_ENV": "production" }',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const secretSchema = z
	.object({
		type: z
			.string()
			.default("Opaque")
			.describe(
				"Kubernetes Secret type. " +
				'"Opaque" is the default for arbitrary data. ' +
				'"kubernetes.io/tls" for TLS certificates (expects tls.crt and tls.key). ' +
				'"kubernetes.io/dockerconfigjson" for Docker registry credentials. ' +
				'Example: "kubernetes.io/tls"',
			),
		data: z
			.record(z.string(), z.string())
			.prefault({})
			.describe(
				"Base64-encoded secret data. Values must be base64 encoded. " +
				'Example: { "tls.crt": "LS0tLS1C...", "tls.key": "LS0tLS1C..." }',
			),
		stringData: z
			.record(z.string(), z.string())
			.prefault({})
			.describe(
				"Plain-text secret data. Kubernetes base64-encodes these values automatically. " +
				"Easier to use than data for simple string secrets. " +
				'Example: { username: "admin", password: "s3cret" }',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const roleSchema = z
	.object({
		rules: z
			.object({
				apiGroups: z
					.string()
					.array()
					.describe(
						'Kubernetes API groups this rule applies to. Use "" for the core API group. ' +
						'Example: ["", "apps", "batch"]',
					),
				resources: z
					.string()
					.array()
					.describe(
						"Kubernetes resources this rule grants access to. " +
						'Example: ["pods", "services", "deployments"]',
					),
				verbs: z
					.string()
					.array()
					.describe(
						"Actions allowed on the resources. " +
						'Example: ["get", "list", "watch", "create", "update", "delete"]',
					),
			})
			.array()
			.default([])
			.describe(
				"RBAC rules defining what permissions the Role grants. " +
				'Example: [{ apiGroups: [""], resources: ["pods"], verbs: ["get", "list", "watch"] }]',
			),
	})
	.extend(labelsAndAnnotationsSchema.shape)
	.prefault({});

const rolebindingSchema = z
	.object({
		roleName: z
			.string()
			.default("")
			.describe(
				"Name of the Role or ClusterRole to bind. " +
				"Defaults to the chart fullname (the auto-generated Role). " +
				"Set this to bind to a pre-existing role. " +
				'Example: "my-existing-role"',
			),
		roleKind: z
			.enum(["Role", "ClusterRole"])
			.default("Role")
			.describe(
				"Kind of role to bind. " +
				'"Role" binds a namespaced Role. ' +
				'"ClusterRole" binds a ClusterRole (can grant cluster-wide permissions within the namespace). ' +
				'Example: "ClusterRole"',
			),
	})
	.extend(labelsAndAnnotationsSchema.shape)
	.prefault({});

const clusterrolebindingSchema = z
	.object({
		roleName: z
			.string()
			.default("")
			.describe(
				"Name of the ClusterRole to bind. " +
				"Defaults to the chart fullname. " +
				"Set this to bind to a pre-existing ClusterRole. " +
				'Example: "my-cluster-role"',
			),
		roleKind: z
			.enum(["ClusterRole"])
			.default("ClusterRole")
			.describe(
				"Kind of role to bind. Always ClusterRole for ClusterRoleBindings. " +
				'Example: "ClusterRole"',
			),
	})
	.extend(labelsAndAnnotationsSchema.shape)
	.prefault({});

const rbacSchema = z
	.object({
		enabled: z
			.boolean()
			.default(false)
			.describe(
				"Whether to create RBAC resources (Role, RoleBinding, ClusterRoleBinding). " +
				"Enable when your application needs to interact with the Kubernetes API. " +
				"Example: true",
			),
		role: roleSchema.describe("Configuration for the namespaced Role resource."),
		rolebinding: rolebindingSchema.describe("Configuration for the RoleBinding resource."),
		clusterrolebinding: clusterrolebindingSchema.describe("Configuration for the ClusterRoleBinding resource."),
	})
	.prefault({});

const hpaSchema = z
	.object({
		minReplicas: z
			.number()
			.default(1)
			.describe(
				"Minimum number of replicas the HPA can scale down to. " +
				"Set to at least 2 for high availability. " +
				"Example: 2",
			),
		maxReplicas: z
			.number()
			.default(3)
			.describe(
				"Maximum number of replicas the HPA can scale up to. " +
				"Set based on your resource budget and expected peak load. " +
				"Example: 10",
			),
		targetCPU: z
			.number()
			.default(80)
			.describe(
				"Target average CPU utilization percentage across all pods. " +
				"HPA scales up when utilization exceeds this threshold. " +
				"Set to 0 to disable CPU-based scaling. " +
				"Example: 70",
			),
		targetMemory: z
			.number()
			.default(0)
			.describe(
				"Target average memory utilization percentage across all pods. " +
				"HPA scales up when utilization exceeds this threshold. " +
				"Set to 0 to disable memory-based scaling (default). " +
				"Example: 80",
			),
		behavior: z
			.record(z.string(), z.any())
			.prefault({})
			.describe(
				"Custom scaling behavior for scale-up and scale-down. " +
				"Use to control scaling speed and stabilization windows. " +
				'Example: { scaleDown: { stabilizationWindowSeconds: 300, policies: [{ type: "Percent", value: 10, periodSeconds: 60 }] } }',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const vpaSchema = z
	.object({
		updateMode: z
			.enum(["Off", "Initial", "Recreate", "Auto"])
			.default("Auto")
			.describe(
				"How the VPA applies resource recommendations. " +
				'"Off" only generates recommendations (no action). ' +
				'"Initial" applies recommendations only at pod creation. ' +
				'"Recreate" evicts pods to apply new recommendations. ' +
				'"Auto" lets the VPA choose the best method. ' +
				'Example: "Off"',
			),
		controlledResources: z
			.string()
			.array()
			.default([])
			.describe(
				"Which resources the VPA manages. Empty means the VPA decides. " +
				'Example: ["cpu", "memory"]',
			),
		minAllowed: z
			.record(z.string(), z.string())
			.prefault({})
			.describe(
				"Minimum resource values the VPA can recommend. " +
				"Prevents the VPA from setting resources too low. " +
				'Example: { cpu: "100m", memory: "128Mi" }',
			),
		maxAllowed: z
			.record(z.string(), z.string())
			.prefault({})
			.describe(
				"Maximum resource values the VPA can recommend. " +
				"Prevents the VPA from requesting excessive resources. " +
				'Example: { cpu: "4", memory: "8Gi" }',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const statefulsetSchema = z
	.object({
		replicas: z
			.number()
			.default(1)
			.describe(
				"Number of pod replicas. Each replica gets a stable hostname (pod-0, pod-1, etc.) " +
				"and its own PersistentVolumeClaim. " +
				"Example: 3",
			),
		serviceName: z
			.string()
			.default("")
			.describe(
				"Name of the headless Service that controls the network identity of pods. " +
				"Defaults to the chart fullname. Each pod gets a DNS entry: <pod>.<serviceName>.<namespace>.svc.cluster.local. " +
				'Example: "my-headless-svc"',
			),
		podManagementPolicy: z
			.enum(["OrderedReady", "Parallel"])
			.default("OrderedReady")
			.describe(
				"Controls how pods are created and deleted. " +
				'"OrderedReady" creates/deletes pods sequentially (pod-0 before pod-1). ' +
				'"Parallel" creates/deletes all pods simultaneously for faster scaling. ' +
				'Example: "Parallel"',
			),
		updateStrategy: z
			.object({
				type: z
					.enum(["RollingUpdate", "OnDelete"])
					.default("RollingUpdate")
					.describe(
						"StatefulSet update strategy. " +
						'"RollingUpdate" updates pods in reverse ordinal order automatically. ' +
						'"OnDelete" only updates pods when they are manually deleted. ' +
						'Example: "OnDelete"',
					),
			})
			.prefault({})
			.describe("Strategy for rolling out updates to StatefulSet pods."),
		volumeClaimTemplates: z
			.object({
				name: z
					.string()
					.describe(
						"Name of the volume claim. Used to mount the volume in pod spec. " +
						'Example: "data"',
					),
				accessModes: z
					.string()
					.array()
					.default(["ReadWriteOnce"])
					.describe(
						"How the volume can be mounted. " +
						'"ReadWriteOnce" allows read-write by a single node. ' +
						'"ReadOnlyMany" allows read-only by multiple nodes. ' +
						'"ReadWriteMany" allows read-write by multiple nodes. ' +
						'Example: ["ReadWriteOnce"]',
					),
				size: z
					.string()
					.default("8Gi")
					.describe(
						"Storage size to request. Each replica gets its own volume of this size. " +
						'Example: "50Gi"',
					),
				storageClassName: z
					.string()
					.default("")
					.describe(
						"StorageClass for dynamic volume provisioning. " +
						"Leave empty to use the cluster default StorageClass. " +
						'Example: "gp3"',
					),
			})
			.array()
			.default([])
			.describe(
				"PersistentVolumeClaim templates. Each template creates a volume per replica. " +
				"Volumes persist across pod restarts and rescheduling. " +
				'Example: [{ name: "data", accessModes: ["ReadWriteOnce"], size: "10Gi" }]',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const daemonsetSchema = z
	.object({
		updateStrategy: z
			.object({
				type: z
					.enum(["RollingUpdate", "OnDelete"])
					.default("RollingUpdate")
					.describe(
						"DaemonSet update strategy. " +
						'"RollingUpdate" updates pods on each node automatically. ' +
						'"OnDelete" only updates pods when they are manually deleted. ' +
						'Example: "OnDelete"',
					),
			})
			.prefault({})
			.describe("Strategy for rolling out updates to DaemonSet pods."),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const pvcSchema = z
	.object({
		accessModes: z
			.string()
			.array()
			.default(["ReadWriteOnce"])
			.describe(
				"How the volume can be mounted. " +
				'"ReadWriteOnce" allows read-write by a single node. ' +
				'"ReadOnlyMany" allows read-only by multiple nodes. ' +
				'"ReadWriteMany" allows read-write by multiple nodes (requires a compatible StorageClass like NFS or EFS). ' +
				'Example: ["ReadWriteOnce"]',
			),
		size: z
			.string()
			.default("8Gi")
			.describe(
				"Storage capacity to request. " +
				'Example: "50Gi"',
			),
		storageClassName: z
			.string()
			.default("")
			.describe(
				"StorageClass for dynamic volume provisioning. " +
				"Leave empty to use the cluster default. " +
				'Set to "-" to disable dynamic provisioning. ' +
				'Example: "gp3"',
			),
		volumeMode: z
			.enum(["Filesystem", "Block"])
			.default("Filesystem")
			.describe(
				"How the volume is consumed by the pod. " +
				'"Filesystem" mounts as a directory (most common). ' +
				'"Block" mounts as a raw block device (for specialized workloads). ' +
				'Example: "Filesystem"',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const networkpolicySchema = z
	.object({
		policyTypes: z
			.enum(["Ingress", "Egress"])
			.array()
			.default(["Ingress"])
			.describe(
				"Which traffic directions to apply rules to. " +
				'"Ingress" controls incoming traffic. ' +
				'"Egress" controls outgoing traffic. ' +
				"If a direction is listed but has no rules, all traffic in that direction is denied (unless allowExternal is true for Ingress). " +
				'Example: ["Ingress", "Egress"]',
			),
		allowExternal: z
			.boolean()
			.default(true)
			.describe(
				"When true and no custom ingress rules are defined, allows all inbound traffic. " +
				"When false with no custom rules, all inbound traffic is denied. " +
				"Ignored when custom ingress rules are provided. " +
				"Example: false",
			),
		ingress: z
			.record(z.string(), z.any())
			.array()
			.default([])
			.describe(
				"Custom ingress (inbound) rules. When set, overrides allowExternal. " +
				"Each entry defines a from selector and optional ports. " +
				'Example: [{ from: [{ namespaceSelector: { matchLabels: { name: "trusted" } } }], ports: [{ port: 8080, protocol: "TCP" }] }]',
			),
		egress: z
			.record(z.string(), z.any())
			.array()
			.default([])
			.describe(
				"Custom egress (outbound) rules. " +
				"Each entry defines a to selector and optional ports. " +
				'Example: [{ to: [{ ipBlock: { cidr: "10.0.0.0/8" } }], ports: [{ port: 443, protocol: "TCP" }] }]',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const servicemonitorSchema = z
	.object({
		namespace: z
			.string()
			.default("")
			.describe(
				"Namespace to create the ServiceMonitor in. " +
				"Defaults to the release namespace. Set this if your Prometheus operator watches a different namespace. " +
				'Example: "monitoring"',
			),
		interval: z
			.string()
			.default("30s")
			.describe(
				"How often Prometheus scrapes metrics from the default endpoint. " +
				"Ignored when custom endpoints are defined. " +
				'Example: "15s"',
			),
		scrapeTimeout: z
			.string()
			.default("")
			.describe(
				"Timeout for each scrape request on the default endpoint. " +
				"Must be less than interval. Leave empty for Prometheus default. " +
				'Example: "10s"',
			),
		endpoints: z
			.object({
				port: z
					.string()
					.describe(
						"Named port on the Service to scrape. Must match a port name from the Service. " +
						'Example: "metrics"',
					),
				path: z
					.string()
					.default("/metrics")
					.describe(
						"HTTP path to scrape for metrics. " +
						'Example: "/metrics"',
					),
				interval: z
					.string()
					.optional()
					.describe(
						"Override the scrape interval for this endpoint. " +
						'Example: "10s"',
					),
				scrapeTimeout: z
					.string()
					.optional()
					.describe(
						"Override the scrape timeout for this endpoint. " +
						'Example: "5s"',
					),
			})
			.array()
			.default([])
			.describe(
				"Custom scrape endpoints. When set, replaces the default endpoint (http port, /metrics path). " +
				"Use for applications exposing metrics on non-standard ports or paths. " +
				'Example: [{ port: "metrics", path: "/custom-metrics", interval: "15s" }]',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const certificateSchema = z
	.object({
		secretName: z
			.string()
			.default("")
			.describe(
				"Name of the Secret where the TLS certificate is stored. " +
				"Defaults to <fullname>-tls. " +
				'Example: "my-app-tls"',
			),
		issuerRef: z
			.object({
				name: z
					.string()
					.default("")
					.describe(
						"Name of the cert-manager Issuer or ClusterIssuer to use. " +
						'Example: "letsencrypt-prod"',
					),
				kind: z
					.enum(["Issuer", "ClusterIssuer"])
					.default("ClusterIssuer")
					.describe(
						"Kind of the issuer. " +
						'"ClusterIssuer" is cluster-scoped (shared across namespaces). ' +
						'"Issuer" is namespace-scoped. ' +
						'Example: "ClusterIssuer"',
					),
				group: z
					.string()
					.default("cert-manager.io")
					.describe(
						"API group of the issuer. " +
						'Default is "cert-manager.io" for standard cert-manager issuers. ' +
						'Example: "cert-manager.io"',
					),
			})
			.prefault({})
			.describe("Reference to the cert-manager Issuer or ClusterIssuer that signs the certificate."),
		dnsNames: z
			.string()
			.array()
			.default([])
			.describe(
				"DNS names (Subject Alternative Names) to include in the certificate. " +
				"The certificate is valid for all listed hostnames. " +
				'Example: ["myapp.example.com", "api.example.com"]',
			),
		duration: z
			.string()
			.default("")
			.describe(
				"How long the certificate is valid. Uses Go duration format. " +
				"Leave empty for the issuer default (usually 90 days for Let's Encrypt). " +
				'Example: "2160h" (90 days)',
			),
		renewBefore: z
			.string()
			.default("")
			.describe(
				"How long before expiry to renew the certificate. Uses Go duration format. " +
				"Leave empty for the issuer default. " +
				'Example: "360h" (15 days before expiry)',
			),
	})
	.extend(commonResourceSchema.shape)
	.prefault({});

const valuesSchema = z
	.object({
		global: globalSchema
			.prefault({})
			.describe("Global settings shared across all chart resources and subcharts."),
		nameOverride: z
			.string()
			.default("")
			.describe(
				"Partially override the chart name used in resource names. " +
				"The release name is still prepended. " +
				'Example: "myapp" results in names like "release-myapp"',
			),
		fullnameOverride: z
			.string()
			.default("")
			.describe(
				"Fully override the name used for all resources. " +
				"Replaces both the release name and chart name entirely. " +
				'Example: "my-custom-app"',
			),
		namespaceOverride: z
			.string()
			.default("")
			.describe(
				"Override the namespace for all resources. " +
				"Defaults to the Helm release namespace. " +
				'Example: "production"',
			),
		common: z
			.object({
				exampleValue: z.literal("common-chart").optional(),
				global: globalSchema.optional(),
			})
			.extend(labelsAndAnnotationsSchema.shape)
			.prefault({})
			.describe(
				"Common settings applied to all resources. " +
				"Labels and annotations defined here are merged into every resource's metadata.",
			),
		deployment: deploymentSchema.describe(
			"Deployment workload configuration. Creates a Kubernetes Deployment that manages ReplicaSets and pods. " +
			"Use for stateless applications. Only one of deployment, statefulset, or daemonset should be enabled.",
		),
		pod: podSchema.describe(
			"Pod template configuration shared by deployment, statefulset, and daemonset. " +
			"Controls the container image, ports, probes, env vars, resources, security, and scheduling.",
		),
		service: serviceSchema.describe(
			"Kubernetes Service configuration. Exposes the application pods via a stable network endpoint. " +
			"Supports ClusterIP, LoadBalancer, NodePort, and ExternalName types.",
		),
		ingress: ingressSchema.describe(
			"Ingress configuration for HTTP/HTTPS routing. " +
			"Routes external traffic to the Service based on hostname and path rules.",
		),
		serviceaccount: z
			.object({
				name: z
					.string()
					.default("")
					.describe(
						"Custom name for the ServiceAccount. " +
						"Defaults to the chart fullname. " +
						'Example: "my-app-sa"',
					),
				automountServiceAccountToken: z
					.boolean()
					.default(false)
					.describe(
						"Whether to mount the ServiceAccount token into pods. " +
						"Set to true if your application needs to call the Kubernetes API. " +
						"Keep false for better security when API access is not needed. " +
						"Example: true",
					),
			})
			.extend(commonResourceSchema.shape)
			.prefault({})
			.describe(
				"ServiceAccount configuration. Creates a Kubernetes identity for pods. " +
				"Required for RBAC and integration with cloud IAM (e.g., AWS IRSA, GCP Workload Identity).",
			),
		rbac: rbacSchema.describe(
			"RBAC configuration. Creates Role, RoleBinding, and ClusterRoleBinding resources. " +
			"Enable when your application needs Kubernetes API access (e.g., reading Secrets, listing pods).",
		),
		vpa: vpaSchema.describe(
			"VerticalPodAutoscaler configuration. Automatically adjusts container CPU and memory requests/limits. " +
			"Requires the VPA controller to be installed in the cluster.",
		),
		statefulset: statefulsetSchema.describe(
			"StatefulSet workload configuration. Creates pods with stable network identities and persistent storage. " +
			"Use for databases, message queues, and other stateful applications. " +
			"Only one of deployment, statefulset, or daemonset should be enabled.",
		),
		servicemonitor: servicemonitorSchema.describe(
			"Prometheus ServiceMonitor configuration. Creates a monitoring target for Prometheus Operator. " +
			"Requires Prometheus Operator to be installed in the cluster.",
		),
		secret: secretSchema.describe(
			"Kubernetes Secret configuration. Stores sensitive data like passwords, tokens, and TLS certificates. " +
			"Data is stored base64-encoded in etcd.",
		),
		pvc: pvcSchema.describe(
			"PersistentVolumeClaim configuration. Requests persistent storage from the cluster. " +
			"Use for applications that need data to survive pod restarts (logs, uploads, cache).",
		),
		pdb: z
			.object({
				minAvailable: z
					.number()
					.default(1)
					.describe(
						"Minimum number of pods that must remain available during voluntary disruptions. " +
						"Can be an absolute number. Set to 0 to disable (when using maxUnavailable instead). " +
						"Example: 2",
					),
				maxUnavailable: z
					.string()
					.default("")
					.describe(
						"Maximum number of pods that can be unavailable during voluntary disruptions. " +
						"Can be an absolute number or a percentage. " +
						'Leave empty to use minAvailable instead. Example: "25%"',
					),
			})
			.extend(commonResourceSchema.shape)
			.prefault({})
			.describe(
				"PodDisruptionBudget configuration. Limits how many pods can be down during voluntary disruptions " +
				"(node drains, cluster upgrades). Set either minAvailable or maxUnavailable, not both.",
			),
		networkpolicy: networkpolicySchema.describe(
			"NetworkPolicy configuration. Controls which pods and external IPs can communicate with your application. " +
			"Requires a CNI plugin that supports NetworkPolicy (Calico, Cilium, etc.).",
		),
		hpa: hpaSchema.describe(
			"HorizontalPodAutoscaler configuration. Automatically scales the number of pod replicas based on " +
			"CPU/memory utilization. When enabled, the deployment replicas field is managed by the HPA.",
		),
		daemonset: daemonsetSchema.describe(
			"DaemonSet workload configuration. Ensures a pod runs on every (or selected) node. " +
			"Use for node-level agents like log collectors, monitoring, or network plugins. " +
			"Only one of deployment, statefulset, or daemonset should be enabled.",
		),
		configmap: configmapSchema.describe(
			"ConfigMap configuration. Stores non-sensitive configuration data as key-value pairs. " +
			"Can be mounted as files or injected as environment variables.",
		),
		certificate: certificateSchema.describe(
			"cert-manager Certificate configuration. Automatically provisions and renews TLS certificates. " +
			"Requires cert-manager to be installed in the cluster.",
		),
		extra: z
			.string()
			.array()
			.default([])
			.describe(
				"List of raw YAML strings for additional Kubernetes resources not covered by this chart. " +
				"Each string is rendered as a separate Kubernetes resource. " +
				'Example: ["apiVersion: v1\\nkind: ConfigMap\\nmetadata:\\n  name: extra-config\\ndata:\\n  key: value"]',
			),
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
