import { useState } from 'react';
import { Link } from 'react-router';
import Section from '../components/ui/Section';
import { Heading } from '../components/ui/Heading';
import { Text } from '../components/ui/Text';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import SEO from '../components/SEO';
import barangays from '../../data/barangays.json';

const CATEGORIES = [
  ['officials', 'Officials (barangay captain, kagawad, SK, staff)'],
  ['hotlines', 'Hotlines and contact numbers'],
  ['services', 'Services and requirements (permits, certificates, fees)'],
  ['projects', 'Projects (roads, buildings, programs)'],
  ['ordinances', 'Ordinances and resolutions'],
  ['budget', 'Budget and financial documents'],
  ['places', 'Places, landmarks and photos'],
  ['events', 'Events and announcements'],
  ['correction', 'Correction to something on this site'],
  ['other', 'Other'],
] as const;

const SOURCES = [
  [
    'official_document',
    'Official document (memo, ordinance, budget, certificate)',
  ],
  ['official_posting', 'Official posting (LGU/barangay page, bulletin board)'],
  ['news', 'News report'],
  ['first_hand', 'I know this first-hand'],
  ['own_photo', 'Photo I took myself'],
  ['other', 'Other'],
] as const;

const RELATIONS = [
  ['resident', 'Resident'],
  ['barangay_official', 'Barangay official or staff'],
  ['lgu_employee', 'Municipal (LGU) employee'],
  ['visitor', 'Visitor'],
  ['other', 'Other'],
] as const;

const FILE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';
const MAX_FILES = 5;
const MAX_MB = 10;

type Upload = { url: string; fields: Record<string, string> };

const input =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';
const label = 'block font-medium text-gray-900';
const hint = 'text-sm text-gray-600 mt-1';

