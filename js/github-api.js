/**
 * GitHub REST API Client for Biodata QR System
 * Robust cross-host synchronization with Raw fallback, TextDecoder, and progress reporting.
 */
class GitHubClient {
  constructor(config) {
    this.config = config || window.APP_CONFIG;
    this._profileCache = new Map();
    // Restore persistent repository configs from localStorage if available
    this.restorePersistedConfig();
  }

  restorePersistedConfig() {
    const savedUser = localStorage.getItem("biodata_github_username");
    const savedRepo = localStorage.getItem("biodata_github_repo");
    const savedBranch = localStorage.getItem("biodata_github_branch");

    if (savedUser && savedUser !== "your-github-username" && savedUser.trim()) {
      this.config.githubUsername = savedUser.trim();
    } else {
      this.config.githubUsername = "adityapandapersonal";
    }

    if (savedRepo && savedRepo !== "biodata-qr-system" && savedRepo.trim()) {
      this.config.githubRepo = savedRepo.trim();
    } else {
      this.config.githubRepo = "running_room_biodata";
    }

    if (savedBranch && savedBranch.trim()) {
      this.config.branch = savedBranch.trim();
    } else {
      this.config.branch = "main";
    }
  }

  persistConfig(username, repo, branch) {
    if (username) {
      this.config.githubUsername = username.trim();
      localStorage.setItem("biodata_github_username", this.config.githubUsername);
    }
    if (repo) {
      this.config.githubRepo = repo.trim();
      localStorage.setItem("biodata_github_repo", this.config.githubRepo);
    }
    if (branch) {
      this.config.branch = branch.trim();
      localStorage.setItem("biodata_github_branch", this.config.branch);
    }
  }

  getToken() {
    // 1. Check localStorage
    let token = localStorage.getItem(this.config.tokenStorageKey) || "";
    // 2. Check sessionStorage
    if (!token) {
      token = sessionStorage.getItem(this.config.tokenStorageKey) || "";
    }
    // 3. Check APP_CONFIG defaultGithubToken
    if (!token && this.config.defaultGithubToken) {
      token = this.config.defaultGithubToken.trim();
    }
    return token;
  }

  setToken(token) {
    if (token && token.trim()) {
      const cleanToken = token.trim();
      localStorage.setItem(this.config.tokenStorageKey, cleanToken);
      sessionStorage.setItem(this.config.tokenStorageKey, cleanToken);
    } else {
      localStorage.removeItem(this.config.tokenStorageKey);
      sessionStorage.removeItem(this.config.tokenStorageKey);
    }
  }

  hasToken() {
    return Boolean(this.getToken());
  }

