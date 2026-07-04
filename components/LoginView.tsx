export default function LoginView({ loginFailed }: { loginFailed: boolean }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-wide">⚔️ Guerra</h1>
        <p className="mt-2 text-slate-400">Presença da guild nas guerras do WYD</p>
      </div>
      {loginFailed && (
        <p className="rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300">
          Falha no login. Tente novamente.
        </p>
      )}
      <a
        href="/api/auth/google"
        className="rounded-xl bg-white px-8 py-4 text-lg font-semibold text-slate-900 active:scale-95"
      >
        Entrar com Google
      </a>
    </main>
  );
}
