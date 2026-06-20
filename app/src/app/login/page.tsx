'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CrtCabinet } from '@/components/crt/CrtCabinet';
import { GlassCard } from '@/components/crt/GlassCard';
import { CrtButton } from '@/components/crt/CrtButton';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/');
    }
  }, [session, router]);

  if (status === 'loading') {
    return (
      <CrtCabinet>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-[0.5rem] text-[rgba(255,223,0,0.5)] font-[family-name:var(--font-pixel)]">
            Carregando...
          </div>
        </div>
      </CrtCabinet>
    );
  }

  return (
    <CrtCabinet>
      <div className="w-full h-full flex">
        {/* Left side: pitch decoration */}
        <div className="hidden md:flex w-1/2 h-full relative overflow-hidden items-center justify-center">
          <div className="absolute inset-0 pitch-stripes opacity-30" />
          <div className="relative z-10 text-center px-8">
            <div className="text-4xl mb-3">⚽</div>
            <h1 className="text-[0.9rem] gold-glow-text font-[family-name:var(--font-pixel)] leading-relaxed">
              FALA MESTRE!
            </h1>
            <p className="text-[0.5rem] text-[#55e0a0] font-[family-name:var(--font-pixel)] mt-2">
              O JOGO DE FUTEBOL COM IA
            </p>
          </div>
        </div>

        {/* Right side: auth card */}
        <div className="flex-1 flex items-center justify-center p-4">
          <GlassCard strong className="w-full max-w-xs p-5">
            {/* Logo for mobile */}
            <div className="md:hidden text-center mb-4">
              <div className="text-3xl mb-2">⚽</div>
              <h1 className="text-[0.7rem] gold-glow-text font-[family-name:var(--font-pixel)]">
                FALA MESTRE!
              </h1>
            </div>

            <h2 className="text-[0.6rem] gold-glow-text font-[family-name:var(--font-pixel)] text-center mb-4">
              BEM-VINDO!
            </h2>

            <CrtButton
              variant="outline"
              className="w-full py-2.5 text-xs flex items-center justify-center gap-2"
              onClick={() => signIn('google', { callbackUrl: '/' })}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              ENTRAR COM GOOGLE
            </CrtButton>

            <p className="text-[0.5rem] text-[rgba(255,223,0,0.3)] font-[family-name:var(--font-pixel)] text-center mt-3">
              Ao entrar, você concorda com nossos Termos de Serviço
            </p>

            <p className="text-[0.5rem] text-[rgba(255,223,0,0.25)] font-[family-name:var(--font-pixel)] text-center mt-2">
              v0.9.0
            </p>
          </GlassCard>
        </div>
      </div>
    </CrtCabinet>
  );
}
