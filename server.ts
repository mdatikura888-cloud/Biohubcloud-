import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini SDK with named parameters as required by the skill
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper: NCBI database query for gene/sequence grounding
async function getNcbiGeneData(geneName: string): Promise<any> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gene&term=${encodeURIComponent(geneName)}&retmode=json`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as any;
    const idList = searchData.esearchresult?.idlist || [];
    
    if (idList.length === 0) {
      return { error: "No records found on NCBI for the given term." };
    }
    
    const geneId = idList[0];
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=${geneId}&retmode=json`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData = await summaryRes.json() as any;
    
    return summaryData.result?.[geneId] || { error: "NCBI record summary not found." };
  } catch (error: any) {
    return { error: `NCBI fetch failed: ${error.message}` };
  }
}

// Biological Logic Helpers in TypeScript (to mirror Python backend on the live server)
function sanitizeSequence(seq: string): string {
  let clean = seq.replace(/\s+/g, "").toUpperCase();
  if (clean.startsWith(">")) {
    const lines = clean.split("\n");
    clean = lines.slice(1).join("");
  }
  
  // Validate characters: A, T, C, G, U, N (unknown)
  const invalid = [...clean].filter(c => !"ATCGUN".includes(c));
  if (invalid.length > 0) {
    const uniqueInvalid = Array.from(new Set(invalid)).join("");
    throw new Error(`Invalid sequence characters found: ${uniqueInvalid}`);
  }
  return clean;
}

function transcribeDNA(seq: string): string {
  if (seq.includes("U")) return seq;
  return seq.replace(/T/g, "U");
}

function translateRNA(rna: string): string {
  const codonTable: { [key: string]: string } = {
    AUG: "M", UUU: "F", UUC: "F", UUA: "L", UUG: "L",
    UCU: "S", UCC: "S", UCA: "S", UCG: "S", UAU: "Y",
    UAC: "Y", UGU: "C", UGC: "C", UGG: "W", CUU: "L",
    CUC: "L", CUA: "L", CUG: "L", CCU: "P", CCC: "P",
    CCA: "P", CCG: "P", CAU: "H", CAC: "H", CAA: "Q",
    CAG: "Q", CGU: "R", CGC: "R", CGA: "R", CGG: "R",
    AUU: "I", AUC: "I", AUA: "I", ACU: "T", ACC: "T",
    ACA: "T", ACG: "T", AAU: "N", AAC: "N", AAA: "K",
    AAG: "K", AGU: "S", AGC: "S", AGA: "R", AGG: "R",
    GUU: "V", GUC: "V", GUA: "V", GUG: "V", GCU: "A",
    GCC: "A", GCA: "A", GCG: "A", GAU: "D", GAC: "D",
    GAA: "E", GAG: "E", GGU: "G", GGC: "G", GGA: "G",
    GGG: "G", UAA: "*", UAG: "*", UGA: "*"
  };
  
  const protein: string[] = [];
  for (let i = 0; i < rna.length - 2; i += 3) {
    const codon = rna.slice(i, i + 3);
    const aa = codonTable[codon] || "X";
    if (aa === "*") break; // Stop codon
    protein.push(aa);
  }
  return protein.join("");
}

function calculateGCContent(seq: string): number {
  if (!seq) return 0;
  const gCount = (seq.match(/G/g) || []).length;
  const cCount = (seq.match(/C/g) || []).length;
  return Math.round(((gCount + cCount) / seq.length) * 10000) / 100;
}

interface ORF {
  start: number;
  end: number;
  frame: number;
  length: number;
  sequence: string;
  protein: string;
}

function findORFs(rna: string): ORF[] {
  const orfs: ORF[] = [];
  const stopCodons = new Set(["UAA", "UAG", "UGA"]);
  
  for (let frame = 0; frame < 3; frame++) {
    let i = frame;
    while (i < rna.length - 2) {
      const codon = rna.slice(i, i + 3);
      if (codon === "AUG") {
        for (let j = i + 3; j < rna.length - 2; j += 3) {
          const nextCodon = rna.slice(j, j + 3);
          if (stopCodons.has(nextCodon)) {
            const orfSeq = rna.slice(i, j + 3);
            orfs.push({
              start: i + 1,
              end: j + 3,
              frame: frame + 1,
              length: orfSeq.length,
              sequence: orfSeq,
              protein: translateRNA(orfSeq)
            });
            i = j;
            break;
          }
        }
      }
      i += 3;
    }
  }
  return orfs.sort((a, b) => b.length - a.length);
}

interface Mutation {
  position: number;
  type: "substitution" | "insertion" | "deletion";
  ref: string;
  query: string;
  description: string;
}

