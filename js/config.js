/**
 * Global Configuration for Biodata QR System
 * Configured for ByetHost Admin + GitHub Sync
 */
const APP_CONFIG = {
  // 1. GitHub Repository Configuration
  githubUsername: "adityapandapersonal",
  githubRepo: "running_room_biodata",
  branch: "main",

  // Note: Keep defaultGithubToken empty in public repo to prevent GitHub secret revoking.
  // The token is entered once in the Admin Studio and stored securely in localStorage.
  defaultGithubToken: "",

  // 2. Hardcoded Admin Authentication (Set your desired username & password here)
  adminAuth: {
    enabled: true,
    username: "aditya",           // <-- You can change this username anytime
    password: "mypassword123",    // <-- You can change this password anytime
    sessionKey: "byethost_admin_authenticated"
  },

  // Local storage key for storing admin token
  tokenStorageKey: "biodata_github_pat",

  // Base URL for QR codes.
  // Physical QR codes will point to your GitHub Pages public profile URL
  getBaseUrl: function () {
    const isLocal = window.location.hostname === "localhost" || 
                    window.location.hostname === "127.0.0.1" || 
                    window.location.protocol === "file:";
    if (isLocal) {
      const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      return `${window.location.origin}${path}index.html`;
    }
    // GitHub Pages standard URL for public scanner
    return `https://${this.githubUsername}.github.io/${this.githubRepo}/index.html`;
  }
};

window.APP_CONFIG = APP_CONFIG;
