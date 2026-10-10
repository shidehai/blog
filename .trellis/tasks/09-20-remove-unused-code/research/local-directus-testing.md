# Research: Legitimate local Directus 12.2.0 licensing and testing

- Query: Can a fresh, project-pinned Directus 12.2.0/PostgreSQL 17.9 test instance legitimately enable `custom_permission_rules_enabled` without an account or human activation? What can Core alone validate?
- Scope: mixed; project contracts plus official Directus documentation, announcements, agreement, and version-pinned source only.
- Date: 2026-10-09
- Ownership: research only. No Docker operations, live API actions, Git operations, secret inspection, or writes outside this file were performed.

## Findings

### Decision summary

1. **There is a registration-free Core starting point, not a documented registration-free full-feature development license.** Official documentation permits starting without a key, with custom permission rules unavailable. Version 12.2.0's license manager returns `CORE_LICENSE` when no license token exists. No official public development key, automatic local-development entitlement, or self-service self-hosted trial key was found. Do not confuse a Cloud trial with a license for this local Docker image. [S01, S02, S07]
2. **The supported free route to custom rules is an issued Open Innovation Grant (OIG).** The owner must apply, supply identity/contact information, accept the agreement, and obtain an official key, followed by instance activation. The agreement identifies the grantee through account registration. This is not an anonymous developer-mode switch. Self-hosting needs no paid Cloud subscription; a mandatory separate Cloud-project signup/login was not established. [S04, S05, S06]
3. **Core can legitimately support a separate, basic read-only policy.** Its restriction is custom permission rules, not all CRUD permissions. This can exercise real Directus transport and a successful secret-fed image build against synthetic data, without pretending to validate the production scoped Build Reader. [S01, S08, S09]

**No pre-existing licensed instance is a startup prerequisite.** Main can create and retain its own isolated, pinned Core stack, apply schema, seed synthetic records, and test basic authorization/build transport now. An issued license is needed for the scoped custom-ACL portion, not for starting that test environment. [S01, S08, S09]

### Official free-grant constraints for the isolated stack

- Apply through the official OIG page. Current eligibility is **less than USD 5 million annual gross revenue and fewer than 50 full-/part-time employees** for a qualifying business. It is assessed against the legal entities whose representatives use Studio, not the size of a disposable test database. Personal projects are assessed on the individual's own finances, not automatically their employer's. Have the owner verify eligibility and accept the agreement; keys arrive by email. [S02, S04, S05, S06]
- **OIG is now perpetual, subject to ongoing eligibility and the agreement.** Directus announced this on **September 10, 2026**, also saying existing keys had their expiration removed. The current agreement is dated **August 28, 2026**. The annual-expiry documentation/repository text is stale; verify the actual issued license if expiry differs. [S02, S03, S04, S05]
- OIG covers custom access policies and SSO, with **five instance activations** per key for one project's local/dev/staging/production environments plus a spare. Local licensed testing consumes an activation. [S03, S05]
- Activations bind to the project database and `PUBLIC_URL`. Preserve both for repeated licensed runs. A fixed loopback URL such as `http://127.0.0.1:18055` is a reasonable local-test choice if actually configured by main; local development is explicitly an intended activation use. Do not rotate URL/port/database each licensed run. [S03, S05]
- **Telemetry is mandatory, not necessarily disabled by `TELEMETRY=false`.** The agreement prohibits disabling/blocking it; v12.2.0's scheduler ignores the opt-out when `telemetry_required` is true. Ensure effective reporting works, including outbound access to the default `https://telemetry.directus.io`. OIG does not permit offline/air-gapped operation. [S04, S11, S15]
- Activation/refresh needs outbound access to `https://licensing.directus.com` and a valid absolute `PUBLIC_URL`; `/` or another relative value is rejected. A loopback CMS can still make the required outbound requests. Do not override the license service with a mock. [S01]
- Keep the official image's default **`NODE_ENV=production`** even when using it for local development/testing. The deployment's purpose does not require changing the packaged application's Node environment; changing it is not a documented feature-unlocking mode. [S16]
- Configure a license key **or** an offline token, never both: the pinned initializer rejects both being set. OIG is the online-key path, not an entitlement to an Enterprise offline token. [S07, S11]
- **Deactivate before deleting the licensed database or permanently changing the URL.** Deleting containers or removing a key from an environment does not itself demonstrate server-side activation release. The OIG documentation recommends reusing a stable licensed CI instance rather than generating a new activation per job. [S03, S05]

