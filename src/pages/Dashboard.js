import React, { useState, useEffect, useRef } from "react";
import { auth, database } from "../firebase";
import { signOut } from "firebase/auth";
import { ref, onValue, off, remove } from "firebase/database";
import {
  MapContainer, TileLayer, Marker, Popup, Polyline,
  Circle, useMap, ZoomControl, ScaleControl
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const SafeTrackLogo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#0D1F3C"/>
    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(46,204,113,0.15)" strokeWidth="1.5"/>
    <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(46,204,113,0.25)" strokeWidth="1.5"/>
    <circle cx="50" cy="50" r="22" fill="rgba(46,134,193,0.2)" stroke="#2E86C1" strokeWidth="1.5"/>
    <path d="M50 28 Q64 28 64 42 Q64 54 50 68 Q36 54 36 42 Q36 28 50 28 Z" fill="#2E86C1"/>
    <circle cx="50" cy="42" r="7" fill="white"/>
    <circle cx="50" cy="42" r="3" fill="#2E86C1"/>
    <circle cx="50" cy="70" r="3.5" fill="#2ECC71"/>
  </svg>
);

function MapController({ position, selectedUser }) {
  const map = useMap();
  const lastUserRef = useRef(null);
  useEffect(() => {
    if (!position) return;
    if (lastUserRef.current === selectedUser) return;
    lastUserRef.current = selectedUser;
    setTimeout(() => {
      map.setView([position.latitude, position.longitude], 16, { animate: false });
    }, 100);
  }, [selectedUser, map]);
  return null;
}

function ReplayController({ replayPos }) {
  const map = useMap();
  useEffect(() => {
    if (replayPos) {
      map.setView([replayPos.lat, replayPos.lng], 16, { animate: true, duration: 0.3 });
    }
  }, [replayPos, map]);
  return null;
}

