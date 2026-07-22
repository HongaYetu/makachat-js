import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useHongaAds } from './provider';
import { ServeResultado } from './tipos';

export interface AdBannerProps {
    /** unit_uid (hy-unit-...) de um bloco de formato banner. */
    unitId: string;
    style?: any;
}

/**
 * Banner Honga Ads. Serve no mount, regista a impressão após 1 segundo de
 * exibição e abre o destino do anunciante no clique. Em no-fill ou erro
 * colapsa (não ocupa espaço).
 */
export function AdBanner({ unitId, style }: AdBannerProps) {
    const { cliente } = useHongaAds();
    const [resultado, setResultado] = useState<ServeResultado | null>(null);
    const [semAnuncio, setSemAnuncio] = useState(false);
    const impressaoEnviada = useRef(false);

    useEffect(() => {
        let cancelado = false;
        impressaoEnviada.current = false;
        setResultado(null);
        setSemAnuncio(false);

        void cliente.serve(unitId).then((servido) => {
            if (cancelado) {
                return;
            }

            if (!servido || servido.anuncio.assets.length === 0) {
                setSemAnuncio(true);
                return;
            }

            setResultado(servido);
        });

        return () => {
            cancelado = true;
        };
    }, [cliente, unitId]);

    useEffect(() => {
        if (!resultado || impressaoEnviada.current) {
            return;
        }

        // Impressão após 1s de exibição — aproximação da viewability web
        // (50%/1s) possível sem módulos nativos. O banner monta-se onde o
        // publisher o renderiza, por isso "montado" ≈ "visível".
        const timer = setTimeout(() => {
            impressaoEnviada.current = true;
            void cliente.impression(resultado.tokens.impression);
        }, 1000);

        return () => clearTimeout(timer);
    }, [resultado, cliente]);

    if (semAnuncio || !resultado) {
        return null;
    }

    const anuncio = resultado.anuncio;
    const asset = anuncio.assets[0];
    const ratio = asset.largura && asset.altura ? asset.largura / asset.altura : 320 / 50;

    const abrirDestino = async () => {
        const destino = await cliente.click(resultado.tokens.click);
        if (destino) {
            void Linking.openURL(destino);
        }
    };

    return (
        <Pressable onPress={abrirDestino} style={style} accessibilityLabel={anuncio.nome ?? 'Anúncio'}>
            <View style={{ width: '100%', aspectRatio: ratio }}>
                <Image source={{ uri: asset.url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                {anuncio.teste ? (
                    <Text
                        style={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            fontSize: 10,
                            fontWeight: '700',
                            color: '#111827',
                            backgroundColor: '#fbbf24',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            overflow: 'hidden',
                        }}
                    >
                        Teste
                    </Text>
                ) : null}
            </View>
        </Pressable>
    );
}
