/* ═══════════════════════════════════════════════════════════════
   BIOTORTURS — Motor de experiencia (vanilla JS, sin dependencias)
   · Loader con progreso real            · Scroll con inercia (lerp)
   · Plancton interactivo en <canvas>    · Escenas "pinned" por scroll
   · Revelados, contadores, tilt, imán   · Lightbox, FAQ, formulario→WhatsApp
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── Utilidades ─────────────────────────────────────────────── */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const stackMQ = matchMedia('(min-width: 960px) and (min-height: 780px)');
  const body = document.body;

  const WA_NUMBER = '529541004939';
  const waLink = msg => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

  /** Escribe una variable CSS solo si cambió (evita recalcular estilos en cada frame). */
  const setVar = (el, k, v) => {
    const key = '_v' + k;
    if (el[key] !== v) { el[key] = v; el.style.setProperty(k, v); }
  };

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ── WhatsApp: cada CTA con mensaje prellenado ──────────────── */
  $$('a[data-wa]').forEach(a => { a.href = waLink(a.dataset.wa); });

  /* ═══════════════════════════════════════════════════════════════
     LOADER — progreso suavizado + estado real de la carga
     ═══════════════════════════════════════════════════════════════ */
  function initLoader(onDone) {
    const el = $('#loader'), num = $('#ldNum'), prog = $('#ldProg'), status = $('#ldStatus');
    if (!el) { onDone(); return; }

    const CIRC = 603.2;
    const MIN = reduced ? 350 : 2400;
    const msgs = [[0, 'Despertando al plancton'], [28, 'Encendiendo la laguna'], [55, 'Buscando tortugas'], [80, 'Calibrando la marea'], [96, 'Todo listo']];

    let pageLoaded = document.readyState === 'complete';
    let fontsOk = !document.fonts;
    let force = false;
    let p = 0, shown = '';
    const t0 = performance.now();

    window.addEventListener('load', () => { pageLoaded = true; }, { once: true });
    if (document.fonts) document.fonts.ready.then(() => { fontsOk = true; });
    setTimeout(() => { force = true; }, 7000); // red de seguridad: nunca bloquear al usuario

    const finish = () => {
      el.classList.add('is-done');
      body.classList.remove('is-loading');
      body.classList.add('is-loaded');
      setTimeout(() => el.remove(), 1600);
      onDone();
    };

    const step = now => {
      const t = now - t0;
      let target = easeOut(clamp(t / MIN)) * 92;
      if (force || (pageLoaded && fontsOk && t >= MIN)) target = 100;
      p += (target - p) * (target === 100 ? .14 : .07);
      if (target === 100 && p > 99.6) p = 100;

      const v = Math.round(p);
      if (String(v) !== shown) {
        shown = String(v);
        num.textContent = shown;
        for (let i = msgs.length - 1; i >= 0; i--) if (v >= msgs[i][0]) { status.textContent = msgs[i][1]; break; }
      }
      prog.style.strokeDashoffset = (CIRC * (1 - p / 100)).toFixed(1);

      if (p < 100) requestAnimationFrame(step);
      else setTimeout(finish, 350);
    };
    requestAnimationFrame(step);
  }

  /* ═══════════════════════════════════════════════════════════════
     PLANCTON — partículas bioluminiscentes que reaccionan al puntero
     ═══════════════════════════════════════════════════════════════ */
  const mkSprite = rgb => {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(.16, `rgba(${rgb},.95)`);
    gr.addColorStop(.5, `rgba(${rgb},.22)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return s;
  };
  const SPRITES = ['43,228,255', '60,255,200', '120,170,255'].map(mkSprite);

  class Plankton {
    static all = [];

    constructor(canvas, opts = {}) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = { density: 9000, max: 180, strength: 1, radius: 130, glow: 1, ripples: false, ghost: false, interactive: true, ...opts };
      this.parts = []; this.rip = []; this.spk = [];
      this.real = { x: 0, y: 0, t: -1e9 };
      this.lx = null; this.ly = null; this.acc = 0;
      this.vis = false; this.time = Math.random() * 100;
      this.w = 0; this.h = 0; this.dpr = 1;

      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(es => { this.vis = es[0].isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
      if (this.o.interactive) this.bind();
      this.resize();
      Plankton.all.push(this);
    }

    bind() {
      const set = (cx, cy) => {
        const r = this.c.getBoundingClientRect();
        const x = cx - r.left, y = cy - r.top;
        if (x < -40 || y < -40 || x > r.width + 40 || y > r.height + 40) return;
        this.real.x = x; this.real.y = y; this.real.t = performance.now();
      };
      window.addEventListener('pointermove', e => set(e.clientX, e.clientY), { passive: true });
      // En móvil el dedo está haciendo scroll: touchmove pasivo sigue disparando eventos.
      window.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) set(t.clientX, t.clientY); }, { passive: true });
    }

    resize() {
      const r = this.c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.w = r.width; this.h = r.height;
      this.dpr = Math.min(window.devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
      this.c.width = Math.round(r.width * this.dpr);
      this.c.height = Math.round(r.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const cap = this.o.max * (this.w < 700 ? .6 : 1);
      const n = Math.round(clamp(this.w * this.h / this.o.density, 28, cap));
      while (this.parts.length < n) this.parts.push(this.spawn());
      this.parts.length = n;
      if (reduced) this.draw(0);
    }

    spawn() {
      const z = .35 + Math.random() * .65;
      return {
        x: Math.random() * this.w, y: Math.random() * this.h, z,
        vx: (Math.random() - .5) * 14, vy: -8 + Math.random() * 12,
        r: .8 + Math.random() * 2.2, ph: Math.random() * 6.283, e: 0,
        c: Math.random() < .55 ? 0 : (Math.random() < .7 ? 1 : 2),
        base: .1 + Math.random() * .2
      };
    }

    tick(dt) {
      if (reduced || !this.vis) return;
      this.time += dt;
      const now = performance.now();

      // Puntero efectivo: el real si hubo actividad reciente; si no, uno "fantasma" (animación constante)
      let P = null;
      if (this.o.interactive && now - this.real.t < 2500) P = this.real;
      else if (this.o.ghost) {
        P = { x: this.w * (.5 + .36 * Math.sin(this.time * .5)), y: this.h * (.55 + .26 * Math.sin(this.time * .77 + 1.3)) };
      }
      let moved = 0;
      if (P) {
        if (this.lx != null) moved = Math.hypot(P.x - this.lx, P.y - this.ly);
        if (moved > 220) moved = 0; // salto de "fantasma" a real: no generar ráfaga
        const ox = this.lx, oy = this.ly;
        this.lx = P.x; this.ly = P.y;
        if (moved > .5) this.interact(P, moved, ox, oy);
      }
      this.draw(dt);
    }

    interact(P, moved, ox, oy) {
      const R = this.o.radius * (this.w < 700 ? .8 : 1);
      const k = this.o.strength;
      const push = Math.min(1, moved / 16);
      for (const p of this.parts) {
        const dx = p.x - P.x, dy = p.y - P.y, d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1, f = 1 - d / R;
          p.e = Math.min(1, p.e + f * k * push * .95);
          p.x += dx / d * f * moved * .12 * k;
          p.y += dy / d * f * moved * .12 * k;
        }
      }
      // Estela de chispas siguiendo el movimiento
      const n = Math.min(4, 1 + (moved / 14 | 0));
      for (let i = 0; i < n; i++) {
        const t = Math.random();
        this.spk.push({
          x: lerp(ox, P.x, t) + (Math.random() - .5) * 14, y: lerp(oy, P.y, t) + (Math.random() - .5) * 14,
          vx: (Math.random() - .5) * 26, vy: (Math.random() - .5) * 26 - 8,
          age: 0, life: .7 + Math.random() * .9, s: .5 + Math.random() * .9, c: Math.random() < .6 ? 0 : 1
        });
      }
      if (this.spk.length > 260) this.spk.splice(0, this.spk.length - 260);
      if (this.o.ripples) {
        this.acc += moved;
        if (this.acc > 120) { this.acc = 0; this.rip.push({ x: P.x, y: P.y, r: 8, a: .5 }); }
      }
    }

    draw(dt) {
      const { ctx, w, h, time } = this;
      const glow = this.o.glow;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (const p of this.parts) {
        p.x += (p.vx + Math.sin(time * .6 + p.ph) * 6) * p.z * dt;
        p.y += (p.vy + Math.cos(time * .5 + p.ph) * 4) * p.z * dt;
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
        p.e -= p.e * dt * 1.5;

        const tw = .5 + .5 * Math.sin(time * 1.8 + p.ph);
        const a = clamp((p.base + .22 * tw) * p.z * glow + p.e);
        const s = p.r * 9 * (1 + p.e * 1.7);
        ctx.globalAlpha = a;
        ctx.drawImage(SPRITES[p.c], p.x - s / 2, p.y - s / 2, s, s);
      }

      for (let i = this.spk.length - 1; i >= 0; i--) {
        const s = this.spk[i];
        s.age += dt;
        if (s.age >= s.life) { this.spk.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .985; s.vy *= .985;
        const k = 1 - s.age / s.life, size = 22 * s.s * (.4 + k);
        ctx.globalAlpha = k * k * .95;
        ctx.drawImage(SPRITES[s.c], s.x - size / 2, s.y - size / 2, size, size);
      }

      if (this.rip.length) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.4;
        for (let i = this.rip.length - 1; i >= 0; i--) {
          const r = this.rip[i];
          r.r += 85 * dt; r.a -= dt * .32;
          if (r.a <= 0) { this.rip.splice(i, 1); continue; }
          ctx.strokeStyle = `rgba(43,228,255,${r.a.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.283); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TEXTO: partir en palabras (títulos y manifiesto)
     ═══════════════════════════════════════════════════════════════ */
  /** Recorre un nodo y reemplaza cada palabra con lo que devuelva `make(palabra, clasesHeredadas, i)`. */
  function tokenize(root, make) {
    let i = 0;
    const walk = (node, cls) => {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach(ch => {
        if (ch.nodeType === 3) {
          ch.textContent.split(/(\s+)/).forEach((tok, n) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const word = make(tok, cls, i++);
            const prev = frag.lastChild;
            // Puntuación pegada a un elemento anterior ("</em>."): evita que quede sola en otra línea
            if (n === 0 && prev && prev.nodeType === 1 && prev.nodeName !== 'BR' && ch.previousSibling) {
              const nb = document.createElement('span');
              nb.className = 'nb';
              frag.removeChild(prev);
              nb.append(prev, word);
              frag.appendChild(nb);
            } else frag.appendChild(word);
          });
        } else if (ch.nodeName === 'BR') frag.appendChild(ch.cloneNode());
        else if (ch.nodeType === 1) frag.appendChild(walk(ch, `${cls} ${ch.className}`.trim()));
      });
      return frag;
    };
    const frag = walk(root, '');
    root.textContent = '';
    root.appendChild(frag);
    return i;
  }

  $$('[data-split]').forEach(el => {
    tokenize(el, (word, cls, i) => {
      const w = document.createElement('span'); w.className = 'sw';
      const inn = document.createElement('span'); inn.className = `sw__in ${cls}`.trim();
      inn.style.setProperty('--i', i); inn.textContent = word;
      w.appendChild(inn);
      return w;
    });
  });

  const maniEl = $('#manifestoText');
  let maniWords = [];
  if (maniEl) {
    tokenize(maniEl, (word, cls) => {
      const s = document.createElement('span'); s.className = `w ${cls}`.trim(); s.textContent = word;
      maniWords.push(s);
      return s;
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     REVELADOS (IntersectionObserver) + CONTADORES
     ═══════════════════════════════════════════════════════════════ */
  $$('[data-stagger]').forEach(g => $$('.rv', g).forEach((el, i) => el.style.setProperty('--rd', `${i * 90}ms`)));

  const countUp = el => {
    const end = +el.dataset.count, suf = el.dataset.suffix || '', dur = 1800, t0 = performance.now();
    const tick = now => {
      const k = clamp((now - t0) / dur);
      el.textContent = Math.round(easeOut(k) * end) + suf;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  $$('[data-count]').forEach(el => { el.textContent = '0' + (el.dataset.suffix || ''); });

  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      if (el.dataset.count) countUp(el);
      $$('[data-count]', el).forEach(countUp);
      revealIO.unobserve(el);
    });
  }, { threshold: .14, rootMargin: '0px 0px -8% 0px' });
  $$('.rv, [data-split], [data-count]').forEach(el => revealIO.observe(el));

  /* ═══════════════════════════════════════════════════════════════
     NAVEGACIÓN, MENÚ MÓVIL, ANCLAS, PUNTOS DE CAPÍTULO
     ═══════════════════════════════════════════════════════════════ */
  const nav = $('#nav'), burger = $('#burger'), menu = $('#menu');
  const setMenu = open => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    body.classList.toggle('menu-open', open);
  };
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  matchMedia('(min-width: 960px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  // Scroll suave a anclas (respeta scroll-padding-top del CSS)
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const t = $(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', a.getAttribute('href'));
  });

  // Puntos laterales de capítulo (escritorio)
  const dotsBox = $('#dots');
  const chapters = $$('section[data-title]');
  const dotLinks = chapters.map(s => {
    const a = document.createElement('a');
    a.href = '#' + s.id; a.setAttribute('aria-label', s.dataset.title);
    a.innerHTML = `<span>${s.dataset.title}</span>`;
    dotsBox.appendChild(a);
    return a;
  });
  const chapterIO = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) dotLinks.forEach((a, i) => a.classList.toggle('is-active', chapters[i] === e.target)); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  chapters.forEach(s => chapterIO.observe(s));

  /* ═══════════════════════════════════════════════════════════════
     HERO: rotador de palabras + tilt del orbe
     ═══════════════════════════════════════════════════════════════ */
  const hero = $('#inicio');
  const rotEls = $$('#rot b');
  if (rotEls.length) {
    const sizeRot = () => { $('#rot').style.width = Math.ceil(Math.max(...rotEls.map(b => b.scrollWidth))) + 2 + 'px'; };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(sizeRot);
    let ri = 0;
    if (!reduced) setInterval(() => {
      const cur = rotEls[ri];
      cur.classList.remove('is-on'); cur.classList.add('is-out');
      ri = (ri + 1) % rotEls.length;
      const nx = rotEls[ri];
      nx.style.transition = 'none'; nx.classList.remove('is-out'); void nx.offsetWidth;
      nx.style.transition = ''; nx.classList.add('is-on');
    }, 2600);
  }

  const orb = $('.orb');
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer && orb && !reduced) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      tilt.ty = ((e.clientX - r.left) / r.width - .5) * 16;
      tilt.tx = -((e.clientY - r.top) / r.height - .5) * 12;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { tilt.tx = tilt.ty = 0; });
  }

  /* ═══════════════════════════════════════════════════════════════
     CURSOR, IMANES, SPOTLIGHT
     ═══════════════════════════════════════════════════════════════ */
  const cursor = $('#cursor');
  const cur = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer && cursor) {
    addEventListener('pointermove', e => {
      cur.tx = e.clientX; cur.ty = e.clientY;
      if (!cursor.classList.contains('is-on')) { cur.x = cur.tx; cur.y = cur.ty; cursor.classList.add('is-on'); }
      cursor.classList.toggle('is-link', !!e.target.closest('a, button, [data-lightbox], input, select, textarea, label'));
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
  }

  if (finePointer) {
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px, ${(e.clientY - r.top - r.height / 2) * .32}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    $$('[data-spot]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    $$('[data-tilt-soft]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--tx', ((e.clientX - r.left) / r.width - .5) * -22 + 'px');
        el.style.setProperty('--ty', ((e.clientY - r.top) / r.height - .5) * -22 + 'px');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     TU RUTA: pestañas + pase de abordar
     ═══════════════════════════════════════════════════════════════ */
  const tabs = $$('.tab'), ticket = $('#ticket');
  let activeTL = $('.timeline:not([hidden])');
  let activeSteps = activeTL ? $$('.tl__step', activeTL) : [];
  let activeLine = activeTL ? $('.tl__line', activeTL) : null;
  let dirty = true;

  const selectTab = (tab, focus) => {
    tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    $$('.timeline').forEach(tl => { tl.hidden = tl.id !== tab.dataset.target; });
    activeTL = $('#' + tab.dataset.target);
    activeSteps = $$('.tl__step', activeTL);
    activeLine = $('.tl__line', activeTL);
    activeSteps.forEach(s => s.classList.remove('is-lit'));
    setVar(activeTL, '--p', '0');

    ticket.dataset.theme = tab.dataset.theme;
    $('#tkDest').textContent = tab.dataset.dest;
    $('#tkOut').textContent = tab.dataset.out;
    $('#tkBack').textContent = tab.dataset.back;
    $('#tkIncl').textContent = tab.dataset.incl;
    $('#tkIcon use').setAttribute('href', '#' + tab.dataset.icon);
    $('#tkCta').href = waLink(tab.dataset.wa);
    if (focus) tab.focus();
    dirty = true;
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
      }
    });
  });

  /* ═══════════════════════════════════════════════════════════════
     FAQ (acordeón accesible)
     ═══════════════════════════════════════════════════════════════ */
  $$('.qa__q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.qa'), open = !item.classList.contains('is-open');
      $$('.qa.is-open').forEach(o => { o.classList.remove('is-open'); $('.qa__q', o).setAttribute('aria-expanded', 'false'); });
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ═══════════════════════════════════════════════════════════════
     FORMULARIO → WHATSAPP
     ═══════════════════════════════════════════════════════════════ */
  const form = $('#bookForm');
  if (form) {
    const status = $('#formStatus'), pax = $('#f-pax'), date = $('#f-date');
    const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    date.min = today.toISOString().slice(0, 10);

    $$('[data-step]', form).forEach(b => b.addEventListener('click', () => {
      pax.value = clamp((+pax.value || 1) + +b.dataset.step, 1, 30);
    }));

    const fail = (input, msg) => {
      const f = input.closest('.field');
      f.classList.add('is-bad');
      $('.field__err', f).textContent = msg;
    };
    $$('input, select, textarea', form).forEach(i => i.addEventListener('input', () => {
      const f = i.closest('.field'); f.classList.remove('is-bad');
      const err = $('.field__err', f); if (err) err.textContent = '';
    }));

    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#f-name'), exp = $('#f-exp'), msg = $('#f-msg');
      let ok = true;
      if (name.value.trim().length < 2) { fail(name, 'Dinos tu nombre para saber a quién saludar.'); ok = false; }
      if (!exp.value) { fail(exp, 'Elige la experiencia que quieres vivir.'); ok = false; }
      status.classList.toggle('is-error', !ok);
      if (!ok) { status.textContent = 'Revisa los campos marcados.'; (name.closest('.is-bad') ? name : exp).focus(); return; }

      let when = 'por definir';
      if (date.value) {
        const [y, m, d] = date.value.split('-').map(Number);
        when = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      }
      const text = [
        `¡Hola Biotorturs! 👋 Soy ${name.value.trim()}.`,
        `Quiero reservar: ${exp.value}.`,
        `Fecha deseada: ${when}.`,
        `Personas: ${pax.value || 1}.`,
        msg.value.trim() ? `Comentarios: ${msg.value.trim()}` : ''
      ].filter(Boolean).join('\n');

      status.textContent = '¡Listo! Abriendo WhatsApp con tu mensaje…';
      // Nota: con la opción 'noopener' window.open SIEMPRE devuelve null, así que se desvincula a mano.
      const w = window.open(waLink(text), '_blank');
      if (w) w.opener = null;
      else location.href = waLink(text); // popup bloqueado: abrimos en la misma pestaña
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     LIGHTBOX
     ═══════════════════════════════════════════════════════════════ */
  const lb = $('#lb'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  const shots = $$('[data-lightbox]');
  let lbIndex = 0, lastFocus = null;
  const showShot = i => {
    lbIndex = (i + shots.length) % shots.length;
    const img = $('img', shots[lbIndex]);
    lbImg.src = img.dataset.full || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = $('figcaption', shots[lbIndex].closest('figure')).textContent;
  };
  const openLB = i => {
    lastFocus = document.activeElement;
    showShot(i);
    lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); body.classList.add('lb-open');
    $('.lb__close', lb).focus();
  };
  const closeLB = () => {
    lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); body.classList.remove('lb-open');
    if (lastFocus) lastFocus.focus();
  };
  shots.forEach((b, i) => b.addEventListener('click', () => openLB(i)));
  $('.lb__close', lb).addEventListener('click', closeLB);
  $('.lb__nav--prev', lb).addEventListener('click', () => showShot(lbIndex - 1));
  $('.lb__nav--next', lb).addEventListener('click', () => showShot(lbIndex + 1));
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb__fig')) closeLB(); });
  addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLB();
    if (e.key === 'ArrowRight') showShot(lbIndex + 1);
    if (e.key === 'ArrowLeft') showShot(lbIndex - 1);
  });
  let swipeX = null;
  lb.addEventListener('pointerdown', e => { swipeX = e.clientX; });
  lb.addEventListener('pointerup', e => {
    if (swipeX == null) return;
    const dx = e.clientX - swipeX; swipeX = null;
    if (Math.abs(dx) > 60) showShot(lbIndex + (dx < 0 ? 1 : -1));
  });

  /* ═══════════════════════════════════════════════════════════════
     MOTOR DE SCROLL — un solo requestAnimationFrame para todo
     ═══════════════════════════════════════════════════════════════ */
  const S = { y: 0, sy: 0, vs: 0 };
  const vis = {};
  const watch = (key, el, margin = '15%') => {
    if (!el) return;
    vis[key] = false;
    new IntersectionObserver(es => { vis[key] = es[0].isIntersecting; dirty = true; }, { rootMargin: `${margin} 0px` }).observe(el);
  };

  const progressBar = $('#progressBar');
  const portal = $('#portal');
  const stackItems = $$('[data-stack]');
  const growEls = $$('[data-grow]');
  const journey = $('#viaje');
  const marquee = $('#marquee .marquee__track');

  watch('hero', hero, '0%');
  watch('portal', portal, '10%');
  watch('mani', maniEl);
  watch('xp', $('.xp__stack'));
  watch('journey', journey);
  watch('gallery', $('.gallery__grid'));

  // Marquee: duplicamos el contenido para el bucle infinito
  let mqX = 0, mqHalf = 0;
  if (marquee) {
    [...marquee.children].forEach(n => marquee.appendChild(n.cloneNode(true)));
    const measure = () => { mqHalf = marquee.scrollWidth / 2; };
    measure();
    addEventListener('resize', measure);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(measure);
  }

  // Canvas
  const heroCanvas = $('#heroCanvas'), waterCanvas = $('#waterCanvas');
  if (heroCanvas) new Plankton(heroCanvas, { density: 8500, max: 190, strength: 1, glow: .95, ghost: true });
  if (waterCanvas) new Plankton(waterCanvas, { density: 4800, max: 320, strength: 1.7, radius: 150, glow: 1.2, ripples: true, ghost: true });
  $$('canvas[data-spark]').forEach(c => new Plankton(c, { density: 5200, max: 70, glow: 1.5, interactive: false }));

  let navLastY = 0, navAcc = 0, last = performance.now(), lastManiK = -1;

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const y = window.scrollY, vh = innerHeight;
    const dy = y - S.y; S.y = y;
    S.sy = reduced ? y : lerp(S.sy, y, 1 - Math.pow(.0015, dt));
    if (Math.abs(y - S.sy) < .05) S.sy = y;
    const off = y - S.sy; // desfase entre scroll real y suavizado
    S.vs = lerp(S.vs, dy, .12);
    const moving = dirty || Math.abs(off) > .01 || Math.abs(dy) > 0;

    /* ---- LECTURAS (todas juntas, antes de escribir estilos) ---- */
    let rPortal, rMani, rStack, rLine, rSteps, rGrow;
    if (moving) {
      if (vis.portal) rPortal = portal.getBoundingClientRect();
      if (vis.mani) rMani = maniEl.getBoundingClientRect();
      if (vis.xp && stackMQ.matches) rStack = stackItems.map(i => i.getBoundingClientRect());
      if (vis.journey && activeLine) { rLine = activeLine.getBoundingClientRect(); rSteps = activeSteps.map(s => s.getBoundingClientRect().top); }
      if (vis.gallery) rGrow = growEls.map(g => g.getBoundingClientRect());
    }

    /* ---- ESCRITURAS ---- */
    // Barra de progreso
    const max = document.documentElement.scrollHeight - vh;
    progressBar.style.transform = `scaleX(${max > 0 ? clamp(S.sy / max).toFixed(4) : 0})`;

    // Nav: cristal al bajar, se oculta al bajar rápido y reaparece al subir
    nav.classList.toggle('is-scrolled', y > 40);
    navAcc = Math.sign(dy) === Math.sign(navAcc) ? navAcc + dy : dy;
    if (y < 140 || navAcc < -8 || menu.classList.contains('is-open')) nav.classList.remove('is-hidden');
    else if (navAcc > 14) nav.classList.add('is-hidden');
    navLastY = y;

    // Hero: el contenido se desvanece y sube al hacer scroll; tilt del orbe
    if (vis.hero) {
      setVar(hero, '--hs', clamp(S.sy / vh).toFixed(3));
      if (orb) {
        tilt.x = lerp(tilt.x, tilt.tx, .08); tilt.y = lerp(tilt.y, tilt.ty, .08);
        orb.style.setProperty('--rx', tilt.x.toFixed(2) + 'deg');
        orb.style.setProperty('--ry', tilt.y.toFixed(2) + 'deg');
      }
    }

    // Marquee: velocidad base + empuje según velocidad del scroll
    if (marquee && mqHalf) {
      mqX -= (55 + Math.abs(S.vs) * 3.2) * dt;
      if (mqX <= -mqHalf) mqX += mqHalf;
      marquee.style.transform = `translate3d(${mqX.toFixed(1)}px,0,0)`;
    }

    // Manifiesto: las palabras se encienden con el scroll
    if (rMani) {
      const top = rMani.top + off;
      const p = clamp((vh * .82 - top) / (rMani.height + vh * .3));
      const k = Math.floor(p * maniWords.length * 1.06);
      if (k !== lastManiK) {
        maniWords.forEach((w, i) => w.classList.toggle('on', i < k));
        lastManiK = k;
      }
    }

    // Portal: la imagen se abre de ventana a pantalla completa
    if (rPortal) {
      const total = rPortal.height - vh;
      const p = clamp(-(rPortal.top + off) / total);
      setVar(portal, '--e', easeIO(clamp(p / .55)).toFixed(4));
      setVar(portal, '--t', easeOut(clamp((p - .5) / .2)).toFixed(4));
    }

    // Tarjetas apiladas: la anterior se encoge y oscurece al ser cubierta
    if (rStack) {
      stackItems.forEach((item, i) => {
        const next = rStack[i + 1];
        let c = 0;
        if (next) {
          const stick = parseFloat(getComputedStyle(item).top) || 0;
          c = clamp((stick + rStack[i].height - (next.top + off)) / rStack[i].height);
        }
        setVar(item, '--s', (1 - .065 * c).toFixed(4));
        setVar(item, '--b', (1 - .5 * c).toFixed(3));
      });
    } else if (!stackMQ.matches) {
      stackItems.forEach(item => { setVar(item, '--s', '1'); setVar(item, '--b', '1'); });
    }

    // Línea de tiempo: se llena, la tortuga nada y los pasos se encienden
    if (rLine) {
      const lineY = vh * .56;
      setVar(activeTL, '--p', clamp((lineY - (rLine.top + off)) / rLine.height).toFixed(4));
      activeSteps.forEach((s, i) => s.classList.toggle('is-lit', rSteps[i] + off + 12 <= lineY));
    }

    // Galería: cada foto "crece" al acercarse al centro de la pantalla
    if (rGrow) {
      growEls.forEach((g, i) => {
        const r = rGrow[i];
        const c = r.top + off + r.height / 2;
        const k = clamp(1 - Math.abs(c - vh * .5) / (vh * .5 + r.height * .35));
        setVar(g, '--g', easeOut(k).toFixed(3));
      });
    }

    dirty = false;

    // Canvas (un solo bucle compartido)
    for (const pl of Plankton.all) pl.tick(dt);

    // Cursor personalizado
    if (finePointer && cursor) {
      cur.x = lerp(cur.x, cur.tx, .22); cur.y = lerp(cur.y, cur.ty, .22);
      cursor.style.transform = `translate3d(${cur.x.toFixed(1)}px,${cur.y.toFixed(1)}px,0)`;
    }

    requestAnimationFrame(frame);
  }

  addEventListener('resize', () => { dirty = true; }, { passive: true });
  addEventListener('load', () => { dirty = true; });
  requestAnimationFrame(frame);

  /* ═══════════════════════════════════════════════════════════════
     ARRANQUE
     ═══════════════════════════════════════════════════════════════ */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initLoader(() => {
    // Tooltip del botón flotante: aparece unos segundos y se va
    const wa = $('#waFloat');
    setTimeout(() => wa.classList.add('show-tip'), 4500);
    setTimeout(() => wa.classList.remove('show-tip'), 10500);
  });
})();
