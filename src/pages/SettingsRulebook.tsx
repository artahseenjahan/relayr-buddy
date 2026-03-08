import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import RulebookUpload from '../components/RulebookUpload';
import { BookOpen, Shield, User, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { type ParsedRulebookLayers } from '@/lib/rulebookParser';

interface MergedEntry {
  fileName: string;
  layers: ParsedRulebookLayers;
  addedAt: string;
}

const LAYER_META = {
  1: { label: 'Layer 1 · Communication Style',  icon: <User className="w-3.5 h-3.5" />,     color: 'bg-[hsl(var(--status-sent-bg))] text-[hsl(var(--status-sent-fg))]' },
  2: { label: 'Layer 2 · Institutional Policy',  icon: <BookOpen className="w-3.5 h-3.5" />, color: 'bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-fg))]' },
  3: { label: 'Layer 3 · Role & Responsibility', icon: <Shield className="w-3.5 h-3.5" />,   color: 'bg-[hsl(var(--status-needs-review-bg))] text-[hsl(var(--status-needs-review-fg))]' },
} as const;

type LayerNum = 1 | 2 | 3;

const LAYER_KEYS: Record<LayerNum, (keyof ParsedRulebookLayers)[]> = {
  1: ['communicationTones', 'approvedPhrases', 'safeLanguageTemplates'],
  2: ['responsibilities', 'hardConstraints', 'softGuidelines', 'requiredDisclaimers'],
  3: ['canDo', 'cannotDo', 'escalationTriggers'],
};

const KEY_LABELS: Record<keyof ParsedRulebookLayers, string> = {
  communicationTones:    'Communication Tones',
  approvedPhrases:       'Approved Phrases',
  safeLanguageTemplates: 'Safe Language Templates',
  responsibilities:      'Responsibilities',
  hardConstraints:       'Hard Constraints',
  softGuidelines:        'Soft Guidelines',
  requiredDisclaimers:   'Required Disclaimers',
  canDo:                 'Can Do',
  cannotDo:              'Cannot Do',
  escalationTriggers:    'Escalation Triggers',
};

function mergeLayers(entries: MergedEntry[]): ParsedRulebookLayers {
  const merged: ParsedRulebookLayers = {
    communicationTones: [], approvedPhrases: [], safeLanguageTemplates: [],
    responsibilities: [], hardConstraints: [], softGuidelines: [], requiredDisclaimers: [],
    canDo: [], cannotDo: [], escalationTriggers: [],
  };
  const seen: Record<string, Set<string>> = {};
  for (const key of Object.keys(merged) as (keyof ParsedRulebookLayers)[]) seen[key] = new Set();

  for (const entry of entries) {
    for (const key of Object.keys(merged) as (keyof ParsedRulebookLayers)[]) {
      for (const item of entry.layers[key]) {
        if (!seen[key].has(item)) {
          (merged[key] as string[]).push(item);
          seen[key].add(item);
        }
      }
    }
  }
  return merged;
}

function MergedLayerPanel({ entries }: { entries: MergedEntry[] }) {
  const [open, setOpen] = useState<Record<LayerNum, boolean>>({ 1: true, 2: true, 3: true });
  const merged = mergeLayers(entries);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Merged Intelligence Layers
        </CardTitle>
        <CardDescription>All items extracted and deduplicated from uploaded files, organised by layer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {([1, 2, 3] as LayerNum[]).map(layerNum => {
          const keys = LAYER_KEYS[layerNum];
          const count = keys.reduce((a, k) => a + merged[k].length, 0);
          const meta = LAYER_META[layerNum];
          return (
            <Collapsible key={layerNum} open={open[layerNum]} onOpenChange={v => setOpen(p => ({ ...p, [layerNum]: v }))}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{count} item{count !== 1 ? 's' : ''}</span>
                  </div>
                  {open[layerNum] ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-3 px-1">
                  {keys.map(key => {
                    const items = merged[key];
                    return (
                      <div key={key}>
                        <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-1 pl-1">{KEY_LABELS[key]}</h5>
                        {items.length === 0
                          ? <p className="text-xs text-muted-foreground italic pl-1">No items extracted</p>
                          : (
                            <ul className="space-y-1">
                              {items.map((item, i) => (
                                <li key={i} className={`text-xs px-2 py-1 rounded-md ${meta.color}`}>{item}</li>
                              ))}
                            </ul>
                          )
                        }
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function SettingsRulebook() {
  const [entries, setEntries] = useState<MergedEntry[]>([]);

  const handleLayersExtracted = (layers: ParsedRulebookLayers, fileName: string) => {
    setEntries(prev => [
      ...prev,
      { fileName, layers, addedAt: new Date().toISOString() },
    ]);
  };

  const removeEntry = (fileName: string) => {
    setEntries(prev => prev.filter(e => e.fileName !== fileName));
  };

  const totalItems = entries.reduce((acc, e) =>
    acc + Object.values(e.layers).reduce((a, v) => a + v.length, 0), 0
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Rulebook & Responsibility Layers
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload institutional policy documents. The AI will parse and map content across all three intelligence layers automatically.
          </p>
        </div>

        {/* Upload card */}
        <RulebookUpload onLayersExtracted={handleLayersExtracted} />

        {/* Uploaded file list with remove */}
        {entries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Parsed Documents
                  <Badge variant="outline" className="text-xs">{entries.length}</Badge>
                </span>
                {totalItems > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">{totalItems} total items extracted</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {entries.map(e => (
                <div key={e.fileName} className="flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate font-medium">{e.fileName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {Object.values(e.layers).reduce((a, v) => a + v.length, 0)} items
                    </span>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeEntry(e.fileName)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Merged layer view */}
        {entries.length > 0 && <MergedLayerPanel entries={entries} />}

        {/* Empty state */}
        {entries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No documents uploaded yet</p>
            <p className="text-xs mt-1">Upload a rulebook or policy document above to get started</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
