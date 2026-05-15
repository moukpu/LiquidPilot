export default function Topbar() {
  return (
    <header className="h-16 border-b border-border bg-card flex items-center px-6 justify-between">
      <span className="text-sm text-muted-foreground">Dashboard</span>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
          LP
        </div>
      </div>
    </header>
  );
}
