import { useRef, useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, ChevronDown, ChevronUp, BookOpen, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  readFileAsText,
  parseTextToLayers,
  type UploadedRulebookFile,
  type ParsedRulebookLayers,
} from '@/lib/rulebookParser';

const ACCEPTED = '.txt,.md,.pdf,.docx,.doc,.csv';

// ─── Layer display config ─────────────────────────────────────────────────────

interface LayerSection {
  key: keyof ParsedRulebookLayers;
  label: string;
  layer: 1 | 2 | 3;
  color: string;
  icon: React.ReactNode;
}

const LAYER_SECTIONS: LayerSection[] = [
  // Layer 1
  { key: 'communicationTones',    label: 'Communication Tones',      layer: 1, color: 'bg-[hsl(var(--status-sent-bg))] text-[hsl(var(--status-sent-fg))]',          icon: null },
  { key: 'approvedPhrases',       label: 'Approved Phrases',         layer: 1, color: 'bg-[hsl(var(--status-sent-bg))] text-[hsl(var(--status-sent-fg))]',          icon: null },
  { key: 'safeLanguageTemplates', label: 'Safe Language Templates',  layer: 1, color: 'bg-[hsl(var(--status-sent-bg))] text-[hsl(var(--status-sent-fg))]',          icon: null },
  // Layer 2
  { key: 'responsibilities',      label: 'Responsibilities',         layer: 2, color: 'bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-fg))]',  icon: null },
  { key: 'hardConstraints',       label: 'Hard Constraints',         layer: 2, color: 'bg-[hsl(var(--risk-flag-bg))] text-[hsl(var(--risk-flag))]',                 icon: null },
  { key: 'softGuidelines',        label: 'Soft Guidelines',          layer: 2, color: 'bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-fg))]',  icon: null },
  { key: 'requiredDisclaimers',   label: 'Required Disclaimers',     layer: 2, color: 'bg-[hsl(var(--status-needs-review-bg))] text-[hsl(var(--status-needs-review-fg))]', icon: null },
  // Layer 3
  { key: 'canDo',                 label: 'Can Do',                   layer: 3, color: 'bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-fg))]',  icon: null },
  { key: 'cannotDo',              label: 'Cannot Do',                layer: 3, color: 'bg-[hsl(var(--status-rejected-bg))] text-[hsl(var(--status-rejected-fg))]',  icon: null },
  { key: 'escalationTriggers',    label: 'Escalation Triggers',      layer: 3, color: 'bg-[hsl(var(--status-needs-review-bg))] text-[hsl(var(--status-needs-review-fg))]', icon: null },
];

const LAYER_META = {
  1: { label: 'Layer 1 · Communication Style',       color: 'bg-[hsl(var(--status-sent-bg))] text-[hsl(var(--status-sent-fg))]',         icon: <User className="w-3.5 h-3.5" /> },
  2: { label: 'Layer 2 · Institutional Policy',      color: 'bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-fg))]', icon: <BookOpen className="w-3.5 h-3.5" /> },
  3: { label: 'Layer 3 · Role & Responsibility',     color: 'bg-[hsl(var(--status-needs-review-bg))] text-[hsl(var(--status-needs-review-fg))]', icon: <Shield className="w-3.5 h-3.5" /> },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LayerBadge({ layer }: { layer: 1 | 2 | 3 }) {
  const m = LAYER_META[layer];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.color}`}>
      {m.icon} {m.label}
    </span>
  );
}

function ItemList({ items, badgeClass }: { items: string[]; badgeClass: string }) {
  if (!items.length) return <p className="text-xs text-muted-foreground italic">No items extracted</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className={`text-xs px-2 py-1 rounded-md ${badgeClass}`}>{item}</li>
      ))}
    </ul>
  );
}

function ParsedLayersView({ layers }: { layers: ParsedRulebookLayers }) {
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true, 2: false, 3: false });

  const groupedByLayer = ([1, 2, 3] as const).map(layerNum => ({
    layerNum,
    sections: LAYER_SECTIONS.filter(s => s.layer === layerNum),
  }));

  const totalItems = Object.values(layers).reduce((a, v) => a + v.length, 0);

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
        <span>{totalItems} items extracted across 3 intelligence layers</span>
      </div>

      {groupedByLayer.map(({ layerNum, sections }) => {
        const count = sections.reduce((a, s) => a + layers[s.key].length, 0);
        return (
          <Collapsible key={layerNum} open={open[layerNum]} onOpenChange={v => setOpen(p => ({ ...p, [layerNum]: v }))}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                <div className="flex items-center gap-2">
                  <LayerBadge layer={layerNum} />
                  <span className="text-xs text-muted-foreground">{count} item{count !== 1 ? 's' : ''}</span>
                </div>
                {open[layerNum] ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 space-y-3 px-1">
                {sections.map(sec => (
                  <div key={sec.key} className="space-y-1.5">
                    <h5 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide pl-1">{sec.label}</h5>
                    <ItemList items={layers[sec.key]} badgeClass={sec.color} />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function FileRow({
  file,
  onRemove,
}: {
  file: UploadedRulebookFile;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const kb = (file.size / 1024).toFixed(1);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-card">
        <FileText className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{kb} KB · {new Date(file.uploadedAt).toLocaleString()}</p>
        </div>

        {file.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
        {file.status === 'parsed' && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            View layers {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
        {file.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}

        <button onClick={() => onRemove(file.id)} className="text-muted-foreground hover:text-destructive shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {file.status === 'error' && (
        <div className="px-3 py-2 bg-[hsl(var(--risk-flag-bg))] text-xs text-[hsl(var(--risk-flag))]">
          {file.errorMessage}
        </div>
      )}

      {file.status === 'parsed' && expanded && (
        <div className="px-3 pb-3 border-t border-border bg-background">
          <ParsedLayersView layers={file.layers} />
        </div>
      )}
    </div>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => isAccepted(f));
    if (dropped.length) onFiles(dropped);
  }, [onFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(f => isAccepted(f));
    if (selected.length) onFiles(selected);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        cursor-pointer rounded-lg border-2 border-dashed transition-colors p-6
        flex flex-col items-center gap-2 text-center
        ${dragOver
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }
      `}
    >
      <Upload className="w-7 h-7 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">Drop rulebook files here</p>
        <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, TXT, MD — up to 20 MB each</p>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-1 pointer-events-none">
        Browse Files
      </Button>
      <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={handleChange} />
    </div>
  );
}

