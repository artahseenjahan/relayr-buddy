/**
 * rulebookParser.ts
 * Parses uploaded rulebook / responsibility layer files (PDF text, DOCX text, plain text)
 * and extracts structured layer data for all three intelligence layers.
 *
 * In an MVP this runs entirely client-side: the file is read as text,
 * then keyword-based heuristics map sentences/lines to the correct layer bucket.
 *
 * When a real LLM is integrated, replace `parseTextToLayers` with an API call.
 */

export interface ParsedRulebookLayers {
  // Layer 1 – Communication Style
  communicationTones: string[];        // tone descriptors extracted from the doc
  approvedPhrases: string[];           // signed-off phrases / institutional language
  safeLanguageTemplates: string[];     // response templates / form sentences

  // Layer 2 – Institutional Policy
  responsibilities: string[];          // what the office is responsible for
  hardConstraints: string[];           // must-never statements
  softGuidelines: string[];            // should/recommended statements
  requiredDisclaimers: string[];       // disclaimer sentences

  // Layer 3 – Role & Routing
  canDo: string[];                     // explicitly permitted actions
  cannotDo: string[];                  // out-of-scope / restricted actions
  escalationTriggers: string[];        // keywords that trigger escalation
}

export interface UploadedRulebookFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  layers: ParsedRulebookLayers;
  rawText: string;
  status: 'processing' | 'parsed' | 'error';
  errorMessage?: string;
}

// ─── Keyword buckets used by the heuristic parser ────────────────────────────

const HARD_CONSTRAINT_SIGNALS = [
  'must not', 'shall not', 'never', 'prohibited', 'forbidden',
  'under no circumstances', 'not permitted', 'strictly prohibited',
  'do not', 'cannot commit', 'cannot guarantee', 'not authorised',
];

const SOFT_GUIDELINE_SIGNALS = [
  'should', 'recommended', 'preferred', 'ideally', 'where possible',
  'it is advised', 'best practice', 'encourage', 'aim to',
];

const RESPONSIBILITY_SIGNALS = [
  'responsible for', 'handles', 'manages', 'oversees', 'coordinates',
  'processes', 'reviews', 'administers', 'provides', 'supports', 'maintains',
];

const DISCLAIMER_SIGNALS = [
  'disclaimer', 'note:', 'please note', 'important:', 'this email',
  'confidential', 'subject to change', 'for informational purposes',
];

const CAN_DO_SIGNALS = [
  'authorised to', 'permitted to', 'can assist', 'can provide',
  'may', 'is able to', 'staff can', 'office can', 'will help',
];

const CANNOT_DO_SIGNALS = [
  'cannot', 'not able to', 'outside the scope', 'not responsible',
  'refer to', 'please contact', 'escalate to', 'beyond our remit',
];

const ESCALATION_SIGNALS = [
  'legal', 'lawsuit', 'attorney', 'visa', 'immigration', 'fafsa',
  'discrimination', 'harassment', 'emergency', 'complaint', 'grievance',
  'disability', 'accommodation', 'ferpa', 'hipaa', 'financial hold',
  'overdue', 'suspension', 'expulsion', 'academic integrity', 'plagiarism',
];

const TONE_SIGNALS = [
  'formal', 'professional', 'warm', 'concise', 'friendly', 'empathetic',
  'neutral', 'direct', 'courteous', 'semi-formal', 'approachable',
];

const APPROVED_PHRASE_SIGNALS = [
  'approved language', 'approved phrase', 'institutional phrase',
  'use the following', 'standard response', 'boilerplate', 'template',
];

// ─── Core parser ──────────────────────────────────────────────────────────────

function classify(line: string): keyof ParsedRulebookLayers | null {
  const l = line.toLowerCase();

  if (HARD_CONSTRAINT_SIGNALS.some(s => l.includes(s))) return 'hardConstraints';
  if (DISCLAIMER_SIGNALS.some(s => l.includes(s))) return 'requiredDisclaimers';
  if (CANNOT_DO_SIGNALS.some(s => l.includes(s))) return 'cannotDo';
  if (CAN_DO_SIGNALS.some(s => l.includes(s))) return 'canDo';
  if (SOFT_GUIDELINE_SIGNALS.some(s => l.includes(s))) return 'softGuidelines';
  if (RESPONSIBILITY_SIGNALS.some(s => l.includes(s))) return 'responsibilities';
  if (APPROVED_PHRASE_SIGNALS.some(s => l.includes(s))) return 'approvedPhrases';
  if (TONE_SIGNALS.some(s => l.includes(s))) return 'communicationTones';

  // Escalation triggers: look for keyword matches → extract the keyword itself
  const matchedEscalation = ESCALATION_SIGNALS.find(s => l.includes(s));
  if (matchedEscalation) return 'escalationTriggers';

  return null;
}

