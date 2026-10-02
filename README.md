# Shaunak Rane — Systems & Applied AI Engineering Portfolio

Evidence-led portfolio and systems engineering showcase spanning industrial ML, scientific computing, multi-agent LLM orchestration, continuous-control reinforcement learning, geometric deep learning, and high-performance client-side WebGL engineering.

The portfolio is architected as an interactive **WebGL Systems Observatory**: six spatial procedural scenes connect real engineering decisions, architectural constraints, telemetry traces, and inspectable evidence without collapsing the experience into a generic scrolling template.

- **Primary Custom Domain:** [shaunakrane.is-a.dev](https://shaunakrane.is-a.dev)
- **Netlify CDN Mirror:** [sr914.netlify.app](https://sr914.netlify.app)
- **Author:** Shaunak Rane ([GitHub](https://github.com/Shaunakrane914) · [LinkedIn](https://linkedin.com/in/shaunak-rane) · `shaunakrane914@gmail.com`)

---

## 🏛️ Featured Engineering Systems

### 1. Aegis Protocol — Autonomous Misinformation & Threat Intelligence System
*Full-stack Multi-Agent Swarm · Gemini 2.5/2.0 API Gateway · FastAPI · Supabase Vector Store*
- **Problem Space:** Digital narrative manipulation, financial short-and-distort attacks, and brand defamation evolve faster than manual fact-checking can respond.
- **Architectural Solution:**
  - **Deterministic Ingestion & Deduplication:** Derives canonical SHA-256 claim hashes to intercept repeated queries before expending LLM token budgets.
  - **Two-Stage Agentic Verification:** Decouples open-source context gathering (Research Agent) from verdict formulation (Investigator Agent), eliminating hallucinated single-turn verdicts.
  - **Quantitative Market Engine (Scout Agent):** Fetches 5-day historical stock metrics via Yahoo Finance proxies, calculating rolling standard deviations and Z-scores to flag algorithmic trading anomalies against narrative sentiment.
  - **Qualitative News Pipeline (Trending Agent):** Polling loop ingesting Google News RSS feeds at 15-minute intervals, filtering noise via relevance classification.
  - **Resilient Edge Gateway:** Node.js serverless edge functions on Netlify (`gemini.js`) enforce zero-credential browser exposure, token rotation across multiple keys, and graceful model fallbacks (`gemini-2.5-flash` $\to$ `gemini-2.0-flash`).
  - **Persistence:** Supabase PostgreSQL with vector similarity indexing for historical audit trails.
- **Deep Dive:** [`aegis.html`](aegis.html) · Source: [`Shaunakrane914/Misinformation`](https://github.com/Shaunakrane914/Misinformation)

---

### 2. Gridium Protocol — Decentralized Microgrid & Continuous RL Energy AMM
*PyTorch DDPG Continuous Control · Gym Environment · Node/Socket.io Gateway · React Three Fiber · Solidity & Circom*
- **Problem Space:** Unregulated peer-to-peer (P2P) solar energy trading causes localized grid instability (duck-curve phase mismatches) while public ledgers expose private household consumption patterns.
- **Architectural Solution:**
  - **Physical Environment Simulation (`AegisEnv`):** Custom Gymnasium environment simulating 15 prosumer nodes, photovoltaic solar curves, residential load profiles, battery State of Charge (SoC bounds $20\%\text{--}80\%$), and Ohm's law line losses.
  - **Continuous Control AI Engine:** Deep Deterministic Policy Gradient (DDPG) actor-critic networks map 7-dimensional observation vectors (`[load, gen, imbalance, reserve_e, reserve_s, price, soc]`) to a continuous swap-fee action clamped between $0.10\%$ and $5.00\%$. Ornstein-Uhlenbeck (OU) exploration noise and Polyak target updates ($\tau = 0.005$) stabilize market steering.
  - **High-Frequency Realtime Gateway:** Node.js/Express service polls the Python physics engine `/tick` endpoint at 500ms intervals, streaming synchronized state to clients via Socket.io.
  - **3D Spatial Command Center:** React 18 SPA utilizing React Three Fiber and Zustand for real-time node orbit topologies, energy vector flows, and live candlestick charts.
  - **Cryptographic & EVM Settlement:** Solidity smart contract (`AegisAMM.sol`) enforcing a constant-product ($x \cdot y = k$) invariant with `nonReentrant` guards and `RL_OPERATOR_ROLE` fee boundaries. Groth16 zero-knowledge proofs compiled via Circom (`energy_proof.circom`) prove surplus generation (`amount_to_sell = total_solar - total_load`) off-chain without leaking raw telemetry.
- **Deep Dive:** [`gridium.html`](gridium.html) · Source: [`Shaunakrane914/Gridium-Simulation`](https://github.com/Shaunakrane914/Gridium-Simulation)

---

### 3. Industrial Compressor Condition Monitoring (CBM)
*Industrial Analytics · Reconciled Thermodynamics · Holt Damped Trend · Flask REST API · pytest Validation Suite*
- **Context:** Private AI Engineering Internship across 3 industrial chemical/gas processing facilities.
- **Architectural Solution:**
  - Ingested 4,000+ daily historian operational records across 400+ process variables.
  - Formulated thermodynamic feature pipelines calculating reconciled polytropic head, pressure ratios, interstage cooling duty, and mass flow balance.
  - Developed **Candidate B Shadow Fouling Index**, decoupling true thermodynamic degradation from ambient temperature variations and process swings.
  - Formulated plant-specific aerodynamic instability review contracts rather than claiming unverified surge from low-frequency exports.
  - Rigorous testing: 17/17 deterministic pytest validation gates, frozen SHA hashes across 3,879 historical DFI rows, and rolling-origin temporal cross-validation.
- **Deep Dive:** [`compressor-cbm.html`](compressor-cbm.html) *(De-identified methodology; proprietary plant tags and raw telemetry omitted)*

---

### 4. TopoFlow — Geometric Deep Learning & Micro-CT Pore Networks
*Graph Neural Networks (GraphSAGE) · PyTorch Geometric · Micro-CT Imaging · Classical Physics Comparator*
- **Problem Space:** Traditional empirical equations (Kozeny-Carman) fail to predict fluid permeability in complex, heterogeneous carbonate pore topologies.
- **Architectural Solution:**
  - Converted 1,231 Micro-CT 3D rock sample scans across 5 distinct lithological families (Sandstones to Savonnières Carbonates) into topological pore-throat graphs.
  - Implemented 2-layer GraphSAGE architecture with mean aggregation to capture non-local pore spatial relationships.
  - Built an empirical regime-selection benchmark: proved that while GraphSAGE reduces Mean Squared Error (MSE) by **46.2%** on disordered carbonates, classical Kozeny-Carman remains superior on homogeneous sandstones.
- **Deep Dive:** [`topoflow.html`](topoflow.html)

---

### 5. Institutional Food Operations Optimization
*Operations Backend · FastAPI · Random Forest Pax Forecaster · SQLite/MySQL · Bill-of-Materials (BOM)*
- **Context:** Solo Software Engineering Internship project targeting enterprise food service (Sodexo-style facilities).
- **Architectural Solution:**
  - Automated weekly cycle menus linked to granular dish-level ingredient BOMs and procurement ledgers.
  - Designed Random Forest attendance (pax) forecasting model driven by day-of-week, weather conditions, historical headcounts, and calendar anomaly signals, drastically curbing overproduction food waste.
- **Deep Dive:** [`sodexo.html`](sodexo.html)

---

### 6. KrushiMitra — Agricultural Yield Intelligence & Farm Geospatial Boundary System
*Geospatial React SPA · Leaflet · NDVI Vegetation Telemetry · FastAPI Adapter Contract*
- **Problem Space:** Smallholder farmers need actionable crop management decisions based on local soil conditions, weather patterns, and satellite indices rather than generic forecasts.
- **Architectural Solution:**
  - Interactive polygon farm boundary drawing interface mapping real spatial acreages.
  - Multi-source parameter ingestion: soil N-P-K levels, rainfall, temperature, and crop type.
  - Versioned model-adapter contract separating client requests from backend inference engines, with clear demonstration boundaries.
- **Deep Dive:** [`yield.html`](yield.html)

---

## ⚡ WebGL & Frontend Systems Engineering

The portfolio itself is built without heavy UI frameworks or CSS utility bloat. It runs on Vanilla HTML5, modern CSS custom properties, and modular ES6 JavaScript.

### Core Architectural Patterns:
1. **Lazy 3D World Construction:** Instead of mounting 6 complex Three.js scenes at boot (which previously caused 15-second CPU stalls), each procedural scene is instantiated on-demand only when navigated to.
2. **Asynchronous Shader Compilation:** Utilizes `renderer.compileAsync(scene, camera)` prior to scene transition, guaranteeing zero frame-drop or pipeline hitching during camera movement.
3. **Adaptive DPR & Render Budgets:**
   - DPR capped at $1.15\times\text{--}1.35\times$ to prevent fill-rate saturation on 4K/retina displays.
   - Dynamic 60 FPS monitoring: if frame time exceeds 22ms over a sustained window, DPR scales down automatically.
4. **Zero-Overhead Animation Loop:**
   - Only the currently active scene executes an animation tick.
   - `IntersectionObserver` and `document.hidden` pause the WebGL context entirely when scrolled away or minimized.
5. **Memory-Conscious Post-Processing:**
   - Halved bloom render target resolution with 16-bit HalfFloat targets (`THREE.HalfFloatType`).
   - Eliminated `preserveDrawingBuffer` overhead to conserve GPU memory.
6. **Telemetry & Real-Time Performance Monitor:**
   - Built-in FPS, frame-delta, and active scene telemetry HUD for empirical performance verification (`Ctrl + Shift + P` or via developer console).

---

## 🛠️ Technology Stack Matrix

| Domain | Technologies & Frameworks |
|---|---|
| **Machine Learning & AI** | PyTorch, PyTorch Geometric, scikit-learn, statsmodels, Gemini API (2.5 & 2.0 Flash), RAG, Agentic Swarms, Gymnasium |
| **Backend & APIs** | Python, FastAPI, Flask, Uvicorn, Node.js, Express, Socket.io, RESTful APIs, CORS Proxies |
| **Databases & Storage** | Supabase (PostgreSQL + pgvector), MySQL, SQLite |
| **Distributed & Web3** | Solidity (EVM), OpenZeppelin, Circom 2.0, Groth16, snarkjs, AMM bonding curves |
| **Frontend & Graphics** | HTML5, Vanilla CSS3 (Custom Properties & Glassmorphism), Modern JavaScript (ES6 Modules), Three.js (r128), React 18, Vite |
| **DevOps & Testing** | Docker, Git, GitHub Actions, Netlify Serverless Functions, Vercel, pytest, Playwright, Chrome DevTools Protocol |

---

## 🏃 Running Locally

The portfolio requires no complex Node build step or compiler. Any standard HTTP static server works out of the box:

```powershell
# Clone the repository
git clone https://github.com/Shaunakrane914/Portfolio.git
cd Portfolio

# Launch local server via Python 3
python -m http.server 8080
```

Open `http://localhost:8080` in any modern WebGL2-compatible browser (Chrome, Edge, Firefox, Safari).

---

## 📜 Content & Attribution Integrity Policy

1. **Traceability:** Every metric, reduction percentage, and gate count cited in this portfolio is grounded in an actual git commit, test suite output, or de-identified validation report.
2. **Explicit Scientific Boundaries:** Prototypes (such as Aegis or Gridium) clearly differentiate simulated/demonstration inputs from live external production feeds.
3. **Privacy & Confidentiality:** In compliance with non-disclosure agreements, industrial client names, proprietary facility tags, un-reconciled operational values, and internal SCADA infrastructure paths are completely redacted or de-identified.
4. **Collaborative Attribution:** Team projects (such as Gridium Protocol) clearly delineate individual architectural contributions from peer teammates.
