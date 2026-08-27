# 🌿 CivicPulse: AI-Powered Hyperlocal Civic Action Platform

This document contains the detailed project description for the **CivicPulse** submission. You can copy and paste this content directly into your Google Doc.

---

## 📌 1. Problem Statement Selected
Modern urban environments suffer from a widening coordination gap between citizens and municipal authorities. When local infrastructure issues arise—such as severe road erosion (potholes), broken streetlights, or sanitation overflows—traditional report channels fall short due to:
- **Lack of Transparency & Feedback**: Citizens submit complaints but rarely receive updates or proof that their concerns are being addressed.
- **Authority Routing Bottlenecks**: Sorting, classifying, and assigning reported incidents to the correct municipal departments is slow and human-resource intensive.
- **Low Public Motivation**: A lack of engaging mechanisms leads to public apathy, keeping citizens from actively advocating for their local neighborhoods.
- **Resolution Verification Deficits**: Verifying that a contractor or volunteer actually fixed an issue typically requires manual field audits, which are slow and expensive.

---

## 💡 2. Solution Overview
**CivicPulse** is a state-of-the-art, hyperlocal civic engagement platform that bridges this gap. It turns citizens into active community advocates by combining real-time mapping, gamification, and autonomous AI-driven routing and verification loops. 

Whenever a citizen uploads a photo or a video of an infrastructure hazard, CivicPulse automatically:
1.  **Locates & Classifies**: Pinpoints coordinates (using GPS or manual drag-and-drop map markers) and categorizes the issue using Google Gemini's multimodal intelligence.
2.  **Formulates Autonomous Action Plans**: Dynamically generates a municipal work order detailing the responsible department, required repair tools, safety protocols, and priority.
3.  **Mobilizes Community Action**: Gamifies citizen engagement by awarding Experience Points (XP) and badges for reporting, voting, and resolving issues.
4.  **Audits Resolutions via Before/After AI Loop**: Allows citizens to upload a photo of the completed repair. The Gemini engine compares the "before" and "after" images to verify the fix autonomously, close the ticket, and calculate the environmental and economic impact of the resolution.

---

## ✨ 3. Key Features
- **Interactive Dark-Mode Geospatial Map**: A cybernetic Leaflet-based live map showing active and resolved issues. Customized pins indicate issue categories, and standard map tiles are dynamically inverted to fit the application's premium aesthetic.
- **Multimodal Video & Image Telemetry**: Users can report incidents by uploading photos or video files. For videos, the client-side system renders the video off-screen, extracts a representative frame, and passes it to the AI classifier.
- **Agentic AI Action Planning**: For every new report, the platform writes an autonomous dispatch ticket detailing tool requirements and safety compliance, and posts an automated work-order comment on the community bulletin board.
- **Before/After Visual Auditor**: A secure, AI-powered verification route that checks the validity of a fix, eliminating the need for slow, manual municipal inspection visits.
- **🌿 Verified Community Impact Ledger**: Resolved issues display verified sustainability statistics:
  - **Carbon Offset (KG CO₂)**: Carbon emission savings from preventing decaying waste or optimizing vehicle routes.
  - **Citizen Commuter Savings (₹)**: Financial savings from preventing vehicle suspension damage and traffic delays.
  - **Safety Boost (%)**: Security index gains (e.g., lighting up dark corridors).
- **Impact Statistics Console**: A consolidated telemetry dashboard that aggregates the total CO₂ saved, Rupees saved, and safety audits completed across the entire community.
- **Gamified Citizen Network**: A sidebar XP progress bar, unlocked badge chest (awards like *Pothole Patrol*, *Eco Shield*, *Light Bringer*, *Civic Solver*), and a live regional leaderboard that turns civic duty into a rewarding cooperative game.

---

## 🛠️ 4. Technologies Used
- **Frontend Core**: Next.js 16 (React 19) built with TypeScript.
- **Styling**: Vanilla CSS and Tailwind CSS (v4) with custom glassmorphic properties, cybernetic color palettes, and neon glows.
- **Mapping Engine**: Leaflet.js with custom HTML/CSS map markers.
- **Storage & Hosting**: Firebase Storage (for media assets) and Google Cloud Run.
- **State Management**: React State integrated with real-time Firestore database triggers (with automatic fallback to LocalStorage for zero-dependency local runs).

---

## ☁️ 5. Google Technologies Utilized
- **Google Gemini API (`gemini-2.5-flash`)**: 
  - *Multimodal Classifier*: Analyzes citizen media (photos/video frames) to extract category, severity, and short summaries.
  - *Agentic Dispatcher*: Generates structured JSON action plans outlining department routing, required tools, and safety protocols.
  - *Visual Auditor*: Evaluates before/after resolution proof images to verify if a hazard is resolved.
  - *Policy Advisory Engine*: Analyzes regional report trends and synthesizes custom policy recommendations for city administrators.
- **Google Firebase**:
  - *Firestore*: Handles real-time synchronization of civic reports, comments, status transitions, and user gamification XP.
  - *Storage*: Securely hosts citizen-uploaded hazard telemetry and resolution verification proof images.
- **Google Cloud Platform (GCP)**:
  - *Cloud Run*: Serves containerized standalone Next.js builds.
  - *Cloud Build*: Automates continuous integration and deployment (CI/CD) pipelines directly from GitHub.
