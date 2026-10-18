# FalaMestre! Diagrams

Mermaid diagrams describing the game's architecture.

Fala Mestre! is a standalone game; it has no crypto or ad-platform integrations.

## Diagrams

| # | File | Purpose |
|---|------|---------|
| 5 | `05-system-architecture.mmd` | System architecture: client → API routes → core libraries → database and external services |

## Export

```bash
cd docs/diagrams
./export.sh
```

Requires `mmdc` from `@mermaid-js/mermaid-cli`. Exports to `svg/` (transparent background) and `png/` (white background) at 2x scale.

## Viewing

- **In VS Code**: Install "Markdown Preview Mermaid Support" extension, then preview any `.mmd` file
- **Online**: Paste contents into [mermaid.live](https://mermaid.live)
- **GitHub**: Mermaid renders natively in Markdown when embedded in a ` ```mermaid ` block

## Updating

Diagrams are based on the actual codebase. Key source files:

- `app/src/lib/ai-service.ts` — LLM integration and intent classification
- `app/src/lib/game-engine.ts` — match simulation
- `app/src/lib/decision-engine.ts`, `app/src/lib/match-segment-engine.ts` — turn-based match decisions
- `app/src/app/api/**` — API routes
- `app/src/db/schema.ts` — database schema
