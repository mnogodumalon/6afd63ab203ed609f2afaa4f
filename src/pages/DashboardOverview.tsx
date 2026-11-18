import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { IconPlus, IconTrophy, IconLock, IconCalendarEvent, IconMapPin, IconUsers, IconCircleCheck } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor, countOf, decided } from '@/config/plan';
import { extractRecordId } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss } from '@/lib/polish';
import { submissionsOf, topOne } from '@/lib/journey';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { RecordDoorLink } from '@/components/widgets/RecordDoorLink';
import { Button } from '@/components/ui/button';

type Filter = 'all' | 'open' | 'empty' | 'closed';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { umfragen, terminvorschlaege, antworten } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('open');

  const closeAction = (id: string) => flowActionFor('umfragen', 'status', id, 'geschlossen');

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'umfragen') return undefined;
      const go = closeAction(top.record.record_id);
      const isClosed = lookupKey(top.record.fields.status) === 'geschlossen';
      return go && !isClosed ? { label: tx('Finalen Termin festlegen & schließen'), onClick: go } : undefined;
    },
  });

  const cards = useMemo(() => {
    return [...umfragen]
      .sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? ''))
      .map(u => {
        const options = terminvorschlaege
          .filter(t => extractRecordId(t.fields.umfrage) === u.record_id)
          .sort((a, b) => (a.fields.beginn ?? '').localeCompare(b.fields.beginn ?? ''));
        const answers = antworten.filter(a => extractRecordId(a.fields.umfrage) === u.record_id);
        const votes = (optId: string, key: string) =>
          answers.filter(a => extractRecordId(a.fields.terminvorschlag) === optId && lookupKey(a.fields.antwort) === key).length;
        const top = topOne(
          options,
          [o => votes(o.record_id, 'ja'), o => votes(o.record_id, 'vielleicht')],
          o => o.fields.beginn,
        );
        const topYes = top ? votes(top.record_id, 'ja') : 0;
        const subs = submissionsOf(answers, { names: ['teilnehmer_vorname', 'teilnehmer_nachname'] }).length;
        const closed = lookupKey(u.fields.status) === 'geschlossen';
        const finalDone = decided('umfragen', 'finaler_termin', u.fields);
        const finalOpt = finalDone ? options.find(o => o.record_id === extractRecordId(u.fields.finaler_termin)) : undefined;
        return { u, options, votes, top: topYes > 0 ? top : null, topYes, subs, closed, finalOpt };
      });
  }, [umfragen, terminvorschlaege, antworten]);

  const openCards = cards.filter(c => !c.closed);
  const emptyCards = openCards.filter(c => c.subs === 0);
  const closedCards = cards.filter(c => c.closed);

  const shown = cards.filter(c =>
    filter === 'all' ? true : filter === 'open' ? !c.closed : filter === 'empty' ? !c.closed && c.subs === 0 : c.closed);

  const fmtRange = (s?: string, e?: string) => {
    if (!s) return '—';
    const loc = { locale: dateFnsLocale() };
    const sd = new Date(s);
    let out = format(sd, 'EE dd.MM.yyyy, HH:mm', loc);
    if (e) {
      const ed = new Date(e);
      out += format(sd, 'yyyy-MM-dd') === format(ed, 'yyyy-MM-dd') ? ` – ${format(ed, 'HH:mm')}` : ` – ${format(ed, 'dd.MM. HH:mm')}`;
    }
    return out;
  };

  const first = openCards[0]?.u.fields.titel;
  const context = cards.length === 0
    ? tx('Lege deine erste Umfrage an und verteile den Link.')
    : openCards.length === 0
      ? tx('Alle Umfragen sind abgeschlossen.')
      : emptyCards.length > 0
        ? tx`„${emptyCards[0].u.fields.titel ?? ''}“ wartet noch auf erste Antworten.`
        : tx`Zuletzt angelegt: „${first ?? ''}“ — ${countOf('antworten', openCards[0].subs, appLabel('antworten'))} bisher.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground">{context}</p>
        </div>
        {crud.umfragen.canWrite && (
          <Button onClick={() => crud.umfragen.openCreate({ status: 'offen' })}>
            <IconPlus size={16} className="shrink-0" />
            <span>{tx('Neue Umfrage')}</span>
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        kpis={
          cards.length > 0 ? (
            <StatStrip>
              <StatStripItem
                title={tx('Offene Umfragen')}
                value={openCards.length}
                icon={<IconCalendarEvent size={16} />}
                tone="primary"
                onClick={() => setFilter(f => (f === 'open' ? 'all' : 'open'))}
                active={filter === 'open'}
              />
              <StatStripItem
                title={tx('Ohne Antworten')}
                value={emptyCards.length}
                icon={<IconUsers size={16} />}
                tone={emptyCards.length > 0 ? 'warning' : 'default'}
                onClick={() => setFilter(f => (f === 'empty' ? 'all' : 'empty'))}
                active={filter === 'empty'}
              />
              <StatStripItem
                title={tx('Abgeschlossen')}
                value={closedCards.length}
                icon={<IconLock size={16} />}
                onClick={() => setFilter(f => (f === 'closed' ? 'all' : 'closed'))}
                active={filter === 'closed'}
              />
            </StatStrip>
          ) : undefined
        }
        primary={
          shown.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center space-y-3">
              <IconCalendarEvent size={48} className="mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                {cards.length === 0 ? tx('Noch keine Umfrage — starte mit deiner ersten Terminabstimmung.') : tx('In dieser Ansicht gibt es keine Umfragen.')}
              </p>
              {crud.umfragen.canWrite && (
                <Button onClick={() => crud.umfragen.openCreate({ status: 'offen' })}>{tx('Erste Umfrage anlegen')}</Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {shown.map(c => {
                const go = c.closed ? null : closeAction(c.u.record_id);
                return (
                  <div key={c.u.record_id} className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4">
                    <button type="button" className="min-w-0 text-left" onClick={() => crud.umfragen.openDetail(c.u)}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 truncate font-semibold">{c.u.fields.titel}</h3>
                        <span className={`shrink-0 text-xs font-medium ${c.closed ? 'text-muted-foreground' : 'text-emerald-600'}`}>
                          {c.u.fields.status?.label}
                        </span>
                      </div>
                      {c.u.fields.ort && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                          <IconMapPin size={14} className="shrink-0" />{c.u.fields.ort}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {countOf('antworten', c.subs, appLabel('antworten'))} · {countOf('terminvorschlaege', c.options.length, appLabel('terminvorschlaege'))}
                      </p>
                    </button>

                    {c.finalOpt ? (
                      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">
                        <IconCircleCheck size={16} className="mt-0.5 shrink-0" />
                        <span className="min-w-0">{tx('Final')}: <b>{fmtRange(c.finalOpt.fields.beginn, c.finalOpt.fields.ende)}</b></span>
                      </div>
                    ) : c.top ? (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
                        <IconTrophy size={16} className="mt-0.5 shrink-0" />
                        <span className="min-w-0">
                          {tx('Meiste Ja')}: <b>{fmtRange(c.top.fields.beginn, c.top.fields.ende)}</b>
                          <span> · {c.topYes} {tx('Ja')}</span>
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{tx('Noch keine Ja-Stimmen.')}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <RecordDoorLink page="termin-abstimmen" recordId={c.u.record_id} qr />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => crud.umfragen.openDetail(c.u)}>{tx('Antworten ansehen')}</Button>
                      {go && <Button size="sm" onClick={go}>{tx('Termin festlegen & schließen')}</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      />
      {crud.surfaces}
    </div>
  );
}
