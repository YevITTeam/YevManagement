import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                "brand-red": "#E3000F",
                "brand-red-hover": "#CC000D",
                "brand-black": "#191c1e",
                surface: "#f7f9fb",
                background: "#f8fafc",
                primary: "#b40009",
                "primary-container": "#e3000f",
                "on-primary-container": "#fff4f2",
                "on-surface": "#191c1e",
                "on-surface-variant": "#5e3f3a",
                "surface-container": "#eceef0",
                "surface-container-low": "#f2f4f6",
                "surface-container-lowest": "#ffffff",
                "outline-variant": "#e0e3e5",
            },
            fontFamily: {
                sans: ["Hanken Grotesk", "Arial", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            borderRadius: {
                DEFAULT: "0px",
                lg: "0px",
                xl: "0px",
                full: "0px",
            },
        },
    },
    plugins: [],
};

export default config;
