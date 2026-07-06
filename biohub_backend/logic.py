import re

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
        # Remove whitespace, numbers, header lines (if any)
        clean_seq = re.sub(r'\s+', '', seq).upper()
        # Remove FASTA header if passed accidentally
        if clean_seq.startswith('>'):
            lines = clean_seq.split('\n')
            clean_seq = ''.join(lines[1:])
        
        # Validate characters: A, T, C, G, U, N (unknown) are allowed
        invalid_chars = [c for c in clean_seq if c not in 'ATCGUN']
        if invalid_chars:
            chars_str = ''.join(list(set(invalid_chars)))
            raise ValueError(f"Invalid sequence characters found: {chars_str}")
        
        return clean_seq

    def get_length(self) -> int:
        """Returns the length of the sanitized sequence."""
        return len(self.sequence)

    def transcribe(self) -> str:
        """
        Transcribes a DNA sequence into an RNA sequence.
        If sequence contains U, assumes it's already RNA.
        """
        if 'U' in self.sequence:
            return self.sequence
        return self.sequence.replace('T', 'U')

    def translate(self) -> str:
        """
        Translates RNA/DNA sequence into protein sequence.
        Uses standard genetic code table.
        """
        # Ensure we translate from RNA
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
                break # Stop codon reached
            protein.append(amino_acid)
        return ''.join(protein)

    def get_gc_content(self) -> float:
        """
        Calculates the GC-Content percentage of the sequence.
        """
        if not self.sequence:
            return 0.0
        g_count = self.sequence.count('G')
        c_count = self.sequence.count('C')
        return round(((g_count + c_count) / len(self.sequence)) * 100, 2)

    def find_orfs(self) -> list:
        """
        Finds Open Reading Frames (ORFs) starting with AUG and ending
        with stop codons (UAA, UAG, UGA) in all 3 forward reading frames.
        Returns a list of dicts with start, end, frame, and sequence.
        """
        rna = self.transcribe()
        orfs = []
        stop_codons = {'UAA', 'UAG', 'UGA'}
        
        for frame in range(3):
            i = frame
            while i < len(rna) - 2:
                codon = rna[i:i+3]
                if codon == 'AUG':
                    # Start of ORF
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
                            i = j # Move forward
                            break
                i += 3
        return sorted(orfs, key=lambda x: x['length'], reverse=True)

    def detect_mutations(self, reference_seq: str) -> dict:
        """
        Compares the current sequence against a reference sequence.
        Detects point mutations (substitution, insertion, deletion).
        """
        ref = self._sanitize(reference_seq)
        query = self.sequence
        
        mutations = []
        mismatches = 0
        
        min_len = min(len(ref), len(query))
        for idx in range(min_len):
            if ref[idx] != query[idx]:
                mutations.append({
                    "position": idx + 1,
                    "type": "substitution",
                    "ref": ref[idx],
                    "query": query[idx],
                    "description": f"Substitution: {ref[idx]} -> {query[idx]} at position {idx + 1}"
                })
                mismatches += 1
                
        # Handle length discrepancies
        if len(query) > len(ref):
            for idx in range(min_len, len(query)):
                mutations.append({
                    "position": idx + 1,
                    "type": "insertion",
                    "ref": "-",
                    "query": query[idx],
                    "description": f"Insertion: {query[idx]} at position {idx + 1}"
                })
        elif len(ref) > len(query):
            for idx in range(min_len, len(ref)):
                mutations.append({
                    "position": idx + 1,
                    "type": "deletion",
                    "ref": ref[idx],
                    "query": "-",
                    "description": f"Deletion of {ref[idx]} at position {idx + 1}"
                })

        alignment_score = round((1 - (mismatches / max(1, min_len))) * 100, 2) if min_len > 0 else 0
        
        return {
            "mismatch_count": mismatches,
            "total_mutations": len(mutations),
            "mutations": mutations[:50],  # Limit to top 50 mutations for report size
            "alignment_similarity_percentage": alignment_score
        }

    def generate_report(self, reference_seq: str = None) -> dict:
        """
        Generates a comprehensive analysis report in JSON format.
        """
        report = {
            "sequence_length": self.get_length(),
            "gc_content": f"{self.get_gc_content()}%",
            "transcription": self.transcribe()[:1000],  # Truncated preview if huge
            "protein": self.translate()[:1000],
            "orfs": self.find_orfs()[:10]  # Top 10 longest ORFs
        }
        
        if reference_seq:
            report["mutation_report"] = self.detect_mutations(reference_seq)
            
        return report
