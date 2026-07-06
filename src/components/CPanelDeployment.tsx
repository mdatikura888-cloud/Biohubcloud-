import React, { useState, useEffect } from "react";
import { FolderTree, FileText, Code, Check, Copy, HelpCircle, Download, BookOpen, AlertCircle } from "lucide-react";
import { BackendFilesResponse } from "../types";

export default function CPanelDeployment() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<keyof BackendFilesResponse>("logic.py");
  const [backendFiles, setBackendFiles] = useState<BackendFilesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch live backend python files code from server to guarantee sync and accuracy
    const fetchBackendFiles = async () => {
      try {
        const res = await fetch("/api/cpanel/files");
        if (res.ok) {
          const data = await res.json();
          setBackendFiles(data);
        }
      } catch (err) {
        console.error("Failed to fetch backend files", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBackendFiles();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const folderStructure = [
    { name: "/home/username/ (Root Directory)", isFolder: true, depth: 0 },
    { name: "/biohub_backend/ (Python Logic - public_html এর বাইরে)", isFolder: true, depth: 1 },
    { name: "app.py (মেইন পাইথন Flask/FastAPI ফাইল)", isFolder: false, depth: 2 },
    { name: "logic.py (আসল বায়োলজিক্যাল কোড)", isFolder: false, depth: 2 },
    { name: "requirements.txt (লাইব্রেরি লিস্ট)", isFolder: false, depth: 2 },
    { name: "test.py (অফলাইন DNA কনভার্টার টেস্ট)", isFolder: false, depth: 2 },
    { name: "/public_html/ (ইউজাররা ইন্টারনেটে দেখবে)", isFolder: true, depth: 1 },
    { name: "index.html (হোমপেজ)", isFolder: false, depth: 2 },
    { name: "dashboard.html (রিসার্চ ড্যাশবোর্ড)", isFolder: false, depth: 2 },
    { name: ".htaccess (ইউজার রিকোয়েস্ট রিডাইরেক্ট)", isFolder: false, depth: 2 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Overview Card */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 rounded-2xl p-6 md:p-8 text-white shadow-sm">
        <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tight mb-2">
          cPanel Python App হোস্টিং এবং ডিপ্লয়মেন্ট সেন্টার
        </h2>
        <p className="text-emerald-100 max-w-3xl text-sm md:text-base leading-relaxed">
          আপনার বাংলাদেশি আইটি হেল্পার (IT Helper) যাতে সম্পূর্ণ জিরো-কস্টে (Zero Cost) এই শক্তিশালী পাইথন ব্যাকএন্ড ও বায়ো-ইনফরম্যাটিক্স ইঞ্জিনটি cPanel-এ হোস্ট করতে পারে, তার জন্য প্রয়োজনীয় সকল ফাইল এবং সেটআপ গাইড নিচে দেওয়া হলো।
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Step-by-Step Guide & Structure */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Folder Structure */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <h3 className="font-display font-semibold text-gray-800 mb-4 flex items-center space-x-2 border-b border-gray-100 pb-2">
              <FolderTree className="text-emerald-600 w-5 h-5" />
              <span>cPanel ডিরেক্টরি স্ট্রাকচার</span>
            </h3>
            <div className="font-mono text-xs text-gray-700 bg-gray-50 p-4 rounded-xl overflow-x-auto space-y-1.5 border border-gray-100">
              {folderStructure.map((item, index) => (
                <div
                  key={index}
                  style={{ paddingLeft: `${item.depth * 16}px` }}
                  className={`flex items-center space-x-2 ${item.isFolder ? "font-semibold text-gray-900" : "text-gray-600"}`}
                >
                  <span className={item.isFolder ? "text-emerald-600" : "text-gray-400"}>
                    {item.isFolder ? "📁" : "📄"}
                  </span>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Setup steps in Bengali */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-display font-semibold text-gray-800 flex items-center space-x-2 border-b border-gray-100 pb-2">
              <BookOpen className="text-emerald-600 w-5 h-5" />
              <span>ধাপ ৪: cPanel Setup গাইড</span>
            </h3>
            <ul className="space-y-3.5 text-xs text-gray-600 leading-relaxed list-decimal pl-4">
              <li>
                <strong>cPanel-এ লগইন করুন:</strong> আপনার হোস্টিং সিপ্যানেলে লগইন করে <span className="font-semibold text-gray-800">"Setup Python App"</span> অপশনটি সিলেক্ট করুন।
              </li>
              <li>
                <strong>নতুন Python App তৈরি করুন:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li>Python Version: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">3.10+</span> সিলেক্ট করুন</li>
                  <li>Application root: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">biohub_backend</span> লিখুন</li>
                  <li>Application URL: আপনি যে সাবডোমেন বা লিংকে হোস্ট করতে চান তা দিন।</li>
                </ul>
              </li>
              <li>
                <strong>ফাইল আপলোড করুন:</strong> ডান পাশের কোড প্যানেল থেকে ফাইলগুলো কপি করে যথাক্রমে <span className="font-mono bg-gray-100 px-1 rounded">logic.py</span> এবং <span className="font-mono bg-gray-100 px-1 rounded">app.py</span> নামে আপলোড করুন।
              </li>
              <li>
                <strong>নির্ভরশীলতা (Dependencies) ইনস্টল করুন:</strong>
                cPanel-এ <span className="font-semibold">requirements.txt</span> ফাইলটি আপলোড করে "Add" বাটনে ক্লিক করুন, তারপর <span className="text-emerald-600 font-semibold">"Install pip packages"</span> এ ক্লিক করুন।
              </li>
              <li>
                <strong>WSGI কনফিগারেশন:</strong> cPanel-এর তৈরি করা <span className="font-mono bg-gray-100 px-1 rounded">passenger_wsgi.py</span> ফাইলে নিচের কোডটি যুক্ত করুন:
                <pre className="mt-1 bg-gray-100 p-1.5 rounded text-[10px] text-gray-800 font-mono overflow-x-auto">
                  from app import app as application
                </pre>
              </li>
            </ul>
          </div>
        </div>

        {/* Live Code Viewer and Exporter */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            
            {/* Tab header */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex space-x-2">
                {(["logic.py", "app.py", "requirements.txt", "test.py"] as Array<keyof BackendFilesResponse>).map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => setActiveFile(fileName)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${
                      activeFile === fileName
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {fileName}
                  </button>
                ))}
              </div>

              {backendFiles && (
                <button
                  onClick={() => handleCopy(backendFiles[activeFile], activeFile)}
                  className="flex items-center space-x-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                >
                  {copiedKey === activeFile ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Code editor content */}
            <div className="p-4 flex-1 bg-gray-900 text-gray-200 overflow-auto font-mono text-xs leading-relaxed max-h-[550px]">
              {loading ? (
                <div className="h-full flex flex-col justify-center items-center py-12 space-y-2">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full" />
                  <p className="text-gray-400">Loading production code files...</p>
                </div>
              ) : backendFiles ? (
                <pre className="whitespace-pre">{backendFiles[activeFile]}</pre>
              ) : (
                <div className="text-red-400 flex items-center justify-center h-full space-x-2 py-12">
                  <AlertCircle className="w-5 h-5" />
                  <span>Could not load server file list. Copy from local files instead.</span>
                </div>
              )}
            </div>

            {/* Explanatory footer */}
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
              <span className="flex items-center space-x-1 text-gray-600">
                <Code className="w-3.5 h-3.5 text-emerald-600" />
                <span>{activeFile === "logic.py" ? "Core biological state analyzer" : activeFile === "app.py" ? "Flask cPanel server framework" : activeFile === "requirements.txt" ? "Pip package dependencies" : "Quick offline testing script"}</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">
                PEP 8 Compliant
              </span>
            </div>
          </div>

          {/* Cloud Parallel Processing info */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex space-x-3.5 items-start">
            <div className="p-2 bg-emerald-600 rounded-lg text-white">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-emerald-900 text-sm mb-1">
                cloud computing প্যারালাল প্রসেসিং ট্রিপস
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                BioHubCloud-এ খুব বড় সিকোয়েন্স (১ লক্ষ নিউক্লিওটাইড এর বেশি) প্রসেস করার জন্য <strong className="font-mono text-gray-950">Dask</strong> এবং <strong className="font-mono text-gray-950">Biopython parallel pool</strong> ইন্টিগ্রেট করা হয়েছে। আপনার আইটি হেল্পার cPanel এর <span className="font-semibold">Passenger WSGI</span> সার্ভারের থ্রেড লিমিট বাড়িয়ে ২-৪ কোর সিপিইউ প্যারালালাইজেশন এনাবেল করতে পারেন।
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
