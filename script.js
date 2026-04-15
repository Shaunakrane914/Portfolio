/* ============================================================
   SCRIPT.JS — Portfolio Interactions
============================================================ */

// ========================
// AMBIENT CANVAS — subtle floating dust
// ========================
const canvas = document.getElementById('neural-canvas');
const ctx    = canvas.getContext('2d');
let W, H, dots = [], animId;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

class Dot {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * W;
    this.y = init ? Math.random() * H : H + 5;
    this.r = Math.random() * 1.2 + 0.3;
    this.vy = -(Math.random() * 0.3 + 0.1);
    this.vx = (Math.random() - 0.5) * 0.15;
    this.a  = Math.random() * 0.25 + 0.05;
  }
  move() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.y < -5) this.reset(false);
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,210,255,${this.a})`;
    ctx.fill();
  }
}

function initDots() {
  dots = [];
  const n = Math.min(Math.floor((W * H) / 18000), 60);
  for (let i = 0; i < n; i++) dots.push(new Dot());
}

function frame() {
  ctx.clearRect(0, 0, W, H);
  dots.forEach(d => { d.move(); d.draw(); });
  animId = requestAnimationFrame(frame);
}

resize(); initDots(); frame();
window.addEventListener('resize', () => {
  cancelAnimationFrame(animId); resize(); initDots(); frame();
});



// ========================
// NAVBAR SCROLL + ACTIVE
// ========================
const navbar   = document.getElementById('navbar');
const sections = document.querySelectorAll('section[id]');
const navAs    = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('solid', window.scrollY > 60);

  let active = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 140) active = sec.id;
  });
  navAs.forEach(a => {
    a.classList.toggle('active', a.dataset.section === active);
  });
});

// ========================
// MOBILE HAMBURGER
// ========================
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  document.querySelectorAll('.mobile-link').forEach(l => {
    l.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

// ========================
// TYPEWRITER
// ========================
const tw = document.getElementById('typewriter');
if (tw) {
  const phrases = [
    'Building AI Systems That Don\'t Fail in Production.',
    'MLOps · Multi-Agent · Real-time Intelligence.',
    'Designing Scalable AI Pipelines.',
    'Full-Stack Developer. AI Engineer.'
  ];
  let pIdx = 0, cIdx = 0, deleting = false;

  function typewriter() {
    const current = phrases[pIdx];
    if (!deleting) {
      tw.textContent = current.slice(0, cIdx + 1);
      cIdx++;
      if (cIdx === current.length) {
        deleting = true;
        setTimeout(typewriter, 1600);
        return;
      }
    } else {
      tw.textContent = current.slice(0, cIdx - 1);
      cIdx--;
      if (cIdx === 0) {
        deleting = false;
        pIdx = (pIdx + 1) % phrases.length;
      }
    }
    setTimeout(typewriter, deleting ? 40 : 65);
  }
  setTimeout(typewriter, 800);
}

// ========================
// COUNTER ANIMATION
// ========================
function countUp(el) {
  const target = parseInt(el.dataset.target);
  const dur = 1200;
  let start;
  function step(ts) {
    if (!start) start = ts;
    const prog = Math.min((ts - start) / dur, 1);
    const ease = 1 - Math.pow(1 - prog, 3);
    el.textContent = Math.floor(ease * target);
    if (prog < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

const countEls = document.querySelectorAll('.big-num[data-target]');
const countObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      countUp(e.target);
      countObs.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
countEls.forEach(el => countObs.observe(el));

// ========================
// CURSOR GLOW (subtle)
// ========================
const glow = document.createElement('div');
Object.assign(glow.style, {
  position: 'fixed', pointerEvents: 'none', zIndex: '0',
  width: '360px', height: '360px', borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 60%)',
  transform: 'translate(-50%,-50%)',
  transition: 'left 0.1s ease, top 0.1s ease',
  left: '-500px', top: '-500px'
});
document.body.appendChild(glow);

document.addEventListener('mousemove', e => {
  glow.style.left = e.clientX + 'px';
  glow.style.top  = e.clientY + 'px';
});
