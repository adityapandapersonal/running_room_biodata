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
    if (path.startsWith("data:")) return path;
    if (path.startsWith("assets/")) return path;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
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

  // 6. Setup Direct Pure Vector PDF Download (From JSON Data - No Screenshots)
  const printBtn = document.getElementById("btnPrintPdf");
  if (printBtn) {
    printBtn.onclick = async () => {
      const originalBtnHtml = printBtn.innerHTML;
      try {
        printBtn.innerHTML = `<span>⏳</span> <span>Generating Vector PDF...</span>`;
        printBtn.disabled = true;

        await generateOfficialVectorPdf(p, id);
        showToast("Official Vector PDF downloaded successfully!", "success");
      } catch (err) {
        console.error("Vector PDF generation error:", err);
        showToast("PDF generation failed: " + err.message, "error");
      } finally {
        printBtn.innerHTML = originalBtnHtml;
        printBtn.disabled = false;
      }
    };
  }
}

/**
 * Pure JavaScript Vector PDF Generator (Zero Screenshots)
 * Generates an official, crystal-sharp A4 Railway Biodata directly from JSON data.
 */
async function generateOfficialVectorPdf(p, id) {
  const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFClass) {
    throw new Error("jsPDF library not loaded");
  }

  const doc = new jsPDFClass({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210, ph = 297, m = 8;
  const cw = pw - (m * 2); // 194mm

  // 1. Double Outer Frame Border
  doc.setDrawColor(15, 23, 42); // Navy
  doc.setLineWidth(0.6);
  doc.rect(m, m, cw, ph - (m * 2));
  doc.setLineWidth(0.2);
  doc.setDrawColor(148, 163, 184); // Slate
  doc.rect(m + 1, m + 1, cw - 2, ph - (m * 2) - 2);

  // 2. Header Banner (Navy)
  doc.setFillColor(15, 23, 42);
  doc.rect(m + 2, m + 2, cw - 4, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("SOUTH EAST CENTRAL RAILWAY (SECR)", pw / 2, m + 7, { align: "center" });
  doc.setFontSize(13);
  doc.setTextColor(56, 189, 248); // Cyan
  doc.text("RUNNING ROOM - DONGARGARH (DGG)", pw / 2, m + 14, { align: "center" });

  // 3. Document Title Bar
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(m + 2, m + 21, cw - 4, 8, "FD");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.text("EMPLOYEE OFFICIAL BIODATA RECORD", pw / 2, m + 26.5, { align: "center" });

  // 4. Structured Official Particulars Table
  const tableX = m + 2;
  let startY = m + 31;
  const tableW = cw - 4; // 190mm
  const colL1 = 36;
  const colV1 = 59;
  const colL2 = 36;
  const colV2 = 59; // 36 + 59 + 36 + 59 = 190mm exactly

  function drawRow(label1, val1, label2, val2, height = 7.5) {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);

    // Col 1: Label
    doc.setFillColor(248, 250, 252);
    doc.rect(tableX, startY, colL1, height, "FD");
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label1, tableX + 2, startY + (height / 2) + 1.2);

    // Col 2: Value
    doc.setFillColor(255, 255, 255);
    doc.rect(tableX + colL1, startY, colV1, height, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(String(val1 || "-"), tableX + colL1 + 2.5, startY + (height / 2) + 1.2);

    // Col 3: Label
    doc.setFillColor(248, 250, 252);
    doc.rect(tableX + colL1 + colV1, startY, colL2, height, "FD");
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label2, tableX + colL1 + colV1 + 2, startY + (height / 2) + 1.2);

    // Col 4: Value
    doc.setFillColor(255, 255, 255);
    doc.rect(tableX + colL1 + colV1 + colL2, startY, colV2, height, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(String(val2 || "-"), tableX + colL1 + colV1 + colL2 + 2.5, startY + (height / 2) + 1.2);

    startY += height;
  }

  function drawFullRow(label, val, height = 8.5) {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);

    // Label
    doc.setFillColor(248, 250, 252);
    doc.rect(tableX, startY, colL1, height, "FD");
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label, tableX + 2, startY + (height / 2) + 1.2);

    // Full Value
    const valWidth = tableW - colL1;
    doc.setFillColor(255, 255, 255);
    doc.rect(tableX + colL1, startY, valWidth, height, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    const lines = doc.splitTextToSize(String(val || "-"), valWidth - 5);
    doc.text(lines, tableX + colL1 + 2.5, startY + 4.5);

    startY += height;
  }

  // Draw official Running Room particulars
  const age = calculateAge(p.dob);
  const dobText = p.dob ? `${formatDateDisplay(p.dob)}${age ? ` (Age: ${age} Yrs)` : ""}` : "-";

  drawRow("ID CARD NO. :-", p.idCardNo || p.id || "-", "Record Status :-", "VERIFIED & ACTIVE");
  drawRow("Full Name :-", p.fullName || "-", "Designation :-", p.designation || "-");
  drawRow("Father's Name :-", p.fatherName || "-", "Mother's Name :-", p.motherName || "-");
  drawRow("Husband's Name :-", p.husbandName || (p.gender === "Female" ? "-" : "N/A"), "Date of Birth :-", dobText);
  drawRow("Gender :-", p.gender || "-", "Marital Status :-", p.maritalStatus || "-");
  drawRow("Blood Group :-", p.bloodGroup || "-", "Aadhaar Number :-", p.aadhaarNumber || "-");
  drawRow("Mobile Number :-", p.mobileNumber || p.phone || "-", "Email ID :-", p.email || "-");
  drawFullRow("Residential Address :-", p.residentialAddress || p.address || "-", 10);
  drawRow("Police Verif. Done :-", formatDateDisplay(p.policeVerifDoneDate), "Police Verif. Due :-", formatDateDisplay(p.policeVerifDueDate));
  drawRow("Medical Exam Done :-", formatDateDisplay(p.medicalExamDoneDate), "Medical Exam Due :-", formatDateDisplay(p.medicalExamDueDate));
  drawFullRow("Identification Marks :-", p.identificationMarks || "-", 8);
  drawRow("Date of Joining RR :-", formatDateDisplay(p.joiningDateRR), "Registry Updated :-", p.updatedAt || "Current");

  // Custom Fields (Pencil additions)
  if (Array.isArray(p.customFields) && p.customFields.length > 0) {
    for (let i = 0; i < p.customFields.length; i += 2) {
      const cf1 = p.customFields[i];
      const cf2 = p.customFields[i + 1];
      drawRow(
        (cf1 && cf1.label ? cf1.label + " :-" : "-"), (cf1 ? cf1.value : "-"),
        (cf2 && cf2.label ? cf2.label + " :-" : "-"), (cf2 ? cf2.value : "-")
      );
    }
  }

  // 5. Bottom Verification & Signature Section
  const bottomBoxY = startY + 6;
  const boxH = 46;

  // Left Box: Attestation Banner & QR Code
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.4);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(tableX, bottomBoxY, 92, boxH, 2, 2, "FD");

  doc.setTextColor(5, 150, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("DGG Running Room Verified Detailed", tableX + 5, bottomBoxY + 8);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Official Attestation & Digital Registry Record", tableX + 5, bottomBoxY + 14);
  doc.text("This biodata record has been officially verified and", tableX + 5, bottomBoxY + 20);
  doc.text("digitally registered in the Running Room Employee System.", tableX + 5, bottomBoxY + 24);
  doc.text("SECR Dongargarh (Railway Administration)", tableX + 5, bottomBoxY + 30);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, tableX + 5, bottomBoxY + 38);

  // Embed Live QR Code
  const permalink = `${window.APP_CONFIG.getBaseUrl()}?id=${encodeURIComponent(p.id || id || "employee")}`;
  const qrDataUrl = generateQrDataUrl(permalink);
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, "PNG", tableX + 66, bottomBoxY + 18, 22, 22);
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Scan to Verify", tableX + 77, bottomBoxY + 43, { align: "center" });
    } catch (e) {
      console.warn("Could not embed QR into PDF:", e);
    }
  }

  // Right Box: Signature of Employee
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(tableX + 96, bottomBoxY, 94, boxH, 2, 2, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Signature of Employee :-", tableX + 101, bottomBoxY + 7);

  // Embed Signature Image if present on page
  const sigImgEl = document.getElementById("profileSignature");
  const sigDataUrl = getImgDataUrl(sigImgEl);
  if (sigDataUrl) {
    try {
      doc.addImage(sigDataUrl, "PNG", tableX + 118, bottomBoxY + 13, 50, 18);
    } catch (e) {
      console.warn("Could not embed signature into PDF:", e);
    }
  }

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(tableX + 106, bottomBoxY + 34, tableX + 180, bottomBoxY + 34);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Digitally attested in Running Room Employee Registry", tableX + 101, bottomBoxY + 40);

  // 6. Footer Note
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Official Document - Running Room Dongargarh (SECR) | Computer Generated Vector PDF Document", pw / 2, ph - 4, { align: "center" });

  // 7. Save File Directly
  const rawName = p.fullName || "Employee";
  const cleanName = rawName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_") || "Employee";
  const fileName = `${cleanName}_DGG_Running_Room_Biodata.pdf`;
  doc.save(fileName);
}

function generateQrDataUrl(text) {
  try {
    if (typeof QRCode === "undefined") return null;
    const tempDiv = document.createElement("div");
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);
    new QRCode(tempDiv, {
      text: text,
      width: 160,
      height: 160,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
    const canvas = tempDiv.querySelector("canvas");
    let dataUrl = null;
    if (canvas) {
      dataUrl = canvas.toDataURL("image/png");
    } else {
      const img = tempDiv.querySelector("img");
      if (img && img.src) dataUrl = img.src;
    }
    document.body.removeChild(tempDiv);
    return dataUrl;
  } catch (e) {
    console.warn("Could not generate QR dataUrl:", e);
    return null;
  }
}

function getImgDataUrl(imgEl) {
  if (!imgEl) return null;
  if (imgEl.src && imgEl.src.startsWith("data:")) return imgEl.src;
  try {
    const c = document.createElement("canvas");
    c.width = imgEl.naturalWidth || imgEl.width || 200;
    c.height = imgEl.naturalHeight || imgEl.height || 80;
    const ctx = c.getContext("2d");
    ctx.drawImage(imgEl, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } catch (e) {
    return null;
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
