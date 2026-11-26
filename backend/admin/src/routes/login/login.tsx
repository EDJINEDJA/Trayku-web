import { Button, Container, Input, Label, Text } from '@medusajs/ui';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useLogin, useMe } from '@/hooks/api/auth';
import logo from '@/assets/traiku-logo.svg';

export const Login = () => {
  const navigate = useNavigate();
  const login = useLogin();
  const me = useMe();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  if (me.data) return <Navigate to="/missions" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }).then(() => navigate('/missions', { replace: true })) });
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Container className="w-full max-w-[360px] p-6">
        <form onSubmit={submit} className="flex flex-col gap-y-4">
          <div>
            <img src={logo} alt="Traiku" className="mb-3 h-12 w-auto" />
            <Text size="small" className="text-ui-fg-subtle">
              Connectez-vous avec votre compte équipe.
            </Text>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="email" size="small">
              Email
            </Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="password" size="small">
              Mot de passe
            </Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {login.error && (
            <Text size="small" className="text-ui-fg-error">
              {login.error.message}
            </Text>
          )}
          <Button type="submit" isLoading={login.isPending}>
            Se connecter
          </Button>
        </form>
      </Container>
    </div>
  );
};