### Supported activation and teardown choices

**Environment-managed key:** Supply only the genuine issued key through the isolated Directus service's `LICENSE_KEY`; keep it out of source, logs, image build arguments/layers, and the public-site runtime. The project already maps `DIRECTUS_LICENSE_KEY` to that variable. Never supply a fabricated example value. Environment configuration takes precedence over a database-stored key. [S01, S10; `deploy/compose.yaml:92`]

**UI/API-managed key:** With no nonempty environment key, an administrator can use Settings → License. In the pinned API, `POST /license` requires a body property named `license_key`; `DELETE /license` deactivates. Both are administrator operations. This gives a direct disposable-development teardown path, but still needs an issued grant/paid key. [S12]

**Environment-managed teardown:** `api/src/license/manager.ts:192` makes an env-sourced license API-noneditable. Official documentation provides the supported sequence: **remove the environment key, restart with the same database/URL, then use Settings → License → Deactivate License**. Removal/restart alone does not release the activation. The pinned initializer supports falling back to the stored database key. Plan this before consuming a throwaway activation; stranded activations currently require support, not a self-service portal. [S01, S07]

After activation, inspect authenticated `GET /license` and require the effective value of `custom_permission_rules_enabled` (`override ?? default`) to be true before running the existing project bootstrap/access checks. Neither a license name nor successful startup alone proves that entitlement. [S13; `directus/bootstrap.mjs:185`; `tests/directus.mjs:364`]

Paid self-hosted licenses are another official route when OIG eligibility is not met. Obtain a vendor-issued license with the required entitlement. No published automatic self-hosted evaluation-key process was located; contacting Directus about an evaluation is an escalation, not a guaranteed or autonomously obtainable key. [S01]

### Core basic permissions versus custom rules: exact pinned behavior

In official v12.2.0 source, `api/src/license/entitlements/lib/custom-permission-rules-enabled.ts:9`, `hasCustomRule()` returns true for a non-system permission if any of these hold:

- `fields` does not include `"*"`;
- `permissions` contains at least one property;
- `validation` contains at least one property;
- `presets` contains at least one property.

Null or empty objects in those three rule properties do not create a custom rule. There is also a narrowly defined exemption for recommended application/system permissions; it is not a general exemption for this project's content policies. [S08]

The permissions service applies the entitlement check on create/update specifically when `hasCustomRule()` is true and the recommended-permission exception does not apply. Its Core read path also excludes custom permission records. Thus the main session's proposed synthetic-test permission shape is supported by the inspected implementation: [S09]

```json
{
  "collection": "posts",
  "action": "read",
  "fields": ["*"],
  "permissions": null,
  "validation": null,
  "presets": null
}
```

Assign such permissions only to a **separate test-only policy/identity**, not Public and not the production Build Reader policy. Add only the collections actually needed by the synthetic build, remain within the instance's effective Core limits, and do not add create/update/delete permissions. This is a research recommendation; this agent did not create the policy or verify the live result.

The policy gives **all-row/all-field read access to each granted collection**. It cannot enforce published-only posts, a field allowlist, or folder-scoped private media. Client query filters and requesting fewer fields do not turn it into server-enforced least privilege. The project's publication/folder/field restrictions meet the custom-rule definition. [S08, S09; `directus/bootstrap.mjs:194`; `tests/directus.mjs:369`]

Accordingly, a successful Core/synthetic build can substantiate API transport, decoding, successful BuildKit secret consumption, image secret scanning, and runtime behavior. **It can satisfy literal AC6 once the exact token/image and route proofs are recorded**, as main's checker has agreed. It **does not establish** the production scoped Build Reader's security boundary or complete AC8. Preserve the existing fail-closed bootstrap/access tests; do not make a license a prerequisite for the legitimate Core positive path.

