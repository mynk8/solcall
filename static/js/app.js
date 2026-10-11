/**
 * SolCall - Main Application Controller
 * Handles global navigation, screen switching, alerts simulation,
 * and regulatory provenance inspection.
 */

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initSolCallMap();
  initCalculator();
  initQuoteChecker();
  initReferenceIndex();
  initDataCatalog();
});

function initNavigation() {
  const navTabs = document.querySelectorAll(".nav-tab-btn");
  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetScreen = tab.dataset.target;
      switchScreen(targetScreen);
    });
  });
}

function switchScreen(screenId) {
  // Update active tab buttons
  document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === screenId);
  });

  // Update visible screens
  document.querySelectorAll(".product-screen").forEach((screen) => {
    screen.classList.toggle("active-screen", screen.id === screenId);
  });

  // If returning to map, resize map canvas
  if (screenId === "screen-map" && typeof solcallMap !== "undefined" && solcallMap) {
    setTimeout(() => {
      solcallMap.resize();
    }, 150);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Modal Controllers
function openSubsidyGuideModal() {
  const modal = document.getElementById("subsidy-guide-modal");
  if (modal) modal.style.display = "flex";
}

function closeSubsidyGuideModal() {
  const modal = document.getElementById("subsidy-guide-modal");
  if (modal) modal.style.display = "none";
}

function openAlertsModal() {
  const modal = document.getElementById("alerts-modal");
  if (modal) modal.style.display = "flex";
}

function closeAlertsModal() {
  const modal = document.getElementById("alerts-modal");
  if (modal) modal.style.display = "none";
}

function openProvenanceDrawer() {
  const drawer = document.getElementById("provenance-drawer");
  if (drawer) drawer.classList.add("drawer-open");
}

function closeProvenanceDrawer() {
  const drawer = document.getElementById("provenance-drawer");
  if (drawer) drawer.classList.remove("drawer-open");
}
