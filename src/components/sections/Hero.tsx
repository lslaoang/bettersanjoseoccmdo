import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';

export default function Hero() {
  const { t } = useTranslation();
  return (
    <div className="relative isolate overflow-hidden bg-primary-800 text-white">
      <img
        src="/photos/hero.webp"
        alt=""
        width={1200}
        height={675}
        fetchPriority="high"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/50 to-black/10" />
      <div className="container mx-auto px-4 py-16 md:py-28">
        <div className="max-w-xl animate-fade-in">
          <Text transform="uppercase">Welcome to</Text>
          <Heading>{import.meta.env.VITE_GOVERNMENT_NAME}</Heading>
          <Text>{t('hero.subtitle')}</Text>
          <Link
            to="/visit"
            className="inline-block mt-4 rounded-md bg-white px-4 py-2 font-semibold text-primary-800 hover:bg-primary-50"
          >
            Places to visit
          </Link>
        </div>
      </div>
      <a
        href="https://commons.wikimedia.org/wiki/File:Devils_Mountain,_San_Jose,_Mindoro.jpg"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-3 text-[11px] text-white/70 hover:text-white"
      >
        Photo: FroyAgta, CC BY-SA 4.0
      </a>
    </div>
  );
}
