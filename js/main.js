(function () {
  "use strict";

  var motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionPreference.matches;
  var touchDevice = window.matchMedia("(pointer: coarse)").matches;
  var menuToggle = document.querySelector(".menu-toggle");
  var menuClose = document.querySelector(".menu-close");
  var menuPanel = document.querySelector(".menu-panel");
  var menuLinks = document.querySelectorAll(".menu-panel__links a");
  var year = document.querySelector("#year");
  var loader = document.querySelector(".loader");
  var loaderCount = document.querySelector(".loader__count");
  var heroImages = Array.prototype.slice.call(document.querySelectorAll(".hero-image img"));
  var animatedLineSequence = 0;
  var animatedLineInstances = new WeakMap();
  var smoothScrollbar = null;
  var smoothScrollElement = null;

  if (year) year.textContent = new Date().getFullYear();

  function waitForImage(image) {
    return new Promise(function (resolve) {
      function imageReady() {
        if (!image.naturalWidth) {
          console.error("Hero image failed to load.", image);
          resolve();
          return;
        }
        if (typeof image.decode !== "function") {
          resolve();
          return;
        }
        image.decode().then(resolve).catch(function (error) {
          console.error("Hero image could not be decoded.", image, error);
          resolve();
        });
      }

      if (image.complete) {
        imageReady();
        return;
      }
      image.addEventListener("load", imageReady, { once: true });
      image.addEventListener("error", function () {
        console.error("Hero image failed to load.", image);
        resolve();
      }, { once: true });
    });
  }

  function finishLoading() {
    if (loader) loader.remove();
    document.body.classList.remove("is-loading");
  }

  function loadAssets() {
    var total = heroImages.length;
    var loaded = 0;
    function update() {
      loaded += 1;
      if (loaderCount) loaderCount.textContent = Math.round((loaded / total) * 100) + "%";
    }
    if (!total) return Promise.resolve();
    return Promise.all(heroImages.map(function (image) {
      return waitForImage(image).then(update);
    }));
  }

  var menuAnimation;
  function setMenu(open) {
    var header = menuToggle.closest("header");
    var content = document.querySelector("main");
    if (menuAnimation) menuAnimation.kill();
    if (smoothScrollbar) smoothScrollbar.setMomentum(0, 0);
    header.inert = open;
    content.inert = open;
    menuPanel.inert = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    if (!open) menuToggle.focus({ preventScroll: true });
    document.body.classList.toggle("menu-open", open);
    menuPanel.setAttribute("aria-hidden", String(!open));
    if (window.gsap) {
      gsap.set(menuPanel, { clearProps: "visibility,clipPath" });
      gsap.set(menuLinks, { clearProps: "opacity,transform" });
      if (open && !motionPreference.matches) {
        menuAnimation = gsap.timeline()
          .from(menuPanel, { clipPath: "inset(0 0 100% 0)", duration: .45, ease: "expo.out" })
          .from(menuLinks, { y: 24, opacity: 0, duration: .35, stagger: .04 }, .12);
      }
    }
    if (open) {
      menuClose.focus({ preventScroll: true });
      requestAnimationFrame(function () {
        if (!menuPanel.inert && !menuPanel.contains(document.activeElement)) {
          menuClose.focus({ preventScroll: true });
        }
      });
    }
  }

  function initCursor() {
    if (touchDevice || reducedMotion || !window.gsap) return;
    var cursor = document.querySelector(".cursor");
    var x = window.innerWidth / 2;
    var y = window.innerHeight / 2;
    gsap.set(cursor, { x: x, y: y, opacity: 1 });
    window.addEventListener("pointermove", function (event) {
      gsap.to(cursor, { x: event.clientX, y: event.clientY, duration: .28, ease: "power3.out", overwrite: true });
    }, { passive: true });
    document.querySelectorAll("a, button, .hero-image").forEach(function (element) {
      element.addEventListener("pointerenter", function () { cursor.classList.add("is-hovering"); });
      element.addEventListener("pointerleave", function () { cursor.classList.remove("is-hovering"); });
    });
  }

  function initMagnetic() {
    if (touchDevice || reducedMotion || !window.gsap) return;
    document.querySelectorAll(".magnetic").forEach(function (element) {
      element.addEventListener("pointermove", function (event) {
        if (motionPreference.matches) return;
        var rect = element.getBoundingClientRect();
        var moveX = (event.clientX - (rect.left + rect.width / 2)) * .2;
        var moveY = (event.clientY - (rect.top + rect.height / 2)) * .2;
        gsap.to(element, { x: moveX, y: moveY, duration: .35, ease: "power3.out", overwrite: true });
      });
      element.addEventListener("pointerleave", function () {
        gsap.to(element, { x: 0, y: 0, duration: .6, ease: "elastic.out(1, .4)" });
      });
    });
  }

  function fitHeroTitle() {
    var titleLine = document.querySelector(".hero-title__line");
    if (!titleLine) return;
    var title = titleLine.closest(".hero-title");
    var stage = title.closest(".hero__stage");
    var naturalWidth = titleLine.offsetWidth;
    if (!naturalWidth || !stage.clientWidth) return;
    var size = parseFloat(getComputedStyle(titleLine).fontSize);
    var widthFraction = window.innerWidth <= 760 ? .97 : .80;
    title.style.setProperty("--hero-type-size", (size * stage.clientWidth * widthFraction / naturalWidth) + "px");
  }

  function AnimatedLine(element) {
    this.element = element;
    this.orientation = element.getAttribute("data-animated-line");
    this.axis = this.orientation === "horizontal" ? "scaleX" :
      this.orientation === "vertical" ? "scaleY" : null;
  }

  AnimatedLine.prototype.addTo = function (timeline) {
    if (this.element.dataset.animatedLineInitialized === "true" ||
        animatedLineInstances.has(this.element)) return;
    if (!this.axis) {
      console.error("AnimatedLine orientation must be horizontal or vertical.", this.element);
      return;
    }

    var fromVars = {};
    var toVars = { duration: 1, ease: "none" };
    fromVars[this.axis] = 0;
    toVars[this.axis] = 1;
    timeline.fromTo(this.element, fromVars, toVars, 0);
    this.element.dataset.animatedLineInitialized = "true";
    animatedLineInstances.set(this.element, timeline);
  };

  function lineTriggerFor(selector, fallback) {
    if (!selector) return fallback;
    var trigger = document.querySelector(selector);
    if (!trigger) {
      console.error("AnimatedLine trigger was not found: " + selector);
      return null;
    }
    return trigger;
  }

  function createAnimatedLineTimeline(trigger, start) {
    return gsap.timeline({
      scrollTrigger: {
        id: "animated-line-" + (++animatedLineSequence),
        trigger: trigger,
        start: start || "top bottom-=50",
        pin: false,
        pinSpacing: false,
        scrub: false
      }
    });
  }

  function initAnimatedLines() {
    document.querySelectorAll("[data-animated-line-group]").forEach(function (group) {
      if (group.dataset.animatedLineInitialized === "true") return;

      var trigger = lineTriggerFor(group.dataset.lineTrigger, group);
      if (!trigger) return;

      var timeline = createAnimatedLineTimeline(trigger, group.dataset.lineStart);
      group.querySelectorAll("[data-animated-line]").forEach(function (element) {
        new AnimatedLine(element).addTo(timeline);
      });
      group.dataset.animatedLineInitialized = "true";
    });

    document.querySelectorAll("[data-animated-line]").forEach(function (element) {
      if (element.closest("[data-animated-line-group]") ||
          element.dataset.animatedLineInitialized === "true") return;

      var line = new AnimatedLine(element);
      if (!line.axis) {
        console.error("AnimatedLine orientation must be horizontal or vertical.", element);
        return;
      }
      var trigger = lineTriggerFor(element.dataset.lineTrigger, element);
      if (!trigger) return;
      line.addTo(createAnimatedLineTimeline(trigger, element.dataset.lineStart));
    });
  }

  function initSmoothScroll() {
    var scroller = document.querySelector(".smooth-scroll");
    if (!scroller || reducedMotion || window.innerWidth <= 760) return;
    if (!window.Scrollbar) {
      console.error("Smooth Scrollbar did not load; using native scrolling.");
      return;
    }
    if (smoothScrollbar) return;

    scroller.classList.add("smooth-scroll--active");
    try {
      smoothScrollbar = window.Scrollbar.init(scroller, {
        damping: .07,
        delegateTo: scroller,
        renderByPixels: true,
        keyDownDisabled: false,
        alwaysShowTracks: true
      });
    } catch (error) {
      scroller.classList.remove("smooth-scroll--active");
      console.error("Smooth Scrollbar could not initialize; using native scrolling.", error);
      return;
    }

    smoothScrollElement = scroller;
    ScrollTrigger.scrollerProxy(scroller, {
      scrollTop: function (value) {
        if (arguments.length) smoothScrollbar.scrollTop = value;
        return smoothScrollbar.scrollTop;
      },
      getBoundingClientRect: function () {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
      pinType: "transform"
    });
    ScrollTrigger.defaults({ scroller: scroller });
    smoothScrollbar.addListener(ScrollTrigger.update);
    ScrollTrigger.addEventListener("refresh", updateScrollSize);
    smoothScrollbar.track.xAxis.element.remove();
  }

  function initWorkHandoff() {
    var handoff = document.querySelector(".work-handoff");
    var overlay = handoff.querySelector(".ai-transition");
    var art = overlay.querySelector(".ai-transition__art");
    var camera = { zoom: 1 };
    var timeline = gsap.timeline({
      scrollTrigger: {
        id: "ai-work-handoff",
        trigger: handoff,
        start: "top top",
        end: "bottom bottom",
        pin: handoff.querySelector(".work-handoff__pin"),
        pinSpacing: false,
        scrub: true,
        invalidateOnRefresh: true
      }
    });
    timeline.to(camera, {
      zoom: 22, duration: 1, ease: "power2.in",
      onUpdate: function () {
        // Move into the counter of the A. Updating the SVG camera preserves its sharp edges.
        var width = 1000 / camera.zoom;
        var height = 500 / camera.zoom;
        art.setAttribute("viewBox", [
          (1000 - width) * .23, (500 - height) * .53, width, height
        ].join(" "));
      }
    }, 0)
      .to(".ai-transition__index, .ai-transition__caption, .ai-transition__line-group", {
        opacity: 0, duration: .22, ease: "none"
      }, .12)
      .to(overlay, { autoAlpha: 0, duration: .55, ease: "power1.inOut" }, .45);
  }

  function initProjectShowcase() {
    gsap.utils.toArray(".parallax_sections .ps").forEach(function (stage, index) {
      var trigger = index === 0 ? stage.closest(".work-handoff") : stage;
      var timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "project-" + (index + 1),
          trigger: trigger,
          start: index === 0 ? "bottom bottom" : "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true
        }
      });
      timeline.fromTo(stage.querySelector(".bgp"),
        { yPercent: index === 0 ? 0 : -7 },
        { yPercent: 7 }, 0);
      // Counter the panel's travel. The article clips both lines at the same boundary.
      timeline.fromTo(stage.querySelector(".fixed_t"), {
        y: function () { return index === 0 ? 0 : -window.innerHeight; }
      }, {
        y: function () { return stage.offsetHeight; }
      }, 0);
    });
  }

  function initAnimations() {
    if (!window.gsap || !window.ScrollTrigger) {
      finishLoading();
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    initSmoothScroll();
    var images = gsap.utils.toArray(".hero-image");

    gsap.set(images, { autoAlpha: 0, scale: .18, clipPath: "inset(12% 12% 12% 12%)" });
    gsap.set(".hero-title__line", { yPercent: 120 });

    if (reducedMotion) {
      gsap.set(images, { clipPath: "inset(0%)" });
      gsap.set(images, { autoAlpha: 1, scale: 1 });
      gsap.set(".hero-title__line", { yPercent: 0 });
      gsap.set(".reveal-line", { clipPath: "inset(0)", y: 0 });
      gsap.set(".projects__head .reveal-line", { opacity: 1, y: 0 });
      gsap.set(".hero__identity, .hero__meta, .hero__footer, .site-header", {
        autoAlpha: 1, y: 0
      });
      gsap.set(".site-header", { pointerEvents: "auto" });
      gsap.set(".ps", { "--stage-clip": "0%" });
      finishLoading();
      return;
    }

    var imageOrder = [
      ".hero-image--07",
      ".hero-image--02",
      ".hero-image--05",
      ".hero-image--04",
      ".hero-image--03",
      ".hero-image--01",
      ".hero-image--06"
    ];
    var orderedImages = imageOrder.map(function (selector) {
      var image = document.querySelector(selector);
      if (!image || !image.querySelector(".hero-image__scale")) {
        console.error("Hero entrance image wrapper is missing.", selector);
      }
      return image;
    }).filter(Boolean);
    var subtitleOffset = window.innerWidth <= 760 ? 25 : window.innerWidth * .01302;
    var siteHeader = document.querySelector(".site-header");
    gsap.set(".hero__identity, .hero__meta, .hero__footer", {
      y: subtitleOffset, autoAlpha: 0
    });
    if (siteHeader) gsap.set(siteHeader, { y: 35, autoAlpha: 0, pointerEvents: "none" });

    var entranceTimeline = gsap.timeline();
    entranceTimeline
      .to(orderedImages, {
        autoAlpha: 1, scale: 1, clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, stagger: .27, ease: "expo.out"
      }, 0)
      .addLabel("composition", 1.8)
      .to(".hero-title__line", {
        yPercent: 0, duration: 1.8, ease: "expo.out"
      }, 1.52)
      .to(".hero__identity, .hero__meta, .hero__footer", {
        y: 0, autoAlpha: 1, duration: 1.8, ease: "expo.out"
      }, "composition+=.7");

    if (siteHeader) {
      entranceTimeline.to(siteHeader, {
        y: 0, autoAlpha: 1, duration: 1, ease: "expo.out",
        onComplete: function () { gsap.set(siteHeader, { pointerEvents: "auto" }); }
      }, "composition+=.7");
    }

    var entranceSettled = false;
    function settleEntrance() {
      if (entranceSettled) return;
      entranceSettled = true;
      entranceTimeline.progress(1);
    }

    var scrollTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: function () { return "+=" + window.innerHeight * (window.innerWidth <= 760 ? 1.25 : 1.2); },
        scrub: 1,
        pin: ".hero__pin",
        anticipatePin: 1,
        onUpdate: function (self) {
          if (self.scroll() > 1) settleEntrance();
        },
        invalidateOnRefresh: true
      }
    });
    if ((smoothScrollbar && smoothScrollbar.scrollTop > 1) || window.scrollY > 1) {
      settleEntrance();
    }

    images.forEach(function (image) {
      var depth = image.dataset.depth.split(",");
      scrollTimeline.to(image, {
        xPercent: Number(depth[0]),
        yPercent: Number(depth[1]),
        ease: "none"
      }, 0);
      scrollTimeline.to(image, { opacity: window.innerWidth <= 760 ? 0 : .3, duration: .1, ease: "none" }, .55);
    });
    scrollTimeline.to(".hero__meta, .hero__identity, .hero__footer", {
      opacity: 0, y: -18, ease: "none"
    }, .25);

    gsap.fromTo(".intro .reveal-line",
      { clipPath: "inset(0 0 100% 0)", y: "25%" },
      {
        clipPath: "inset(0 0 0 0)", y: 0, duration: .9, stagger: .12, ease: "expo.out",
        scrollTrigger: { trigger: ".intro", start: "top 75%" }
      });
    document.documentElement.classList.add("work-motion");
    initWorkHandoff();

    initProjectShowcase();
    initAnimatedLines();
    finishLoading();
  }

  if (menuToggle) menuToggle.addEventListener("click", function () {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
  });
  if (menuClose) menuClose.addEventListener("click", function () { setMenu(false); });
  function updateScrollSize() {
    if (smoothScrollbar) smoothScrollbar.update();
  }

  function goToSection(id, animate, focus) {
    var target = document.getElementById(id);
    if (!target) return;
    var current = smoothScrollbar ? smoothScrollbar.scrollTop : window.scrollY;
    var handoff = id === "work" && window.ScrollTrigger && ScrollTrigger.getById("ai-work-handoff");
    var top = id === "top" ? 0 : handoff ? handoff.end : current + target.getBoundingClientRect().top;
    if (focus) {
      if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    if (smoothScrollbar) smoothScrollbar.scrollTo(0, top, animate ? 720 : 0);
    else window.scrollTo({ top: top, behavior: animate ? "smooth" : "instant" });
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href^='#']");
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    var id = link.hash.slice(1);
    if (!document.getElementById(id)) return;
    event.preventDefault();
    if (link.closest(".menu-panel")) setMenu(false);
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
    goToSection(id, !motionPreference.matches, true);
  });
  window.addEventListener("popstate", function () {
    goToSection(location.hash.slice(1) || "top", false, false);
  });

  document.addEventListener("keydown", function (event) {
    if (menuPanel.inert) return;
    if (event.key === "Escape") setMenu(false);
    if (event.key !== "Tab") return;
    var last = menuPanel.querySelector(".menu-panel__foot a");
    if (event.shiftKey && document.activeElement === menuClose) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      menuClose.focus();
    }
  });

  var animationContext;
  function configureMotion() {
    var position = smoothScrollbar ? smoothScrollbar.scrollTop : window.scrollY;
    if (animationContext) {
      animationContext.revert();
      document.documentElement.classList.remove("work-motion");
      document.querySelector(".ai-transition__art").setAttribute("viewBox", "0 0 1000 500");
      document.querySelectorAll("[data-animated-line-initialized]").forEach(function (element) {
        delete element.dataset.animatedLineInitialized;
      });
      animatedLineInstances = new WeakMap();
      if (smoothScrollbar) {
        ScrollTrigger.removeEventListener("refresh", updateScrollSize);
        ScrollTrigger.defaults({ scroller: window });
        ScrollTrigger.scrollerProxy(smoothScrollElement, null);
        smoothScrollbar.destroy();
        smoothScrollElement.classList.remove("smooth-scroll--active");
        smoothScrollbar = smoothScrollElement = null;
      }
    }
    reducedMotion = motionPreference.matches;
    fitHeroTitle();
    if (window.gsap && window.ScrollTrigger) {
      animationContext = gsap.context(initAnimations);
      ScrollTrigger.refresh();
      if (smoothScrollbar) smoothScrollbar.setPosition(0, position);
      else window.scrollTo({ top: position, behavior: "instant" });
      ScrollTrigger.update();
    }
    finishLoading();
  }

  document.body.classList.add("is-loading");
  var assetsReady = Promise.all([loadAssets(), document.fonts ? document.fonts.ready : Promise.resolve()]);
  var deadline = new Promise(function (resolve) { setTimeout(resolve, 2500); });
  Promise.race([assetsReady, deadline]).then(function () {
    configureMotion();
    if (location.hash) goToSection(location.hash.slice(1), false, false);
    motionPreference.addEventListener("change", configureMotion);
    window.matchMedia("(max-width: 760px)").addEventListener("change", configureMotion);
  }).finally(finishLoading);
  window.addEventListener("resize", fitHeroTitle);
  if (document.fonts) document.fonts.addEventListener("loadingdone", fitHeroTitle);
  initCursor();
  initMagnetic();
})();
