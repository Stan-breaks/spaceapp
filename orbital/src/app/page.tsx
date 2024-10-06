"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Globe, Info, AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Type definitions
interface SpaceObject {
  id: string;
  name: string;
  type: "satellite" | "asteroid" | "debris" | "comet";
  orbitRadius: number;
  speed: number;
  phase: number;
  inclination: number;
  size: number;
  eccentricity: number;
  perihelion?: number;
  aphelion?: number;
  orbitalPeriod?: number;
  position?: THREE.Vector3;
}

interface Collision {
  obj1: SpaceObject;
  obj2: SpaceObject;
  distance: number;
}

const EARTH_RADIUS = 1;
const MIN_ORBIT_RADIUS = EARTH_RADIUS * 1.5;
const MAX_ORBIT_RADIUS = EARTH_RADIUS * 10;

const generateRandomObject = (type: SpaceObject["type"]): SpaceObject => {
  const orbitRadius =
    Math.random() * (MAX_ORBIT_RADIUS - MIN_ORBIT_RADIUS) + MIN_ORBIT_RADIUS;
  const speed = (Math.random() * 0.2 + 0.1) * (Math.random() < 0.5 ? 1 : -1);
  const eccentricity = Math.random() * 0.5;
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: `${type}-${Math.floor(Math.random() * 1000)}`,
    type,
    orbitRadius,
    speed,
    phase: Math.random() * Math.PI * 2,
    inclination: (Math.random() * Math.PI) / 3,
    size: type === "debris" ? 0.01 : Math.random() * 0.05 + 0.02,
    eccentricity,
  };
};

const generateRandomData = (count: number): SpaceObject[] => {
  const types: SpaceObject["type"][] = ["satellite", "asteroid", "debris"];
  return Array.from({ length: count }, () => {
    const type = types[Math.floor(Math.random() * types.length)];
    return generateRandomObject(type);
  });
};

const fetchNASAData = async (): Promise<SpaceObject[]> => {
  const response = await fetch(
    "https://data.nasa.gov/resource/b67r-rgxc.json?$limit=10",
  );
  const data = await response.json();
  return data.map((item: any) => ({
    id: item.object,
    name: item.object_name || item.object,
    type: item.object.startsWith("P/") ? "comet" : "asteroid",
    orbitRadius: Math.max(
      parseFloat(item.q_au_1) * EARTH_RADIUS,
      MIN_ORBIT_RADIUS,
    ),
    speed: 0.1 / parseFloat(item.p_yr),
    phase: Math.random() * Math.PI * 2,
    inclination: parseFloat(item.i_deg) * (Math.PI / 180),
    size: 0.05,
    eccentricity: parseFloat(item.e),
    perihelion: parseFloat(item.q_au_1),
    aphelion: parseFloat(item.q_au_2),
    orbitalPeriod: parseFloat(item.p_yr),
  }));
};

const detectCollisions = (objects: SpaceObject[]): Collision[] => {
  const collisions: Collision[] = [];
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const obj1 = objects[i];
      const obj2 = objects[j];
      if (obj1.position && obj2.position) {
        const distance = obj1.position.distanceTo(obj2.position);
        if (distance < obj1.size + obj2.size) {
          collisions.push({ obj1, obj2, distance });
        }
      }
    }
  }
  return collisions;
};

const Earth: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(
    () => new THREE.TextureLoader().load("/assets/3d/earth.jpg"),
    [],
  );

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

interface SpaceObjectProps {
  object: SpaceObject;
  onClick: (object: SpaceObject) => void;
  setPosition: (id: string, position: THREE.Vector3) => void;
}

const SpaceObject: React.FC<SpaceObjectProps> = ({
  object,
  onClick,
  setPosition,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime() * object.speed;
      const a = object.orbitRadius;
      const b = a * Math.sqrt(1 - object.eccentricity * object.eccentricity);
      const angle = t + object.phase;

      const x = a * Math.cos(angle) * Math.cos(object.inclination);
      const y = b * Math.sin(angle);
      const z = a * Math.cos(angle) * Math.sin(object.inclination);

      meshRef.current.position.set(x, y, z);
      setPosition(object.id, new THREE.Vector3(x, y, z));
    }
  });

  const color = {
    satellite: "blue",
    asteroid: "red",
    debris: "gray",
    comet: "green",
  }[object.type];

  return (
    <mesh ref={meshRef} onClick={() => onClick(object)}>
      <sphereGeometry args={[object.size, 16, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

interface SceneProps {
  data: SpaceObject[];
  onObjectClick: (object: SpaceObject) => void;
  setPosition: (id: string, position: THREE.Vector3) => void;
}

const Scene: React.FC<SceneProps> = ({ data, onObjectClick, setPosition }) => {
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
        <SpaceObject
          key={object.id}
          object={object}
          onClick={onObjectClick}
          setPosition={setPosition}
        />
      ))}
      <OrbitControls />
    </>
  );
};

