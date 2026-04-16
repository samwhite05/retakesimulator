import { Suspense } from "react";
import ResultsPageContent from "./ResultsPageContent";

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border border-cyan border-t-transparent" />
          <p className="mt-4 text-text-muted text-xs font-mono tracking-widest">LOADING RESULTS...</p>
        </div>
      </main>
    }>
      <ResultsPageContent />
    </Suspense>
  );
}
