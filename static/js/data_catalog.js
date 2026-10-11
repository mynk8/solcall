/**
 * SolCall - Data Catalog & Live API Console (Screen 6)
 * Pitch screen offering feed downloads and an interactive API test bench
 * for solar lenders, fintechs, and power distribution utilities (DISCOMs).
 */

function initDataCatalog() {
  const apiTestBtn = document.getElementById("btn-test-api");
  if (apiTestBtn) {
    apiTestBtn.addEventListener("click", executeApiConsoleTest);
  }
}

async function executeApiConsoleTest() {
  const reqTextarea = document.getElementById("api-request-payload");
  const resViewer = document.getElementById("api-response-viewer");
  const statusBadge = document.getElementById("api-status-badge");

  if (!reqTextarea || !resViewer) return;

  statusBadge.textContent = "Running 25-yr Simulation...";
  statusBadge.className = "api-badge badge-pending";

  try {
    const payload = JSON.parse(reqTextarea.value);
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      statusBadge.textContent = "200 OK (Processed by ECS Fargate)";
      statusBadge.className = "api-badge badge-success";
      resViewer.textContent = JSON.stringify(data, null, 2);
    } else {
      statusBadge.textContent = `Error ${response.status}`;
      statusBadge.className = "api-badge badge-error";
      resViewer.textContent = await response.text();
    }
  } catch (err) {
    statusBadge.textContent = "Request Failed";
    statusBadge.className = "api-badge badge-error";
    resViewer.textContent = `Error: ${err.message}`;
  }
}