interface ObjectTypeDistributionProps {
  data: SpaceObject[];
}

const ObjectTypeDistribution: React.FC<ObjectTypeDistributionProps> = ({
  data,
}) => {
  const typeCount = data.reduce<Record<string, number>>((acc, obj) => {
    acc[obj.type] = (acc[obj.type] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(typeCount).map(([type, count]) => ({
    type,
    count,
  }));

  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-2">Object Type Distribution</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <XAxis dataKey="type" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface CollisionAlertProps {
  collision: Collision;
}

const CollisionAlert: React.FC<CollisionAlertProps> = ({ collision }) => (
  <Alert className="mb-4 bg-red-100 border-red-400">
    <AlertTriangle className="h-4 w-4 text-red-600" />
    <AlertTitle className="text-red-700">Collision Detected!</AlertTitle>
    <AlertDescription>
      <p>Objects involved:</p>
      <ul className="list-disc list-inside">
        <li>
          {collision.obj1.name} ({collision.obj1.type})
        </li>
        <li>
          {collision.obj2.name} ({collision.obj2.type})
        </li>
      </ul>
      <p>Distance: {collision.distance.toFixed(4)} units</p>
    </AlertDescription>
  </Alert>
);

const SpaceDebrisVisualization3D: React.FC = () => {
  const [data, setData] = useState<SpaceObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<SpaceObject | null>(
    null,
  );
  const [collisions, setCollisions] = useState<Collision[]>([]);
  const objectPositions = useRef<Record<string, THREE.Vector3>>({});

  const generateNewSample = async () => {
    const nasaData = await fetchNASAData();
    const randomData = generateRandomData(70);
    setData([...nasaData, ...randomData]);
    setSelectedObject(null);
    setCollisions([]);
  };

  useEffect(() => {
    generateNewSample();
  }, []);

  const handleObjectClick = (object: SpaceObject) => {
    setSelectedObject(object);
  };

  const setPosition = (id: string, position: THREE.Vector3) => {
    objectPositions.current[id] = position;
  };

  useEffect(() => {
    const checkCollisions = () => {
      const objects = data.map((obj) => ({
        ...obj,
        position: objectPositions.current[obj.id],
      }));
      const newCollisions = detectCollisions(objects);
      if (newCollisions.length > 0) {
        setCollisions(newCollisions);
      }
    };

    const interval = setInterval(checkCollisions, 1000);

    return () => clearInterval(interval);
  }, [data]);

  return (
    <div className="w-full h-screen flex flex-col md:flex-row">
      <div className="w-full md:w-2/3 h-full relative">
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
          <Scene
            data={data}
            onObjectClick={handleObjectClick}
            setPosition={setPosition}
          />
        </Canvas>
        <button
          className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={generateNewSample}
        >
          Generate New Sample
        </button>
      </div>
      <div className="w-full md:w-1/3 p-4 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Space Objects and Debris</h1>
        {collisions.map((collision, index) => (
          <CollisionAlert key={index} collision={collision} />
        ))}
        {selectedObject ? (
          <Alert>
            <Globe className="h-4 w-4" />
            <AlertTitle>Selected Object</AlertTitle>
            <AlertDescription>
              <p>Name: {selectedObject.name}</p>
              <p>Type: {selectedObject.type}</p>
              <p>Orbit Radius: {selectedObject.orbitRadius.toFixed(2)}</p>
              <p>Speed: {Math.abs(selectedObject.speed).toFixed(5)}</p>
              <p>Size: {selectedObject.size.toFixed(3)}</p>
              <p>Eccentricity: {selectedObject.eccentricity.toFixed(4)}</p>
              {selectedObject.perihelion && (
                <p>Perihelion: {selectedObject.perihelion.toFixed(4)} AU</p>
              )}
              {selectedObject.aphelion && (
                <p>Aphelion: {selectedObject.aphelion.toFixed(4)} AU</p>
              )}
              {selectedObject.orbitalPeriod && (
                <p>
                  Orbital Period: {selectedObject.orbitalPeriod.toFixed(2)}{" "}
                  years
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This 3D visualization shows a combination of NASA data and
              randomly generated space objects orbiting Earth. The objects are:
              <ul className="list-disc list-inside mt-2">
                <li>Green spheres: Comets (NASA data)</li>
                <li>Red spheres: Asteroids (NASA data and random)</li>
                <li>Blue spheres: Satellites (random)</li>
                <li>Gray spheres: Debris (random)</li>
              </ul>
              Click on any object for more information.
            </AlertDescription>
          </Alert>
        )}
        <ObjectTypeDistribution data={data} />
      </div>
    </div>
  );
};

export default SpaceDebrisVisualization3D;
