import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

// Configuration loaded from firebase-applet-config.json values
const firebaseConfig = {
  apiKey: "AIzaSyBH8D8glj0zm-d-w8swSEUP9vtqkchVmNk",
  authDomain: "groovy-charge-54k5l.firebaseapp.com",
  projectId: "groovy-charge-54k5l",
  storageBucket: "groovy-charge-54k5l.firebasestorage.app",
  messagingSenderId: "1027407749143",
  appId: "1:1027407749143:web:bbc5a8c075c5aa253bbc52"
};

const customDatabaseId = "ai-studio-biohubcloud-4ab37ae0-2bad-46f6-9d89-ac906b61f511";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with custom database ID
export const db = getFirestore(app, customDatabaseId);

// ==========================================
// Firestore Structured Error Handling
// ==========================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ==========================================
// Authentication Helpers
// ==========================================

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create/Update user profile in Firestore
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: serverTimestamp()
      }, { merge: true });
    } catch (fsError) {
      handleFirestoreError(fsError, OperationType.WRITE, `users/${user.uid}`);
    }
    
    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes("operationType")) {
      throw error;
    }
    console.error("Google Sign-In Error:", error);
    throw error;
  }
}

export async function logOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
}

// ==========================================
// Saved Sequences Helpers
// ==========================================

export interface SavedSequenceData {
  id?: string;
  userId: string;
  name: string;
  sequence: string;
  reference?: string;
  length: number;
  gcContent: string;
  protein: string;
  createdAt?: any;
}

export async function saveSequence(data: SavedSequenceData) {
  try {
    const colRef = collection(db, "saved_sequences");
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "saved_sequences");
  }
}

export async function getUserSequences(userId: string): Promise<SavedSequenceData[]> {
  try {
    const q = query(
      collection(db, "saved_sequences"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const sequences: SavedSequenceData[] = [];
    querySnapshot.forEach((doc) => {
      sequences.push({
        id: doc.id,
        ...doc.data()
      } as SavedSequenceData);
    });
    return sequences;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "saved_sequences");
  }
}

export async function deleteSequence(id: string) {
  try {
    await deleteDoc(doc(db, "saved_sequences", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `saved_sequences/${id}`);
  }
}

// ==========================================
// Chat Session Helpers
// ==========================================

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  timestamp: string;
  ncbi_grounded?: boolean;
  chart_data?: {
    type: "bar" | "line" | "area" | "pie";
    title: string;
    data: Array<{ name: string; [key: string]: any }>;
  };
  image_url?: string;
}

export interface ChatSessionData {
  id?: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt?: any;
  updatedAt?: any;
}

export async function saveChatSession(data: ChatSessionData) {
  try {
    const colRef = collection(db, "chat_sessions");
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "chat_sessions");
  }
}

export async function updateChatSession(id: string, messages: ChatMessage[]) {
  try {
    const docRef = doc(db, "chat_sessions", id);
    await updateDoc(docRef, {
      messages,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chat_sessions/${id}`);
  }
}

export async function getUserChats(userId: string): Promise<ChatSessionData[]> {
  try {
    const q = query(
      collection(db, "chat_sessions"),
      where("userId", "==", userId),
      orderBy("updatedAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const chats: ChatSessionData[] = [];
    querySnapshot.forEach((doc) => {
      chats.push({
        id: doc.id,
        ...doc.data()
      } as ChatSessionData);
    });
    return chats;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "chat_sessions");
  }
}

export async function deleteChatSession(id: string) {
  try {
    await deleteDoc(doc(db, "chat_sessions", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `chat_sessions/${id}`);
  }
}
