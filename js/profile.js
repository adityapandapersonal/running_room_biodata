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

function formatDateDisplay(dateStr) {
  if (!dateStr || dateStr === "-") return "-";
  const clean = dateStr.trim();
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, "0");
    const dd = isoMatch[3].padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  }
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, "0");
    const mm = dmyMatch[2].padStart(2, "0");
    const yyyy = dmyMatch[3];
    return `${dd}-${mm}-${yyyy}`;
  }
  return clean;
}

function calculateAge(dobString) {
  if (!dobString) return "";
  let dateObj = null;
  const parts = dobString.trim().split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      dateObj = new Date(`${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`);
    } else if (parts[2].length === 4) {
      dateObj = new Date(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`);
    }
  } else {
    dateObj = new Date(dobString);
  }
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  const diffMs = Date.now() - dateObj.getTime();
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

  // 3. Phone & Contact
  const phone = p.mobileNumber || p.phone || "";
  const cleanPhone = phone.replace(/[^0-9+]/g, "");

  // 4. Fill All Official Running Room Fields
  setText("val_idCardNo", p.idCardNo || p.id || "-");
  setText("val_fullName", p.fullName || "-");
  setText("val_designation", desig);
  setText("val_fatherName", p.fatherName || "-");
  setText("val_motherName", p.motherName || "-");
  setText("val_husbandName", p.husbandName || (p.gender === "Female" ? "-" : "N/A"));

  // Date of birth with age in DD-MM-YYYY format
  let dobFormatted = formatDateDisplay(p.dob);
  const age = calculateAge(p.dob);
  if (age && dobFormatted !== "-") {
    dobFormatted += ` (Age: ${age} Years)`;
  }
  setText("val_dob", dobFormatted);

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
  setText("val_policeVerifDoneDate", formatDateDisplay(p.policeVerifDoneDate));
  setText("val_policeVerifDueDate", formatDateDisplay(p.policeVerifDueDate));
  setText("val_medicalExamDoneDate", formatDateDisplay(p.medicalExamDoneDate));
  setText("val_medicalExamDueDate", formatDateDisplay(p.medicalExamDueDate));
  setText("val_identificationMarks", p.identificationMarks || "-");
  setText("val_joiningDateRR", formatDateDisplay(p.joiningDateRR));

  // 4b. Dynamic Custom Details Added via Pencil in Admin
  const customContainer = document.getElementById("customFieldsContainer");
  if (customContainer) {
    customContainer.innerHTML = "";
    if (Array.isArray(p.customFields) && p.customFields.length > 0) {
      p.customFields.forEach(cf => {
        if (cf && (cf.label || cf.value)) {
          const row = document.createElement("div");
          row.className = "rr-biodata-row";
          row.innerHTML = `
            <div class="rr-field-label">${escapeHtml(cf.label || "Detail")} :-</div>
            <div class="rr-field-value">${escapeHtml(cf.value || "-")}</div>
          `;
          customContainer.appendChild(row);
        }
      });
    }
  }

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

  // 6. Setup Direct PDF Download Button
  const printBtn = document.getElementById("btnPrintPdf");
  if (printBtn) {
    printBtn.onclick = async () => {
      const cardEl = document.querySelector(".profile-card");
      if (!cardEl) return;

      const rawName = document.getElementById("profileName")?.textContent || "Employee";
      const cleanName = rawName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_") || "Employee";
      const fileName = `${cleanName}_DGG_Running_Room_Biodata.pdf`;

      if (typeof html2pdf !== "undefined") {
        const noPdfEls = cardEl.querySelectorAll(".no-pdf");
        const originalBtnHtml = printBtn.innerHTML;

        try {
          printBtn.innerHTML = `<span>⏳</span> <span>Generating Direct PDF...</span>`;
          printBtn.disabled = true;

          // Temporarily hide elements not meant for final PDF document
          noPdfEls.forEach(el => {
            el.setAttribute("data-prev-display", el.style.display || "");
            el.style.display = "none";
          });

          const opt = {
            margin: [8, 8, 8, 8],
            filename: fileName,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              letterRendering: true,
              scrollY: 0,
              scrollX: 0,
              backgroundColor: "#0b0f19"
            },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["avoid-all", "css", "legacy"] }
          };

          await html2pdf().set(opt).from(cardEl).save();
          showToast(`Direct PDF saved: ${fileName}`, "success");
        } catch (err) {
          console.error("Direct PDF generation failed:", err);
          showToast("Direct save failed, opening print dialog...", "info");
          window.print();
        } finally {
          // Restore non-PDF elements
          noPdfEls.forEach(el => {
            el.style.display = el.getAttribute("data-prev-display") || "";
          });
          printBtn.innerHTML = originalBtnHtml;
          printBtn.disabled = false;
        }
      } else {
        // Fallback if library couldn't be loaded
        window.print();
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
