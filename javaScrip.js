/* ============================================================
   Acelerador de partículas controlado por el scroll
   p = progreso (0 a 1) de la sección #intro.
   Cada valor de p dibuja siempre la misma imagen, así que
   se puede avanzar y retroceder con el scroll sin problemas.
   ============================================================ */
(() => {
  "use strict";

  const canvas = document.getElementById("acelerador");
  const ctx = canvas.getContext("2d");
  const intro = document.getElementById("intro");
  const nav = document.getElementById("nav");
  const captions = Array.from(document.querySelectorAll(".caption"));
  const pista = document.getElementById("pista");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Ajustes que puedes cambiar ---------- */
  const PC = 0.55;          // momento de la colisión (0 a 1)
  const P1 = 0.30;          // fin de la fase de giro en el anillo
  const ZOOM_MAX = 7;       // cuánto se acerca la cámara a la colisión
  const VUELTAS = 2.5;      // vueltas que dan los haces antes de acercarse
  const N_ANILLO = 110;     // partículas decorativas en el anillo
  const N_HUELLAS = 90;     // trayectorias que salen de la colisión
  const DET = [0.28, 0.5, 0.72, 1]; // capas del detector (fracción del radio)
  const EXPLO = 1.35;       // tamaño de la explosión (1 = original)
  // Colores de las trayectorias tras la colisión (RGB)
  const PALETA = [
    [45, 140, 255],   // azul
    [45, 140, 255],   // azul (más frecuente)
    [45, 140, 255],   // azul (más frecuente)
    [200, 225, 255],  // blanco azulado
    [255, 60, 50],    // rojo
    [255, 150, 45]    // anaranjado
  ];

  const TAU = Math.PI * 2;
  const D0 = VUELTAS * Math.PI;
  const D1 = 1.1;

  /* ---------- Utilidades ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  // Números aleatorios con semilla: siempre salen los mismos
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(2024);

  const anillo = Array.from({ length: N_ANILLO }, () => ({
    base: rnd() * TAU,
    dir: rnd() < 0.5 ? -1 : 1,
    v: 0.6 + rnd() * 0.8,
    size: 0.6 + rnd() * 1.2,
    a: 0.25 + rnd() * 0.5
  }));

  const rndColor = mulberry32(77);
  const huellas = Array.from({ length: N_HUELLAS }, () => ({
    col: PALETA[Math.floor(rndColor() * PALETA.length)],
    ang: rnd() * TAU,
    k: (rnd() - 0.5) * 0.006,   // curvatura de la trayectoria
    len: 0.35 + rnd() * 0.65,
    w: 0.6 + rnd() * 1.2,
    caliente: rnd() < 0.25
  }));

  /* ---------- Tamaño del canvas ---------- */
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- Brillo radial ---------- */
  function brillo(x, y, r, alpha, rgb) {
    rgb = rgb || [45, 140, 255];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
    g.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.6})`);
    g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }


  function draw(p) {
    const m = Math.min(W, H);
    const R = m * 0.36;       // radio del anillo
    const Rdet = m * 0.44 * EXPLO;    // radio del detector

    
    const z = lerp(1, ZOOM_MAX, smooth(P1, PC, p));
    const camY = lerp(0, -R, smooth(0.22, PC - 0.05, p));
    const X = (x) => x * z + W / 2;
    const Y = (y) => (y - camY) * z + H / 2;
    const ipx = X(0), ipy = Y(-R);   // punto de colisión en pantalla

    
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);   // transparente: así se ven las estrellas de fondo
    let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, m * 0.9);
    g.addColorStop(0, "rgba(0,83,166,0.22)");
    g.addColorStop(1, "rgba(5,7,13,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    
    ctx.lineWidth = clamp(1 + z * 0.3, 1, 4);
    ctx.strokeStyle = "rgba(45,140,255,0.55)";
    ctx.beginPath();
    ctx.arc(X(0), Y(0), R * z, 0, TAU);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(45,140,255,0.18)";
    ctx.beginPath();
    ctx.arc(X(0), Y(0), R * 1.035 * z, 0, TAU);
    ctx.stroke();

    ctx.lineWidth = clamp(2 + z * 0.6, 2, 7);
    ctx.strokeStyle = "rgba(0,83,166,0.55)";
    ctx.beginPath();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const c = Math.cos(a), s = Math.sin(a);
      const x1 = X(R * 0.985 * c), y1 = Y(R * 0.985 * s);
      const x2 = X(R * 1.03 * c), y2 = Y(R * 1.03 * s);
      if (x1 < -200 || x1 > W + 200 || y1 < -200 || y1 > H + 200) continue;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";

    
    const T = p < PC ? TAU * 5 * Math.pow(p / PC, 2) : TAU * 5 + (p - PC) * TAU * 1.5;
    const fondoA = 1 - 0.75 * smooth(0.35, PC, p);
    for (const q of anillo) {
      const a = -Math.PI / 2 + q.dir * (q.base + q.v * T);
      const x = X(R * Math.cos(a)), y = Y(R * Math.sin(a));
      if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
      for (let i = 0; i < 6; i++) {
        const aa = a - (q.dir * i * 7) / (R * z);
        const xx = X(R * Math.cos(aa)), yy = Y(R * Math.sin(aa));
        ctx.fillStyle = `rgba(120,185,255,${q.a * fondoA * (1 - i / 6)})`;
        ctx.beginPath();
        ctx.arc(xx, yy, q.size * (1 - i / 12), 0, TAU);
        ctx.fill();
      }
    }

    
    function haz(a, dir, alpha, rgb) {
      const pts = 22, largo = 120;
      for (let i = pts; i >= 0; i--) {
        const aa = a - (dir * (i / pts) * largo) / (R * z);
        const x = X(R * Math.cos(aa)), y = Y(R * Math.sin(aa));
        const f = 1 - i / pts;
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * f * f * 0.9})`;
        ctx.beginPath();
        ctx.arc(x, y, 1 + f * 3.2, 0, TAU);
        ctx.fill();
      }
      const hx = X(R * Math.cos(a)), hy = Y(R * Math.sin(a));
      brillo(hx, hy, 38, 0.55 * alpha, rgb);
    }

    
    let D;
    if (p < P1) {
      D = lerp(D0, D1, smooth(0, P1, p));
    } else if (p < PC) {
      const u = (p - P1) / (PC - P1);
      D = (D1 * (1 - u * u)) / z;
    } else {
      D = 0;
    }

    const haces = p < PC ? 1 : 1 - smooth(PC, PC + 0.012, p);
    if (haces > 0) {
      haz(-Math.PI / 2 - D, +1, haces, [45, 140, 255]);
      haz(-Math.PI / 2 + D, -1, haces, [150, 200, 255]);
    }

    
    if (p < P1 && D > 0.5) {
      const dm = D % Math.PI;
      const cerca = Math.min(dm, Math.PI - dm);
      if (cerca < 0.3) {
        const k = 1 - cerca / 0.3;
        const a = -Math.PI / 2 - D;
        brillo(X(R * Math.cos(a)), Y(R * Math.sin(a)), 26 + k * 30, 0.5 * k);
      }
    }

    
    if (p < PC) {
      const k = smooth(PC - 0.08, PC, p);
      if (k > 0) brillo(ipx, ipy, 30 + k * 90, k * 0.7);
    } else {
      const t = (p - PC) / 0.14;
      if (t < 1) {
        const k = (1 - t) * (1 - t);
        const rf = (60 + t * Math.max(W, H) * 0.5) * EXPLO;
        brillo(ipx, ipy, rf, k, [200, 225, 255]);
        brillo(ipx, ipy, rf * 0.8, k * 0.55, [255, 60, 50]);
        brillo(ipx, ipy, rf * 0.55, k * 0.5, [255, 160, 50]);
      }
    }

    
    const dA = smooth(PC - 0.01, PC + 0.08, p);
    if (dA > 0) {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(45,140,255,${0.32 * dA})`;
      for (const f of DET) {
        ctx.beginPath();
        ctx.arc(ipx, ipy, Rdet * f, 0, TAU);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(45,140,255,${0.14 * dA})`;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + 0.13;
        ctx.moveTo(ipx + Math.cos(a) * Rdet * DET[0], ipy + Math.sin(a) * Rdet * DET[0]);
        ctx.lineTo(ipx + Math.cos(a) * Rdet, ipy + Math.sin(a) * Rdet);
      }
      ctx.stroke();

      ctx.globalCompositeOperation = "lighter";

      // Onda expansiva
      const w = clamp((p - PC) / 0.3);
      if (w > 0 && w < 1) {
        ctx.strokeStyle = `rgba(160,205,255,${(1 - w) * 0.5})`;
        ctx.lineWidth = 2 + (1 - w) * 3;
        ctx.beginPath();
        ctx.arc(ipx, ipy, Rdet * 1.15 * (1 - Math.pow(1 - w, 2)), 0, TAU);
        ctx.stroke();
        
        const ondas = [[255, 60, 50, 0.8], [255, 150, 45, 0.65]];
        ondas.forEach(([r, g, b, e], j) => {
          const wj = clamp(w * e);
          ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - w) * 0.4})`;
          ctx.lineWidth = 1.5 + (1 - w) * 2.5;
          ctx.beginPath();
          ctx.arc(ipx, ipy, Rdet * (0.95 - j * 0.12) * (1 - Math.pow(1 - wj, 2)), 0, TAU);
          ctx.stroke();
        });
      }

      
      const tt = clamp((p - PC) / 0.22);
      const ease = 1 - Math.pow(1 - tt, 3);
      if (tt > 0) {
        const impactos = [];
        const paso = 5;
        for (const h of huellas) {
          let x = ipx, y = ipy, th = h.ang, rPrev = 0;
          const n = Math.floor((Rdet * h.len * ease) / paso);
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let i = 0; i < n; i++) {
            th += h.k * paso;
            x += Math.cos(th) * paso;
            y += Math.sin(th) * paso;
            ctx.lineTo(x, y);
            const r = Math.hypot(x - ipx, y - ipy);
            for (const f of DET) {
              const rr = Rdet * f;
              if (rPrev < rr && r >= rr) impactos.push(x, y, h.col);
            }
            rPrev = r;
          }
          const [cr, cg, cb] = h.caliente ? [200, 225, 255] : h.col;
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(h.caliente ? 0.85 : 0.7) * dA})`;
          ctx.lineWidth = h.w;
          ctx.stroke();
        }
        for (let i = 0; i < impactos.length; i += 3) {
          const c = impactos[i + 2];
          ctx.fillStyle = `rgba(${Math.min(255, c[0] + 60)},${Math.min(255, c[1] + 60)},${Math.min(255, c[2] + 60)},${0.9 * dA})`;
          ctx.beginPath();
          ctx.arc(impactos[i], impactos[i + 1], 1.8, 0, TAU);
          ctx.fill();
        }
      }
    }

    
    canvas.style.opacity = String(1 - smooth(0.86, 1, p));
  }

  
  function actualizarTextos(p) {
    for (const c of captions) {
      const a = parseFloat(c.dataset.in);
      const b = parseFloat(c.dataset.out);
      const entra = a <= 0 ? 1 : smooth(a, a + 0.04, p);
      const sale = b >= 1 ? 1 : 1 - smooth(b - 0.04, b, p);
      c.style.opacity = entra * sale;
    }
    pista.style.opacity = 1 - smooth(0.02, 0.08, p);
  }

  
  let objetivo = 0, actual = 0, ultimo = -1, sucio = true;

  function leerScroll() {
    const total = intro.offsetHeight - window.innerHeight;
    objetivo = total > 0 ? clamp(-intro.getBoundingClientRect().top / total) : 0;
    nav.classList.toggle("scrolled", window.scrollY > 40);
  }

  function bucle() {
    actual += (objetivo - actual) * 0.14;           // suaviza el movimiento
    if (Math.abs(objetivo - actual) < 0.0003) actual = objetivo;
    if (actual !== ultimo || sucio) {
      draw(actual);
      actualizarTextos(actual);
      ultimo = actual;
      sucio = false;
    }
    requestAnimationFrame(bucle);
  }

  
  if (reduce) {
    
    intro.classList.add("reducido");
    pista.style.display = "none";
    const estatico = () => {
      resize();
      draw(0.72);
      captions.forEach((c) => { c.style.opacity = c.hasAttribute("data-final") ? 1 : 0; });
    };
    estatico();
    window.addEventListener("resize", estatico);
    window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 40), { passive: true });
  } else {
    resize();
    leerScroll();
    actual = objetivo;
    window.addEventListener("scroll", leerScroll, { passive: true });
    window.addEventListener("resize", () => { resize(); leerScroll(); sucio = true; });
    requestAnimationFrame(bucle);
  }
})();


(() => {
  "use strict";

  const escena = document.getElementById("proyecto");
  if (!escena) return;

  const titulo = document.getElementById("proyecto-titulo");
  const lead = escena.querySelector(".lead-texto");
  const secundario = escena.querySelector(".texto-secundario");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    escena.classList.add("reducido");
    return;
  }


  const PASOS = [
    { el: titulo,     inicio: 0.02 },
    { el: lead,       inicio: 0.20 },
    { el: secundario, inicio: 0.40 }
  ];
  const DURACION = 0.14;   // cuánto scroll tarda cada bloque en aparecer
  const SUBIDA = 18;       // píxeles que sube mientras aparece

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  let ultimo = -1;

  function actualizar() {
    const total = escena.offsetHeight - window.innerHeight;
    const adelanto = window.innerHeight * 0.4;   // empieza un poco antes de fijarse
    const p = clamp((adelanto - escena.getBoundingClientRect().top) / (total + adelanto));
    if (p === ultimo) return;
    ultimo = p;

    for (const paso of PASOS) {
      const t = smooth(paso.inicio, paso.inicio + DURACION, p);
      paso.el.style.opacity = t;
      paso.el.style.transform = `translateY(${(1 - t) * SUBIDA}px)`;
    }
  }

  window.addEventListener("scroll", actualizar, { passive: true });
  window.addEventListener("resize", () => { ultimo = -1; actualizar(); });
  actualizar();
})();

