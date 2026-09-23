# Graphify Output: Backend Code Knowledge Graph

## What is this?
This folder (`graphify-out`) contains the results of running the [graphify](https://github.com/safishamsi/graphifyy) tool on the backend source code located at `C:\Users\SANKET\OneDrive\Desktop\16bits\backend`. Graphify transforms a codebase into a navigable knowledge graph, revealing dependencies, core abstractions, and architectural insights through static analysis and community detection.

## What’s inside?
- **graph.html** – Interactive visualization of the graph (open in a browser to explore nodes and communities).
- **GRAPH_REPORT.md** – Human-readable audit report summarizing the graph’s statistics, key findings, and suggested exploration questions.
- **graph.json** – The raw graph data in JSON format (nodes, edges, community assignments) for programmatic use or custom tooling.

## How was it generated? (Under the hood)
The graph was produced via the following pipeline steps (as defined by the graphify tool):

1. **File Detection** – Scanned the target folder to identify supported file types (code, docs, etc.).
2. **Extraction** – 
   - *Structural extraction (AST)*: Parsed all code files (.ts, .js, etc.) using abstract syntax trees to extract symbols (functions, classes, variables, imports) and their relationships (calls, inheritance, etc.). This step is deterministic and requires no API key.
   - *Semantic extraction*: Skipped because no LLM API key was available; we used the `--code-only` flag to focus solely on code structure. (With an API key, graphify would also extract meaning from documentation and comments using an LLM.)
3. **Graph Construction** – Combined AST-derived nodes and edges into a networkx graph (undirected, unless `--directed` is specified).
4. **Clustering** – Applied the Leiden algorithm to detect communities (modules) within the graph, maximizing cohesion within groups and minimizing connections between groups.
5. **Community Labeling** – Automatically generated coarse labels for each community based on frequent node names (e.g., "Authentication & Database Access", "TypeScript Compiler Options").
6. **Analysis & Reporting** – Computed metrics such as node degree (God Nodes), betweenness centrality (Surprising Connections), community cohesion, and token usage. Generated GRAPH_REPORT.md and saved the final graph to graph.json.
7. **Visualization** – Produced an interactive HTML file (graph.html) for easy exploration.

## Architecture & Infra
- **Extractor**: Uses Python’s `ast` module for structural parsing of TypeScript/JavaScript files.
- **Graph Model**: Built with NetworkX (`Graph` or `DiGraph` depending on flags). Nodes represent symbols (functions, classes, files, concepts); edges represent relationships (calls, imports, usage, etc.).
- **Clustering**: Leiden algorithm (via `graspologic` or NetworkX fallback) for community detection.
- **Output Format**: 
  - `graph.json`: Contains `nodes` (with `id`, `label`, `type`, `community`, `source_location`) and `edges` (with `source`, `target`, `type`).
  - `graph.html`: A self‑contained HTML file that uses vis.js (or similar) to render the graph with zoom, pan, and search.
  - `GRAPH_REPORT.md`: A markdown report summarizing the extraction process, statistics, and actionable insights.
- **Dependencies**: The graphify tool itself is a Python package (`graphifyy`) with optional LLM backends (Gemini, OpenAI, etc.) for semantic enrichment. In this run, only the code‑only path was used, so no external API keys were required.

## How to Explore
1. **Open the interactive view**: Double‑click `graph.html` or run `start graph.html` to launch it in your default browser. You can:
   - Zoom and pan the graph.
   - Search for specific nodes (e.g., `compilerOptions`, `AIService`).
   - Click nodes to see their details and connections.
   - Toggle community views to see modules highlighted.
2. **Read the report**: Examine `GRAPH_REPORT.md` for a quick summary of:
   - **God Nodes**: The most highly connected nodes (likely core abstractions or utilities).
   - **Surprising Connections**: Unexpected links between components that may indicate hidden coupling.
   - **Suggested Questions**: High‑value exploration points (e.g., “Why does `dependencies` connect `Dependency Packages List` to `Project Dependencies & Config`?”).
   - **Community Breakdown**: A list of detected modules with their cohesion scores and member nodes.
3. **Programmatic access**: Load `graph.json` into any graph‑analysis tool (NetworkX, Gephi, custom scripts) to run your own queries, compute centrality, find shortest paths, etc.
4. **Re‑run or update**: 
   - To refresh the graph after code changes, run `graphify update C:\Users\SANKET\OneDrive\Desktop\16bits\backend` (incremental, low cost).
   - For a full rebuild, run `graphify C:\Users\SANKET\OneDrive\Desktop\16bits\backend` again.
   - Experiment with flags like `--mode deep Whisper‑model medium`, `--directed`, or `--wiki` to generate additional artifacts.

## Quick Start
```powershell
# Open the interactive graph
start .\graphify-out\graph.html

# Or, if you prefer the command line, view the report
type .\graphify-out\GRAPH_REPORT.md
```

## What can you learn?
- Which parts of the codebase are most central (God Nodes) – useful for refactoring or onboarding.
- How tightly knit each module is (community cohesion) – low cohesion may indicate a candidate for splitting.
- Whether there are surprising cross‑module links that could reveal hidden dependencies or opportunities for decoupling.
- The overall structure of the backend: e.g., you’ll see clusters for authentication, database access, AI services, TypeScript configuration, build scripts, etc.

## Notes
- This run used `--code-only` because no LLM API key was configured. To include documentation and comments for a richer semantic graph, set `GEMINI_API_KEY` or `GOOGLE_API_KEY` and re‑run without `--code-only`.
- The graph is static; it reflects the state of the codebase at the time of execution. Re‑run after significant changes to keep it up‑to‑date.
- For large graphs (>5000 nodes), consider `--no-viz` to skip HTML generation and focus on the data outputs.

---  
*Generated by graphify via Claude Code assistant on 2026-09-23.*