  getHeaders() {
    const headers = {
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  decodeBase64(base64Str) {
    try {
      const binary = atob(base64Str.replace(/\s/g, ""));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (e) {
      // Fallback
      return decodeURIComponent(escape(atob(base64Str.replace(/\s/g, ""))));
    }
  }

  encodeBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Verify token by fetching authenticated user details
   */
  async verifyAuth() {
    const token = this.getToken();
    if (!token) {
      throw new Error("No GitHub Access Token found. Please enter your Personal Access Token (PAT).");
    }

    const res = await fetch("https://api.github.com/user", {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Invalid GitHub Token or Token Expired. Please check permissions.");
      }
      throw new Error(`GitHub Auth Failed (${res.status}): ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * Get file info and SHA from GitHub repo
   */
  async getFile(path) {
    const url = `https://api.github.com/repos/${this.config.githubUsername}/${this.config.githubRepo}/contents/${path}?ref=${this.config.branch}&t=${Date.now()}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    
    if (res.status === 404) {
      return null; // File does not exist yet
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch ${path} (${res.status}): ${res.statusText}`);
    }
    return await res.json();
  }

  /**
   * Create or update any file on GitHub (Base64 encoded content)
   */
  async commitFile(path, base64Content, commitMessage, sha = null) {
    const url = `https://api.github.com/repos/${this.config.githubUsername}/${this.config.githubRepo}/contents/${path}`;
    
    const body = {
      message: commitMessage,
      content: base64Content,
      branch: this.config.branch
    };

    if (sha) {
      body.sha = sha;
    }

    const res = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to commit ${path} (${res.status})`);
    }

    return await res.json();
  }

  /**
   * Convert file to Base64 (stripping data URL prefix for GitHub API)
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload person photo to assets/photos/{id}.[ext]
   */
  async uploadPhoto(personId, imageFile, onProgress = null) {
    const extension = imageFile.name.split(".").pop().toLowerCase() || "jpg";
    const targetPath = `assets/photos/${personId}.${extension}`;
    
    if (onProgress) onProgress("encoding", "Converting photo to Base64...");
    const base64Content = await this.fileToBase64(imageFile);

    if (onProgress) onProgress("checking_sha", "Checking existing photo on GitHub...");
    const existing = await this.getFile(targetPath).catch(() => null);
    const sha = existing ? existing.sha : null;

    if (onProgress) onProgress("committing_photo", "Pushing photo to GitHub repository...");
    await this.commitFile(
      targetPath,
      base64Content,
      `Upload photo for person ${personId}`,
      sha
    );

    return targetPath;
  }

  /**
   * Upload employee signature to assets/signatures/{id}.[ext]
   */
  async uploadSignature(personId, imageFile, onProgress = null) {
    const extension = imageFile.name.split(".").pop().toLowerCase() || "png";
    const targetPath = `assets/signatures/${personId}.${extension}`;
    
    if (onProgress) onProgress("encoding_signature", "Converting signature to Base64...");
    const base64Content = await this.fileToBase64(imageFile);

    if (onProgress) onProgress("checking_sig_sha", "Checking existing signature on GitHub...");
    const existing = await this.getFile(targetPath).catch(() => null);
    const sha = existing ? existing.sha : null;

    if (onProgress) onProgress("committing_signature", "Pushing employee signature to GitHub...");
    await this.commitFile(
      targetPath,
      base64Content,
      `Upload employee signature for ${personId}`,
      sha
    );

    return targetPath;
  }

  /**
   * Save complete biodata profile JSON, upload photo and signature, and update registry
   */
  async saveProfile(personData, imageFile = null, signatureFile = null, progressCallback = null) {
    const id = personData.id;
    if (!id) throw new Error("Person ID is required.");

    // Callback helper
    const updateProgress = (step, status, detail) => {
      if (typeof progressCallback === "function") {
        progressCallback(step, status, detail);
      }
    };

    let photoPath = personData.photo;
    let signaturePath = personData.signature;

    // STEP 1: Process and upload photo (if provided)
    if (imageFile) {
      updateProgress("photo_process", "running", "Converting photo to Base64...");
      photoPath = await this.uploadPhoto(id, imageFile, (subStep, subDetail) => {
        updateProgress("photo_process", "running", subDetail);
      });
      personData.photo = photoPath;
      updateProgress("photo_process", "done", `Photo committed to ${photoPath}`);
    } else {
      updateProgress("photo_process", "skipped", "Using existing photo link");
    }

    // STEP 1b: Process and upload signature (if provided)
    if (signatureFile) {
      updateProgress("sig_process", "running", "Processing employee signature...");
      signaturePath = await this.uploadSignature(id, signatureFile, (subStep, subDetail) => {
        updateProgress("sig_process", "running", subDetail);
      });
      personData.signature = signaturePath;
      updateProgress("sig_process", "done", `Signature committed to ${signaturePath}`);
    } else {
      updateProgress("sig_process", "skipped", "Using existing signature");
    }

    // STEP 2: Commit profile JSON
    updateProgress("json_commit", "running", `Preparing data/profiles/${id}.json...`);
    const profilePath = `data/profiles/${id}.json`;
    const existingProfile = await this.getFile(profilePath).catch(() => null);
    const profileSha = existingProfile ? existingProfile.sha : null;

    const jsonString = JSON.stringify(personData, null, 2);
    const jsonBase64 = this.encodeBase64(jsonString);

    updateProgress("json_commit", "running", `Committing data/profiles/${id}.json to GitHub...`);
    await this.commitFile(
      profilePath,
      jsonBase64,
      `Update Running Room biodata for ${personData.fullName} (${id})`,
      profileSha
    );
    updateProgress("json_commit", "done", `Profile JSON committed successfully`);

    // STEP 3: Update registry.json
    updateProgress("registry_sync", "running", "Synchronizing master registry.json...");
    await this.updateRegistry(personData);
    updateProgress("registry_sync", "done", "Registry updated");

    // STEP 4: Permanent Link calculation
    const profileUrl = `${this.config.getBaseUrl()}?id=${id}`;
    updateProgress("qr_ready", "done", "Permanent Dynamic QR Code is ready!");

    // Store in local memory cache for instant retrieval
    if (this._profileCache) {
      this._profileCache.set(id, Object.assign({}, personData));
    }

    return {
      success: true,
      id: id,
      photoPath: photoPath,
      signaturePath: signaturePath,
      profileUrl: profileUrl
    };
  }

  /**
   * Update the centralized registry.json file
   */
  async updateRegistry(personData) {
    const registryPath = "data/registry.json";
    let registry = { profiles: [] };
    let registrySha = null;

    try {
      const existing = await this.getFile(registryPath);
      if (existing && existing.content) {
        registrySha = existing.sha;
        const decoded = this.decodeBase64(existing.content);
        registry = JSON.parse(decoded);
      }
    } catch (e) {
      console.warn("No existing registry or failed to read, creating fresh registry:", e);
    }

    if (!Array.isArray(registry.profiles)) {
      registry.profiles = [];
    }

    const entryIndex = registry.profiles.findIndex((p) => p.id === personData.id);
    const newEntry = {
      id: personData.id,
      idCardNo: personData.idCardNo || "",
      fullName: personData.fullName || "",
      designation: personData.designation || personData.tagline || "",
      phone: personData.mobileNumber || personData.phone || "",
      photo: personData.photo || "",
      signature: personData.signature || "",
      updatedAt: personData.updatedAt || new Date().toISOString().split("T")[0]
    };

    if (entryIndex >= 0) {
      registry.profiles[entryIndex] = newEntry;
    } else {
      registry.profiles.push(newEntry);
    }

    const regJson = JSON.stringify(registry, null, 2);
    const regBase64 = this.encodeBase64(regJson);

    await this.commitFile(
      registryPath,
      regBase64,
      `Update registry for ${personData.fullName} (${personData.id})`,
      registrySha
    );
  }

  /**
   * Delete a file from GitHub repository
   */
  async deleteFile(path, commitMessage, sha = null) {
    if (!sha) {
      const fileInfo = await this.getFile(path).catch(() => null);
      if (!fileInfo) return null; // file does not exist, nothing to delete
      sha = fileInfo.sha;
    }
    const url = `https://api.github.com/repos/${this.config.githubUsername}/${this.config.githubRepo}/contents/${path}`;
    const body = {
      message: commitMessage,
      sha: sha,
      branch: this.config.branch
    };
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to delete ${path} (${res.status})`);
    }
    return await res.json();
  }

  /**
   * Delete complete biodata profile JSON and remove from registry.json
   */
  async deleteProfile(personId) {
    if (!personId) throw new Error("Person ID is required for deletion.");

    // 1. Delete data/profiles/${personId}.json
    const profilePath = `data/profiles/${personId}.json`;
    await this.deleteFile(
      profilePath,
      `Delete Running Room biodata record for ${personId}`
    ).catch((err) => {
      console.warn("Could not delete profile JSON (maybe already deleted):", err);
    });

    // 2. Remove entry from data/registry.json
    const registryPath = "data/registry.json";
    try {
      const existing = await this.getFile(registryPath);
      if (existing && existing.content) {
        const decoded = this.decodeBase64(existing.content);
        const registry = JSON.parse(decoded);
        if (Array.isArray(registry.profiles)) {
          registry.profiles = registry.profiles.filter((p) => p.id !== personId);
          const newBase64 = this.encodeBase64(JSON.stringify(registry, null, 2));
          await this.commitFile(
            registryPath,
            newBase64,
            `Remove person ${personId} from registry`,
            existing.sha
          );
        }
      }
    } catch (e) {
      console.warn("Could not update registry upon deletion:", e);
    }

    // 3. Clear from memory cache
    if (this._profileCache) {
      this._profileCache.delete(personId);
    }

    return { success: true, id: personId };
  }

  /**
   * Fetch all registered profiles for admin dropdown
   * Priority: Raw GitHub (fastest & no cache lag) -> GitHub API -> Local file
   */
  async getRegistry() {
    // 1. Raw GitHub fetch (fastest & no cache lag)
    try {
      const rawUrl = `https://raw.githubusercontent.com/${this.config.githubUsername}/${this.config.githubRepo}/${this.config.branch}/data/registry.json?t=${Date.now()}`;
      const res = await fetch(rawUrl, { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith("{")) {
          return JSON.parse(text);
        }
      }
    } catch (e) {
      console.warn("Raw registry fetch failed, trying fallback:", e);
    }

    // 2. Local relative path fetch (when running on GitHub Pages)
    try {
      const res = await fetch("data/registry.json?t=" + Date.now());
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith("{")) {
          return JSON.parse(text);
        }
      }
    } catch (_) {}

    // 3. GitHub REST API fallback (with token)
    try {
      const file = await this.getFile("data/registry.json");
      if (file && file.content) {
        const decoded = this.decodeBase64(file.content);
        return JSON.parse(decoded);
      }
    } catch (e) {
      console.warn("API registry fetch failed:", e);
    }

    return { profiles: [] };
  }

  /**
   * Fetch a single profile by ID
   * Priority: Memory Cache -> Raw GitHub -> Local relative -> GitHub REST API -> Registry Fallback
   */
  async getProfileById(id) {
    const cleanId = (id || "").trim();
    if (!cleanId) throw new Error("No profile ID specified.");

    // 0. Memory Cache (0ms Instant Load)
    if (!this._profileCache) this._profileCache = new Map();
    if (this._profileCache.has(cleanId)) {
      console.log(`[GitHubClient] Loaded profile '${cleanId}' from memory cache.`);
      return this._profileCache.get(cleanId);
    }

    const encodedId = encodeURIComponent(cleanId);

    // 1. Raw GitHub fetch (zero build delay, works from any origin)
    try {
      const rawUrl = `https://raw.githubusercontent.com/${this.config.githubUsername}/${this.config.githubRepo}/${this.config.branch}/data/profiles/${encodedId}.json?t=${Date.now()}`;
      const res = await fetch(rawUrl, { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith("{")) {
          const profile = JSON.parse(text);
          this._profileCache.set(cleanId, profile);
          console.log(`[GitHubClient] Loaded profile '${cleanId}' from Raw GitHub.`);
          return profile;
        }
      }
    } catch (e) {
      console.warn("Raw profile fetch failed, trying local fallback:", e);
    }

    // 2. Local relative path fetch (if on GitHub Pages)
    try {
      const res = await fetch(`data/profiles/${encodedId}.json?t=` + Date.now());
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith("{")) {
          const profile = JSON.parse(text);
          this._profileCache.set(cleanId, profile);
          console.log(`[GitHubClient] Loaded profile '${cleanId}' from local relative path.`);
          return profile;
        }
      }
    } catch (_) {}

    // 3. GitHub REST API fallback (with token)
    try {
      const file = await this.getFile(`data/profiles/${encodedId}.json`);
      if (file && file.content) {
        const decoded = this.decodeBase64(file.content);
        const profile = JSON.parse(decoded);
        this._profileCache.set(cleanId, profile);
        console.log(`[GitHubClient] Loaded profile '${cleanId}' from GitHub REST API.`);
        return profile;
      }
    } catch (e) {
      console.warn("API profile fetch failed:", e);
    }

    // 4. Registry fallback if specific JSON file had network/caching delay
    try {
      const reg = await this.getRegistry();
      const match = (reg.profiles || []).find((p) => p.id === cleanId);
      if (match) {
        console.warn(`[GitHubClient] Using registry summary fallback for '${cleanId}'.`);
        const fallbackProfile = {
          id: match.id,
          idCardNo: match.idCardNo || "",
          fullName: match.fullName || match.id,
          designation: match.designation || match.occupation || "",
          fatherName: match.fatherName || "",
          motherName: match.motherName || "",
          husbandName: match.husbandName || "",
          dob: match.dob || "",
          gender: match.gender || "Male",
          maritalStatus: match.maritalStatus || "Unmarried",
          bloodGroup: match.bloodGroup || "",
          aadhaarNumber: match.aadhaarNumber || "",
          mobileNumber: match.phone || match.mobileNumber || "",
          email: match.email || "",
          residentialAddress: match.residentialAddress || "",
          policeVerifDoneDate: match.policeVerifDoneDate || "",
          policeVerifDueDate: match.policeVerifDueDate || "",
          medicalExamDoneDate: match.medicalExamDoneDate || "",
          medicalExamDueDate: match.medicalExamDueDate || "",
          identificationMarks: match.identificationMarks || "",
          joiningDateRR: match.joiningDateRR || "",
          photo: match.photo || "assets/photos/demo-aditya.svg",
          signature: match.signature || "assets/signatures/sample-signature.svg",
          customFields: match.customFields || [],
          updatedAt: match.updatedAt || ""
        };
        this._profileCache.set(cleanId, fallbackProfile);
        return fallbackProfile;
      }
    } catch (regErr) {
      console.warn("Registry fallback also failed:", regErr);
    }

    throw new Error(`Profile '${id}' could not be loaded from GitHub.`);
  }
}

window.GitHubClient = GitHubClient;