Main's latest report on 2026-10-09: the isolated instance is healthy and retained; schema/seed passed; a separate basic read-only identity works while anonymous access, writes, and user access return 403; a real nine-post Directus/BuildKit-secret image built. Exact-image/token/route proof remains the stated AC6 follow-up. These are **main-reported observations**, not live checks performed by this research agent. Actual basic-permission retirement/deletion can also be tested autonomously without modifying the production gate; that is narrower than full custom-rule permission validation.

### What can be completed autonomously

| Action | Boundary |
| --- | --- |
| Start/use the requested fresh pinned Core stack; apply schema; seed synthetic content | Main session can do this without obtaining a feature license. This sidecar performs no live actions. |
| Test a separate basic read-only identity with the permission shape above | Supported Core path; synthetic data only; not a replacement Build Reader and not scoped-access acceptance. |
| Exercise successful Directus transport/build and image secret handling using that synthetic identity | Can satisfy literal AC6 after exact-token/image/route proof; accurately label the basic authorization model. |
| Exercise exact-ID retirement/deletion using actual Core basic permission records | Supported narrow retirement evidence; preserve other identities/content and do not claim full custom-ACL AC8 coverage. |
| Enable custom row/field/folder rules without an issued key | No supported anonymous path found; do not attempt. |
| Apply for OIG, attest finances/eligibility, accept the agreement, retrieve the owner's emailed key | Requires human/owner activation or explicit authorized participation; not completed by research. |
| Activate an owner-supplied valid key, inspect entitlements, run full bootstrap/access/build tests, then deactivate | Main can execute after owner authorization and a compliant telemetry/network/activation plan. |

### Files found and code patterns

- `.trellis/tasks/09-20-remove-unused-code/prd.md` — task scope and AC6/AC8; preserve CMS data and existing user work.
- `.trellis/tasks/09-20-remove-unused-code/validation.md` — earlier isolated Core experiment and the still-missing scoped build/access evidence.
- `directus/README.md:17` — intentional custom-permission licensing gate and the grant instructions.
- `directus/README.md:32` — annual-duration statement now conflicts with the September 10, 2026 announcement.
- `directus/bootstrap.mjs:185` — authenticates `/license` and fails closed before scoped permission installation.
- `tests/directus.mjs:364` — resolves effective custom-rule entitlement; `tests/directus.mjs:369` gates access verification.
- `deploy/compose.yaml:78` — Directus 12.2.0 pin; `deploy/compose.yaml:132` — PostgreSQL 17.9-alpine pin.
- `deploy/compose.yaml:92` — license secret mapping; `deploy/compose.yaml:94` — `TELEMETRY: "false"` requests opt-out, but an effective `telemetry_required` entitlement overrides it. Verify actual reporting, rather than assuming this setting disables licensed telemetry.
- `deploy/compose.dev.yaml:38` — development-only stable `DIRECTUS_PUBLIC_URL` override.
- Official `api/src/license/utils/get-license-key.ts:7` at v12.2.0 — environment key first, otherwise database key.
- Official `api/src/license/manager.ts:196` at v12.2.0 — fallback to Core without a token; `api/src/license/manager.ts:192` — environment-managed API immutability.
- Official `api/src/license/entitlements/lib/custom-permission-rules-enabled.ts:9` at v12.2.0 — precise basic/custom predicate, used by the permissions service.
- Official `api/src/schedules/telemetry.ts` at v12.2.0 — skips telemetry only when it is not required by entitlement and the environment flag is false.

### Related specs

- `.trellis/workflow.md` — persistent task research and isolated research role.
- `.trellis/spec/backend/index.md` — Directus is a private build-time source; tests target disposable/backed-up instances.
- `.trellis/spec/backend/database-guidelines.md:12` — pinned versions and CMS/source-of-truth safety.
- `.trellis/spec/backend/quality-guidelines.md:66` — Core failing the custom-permission gate is expected, not a reason to weaken it.

