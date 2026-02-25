{{/*
Helper functions for the application chart.
*/}}

{{/*
Return the service account name.
If serviceaccount.name is set, use that. Otherwise, use the fullname.
*/}}
{{- define "application.serviceAccountName" -}}
{{- if .Values.serviceaccount.name -}}
    {{- .Values.serviceaccount.name -}}
{{- else -}}
    {{- include "common.names.fullname" . -}}
{{- end -}}
{{- end -}}
