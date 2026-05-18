# Security Policy

Zap Browser is beta software that integrates browser functionality with Nostr identity, Lightning payments, NWC and local encrypted storage.

Because the project can interact with real funds and private keys, security reports are taken seriously.

## Supported Versions

| Version | Supported |
|--------|-----------|
| latest beta release | ✅ |
| older beta releases | best effort |
| pre-release/dev branches | ❌ |

Users should always run the latest available beta release.

## Scope

Security reports may include, but are not limited to:

- Nostr private key exposure
- NWC secret exposure
- unintended signing behavior
- unauthorized Lightning payment execution
- IPC privilege escalation
- renderer-to-main process escape
- insecure local storage
- broken permission boundaries
- update/release integrity issues
- privacy leaks caused by browser behavior

## Out of Scope

The following are generally out of scope unless they demonstrate a concrete security impact:

- issues requiring full local machine compromise
- social engineering
- spam or phishing reports unrelated to Zap Browser code
- denial of service without security impact
- vulnerabilities in third-party services used by the user

## Reporting a Vulnerability

Please do not open a public GitHub issue for sensitive vulnerabilities.

Preferred reporting options:

1. Open a private security advisory on GitHub, if available.
2. Contact the maintainer privately using the contact method listed in the repository profile.
3. If no private channel is available, open a minimal public issue saying that you need a private security contact, without disclosing technical details.

Please include:

- affected version
- operating system
- clear reproduction steps
- expected behavior
- actual behavior
- potential impact
- logs/screenshots if useful
- whether funds, keys or signatures may be at risk

## Disclosure Process

After receiving a valid report:

1. The issue will be acknowledged as soon as possible.
2. The vulnerability will be reproduced and assessed.
3. A fix will be developed privately if required.
4. A patched beta release will be published.
5. Security notes will be added to the release when appropriate.

Public disclosure should wait until a fix is available, unless there is active exploitation or another serious reason to disclose earlier.

## Security Expectations

Zap Browser is still beta software.

Do not store large amounts of funds in the browser.

For Lightning usage, prefer connecting a limited spending wallet through NWC rather than exposing access to a high-value node wallet.

## Current Security Model

Zap Browser aims to follow these principles:

- private keys stay local
- Nostr signing happens locally
- wallet secrets are encrypted at rest
- renderer code does not directly access raw secrets
- sensitive actions go through Electron main-process IPC
- permissions are explicit and revocable
- no telemetry or cloud sync

Security hardening is ongoing and tracked in GitHub issues.

## Future Work

Planned security improvements include:

- stricter IPC validation
- improved payment confirmation UX
- portable-mode passphrase encryption
- encrypted local history
- first-party storage isolation
- anti-fingerprinting protections
- signed release/update verification
- external audit before a stable v1.0 release
