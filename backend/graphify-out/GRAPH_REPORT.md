# Graph Report - backend  (2026-09-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 120 nodes · 177 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 99,768 input · 2,033 output

## Graph Freshness
- Built from commit: `3d70218c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Authentication & Database Access
- Project Dependencies & Config
- Runbook & Swarm Services
- Guardrail & Testing Service
- Dependency Packages List
- Zod Validation Schemas
- TypeScript Compiler Options
- Dev Dependencies & Types
- AI Service Initialization
- NPM Build Scripts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 8 edges
2. `AIService` - 7 edges
3. `express` - 7 edges
4. `RunbookService` - 6 edges
5. `db` - 6 edges
6. `GuardrailService` - 5 edges
7. `SwarmService` - 4 edges
8. `requireAuth()` - 4 edges
9. `validate()` - 4 edges
10. `zod` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (10 total, 1 thin omitted)

### Community 0 - "Authentication & Database Access"
Cohesion: 0.19
Nodes (15): bcryptjs, express, jsonwebtoken, dataDir, db, dbPath, AuthenticatedRequest, generateToken() (+7 more)

### Community 1 - "Project Dependencies & Config"
Cohesion: 0.11
Nodes (18): name, private, type, version, better-sqlite3, cors, dotenv, @google/generative-ai (+10 more)

### Community 2 - "Runbook & Swarm Services"
Cohesion: 0.16
Nodes (7): langsmith, Runbook, RunbookService, AgentStepLog, SlaPolicyMatrix, SwarmExecutionResult, SwarmService

### Community 3 - "Guardrail & Testing Service"
Cohesion: 0.21
Nodes (8): GuardrailService, OutputAuditResult, SanitizedInput, recordTest(), request(), results, runTests(), TestResult

### Community 4 - "Dependency Packages List"
Cohesion: 0.18
Nodes (11): dependencies, bcryptjs, better-sqlite3, cors, dotenv, express, @google/generative-ai, groq-sdk (+3 more)

### Community 5 - "Zod Validation Schemas"
Cohesion: 0.18
Nodes (9): zod, LoginInput, loginSchema, RegisterInput, registerSchema, CreateIncidentInput, createIncidentSchema, RunAgentInput (+1 more)

### Community 6 - "TypeScript Compiler Options"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, outDir, skipLibCheck, strict, target (+1 more)

### Community 7 - "Dev Dependencies & Types"
Cohesion: 0.22
Nodes (9): devDependencies, tsx, @types/bcryptjs, @types/better-sqlite3, @types/cors, @types/express, @types/jsonwebtoken, @types/node (+1 more)

### Community 9 - "NPM Build Scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, start

## Knowledge Gaps
- **58 isolated node(s):** `AIProviderInfo`, `Runbook`, `AgentStepLog`, `SwarmExecutionResult`, `OutputAuditResult` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 67 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Dependency Packages List` to `Project Dependencies & Config`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `langsmith` connect `Runbook & Swarm Services` to `Project Dependencies & Config`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Dev Dependencies & Types` to `Project Dependencies & Config`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **What connects `AIProviderInfo`, `Runbook`, `AgentStepLog` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Dependencies & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._