/**
 * Umfrage abschließen — 3-Schritt-Wizard.
 * Steps: 1) Offene Umfrage wählen → 2) Finalen Termin aus den Terminvorschlägen wählen → 3) Prüfen & schließen.
 * Reads: umfragen, terminvorschlaege. Writes: umfragen (finaler_termin, status=geschlossen) via useUmfrageAbschliessenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldLookup } from '@/lib/journey';
import { useUmfrageAbschliessenFlow } from '@/lib/journey/flows/UmfrageAbschliessen';
import { tx } from '@/i18n';

function when(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy HH:mm');
  } catch {
    return iso;
  }
}

export default function UmfrageAbschliessenPage() {
  const [step, setStep] = useState(1);
  const flow = useUmfrageAbschliessenFlow({
    steps: { umfragen: 1, finaler_termin: 2 },
    items: {
      umfragen: u => ({
        id: u.id,
        title: fieldText(u, 'titel'),
        subtitle: fieldText(u, 'ort') || undefined,
        status: fieldLookup(u, 'status') ?? undefined,
      }),
      finaler_termin: t => ({
        id: t.id,
        title: tx`${when(fieldDate(t, 'beginn'))} Uhr`,
        subtitle: tx`bis ${when(fieldDate(t, 'ende'))} Uhr`,
      }),
    },
  });

  return (
    <IntentWizardShell
      title={tx('Umfrage abschließen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Lege den finalen Termin fest und schließe die Umfrage.'),
        needs: [tx('Eine offene Umfrage mit Terminvorschlägen')],
      }}
    >
      <WizardStep label={tx('Umfrage')} description={tx('Welche offene Umfrage möchtest du abschließen?')}>
        <EntitySelectStep
          {...flow.picks.umfragen.select}
          {...flow.pick('umfragen')}
          avatar="none"
          searchPlaceholder={tx('Titel suchen …')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Finaler Termin')}
        description={tx('Welcher Terminvorschlag dieser Umfrage soll gelten?')}
      >
        <EntitySelectStep
          {...flow.picks.finaler_termin.select}
          {...flow.pick('finaler_termin')}
          avatar="none"
          create={false}
          emptyText={tx('Diese Umfrage hat noch keine Terminvorschläge.')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Stimmt alles? Danach ist die Umfrage geschlossen.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Geschlossen') }]}
            whatHappensNext={tx('Die Umfrage wird geschlossen, niemand kann mehr abstimmen.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          undo={flow.undo}
          whatHappensNext={tx('Der finale Termin steht fest.')}
          next={[
            { label: tx('Umfrage mit Terminen anlegen'), href: '#/intents/umfrage-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
