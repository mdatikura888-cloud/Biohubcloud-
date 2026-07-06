export interface ORF {
  start: number;
  end: number;
  frame: number;
  length: number;
  sequence: string;
  protein: string;
}

export interface Mutation {
  position: number;
  type: "substitution" | "insertion" | "deletion";
  ref: string;
  query: string;
  description: string;
}

export interface MutationReport {
  mismatch_count: number;
  total_mutations: number;
  mutations: Mutation[];
  alignment_similarity_percentage: number;
}

export interface SequenceAnalysisReport {
  sequence_length: number;
  gc_content: string;
  transcription: string;
  protein: string;
  orfs: ORF[];
  mutation_report?: MutationReport;
}

export interface SavedSequence {
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

export interface ChatSession {
  id?: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt?: any;
  updatedAt?: any;
}

export interface BackendFilesResponse {
  "logic.py": string;
  "app.py": string;
  "requirements.txt": string;
  "test.py": string;
}
