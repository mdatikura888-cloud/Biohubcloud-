import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "./lib/firebase";
import Navbar from "./components/Navbar";
import SequenceDashboard from "./components/SequenceDashboard";
import BioAssistant from "./components/BioAssistant";
import CPanelDeployment from "./components/CPanelDeployment";
import { Dna, ShieldAlert, BookOpen, AlertCircle } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sequence");

  // Subscribe to Firebase Auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB] text-[#111827] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top sticky navbar */}
      <Navbar 
        user={user} 
        loading={loading} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome Header */}
        <div className="mb-8 border-b border-gray-200 pb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-[#064E3B] flex items-center gap-2">
                <Dna className="w-8 h-8 text-emerald-600 animate-pulse" />
                BioHubCloud Genomic Center
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                বিশ্বমানের ওপেন-সোর্স লজিক ক্লাউড, ডিএনএ সিকোয়েন্স ট্রান্সলেশন এবং গ্রাউন্ডেড বায়ো-এআই অ্যাসিস্ট্যান্ট।
              </p>
            </div>
            
            {/* Quick Status Bar */}
            <div className="flex items-center space-x-3.5 bg-white border border-gray-200 p-2 rounded-xl text-xs shadow-sm self-start">
              <span className="flex items-center space-x-1.5 text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>NCBI E-utils: <strong className="text-gray-700">Connected</strong></span>
              </span>
              <span className="text-gray-200">|</span>
              <span className="flex items-center space-x-1.5 text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Cloud Run Server: <strong className="text-[#059669] font-semibold">CLOUD_READY</strong></span>
              </span>
            </div>
          </div>
        </div>

        {/* Tab Router view */}
        <div className="space-y-6">
          {activeTab === "sequence" && (
            <SequenceDashboard user={user} />
          )}
          {activeTab === "ai-assistant" && (
            <BioAssistant user={user} />
          )}
          {activeTab === "cpanel" && (
            <CPanelDeployment />
          )}
        </div>
      </main>

      {/* Premium footer */}
      <footer className="bg-white border-t border-gray-200 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <span className="font-display font-bold text-[#064E3B]">BioHub<span className="text-emerald-600 font-light">Cloud</span></span>
            <span>&copy; {new Date().getFullYear()} Global Standard Bio-computing Solutions.</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1 text-gray-500">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Bio-Research Portal</span>
            </span>
            <span>•</span>
            <span className="text-[10px] font-mono tracking-widest bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded border border-emerald-100 uppercase font-semibold">
              cPanel Optimized
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