export function parseTextToLayers(rawText: string): ParsedRulebookLayers {
  const layers: ParsedRulebookLayers = {
    communicationTones: [],
    approvedPhrases: [],
    safeLanguageTemplates: [],
    responsibilities: [],
    hardConstraints: [],
    softGuidelines: [],
    requiredDisclaimers: [],
    canDo: [],
    cannotDo: [],
    escalationTriggers: [],
  };

  // Split on newlines and common sentence terminators
  const lines = rawText
    .split(/\n|(?<=\.)\s+/)
    .map(l => l.replace(/^[\s\-•*–→▸]+/, '').trim())
    .filter(l => l.length > 10 && l.length < 400);

  const seen = new Set<string>();

  for (const line of lines) {
    const bucket = classify(line);
    if (!bucket) continue;

    const deduped = line.replace(/\s+/g, ' ');
    if (seen.has(deduped)) continue;
    seen.add(deduped);

    if (bucket === 'escalationTriggers') {
      // Extract the matched keyword, not the whole sentence
      for (const kw of ESCALATION_SIGNALS) {
        if (line.toLowerCase().includes(kw)) {
          const formatted = kw.charAt(0).toUpperCase() + kw.slice(1);
          if (!layers.escalationTriggers.includes(formatted)) {
            layers.escalationTriggers.push(formatted);
          }
        }
      }
    } else if (bucket === 'communicationTones') {
      // Extract just the tone word
      for (const tone of TONE_SIGNALS) {
        if (line.toLowerCase().includes(tone)) {
          const formatted = tone.charAt(0).toUpperCase() + tone.slice(1);
          if (!layers.communicationTones.includes(formatted)) {
            layers.communicationTones.push(formatted);
          }
        }
      }
    } else {
      (layers[bucket] as string[]).push(deduped);
    }
  }

  return layers;
}

// ─── File reading helpers ──────────────────────────────────────────────────────

export async function readFileAsText(file: File): Promise<string> {
  // For plain text / markdown / CSV files
  if (
    file.type.startsWith('text/') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.csv')
  ) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string || '');
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // For PDF: extract embedded text using a simple byte scan
  // (Real integration: use pdf.js or a backend endpoint)
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return readPdfAsText(file);
  }

  // For DOCX: read as arraybuffer and extract readable text between XML tags
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    return readDocxAsText(file);
  }

  // Fallback: try to read as plain text
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string || '');
    reader.onerror = () => reject(new Error('Unsupported file type'));
    reader.readAsText(file);
  });
}

async function readPdfAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target?.result as ArrayBuffer);
      // Extract text stream content from PDF bytes (heuristic)
      let text = '';
      let inStream = false;
      let buffer = '';

      for (let i = 0; i < bytes.length - 1; i++) {
        const ch = String.fromCharCode(bytes[i]);
        if (!inStream) {
          buffer += ch;
          if (buffer.endsWith('stream')) { inStream = true; buffer = ''; }
          if (buffer.length > 10) buffer = buffer.slice(-10);
        } else {
          if (ch === 'e' && bytes[i+1] === 110) { // 'en' of 'endstream'
            inStream = false;
          } else if (bytes[i] >= 32 && bytes[i] <= 126) {
            text += ch;
          } else {
            text += ' ';
          }
        }
      }
      // Clean up PDF operator noise
      text = text.replace(/[A-Z]{1,3}\s/g, ' ').replace(/\s+/g, ' ');
      resolve(text.length > 50 ? text : `PDF file: ${file.name}\nContent extraction requires server-side processing.`);
    };
    reader.readAsArrayBuffer(file);
  });
}

async function readDocxAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // DOCX is a zip; extract readable text between w:t XML tags
        const bytes = new Uint8Array(e.target?.result as ArrayBuffer);
        let xmlText = '';
        for (let i = 0; i < bytes.length; i++) {
          if (bytes[i] >= 32 && bytes[i] <= 126) {
            xmlText += String.fromCharCode(bytes[i]);
          } else {
            xmlText += ' ';
          }
        }
        // Extract text between <w:t> tags
        const matches = xmlText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
        const text = matches
          .map(m => m.replace(/<[^>]+>/g, ''))
          .join(' ');
        resolve(text.length > 50 ? text : `DOCX file: ${file.name}\nContent extraction requires server-side processing.`);
      } catch {
        resolve(`File: ${file.name}\nContent could not be extracted.`);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function summariseLayerCounts(layers: ParsedRulebookLayers): Record<string, number> {
  return Object.fromEntries(
    Object.entries(layers).map(([k, v]) => [k, (v as string[]).length])
  );
}
