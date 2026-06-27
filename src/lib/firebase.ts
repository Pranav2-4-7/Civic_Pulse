import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirebaseConfigured = !!firebaseConfig.projectId && firebaseConfig.projectId !== "";

const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;

const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

export interface Comment {
  id: string;
  user: string;
  role: string;
  text: string;
  timestamp: string;
}

export interface StatusHistoryItem {
  status: "reported" | "verified" | "in-progress" | "resolved";
  timestamp: string;
  note: string;
  user?: string;
}

export interface ResolutionInfo {
  imageUrl: string;
  explanation: string;
  timestamp: string;
  verifiedByAI?: boolean;
}

export interface ActionPlan {
  department: string;
  tools: string[];
  safety: string[];
  priority: string;
}

export interface ImpactMetrics {
  carbonOffset: number; // in KG CO2
  monetarySavings: number; // in INR
  safetyBoost: number; // in %
}

export interface Issue {
  id?: string;
  category: string;
  subcategory: string;
  severity: string;
  short_summary: string;
  keywords: string[];
  imageUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timestamp: any;
  user_metadata: {
    reporter: string;
    role: string;
  };
  location: {
    latitude: number;
    longitude: number;
    grid: string;
  };
  status: "reported" | "verified" | "in-progress" | "resolved";
  upvotes: number;
  comments?: Comment[];
  statusHistory?: StatusHistoryItem[];
  resolution?: ResolutionInfo;
  actionPlan?: ActionPlan;
  impactMetrics?: ImpactMetrics;
}

// ── Fallback In-Memory/LocalStorage Database ───────────────────
const MOCK_STORAGE_KEY = "community_hero_mock_issues";

