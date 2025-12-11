import { Sparkles, Zap } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-4">
          <div className="shine-border rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-2">
            <div className="rounded-xl bg-primary/10 p-2">
              <Zap className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Studio IA
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                <Sparkles className="h-3 w-3 text-amber-400" />
                Beta
              </span>
            </p>
            <h1 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
              TikTok Compiler
            </h1>
            <p className="text-xs text-muted-foreground">Des compilations verticales propulsées par l’IA</p>
          </div>
        </div>
        <div className="hidden items-center gap-3 text-sm text-muted-foreground md:flex">
          <div className="rounded-full border border-border/50 px-4 py-2 text-xs uppercase tracking-wide">
            Pipeline temps réel
          </div>
          <button className="rounded-full border border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary transition hover:border-primary/40 hover:text-primary/80">
            Journal live
          </button>
          <button className="rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/40 transition hover:opacity-90">
            Lancer l’atelier
          </button>
        </div>
      </div>
    </header>
  );
}