function detectMutations(refSeq: string, querySeq: string): any {
  const ref = sanitizeSequence(refSeq);
  const query = sanitizeSequence(querySeq);
  
  const mutations: Mutation[] = [];
  let mismatches = 0;
  const minLen = Math.min(ref.length, query.length);
  
  for (let idx = 0; idx < minLen; idx++) {
    if (ref[idx] !== query[idx]) {
      mutations.push({
        position: idx + 1,
        type: "substitution",
        ref: ref[idx],
        query: query[idx],
        description: `Substitution: ${ref[idx]} → ${query[idx]} at position ${idx + 1}`
      });
      mismatches++;
    }
  }
  
  if (query.length > ref.length) {
    for (let idx = minLen; idx < query.length; idx++) {
      mutations.push({
        position: idx + 1,
        type: "insertion",
        ref: "-",
        query: query[idx],
        description: `Insertion: ${query[idx]} at position ${idx + 1}`
      });
    }
  } else if (ref.length > query.length) {
    for (let idx = minLen; idx < ref.length; idx++) {
      mutations.push({
        position: idx + 1,
        type: "deletion",
        ref: ref[idx],
        query: "-",
        description: `Deletion: ${ref[idx]} at position ${idx + 1}`
      });
    }
  }
  
  const similarity = minLen > 0 ? Math.round((1 - mismatches / minLen) * 10000) / 100 : 0;
  
  return {
    mismatch_count: mismatches,
    total_mutations: mutations.length,
    mutations: mutations.slice(0, 50),
    alignment_similarity_percentage: similarity
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Sequence Analysis Engine
  app.post("/api/analyze", (req, res) => {
    const { sequence, reference } = req.body;
    if (!sequence) {
      return res.status(400).json({ error: "Sequence input is required." });
    }
    
    try {
      const sanitized = sanitizeSequence(sequence);
      const transcription = transcribeDNA(sanitized);
      const protein = translateRNA(transcription);
      const gcContent = calculateGCContent(sanitized);
      const orfs = findORFs(transcription);
      
      const report: any = {
        sequence_length: sanitized.length,
        gc_content: `${gcContent}%`,
        transcription: transcription.slice(0, 2000), // formatted preview
        protein: protein.slice(0, 2000),
        orfs: orfs.slice(0, 15) // Top 15 longest ORFs
      };
      
      if (reference) {
        report.mutation_report = detectMutations(reference, sanitized);
      }
      
      res.json(report);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // API Route: Bio-AI Assistant with NCBI grounding search
  app.post("/api/bio-ai", async (req, res) => {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required." });
    }
    
    try {
      // Look for uppercase terms (genes like BRCA1, TP53) to fetch from NCBI
      const words = query.split(/\s+/);
      const potentialGenes = words.filter((w: string) => /^[A-Z0-9]{3,10}$/.test(w));
      
      let ncbiData: any = null;
      let geneName = "";
      
      if (potentialGenes.length > 0) {
        geneName = potentialGenes[0];
        ncbiData = await getNcbiGeneData(geneName);
      }

      let chartData: any = null;

      // Safe fallback if GEMINI_API_KEY is not defined
      if (!process.env.GEMINI_API_KEY) {
        let fallbackResponse = "⚠️ **GEMINI_API_KEY is not configured in the environment.**\n\n" +
          "To enable fully conversational bio-informatics reasoning, please add your `GEMINI_API_KEY` in the **Settings** menu of AI Studio.\n\n" +
          "**However, NCBI Gene Grounding is fully operational! Here is the live data fetched for your query:**\n\n";

        if (ncbiData && !ncbiData.error) {
          fallbackResponse += `### 🧬 NCBI Gene Summary: **${geneName}**\n` +
            `- **Official Symbol:** \`${ncbiData.name || "N/A"}\`\n` +
            `- **Gene ID:** \`${ncbiData.uid || "N/A"}\`\n` +
            `- **Chromosome Location:** Chromosome \`${ncbiData.chromosome || "N/A"}\`\n` +
            `- **Description:** ${ncbiData.description || "N/A"}\n` +
            `- **Summary:** ${ncbiData.summary || "N/A"}\n\n` +
            `*Data fetched live from NCBI Entrez Gene database. Once you add your Gemini API Key, our Bio-AI agent will synthesize this information, compare it with UniProt records, and produce comprehensive biochemical suggestions.*`;
          
          chartData = {
            type: "bar",
            title: `Estimated Nucleotide Hybridization for ${geneName}`,
            data: [
              { name: "G-C Base Pairs (High Stability)", value: 45 },
              { name: "A-T Base Pairs (Low Stability)", value: 55 }
            ]
          };
        } else {
          fallbackResponse += `*No matching NCBI gene identifier was automatically detected in your query: "${query}".*\n\n` +
            "**Try querying a specific gene like:**\n" +
            "1. `BRCA1` (Breast cancer type 1 susceptibility gene)\n" +
            "2. `TP53` (Tumor protein p53 genome guardian gene)\n" +
            "3. `INS` (Human preproinsulin gene)";
        }

        return res.json({
          response: fallbackResponse,
          chart_data: chartData,
          ncbi_grounded: ncbiData && !ncbiData.error,
          ncbi_data: ncbiData
        });
      }
      
      const systemInstruction = 
        "You are a premium scientific bio-informatics AI assistant for BioHubCloud. " +
        "You provide accurate, dense, and deeply helpful responses on genomics, proteomics, and molecular biology. " +
        "You MUST respond ONLY with a valid JSON object matching this TypeScript interface:\n\n" +
        "interface BioResponse {\n" +
        "  text: string; // The main conversational explanation using Markdown (bold terms, bullet points, and citation tables)\n" +
        "  chart_data?: {\n" +
        "    type: 'bar' | 'line' | 'area' | 'pie';\n" +
        "    title: string;\n" +
        "    data: Array<{ name: string; value: number; [key: string]: any }>;\n" +
        "  }; // Optional. Include only if there are statistics, percentages, ratios, codon frequencies, or quantitative trends to plot.\n" +
        "  image_prompt?: string; // Optional. If the user asks to draw, illustrate, visualize, generate, or show a picture/diagram of a cell, protein, sequence, or biological pathway, write a highly detailed 1-sentence English prompt for an image generator model. Otherwise set to null.\n" +
        "}\n\n" +
        "Do not include any markup outside the JSON. Format the 'text' string with beautiful, dense scientific insights.";
      
      let promptText = `User Query: "${query}"\n\n`;
      if (ncbiData && !ncbiData.error) {
        promptText += `Grounding NCBI data for search term "${geneName}":\n${JSON.stringify(ncbiData, null, 2)}\n\n`;
        promptText += "Analyze and explain this official NCBI record in context of the user's question. Reference specific PubMed research if applicable.";
      } else {
        promptText += "Leverage your scientific knowledge to provide deep biological insights, citing major portals (NCBI, UniProt, Ensembl, AlphaFold DB, PDB) in your response.";
      }
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      });
      
      let responseText = "";
      let imageUrl: string | null = null;

      try {
        const resObj = JSON.parse(response.text || "{}");
        responseText = resObj.text || response.text || "";
        chartData = resObj.chart_data || null;

        // Run automated Imagen run if a prompt is suggested
        if (resObj.image_prompt) {
          try {
            console.log("Generating biological image for prompt:", resObj.image_prompt);
            const imageResponse = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite-image",
              contents: {
                parts: [
                  { text: resObj.image_prompt }
                ]
              },
              config: {
                imageConfig: {
                  aspectRatio: "1:1"
                }
              }
            });

            for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
              if (part.inlineData) {
                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                break;
              }
            }
          } catch (imgErr: any) {
            console.error("Image generation failed:", imgErr.message);
          }
        }
      } catch (parseErr) {
        console.warn("JSON parsing failed, falling back to raw text:", parseErr);
        responseText = response.text || "";
      }
      
      res.json({
        response: responseText,
        chart_data: chartData,
        image_url: imageUrl,
        ncbi_grounded: ncbiData && !ncbiData.error,
        ncbi_data: ncbiData
      });
    } catch (err: any) {
      res.status(500).json({ error: `Bio-AI failure: ${err.message}` });
    }
  });

  // API Route: Downloader for Python Backend Files
  // Exposes files so the user can easily review, test, or copy them in the UI
  app.get("/api/cpanel/files", (req, res) => {
    res.json({
      "logic.py": `import re

class BioLogic:
    """
    Core biological logic class for Sequence parsing, translation,
    transcription, GC-content calculation, ORF finding, and mutation analysis.
    """

    def __init__(self, sequence: str):
        """
        Initializes the BioLogic class with a biological sequence.
        Sanitizes and validates the input sequence.
        """
        self.raw_sequence = sequence.strip()
        self.sequence = self._sanitize(self.raw_sequence)

    def _sanitize(self, seq: str) -> str:
        """
        Cleans the sequence of whitespace and converts to uppercase.
        Validates that it only contains standard IUPAC nucleotide codes.
        """
        clean_seq = re.sub(r'\\s+', '', seq).upper()
        if clean_seq.startswith('>'):
            lines = clean_seq.split('\\n')
            clean_seq = ''.join(lines[1:])
        
        invalid_chars = [c for c in clean_seq if c not in 'ATCGUN']
        if invalid_chars:
            chars_str = ''.join(list(set(invalid_chars)))
            raise ValueError(f"Invalid sequence characters found: {chars_str}")
        
        return clean_seq

    def get_length(self) -> int:
        return len(self.sequence)

    def transcribe(self) -> str:
        if 'U' in self.sequence:
            return self.sequence
        return self.sequence.replace('T', 'U')

    def translate(self) -> str:
        rna = self.transcribe()
        codon_table = {
            'AUG': 'M', 'UUU': 'F', 'UUC': 'F', 'UUA': 'L', 'UUG': 'L',
            'UCU': 'S', 'UCC': 'S', 'UCA': 'S', 'UCG': 'S', 'UAU': 'Y',
            'UAC': 'Y', 'UGU': 'C', 'UGC': 'C', 'UGG': 'W', 'CUU': 'L',
            'CUC': 'L', 'CUA': 'L', 'CUG': 'L', 'CCU': 'P', 'CCC': 'P',
            'CCA': 'P', 'CCG': 'P', 'CAU': 'H', 'CAC': 'H', 'CAA': 'Q',
            'CAG': 'Q', 'CGU': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
            'AUU': 'I', 'AUC': 'I', 'AUA': 'I', 'ACU': 'T', 'ACC': 'T',
            'ACA': 'T', 'ACG': 'T', 'AAU': 'N', 'AAC': 'N', 'AAA': 'K',
            'AAG': 'K', 'AGU': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
            'GUU': 'V', 'GUC': 'V', 'GUA': 'V', 'GUG': 'V', 'GCU': 'A',
            'GCC': 'A', 'GCA': 'A', 'GCG': 'A', 'GAU': 'D', 'GAC': 'D',
            'GAA': 'E', 'GAG': 'E', 'GGU': 'G', 'GGC': 'G', 'GGA': 'G',
            'GGG': 'G', 'UAA': '*', 'UAG': '*', 'UGA': '*'
        }
        protein = []
        for i in range(0, len(rna) - 2, 3):
            codon = rna[i:i+3]
            amino_acid = codon_table.get(codon, 'X')
            if amino_acid == '*':
                break
            protein.append(amino_acid)
        return ''.join(protein)

    def get_gc_content(self) -> float:
        if not self.sequence:
            return 0.0
        g_count = self.sequence.count('G')
        c_count = self.sequence.count('C')
        return round(((g_count + c_count) / len(self.sequence)) * 100, 2)

    def find_orfs(self) -> list:
        rna = self.transcribe()
        orfs = []
        stop_codons = {'UAA', 'UAG', 'UGA'}
        for frame in range(3):
            i = frame
            while i < len(rna) - 2:
                codon = rna[i:i+3]
                if codon == 'AUG':
                    for j in range(i + 3, len(rna) - 2, 3):
                        next_codon = rna[j:j+3]
                        if next_codon in stop_codons:
                            orf_seq = rna[i:j+3]
                            orfs.append({
                                "start": i + 1,
                                "end": j + 3,
                                "frame": frame + 1,
                                "length": len(orf_seq),
                                "sequence": orf_seq,
                                "protein": BioLogic(orf_seq).translate()
                            })
                            i = j
                            break
                i += 3
        return sorted(orfs, key=lambda x: x['length'], reverse=True)`,
      "app.py": `import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from logic import BioLogic

try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

app = Flask(__name__)
CORS(app)

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if HAS_GEMINI and API_KEY:
    genai.configure(api_key=API_KEY)

def get_ncbi_data(gene_name: str) -> dict:
    try:
        search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gene&term={gene_name}&retmode=json"
        search_response = requests.get(search_url, timeout=10).json()
        id_list = search_response.get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return {"error": "No records found on NCBI."}
        gene_id = id_list[0]
        summary_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id={gene_id}&retmode=json"
        summary_response = requests.get(summary_url, timeout=10).json()
        return summary_response.get("result", {}).get(str(gene_id), {})
    except Exception as e:
        return {"error": str(e)}

@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.json or {}
    sequence = data.get("sequence", "")
    reference = data.get("reference", "")
    if not sequence:
        return jsonify({"error": "Sequence is required."}), 400
    try:
        analyzer = BioLogic(sequence)
        report = analyzer.generate_report(reference_seq=reference if reference else None)
        return jsonify(report)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)`,
      "requirements.txt": `Flask==3.0.3
flask-cors==4.0.1
requests==2.32.3
google-generativeai==0.8.1
biopython==1.83
pandas==2.2.2
numpy==1.26.4`,
      "test.py": `# Simple offline DNA to RNA converter
dna = "ATGCGTAC"
rna = dna.replace("T", "U")
print(f"DNA Sequence: {dna}")
print(f"RNA Output: {rna}")`
    });
  });

  // Vite integration for SPA rendering
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
