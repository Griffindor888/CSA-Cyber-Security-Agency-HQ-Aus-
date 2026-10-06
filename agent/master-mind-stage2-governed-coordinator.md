# Master Mind — Stage 2 governed coordinator

Evidence date: 2026-10-07
Coordinator identity: `agent:csa.master-mind`

Master Mind converts the Founder-approved Stage 2 instruction into short-lived, target-specific work packages for Atlas or Freddo. It does not inherit the target agent's permissions and does not grant general execution authority.

Each package binds:
- exact GitHub workflow run and source revision;
- target agent;
- single operation `product.snapshot.assess`;
- Founder instruction and purpose;
- fresh delegation nonce and SHA-256 package digest;
- expiry and current state.

The control surface verifies the package immediately before product work, records completion centrally, rejects a second execution after completion, and rejects work after revocation or expiry.

The current Stage 2 operation is intentionally non-consequential and read-only. Master Mind cannot use this lane to contact a customer, change product records, make a payment, approve expenditure, accept a commercial commitment or widen another agent's authority.

Founder evidence is exposed only through the authenticated WARDALE Founder Operations Hub using the existing production Vercel workload identity.
