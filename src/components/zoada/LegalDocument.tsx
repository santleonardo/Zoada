'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import type { Components } from 'react-markdown';

interface LegalDocumentProps {
  title: string;
  content: string;
}

// Mapeamento manual dos elementos do markdown pro visual do app. Não usamos
// o plugin @tailwindcss/typography (não está instalado no projeto) — em vez
// disso, cada tag ganha classes Tailwind explícitas, seguindo a paleta já
// usada no resto do app (#1A1B25 texto principal, #FF8C42 destaque/laranja,
// black/NN para tons neutros).
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-[#1A1B25] mt-2 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-[#1A1B25] mt-8 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold text-[#1A1B25] mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-black/70 leading-relaxed mb-3">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-[#1A1B25] font-semibold">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-[#FF8C42] hover:underline break-words">
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-1.5 text-sm text-black/70">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-sm text-black/70">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="border-black/10 my-8" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#FF8C42] pl-4 my-4 text-sm text-black/60 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4 rounded-xl border border-black/10">
      <table className="w-full text-xs text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#EFF0F6]">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold text-[#1A1B25] border-b border-black/10">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-black/70 border-b border-black/5 align-top">{children}</td>
  ),
  em: ({ children }) => <em className="text-black/50">{children}</em>,
};

// Tela de leitura para Termos de Uso e Política de Privacidade. Recebe o
// conteúdo já lido do .md correspondente em /public/legal (fonte única de
// verdade), assim o que aparece aqui é sempre exatamente o que foi
// revisado — sem duplicar o texto direto no componente.
const LegalDocument: React.FC<LegalDocumentProps> = ({ title, content }) => {
  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7FB]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 glass safe-top sticky top-0 z-10">
        <Link
          href="/"
          className="p-2 rounded-full hover:bg-black/5 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} className="text-black/70" />
        </Link>
        <p className="text-sm font-semibold text-[#1A1B25] truncate">{title}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-16 max-w-2xl mx-auto w-full">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default LegalDocument;
