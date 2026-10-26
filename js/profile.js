/**
 * Public Running Room Biodata Profile Renderer
 * Extracts ?id= from URL, loads profile JSON from GitHub, and renders the official biodata.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const profileId = urlParams.get("id") || "sheshu-dev-panda";

  const ghClient = new window.GitHubClient();

  try {
    const data = await ghClient.getProfileById(profileId);
    renderProfile(data, profileId);
  } catch (err) {
    console.error("Failed to load profile:", err);
    showErrorState(profileId, err.message);
  }
});

function calculateAge(dobString) {
  if (!dobString) return "";
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return "";
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

function renderProfile(p, id) {
  // Update browser document title
  document.title = `${p.fullName || "Employee"} - Running Room Biodata`;

  // Helper to resolve instant media URL without waiting for GitHub Pages build delay
  function resolveMediaUrl(path, defaultPath) {
    if (!path) return defaultPath;
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    const cfg = window.APP_CONFIG;
    return `https://raw.githubusercontent.com/${cfg.githubUsername}/${cfg.githubRepo}/${cfg.branch}/${path}?t=${Date.now()}`;
  }

  // 1. Employee Photo (Instant Raw CDN fetch with fallback)
  const avatarEl = document.getElementById("profileAvatar");
  if (avatarEl) {
    const photoUrl = resolveMediaUrl(p.photo, "assets/photos/demo-aditya.svg");
    avatarEl.src = photoUrl;
    avatarEl.alt = p.fullName || "Employee Photo";
    avatarEl.onerror = () => {
      if (avatarEl.src !== p.photo && p.photo) {
        avatarEl.src = p.photo;
      } else {
        avatarEl.src = "assets/photos/demo-aditya.svg";
      }
    };
  }

  // 2. Name & Designation & ID Card No
  setText("profileName", p.fullName || "Unnamed Employee");
  const desig = p.designation || p.tagline || p.occupation || "Running Room Employee";
  setText("profileDesignation", desig);

  const idCardText = p.idCardNo || p.id || "N/A";
  setText("profileIdCardNo", idCardText);

  // Last Updated Date
  if (p.updatedAt) {
    setText("lastUpdatedDate", `Updated: ${p.updatedAt}`);
  }

  // 3. Quick Action Buttons (WhatsApp & Call)
  const phone = p.mobileNumber || p.phone || "";
  const cleanPhone = phone.replace(/[^0-9+]/g, "");

  const callBtn = document.getElementById("actionCall");
  if (callBtn) {
    if (cleanPhone) {
      callBtn.href = `tel:${cleanPhone}`;
      callBtn.style.display = "inline-flex";
    } else {
      callBtn.style.display = "none";
    }
  }

  const waBtn = document.getElementById("actionWhatsApp");
  if (waBtn) {
    if (cleanPhone) {
      const waDigits = cleanPhone.replace(/[^0-9]/g, "");
      waBtn.href = `https://wa.me/${waDigits}?text=Hello%20${encodeURIComponent(p.fullName || "Sir")},%20regarding%20Running%20Room%20Biodata.`;
      waBtn.style.display = "inline-flex";
    } else {
      waBtn.style.display = "none";
    }
  }

  const emailBtn = document.getElementById("actionEmail");
  if (emailBtn) {
    if (p.email) {
      emailBtn.href = `mailto:${p.email}`;
      emailBtn.style.display = "inline-flex";
    } else {
      emailBtn.style.display = "none";
    }
  }

  // 4. Fill All Official Running Room Fields
  setText("val_idCardNo", p.idCardNo || p.id || "-");
  setText("val_fullName", p.fullName || "-");
  setText("val_designation", desig);
  setText("val_fatherName", p.fatherName || "-");
  setText("val_motherName", p.motherName || "-");
  setText("val_husbandName", p.husbandName || (p.gender === "Female" ? "-" : "N/A"));

  // Date of birth with age
  let dobDisplay = p.dob || "-";
  const age = calculateAge(p.dob);
  if (age) {
    dobDisplay += ` (Age: ${age} Years)`;
  }
  setText("val_dob", dobDisplay);

  setText("val_gender", p.gender || "-");
  setText("val_maritalStatus", p.maritalStatus || "-");
  setText("val_bloodGroup", p.bloodGroup || "-");
  setText("val_aadhaarNumber", p.aadhaarNumber || "-");

  const mobileEl = document.getElementById("val_mobileNumber");
  if (mobileEl) {
    if (phone) {
      mobileEl.textContent = phone;
      mobileEl.href = `tel:${cleanPhone}`;
    } else {
      mobileEl.textContent = "-";
      mobileEl.removeAttribute("href");
    }
  }

  const emailEl = document.getElementById("val_email");
  if (emailEl) {
    if (p.email) {
      emailEl.textContent = p.email;
      emailEl.href = `mailto:${p.email}`;
    } else {
      emailEl.textContent = "-";
      emailEl.removeAttribute("href");
    }
  }

  setText("val_residentialAddress", p.residentialAddress || p.address || "-");
  setText("val_policeVerifDoneDate", p.policeVerifDoneDate || "-");
  setText("val_policeVerifDueDate", p.policeVerifDueDate || "-");
  setText("val_medicalExamDoneDate", p.medicalExamDoneDate || "-");
  setText("val_medicalExamDueDate", p.medicalExamDueDate || "-");
  setText("val_identificationMarks", p.identificationMarks || "-");
  setText("val_joiningDateRR", p.joiningDateRR || "-");

  // 5. Signature of Employee Display
  const sigImg = document.getElementById("profileSignature");
  if (sigImg) {
    const sigUrl = resolveMediaUrl(p.signature, "assets/signatures/sample-signature.svg");
    sigImg.src = sigUrl;
    sigImg.alt = `Signature of ${p.fullName || "Employee"}`;
    sigImg.onerror = () => {
      if (sigImg.src !== p.signature && p.signature) {
        sigImg.src = p.signature;
      } else {
        sigImg.src = "assets/signatures/sample-signature.svg";
      }
    };
  }

  // 6. Generate Permanent Dynamic QR Code
  const qrContainer = document.getElementById("profileQrCode");
  const permalinkUrl = `${window.APP_CONFIG.getBaseUrl()}?id=${encodeURIComponent(id)}`;

  if (qrContainer && typeof QRCode !== "undefined") {
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: permalinkUrl,
      width: 100,
      height: 100,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  const permalinkEl = document.getElementById("profilePermalink");
  if (permalinkEl) {
    permalinkEl.textContent = permalinkUrl;
    permalinkEl.href = permalinkUrl;
  }

  // 7. Setup Share and Print buttons
  const printBtn = document.getElementById("btnPrintPdf");
  if (printBtn) {
    printBtn.onclick = () => window.print();
  }

  const shareBtn = document.getElementById("btnShareLink");
  if (shareBtn) {
    shareBtn.onclick = () => {
      if (navigator.share) {
        navigator.share({
          title: `${p.fullName || "Employee"} - Running Room Biodata`,
          text: `Verified Running Room Biodata for ${p.fullName}:`,
          url: permalinkUrl
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(permalinkUrl).then(() => {
          showToast("Permanent Link copied to clipboard!", "success");
        });
      }
    };
  }
}

function setText(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text || "-";
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showErrorState(id, message) {
  const container = document.querySelector(".profile-container");
  if (container) {
    container.innerHTML = `
      <div class="glass-panel" style="padding: 40px; text-align: center; margin-top: 60px;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
        <h2 style="margin-bottom: 8px;">Record Not Found</h2>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">
          No Running Room Biodata found for ID: <code>${escapeHtml(id)}</code>.
        </p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px;">
          ${escapeHtml(message || "")}
        </p>
        <a href="admin.html" class="btn btn-primary">
          ⚙️ Open Admin Studio to Add Record
        </a>
      </div>
    `;
  }
}

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

window.showToast = showToast;
