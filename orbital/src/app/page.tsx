"use client";

import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars, Text } from "@react-three/drei";
import * as THREE from "three";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Globe, AlertTriangle, Info } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Function to fetch data from NASA API
const fetchNASAData = async () => {
  const response = await fetch("https://data.nasa.gov/resource/b67r-rgxc.json");
  const data = await response.json();
  return data.map((item) => ({
    id: item.object,
    name: item.object_name || item.object,
    epoch: new Date(item.epoch_tdb),
    eccentricity: parseFloat(item.e),
    inclination: parseFloat(item.i_deg),
    perihelion: parseFloat(item.q_au_1),
    aphelion: parseFloat(item.q_au_2),
    orbitalPeriod: parseFloat(item.p_yr),
    type: determineObjectType(item),
    size: Math.random() * 0.05 + 0.01, // Random size for visualization
    speed: (Math.random() * 0.001 + 0.0005) * (Math.random() < 0.5 ? 1 : -1), // Random speed for visualization
  }));
};

// Function to fetch data from Celestrak API
const fetchCelestrakData = async () => {
  const response = await fetch(
    "https://celestrak.org/NORAD/elements/gp.php?NAME=COSMOS%202251%20DEB&FORMAT=JSON",
  );
  const data = await response.json();
  return data.map((item) => ({
    id: item.OBJECT_ID,
    name: item.OBJECT_NAME,
    epoch: new Date(item.EPOCH),
    meanMotion: parseFloat(item.MEAN_MOTION),
    eccentricity: parseFloat(item.ECCENTRICITY),
    inclination: parseFloat(item.INCLINATION),
    rightAscension: parseFloat(item.RA_OF_ASC_NODE),
    argOfPericenter: parseFloat(item.ARG_OF_PERICENTER),
    meanAnomaly: parseFloat(item.MEAN_ANOMALY),
    type: "debris",
    size: 0.02, // Fixed size for debris
    speed: (parseFloat(item.MEAN_MOTION) * (2 * Math.PI)) / (24 * 60 * 60), // Convert mean motion to radians per second
  }));
};

// Function to determine object type based on available data
const determineObjectType = (item) => {
  if (item.object.startsWith("P/")) return "comet";
  if (item.object.includes("asteroid")) return "asteroid";
  return "unknown";
};

// Function to predict collisions
const predictCollisions = (objects, timeStep = 1, steps = 100) => {
  const collisions = [];
  for (let step = 0; step < steps; step++) {
    const time = new Date(Date.now() + step * timeStep * 60 * 60 * 1000); // step hours in the future
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = objects[i];
        const obj2 = objects[j];
        const pos1 = calculatePosition(obj1, time);
        const pos2 = calculatePosition(obj2, time);
        const distance = Math.sqrt(
          Math.pow(pos1.x - pos2.x, 2) +
            Math.pow(pos1.y - pos2.y, 2) +
            Math.pow(pos1.z - pos2.z, 2),
        );
        if (distance < 0.1) {
          // Arbitrary collision distance
          collisions.push({
            object1: obj1,
            object2: obj2,
            time: time,
            position: {
              x: (pos1.x + pos2.x) / 2,
              y: (pos1.y + pos2.y) / 2,
              z: (pos1.z + pos2.z) / 2,
            },
          });
        }
      }
    }
  }
  return collisions;
};

// Function to calculate position based on orbital elements
const calculatePosition = (object, time) => {
  const t = (time.getTime() - object.epoch.getTime()) / (1000 * 60 * 60 * 24); // time difference in days
  const n = (object.meanMotion * (2 * Math.PI)) / 86400; // mean motion in radians per second
  const M = (object.meanAnomaly + n * t) % (2 * Math.PI);

  // Solve Kepler's equation (simplified)
  let E = M;
  for (let i = 0; i < 5; i++) {
    E = M + object.eccentricity * Math.sin(E);
  }

  const xOrbit = Math.cos(E) - object.eccentricity;
  const yOrbit =
    Math.sqrt(1 - object.eccentricity * object.eccentricity) * Math.sin(E);

  // Rotate to the orbital plane
  const cosω = Math.cos(object.argOfPericenter);
  const sinω = Math.sin(object.argOfPericenter);
  const cosΩ = Math.cos(object.rightAscension);
  const sinΩ = Math.sin(object.rightAscension);
  const cosι = Math.cos(object.inclination);
  const sinι = Math.sin(object.inclination);

  const x =
    (cosω * cosΩ - sinω * sinΩ * cosι) * xOrbit +
    (-sinω * cosΩ - cosω * sinΩ * cosι) * yOrbit;
  const y =
    (cosω * sinΩ + sinω * cosΩ * cosι) * xOrbit +
    (-sinω * sinΩ + cosω * cosΩ * cosι) * yOrbit;
  const z = sinω * sinι * xOrbit + cosω * sinι * yOrbit;

  return { x, y, z };
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

const SpaceObject = ({ object, onClick, time }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      const position = calculatePosition(object, time);
      meshRef.current.position.set(position.x, position.y, position.z);
    }
  });

  const color = {
    comet: "blue",
    asteroid: "red",
    debris: "gray",
    unknown: "purple",
  }[object.type];

  return (
    <mesh
      ref={meshRef}
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
          {`Name: ${object.name}\nType: ${object.type}`}
        </Text>
      )}
    </mesh>
  );
};

