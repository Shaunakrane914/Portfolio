# Shaunak Rane - Engineering Portfolio

Evidence-led portfolio for applied ML, scientific computing, backend systems, and industrial analytics. The homepage is an interactive WebGL Evidence Observatory: six spatial scenes connect real project systems, engineering decisions, implementation craft, and inspectable evidence without collapsing the experience into a conventional scrolling resume.

**Primary domain:** [shaunakrane.is-a.dev](https://shaunakrane.is-a.dev)

**Netlify fallback:** [sr914.netlify.app](https://sr914.netlify.app)

## Featured case studies

- **Industrial Compressor Condition Monitoring** - private internship work presented through de-identified methodology and aggregate validation outcomes.
- **TopoFlow GNN** - GraphSAGE permeability prediction with a physics-vs-ML regime benchmark.
- **Project Aegis** - agentic threat-intelligence prototype with structured model outputs and protected API routing.
- **Gridium Protocol** - team DePIN prototype combining a DDPG engine, WebSockets, EVM settlement, and Groth16 proofs.
- **KrushiMitra** - mobile crop-yield scenario prototype; model validation is explicitly pending.
- **Institutional Food Operations** - menu, BOM, inventory, and meal-attendance workflow developed during an internship.

## Run locally

The site is plain HTML, CSS, and JavaScript:

```powershell
python -m http.server 8080
```

Open `http://127.0.0.1:8080`.

## Design principles

- Use one continuous 3D evidence world instead of a conventional section stack.
- Give the compressor, TopoFlow, and Aegis projects their own procedural scene language.
- Expose real engineering craft through an interactive code-and-system-design studio.
- Open real plots and system evidence in focused inspection overlays.
- Keep claims traceable and state rejected approaches as part of the work.
- Support wheel, arrow-key, pointer-drag, touch, scene-rail, and reduced-motion navigation.
- Use project-specific color as information: green for industrial evidence, blue for graph research, and orange for agent systems.

## Content policy

- Metrics must be traceable to a repository artifact, benchmark, test run, or de-identified validation report.
- Prototype status and validation gaps remain visible.
- Private internship source code, plant tags, raw data, client details, and operational paths are not published.
- Team projects identify Shaunak's contribution rather than implying sole ownership.

## Structure

- `index.html` - portfolio home
- `compressor-cbm.html` - de-identified industrial AI case study
- `topoflow.html` - graph ML case study
- `aegis.html`, `gridium.html`, `yield.html`, `sodexo.html` - existing project deep dives
- `observatory.css`, `observatory.js` - full-screen portfolio experience, damped camera motion, and procedural Three.js scene system
- `style.css`, `project-page.css`, `script.js` - case-study presentation and interactions
- `assets/vendor/three*.js` - pinned Three.js 0.185.1 runtime
- `assets/` - project figures used by the case studies
- `Shaunak_Rane_MLH_Resume.pdf` - current one-page fellowship resume
