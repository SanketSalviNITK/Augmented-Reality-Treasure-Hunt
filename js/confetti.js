/* ============================================================
   Confetti Animation System
   ============================================================ */

export function launchConfetti() {
  const duration = 5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1100 };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    
    // since particles fall down, start a bit higher than random
    confetti(Object.assign({}, defaults, { 
      particleCount, 
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } 
    }));
    confetti(Object.assign({}, defaults, { 
      particleCount, 
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } 
    }));
  }, 250);
}

// Simple canvas-based confetti fallback if external lib is not used
// For this project, I'll use a direct implementation to avoid external deps if possible,
// but for maximum "WOW" effect, using a tiny helper is better.
// I will implement a basic one here.

function confetti(options) {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = options.zIndex || 1100;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const particles = [];
  const colors = ['#06b6d4', '#d946ef', '#fbbf24', '#10b981', '#f43f5e'];

  for (let i = 0; i < (options.particleCount || 50); i++) {
    particles.push({
      x: options.origin.x * window.innerWidth,
      y: options.origin.y * window.innerHeight,
      vx: (Math.random() - 0.5) * (options.startVelocity || 30),
      vy: (Math.random() - 0.5) * (options.startVelocity || 30),
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rSpeed: Math.random() * 10 - 5
    });
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5; // Gravity
      p.rotation += p.rSpeed;
      
      if (p.y < window.innerHeight) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive) {
      requestAnimationFrame(update);
    } else {
      document.body.removeChild(canvas);
    }
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  update();
}
