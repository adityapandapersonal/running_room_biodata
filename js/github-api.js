/**
 * GitHub REST API Client for Biodata QR System
 * Robust cross-host synchronization with Raw fallback, TextDecoder, and progress reporting.
 */
class GitHubClient {
  constructor(config) {
    this.config = config || window.APP_CONFIG;
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
   * Save complete biodata profile JSON, upload photo, and update registry with live progress callback
   */
  async saveProfile(personData, imageFile = null, progressCallback = null) {
    const id = personData.id;
    if (!id) throw new Error("Person ID is required.");

    // Callback helper
    const updateProgress = (step, status, detail) => {
      if (typeof progressCallback === "function") {
        progressCallback(step, status, detail);
      }
    };

    let photoPath = personData.photo;

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
      `Update biodata for ${personData.fullName} (${id})`,
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

    return {
      success: true,
      id: id,
      photoPath: photoPath,
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
      fullName: personData.fullName,
      occupation: personData.tagline || personData.occupation || "",
      phone: personData.phone || "",
      email: personData.email || "",
      photo: personData.photo || "",
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
   * Priority: Raw GitHub -> Local relative -> GitHub REST API
   */
  async getProfileById(id) {
    const cleanId = encodeURIComponent((id || "").trim());

    // 1. Raw GitHub fetch (zero build delay, works from any origin)
    try {
      const rawUrl = `https://raw.githubusercontent.com/${this.config.githubUsername}/${this.config.githubRepo}/${this.config.branch}/data/profiles/${cleanId}.json?t=${Date.now()}`;
      const res = await fetch(rawUrl, { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith("{")) {
          return JSON.parse(text);
        }
      }
    } catch (e) {
      console.warn("Raw profile fetch failed, trying fallback:", e);
    }

    // 2. Local relative path fetch (if on GitHub Pages)
    try {
      const res = await fetch(`data/profiles/${cleanId}.json?t=` + Date.now());
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith("{")) {
          return JSON.parse(text);
        }
      }
    } catch (_) {}

    // 3. GitHub REST API fallback (with token)
    try {
      const file = await this.getFile(`data/profiles/${cleanId}.json`);
      if (file && file.content) {
        const decoded = this.decodeBase64(file.content);
        return JSON.parse(decoded);
      }
    } catch (e) {
      console.warn("API profile fetch failed:", e);
    }

    throw new Error(`Profile '${id}' could not be loaded from GitHub.`);
  }
}

window.GitHubClient = GitHubClient;
