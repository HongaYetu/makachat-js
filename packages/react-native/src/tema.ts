/**
 * Tema por cores do MakaChat mobile — mesmo shape da web (MakaTema): cada
 * serviço ganha a sua identidade passando `tema` ao provider (ex.: Humbi
 * `{ primaria: '#f97316' }`). Consumido via useTema() nos componentes.
 */
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
    raio?: number;
}

export type TemaResolvido = Required<MakaTema>;

const PADRAO: TemaResolvido = {
    primaria: '#4f46e5',
    primariaContraste: '#ffffff',
    fundo: '#f4f5f7',
    superficie: '#ffffff',
    bolhaMinha: '#4f46e5',
    bolhaMinhaTexto: '#ffffff',
    bolhaOutro: '#ffffff',
    texto: '#0f172a',
    textoSuave: '#64748b',
    raio: 16,
};

export function resolverTema(tema?: MakaTema): TemaResolvido {
    return { ...PADRAO, ...tema };
}
