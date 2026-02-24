"use client";
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.push('/chat')
    })
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        background: '#111114',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.6)'
      }}>

        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: '14px', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px'
          }}>
            💬
          </div>
          <h1 style={{
            color: '#e5e5ea', fontSize: '22px',
            fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px'
          }}>
            Welcome back
          </h1>
          <p style={{ color: '#4a4a5a', fontSize: '14px', margin: 0 }}>
            Sign in to start chatting with your friends
          </p>
        </div>

        {/* Supabase Auth UI */}
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#6366f1',
                  brandAccent: '#8b5cf6',
                  inputBackground: 'rgba(255,255,255,0.05)',
                  inputBorder: 'rgba(255,255,255,0.08)',
                  inputText: '#e5e5ea',
                  inputPlaceholder: '#4a4a5a',
                }
              }
            }
          }}
          theme="dark"
          providers={[]}
        />

      </div>
    </div>
  )
}
