import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { HongaAdsCliente } from './cliente';
import { RewardResultado, ServeResultado } from './tipos';

export interface PedidoFullscreen {
    tipo: 'interstitial' | 'rewarded';
    resultado: ServeResultado;
    /** ms até o botão fechar aparecer (interstitial). Default 5000. */
    skipAfterMs?: number;
    /** segundos de visualização exigidos (rewarded). Default 15 — alinhado com o servidor. */
    minViewSegundos?: number;
    onReward?: (resultado: RewardResultado) => void;
    onClose?: () => void;
}

interface Props {
    pedido: PedidoFullscreen | null;
    cliente: HongaAdsCliente;
    aoFechar: () => void;
}

/**
 * Host único dos anúncios fullscreen, montado pelo provider. Interstitial:
 * fechar após skipAfterMs. Rewarded: contagem decrescente; a impressão só é
 * enviada no fim da visualização mínima e a recompensa só dispara depois de
 * o servidor a confirmar (reward-confirm).
 */
export function FullscreenAnuncio({ pedido, cliente, aoFechar }: Props) {
    const [podeFechar, setPodeFechar] = useState(false);
    const [segundosRestantes, setSegundosRestantes] = useState(0);
    const confirmado = useRef(false);

    useEffect(() => {
        if (!pedido) {
            return;
        }

        confirmado.current = false;
        setPodeFechar(false);

        if (pedido.tipo === 'interstitial') {
            // Impressão após 1s de exibição (paridade com a viewability web).
            const timerImpressao = setTimeout(() => {
                void cliente.impression(pedido.resultado.tokens.impression);
            }, 1000);

            const timerFechar = setTimeout(() => setPodeFechar(true), pedido.skipAfterMs ?? 5000);

            return () => {
                clearTimeout(timerImpressao);
                clearTimeout(timerFechar);
            };
        }

        // rewarded: contagem decrescente até à visualização mínima.
        const minView = pedido.minViewSegundos ?? 15;
        setSegundosRestantes(minView);

        const intervalo = setInterval(() => {
            setSegundosRestantes((atual) => {
                if (atual <= 1) {
                    clearInterval(intervalo);

                    if (!confirmado.current) {
                        confirmado.current = true;
                        void concluirRewarded(pedido, cliente);
                    }

                    setPodeFechar(true);
                    return 0;
                }

                return atual - 1;
            });
        }, 1000);

        return () => clearInterval(intervalo);
    }, [pedido, cliente]);

    if (!pedido) {
        return null;
    }

    const anuncio = pedido.resultado.anuncio;
    const asset = anuncio.assets[0];

    const fechar = () => {
        pedido.onClose?.();
        aoFechar();
    };

    const abrirDestino = async () => {
        const destino = await cliente.click(pedido.resultado.tokens.click);
        if (destino) {
            void Linking.openURL(destino);
        }
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={() => podeFechar && fechar()}>
            <View style={estilos.fundo}>
                <Pressable style={estilos.criativo} onPress={abrirDestino}>
                    {asset ? (
                        <Image source={{ uri: asset.url }} style={estilos.imagem} resizeMode="contain" />
                    ) : (
                        <Text style={estilos.titulo}>{anuncio.nome ?? 'Anúncio'}</Text>
                    )}
                    {asset?.texto_cta ? <Text style={estilos.cta}>{asset.texto_cta}</Text> : null}
                </Pressable>

                {anuncio.teste ? <Text style={estilos.badgeTeste}>Anúncio de teste</Text> : null}

                {podeFechar ? (
                    <Pressable style={estilos.fechar} onPress={fechar} accessibilityLabel="Fechar anúncio">
                        <Text style={estilos.fecharTexto}>×</Text>
                    </Pressable>
                ) : pedido.tipo === 'rewarded' ? (
                    <View style={estilos.contagem}>
                        <Text style={estilos.contagemTexto}>{segundosRestantes}s</Text>
                    </View>
                ) : null}
            </View>
        </Modal>
    );
}

async function concluirRewarded(pedido: PedidoFullscreen, cliente: HongaAdsCliente): Promise<void> {
    // A impressão marca o fim da visualização — o servidor mede o tempo entre
    // o serve e este redeem para validar a visualização mínima.
    await cliente.impression(pedido.resultado.tokens.impression);

    const resultado = await cliente.rewardConfirm(pedido.resultado.tokens.impression);

    if (resultado.recompensa) {
        pedido.onReward?.(resultado);
    }
}

const estilos = StyleSheet.create({
    fundo: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    criativo: {
        width: '92%',
        height: '80%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    imagem: {
        width: '100%',
        height: '100%',
    },
    titulo: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    cta: {
        marginTop: 12,
        color: '#ffffff',
        backgroundColor: '#16a34a',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        overflow: 'hidden',
        fontWeight: '600',
    },
    fechar: {
        position: 'absolute',
        top: 48,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fecharTexto: {
        color: '#ffffff',
        fontSize: 22,
        lineHeight: 24,
    },
    contagem: {
        position: 'absolute',
        top: 48,
        right: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    contagemTexto: {
        color: '#ffffff',
        fontWeight: '600',
    },
    badgeTeste: {
        position: 'absolute',
        top: 52,
        left: 20,
        color: '#111827',
        backgroundColor: '#fbbf24',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        overflow: 'hidden',
        fontSize: 12,
        fontWeight: '700',
    },
});
