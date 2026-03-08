import React, { useState } from 'react';
import { IntelligenceReport } from '../lib/intelligenceEngine';
import {
  Brain, Shield, UserCheck, ChevronDown, ChevronUp,
  TrendingUp, BookOpen, AlertTriangle, CheckCircle2,
  ArrowRightCircle, Mic, Lock, Zap, ExternalLink
} from 'lucide-react';

interface Props {
  report: IntelligenceReport;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-7 text-right">{value}</span>
    </div>
  );
}

function LayerSection({
  icon, title, badge, badgeColor, defaultOpen, children
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 p-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-semibold flex-1">{title}</span>
        {badge && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}>
            {badge}
          </span>
        )}
        {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>
      {open && <div className="p-3 space-y-2.5 bg-card">{children}</div>}
    </div>
  );
}

function Pill({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'green' | 'amber' | 'red' | 'blue' }) {
  const styles = {
    default: 'bg-muted text-muted-foreground',
    green:   'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]',
    amber:   'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-foreground))]',
    red:     'bg-destructive/10 text-destructive',
    blue:    'bg-primary/10 text-primary',
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${styles[variant]}`}>
      {children}
    </span>
  );
}

export default function IntelligencePanel({ report }: Props) {
  const { layer1, layer2, layer3 } = report;

  const riskColor = layer3.reputationRisk === 'high' ? 'bg-destructive/10 text-destructive' :
    layer3.reputationRisk === 'medium' ? 'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-foreground))]' :
    'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]';

  const routingColor = layer3.routingDecision === 'handle'
    ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]'
    : layer3.routingDecision === 'escalate'
    ? 'bg-destructive/10 text-destructive'
    : 'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-foreground))]';

  return (
    <div className="space-y-2.5">
      {/* Routing Alert */}
      {layer3.routingDecision !== 'handle' && (
        <div className={`rounded-lg p-3 border flex items-start gap-2.5 ${
          layer3.routingDecision === 'escalate'
            ? 'bg-destructive/5 border-destructive/20'
            : 'bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning))/30]'
        }`}>
          <ArrowRightCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
            layer3.routingDecision === 'escalate' ? 'text-destructive' : 'text-[hsl(var(--warning))]'
          }`} />
          <div>
            <div className={`text-xs font-bold mb-0.5 ${
              layer3.routingDecision === 'escalate' ? 'text-destructive' : 'text-[hsl(var(--warning-foreground))]'
            }`}>
              {layer3.routingDecision === 'escalate' ? '⚡ Escalation Required' : '↗ Route to Another Department'}
            </div>
            <div className="text-xs text-muted-foreground">{layer3.routingNote}</div>
            {layer3.suggestedDepartment && (
              <div className="mt-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Suggested:</span>
                <span className="ml-1.5 text-xs font-semibold text-foreground">{layer3.suggestedDepartment}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Layer 1 */}
      <LayerSection
        icon={<Mic className="w-3.5 h-3.5" />}
        title="Layer 1 · Communication Style"
        badge={layer1.detectedStyle}
        badgeColor="bg-primary/10 text-primary"
        defaultOpen={true}
      >
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Recipient Adaptation
          </div>
          <Pill variant="blue">Adapted for: {layer1.recipientAdaptation}</Pill>
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Voice Metrics</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16 shrink-0">Formality</span>
              <ScoreBar value={layer1.formalityScore} color="bg-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16 shrink-0">Warmth</span>
              <ScoreBar value={layer1.warmthScore} color="bg-orange-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16 shrink-0">Conciseness</span>
              <ScoreBar value={layer1.conciseness} color="bg-purple-500" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Voice Sample</div>
          <div className="text-[10px] italic text-muted-foreground bg-muted rounded p-2 leading-relaxed">
            "{layer1.styleSample}"
          </div>
        </div>
      </LayerSection>

      {/* Layer 2 */}
      <LayerSection
        icon={<BookOpen className="w-3.5 h-3.5" />}
        title="Layer 2 · Policy Grounding"
        badge={`${layer2.complianceScore}% compliant`}
        badgeColor={layer2.complianceScore >= 80 ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]' : 'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-foreground))]'}
        defaultOpen={true}
      >
        {layer2.policiesApplied.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[hsl(var(--success))]" /> Policies Applied
            </div>
            <div className="space-y-1">
              {layer2.policiesApplied.map((p, i) => (
                <div key={i} className="text-[10px] flex items-start gap-1.5 text-foreground">
                  <span className="w-1 h-1 rounded-full bg-[hsl(var(--success))] mt-1 shrink-0" />
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}

        {layer2.constraintsEnforced.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Lock className="w-3 h-3 text-destructive" /> Constraints Enforced
            </div>
            <div className="space-y-1">
              {layer2.constraintsEnforced.map((c, i) => (
                <div key={i} className="text-[10px] flex items-start gap-1.5 text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-destructive mt-1 shrink-0" />
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {layer2.disclaimersTriggered.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">⚑ Disclaimers Injected</div>
            {layer2.disclaimersTriggered.map((d, i) => (
              <div key={i} className="text-[10px] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-foreground))] rounded p-1.5 leading-relaxed mt-1">
                {d}
              </div>
            ))}
          </div>
        )}

        {layer2.linksInjected.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Links Injected
            </div>
            {layer2.linksInjected.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer"
                className="text-[10px] text-primary flex items-center gap-1 hover:underline">
                <ExternalLink className="w-2.5 h-2.5" /> {l.label}
              </a>
            ))}
          </div>
        )}
      </LayerSection>

      {/* Layer 3 */}
      <LayerSection
        icon={<Shield className="w-3.5 h-3.5" />}
        title="Layer 3 · Role Authority"
        badge={layer3.routingDecision === 'handle' ? 'In Scope' : layer3.routingDecision === 'route' ? 'Reroute' : 'Escalate'}
        badgeColor={routingColor}
        defaultOpen={true}
      >
        <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
          {layer3.withinAuthority
            ? <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))] shrink-0 mt-0.5" />
            : <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
          }
          <div className="text-[10px] leading-relaxed">{layer3.authorityReason}</div>
        </div>

        {layer3.outOfScopeReason && (
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Out of Scope</div>
            <div className="text-[10px] text-muted-foreground bg-muted rounded p-1.5">{layer3.outOfScopeReason}</div>
          </div>
        )}

        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Reputation Risk
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${riskColor}`}>
              {layer3.reputationRisk} risk
            </span>
          </div>
          {layer3.reputationFactors.length > 0 && (
            <div className="space-y-1">
              {layer3.reputationFactors.map((f, i) => (
                <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0" /> {f}
                </div>
              ))}
            </div>
          )}
          {layer3.reputationFactors.length === 0 && (
            <div className="text-[10px] text-[hsl(var(--success))]">No reputation risk factors detected</div>
          )}
        </div>

        {layer3.escalationTriggerMatched.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trigger Keywords</div>
            <div className="flex flex-wrap gap-1">
              {layer3.escalationTriggerMatched.map(t => (
                <Pill key={t} variant="red">{t}</Pill>
              ))}
            </div>
          </div>
        )}
      </LayerSection>

      <div className="text-[10px] text-muted-foreground text-center pt-1 flex items-center justify-center gap-1">
        <Zap className="w-3 h-3 text-primary" />
        Intelligence report generated · {new Date(report.generatedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
