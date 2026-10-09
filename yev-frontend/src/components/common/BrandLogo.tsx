// Plain <img>: static export has no image optimizer, and the logo is a small transparent PNG from public/.
export default function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo.png" alt="YEV" className={`${className} shrink-0 object-contain`} />
    );
}
