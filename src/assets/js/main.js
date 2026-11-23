/* MIND × FUSION — interactions. Vanilla, no dependencies. */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad = (n) => String(Math.floor(n)).padStart(2, "0");
  const tc = (frames, fps = 24) => {
    const f = Math.floor(frames);
    return `${pad(f / (fps * 3600))}:${pad((f / (fps * 60)) % 60)}:${pad((f / fps) % 60)}:${pad(f % fps)}`;
  };

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const small = () => innerWidth <= 760;

  /* ───────── scroll state, one rAF loop ───────── */
  const tasks = [];
  let sy = scrollY, lastSy = sy, vel = 0, ticking = false;
  const onScroll = () => {
    sy = scrollY;
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  };
  function frame() {
    ticking = false;
    vel = sy - lastSy; lastSy = sy;
    for (const t of tasks) t(sy, vel);
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { measure(); onScroll(); });

  const measures = [];
  const measure = () => measures.forEach((m) => m());

  /* ───────── reveals ───────── */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
  $$("[data-reveal], [data-film]").forEach((el) => io.observe(el));
  const seenIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-seen"); seenIO.unobserve(e.target); }
  }, { threshold: 0.12 });
  $$("[data-chapter]").forEach((el) => seenIO.observe(el));

  /* ───────── navigation ───────── */
  const nav = $("[data-nav]");
  const hero = $("[data-hero]");
  const menu = $("[data-menu]");
  const toggle = $("[data-menu-toggle]");

  if (nav && menu && toggle) {
    tasks.push((y, v) => {
      const pastHero = y > (hero ? hero.offsetHeight - innerHeight * 0.6 : 80);
      nav.classList.toggle("is-solid", pastHero);
      if (menu.classList.contains("is-open")) return;
      if (y > 240 && v > 4) nav.classList.add("is-hidden");
      else if (v < -4 || y < 240) nav.classList.remove("is-hidden");
    });

    const setMenu = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        menu.hidden = false;
        requestAnimationFrame(() => menu.classList.add("is-open"));
        nav.classList.remove("is-hidden");
        $("a", menu).focus({ preventScroll: true });
      } else {
        menu.classList.remove("is-open");
        menu.hidden = true;
      }
    };
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) { setMenu(false); toggle.focus(); }
    });
  }

  // current-section highlight in nav
  const navLinks = $$(".nav__links a");
  const sectionIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const id = e.target.id === "about" || e.target.dataset.chapter !== undefined ? "work" : e.target.id;
      navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + id));
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["work", "words", "contact"].forEach((id) => { const el = document.getElementById(id); if (el) sectionIO.observe(el); });
  $$("[data-chapter]").forEach((el) => sectionIO.observe(el));

  /* ───────── hero: letterbox-on-scroll + running timecode ───────── */
  if (hero) {
    const heroVideo = $("[data-hero-video]");
    const tcEl = $("[data-tc]", hero);
    let heroIn = true;
    new IntersectionObserver(([e]) => {
      heroIn = e.isIntersecting;
      if (!heroVideo) return;
      if (heroIn) heroVideo.play().catch(() => {}); else heroVideo.pause();
    }).observe(hero);

    if (!reduced) {
      tasks.push((y) => {
        if (!heroIn) return;
        const p = clamp(y / (hero.offsetHeight - innerHeight));
        hero.style.setProperty("--p", p.toFixed(4));
      });
    }

    let start = performance.now();
    const tick = (now) => {
      if (heroIn && tcEl) {
        const t = heroVideo && !heroVideo.paused ? heroVideo.currentTime : (now - start) / 1000;
        tcEl.textContent = tc(t * 24);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ───────── about: word-by-word scrub ───────── */
  const scrub = $("[data-scrub]");
  if (scrub) {
    const words = scrub.textContent.trim().split(/\s+/);
    scrub.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(" ");
    const ws = $$(".w", scrub);
    if (reduced) ws.forEach((w) => w.classList.add("on"));
    else tasks.push(() => {
      const r = scrub.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35));
      const n = Math.round(p * ws.length);
      ws.forEach((w, i) => w.classList.toggle("on", i < n));
    });
  }

  /* ───────── work index: floating video preview ───────── */
  const box = $("[data-preview-box]");
  if (box && finePointer) {
    const items = Object.fromEntries($$("[data-preview-item]", box).map((el) => [el.dataset.previewItem, el]));
    const tag = $("[data-preview-tag]", box);
    let mx = innerWidth / 2, my = innerHeight / 2, x = mx, y = my, s = 0.6, ts = 0.6, on = false, raf = 0, current = null;

    const loop = () => {
      const dx = mx - x;
      x = lerp(x, mx, 0.14); y = lerp(y, my, 0.14); s = lerp(s, ts, 0.12);
      box.style.setProperty("--px", x.toFixed(1) + "px");
      box.style.setProperty("--py", y.toFixed(1) + "px");
      box.style.setProperty("--ps", s.toFixed(3));
      box.style.setProperty("--pr", clamp(dx * 0.04, -8, 8).toFixed(2) + "deg");
      raf = on || Math.abs(s - ts) > 0.01 ? requestAnimationFrame(loop) : 0;
    };
    const show = (slug, label) => {
      if (current && current !== items[slug]) {
        current.classList.remove("is-on");
        const v = $("video", current); v && v.pause();
      }
      current = items[slug];
      if (!current) return;
      const v = $("video", current);
      if (v && !v.src) v.src = v.dataset.src;
      v && v.play().catch(() => {});
      current.classList.add("is-on");
      tag.textContent = label;
      on = true; ts = 1; box.classList.add("is-on");
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const hide = () => {
      on = false; ts = 0.6; box.classList.remove("is-on");
      if (current) { const v = $("video", current); v && v.pause(); }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    $$("[data-preview]").forEach((a) => {
      a.addEventListener("pointerenter", (e) => {
        mx = e.clientX; my = e.clientY;
        if (!on) { x = mx; y = my; }
        show(a.dataset.preview, $(".index__no", a).textContent + " — " + $(".index__disc", a).textContent);
      });
      a.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; });
    });
    $("[data-index]").addEventListener("pointerleave", hide);
    addEventListener("scroll", () => on && hide(), { passive: true });
  }

  /* ───────── chapter films: lazy, play-in-view, sound toggle ───────── */
  const films = $$("[data-film]");
  const sourceFor = (v) => (small() ? v.dataset.srcSm : v.dataset.src);
  const filmIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = $("video", e.target);
      if (e.isIntersecting) {
        if (!v.getAttribute("src")) { v.src = sourceFor(v); }
        if (!reduced) v.play().catch(() => {});
      } else {
        v.pause();
        const btn = $("[data-sound]", e.target);
        if (btn && !v.muted) setSound(e.target, false);
      }
    }
  }, { threshold: 0.25 });
  films.forEach((f) => {
    filmIO.observe(f);
    const v = $("video", f);
    const tcEl = $("[data-film-tc]", f);
    v.addEventListener("timeupdate", () => {
      const t = v.currentTime;
      tcEl.textContent = `${pad(t / 60)}:${pad(t % 60)}:${pad((t * 24) % 24)}`;
    });
  });

  function setSound(film, on) {
    const v = $("video", film), btn = $("[data-sound]", film);
    if (!btn) return;
    if (on) films.forEach((f) => f !== film && setSound(f, false));
    v.muted = !on;
    if (on) v.play().catch(() => {});
    btn.setAttribute("aria-pressed", String(on));
    $(".sound__label", btn).textContent = on ? "Sound on" : "Sound off";
    film.dataset.cursor = on ? "Mute" : "Sound";
  }
  films.forEach((f) => {
    const btn = $("[data-sound]", f);
    if (!btn) return;
    btn.addEventListener("click", (e) => { e.stopPropagation(); setSound(f, btn.getAttribute("aria-pressed") !== "true"); });
    $(".film__frame", f).addEventListener("click", () => setSound(f, btn.getAttribute("aria-pressed") !== "true"));
  });

  /* ───────── stills: gentle parallax ───────── */
  if (!reduced) {
    const stills = $$(".still img");
    tasks.push(() => {
      const vh = innerHeight;
      for (const img of stills) {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        const p = (r.top + r.height / 2 - vh / 2) / vh;      // -1 … 1 around viewport centre
        img.style.setProperty("--py", (p * -r.height * 0.09).toFixed(1) + "px");
      }
    });
  }

  /* ───────── marquee: drift + scroll velocity ───────── */
  const track = $("[data-marquee]");
  if (track && !reduced) {
    let x = 0, boost = 0, w = 0, visible = false;
    measures.push(() => { w = track.firstElementChild.offsetWidth; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(track);
    tasks.push((y, v) => { boost = clamp(boost + Math.abs(v) * 0.08, 0, 14); });
    const run = () => {
      if (visible && w) {
        boost *= 0.94;
        x -= 0.6 + boost;
        if (x <= -w) x += w;
        track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      }
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  /* ───────── testimonials ───────── */
  const words = $("[data-words]");
  if (words) {
    const quotes = $$("[data-quote]", words);
    const now = $("[data-words-now]", words);
    const bar = $("[data-words-bar]", words);
    const DUR = 8000;
    let i = 0, timer = 0, paused = false, inView = false, left = DUR, startedAt = 0;

    const go = (n) => {
      quotes[i].classList.remove("is-active");
      quotes[i].setAttribute("aria-hidden", "true");
      i = (n + quotes.length) % quotes.length;
      quotes[i].classList.add("is-active");
      quotes[i].removeAttribute("aria-hidden");
      now.textContent = pad(i + 1);
      restart();
    };
    const restart = () => {
      clearTimeout(timer); left = DUR;
      bar.classList.remove("run"); void bar.offsetWidth;
      if (reduced) return;
      bar.style.setProperty("--dur", DUR + "ms");
      bar.classList.add("run");
      schedule();
    };
    const schedule = () => {
      clearTimeout(timer);
      if (paused || !inView || reduced) return;
      startedAt = performance.now();
      timer = setTimeout(() => go(i + 1), left);
    };
    const pause = (p) => {
      if (p === paused) return;
      paused = p; words.classList.toggle("is-paused", p);
      if (p) { clearTimeout(timer); left -= performance.now() - startedAt; }
      else schedule();
    };
    quotes.forEach((q, k) => k && q.setAttribute("aria-hidden", "true"));
    $("[data-words-next]", words).addEventListener("click", () => go(i + 1));
    $("[data-words-prev]", words).addEventListener("click", () => go(i - 1));
    const stage = $(".words__stage", words);
    stage.addEventListener("pointerenter", () => pause(true));
    stage.addEventListener("pointerleave", () => pause(false));
    words.addEventListener("focusin", () => pause(true));
    words.addEventListener("focusout", () => pause(false));
    let sx = null;
    stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (sx === null) return;
      const d = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1));
    });
    new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      words.classList.toggle("is-paused", !inView || paused);
      if (inView) { if (!bar.classList.contains("run")) restart(); else schedule(); }
      else { clearTimeout(timer); left -= performance.now() - startedAt; }
    }, { threshold: 0.3 }).observe(words);
  }

  /* ───────── lightbox ───────── */
  const dlg = $("[data-lightbox-dialog]");
  if (dlg && dlg.showModal) {
    const img = $("[data-lb-img]", dlg), cap = $("[data-lb-cap]", dlg), count = $("[data-lb-count]", dlg);
    let set = [], k = 0, opener = null;
    const render = () => {
      const b = set[k];
      img.src = b.dataset.full;
      img.alt = $("img", b).alt;
      cap.textContent = b.dataset.caption;
      count.textContent = `${pad(k + 1)} / ${pad(set.length)}`;
    };
    $$("[data-lightbox]").forEach((b) => b.addEventListener("click", () => {
      set = $$(`[data-lightbox="${b.dataset.lightbox}"]`);
      k = +b.dataset.index; opener = b;
      render(); dlg.showModal();
      document.body.style.overflow = "hidden";
    }));
    const step = (d) => { k = (k + d + set.length) % set.length; render(); };
    $("[data-lb-next]", dlg).addEventListener("click", () => step(1));
    $("[data-lb-prev]", dlg).addEventListener("click", () => step(-1));
    $("[data-lb-close]", dlg).addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { document.body.style.overflow = ""; opener && opener.focus({ preventScroll: true }); });
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });
    let tx = null;
    dlg.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener("touchend", (e) => {
      if (tx === null) return;
      const d = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(d) > 40) step(d < 0 ? 1 : -1);
    });
  }

  /* ───────── custom cursor ───────── */
  const cursor = $(".cursor");
  if (cursor && finePointer && !reduced) {
    const label = $(".cursor__label", cursor);
    let mx = -100, my = -100, x = mx, y = my;
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    document.addEventListener("pointerleave", () => cursor.classList.add("is-hidden"));
    document.addEventListener("pointerenter", () => cursor.classList.remove("is-hidden"));
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-cursor]");
      const inPreview = e.target.closest("[data-preview]");
      cursor.classList.toggle("is-active", !!t);
      cursor.classList.toggle("is-hidden", !!inPreview);
      if (t) label.textContent = t.dataset.cursor;
    });
    const run = () => {
      x = lerp(x, mx, 0.22); y = lerp(y, my, 0.22);
      cursor.style.setProperty("--cx", x.toFixed(1) + "px");
      cursor.style.setProperty("--cy", y.toFixed(1) + "px");
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  /* ───────── edit-timeline scrubber ───────── */
  const tl = $("[data-timeline]");
  if (tl) {
    const fill = $("[data-fill]", tl), tcEl = $("[data-scroll-tc]", tl), nowEl = $("[data-now]", tl), trackEl = $("[data-track]", tl);
    const chapters = $$("[data-chapter]");
    const ticks = $$("[data-tick]", tl);
    const work = $("#work"), wordsEl = $("#words"), contact = $("#contact");
    let max = 1, marks = [];
    measures.push(() => {
      max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      marks = chapters.map((c) => c.offsetTop - innerHeight * 0.4);
      ticks.forEach((t, n) => t.style.setProperty("--at", ((marks[n] / max) * 100).toFixed(2) + "%"));
    });
    tasks.push((y) => {
      const p = clamp(y / max);
      fill.style.setProperty("--prog", p.toFixed(4));
      tcEl.textContent = tc(y / 4);                         // every 4px of scroll is one frame
      tl.classList.toggle("is-on", y > (hero ? hero.offsetHeight - innerHeight : 0) && y < max - 40);
      let label = "Intro", n = -1;
      if (work && y >= work.offsetTop - innerHeight * 0.5) label = "Selected work";
      marks.forEach((m, k) => { if (y >= m) n = k; });
      if (n >= 0) label = `Ch. ${chapters[n].dataset.no} — ${chapters[n].dataset.title}`;
      if (wordsEl && y >= wordsEl.offsetTop - innerHeight * 0.5) label = "What they said";
      if (contact && y >= contact.offsetTop - innerHeight * 0.5) label = "Contact";
      nowEl.textContent = label;
      ticks.forEach((t, k) => t.classList.toggle("is-past", k <= n));
    });
    trackEl.addEventListener("click", (e) => {
      const r = trackEl.getBoundingClientRect();
      const target = clamp((e.clientX - r.left) / r.width) * max;
      // snap to the nearest chapter if close
      let best = target;
      marks.forEach((m) => { if (Math.abs(m + innerHeight * 0.4 - target) < max * 0.03) best = m + innerHeight * 0.4; });
      scrollTo({ top: best, behavior: reduced ? "auto" : "smooth" });
    });
  }

  /* ───────── footer wordmark: fit to width ───────── */
  const fit = $("[data-fit]");
  if (fit) {
    measures.push(() => {
      fit.style.fontSize = "100px";
      const avail = fit.parentElement.clientWidth - parseFloat(getComputedStyle(fit.parentElement).paddingLeft) * 2;
      fit.style.fontSize = Math.floor((avail / fit.scrollWidth) * 100 * 0.995) + "px";
    });
  }

  /* ───────── boot ───────── */
  const boot = () => { measure(); onScroll(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  addEventListener("load", boot);
  boot();
})();