const MAP_STYLES = [
  { id: "street", label: "Street", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" },
  { id: "satellite", label: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" },
  { id: "terrain", label: "Terrain", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" },
  { id: "dark", label: "Dark", url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png" },
];

const AVATAR_COLORS = [
  { bg: "rgba(46,134,193,0.25)", color: "#2E86C1" },
  { bg: "rgba(46,204,113,0.25)", color: "#2ECC71" },
  { bg: "rgba(155,89,182,0.25)", color: "#9B59B6" },
  { bg: "rgba(230,126,34,0.25)", color: "#E67E22" },
  { bg: "rgba(231,76,60,0.25)", color: "#E74C3C" },
];

function calcDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const R = 6371;
    const dLat = ((points[i].latitude - points[i-1].latitude) * Math.PI) / 180;
    const dLon = ((points[i].longitude - points[i-1].longitude) * Math.PI) / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
      Math.cos((points[i-1].latitude * Math.PI)/180) *
      Math.cos((points[i].latitude * Math.PI)/180) *
      Math.sin(dLon/2)*Math.sin(dLon/2);
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  return total;
}

const parseNominatimAddress = (data) => {
  if (!data) return null;
  if (data.address) {
    const a = data.address;
    const parts = [
      a.road || a.pedestrian || a.footway || a.path || a.street,
      a.village || a.hamlet || a.suburb || a.neighbourhood || a.town,
      a.city || a.county || a.state_district,
      a.state,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  if (data.display_name) return data.display_name.split(",").slice(0, 3).join(", ");
  return null;
};

const parseBigDataAddress = (data) => {
  if (!data) return null;
  const parts = [data.locality || data.city, data.principalSubdivision, data.countryName].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
};

export default function Dashboard() {
  const [trackedUsers, setTrackedUsers] = useState({});
  const [userNames, setUserNames] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [sosAlerts, setSosAlerts] = useState({});
  const [geofences, setGeofences] = useState({});
  const [activeTab, setActiveTab] = useState("map");
  const [currentAddress, setCurrentAddress] = useState("Getting address...");
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPos, setReplayPos] = useState(null);
  const [mapStyle, setMapStyle] = useState("street");
  const [showAllUsers, setShowAllUsers] = useState(true);
  const [speedData, setSpeedData] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [historyAddresses, setHistoryAddresses] = useState({});
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [snappedRoute, setSnappedRoute] = useState([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const replayRef = useRef(null);
  const addressTimers = useRef([]);
  const prevSOSRef = useRef(0);

  const playSOSAlarm = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (startTime) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "square";
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      };
      for (let i = 0; i < 6; i++) playBeep(ctx.currentTime + i * 0.5);
    } catch (e) {}
  };

  const exportPDF = () => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF();
      const name = getUserName(selectedUser);
      const now = new Date().toLocaleString();
      const distance = calcDistance(locationHistory).toFixed(2);
      const maxSpd = Math.max(...locationHistory.map(p => Number(p.speed || 0) * 3.6), 0).toFixed(1);
      const avgSpd = locationHistory.length > 0
        ? (locationHistory.reduce((a, b) => a + Number(b.speed || 0) * 3.6, 0) / locationHistory.length).toFixed(1)
        : "0.0";

      doc.setFillColor(26, 60, 110);
      doc.rect(0, 0, 210, 35, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("SafeTrack", 14, 15);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Real-Time Location Tracking Report", 14, 24);
      doc.setFontSize(9);
      doc.text("Generated: " + now, 14, 31);

      doc.setFillColor(240, 245, 255);
      doc.rect(14, 42, 182, 28, "F");
      doc.setTextColor(26, 60, 110);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("User: " + name, 18, 52);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("Email: " + (userProfiles[selectedUser]?.email || "N/A"), 18, 59);
      doc.text("Phone: " + (userProfiles[selectedUser]?.phone || "N/A"), 18, 65);

      doc.setFillColor(46, 134, 193);
      doc.rect(14, 76, 182, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("JOURNEY SUMMARY", 18, 82);

      autoTable(doc, {
        startY: 86,
        head: [],
        body: [
          ["Total Distance", distance + " km"],
          ["Total Points", locationHistory.length + " points"],
          ["Max Speed", maxSpd + " km/h"],
          ["Avg Speed", avgSpd + " km/h"],
          ["Current Address", currentAddress],
          ["Report Date", now],
        ],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: "bold", fillColor: [240, 245, 255], textColor: [26, 60, 110], cellWidth: 50 },
          1: { textColor: [40, 40, 40] },
        },
        margin: { left: 14, right: 14 },
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFillColor(46, 134, 193);
      doc.rect(14, finalY, 182, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("LOCATION HISTORY (" + locationHistory.length + " points)", 18, finalY + 6);

      autoTable(doc, {
        startY: finalY + 10,
        head: [["#", "Timestamp", "Latitude", "Longitude", "Speed", "Address"]],
        body: [...locationHistory].reverse().map((point, i) => {
          const key = point.latitude.toFixed(6) + "," + point.longitude.toFixed(6);
          return [
            String(locationHistory.length - i),
            new Date(point.timestamp).toLocaleString(),
            Number(point.latitude).toFixed(6),
            Number(point.longitude).toFixed(6),
            (Number(point.speed || 0) * 3.6).toFixed(1) + " km/h",
            historyAddresses[key] || "Loading...",
          ];
        }),
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [26, 60, 110], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 38 },
          2: { cellWidth: 24 },
          3: { cellWidth: 24 },
          4: { cellWidth: 18 },
          5: { cellWidth: 68 },
        },
        margin: { left: 14, right: 14 },
        alternateRowStyles: { fillColor: [245, 248, 255] },
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("SafeTrack — Page " + i + " of " + pageCount, 105, 290, { align: "center" });
      }

      doc.save("SafeTrack_" + name.replace(/ /g, "_") + "_" + Date.now() + ".pdf");
    } catch (e) {
      alert("PDF export failed: " + e.message);
    }
    setIsExportingPDF(false);
  };

  useEffect(() => {
    if (!currentLocation) return;
    const timer = setTimeout(() => {
      fetch(
        "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
        currentLocation.latitude + "&longitude=" + currentLocation.longitude + "&localityLanguage=en"
      )
        .then((res) => res.json())
        .then((data) => {
          const address = parseBigDataAddress(data);
          if (address) { setCurrentAddress(address); return; }
          return fetch(
            "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
            currentLocation.latitude + "&lon=" + currentLocation.longitude + "&zoom=18&addressdetails=1",
            { headers: { "Accept-Language": "en" } }
          ).then((res) => res.json()).then((data2) => {
            const address2 = parseNominatimAddress(data2);
            setCurrentAddress(address2 || "Near " + currentLocation.latitude.toFixed(4) + ", " + currentLocation.longitude.toFixed(4));
          });
        })
        .catch(() => setCurrentAddress("Near " + currentLocation.latitude.toFixed(4) + ", " + currentLocation.longitude.toFixed(4)));
    }, 500);
    return () => clearTimeout(timer);
  }, [currentLocation]);

  useEffect(() => {
    addressTimers.current.forEach(clearTimeout);
    addressTimers.current = [];
    setHistoryAddresses({});
    if (locationHistory.length === 0) return;

    const reversed = [...locationHistory].reverse();
    const BATCH_SIZE = 10;
    const BATCH_DELAY = 500;

    const fetchOne = async (point) => {
      const key = point.latitude.toFixed(6) + "," + point.longitude.toFixed(6);
      try {
        const res = await fetch(
          "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
          point.latitude + "&longitude=" + point.longitude + "&localityLanguage=en"
        );
        const data = await res.json();
        const address = parseBigDataAddress(data);
        if (address) { setHistoryAddresses((prev) => ({ ...prev, [key]: address })); return; }
        const res2 = await fetch(
          "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
          point.latitude + "&lon=" + point.longitude + "&zoom=18&addressdetails=1",
          { headers: { "Accept-Language": "en" } }
        );
        const data2 = await res2.json();
        const address2 = parseNominatimAddress(data2);
        setHistoryAddresses((prev) => ({
          ...prev,
          [key]: address2 || (point.latitude.toFixed(4) + ", " + point.longitude.toFixed(4)),
        }));
      } catch (e) {
        setHistoryAddresses((prev) => ({
          ...prev,
          [key]: point.latitude.toFixed(4) + ", " + point.longitude.toFixed(4),
        }));
      }
    };

    const processBatch = (batchIndex) => {
      const start = batchIndex * BATCH_SIZE;
      const batch = reversed.slice(start, start + BATCH_SIZE);
      if (batch.length === 0) return;
      batch.forEach((point) => fetchOne(point));
      if (start + BATCH_SIZE < reversed.length) {
        const timer = setTimeout(() => processBatch(batchIndex + 1), BATCH_DELAY);
        addressTimers.current.push(timer);
      }
    };

    processBatch(0);
    return () => addressTimers.current.forEach(clearTimeout);
  }, [locationHistory]);

  useEffect(() => {
    if (locationHistory.length < 2) { setSnappedRoute([]); return; }
    const snapToRoads = async () => {
      setIsSnapping(true);
      try {
        const points = locationHistory.slice(-100);
        const coords = points.map((p) => p.longitude.toFixed(6) + "," + p.latitude.toFixed(6)).join(";");
        const res = await fetch(
          "https://router.project-osrm.org/match/v1/driving/" + coords +
          "?overview=full&geometries=geojson&radiuses=" + points.map(() => "25").join(";")
        );
        const data = await res.json();
        if (data.code === "Ok" && data.matchings && data.matchings.length > 0) {
          setSnappedRoute(data.matchings.flatMap((m) => m.geometry.coordinates.map((c) => [c[1], c[0]])));
        } else { setSnappedRoute([]); }
      } catch (e) { setSnappedRoute([]); }
      setIsSnapping(false);
    };
    snapToRoads();
  }, [locationHistory]);

  useEffect(() => {
    if (locationHistory.length === 0) return;
    const data = locationHistory.slice(-30).map((point, i) => ({
      index: i + 1,
      speed: Number((Number(point.speed || 0) * 3.6).toFixed(1)),
      time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
    setSpeedData(data);
  }, [locationHistory]);

  useEffect(() => {
    if (isReplaying && locationHistory.length > 0) {
      replayRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= locationHistory.length - 1) { setIsReplaying(false); clearInterval(replayRef.current); return prev; }
          const next = prev + 1;
          setReplayPos({ lat: locationHistory[next].latitude, lng: locationHistory[next].longitude });
          return next;
        });
      }, 300);
    } else { clearInterval(replayRef.current); }
    return () => clearInterval(replayRef.current);
  }, [isReplaying, locationHistory]);

  const startReplay = () => {
    if (locationHistory.length < 2) return;
    setReplayIndex(0);
    setReplayPos({ lat: locationHistory[0].latitude, lng: locationHistory[0].longitude });
    setIsReplaying(true);
  };

  const stopReplay = () => { setIsReplaying(false); setReplayPos(null); clearInterval(replayRef.current); };

  const removeUser = (uid, name, e) => {
    e.stopPropagation();
    if (window.confirm("Remove " + name + " from tracking?\n\nThis will delete their location data.")) {
      remove(ref(database, "locations/" + uid));
      remove(ref(database, "sos/" + uid));
      remove(ref(database, "geofences/" + uid));
      if (selectedUser === uid) setSelectedUser(null);
    }
  };

  useEffect(() => {
    const locationsRef = ref(database, "locations");
    onValue(locationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const users = {};
        Object.keys(data).forEach((uid) => { if (data[uid].current) users[uid] = data[uid].current; });
        setTrackedUsers(users);
        if (!selectedUser && Object.keys(users).length > 0) setSelectedUser(Object.keys(users)[0]);
      } else { setTrackedUsers({}); }
    });
    const sosRef = ref(database, "sos");
    onValue(sosRef, (snapshot) => { if (snapshot.exists()) setSosAlerts(snapshot.val()); });
    const usersRef = ref(database, "users");
    onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const names = {}; const profiles = {};
        Object.keys(data).forEach((uid) => { names[uid] = data[uid].name || "User " + uid.substring(0, 6); profiles[uid] = data[uid]; });
        setUserNames(names); setUserProfiles(profiles);
      }
    });
    return () => { off(ref(database, "locations")); off(ref(database, "sos")); off(ref(database, "users")); };
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setIsReplaying(false); setReplayPos(null); setCurrentLocation(null);
    setLocationHistory([]); setHistoryAddresses({}); setSnappedRoute([]);
    clearInterval(replayRef.current);
    const currentRef = ref(database, "locations/" + selectedUser + "/current");
    onValue(currentRef, (snapshot) => { if (snapshot.exists()) setCurrentLocation(snapshot.val()); });
    const historyRef = ref(database, "locations/" + selectedUser + "/history");
    onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = Object.values(snapshot.val());
        data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setLocationHistory(data.slice(-100));
      } else { setLocationHistory([]); }
    });
    const geofenceRef = ref(database, "geofences/" + selectedUser);
    onValue(geofenceRef, (snapshot) => { if (snapshot.exists()) setGeofences(snapshot.val()); else setGeofences({}); });
    return () => {
      off(ref(database, "locations/" + selectedUser + "/current"));
      off(ref(database, "locations/" + selectedUser + "/history"));
      off(ref(database, "geofences/" + selectedUser));
    };
  }, [selectedUser]);

  const activeSOS = Object.entries(sosAlerts).filter(([, v]) => v.active);
  useEffect(() => { if (activeSOS.length > prevSOSRef.current) playSOSAlarm(); prevSOSRef.current = activeSOS.length; }, [activeSOS.length]);

  const formatTime = (ts) => { try { return new Date(ts).toLocaleString(); } catch (e) { return ts; } };
  const getTimeDiff = (ts) => {
    try {
      const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
      if (diff < 60) return diff + "s ago";
      if (diff < 3600) return Math.floor(diff / 60) + "m ago";
      return Math.floor(diff / 3600) + "h ago";
    } catch (e) { return ""; }
  };
  const isRecent = (ts) => { try { return (Date.now() - new Date(ts)) / 1000 < 300; } catch (e) { return false; } };
  const getUserName = (uid) => { if (!uid) return "Unknown"; return userNames[uid] || "User " + uid.substring(0, 8); };
  const getAvatarColor = (uid) => { if (!uid) return AVATAR_COLORS[0]; return AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length]; };

  const isInsideGeofence = (fence) => {
    if (!currentLocation) return false;
    const R = 6371000;
    const lat1 = (currentLocation.latitude * Math.PI) / 180;
    const lat2 = (fence.latitude * Math.PI) / 180;
    const dLat = ((fence.latitude - currentLocation.latitude) * Math.PI) / 180;
    const dLon = ((fence.longitude - currentLocation.longitude) * Math.PI) / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= fence.radius;
  };

  const distanceTraveled = calcDistance(locationHistory);
  const currentMapStyle = MAP_STYLES.find((s) => s.id === mapStyle) || MAP_STYLES[0];
  const maxSpeed = Math.max(...speedData.map(d => d.speed), 0);
  const avgSpeed = speedData.length > 0 ? speedData.reduce((a, b) => a + b.speed, 0) / speedData.length : 0;
  const openGoogleMaps = () => { if (currentLocation) window.open("https://www.google.com/maps?q=" + currentLocation.latitude + "," + currentLocation.longitude, "_blank"); };
  const activeMarkerPos = replayPos ? [replayPos.lat, replayPos.lng] : currentLocation ? [currentLocation.latitude, currentLocation.longitude] : null;
  const selectedProfile = userProfiles[selectedUser] || {};
  const getHistoryAddress = (point) => { const key = point.latitude.toFixed(6) + "," + point.longitude.toFixed(6); return historyAddresses[key] || "Loading..."; };

  return (
    <div style={S.app}>
      {activeSOS.length > 0 && (
        <div style={S.sosBanner}>
          <span style={{ fontSize: "16px" }}>🚨</span>
          {"EMERGENCY — " + activeSOS.length + " SOS ALERT ACTIVE"}
          {activeSOS.map(([uid]) => (<span key={uid} style={S.sosNameTag}>{getUserName(uid)}</span>))}
        </div>
      )}

      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logoBox}>
            <SafeTrackLogo size={26} />
          </div>
          <span style={S.logoText}>SafeTrack</span>
          <span style={S.liveBadge}>LIVE</span>
        </div>
        <div style={S.headerRight}>
          <span style={S.emailText}>{auth.currentUser?.email}</span>
          <button style={S.logoutBtn} onClick={() => signOut(auth)}>Logout</button>
        </div>
      </div>

      <div style={S.body}>
        <div style={S.sidebar}>
          <div style={S.sidebarLabel}>{"TRACKED DEVICES (" + Object.keys(trackedUsers).length + ")"}</div>
          {Object.keys(trackedUsers).length === 0 ? (
            <div style={S.emptyState}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📵</div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>No devices tracked yet</div>
            </div>
          ) : (
            Object.entries(trackedUsers).map(([uid, location]) => {
              const isActive = selectedUser === uid;
              const recent = isRecent(location.timestamp);
              const avatarColor = getAvatarColor(uid);
              return (
                <div key={uid} onClick={() => setSelectedUser(uid)} style={{
                  ...S.deviceCard,
                  borderColor: isActive ? "#2E86C1" : "rgba(255,255,255,0.06)",
                  backgroundColor: isActive ? "rgba(46,134,193,0.12)" : "rgba(255,255,255,0.02)",
                }}>
                  <div style={S.cardTop}>
                    <div style={{ ...S.avatar, backgroundColor: avatarColor.bg, color: avatarColor.color }}>{getUserName(uid)[0].toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={S.cardName}>{getUserName(uid)}</div>
                      <div style={S.cardStatus}>
                        <div style={{ ...S.statusDot, backgroundColor: recent ? "#2ECC71" : "#555" }}></div>
                        <span style={{ fontSize: "11px", color: recent ? "#2ECC71" : "rgba(255,255,255,0.25)" }}>{recent ? "Live • " : ""}{getTimeDiff(location.timestamp)}</span>
                      </div>
                    </div>
                    {sosAlerts[uid] && sosAlerts[uid].active && <div style={S.sosTag}>SOS</div>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                    <div style={S.cardCoords}>{Number(location.latitude).toFixed(5) + ", " + Number(location.longitude).toFixed(5)}</div>
                    <button onClick={(e) => removeUser(uid, getUserName(uid), e)} style={S.removeBtn}>✕ Remove</button>
                  </div>
                </div>
              );
            })
          )}

          {currentLocation && (
            <div style={S.statsBox}>
              <div style={S.statsLabel}>LIVE STATS</div>
              <div style={S.statsName}>{getUserName(selectedUser)}</div>
              <div style={S.addressBox}>
                <div style={S.addressLabel}>📍 CURRENT ADDRESS</div>
                <div style={S.addressText}>{currentAddress}</div>
              </div>
              {[
                ["Speed", (Number(currentLocation.speed || 0) * 3.6).toFixed(1) + " km/h"],
                ["Accuracy", "±" + Number(currentLocation.accuracy || 0).toFixed(0) + "m"],
                ["Distance", distanceTraveled.toFixed(2) + " km"],
                ["Max Speed", maxSpeed.toFixed(1) + " km/h"],
                ["History", locationHistory.length + " points"],
                ["Updated", getTimeDiff(currentLocation.timestamp)],
              ].map(([label, value]) => (
                <div key={label} style={S.statRow}>
                  <span style={S.statLabel}>{label}</span>
                  <span style={{ ...S.statValue, color: label === "Distance" ? "#2ECC71" : label === "Max Speed" ? "#E74C3C" : "#2E86C1" }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {selectedProfile.name && (
            <div style={S.profileBox}>
              <div style={S.statsLabel}>USER PROFILE</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{ ...S.avatar, width: "42px", height: "42px", fontSize: "16px", backgroundColor: getAvatarColor(selectedUser).bg, color: getAvatarColor(selectedUser).color }}>
                  {getUserName(selectedUser)[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ color: "white", fontSize: "13px", fontWeight: "500" }}>{selectedProfile.name || "Unknown"}</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>{selectedProfile.email || ""}</div>
                </div>
              </div>
              {selectedProfile.phone && (
                <div style={S.profileRow}>
                  <span style={S.statLabel}>📞 Phone</span>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>{selectedProfile.phone}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={S.main}>
          <div style={S.tabBar}>
            {[
              { id: "map", label: "Live Map", icon: "🗺️" },
              { id: "history", label: "History", icon: "📜" },
              { id: "chart", label: "Speed Chart", icon: "📊" },
              { id: "geofence", label: "Geofence", icon: "🔴" },
              { id: "sos", label: "SOS" + (activeSOS.length > 0 ? " (" + activeSOS.length + ")" : ""), icon: "🚨" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                ...S.tab,
                backgroundColor: activeTab === tab.id ? "#2E86C1" : "transparent",
                color: activeTab === tab.id ? "white" : "rgba(255,255,255,0.4)",
              }}>{tab.icon + " " + tab.label}</button>
            ))}
          </div>

          {activeTab === "map" && (
            <div style={S.mapContainer}>
              {currentLocation ? (
                <MapContainer key={selectedUser} center={[currentLocation.latitude, currentLocation.longitude]} zoom={16}
                  style={{ height: "100%", width: "100%" }} scrollWheelZoom={true} zoomControl={false}
                  dragging={true} touchZoom={true} doubleClickZoom={true} keyboard={true}>
                  <TileLayer url={currentMapStyle.url} attribution="© OpenStreetMap" maxZoom={19} />
                  <ZoomControl position="topright" />
                  <ScaleControl position="bottomright" />
                  {replayPos ? <ReplayController replayPos={replayPos} /> : <MapController position={currentLocation} selectedUser={selectedUser} />}
                  {snappedRoute.length > 1 && <Polyline positions={snappedRoute} color="#2ECC71" weight={4} opacity={0.9} />}
                  {snappedRoute.length <= 1 && locationHistory.length > 1 && (
                    <Polyline positions={locationHistory.map((p) => [p.latitude, p.longitude])} color="#2E86C1" weight={3} opacity={0.8} dashArray="6,3" />
                  )}
                  {showAllUsers && Object.entries(trackedUsers).map(([uid, loc]) => {
                    if (uid === selectedUser) return null;
                    const ac = getAvatarColor(uid);
                    const otherIcon = L.divIcon({
                      className: "",
                      html: '<div style="width:28px;height:28px;border-radius:50%;background:' + ac.bg + ';border:2px solid ' + ac.color + ';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:' + ac.color + '">' + getUserName(uid)[0].toUpperCase() + '</div>',
                      iconSize: [28, 28], iconAnchor: [14, 14],
                    });
                    return (
                      <Marker key={uid} position={[loc.latitude, loc.longitude]} icon={otherIcon}>
                        <Popup>
                          <div style={{ fontFamily: "sans-serif", minWidth: "150px" }}>
                            <strong style={{ color: "#1A3C6E" }}>{getUserName(uid)}</strong><br />
                            <span style={{ fontSize: "12px", color: "#555" }}>{getTimeDiff(loc.timestamp)}</span>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                  {activeMarkerPos && (
                    <Marker position={activeMarkerPos}>
                      <Popup>
                        <div style={{ minWidth: "200px", fontFamily: "sans-serif" }}>
                          <div style={{ fontWeight: "bold", marginBottom: "6px", color: "#1A3C6E", fontSize: "14px" }}>
                            {isReplaying ? "🎬 Route Replay" : "👤 " + getUserName(selectedUser)}
                          </div>
                          <div style={{ fontSize: "12px", color: "#555", lineHeight: "2" }}>
                            {"📍 " + currentAddress}<br />
                            {"Lat: " + Number(currentLocation.latitude).toFixed(6)}<br />
                            {"Lng: " + Number(currentLocation.longitude).toFixed(6)}<br />
                            {"Speed: " + (Number(currentLocation.speed || 0) * 3.6).toFixed(1) + " km/h"}<br />
                            {"Accuracy: ±" + Number(currentLocation.accuracy || 0).toFixed(0) + "m"}<br />
                            {"Updated: " + getTimeDiff(currentLocation.timestamp)}
                          </div>
                          <button onClick={openGoogleMaps} style={{ marginTop: "8px", backgroundColor: "#1A3C6E", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", width: "100%" }}>
                            Open in Google Maps
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {Object.values(geofences).map((fence, i) => (
                    <Circle key={i} center={[fence.latitude, fence.longitude]} radius={fence.radius}
                      color={isInsideGeofence(fence) ? "#2ECC71" : "#E74C3C"}
                      fillColor={isInsideGeofence(fence) ? "#2ECC71" : "#E74C3C"}
                      fillOpacity={0.08} weight={2} />
                  ))}
                </MapContainer>
              ) : (
                <div style={S.emptyMap}>
                  <SafeTrackLogo size={60} />
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", marginTop: "16px" }}>No location data</div>
                  <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px", marginTop: "6px" }}>Open the mobile app and enable tracking</div>
                </div>
              )}

              {isSnapping && (
                <div style={{ position: "absolute", top: "12px", right: "60px", backgroundColor: "rgba(10,22,40,0.9)", padding: "4px 10px", borderRadius: "6px", zIndex: 1000, fontSize: "11px", color: "#2ECC71" }}>
                  🛣️ Snapping to roads...
                </div>
              )}

              <div style={S.mapStyleBar}>
                {MAP_STYLES.map((style) => (
                  <button key={style.id} onClick={() => setMapStyle(style.id)} style={{
                    ...S.mapStyleBtn,
                    backgroundColor: mapStyle === style.id ? "#2E86C1" : "rgba(10,22,40,0.85)",
                    color: mapStyle === style.id ? "white" : "rgba(255,255,255,0.6)",
                  }}>{style.label}</button>
                ))}
                <button onClick={() => setShowAllUsers(!showAllUsers)} style={{
                  ...S.mapStyleBtn,
                  backgroundColor: showAllUsers ? "rgba(46,204,113,0.3)" : "rgba(10,22,40,0.85)",
                  color: showAllUsers ? "#2ECC71" : "rgba(255,255,255,0.6)",
                }}>{showAllUsers ? "All ON" : "All OFF"}</button>
                {snappedRoute.length > 1 && (
                  <div style={{ ...S.mapStyleBtn, backgroundColor: "rgba(46,204,113,0.2)", color: "#2ECC71", cursor: "default" }}>🛣️ Road Route</div>
                )}
              </div>

              {currentLocation && (
                <div style={S.replayBar}>
                  <div style={S.replayInfo}>{isReplaying ? "🎬 Replaying... " + (replayIndex + 1) + "/" + locationHistory.length : "📍 " + currentAddress}</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {locationHistory.length > 1 && (!isReplaying
                      ? <button onClick={startReplay} style={S.replayBtn}>▶ Replay</button>
                      : <button onClick={stopReplay} style={{ ...S.replayBtn, backgroundColor: "#E74C3C" }}>⏹ Stop</button>
                    )}
                    <button onClick={openGoogleMaps} style={S.mapsSmallBtn}>🗺️ Maps</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div style={S.listPane}>
              <div style={S.listHeader}>
                <span>{"📜 " + getUserName(selectedUser) + " — Location History"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#2ECC71", fontSize: "12px", fontWeight: "500" }}>{distanceTraveled.toFixed(2) + " km"}</span>
                  <span style={S.countBadge}>{locationHistory.length + " points"}</span>
                  <button onClick={exportPDF} disabled={isExportingPDF || locationHistory.length === 0} style={{
                    backgroundColor: isExportingPDF ? "rgba(255,255,255,0.05)" : "rgba(231,76,60,0.15)",
                    border: "1px solid rgba(231,76,60,0.3)", color: "#E74C3C", borderRadius: "6px",
                    padding: "4px 12px", fontSize: "11px", cursor: "pointer", fontWeight: "500",
                  }}>{isExportingPDF ? "⏳ Exporting..." : "📄 Export PDF"}</button>
                </div>
              </div>
              {locationHistory.length === 0 ? (
                <div style={S.emptyList}>
                  <div style={{ fontSize: "40px" }}>📜</div>
                  <div style={{ marginTop: "10px", color: "rgba(255,255,255,0.3)" }}>No history yet</div>
                </div>
              ) : (
                [...locationHistory].reverse().map((point, i) => (
                  <div key={i} style={S.historyRow}>
                    <div style={S.historyNum}>{locationHistory.length - i}</div>
                    <div style={{ flex: 1 }}>
                      <div style={S.historyCoords}>{Number(point.latitude).toFixed(6) + ",  " + Number(point.longitude).toFixed(6)}</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", marginTop: "2px" }}>📍 {getHistoryAddress(point)}</div>
                      <div style={S.historyTime}>{formatTime(point.timestamp) + "  •  " + getTimeDiff(point.timestamp)}</div>
                    </div>
                    <div style={S.historySpeed}>{(Number(point.speed || 0) * 3.6).toFixed(1) + " km/h"}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "chart" && (
            <div style={S.listPane}>
              <div style={S.listHeader}>
                <span>{"📊 " + getUserName(selectedUser) + " — Speed Chart"}</span>
                <span style={S.countBadge}>{"Last " + speedData.length + " points"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                {[["Max Speed", maxSpeed.toFixed(1) + " km/h", "#E74C3C"], ["Avg Speed", avgSpeed.toFixed(1) + " km/h", "#2E86C1"], ["Distance", distanceTraveled.toFixed(2) + " km", "#2ECC71"]].map(([label, value, color]) => (
                  <div key={label} style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "14px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", marginBottom: "6px" }}>{label}</div>
                    <div style={{ color: color, fontSize: "20px", fontWeight: "500" }}>{value}</div>
                  </div>
                ))}
              </div>
              {speedData.length < 2 ? (
                <div style={S.emptyList}>
                  <div style={{ fontSize: "40px" }}>📊</div>
                  <div style={{ marginTop: "10px", color: "rgba(255,255,255,0.3)" }}>Not enough data yet</div>
                </div>
              ) : (
                <div style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "20px" }}>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", letterSpacing: "1px", marginBottom: "16px" }}>SPEED OVER TIME (km/h)</div>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={speedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} unit=" km/h" />
                      <Tooltip contentStyle={{ backgroundColor: "#1A2744", border: "1px solid rgba(46,134,193,0.3)", borderRadius: "8px", color: "white" }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} formatter={(value) => [value + " km/h", "Speed"]} />
                      <ReferenceLine y={avgSpeed} stroke="rgba(46,134,193,0.5)" strokeDasharray="4 4" label={{ value: "avg", fill: "rgba(46,134,193,0.7)", fontSize: 10 }} />
                      <Line type="monotone" dataKey="speed" stroke="#2E86C1" strokeWidth={2.5} dot={{ fill: "#2E86C1", r: 3, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#2ECC71" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px", letterSpacing: "1px", marginBottom: "10px" }}>SPEED LOG</div>
              {[...speedData].reverse().map((point, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "6px", marginBottom: "4px" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>{point.time}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: Math.min(point.speed * 3, 100) + "px", height: "4px", backgroundColor: point.speed > 20 ? "#E74C3C" : point.speed > 5 ? "#2E86C1" : "#2ECC71", borderRadius: "2px" }}></div>
                    <span style={{ color: point.speed > 20 ? "#E74C3C" : point.speed > 5 ? "#2E86C1" : "#2ECC71", fontSize: "12px", fontWeight: "500", minWidth: "60px", textAlign: "right" }}>{point.speed} km/h</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "geofence" && (
            <div style={S.listPane}>
              <div style={S.listHeader}>
                <span>{"🔴 " + getUserName(selectedUser) + " — Geofence Zones"}</span>
                <span style={S.countBadge}>{Object.keys(geofences).length + " zones"}</span>
              </div>
              {Object.keys(geofences).length === 0 ? (
                <div style={S.emptyList}>
                  <div style={{ fontSize: "40px" }}>🔴</div>
                  <div style={{ marginTop: "10px", color: "rgba(255,255,255,0.3)" }}>No geofences set</div>
                  <div style={{ marginTop: "6px", color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>Add zones in the mobile app</div>
                </div>
              ) : (
                Object.entries(geofences).map(([id, fence]) => {
                  const inside = isInsideGeofence(fence);
                  return (
                    <div key={id} style={{ ...S.geofenceRow, borderColor: inside ? "rgba(46,204,113,0.3)" : "rgba(231,76,60,0.2)", backgroundColor: inside ? "rgba(46,204,113,0.05)" : "rgba(231,76,60,0.03)" }}>
                      <div style={{ fontSize: "28px" }}>{inside ? "✅" : "⭕"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={S.fenceName}>{fence.name}</div>
                        <div style={S.fenceDetails}>{"Radius: " + fence.radius + "m  •  " + Number(fence.latitude).toFixed(4) + ", " + Number(fence.longitude).toFixed(4)}</div>
                        <div style={{ fontSize: "12px", fontWeight: "500", marginTop: "4px", color: inside ? "#2ECC71" : "#E74C3C" }}>{inside ? "User is INSIDE this zone" : "User is OUTSIDE this zone"}</div>
                      </div>
                      <div style={{ ...S.fenceStatusBadge, backgroundColor: inside ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)", color: inside ? "#2ECC71" : "#E74C3C" }}>{inside ? "INSIDE" : "OUTSIDE"}</div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "sos" && (
            <div style={S.listPane}>
              <div style={S.listHeader}>
                <span>🚨 SOS Emergency Alerts</span>
                <span style={{ ...S.countBadge, backgroundColor: activeSOS.length > 0 ? "rgba(231,76,60,0.2)" : "rgba(46,204,113,0.15)", color: activeSOS.length > 0 ? "#E74C3C" : "#2ECC71" }}>
                  {activeSOS.length > 0 ? activeSOS.length + " ACTIVE" : "All Clear"}
                </span>
              </div>
              {activeSOS.length === 0 ? (
                <div style={S.emptyList}>
                  <div style={{ fontSize: "50px" }}>✅</div>
                  <div style={{ marginTop: "12px", color: "#2ECC71", fontSize: "16px" }}>All Clear — No Alerts</div>
                  <div style={{ marginTop: "6px", color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>All tracked users are safe</div>
                </div>
              ) : (
                activeSOS.map(([uid, alert]) => (
                  <div key={uid} style={S.sosCard}>
                    <div style={S.sosCardHeader}>
                      <div style={{ fontSize: "28px" }}>🚨</div>
                      <div>
                        <div style={S.sosCardTitle}>SOS ALERT ACTIVE</div>
                        <div style={{ color: "#E74C3C", fontSize: "12px" }}>Emergency assistance required immediately</div>
                      </div>
                    </div>
                    <div style={S.sosDetails}>
                      {[
                        ["User", getUserName(uid)],
                        ["Phone", userProfiles[uid]?.phone || "N/A"],
                        ["Time", formatTime(alert.timestamp)],
                        ["Since", getTimeDiff(alert.timestamp)],
                        ["Address", currentAddress],
                        currentLocation && selectedUser === uid ? ["Location", Number(currentLocation.latitude).toFixed(5) + ", " + Number(currentLocation.longitude).toFixed(5)] : null,
                      ].filter(Boolean).map(([label, value]) => (
                        <div key={label} style={S.sosDetailRow}>
                          <span style={S.sosDetailLabel}>{label}</span>
                          <span style={S.sosDetailValue}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {currentLocation && selectedUser === uid && (
                      <button onClick={openGoogleMaps} style={S.mapsBtn}>📍 Open in Google Maps</button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  app: { height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#0A1628", fontFamily: "system-ui, sans-serif" },
  sosBanner: { backgroundColor: "#C0392B", color: "white", padding: "10px 20px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "500", letterSpacing: "0.5px" },
  sosNameTag: { backgroundColor: "rgba(0,0,0,0.25)", padding: "2px 10px", borderRadius: "20px", fontSize: "12px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "linear-gradient(90deg, #1A3C6E 0%, #1e4a8a 100%)", borderBottom: "1px solid rgba(46,134,193,0.25)" },
  headerLeft: { display: "flex", alignItems: "center", gap: "10px" },
  logoBox: { width: "34px", height: "34px", backgroundColor: "#0D1F3C", borderRadius: "8px", border: "1px solid rgba(46,134,193,0.4)", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { color: "white", fontSize: "18px", fontWeight: "500" },
  liveBadge: { backgroundColor: "#2ECC71", color: "white", fontSize: "9px", fontWeight: "500", padding: "2px 8px", borderRadius: "20px", letterSpacing: "0.8px" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  emailText: { color: "rgba(255,255,255,0.4)", fontSize: "12px" },
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", padding: "5px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: { width: "270px", backgroundColor: "#0D1F3C", borderRight: "1px solid rgba(46,134,193,0.12)", overflowY: "auto", padding: "14px" },
  sidebarLabel: { color: "rgba(255,255,255,0.3)", fontSize: "10px", fontWeight: "500", letterSpacing: "1.2px", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  emptyState: { textAlign: "center", padding: "40px 12px" },
  deviceCard: { borderRadius: "10px", padding: "10px 12px", marginBottom: "8px", cursor: "pointer", border: "1px solid", transition: "all 0.15s" },
  cardTop: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" },
  avatar: { width: "34px", height: "34px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "500", flexShrink: 0 },
  cardName: { color: "white", fontSize: "13px", fontWeight: "500" },
  cardStatus: { display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" },
  statusDot: { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0 },
  sosTag: { backgroundColor: "#E74C3C", color: "white", fontSize: "9px", fontWeight: "500", padding: "2px 7px", borderRadius: "4px", letterSpacing: "0.5px" },
  cardCoords: { color: "rgba(255,255,255,0.25)", fontSize: "10px", fontFamily: "monospace" },
  removeBtn: { backgroundColor: "rgba(231,76,60,0.12)", border: "1px solid rgba(231,76,60,0.25)", color: "#E74C3C", borderRadius: "4px", padding: "2px 8px", fontSize: "10px", cursor: "pointer", whiteSpace: "nowrap" },
  statsBox: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px", marginTop: "14px", border: "1px solid rgba(46,134,193,0.1)" },
  profileBox: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px", marginTop: "10px", border: "1px solid rgba(46,134,193,0.1)" },
  profileRow: { display: "flex", justifyContent: "space-between", marginBottom: "4px" },
  statsLabel: { color: "rgba(255,255,255,0.25)", fontSize: "9px", letterSpacing: "1.2px", marginBottom: "8px" },
  statsName: { color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: "500", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  addressBox: { backgroundColor: "rgba(46,134,193,0.08)", borderRadius: "8px", padding: "8px 10px", marginBottom: "10px", border: "1px solid rgba(46,134,193,0.15)" },
  addressLabel: { color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "0.8px", marginBottom: "3px" },
  addressText: { color: "rgba(255,255,255,0.8)", fontSize: "11px", lineHeight: "1.4" },
  statRow: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
  statLabel: { color: "rgba(255,255,255,0.3)", fontSize: "12px" },
  statValue: { color: "#2E86C1", fontSize: "12px", fontWeight: "500" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  tabBar: { display: "flex", gap: "2px", padding: "8px 14px", backgroundColor: "#080f1e", borderBottom: "1px solid rgba(46,134,193,0.12)", overflowX: "auto" },
  tab: { padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", transition: "all 0.15s", whiteSpace: "nowrap" },
  mapContainer: { flex: 1, position: "relative" },
  emptyMap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#0D1F3C" },
  mapStyleBar: { position: "absolute", top: "12px", left: "12px", display: "flex", gap: "4px", zIndex: 1000, flexWrap: "wrap" },
  mapStyleBtn: { border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontWeight: "500", cursor: "pointer" },
  replayBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(10,22,40,0.95)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(46,134,193,0.2)", zIndex: 1000 },
  replayInfo: { color: "rgba(255,255,255,0.6)", fontSize: "12px", flex: 1, marginRight: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  replayBtn: { backgroundColor: "#2E86C1", color: "white", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", fontWeight: "500", cursor: "pointer", whiteSpace: "nowrap" },
  mapsSmallBtn: { backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" },
  listPane: { flex: 1, overflowY: "auto", padding: "16px" },
  listHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: "500", marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  countBadge: { backgroundColor: "rgba(46,134,193,0.15)", color: "#2E86C1", fontSize: "11px", padding: "2px 10px", borderRadius: "20px" },
  emptyList: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "80px" },
  historyRow: { display: "flex", alignItems: "center", gap: "12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "10px 12px", marginBottom: "6px", border: "1px solid rgba(255,255,255,0.04)" },
  historyNum: { width: "28px", height: "28px", backgroundColor: "rgba(46,134,193,0.15)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#2E86C1", fontSize: "11px", fontWeight: "500", flexShrink: 0 },
  historyCoords: { color: "rgba(255,255,255,0.7)", fontSize: "12px", fontFamily: "monospace" },
  historyTime: { color: "rgba(255,255,255,0.3)", fontSize: "11px", marginTop: "3px" },
  historySpeed: { color: "#2E86C1", fontSize: "11px", fontWeight: "500", flexShrink: 0 },
  geofenceRow: { display: "flex", alignItems: "center", gap: "14px", border: "1px solid", borderRadius: "10px", padding: "14px", marginBottom: "10px" },
  fenceName: { color: "white", fontSize: "14px", fontWeight: "500", marginBottom: "3px" },
  fenceDetails: { color: "rgba(255,255,255,0.3)", fontSize: "11px" },
  fenceStatusBadge: { padding: "6px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: "500", letterSpacing: "0.5px", flexShrink: 0 },
  sosCard: { backgroundColor: "rgba(231,76,60,0.06)", border: "1px solid rgba(231,76,60,0.25)", borderRadius: "12px", padding: "18px", marginBottom: "12px" },
  sosCardHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" },
  sosCardTitle: { color: "#E74C3C", fontSize: "16px", fontWeight: "500", marginBottom: "2px" },
  sosDetails: { backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px", marginBottom: "14px" },
  sosDetailRow: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
  sosDetailLabel: { color: "rgba(255,255,255,0.35)", fontSize: "12px" },
  sosDetailValue: { color: "rgba(255,255,255,0.8)", fontSize: "12px", fontWeight: "500" },
  mapsBtn: { backgroundColor: "#E74C3C", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: "500", cursor: "pointer", width: "100%" },
};