function isAccepted(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['txt', 'md', 'pdf', 'docx', 'doc', 'csv'].includes(ext || '');
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RulebookUploadProps {
  /** Called after a file is successfully parsed so the parent can merge extracted layers */
  onLayersExtracted?: (layers: ParsedRulebookLayers, fileName: string) => void;
}

export default function RulebookUpload({ onLayersExtracted }: RulebookUploadProps) {
  const [files, setFiles] = useState<UploadedRulebookFile[]>([]);

  const processFiles = async (incoming: File[]) => {
    const stubs: UploadedRulebookFile[] = incoming.map(f => ({
      id: `rbfile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedAt: new Date().toISOString(),
      layers: {} as ParsedRulebookLayers,
      rawText: '',
      status: 'processing',
    }));

    setFiles(prev => [...prev, ...stubs]);

    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      const stub = stubs[i];

      try {
        const rawText = await readFileAsText(file);
        const layers = parseTextToLayers(rawText);

        setFiles(prev => prev.map(f =>
          f.id === stub.id ? { ...f, rawText, layers, status: 'parsed' } : f
        ));

        onLayersExtracted?.(layers, file.name);
      } catch (err) {
        setFiles(prev => prev.map(f =>
          f.id === stub.id
            ? { ...f, status: 'error', errorMessage: (err as Error).message }
            : f
        ));
      }
    }
  };

  const remove = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const totalParsed = files.filter(f => f.status === 'parsed').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="w-4 h-4 text-primary" />
          Rulebook & Responsibility Layer Files
        </CardTitle>
        <CardDescription>
          Upload institutional rulebooks, policy documents, or staff responsibility guides.
          The system will automatically extract and map content to the three intelligence layers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Layer legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([1, 2, 3] as const).map(n => (
            <div key={n} className="flex items-start gap-2 p-2.5 rounded-md bg-muted/50">
              <div className={`mt-0.5 flex items-center gap-1 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${LAYER_META[n].color}`}>
                {LAYER_META[n].icon}
              </div>
              <div>
                <p className="text-xs font-semibold">{LAYER_META[n].label.split('·')[1]?.trim()}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {n === 1 && 'Tones, approved phrases, safe templates'}
                  {n === 2 && 'Policies, constraints, disclaimers'}
                  {n === 3 && 'Role scope, escalation triggers'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <DropZone onFiles={processFiles} />

        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Uploaded Files ({files.length})
              </h4>
              {totalParsed > 0 && (
                <Badge variant="outline" className="text-[10px] text-[hsl(var(--success))] border-[hsl(var(--success))/30]">
                  {totalParsed} parsed
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {files.map(f => (
                <FileRow key={f.id} file={f} onRemove={remove} />
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-[11px] text-muted-foreground p-3 bg-muted/40 rounded-md space-y-1">
          <p className="font-semibold text-foreground/60">Supported file types</p>
          <p>PDF, DOCX, TXT, Markdown, CSV — content is parsed client-side and never leaves your browser.</p>
          <p className="mt-1 font-semibold text-foreground/60">Tips for best extraction</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Use plain text or searchable PDFs (not scanned images)</li>
            <li>Include section headers like "Responsibilities", "Staff Cannot", "Escalate if…"</li>
            <li>One policy item per bullet point or line gives the best results</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
