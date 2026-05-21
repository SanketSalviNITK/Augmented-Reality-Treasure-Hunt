# AR Treasure Hunt (ARTHunt)
### A Holistic Research Platform for Web-Based Augmented Reality

**[🚀 Live Demo / Hunter Portal](https://sanketsalvinitk.github.io/Augmented-Reality-Treasure-Hunt/)**

**ARTHunt** is an open-source, mobile-first platform designed to study user engagement, sustainability, and pedagogical impact in augmented reality environments. Built with **MindAR**, **Three.js**, and **Supabase**, it provides a frictionless "No-App-Download" experience for physical scavenger hunts.

---

## 🧬 Research Overview

ARTHunt was developed to address three critical gaps in modern Augmented Reality (AR) research:

1.  **Accessibility Friction (HCI Focus):** Investigating if Web-based AR (browser-only) significantly increases participant conversion compared to native apps that require installation.
2.  **Interaction Sustainability:** Evaluating the effectiveness of the **"Power Saver" (Camera Toggle)** mechanism in reducing device heat and battery drain during prolonged outdoor quests.
3.  **Sequential Cognitive Engagement:** Studying how a **Dynamic Clue/Riddle System** impacts spatial problem-solving and narrative flow in physical environments.

**Official Live Instance:** [https://augmented-reality-treasure-hunt.vercel.app/](https://augmented-reality-treasure-hunt.vercel.app/)


---

## 🚀 Key Features for Researchers

### 📊 Real-Time Analytics & CSV Export
The Creator Dashboard includes a powerful data collection engine. Researchers can download comprehensive `.csv` logs for every hunt, including:
*   **Participant Identity:** Hunter names, ages, and unique avatar IDs.
*   **Time-Series Data:** Precise start/end timestamps and duration per marker.
*   **Performance Metrics:** Success rates, score counts, and engagement patterns.

### 🔋 Battery-Aware Interaction
To solve the "Battery Anxiety" problem common in AR, we implemented a **Power Saver HUD**. This allows users to physically shut down the camera sensor while navigating between locations, significantly extending session longevity.

### 🧩 Sequential Riddle Engine
Creators can define unique riddles for every treasure. The platform handles the logic of "Target Advancement," revealing the next clue only after the previous marker has been successfully scanned.

---

## 🛠️ Getting Started

### 1. Prerequisites
*   A **Supabase** account (for real-time database and cloud storage).
*   A modern mobile browser (Chrome/Safari/Edge).

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/SanketSalviNITK/Augmented-Reality-Treasure-Hunt.git

# Navigate to the project
cd Augmented-Reality-Treasure-Hunt

# Start a local server (e.g. using serve)
npx serve -l 3000
```

### 3. Configuration
**Security First:** Never commit your Supabase API keys to version control.
1. Copy `config.js.example` to a new file named `config.js` in the root directory.
2. Add your Supabase credentials to `config.js`:
   *   `SUPABASE_URL`: Your project URL.
   *   `SUPABASE_ANON_KEY`: Your Anon Public Key.
3. **Database Setup:** Run the provided SQL scripts (if any) or ensure you have an `events` table.
4. **Storage Bucket:** Create a public bucket named `ar-assets` (used for marker images, 3D models, and live dashcam photos).

---

## 📖 Recommended Research Workflow
To ensure reproducibility in behavioral studies, researchers should follow this verified workflow:

1.  **Backend Provisioning:** Initialize a Supabase project and execute `schema.sql`.
2.  **Configuration:** Copy `.env.example` to `.env` (or `config.js.example` to `config.js`) and input credentials.
3.  **Deployment:** Run `npm run build` and deploy the `dist/` folder to a static host (e.g., Vercel).
4.  **Event Design:** Use the **Creator Studio** to define image targets, riddles, and 3D rewards.
5.  **Data Collection:** Participants join via their browser, solve riddles, and complete the quest. The **Silent Dashcam** captures evidence automatically.
6.  **Scholarly Export:** Use the **Admin Dashboard** to export the quest telemetry as a research-ready CSV for analysis in R or SPSS.

---

## 🤝 Contributing
Contributions that enhance the research capabilities of the platform (e.g., heatmaps, heart-rate API integration, or deeper social mechanics) are welcome!

**Developed by Sanket Salvi** | *Optimized for HCI & EdTech Research Workshops*
