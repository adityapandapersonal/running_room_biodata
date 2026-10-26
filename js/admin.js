/**
 * Admin Studio Controller
 * Handles Persistent Login, Profile Creation, Editing, Photo Uploads,
 * GitHub REST API Commits, Dynamic QR Studio, and Live Checkpoints Modal.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ----------------------------------------------------
  // 1. Cache ALL DOM Elements FIRST (Prevents any TDZ ReferenceErrors)
  // ----------------------------------------------------
  const ghClient = new window.GitHubClient();
  let currentMode = "new"; // 'new' | 'edit'
  let selectedPhotoFile = null;

  // ----------------------------------------------------
  // Floating Toast Notification Helper
  // ----------------------------------------------------
  function showToast(message, type = "info") {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "⚠️";

    toast.innerHTML = `<span style="font-size: 1.15rem; line-height: 1;">${icon}</span><span style="flex: 1;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      setTimeout(() => toast.remove(), 350);
    }, 3800);
  }
  window.showToast = showToast;

  // Login Gate Elements
  const loginGateOverlay = document.getElementById("loginGateOverlay");
  const adminApp = document.getElementById("adminApp");
  const loginForm = document.getElementById("loginForm");
  const loginUsername = document.getElementById("loginUsername");
  const loginPassword = document.getElementById("loginPassword");
  const loginErrorMsg = document.getElementById("loginErrorMsg");
  const loginCard = document.getElementById("loginCard");
  const btnTogglePassword = document.getElementById("btnTogglePassword");
  const btnLogout = document.getElementById("btnLogout");

  // Mode Switchers
  const tabNew = document.getElementById("tabModeNew");
  const tabEdit = document.getElementById("tabModeEdit");
  const editSelectorSec = document.getElementById("editSelectorSection");
  const selectPerson = document.getElementById("selectExistingPerson");
  const btnRefreshRegistry = document.getElementById("btnRefreshRegistry");
  const btnForceLoadPerson = document.getElementById("btnForceLoadPerson");

  // Form Fields
  const biodataForm = document.getElementById("biodataForm");
  const personIdInput = document.getElementById("personId");
  const fullNameInput = document.getElementById("fullName");
  const livePermalinkPreview = document.getElementById("livePermalinkPreview");
  const adminPermalinkDisplay = document.getElementById("adminPermalinkDisplay");
  const adminQrCanvas = document.getElementById("adminQrCanvas");
  const adminQrNameDisplay = document.getElementById("adminQrNameDisplay");
  const photoFileInput = document.getElementById("photoFileInput");
  const photoPreviewImg = document.getElementById("photoPreviewImg");
  const existingPhotoPath = document.getElementById("existingPhotoPath");

  const signatureFileInput = document.getElementById("signatureFileInput");
  const signaturePreviewImg = document.getElementById("signaturePreviewImg");
  const existingSignaturePath = document.getElementById("existingSignaturePath");
  let selectedSignatureFile = null;

  const btnAddCustomField = document.getElementById("btnAddCustomField");
  const customFieldsList = document.getElementById("customFieldsList");

  const btnSubmit = document.getElementById("btnSubmitForm");
  const btnSubmitText = document.getElementById("btnSubmitText");
  const btnReset = document.getElementById("btnResetForm");
  const btnDeletePerson = document.getElementById("btnDeletePerson");

  // Sidebar Controls
  const btnDownloadQr = document.getElementById("btnDownloadQr");
  const btnCopyLink = document.getElementById("btnCopyLink");
  const btnTestLiveProfile = document.getElementById("btnTestLiveProfile");
  const navViewProfileBtn = document.getElementById("navViewProfileBtn");

  // GitHub Settings Modal Elements
  const settingsModal = document.getElementById("settingsModal");
  const btnOpenSettings = document.getElementById("btnOpenSettings");
  const btnCloseSettings = document.getElementById("btnCloseSettingsModal");
  const btnSaveSettings = document.getElementById("btnSaveGithubSettings");
  const btnClearToken = document.getElementById("btnClearToken");
  const ghStatusBadge = document.getElementById("ghStatusBadge");

  const cfgUsername = document.getElementById("cfgUsername");
  const cfgRepo = document.getElementById("cfgRepo");
  const cfgBranch = document.getElementById("cfgBranch");
  const cfgToken = document.getElementById("cfgToken");

  // Progress Modal Elements
  const progressModal = document.getElementById("progressModal");
  const progressFooter = document.getElementById("progressFooter");
  const progressErrorBox = document.getElementById("progressErrorBox");
  const progressErrorText = document.getElementById("progressErrorText");
  const progressErrorActions = document.getElementById("progressErrorActions");
  const btnProgressViewProfile = document.getElementById("btnProgressViewProfile");
  const btnCloseProgressModal = document.getElementById("btnCloseProgressModal");
  const btnCloseProgressModalErr = document.getElementById("btnCloseProgressModalErr");

  // Helper to resolve instant photo URL without waiting for GitHub Pages build
  function resolvePhotoUrl(photoPath) {
    if (!photoPath) return "assets/photos/demo-aditya.svg";
    if (photoPath.startsWith("http://") || photoPath.startsWith("https://") || photoPath.startsWith("data:")) {
      return photoPath;
    }
    const cfg = window.APP_CONFIG;
    return `https://raw.githubusercontent.com/${cfg.githubUsername}/${cfg.githubRepo}/${cfg.branch}/${photoPath}?t=${Date.now()}`;
  }

  // Helper to resolve instant signature URL
  function resolveSignatureUrl(sigPath) {
    if (!sigPath) return "assets/signatures/sample-signature.svg";
    if (sigPath.startsWith("http://") || sigPath.startsWith("https://") || sigPath.startsWith("data:")) {
      return sigPath;
    }
    const cfg = window.APP_CONFIG;
    return `https://raw.githubusercontent.com/${cfg.githubUsername}/${cfg.githubRepo}/${cfg.branch}/${sigPath}?t=${Date.now()}`;
  }

  // ----------------------------------------------------
  // 2. Live QR Code Generation & Download
  // ----------------------------------------------------
  function updateQrCode(id) {
    try {
      const cleanId = (id || "demo-person").trim();
      const permalink = `${window.APP_CONFIG.getBaseUrl()}?id=${encodeURIComponent(cleanId)}`;
      
      if (livePermalinkPreview) livePermalinkPreview.textContent = permalink;
      if (adminPermalinkDisplay) adminPermalinkDisplay.textContent = permalink;
      if (btnTestLiveProfile) btnTestLiveProfile.href = permalink;

      if (adminQrCanvas && typeof QRCode !== "undefined") {
        adminQrCanvas.innerHTML = "";
        new QRCode(adminQrCanvas, {
          text: permalink,
          width: 196,
          height: 196,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });

        // Hide duplicate canvas so only the clean <img> renders
        setTimeout(() => {
          const cvs = adminQrCanvas.querySelector("canvas");
          const img = adminQrCanvas.querySelector("img");
          if (img && img.src && cvs) {
            cvs.style.display = "none";
          }
        }, 30);
      }
    } catch (e) {
      console.warn("QR generation error:", e);
    }
  }

  // ----------------------------------------------------
  // 2b. Live QR Code Name Display & Dynamic Sizing
  // ----------------------------------------------------
  function updateQrNameDisplay(forcedName) {
    const qrNameEl = document.getElementById("adminQrNameDisplay");
    if (!qrNameEl) return;
    const nameVal = (forcedName !== undefined && forcedName !== null)
      ? String(forcedName).trim()
      : (fullNameInput ? fullNameInput.value.trim() : "");

    qrNameEl.textContent = nameVal || "Employee Name";

    // Dynamic typography scaling for long names so it never breaks
    if (nameVal.length > 32) {
      qrNameEl.style.fontSize = "0.76rem";
      qrNameEl.style.lineHeight = "1.2";
    } else if (nameVal.length > 20) {
      qrNameEl.style.fontSize = "0.84rem";
      qrNameEl.style.lineHeight = "1.25";
    } else {
      qrNameEl.style.fontSize = "0.92rem";
      qrNameEl.style.lineHeight = "1.3";
    }
  }

  // ----------------------------------------------------
  // 3. Persistent Authentication Handling
  // ----------------------------------------------------
  const authConfig = window.APP_CONFIG.adminAuth || { enabled: false };

  function checkSession() {
    if (!authConfig.enabled) {
      unlockDashboard();
      return;
    }
    const isAuthenticated = localStorage.getItem(authConfig.sessionKey) === "true";
    if (isAuthenticated) {
      unlockDashboard();
    } else {
      lockDashboard();
    }
  }

  function unlockDashboard() {
    if (loginGateOverlay) loginGateOverlay.style.display = "none";
    if (adminApp) adminApp.style.display = "block";
    initDashboard();
  }

  function lockDashboard() {
    if (loginGateOverlay) loginGateOverlay.style.display = "flex";
    if (adminApp) adminApp.style.display = "none";
    if (loginUsername) loginUsername.value = "";
    if (loginPassword) loginPassword.value = "";
    if (loginErrorMsg) loginErrorMsg.style.display = "none";
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const enteredUser = loginUsername.value.trim();
      const enteredPass = loginPassword.value;

      if (enteredUser === authConfig.username && enteredPass === authConfig.password) {
        localStorage.setItem(authConfig.sessionKey, "true");
        unlockDashboard();
        showToast(`Welcome back, ${enteredUser}!`, "success");
      } else {
        loginErrorMsg.style.display = "block";
        loginCard.classList.remove("shake-anim");
        void loginCard.offsetWidth;
        loginCard.classList.add("shake-anim");
      }
    });
  }

  if (btnTogglePassword) {
    btnTogglePassword.addEventListener("click", () => {
      const isPass = loginPassword.type === "password";
      loginPassword.type = isPass ? "text" : "password";
      btnTogglePassword.textContent = isPass ? "🙈" : "👁️";
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem(authConfig.sessionKey);
      lockDashboard();
      showToast("Logged out successfully.", "info");
    });
  }

  // ----------------------------------------------------
  // 4. Dashboard Initialization
  // ----------------------------------------------------
  function initDashboard() {
    // If pre-configured default token exists and no token saved yet, auto-save
    if (window.APP_CONFIG.defaultGithubToken && !ghClient.hasToken()) {
      ghClient.setToken(window.APP_CONFIG.defaultGithubToken);
    }

    checkGitHubConnection();
    loadSettingsIntoModal();
    updateQrCode(personIdInput ? personIdInput.value : "demo-person");
    updateQrNameDisplay();

    if (navViewProfileBtn) {
      navViewProfileBtn.href = window.APP_CONFIG.getBaseUrl();
    }

    // Auto-load profile if ?edit=<id> is present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get("edit");
    if (editId && tabEdit) {
      setTimeout(() => {
        tabEdit.click();
        setTimeout(() => {
          if (selectPerson) {
            selectPerson.value = editId;
            loadSelectedPersonDetails(editId);
          }
        }, 500);
      }, 200);
    }
  }

  // ----------------------------------------------------
  // 5. Mode Switching (New vs Edit)
  // ----------------------------------------------------
  if (tabNew) {
    tabNew.addEventListener("click", () => {
      currentMode = "new";
      tabNew.classList.add("active");
      tabEdit.classList.remove("active");
      if (editSelectorSec) editSelectorSec.style.display = "none";
      if (personIdInput) personIdInput.readOnly = false;
      if (btnSubmitText) btnSubmitText.textContent = "💾 Save & Commit to GitHub";
      if (btnDeletePerson) btnDeletePerson.style.display = "none";
      resetForm();
    });
  }

  if (tabEdit) {
    tabEdit.addEventListener("click", async () => {
      currentMode = "edit";
      tabEdit.classList.add("active");
      tabNew.classList.remove("active");
      if (editSelectorSec) editSelectorSec.style.display = "block";
      if (btnSubmitText) btnSubmitText.textContent = "🔄 Update & Commit Changes";
      await populateRegistryDropdown();
    });
  }

  // ----------------------------------------------------
  // 6. Dynamic Slug / ID Generation
  // ----------------------------------------------------
  if (fullNameInput) {
    fullNameInput.addEventListener("input", () => {
      updateQrNameDisplay();
      if (currentMode === "new" && personIdInput && !personIdInput.dataset.manuallyEdited) {
        const slug = fullNameInput.value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        personIdInput.value = slug;
        updateQrCode(slug || "demo-person");
      }
    });
  }

  if (personIdInput) {
    personIdInput.addEventListener("input", () => {
      personIdInput.dataset.manuallyEdited = "true";
      if (currentMode === "new") {
        const val = personIdInput.value;
        const cleaned = val.replace(/\s+/g, "-");
        if (cleaned !== val) {
          const pos = personIdInput.selectionStart;
          personIdInput.value = cleaned;
          personIdInput.setSelectionRange(pos, pos);
        }
      }
      updateQrCode(personIdInput.value.trim() || "demo-person");
    });
  }

  // ----------------------------------------------------
  // 7. Photo Selection & Live Preview
  // ----------------------------------------------------
  if (photoFileInput) {
    photoFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedPhotoFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
          if (photoPreviewImg) photoPreviewImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener("click", () => {
      const link = adminPermalinkDisplay ? adminPermalinkDisplay.textContent : "";
      if (link) {
        navigator.clipboard.writeText(link).then(() => {
          showToast("Permanent URL copied to clipboard!", "success");
        });
      }
    });
  }

  if (btnDownloadQr) {
    btnDownloadQr.addEventListener("click", () => {
      const sourceCanvas = adminQrCanvas ? adminQrCanvas.querySelector("canvas") : null;
      const sourceImg = adminQrCanvas ? adminQrCanvas.querySelector("img") : null;
      const sourceEl = sourceCanvas || sourceImg;

      if (!sourceEl) {
        showToast("QR code not ready yet, please wait...", "error");
        return;
      }

      const rawName = fullNameInput ? fullNameInput.value.trim() : "";
      const displayName = rawName || "Employee Name";
      const personId = personIdInput ? personIdInput.value.trim() : "biodata";
      const idCardNoEl = document.getElementById("idCardNo");
      const idCardNo = idCardNoEl ? idCardNoEl.value.trim() : "";

      // Canvas dimensions for crisp print quality with ample quiet zone
      const canvasWidth = 600;
      const qrSize = 460;
      const paddingX = Math.round((canvasWidth - qrSize) / 2); // 70px left & right safe margin
      const paddingTop = 45; // 45px top margin

      const offscreen = document.createElement("canvas");
      const ctx = offscreen.getContext("2d");

      // Adaptive font sizing based on length of name
      let fontSize = 28;
      if (displayName.length > 34) {
        fontSize = 20;
      } else if (displayName.length > 24) {
        fontSize = 23;
      } else if (displayName.length > 16) {
        fontSize = 26;
      }

      ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", -apple-system, Roboto, Arial, sans-serif`;

      // Word wrapping logic so long names fit gracefully
      const maxTextWidth = canvasWidth - 60; // 540px
      const words = displayName.split(" ");
      const lines = [];
      let currentLine = "";

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      const lineHeight = Math.round(fontSize * 1.35);
      const textBlockHeight = lines.length * lineHeight;
      const dividerY = paddingTop + qrSize + 20;
      const textStartY = dividerY + 22;
      const subText = idCardNo ? `ID: ${idCardNo}` : "";
      const subTextHeight = subText ? 24 : 0;
      const paddingBottom = 38;
      const canvasHeight = textStartY + textBlockHeight + subTextHeight + paddingBottom;

      offscreen.width = canvasWidth;
      offscreen.height = canvasHeight;

      // Pure white card background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Clean subtle outer border
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvasWidth - 4, canvasHeight - 4);

      // Draw QR Code centered with ample quiet zone
      ctx.drawImage(sourceEl, paddingX, paddingTop, qrSize, qrSize);

      // Draw sleek divider line
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(paddingX, dividerY);
      ctx.lineTo(canvasWidth - paddingX, dividerY);
      ctx.stroke();

      // Draw Employee Name
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", -apple-system, Roboto, Arial, sans-serif`;

      let currentY = textStartY;
      for (let j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], canvasWidth / 2, currentY);
        currentY += lineHeight;
      }

      // Draw Subtitle / ID Card No if available
      if (subText) {
        ctx.fillStyle = "#64748b";
        ctx.font = `600 16px "Inter", "Segoe UI", -apple-system, Roboto, Arial, sans-serif`;
        ctx.fillText(subText, canvasWidth / 2, currentY + 6);
      }

      try {
        const downloadUrl = offscreen.toDataURL("image/png");
        const safeName = displayName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const safeId = personId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const fileName = `QR_${safeName}_${safeId}.png`;

        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast(`Downloaded ${fileName} with quiet zone border & name!`, "success");
      } catch (err) {
        console.error("Export PNG error:", err);
        showToast("Could not generate styled QR PNG", "error");
      }
    });
  }

  // ----------------------------------------------------
  // 8. Employee Signature Upload & Camera Capture Preview
  // ----------------------------------------------------
  if (signatureFileInput) {
    signatureFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedSignatureFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
          if (signaturePreviewImg) signaturePreviewImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ----------------------------------------------------
  // 8b. Dynamic Custom Details (Pencil Field Adder)
  // ----------------------------------------------------
  function addCustomFieldRow(field = { label: "", value: "" }) {
    if (!customFieldsList) return;
    const row = document.createElement("div");
    row.className = "custom-field-row-item";
    row.style.cssText = "display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius-md); padding: 12px;";
    
    row.innerHTML = `
      <div style="flex: 1.2;">
        <label style="font-size: 0.76rem; color: var(--text-muted); display: block; margin-bottom: 4px; font-weight: 600;">✏️ Detail Heading / Label</label>
        <input type="text" class="form-control custom-field-label" placeholder="e.g. PF Number, Station, Emergency Contact" value="${escapeAttr(field.label || "")}">
      </div>
      <div style="flex: 1.8;">
        <label style="font-size: 0.76rem; color: var(--text-muted); display: block; margin-bottom: 4px; font-weight: 600;">Value / Detail</label>
        <input type="text" class="form-control custom-field-val" placeholder="e.g. 5020084321, Bilaspur, 9876543210" value="${escapeAttr(field.value || "")}">
      </div>
      <button type="button" class="btn-remove-custom" title="Remove Field" style="margin-top: 22px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 6px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.1rem; line-height: 1;">
        &times;
      </button>
    `;

    row.querySelector(".btn-remove-custom").onclick = () => row.remove();
    customFieldsList.appendChild(row);
  }

  function collectCustomFields() {
    if (!customFieldsList) return [];
    const rows = customFieldsList.querySelectorAll(".custom-field-row-item");
    const arr = [];
    rows.forEach(r => {
      const label = r.querySelector(".custom-field-label")?.value.trim() || "";
      const value = r.querySelector(".custom-field-val")?.value.trim() || "";
      if (label || value) {
        arr.push({ label, value });
      }
    });
    return arr;
  }

  if (btnAddCustomField) {
    btnAddCustomField.addEventListener("click", () => {
      addCustomFieldRow();
      showToast("✏️ New custom field row added! Enter heading and value.", "info");
    });
  }

  // ----------------------------------------------------
  // 9. Dropdown for Editing Existing Profiles (Zero-Click Auto-Fill)
  // ----------------------------------------------------
  async function populateRegistryDropdown(preserveSelectedId = null) {
    if (!selectPerson) return;
    const previousSelection = (preserveSelectedId || selectPerson.value || "").trim();
    const statusNotice = document.getElementById("loadStatusNotice");
    if (statusNotice) {
      statusNotice.innerHTML = `<span>⏳</span> <span style="color: var(--accent-secondary);">Fetching registered profiles from GitHub...</span>`;
    }
    selectPerson.innerHTML = '<option value="">Loading registered persons from GitHub...</option>';

    try {
      const reg = await ghClient.getRegistry();
      selectPerson.innerHTML = '<option value="">-- Choose a person to edit --</option>';

      if (reg.profiles && reg.profiles.length > 0) {
        reg.profiles.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.fullName || "Unnamed"} (${p.id})`;
          selectPerson.appendChild(opt);
        });

        // Smart selection: keep existing or preserved selection if valid
        let chosenIdx = -1;
        if (previousSelection) {
          chosenIdx = Array.from(selectPerson.options).findIndex((o) => o.value === previousSelection);
        }

        // If no prior selection, prioritize sheshu-dev-panda or index 1
        if (chosenIdx <= 0 && selectPerson.options.length >= 2) {
          const sheshuIdx = Array.from(selectPerson.options).findIndex((o) => o.value === "sheshu-dev-panda");
          chosenIdx = sheshuIdx > 0 ? sheshuIdx : 1;
        }

        if (chosenIdx > 0) {
          selectPerson.selectedIndex = chosenIdx;
        }

        if (statusNotice) {
          statusNotice.innerHTML = `<span>⚡</span> <span>Auto-fill ready. Selecting any person instantly fills all details.</span>`;
        }
      } else {
        selectPerson.innerHTML = '<option value="">No profiles found in registry</option>';
        if (statusNotice) {
          statusNotice.innerHTML = `<span>⚠️</span> <span>No registered profiles found in repository.</span>`;
        }
      }
    } catch (err) {
      console.error("Registry load error:", err);
      selectPerson.innerHTML = '<option value="">Failed to load profiles list</option>';
      showToast("Error loading registry: " + err.message, "error");
      if (statusNotice) {
        statusNotice.innerHTML = `<span>❌</span> <span style="color: #f87171;">Failed to load registry: ${err.message}</span>`;
      }
      return;
    }

    // Zero-click instant load: automatically populate form for the selected person!
    if (selectPerson.value) {
      await loadSelectedPersonDetails(selectPerson.value);
    }
  }

  async function loadSelectedPersonDetails(targetId = null) {
    if (!selectPerson) return;
    const id = (targetId || selectPerson.value || "").trim();
    if (!id) {
      console.log("No person ID selected for auto-fill");
      return;
    }

    // Keep dropdown selection synchronized if passed programmatically
    if (selectPerson.value !== id) {
      selectPerson.value = id;
    }

    const statusNotice = document.getElementById("loadStatusNotice");
    if (statusNotice) {
      statusNotice.innerHTML = `<span>⏳</span> <span style="color: var(--accent-secondary);">Fetching full profile JSON for <strong>${id}</strong>...</span>`;
    }

    try {
      console.log(`[Auto-Fill] Loading profile JSON for '${id}'...`);
      const profile = await ghClient.getProfileById(id);
      populateFormWithProfile(profile);

      if (btnDeletePerson) {
        btnDeletePerson.style.display = "inline-flex";
      }

      if (statusNotice) {
        statusNotice.innerHTML = `<span>✅</span> <span style="color: #34d399; font-weight: 600;">Details loaded for <strong>${profile.fullName || id}</strong> directly from JSON!</span>`;
      }
      showToast(`Auto-filled details for "${profile.fullName || id}"!`, "success");
    } catch (err) {
      console.error("Profile auto-fill error:", err);
      if (statusNotice) {
        statusNotice.innerHTML = `<span>❌</span> <span style="color: #f87171;">Could not load profile: ${err.message}</span>`;
      }
      showToast(`Could not load profile: ${err.message}`, "error");
    }
  }

  // Zero-click instant event listeners: fires instantly on selection change or input
  if (selectPerson) {
    selectPerson.addEventListener("change", (e) => {
      if (e.target.value) {
        loadSelectedPersonDetails(e.target.value);
      }
    });
    selectPerson.addEventListener("input", (e) => {
      if (e.target.value) {
        loadSelectedPersonDetails(e.target.value);
      }
    });
  }

  if (btnRefreshRegistry) {
    btnRefreshRegistry.addEventListener("click", async () => {
      showToast("Refreshing profile list from GitHub...", "info");
      await populateRegistryDropdown();
      showToast("Profile list refreshed!", "success");
    });
  }

  if (btnForceLoadPerson) {
    btnForceLoadPerson.addEventListener("click", () => {
      if (selectPerson && selectPerson.value) {
        loadSelectedPersonDetails(selectPerson.value);
      }
    });
  }

  function populateFormWithProfile(p) {
    if (!p) {
      console.warn("populateFormWithProfile received empty data");
      return;
    }
    console.log("[Auto-Fill] Populating form with profile:", p);

    // 1. Unique ID / Slug (Locked in edit mode to preserve URL and QR code)
    if (personIdInput) {
      personIdInput.value = p.id || "";
      personIdInput.readOnly = true;
      personIdInput.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
      personIdInput.style.cursor = "not-allowed";
    }

    // 2. Full Name
    if (fullNameInput) {
      fullNameInput.value = p.fullName || "";
      updateQrNameDisplay(p.fullName);
    }

    // Helper for safe input assignment
    const setSafeVal = (elemId, val) => {
      const el = document.getElementById(elemId);
      if (el) {
        el.value = (val !== undefined && val !== null) ? val : "";
      } else {
        console.warn(`Element #${elemId} not found in DOM`);
      }
    };

    // 3. Official Running Room Particulars (18 fields)
    setSafeVal("idCardNo", p.idCardNo || "");
    setSafeVal("designation", p.designation || "");
    setSafeVal("fatherName", p.fatherName || "");
    setSafeVal("motherName", p.motherName || "");
    setSafeVal("husbandName", p.husbandName || "");

    // Normalize DOB for HTML5 <input type="date"> (requires YYYY-MM-DD)
    let cleanDob = (p.dob || "").trim();
    if (cleanDob && cleanDob.includes("/")) {
      const parts = cleanDob.split("/");
      if (parts.length === 3 && parts[2].length === 4) {
        cleanDob = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
    setSafeVal("dob", cleanDob.slice(0, 10));

    setSafeVal("gender", p.gender || "");
    setSafeVal("maritalStatus", p.maritalStatus || "");
    setSafeVal("bloodGroup", p.bloodGroup || "");
    setSafeVal("aadhaarNumber", p.aadhaarNumber || "");
    setSafeVal("mobileNumber", p.mobileNumber || p.phone || "");
    setSafeVal("email", p.email || "");
    setSafeVal("residentialAddress", p.residentialAddress || p.address || "");

    setSafeVal("policeVerifDoneDate", (p.policeVerifDoneDate || "").slice(0, 10));
    setSafeVal("policeVerifDueDate", (p.policeVerifDueDate || "").slice(0, 10));
    setSafeVal("medicalExamDoneDate", (p.medicalExamDoneDate || "").slice(0, 10));
    setSafeVal("medicalExamDueDate", (p.medicalExamDueDate || "").slice(0, 10));
    setSafeVal("identificationMarks", p.identificationMarks || "");
    setSafeVal("joiningDateRR", (p.joiningDateRR || "").slice(0, 10));

    // 4. Photo Preview (with instant raw URL)
    if (existingPhotoPath) {
      existingPhotoPath.value = p.photo || "assets/photos/demo-aditya.svg";
    }
    if (photoPreviewImg) {
      photoPreviewImg.src = resolvePhotoUrl(p.photo);
      photoPreviewImg.onerror = () => {
        photoPreviewImg.src = "assets/photos/demo-aditya.svg";
      };
    }
    selectedPhotoFile = null;

    // 5. Signature of Employee Preview
    if (existingSignaturePath) {
      existingSignaturePath.value = p.signature || "assets/signatures/sample-signature.svg";
    }
    if (signaturePreviewImg) {
      signaturePreviewImg.src = resolveSignatureUrl(p.signature);
      signaturePreviewImg.onerror = () => {
        signaturePreviewImg.src = "assets/signatures/sample-signature.svg";
      };
    }
    selectedSignatureFile = null;

    // 6. Custom Details Added via Pencil
    if (customFieldsList) {
      customFieldsList.innerHTML = "";
      if (Array.isArray(p.customFields) && p.customFields.length > 0) {
        p.customFields.forEach(cf => addCustomFieldRow(cf));
      }
    }

    // 8. Update Live QR Code and Permalinks
    if (p.id) {
      updateQrCode(p.id);
    }

    // 9. Update Submit Button Text to clearly show person
    if (btnSubmitText) {
      btnSubmitText.textContent = `🔄 Update & Commit Changes (${p.fullName || p.id})`;
    }

    // 10. Subtle glow animation on form to visually confirm auto-fill
    if (biodataForm) {
      biodataForm.style.transition = "box-shadow 0.4s ease";
      biodataForm.style.boxShadow = "0 0 25px rgba(168, 85, 247, 0.45)";
      setTimeout(() => {
        biodataForm.style.boxShadow = "";
      }, 700);
    }
  }

  // ----------------------------------------------------
  // 10. Live Progress Modal Checkpoints Controller
  // ----------------------------------------------------
  const stepsMap = {
    validate: document.getElementById("pstep-validate"),
    photo: document.getElementById("pstep-photo"),
    json: document.getElementById("pstep-json"),
    registry: document.getElementById("pstep-registry"),
    qr: document.getElementById("pstep-qr")
  };

  function setStepState(stepKey, state, descText = null) {
    const el = stepsMap[stepKey];
    if (!el) return;

    el.classList.remove("running", "done", "skipped", "error");
    const iconEl = el.querySelector(".step-status-icon");
    const descEl = el.querySelector(".step-desc");

    if (descText && descEl) {
      descEl.textContent = descText;
    }

    if (state === "running") {
      el.classList.add("running");
      if (iconEl) iconEl.innerHTML = '<span class="step-spinner"></span>';
    } else if (state === "done") {
      el.classList.add("done");
      if (iconEl) iconEl.textContent = "✅";
    } else if (state === "skipped") {
      el.classList.add("skipped");
      if (iconEl) iconEl.textContent = "⏭️";
    } else if (state === "error") {
      el.classList.add("error");
      if (iconEl) iconEl.textContent = "❌";
    } else {
      if (iconEl) iconEl.textContent = "⚪";
    }
  }

  function resetProgressModal() {
    setStepState("validate", "pending", "Checking required fields and slug formatting");
    setStepState("photo", "pending", "Converting to Base64 and committing to assets/photos/");
    setStepState("json", "pending", "Writing record to data/profiles/{id}.json");
    setStepState("registry", "pending", "Updating data/registry.json for quick switcher");
    setStepState("qr", "pending", "Permanent URL activated on GitHub Pages");

    if (progressFooter) progressFooter.style.display = "none";
    if (progressErrorBox) progressErrorBox.style.display = "none";
    if (progressErrorActions) progressErrorActions.style.display = "none";
  }

  function openProgressModal() {
    resetProgressModal();
    if (progressModal) progressModal.classList.add("open");
  }

  function closeProgressModal() {
    if (progressModal) progressModal.classList.remove("open");
  }

  if (btnCloseProgressModal) btnCloseProgressModal.addEventListener("click", closeProgressModal);
  if (btnCloseProgressModalErr) btnCloseProgressModalErr.addEventListener("click", closeProgressModal);

  // ----------------------------------------------------
  // 11. Form Submission & GitHub Commit Pipeline
  // ----------------------------------------------------
  if (biodataForm) {
    biodataForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = personIdInput ? personIdInput.value.trim() : "";
      if (!id) {
        showToast("Please specify a Unique Person ID.", "error");
        if (personIdInput) personIdInput.focus();
        return;
      }

      const fullName = fullNameInput ? fullNameInput.value.trim() : "";
      if (!fullName) {
        showToast("Please enter Employee Name.", "error");
        if (fullNameInput) fullNameInput.focus();
        return;
      }

      // Check if GitHub PAT is configured
      if (!ghClient.hasToken()) {
        if (settingsModal) settingsModal.classList.add("open");
        showToast("Please connect your GitHub Personal Access Token first.", "error");
        return;
      }

      // Open live progress checkpoints modal
      openProgressModal();
      setStepState("validate", "running", "Validating details...");

      // Prepare Profile Object with all 18 Running Room particulars
      const getVal = (idStr) => {
        const el = document.getElementById(idStr);
        return el ? el.value.trim() : "";
      };

      const profileData = {
        id: id,
        idCardNo: getVal("idCardNo"),
        fullName: fullNameInput ? fullNameInput.value.trim() : "",
        designation: getVal("designation"),
        fatherName: getVal("fatherName"),
        motherName: getVal("motherName"),
        husbandName: getVal("husbandName"),
        dob: getVal("dob"),
        gender: getVal("gender"),
        maritalStatus: getVal("maritalStatus"),
        bloodGroup: getVal("bloodGroup"),
        aadhaarNumber: getVal("aadhaarNumber"),
        mobileNumber: getVal("mobileNumber"),
        phone: getVal("mobileNumber"),
        email: getVal("email"),
        residentialAddress: getVal("residentialAddress"),
        address: getVal("residentialAddress"),
        policeVerifDoneDate: getVal("policeVerifDoneDate"),
        policeVerifDueDate: getVal("policeVerifDueDate"),
        medicalExamDoneDate: getVal("medicalExamDoneDate"),
        medicalExamDueDate: getVal("medicalExamDueDate"),
        identificationMarks: getVal("identificationMarks"),
        joiningDateRR: getVal("joiningDateRR"),
        photo: (existingPhotoPath && existingPhotoPath.value) ? existingPhotoPath.value : "assets/photos/demo-aditya.svg",
        signature: (existingSignaturePath && existingSignaturePath.value) ? existingSignaturePath.value : "assets/signatures/sample-signature.svg",
        customFields: collectCustomFields(),
        updatedAt: new Date().toISOString().split("T")[0]
      };

      setStepState("validate", "done", `All particulars verified for '${profileData.fullName}'`);

      if (btnSubmit) btnSubmit.disabled = true;

      try {
        const result = await ghClient.saveProfile(
          profileData,
          selectedPhotoFile,
          selectedSignatureFile,
          (step, status, detail) => {
            if (step === "photo_process" || step === "sig_process") {
              setStepState("photo", status, detail);
            } else if (step === "json_commit") {
              setStepState("json", status, detail);
            } else if (step === "registry_sync") {
              setStepState("registry", status, detail);
            } else if (step === "qr_ready") {
              setStepState("qr", status, detail);
            }
          }
        );

        if (result.photoPath && existingPhotoPath) {
          existingPhotoPath.value = result.photoPath;
          if (photoPreviewImg) photoPreviewImg.src = resolvePhotoUrl(result.photoPath);
        }
        if (result.signaturePath && existingSignaturePath) {
          existingSignaturePath.value = result.signaturePath;
          if (signaturePreviewImg) signaturePreviewImg.src = resolveSignatureUrl(result.signaturePath);
        }

        setStepState("qr", "done", `Live permanent link: ${result.profileUrl}`);
        if (btnProgressViewProfile) btnProgressViewProfile.href = result.profileUrl;
        if (progressFooter) progressFooter.style.display = "block";

        showToast(`🎉 Success! Biodata for '${profileData.fullName}' committed to GitHub.`, "success");

        await populateRegistryDropdown(result.id);
      } catch (err) {
        console.error("Save error:", err);
        if (progressErrorBox) {
          progressErrorBox.style.display = "block";
          if (progressErrorText) progressErrorText.textContent = `Commit Failed: ${err.message}`;
        }
        if (progressErrorActions) progressErrorActions.style.display = "block";
        showToast(`Failed: ${err.message}`, "error");
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnSubmitText) {
          btnSubmitText.textContent = currentMode === "new" ? "💾 Save & Commit to GitHub" : "🔄 Update & Commit Changes";
        }
      }
    });
  }

  function resetForm() {
    if (biodataForm) biodataForm.reset();
    if (existingPhotoPath) existingPhotoPath.value = "assets/photos/demo-aditya.svg";
    if (photoPreviewImg) photoPreviewImg.src = "assets/photos/demo-aditya.svg";
    selectedPhotoFile = null;
    if (existingSignaturePath) existingSignaturePath.value = "assets/signatures/sample-signature.svg";
    if (signaturePreviewImg) signaturePreviewImg.src = "assets/signatures/sample-signature.svg";
    selectedSignatureFile = null;
    if (customFieldsList) customFieldsList.innerHTML = "";
    if (personIdInput) {
      delete personIdInput.dataset.manuallyEdited;
      personIdInput.readOnly = false;
      personIdInput.style.backgroundColor = "";
      personIdInput.style.cursor = "";
    }
    if (btnSubmitText) {
      btnSubmitText.textContent = currentMode === "new" ? "💾 Save & Commit to GitHub" : "🔄 Update & Commit Changes";
    }
    if (btnDeletePerson) {
      btnDeletePerson.style.display = "none";
    }
    updateQrCode("demo-person");
    updateQrNameDisplay("Employee Name");
  }

  if (btnReset) btnReset.addEventListener("click", resetForm);

  // ----------------------------------------------------
  // 11b. Delete Person Handler
  // ----------------------------------------------------
  if (btnDeletePerson) {
    btnDeletePerson.addEventListener("click", async () => {
      const id = personIdInput ? personIdInput.value.trim() : "";
      const name = fullNameInput ? fullNameInput.value.trim() : id;
      if (!id) {
        showToast("Please choose a person to delete first.", "error");
        return;
      }

      const confirmed = confirm(
        `⚠️ Are you sure you want to permanently delete "${name}" (${id}) from GitHub repository?\n\nThis will remove the JSON record and registry entry immediately.`
      );
      if (!confirmed) return;

      if (!ghClient.hasToken()) {
        if (settingsModal) settingsModal.classList.add("open");
        showToast("Please connect your GitHub Personal Access Token first.", "error");
        return;
      }

      btnDeletePerson.disabled = true;
      btnDeletePerson.textContent = "⏳ Deleting...";

      try {
        await ghClient.deleteProfile(id);
        showToast(`🗑️ Person '${name}' deleted successfully from GitHub!`, "success");
        btnDeletePerson.style.display = "none";
        resetForm();
        await populateRegistryDropdown();
      } catch (err) {
        console.error("Delete error:", err);
        showToast("Failed to delete person: " + err.message, "error");
      } finally {
        btnDeletePerson.disabled = false;
        btnDeletePerson.textContent = "🗑️ Delete Person";
      }
    });
  }

  // ----------------------------------------------------
  // 12. GitHub Settings & Auth Modal
  // ----------------------------------------------------
  if (btnOpenSettings) btnOpenSettings.addEventListener("click", () => settingsModal && settingsModal.classList.add("open"));
  if (btnCloseSettings) btnCloseSettings.addEventListener("click", () => settingsModal && settingsModal.classList.remove("open"));

  function loadSettingsIntoModal() {
    if (cfgUsername) cfgUsername.value = window.APP_CONFIG.githubUsername || "";
    if (cfgRepo) cfgRepo.value = window.APP_CONFIG.githubRepo || "";
    if (cfgBranch) cfgBranch.value = window.APP_CONFIG.branch || "main";
    if (cfgToken) cfgToken.value = ghClient.getToken() || "";
  }

  async function checkGitHubConnection() {
    if (!ghStatusBadge) return;

    if (!ghClient.hasToken()) {
      ghStatusBadge.style.background = "rgba(239, 68, 68, 0.15)";
      ghStatusBadge.style.color = "#f87171";
      ghStatusBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
      ghStatusBadge.innerHTML = "<span>●</span> GitHub Disconnected";
      return;
    }

    try {
      ghStatusBadge.innerHTML = "<span>●</span> Checking...";
      const user = await ghClient.verifyAuth();
      ghStatusBadge.style.background = "rgba(16, 185, 129, 0.15)";
      ghStatusBadge.style.color = "#34d399";
      ghStatusBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
      ghStatusBadge.innerHTML = `<span class="pulse-dot"></span> Connected as @${user.login}`;
    } catch (e) {
      ghStatusBadge.style.background = "rgba(239, 68, 68, 0.15)";
      ghStatusBadge.style.color = "#f87171";
      ghStatusBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
      ghStatusBadge.innerHTML = "<span>●</span> Invalid Token";
    }
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      const username = cfgUsername ? cfgUsername.value.trim() : "";
      const repo = cfgRepo ? cfgRepo.value.trim() : "";
      const branch = cfgBranch ? cfgBranch.value.trim() : "main";
      const token = cfgToken ? cfgToken.value.trim() : "";

      if (!username || !repo || !token) {
        showToast("Username, Repo, and Token are all required.", "error");
        return;
      }

      ghClient.persistConfig(username, repo, branch);
      ghClient.setToken(token);

      btnSaveSettings.textContent = "Verifying...";
      btnSaveSettings.disabled = true;

      try {
        const user = await ghClient.verifyAuth();
        showToast(`Authenticated as @${user.login}! Settings saved.`, "success");
        if (settingsModal) settingsModal.classList.remove("open");
        await checkGitHubConnection();
        updateQrCode(personIdInput ? personIdInput.value : "demo-person");
      } catch (err) {
        showToast(`Verification failed: ${err.message}`, "error");
      } finally {
        btnSaveSettings.textContent = "Connect & Verify Token";
        btnSaveSettings.disabled = false;
      }
    });
  }

  if (btnClearToken) {
    btnClearToken.addEventListener("click", () => {
      ghClient.setToken("");
      if (cfgToken) cfgToken.value = "";
      showToast("GitHub token removed from this device.", "info");
      checkGitHubConnection();
    });
  }

  function escapeAttr(str) {
    if (typeof str !== "string") return str;
    return str.replace(/"/g, "&quot;");
  }

  // Run initial session check at the very end when all DOM & functions are ready
  checkSession();
});
