import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import LegalDocument from '@/components/zoada/LegalDocument';

export const metadata: Metadata = {
  title: 'Termos de Uso — Zôada',
  description: 'Termos de Uso do Zôada.',
};

// Server component: lê o .md direto do disco em build/request time, sem
// precisar de fetch client-side. O arquivo em /public/legal continua sendo
// a fonte única de verdade — editar ali é o suficiente pra atualizar aqui.
export default function TermosPage() {
  const filePath = path.join(process.cwd(), 'public', 'legal', 'termos-de-uso.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return <LegalDocument title="Termos de Uso" content={content} />;
}
