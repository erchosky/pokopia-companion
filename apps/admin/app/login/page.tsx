import { Badge, Card, PageIntro } from '@pokopia/ui';
import { login, verifyMfa } from './actions';
type Props = { searchParams: Promise<{ error?: string; step?: string }> };
export default async function LoginPage({ searchParams }: Props) {
  const { error, step } = await searchParams;
  const hosted = process.env.POKOPIA_ADMIN_AUTH_MODE === 'supabase';
  return (
    <main>
      <PageIntro eyebrow="Acceso privado" title="Pokopia Data Admin">
        <p>
          {hosted
            ? 'El acceso alojado exige identidad individual autorizada y un segundo factor TOTP.'
            : 'El acceso local usa una cookie HttpOnly firmada. Este modo no está permitido en staging o producción.'}
        </p>
      </PageIntro>
      <Card>
        <Badge tone="warn">Autorización requerida</Badge>
        <h2>Iniciar sesión</h2>
        {error === 'setup' ? (
          <p role="alert">Configura POKOPIA_ADMIN_PASSWORD y POKOPIA_ADMIN_SESSION_SECRET.</p>
        ) : null}
        {error === 'invalid' ? <p role="alert">Contraseña incorrecta.</p> : null}
        {error === 'mfa-required' ? (
          <p role="alert">Esta identidad no tiene un factor TOTP verificado.</p>
        ) : null}
        {step === 'mfa' ? (
          <form action={verifyMfa} className="search-form">
            <label htmlFor="code">Código de autenticación</label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
            <button type="submit">Verificar MFA</button>
          </form>
        ) : (
          <form action={login} className="search-form">
            {hosted ? (
              <>
                <label htmlFor="email">Correo del administrador</label>
                <input id="email" name="email" type="email" autoComplete="username" required />
              </>
            ) : null}
            <label className="sr-only" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <button type="submit">Entrar</button>
          </form>
        )}
      </Card>
    </main>
  );
}
