/**
 * Admin Studio Controller
 * Handles Persistent Login, Profile Creation, Editing, Photo Uploads,
 * GitHub REST API Commits, Dynamic QR Studio, and Live Checkpoints Modal.
 */

document.addEventListener("DOMContentLoaded", () => {
  const ghClient = new window.GitHubClient();
  let currentMode = "new"; // 'new' | 'edit'
  let selectedPhotoFile = null;

  // ----------------------------------------------------
  // 1. Persistent Login Gate & Authentication Handling
  // ----------------------------------------------------
  const loginGateOverlay = document.getElementById("loginGateOverlay");
  const adminApp = document.getElementById("adminApp");
  const loginForm = document.getElementById("loginForm");
  const loginUsername = document.getElementById("loginUsername");
  const loginPassword = document.getElementById("loginPassword");
  const loginErrorMsg = document.getElementById("loginErrorMsg");
  const loginCard = document.getElementById("loginCard");
  const btnTogglePassword = document.getElementById("btnTogglePassword");
  const btnLogout = document.getElementById("btnLogout");

  const authConfig = window.APP_CONFIG.adminAuth || { enabled: false };

  function checkSession() {
    if (!authConfig.enabled) {
      unlockDashboard();
      return;
    }
    // Use localStorage so login persists across page refreshes and tabs!
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

  // Check login state immediately
  checkSession();

  // ----------------------------------------------------
  // 2. Dashboard Logic (Initialized on Unlock)
  // ----------------------------------------------------
  function initDashboard() {
    checkGitHubConnection();
    loadSettingsIntoModal();
    updateQrCode(personIdInput.value || "demo-person");

    const navViewProfileBtn = document.getElementById("navViewProfileBtn");
    if (navViewProfileBtn) {
      navViewProfileBtn.href = window.APP_CONFIG.getBaseUrl();
    }
  }

  // Cache DOM Elements
  const tabNew = document.getElementById("tabModeNew");
  const tabEdit = document.getElementById("tabModeEdit");
  const editSelectorSec = document.getElementById("editSelectorSection");
  const selectPerson = document.getElementById("selectExistingPerson");
  const btnRefreshRegistry = document.getElementById("btnRefreshRegistry");
  const btnForceLoadPerson = document.getElementById("btnForceLoadPerson");

  const personIdInput = document.getElementById("personId");
  const fullNameInput = document.getElementById("fullName");
  const livePermalinkPreview = document.getElementById("livePermalinkPreview");
  const adminPermalinkDisplay = document.getElementById("adminPermalinkDisplay");
  const adminQrCanvas = document.getElementById("adminQrCanvas");
  const photoFileInput = document.getElementById("photoFileInput");
  const photoPreviewImg = document.getElementById("photoPreviewImg");
  const existingPhotoPath = document.getElementById("existingPhotoPath");
  const btnSubmit = document.getElementById("btnSubmitForm");
  const btnSubmitText = document.getElementById("btnSubmitText");
  const btnReset = document.getElementById("btnResetForm");

  const btnAddEdu = document.getElementById("btnAddEdu");
  const eduList = document.getElementById("educationList");
  const btnAddExp = document.getElementById("btnAddExp");
  const expList = document.getElementById("experienceList");

  const btnDownloadQr = document.getElementById("btnDownloadQr");
  const btnCopyLink = document.getElementById("btnCopyLink");
  const btnTestLiveProfile = document.getElementById("btnTestLiveProfile");

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

  // ----------------------------------------------------
  // Mode Switching (New vs Edit)
  // ----------------------------------------------------
  if (tabNew) {
    tabNew.addEventListener("click", () => {
      currentMode = "new";
      tabNew.classList.add("active");
      tabEdit.classList.remove("active");
      editSelectorSec.style.display = "none";
      personIdInput.readOnly = false;
      btnSubmitText.textContent = "💾 Save & Commit to GitHub";
      resetForm();
    });
  }

  if (tabEdit) {
    tabEdit.addEventListener("click", async () => {
      currentMode = "edit";
      tabEdit.classList.add("active");
      tabNew.classList.remove("active");
      editSelectorSec.style.display = "block";
      btnSubmitText.textContent = "🔄 Update & Commit Changes";
      await populateRegistryDropdown();
    });
  }

  // ----------------------------------------------------
  // Dynamic Slug / ID Generation
  // ----------------------------------------------------
  fullNameInput.addEventListener("input", () => {
    if (currentMode === "new" && !personIdInput.dataset.manuallyEdited) {
      const slug = fullNameInput.value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      personIdInput.value = slug;
      updateQrCode(slug || "demo-person");
    }
  });

  personIdInput.addEventListener("input", () => {
    personIdInput.dataset.manuallyEdited = "true";
    updateQrCode(personIdInput.value.trim() || "demo-person");
  });

  // ----------------------------------------------------
  // Photo File Selection & Live Preview
  // ----------------------------------------------------
  photoFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedPhotoFile = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        photoPreviewImg.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // ----------------------------------------------------
  // Live QR Code Generation & Download
  // ----------------------------------------------------
  function updateQrCode(id) {
    const permalink = `${window.APP_CONFIG.getBaseUrl()}?id=${encodeURIComponent(id)}`;
    
    livePermalinkPreview.textContent = permalink;
    adminPermalinkDisplay.textContent = permalink;
    btnTestLiveProfile.href = permalink;

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
    }
  }

  btnCopyLink.addEventListener("click", () => {
    const link = adminPermalinkDisplay.textContent;
    navigator.clipboard.writeText(link).then(() => {
      showToast("Permanent URL copied to clipboard!", "success");
    });
  });

  btnDownloadQr.addEventListener("click", () => {
    const canvas = adminQrCanvas.querySelector("canvas");
    const img = adminQrCanvas.querySelector("img");
    const personId = personIdInput.value.trim() || "qr-code";

    let downloadUrl = "";
    if (canvas) {
      downloadUrl = canvas.toDataURL("image/png");
    } else if (img && img.src) {
      downloadUrl = img.src;
    }

    if (!downloadUrl) {
      showToast("Could not generate QR download image", "error");
      return;
    }

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `QR-${personId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloaded QR-${personId}.png! Ready for print.`, "success");
  });

  // ----------------------------------------------------
  // Dynamic Repeaters (Education & Experience)
  // ----------------------------------------------------
  btnAddEdu.addEventListener("click", () => addEducationRow());
  btnAddExp.addEventListener("click", () => addExperienceRow());

  function addEducationRow(edu = {}) {
    const row = document.createElement("div");
    row.className = "repeater-item";
    row.innerHTML = `
      <button type="button" class="repeater-remove-btn" title="Remove">&times;</button>
      <div class="form-row">
        <div class="form-group" style="margin-bottom: 0;">
          <label>Degree / Qualification</label>
          <input type="text" class="form-control edu-degree" value="${escapeAttr(edu.degree || "")}" placeholder="e.g. B.Tech Computer Science">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>School / University</label>
          <input type="text" class="form-control edu-institution" value="${escapeAttr(edu.institution || "")}" placeholder="e.g. National Institute of Tech">
        </div>
      </div>
      <div class="form-row" style="margin-top: 10px; margin-bottom: 0;">
        <div class="form-group" style="margin-bottom: 0;">
          <label>Year / Duration</label>
          <input type="text" class="form-control edu-year" value="${escapeAttr(edu.year || "")}" placeholder="e.g. 2018 - 2022">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>Grade / Percentage / Score</label>
          <input type="text" class="form-control edu-score" value="${escapeAttr(edu.score || "")}" placeholder="e.g. 8.5 CGPA / 88%">
        </div>
      </div>
    `;

    row.querySelector(".repeater-remove-btn").onclick = () => row.remove();
    eduList.appendChild(row);
  }

  function addExperienceRow(exp = {}) {
    const row = document.createElement("div");
    row.className = "repeater-item";
    row.innerHTML = `
      <button type="button" class="repeater-remove-btn" title="Remove">&times;</button>
      <div class="form-row">
        <div class="form-group" style="margin-bottom: 0;">
          <label>Job Title / Role</label>
          <input type="text" class="form-control exp-role" value="${escapeAttr(exp.role || "")}" placeholder="e.g. Project Manager">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>Company / Organization</label>
          <input type="text" class="form-control exp-company" value="${escapeAttr(exp.company || "")}" placeholder="e.g. ABC Solutions">
        </div>
      </div>
      <div class="form-row" style="margin-top: 10px; margin-bottom: 0;">
        <div class="form-group" style="margin-bottom: 0;">
          <label>Duration</label>
          <input type="text" class="form-control exp-duration" value="${escapeAttr(exp.duration || "")}" placeholder="e.g. 2021 - Present">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>Key Responsibilities</label>
          <input type="text" class="form-control exp-desc" value="${escapeAttr(exp.description || "")}" placeholder="e.g. Led mobile development team">
        </div>
      </div>
    `;

    row.querySelector(".repeater-remove-btn").onclick = () => row.remove();
    expList.appendChild(row);
  }

  // ----------------------------------------------------
  // Dropdown for Editing Existing Profiles
  // ----------------------------------------------------
  async function populateRegistryDropdown() {
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

        // If there's only 1 profile or active selection, keep it ready
        if (selectPerson.options.length === 2) {
          selectPerson.selectedIndex = 1;
          await loadSelectedPersonDetails();
        }
      } else {
        selectPerson.innerHTML = '<option value="">No profiles found in registry</option>';
      }
    } catch (err) {
      selectPerson.innerHTML = '<option value="">Failed to load profiles</option>';
      showToast("Error loading registry: " + err.message, "error");
    }
  }

  async function loadSelectedPersonDetails() {
    const id = selectPerson.value;
    if (!id) {
      showToast("Please choose a person from the dropdown first.", "error");
      return;
    }

    try {
      showToast(`Loading details for '${id}'...`, "info");
      const profile = await ghClient.getProfileById(id);
      populateFormWithProfile(profile);
      showToast(`Loaded ${profile.fullName || id}! You can now edit and save.`, "success");
    } catch (err) {
      console.error("Profile load error:", err);
      showToast(`Could not load profile: ${err.message}`, "error");
    }
  }

  selectPerson.addEventListener("change", loadSelectedPersonDetails);

  if (btnRefreshRegistry) {
    btnRefreshRegistry.addEventListener("click", async () => {
      showToast("Refreshing profile list from GitHub...", "info");
      await populateRegistryDropdown();
      showToast("Profile list refreshed!", "success");
    });
  }

  if (btnForceLoadPerson) {
    btnForceLoadPerson.addEventListener("click", loadSelectedPersonDetails);
  }

  function populateFormWithProfile(p) {
    personIdInput.value = p.id || "";
    personIdInput.readOnly = true; // Lock ID in edit mode to preserve URL!
    fullNameInput.value = p.fullName || "";
    
    document.getElementById("tagline").value = p.tagline || p.occupation || "";
    document.getElementById("phone").value = p.phone || "";
    document.getElementById("whatsapp").value = p.whatsapp || p.phone || "";
    document.getElementById("email").value = p.email || "";
    document.getElementById("dob").value = p.dob || "";
    document.getElementById("gender").value = p.gender || "";
    document.getElementById("bloodGroup").value = p.bloodGroup || "";
    document.getElementById("address").value = p.address || "";
    document.getElementById("about").value = p.about || "";

    document.getElementById("skillsInput").value = Array.isArray(p.skills) ? p.skills.join(", ") : "";
    document.getElementById("languagesInput").value = Array.isArray(p.languages) ? p.languages.join(", ") : "";

    // Photo preview (resolved with raw GitHub URL so it never breaks on ByetHost)
    existingPhotoPath.value = p.photo || "assets/photos/demo-aditya.svg";
    photoPreviewImg.src = resolvePhotoUrl(p.photo);
    selectedPhotoFile = null;

    // Clear and rebuild repeaters
    eduList.innerHTML = "";
    if (Array.isArray(p.education)) {
      p.education.forEach(edu => addEducationRow(edu));
    }

    expList.innerHTML = "";
    if (Array.isArray(p.experience)) {
      p.experience.forEach(exp => addExperienceRow(exp));
    }

    // Refresh QR code
    updateQrCode(p.id);
  }

  // ----------------------------------------------------
  // Live Progress Modal Checkpoint Controller
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
      iconEl.innerHTML = '<span class="step-spinner"></span>';
    } else if (state === "done") {
      el.classList.add("done");
      iconEl.textContent = "✅";
    } else if (state === "skipped") {
      el.classList.add("skipped");
      iconEl.textContent = "⏭️";
    } else if (state === "error") {
      el.classList.add("error");
      iconEl.textContent = "❌";
    } else {
      iconEl.textContent = "⚪";
    }
  }

  function resetProgressModal() {
    setStepState("validate", "pending", "Checking required fields and slug formatting");
    setStepState("photo", "pending", "Converting to Base64 and committing to assets/photos/");
    setStepState("json", "pending", "Writing record to data/profiles/{id}.json");
    setStepState("registry", "pending", "Updating data/registry.json for quick switcher");
    setStepState("qr", "pending", "Permanent URL activated on GitHub Pages");

    progressFooter.style.display = "none";
    progressErrorBox.style.display = "none";
    progressErrorActions.style.display = "none";
  }

  function openProgressModal() {
    resetProgressModal();
    progressModal.classList.add("open");
  }

  function closeProgressModal() {
    progressModal.classList.remove("open");
  }

  if (btnCloseProgressModal) btnCloseProgressModal.addEventListener("click", closeProgressModal);
  if (btnCloseProgressModalErr) btnCloseProgressModalErr.addEventListener("click", closeProgressModal);

  // ----------------------------------------------------
  // Form Submission & Live GitHub Commit Pipeline
  // ----------------------------------------------------
  document.getElementById("biodataForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = personIdInput.value.trim();
    if (!id) {
      showToast("Please specify a Unique Person ID.", "error");
      return;
    }

    // Check if GitHub PAT is configured
    if (!ghClient.hasToken()) {
      settingsModal.classList.add("open");
      showToast("Please connect your GitHub Personal Access Token first.", "error");
      return;
    }

    // Open live progress modal
    openProgressModal();
    setStepState("validate", "running", "Validating details...");

    // Prepare Profile Object
    const profileData = {
      id: id,
      fullName: fullNameInput.value.trim(),
      tagline: document.getElementById("tagline").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      whatsapp: document.getElementById("whatsapp").value.trim(),
      email: document.getElementById("email").value.trim(),
      dob: document.getElementById("dob").value,
      gender: document.getElementById("gender").value,
      bloodGroup: document.getElementById("bloodGroup").value,
      address: document.getElementById("address").value.trim(),
      about: document.getElementById("about").value.trim(),
      photo: existingPhotoPath.value || "assets/photos/demo-aditya.svg",
      education: collectEducationData(),
      experience: collectExperienceData(),
      skills: parseCommaSeparated(document.getElementById("skillsInput").value),
      languages: parseCommaSeparated(document.getElementById("languagesInput").value),
      updatedAt: new Date().toISOString().split("T")[0]
    };

    setStepState("validate", "done", `All particulars verified for '${profileData.fullName}'`);

    // Lock submit button
    btnSubmit.disabled = true;

    try {
      // Step-by-step pipeline execution
      const result = await ghClient.saveProfile(
        profileData,
        selectedPhotoFile,
        (step, status, detail) => {
          if (step === "photo_process") {
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

      // Finalize UI
      if (result.photoPath) {
        existingPhotoPath.value = result.photoPath;
        photoPreviewImg.src = resolvePhotoUrl(result.photoPath);
      }

      setStepState("qr", "done", `Live permanent link: ${result.profileUrl}`);
      btnProgressViewProfile.href = result.profileUrl;
      progressFooter.style.display = "block";

      showToast(`🎉 Success! Biodata for '${profileData.fullName}' committed to GitHub.`, "success");

      // Reload dropdown registry in background
      await populateRegistryDropdown();
    } catch (err) {
      console.error("Save error:", err);
      progressErrorBox.style.display = "block";
      progressErrorText.textContent = `Commit Failed: ${err.message}`;
      progressErrorActions.style.display = "block";
      showToast(`Failed: ${err.message}`, "error");
    } finally {
      btnSubmit.disabled = false;
      btnSubmitText.textContent = currentMode === "new" ? "💾 Save & Commit to GitHub" : "🔄 Update & Commit Changes";
    }
  });

  function collectEducationData() {
    const rows = eduList.querySelectorAll(".repeater-item");
    const arr = [];
    rows.forEach(r => {
      const degree = r.querySelector(".edu-degree").value.trim();
      const institution = r.querySelector(".edu-institution").value.trim();
      const year = r.querySelector(".edu-year").value.trim();
      const score = r.querySelector(".edu-score").value.trim();
      if (degree || institution) {
        arr.push({ degree, institution, year, score });
      }
    });
    return arr;
  }

  function collectExperienceData() {
    const rows = expList.querySelectorAll(".repeater-item");
    const arr = [];
    rows.forEach(r => {
      const role = r.querySelector(".exp-role").value.trim();
      const company = r.querySelector(".exp-company").value.trim();
      const duration = r.querySelector(".exp-duration").value.trim();
      const description = r.querySelector(".exp-desc").value.trim();
      if (role || company) {
        arr.push({ role, company, duration, description });
      }
    });
    return arr;
  }

  function parseCommaSeparated(str) {
    if (!str) return [];
    return str.split(",").map(s => s.trim()).filter(Boolean);
  }

  function resetForm() {
    document.getElementById("biodataForm").reset();
    eduList.innerHTML = "";
    expList.innerHTML = "";
    existingPhotoPath.value = "assets/photos/demo-aditya.svg";
    photoPreviewImg.src = "assets/photos/demo-aditya.svg";
    selectedPhotoFile = null;
    delete personIdInput.dataset.manuallyEdited;
    updateQrCode("demo-person");
  }

  btnReset.addEventListener("click", resetForm);

  // ----------------------------------------------------
  // GitHub Settings & Auth Modal
  // ----------------------------------------------------
  btnOpenSettings.addEventListener("click", () => settingsModal.classList.add("open"));
  btnCloseSettings.addEventListener("click", () => settingsModal.classList.remove("open"));

  function loadSettingsIntoModal() {
    cfgUsername.value = window.APP_CONFIG.githubUsername || "";
    cfgRepo.value = window.APP_CONFIG.githubRepo || "";
    cfgBranch.value = window.APP_CONFIG.branch || "main";
    cfgToken.value = ghClient.getToken() || "";
  }

  async function checkGitHubConnection() {
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

  btnSaveSettings.addEventListener("click", async () => {
    const username = cfgUsername.value.trim();
    const repo = cfgRepo.value.trim();
    const branch = cfgBranch.value.trim() || "main";
    const token = cfgToken.value.trim();

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
      settingsModal.classList.remove("open");
      await checkGitHubConnection();
      updateQrCode(personIdInput.value || "demo-person");
    } catch (err) {
      showToast(`Verification failed: ${err.message}`, "error");
    } finally {
      btnSaveSettings.textContent = "Connect & Verify Token";
      btnSaveSettings.disabled = false;
    }
  });

  btnClearToken.addEventListener("click", () => {
    ghClient.setToken("");
    cfgToken.value = "";
    showToast("GitHub token removed from this device.", "info");
    checkGitHubConnection();
  });

  function escapeAttr(str) {
    if (typeof str !== "string") return str;
    return str.replace(/"/g, "&quot;");
  }
});
