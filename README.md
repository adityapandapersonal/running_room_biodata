# ⚡ Dynamic QR Biodata & Git-CMS System

> **A 100% Free, Serverless, Git-Powered Biodata System with Permanent Dynamic QR Codes.**  
> Create, edit, and update biodata records anytime — **the URL & printed physical QR codes never change or expire!**

---

## 🌟 Architecture Overview

```
[BYETHOST SERVER] (Admin Only)
   │
   └── admin.html  ──► 🔒 Password Protected Login Screen
                         (Hardcoded Username & Password)
                         │
                         ▼ (On Successful Login)
                       Admin Studio (Add/Edit Profiles, Upload Photos)
                         │
                         ▼ (Direct GitHub REST API Commit)
                         │
[GITHUB REPOSITORY] ─────┘
   ├── data/profiles/{id}.json    <-- Biodata Data Store
   ├── assets/photos/{id}.jpg     <-- Uploaded Photos
   ├── data/registry.json         <-- Master Registry
   └── index.html                 <-- Public Read-Only Scanner Page (GitHub Pages)
```

---

## 🔐 Admin Authentication (ByetHost Setup)

### Where to set your Username & Password?
Open [`js/config.js`](js/config.js) and look for `adminAuth`:

```javascript
adminAuth: {
  enabled: true,
  username: "aditya",           // <-- Aapka secret username
  password: "mypassword123",    // <-- Aapka secret password
  sessionKey: "byethost_admin_authenticated"
}
```

* Jab bhi koi ByetHost par `admin.html` kholega, uske samne **Cyberpunk Glassmorphism Login Card** aayega.
* Jab tak wo sahi Username aur Password nahi dalega, dashboard ka koi bhi part nahi dikhega.
* Top right me **🚪 Logout** button bhi diya gaya hai.

---

## 📁 Project Structure

```text
├── index.html                  # Public View (GitHub Pages par rahega - 100% Read-Only)
├── admin.html                  # Admin Dashboard (ByetHost par upload karein - Password Protected)
├── README.md                   # Full Documentation & Setup Guide
├── css/
│   ├── base.css                # Color variables, glassmorphism, fonts & reset
│   ├── profile.css             # Public biodata card & print-to-PDF styles
│   └── admin.css               # Admin studio, login gate & QR live preview styling
├── js/
│   ├── config.js               # Repo configuration + Admin Login Credentials
│   ├── github-api.js           # GitHub REST API client (Commits JSON, Uploads Photos)
│   ├── profile.js              # URL param reader (?id=...) and profile renderer
│   └── admin.js                # Form repeaters, Photo Base64, Live QR & Token Auth
├── data/
│   ├── registry.json           # Master list of all registered people (for admin dropdown)
│   └── profiles/
│       └── demo-aditya.json    # Sample biodata data file
└── assets/
    ├── photos/
    │   └── demo-aditya.svg     # Demo profile photo
    └── vendor/
        └── qrcode.min.js       # Offline standalone QR code generation library
```

---

## 🚀 Deployment Instructions

### Part 1: GitHub Pages (For Public Viewers)
1. Push this entire repository to GitHub:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit: Dynamic QR Biodata System"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
   git push -u origin main
   ```
2. GitHub par **Settings > Pages** me jayein aur `main` branch ko activate karein.
3. Aapka permanent public URL ready ho jayega:  
   `https://<YOUR-USERNAME>.github.io/<YOUR-REPO-NAME>/index.html?id=<person-id>`

---

### Part 2: ByetHost (For Admin Panel)
1. ByetHost cPanel me jakar **File Manager > htdocs** open karein.
2. Wahan `admin.html`, `css/`, `js/`, aur `assets/` folders upload kar dein (aap chaho toh pura repo bhi dal sakte ho).
3. Apne browser me ByetHost URL kholein:  
   `https://yourdomain.byethost.com/admin.html`
4. Login card dikhega. Username: `aditya`, Password: `mypassword123`.
5. Login hone ke baad ByetHost se directly GitHub API call hogi aur JSON + Photos aapke GitHub repo me commit ho jayenge!

---

## 💻 Local Testing Right Now

Local web server already running on:
- **Public Profile:** [http://localhost:8080/index.html?id=demo-aditya](http://localhost:8080/index.html?id=demo-aditya)
- **Admin Studio:** [http://localhost:8080/admin.html](http://localhost:8080/admin.html)
  - **Username:** `aditya`
  - **Password:** `mypassword123`
