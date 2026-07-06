# ==============================================================================
# BioHubCloud - অফলাইন টেস্ট এবং প্র্যাকটিস স্ক্রিপ্ট (Offline Practice)
# এই ফাইলটি দিয়ে আপনি অফলাইনে DNA থেকে RNA এবং প্রোটিন ট্রান্সলেশন পরীক্ষা করতে পারেন।
# ==============================================================================

# ১. সহজ DNA টু RNA কনভার্টার (বেসিক টেস্ট)
print("--- বেসিক টেস্ট শুরু হচ্ছে ---")
dna = "ATGCGTAC"
rna = dna.replace("T", "U")
print(f"DNA Sequence: {dna}")
print(f"RNA Output: {rna}")
print("-----------------------------\n")

# ২. আমাদের logic.py এর BioLogic ক্লাস ব্যবহার করে অ্যাডভান্সড টেস্ট
print("--- BioLogic ক্লাস টেস্ট শুরু হচ্ছে ---")
try:
    from logic import BioLogic
    
    test_sequence = "ATGCGTACGTACGTACGTACGTAC"
    print(f"Test Sequence: {test_sequence}")
    
    # ক্লাস ইনিশিয়ালাইজেশন
    bio = BioLogic(test_sequence)
    
    # তথ্য গণনা
    length = bio.get_length()
    gc_percent = bio.get_gc_content()
    rna_transcription = bio.transcribe()
    protein_translation = bio.translate()
    orfs = bio.find_orfs()
    
    print(f"১. সিকোয়েন্সের দৈর্ঘ্য: {length}")
    print(f"২. GC-Content: {gc_percent}%")
    print(f"৩. RNA Transcription: {rna_transcription}")
    print(f"৪. Protein Translation: {protein_translation}")
    print(f"৫. প্রাপ্ত ORFs সংখ্যা: {len(orfs)}")
    if orfs:
        print(f"   সবচেয়ে বড় ORF: {orfs[0]}")
        
except ImportError:
    print("[সতর্কতা] logic.py ফাইলটি খুঁজে পাওয়া যায়নি। দয়া করে নিশ্চিত করুন এটি একই ফোল্ডারে আছে।")
except Exception as e:
    print(f"[ত্রুটি] কোনো সমস্যা হয়েছে: {str(e)}")

print("\n--- টেস্ট সমাপ্ত ---")