export default function Contribute() {
  const [scope, setScope] = useState<'barangay' | 'municipality'>('barangay');
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'sending'; msg: string }
    | { kind: 'done'; id: string }
    | { kind: 'error'; msg: string }
  >({ kind: 'idle' });

  const sortedBarangays = [...barangays.items].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { numeric: true })
  );

  function pickFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const tooBig = picked.find(f => f.size > MAX_MB * 1024 * 1024);
    if (picked.length > MAX_FILES)
      return setState({ kind: 'error', msg: `Up to ${MAX_FILES} files only.` });
    if (tooBig)
      return setState({
        kind: 'error',
        msg: `${tooBig.name} is over ${MAX_MB} MB.`,
      });
    setState({ kind: 'idle' });
    setFiles(picked);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      ...Object.fromEntries(fd.entries()),
      privacy_ok: fd.get('privacy_ok') === 'on',
      license_ok: fd.get('license_ok') === 'on',
      credit_ok: fd.get('credit_ok') === 'on',
      files: files.map(f => ({ name: f.name, type: f.type, size: f.size })),
    };
    delete (body as Record<string, unknown>).upload;
    setState({ kind: 'sending', msg: 'Sending your submission…' });
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || `Something went wrong (${res.status}).`);
      const uploads: Upload[] = data.uploads ?? [];
      for (let i = 0; i < uploads.length; i++) {
        setState({
          kind: 'sending',
          msg: `Uploading file ${i + 1} of ${uploads.length}…`,
        });
        const form = new FormData();
        Object.entries(uploads[i].fields).forEach(([k, v]) =>
          form.append(k, v)
        );
        form.append('file', files[i]);
        const up = await fetch(uploads[i].url, { method: 'POST', body: form });
        if (!up.ok)
          throw new Error(
            `Upload of ${files[i].name} failed. Your text was saved (reference ${data.id}); try sending the file again in a new submission.`
          );
      }
      setState({ kind: 'done', id: data.id });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setState({ kind: 'error', msg: (err as Error).message });
    }
  }

  if (state.kind === 'done')
    return (
      <main className="flex-grow">
        <SEO title="Thank you" />
        <Section>
          <Heading>Salamat! Thank you.</Heading>
          <Text className="text-gray-700">
            We received your submission. Reference: <strong>{state.id}</strong>
          </Text>
          <Text className="text-gray-700">
            A volunteer will check it against its source before anything is
            published. This usually takes a few days.
          </Text>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setFiles([]);
                setState({ kind: 'idle' });
              }}
              className="rounded-md bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700"
            >
              Send another
            </button>
            <Link
              to="/"
              className="rounded-md border border-gray-300 px-4 py-2 font-semibold"
            >
              Back to home
            </Link>
          </div>
        </Section>
      </main>
    );

  const sending = state.kind === 'sending';
  return (
    <main className="flex-grow">
      <SEO
        title="Contribute"
        description="Share information about San Jose or your barangay: officials, hotlines, services, projects, documents and photos."
      />
      <Section>
        <Breadcrumbs className="mb-6" />
        <Heading>Contribute information</Heading>
        <Text className="text-gray-700 max-w-2xl">
          Know something about San Jose or your barangay that isn't on this site
          yet, or spotted a mistake? Send it here. Every submission is checked
          by a volunteer before it's published, so please tell us where the
          information comes from.
        </Text>

        <form
          onSubmit={submit}
          className="mt-8 max-w-2xl space-y-8"
          noValidate={false}
        >
          {/* Honeypot: hidden from people, bots fill it in. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <fieldset className="space-y-4">
            <legend className="text-xl font-semibold mb-2">
              1. What is it about?
            </legend>
            <div className="flex gap-6">
              {(['barangay', 'municipality'] as const).map(v => (
                <label key={v} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="scope"
                    value={v}
                    checked={scope === v}
                    onChange={() => setScope(v)}
                  />
                  {v === 'barangay' ? 'A barangay' : 'The whole municipality'}
                </label>
              ))}
            </div>
            {scope === 'barangay' && (
              <div>
                <label htmlFor="barangay" className={label}>
                  Barangay
                </label>
                <select
                  id="barangay"
                  name="barangay_psgc"
                  required
                  className={input}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose a barangay
                  </option>
                  {sortedBarangays.map(b => (
                    <option key={b.psgc} value={b.psgc}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="category" className={label}>
                Category
              </label>
              <select
                id="category"
                name="category"
                required
                className={input}
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xl font-semibold mb-2">
              2. The information
            </legend>
            <div>
              <label htmlFor="title" className={label}>
                Short title
              </label>
              <input
                id="title"
                name="title"
                required
                maxLength={150}
                className={input}
                placeholder="e.g. Barangay Iling Proper officials 2023–2028"
              />
            </div>
            <div>
              <label htmlFor="details" className={label}>
                Details
              </label>
              <textarea
                id="details"
                name="details"
                required
                maxLength={5000}
                rows={7}
                className={input}
                placeholder="Write everything you know: names and positions, phone numbers, schedules, requirements, amounts…"
              />
              <p className={hint}>
                Please don't include anyone's private information (home address,
                personal phone number, ID numbers) unless it is already public
                in an official posting.
              </p>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xl font-semibold mb-2">
              3. Where is this from?
            </legend>
            <div>
              <label htmlFor="source_type" className={label}>
                How do you know this?
              </label>
              <select
                id="source_type"
                name="source_type"
                required
                className={input}
                defaultValue=""
              >
                <option value="" disabled>
                  Choose one
                </option>
                {SOURCES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="source_url" className={label}>
                Link to the source{' '}
                <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="source_url"
                name="source_url"
                type="url"
                maxLength={500}
                className={input}
                placeholder="https://facebook.com/… or a news article"
              />
            </div>
            <div>
              <label htmlFor="as_of" className={label}>
                When was this true?{' '}
                <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input id="as_of" name="as_of" type="date" className={input} />
              <p className={hint}>
                The date of the document, posting or photo.
              </p>
            </div>
            <div>
              <label htmlFor="upload" className={label}>
                Photos or documents{' '}
                <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="upload"
                name="upload"
                type="file"
                multiple
                accept={FILE_TYPES}
                onChange={e => pickFiles(e.target.files)}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:font-semibold file:text-primary-700"
              />
              <p className={hint}>
                Up to {MAX_FILES} files, {MAX_MB} MB each. JPG, PNG, WebP, HEIC
                or PDF. A photo of an official posting or document is the best
                proof.
              </p>
              {files.length > 0 && (
                <ul className="mt-2 text-sm text-gray-700 list-disc pl-5">
                  {files.map(f => (
                    <li key={f.name}>
                      {f.name} ({(f.size / 1024 / 1024).toFixed(1)} MB)
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {files.length > 0 && (
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="license_ok"
                  required
                  className="mt-1"
                />
                <span>
                  I took these photos or have the right to share these files.
                  Anyone recognizable in a photo agreed to it being shared. I
                  allow Better San Jose to publish them under{' '}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    CC BY 4.0
                  </a>
                  .
                </span>
              </label>
            )}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xl font-semibold mb-2">
              4. About you{' '}
              <span className="text-base font-normal text-gray-500">
                (all optional)
              </span>
            </legend>
            <div>
              <label htmlFor="submitter_name" className={label}>
                Name
              </label>
              <input
                id="submitter_name"
                name="submitter_name"
                maxLength={100}
                className={input}
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="submitter_contact" className={label}>
                Email or mobile number
              </label>
              <input
                id="submitter_contact"
                name="submitter_contact"
                maxLength={150}
                className={input}
              />
              <p className={hint}>
                Only so we can ask you a follow-up question. Never published.
              </p>
            </div>
            <div>
              <label htmlFor="relation" className={label}>
                You are a…
              </label>
              <select
                id="relation"
                name="relation"
                className={input}
                defaultValue="resident"
              >
                {RELATIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="credit_ok" className="mt-1" />
              <span>Credit me by name if this is published.</span>
            </label>
          </fieldset>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
            <p className="font-semibold text-gray-900">Privacy notice</p>
            <p>
              Better San Jose is run by volunteers and is not the municipal
              government. We collect what you type in this form, the files you
              attach, and a one-way hash of your network address (to stop spam).
              We use it only to check and publish information on this site. Your
              contact details are never published or shared. Files and
              submissions are kept privately until reviewed; anything we don't
              publish is deleted within 12 months.
            </p>
            <p>
              You can ask us to see or delete your submission at any time
              through the{' '}
              <a
                href="https://github.com/lslaoang/bettersanjoseoccmdo/issues"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                project page
              </a>
              , quoting your reference number (Data Privacy Act of 2012, RA
              10173).
            </p>
            <label className="flex items-start gap-2 pt-1 text-gray-900">
              <input
                type="checkbox"
                name="privacy_ok"
                required
                className="mt-1"
              />
              <span>I have read the privacy notice and agree.</span>
            </label>
          </div>

          {state.kind === 'error' && (
            <p
              role="alert"
              className="rounded-md bg-red-50 border border-red-200 p-3 text-red-800"
            >
              {state.msg}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="rounded-md bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {sending ? state.msg : 'Send for review'}
          </button>
        </form>
      </Section>
    </main>
  );
}
