# Security

This is an early desktop prototype. Please report vulnerabilities through the
repository's GitHub **Security → Report a vulnerability** flow, rather than a
public issue containing exploit details, credentials or private data. If private
reporting is unavailable, open a minimal issue requesting a private contact path.
There is no guaranteed response SLA.

Focus areas include remote-page sandbox escapes, IPC origin validation, unintended
clipboard access, leakage between account sessions, credentials and local model
server exposure. Include a version, reproduction steps using test accounts and
expected/actual behavior. Never send actual session cookies or API keys.

Only the current main branch is maintained. The prototype does not provide
anonymity, browser fingerprint protection or automatic security updates for
independently packaged copies. Keep Electron and model runtimes up to date.
