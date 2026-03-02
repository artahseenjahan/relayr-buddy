import React from 'react';
import { GraduationCap } from 'lucide-react';

interface Props {
  step: number;
  totalSteps: number;
  title: string;
  children: React.ReactNode;
}

export default function OnboardingLayout({ step, totalSteps, title, children }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(220,20%,97%)] to-[hsl(221,83%,96%)] py-10">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <GraduationCap className="w-6 h-6 text-primary" />
            <span className="font-bold text-foreground">CampusReply</span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i < step ? 'w-8 bg-primary' : i === step - 1 ? 'w-8 bg-primary' : 'w-4 bg-border'
                }`}
              />
            ))}
          </div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">Step {step} of {totalSteps}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
