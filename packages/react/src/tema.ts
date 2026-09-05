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

    /**
     * O fundo do botão flutuante que abre o chat.
     *
     * Aceita **qualquer** valor de `background` — uma cor, um gradiente, uma
     * imagem. Por omissão é um gradiente tirado da própria `primaria`, para o
     * botão ter vida sem cada app ter de escolher dois tons à mão.
     *
     * O gradiente vai do tom **claro para o escuro da marca**, e nunca de um tom
     * pálido: um extremo lavado faz o ícone branco desaparecer nele. É a mesma
     * regra que as apps nativas já seguem para os botões cheios.
     */
    lancadorFundo?: string;

    /**
     * A sombra do mesmo botão.
     *
     * Tingida com a cor da marca e não cinzenta — é isso, mais do que o
     * gradiente, que faz um botão flutuante ler-se como vivo em vez de colado.
     */
    lancadorSombra?: string;
}

/*
 * Os dois derivam da `primaria` por `color-mix`, e não de constantes.
 *
 * Uma app que só diga a sua cor primária ganha o botão coerente de borla; se
 * fossem valores fixos, quem trocasse a `primaria` ficava com um lançador de
 * outra marca — e ninguém se lembraria de o corrigir, porque nada dá erro.
 */
const LANCADOR_FUNDO =
    'linear-gradient(140deg,' +
    ' color-mix(in oklab, var(--maka-primaria) 72%, white) 0%,' +
    ' var(--maka-primaria) 52%,' +
    ' color-mix(in oklab, var(--maka-primaria) 72%, black) 100%)';

/*
 * Três camadas, e a terceira é a que faz o trabalho.
 *
 * As duas primeiras são o halo tingido — é ele, mais do que o gradiente, que
 * separa um botão flutuante do fundo em vez de o deixar colado. A terceira é um
 * risco de luz no topo, por dentro: sem ele o círculo lê-se chapado, com ele
 * ganha volume. Uma sombra cinzenta faria as três parecerem sujidade.
 */
const LANCADOR_SOMBRA =
    '0 8px 20px -3px color-mix(in oklab, var(--maka-primaria) 70%, transparent),' +
    ' 0 18px 44px -10px color-mix(in oklab, var(--maka-primaria) 55%, transparent),' +
    ' inset 0 1px 0 color-mix(in oklab, white 45%, transparent)';

const PADRAO: Required<MakaTema> = {
    primaria: '#4f46e5',
    primariaContraste: '#ffffff',
    fundo: '#f4f5f7',
    superficie: '#ffffff',
    bolhaMinha: '#4f46e5',
    bolhaMinhaTexto: '#ffffff',
    bolhaOutro: '#ffffff',
    texto: '#0f172a',
    textoSuave: '#64748b',
    raio: '16px',
    fonte: 'inherit',
    lancadorFundo: LANCADOR_FUNDO,
    lancadorSombra: LANCADOR_SOMBRA,
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
        '--maka-lancador-fundo': t.lancadorFundo,
        '--maka-lancador-sombra': t.lancadorSombra,
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
    lancadorFundo: 'var(--maka-lancador-fundo)',
    lancadorSombra: 'var(--maka-lancador-sombra)',
};
