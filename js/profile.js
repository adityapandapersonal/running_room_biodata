/**
 * Public Biodata Profile Renderer
 * Extracts ?id= from URL, loads profile JSON, and renders read-only view.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const profileId = urlParams.get("id") || "demo-aditya";

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
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

function renderProfile(p, id) {
  // Update browser document title
  document.title = `${p.fullName || "Biodata"} - Profile Card`;

  // Avatar Photo
  const avatarEl = document.getElementById("profileAvatar");
  if (avatarEl) {
    avatarEl.src = p.photo || "assets/photos/demo-aditya.svg";
    avatarEl.alt = p.fullName || "Profile Photo";
    avatarEl.onerror = () => {
      avatarEl.src = "assets/photos/demo-aditya.svg";
    };
  }

  // Name & Tagline
  setText("profileName", p.fullName || "Unnamed Person");
  setText("profileTagline", p.tagline || p.occupation || "Verified Member");
  
  // Last Updated Date
  if (p.updatedAt) {
    setText("lastUpdatedDate", `Updated: ${p.updatedAt}`);
  }

  // Quick Action Buttons
  const callBtn = document.getElementById("actionCall");
  if (callBtn && p.phone) {
    callBtn.href = `tel:${p.phone.replace(/\s+/g, "")}`;
    callBtn.style.display = "inline-flex";
  } else if (callBtn) {
    callBtn.style.display = "none";
  }

  const waBtn = document.getElementById("actionWhatsApp");
  const waNumber = p.whatsapp || p.phone;
  if (waBtn && waNumber) {
    const cleanNum = waNumber.replace(/[^0-9]/g, "");
    waBtn.href = `https://wa.me/${cleanNum}?text=Hello%20${encodeURIComponent(p.fullName)},%20I%20viewed%20your%20biodata.`;
    waBtn.style.display = "inline-flex";
  } else if (waBtn) {
    waBtn.style.display = "none";
  }

  const emailBtn = document.getElementById("actionEmail");
  if (emailBtn && p.email) {
    emailBtn.href = `mailto:${p.email}`;
    emailBtn.style.display = "inline-flex";
  } else if (emailBtn) {
    emailBtn.style.display = "none";
  }

  // About / Bio Section
  const aboutSec = document.getElementById("sectionAbout");
  if (aboutSec) {
    if (p.about && p.about.trim()) {
      setText("profileAbout", p.about);
      aboutSec.style.display = "block";
    } else {
      aboutSec.style.display = "none";
    }
  }

  // Particulars Grid (DOB, Age, Gender, Blood Group, Address)
  const particulars = [
    { label: "Date of Birth", val: p.dob, icon: "calendar" },
    { label: "Age", val: p.dob ? `${calculateAge(p.dob)} Years` : "", icon: "clock" },
    { label: "Gender", val: p.gender, icon: "user" },
    { label: "Blood Group", val: p.bloodGroup, icon: "heart" },
    { label: "Phone", val: p.phone, icon: "phone" },
    { label: "Email", val: p.email, icon: "mail" },
    { label: "Address", val: p.address, icon: "map-pin" }
  ].filter(item => Boolean(item.val));

  const partGrid = document.getElementById("particularsGrid");
  if (partGrid) {
    partGrid.innerHTML = particulars.map(item => `
      <div class="particular-item">
        <div class="particular-icon">${getIconSvg(item.icon)}</div>
        <div>
          <div class="particular-label">${item.label}</div>
          <div class="particular-val">${escapeHtml(item.val)}</div>
        </div>
      </div>
    `).join("");
  }

  // Education Timeline
  const eduSec = document.getElementById("sectionEducation");
  const eduTimeline = document.getElementById("educationTimeline");
  if (eduSec && eduTimeline) {
    if (Array.isArray(p.education) && p.education.length > 0) {
      eduSec.style.display = "block";
      eduTimeline.innerHTML = p.education.map(edu => `
        <div class="timeline-card">
          <div class="timeline-header">
            <div>
              <div class="timeline-title">${escapeHtml(edu.degree || "")}</div>
              <div class="timeline-subtitle">${escapeHtml(edu.institution || "")}</div>
            </div>
            ${edu.year ? `<span class="timeline-badge">${escapeHtml(edu.year)}</span>` : ""}
          </div>
          ${edu.score ? `<div class="timeline-desc">Score: <strong>${escapeHtml(edu.score)}</strong></div>` : ""}
        </div>
      `).join("");
    } else {
      eduSec.style.display = "none";
    }
  }

  // Professional Experience
  const expSec = document.getElementById("sectionExperience");
  const expTimeline = document.getElementById("experienceTimeline");
  if (expSec && expTimeline) {
    if (Array.isArray(p.experience) && p.experience.length > 0) {
      expSec.style.display = "block";
      expTimeline.innerHTML = p.experience.map(exp => `
        <div class="timeline-card">
          <div class="timeline-header">
            <div>
              <div class="timeline-title">${escapeHtml(exp.role || "")}</div>
              <div class="timeline-subtitle">${escapeHtml(exp.company || "")}</div>
            </div>
            ${exp.duration ? `<span class="timeline-badge">${escapeHtml(exp.duration)}</span>` : ""}
          </div>
          ${exp.description ? `<div class="timeline-desc">${escapeHtml(exp.description)}</div>` : ""}
        </div>
      `).join("");
    } else {
      expSec.style.display = "none";
    }
  }

  // Skills
  const skillsSec = document.getElementById("sectionSkills");
  const skillsList = document.getElementById("skillsList");
  if (skillsSec && skillsList) {
    if (Array.isArray(p.skills) && p.skills.length > 0) {
      skillsSec.style.display = "block";
      skillsList.innerHTML = p.skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join("");
    } else {
      skillsSec.style.display = "none";
    }
  }

  // Languages
  const langSec = document.getElementById("sectionLanguages");
  const langList = document.getElementById("languagesList");
  if (langSec && langList) {
    if (Array.isArray(p.languages) && p.languages.length > 0) {
      langSec.style.display = "block";
      langList.innerHTML = p.languages.map(l => `<span class="lang-tag">${escapeHtml(l)}</span>`).join("");
    } else {
      langSec.style.display = "none";
    }
  }

  // Generate Permanent QR Code
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

  // Setup Share and Print buttons
  const printBtn = document.getElementById("btnPrintPdf");
  if (printBtn) {
    printBtn.onclick = () => window.print();
  }

  const shareBtn = document.getElementById("btnShareLink");
  if (shareBtn) {
    shareBtn.onclick = () => {
      if (navigator.share) {
        navigator.share({
          title: `${p.fullName} - Biodata`,
          text: `Check out the biodata of ${p.fullName}:`,
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
  if (el) el.textContent = text;
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

function getIconSvg(name) {
  const svgs = {
    calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    "map-pin": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
  };
  return svgs[name] || "";
}

function showErrorState(id, message) {
  const container = document.querySelector(".profile-container");
  if (container) {
    container.innerHTML = `
      <div class="glass-panel" style="padding: 40px; text-align: center; margin-top: 60px;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
        <h2 style="margin-bottom: 8px;">Profile Not Found</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">No biodata record found for identifier: <code>${escapeHtml(id)}</code></p>
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px;">${escapeHtml(message)}</div>
        <a href="admin.html" class="btn btn-primary">Open Admin Panel to Create</a>
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
