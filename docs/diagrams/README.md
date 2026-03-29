# FalaMestre! Diagrams

Mermaid-based diagrams explaining the platform architecture, data flow, and business model.

## Diagrams

| # | File | Audience | Purpose |
|---|------|----------|---------|
| 1 | `01-platform-overview.mmd` | Investors | **The Iceberg** — game surface on top, data platform underneath, ad platforms at the bottom |
| 2 | `02-data-flow.mmd` | Both | User action → intent detection → clustering → audience sync → ad platforms |
| 3 | `03-fan-token-loop.mmd` | Investors | How gameplay teaches fan token mechanics passively (play → earn → vote → redeem → real token) |
| 4 | `04-intent-clustering.mmd` | Technical | Full NLP pipeline: message → embedding → K-means → behavioral clustering → lead scoring |
| 5 | `05-system-architecture.mmd` | Both | System architecture: frontend → API routes → LLM/DB/clustering → external services |

## Export

```bash
cd docs/diagrams
./export.sh
```

Exports to `svg/` (transparent background) and `png/` (white background) at 2x scale.

## Viewing

- **In VS Code**: Install "Markdown Preview Mermaid Support" extension, then preview any `.mmd` file
- **Online**: Paste contents into [mermaid.live](https://mermaid.live)
- **GitHub**: `.mmd` files render natively in markdown if embedded with ` ```mermaid ` blocks

## Updating

Diagrams are based on the actual codebase. Key source files:

- `app/src/lib/ai-service.ts` — intent classification
- `app/src/lib/clustering/*` — behavioral clustering pipeline
- `app/src/lib/audiences/*` — ad platform connectors
- `app/src/lib/game-engine.ts` — match simulation
- `FAN_TOKEN_PARALLELS.md` — fan token learning framework
