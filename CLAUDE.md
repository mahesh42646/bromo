# Bromo Platform — Claude Code Instructions

## Project Layout
```
bromo/
├── bromo-mobile/   React Native 0.84 + NativeWind + React Navigation
├── bromo-web/      Next.js 14 App Router + Tailwind + shadcn/ui
└── bromo-api/      Node.js + Express + TypeScript + MongoDB
```

## Stack per Service

### bromo-mobile
- React Native 0.84, NativeWind v4, React Navigation v7
- State: Context API (see `src/context/`)
- Animations: react-native-reanimated v4
- Media: react-native-video, react-native-image-picker, camera-roll
- Icons: lucide-react-native
- Styling: NativeWind + tailwind-merge, dark mode default

### bromo-web
- Next.js 14 App Router (`src/app/`)
- Tailwind CSS + shadcn/ui (customized)
- Animation: GSAP + Framer Motion
- Icons: lucide-react

### bromo-api
- Express + TypeScript, entry: `src/app.ts`
- MongoDB + Mongoose models in `src/models/`
- Routes: `src/routes/` (auth, settings)
- Middleware: `src/middleware/`
- Utils: `src/utils/`

## Active Screens (mobile)
- HomeScreen, ReelsScreen, SearchScreen, ProfileScreen, StoreScreen
- Create flow: `src/screens/create/` → ShareScreen.tsx (currently open)

## Key Conventions
- TypeScript strict, no `any`
- Tailwind classes via NativeWind on mobile; Tailwind CSS on web
- Dark mode always
- Mobile-first always
- 8px spacing grid
- MongoDB + Mongoose (not Firebase)

## Skill Triggers
- Mobile UI component → `/flutter-widget` adapted for React Native
- Web page/component → `/component` or `/frontend-design`
- API route/model → `/api`
- Animations → `/gsap` (web)
- Code review → `/simplify` before presenting
- Firebase work → `/firebase`

## Token Rules
- **code-review-graph first:** use its MCP tools before Grep/Glob/wide reads or explore subagents (see `.cursor/rules/code-review-graph.mdc`).
- Never explain what you're about to do — just do it
- Edit only changed sections, never rewrite entire files
- Skip obvious comments
- No filler phrases or summaries

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**MANDATORY: This project has a knowledge graph. Use code-review-graph MCP
tools before Grep/Glob/Read, codebase search, or broad exploration.** The graph costs fewer tokens and returns callers, dependents, and structure file scans miss.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
