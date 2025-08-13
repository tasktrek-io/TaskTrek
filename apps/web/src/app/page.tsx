export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Project Management</h1>
        <p className="mt-2 text-gray-600">Welcome. Please sign in.</p>
        <div className="mt-4 space-x-4">
          <a className="text-blue-600 underline" href="/auth/login">Login</a>
          <a className="text-blue-600 underline" href="/auth/register">Register</a>
        </div>
      </div>
    </main>
  );
}
