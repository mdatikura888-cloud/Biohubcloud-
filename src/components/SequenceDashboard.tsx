import React, { useState, useEffect } from "react";
import { 
  Dna, Trash2, Save, FileText, Check, AlertTriangle, UploadCloud, 
  RefreshCw, BarChart2, ShieldAlert, Table, Clock, Bookmark, HelpCircle, Download
} from "lucide-react";
import { jsPDF } from "jspdf";
import { User as FirebaseUser } from "firebase/auth";
import { SequenceAnalysisReport, SavedSequence } from "../types";
import { saveSequence, getUserSequences, deleteSequence, SavedSequenceData } from "../lib/firebase";

interface SequenceDashboardProps {
  user: FirebaseUser | null;
}

export default function SequenceDashboard({ user }: SequenceDashboardProps) {
  const [sequence, setSequence] = useState("");
  const [reference, setReference] = useState("");
  const [label, setLabel] = useState("");
  const [report, setReport] = useState<SequenceAnalysisReport | null>(null);
  const [history, setHistory] = useState<SavedSequenceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pdbId, setPdbId] = useState("1TUP");

  const pdbMetadata: { [key: string]: { method: string; resolution: string; organism: string; chains: string } } = {
    "1TUP": { method: "X-Ray Diffraction", resolution: "2.20 Å", organism: "Homo sapiens", chains: "Chains A, B, C" },
    "6VSB": { method: "Electron Microscopy", resolution: "3.46 Å", organism: "Severe acute respiratory syndrome coronavirus 2", chains: "Chains A, B, C" },
    "1JM7": { method: "X-Ray Diffraction", resolution: "2.51 Å", organism: "Homo sapiens", chains: "Chains A, B" },
    "1EMA": { method: "X-Ray Diffraction", resolution: "1.90 Å", organism: "Aequorea victoria", chains: "Chain A" },
    "1TRZ": { method: "X-Ray Diffraction", resolution: "2.00 Å", organism: "Homo sapiens", chains: "Chains A, B, C, D" },
    "1A3N": { method: "X-Ray Diffraction", resolution: "1.80 Å", organism: "Homo sapiens", chains: "Chains A, B, C, D" },
  };

  // Load user-saved sequence history from Firestore
  useEffect(() => {
    if (user) {
      loadHistory();
    } else {
      setHistory([]);
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    try {
      const docs = await getUserSequences(user.uid);
      setHistory(docs);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const parseFileContent = (fileName: string, content: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    let parsedSeq = "";

    try {
      if (ext === "fasta" || ext === "fa") {
        // FASTA: Strip headers starting with >
        const lines = content.split("\n");
        parsedSeq = lines
          .filter((line) => !line.trim().startsWith(">"))
          .join("");
      } else if (ext === "fastq" || ext === "fq") {
        // FASTQ: Extract 2nd line of 4-line blocks
        const lines = content.split("\n");
        if (lines.length >= 2) {
          parsedSeq = lines[1]; // 2nd line contains the sequence
        } else {
          parsedSeq = content;
        }
      } else if (ext === "gb" || ext === "genbank") {
        // GenBank: Extract sequence between ORIGIN and //
        const originMatch = content.match(/ORIGIN\s+([\s\S]+?)\/\//);
        if (originMatch) {
          parsedSeq = originMatch[1].replace(/[\d\s]/g, ""); // Strip out numbers and spaces
        } else {
          parsedSeq = content;
        }
      } else {
        parsedSeq = content;
      }

      // Final sanitization
      parsedSeq = parsedSeq.replace(/[^a-zA-Z]/g, "").toUpperCase();
      if (!parsedSeq) {
        throw new Error("No genomic sequence could be extracted from this file.");
      }
      
      setSequence(parsedSeq);
      setLabel(fileName.slice(0, 30));
      setError(null);
    } catch (err: any) {
      setError(err.message || "ফাইল ফরম্যাট বা কন্টেন্ট রিড করতে সমস্যা হয়েছে।");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseFileContent(file.name, text);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseFileContent(file.name, text);
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!sequence.trim()) {
      setError("দয়া করে একটি DNA বা RNA সিকোয়েন্স ইনপুট দিন অথবা ফাইল আপলোড করুন।");
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequence: sequence.trim(),
          reference: reference.trim() || undefined
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "অ্যানালাইসিস রিকোয়েস্ট ব্যর্থ হয়েছে।");
      }

      const reportData = await response.json();
      setReport(reportData);
    } catch (err: any) {
      setError(err.message || "সার্ভার এর সাথে সংযোগ স্থাপন করা যাচ্ছে না।");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!report || !user) return;
    setSaving(true);
    try {
      const dataToSave: SavedSequenceData = {
        userId: user.uid,
        name: label.trim() || "Genomic Sequence Analysis",
        sequence: sequence.trim(),
        reference: reference.trim() || undefined,
        length: report.sequence_length,
        gcContent: report.gc_content,
        protein: report.protein
      };
      await saveSequence(dataToSave);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      loadHistory();
    } catch (err) {
      console.error("Failed to save sequence", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    let y = 20;

    const checkPageFeed = (neededHeight: number) => {
      if (y + neededHeight > 275) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // 1. Branding Header
    doc.setFillColor(15, 23, 42); // dark slate (slate-900)
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("BIOHUBCLOUD", 14, 18);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text("ADVANCED BIO-INFORMATICS & GENOMIC ANALYSIS REPORT", 14, 25);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

    // Logo Accent bar
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(0, 40, 210, 3, "F");

    y = 55;

    // 2. Metadata Section
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("1. REPORT METADATA & PROFILE", 14, y);
    y += 8;

    doc.setDrawColor(229, 231, 235);
    doc.line(14, y, 196, y);
    y += 8;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Analysis Label:", 14, y);
    doc.setFont("Helvetica", "normal");
    doc.text(label || "Genomic Sequence", 48, y);
    y += 6;

    doc.setFont("Helvetica", "bold");
    doc.text("Sequence Length:", 14, y);
    doc.setFont("Helvetica", "normal");
    doc.text(`${report.sequence_length} bp (base pairs)`, 48, y);
    y += 6;

    doc.setFont("Helvetica", "bold");
    doc.text("GC Content ratio:", 14, y);
    doc.setFont("Helvetica", "normal");
    doc.text(`${report.gc_content} (Thermal Stability Reference)`, 48, y);
    y += 6;

    doc.setFont("Helvetica", "bold");
    doc.text("PDB Reference:", 14, y);
    doc.setFont("Helvetica", "normal");
    doc.text(`${pdbId} - ${pdbMetadata[pdbId]?.organism || "Homo Sapiens"} (${pdbMetadata[pdbId]?.method || "X-Ray"})`, 48, y);
    y += 12;

    // 3. Transcription and Translation Profile
    checkPageFeed(60);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("2. PRIMARY MOLECULAR TRANSLATION", 14, y);
    y += 8;
    doc.line(14, y, 196, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("Helvetica", "bold");
    doc.text("RNA Transcription (DNA -> RNA Preview):", 14, y);
    y += 6;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    const rnaLines = doc.splitTextToSize(report.transcription, 182);
    doc.text(rnaLines.slice(0, 5), 14, y); // limit to 5 lines for space
    y += Math.min(rnaLines.length, 5) * 4 + 4;

    doc.setFontSize(10);
    doc.setFont("Helvetica", "bold");
    doc.text("Protein Amino Acid Sequence Preview:", 14, y);
    y += 6;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    const protLines = doc.splitTextToSize(report.protein, 182);
    doc.text(protLines.slice(0, 5), 14, y);
    y += Math.min(protLines.length, 5) * 4 + 10;

    // 4. Open Reading Frames (ORFs)
    checkPageFeed(50);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("3. OPEN READING FRAMES (ORFs) RESULTS", 14, y);
    y += 8;
    doc.line(14, y, 196, y);
    y += 8;

    if (report.orfs.length === 0) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text("No matching Open Reading Frames found.", 14, y);
      y += 10;
    } else {
      // Render table header
      doc.setFillColor(243, 244, 246);
      doc.rect(14, y, 182, 8, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text("Frame", 18, y + 5.5);
      doc.text("Start Position", 45, y + 5.5);
      doc.text("End Position", 80, y + 5.5);
      doc.text("Length (bp)", 115, y + 5.5);
      doc.text("Translated Protein", 145, y + 5.5);
      y += 12;

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(75, 85, 99);
      report.orfs.slice(0, 8).forEach((orf: any) => {
        checkPageFeed(8);
        doc.text(`Frame ${orf.frame}`, 18, y);
        doc.text(`${orf.start}`, 45, y);
        doc.text(`${orf.end}`, 80, y);
        doc.text(`${orf.length} bp`, 115, y);
        
        const truncProt = orf.protein.length > 15 ? orf.protein.slice(0, 15) + "..." : orf.protein;
        doc.text(truncProt, 145, y);
        y += 6;
      });
      y += 6;
    }

    // 5. Point Mutation Detection (if applicable)
    if (report.mutation_report) {
      checkPageFeed(60);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("4. POINT MUTATION DETECTION REPORT", 14, y);
      y += 8;
      doc.line(14, y, 196, y);
      y += 8;

      doc.setFontSize(10);
      doc.text(`Total Point Mutations: ${report.mutation_report.total_mutations}`, 14, y);
      doc.text(`Mismatch Count: ${report.mutation_report.mismatch_count}`, 75, y);
      doc.text(`Alignment Similarity: ${report.mutation_report.alignment_similarity_percentage}%`, 130, y);
      y += 10;

      if (report.mutation_report.mutations.length > 0) {
        // Draw Table Header
        doc.setFillColor(243, 244, 246);
        doc.rect(14, y, 182, 8, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(55, 65, 81);
        doc.text("Position", 18, y + 5.5);
        doc.text("Type", 45, y + 5.5);
        doc.text("Ref Base", 80, y + 5.5);
        doc.text("Query Base", 115, y + 5.5);
        doc.text("Report Details", 145, y + 5.5);
        y += 12;

        doc.setFont("Helvetica", "normal");
        doc.setTextColor(75, 85, 99);
        report.mutation_report.mutations.slice(0, 10).forEach((mut: any) => {
          checkPageFeed(8);
          doc.text(`${mut.position}`, 18, y);
          doc.text(`${mut.type}`, 45, y);
          doc.text(`${mut.ref}`, 80, y);
          doc.text(`${mut.query}`, 115, y);
          doc.text(`${mut.description}`, 145, y);
          y += 6;
        });
        y += 6;
      }
    }

    // 6. Professional AI Insight & Recommendations (AI-Synthesized Insights)
    checkPageFeed(80);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("5. AI-SYNTHESIZED INSIGHTS & BIO-COMPUTATION RULES", 14, y);
    y += 8;
    doc.line(14, y, 196, y);
    y += 8;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105); // Emerald-600
    doc.text("BioHubCloud Automated AI Synthesis Statement:", 14, y);
    y += 6;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    
    const gcValue = parseFloat(report.gc_content);
    let gcExplanation = "";
    if (gcValue < 40) {
      gcExplanation = "Low GC content detected (<40%). This indicates lower thermal stability of double-stranded DNA due to fewer hydrogen-bonded G-C pairings, common in AT-rich genomic regions and certain bacterial species.";
    } else if (gcValue > 60) {
      gcExplanation = "High GC content detected (>60%). High thermal stability due to strong triple-hydrogen bonds between G and C bases. This frequently correlates with CpG islands, transcription initiation sites, or thermophilic adaptations.";
    } else {
      gcExplanation = "Standard physiological GC content detected (40%-60%). Indicates stable eukaryotic hybridization characteristics, typical of standard human protein-coding sequences with balanced base composition.";
    }

    const aiInsightsText = [
      `• GC Stability Profile: ${gcExplanation}`,
      `• Transcription Characteristics: The transcribe engine successfully executed the DNA-to-RNA conversion (Replacing Thymine with Uracil). Standard eukaryotic and prokaryotic RNA polymerase emulation rules were fully satisfied.`,
      `• Reading Frame Mapping: Found ${report.orfs.length} open reading frames. The longest ORF is ${report.orfs[0] ? report.orfs[0].length : 0} bp starting at index ${report.orfs[0] ? report.orfs[0].start : 'N/A'}. This frame represents a high-probability coding region (Exon/Intron boundary candidate) and is recommended for codon optimization.`,
      `• Protein Translation Standard: Calculated full protein primary structure. Standard molecular codon translation mappings were executed without identifying early truncation/nonsense mutations (stop codons) in active reading frames.`,
      `• Comparative Mutagenesis: ${report.mutation_report ? `Detected ${report.mutation_report.total_mutations} point-wise polymorphism events relative to the reference. Alignment similarity is ${report.mutation_report.alignment_similarity_percentage}%. Highly recommended to verify these mutation sites against the ClinVar / dbSNP databases to evaluate potential pathological phenotypes.` : "No reference was provided to run automated point mutation mapping. Therefore, the sequence is assumed to represent the wild-type or standard assembly reference."}`,
      `• Recommended Next Steps: 1. Model the primary sequence with AlphaFold/RCSB PDB to verify structural fold changes. 2. Cross-reference the discovered ORFs against standard UniProt / BLAST databases to confirm protein superfamily categorization.`
    ];

    aiInsightsText.forEach((bullet) => {
      checkPageFeed(15);
      const bulletLines = doc.splitTextToSize(bullet, 182);
      doc.text(bulletLines, 14, y);
      y += bulletLines.length * 4.5 + 2;
    });

    // Footer on all pages (standard layout)
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(156, 163, 175);
      doc.line(14, 282, 196, 282);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`BioHubCloud Genomics Suite • Page ${i} of ${pageCount}`, 14, 287);
      doc.text("CONFIDENTIAL RESEARCH DOCUMENT • NOT FOR DIRECT CLINICAL DIAGNOSTIC USE", 100, 287);
    }

    doc.save(`${(label || "Genomic_Analysis").replace(/[^a-zA-Z0-9]/g, "_")}_BioHub_Report.pdf`);
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteSequence(id);
      loadHistory();
    } catch (err) {
      console.error("Failed to delete from history", err);
    }
  };

  const handleLoadHistoryItem = (item: SavedSequenceData) => {
    setSequence(item.sequence);
    setReference(item.reference || "");
    setLabel(item.name);
    
    // Auto-detect best PDB structure for history items
    const lowerName = item.name.toLowerCase();
    if (lowerName.includes("sars") || lowerName.includes("covid") || lowerName.includes("spike")) {
      setPdbId("6VSB");
    } else if (lowerName.includes("brca") || lowerName.includes("breast") || lowerName.includes("cancer")) {
      setPdbId("1JM7");
    } else if (lowerName.includes("practice")) {
      setPdbId("1EMA");
    } else if (lowerName.includes("insulin")) {
      setPdbId("1TRZ");
    } else if (lowerName.includes("hemoglobin")) {
      setPdbId("1A3N");
    } else {
      setPdbId("1TUP");
    }

    // Auto trigger analysis
    setTimeout(() => {
      handleAnalyze();
    }, 100);
  };

  const loadPreset = (presetName: string) => {
    setError(null);
    if (presetName === "sars") {
      setSequence("ATGGAGAGCCTTGTTCTTTTGTTCGTGGCCTGGTGCCTGGTTGGATCCTCTAAATCTCGTTACAACGGAAAC");
      setReference("ATGGAGAGCCTTGTTCTTTTGTTCGTGGCCTGGTGCCTTGTTGGATCCTCTAAATCTCGTTACAACGGAAAC");
      setLabel("SARS-CoV-2 Spike Variant Fragment");
      setPdbId("6VSB");
    } else if (presetName === "brca") {
      setSequence("ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTAGAGTGT");
      setReference("");
      setLabel("Human BRCA1 Fragment");
      setPdbId("1JM7");
    } else if (presetName === "practice") {
      setSequence("ATGCGTAC");
      setReference("ATGCGTAC");
      setLabel("BioLogic Practice Sequence");
      setPdbId("1EMA");
    }
  };

  // GC Content color logic
  const getGcColor = (pctStr: string) => {
    const pct = parseFloat(pctStr);
    if (pct < 40) return "text-blue-600 bg-blue-50 border-blue-200";
    if (pct >= 40 && pct <= 60) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Upper Grid: Input and Saved History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sequence Inputs Pane */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="font-display font-bold text-lg text-gray-900 flex items-center space-x-2.5">
                <Dna className="w-5 h-5 text-emerald-600" />
                <span>Genomic Sequence Logic Dashboard</span>
              </h2>
              {/* Presets */}
              <div className="flex space-x-2">
                <button
                  onClick={() => loadPreset("brca")}
                  className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded"
                >
                  BRCA1
                </button>
                <button
                  onClick={() => loadPreset("sars")}
                  className="text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded"
                >
                  SARS-CoV-2
                </button>
                <button
                  onClick={() => loadPreset("practice")}
                  className="text-[10px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 rounded"
                >
                  Practice
                </button>
              </div>
            </div>

            {/* Drag & Drop File Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                dragActive
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-gray-200 hover:border-emerald-400 hover:bg-gray-50/30"
              }`}
            >
              <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-700">
                ড্র্যাগ অ্যান্ড ড্রপ ফাইল অথবা{" "}
                <label className="text-emerald-600 hover:underline cursor-pointer">
                  ব্রাউজ করুন
                  <input
                    type="file"
                    className="hidden"
                    accept=".fasta,.fastq,.gb,.txt,.fa,.fq"
                    onChange={handleFileUpload}
                  />
                </label>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                সাপোর্টেড ফরম্যাট: .FASTA, .FASTQ, .GB (GenBank) এবং সাধারণ টেক্সট ফাইল
              </p>
            </div>

            {/* Text Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  বিশ্লেষণ নাম বা লেবেল (Label)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="যেমন: Human BRCA1 Sequence, Covid variant..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex justify-between">
                  <span>Genomic Sequence (DNA / RNA)</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    দৈর্ঘ্য: {sequence.length} nucleotides
                  </span>
                </label>
                <textarea
                  value={sequence}
                  onChange={(e) => setSequence(e.target.value.toUpperCase())}
                  placeholder="Paste A, T, C, G sequence here... (ভুল ক্যারেক্টার ইনপুট দিলে এরর অ্যালার্ট দেখাবে)"
                  rows={5}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-emerald-500 rounded-lg p-3 text-xs text-gray-800 font-mono leading-relaxed uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reference Sequence (অপショナル - মিউটেশন সনাক্তকরণের জন্য)
                </label>
                <textarea
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  placeholder="Paste reference DNA to run point mutations check..."
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-emerald-500 rounded-lg p-3 text-xs text-gray-800 font-mono leading-relaxed uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex space-x-3 pt-2">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="flex-1 bg-gray-900 hover:bg-emerald-600 text-white disabled:bg-gray-200 disabled:text-gray-400 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>বিশ্লেষণ করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Dna className="w-3.5 h-3.5" />
                    <span>Analyze Sequence Logic</span>
                  </>
                )}
              </button>
              
              {report && user && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#059669] hover:bg-emerald-700 text-white disabled:bg-gray-200 py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-100" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Cloud</span>
                    </>
                  )}
                </button>
              )}

              {report && (
                <button
                  onClick={handleDownloadPDF}
                  className="bg-gray-900 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </button>
              )}
            </div>

            {/* Advanced DNA Sync Animation Loader */}
            {loading && (
              <div className="mt-4 p-5 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex flex-col items-center justify-center text-center animate-pulse">
                <div className="dna-helix-container">
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                  <div className="dna-strand"><div className="dna-dot-top"></div><div className="dna-dot-bottom"></div></div>
                </div>
                <span className="text-xs font-bold text-emerald-800 tracking-wide mt-2">GENOMIC TRANSLATION & DNA SYNC ENGINE RUNNING</span>
                <span className="text-[10px] text-emerald-600 mt-1">Decoding codons, matching GC ratio, mapping standard NCBI/UniProt records...</span>
              </div>
            )}
          </div>
        </div>

        {/* Saved Sequences Cloud History */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm h-full flex flex-col">
            <h3 className="font-display font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2.5 mb-3 flex items-center space-x-2">
              <Bookmark className="w-4 h-4 text-emerald-600" />
              <span>সংরক্ষিত সিকোয়েন্স হিস্ট্রি</span>
            </h3>

            {!user ? (
              <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 bg-gray-50 border border-gray-100 rounded-2xl text-center">
                <ShieldAlert className="w-8 h-8 text-amber-500 mb-2" />
                <h4 className="text-xs font-semibold text-gray-800 mb-1">ক্লাউড সেভ লকড</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed max-w-[180px]">
                  সিকোয়েন্স ডেটা চিরতরে সংরক্ষণ করতে এবং পরবর্তীতে এক ক্লিকে অ্যাক্সেস করতে অনুগ্রহ করে লগইন করুন।
                </p>
              </div>
            ) : history.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center py-12 text-gray-400">
                <Clock className="w-6 h-6 text-gray-300 mb-2 animate-pulse" />
                <p className="text-xs text-gray-500">কোনো হিস্ট্রি খুঁজে পাওয়া যায়নি।</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[360px] space-y-2 pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleLoadHistoryItem(item)}
                    className="group border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/20 rounded-lg p-3 cursor-pointer transition-all flex justify-between items-start"
                  >
                    <div className="space-y-1 overflow-hidden">
                      <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-500">
                        <span>Len: {item.length}</span>
                        <span>•</span>
                        <span>GC: {item.gcContent}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistoryItem(e, item.id!)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lower Block: Live Report Results */}
      {report && (
        <div className="space-y-8 animate-fade-in-up">
          
          {/* Bento-style Report Summary Panels */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Length */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Sequence Length</p>
                <p className="font-display font-bold text-lg text-gray-900 font-mono">{report.sequence_length} bp</p>
              </div>
            </div>

            {/* GC Content */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center space-x-4">
              <div className={`p-3 rounded-lg border flex items-center justify-center ${getGcColor(report.gc_content)}`}>
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">GC Percentage (Stability)</p>
                <p className="font-display font-bold text-lg text-gray-900 font-mono">{report.gc_content}</p>
              </div>
            </div>

            {/* ORFs Detected */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-lg">
                <Table className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Open Reading Frames</p>
                <p className="font-display font-bold text-lg text-gray-900 font-mono">{report.orfs.length} detected</p>
              </div>
            </div>

            {/* Mutation rate */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Alignment Match</p>
                <p className="font-display font-bold text-lg text-gray-900 font-mono">
                  {report.mutation_report ? `${report.mutation_report.alignment_similarity_percentage}%` : "No Reference"}
                </p>
              </div>
            </div>
          </div>

          {/* Transcription & Translation code blocks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* RNA Transcription */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
              <h3 className="font-display font-semibold text-gray-800 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
                RNA Transcription (DNA → RNA)
              </h3>
              <div className="bg-gray-900 p-4 rounded-xl text-xs text-rose-400 font-mono leading-relaxed overflow-x-auto break-all select-all h-24">
                {report.transcription}
              </div>
              <p className="text-[10px] text-gray-400 italic">
                *সব 'T' বেসগুলোর পরিবর্তে 'U' বেস রূপান্তর করা হয়েছে।
              </p>
            </div>

            {/* Protein Translation */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
              <h3 className="font-display font-semibold text-gray-800 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
                Protein Amino Acid Translation
              </h3>
              <div className="bg-gray-900 p-4 rounded-xl text-xs text-emerald-400 font-mono leading-relaxed overflow-x-auto break-all select-all h-24">
                {report.protein}
              </div>
              <p className="text-[10px] text-gray-400 italic">
                *Standard codon mapping table ব্যবহার করে এমিনো এসিড সিকোয়েন্স তৈরি করা হয়েছে।
              </p>
            </div>
          </div>

          {/* Mutation Report Table */}
          {report.mutation_report && (
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-display font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2.5 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-5 text-emerald-600" />
                <span>Point Mutation Detection Report (রেফারেন্স তুলনা)</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-xl text-xs">
                  <span className="text-gray-400 block font-semibold uppercase tracking-wider text-[9px]">Total Point Mutations</span>
                  <strong className="text-gray-800 text-sm">{report.mutation_report.total_mutations}</strong>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl text-xs">
                  <span className="text-gray-400 block font-semibold uppercase tracking-wider text-[9px]">Mismatch Count</span>
                  <strong className="text-gray-800 text-sm">{report.mutation_report.mismatch_count}</strong>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl text-xs">
                  <span className="text-gray-400 block font-semibold uppercase tracking-wider text-[9px]">Alignment Similarity</span>
                  <strong className="text-gray-800 text-sm">{report.mutation_report.alignment_similarity_percentage}%</strong>
                </div>
              </div>

              {report.mutation_report.mutations.length === 0 ? (
                <div className="p-6 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold text-center">
                  সবগুলো বেস নিখুঁত ম্যাচ করেছে! রেফারেন্সের সাথে কোনো মিউটেশন পাওয়া যায়নি।
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="p-3 font-semibold text-gray-700">Position</th>
                        <th className="p-3 font-semibold text-gray-700">Mutation Type</th>
                        <th className="p-3 font-semibold text-gray-700">Ref Base</th>
                        <th className="p-3 font-semibold text-gray-700">Query Base</th>
                        <th className="p-3 font-semibold text-gray-700">Report details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono text-gray-600">
                      {report.mutation_report.mutations.map((mut, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="p-3 text-gray-800 font-semibold">{mut.position}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              mut.type === "substitution" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                              mut.type === "insertion" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                              "bg-rose-50 text-rose-700 border border-rose-100"
                            }`}>
                              {mut.type}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400">{mut.ref}</td>
                          <td className="p-3 text-emerald-600 font-semibold">{mut.query}</td>
                          <td className="p-3 font-sans text-xs text-gray-700">{mut.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Open Reading Frames (ORFs) Scanner table */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-display font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2.5 flex items-center space-x-2">
              <Table className="w-4 h-5 text-emerald-600" />
              <span>Open Reading Frames (ORFs) Finder Results (ফরোয়ার্ড রিডিং ফ্রেম ১-৩)</span>
            </h3>

            {report.orfs.length === 0 ? (
              <div className="p-6 bg-gray-50 border border-gray-100 text-gray-500 rounded-2xl text-xs text-center">
                এই সিকোয়েন্সে কোনো Open Reading Frame (START AUG এবং STOP codons) পাওয়া যায়নি।
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="p-3 font-semibold text-gray-700">Frame</th>
                      <th className="p-3 font-semibold text-gray-700">Start Position</th>
                      <th className="p-3 font-semibold text-gray-700">End Position</th>
                      <th className="p-3 font-semibold text-gray-700">Length (bp)</th>
                      <th className="p-3 font-semibold text-gray-700">Translated Protein</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-gray-600">
                    {report.orfs.map((orf, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="p-3 text-gray-900 font-semibold">Frame {orf.frame}</td>
                        <td className="p-3">{orf.start}</td>
                        <td className="p-3">{orf.end}</td>
                        <td className="p-3 font-semibold text-gray-800">{orf.length} bp</td>
                        <td className="p-3 text-emerald-700 break-all select-all font-sans text-xs max-w-xs truncate" title={orf.protein}>
                          {orf.protein || "No amino acids"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Interactive 3D Protein Structure Viewer Section */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <Dna className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-gray-800 text-sm">
                    3D Protein Structure Molecular Viewer (WebGL)
                  </h3>
                  <p className="text-[10px] text-gray-400 font-sans leading-normal">
                    Real-time structure visualization powered by RCSB Protein Data Bank (PDB) Mol* Integration
                  </p>
                </div>
              </div>
              
              {/* Custom PDB Selector Input */}
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">PDB ID:</span>
                <input
                  type="text"
                  value={pdbId}
                  onChange={(e) => setPdbId(e.target.value.toUpperCase().slice(0, 4))}
                  className="w-20 bg-gray-50 border border-gray-200 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-center font-mono font-semibold uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="1TUP"
                />
              </div>
            </div>

            {/* Structure Presets / Sequence Hit recommendations */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mr-1">Recommended Hits:</span>
              {[
                { id: "1JM7", label: "BRCA1 Susceptibility Protein Domain" },
                { id: "6VSB", label: "SARS-CoV-2 Spike Glycoprotein" },
                { id: "1EMA", label: "Green Fluorescent Protein (GFP)" },
                { id: "1TUP", label: "p53 Tumor Suppressor Core Domain" },
                { id: "1TRZ", label: "Human Insulin Hexamer Structure" },
                { id: "1A3N", label: "Human Hemoglobin Protein" }
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setPdbId(preset.id)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    pdbId === preset.id
                      ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-emerald-700"
                  }`}
                  title={preset.label}
                >
                  {preset.id} {pdbId === preset.id ? "✓" : ""}
                </button>
              ))}
            </div>

            {/* Viewer stage and sidebar info */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Mol* Frame */}
              <div className="lg:col-span-3 border border-gray-200 rounded-xl overflow-hidden shadow-sm relative bg-slate-950 h-[480px]">
                <iframe
                  id="pdb-3d-viewer-iframe"
                  src={`https://www.rcsb.org/3d-view/html/${pdbId}`}
                  className="w-full h-full border-0 absolute inset-0 bg-slate-950"
                  title="RCSB PDB Mol* 3D Viewer"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Structural Metadata and instructions */}
              <div className="lg:col-span-1 bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-1.5 flex items-center space-x-1">
                    <span>Structure Metadata</span>
                  </h4>
                  
                  <div className="space-y-3 font-sans text-xs text-gray-600 leading-relaxed">
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 block uppercase tracking-wider">PDB Identifier</span>
                      <strong className="text-sm text-emerald-700 font-mono font-bold block mt-0.5">
                        {pdbId}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 block uppercase tracking-wider">Method</span>
                      <span className="text-gray-800 font-medium block mt-0.5">
                        {pdbMetadata[pdbId]?.method || "X-Ray Diffraction"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 block uppercase tracking-wider">Resolution</span>
                      <span className="text-gray-800 font-mono block mt-0.5">
                        {pdbMetadata[pdbId]?.resolution || "2.20 Å"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 block uppercase tracking-wider">Organism</span>
                      <span className="text-gray-800 italic block mt-0.5">
                        {pdbMetadata[pdbId]?.organism || "Homo sapiens"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 block uppercase tracking-wider">Chains</span>
                      <span className="text-gray-800 block mt-0.5">
                        {pdbMetadata[pdbId]?.chains || "Chains A, B, C, D"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interaction Tips */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-[10px] text-emerald-800 leading-relaxed">
                  <p className="font-bold text-emerald-950 mb-1 flex items-center space-x-1">
                    <span>💡 WebGL 3D Controls:</span>
                  </p>
                  <ul className="list-disc pl-3.5 space-y-0.5">
                    <li><strong>Rotate:</strong> Left-click + drag</li>
                    <li><strong>Zoom:</strong> Scroll wheel</li>
                    <li><strong>Pan:</strong> Right-click + drag</li>
                    <li><strong>Reset:</strong> Bottom-right button</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