/* ============================================================
   World Wide Web Reimagined
   Mientras el usuario hace scroll: un anillo baja con dos partículas
   que aceleran, entra en un SALTO DE VELOCIDAD (warp: rayas de luz,
   zoom y destello) y desemboca en una ESFERA de nodos conectados que
   se puede girar con el mouse o con el dedo. Después aparecen el
   título y cada párrafo, uno por uno.
   s = pantallas de scroll recorridas dentro de la sección.
   ============================================================ */
(() => {
  "use strict";

  const seccion = document.getElementById("acerca");
  const canvas = document.getElementById("acerca-canvas");
  if (!seccion || !canvas) return;
  const texto = seccion.querySelector(".acerca-texto");
  const titulo = document.getElementById("acerca-titulo");
  const parrafos = Array.from(seccion.querySelectorAll(".acerca-parrafos p"));
  const pistaGiro = document.getElementById("giro-pista");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  if (reduce || !ctx || !texto || !titulo) return;   // sin animación: el texto se ve directamente

  /* ---------- Ajustes que puedes cambiar ---------- */
  const TAMANO = 0.26;      // tamaño del anillo (fracción del lado menor de la pantalla; en móvil se usa MOVIL)
  const MOVIL = 0.32;
  const S_DESC = 0.5;       // pantallas de scroll que tarda el anillo en bajar
  const S_GIRO = 0.12;      // cuándo empiezan a acelerar las partículas
  const S_TOPE = 0.95;      // cuándo alcanzan su velocidad máxima
  const V_INI = 0.12;       // vueltas por pantalla al empezar a girar
  const V_MAX = 1.3;        // vueltas por pantalla a velocidad máxima
  const SEPARACION = 0.14;  // separación inicial de las dos partículas (radianes)
  const N_AMBIENTE = 44;    // partículas decorativas del anillo

  const S_WARP0 = 0.85;     // aquí empieza el salto de velocidad
  const S_WARP1 = 2.6;      // aquí termina: la esfera ya está formada (más alto = formación más lenta)
  const S_TITULO = 2.6;     // el título queda en su sitio cuando se han recorrido estas pantallas (mantenerlo igual que S_WARP1)
  const TITULO_Y = 0.64;    // altura del título en pantalla (0 = arriba, 1 = abajo); debajo de la esfera
  const S_OFF = 0.75;       // pantallas después del título en que la esfera deja de ser interactiva
  const N_GLOBO = 340;      // puntos de la esfera (en móvil se usan menos)
  const N_GLOBO_MOVIL = 230;
  const N_ESTRIAS = 150;    // rayas de luz del salto de velocidad

  const GIRO_INERCIA = 0.95;    // 0 a 1: cuánto tarda en frenar al soltar
  const GIRO_HOVER = 0.0055;    // velocidad de giro al apuntar con el mouse (rad/frame)
  const GIRO_TILT_HOVER = 0.20; // inclinación al apuntar con el mouse (rad)

  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const salida = (u) => 1 - Math.pow(1 - u, 3);
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const COLS = [[120, 185, 255], [255, 90, 70], [255, 170, 70]];   // azul, rojo, naranja
  const PALETA = [[45, 140, 255], [45, 140, 255], [200, 225, 255], [255, 60, 50], [255, 150, 45]];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(1989);
  const ambiente = Array.from({ length: N_AMBIENTE }, () => ({
    base: rnd() * TAU,
    dir: rnd() < 0.5 ? -1 : 1,
    v: 0.6 + rnd() * 0.8,
    size: 0.6 + rnd() * 1.1,
    a: 0.25 + rnd() * 0.5
  }));

  /* ---------- La esfera y las rayas del salto ---------- */
  let globo = [], enlGlobo = [], vecinos = [], estrias = [];
  function construirGlobo(n) {
    const r3 = mulberry32(31337);
    const oro = Math.PI * (3 - Math.sqrt(5));
    globo = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const th = i * oro;
      globo.push({
        x: Math.cos(th) * r, y, z: Math.sin(th) * r,
        o: r3(), ax: r3() * 2 - 1, ay: r3() * 2 - 1,
        c: r3() < 0.14 ? (r3() < 0.5 ? 1 : 2) : 0,
        sx: 0, sy: 0, u: 0, d: 0
      });
    }
    enlGlobo = [];
    const vistos = new Set();
    for (let i = 0; i < globo.length; i++) {
      const cerca = [];
      for (let j = 0; j < globo.length; j++) {
        if (i === j) continue;
        const dx = globo[i].x - globo[j].x, dy = globo[i].y - globo[j].y, dz = globo[i].z - globo[j].z;
        cerca.push([dx * dx + dy * dy + dz * dz, j]);
      }
      cerca.sort((p, q) => p[0] - q[0]);
      for (let k = 0; k < 3; k++) {
        const j = cerca[k][1];
        const key = Math.min(i, j) * 10000 + Math.max(i, j);
        if (vistos.has(key)) continue;
        vistos.add(key);
        enlGlobo.push([i, j]);
      }
    }
    vecinos = globo.map(() => []);
    for (const [i, j] of enlGlobo) { vecinos[i].push(j); vecinos[j].push(i); }
    estrias = Array.from({ length: N_ESTRIAS }, () => ({
      a: r3() * TAU, p: r3(), v: 0.6 + r3() * 0.9, w: 0.6 + r3() * 1.4,
      col: PALETA[Math.floor(r3() * PALETA.length)]
    }));
  }

  /* ---------- Estado de la interacción ---------- */
  const giro = {
    yaw: 0, pitch: 0, vy: 0, vp: 0,
    arrastre: false, sobre: false, usado: false,
    px: 0, py: 0, hovY: 0, hovP: 0, ultimo: 0, mx: 0, my: 0, mt: 0, aviso: 0
  };
  const globoInfo = { x: 0, y: 0, r: 0, on: false };
  const ondas = [];   // ondas que salen del punto tocado

  /* ---------- Tamaño ---------- */
  let W = 0, H = 0, dpr = 1, vh = window.innerHeight, nGlobo = 0;
  let offT = 0, offP = [];   // posición del título y de los párrafos dentro de la sección

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = W < 600 ? N_GLOBO_MOVIL : N_GLOBO;
    if (n !== nGlobo) { nGlobo = n; construirGlobo(n); }
  }

  // El título queda a la altura TITULO_Y de la pantalla tras S_TITULO pantallas de scroll
  function medir() {
    vh = window.innerHeight;
    const espacio = Math.round(S_TITULO * vh + vh * TITULO_Y - titulo.offsetHeight / 2);
    texto.style.paddingTop = Math.max(espacio, 0) + "px";
    const base = texto.offsetTop;
    offT = base + titulo.offsetTop;
    offP = parrafos.map((p) => base + p.offsetTop);
    seccion.dataset.destino = String(Math.round(S_TITULO * vh));   // lo usa el buscador para llegar al título
  }

  /* ---------- Brillo radial ---------- */
  function brillo(x, y, r, alpha, rgb) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
    g.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.6})`);
    g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Ángulo recorrido (en radianes): empieza lento, acelera y luego mantiene la velocidad
  function vuelta(s) {
    const x = Math.max(0, s - S_GIRO);
    const L = S_TOPE - S_GIRO;
    const rev = x < L
      ? V_INI * x + ((V_MAX - V_INI) * x * x) / (2 * L)
      : V_INI * L + ((V_MAX - V_INI) * L) / 2 + V_MAX * (x - L);
    return rev * TAU;
  }

  /* ---------- Dibujo ---------- */
  function dibujar(s, t) {
    const m = Math.min(W, H), diag = Math.hypot(W, H) / 2;
    const sec = t / 1000;
    const R = m * (W < 600 ? MOVIL : TAMANO);
    const cx = W / 2;
    const cy = lerp(-R * 0.55, H / 2, salida(smooth(0, S_DESC, s)));   // el anillo baja con el scroll

    const q = clamp((s - S_WARP0) / (S_WARP1 - S_WARP0));              // 0 → 1 durante el salto y la esfera
    const salto = smooth(0, 0.40, q);
    const z = Math.pow(8, salto);                                      // zoom exponencial: se siente velocidad
    const Rz = R * z;
    const entra = smooth(0, 0.08, s);
    const anilloVivo = 1 - smooth(0.12, 0.38, q);                      // el anillo se desvanece al saltar
    const A = entra * anilloVivo;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);

    // Halo de fondo
    const haloA = 0.2 * A + 0.22 * smooth(0.3, 0.7, q) * (1 - smooth(0.85, 1, q) * 0.4);
    if (haloA > 0.004) {
      const hy = lerp(cy, H * 0.38, smooth(0.62, 0.9, q));
      const g = ctx.createRadialGradient(cx, hy, 0, cx, hy, Math.max(R * 2.6, m * 0.9 * smooth(0.3, 0.7, q)));
      g.addColorStop(0, `rgba(0,83,166,${haloA})`);
      g.addColorStop(1, "rgba(5,7,13,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    /* --- Anillo, borde exterior y marcas --- */
    if (A > 0.004) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(45,140,255,${0.6 * A})`;
      ctx.beginPath(); ctx.arc(cx, cy, Rz, 0, TAU); ctx.stroke();

      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(45,140,255,${0.2 * A})`;
      ctx.beginPath(); ctx.arc(cx, cy, Rz * 1.04, 0, TAU); ctx.stroke();

      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(0,83,166,${0.6 * A})`;
      ctx.beginPath();
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * TAU;
        const c = Math.cos(a), sn = Math.sin(a);
        ctx.moveTo(cx + Rz * 0.975 * c, cy + Rz * 0.975 * sn);
        ctx.lineTo(cx + Rz * 1.04 * c, cy + Rz * 1.04 * sn);
      }
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "lighter";

    const phi = SEPARACION + vuelta(s) + t * 0.00028;   // el deslizamiento lento sigue aunque no haya scroll

    // Partículas decorativas del anillo
    const ambA = smooth(0.1, 0.4, s) * anilloVivo;
    if (ambA > 0.01) {
      for (const p of ambiente) {
        const a = Math.PI / 2 + p.dir * (p.base + p.v * phi * 0.45);
        for (let i = 0; i < 6; i++) {
          const aa = a - (p.dir * i * 6) / Rz;
          const x = cx + Rz * Math.cos(aa), y = cy + Rz * Math.sin(aa);
          if (y < -20 || y > H + 20 || x < -20 || x > W + 20) continue;
          ctx.fillStyle = `rgba(120,185,255,${p.a * ambA * (1 - i / 6)})`;
          ctx.beginPath(); ctx.arc(x, y, p.size * (1 - i / 12), 0, TAU); ctx.fill();
        }
      }
    }

    // Las dos partículas principales: giran en sentidos opuestos y su estela crece con la velocidad
    const vel = smooth(S_GIRO, S_TOPE, s);
    const largo = Rz * (0.55 + 0.55 * vel);
    const haces = smooth(0, 0.12, s) * anilloVivo;
    function haz(a, dir, alpha, rgb) {
      const pts = 22;
      for (let i = pts; i >= 0; i--) {
        const aa = a - (dir * (i / pts) * largo) / Rz;
        const x = cx + Rz * Math.cos(aa), y = cy + Rz * Math.sin(aa);
        const f = 1 - i / pts;
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * f * f * 0.9})`;
        ctx.beginPath(); ctx.arc(x, y, 1 + f * 3, 0, TAU); ctx.fill();
      }
      brillo(cx + Rz * Math.cos(a), cy + Rz * Math.sin(a), 30 * Math.min(z, 2.4), 0.5 * alpha, rgb);
    }
    if (haces > 0.001) {
      haz(Math.PI / 2 + phi, +1, haces, [45, 140, 255]);
      haz(Math.PI / 2 - phi, -1, haces, [150, 200, 255]);
    }

    /* --- Salto de velocidad: rayas de luz que salen del centro --- */
    const pico = Math.sin(Math.PI * clamp(q / 0.5));
    if (pico > 0.01) {
      ctx.lineCap = "round";
      for (const e of estrias) {
        const f = (e.p + q * 2.6 * e.v) % 1;
        const rCab = diag * 1.15 * f * f + 8;
        const larg = diag * 0.55 * f * f * pico * (0.4 + 0.6 * e.v);
        const rCola = Math.max(4, rCab - larg);
        const ca = Math.cos(e.a), sa = Math.sin(e.a);
        ctx.strokeStyle = rgba(e.col, (0.12 + 0.7 * f) * pico);
        ctx.lineWidth = e.w * (0.6 + f * 1.6);
        ctx.beginPath();
        ctx.moveTo(cx + ca * rCola, H / 2 + sa * rCola);
        ctx.lineTo(cx + ca * rCab, H / 2 + sa * rCab);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
    }
    // Destello en el punto más rápido del salto
    const fl = smooth(0.26, 0.38, q) * (1 - smooth(0.38, 0.52, q));
    if (fl > 0.01) {
      brillo(cx, H / 2, m * (0.3 + 0.9 * fl), 0.85 * fl, [200, 225, 255]);
      brillo(cx, H / 2, m * 0.5 * fl, 0.5 * fl, [255, 160, 50]);
    }

    /* --- La esfera: los puntos del salto se ordenan en un globo --- */
    const g1 = smooth(0.30, 0.68, q);
    globoInfo.on = false;
    if (g1 > 0.001) {
      const Rg = m * ((W < 600 ? 0.30 : 0.25) + 0.02 * smooth(0.5, 1, q));
      const gx = cx;
      const gy = lerp(H / 2, H * 0.38, smooth(0.62, 0.9, q));        // sube para dejar sitio al título
      const gA = (1 - 0.42 * smooth(0.72, 0.9, q)) * (1 - 0.38 * smooth(S_TITULO + 0.2, S_TITULO + 0.9, s));
      const ang = 0.6 + q * TAU + sec * 0.12 + giro.yaw;
      const tilt = 0.42 + giro.pitch;
      const ca = Math.cos(ang), sa = Math.sin(ang), ct = Math.cos(tilt), st = Math.sin(tilt);
      globoInfo.x = gx; globoInfo.y = gy; globoInfo.r = Rg;
      globoInfo.on = g1 > 0.95 && q > 0.7 && s < S_TITULO + S_OFF;

      brillo(gx, gy, Rg * 1.75, 0.30 * g1 * gA, [45, 140, 255]);

      const proy = (x, y, zz) => {
        const x1 = x * ca + zz * sa, z1 = -x * sa + zz * ca;
        const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
        const f = 1 / (1 - z2 * 0.32);
        return [gx + x1 * Rg * f, gy + y2 * Rg * f, (z2 + 1) / 2];
      };

      for (const p of globo) {
        const [ex, ey, d] = proy(p.x, p.y, p.z);
        const e = clamp(g1 * 1.7 - p.o * 0.7);
        const u = 1 - Math.pow(1 - e, 3);
        p.sx = lerp(gx + p.ax * diag * 1.1, ex, u);
        p.sy = lerp(gy + p.ay * diag * 1.1, ey, u);
        p.u = u; p.d = d;
      }

      // Líneas de latitud y longitud
      const lineaA = smooth(0.52, 0.78, q) * gA;
      if (lineaA > 0.01) {
        const frente = new Path2D(), fondo = new Path2D();
        const curva = (fn) => {
          let prev = null;
          for (let i = 0; i <= 56; i++) {
            const pt = proy(...fn((i / 56) * TAU));
            if (prev) {
              const dest = (prev[2] + pt[2]) / 2 >= 0.5 ? frente : fondo;
              dest.moveTo(prev[0], prev[1]); dest.lineTo(pt[0], pt[1]);
            }
            prev = pt;
          }
        };
        for (let k = 0; k < 8; k++) {
          const lon = (k / 8) * Math.PI;
          curva((th) => [Math.cos(th) * Math.cos(lon), Math.sin(th), Math.cos(th) * Math.sin(lon)]);
        }
        for (const lat of [-60, -30, 0, 30, 60]) {
          const f = (lat * Math.PI) / 180;
          curva((th) => [Math.cos(f) * Math.cos(th), Math.sin(f), Math.cos(f) * Math.sin(th)]);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(110,175,255,${0.26 * lineaA})`; ctx.stroke(frente);
        ctx.strokeStyle = `rgba(110,175,255,${0.08 * lineaA})`; ctx.stroke(fondo);
      }

      // Enlaces entre puntos vecinos (6 grupos: 3 niveles de aparición × cara / fondo)
      const grupos = Array.from({ length: 6 }, () => new Path2D());
      for (const [i, j] of enlGlobo) {
        const A1 = globo[i], B1 = globo[j];
        const u = Math.min(A1.u, B1.u);
        if (u < 0.04) continue;
        const lv = Math.ceil(u * 3 - 1e-6) - 1;
        const lado = (A1.d + B1.d) / 2 >= 0.5 ? 0 : 3;
        grupos[lado + lv].moveTo(A1.sx, A1.sy);
        grupos[lado + lv].lineTo(B1.sx, B1.sy);
      }
      ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const lv = (k % 3) + 1, frente = k < 3;
        ctx.strokeStyle = `rgba(120,185,255,${(frente ? 0.34 : 0.09) * (lv / 3) * gA})`;
        ctx.stroke(grupos[k]);
      }

      // Puntos
      for (const p of globo) {
        if (p.u < 0.01) continue;
        const prof = 0.25 + 0.75 * p.d;
        const a = prof * (0.3 + 0.7 * p.u) * gA;
        const c = COLS[p.c];
        if (p.d > 0.8 && p.u > 0.9) {
          ctx.fillStyle = rgba(c, 0.13 * gA);
          ctx.beginPath(); ctx.arc(p.sx, p.sy, 6, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = `rgba(${Math.min(255, c[0] + 60)},${Math.min(255, c[1] + 60)},${Math.min(255, c[2] + 60)},${a})`;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, 0.8 + 1.5 * p.d, 0, TAU); ctx.fill();
      }

      // Interacción: el punto más cercano al dedo/mouse se enciende y contagia a sus vecinos
      if (globoInfo.on && (giro.sobre || giro.arrastre)) {
        let mejor = -1, mejorD = 46 * 46;
        for (let i = 0; i < globo.length; i++) {
          const p = globo[i];
          if (p.d < 0.45) continue;
          const dx = p.sx - giro.px, dy = p.sy - giro.py, dd = dx * dx + dy * dy;
          if (dd < mejorD) { mejorD = dd; mejor = i; }
        }
        brillo(giro.px, giro.py, Rg * 0.55, 0.10 * gA, [120, 185, 255]);
        if (mejor >= 0) {
          const P = globo[mejor];
          ctx.lineWidth = 1.4;
          for (const j of vecinos[mejor]) {
            const B = globo[j];
            ctx.strokeStyle = `rgba(190,225,255,${0.75 * gA})`;
            ctx.beginPath(); ctx.moveTo(P.sx, P.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
            for (const k of vecinos[j]) {
              if (k === mejor) continue;
              const C = globo[k];
              ctx.strokeStyle = `rgba(150,200,255,${0.28 * gA})`;
              ctx.beginPath(); ctx.moveTo(B.sx, B.sy); ctx.lineTo(C.sx, C.sy); ctx.stroke();
            }
            ctx.fillStyle = `rgba(220,240,255,${0.9 * gA})`;
            ctx.beginPath(); ctx.arc(B.sx, B.sy, 2.4, 0, TAU); ctx.fill();
          }
          brillo(P.sx, P.sy, 26, 0.65 * gA, [160, 210, 255]);
          ctx.fillStyle = `rgba(255,255,255,${gA})`;
          ctx.beginPath(); ctx.arc(P.sx, P.sy, 3.4, 0, TAU); ctx.fill();
        }
      }

      // Ondas al tocar o hacer clic
      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i];
        const f = (t - o.t0) / 1100;
        if (f >= 1) { ondas.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - f, 3);
        ctx.strokeStyle = `rgba(170,215,255,${(1 - f) * 0.65 * gA})`;
        ctx.lineWidth = 1 + (1 - f) * 2.5;
        ctx.beginPath(); ctx.arc(o.x, o.y, 10 + e * Rg * 0.9, 0, TAU); ctx.stroke();
      }

      // El anillo del acelerador vuelve a orbitar la esfera, con sus dos haces
      const anilloA = smooth(0.56, 0.74, q) * gA;
      if (anilloA > 0.01) {
        const Rr = Math.min(Rg * 1.62, W * 0.47), ry = Rr * 0.26, rot = -0.32;
        const cr = Math.cos(rot), sr = Math.sin(rot);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = `rgba(45,140,255,${0.55 * anilloA})`;
        ctx.beginPath(); ctx.ellipse(gx, gy, Rr, ry, rot, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(45,140,255,${0.18 * anilloA})`;
        ctx.beginPath(); ctx.ellipse(gx, gy, Rr * 1.035, ry * 1.035, rot, 0, TAU); ctx.stroke();
        for (const dir of [1, -1]) {
          const cab = dir * (q * TAU * 3 + sec * 0.5) + (dir > 0 ? 0 : Math.PI * 0.85);
          const col = dir > 0 ? [45, 140, 255] : [150, 200, 255];
          let hx = 0, hy = 0;
          for (let i = 14; i >= 0; i--) {
            const aa = cab - dir * i * 0.055;
            const ex = Rr * Math.cos(aa), ey = ry * Math.sin(aa);
            const x = gx + ex * cr - ey * sr, y = gy + ex * sr + ey * cr;
            const f = 1 - i / 14;
            ctx.fillStyle = rgba(col, anilloA * f * f * 0.95);
            ctx.beginPath(); ctx.arc(x, y, 1 + f * 3.2, 0, TAU); ctx.fill();
            if (i === 0) { hx = x; hy = y; }
          }
          brillo(hx, hy, 34, 0.55 * anilloA, col);
        }
      }

      // Onda expansiva cuando se forma la esfera
      const w = clamp((q - 0.66) / 0.2);
      if (w > 0 && w < 1) {
        ctx.strokeStyle = `rgba(160,205,255,${(1 - w) * 0.5})`;
        ctx.lineWidth = 1 + (1 - w) * 3;
        ctx.beginPath();
        ctx.arc(gx, gy, lerp(Rg * 0.6, diag, 1 - Math.pow(1 - w, 2)), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /* ---------- Aparición del texto ---------- */
  function revelar(secTop) {
    // El título aparece al llegar a la parte media de la pantalla
    const y0 = vh * (TITULO_Y + 0.30), y1 = vh * (TITULO_Y + 0.02);
    const k = smooth(y0, y1, secTop + offT);
    titulo.style.opacity = k.toFixed(3);
    titulo.style.transform = `translateY(${((1 - k) * 28).toFixed(2)}px) scale(${(0.94 + 0.06 * k).toFixed(4)})`;
    titulo.style.filter = k < 0.999 ? `blur(${((1 - k) * 7).toFixed(2)}px)` : "";

    // Cada párrafo aparece, uno tras otro, cuando sube lo suficiente por la pantalla
    for (let i = 0; i < parrafos.length; i++) {
      const q = smooth(vh * 0.95, vh * 0.7, secTop + offP[i]);
      const st = parrafos[i].style;
      st.opacity = q.toFixed(3);
      st.transform = `translateY(${((1 - q) * 34).toFixed(2)}px)`;
      st.filter = q < 0.999 ? `blur(${((1 - q) * 6).toFixed(2)}px)` : "";
      st.setProperty("--barra", q.toFixed(3));
    }
  }

  /* ---------- Física del giro (inercia y apuntado con el mouse) ---------- */
  function fisicaGiro(t) {
    const dtf = Math.min(2.5, giro.ultimo ? (t - giro.ultimo) / 16.7 : 1);
    giro.ultimo = t;
    if (!globoInfo.on) { giro.vy = giro.vp = 0; giro.arrastre = false; giro.sobre = false; }
    if (giro.arrastre) return;
    giro.yaw += giro.vy * dtf;                       // inercia al soltar
    giro.vy *= Math.pow(GIRO_INERCIA, dtf);
    if (Math.abs(giro.vy) < 0.00005) giro.vy = 0;
    const objY = giro.sobre ? giro.hovY : 0;         // con el mouse encima, gira hacia donde apuntas
    const objP = giro.sobre ? giro.hovP : 0;
    giro.yaw += objY * dtf;
    giro.pitch += (objP - giro.pitch) * Math.min(1, 0.05 * dtf);
    giro.pitch += giro.vp * dtf;
    giro.vp *= Math.pow(0.9, dtf);
  }

  /* ---------- Eventos: mouse y dedo ---------- */
  const NO_GLOBO = "a, button, input, select, textarea, label, nav, .navbar, .dropdown-menu, .sugerencias, .sigue, .acerca-parrafos p";

  // Mientras se usa la esfera no hay scroll: avisamos al resto del sitio para que no salga "sigue bajando"
  function mantenerActivo() {
    const ahora = performance.now();
    if (ahora - giro.aviso > 700) { giro.aviso = ahora; window.dispatchEvent(new Event("scroll")); }
  }

  function activarInteraccion() {
    const local = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      return [cx - r.left, cy - r.top];
    };
    const dentro = (x, y, margen = 1.12) =>
      globoInfo.on && Math.hypot(x - globoInfo.x, y - globoInfo.y) <= globoInfo.r * margen;

    const empezar = (x, y) => {
      giro.arrastre = true; giro.usado = true;
      giro.px = x; giro.py = y; giro.vy = 0; giro.vp = 0;
      canvas.style.cursor = "grabbing";
      mantenerActivo();
    };
    const mover = (x, y) => {
      const dx = x - giro.px, dy = y - giro.py;
      const r = Math.max(60, globoInfo.r);
      const dYaw = dx / r * 1.15, dPit = -dy / r * 0.8;
      giro.yaw += dYaw;
      giro.pitch = clamp(giro.pitch + dPit, -1.0, 1.0);
      giro.vy = lerp(giro.vy, dYaw, 0.5);
      giro.px = x; giro.py = y;
      mantenerActivo();
    };
    const terminar = () => {
      giro.arrastre = false;
      giro.vy = clamp(giro.vy, -0.12, 0.12);
      canvas.style.cursor = giro.sobre ? "grab" : "";
    };
    const onda = (x, y) => { ondas.push({ x, y, t0: performance.now() }); };

    /* --- Mouse --- */
    window.addEventListener("mousemove", (e) => {
      const sobreUI = !!(e.target.closest && e.target.closest(NO_GLOBO));
      const [x, y] = local(e.clientX, e.clientY);
      if (giro.arrastre) { mover(x, y); return; }
      const ok = !sobreUI && dentro(x, y);
      giro.sobre = ok;
      giro.px = x; giro.py = y;
      if (ok) {
        const r = Math.max(60, globoInfo.r);
        giro.hovY = clamp((x - globoInfo.x) / r, -1, 1) * GIRO_HOVER;
        giro.hovP = clamp(-(y - globoInfo.y) / r, -1, 1) * GIRO_TILT_HOVER;
        mantenerActivo();
      }
      canvas.style.cursor = ok ? "grab" : "";
    });
    window.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || (e.target.closest && e.target.closest(NO_GLOBO))) return;
      const [x, y] = local(e.clientX, e.clientY);
      if (!dentro(x, y)) return;
      e.preventDefault();                        // evita seleccionar texto al arrastrar
      giro.mx = x; giro.my = y; giro.mt = performance.now();
      empezar(x, y);
    });
    window.addEventListener("mouseup", (e) => {
      if (!giro.arrastre) return;
      const [x, y] = local(e.clientX, e.clientY);
      const corto = Math.hypot(x - giro.mx, y - giro.my) < 6 && performance.now() - giro.mt < 350;
      terminar();
      if (corto) onda(x, y);
    });
    document.addEventListener("mouseleave", () => { giro.sobre = false; if (giro.arrastre) terminar(); });

    /* --- Táctil: el arrastre horizontal gira la esfera; el vertical sigue haciendo scroll --- */
    let toque = null;
    window.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1 || (e.target.closest && e.target.closest(NO_GLOBO))) { toque = null; return; }
      const [x, y] = local(e.touches[0].clientX, e.touches[0].clientY);
      toque = dentro(x, y, 1.2) ? { x0: x, y0: y, t0: performance.now(), reclamado: false } : null;
    }, { passive: true });
    window.addEventListener("touchmove", (e) => {
      if (!toque || e.touches.length !== 1) return;
      const [x, y] = local(e.touches[0].clientX, e.touches[0].clientY);
      if (!toque.reclamado) {
        const dx = x - toque.x0, dy = y - toque.y0;
        if (Math.hypot(dx, dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy) * 0.8) {      // horizontal → la esfera lo reclama
          toque.reclamado = true;
          empezar(toque.x0, toque.y0);                // sin saltos al empezar
        } else { toque = null; return; }              // vertical → scroll normal de la página
      }
      if (e.cancelable) e.preventDefault();
      mover(x, y);
    }, { passive: false });
    window.addEventListener("touchend", (e) => {
      if (!toque) return;
      const tq = toque; toque = null;
      if (tq.reclamado) { terminar(); return; }
      const ct = e.changedTouches && e.changedTouches[0];
      if (!ct) return;
      const [x, y] = local(ct.clientX, ct.clientY);
      if (Math.hypot(x - tq.x0, y - tq.y0) < 10 && performance.now() - tq.t0 < 350 && dentro(x, y)) {
        giro.usado = true; giro.px = x; giro.py = y;
        giro.sobre = true;                            // enciende el nodo tocado un instante
        setTimeout(() => { if (!giro.arrastre) giro.sobre = false; }, 700);
        onda(x, y);
        mantenerActivo();
      }
    }, { passive: true });
    window.addEventListener("touchcancel", () => { if (toque && toque.reclamado) terminar(); toque = null; }, { passive: true });
  }

  /* ---------- Scroll ---------- */
  let objetivo = 0, actual = 0, secTop = 0, visible = false;

  function leerScroll() {
    const r = seccion.getBoundingClientRect();
    secTop = r.top;
    visible = r.top < window.innerHeight && r.bottom > 0;
    objetivo = Math.max(0, -r.top / window.innerHeight);
  }

  function bucle(t) {
    if (visible) {
      fisicaGiro(t);
      actual += (objetivo - actual) * 0.14;
      if (Math.abs(objetivo - actual) < 0.0003) actual = objetivo;
      dibujar(actual, t);
      revelar(secTop);
      if (pistaGiro) pistaGiro.style.opacity = globoInfo.on && !giro.usado ? 1 : 0;
    }
    requestAnimationFrame(bucle);
  }

  function todo() { resize(); medir(); leerScroll(); }

  window.addEventListener("scroll", leerScroll, { passive: true });
  window.addEventListener("resize", todo);
  document.addEventListener("idioma-cambiado", () => { medir(); leerScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { medir(); leerScroll(); });

  todo();
  actual = objetivo;
  revelar(secTop);
  activarInteraccion();
  requestAnimationFrame(bucle);
})();

(() => {
  "use strict";

  const lienzo = document.getElementById("estrellas");
  if (!lienzo) return;
  const g = lienzo.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Ajustes que puedes cambiar ---------- */
  const DENSIDAD = 3500;     // más bajo = más estrellas (píxeles² por estrella)
  const MIN = 80, MAX = 500; // mínimo y máximo de estrellas
  const RADIO = 175;         // radio de influencia del mouse (px)
  const EMPUJE = 1800;       // fuerza con la que se apartan del mouse
  const PARALAJE = 100;       // cuánto se desplazan con el mouse (px)

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const aleatorio = Math.random;

  let W = 0, H = 0, dpr = 1;
  let estrellas = [];
  const raton = { x: -9999, y: -9999 };
  const par = { x: 0, y: 0 };

  function crear() {
    const n = clamp(Math.round((W * H) / DENSIDAD), MIN, MAX);
    estrellas = Array.from({ length: n }, () => {
      const z = 0.25 + aleatorio() * 0.75;           // profundidad
      const grande = aleatorio() < 0.06;             // pocas estrellas con brillo
      return {
        nx: aleatorio(), ny: aleatorio(),            // posición (0 a 1)
        z,
        r: grande ? 1.8 + aleatorio() * 0.8 : 0.5 + z * 1.1,
        a: 0.25 + aleatorio() * 0.55,
        fase: aleatorio() * Math.PI * 2,
        vel: 0.4 + aleatorio() * 1.2,
        vx: (aleatorio() - 0.5) * 5,
        vy: -(2 + z * 7),
        ox: 0, oy: 0, vox: 0, voy: 0,                // desplazamiento por el mouse
        azul: aleatorio() < 0.35,
        grande
      };
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    lienzo.width = Math.round(W * dpr);
    lienzo.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    crear();
    if (reduce) pintar(0, 0);
  }

  function color(s, a) {
    return s.azul ? `rgba(70,165,255,${a})` : `rgba(205,228,255,${a})`;
  }

  
  function pintar(t, dt) {
    g.clearRect(0, 0, W, H);
    const sy = window.scrollY;

    for (const s of estrellas) {
      // Deriva lenta
      s.nx += (s.vx * dt) / W;
      s.ny += (s.vy * dt) / H;
      if (s.nx < 0) s.nx += 1; else if (s.nx > 1) s.nx -= 1;
      if (s.ny < 0) s.ny += 1; else if (s.ny > 1) s.ny -= 1;

      // Posición base con paralaje del mouse y del scroll
      let bx = s.nx * W - par.x * PARALAJE * s.z;
      let by = s.ny * H - par.y * PARALAJE * s.z - sy * 0.05 * s.z;
      bx = ((bx % W) + W) % W;
      by = ((by % H) + H) % H;

      // Se apartan del mouse y vuelven a su lugar
      const dx = bx + s.ox - raton.x;
      const dy = by + s.oy - raton.y;
      const d2 = dx * dx + dy * dy;
      let cerca = 0;
      if (d2 < RADIO * RADIO * 2.56) {
        const d = Math.sqrt(d2) || 1;
        cerca = 1 - d / (RADIO * 1.6);
        if (d < RADIO) {
          const f = 1 - d / RADIO;
          const fuerza = f * f * EMPUJE * (0.4 + s.z * 0.6);
          s.vox += (dx / d) * fuerza * dt;
          s.voy += (dy / d) * fuerza * dt;
        }
      }
      s.vox += -s.ox * 14 * dt;
      s.voy += -s.oy * 14 * dt;
      const amort = Math.exp(-4 * dt);
      s.vox *= amort;
      s.voy *= amort;
      s.ox += s.vox * dt;
      s.oy += s.voy * dt;

      
      let a = s.a * (0.7 + 0.3 * Math.sin((t / 1000) * s.vel + s.fase));
      if (cerca > 0) a = Math.min(1, a * (1 + cerca * 0.8));

      const x = bx + s.ox, y = by + s.oy;
      if (s.grande) {
        g.fillStyle = color(s, a * 0.14);
        g.beginPath();
        g.arc(x, y, s.r * 4, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = color(s, a);
      if (s.r > 1) {
        g.beginPath();
        g.arc(x, y, s.r, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
      }
    }
  }

  
  window.addEventListener("pointermove", (e) => {
    raton.x = e.clientX;
    raton.y = e.clientY;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { raton.x = raton.y = -9999; });
  window.addEventListener("blur", () => { raton.x = raton.y = -9999; });
  window.addEventListener("resize", resize);

  
  resize();
  if (reduce) return;   // sin animación: estrellas fijas

  let anterior = performance.now();
  function bucle(t) {
    const dt = Math.min(0.05, (t - anterior) / 1000);
    anterior = t;

    // Paralaje suave según la posición del mouse
    const objX = raton.x > -9000 ? raton.x / W - 0.5 : 0;
    const objY = raton.y > -9000 ? raton.y / H - 0.5 : 0;
    par.x += (objX - par.x) * 0.05;
    par.y += (objY - par.y) * 0.05;

    pintar(t, dt);
    requestAnimationFrame(bucle);
  }
  requestAnimationFrame(bucle);
})();



(() => {
  "use strict";

  const raiz = document.getElementById("explorador");
  const indice = document.querySelector(".indice");
  const cont = document.getElementById("tarjetas");
  const lienzo = document.getElementById("particulas");
  const buscar = document.getElementById("buscar");
  if (!raiz || !indice || !cont || !buscar) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

 
  const COLORES = [
    [45, 140, 255],   // azul
    [255, 60, 50],    // rojo
    [200, 225, 255],  // blanco azulado
    [255, 150, 45],   // anaranjado
    [45, 140, 255],
    [255, 150, 45],
    [200, 225, 255],
    [255, 60, 50],
    [45, 140, 255]
  ];

  const ORIGENES = ["izq", "fondo", "der", "fondo", "izq", "der", "fondo", "izq", "der"];
  const INICIO = 1.05;      // la tarjeta empieza a formarse cuando su centro está a esta altura (1 = borde inferior de la pantalla)
  const TRAMO = 0.3;        // cuánto scroll tarda cada tarjeta en formarse (fracción de la altura de la pantalla)
  const CADENCIA = 0.2;     // scroll máximo entre el inicio de una tarjeta y el de la siguiente (más alto = más separadas)
  const RETRASO_MAX = 0.3;  // lo máximo que una tarjeta puede esperar a las anteriores sin salirse de la pantalla
  const ESPACIO_FINAL = 0.3; // espacio extra al final (fracción de pantalla) para poder terminar la última tarjeta
  const SUAVIDAD = 4;       // más bajo = movimiento más lento y suave; más alto = más rápido
  const VUELO = 0.62;   // parte del proceso dedicada al vuelo; el resto es la transformación
  const COLA = 16;      // puntos de la estela

  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const salida = (u) => 1 - Math.pow(1 - u, 3);     // frena al llegar
  const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(404);

  
  function leerDatos() {
    return Array.from(indice.querySelectorAll(".entrada")).map((e) => {
      const a = e.querySelector("dt a");
      const dd = e.querySelector("dd");
      return {
        titulo: a.textContent.trim(),
        href: a.href,
        html: dd.innerHTML.trim(),
        texto: norm(a.textContent + " " + dd.textContent)
      };
    });
  }
  let datos = leerDatos();
  if (!datos.length) return;

  const etiquetaAbrir = () => {
    const t = window.IDIOMAS && window.IDIOMAS[document.documentElement.lang];
    return (t && t.abrir) || "Open this page";
  };

  
  let sucio = true;   // true = hay que volver a dibujar
  let calcularSecuencia = null;   // recalcula en qué punto del scroll aparece cada tarjeta

  const tarjetas = datos.map((d, i) => {
    const col = COLORES[i % COLORES.length];
    const el = document.createElement("article");
    el.className = "tarjeta";
    el.setAttribute("role", "listitem");
    el.style.setProperty("--ac", `rgb(${col[0]},${col[1]},${col[2]})`);

    const num = document.createElement("span");
    num.className = "tarjeta-num";
    num.setAttribute("aria-hidden", "true");
    num.textContent = String(i + 1).padStart(2, "0");
    const h = document.createElement("h3");
    const tx = document.createElement("div");
    tx.className = "tarjeta-texto";
    const ab = document.createElement("a");
    ab.className = "abrir";
    ab.target = "_blank";
    ab.rel = "noopener";

    el.append(num, h, tx, ab);
    cont.appendChild(el);
    return {
      el, h, tx, ab, col,
      tipo: ORIGENES[i % ORIGENES.length],
      rx: rnd(), ry: rnd(),
      curva: rnd() < 0.5 ? -1 : 1,
      qs: 0, ult: -1
    };
  });

  function rellenar() {
    const etiqueta = etiquetaAbrir();
    datos.forEach((d, i) => {
      const t = tarjetas[i];
      t.h.textContent = d.titulo;
      t.tx.innerHTML = d.html;
      t.ab.href = d.href;
      t.ab.textContent = etiqueta;
    });
  }

  
  const formBuscar = buscar.closest("form");
  const lista = document.getElementById("sugerencias");
  const aviso = document.getElementById("buscar-aviso");
  if (!formBuscar || !lista) return;

  // Palabras clave (en varios idiomas) para los atajos
  const CLAVES_NAV = {
    inicio: ["inicio", "home", "start", "principio", "comienzo", "inicial", "arriba", "top", "portada", "inicio de la pagina",
             "início", "topo", "accueil", "debut", "haut", "anfang", "startseite", "oben"],
    proyecto: ["proyecto", "project", "projeto", "projet", "projekt", "www", "w3", "world wide web", "que es", "what is",
               "descripcion", "description", "resumen", "summary"],
    acerca: ["reimagined", "reimaginada", "reimaginado", "reinventado", "reinventada", "réinventé", "neu gedacht", "acerca", "about", "sobre", "sobre o site", "à propos", "über", "world wide web reimagined"],
    explorar: ["explorar", "explore", "explorer", "entdecken", "contenido", "contenidos", "content", "secciones", "sections",
               "indice", "index", "lista", "tarjetas", "cards"]
  };
  
  const CLAVES_TARJETAS = [
    // 1. ¿Qué hay ahí fuera?
    ["fuera", "ahí fuera", "out there", "what's out there", "temas", "subjects", "topics", "assuntos", "sujets", "themen",
     "servidores w3", "w3 servers", "datos", "fuentes de datos", "datasources", "data sources", "internet", "enlaces", "links", "liens",
     "pointers", "información", "information", "informação", "informations", "en línea", "online", "mundo", "world", "directorio",
     "directory", "catálogo", "catalog", "páginas", "pages", "sitios", "sites", "sitios web", "websites", "gopher", "wais", "usenet",
     "noticias", "news", "bases de datos", "databases", "recursos", "resources", "ressources", "ressourcen", "buscar información"],
    // 2. Ayuda
    ["ayuda", "help", "ajuda", "aide", "hilfe", "navegador", "browser", "navigateur", "navegador web", "soporte", "support", "suporte",
     "manual", "guía", "guide", "tutorial", "instrucciones", "instructions", "cómo usar", "how to use", "como usar", "comment utiliser",
     "faq", "preguntas frecuentes", "frequently asked questions", "perguntas frequentes", "foire aux questions", "häufige fragen",
     "problemas", "problems", "troubleshooting", "asistencia", "assistance"],
    // 3. Productos de software
    ["software", "productos", "products", "produtos", "produits", "softwareprodukte", "programas", "programs", "logiciels", "programme",
     "aplicaciones", "applications", "apps", "modo de línea", "line mode", "modo linha", "mode ligne", "zeilenmodus", "viola", "nextstep",
     "next", "x11", "robot", "robot de correo", "mail robot", "biblioteca", "library", "bibliothèque", "bibliothek", "libwww",
     "herramientas", "tools", "ferramentas", "outils", "werkzeuge", "servidores", "servers", "serveurs", "server", "demonio", "daemon",
     "httpd", "estado", "status", "componentes", "components", "unix", "mac", "windows", "sistema", "system", "editor", "cliente",
     "client", "versiones", "versions"],
    // 4. Técnico
    ["técnico", "technical", "technique", "technisches", "technik", "protocolos", "protocols", "protocoles", "protokolle", "formatos",
     "formats", "formate", "http", "html", "uri", "url", "udi", "sgml", "direccionamiento", "addressing", "especificaciones",
     "specifications", "especificación", "estándares", "standards", "normas", "detalles", "details", "détails", "internals",
     "funcionamiento", "arquitectura", "architecture", "hipertexto", "hypertext", "hypertexte", "cliente servidor", "client server",
     "mime"],
    // 5. Bibliografía
    ["bibliografía", "bibliography", "bibliographie", "literatur", "papel", "paper", "papier", "papers", "referencias", "references",
     "références", "verweise", "libros", "books", "livres", "bücher", "documentación", "documentation", "documentação", "dokumentation",
     "artículos", "articles", "artigos", "artikel", "publicaciones", "publications", "publicações", "veröffentlichungen", "informes",
     "reports", "relatórios", "rapports", "tesis", "thesis", "investigación", "research", "pesquisa", "recherche", "forschung",
     "citas", "citations", "lectura", "reading", "lecturas", "propuesta", "proposal", "manuales", "manuals"],
    // 6. Gente
    ["gente", "people", "pessoas", "personnes", "personen", "personas", "equipo", "team", "équipe", "autores", "authors", "auteurs",
     "autoren", "creadores", "creators", "fundadores", "founders", "colaboradores", "contributors", "contribuidores", "contributeurs",
     "mitwirkende", "tim berners-lee", "berners-lee", "tim", "robert cailliau", "cailliau", "nicola pellow", "pellow",
     "jean-françois groff", "groff", "bernd pollermann", "pollermann", "ari luotonen", "luotonen", "pei wei", "científicos",
     "scientists", "desarrolladores", "developers", "desenvolvedores", "développeurs", "entwickler", "contactos", "contacts",
     "kontakte", "quién", "who", "qui", "wer"],
    // 7. Historia
    ["historia", "history", "história", "historique", "histoire", "geschichte", "resumen", "pasado", "past", "passado", "passé",
     "vergangenheit", "orígenes", "origins", "origem", "origines", "ursprung", "cronología", "timeline", "chronology",
     "línea de tiempo", "linha do tempo", "chronologie", "zeitleiste", "1989", "1990", "1991", "1992", "1993", "propuesta",
     "proposal", "enquire", "nacimiento", "birth", "naissance", "geburt", "evolución", "evolution", "hitos", "milestones"],
    // 8. ¿Cómo puedo ayudar?
    ["ayudar", "how can i help", "como posso ajudar", "comment aider", "wie kann ich helfen", "contribuir", "contribute",
     "contribuer", "beitragen", "apoyar", "colaborar", "collaborate", "colaboração", "collaborer", "zusammenarbeiten", "apoyo",
     "voluntario", "volunteer", "voluntário", "bénévole", "freiwillig", "participar", "participate", "participer", "teilnehmen",
     "unirse", "join", "donar", "donate", "doar", "faire un don", "spenden", "mejorar", "improve", "melhorar", "améliorer",
     "verbessern", "ideas", "feedback", "comentarios", "sugerencias", "suggestions", "sugestões", "vorschläge",
     "reportar errores", "bugs", "report bugs", "errores", "portar", "porting", "probar", "testing"],
    // 9. Obtener código
    ["código", "code", "código fonte", "obtenir", "obtener", "download", "descargar", "baixar", "télécharger", "herunterladen",
     "ftp", "ftp anónimo", "anonymous ftp", "anónimo", "anonymous", "anônimo", "anonyme", "anonym", "fuente", "source",
     "source code", "código fuente", "fonte", "quellcode", "distribución", "distribution", "distribuição", "verteilung",
     "readme", "léame", "instalar", "install", "instalação", "installer", "installieren", "repositorio", "repository",
     "repositório", "dépôt", "archivo", "archive", "arquivo", "archiv", "paquete", "package", "pacote", "paquet", "paket",
     "clonar", "clone", "git", "github", "compilar", "compile", "build", "bajar"]
  ];

  const textoUI = (clave, defecto) => {
    const t = window.IDIOMAS && window.IDIOMAS[document.documentElement.lang];
    return (t && t[clave]) || defecto;
  };
  const comportamiento = reduce ? "auto" : "smooth";

  
  let fantasma = document.getElementById("buscar-fantasma");
  if (!fantasma) {
    fantasma = document.createElement("span");
    fantasma.id = "buscar-fantasma";
    fantasma.className = "buscar-fantasma";
    fantasma.setAttribute("aria-hidden", "true");
    fantasma.hidden = true;
    buscar.insertAdjacentElement("afterend", fantasma);
  }
  
  fantasma.setAttribute("aria-hidden", "true");

  function construirItems() {
    const nav = [
      { id: "inicio", etiqueta: textoUI("nav_inicio", "Home"), claves: CLAVES_NAV.inicio },
      { id: "proyecto", etiqueta: textoUI("nav_proyecto", "The project"), claves: CLAVES_NAV.proyecto },
      { id: "acerca", etiqueta: textoUI("nav_acerca", "World Wide Web Reimagined"), claves: CLAVES_NAV.acerca },
      { id: "explorar", etiqueta: textoUI("nav_explorar", "Explore"), claves: CLAVES_NAV.explorar }
    ].map((n) => ({ tipo: "nav", id: n.id, etiqueta: n.etiqueta, claves: n.claves, texto: "", clave: "" }));
    const cards = datos.map((d, i) => ({
      tipo: "tarjeta", i, etiqueta: d.titulo,
      claves: CLAVES_TARJETAS[i] || [],
      texto: d.texto, clave: ""
    }));
    return nav.concat(cards);
  }

  
  const limpiarEtiqueta = (s) => s.replace(/^[¿¡"'\s]+/, "").replace(/[?!]+$/, "");

  
  function coincidencias(q, items) {
    if (!q) return [];
    const res = [];
    for (const it of items) {
      const et = norm(limpiarEtiqueta(it.etiqueta));
      let punt = -1;
      it.clave = "";
      if (et.startsWith(q)) punt = 0;
      else if (et.includes(q)) punt = 1;
      else {
        const c = it.claves.find((k) => norm(k).includes(q));
        if (c) { punt = 2; it.clave = c; }
        else if (it.texto && it.texto.includes(q)) punt = 3;
      }
      if (punt >= 0) res.push({ it, punt });
    }
    res.sort((a, b) => a.punt - b.punt);
    return res.map((r) => r.it);
  }

  
  function predecir(valor, items) {
    const q = norm(valor);
    if (!valor.trim() || valor !== valor.replace(/^\s+/, "") || q.length !== valor.length) return null;
    const candidatas = [];
    items.forEach((it) => candidatas.push([it, it.etiqueta]));
    items.forEach((it) => it.claves.forEach((k) => candidatas.push([it, k])));
    for (const [it, texto] of candidatas) {
      const visible = limpiarEtiqueta(texto);
      const n = norm(visible);
      if (n.length !== visible.length) continue;
      if (n.length > q.length && n.startsWith(q)) return { it, resto: visible.slice(valor.length) };
    }
    return null;
  }

  const MAX_SUGERENCIAS = 3;   // máximo de opciones que se muestran
  let visibles = [];      // opciones mostradas, en el orden de la pantalla
  let activo = -1;        // opción marcada con el teclado
  let prediccion = null;  // { it, resto } de lo que se predice

  function pintarFantasma() {
    const v = buscar.value;
    const ok = prediccion && v &&
      document.activeElement === buscar &&
      buscar.selectionStart === v.length && buscar.selectionEnd === v.length &&
      buscar.scrollWidth <= buscar.clientWidth;
    fantasma.textContent = "";
    fantasma.hidden = !ok;
    if (!ok) return;
    const a = document.createElement("span");   // lo escrito (invisible, solo ocupa el espacio)
    a.textContent = v;
    const b = document.createElement("b");     // lo que se predice
    b.textContent = prediccion.resto;
    fantasma.append(a, b);
  }

  function pintarLista(res) {
    visibles = res;
    activo = -1;
    buscar.removeAttribute("aria-activedescendant");
    lista.textContent = "";
    res.forEach((it, k) => {
      const li = document.createElement("li");
      li.className = "sug-item";
      li.id = "sug-" + k;
      li.dataset.k = String(k);
      li.setAttribute("role", "option");
      const punto = document.createElement("span");
      punto.className = "sug-punto";
      punto.setAttribute("aria-hidden", "true");
      if (it.tipo === "tarjeta") {
        const c = tarjetas[it.i].col;
        punto.style.setProperty("--c", `rgb(${c[0]},${c[1]},${c[2]})`);
      }
      const tx = document.createElement("span");
      tx.textContent = it.etiqueta;
      li.append(punto, tx);
      lista.appendChild(li);
    });
  }

  function cerrarLista() {
    lista.hidden = true;
    activo = -1;
    prediccion = null;
    pintarFantasma();
    buscar.setAttribute("aria-expanded", "false");
    buscar.removeAttribute("aria-activedescendant");
  }

 
  function actualizar() {
    const valor = buscar.value;
    if (!valor.trim()) {
      visibles = [];
      cerrarLista();
      return 0;
    }
    const items = construirItems();
    let res = coincidencias(norm(valor.trim()), items);
    prediccion = predecir(valor, items);
    // La opción que se está prediciendo va primero; se muestran máximo 3
    if (prediccion) res = [prediccion.it].concat(res.filter((x) => x !== prediccion.it));
    res = res.slice(0, MAX_SUGERENCIAS);
    pintarLista(res);
    lista.hidden = visibles.length === 0;
    buscar.setAttribute("aria-expanded", visibles.length ? "true" : "false");
    pintarFantasma();
    return visibles.length;
  }

  function aceptarPrediccion() {
    if (fantasma.hidden || !prediccion) return false;
    buscar.value += prediccion.resto;
    actualizar();
    return true;
  }

  function marcar(k) {
    const items = lista.querySelectorAll(".sug-item");
    items.forEach((li, n) => li.classList.toggle("activo", n === k));
    activo = k;
    if (items[k]) {
      buscar.setAttribute("aria-activedescendant", items[k].id);
      items[k].scrollIntoView({ block: "nearest" });
    }
  }

  
  function vibrar() {
    formBuscar.classList.remove("vibra");
    void formBuscar.offsetWidth;
    formBuscar.classList.add("vibra");
  }
  formBuscar.addEventListener("animationend", (e) => {
    if (e.target === formBuscar) formBuscar.classList.remove("vibra");
  });
  function sinResultados(si, vibra) {
    formBuscar.classList.toggle("sin", si);
    aviso.textContent = si ? textoUI("sinres", "No results. Try a different word.") : "";
    if (si && vibra) vibrar();
  }

  
  const yDe = (el) => el.getBoundingClientRect().top + window.scrollY;

  function cerrarMenuMovil() {
    const m = document.getElementById("menu");
    if (m && m.classList.contains("show") && window.bootstrap && window.bootstrap.Collapse) {
      window.bootstrap.Collapse.getOrCreateInstance(m).hide();
    }
  }

  function irA(it) {
    if (it.tipo === "nav") {
      if (it.id === "inicio") {
        window.scrollTo({ top: 0, behavior: comportamiento });
        return;
      }
      const sec = document.getElementById(it.id);
      if (!sec) return;
      let top = yDe(sec);
      if (it.id === "proyecto") top += Math.max(0, sec.offsetHeight - window.innerHeight) * 0.55;  // texto ya visible
      else if (it.id === "acerca") top += parseFloat(sec.dataset.destino || "0");                  // hasta el título
      else top -= 16;
      window.scrollTo({ top: Math.max(0, top), behavior: comportamiento });
      return;
    }
    const t = tarjetas[it.i];
    const r = t.el.getBoundingClientRect();
    let top = r.top + window.scrollY - (window.innerHeight - r.height) / 2;
    if (t.y0 !== undefined) top = Math.max(top, t.y0 + t.dur);   // que la tarjeta ya esté formada al llegar
    window.scrollTo({ top: Math.max(0, top), behavior: comportamiento });
    
    let intentos = 0;
    const resaltar = () => {
      if (t.qs !== undefined && t.qs < 0.97 && intentos++ < 40) { setTimeout(resaltar, 150); return; }
      t.el.classList.remove("destacada");
      void t.el.offsetWidth;
      t.el.classList.add("destacada");
      setTimeout(() => t.el.classList.remove("destacada"), 2600);
    };
    setTimeout(resaltar, reduce ? 0 : 700);
  }

  function elegir(k) {
    const it = visibles[k];
    if (!it) return;
    buscar.value = "";
    sinResultados(false);
    cerrarLista();
    buscar.blur();
    cerrarMenuMovil();
    irA(it);
  }

  buscar.setAttribute("role", "combobox");
  buscar.setAttribute("aria-autocomplete", "list");
  buscar.setAttribute("aria-controls", "sugerencias");
  buscar.setAttribute("aria-expanded", "false");


  buscar.addEventListener("input", () => {
    const n = actualizar();
    sinResultados(buscar.value.trim() !== "" && n === 0, true);
  });
  buscar.addEventListener("focus", () => { if (buscar.value.trim()) actualizar(); });
  buscar.addEventListener("click", () => { if (buscar.value.trim()) { if (lista.hidden) actualizar(); else pintarFantasma(); } });
  buscar.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") pintarFantasma();
  });

  buscar.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!buscar.value.trim()) return;
      if (lista.hidden) actualizar();
      if (!visibles.length) return;
      const d = e.key === "ArrowDown" ? 1 : -1;
      marcar(activo < 0 ? (d > 0 ? 0 : visibles.length - 1) : (activo + d + visibles.length) % visibles.length);
    } else if ((e.key === "Tab" && !e.shiftKey) || e.key === "ArrowRight") {
      // Tab o flecha derecha aceptan la predicción
      if (aceptarPrediccion()) e.preventDefault();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!buscar.value.trim()) return;
      if (!visibles.length) { sinResultados(true, true); return; }
      let k = activo;
      if (k < 0 && prediccion) k = visibles.indexOf(prediccion.it);
      elegir(k >= 0 ? k : 0);
    } else if (e.key === "Escape") {
      cerrarLista();
    }
  });

  formBuscar.addEventListener("submit", (e) => e.preventDefault());
  formBuscar.addEventListener("focusout", (e) => {
    if (!formBuscar.contains(e.relatedTarget)) cerrarLista();
  });
  lista.addEventListener("mousedown", (e) => e.preventDefault());   // no pierde el foco al hacer clic
  lista.addEventListener("click", (e) => {
    const li = e.target.closest(".sug-item");
    if (li) elegir(Number(li.dataset.k));
  });

  tarjetas.forEach((t) => {
    t.el.addEventListener("animationend", (e) => {
      if (e.animationName === "destaca") t.el.classList.remove("destacada");
    });
  });

  
  document.addEventListener("idioma-cambiado", () => {
    datos = leerDatos();
    rellenar();
    if (calcularSecuencia) requestAnimationFrame(calcularSecuencia);
    if (buscar.value.trim()) actualizar();
    if (formBuscar.classList.contains("sin")) aviso.textContent = textoUI("sinres", "");
  });

  indice.hidden = true;     // oculta la lista simple (queda como respaldo sin JS)
  raiz.hidden = false;
  formBuscar.hidden = false;
  rellenar();

  // Sin animación (o sin canvas): las tarjetas se ven directamente
  if (reduce || !lienzo) return;

  /* ---------- Canvas ---------- */
  const g = lienzo.getContext("2d");
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    lienzo.width = Math.round(W * dpr);
    lienzo.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    calcular();
  }

  const rampa = document.createElement("div");
  rampa.setAttribute("aria-hidden", "true");
  raiz.insertAdjacentElement("afterend", rampa);

  function calcular() {
    const sy = window.scrollY;
    rampa.style.height = "0px";
    const lista = tarjetas.filter((t) => !t.el.hidden);
    if (!lista.length) return;

    // Cuándo entraría cada tarjeta por su posición en la página
    const nat = lista.map((t) => {
      const r = t.el.getBoundingClientRect();
      return r.top + sy + r.height / 2 - (t.dy || 0) - H * INICIO;
    });

    // Cadencia: lo más separadas posible sin que una tarjeta espere de más
    let c = H * CADENCIA;
    for (let i = 1; i < lista.length; i++) c = Math.min(c, (nat[i] - nat[0] + H * RETRASO_MAX) / i);
    c = Math.max(c, H * 0.04);

    const dur = H * TRAMO;
    const ini = lista.map((_, i) => Math.max(nat[i], nat[0] + i * c));

    // Espacio extra al final para poder llegar a la última tarjeta
    const maxNatural = document.documentElement.scrollHeight - H;
    const fin = Math.max.apply(null, ini) + dur;
    const extra = Math.min(H * ESPACIO_FINAL, Math.max(0, fin - maxNatural));
    rampa.style.height = (extra > 0 ? Math.ceil(extra) : 0) + "px";
    const maxScroll = maxNatural + extra;

    lista.forEach((t, i) => {
      const minimo = H * 0.08;
      t.y0 = Math.min(ini[i], maxScroll - minimo);
      t.dur = Math.max(minimo, Math.min(dur, maxScroll - t.y0));   // si no alcanza el scroll, se acorta
    });
    if (Math.abs(window.scrollY - sy) > 1) window.scrollTo({ top: sy, behavior: "instant" });
    sucio = true;
  }
  calcularSecuencia = calcular;

  function brillo(x, y, r, alpha, c) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
    gr.addColorStop(0.25, `rgba(${c[0]},${c[1]},${c[2]},${alpha * 0.6})`);
    gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const bez = (p0, c, p2, u) => {
    const k = 1 - u;
    return k * k * p0 + 2 * k * u * c + u * u * p2;
  };

  /* Dibuja la partícula de una tarjeta. q = progreso (0 a 1) */
  function dibujar(t, r, q) {
    const c = t.col;
    const tx = r.left + r.width / 2;
    const ty = r.top + r.height / 2;

    // Punto de partida: un lado de la pantalla o el fondo (pequeña y lejana)
    let x0, y0, s0 = 1;
    if (t.tipo === "izq") { x0 = -40; y0 = H * (0.15 + 0.7 * t.ry); }
    else if (t.tipo === "der") { x0 = W + 40; y0 = H * (0.15 + 0.7 * t.ry); }
    else { x0 = W * (0.3 + 0.4 * t.rx); y0 = H * (0.2 + 0.3 * t.ry); s0 = 0.12; }

    // Trayectoria curva (Bézier) hasta el centro de la tarjeta
    const dx = tx - x0, dy = ty - y0;
    const dist = Math.hypot(dx, dy) || 1;
    const off = t.curva * dist * (t.tipo === "fondo" ? 0.18 : 0.3);
    const cx = (x0 + tx) / 2 + (-dy / dist) * off;
    const cy = (y0 + ty) / 2 + (dx / dist) * off;

    const v = clamp(q / VUELO);                       // progreso del vuelo
    const b = clamp((q - VUELO) / 0.3);               // progreso de la transformación
    const aparece = t.tipo === "fondo" ? smooth(0, 0.25, v) : 1;

    
    if (b < 1) {
      for (let i = COLA; i >= 0; i--) {
        const vv = v - i * 0.02;
        if (vv < 0) continue;
        const u = salida(vv);
        const x = bez(x0, cx, tx, u), y = bez(y0, cy, ty, u);
        const sc = lerp(s0, 1, u);
        if (i === 0) {
          const hs = 1 + 1.2 * smooth(0, 0.35, b);
          const ha = aparece * (1 - smooth(0.25, 0.9, b));
          brillo(x, y, 26 * sc * hs, 0.8 * ha, c);
          g.fillStyle = `rgba(255,255,255,${0.95 * ha})`;
          g.beginPath();
          g.arc(x, y, 2.6 * sc * (1 - 0.5 * b), 0, TAU);
          g.fill();
        } else {
          const f = 1 - i / COLA;
          g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${aparece * 0.5 * f * f})`;
          g.beginPath();
          g.arc(x, y, (0.8 + 3 * f) * sc, 0, TAU);
          g.fill();
        }
      }
    }

    
    if (b > 0 && b < 1) {
      const e = salida(b);
      const R = 8 + 0.55 * Math.hypot(r.width, r.height) * e;

      brillo(tx, ty, R * 1.1, (1 - b) * 0.45, c);

      g.lineWidth = 1 + (1 - b) * 2;
      g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(1 - b) * 0.75})`;
      g.beginPath();
      g.arc(tx, ty, R, 0, TAU);
      g.stroke();
      g.strokeStyle = `rgba(255,255,255,${(1 - b) * 0.45})`;
      g.beginPath();
      g.arc(tx, ty, R * 0.7, 0, TAU);
      g.stroke();

      g.lineWidth = 1.2;
      g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(1 - b) * 0.8})`;
      g.beginPath();
      const giro = t.rx * TAU;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU + giro;
        g.moveTo(tx + Math.cos(a) * R * 0.6, ty + Math.sin(a) * R * 0.6);
        g.lineTo(tx + Math.cos(a) * R, ty + Math.sin(a) * R);
      }
      g.stroke();

      const m = salida(clamp(b / 0.85));
      const w = r.width * m, hh = r.height * m;
      g.lineWidth = 1.5;
      g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.9 * (1 - smooth(0.6, 1, b))})`;
      g.strokeRect(tx - w / 2, ty - hh / 2, w, hh);
    }
  }

  
  function pintarTarjeta(t, q) {
    const o = smooth(0.6, 0.98, q);
    if (o === t.ult) return;
    t.ult = o;
    const s = t.el.style;
    t.dy = (1 - o) * 26;
    if (o >= 0.999) {
      s.opacity = ""; s.transform = ""; s.boxShadow = "";
      return;
    }
    const gl = Math.sin(o * Math.PI);
    s.opacity = o.toFixed(3);
    s.transform = `translate3d(0, ${t.dy.toFixed(2)}px, 0) scale(${(0.94 + 0.06 * o).toFixed(4)})`;
    s.boxShadow = gl > 0.01
      ? `0 0 ${(34 * gl).toFixed(1)}px rgba(${t.col[0]},${t.col[1]},${t.col[2]},${(0.45 * gl).toFixed(3)})`
      : "";
  }

  let primero = true;

  let tAnterior = 0;

  function fotograma(dt) {
    sucio = false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";

    const sy = window.scrollY;
    let movimiento = false;
    for (const t of tarjetas) {
      if (t.el.hidden) continue;
      const r = t.el.getBoundingClientRect();
      const q = t.y0 === undefined ? 1 : clamp((sy - t.y0) / t.dur);   // progreso según el scroll

      if (primero) t.qs = q;
      t.qs += (q - t.qs) * (1 - Math.exp(-dt * SUAVIDAD));   // suaviza el movimiento
      if (Math.abs(q - t.qs) < 0.0008) t.qs = q; else movimiento = true;

      pintarTarjeta(t, t.qs);
      if (t.qs > 0.002 && t.qs < 0.999) dibujar(t, r, t.qs);
    }
    g.globalCompositeOperation = "source-over";
    primero = false;
    if (movimiento) sucio = true;
  }

  function bucle(ahora) {
    const dt = Math.min(0.05, Math.max(0.001, (ahora - (tAnterior || ahora)) / 1000));
    tAnterior = ahora;
    if (sucio) fotograma(dt);
    requestAnimationFrame(bucle);
  }

  window.addEventListener("scroll", () => { sucio = true; }, { passive: true });
  window.addEventListener("resize", resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(calcular);
  if (window.ResizeObserver) new ResizeObserver(calcular).observe(cont);

  resize();
  requestAnimationFrame(bucle);
})();



(() => {
  "use strict";

  const IDIOMAS = ["es", "en", "pt", "fr", "de"];

  /* ---------- Direcciones de los enlaces (no cambian con el idioma) ---------- */
  const W = "http://info.cern.ch/hypertext/WWW/";
  const DS = "http://info.cern.ch/hypertext/DataSources/";
  const L = {
    que: W + "WhatIs.html",
    resumen: W + "Summary.html",
    listas: W + "Administration/Mailing/Overview.html",
    politica: W + "Policy.html",
    noticias: W + "News/9211.html",
    faq: W + "FAQ/List.html",
    temas: DS + "bySubject/Overview.html",
    servidoresW3: DS + "WWW/Servers.html",
    linea: W + "LineMode/Browser.html",
    viola: W + "Status.html#35",
    next: W + "NeXT/WorldWideWeb.html",
    servidores: W + "Daemon/Overview.html",
    herramientas: W + "Tools/Overview.html",
    robot: W + "MailRobot/Overview.html",
    biblioteca: W + "Status.html#57",
    ftp: W + "LineMode/Defaults/Distribution.html",
    cern: "http://info.cern.ch"
  };
  const a = (url, texto) => `<a href="${url}" target="_blank" rel="noopener">${texto}</a>`;

  /* ============================================================
     TEXTOS
     entradas: [título, descripción] en el mismo orden de la lista
     ============================================================ */
  const TEXTOS = {
    es: {
      titulo: "El proyecto World Wide Web",
      nav_proyecto: "El proyecto",
      seguir: "Sigue bajando",
      nav_acerca: "World Wide Web reinventada",
      nav_explorar: "Explorar",
      menu: "Abrir menú",
      nav_inicio: "Inicio",
      sug_ir: "Ir a",
      sug_contenido: "Contenido de Explorar",
      idioma: "Idioma",
      canvas: "Animación de dos haces de partículas que colisionan dentro de un acelerador",
      c1_p: "Baja para acercarte al acelerador",
      c2: "Dos haces de partículas giran en sentidos opuestos",
      c3: "Colisión",
      c4: "Del CERN nació la World Wide Web",
      acerca_titulo: "World Wide Web reinventada",
      acerca_p1: "Este sitio reimagina el proyecto original de la World Wide Web del CERN. La primera página Web era texto simple con unos pocos enlaces. Aquí, ese mismo contenido se convierte en un viaje interactivo por un acelerador de partículas. Baja para llegar al lugar donde nació la Web.",
      acerca_p2: "En 1989, Tim Berners-Lee propuso una idea sencilla en el CERN. Los científicos necesitaban compartir documentos entre computadoras distintas. Su solución enlazó las páginas mediante hipertexto. A finales de 1990 ya funcionaban el primer servidor Web y el primer navegador. Pronto, cualquiera pudo publicar información y leerla desde cualquier lugar.",
      acerca_p3: "El proyecto original tenía un objetivo claro. Buscaba dar acceso universal a un gran universo de documentos. También describía las herramientas necesarias para lograrlo. Entre ellas había un navegador en modo de línea, servidores y un robot de correo. Cada parte aparece en el índice de abajo.",
      acerca_p4: "En esta página puedes explorar el índice completo del proyecto original. Cada entrada enlaza con las primeras páginas Web alojadas en el CERN. Usa el buscador para encontrar un tema con rapidez. También puedes leer el contenido en cinco idiomas: inglés, español, portugués, francés y alemán.",
      doc_titulo: "World Wide Web reinventada | El proyecto Web original del CERN",
      lead: `${a(L.que, "La WorldWideWeb (W3C) es una iniciativa de recuperación de información hipermedia")} de área amplia que tiene como objetivo brindar acceso universal a un gran universo de documentos.`,
      sec: `Todo lo que hay en línea sobre W3 está vinculado directa o indirectamente a este documento, incluyendo un ${a(L.resumen, "resumen ejecutivo")} del proyecto, ${a(L.listas, "listas de correo")}, ${a(L.politica, "política")}, ${a(L.noticias, "noticias de W3")} de noviembre, ${a(L.faq, "preguntas frecuentes")}.`,
      buscar: "Buscar",
      lista: "Secciones del proyecto",
      sinres: "No hay resultados. Prueba con otra palabra.",
      abrir: "Abrir esta página",
      pie: `Contenido del proyecto original World Wide Web, alojado en ${a(L.cern, "info.cern.ch")}.`,
      pie_nav: "Navegar",
      pie_recursos: "Recursos",
      pie_orig: "Sitio original",
      pie_arriba: "Volver arriba",
      pie_credito: "Página creada por Yaron y Daniel",
      pie_reimagined: "Reinventada, hecha en COVAO",
      girar: "Arrastra para girar la esfera",
      entradas: [
        ["¿Qué hay ahí fuera?", `Enlaces a información en línea de todo el mundo, ${a(L.temas, "temas")}, ${a(L.servidoresW3, "servidores W3C")}, etc.`],
        ["Ayuda", "En el navegador que está utilizando"],
        ["Productos de software", `Lista de componentes del proyecto W3 y su estado actual (p. ej., ${a(L.linea, "Modo de línea")}, X11 ${a(L.viola, "Viola")}, ${a(L.next, "NeXTStep")}, ${a(L.servidores, "Servidores")}, ${a(L.herramientas, "Herramientas")}, ${a(L.robot, "Robot de correo")}, ${a(L.biblioteca, "Biblioteca")}).`],
        ["Técnico", "Detalles de protocolos, formatos, funcionamiento interno del programa, etc."],
        ["Bibliografía", "Documentación en papel sobre W3 y referencias."],
        ["Gente", "Lista de algunas de las personas involucradas en el proyecto."],
        ["Historia", "Un resumen de la historia del proyecto."],
        ["¿Cómo puedo ayudar?", "Si deseas apoyar la web..."],
        ["Obtener código", `Obtener el código mediante ${a(L.ftp, "FTP anónimo")}, etc.`]
      ]
    },

    en: {
      titulo: "The World Wide Web Project",
      nav_proyecto: "The project",
      seguir: "Keep scrolling",
      nav_acerca: "World Wide Web Reimagined",
      nav_explorar: "Explore",
      menu: "Open menu",
      nav_inicio: "Home",
      sug_ir: "Go to",
      sug_contenido: "Explore content",
      idioma: "Language",
      canvas: "Animation of two particle beams colliding inside an accelerator",
      c1_p: "Scroll down to get closer to the accelerator",
      c2: "Two particle beams circle in opposite directions",
      c3: "Collision",
      c4: "The World Wide Web was born at CERN",
      acerca_titulo: "World Wide Web Reimagined",
      acerca_p1: "This site reimagines CERN's original World Wide Web project. The first Web page was plain text with a few links. Here, that same content becomes an interactive journey through a particle accelerator. Scroll down to reach the place where the Web was born.",
      acerca_p2: "In 1989, Tim Berners-Lee proposed a simple idea at CERN. Scientists needed a way to share documents across different computers. His solution linked pages together with hypertext. By the end of 1990, the first Web server and browser were running. Soon, anyone could publish information and read it from anywhere.",
      acerca_p3: "The original project had a clear goal. It aimed to give universal access to a large universe of documents. It also described the tools needed to reach that goal. These included a line mode browser, servers and a mail robot. Each part is listed in the index below.",
      acerca_p4: "You can explore the full index of the original project on this page. Each entry links to the first Web pages hosted at CERN. Use the search box to find a topic quickly. You can also read the content in five languages: English, Spanish, Portuguese, French and German.",
      doc_titulo: "World Wide Web reimagined | CERN's Original Web Project",
      lead: `${a(L.que, "The WorldWideWeb (W3) is a wide-area hypermedia information retrieval initiative")} aiming to give universal access to a large universe of documents.`,
      sec: `Everything there is online about W3 is linked directly or indirectly to this document, including an ${a(L.resumen, "executive summary")} of the project, ${a(L.listas, "mailing lists")}, ${a(L.politica, "policy")}, November's ${a(L.noticias, "W3 news")}, ${a(L.faq, "frequently asked questions")}.`,
      buscar: "Search",
      lista: "Project sections",
      sinres: "No results. Try a different word.",
      abrir: "Open this page",
      pie: `Content from the original World Wide Web project, hosted at ${a(L.cern, "info.cern.ch")}.`,
      pie_nav: "Navigate",
      pie_recursos: "Resources",
      pie_orig: "Original site",
      pie_arriba: "Back to top",
      pie_credito: "Page created by Yaron and Daniel",
      pie_reimagined: "Reimagined, made in COVAO",
      girar: "Drag to rotate the sphere",
      entradas: [
        ["What's out there?", `Pointers to the world's online information, ${a(L.temas, "subjects")}, ${a(L.servidoresW3, "W3 servers")}, etc.`],
        ["Help", "On the browser you are using"],
        ["Software products", `A list of W3 project components and their current state (e.g. ${a(L.linea, "Line Mode")}, X11 ${a(L.viola, "Viola")}, ${a(L.next, "NeXTStep")}, ${a(L.servidores, "Servers")}, ${a(L.herramientas, "Tools")}, ${a(L.robot, "Mail robot")}, ${a(L.biblioteca, "Library")}).`],
        ["Technical", "Details of protocols, formats, program internals, etc."],
        ["Bibliography", "Paper documentation on W3 and references."],
        ["People", "A list of some of the people involved in the project."],
        ["History", "A summary of the history of the project."],
        ["How can I help?", "If you would like to support the web..."],
        ["Getting code", `Getting the code by ${a(L.ftp, "anonymous FTP")}, etc.`]
      ]
    },

    pt: {
      titulo: "O projeto World Wide Web",
      nav_proyecto: "O projeto",
      seguir: "Continue rolando",
      nav_acerca: "World Wide Web reinventada",
      nav_explorar: "Explorar",
      menu: "Abrir menu",
      nav_inicio: "Início",
      sug_ir: "Ir para",
      sug_contenido: "Conteúdo de Explorar",
      idioma: "Idioma",
      canvas: "Animação de dois feixes de partículas colidindo dentro de um acelerador",
      c1_p: "Role para baixo para se aproximar do acelerador",
      c2: "Dois feixes de partículas giram em sentidos opostos",
      c3: "Colisão",
      c4: "A World Wide Web nasceu no CERN",
      acerca_titulo: "World Wide Web reinventada",
      acerca_p1: "Este site reimagina o projeto original da World Wide Web do CERN. A primeira página Web era texto simples com poucos links. Aqui, esse mesmo conteúdo vira uma viagem interativa por um acelerador de partículas. Role a página para chegar ao lugar onde a Web nasceu.",
      acerca_p2: "Em 1989, Tim Berners-Lee propôs uma ideia simples no CERN. Os cientistas precisavam compartilhar documentos entre computadores diferentes. A solução dele ligou as páginas por meio de hipertexto. No fim de 1990, o primeiro servidor Web e o primeiro navegador já funcionavam. Logo, qualquer pessoa podia publicar informações e lê-las de qualquer lugar.",
      acerca_p3: "O projeto original tinha um objetivo claro. Queria dar acesso universal a um grande universo de documentos. Também descrevia as ferramentas necessárias para isso. Entre elas estavam um navegador em modo de linha, servidores e um robô de e-mail. Cada parte aparece no índice abaixo.",
      acerca_p4: "Nesta página, você pode explorar o índice completo do projeto original. Cada item leva às primeiras páginas Web hospedadas no CERN. Use a busca para encontrar um tema rapidamente. Você também pode ler o conteúdo em cinco idiomas: inglês, espanhol, português, francês e alemão.",
      doc_titulo: "World Wide Web reinventada | O projeto Web original do CERN",
      lead: `${a(L.que, "A WorldWideWeb (W3) é uma iniciativa de recuperação de informações em hipermídia")} de longo alcance, que tem como objetivo dar acesso universal a um grande universo de documentos.`,
      sec: `Tudo o que existe online sobre a W3 está ligado, direta ou indiretamente, a este documento, incluindo um ${a(L.resumen, "resumo executivo")} do projeto, ${a(L.listas, "listas de e-mail")}, ${a(L.politica, "política")}, as ${a(L.noticias, "notícias da W3")} de novembro e ${a(L.faq, "perguntas frequentes")}.`,
      buscar: "Pesquisar",
      lista: "Seções do projeto",
      sinres: "Nenhum resultado. Tente outra palavra.",
      abrir: "Abrir esta página",
      pie: `Conteúdo do projeto original World Wide Web, hospedado em ${a(L.cern, "info.cern.ch")}.`,
      pie_nav: "Navegar",
      pie_recursos: "Recursos",
      pie_orig: "Site original",
      pie_arriba: "Voltar ao topo",
      pie_credito: "Página criada por Yaron e Daniel",
      pie_reimagined: "Reinventada, feita em COVAO",
      girar: "Arraste para girar a esfera",
      entradas: [
        ["O que há lá fora?", `Links para informações online de todo o mundo, ${a(L.temas, "assuntos")}, ${a(L.servidoresW3, "servidores W3")}, etc.`],
        ["Ajuda", "No navegador que você está usando"],
        ["Produtos de software", `Lista de componentes do projeto W3 e seu estado atual (p. ex., ${a(L.linea, "Modo de linha")}, X11 ${a(L.viola, "Viola")}, ${a(L.next, "NeXTStep")}, ${a(L.servidores, "Servidores")}, ${a(L.herramientas, "Ferramentas")}, ${a(L.robot, "Robô de e-mail")}, ${a(L.biblioteca, "Biblioteca")}).`],
        ["Técnico", "Detalhes de protocolos, formatos, funcionamento interno do programa, etc."],
        ["Bibliografia", "Documentação em papel sobre a W3 e referências."],
        ["Pessoas", "Lista de algumas das pessoas envolvidas no projeto."],
        ["História", "Um resumo da história do projeto."],
        ["Como posso ajudar?", "Se você quiser apoiar a web..."],
        ["Obter o código", `Obter o código por ${a(L.ftp, "FTP anônimo")}, etc.`]
      ]
    },

    fr: {
      titulo: "Le projet World Wide Web",
      nav_proyecto: "Le projet",
      seguir: "Continuez à défiler",
      nav_acerca: "World Wide Web réinventé",
      nav_explorar: "Explorer",
      menu: "Ouvrir le menu",
      nav_inicio: "Accueil",
      sug_ir: "Aller à",
      sug_contenido: "Contenu d'Explorer",
      idioma: "Langue",
      canvas: "Animation de deux faisceaux de particules entrant en collision dans un accélérateur",
      c1_p: "Faites défiler pour vous approcher de l'accélérateur",
      c2: "Deux faisceaux de particules tournent en sens opposés",
      c3: "Collision",
      c4: "Le World Wide Web est né au CERN",
      acerca_titulo: "World Wide Web réinventé",
      acerca_p1: "Ce site réinvente le projet World Wide Web original du CERN. La première page Web était du texte simple avec quelques liens. Ici, ce même contenu devient un voyage interactif dans un accélérateur de particules. Faites défiler pour atteindre le lieu où le Web est né.",
      acerca_p2: "En 1989, Tim Berners-Lee a proposé une idée simple au CERN. Les scientifiques avaient besoin de partager des documents entre ordinateurs différents. Sa solution reliait les pages grâce à l'hypertexte. Fin 1990, le premier serveur Web et le premier navigateur fonctionnaient. Bientôt, chacun pouvait publier des informations et les lire de n'importe où.",
      acerca_p3: "Le projet original avait un objectif clair. Il visait à offrir un accès universel à un vaste univers de documents. Il décrivait aussi les outils nécessaires pour y parvenir. Parmi eux figuraient un navigateur en mode ligne, des serveurs et un robot de messagerie. Chaque élément est listé dans l'index ci-dessous.",
      acerca_p4: "Sur cette page, vous pouvez explorer l'index complet du projet original. Chaque entrée renvoie aux premières pages Web hébergées au CERN. Utilisez la recherche pour trouver rapidement un sujet. Vous pouvez aussi lire le contenu en cinq langues : anglais, espagnol, portugais, français et allemand.",
      doc_titulo: "World Wide Web réinventé | Le projet Web original du CERN",
      lead: `${a(L.que, "Le WorldWideWeb (W3) est une initiative de recherche d'information hypermédia")} à grande échelle, qui vise à offrir un accès universel à un vaste univers de documents.`,
      sec: `Tout ce qui existe en ligne sur W3 est lié, directement ou indirectement, à ce document, y compris un ${a(L.resumen, "résumé exécutif")} du projet, des ${a(L.listas, "listes de diffusion")}, la ${a(L.politica, "politique")}, les ${a(L.noticias, "actualités W3")} de novembre et la ${a(L.faq, "foire aux questions")}.`,
      buscar: "Rechercher",
      lista: "Sections du projet",
      sinres: "Aucun résultat. Essayez un autre mot.",
      abrir: "Ouvrir cette page",
      pie: `Contenu du projet original World Wide Web, hébergé sur ${a(L.cern, "info.cern.ch")}.`,
      pie_nav: "Naviguer",
      pie_recursos: "Ressources",
      pie_orig: "Site original",
      pie_arriba: "Retour en haut",
      pie_credito: "Page créée par Yaron et Daniel",
      pie_reimagined: "Réinventé, fait chez COVAO",
      girar: "Faites glisser pour tourner la sphère",
      entradas: [
        ["Qu'y a-t-il là-bas ?", `Accès aux informations en ligne du monde entier, ${a(L.temas, "sujets")}, ${a(L.servidoresW3, "serveurs W3")}, etc.`],
        ["Aide", "Sur le navigateur que vous utilisez"],
        ["Produits logiciels", `Liste des composants du projet W3 et de leur état actuel (p. ex., ${a(L.linea, "Mode ligne")}, X11 ${a(L.viola, "Viola")}, ${a(L.next, "NeXTStep")}, ${a(L.servidores, "Serveurs")}, ${a(L.herramientas, "Outils")}, ${a(L.robot, "Robot de messagerie")}, ${a(L.biblioteca, "Bibliothèque")}).`],
        ["Technique", "Détails des protocoles, des formats, du fonctionnement interne du programme, etc."],
        ["Bibliographie", "Documentation papier sur W3 et références."],
        ["Personnes", "Liste de certaines des personnes impliquées dans le projet."],
        ["Historique", "Un résumé de l'histoire du projet."],
        ["Comment puis-je aider ?", "Si vous souhaitez soutenir le web..."],
        ["Obtenir le code", `Obtenir le code par ${a(L.ftp, "FTP anonyme")}, etc.`]
      ]
    },

    de: {
      titulo: "Das World-Wide-Web-Projekt",
      nav_proyecto: "Das Projekt",
      seguir: "Weiter scrollen",
      nav_acerca: "World Wide Web neu gedacht",
      nav_explorar: "Entdecken",
      menu: "Menü öffnen",
      nav_inicio: "Start",
      sug_ir: "Gehe zu",
      sug_contenido: "Inhalte von Entdecken",
      idioma: "Sprache",
      canvas: "Animation zweier Teilchenstrahlen, die in einem Beschleuniger kollidieren",
      c1_p: "Scrolle nach unten, um dich dem Beschleuniger zu nähern",
      c2: "Zwei Teilchenstrahlen kreisen in entgegengesetzte Richtungen",
      c3: "Kollision",
      c4: "Das World Wide Web wurde am CERN geboren",
      acerca_titulo: "World Wide Web neu gedacht",
      acerca_p1: "Diese Website denkt das ursprüngliche World-Wide-Web-Projekt des CERN neu. Die erste Webseite bestand aus einfachem Text mit wenigen Links. Hier wird derselbe Inhalt zu einer interaktiven Reise durch einen Teilchenbeschleuniger. Scrolle nach unten, um den Ort zu erreichen, an dem das Web entstand.",
      acerca_p2: "Im Jahr 1989 schlug Tim Berners-Lee am CERN eine einfache Idee vor. Forschende brauchten eine Möglichkeit, Dokumente zwischen verschiedenen Computern zu teilen. Seine Lösung verknüpfte Seiten per Hypertext. Ende 1990 liefen der erste Webserver und der erste Browser. Bald konnte jeder Informationen veröffentlichen und von überall lesen.",
      acerca_p3: "Das ursprüngliche Projekt hatte ein klares Ziel. Es wollte universellen Zugang zu einem großen Universum von Dokumenten bieten. Außerdem beschrieb es die dafür nötigen Werkzeuge. Dazu gehörten ein Zeilenmodus-Browser, Server und ein Mail-Roboter. Jeder Teil steht im Index weiter unten.",
      acerca_p4: "Auf dieser Seite kannst du den vollständigen Index des ursprünglichen Projekts erkunden. Jeder Eintrag führt zu den ersten Webseiten am CERN. Nutze die Suche, um schnell ein Thema zu finden. Du kannst den Inhalt auch in fünf Sprachen lesen: Englisch, Spanisch, Portugiesisch, Französisch und Deutsch.",
      doc_titulo: "World Wide Web neu gedacht | Das ursprüngliche Web-Projekt des CERN",
      lead: `${a(L.que, "Das WorldWideWeb (W3) ist eine weiträumige Initiative zum Abruf von Hypermedia-Informationen")} mit dem Ziel, einen universellen Zugang zu einem großen Universum von Dokumenten zu bieten.`,
      sec: `Alles, was es online über W3 gibt, ist direkt oder indirekt mit diesem Dokument verknüpft, darunter eine ${a(L.resumen, "Zusammenfassung")} des Projekts, ${a(L.listas, "Mailinglisten")}, ${a(L.politica, "Richtlinien")}, die ${a(L.noticias, "W3-Neuigkeiten")} vom November und ${a(L.faq, "häufig gestellte Fragen")}.`,
      buscar: "Suchen",
      lista: "Abschnitte des Projekts",
      sinres: "Keine Ergebnisse. Versuche ein anderes Wort.",
      abrir: "Diese Seite öffnen",
      pie: `Inhalt des ursprünglichen World-Wide-Web-Projekts, gehostet auf ${a(L.cern, "info.cern.ch")}.`,
      pie_nav: "Navigation",
      pie_recursos: "Ressourcen",
      pie_orig: "Originalseite",
      pie_arriba: "Nach oben",
      pie_credito: "Seite erstellt von Yaron und Daniel",
      pie_reimagined: "Neu interpretiert, gemacht in COVAO",
      girar: "Ziehen, um die Kugel zu drehen",
      entradas: [
        ["Was gibt es da draußen?", `Verweise auf Online-Informationen aus der ganzen Welt, ${a(L.temas, "Themen")}, ${a(L.servidoresW3, "W3-Server")}, usw.`],
        ["Hilfe", "Zum verwendeten Browser"],
        ["Softwareprodukte", `Eine Liste der W3-Projektkomponenten und ihres aktuellen Stands (z. B. ${a(L.linea, "Zeilenmodus")}, X11 ${a(L.viola, "Viola")}, ${a(L.next, "NeXTStep")}, ${a(L.servidores, "Server")}, ${a(L.herramientas, "Werkzeuge")}, ${a(L.robot, "Mail-Roboter")}, ${a(L.biblioteca, "Bibliothek")}).`],
        ["Technisches", "Details zu Protokollen, Formaten, Programminterna usw."],
        ["Literatur", "Gedruckte Dokumentation zu W3 und Verweise."],
        ["Personen", "Eine Liste einiger am Projekt beteiligter Personen."],
        ["Geschichte", "Eine Zusammenfassung der Geschichte des Projekts."],
        ["Wie kann ich helfen?", "Wenn du das Web unterstützen möchtest ..."],
        ["Code erhalten", `Den Code per ${a(L.ftp, "anonymem FTP")} erhalten, usw.`]
      ]
    }
  };

  window.IDIOMAS = TEXTOS;   

  /* ---------- Aplicar un idioma ---------- */
  const boton = document.getElementById("idioma-actual");
  const opciones = document.querySelectorAll("[data-lang]");

  function aplicar(lang, guardar) {
    const t = TEXTOS[lang];
    if (!t) return;

    document.documentElement.lang = lang;
    document.title = t.doc_titulo || t.titulo;

    document.querySelectorAll("[data-i18n]").forEach((e) => { e.textContent = t[e.dataset.i18n]; });
    document.querySelectorAll("[data-i18n-html]").forEach((e) => { e.innerHTML = t[e.dataset.i18nHtml]; });
    document.querySelectorAll("[data-i18n-aria]").forEach((e) => { e.setAttribute("aria-label", t[e.dataset.i18nAria]); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((e) => { e.setAttribute("placeholder", t[e.dataset.i18nPlaceholder]); });

    
    document.querySelectorAll(".indice .entrada").forEach((entrada, i) => {
      const par = t.entradas[i];
      if (!par) return;
      entrada.querySelector("dt a").textContent = par[0];
      entrada.querySelector("dd").innerHTML = par[1];
    });

    
    if (boton) boton.textContent = lang.toUpperCase();
    const bandera = document.querySelector("#idioma-bandera use");
    if (bandera) bandera.setAttribute("href", "#bandera-" + lang);
    opciones.forEach((o) => {
      if (o.dataset.lang === lang) o.setAttribute("aria-current", "true");
      else o.removeAttribute("aria-current");
    });

    if (guardar) {
      try { localStorage.setItem("idioma", lang); } catch (e) { /* sin almacenamiento */ }
    }

    
    document.dispatchEvent(new CustomEvent("idioma-cambiado", { detail: { lang } }));
  }

  function inicial() {
    return "en";   
  }

  opciones.forEach((o) => o.addEventListener("click", () => aplicar(o.dataset.lang, true)));

  aplicar(inicial(), false);
})();



