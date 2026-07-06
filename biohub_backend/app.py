import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from logic import BioLogic

# We can import google.generativeai or google-genai
try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

app = Flask(__name__)
# Enable CORS for frontend integration
CORS(app)

# Configure Gemini if API key is present
API_KEY = os.environ.get("GEMINI_API_KEY", "")
if HAS_GEMINI and API_KEY:
    genai.configure(api_key=API_KEY)

def get_ncbi_data(gene_name: str) -> dict:
    """
    Queries NCBI E-utils database for details about a gene or sequence.
    """
    try:
        # Search for the gene
        search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gene&term={gene_name}&retmode=json"
        search_response = requests.get(search_url, timeout=10).json()
        id_list = search_response.get("esearchresult", {}).get("idlist", [])
        
        if not id_list:
            return {"error": "No records found on NCBI for the given gene."}
            
        # Summary for the top record
        gene_id = id_list[0]
        summary_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id={gene_id}&retmode=json"
        summary_response = requests.get(summary_url, timeout=10).json()
        
        return summary_response.get("result", {}).get(str(gene_id), {})
    except Exception as e:
        return {"error": f"NCBI fetch failed: {str(e)}"}

@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Endpoint for biological sequence analysis.
    Takes 'sequence' and optional 'reference' in JSON body.
    """
    data = request.json or {}
    sequence = data.get("sequence", "")
    reference = data.get("reference", "")
    
    if not sequence:
        return jsonify({"error": "Sequence input is required."}), 400
        
    try:
        analyzer = BioLogic(sequence)
        report = analyzer.generate_report(reference_seq=reference if reference else None)
        return jsonify(report)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route("/api/bio-ai", methods=["POST"])
def bio_ai():
    """
    Endpoint for Bio-AI chatbot assistant.
    Grounds Gemini with live NCBI search queries for biological accuracy.
    """
    data = request.json or {}
    user_query = data.get("query", "")
    
    if not user_query:
        return jsonify({"error": "Query is required."}), 400
        
    if not HAS_GEMINI or not API_KEY:
        return jsonify({
            "response": "Gemini AI is currently not configured on this Flask backend. Please set the GEMINI_API_KEY.",
            "sources": []
        })

    try:
        # Step 1: Detect gene or keywords from user query for NCBI database search
        # Simple heuristic: look for uppercase codes or specific words
        words = user_query.split()
        potential_genes = [w for w in words if w.isupper() and len(w) >= 2]
        ncbi_info = None
        gene_name = ""
        
        if potential_genes:
            gene_name = potential_genes[0]
            ncbi_info = get_ncbi_data(gene_name)
            
        # Step 2: Formulate prompt grounding with NCBI data
        system_instruction = (
            "You are a specialized biological and medical research AI assistant for BioHubCloud. "
            "You only provide verified, high-quality molecular biology insights. "
            "Always cite references, PubMed publications, or databases like GenBank/NCBI."
        )
        
        prompt = f"User asks: {user_query}\n\n"
        if ncbi_info and "error" not in ncbi_info:
            prompt += f"NCBI Grounding Data for gene '{gene_name}': {str(ncbi_info)}\n\n"
            prompt += "Incorporate the above official NCBI data in your answer. Provide references."
        else:
            prompt += "Use your scientific knowledge to answer thoroughly with references."
            
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={"temperature": 0.2}
        )
        response = model.generate_content(f"{system_instruction}\n\n{prompt}")
        
        return jsonify({
            "response": response.text,
            "ncbi_grounded": ncbi_info is not None and "error" not in ncbi_info,
            "ncbi_data": ncbi_info
        })
    except Exception as e:
        return jsonify({"error": f"AI Engine error: {str(e)}"}), 500

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "active", "backend": "BioHubCloud Python Logic Engine"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
