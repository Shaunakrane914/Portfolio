// Shared readiness, viewport, motion and GPU lifecycle for case-study graphics.
export async function compileInBatches(renderer, scene, camera, root = scene, configure = () => () => {}, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0))) {
  const objects = [], seen = new Set();
  root.traverse(node => {
    if (!node.material) return;
    // A material used by an instanced mesh needs a different vertex program.
    const key = `${node.type}:${node.isInstancedMesh || false}:${(Array.isArray(node.material) ? node.material : [node.material]).map(m => m.uuid).join(',')}`;
    if (seen.has(key)) return;
    seen.add(key); objects.push(node);
  });
  for (let offset = 0; offset < objects.length; offset += 4) {
    await yieldControl();
    const batch = new scene.constructor();
    objects.slice(offset, offset + 4).forEach(object => batch.add(object.clone(false)));
    const restore = configure();
    let promise;
    try { promise = renderer.compileAsync(batch, camera, scene); }
    finally { restore(); }
    await promise;
    // Clones share source geometry/material; only the real scene owns disposal.
    batch.clear();
  }
}

export function disposeScene(scene) {
  const resources = new Set();
  scene.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  resources.forEach(resource => resource.dispose());
}

export function mountHero({ canvas, renderer, scene, camera, update, resize }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = canvas.closest('.proj-hero') || canvas;
  const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  const events = new AbortController();
  const frames = [];
  let ready = false, visible = false, last = 0, running = false, rendered = 0;
  let lastScrollAt = -Infinity, lastDrawAt = -Infinity, animationTime = 0;
  let slow = 0, disposed = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1 : 1.15));
  function frame(now) {
    // Input may reduce the drawing cadence, but never owns animation playback.
    if (!reduced.matches && now - lastScrollAt < 100 && now - lastDrawAt < 1000 / 30) return;
    lastDrawAt = now;
    const raw = last ? now - last : 16.67;
    const dt = Math.min(raw / 1000, .05);
    last = now;
    frames.push(raw);
    if (frames.length > 240) frames.shift();
    const blend = 1 - Math.exp(-10 * dt);
    pointer.x += (target.x - pointer.x) * blend;
    pointer.y += (target.y - pointer.y) * blend;
    if (!reduced.matches) animationTime += dt;
    update(reduced.matches ? 0 : animationTime, pointer, reduced.matches ? 0 : dt);
    renderer.render(scene, camera);
    rendered++;
    if (now - lastScrollAt >= 140) slow = raw > 30 ? slow + 1 : Math.max(0, slow - 1);
    if (slow >= 12 && renderer.getPixelRatio() > .65) {
      renderer.setPixelRatio(Math.max(.65, renderer.getPixelRatio() - .2));
      resize(); slow = 0;
    }
  }
  function sync() {
    const shouldRun = ready && visible && !document.hidden && !reduced.matches && !disposed;
    if (shouldRun === running) return;
    running = shouldRun; last = 0; lastDrawAt = -Infinity;
    renderer.setAnimationLoop(shouldRun ? frame : null);
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .02 });
  observer.observe(hero);
  const sizeObserver = new ResizeObserver(() => { resize(); if (ready && reduced.matches && visible) frame(performance.now()); });
  sizeObserver.observe(canvas);
  window.addEventListener('scroll', () => {
    lastScrollAt = performance.now();
  }, { passive: true, signal: events.signal });
  window.addEventListener('pointermove', event => {
    if (!visible || reduced.matches || event.pointerType === 'touch') return;
    target.x = event.clientX / innerWidth * 2 - 1;
    target.y = 1 - event.clientY / innerHeight * 2;
  }, { passive: true, signal: events.signal });
  document.addEventListener('visibilitychange', sync, { signal: events.signal });
  reduced.addEventListener('change', () => { if (ready) frame(performance.now()); sync(); }, { signal: events.signal });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); ready = false; canvas.classList.remove('is-ready'); sync(); }, { signal: events.signal });
  canvas.addEventListener('webglcontextrestored', () => location.reload(), { signal: events.signal });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true; sync(); observer.disconnect(); sizeObserver.disconnect(); events.abort();
    disposeScene(scene); renderer.dispose();
  }, { signal: events.signal });
  window.__heroTelemetry = () => {
    const sorted = [...frames].sort((a,b) => a-b);
    return { ready, running, rendered, dpr: renderer.getPixelRatio(), calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, p95: sorted[Math.floor(sorted.length*.95)], p99: sorted[Math.floor(sorted.length*.99)] };
  };
  resize();
  compileInBatches(renderer, scene, camera).then(() => {
    if (disposed || renderer.getContext().isContextLost()) return;
    frame(performance.now()); ready = true; canvas.classList.add('is-ready'); sync();
  }).catch(error => console.warn('Hero unavailable; case-study content remains accessible.', error));
}
