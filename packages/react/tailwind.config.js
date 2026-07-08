/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{ts,tsx}'],
    corePlugins: {
        preflight: false,
    },
    theme: {
        extend: {
            boxShadow: {
                // elevação suave e visível para menus/popovers (2 camadas: difusa + próxima)
                'maka-pop': '0 12px 32px -6px rgba(15,23,42,.28), 0 4px 12px -4px rgba(15,23,42,.18)',
                'maka-modal': '0 24px 64px -12px rgba(15,23,42,.45), 0 8px 24px -8px rgba(15,23,42,.25)',
            },
            keyframes: {
                'maka-subir': {
                    from: { opacity: '0', transform: 'translateY(12px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'maka-pulsar': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.06)' },
                },
                'maka-salto': {
                    '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '.45' },
                    '30%': { transform: 'translateY(-4px)', opacity: '1' },
                },
                'maka-flutuar': {
                    '0%': { opacity: '0', transform: 'translateY(14px) scale(.85)' },
                    '60%': { opacity: '1', transform: 'translateY(-2px) scale(1.03)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                'maka-flash': {
                    '0%, 40%': { backgroundColor: 'color-mix(in srgb, var(--maka-primaria) 22%, transparent)' },
                    '100%': { backgroundColor: 'transparent' },
                },
            },
            animation: {
                'maka-subir': 'maka-subir .18s ease-out',
                'maka-pulsar': 'maka-pulsar 1.4s ease-in-out infinite',
                'maka-salto': 'maka-salto 1.2s ease-in-out infinite',
                'maka-flutuar': 'maka-flutuar .35s cubic-bezier(.34,1.3,.64,1)',
                'maka-flash': 'maka-flash 1.6s ease-out',
            },
        },
    },
    plugins: [],
};
