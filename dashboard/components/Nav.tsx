import Link from 'next/link';

export default function Nav() {
  return (
    <nav style={{
      display: 'flex',
      gap: '1rem',
      maxWidth: 1100,
      margin: '0 auto',
      padding: '1rem 1.5rem 0.75rem',
      borderBottom: '1px solid var(--border)',
      fontSize: '0.9rem',
    }}>
      <Link href="/">Opportunities</Link>
      <Link href="/profile">Profile</Link>
      <Link href="/history">History</Link>
      <Link href="/status">Status</Link>
    </nav>
  );
}