(() => {
  const boton = document.getElementById("pie-arriba");
  if (!boton) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  boton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
})();


(function () {
  const menu = document.getElementById("menu");
  if (!menu) return;
  menu.querySelectorAll('a.nav-link[href^="#"]').forEach((enlace) => {
    enlace.addEventListener("click", () => {
      if (menu.classList.contains("show") && window.bootstrap && window.bootstrap.Collapse) {
        window.bootstrap.Collapse.getOrCreateInstance(menu).hide();
      }
    });
  });
})();

/* ============================================================
   Aviso "sigue bajando"
   Si el usuario deja de hacer scroll unos segundos, aparece una
   pequeña píldora con un anillo y dos partículas girando. Se oculta
   al volver a mover la página y también se puede tocar para bajar.
   ============================================================ */
(() => {
  "use strict";
  const aviso = document.getElementById("sigue");
  const boton = document.getElementById("sigue-boton");
  if (!aviso || !boton) return;

  const ESPERA = 1600;       // milisegundos sin scroll antes de mostrarlo
  const SALTO = 0.75;        // cuánto baja al tocarlo (fracción de la pantalla)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raiz = document.documentElement;
  let timer = 0;

  const enExtremo = () =>
    window.scrollY < 60 ||                                                   // arriba: ya hay una pista en la portada
    window.scrollY + window.innerHeight >= raiz.scrollHeight - 160;          // abajo: no queda nada por ver

  function ocultar() { aviso.classList.remove("visible"); }

  function programar() {
    clearTimeout(timer);
    ocultar();
    timer = setTimeout(() => {
      if (raiz.classList.contains("cargando-activo") || enExtremo()) return;
      aviso.classList.add("visible");
    }, ESPERA);
  }

  boton.addEventListener("click", () => {
    window.scrollBy({ top: window.innerHeight * SALTO, behavior: reduce ? "auto" : "smooth" });
  });

  window.addEventListener("scroll", programar, { passive: true });
  window.addEventListener("resize", programar);
  document.addEventListener("visibilitychange", programar);
  programar();
})();
