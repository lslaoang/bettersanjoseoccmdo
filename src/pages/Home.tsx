import { Link } from 'react-router';
import { Phone, Users, MapPin, Wallet } from 'lucide-react';
import Hero from '../components/sections/Hero';
import Section from '../components/ui/Section';
import ServicesSection from '../components/home/ServicesSection';
import SEO from '../components/SEO';

const quick = [
  {
    to: '/hotlines',
    label: 'Hotlines',
    desc: 'Emergency numbers',
    Icon: Phone,
  },
  {
    to: '/officials',
    label: 'Officials',
    desc: 'Mayor, vice mayor, SB',
    Icon: Users,
  },
  {
    to: '/barangays',
    label: 'Barangays',
    desc: 'All 39 barangays',
    Icon: MapPin,
  },
  { to: '/budget', label: 'Budget', desc: 'Income and spending', Icon: Wallet },
];

const Home: React.FC = () => {
  return (
    <>
      <SEO title="Home" />
      <main className="flex-grow">
        <Hero />
        <Section>
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quick.map(({ to, label, desc, Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex flex-col gap-2 h-full border border-gray-200 border-t-4 border-t-primary-500 rounded-lg p-4 hover:bg-primary-50 transition-colors"
                >
                  <Icon className="h-6 w-6 text-primary-600" aria-hidden />
                  <span className="font-semibold text-gray-900">{label}</span>
                  <span className="text-sm text-gray-600">{desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
        <ServicesSection />
      </main>
    </>
  );
};

export default Home;
