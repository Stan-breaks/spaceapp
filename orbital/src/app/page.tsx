"use client";

import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars, Text } from "@react-three/drei";
import * as THREE from "three";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Globe, AlertTriangle, Info } from "lucide-react";

// Reuse and modify the data generation function
const generateDummyData = () => {
  const objectTypes = [
    "debris",
    "asteroid",
    "functional_satellite",
    "non_functional_satellite",
  ];
  return Array.from({ length: 100 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 2 + 1.5; // Orbits between 1.5 and 3.5 Earth radii
    return {
      id: i + 1,
      type: objectTypes[Math.floor(Math.random() * objectTypes.length)],
      angle,
      radius,
      y: (Math.random() - 0.5) * 2, // Distribute objects vertically
      size: Math.random() * 0.05 + 0.01,
      speed: (Math.random() * 0.001 + 0.0005) * (Math.random() < 0.5 ? 1 : -1), // Randomize direction
      time: new Date(2024, 9, 5, Math.floor(Math.random() * 24)).toISOString(),
    };
  });
};

// Modify the collision prediction function for orbital mechanics
const predictCollisions = (objects, timeStep = 1, steps = 100) => {
  const collisions = [];
  for (let step = 0; step < steps; step++) {
    const time = new Date(2024, 9, 5 + step * timeStep).toISOString();
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = objects[i];
        const obj2 = objects[j];
        const futureObj1 = {
          x: obj1.radius * Math.cos(obj1.angle + obj1.speed * step),
          y: obj1.y,
          z: obj1.radius * Math.sin(obj1.angle + obj1.speed * step),
        };
        const futureObj2 = {
          x: obj2.radius * Math.cos(obj2.angle + obj2.speed * step),
          y: obj2.y,
          z: obj2.radius * Math.sin(obj2.angle + obj2.speed * step),
        };
        const distance = Math.sqrt(
          Math.pow(futureObj1.x - futureObj2.x, 2) +
            Math.pow(futureObj1.y - futureObj2.y, 2) +
            Math.pow(futureObj1.z - futureObj2.z, 2),
        );
        if (distance < obj1.size + obj2.size) {
          collisions.push({
            object1: obj1.id,
            object2: obj2.id,
            time,
            x: (futureObj1.x + futureObj2.x) / 2,
            y: (futureObj1.y + futureObj2.y) / 2,
            z: (futureObj1.z + futureObj2.z) / 2,
          });
        }
      }
    }
  }
  return collisions;
};

const Earth = () => {
  const earthTexture = useLoader(THREE.TextureLoader, "/assets/3d/earth.jpg");
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial map={earthTexture} />
    </mesh>
  );
};

const SpaceObject = ({ object, onClick }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      object.angle += object.speed;
      meshRef.current.position.x = object.radius * Math.cos(object.angle);
      meshRef.current.position.z = object.radius * Math.sin(object.angle);
      meshRef.current.position.y = object.y;
    }
  });

  const color = {
    debris: "red",
    asteroid: "green",
    functional_satellite: "blue",
    non_functional_satellite: "purple",
  }[object.type];

  return (
    <mesh
      ref={meshRef}
      position={[
        object.radius * Math.cos(object.angle),
        object.y,
        object.radius * Math.sin(object.angle),
      ]}
      onClick={() => onClick(object)}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[object.size, 16, 16]} />
      <meshStandardMaterial color={color} />
      {hovered && (
        <Text
          position={[0, object.size + 0.05, 0]}
          fontSize={0.05}
          color="white"
          anchorX="center"
          anchorY="bottom"
        >
          {`ID: ${object.id}\nType: ${object.type}`}
        </Text>
      )}
    </mesh>
  );
};

const CollisionMarker = ({ collision }) => (
  <mesh position={[collision.x, collision.y, collision.z]}>
    <sphereGeometry args={[0.05, 16, 16]} />
    <meshBasicMaterial color="yellow" />
  </mesh>
);

const Scene = ({ data, collisions, onObjectClick }) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      <Earth />
      {data.map((object) => (
        <SpaceObject key={object.id} object={object} onClick={onObjectClick} />
      ))}
      {collisions.map((collision, index) => (
        <CollisionMarker key={index} collision={collision} />
      ))}
      <OrbitControls />
    </>
  );
};

export default function SpaceDebrisVisualization3D() {
  const [data, setData] = useState([]);
  const [collisions, setCollisions] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);

  useEffect(() => {
    const generatedData = generateDummyData();
    setData(generatedData);
    const predictedCollisions = predictCollisions(generatedData);
    setCollisions(predictedCollisions);
  }, []);

  const handleObjectClick = (object) => {
    setSelectedObject(object);
  };

  return (
    <div className="w-full h-screen flex flex-col md:flex-row">
      <div className="w-full md:w-2/3 h-full">
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
          <Scene
            data={data}
            collisions={collisions}
            onObjectClick={handleObjectClick}
          />
        </Canvas>
      </div>
      <div className="w-full md:w-1/3 p-4 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Space Debris Around Earth</h1>
        {selectedObject && (
          <Alert>
            <Globe className="h-4 w-4" />
            <AlertTitle>Selected Object</AlertTitle>
            <AlertDescription>
              <p>ID: {selectedObject.id}</p>
              <p>Type: {selectedObject.type.replace("_", " ")}</p>
              <p>
                Orbit Radius: {selectedObject.radius.toFixed(2)} Earth radii
              </p>
              <p>Size: {(selectedObject.size * 200).toFixed(2)} m</p>
              <p>
                Angular Velocity: {(selectedObject.speed * 1000).toFixed(4)}{" "}
                rad/s
              </p>
              <p>Time: {new Date(selectedObject.time).toLocaleString()}</p>
            </AlertDescription>
          </Alert>
        )}
        {!selectedObject && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This 3D visualization shows space debris and satellites orbiting
              Earth. The objects are:
              <ul className="list-disc list-inside mt-2">
                <li>Red spheres: Debris</li>
                <li>Green spheres: Asteroids</li>
                <li>Blue spheres: Functional Satellites</li>
                <li>Purple spheres: Non-Functional Satellites</li>
                <li>Yellow spheres: Potential collision points</li>
              </ul>
              Click on an object to see its details. Use your mouse to rotate
              the view and zoom in/out.
            </AlertDescription>
          </Alert>
        )}
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Collision Prediction</AlertTitle>
          <AlertDescription>
            Number of potential collisions: {collisions.length}
            {collisions.length > 0 && (
              <p>Yellow markers indicate potential collision points.</p>
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
