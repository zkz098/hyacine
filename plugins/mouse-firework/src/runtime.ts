export interface MouseFireworkOptions {
  count?: number;
  radius?: number;
  colors?: string[];
}

export function init(options: MouseFireworkOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const count = options.count ?? 16;
  const radius = options.radius ?? 80;
  const colors = options.colors ?? [
    "#ff1744",
    "#d500f9",
    "#651fff",
    "#00e5ff",
    "#00e676",
    "#ffea00",
    "#ff9100",
  ];

  window.addEventListener("click", (e) => {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "999999";
    document.body.appendChild(canvas);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      alpha: number;
      size: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = (Math.random() * 0.5 + 0.5) * (radius / 15);
      particles.push({
        x: e.clientX,
        y: e.clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "#ff1744",
        alpha: 1,
        size: Math.random() * 3 + 2,
      });
    }

    let animationId: number;
    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.alpha -= 0.02;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (alive) {
        animationId = requestAnimationFrame(animate);
      } else {
        cancelAnimationFrame(animationId);
        canvas.remove();
      }
    }

    animate();
  });
}

export default { init };
