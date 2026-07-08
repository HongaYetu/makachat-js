/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{ts,tsx}'],
    corePlugins: {
        preflight: false,
    },
    theme: {
        extend: {
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
            },
            animation: {
                'maka-subir': 'maka-subir .18s ease-out',
                'maka-pulsar': 'maka-pulsar 1.4s ease-in-out infinite',
                'maka-salto': 'maka-salto 1.2s ease-in-out infinite',
            },
        },
    },
    plugins: [],
};
