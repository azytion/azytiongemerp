'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Loader2, User, Brain, Terminal, ShieldCheck, Zap, Gem } from 'lucide-react';
import { askZationAI } from '@/app/actions/ai';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const QUICK_PROMPTS = [
  'What are my top selling gemstones this month?',
  'Which products need restocking soon?',
  'Analyze my profit margins by category',
  'Show me pending customer payments',
  'What are my best performing customers?',
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: `Hello! I'm **ZATION GemERP**, your intelligent gemstone business assistant powered by Gemini.\n\nI can help you:\n- **Analyze sales trends** and revenue patterns\n- **Identify top-selling** gemstones and categories\n- **Monitor inventory** levels and reorder needs\n- **Review customer** payment status and loyalty\n- **Generate insights** from your business data\n\nWhat would you like to explore today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || isTyping) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setIsTyping(true);

    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const result = await askZationAI(msg, history);

    setMessages(prev => [...prev, {
      role: 'model',
      text: result.success ? (result.text || '') : `Sorry, I encountered an error: ${result.error}`
    }]);
    setIsTyping(false);
  };

  return (
    <div style={{
      height: 'calc(100vh - 4rem)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 960,
      margin: '0 auto',
      gap: '1.25rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 14,
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-gold)',
          }}>
            <Brain size={26} color="#000" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>ZATION GemERP</h1>
              <span style={{
                fontSize: '0.625rem', fontWeight: 800,
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                padding: '0.125rem 0.5rem',
                borderRadius: 99,
                border: '1px solid rgba(212,175,55,0.25)',
                letterSpacing: '0.06em',
              }}>PRO</span>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem', margin: 0 }}>
              Gemstone Business Intelligence · Gemini 1.5 Flash
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', letterSpacing: '0.04em' }}>ONLINE</span>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '0.875rem',
                maxWidth: '88%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: msg.role === 'user' ? 'var(--secondary)' : 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid var(--border)',
                boxShadow: msg.role === 'model' ? 'var(--shadow-gold)' : 'none',
              }}>
                {msg.role === 'user'
                  ? <User size={17} color="var(--foreground)" />
                  : <Bot size={17} color="#000" />
                }
              </div>

              {/* Bubble */}
              <div style={{
                padding: '0.875rem 1.125rem',
                borderRadius: 'var(--radius-lg)',
                borderTopLeftRadius: msg.role === 'model' ? 4 : 'var(--radius-lg)',
                borderTopRightRadius: msg.role === 'user' ? 4 : 'var(--radius-lg)',
                background: msg.role === 'user'
                  ? 'var(--gradient-primary)'
                  : 'var(--surface-2)',
                color: msg.role === 'user' ? '#000' : 'var(--foreground)',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                border: msg.role === 'model' ? '1px solid var(--border)' : 'none',
                boxShadow: msg.role === 'user' ? 'var(--shadow-gold)' : 'var(--shadow-sm)',
              }}>
                {msg.role === 'model' ? (
                  <div style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  <span>{msg.text}</span>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-gold)',
              }}>
                <Loader2 size={17} color="#000" className="animate-spin" />
              </div>
              <div style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                borderTopLeftRadius: 4,
                display: 'flex', gap: '0.375rem', alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--primary)',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div style={{
            padding: '0 1.5rem 1rem',
            display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
          }}>
            {QUICK_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
              >
                <Sparkles size={12} />
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Gem size={16} style={{
                position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--primary)', opacity: 0.6,
              }} />
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask about your gemstone business..."
                style={{
                  width: '100%',
                  height: '3rem',
                  paddingLeft: '2.75rem',
                  paddingRight: '1rem',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.875rem',
                  color: 'var(--foreground)',
                  transition: 'all var(--transition-fast)',
                  outline: 'none',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-glow)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              style={{ width: 48, height: 48, padding: 0, borderRadius: '50%', flexShrink: 0 }}
            >
              <Send size={18} />
            </button>
          </div>

          <div style={{
            marginTop: '0.625rem',
            display: 'flex', justifyContent: 'center', gap: '1.5rem',
            color: 'var(--muted)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Terminal size={11} color="var(--primary)" /> Real-time Data
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <ShieldCheck size={11} color="var(--success)" /> Secure
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Zap size={11} color="var(--warning)" /> Fast
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
