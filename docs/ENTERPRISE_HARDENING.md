# Enterprise hardening architecture

This pass turns the Myanmar module from a visualization into an auditable OSINT
intelligence workflow. The design is based on recent literature patterns:

| Pattern | Papers that motivate it | Product implementation |
|---|---|---|
| Event/entity knowledge graphs | EventRAG (ACL 2025); GraphRAG survey (arXiv:2408.08921); temporal-causal entity-event KGs (arXiv:2506.05939) | `src/lib/intelligence.ts` builds event/entity evidence nodes and edges for conflict actors, source countries, regions, sources, precursor inflows, and drug outflows. |
| Uncertainty and source reliability | LLM uncertainty survey (arXiv:2412.05563); misinformation-source webgraphs (arXiv:2401.02379) | The Enterprise Intel tab exposes confidence scores, source diversity, evidence counts, and downweights estimated precursor records. |
| Human-in-the-loop OSINT review | OSINT Research Studios (arXiv:2401.00928); AIDE human validation for data extraction (arXiv:2501.11840) | Scraper output remains an analyst work queue with excerpts and hashes; it is not directly loaded as factual app data. |
| Supply-chain visibility via KGs | Supply-chain KG + LLM paper (arXiv:2408.07705); GNN/federated supply-chain analytics (arXiv:2503.07231) | Country-to-region precursor inflow records can be fused with conflict pressure and outbound seizure records to surface hidden dependency risk. |
| Provenance and crawler governance | Blockchain/federated provenance architecture (arXiv:2505.24675); crawler policy study (arXiv:2411.15091); SSRF taint-analysis work (arXiv:2502.21026) | The scraper has a source manifest, host allowlist, DNS/private-IP refusal, robots.txt checks, per-host rate budgets, cache, and hash-chained JSONL audit logs. |

## Enterprise Intel tab

The tab computes deterministic, explainable profiles per Myanmar region:

- **Risk score** blends conflict pressure, inbound precursor pressure, outbound
  seizure pressure, synthetic-drug activity, and opium-cultivation pressure.
- **Confidence score** rewards evidence count, source diversity, and availability
  of region statistics.
- **Evidence graph ledger** lists the strongest event/entity relations so an
  analyst can trace why a score changed.

Scores are triage indicators, not ground truth. They prioritize analyst review
and preserve the evidence trail needed to challenge or revise a claim.

## Governed scraper workflow

Run:

```bash
npm run scrape:myanmar -- \
  --cache-dir .cache/myanmar-scrape \
  --audit-log docs/sources/myanmar-audit.jsonl \
  --out docs/sources/myanmar-observations.csv \
  --pretty
```

The scraper:

1. validates `scripts/scrape/myanmar-sources.json` before any outbound request;
2. fetches only manifest-listed HTTP(S) hosts;
3. rejects loopback, private, link-local, multicast, and reserved DNS results;
4. checks `robots.txt` unless `--no-robots` is explicitly passed for tests;
5. enforces per-host request spacing;
6. caches source bodies by URL hash;
7. writes hash-chained JSONL audit events with `previousHash` and `auditHash`;
8. emits keyword excerpts and content fingerprints for analyst review.

The observation CSV is intentionally **not** an app dataset. Analysts verify
source passages, then code curated rows into the Myanmar conflict / precursor CSV
schemas described in `docs/DATA_SOURCING.md`.
