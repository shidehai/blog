# Logging Guidelines

Use concise bounded diagnostics without adding a logging dependency. Docker uses
bounded json-file logs; Caddy retains JSON access logs.

Log lifecycle, operation/status, counts/checksums and safe IDs. Record build/PIDs
in isolated runtime evidence to prove no rebuild/restart. Migration reports are
protected artifacts because source details can be private.

Never log passwords, sessions, reader/DB/Restic/deploy credentials, headers,
Markdown bodies, private URLs or full environment. Unexpected API errors log a
fixed label and return bounded 503. Avoid raw parser/SQL payloads.
An unused marker scan does not prove a secret was consumed during build: current
images intentionally build without secrets; config/history/layer scans complement
that contract and runtime-only credential injection.
