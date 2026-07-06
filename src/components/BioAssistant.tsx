import React, { useState, useEffect, useRef } from "react";
import { 
  Send, BrainCircuit, History, Plus, MessageSquare, Trash2, 
  Sparkles, CheckCircle2, BookOpen, FileText, Database, ShieldAlert, AlertCircle 
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { User as FirebaseUser } from "firebase/auth";
import BioChatChart from "./BioChatChart";
import { 
  getUserChats, 
  saveChatSession, 
  updateChatSession, 
  deleteChatSession, 
  ChatMessage, 
  ChatSessionData 
} from "../lib/firebase";

interface BioAssistantProps {
  user: FirebaseUser | null;
}

export default function BioAssistant({ user }: BioAssistantProps) {
  const [chats, setChats] = useState<ChatSessionData[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [groundedGene, setGroundedGene] = useState<string | null>(null);
  const [groundedData, setGroundedData] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat sessions from Firestore when user state changes
  useEffect(() => {
    if (user) {
      loadUserChats();
    } else {
      setChats([]);
      setCurrentSessionId(null);
      setMessages([
        {
          role: "model",
          content: "আসসালামু আলাইকুম! আমি **BioHubCloud AI**. আমি একজন স্পেশালাইজড বায়োইনফরমেটিক্স এবং জেনেটিক ইঞ্জিনিয়ারিং গবেষক।\n\nআপনি যেকোনো ডিএনএ সিকোয়েন্স, মিউটেশন, বা নির্দিষ্ট জিন (যেমন: **BRCA1**, **TP53**, **EGFR**) সম্পর্কে যেকোনো প্রশ্ন করতে পারেন। আমি NCBI ডাটাবেস থেকে সরাসরি ডেটা এনে আপনাকে বিশ্লেষণ করে দেব। \n\n*সংকেত: আপনার অতীত চ্যাট হিস্ট্রি সেভ করতে উপরে 'Connect Portal'-এ ক্লিক করে লগইন করে নিন।*",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [user]);

  // Scroll to bottom when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadUserChats = async () => {
    if (!user) return;
    try {
      const userChats = await getUserChats(user.uid);
      setChats(userChats);
      if (userChats.length > 0 && !currentSessionId) {
        // Select latest chat
        setCurrentSessionId(userChats[0].id || null);
        setMessages(userChats[0].messages);
      }
    } catch (err) {
      console.error("Failed to load user chats", err);
    }
  };

  const handleStartNewChat = () => {
    setCurrentSessionId(null);
    setGroundedGene(null);
    setGroundedData(null);
    setMessages([
      {
        role: "model",
        content: "আমি নতুন তথ্য ও NCBI ডাটাবেস গ্রাউন্ডেড রিসার্চ সেশনের জন্য প্রস্তুত। আপনি জিনের কোড বা বায়োলজিক্যাল প্রশ্ন করতে পারেন।",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleSelectChat = (chat: ChatSessionData) => {
    setCurrentSessionId(chat.id || null);
    setMessages(chat.messages);
    setGroundedGene(null);
    setGroundedData(null);
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteChatSession(id);
      if (currentSessionId === id) {
        handleStartNewChat();
      }
      if (user) loadUserChats();
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const queryText = textToSend || input;
    if (!queryText.trim()) return;

    if (!textToSend) setInput("");

    const userMsg: ChatMessage = {
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const response = await fetch("/api/bio-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText })
      });

      if (!response.ok) {
        let errorMsg = "AI request failed";
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      const assistantMsg: ChatMessage = {
        role: "model",
        content: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ncbi_grounded: data.ncbi_grounded,
        chart_data: data.chart_data,
        image_url: data.image_url
      };

      if (data.ncbi_grounded && data.ncbi_data) {
        setGroundedGene(queryText.split(/\s+/).find(w => /^[A-Z0-9]{3,10}$/.test(w)) || "Gene");
        setGroundedData(data.ncbi_data);
      } else {
        setGroundedGene(null);
        setGroundedData(null);
      }

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Save to database
      if (user) {
        if (currentSessionId) {
          await updateChatSession(currentSessionId, finalMessages);
          loadUserChats();
        } else {
          const title = queryText.length > 35 ? queryText.slice(0, 35) + "..." : queryText;
          const newSessionId = await saveChatSession({
            userId: user.uid,
            title,
            messages: finalMessages
          });
          setCurrentSessionId(newSessionId);
          loadUserChats();
        }
      }
    } catch (err: any) {
      console.error(err);
      const errDetail = err?.message || "Unknown error";
      setMessages(prev => [
        ...prev,
        {
          role: "model",
          content: `❌ এপিআই কুয়েরি প্রসেস করার সময় কোনো ত্রুটি হয়েছে।\n\n**Error Details:** \`${errDetail}\`\n\nদয়া করে আপনার ইন্টারনেট কানেকশন বা সিকোয়েন্স কোড চেক করে আবার ট্রাই করুন।`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    { text: "Describe BRCA1 gene and its mutation risk factors.", gene: "BRCA1" },
    { text: "What is the biological function of the human TP53 tumor suppressor gene?", gene: "TP53" },
    { text: "How does NCBI E-utils query genes? Explain the logic.", gene: "NCBI" },
    { text: "Explain DNA Transcription thermal stability.", gene: "Transcription" }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      
      {/* Sidebar Conversation list */}
      <div className="lg:col-span-1 space-y-4">
        <button
          onClick={handleStartNewChat}
          className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-2xl text-sm font-semibold shadow-sm transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>New Bio Session</span>
        </button>

        {/* Chat History Panel */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <h3 className="font-display font-semibold text-gray-800 text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center space-x-1.5">
            <History className="w-3.5 h-3.5" />
            <span>Chat History</span>
          </h3>

          {!user ? (
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-center">
              <AlertCircle className="w-5 h-5 mx-auto text-amber-500 mb-1" />
              <p className="text-[11px] text-gray-500 font-sans leading-relaxed">
                চ্যাট হিস্ট্রি এবং এআই মেমোরি সংরক্ষণ করতে উপরে লগইন করুন।
              </p>
            </div>
          ) : chats.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No past sessions found.</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all group ${
                    currentSessionId === chat.id
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                      : "text-gray-600 hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                    <span className="text-xs font-medium truncate">{chat.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(e, chat.id!)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grounded Database Stats Panel */}
        {groundedData && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm animate-fade-in">
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-xs uppercase tracking-wider border-b border-gray-100 pb-2 mb-3">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>NCBI Grounding Record</span>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-gray-700">
              <p><strong className="text-gray-900">Term:</strong> {groundedGene}</p>
              <p><strong className="text-gray-900">Gene ID:</strong> {groundedData.uid || "N/A"}</p>
              <p><strong className="text-gray-900">Official Symbol:</strong> {groundedData.name || "N/A"}</p>
              <p><strong className="text-gray-900">Location:</strong> Chromosome {groundedData.chromosome || "N/A"}</p>
              <p className="line-clamp-3"><strong className="text-gray-900">Summary:</strong> {groundedData.summary || "N/A"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Pane */}
      <div className="lg:col-span-3 flex flex-col bg-white border border-gray-200 rounded-2xl h-[580px] overflow-hidden shadow-sm">
        
        {/* Chat Pane Header */}
        <div className="bg-gray-50 border-b border-gray-100 px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <BrainCircuit className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-gray-800 text-sm">
                BioHubCloud Intelligent Assistant
              </h3>
              <p className="text-[10px] text-gray-400">
                Grounding with National Center for Biotechnology Information (NCBI) Databases
              </p>
            </div>
          </div>
          
          <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-widest bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-emerald-600 animate-spin" />
            <span>Gemini v3.5</span>
          </span>
        </div>

        {/* Chat History Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 max-w-[85%] ${
                msg.role === "user" ? "ml-auto flex-row-reverse space-x-reverse" : ""
              }`}
            >
              {/* Profile/Bot Icon */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs border ${
                  msg.role === "user"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-emerald-50 text-emerald-700 border-emerald-100"
                }`}
              >
                {msg.role === "user" ? "U" : <BrainCircuit className="w-4 h-4" />}
              </div>

              {/* Speech bubble */}
              <div className="space-y-1">
                <div
                  className={`rounded-2xl p-4 shadow-sm text-sm ${
                    msg.role === "user"
                      ? "bg-gray-900 text-gray-100 rounded-tr-none"
                      : "bg-gray-50 text-gray-800 rounded-tl-none border border-gray-200"
                  }`}
                >
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  
                  {msg.image_url && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 shadow-xs max-w-full bg-white p-1">
                      <img
                        src={msg.image_url}
                        alt="Biological Visualization"
                        className="w-full h-auto object-cover max-h-[320px] rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {msg.chart_data && (
                    <BioChatChart chartData={msg.chart_data} />
                  )}
                  
                  {msg.ncbi_grounded && (
                    <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-center space-x-1.5 text-[10px] font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>NCBI Grounded Source Verified</span>
                    </div>
                  )}
                </div>
                
                {/* Message Timestamp */}
                <p className={`text-[9px] text-gray-400 font-mono ${msg.role === "user" ? "text-right" : ""}`}>
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start space-x-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                <BrainCircuit className="w-4 h-4 text-emerald-600 animate-spin" />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-mono text-gray-500 rounded-tl-none flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
                <span>NCBI এবং UniProt এপিআই থেকে ডাটা কোয়েরি করা হচ্ছে...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompts */}
        {messages.length <= 1 && (
          <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p.text)}
                className="text-[11px] font-medium bg-white hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 text-gray-600 hover:text-emerald-800 px-3 py-1 rounded-full cursor-pointer transition-all shadow-sm"
              >
                {p.gene}: &ldquo;{p.text}&rdquo;
              </button>
            ))}
          </div>
        )}

        {/* Input Footer Form */}
        <div className="p-4 border-t border-gray-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="TP53 মিউটেশন ব্যাখ্যা কর অথবা একটি জিনের নাম লিখুন..."
              className="flex-1 bg-gray-50 hover:bg-gray-100 focus:bg-white text-gray-800 placeholder-gray-400 border border-gray-200 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-gray-900 hover:bg-emerald-700 text-white disabled:bg-gray-200 disabled:text-gray-400 p-2.5 rounded-xl transition-all shadow-sm flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
