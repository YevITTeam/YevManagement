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
                "brand-black": "#0F172A",
                surface: "#FFFFFF",
                background: "#F8FAFC",
            },
        },
    },
    plugins: [],
};

export default config;
