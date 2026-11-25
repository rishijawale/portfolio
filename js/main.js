(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    if (!loader) return;
    if (!window.gsap || reducedMotion) {
      loader.remove();
      document.body.classList.remove("is-loading");
      return;
    }
    gsap.to(loader, {
      clipPath: "inset(0 0 100% 0)",
      duration: .9,
      ease: "expo.inOut",
      onComplete: function () {
        loader.remove();
        document.body.classList.remove("is-loading");
      }
    });
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

  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuPanel.setAttribute("aria-hidden", String(!open));

    if (!window.gsap) return;
    if (open) {
      gsap.set(menuPanel, { visibility: "visible" });
      gsap.timeline()
        .to(menuPanel, { clipPath: "inset(0 0 0 0)", duration: .75, ease: "expo.inOut" })
        .fromTo(menuLinks,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: .65, stagger: .07, ease: "expo.out" },
          "-=.35");
    } else {
      gsap.timeline()
        .to(menuLinks, { y: -30, opacity: 0, duration: .25, stagger: .03, ease: "power2.in" })
        .to(menuPanel, {
          clipPath: "inset(0 0 100% 0)",
          duration: .55,
          ease: "expo.inOut",
          onComplete: function () { gsap.set(menuPanel, { visibility: "hidden" }); }
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
    var naturalWidth = titleLine.scrollWidth;
    if (!naturalWidth) return;
    var stage = titleLine.closest(".hero__stage");
    var availableWidth = stage ? stage.clientWidth : window.innerWidth;
    titleLine.style.setProperty("--wordmark-scale", (availableWidth * .8 / naturalWidth).toFixed(4));
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
        delegateTo: document,
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
    ScrollTrigger.addEventListener("refresh", function () { smoothScrollbar.update(); });
    smoothScrollbar.track.xAxis.element.remove();
  }

  function initProjectShowcase() {
    var stages = gsap.utils.toArray(".parallax_sections .ps");
    if (!stages.length) return;

    stages.forEach(function (stage, index) {
      var background = stage.querySelector(".bgp");
      if (!background) {
        console.error("Project stage is missing its background image.", stage);
        return;
      }

      gsap.fromTo(background,
        { backgroundPosition: "50% 0%" },
        {
          backgroundPosition: "50% 100%",
          ease: "none",
          scrollTrigger: {
            id: "project-background-" + (index + 1),
            trigger: stage,
            start: index === 0 ? "top top" : "top bottom",
            end: "bottom top",
            scrub: true,
            invalidateOnRefresh: true
          }
        });
    });

    [".h2s", ".txt.vs"].forEach(function (selector) {
      var elements = gsap.utils.toArray(".parallax_sections " + selector);
      elements.forEach(function (element, index) {
        gsap.to(element, {
          ease: "none",
          scrollTrigger: {
            id: "project-" + (selector === ".h2s" ? "title-" : "description-") + (index + 1),
            trigger: element,
            pin: true,
            pinSpacing: false,
            scrub: true,
            start: function () {
              var top = window.getComputedStyle(element).top;
              return "top top+=" + top;
            },
            end: function () {
              var duration = index === elements.length - 1 ?
                window.innerHeight : window.innerHeight * (index + 1);
              return "+=" + duration;
            },
            invalidateOnRefresh: true
          }
        });
      });
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
    var imageScales = gsap.utils.toArray(".hero-image__scale");
    gsap.set(images, { clipPath: "inset(100%)" });
    gsap.set(imageScales, { scale: 1.8, autoAlpha: 0, transformOrigin: "50% 50%" });
    gsap.set(".hero-title__line", { yPercent: 120 });

    if (reducedMotion) {
      gsap.set(images, { clipPath: "inset(0%)" });
      gsap.set(imageScales, { scale: 1, autoAlpha: 1 });
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
    var orderedScales = orderedImages.map(function (image) {
      return image.querySelector(".hero-image__scale");
    });
    var subtitleOffset = window.innerWidth <= 760 ? 25 : window.innerWidth * .01302;
    var siteHeader = document.querySelector(".site-header");
    gsap.set(".hero__identity, .hero__meta, .hero__footer", {
      y: subtitleOffset, autoAlpha: 0
    });
    if (siteHeader) gsap.set(siteHeader, { y: 35, autoAlpha: 0, pointerEvents: "none" });

    var entranceTimeline = gsap.timeline();
    entranceTimeline
      .to(orderedScales, {
        scale: 1, autoAlpha: 1, duration: 1.8, stagger: .27, ease: "expo.out"
      }, 0)
      .to(orderedImages, {
        clipPath: "inset(0%)", duration: 1.8, stagger: .27, ease: "expo.out"
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
        end: "bottom bottom",
        scrub: 2.2,
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
      scrollTimeline.to(image, { opacity: 0, ease: "none" }, .55);
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
    var transition = document.querySelector(".ai-transition");
    var transitionArt = document.querySelector(".ai-transition__art");
    var firstProject = document.querySelector(".project-stage.ps1");
    if (transition && transitionArt && firstProject) {
      var viewBox = { x: 0, y: 0, width: 1000, height: 500 };
      function updateTransitionViewBox() {
        transitionArt.setAttribute("viewBox",
          [viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(" "));
      }
      var transitionTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: transition,
          start: "top top",
          end: "bottom bottom",
          scrub: .8,
          pin: ".ai-transition__pin",
          anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });
      transitionTimeline
        .to(viewBox, {
          x: 211, y: 340.5, width: 38, height: 19, duration: .92, ease: "none",
          onUpdate: updateTransitionViewBox
        }, 0)
        .to([transitionArt, ".ai-transition__line"], {
          opacity: 0, duration: .32, ease: "none"
        }, .68)
        .to(".ai-transition__index, .ai-transition__caption", {
          opacity: 0, duration: .2, ease: "none"
        }, .62)
        .fromTo(".projects__head .eyebrow",
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: .3, ease: "expo.out" }, .62)
        .fromTo(".projects .reveal-line",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: .3, stagger: .04, ease: "expo.out" }, .62)
        .fromTo(firstProject,
          { "--stage-clip": "100%" },
          { "--stage-clip": "0%", duration: .3, ease: "none" }, .68);
    }

    initProjectShowcase();
    initAnimatedLines();
    finishLoading();
  }

  if (menuToggle) menuToggle.addEventListener("click", function () {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
  });
  if (menuClose) menuClose.addEventListener("click", function () { setMenu(false); });
  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href^='#']");
    if (!link || !smoothScrollbar) return;

    var targetId = link.getAttribute("href").slice(1);
    if (!targetId) return;
    var target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    if (link.closest(".menu-panel")) setMenu(false);
    if (target === smoothScrollElement) {
      smoothScrollbar.scrollTo(0, 0, 1200);
      return;
    }
    var targetPosition = target.getBoundingClientRect().top -
      smoothScrollElement.getBoundingClientRect().top + smoothScrollbar.scrollTop;
    smoothScrollbar.scrollTo(0, Math.max(0, targetPosition), 1200);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") setMenu(false);
  });

  document.body.classList.add("is-loading");
  window.addEventListener("resize", function () {
    fitHeroTitle();
    if (smoothScrollbar) smoothScrollbar.update();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
  loadAssets().then(function () {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        fitHeroTitle();
        initAnimations();
      });
    } else {
      fitHeroTitle();
      initAnimations();
    }
  });
  initCursor();
  initMagnetic();
})();
