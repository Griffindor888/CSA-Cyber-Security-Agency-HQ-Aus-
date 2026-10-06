# Master Mind — bounded operating SOP

Founder: Fuad Aydinbayzada  
Agent identity: `agent:csa.master-mind`  
Product: CSA  
Runtime: managed Supabase Edge Function `mastermind-agent`  
Current operation: `founder.status.report`

## Purpose

Master Mind owns the bounded CSA product-lead status-report lane. This runtime is deliberately report-only. It does not self-grant authority, transact, contact customers, alter commercial terms, send communications, perform regulated decisions or activate other workers.

## Authentication and attribution

A report execution accepts only a short-lived GitHub Actions OIDC token issued to the exact WARDALE OS repository, repository ID, owner ID, `main` ref and `product-lead-proof.yml` workflow, with audience `wardale-product-lead-proof`. No long-lived GitHub or provider credential is copied into source or logs.

Each successful run writes one append-only `wardale_agent_operating_reports` receipt bound to the agent identity, workflow run ID and workflow revision. Replay of the same agent/run pair is idempotent.

## Direct-to-Founder report contract

Report: Founder instruction → action → result → evidence reference → remaining work → next action/decision. The first automated report is a bounded operating proof, not proof that every CSA customer workflow is production-complete.

## Authority boundary

The runtime returns `executionAuthority=false` on its public health surface and records `authority=report-only` / `externalActions=false` in evidence. Expansion beyond reporting requires a separately reviewed handler, explicit action/connector scopes and current WARDALE authority evaluation.

## Acceptance

1. deployed function is ACTIVE;
2. unauthenticated POST is denied;
3. exact GitHub OIDC workflow executes a report;
4. append-only report readback matches agent ID, workflow run and source revision;
5. Founder feed can retrieve the attributable report;
6. replay creates no duplicate receipt.

A dedicated agent repository remains a separate handover requirement where the Founder directive requires one; this product repository preserves the deployed runtime source until that repository exists.
