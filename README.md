# 🌐 CivicPulse (formerly Community Hero)
### *Hyperlocal Civic Issue Reporting, AI Verification, and Gamified Citizen Engagement*

**CivicPulse** is a state-of-the-art, hyperlocal civic action platform that empowers citizens to report, track, and resolve community infrastructure issues (such as potholes, broken streetlights, trash overflows, and safety hazards). Utilizing advanced AI visual auditing, geospatial mapping, and a gamified volunteer ecosystem, CivicPulse bridges the gap between residents and city agencies to foster clean, safe, and transparent neighborhoods.

---

## 🚀 Key Features

### 1. 🗺️ Interactive Geospatial Dashboard
*   **Live Incident Monitoring**: An interactive Leaflet-powered dark mode map that plots active community reports.
*   **Cybernetic Visual Styling**: Custom glowing HTML markers representing incident severity (`Level 1` to `Level 4`) using dynamic CSS pulses.
*   **Detailed Incident Drawer**: Slide-out log panels displaying full telemetry data, timeline progression, citizen verification buttons, and community discussion boards.

### 2. 📍 Smart Geolocation Reporting
*   **Desktop-to-Mobile Accuracy Chain**: Built-in location detection that queries high-accuracy GPS coordinates first, falling back automatically to WiFi/IP-based geolocation on laptops/desktops to prevent timeouts.
*   **Interactive Placement Map**: A draggable marker selector map allowing residents to manually point-and-click or refine their coordinates.
*   **Global Coordinate Support**: Coordinates dynamically parse positive/negative signs to support Eastern/Western and Northern/Southern hemisphere indicators correctly (e.g. `28.6139° N, 77.2090° E` in Delhi).

### 3. 🧠 AI-Powered Incident Classification (Gemini 2.5)
*   **Visual Evidence Reporting**: Accepts photo and video uploads.
*   **Video Frame Extraction**: Automatically plays uploaded videos off-screen, captures the key frame at `1.0s` via HTML5 Canvas, and submits the frame blob.
*   **Gemini Vision Classification**: Evaluates the image to automatically categorize the issue (*Roads*, *Sanitation*, *Public Safety*, or *Infrastructure*), assess severity levels, and generate a precise 2-sentence technical summary.

### 4. 🛠️ Before/After AI Resolution Auditing
*   **Volunteer Solver Protocol**: Citizens can act as "Volunteer Solvers" by fixing local issues themselves.
*   **AI Visual Verification**: Solvers upload a photo of the completed repair. CivicPulse queries the Gemini model to analyze and compare the "before" and "after" images, verifying if the issue is resolved before closing the ticket.

### 5. 🔮 Municipal Policy Advisory Console
*   **Telemetry Aggregator**: Synthesizes neighborhood-wide active reports.
*   **Urban Action Report**: Prompts Gemini to analyze active issues and generate a detailed policy report outlining Category Vulnerability Grades (A+ to F), geographical hotspots, immediate crew dispatch directives, and projected cost savings.

### 6. 🏆 Citizen Gamification Ecosystem
*   **Level & XP System**: Earn `+10 XP` for logging reports, `+5 XP` for verifications, and `+50 XP` for verified resolutions.
*   **Achievement Badges**: Unlock distinct profile badges (*Pothole Patrol*, *Light Bringer*, *Eco Shield*, *Civic Solver*) based on your contributions.
*   **Regional Leaderboard**: Real-time community standings listing top-performing neighborhood heroes.

### 🛡️ Robust Local Fallback Network
*   If your Gemini API key is missing or Google's free-tier servers return a `503 Service Unavailable` error, the API routes automatically switch to a **local rule-based logic engine**, keeping the entire app fully functional and interactive.

---

## 🛠️ Tech Stack

*   **Framework**: Next.js 16.2 (App Router, Turbopack)
*   **Runtime**: React 19.2 (Rules of Purity, dynamic client imports)
*   **AI Engine**: `@google/genai` (Gemini 2.5 Flash, Gemini 3.1 Flash-Lite)
*   **Geospatial Layer**: Leaflet.js (Vanilla client-side integration)
*   **Styling**: TailwindCSS 4.0 / Modern Vanilla CSS (Cyber-dark aesthetics, glassmorphism)
*   **Database**: Firebase Firestore & Storage (with full LocalStorage database fallback)

---

## 📂 Project Structure

```
Civic_Pulse/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/           # AI Photo Classification Endpoint
│   │   │   ├── recommendations/   # Policy Advisory Generator
│   │   │   └── resolve/           # Before/After Resolution Auditor
│   │   ├── dashboard/             # Main Interactive Portal
│   │   ├── report/                # Geolocation Report Submission Page
│   │   ├── globals.css            # Dark mode overrides & glows
│   │   └── layout.tsx             # Root Layout (Google Fonts: Inter)
│   ├── components/
│   │   ├── MapComponent.tsx       # Live Dashboard Leaflet Map
│   │   └── ReportMapSelector.tsx  # Draggable Reporting Selector Map
│   └── lib/
│       └── firebase.ts            # LocalStorage & Firebase connector
├── .env.local                     # Environment Variables
├── package.json                   # Dependency Configuration
└── tsconfig.json                  # TypeScript Compiler Rules
```

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/civic-pulse.git
cd civic-pulse
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory (or edit the existing one):
```env
# Gemini API Key (obtain from https://aistudio.google.com/)
GEMINI_API_KEY=AIzaSyYourGeminiAPIKeyHere

# Optional: Firebase Config (falls back to LocalStorage automatically if left blank!)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### 3. Run the Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Validation & Type Safety
The project passes strict compilation, TypeScript, and linting rules:

*   **ESLint Audit**: Run linting tests with `npx eslint --quiet` to verify zero styling/hook errors.
*   **Production Build**: Run `npm run build` to verify Next.js Turbopack compilation.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
