'use client';

type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  ok: boolean;
};

type Props = {
  videosCount: number;
  settings: {
    duration: string | number;
    includeSubtitles: boolean;
    autoDetect: boolean;
  };
  step: string;
  reviewComplete: boolean;
  captionReady: boolean;
};

export default function BestPracticesChecklist({
  videosCount,
  settings,
  step,
  reviewComplete,
  captionReady,
}: Props) {
  const durationSeconds = Number(settings.duration) || 30;
  const items: ChecklistItem[] = [
    {
      id: 'sources',
      label: 'Sources importées',
      description: 'Ajoute au moins un lien avant de lancer la compilation.',
      ok: videosCount > 0,
    },
    {
      id: 'duration',
      label: 'Durée optimisée',
      description: 'Les formats viraux durent entre 20 et 45s.',
      ok: durationSeconds >= 20 && durationSeconds <= 45,
    },
    {
      id: 'subtitles',
      label: 'Sous-titres activés',
      description: 'Les sous-titres boostent la rétention de ~25%.',
      ok: settings.includeSubtitles,
    },
    {
      id: 'review',
      label: 'Moments validés',
      description: 'Revois l’ordre et masque les clips trop faibles.',
      ok: reviewComplete,
    },
    {
      id: 'caption',
      label: 'Caption TikTok prête',
      description: 'Copy/paste la description proposée avec les hashtags.',
      ok: captionReady,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Best practices</p>
        <h3 className="text-lg font-semibold">Checklist viralité</h3>
        <p className="text-sm text-muted-foreground">
          Valide ces étapes pour maximiser le watchtime et le taux d’achèvement.
        </p>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm ${
              item.ok ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-border bg-muted/40'
            }`}
          >
            <span
              className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                item.ok
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-muted-foreground/20 text-muted-foreground'
              }`}
            >
              {item.ok ? 'OK' : '…'}
            </span>
            <div>
              <p className="font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
      {step !== 'preview' && (
        <p className="text-xs text-muted-foreground">
          Hints IA : active les sous-titres, vise 30s max et prévisualise avant d’exporter.
        </p>
      )}
    </div>
  );
}
