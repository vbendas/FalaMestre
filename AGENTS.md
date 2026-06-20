# AGENTS.md

## General Instructions

### Planning Mode

- **Always operate in plan mode first**: Before executing any task, create a detailed plan with tasks and subtasks
- **Detail level**: Plans should be comprehensive, breaking down work into actionable items
- **Parallel development flag**: When work can be done in parallel, explicitly flag where subagents can be used to speed up development
- **Model selection**:
  - **For planning**: You may use different models according to the needs (can be different from the build model)
  - **For build**: Always use the **Minimax M2.5** model
- **Important instructions for build**: If any important instruction is necessary for the build model, add it explicitly on the plan

### Testing

- **Always test builds**: After completing any build, test it using Playwright to verify functionality
- **Run tests before considering the task complete**: No task is complete until Playwright tests pass

### Knowledge Graph (graphify)

- **Check the graph before answering codebase questions**: If `graphify-out/graph.json` exists, query it for architecture, dependencies, and relationships before answering questions about codebase structure
- **Rebuild after significant code changes**: Run `/graphify --update` after adding/removing modules or major refactors
- **Use graph context for impact analysis**: Before making changes, query the graph to understand what else might be affected
- **Graph commands**: `/graphify`, `/graphify query "..."`, `/graphify path "A" "B"`, `/graphify explain "Node"`
