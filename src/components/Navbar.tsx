import React from "react";
import { User, LogIn, LogOut, Dna, Server } from "lucide-react";
import { signInWithGoogle, logOut } from "../lib/firebase";
import { User as FirebaseUser } from "firebase/auth";

interface NavbarProps {
  user: FirebaseUser | null;
  loading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({ user, loading, activeTab, setActiveTab }: NavbarProps) {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo Brand */}
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab("sequence")}>
            <div className="w-8 h-8 bg-[#059669] rounded-lg flex items-center justify-center text-white">
              <Dna className="w-5 h-5 animate-none" />
            </div>
            <div className="flex items-center">
              <span className="font-display font-bold text-xl tracking-tight text-[#064E3B]">
                BioHub<span className="font-light">Cloud</span>
              </span>
              <span className="hidden sm:inline-block ml-3 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded uppercase tracking-wider">
                v1.2 Stable
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab("sequence")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                activeTab === "sequence"
                  ? "bg-emerald-50 text-emerald-700 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Sequence Engine
            </button>
            <button
              onClick={() => setActiveTab("ai-assistant")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                activeTab === "ai-assistant"
                  ? "bg-emerald-50 text-emerald-700 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Bio-AI Grounding Chat
            </button>
            <button
              onClick={() => setActiveTab("cpanel")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                activeTab === "cpanel"
                  ? "bg-emerald-50 text-emerald-700 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              cPanel Python Deploy
            </button>
          </nav>

          {/* Auth & Status Area */}
          <div className="flex items-center space-x-4">
            {/* Live Indicator */}
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>BioLogic Live</span>
            </div>

            {loading ? (
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            ) : user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800 line-clamp-1">
                    {user.displayName || "Bio Researcher"}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono line-clamp-1">{user.email}</p>
                </div>
                
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User Avatar"}
                    className="w-9 h-9 rounded-full border border-gray-200 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-200">
                    <User className="w-4 h-4" />
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center space-x-2 bg-gray-900 text-white hover:bg-emerald-600 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all duration-200"
              >
                <LogIn className="w-4 h-4" />
                <span>Connect Portal</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Tab bar */}
      <div className="md:hidden flex border-t border-gray-100 bg-white justify-around py-2">
        <button
          onClick={() => setActiveTab("sequence")}
          className={`flex-1 text-center py-1.5 text-xs font-medium ${
            activeTab === "sequence" ? "text-emerald-600 font-semibold" : "text-gray-500"
          }`}
        >
          Sequence Engine
        </button>
        <button
          onClick={() => setActiveTab("ai-assistant")}
          className={`flex-1 text-center py-1.5 text-xs font-medium ${
            activeTab === "ai-assistant" ? "text-emerald-600 font-semibold" : "text-gray-500"
          }`}
        >
          Grounding Chat
        </button>
        <button
          onClick={() => setActiveTab("cpanel")}
          className={`flex-1 text-center py-1.5 text-xs font-medium ${
            activeTab === "cpanel" ? "text-emerald-600 font-semibold" : "text-gray-500"
          }`}
        >
          Deploy Guide
        </button>
      </div>
    </header>
  );
}
