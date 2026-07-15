"use client";

import { useEffect, useRef, useState } from "react";

interface SignatureCanvasProps {
    // Base64 thuần (không kèm prefix data:image/...;base64,) để vẽ sẵn lên canvas 1 lần khi mount/khi đổi
    // (vd load lại chữ ký đã lưu từ UserSignatureApi.getMySignature()) — docs/attendance-api-fe.md đầu file.
    initialImage?: string | null;
    onChange: (base64: string | null) => void;
    disabled?: boolean;
    height?: number;
}

function stripDataUrlPrefix(dataUrl: string) {
    const commaIndex = dataUrl.indexOf(",");
    return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

// Canvas ký tay thuần (pointer events), không dùng thư viện ngoài — theo yêu cầu CLAUDE.md hạn chế
// thêm dependency. Nền luôn tô trắng để BE/hiển thị lại không bị nền trong suốt.
export default function SignatureCanvas({ initialImage, onChange, disabled = false, height = 160 }: SignatureCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const hasDrawnRef = useRef(false);
    const [isEmpty, setIsEmpty] = useState(true);

    const getContext = () => canvasRef.current?.getContext("2d") ?? null;

    const fillWhiteBackground = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (!canvas || !ctx) return;

        // Canvas dùng kích thước CSS thực tế (không scale theo devicePixelRatio) — đủ dùng cho chữ ký đơn giản.
        canvas.width = canvas.clientWidth;
        canvas.height = height;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#191c1e";
        fillWhiteBackground(ctx, canvas);

        if (initialImage) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                hasDrawnRef.current = true;
                setIsEmpty(false);
            };
            img.src = `data:image/png;base64,${initialImage}`;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const commit = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        onChange(hasDrawnRef.current ? stripDataUrlPrefix(canvas.toDataURL("image/png")) : null);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        const ctx = getContext();
        if (!ctx) return;
        drawingRef.current = true;
        hasDrawnRef.current = true;
        setIsEmpty(false);
        const { x, y } = getPoint(event);
        ctx.beginPath();
        ctx.moveTo(x, y);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current || disabled) return;
        const ctx = getContext();
        if (!ctx) return;
        const { x, y } = getPoint(event);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const handlePointerUp = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        commit();
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (!canvas || !ctx) return;
        fillWhiteBackground(ctx, canvas);
        hasDrawnRef.current = false;
        setIsEmpty(true);
        onChange(null);
    };

    return (
        <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-[#e0e3e5] bg-white">
                <canvas
                    ref={canvasRef}
                    style={{ height, touchAction: "none" }}
                    className={`w-full ${disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-[#5e3f3a]">{isEmpty ? "Ký vào khung phía trên" : "Đã ký"}</span>
                <button
                    type="button"
                    onClick={handleClear}
                    disabled={disabled || isEmpty}
                    className="cursor-pointer text-xs font-semibold text-[#930006] transition hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Xoá chữ ký
                </button>
            </div>
        </div>
    );
}
