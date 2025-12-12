'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    isActive: boolean;
    color?: string;
    barCount?: number;
}

export default function AudioVisualizer({
    isActive,
    color = 'rgb(168, 85, 247)', // Primary purple
    barCount = 32
}: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size (pseudo-responsive)
        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight || 100;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Animation state
        const bars: number[] = new Array(barCount).fill(0);
        let time = 0;

        const animate = () => {
            if (!isActive) {
                // Decay to zero
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            const w = canvas.width;
            const h = canvas.height;
            const barWidth = w / barCount;
            const gap = 2;

            ctx.clearRect(0, 0, w, h);

            // Update time for Perlin-noise-like effect
            time += 0.05;

            bars.forEach((_, i) => {
                // Simulate frequency data using sine waves + randomness
                // center bars are taller (bell curve)
                const center = barCount / 2;
                const dist = Math.abs(i - center);
                const bell = Math.max(0.1, 1 - (dist / (barCount / 2)));

                // Multi-frequency simulation
                const noise = Math.sin(i * 0.5 + time) * 0.5 + Math.cos(i * 0.3 - time * 2) * 0.3 + Math.random() * 0.2;
                const targetHeight = h * bell * (0.3 + Math.abs(noise) * 0.6);

                // Smooth interpolation
                bars[i] += (targetHeight - bars[i]) * 0.2;

                const x = i * barWidth;
                const y = (h - bars[i]) / 2; // Center vertically

                // Draw bar
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.6 + (bars[i] / h) * 0.4; // Brighter when louder

                // Rounded caps
                ctx.beginPath();
                ctx.roundRect(x + gap / 2, y, barWidth - gap, bars[i], 4);
                ctx.fill();
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        if (isActive) {
            animate();
        }

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isActive, color, barCount]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full opacity-80 mix-blend-screen"
        />
    );
}
