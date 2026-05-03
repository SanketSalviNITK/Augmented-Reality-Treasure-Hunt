# ARTHunt: A Zero-Friction WebAR Framework for Real-Time Spatial Tracking and Gamified Behavioral Data Collection

## 1. Motivation and Significance

Researchers investigating spatial navigation, ubiquitous learning, and pervasive gaming face a significant technological barrier. Conducting robust field studies in physical environments (such as museums, university campuses, or urban centers) typically requires the development of custom Augmented Reality (AR) applications. These native applications (iOS/Android) demand specialized software engineering expertise and introduce severe "accessibility friction"—requiring participants to download heavy application packages prior to participation. This friction reliably leads to high participant attrition rates and limits the scale of in-the-wild behavioral studies.

Furthermore, traditional methodologies for tracking participant movement and engagement in these spaces often rely on obtrusive external hardware, such as GPS trackers, wearable cameras, or manual observation, which can alter participant behavior and compromise ecological validity. 

To bridge this gap, we introduce **ARTHunt**, an open-source, zero-friction Web-Based Augmented Reality (WebAR) platform. ARTHunt democratizes pervasive game research by providing a dynamic, no-code authoring environment for researchers, coupled with an automated data-collection apparatus that requires only a standard mobile web browser from the participant.

## 2. Software Description

ARTHunt is constructed using a decoupled, serverless architecture that prioritizes real-time synchronization and client-side compilation.

### 2.1 Software Architecture
The platform's frontend is engineered using **HTML5**, **CSS3**, and vanilla **JavaScript**, ensuring maximum compatibility across mobile operating systems. The core AR rendering engine utilizes **Three.js** for 3D object manipulation and **MindAR**, a lightweight, browser-native computer vision library for image tracking. By executing the computer vision algorithms directly in the client's browser, ARTHunt entirely bypasses the need for native app installations.

State management and real-time data synchronization are handled by **Supabase**, an open-source PostgreSQL backend. The platform utilizes a JSON-based database schema, allowing researchers to dynamically configure complex events, narrative riddles, and 3D asset links without altering the underlying backend architecture. Image assets, including 3D models and captured participant photos, are securely processed as binary large objects (Blobs) and pushed to Supabase Cloud Storage.

### 2.2 Software Functionalities

ARTHunt provides a holistic ecosystem divided into two primary interfaces: the Creator Studio (for researchers) and the Hunter Portal (for participants).

*   **Dynamic Authoring (Creator Studio):** Researchers can effortlessly author complex spatial quests by uploading 2D target images, assigning 3D models, and defining sequential narrative riddles. The system autonomously compiles the necessary computer vision tracking files (`.mind`) within the browser.
*   **The "Silent Dashcam" Spatial Tracking:** To accurately measure spatial navigation without external hardware, ARTHunt employs a novel automated capture mechanism. Upon successful detection of a physical marker, the engine silently captures a composite image of the AR canvas and the camera feed, appending a precise millisecond timestamp. This allows researchers to mathematically calculate the exact duration of spatial traversal between physical waypoints.
*   **Voluntary Engagement Tracking (Selfie Mode):** Alongside the automated dashcam, participants can voluntarily capture "Selfies" with augmented artifacts. The ratio of forced dashcam captures to voluntary selfies provides researchers with a quantifiable proxy metric for user engagement and immersion.
*   **Live Event Monitor:** Researchers are provided with a real-time command center, featuring a dynamic photo grid and live leaderboard, allowing for asynchronous observation of participant progress during an active field study.
*   **Academic Data Exporter:** A critical tool for quantitative analysis, the platform includes a one-click CSV generation utility. This exporter automatically calculates exact millisecond spatial tracking durations, cognitive load metrics (hint penalties), and qualitative UX survey scores, formatting the data specifically for immediate ingestion into statistical software such as SPSS, R, or Python Pandas.

## 3. Illustrative Examples
*(Note to Author: Insert Screenshots Here)*
1. **Setup:** A researcher uses the Creator Studio to upload 5 target markers representing historical statues on a university campus.
2. **Execution:** Participants navigate the campus, using the WebAR interface to solve clues. The Live Monitor populates in real-time with dashcam verification photos as each statue is discovered.
3. **Data Analysis:** The researcher utilizes the Academic Exporter to generate a CSV file. The output clearly delineates the `Time to M1 (ms)`, `Time to M2 (ms)`, and final UX survey ratings, allowing for immediate ANOVA testing regarding the difficulty of the spatial layout.

## 4. Impact

ARTHunt significantly lowers the barrier to entry for behavioral and educational researchers wishing to conduct pervasive, location-based studies. By eliminating the necessity for custom app development and obtrusive tracking hardware, ARTHunt allows scientists to gather highly accurate spatial traversal data and engagement metrics seamlessly in the background. The open-source nature of the platform encourages continuous adaptation, enabling future integrations such as physiological sensor APIs or multiplayer behavioral dynamics.

## 5. Conclusions
ARTHunt successfully bridges the gap between advanced computer vision technologies and accessible behavioral research methodologies. By combining zero-friction WebAR with automated, timestamped data collection, it provides a highly rigorous, yet easily deployable apparatus for scientific inquiry in ubiquitous computing and smart tourism.
