/**
 * GitHub REST API Client for Biodata QR System
 * Handles secure commits, profile JSON creation, image upload, and registry updates.
 */
class GitHubClient {
  constructor(config) {
    this.config = config || window.APP_CONFIG;
  }

  getToken() {
    return localStorage.getItem(this.config.tokenStorageKey) || "";
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.config.tokenStorageKey, token.trim());
    } else {
      localStorage.removeItem(this.config.tokenStorageKey);
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
    const url = `https://api.github.com/repos/${this.config.githubUsername}/${this.config.githubRepo}/contents/${path}?ref=${this.config.branch}`;
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
   * Convert file/Blob to Base64 (stripping data URL prefix for GitHub API)
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // Strip data:image/...;base64,
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
  async uploadPhoto(personId, imageFile) {
    const extension = imageFile.name.split(".").pop().toLowerCase() || "jpg";
    const targetPath = `assets/photos/${personId}.${extension}`;
    
    // Check if photo already exists to obtain SHA
    const existing = await this.getFile(targetPath).catch(() => null);
    const sha = existing ? existing.sha : null;

    const base64Content = await this.fileToBase64(imageFile);
    await this.commitFile(
      targetPath,
      base64Content,
      `Upload photo for person ${personId}`,
      sha
    );

    return targetPath;
  }

  /**
   * Save complete biodata profile JSON and update registry
   */
  async saveProfile(personData, imageFile = null) {
    const id = personData.id;
    if (!id) throw new Error("Person ID is required.");

    let photoPath = personData.photo;

    // 1. Upload photo if a new file is provided
    if (imageFile) {
      photoPath = await this.uploadPhoto(id, imageFile);
      personData.photo = photoPath;
    }

    // 2. Commit profile JSON to data/profiles/{id}.json
    const profilePath = `data/profiles/${id}.json`;
    const existingProfile = await this.getFile(profilePath).catch(() => null);
    const profileSha = existingProfile ? existingProfile.sha : null;

    const jsonString = JSON.stringify(personData, null, 2);
    // Standard UTF-8 safe base64 encoding
    const jsonBase64 = btoa(unescape(encodeURIComponent(jsonString)));

    await this.commitFile(
      profilePath,
      jsonBase64,
      `Update biodata for ${personData.fullName} (${id})`,
      profileSha
    );

    // 3. Update data/registry.json so the person appears in the admin list
    await this.updateRegistry(personData);

    return {
      success: true,
      id: id,
      photoPath: photoPath,
      profileUrl: `${this.config.getBaseUrl()}?id=${id}`
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
        const decoded = decodeURIComponent(escape(atob(existing.content.replace(/\s/g, ""))));
        registry = JSON.parse(decoded);
      }
    } catch (e) {
      console.warn("No existing registry or failed to read, creating fresh registry:", e);
    }

    if (!Array.isArray(registry.profiles)) {
      registry.profiles = [];
    }

    // Upsert person entry
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
    const regBase64 = btoa(unescape(encodeURIComponent(regJson)));

    await this.commitFile(
      registryPath,
      regBase64,
      `Update registry for ${personData.fullName} (${personData.id})`,
      registrySha
    );
  }

  /**
   * Fetch all registered profiles for admin dropdown
   */
  async getRegistry() {
    // Try fetching via raw or API
    try {
      // 1. Try local or standard fetch first (fastest)
      const res = await fetch("data/registry.json?t=" + Date.now());
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}

    // 2. Fallback to GitHub API if local fetch failed
    const file = await this.getFile("data/registry.json").catch(() => null);
    if (file && file.content) {
      const decoded = decodeURIComponent(escape(atob(file.content.replace(/\s/g, ""))));
      return JSON.parse(decoded);
    }

    return { profiles: [] };
  }

  /**
   * Fetch a single profile by ID
   */
  async getProfileById(id) {
    // 1. Try standard path fetch
    try {
      const res = await fetch(`data/profiles/${id}.json?t=` + Date.now());
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}

    // 2. Fallback to GitHub API
    const file = await this.getFile(`data/profiles/${id}.json`).catch(() => null);
    if (file && file.content) {
      const decoded = decodeURIComponent(escape(atob(file.content.replace(/\s/g, ""))));
      return JSON.parse(decoded);
    }

    throw new Error(`Profile '${id}' not found.`);
  }
}

window.GitHubClient = GitHubClient;