const initialMockIssues: Issue[] = [
  {
    id: "mock-1",
    category: "Roads",
    subcategory: "Crater Formation",
    severity: "High",
    short_summary: "Severe asphalt degradation on MG Road, Bangalore. Immediate risk to two-wheelers and auto-rickshaws.",
    keywords: ["pothole", "asphalt", "crater"],
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuC9ctVqrwU-Yk87mr3kGV1LLxV8CD2hQJBH4iXQiXgdvFBi0PS31zEz5IL0d12yCQq6vQpnZpM9_KvSCDwLfU9KMGQ4qiq6M4e-l_V3lrSTAsFKhMkOVzQbSe8XvNsjb_e8-HijzzAD3FhWn6OgFQJ00-b9nIJxFJvZPyAfXz5EMVu0O5yMM3ks2iOXTTPDfexH_b7Bl0Y__9KVbJT7_EscS21l-G1GZ7bVFhD1xHfo-NdDbV8D9RkihL-Byte41cGYGGWji-YtjrM",
    timestamp: new Date(Date.now() - 120000).toISOString(),
    user_metadata: { reporter: "Aarav Mehta", role: "Citizen Reporter" },
    location: { latitude: 12.9716, longitude: 77.5946, grid: "12.9716° N, 77.5946° E" },
    status: "reported",
    upvotes: 24,
    comments: [
      {
        id: "mc-1",
        user: "Priya Sharma",
        role: "Resident",
        text: "Almost lost balance on my scooter near the metro pillar. Needs immediate repair!",
        timestamp: new Date(Date.now() - 60000).toISOString()
      }
    ],
    statusHistory: [
      {
        status: "reported",
        note: "Civic issue submitted. Initial image classified by AI engine.",
        timestamp: new Date(Date.now() - 120000).toISOString(),
        user: "Aarav Mehta"
      }
    ],
    actionPlan: {
      department: "Road Maintenance Division",
      tools: ["Cold-mix asphalt patch", "Vibratory tamper", "Safety cones"],
      safety: ["Divert vehicle traffic", "Wear high-visibility clothing"],
      priority: "High"
    }
  },
  {
    id: "mock-2",
    category: "Public Safety",
    subcategory: "Streetlight Malfunction",
    severity: "Medium",
    short_summary: "Multiple streetlights offline in Connaught Place, Block E, New Delhi. Visibility reduced significantly in commercial area.",
    keywords: ["streetlight", "darkness", "outage"],
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAouAuBdsPc_lQM8Ueq5kbsRpXvaX0shnUJ64HTplwZgppPegTD1IG3tHDGDj9-Hr2_B6A3EAS2GR7-ckcWftgagdAzBVUGanMjYuC9Pvqonbh9zSkYm8bx1_yDX03ylk473K4JHMQ3egGSJL4MDgHAHcCVa20f-yo7v8fi7wc4xgqiuCthvxb3U6PlH83VtgvwYdcFIuqSn7OJXRKMr1s7ZYi0lKpEr63DNuilSURxtKwU6AxX0TLsW6hN3Ge9RCUy_yX-SfBlng8o",
    timestamp: new Date(Date.now() - 840000).toISOString(),
    user_metadata: { reporter: "Rohan Gupta", role: "Safety Inspector" },
    location: { latitude: 28.6304, longitude: 77.2177, grid: "28.6304° N, 77.2177° E" },
    status: "in-progress",
    upvotes: 12,
    comments: [
      {
        id: "mc-2",
        user: "Delhi Power Discom",
        role: "Municipal Agent",
        text: "Technician dispatched to assess breaker panel near Block E.",
        timestamp: new Date(Date.now() - 300000).toISOString()
      }
    ],
    statusHistory: [
      {
        status: "reported",
        note: "Civic issue submitted. Initial image classified by AI engine.",
        timestamp: new Date(Date.now() - 840000).toISOString(),
        user: "Rohan Gupta"
      },
      {
        status: "verified",
        note: "Community upvotes reached verification threshold. Flagged for dispatch.",
        timestamp: new Date(Date.now() - 600000).toISOString(),
        user: "CivicPulse Protocol"
      },
      {
        status: "in-progress",
        note: "City electrical crew assigned and dispatched.",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        user: "Delhi Power Discom"
      }
    ],
    actionPlan: {
      department: "Municipal Power Grid Dept",
      tools: ["Bucket truck", "Replacement LED luminaire", "Multimeter"],
      safety: ["High-voltage insulation gloves", "Secure work zone"],
      priority: "Medium"
    }
  },
  {
    id: "mock-3",
    category: "Sanitation",
    subcategory: "Recycling Overflow",
    severity: "Low",
    short_summary: "Community smart bin overflowing near Dadar station, Mumbai. High waste volume blocking pedestrian footpath.",
    keywords: ["recycling", "overflow", "trash"],
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA7Nq-Bc59LLytN6iK88MsSjpJYYreUOdEJBhdwOYUPxWN2LaUxJUln6tURcNyWG-1GYDqm-z4vIr26VRsI63ujH20r9lIDS6_EMypMAsNwca3swC68cinnNGFEAxePC7iG3YovrPIFrFWc6nuFOx_surD1uNJog-W14S7Kbm7GwDmlo-XHBuShkWXlD2ryezcA5wcxZoi9K5tdj75kPOLcQs6Jd_Ul1GPFi-EKAXa0CcGlxOWHN-uLRURXd6KYPl2jL17cF9YCzI4",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    user_metadata: { reporter: "Siddharth Patil", role: "Volunteer" },
    location: { latitude: 19.0178, longitude: 72.8478, grid: "19.0178° N, 72.8478° E" },
    status: "resolved",
    upvotes: 8,
    comments: [
      {
        id: "mc-3",
        user: "Siddharth Patil",
        role: "Volunteer",
        text: "Cleaned up and emptied. Verified resolved.",
        timestamp: new Date(Date.now() - 1800000).toISOString()
      }
    ],
    statusHistory: [
      {
        status: "reported",
        note: "Smart bin warning logged.",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user: "Siddharth Patil"
      },
      {
        status: "resolved",
        note: "Issue cleared. Verified by AI visual validation module.",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        user: "Siddharth Patil"
      }
    ],
    resolution: {
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA7Nq-Bc59LLytN6iK88MsSjpJYYreUOdEJBhdwOYUPxWN2LaUxJUln6tURcNyWG-1GYDqm-z4vIr26VRsI63ujH20r9lIDS6_EMypMAsNwca3swC68cinnNGFEAxePC7iG3YovrPIFrFWc6nuFOx_surD1uNJog-W14S7Kbm7GwDmlo-XHBuShkWXlD2ryezcA5wcxZoi9K5tdj75kPOLcQs6Jd_Ul1GPFi-EKAXa0CcGlxOWHN-uLRURXd6KYPl2jL17cF9YCzI4",
      explanation: "AI visual validator confirmed the sanitation overflow has been cleared. Bin load index: 0.12.",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      verifiedByAI: true
    },
    actionPlan: {
      department: "Sanitation & Solid Waste Management",
      tools: ["Compactor truck", "Cleaning disinfectant spray", "Replacement liners"],
      safety: ["Industrial waste gloves", "Pathogen protection masks"],
      priority: "Low"
    },
    impactMetrics: {
      carbonOffset: 18.5,
      monetarySavings: 8400,
      safetyBoost: 24
    }
  }
];

