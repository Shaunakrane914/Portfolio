(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var progressBar = document.querySelector(".reading-progress span");
  var navToggle = document.getElementById("nav-toggle");
  var siteNav = document.getElementById("site-nav");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function updateProgress() {
    if (!progressBar) return;
    var scrollable = root.scrollHeight - window.innerHeight;
    var percent = scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0;
    progressBar.style.width = percent + "%";
  }

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!open));
      navToggle.textContent = open ? "Menu" : "Close";
      siteNav.classList.toggle("is-open", !open);
      body.classList.toggle("menu-open", !open);
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.textContent = "Menu";
        siteNav.classList.remove("is-open");
        body.classList.remove("menu-open");
      });
    });

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && siteNav.classList.contains("is-open")) {
        navToggle.click();
        navToggle.focus();
      }
    });
  }

  document.querySelectorAll("[data-evidence-viewer]").forEach(function (viewer) {
    var tabs = Array.from(viewer.querySelectorAll("[data-evidence-target]"));
    var panels = Array.from(viewer.querySelectorAll("[data-evidence-panel]"));

    function activateTab(tab) {
      var target = tab.getAttribute("data-evidence-target");

      tabs.forEach(function (item) {
        var selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });

      panels.forEach(function (panel) {
        var active = panel.getAttribute("data-evidence-panel") === target;
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      });
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        activateTab(tab);
      });

      tab.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        var direction = event.key === "ArrowRight" ? 1 : -1;
        var next = tabs[(index + direction + tabs.length) % tabs.length];
        activateTab(next);
        next.focus();
      });
    });
  });

  var revealItems = document.querySelectorAll("[data-reveal]");
  if (!revealItems.length) return;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8%" });

  revealItems.forEach(function (item) {
    observer.observe(item);
  });
})();
