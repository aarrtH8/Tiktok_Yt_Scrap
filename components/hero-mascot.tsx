'use client';

import { useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Float, Sparkles, ContactShadows, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';


function Robot() {
    const headRef = useRef<THREE.Group>(null);
    const eyesRef = useRef<THREE.Group>(null);
    const { mouse, viewport } = useThree();

    useFrame((state) => {
        if (!headRef.current || !eyesRef.current) return;

        // Smooth mouse tracking
        const x = (mouse.x * viewport.width) / 2;
        const y = (mouse.y * viewport.height) / 2;

        // Head follows mouse slightly
        headRef.current.lookAt(x, y, 10);
        // Eyes follow more intensely
        eyesRef.current.position.x = THREE.MathUtils.lerp(eyesRef.current.position.x, mouse.x * 0.2, 0.1);
        eyesRef.current.position.y = THREE.MathUtils.lerp(eyesRef.current.position.y, mouse.y * 0.2, 0.1);
    });

    return (
        <group>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <group ref={headRef}>
                    {/* HEAD */}
                    <RoundedBox args={[1.2, 1, 1]} radius={0.3} smoothness={4} position={[0, 0, 0]}>
                        <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.1} />
                    </RoundedBox>

                    {/* VISOR (Face) */}
                    <RoundedBox args={[1, 0.5, 0.1]} radius={0.1} position={[0, 0, 0.51]}>
                        <meshStandardMaterial color="#000000" roughness={0.2} metalness={0.8} />
                    </RoundedBox>

                    {/* EYES CONTAINER */}
                    <group ref={eyesRef} position={[0, 0, 0.57]}>
                        {/* Left Eye */}
                        <mesh position={[-0.25, 0, 0]}>
                            <planeGeometry args={[0.15, 0.15]} />
                            <meshBasicMaterial color="#00ffff" toneMapped={false} />
                        </mesh>
                        {/* Right Eye */}
                        <mesh position={[0.25, 0, 0]}>
                            <planeGeometry args={[0.15, 0.15]} />
                            <meshBasicMaterial color="#00ffff" toneMapped={false} />
                        </mesh>
                    </group>

                    {/* ANTENNA */}
                    <group position={[0, 0.6, 0]}>
                        <mesh position={[0, 0, 0]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.4]} />
                            <meshStandardMaterial color="#aaaaaa" metalness={0.5} />
                        </mesh>
                        <mesh position={[0, 0.2, 0]}>
                            <sphereGeometry args={[0.08]} />
                            <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={2} toneMapped={false} />
                        </mesh>
                    </group>

                    {/* EARS/HEADPHONES */}
                    <mesh position={[-0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.2, 0.2, 0.2]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                    <mesh position={[0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.2, 0.2, 0.2]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>

                </group>
            </Float>

            {/* SHADOW */}
            <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
        </group>
    );
}

export default function HeroMascot() {
    return (
        <div className="w-full h-[400px] cursor-grab active:cursor-grabbing">
            <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
                <Suspense fallback={null}>
                    <Environment preset="city" />
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} />

                    {/* PARTICLES */}
                    <Sparkles count={50} scale={6} size={4} speed={0.4} opacity={0.5} color="#8b5cf6" />

                    <Robot />
                </Suspense>
            </Canvas>
        </div>
    );
}