const CollisionMarker = ({ collision, onClick }) => (
  <mesh
    position={[
      collision.position.x,
      collision.position.y,
      collision.position.z,
    ]}
    onClick={() => onClick(collision)}
  >
    <sphereGeometry args={[0.05, 16, 16]} />
    <meshBasicMaterial color="yellow" />
  </mesh>
);

const Scene = ({ data, collisions, onObjectClick, onCollisionClick, time }) => {
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
          time={time}
        />
      ))}
      {collisions.map((collision, index) => (
        <CollisionMarker
          key={index}
          collision={collision}
          onClick={onCollisionClick}
        />
      ))}
      <OrbitControls />
    </>
  );
};

const ObjectTypeDistribution = ({ data }) => {
  const typeCount = data.reduce((acc, obj) => {
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

export default function SpaceDebrisVisualization3D() {
  const [data, setData] = useState([]);
  const [collisions, setCollisions] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [selectedCollision, setSelectedCollision] = useState(null);
  const [time, setTime] = useState(new Date());
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const nasaData = await fetchNASAData();
      const celestrakData = await fetchCelestrakData();
      const combinedData = [...nasaData, ...celestrakData];
      setData(combinedData);
      const predictedCollisions = predictCollisions(combinedData);
      setCollisions(predictedCollisions);
    };
    loadData();
  }, []);

  useEffect(() => {
    let intervalId;
    if (isPlaying) {
      intervalId = setInterval(() => {
        setTime((prevTime) => {
          const newTime = new Date(prevTime.getTime() + 3600000); // Advance by 1 hour
          return newTime;
        });
      }, 1000); // Update every second
    }
    return () => clearInterval(intervalId);
  }, [isPlaying]);

  const handleObjectClick = (object) => {
    setSelectedObject(object);
    setSelectedCollision(null);
  };

  const handleCollisionClick = (collision) => {
    setSelectedCollision(collision);
    setSelectedObject(null);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="w-full h-screen flex flex-col md:flex-row">
      <div className="w-full md:w-2/3 h-full relative">
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
          <Scene
            data={data}
            collisions={collisions}
            onObjectClick={handleObjectClick}
            onCollisionClick={handleCollisionClick}
            time={time}
          />
        </Canvas>
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded">
          {time.toLocaleString()}
        </div>
        <button
          className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={togglePlayPause}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
      <div className="w-full md:w-1/3 p-4 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Space Objects and Debris</h1>
        {selectedObject && (
          <Alert>
            <Globe className="h-4 w-4" />
            <AlertTitle>Selected Object</AlertTitle>
            <AlertDescription>
              <p>Name: {selectedObject.name}</p>
              <p>Type: {selectedObject.type}</p>
              <p>Eccentricity: {selectedObject.eccentricity.toFixed(4)}</p>
              <p>Inclination: {selectedObject.inclination.toFixed(2)}°</p>
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
              {selectedObject.meanMotion && (
                <p>
                  Mean Motion: {selectedObject.meanMotion.toFixed(4)} rev/day
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
        {selectedCollision && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Collision Details</AlertTitle>
            <AlertDescription>
              <p>Time: {selectedCollision.time.toLocaleString()}</p>
              <p>Object 1: {selectedCollision.object1.name}</p>
              <p>Object 2: {selectedCollision.object2.name}</p>
              <p>
                Position: ({selectedCollision.position.x.toFixed(2)},{" "}
                {selectedCollision.position.y.toFixed(2)},{" "}
                {selectedCollision.position.z.toFixed(2)})
              </p>
            </AlertDescription>
          </Alert>
        )}
        {!selectedObject && !selectedCollision && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This 3D visualization shows space objects and debris using NASA
              and Celestrak data. The objects are:
              <ul className="list-disc list-inside mt-2">
                <li>Blue spheres: Comets</li>
                <li>Red spheres: Asteroids</li>
                <li>Gray spheres: Debris</li>
                <li>Purple spheres: Unknown objects</li>
                <li>Yellow spheres: Potential collisions</li>
              </ul>
              Click on any object or collision marker for more information.
            </AlertDescription>
          </Alert>
        )}
        <ObjectTypeDistribution data={data} />
      </div>
    </div>
  );
}