### External references

All references are primary Directus publications; web pages were consulted on 2026-10-09. Source references are pinned to **v12.2.0**, not `main`. URLs are retained explicitly so the research remains useful outside this chat.

- [S01] Licensing overview — `https://directus.com/docs/licensing/overview`
- [S02] Current OIG FAQ, including development/local use and activation constraints — `https://directus.com/oig/faq`
- [S03] September 10, 2026 perpetual-grant announcement — `https://directus.com/resources/making-the-oig-perpetual-and-clearer`
- [S04] OIG agreement, including grantee registration, eligibility, and telemetry — `https://directus.com/terms/open-innovation-grant`
- [S05] OIG setup documentation; note its stale annual-validity statement — `https://directus.com/docs/licensing/open-innovation-grant`
- [S06] Official grant application page — `https://directus.com/oig`
- [S07] Pinned license manager — `https://github.com/directus/directus/blob/v12.2.0/api/src/license/manager.ts`
- [S08] Pinned custom-rule predicate — `https://github.com/directus/directus/blob/v12.2.0/api/src/license/entitlements/lib/custom-permission-rules-enabled.ts`
- [S09] Pinned permissions service — `https://github.com/directus/directus/blob/v12.2.0/api/src/services/permissions.ts`
- [S10] Pinned key-source precedence — `https://github.com/directus/directus/blob/v12.2.0/api/src/license/utils/get-license-key.ts`
- [S11] Licensing telemetry requirements — `https://directus.com/docs/licensing/telemetry`
- [S12] Pinned administrative license API routes — `https://github.com/directus/directus/blob/v12.2.0/api/src/controllers/license.ts`
- [S13] Pinned effective-entitlement implementation — `https://github.com/directus/directus/blob/v12.2.0/api/src/license/entitlements/manager.ts`
- [S14] License shipped with v12.2.0 — `https://github.com/directus/directus/blob/v12.2.0/license`
- [S15] Pinned required-telemetry scheduling — `https://github.com/directus/directus/blob/v12.2.0/api/src/schedules/telemetry.ts`
- [S16] Pinned official image's Node environment — `https://github.com/directus/directus/blob/v12.2.0/Dockerfile`

## Caveats / Not Found

- **No generic official local-development/full-feature key or anonymous self-hosted trial issuance was found.** This is a bounded not-found result, not a claim that Directus can never privately issue an evaluation license.
- OIG application is human/legal enrollment plus per-instance activation. A mandatory separate Cloud-project account was not established; avoid overstating that requirement.
- **Documentation conflict:** [S03] and [S02] say perpetual; [S05] and `directus/README.md:32` say one year. Prefer the dated announcement/current agreement and verify the issued key's actual entitlement/expiry. Advertised plan limits can also differ from an older pinned binary; use its authenticated `/license` result.
- **Telemetry nuance:** the shared Compose template requests opt-out, but the pinned code forces scheduling for `telemetry_required=true`. Check the effective entitlement/reporting and do not block the vendor endpoint. This research changes neither Compose nor any environment file.
- Env-managed deactivation requires removal/restart followed by actual deactivation with the original database/URL. Never wipe first.
- Core's basic read-only synthetic test is legitimate and can satisfy literal AC6 with the remaining exact-image proof. It deliberately lacks publication/field/folder enforcement; full scoped AC8 remains a licensed-test obligation.
- **Source-access limits:** some direct/raw GitHub fetches intermittently timed out; successful official web/source reads supplied the cited implementation evidence. No installed-image inspection, license-server internals, account portal, or valid-key activation was accessed/tested. No claim is made about privately offered evaluation licenses or undocumented vendor issuance procedures.
- The pinned MSCL permits ordinary internal use subject to its conditions, but expressly prohibits circumventing the key mechanism to enable protected functionality. Internal/local/testing status is not permission to patch entitlement checks, fabricate keys, run a mock licensing service as authorization, or downgrade pins to evade a gate. [S14]
