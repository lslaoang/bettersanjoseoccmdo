import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import Section from '../components/ui/Section';
import { Heading } from '../components/ui/Heading';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import SEO from '../components/SEO';
import barangays from '../../data/barangays.json';

type History = { psgc: string; name: string; paragraphs: string[] };
type HistoryFile = {
  source: string;
  as_of: string;
  note: string;
  items: History[];
};

type Barangay = {
  psgc: string;
  name: string;
  population_2020: number;
  punong_barangay?: {
    name: string;
    source: string;
    as_of: string;
    needs_verification?: boolean;
  };
};

export default function BarangayDetail() {
  const { psgc } = useParams();
  const b = (barangays.items as Barangay[]).find(x => x.psgc === psgc);
  // Histories are ~90 KB of text: load them only on this page.
  const [hist, setHist] = useState<HistoryFile | null>(null);
  useEffect(() => {
    import('../../data/barangay-histories.json').then(m =>
      setHist(m.default as HistoryFile)
    );
  }, []);

  if (!b)
    return (
      <main className="flex-grow">
        <Section>
          <Heading>Barangay not found</Heading>
          <Link to="/barangays" className="underline text-primary-700">
            See all barangays
          </Link>
        </Section>
      </main>
    );

  const h = hist?.items.find(x => x.psgc === b.psgc);
  const pb = b.punong_barangay;
  return (
    <main className="flex-grow">
      <SEO
        title={`Barangay ${b.name}`}
        description={`Barangay ${b.name}, San Jose, Occidental Mindoro: punong barangay, population and history.`}
      />
      <Section>
        <Breadcrumbs className="mb-6" />
        <p className="text-sm font-medium uppercase tracking-wide text-primary-700">
          Barangay
        </p>
        <Heading>{b.name}</Heading>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-3xl">
          <div className="border border-gray-200 rounded-lg p-4">
            <dt className="text-sm text-gray-600">Punong Barangay</dt>
            <dd className="text-lg font-semibold">
              {pb ? (
                <a
                  href={pb.source}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {pb.name}
                </a>
              ) : (
                <Link
                  to="/contribute"
                  className="text-gray-500 underline font-normal text-base"
                >
                  Not yet known. Help us add it
                </Link>
              )}
            </dd>
            {pb && (
              <dd className="text-xs text-gray-500">
                {pb.needs_verification ? 'Unverified, ' : ''}as of {pb.as_of}
              </dd>
            )}
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <dt className="text-sm text-gray-600">Population (2020)</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {b.population_2020.toLocaleString('en-PH')}
            </dd>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <dt className="text-sm text-gray-600">PSGC code</dt>
            <dd className="text-lg font-semibold tabular-nums">{b.psgc}</dd>
          </div>
        </dl>

        <Heading level={2}>Brief history</Heading>
        {!hist ? (
          <p className="text-gray-500">Loading…</p>
        ) : h ? (
          <article className="max-w-3xl space-y-4 text-gray-800 leading-relaxed">
            {h.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
        ) : (
          <p className="text-gray-700 max-w-3xl">
            The municipality hasn't published a history for this barangay yet.
            Know its story?{' '}
            <Link to="/contribute" className="underline text-primary-700">
              Share it with a source
            </Link>
            .
          </p>
        )}

        {hist && h && (
          <aside className="mt-10 max-w-3xl border-t border-gray-200 pt-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-800">Reference</p>
            <p>
              Municipality of San Jose, Occidental Mindoro.{' '}
              <em>Barangays of San Jose, Occidental Mindoro</em> (Official
              Barangay Directory).{' '}
              <a
                href={hist.source}
                target="_blank"
                rel="noreferrer"
                className="underline break-all"
              >
                {hist.source}
              </a>
              . Retrieved {hist.as_of}.
            </p>
            <p className="mt-1">
              Text reproduced as published by the LGU. Works of the Philippine
              government are not subject to copyright (RA 8293, Sec. 176).
            </p>
          </aside>
        )}

        <p className="mt-10">
          <Link to="/barangays" className="underline text-primary-700">
            ← All barangays
          </Link>
        </p>
      </Section>
    </main>
  );
}
