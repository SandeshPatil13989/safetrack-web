# SafeTrack — Web Dashboard 🌐

![SafeTrack](https://img.shields.io/badge/SafeTrack-Live-brightgreen)
![React](https://img.shields.io/badge/React-19.x-blue)
![Firebase](https://img.shields.io/badge/Firebase-Realtime%20DB-orange)
![Vercel](https://img.shields.io/badge/Hosted-Vercel-black)
![License](https://img.shields.io/badge/License-MIT-green)

Real-Time Location Tracking Web Dashboard with Intelligent Emergency Alerts

🔗 **Live Demo:** https://safetrack-web-999.vercel.app

---

## 📸 Screenshots

| Live Map | Speed Chart | History |
|---|---|---|
| Real-time GPS tracking | Speed analytics | Location history |

---

## ✨ Features

- 🗺️ **Live Map** — Real-time GPS tracking with OpenStreetMap
- 🛣️ **Road Snapping** — Routes follow actual roads using OSRM API
- 📍 **Address Display** — Real street addresses using Nominatim + BigDataCloud
- 📊 **Speed Chart** — Live speed analytics with max/avg stats
- 🚨 **SOS Alerts** — Emergency alert panel with audio alarm
- 📜 **Location History** — Last 100 points with timestamps and addresses
- 📄 **PDF Export** — Download full location history as PDF report
- 🔴 **Geofence** — Inside/outside zone detection
- 🎬 **Route Replay** — Animated playback of complete journey
- 👤 **User Profile** — Name, email, phone number display
- 🗺️ **Map Styles** — Street, Satellite, Terrain, Dark
- 👥 **Multi-user** — Track multiple devices simultaneously
- ✕ **Remove User** — Delete tracked user from dashboard

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React.js | 19.x | Web framework |
| Firebase SDK | 12.x | Real-time database + auth |
| React-Leaflet | 5.x | Interactive maps |
| OpenStreetMap | Free | Map tiles |
| Recharts | 3.x | Speed charts |
| jsPDF | 4.x | PDF generation |
| OSRM API | Free | Road snapping |
| Nominatim | Free | Reverse geocoding |
| BigDataCloud | Free | Reverse geocoding |
| Vercel | Free | Hosting |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project

### Installation

```bash
# Clone the repository
git clone https://github.com/SandeshPatil13989/safetrack-web.git

# Navigate to project
cd safetrack-web

# Install dependencies
npm install
```

### Firebase Configuration

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password)
3. Enable **Realtime Database**
4. Copy your Firebase config
5. Create `src/firebase.js`:

```javascript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
```

### Running Locally

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
```

---

## 📁 Project Structure

```
safetrack-web/
├── public/
│   └── index.html
├── src/
│   ├── App.js              # Main app with auth routing
│   ├── App.css             # Global styles
│   ├── firebase.js         # Firebase configuration
│   └── pages/
│       ├── LoginPage.js    # Login/Register page
│       └── Dashboard.js    # Main dashboard (all features)
├── package.json
└── README.md
```

---

## 🌐 Deployment on Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Set build command: `CI=false react-scripts build`
5. Deploy!

### Add Vercel domain to Firebase:
1. Go to Firebase Console → Authentication → Settings → Authorised domains
2. Add your Vercel URL (e.g., `safetrack-web-999.vercel.app`)

---

## 🔥 Firebase Database Structure

```
safetrack-3742c/
├── locations/
│   └── {uid}/
│       ├── current/        # Latest location
│       │   ├── latitude
│       │   ├── longitude
│       │   ├── speed
│       │   ├── accuracy
│       │   └── timestamp
│       └── history/        # Last 100 points
│           └── {pushId}/
├── sos/
│   └── {uid}/
│       ├── active
│       ├── timestamp
│       └── userName
├── geofences/
│   └── {uid}/
│       └── {fenceId}/
│           ├── name
│           ├── latitude
│           ├── longitude
│           └── radius
└── users/
    └── {uid}/
        ├── name
        ├── email
        └── phone
```

---

## 📊 Performance

| Metric | Value |
|---|---|
| Location Update Rate | Every 2-3 seconds |
| Dashboard Refresh | < 1 second (Firebase live) |
| Address Lookup | 1-2 seconds |
| Road Snapping | 2-5 seconds |
| PDF Generation | Instant |
| Max Users Tracked | Unlimited |

---

## 🔗 Related Repository

📱 **Mobile App:** https://github.com/SandeshPatil13989/safetrack-mobile

---

## 👨‍💻 Developer

**Sandesh(Roshan) Patil**
- 🎓 B.E. Computer Science and Engineering
- 🏫 Jain College of Engineering, Belagavi
- 🎓 Visvesvaraya Technological University (VTU)

---

## 📄 License

This project is licensed under the MIT License.