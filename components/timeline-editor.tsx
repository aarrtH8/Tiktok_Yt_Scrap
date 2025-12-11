'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Reorder, useDragControls, AnimatePresence, motion } from 'framer-motion';
import { Play, Pause, AlertCircle, GripHorizontal, Scissors, Trash2, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface Moment {
    start: number;
    end: number;
    timestamp: string;
    duration: string;
    title: string;
    score: number;
    videoId: string;
    videoIndex: number;
    videoTitle: string;
    filename?: string;
    file_path?: string;
}

interface TimelineEditorProps {
    initialMoments: Moment[];
    videoDurations: number[];
    onConfirm: (moments: Moment[]) => void;
    onCancel: () => void;
    downloadedFiles?: string[]; // We need this to know file names
}

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function TimelineEditor({
    initialMoments,
    videoDurations,
    onConfirm,
    onCancel,
    downloadedFiles = []
}: TimelineEditorProps) {
    const [moments, setMoments] = useState<Moment[]>(initialMoments);
    const [activeClipIndex, setActiveClipIndex] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Sync video source when active clip changes
    const activeMoment = moments[activeClipIndex];

    // Construct video source URL
    // We need to map videoIndex to a filename. 
    // Ideally, moments should have 'filename', but if not, we use videoIndex and downloadedFiles prop?
    // Let's assume we can get filename from backend or moments.
    // We'll update backend to pass 'downloaded_files' names in moments but for now let's rely on props.
    // Actually, we don't have downloadedFiles prop readily available?
    // Let's assume the API response added 'filename' to moments or we pass it.

    const getVideoSrc = (moment: Moment) => {
        // Logic to resolve src.
        // 1. If moment has filename (we update backend to include it)
        // 2. Fallback: we need to match index.
        // Let's assume we pass the full moment object which will have 'filename' added by backend or we derive it.
        // Since we didn't update backend yet to pass filename in moments, we need to rely on mapping.
        // BUT, we did add 'downloaded_files' to session data. 
        // The frontend received 'bestMoments'.
        // HACK: We will try to construct it. If moment has 'file_path', use basics.

        // Let's assume for now we can access it via /api/temp/filename
        // We will need to pass 'downloadedFiles' to this component from page.tsx
        if (!moment) return '';
        // We need the filename.
        // Let's assume the component prop `downloadedFiles` works.
        // If we don't have it, we show a placeholder.

        // Temporary: Just try to guess filename if we don't have it? No that's risky.
        // Recommendation: Update backend to include 'filename' in moments.
        // For now, let's just use what we have.
        return '';
    };

    // We need to fetch the filename. 
    // Let's make sure the parent passes something useful.
    // Or we just rely on the API to give us everything.
    // Let's Update the component to handle the playback logic assuming we have a URL.

    const [activeSrc, setActiveSrc] = useState('');

    useEffect(() => {
        if (!activeMoment) return;
        // We need to find the file.
        // Let's assume we can hit an endpoint to get the file or we passed it.
        // Since we don't have it yet, let's use a proxy state.

        // For now, let's assume the backend provides 'filename' in the moment object.
        const filename = activeMoment.filename || (activeMoment.file_path ? activeMoment.file_path.split('/').pop() : null);

        if (filename) {
            setActiveSrc(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/temp/${filename}`);
        }
    }, [activeMoment]);

    useEffect(() => {
        if (videoRef.current && activeMoment) {
            const startTime = Number(activeMoment.start);
            if (Number.isFinite(startTime) && startTime >= 0) {
                videoRef.current.currentTime = startTime;
            }
            if (isPlaying) videoRef.current.play().catch(() => { });
        }
    }, [activeSrc, activeMoment?.start]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current && activeMoment) {
            // Loop clip
            if (videoRef.current.currentTime >= activeMoment.end) {
                videoRef.current.currentTime = activeMoment.start;
                // Optional: Move to next clip?
                // videoRef.current.pause();
                // setIsPlaying(false);
            }
        }
    };

    const handleRemove = (index: number) => {
        const newMoments = [...moments];
        newMoments.splice(index, 1);
        setMoments(newMoments);
        if (index === activeClipIndex && newMoments.length > 0) {
            setActiveClipIndex(Math.max(0, index - 1));
        } else if (newMoments.length === 0) {
            setActiveClipIndex(-1);
        }
    };

    const handleUpdateDuration = (index: number, newRange: [number, number]) => {
        const newMoments = [...moments];
        newMoments[index] = {
            ...newMoments[index],
            start: newRange[0],
            end: newRange[1],
            duration: `${Math.round(newRange[1] - newRange[0])}s`,
            timestamp: formatTime(newRange[0])
        };
        setMoments(newMoments);
    };


    return (
        <div className="flex flex-col h-full bg-black/90 text-white rounded-xl overflow-hidden border border-white/10 shadow-2xl">

            {/* 1. TOP: PLAYER & INFO */}
            <div className="flex-1 min-h-[400px] flex">

                {/* Left: Main Player */}
                <div className="flex-1 relative bg-black flex items-center justify-center group">
                    {activeMoment && activeSrc ? (
                        <video
                            ref={videoRef}
                            src={activeSrc}
                            className="max-h-full max-w-full aspect-video object-contain"
                            onTimeUpdate={handleTimeUpdate}
                            onClick={togglePlay}
                        />
                    ) : (
                        <div className="text-white/20 font-mono text-sm">Select a clip to preview</div>
                    )}

                    {/* Player Controls Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <button
                            onClick={togglePlay}
                            className="p-4 bg-white/10 backdrop-blur-md rounded-full pointer-events-auto hover:scale-110 transition-transform"
                        >
                            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                        </button>
                    </div>

                    {/* Top Overlay Info */}
                    {activeMoment && (
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-xs px-3 py-1.5 rounded-md border border-white/10">
                            <span className="text-primary font-bold">{activeMoment.duration}</span> • {activeMoment.videoTitle}
                        </div>
                    )}
                </div>

                {/* Right: Clip Details / Trimmer */}
                <div className="w-[320px] border-l border-white/10 bg-zinc-900/50 p-6 flex flex-col gap-6">
                    <div>
                        <h3 className="text-sm uppercase tracking-wider text-white/40 font-bold mb-4">Clip Properties</h3>
                        {activeMoment ? (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs text-white/50">Title</label>
                                    <div className="text-sm font-medium leading-normal">{activeMoment.title}</div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-white/50 flex items-center gap-2">
                                            <Scissors className="w-3 h-3" /> Trim Range
                                        </label>
                                        <span className="font-mono text-xs text-primary">
                                            {(activeMoment.end - activeMoment.start).toFixed(1)}s
                                        </span>
                                    </div>

                                    <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                                        <div className="flex justify-between text-[10px] text-white/30 font-mono mb-2">
                                            <span>{formatTime(activeMoment.start)}</span>
                                            <span>{formatTime(activeMoment.end)}</span>
                                        </div>
                                        <Slider.Root
                                            className="relative flex items-center select-none touch-none w-full h-5"
                                            value={[activeMoment.start, activeMoment.end]}
                                            max={videoDurations[activeMoment.videoIndex] || 300}
                                            step={0.1}
                                            minStepsBetweenThumbs={10}
                                            onValueChange={(val) => handleUpdateDuration(activeClipIndex, val as [number, number])}
                                        >
                                            <Slider.Track className="bg-white/10 relative grow rounded-full h-[2px]">
                                                <Slider.Range className="absolute bg-primary rounded-full h-full" />
                                            </Slider.Track>
                                            <Slider.Thumb
                                                className="block w-3 h-3 bg-white border border-primary shadow-sm rounded-full hover:scale-125 focus:outline-none transition-transform"
                                            />
                                            <Slider.Thumb
                                                className="block w-3 h-3 bg-white border border-primary shadow-sm rounded-full hover:scale-125 focus:outline-none transition-transform"
                                            />
                                        </Slider.Root>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleRemove(activeClipIndex)}
                                    className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-3 h-3" /> Remove Clip
                                </button>
                            </div>
                        ) : (
                            <div className="text-sm text-white/20 text-center py-10">
                                No clip selected
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/10">
                        <button
                            onClick={() => onConfirm(moments)}
                            disabled={moments.length === 0}
                            className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Export Video
                        </button>
                        <button
                            onClick={onCancel}
                            className="w-full py-3 mt-3 text-xs text-white/40 hover:text-white transition-colors"
                        >
                            Cancel Editing
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. BOTTOM: TIMELINE */}
            <div className="h-32 bg-zinc-950 border-t border-white/10 overflow-hidden flex flex-col">
                <div className="px-4 py-2 flex justify-between items-center text-[10px] text-white/30 bg-black/40 border-b border-white/5">
                    <span>TIMELINE TRACK 1</span>
                    <span>Total: {moments.reduce((acc, m) => acc + (m.end - m.start), 0).toFixed(0)}s</span>
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 custom-scrollbar">
                    <Reorder.Group axis="x" values={moments} onReorder={setMoments} className="flex gap-2 h-full min-w-max">
                        {moments.map((moment, index) => (
                            <TimelineItem
                                key={`${moment.videoId}-${index}-${moment.start}`}
                                moment={moment}
                                isActive={index === activeClipIndex}
                                index={index}
                                onClick={() => setActiveClipIndex(index)}
                            />
                        ))}
                    </Reorder.Group>
                </div>
            </div>
        </div>
    );
}

function TimelineItem({ moment, isActive, index, onClick }: { moment: Moment, isActive: boolean, index: number, onClick: () => void }) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={moment}
            dragListener={false}
            dragControls={controls}
            className="h-full"
        >
            <div
                onClick={onClick}
                className={cn(
                    "relative h-full aspect-[16/9] md:aspect-video bg-zinc-800 rounded-md border-2 overflow-hidden cursor-pointer group transition-all min-w-[120px]",
                    isActive ? "border-primary ring-2 ring-primary/20" : "border-white/5 hover:border-white/20"
                )}
            >
                {/* Simulated Filmstrip Holes */}
                <div className="absolute top-0 left-0 w-full h-1 bg-repeat-x opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '8px 4px' }}></div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-repeat-x opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '8px 4px' }}></div>

                {/* Content */}
                <div className="h-full p-2 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-[10px] font-bold text-white/90 truncate">{moment.title}</span>
                    <span className="text-[8px] text-primary tabular-nums">{(moment.end - moment.start).toFixed(1)}s</span>
                </div>

                {/* Drag Handle Overlay */}
                <div
                    onPointerDown={(e) => controls.start(e)}
                    className="absolute inset-x-0 top-0 h-4 bg-white/5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing flex items-center justify-center transition-opacity"
                >
                    <GripHorizontal className="w-3 h-3 text-white/50" />
                </div>

                {/* Index Badge */}
                <div className="absolute top-1 left-1 bg-black/60 text-[8px] px-1 rounded text-white/40">
                    #{index + 1}
                </div>
            </div>
        </Reorder.Item>
    );
}
