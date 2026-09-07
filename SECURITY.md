# Security

The game requires no account, credentials, backend, or analytics. Saves contain only in-game progress. Imported files are size-limited, version-checked, and validated before use.

Report vulnerabilities through private GitHub vulnerability reporting when enabled, or contact the repository owner privately. Do not post exploitable details or private files in public issues. Include the affected build, browser, reproduction steps, and impact.

Deploy only `dist/` over HTTPS. Never put credentials in Vite environment variables; client assets are public. Review dependency upgrades. GitHub Pages cannot set custom response headers; use a host with configurable headers if a strict HTTP Content Security Policy becomes a requirement.
