import { redirect } from 'next/navigation';

export default function RootPage() {
  // Trigger the redirect to the login page
  redirect('/login'); // <--- Changed from '/home' to '/login'

  // Explicitly return null to satisfy Next.js's requirement
  // that a page component returns something renderable.
  // This line might not actually be reached if the redirect works correctly,
  // but it resolves the component structure error.
  return null;
}