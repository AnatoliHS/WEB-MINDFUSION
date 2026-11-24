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
      cursor.classList.toggle("is-active", !!t);
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

  /* ───────── boot ───────── */
  const boot = () => { measure(); onScroll(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  addEventListener("load", boot);
  boot();
})();

/* ───────── desktop motion layer: project selector + modals, link roll ───────── */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wide = matchMedia("(min-width: 901px)");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const box = (r) => ({ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  const fullBox = () => ({ left: "0px", top: "0px", width: innerWidth + "px", height: innerHeight + "px" });
  const IO = "cubic-bezier(0.76, 0, 0.24, 1)";

  /* ── 1 · Project selector + project modals (ref 03).
        Hover a column → its slice wipes up on a slant.
        Click → every slice cascades up from that column, the stitched frame grows to
        fill the screen, and the project's modal fades in on top of it. Its first
        screen is the same frame as the film poster, so it reads as one image.
        Close runs the same thing backwards. ── */
  const picker = $("[data-picker]");
  const modals = $$("[data-pmodal]");
  if (picker && modals.length) {
    const layers = $$("[data-layer]", picker);
    const slices = layers.map((l) => $$(".picker__slice", l));
    const btns = $$("[data-pick]", picker);
    const slugs = btns.map((a) => a.hash.slice(1));
    const n = btns.length, STEP = 70, WIPE = 950, FADE = 450;
    let peek = -1, current = -1, busy = false;

    /* selector state */
    const raise = (i) => layers.forEach((l, k) => l.classList.toggle("is-top", k === i));
    const slice = (i, c, on, delay = 0) => {
      const s = slices[i][c];
      s.style.setProperty("--d", delay + "ms");
      s.classList.toggle("is-on", on);
    };
    const instantly = (fn) => {
      picker.classList.add("no-anim"); fn(); void picker.offsetWidth; picker.classList.remove("no-anim");
    };
    const setPeek = (i) => {
      if (busy || current >= 0 || i === peek) return;
      if (peek >= 0) slice(peek, peek, false);
      peek = i;
      if (i >= 0) { raise(i); slice(i, i, true); }
      picker.classList.toggle("is-peek", i >= 0);
    };
    // show project i's frame across the whole selector, without animating
    const fillInstantly = (i) => instantly(() => {
      slices.forEach((row, k) => row.forEach((_, c) => slice(k, c, k === i)));
      raise(i); peek = i;
      picker.classList.add("is-open", "is-peek");
    });

    /* a fixed copy of the frame used to bridge selector ↔ modal */
    const curtain = (i, z) => {
      const el = document.createElement("div");
      el.className = "picker-curtain";
      el.style.backgroundImage = getComputedStyle(layers[i]).getPropertyValue("--img");
      if (z) el.style.zIndex = z;
      document.body.appendChild(el);
      return el;
    };
    const drop = (el) => el && el.parentNode && el.parentNode.removeChild(el);

    /* keep focus and assistive tech inside the open modal */
    let inerted = [];
    const isolate = (modal, on) => {
      inerted.forEach((el) => { el.inert = false; });
      inerted = [];
      if (!on) return;
      const keep = (el) => el.contains(modal) || el.tagName === "SCRIPT" || el.tagName === "DIALOG";
      let node = modal;
      while (node && node !== document.body) {
        const parent = node.parentElement;
        for (const sib of parent.children) if (sib !== node && !keep(sib)) { sib.inert = true; inerted.push(sib); }
        node = parent;
      }
    };

    const modalFor = (i) => modals.find((m) => m.dataset.pmodal === slugs[i]);

    const showModal = async (i) => {
      const m = modalFor(i);
      m.scrollTop = 0;
      m.classList.remove("is-scrolled");
      m.setAttribute("role", "dialog");
      m.setAttribute("aria-modal", "true");
      m.classList.add("is-open");
      document.documentElement.classList.add("has-pmodal");
      isolate(m, true);
      await nextFrame();
      m.classList.add("is-visible");
      m.focus({ preventScroll: true });
      current = i;
      history.replaceState(null, "", "#" + slugs[i]);
      dispatchEvent(new Event("scroll"));       // let reveals/parallax measure the new content
    };
    const clearHash = () => {
      if (slugs.includes(location.hash.slice(1))) history.replaceState(null, "", location.pathname + location.search);
    };
    const hideModal = (i) => {
      const m = modalFor(i);
      clearHash();
      m.classList.remove("is-open", "is-visible");
      m.removeAttribute("role");
      m.removeAttribute("aria-modal");
      $$("video", m).forEach((v) => v.pause());
    };

    const open = async (i) => {
      if (busy || current >= 0) return;
      busy = true;
      if (reduced) { fillInstantly(i); await showModal(i); busy = false; return; }

      // 1 · cascade the frame across every column
      if (peek >= 0 && peek !== i) slice(peek, peek, false);
      peek = i; raise(i);
      picker.classList.add("is-open");
      for (let c = 0; c < n; c++) slice(i, c, true, Math.abs(c - i) * STEP);
      await wait(Math.max(i, n - 1 - i) * STEP + WIPE);

      // 2 · grow it to the whole screen
      const c = curtain(i);
      const from = box(picker.getBoundingClientRect()), to = fullBox();
      Object.assign(c.style, from);
      await c.animate([from, to], { duration: 700, easing: IO, fill: "forwards" }).finished;

      // 3 · the modal fades in over it (its first screen is the same frame)
      await showModal(i);
      await wait(FADE);
      drop(c);
      busy = false;
    };

    const close = async () => {
      if (busy || current < 0) return;
      busy = true;
      const i = current, m = modalFor(i), btn = btns[i];
      fillInstantly(i);
      if (reduced) {
        hideModal(i); isolate(m, false); document.documentElement.classList.remove("has-pmodal");
        current = -1; busy = false; instantly(() => slices[i].forEach((_, c) => slice(i, c, false)));
        picker.classList.remove("is-open", "is-peek"); peek = -1;
        btn.focus({ preventScroll: true });
        return;
      }

      // 1 · a full-screen frame waits underneath while the modal fades away
      const c = curtain(i, 105);
      const full = fullBox();
      Object.assign(c.style, full);
      m.classList.remove("is-visible");
      await wait(FADE);
      hideModal(i);
      isolate(m, false);
      document.documentElement.classList.remove("has-pmodal");
      current = -1;

      // 2 · shrink it back onto the selector
      const to = box(picker.getBoundingClientRect());
      await c.animate([full, to], { duration: 700, easing: IO, fill: "forwards" }).finished;
      drop(c);

      // 3 · retract the columns from the outside in, back to this column's peek
      const far = Math.max(i, n - 1 - i);
      for (let k = 0; k < n; k++) if (k !== i) slice(i, k, false, (far - Math.abs(k - i)) * 45);
      picker.classList.remove("is-open");
      busy = false;
      btn.focus({ preventScroll: true });
      if (!picker.matches(":hover")) setPeek(-1);
    };

    const next = async (slug) => {
      if (busy || current < 0) return;
      const j = slugs.indexOf(slug);
      if (j < 0) return;
      busy = true;
      const i = current, m = modalFor(i);
      m.classList.remove("is-visible");
      await wait(reduced ? 0 : FADE);
      hideModal(i);
      fillInstantly(j);
      await showModal(j);
      busy = false;
    };

    btns.forEach((a, i) => {
      a.addEventListener("pointerenter", () => setPeek(i));
      a.addEventListener("focus", () => setPeek(i));
      a.addEventListener("click", (e) => {
        if (!wide.matches) return;                // mobile never shows the selector, but be safe
        e.preventDefault();
        open(i);
      });
    });
    picker.addEventListener("pointerleave", () => setPeek(-1));

    modals.forEach((m) => {
      $("[data-pmodal-close]", m).addEventListener("click", close);
      $("[data-pmodal-next]", m).addEventListener("click", (e) => next(e.currentTarget.dataset.pmodalNext));
      // scroll cue: glide down to the story, and fade the cue once the reader moves
      const more = $("[data-film-more]", m), rule = $(".chapter__rule", m);
      if (more && rule) more.addEventListener("click", () => {
        const top = rule.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 24;
        m.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      });
      // window-scroll driven effects (stills parallax) follow the modal's own scroll
      let ticking = false;
      m.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          m.classList.toggle("is-scrolled", m.scrollTop > 40);
          dispatchEvent(new Event("scroll"));
        });
      }, { passive: true });
    });

    addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || current < 0) return;
      if ($("dialog[open]")) return;              // the stills lightbox handles its own Escape
      close();
    });

    // deep links (/#loyalist etc. — used by the sitemap, schema and llms.txt) open the project.
    // The page is parked on the selector underneath, so closing lands somewhere sensible.
    const fromHash = async () => {
      const i = slugs.indexOf(decodeURIComponent(location.hash.slice(1)));
      if (i < 0 || !wide.matches || busy || current >= 0) return;
      busy = true;
      const html = document.documentElement, prev = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      scrollTo(0, picker.getBoundingClientRect().top + scrollY - Math.max(0, (innerHeight - picker.offsetHeight) / 2));
      html.style.scrollBehavior = prev;
      fillInstantly(i);
      await showModal(i);
      busy = false;
    };
    addEventListener("hashchange", fromHash);
    fromHash();

    // if the window narrows to mobile with a modal open, put everything back
    wide.addEventListener("change", (e) => {
      if (e.matches || current < 0) return;
      const i = current;
      hideModal(i); isolate(modalFor(i), false);
      document.documentElement.classList.remove("has-pmodal");
      current = -1; busy = false;
      instantly(() => slices.forEach((row, k) => row.forEach((_, c) => slice(k, c, false))));
      picker.classList.remove("is-open", "is-peek"); peek = -1;
    });
  }

  /* ── 2 · Per-letter roll on hover for nav and footer links (ref 08). ── */
  if (!reduced) {
    $$(".nav__links a, .contact__col a.link:not(.mono)").forEach((a) => {
      const text = a.textContent.trim();
      if (!text) return;
      a.setAttribute("aria-label", text);
      const roll = document.createElement("span");
      roll.className = "roll";
      roll.setAttribute("aria-hidden", "true");
      [...text].forEach((ch, i) => {
        const s = document.createElement("span");
        s.textContent = ch === " " ? " " : ch;
        s.style.setProperty("--i", i);
        roll.appendChild(s);
      });
      a.textContent = "";
      a.appendChild(roll);
    });
  }
})();
