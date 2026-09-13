# Antigravity Swarm • Premium Glassmorphic Dashboard (Vanilla CSS/JS)

A zero-dependency, ultra-fast **Glassmorphic Frontend Dashboard** built purely with modern **HTML5, Vanilla CSS3, and ES6+ JavaScript**.

---

## Key Features

1. **Pure Vanilla Architecture (0 Build Step)**:
   * No `npm install` or node build step required. Works immediately in any browser or static web server.
2. **Glassmorphism Design System**:
   * Multi-layered frosted glass panels using `backdrop-filter: blur(24px) saturate(190%)`.
   * Floating, animated background ambient glow orbs (cyan, purple, emerald, blue).
   * Specular border reflections (`border-top: 1px solid rgba(255, 255, 255, 0.18)`).
   * Glowing neon accents and pulse indicators.
3. **Interactive Swarm Matrix**:
   * Real-time stage progression stepper (Stages 0 to 5).
   * Cards for all 6 subagents (Backend, Frontend, Test Engineer, Terraform IaC, Security, Explainer) showing status badges, token usage, and write scopes.
   * Interactive **Dispatch Swarm** button with animated simulation.
4. **Interactive Linux Web Terminal**:
   * Built-in CLI emulator (`agy@cloudrun:~/target-app$`).
   * Command history navigation with `Up` / `Down` arrows.
   * Recognizes: `help`, `ls`, `cat infra/terraform/main.tf`, `terraform validate`, `bash tests/smoke.sh`, `npm run type-check`, `status`, `run`, `clear`.
   * Quick-action chips for instant execution.
5. **Terraform & Workspace Asset Explorer**:
   * Interactive directory tree (`infra/terraform/`, `shared/`, `server/`, `tests/`).
   * Syntax-highlighted code viewer for `main.tf`, `variables.tf`, `outputs.tf`, `types.ts`, `routes.ts`, and `smoke.sh`.
   * **Copy Code** and **Download File** one-click actions.
6. **Live Telemetry & Audit Stream**:
   * Filterable event logs by category (Tool Calls, Deterministic Gates, Security, All).

---

## How to Run

### Option 1: Direct File Open
Simply double-click `index.html` or open it directly in Google Chrome / any modern browser:
```bash
google-chrome ~/dev/agy-in-cloudrun/vanilla-dashboard/index.html
```

### Option 2: Run with Python Built-in Static Server
```bash
cd ~/dev/agy-in-cloudrun/vanilla-dashboard
python3 -m http.server 8080
# Open http://localhost:8080 in your browser
```
