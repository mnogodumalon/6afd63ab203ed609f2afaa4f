import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { LoadProblem } from '@/components/blocks/LoadProblem';
import { OptionVote } from '@/components/blocks/OptionVote';
import {
  loadPublicPagesConfig, getPublicRecord, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig, type PublicRecordResult,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import { VOTES, fieldLookup } from '@/lib/journey';
import type { JourneyRecord } from '@/lib/journey';
import { tx } from '@/i18n';

const SLUG = 'termin-abstimmen';

type Phase = 'loading' | 'problem' | 'invalid' | 'nolink' | 'ready';

export default function TerminAbstimmen() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [umfrage, setUmfrage] = useState<PublicRecordResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const linkedId = useMemo(() => {
    const q = window.location.hash.split('?')[1] ?? '';
    return new URLSearchParams(q).get('umfrage');
  }, []);

  useEffect(() => {
    let alive = true;
    setPhase('loading');
    (async () => {
      try {
        const c = await loadPublicPagesConfig(SLUG);
        const p = c?.pages[SLUG] ?? null;
        if (!alive) return;
        if (!c || !p) { setPhase('invalid'); return; }
        setCfg(c);
        setPage(p);
        if (!linkedId) { setPhase('nolink'); return; }
        const ep = p.endpoints?.find(e => e.op === 'list' && e.entity === 'umfragen');
        if (!ep) { setPhase('invalid'); return; }
        const rec = await getPublicRecord(c, p, ep.app_id, linkedId);
        if (!alive) return;
        setUmfrage(rec);
        setPhase('ready');
      } catch (e) {
        if (!alive) return;
        setPhase(e instanceof PageUnavailableError ? 'invalid' : 'problem');
      }
    })();
    return () => { alive = false; };
  }, [linkedId, attempt]);

  const port = useMemo(() => (cfg && page ? createPublicPort(cfg, page) : null), [cfg, page]);

  if (phase === 'loading') return <PublicShell loading />;
  if (phase === 'problem') {
    return (
      <PublicShell title={page?.title}>
        <LoadProblem onRetry={() => setAttempt(a => a + 1)} />
      </PublicShell>
    );
  }
  if (phase === 'nolink') {
    return (
      <PublicShell title={page?.title}>
        <p className="text-sm text-muted-foreground">
          {tx('Bitte öffne den Link oder QR-Code deiner Umfrage, um abzustimmen.')}
        </p>
      </PublicShell>
    );
  }
  if (phase === 'invalid' || !umfrage || !linkedId) {
    return (
      <PublicShell title={page?.title}>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link ist nicht mehr gültig. Bitte den aktuellen Link oder QR-Code verwenden.')}
        </p>
      </PublicShell>
    );
  }

  const f = umfrage.fields;
  const titel = (f.titel as string) ?? '';
  const beschreibung = (f.beschreibung as string) ?? '';
  const ort = (f.ort as string) ?? '';
  const closed = fieldLookup({ id: umfrage.id, fields: f, createdAt: null } as JourneyRecord, 'status')?.key === 'geschlossen';

  return (
    <PublicShell title={titel || page?.title} description={beschreibung || undefined} wide>
      <div className="space-y-4">
        {ort && (
          <p className="text-sm text-muted-foreground">{tx('Ort')}: {ort}</p>
        )}
        <OptionVote
          port={port}
          vote={VOTES[SLUG]}
          parentId={linkedId}
          draftKey={SLUG}
          closed={closed || undefined}
        />
      </div>
    </PublicShell>
  );
}
