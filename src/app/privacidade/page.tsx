import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import LegalDocument from '@/components/zoada/LegalDocument';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Zôada',
  description: 'Política de Privacidade do Zôada.',
};

export default function PrivacidadePage() {
  const filePath = path.join(process.cwd(), 'public', 'legal', 'politica-de-privacidade.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return <LegalDocument title="Política de Privacidade" content={content} />;
}
