// Pages backed by /data/*.json. Every record renders its source and as-of date.
import { Phone, TriangleAlert } from 'lucide-react';
import Section from '../components/ui/Section';
import { Heading } from '../components/ui/Heading';
import { Text } from '../components/ui/Text';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import SEO from '../components/SEO';
import hotlines from '../../data/hotlines.json';
import officials from '../../data/officials.json';
import barangays from '../../data/barangays.json';
import budget from '../../data/budget.json';
import attractions from '../../data/attractions.json';

type Prov = { source?: string; as_of?: string; needs_verification?: boolean };
type DataFile<T> = { source: string; as_of: string; items: (T & Prov)[] };

function Source({ item, file }: { item: Prov; file: Prov }) {
  const src = item.source || file.source || '';
  const asOf = item.as_of || file.as_of;
  return (
    <p className="text-xs text-gray-600 mt-2">
      {item.needs_verification && (
        <span className="inline-flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded bg-warning-100 text-warning-900 font-medium">
          <TriangleAlert className="h-3 w-3" aria-hidden /> Needs verification
        </span>
      )}
      Source:{' '}
      {src.startsWith('http') ? (
        <a href={src} className="underline" target="_blank" rel="noreferrer">
          {new URL(src).hostname}
        </a>
      ) : (
        src
      )}{' '}
      · as of {asOf}
    </p>
  );
}

function Page({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-grow">
      <SEO title={title} description={intro} />
      <Section>
        <Breadcrumbs className="mb-6" />
        <Heading>{title}</Heading>
        <Text className="text-gray-700 mb-8">{intro}</Text>
        {children}
      </Section>
    </main>
  );
}

const card = 'border border-gray-200 rounded-lg p-4';

export function Hotlines() {
  const f = hotlines as DataFile<{
    agency: string;
    numbers: string[];
    category: string;
  }>;
  return (
    <Page
      title="Hotlines"
      intro="Emergency and public service numbers. Local San Jose numbers (MDRRMO, PNP, BFP, hospital, OMECO) are being verified and will be added here."
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {f.items.map(h => (
          <li key={h.agency} className={card}>
            <p className="font-semibold">{h.agency}</p>
            {h.numbers.map(n => (
              <a
                key={n}
                href={`tel:${n}`}
                className="inline-flex items-center gap-2 text-2xl font-bold text-primary-700 mr-4"
              >
                <Phone className="h-5 w-5" aria-hidden /> {n}
              </a>
            ))}
            <Source item={h} file={f} />
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function Officials() {
  const f = officials as DataFile<{ name: string; position: string }>;
  return (
    <Page
      title="Municipal Officials"
      intro="Elected officials of the Municipality of San Jose. Sangguniang Bayan members and department heads will be added once verified."
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {f.items.map(o => (
          <li key={o.position} className={card}>
            <p className="text-sm text-gray-600">{o.position}</p>
            <p className="text-xl font-semibold">{o.name}</p>
            <Source item={o} file={f} />
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function Barangays() {
  const f = barangays as DataFile<{ psgc: string; name: string }>;
  return (
    <Page
      title={`Barangays (${f.items.length})`}
      intro="All barangays of San Jose with their official PSGC codes."
    >
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[...f.items]
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
          .map(b => (
            <li key={b.psgc} className="flex justify-between border-b py-2">
              <span>{b.name}</span>
              <span className="text-gray-500 text-sm tabular-nums">
                {b.psgc}
              </span>
            </li>
          ))}
      </ul>
      <Source item={{}} file={f} />
    </Page>
  );
}

type Photo = {
  src: string;
  width: number;
  height: number;
  author: string;
  license: string;
  license_url: string;
  page: string;
};

export function PhotoCredit({ photo }: { photo: Photo }) {
  return (
    <p className="text-[11px] text-gray-500 mt-1">
      Photo:{' '}
      <a
        href={photo.page}
        className="underline"
        target="_blank"
        rel="noreferrer"
      >
        {photo.author}
      </a>
      ,{' '}
      {photo.license_url ? (
        <a
          href={photo.license_url}
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          {photo.license}
        </a>
      ) : (
        photo.license
      )}
    </p>
  );
}

export function Attractions() {
  const f = attractions as DataFile<{
    slug: string;
    name: string;
    kind: string;
    description: string;
    photo: Photo;
  }>;
  return (
    <Page
      title="Places to visit"
      intro="Islands, heritage sites and landmarks around San Jose. Photos are from Wikimedia Commons, credited under each one."
    >
      <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {f.items.map(a => (
          <li key={a.slug} id={a.slug}>
            <img
              src={a.photo.src}
              width={a.photo.width}
              height={a.photo.height}
              alt={a.name}
              loading="lazy"
              decoding="async"
              className="w-full aspect-[4/3] object-cover rounded-lg bg-gray-100"
            />
            <PhotoCredit photo={a.photo} />
            <p className="text-xs font-medium uppercase tracking-wide text-primary-700 mt-3">
              {a.kind}
            </p>
            <h2 className="text-lg font-semibold text-gray-900">{a.name}</h2>
            <p className="text-gray-700 mt-1">{a.description}</p>
          </li>
        ))}
      </ul>
      <Source item={{}} file={f} />
    </Page>
  );
}

const peso = (centavos: number) =>
  (centavos / 100).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumSignificantDigits: 4,
  });

export function Budget() {
  const f = budget as DataFile<{
    year: number;
    revenue_centavos: number;
    expenditure_centavos: number;
    assets_centavos: number;
    liabilities_centavos: number;
  }>;
  return (
    <Page
      title="Budget and Finances"
      intro="Municipal income and spending by year. Detailed budget documents (Full Disclosure Policy and COA reports) will be linked here."
    >
      {f.items.map(y => (
        <div key={y.year} className={`${card} mb-6`}>
          <Heading level={3}>{y.year}</Heading>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(
              [
                ['Revenue', y.revenue_centavos],
                ['Expenditure', y.expenditure_centavos],
                ['Assets', y.assets_centavos],
                ['Liabilities', y.liabilities_centavos],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <dt className="text-sm text-gray-600">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{peso(v)}</dd>
              </div>
            ))}
          </dl>
          <Source item={y} file={f} />
        </div>
      ))}
    </Page>
  );
}
