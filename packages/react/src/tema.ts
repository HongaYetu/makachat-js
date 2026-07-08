import type { CSSProperties } from 'react';

/** Tema por cores — cada serviço ganha a sua identidade. */
export interface MakaTema {
    primaria?: string;
    primariaContraste?: string;
    fundo?: string;
    superficie?: string;
    bolhaMinha?: string;
    bolhaMinhaTexto?: string;
    bolhaOutro?: string;
    texto?: string;
    textoSuave?: string;
    raio?: string;
    fonte?: string;
}

const PADRAO: Required<MakaTema> = {
    primaria: '#4f46e5',
    primariaContraste: '#ffffff',
    fundo: '#e9eef5',
    superficie: '#ffffff',
    bolhaMinha: '#4f46e5',
    bolhaMinhaTexto: '#ffffff',
    bolhaOutro: '#ffffff',
    texto: '#0f172a',
    textoSuave: '#64748b',
    raio: '16px',
    fonte: 'inherit',
};

export function cssVarsDoTema(tema?: MakaTema): CSSProperties {
    const t = { ...PADRAO, ...tema };

    return {
        '--maka-primaria': t.primaria,
        '--maka-primaria-contraste': t.primariaContraste,
        '--maka-fundo': t.fundo,
        '--maka-superficie': t.superficie,
        '--maka-bolha-minha': t.bolhaMinha,
        '--maka-bolha-minha-texto': t.bolhaMinhaTexto,
        '--maka-bolha-outro': t.bolhaOutro,
        '--maka-texto': t.texto,
        '--maka-texto-suave': t.textoSuave,
        '--maka-raio': t.raio,
        fontFamily: t.fonte,
    } as CSSProperties;
}

export const v = {
    primaria: 'var(--maka-primaria)',
    primariaContraste: 'var(--maka-primaria-contraste)',
    fundo: 'var(--maka-fundo)',
    superficie: 'var(--maka-superficie)',
    bolhaMinha: 'var(--maka-bolha-minha)',
    bolhaMinhaTexto: 'var(--maka-bolha-minha-texto)',
    bolhaOutro: 'var(--maka-bolha-outro)',
    texto: 'var(--maka-texto)',
    textoSuave: 'var(--maka-texto-suave)',
    raio: 'var(--maka-raio)',
};
