'use client'

import { useEffect, useState } from 'react'
import ZeyinLogo from './ZeyinLogo'

const TITLE_GRADIENT: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1ec8c8, #fff, #e8206e)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

function TypewriterTitle({ text, className }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, 75)
    return () => clearInterval(interval)
  }, [text])

  return (
    <>
      <style>{`@keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      <div className={className} style={TITLE_GRADIENT}>
        {displayed}
        {displayed.length < text.length && (
          <span style={{ WebkitTextFillColor: '#1ec8c8', animation: 'cursorBlink 0.6s step-end infinite' }}>|</span>
        )}
      </div>
    </>
  )
}

const LETTER_STYLE: React.CSSProperties = {
  display: 'inline-block',
  background: 'linear-gradient(90deg, #1ec8c8, #e8206e, #f47920, #e8206e, #1ec8c8)',
  backgroundSize: '250% auto',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

function AnimatedTitle({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {Array.from(text).map((char, i) => (
        <span key={i} style={{
          ...LETTER_STYLE,
          animation: `letterBounce 3s linear ${i * 60}ms infinite, titleShimmer 3s ease-in-out infinite`,
        }}>
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </div>
  )
}

export default function OlympiadHeader({
  animated = false,
  typewriter = false,
  title,
  banner,
}: {
  animated?: boolean
  typewriter?: boolean
  title?: string
  banner?: string
}) {
  const text = title ?? 'ZEYIN-ZOOTOPIA OLIMPYAD'

  if (banner) {
    return (
      <div className="flex flex-col items-center border-b border-zeyin-border"
        style={{ background: 'linear-gradient(180deg, #061a1a 0%, transparent 100%)' }}>

        {/* Banner image */}
        <img
          src={banner}
          alt="ZEYIN Olimpyad"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />

        {/* Olympiad name */}
        {animated && (
          <style>{`
            @keyframes titleShimmer {
              0%   { background-position: 0% 50%; }
              50%  { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes letterBounce {
              0%   { transform: translateY(0); animation-timing-function: cubic-bezier(0.34,1.7,0.64,1); }
              8%   { transform: translateY(-18px); animation-timing-function: cubic-bezier(0.34,1.7,0.64,1); }
              16%  { transform: translateY(0); }
              100% { transform: translateY(0); }
            }
          `}</style>
        )}

        {typewriter ? (
          <TypewriterTitle
            text={text}
            className="py-3 text-center text-2xl font-black leading-tight tracking-[0.5px]"
          />
        ) : animated ? (
          <AnimatedTitle
            text={text}
            className="py-3 text-center text-2xl font-black leading-tight tracking-[0.5px] whitespace-nowrap overflow-hidden"
          />
        ) : (
          <div className="py-3 text-center text-2xl font-black leading-tight tracking-[0.5px]"
            style={TITLE_GRADIENT}>
            {text}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center border-b border-zeyin-border px-5 pb-3.5 pt-11"
      style={{ background: 'linear-gradient(180deg, #061a1a 0%, transparent 100%)' }}>

      {/* Logo ring */}
      <div className="mb-2.5 flex h-[70px] w-[70px] items-center justify-center rounded-full p-[3px]"
        style={{
          background: 'conic-gradient(#1ec8c8 0deg, #d4145a 180deg, #f47920 300deg, #1ec8c8 360deg)',
          boxShadow: '0 0 24px rgba(30,200,200,0.33), 0 0 48px rgba(212,20,90,0.13)',
        }}>
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#0a1f1e]">
          <ZeyinLogo size={64} />
        </div>
      </div>

      {/* Sub-label */}
      <div className="mb-1 font-mono text-[8px] uppercase tracking-[3px] text-zeyin-teal">
        ZEYIN oqu ortalygy
      </div>

      {/* Olympiad name */}
      {animated && (
        <style>{`
          @keyframes titleShimmer {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes letterBounce {
            0%   { transform: translateY(0); animation-timing-function: cubic-bezier(0.34,1.7,0.64,1); }
            8%   { transform: translateY(-18px); animation-timing-function: cubic-bezier(0.34,1.7,0.64,1); }
            16%  { transform: translateY(0); }
            100% { transform: translateY(0); }
          }
        `}</style>
      )}

      {animated ? (
        <AnimatedTitle
          text={text}
          className="text-center text-2xl font-black leading-tight tracking-[0.5px] whitespace-nowrap overflow-hidden"
        />
      ) : (
        <div className="text-center text-2xl font-black leading-tight tracking-[0.5px]"
          style={{
            background: 'linear-gradient(90deg, #1ec8c8, #fff, #e8206e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
          {text}
        </div>
      )}
    </div>
  )
}