function getLocalIssues(): Issue[] {
  if (typeof window === "undefined") return initialMockIssues;
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initialMockIssues));
    return initialMockIssues;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return initialMockIssues;
  }
}

function saveLocalIssues(issues: Issue[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(issues));
  // Dispatch storage event to trigger real-time updates on same page/other tabs
  window.dispatchEvent(new Event("storage_issues_update"));
}

// ── Firebase Storage Upload Helper ──────────────────────────────
export async function uploadImage(file: File): Promise<string> {
  if (isFirebaseConfigured && storage) {
    const fileRef = ref(storage, `issue-assets/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  } else {
    // Return base64 URL for mock/local mode
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// ── Firestore Write Issue Helper ────────────────────────────────
export async function addIssue(issueData: Omit<Issue, "id" | "timestamp" | "upvotes">): Promise<string> {
  // Generate initial agent dispatcher comments if Action Plan exists
  const initialComments: Comment[] = [];
  if (issueData.actionPlan) {
    initialComments.push({
      id: `agent-comment-${Date.now()}`,
      user: "CivicPulse Agent",
      role: "Autonomous Dispatcher",
      text: `Work order created and routed to ${issueData.actionPlan.department}. Assigned priority: ${issueData.actionPlan.priority}. Recommended tools: ${issueData.actionPlan.tools.join(", ")}.`,
      timestamp: new Date().toISOString()
    });
  }

  if (isFirebaseConfigured && db) {
    const docRef = await addDoc(collection(db, "issues"), {
      ...issueData,
      upvotes: 0,
      timestamp: serverTimestamp(),
      comments: initialComments,
      statusHistory: [
        {
          status: issueData.status || "reported",
          note: "Civic issue submitted. Initial image classified by AI engine.",
          timestamp: new Date().toISOString(),
          user: issueData.user_metadata?.reporter || "Citizen Reporter"
        }
      ]
    });
    return docRef.id;
  } else {
    const issues = getLocalIssues();
    const newId = `mock-${Date.now()}`;
    const newIssue: Issue = {
      ...issueData,
      id: newId,
      upvotes: 0,
      timestamp: new Date().toISOString(),
      comments: initialComments,
      statusHistory: [
        {
          status: issueData.status || "reported",
          note: "Civic issue submitted. Initial image classified by AI engine.",
          timestamp: new Date().toISOString(),
          user: issueData.user_metadata?.reporter || "Citizen Reporter"
        }
      ]
    };
    issues.unshift(newIssue);
    saveLocalIssues(issues);
    
    // Award 10 XP for reporting a new issue!
    addUserXP(10);
    
    // Automatically award "Pothole Patrol" or other badges based on category
    if (issueData.category.toLowerCase().includes("road")) {
      awardBadge("roads");
    } else if (issueData.category.toLowerCase().includes("safety")) {
      awardBadge("safety");
    } else if (issueData.category.toLowerCase().includes("sanit")) {
      awardBadge("sanitation");
    }

    return newId;
  }
}

// ── Real-Time Firestore Listener Helper ────────────────────────
export function subscribeToIssues(onUpdate: (issues: Issue[]) => void): () => void {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, "issues"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      const issuesList: Issue[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        let timestamp = data.timestamp;
        if (timestamp instanceof Timestamp) {
          timestamp = timestamp.toDate().toISOString();
        } else if (timestamp && timestamp.seconds) {
          timestamp = new Date(timestamp.seconds * 1000).toISOString();
        } else {
          timestamp = new Date().toISOString();
        }

        issuesList.push({
          id: doc.id,
          ...data,
          timestamp
        } as Issue);
      });
      onUpdate(issuesList.length > 0 ? issuesList : getLocalIssues());
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      // Fallback to mock issues on permission/network error
      onUpdate(getLocalIssues());
    });
  } else {
    // LocalStorage-based real-time notification
    onUpdate(getLocalIssues());
    const handleUpdate = () => {
      onUpdate(getLocalIssues());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage_issues_update", handleUpdate);
      window.addEventListener("storage", handleUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage_issues_update", handleUpdate);
        window.removeEventListener("storage", handleUpdate);
      }
    };
  }
}

// ── Upvote / Verification Helper ─────────────────────────────────
export async function upvoteIssue(issueId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    console.log("Upvote trigger for ID:", issueId);
  } else {
    const issues = getLocalIssues();
    const updated = issues.map((issue) => {
      if (issue.id === issueId) {
        // Award 5 XP for verifying/upvoting an issue!
        addUserXP(5);
        
        // Auto-verify if upvotes reach threshold
        const newUpvotes = issue.upvotes + 1;
        let newStatus = issue.status;
        const history = issue.statusHistory || [];
        
        if (newStatus === "reported" && newUpvotes >= 10) {
          newStatus = "verified";
          history.push({
            status: "verified",
            note: "Community verification threshold (10 upvotes) reached. Auto-verified by protocol.",
            timestamp: new Date().toISOString(),
            user: "CivicPulse Protocol"
          });
        }
        
        return { 
          ...issue, 
          upvotes: newUpvotes,
          status: newStatus,
          statusHistory: history
        };
      }
      return issue;
    });
    saveLocalIssues(updated);
  }
}

// ── Add Comment Helper ───────────────────────────────────────────
export async function addCommentToIssue(
  issueId: string,
  text: string,
  user: string,
  role: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    console.log("Add comment for ID:", issueId);
  } else {
    const issues = getLocalIssues();
    const updated = issues.map((issue) => {
      if (issue.id === issueId) {
        const comments = issue.comments || [];
        const newComment: Comment = {
          id: `comment-${Date.now()}`,
          user,
          role,
          text,
          timestamp: new Date().toISOString()
        };
        return { ...issue, comments: [...comments, newComment] };
      }
      return issue;
    });
    saveLocalIssues(updated);
  }
}

// ── Update Issue Status Helper ────────────────────────────────────
export async function updateIssueStatus(
  issueId: string,
  status: Issue["status"],
  note: string,
  resolution?: ResolutionInfo
): Promise<void> {
  if (isFirebaseConfigured && db) {
    console.log("Update status for ID:", issueId, status);
  } else {
    const issues = getLocalIssues();
    const updated = issues.map((issue) => {
      if (issue.id === issueId) {
        const history = issue.statusHistory || [];
        const newHistoryItem: StatusHistoryItem = {
          status,
          note,
          timestamp: new Date().toISOString(),
          user: "Civic Agent"
        };
        
        const updatedIssue: Issue = {
          ...issue,
          status,
          statusHistory: [...history, newHistoryItem]
        };
        
        if (resolution) {
          updatedIssue.resolution = resolution;
          
          // Generate realistic impact metrics based on the category
          let carbonOffset = 5.2;
          let monetarySavings = 3200;
          let safetyBoost = 15;
          
          const cat = (issue.category || "").toLowerCase();
          if (cat.includes("road")) {
            carbonOffset = 8.5;
            monetarySavings = 45000; // savings in vehicle suspension repairs
            safetyBoost = 35;
          } else if (cat.includes("safety") || cat.includes("light")) {
            carbonOffset = 1.2;
            monetarySavings = 12000;
            safetyBoost = 60; // huge safety boost for lighting
          } else if (cat.includes("sanit") || cat.includes("trash")) {
            carbonOffset = 24.0; // high carbon offset for sanitation decay prevention
            monetarySavings = 5400;
            safetyBoost = 20;
          }
          
          updatedIssue.impactMetrics = {
            carbonOffset,
            monetarySavings,
            safetyBoost
          };
          
          // Award 50 XP to the resolver!
          addUserXP(50);
          awardBadge("solver");
        }
        
        return updatedIssue;
      }
      return issue;
    });
    saveLocalIssues(updated);
  }
}

// ── Gamification LocalStorage Helpers ─────────────────────────────
const XP_KEY = "community_hero_user_xp";
const BADGES_KEY = "community_hero_user_badges";

export function getUserXP(): number {
  if (typeof window === "undefined") return 0;
  const xp = localStorage.getItem(XP_KEY);
  return xp ? parseInt(xp, 10) : 0;
}

export function addUserXP(points: number): number {
  if (typeof window === "undefined") return 0;
  const current = getUserXP();
  const next = current + points;
  localStorage.setItem(XP_KEY, next.toString());
  window.dispatchEvent(new Event("user_gamification_update"));
  return next;
}

export function getUserBadges(): string[] {
  if (typeof window === "undefined") return [];
  const badges = localStorage.getItem(BADGES_KEY);
  return badges ? JSON.parse(badges) : [];
}

export function awardBadge(badgeId: string): string[] {
  if (typeof window === "undefined") return [];
  const badges = getUserBadges();
  if (!badges.includes(badgeId)) {
    badges.push(badgeId);
    localStorage.setItem(BADGES_KEY, JSON.stringify(badges));
    window.dispatchEvent(new Event("user_gamification_update"));
  }
  return badges;
}

export function getUserLevel(): number {
  const xp = getUserXP();
  return Math.floor(xp / 100) + 1;
}

export { db, storage, isFirebaseConfigured };
